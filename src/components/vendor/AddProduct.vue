<script setup lang="ts">
import { reactive, ref, onUnmounted, computed, onMounted } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import ImageCropper from './ImageCropper.vue'
import { useVendorDashboardStore } from '../../stores/vendor/dashboardStores'
import { Alert } from '../composable/Alert'
import { useImageUpload } from '../../composables/useImageUpload'
import { XMarkIcon } from '@heroicons/vue/24/outline'

/* ================================================================== */
/* Emits                                                             */
/* ================================================================== */
const emit = defineEmits<{
  close: []
}>()

/* ------------------------------------------------------------------ */
/* Constants / Stores                                                 */
/* ------------------------------------------------------------------ */
const categories = [
  'Native Delicacies', 'Dried Fish & Seafood', 'Fruits & Produce', 'Local Snacks',
  'Herbal & Wellness Products', 'Coffee & Cacao', 'Honey Products', 'Handicrafts',
  'Woodcrafts', 'Woven Products', 'Souvenir Items', 'Condiments & Spices', 'Apparel & Accessories'
]

const dashboardStore = useVendorDashboardStore()
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Get vendor municipality from store
const vendorMunicipality = computed(() => {
  return dashboardStore.vendor?.address?.city || ''
})

// Character count for description with styling
const descriptionStats = computed(() => {
  const length = form.description.length
  const maxLength = 2000
  
  return {
    count: length,
    max: maxLength,
    percentage: (length / maxLength) * 100,
    isWarning: length > maxLength * 0.8,
    isError: length > maxLength
  }
})


const editorOptions = {
  theme: 'snow',
  placeholder: 'Describe your product in detail...',
  modules: {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  },

  bounds: document.body,
  debug: false,
  readOnly: false,
  preserveWhitespace: false
}

const imageUpload = useImageUpload({
  apiBaseUrl: API_BASE_URL,
  temporary: true,
  onProgress: (progress) => {
    console.log(`Uploading ${progress.fileName}: ${progress.percentage}%`)
  },
  onError: (error, fileName) => {
    Alert(`Failed to upload ${fileName}: ${error.message}`, 'error', 'var(--secondary-color)', 3000)
  },
  onSuccess: (image, fileName) => {
    console.log(`Successfully uploaded ${fileName}:`, image)
  }
})

const isUploading = ref(false)
const isSubmitting = ref(false)

const showCropper = ref(false)
const showImagePreview = ref(false)

const currentImageSrc = ref('')
const currentImageType = ref<'main' | 'option'>('main')
const currentOptionIndex = ref(0)

const pendingImages = ref<string[]>([])

const pendingIndex = ref<number>(-1)

const MAX_FILE_SIZE = 100 * 1024 * 1024 
const COMPRESSION_QUALITY = 0.8 
const MAX_DIMENSION = 2560 


const imageBlobsForUpload = ref<Array<{ blob: Blob; fileName: string; previewUrl: string }>>([]) 
const optionImageBlobsForUpload = ref<Map<number, { blob: Blob; fileName: string; previewUrl: string }>>(new Map())

const form = reactive({
  name: '',
  description: '',
  price: 0,
  stock: 0,
  imageUrls: [] as string[], 
  categories: [] as string[],
  isOption: false,
  option: [] as {
    label: string
    price: number
    stock: number
    imageUrl: string | any,
    isHot?: boolean
    promotion?: {
      isActive: boolean
      discountType: 'percentage' | 'fixed' | 'none'
      discountValue: number
      startDate?: string
      endDate?: string
      freeShipping: boolean
    }
  }[],
  promotion: {
    isActive: false,
    discountType: 'none' as 'percentage' | 'fixed' | 'none',
    discountValue: 0,
    startDate: '',
    endDate: '',
    freeShipping: false
  },
  // J&T Shipping Profile
  weightKg: null as number | null,
  lengthCm: null as number | null,
  widthCm: null as number | null,
  heightCm: null as number | null,
  shippingDiscountType: 'NONE' as 'NONE' | 'FIXED' | 'PERCENT',
  shippingDiscountValue: 0
})

onUnmounted(async () => {
  await imageUpload.cleanupTempImages()
  
  imageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
  optionImageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
})


function compressImage(file: File, maxSizeKB = 1024, quality = COMPRESSION_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      const maxDim = MAX_DIMENSION
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim)
          width = maxDim
        } else {
          width = Math.round((width / height) * maxDim)
          height = maxDim
        }
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      // Try different quality levels to get under size limit
      const tryCompress = (currentQuality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'))
            return
          }
          
          // If size is still too large and quality can be reduced further
          if (blob.size > maxSizeKB * 1024 && currentQuality > 0.2) {
            console.log(`Compression at quality ${currentQuality} resulted in ${(blob.size/1024/1024).toFixed(2)}MB, trying lower quality`)
            // Try a lower quality
            tryCompress(Math.max(0.2, currentQuality - 0.1))
          } else {
            console.log(`Final compression: ${(blob.size/1024/1024).toFixed(2)}MB at quality ${currentQuality}`)
            resolve(blob)
          }
        }, file.type || 'image/jpeg', currentQuality)
      }
      
      tryCompress(quality)
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    img.src = URL.createObjectURL(file)
  })
}

/* ------------------------------------------------------------------ */
/* File Size Validation                                               */
/* ------------------------------------------------------------------ */
function validateFileSize(file: File): boolean {
  const maxSize = 100 * 1024 * 1024 // 100MB original file limit
  if (file.size > maxSize) {
    Alert(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed: 100MB`, 'warning', 'var(--secondary-color)', 3000)
    return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Category Toggle (mutate instead of reassign reactive array)        */
/* ------------------------------------------------------------------ */
function toggleCategory(cat: string) {
  const idx = form.categories.indexOf(cat)
  if (idx > -1) {
    form.categories.splice(idx, 1)
  } else if (form.categories.length < 3) {
    form.categories.push(cat)
  }
}

/* ------------------------------------------------------------------ */
/* Options                                                            */
/* ------------------------------------------------------------------ */
function addOption() {
  form.option.push({ label: '', price: 0, stock: 0, imageUrl: '', isHot: false })
}
function removeOption(index: number) {
  form.option.splice(index, 1)
}

/* ------------------------------------------------------------------ */
/* File Selection with Enhanced Large File Handling                  */
/* ------------------------------------------------------------------ */
async function handleFileSelect(files: FileList | null, type: 'main' | 'option', optionIndex?: number) {
  if (!files || files.length === 0) return

  currentImageType.value = type
  if (optionIndex !== undefined) currentOptionIndex.value = optionIndex

  // Enhanced file validation for large files
  const validFiles = Array.from(files).filter(file => {
    // Check file type first
    if (!file.type.startsWith('image/')) {
      Alert(`"${file.name}" is not a valid image file.`, 'warning', 'var(--secondary-color)', 3000)
      return false
    }
    
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      Alert(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed: 100MB`, 'warning', 'var(--secondary-color)', 3000)
      return false
    }
  
    console.log(`Processing file: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}`)
    return true
  })

  if (validFiles.length === 0) {
    Alert('No valid images selected. Please try again.', 'warning', 'var(--secondary-color', 2000)
    return
  }

  try {
    Alert(`Processing ${validFiles.length} image(s)...`, 'info', 'var(--primary-color)', 2000)
    
    const imagePromises = validFiles.map(async (file, index) => {
      try {
        Alert(`Compressing image ${index + 1}/${validFiles.length}...`, 'info', 'var(--primary-color)', 1000)
        
        // Use more aggressive compression for very large files
        const targetSizeKB = file.size > 10 * 1024 * 1024 ? 512 : 1024 // 512KB for files > 10MB
        const compressedBlob = await compressImage(file, targetSizeKB)
        
        console.log(`Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`)

        // Convert compressed blob to data URL with error handling
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result as string)
          reader.onerror = () => reject(new Error(`Failed to read compressed file: ${file.name}`))
          reader.readAsDataURL(compressedBlob)
        })
      } catch (error) {
        console.error('Error compressing image:', error)
        Alert(`Failed to compress "${file.name}". Using original file.`, 'warning', 'var(--secondary-color)', 2000)
        // Fallback to original file if compression fails
        return fileToDataUrl(file)
      }
    })
    
    const images = await Promise.all(imagePromises)
    pendingImages.value = images
    showImagePreview.value = true
    pendingIndex.value = -1
    
    Alert(`Successfully processed ${images.length} image(s)!`, 'success', 'var(--primary-color)', 1500)
  } catch (error) {
    console.error('Error processing images:', error)
    Alert('Error processing images. Please try again with smaller files.', 'error', 'var(--secondary-color)', 3000)
  }
}

async function handleMainImageUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  await handleFileSelect(files, 'main')
}

async function handleOptionImageUpload(e: Event, index: number) {
  const files = (e.target as HTMLInputElement).files
  await handleFileSelect(files, 'option', index)
}

/* ------------------------------------------------------------------ */
/* Choose Image → Crop                                                */
/* ------------------------------------------------------------------ */
function selectImageToCrop(imageSrc: string) {
  const idx = pendingImages.value.indexOf(imageSrc)
  pendingIndex.value = idx
  currentImageSrc.value = imageSrc
  showImagePreview.value = false
  showCropper.value = true
}

/* ------------------------------------------------------------------ */
/* Skip Cropping → Upload all raw                                     */
/* ------------------------------------------------------------------ */
async function skipCropping() {
  try {
    isUploading.value = true
    await uploadImagesDirectly()
  } catch (err) {
    console.error(err)
    Alert('Failed to upload images. Please try again.', 'error', 'var(--secondary-color)', 2000)
  } finally {
    isUploading.value = false
  }
}

/**
 * Store pending images as blobs for upload on submit (no upload yet)
 */
async function uploadImagesDirectly() {
  try {
    const imagesToUpload =
      currentImageType.value === 'main'
        ? [...pendingImages.value]
        : [pendingImages.value[0]]

    // Convert data URLs to blobs and store them
    imagesToUpload.forEach((imageSrc, index) => {
      const blob = dataUrlToBlob(imageSrc)
      const fileName = `image-${Date.now()}-${index}.jpg`
      const previewUrl = URL.createObjectURL(blob)
      
      if (currentImageType.value === 'main') {
        imageBlobsForUpload.value.push({ blob, fileName, previewUrl })
        form.imageUrls.push(previewUrl) // Use blob URL for preview
      } else {
        optionImageBlobsForUpload.value.set(currentOptionIndex.value, { blob, fileName, previewUrl })
        form.option[currentOptionIndex.value].imageUrl = previewUrl
      }
    })

    Alert(`Successfully processed ${imagesToUpload.length} image(s)! They will be uploaded when you create the product.`, 'success', 'var(--primary-color)', 1500)
  } catch (error) {
    console.error('Failed to process images:', error)
    Alert(`Processing failed: ${error.message || 'Unknown error'}. Try a smaller file or different format.`, 'error', 'var(--secondary-color)', 3000)
    throw error
  } finally {
    pendingImages.value = []
    showImagePreview.value = false
  }
}

function updateFormWithImage(url: string) {
  if (currentImageType.value === 'main') {
    form.imageUrls.push(url)
  } else {
    form.option[currentOptionIndex.value].imageUrl = url
  }
}

/* ------------------------------------------------------------------ */
/* Crop Result Type                                                   */
/* ------------------------------------------------------------------ */
type CropResult =
  | string
  | {
    blob: Blob
    url: string
    width: number
    height: number
    format?: string
  }

/* ------------------------------------------------------------------ */
/* Handle Crop Complete (child emits)                                 */
/* ------------------------------------------------------------------ */
async function handleCropComplete(cropped: CropResult) {
  let blob: Blob
  let tempUrl: string | null = null
  let filename = 'cropped-image.jpg'

  try {
    // Normalize incoming payload
    if (typeof cropped === 'string') {
      tempUrl = cropped
      const resp = await fetch(cropped)
      blob = await resp.blob()
      filename = inferFilenameFromType(blob.type) ?? filename
    } else {
      blob = cropped.blob
      tempUrl = cropped.url
      filename =
        inferFilenameFromType(cropped.blob.type) ??
        inferFilenameFromType(cropped.format) ??
        filename
    }

    // Additional compression for cropped images if they're too large
    if (blob.size > MAX_FILE_SIZE) {
      const compressedBlob = await compressImage(new File([blob], filename), 1024, 0.7)
      blob = compressedBlob
    }

    // Store blob locally for upload on submit (not uploading yet)
    const previewUrl = URL.createObjectURL(blob)
    
    if (currentImageType.value === 'main') {
      imageBlobsForUpload.value.push({ blob, fileName: filename, previewUrl })
      form.imageUrls.push(previewUrl) // Use blob URL for preview
    } else {
      optionImageBlobsForUpload.value.set(currentOptionIndex.value, { blob, fileName: filename, previewUrl })
      form.option[currentOptionIndex.value].imageUrl = previewUrl
    }

    // Remove processed image from pending queue
    if (pendingIndex.value > -1) {
      pendingImages.value.splice(pendingIndex.value, 1)
    } else {
      const rmIdx = pendingImages.value.indexOf(currentImageSrc.value)
      if (rmIdx > -1) pendingImages.value.splice(rmIdx, 1)
    }

    // Move to next image or close preview
    if (currentImageType.value === 'main' && pendingImages.value.length > 0) {
      showImagePreview.value = true
    } else {
      pendingImages.value = []
      showImagePreview.value = false
    }

    currentImageSrc.value = ''
    pendingIndex.value = -1
    showCropper.value = false
    
    Alert('Image processed successfully! It will be uploaded when you create the product.', 'success', 'var(--primary-color)', 1500)
  } catch (error) {
    console.error('Failed to process cropped image:', error)
    Alert('Failed to process image. Please try again.', 'error', 'var(--secondary-color)', 2000)
  } finally {
    if (tempUrl?.startsWith('blob:')) URL.revokeObjectURL(tempUrl)
  }
}

/* ------------------------------------------------------------------ */
/* Remove Image from Form (and Cloudinary)                            */
/* ------------------------------------------------------------------ */
function removeImage(index: number) {
  const imageUrl = form.imageUrls[index]
  
  // If it's a blob URL (local preview), just revoke it and remove from storage
  if (imageUrl.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl)
    
    // Remove from blob storage
    const blobIndex = imageBlobsForUpload.value.findIndex(img => img.previewUrl === imageUrl)
    if (blobIndex !== -1) {
      imageBlobsForUpload.value.splice(blobIndex, 1)
    }
  } else {
    // If it's a Cloudinary URL, delete from Cloudinary
    const publicId = extractPublicIdFromUrl(imageUrl)
    if (publicId) {
      imageUpload.deleteImage(publicId).catch(err => {
        console.error('Failed to delete image from Cloudinary:', err)
      })
    }
  }
  
  // Remove from form
  form.imageUrls.splice(index, 1)
}

function removeOptionImage(optionIndex: number) {
  const imageUrl = form.option[optionIndex].imageUrl
  
  if (typeof imageUrl === 'string') {
    // If it's a blob URL (local preview), just revoke it and remove from storage
    if (imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl)
      optionImageBlobsForUpload.value.delete(optionIndex)
    } else {
      // If it's a Cloudinary URL, delete from Cloudinary
      const publicId = extractPublicIdFromUrl(imageUrl)
      if (publicId) {
        imageUpload.deleteImage(publicId).catch(err => {
          console.error('Failed to delete option image from Cloudinary:', err)
        })
      }
    }
  }
  
  form.option[optionIndex].imageUrl = ''
}

/**
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns public_id or null
 */
function extractPublicIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname || ''
    // Ensure this is a Cloudinary URL
    if (!hostname.includes('cloudinary.com')) return null

    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    const uploadIndex = pathParts.indexOf('upload')
    if (uploadIndex === -1) return null

    const relevantParts = pathParts.slice(uploadIndex + 1)
    const startIndex = relevantParts[0]?.startsWith('v') ? 1 : 0
    const publicIdWithExt = relevantParts.slice(startIndex).join('/')

    // Decode in case of encoded characters and strip extension
    const decoded = decodeURIComponent(publicIdWithExt || '')
    const lastDotIndex = decoded.lastIndexOf('.')
    const publicId = lastDotIndex > -1 ? decoded.substring(0, lastDotIndex) : decoded

    return publicId || null
  } catch (error) {
    console.error('Failed to extract public_id from URL:', error)
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Cancel Cropping                                                    */
/* ------------------------------------------------------------------ */
function handleCropCancel() {
  showCropper.value = false
  currentImageSrc.value = ''
  pendingIndex.value = -1

  if (currentImageType.value === 'main' && pendingImages.value.length > 0) {
    showImagePreview.value = true
  } else {
    pendingImages.value = []
    showImagePreview.value = false
  }
}

function cancelImageSelection() {
  pendingImages.value = []
  showImagePreview.value = false
  currentImageSrc.value = ''
  pendingIndex.value = -1
}

function inferFilenameFromType(mime?: string | null): string | null {
  if (!mime) return null;
  switch (mime.toLowerCase()) {
    case 'image/png': return 'cropped-image.png';
    case 'image/webp': return 'cropped-image.webp';
    case 'image/avif': return 'cropped-image.avif';
    case 'image/jpeg':
    case 'image/jpg': return 'cropped-image.jpg';
    default: return 'cropped-image.jpg';
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

/** Faster + safer than fetch() on a data URL */
function dataUrlToBlob(dataUrl: string): Blob {
  // data:[mime];base64,...
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const binary = atob(base64)
  const len = binary.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

function capitalizeWords(str) {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function submitProduct() {
  if (form.imageUrls.length <= 0 && form.option.length <= 0) {
    Alert('Please add atleast one image!', 'warning', 'var(--secondary-color)', 1500)
    return
  }

  // Use vendor's municipality from their profile
  const municipality = capitalizeWords(vendorMunicipality.value)
  if (!municipality) {
    Alert('Please complete your store profile with your municipality!', 'warning', 'var(--secondary-color)', 2000)
    return
  }

  isSubmitting.value = true

  try {
    // Step 1: Upload all images to Cloudinary first
    Alert('Uploading images...', 'info', 'var(--primary-color)', 2000)
    
    const uploadedImageUrls: string[] = []
    const uploadedPublicIds: string[] = []
    
    // Upload main product images
    for (const imgData of imageBlobsForUpload.value) {
      try {
        const uploadedImage = await imageUpload.uploadImage(imgData.blob, imgData.fileName, true)
        uploadedImageUrls.push(uploadedImage.url)
        uploadedPublicIds.push(uploadedImage.public_id)
        
        // Replace blob URL with Cloudinary URL
        const index = form.imageUrls.indexOf(imgData.previewUrl)
        if (index !== -1) {
          form.imageUrls[index] = uploadedImage.url
        }
        
        // Revoke blob URL
        URL.revokeObjectURL(imgData.previewUrl)
      } catch (error) {
        console.error('Failed to upload image:', error)
        throw new Error('Image upload failed')
      }
    }
    
    // Upload option images
    for (const [optionIndex, imgData] of optionImageBlobsForUpload.value.entries()) {
      try {
        const uploadedImage = await imageUpload.uploadImage(imgData.blob, imgData.fileName, true)
        uploadedImageUrls.push(uploadedImage.url)
        uploadedPublicIds.push(uploadedImage.public_id)
        
        // Replace blob URL with Cloudinary URL
        if (form.option[optionIndex]) {
          form.option[optionIndex].imageUrl = uploadedImage.url
        }
        
        // Revoke blob URL
        URL.revokeObjectURL(imgData.previewUrl)
      } catch (error) {
        console.error('Failed to upload option image:', error)
        throw new Error('Option image upload failed')
      }
    }
    
    Alert('Creating product...', 'info', 'var(--primary-color)', 1500)
    
    // Step 2: Create the product with uploaded image URLs
    const payload = {
      ...form,
      municipality, // Use vendor's municipality
      price: form.isOption ? form.option[0].price : form.price,
      stock: form.isOption ? 0 : form.stock,
      option: form.isOption ? form.option : []
    }
    
    await dashboardStore.uploadProducts(payload)
    
    // Step 3: Mark images as permanent now that product is successfully created
    if (uploadedPublicIds.length > 0) {
      await imageUpload.confirmImages(uploadedPublicIds).catch(err => {
        console.error('Failed to confirm images as permanent:', err)
        // Don't fail the whole operation if confirmation fails
      })
    }
    
    // Clear blob storage
    imageBlobsForUpload.value = []
    optionImageBlobsForUpload.value.clear()
    
    // Reset the upload state
    imageUpload.reset()
    
    Alert('Product successfully created!', 'success', 'var(--primary-color)', 1500)
    
    // Reset form
    Object.assign(form, {
      name: '',
      description: '',
      price: 0,
      stock: 0,
      imageUrls: [],
      categories: [],
      isOption: false,
      option: [],
      weightKg: null,
      lengthCm: null,
      widthCm: null,
      heightCm: null,
      shippingDiscountType: 'NONE',
      shippingDiscountValue: 0
    })
  } catch (error) {
    Alert('Product failed to create!', 'error', 'var(--secondary-color)', 1500)
    console.error(error)
    
    // On error, cleanup uploaded images since product creation failed
    const allImageUrls = [
      ...form.imageUrls.filter(url => !url.startsWith('blob:')),
      ...form.option.map(opt => opt.imageUrl).filter(url => url && !url.startsWith('blob:'))
    ]
    
    const publicIds = allImageUrls
      .map(url => extractPublicIdFromUrl(url))
      .filter(Boolean) as string[]
    
    if (publicIds.length > 0) {
      imageUpload.deleteBatch(publicIds).catch(err => {
        console.error('Failed to cleanup images after product creation failure:', err)
      })
    }
    
    // Cleanup blob URLs that weren't uploaded
    imageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
    optionImageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
    imageBlobsForUpload.value = []
    optionImageBlobsForUpload.value.clear()
  } finally {
    isSubmitting.value = false
  }
}

/* ------------------------------------------------------------------ */
/* Cancel Product Creation (cleanup temporary images)                 */
/* ------------------------------------------------------------------ */
async function cancelProductCreation() {
  // Cleanup any temporary images that were uploaded
  await imageUpload.cleanupTempImages()
  
  // Revoke all blob URLs
  imageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
  optionImageBlobsForUpload.value.forEach(img => URL.revokeObjectURL(img.previewUrl))
  
  // Clear blob storage
  imageBlobsForUpload.value = []
  optionImageBlobsForUpload.value.clear()
  
  // Reset form
  Object.assign(form, {
    name: '',
    description: '',
    price: 0,
    stock: 0,
    imageUrls: [],
    categories: [],
    isOption: false,
    option: [],
    weightKg: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    shippingDiscountType: 'NONE',
    shippingDiscountValue: 0
  })
  
  // Reset pending images
  pendingImages.value = []
  showImagePreview.value = false
  showCropper.value = false
  
  Alert('Product creation cancelled', 'info', 'var(--secondary-color)', 1500)
}
</script>


<template>
  <div class="prod">
    <div class="add-product-container">
      <!-- Header -->
      <header class="page-header">
        <div class="header-content">
          <h1 class="page-title">Create Product</h1>
          <p class="page-subtitle">Add a new product to your store</p>
        </div>
        <div class="header-right">
          <div class="location-badge" v-if="vendorMunicipality">
            <span class="location-icon">📍</span>
            <span class="location-text">{{ vendorMunicipality }}</span>
          </div>
          <button 
            type="button"
            class="close-btn" 
            @click="emit('close')"
            aria-label="Close modal"
            title="Close"
          >
            <XMarkIcon class="close-icon" />
          </button>
        </div>
      </header>

      <form @submit.prevent="submitProduct" class="product-form">
        <!-- Product Info Card -->
        <section class="form-card">
          <div class="card-header">
            <span class="card-icon">📦</span>
            <h2 class="card-title">Product Information</h2>
          </div>
          
          <div class="card-body">
            <div class="form-field">
              <label class="field-label">Product Name <span class="required">*</span></label>
              <input 
                v-model="form.name" 
                type="text" 
                class="field-input" 
                placeholder="Enter a clear, descriptive product name" 
                required 
              />
            </div>

            <div class="form-field">
              <div class="field-header">
                <label class="field-label">Product Description</label>
                <span class="field-optional">(Optional)</span>
              </div>
              <div class="description-editor">
                <QuillEditor
                  ref="quillEditorRef"
                  v-model:content="form.description"
                  :options="editorOptions"
                  contentType="html"
                  class="quill-editor-custom"
                  placeholder="Describe your product in detail..."
                />
                <div class="editor-footer">
                  <div class="editor-stats">
                    <span 
                      class="char-count" 
                      :class="{ 
                        warning: descriptionStats.isWarning && !descriptionStats.isError,
                        error: descriptionStats.isError 
                      }"
                    >
                      {{ descriptionStats.count }}/{{ descriptionStats.max }}
                    </span>
                  </div>
                  <div class="editor-hint">
                    <span class="hint-icon">💡</span>
                    <span class="hint-text">Use formatting to highlight features and specifications</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="variant-toggle">
              <label class="toggle-card" :class="{ active: form.isOption }">
                <input type="checkbox" v-model="form.isOption" class="toggle-input" />
                <div class="toggle-content">
                  <span class="toggle-icon">🎨</span>
                  <div class="toggle-text">
                    <span class="toggle-title">Multiple Variants</span>
                    <span class="toggle-desc">Enable for products with different sizes, colors, or options</span>
                  </div>
                </div>
                <div class="toggle-switch">
                  <div class="toggle-track">
                    <div class="toggle-thumb"></div>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Categories Card -->
        <section class="form-card">
          <div class="card-header">
            <span class="card-icon">🏷️</span>
            <h2 class="card-title">Categories</h2>
            <span class="card-badge">{{ form.categories.length }}/3</span>
          </div>
          
          <div class="card-body">
            <p class="card-description">Select up to 3 categories that best describe your product</p>
            
            <div class="category-grid">
              <button 
                v-for="cat in categories" 
                :key="cat" 
                type="button" 
                @click="toggleCategory(cat)"
                :class="['category-chip', { active: form.categories.includes(cat) }]"
                :disabled="!form.categories.includes(cat) && form.categories.length >= 3"
              >
                <span class="chip-check" v-if="form.categories.includes(cat)">✓</span>
                {{ cat }}
              </button>
            </div>
          </div>
        </section>

        <!-- Pricing Card (non-option products) -->
        <section class="form-card" v-if="!form.isOption">
          <div class="card-header">
            <span class="card-icon">💰</span>
            <h2 class="card-title">Pricing & Stock</h2>
          </div>
          
          <div class="card-body">
            <div class="pricing-grid">
              <div class="form-field">
                <label class="field-label">Price <span class="required">*</span></label>
                <div class="input-with-prefix">
                  <span class="input-prefix">₱</span>
                  <input 
                    v-model.number="form.price" 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    class="field-input with-prefix" 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div class="form-field">
                <label class="field-label">Stock Quantity <span class="required">*</span></label>
                <input 
                  v-model.number="form.stock" 
                  type="number" 
                  min="0" 
                  class="field-input" 
                  placeholder="0" 
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Promotion Card (non-option products) -->
        <section class="form-card promotion-card" v-if="!form.isOption">
          <div class="card-header">
            <span class="card-icon">🎉</span>
            <h2 class="card-title">Promotion</h2>
            <label class="promotion-toggle">
              <input type="checkbox" v-model="form.promotion.isActive" />
              <span class="promotion-toggle-track">
                <span class="promotion-toggle-thumb"></span>
              </span>
            </label>
          </div>
          
          <div class="card-body" v-if="form.promotion.isActive">
            <div class="discount-options">
              <button 
                type="button" 
                :class="['discount-btn', { active: form.promotion.discountType === 'percentage' }]"
                @click="form.promotion.discountType = 'percentage'"
              >
                <span class="discount-icon">%</span>
                <span class="discount-label">Percentage</span>
              </button>
              <button 
                type="button"
                :class="['discount-btn', { active: form.promotion.discountType === 'fixed' }]"
                @click="form.promotion.discountType = 'fixed'"
              >
                <span class="discount-icon">₱</span>
                <span class="discount-label">Fixed Amount</span>
              </button>
            </div>

            <div class="pricing-grid" v-if="form.promotion.discountType !== 'none'">
              <div class="form-field">
                <label class="field-label">
                  {{ form.promotion.discountType === 'percentage' ? 'Discount (%)' : 'Discount (₱)' }}
                </label>
                <input 
                  v-model.number="form.promotion.discountValue" 
                  type="number" 
                  min="0" 
                  :max="form.promotion.discountType === 'percentage' ? 100 : undefined"
                  step="0.01" 
                  class="field-input"
                  :placeholder="form.promotion.discountType === 'percentage' ? '10' : '50.00'" 
                />
                <p class="sale-preview" v-if="form.promotion.discountValue > 0 && form.price > 0">
                  Sale Price: <strong>₱{{ 
                    form.promotion.discountType === 'percentage' 
                      ? (form.price - (form.price * form.promotion.discountValue / 100)).toFixed(2)
                      : Math.max(0, form.price - form.promotion.discountValue).toFixed(2)
                  }}</strong>
                </p>
              </div>

              <div class="form-field">
                <label class="shipping-option">
                  <input type="checkbox" v-model="form.promotion.freeShipping" />
                  <span class="shipping-content">
                    <span class="shipping-icon">🚚</span>
                    <span class="shipping-text">Free Shipping</span>
                  </span>
                </label>
              </div>
            </div>

            <div class="date-grid" v-if="form.promotion.discountType !== 'none'">
              <div class="form-field">
                <label class="field-label">Start Date <span class="optional">(Optional)</span></label>
                <input v-model="form.promotion.startDate" type="datetime-local" class="field-input" />
              </div>
              <div class="form-field">
                <label class="field-label">End Date <span class="optional">(Optional)</span></label>
                <input 
                  v-model="form.promotion.endDate" 
                  type="datetime-local" 
                  class="field-input"
                  :min="form.promotion.startDate || undefined" 
                />
              </div>
            </div>
          </div>
        </section>

        <!-- J&T Shipping Profile Card -->
        <section class="form-card">
          <div class="card-header">
            <span class="card-icon">📦</span>
            <h2 class="card-title">J&T Shipping Profile</h2>
            <span class="card-badge">Optional</span>
          </div>

          <div class="card-body">
            <p class="card-description">Set weight and dimensions for J&T Express shipping. Required for buyers to use J&T delivery.</p>

            <div class="shipping-profile-grid">
              <div class="form-field">
                <label class="field-label">Weight (kg) <span class="required">*</span></label>
                <div class="input-with-prefix">
                  <span class="input-prefix">kg</span>
                  <input
                    v-model.number="form.weightKg"
                    type="number"
                    step="0.01"
                    min="0.01"
                    class="field-input with-prefix"
                    placeholder="0.50"
                  />
                </div>
                <p class="field-hint">Minimum 0.01 kg</p>
              </div>

              <div class="form-field">
                <label class="field-label">Length (cm)</label>
                <input
                  v-model.number="form.lengthCm"
                  type="number"
                  step="1"
                  min="1"
                  class="field-input"
                  placeholder="10"
                />
              </div>

              <div class="form-field">
                <label class="field-label">Width (cm)</label>
                <input
                  v-model.number="form.widthCm"
                  type="number"
                  step="1"
                  min="1"
                  class="field-input"
                  placeholder="10"
                />
              </div>

              <div class="form-field">
                <label class="field-label">Height (cm)</label>
                <input
                  v-model.number="form.heightCm"
                  type="number"
                  step="1"
                  min="1"
                  class="field-input"
                  placeholder="5"
                />
              </div>
            </div>

            <div class="shipping-discount-section">
              <h3 class="discount-section-title">Shipping Discount</h3>
              <p class="card-description">Offer your customers a discount on J&T shipping for this product</p>

              <div class="shipping-discount-grid">
                <div class="form-field">
                  <label class="field-label">Discount Type</label>
                  <select v-model="form.shippingDiscountType" class="field-input">
                    <option value="NONE">No Discount</option>
                    <option value="FIXED">Fixed Amount (₱)</option>
                    <option value="PERCENT">Percentage (%)</option>
                  </select>
                </div>

                <div class="form-field" v-if="form.shippingDiscountType !== 'NONE'">
                  <label class="field-label">
                    {{ form.shippingDiscountType === 'FIXED' ? 'Discount Amount (₱)' : 'Discount (%)' }}
                  </label>
                  <input
                    v-model.number="form.shippingDiscountValue"
                    type="number"
                    :step="form.shippingDiscountType === 'FIXED' ? '0.01' : '1'"
                    :min="0"
                    :max="form.shippingDiscountType === 'PERCENT' ? 100 : undefined"
                    class="field-input"
                    :placeholder="form.shippingDiscountType === 'FIXED' ? '10.00' : '15'"
                  />
                  <p class="field-hint" v-if="form.shippingDiscountType === 'PERCENT'">Maximum 100%</p>
                </div>
              </div>

              <div v-if="form.shippingDiscountType !== 'NONE' && form.shippingDiscountValue > 0" class="shipping-discount-preview">
                <span class="preview-icon">💰</span>
                <span>Customer saves 
                  <strong>{{ form.shippingDiscountType === 'FIXED' ? `₱${form.shippingDiscountValue.toFixed(2)}` : `${form.shippingDiscountValue}%` }}</strong>
                  on J&T shipping for this product
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Images Card (non-option products) -->
        <section class="form-card" v-if="!form.isOption">
          <div class="card-header">
            <span class="card-icon">📸</span>
            <h2 class="card-title">Product Images</h2>
          </div>
          
          <div class="card-body">
            <div class="upload-zone">
              <input 
                type="file" 
                multiple 
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/tiff" 
                @change="handleMainImageUpload" 
                class="upload-input"
                id="main-images" 
              />
              <label for="main-images" class="upload-label">
                <div class="upload-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                </div>
                <div class="upload-text">
                  <span class="upload-title">Click to upload images</span>
                  <span class="upload-hint">or drag and drop • PNG, JPG, WebP up to 100MB</span>
                </div>
              </label>
            </div>

            <div v-if="form.imageUrls.length" class="image-gallery">
              <div v-for="(img, index) in form.imageUrls" :key="index" class="gallery-item">
                <img :src="img" :alt="`Product ${index + 1}`" class="gallery-image" />
                <button type="button" @click="removeImage(index)" class="remove-btn" aria-label="Remove image">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
                <span class="image-badge" v-if="index === 0">Main</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Variants Card (option products) -->
        <section class="form-card" v-if="form.isOption">
          <div class="card-header">
            <span class="card-icon">🎨</span>
            <h2 class="card-title">Product Variants</h2>
            <button type="button" @click="addOption" class="add-variant-btn">
              <span>+ Add Variant</span>
            </button>
          </div>
          
          <div class="card-body">
            <div v-if="form.option.length === 0" class="empty-variants">
              <span class="empty-icon">📦</span>
              <p class="empty-text">No variants added yet</p>
              <button type="button" @click="addOption" class="add-first-btn">Add Your First Variant</button>
            </div>

            <div class="variants-list" v-else>
              <div v-for="(opt, index) in form.option" :key="index" class="variant-card">
                <div class="variant-header">
                  <span class="variant-number">Variant {{ index + 1 }}</span>
                  <button type="button" @click="removeOption(index)" class="remove-variant-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>

                <div class="variant-body">
                  <div class="form-field">
                    <label class="field-label">Variant Name</label>
                    <input v-model="opt.label" type="text" class="field-input" placeholder="e.g. Large, Red, Spicy" />
                  </div>

                  <div class="variant-pricing">
                    <div class="form-field">
                      <label class="field-label">Price</label>
                      <div class="input-with-prefix">
                        <span class="input-prefix">₱</span>
                        <input v-model.number="opt.price" type="number" min="0" step="0.01" class="field-input with-prefix" placeholder="0.00" />
                      </div>
                    </div>
                    <div class="form-field">
                      <label class="field-label">Stock</label>
                      <input v-model.number="opt.stock" type="number" min="1" class="field-input" placeholder="0" />
                    </div>
                  </div>

                  <div class="variant-image">
                    <label class="field-label">Variant Image</label>
                    <div class="variant-upload-zone">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/tiff" 
                        @change="(e) => handleOptionImageUpload(e, index)"
                        class="upload-input" 
                        :id="`option-image-${index}`" 
                      />
                      <label :for="`option-image-${index}`" class="variant-upload-label">
                        <template v-if="!opt.imageUrl">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M12 4v16m8-8H4"/>
                          </svg>
                          <span>Add Image</span>
                        </template>
                        <template v-else>
                          <img :src="opt.imageUrl" :alt="`Variant ${index + 1}`" class="variant-preview" />
                          <div class="variant-overlay">Change</div>
                        </template>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Submit Actions -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="isSubmitting">
            <template v-if="!isSubmitting">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 13l4 4L19 7"/>
              </svg>
              <span>Create Product</span>
            </template>
            <template v-else>
              <span class="spinner"></span>
              <span>Creating...</span>
            </template>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Image Preview Modal -->
  <div v-if="showImagePreview" class="modal-overlay">
    <div class="modal-backdrop" @click="cancelImageSelection"></div>
    <div class="modal-content preview-modal">
      <div class="modal-header">
        <h3 class="modal-title">Select Images to Crop</h3>
        <button @click="cancelImageSelection" class="modal-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <p class="preview-hint">Choose images to crop, or skip to use them as-is.</p>

        <div class="preview-grid">
          <div v-for="(imageSrc, index) in pendingImages" :key="index" class="preview-item">
            <img :src="imageSrc" :alt="`Preview ${index + 1}`" class="preview-thumb" />
            <button @click="selectImageToCrop(imageSrc)" class="crop-btn">✂️ Crop</button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="cancelImageSelection" class="btn-secondary">Cancel</button>
        <button @click="skipCropping" class="btn-primary" :disabled="isUploading">
          <template v-if="!isUploading">Skip & Upload All</template>
          <template v-else>
            <span class="spinner"></span>
            Uploading...
          </template>
        </button>
      </div>
    </div>
  </div>

  <!-- Image Cropper Modal -->
  <div v-if="showCropper" class="modal-overlay">
    <div class="modal-backdrop" @click="handleCropCancel"></div>
    <div class="modal-content cropper-modal">
      <div class="modal-header">
        <h3 class="modal-title">Crop Image</h3>
        <button @click="handleCropCancel" class="modal-close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <ImageCropper :imageSrc="currentImageSrc" @crop="handleCropComplete" @cancel="handleCropCancel" />
    </div>
  </div>
</template>




<style scoped>
/* ============================================
   Modern Clean Product Form Styles
   ============================================ */

/* Base Container */
.prod {
  position: fixed;
  inset: 0;
  z-index: 1000;
  overflow-y: auto;
  background: var(--bg-primary);
}

.add-product-container {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 16px;
  flex-wrap: wrap;
}

.header-content {
  flex: 1;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.location-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: 24px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
}

.location-icon {
  font-size: 0.9rem;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--surface);
  border: 2px solid var(--border-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

.close-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

/* Form Layout */
.product-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Card Component */
.form-card {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.form-card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.card-icon {
  font-size: 1.25rem;
}

.card-title {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--surface);
  padding: 4px 10px;
  border-radius: 12px;
}

.card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

/* Form Fields */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.required {
  color: var(--secondary-color);
}

.optional {
  font-weight: 400;
  text-transform: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.field-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 0.95rem;
  color: var(--text-primary);
  background: var(--input-bg);
  border: 1.5px solid var(--input-border);
  border-radius: 10px;
  transition: all 0.2s ease;
  outline: none;
}

.field-input::placeholder {
  color: var(--input-placeholder);
}

.field-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.field-input.with-prefix {
  padding-left: 36px;
}

.input-with-prefix {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Quill Editor */
.quill-editor-custom {
  border-radius: 10px;
  overflow: hidden;
}

.quill-editor-custom :deep(.ql-toolbar) {
  background: var(--bg-secondary);
  border: 1.5px solid var(--input-border);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  padding: 10px;
}

.quill-editor-custom :deep(.ql-container) {
  border: 1.5px solid var(--input-border);
  border-radius: 0 0 10px 10px;
  min-height: 140px;
  font-size: 0.95rem;
  background: var(--input-bg);
}

.quill-editor-custom :deep(.ql-editor) {
  min-height: 140px;
  padding: 14px;
  color: var(--text-primary);
  line-height: 1.6;
}

.quill-editor-custom :deep(.ql-editor.ql-blank::before) {
  color: var(--input-placeholder);
  font-style: normal;
}

.quill-editor-custom :deep(.ql-snow .ql-stroke) {
  stroke: var(--text-primary);
}

.quill-editor-custom :deep(.ql-snow .ql-fill) {
  fill: var(--text-primary);
}

.quill-editor-custom :deep(.ql-snow .ql-picker-label) {
  color: var(--text-primary);
}

.quill-editor-custom :deep(.ql-toolbar button:hover),
.quill-editor-custom :deep(.ql-toolbar button.ql-active) {
  color: var(--color-primary);
}

.quill-editor-custom :deep(.ql-toolbar button:hover .ql-stroke),
.quill-editor-custom :deep(.ql-toolbar button.ql-active .ql-stroke) {
  stroke: var(--color-primary);
}

.quill-editor-custom:focus-within :deep(.ql-container) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Description Editor Enhancements */
.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-optional {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.description-editor {
  position: relative;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 16px;
}

.editor-stats {
  display: flex;
  align-items: center;
}

.char-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}

.char-count.warning {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.char-count.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.editor-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  font-size: 0.75rem;
  color: var(--color-primary);
  flex: 1;
  max-width: 300px;
}

.hint-icon {
  flex-shrink: 0;
  font-size: 0.8rem;
}

.hint-text {
  line-height: 1.4;
}

/* Variant Toggle */
.variant-toggle {
  margin-top: 4px;
}

.toggle-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-primary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-card:hover {
  border-color: var(--color-primary);
}

.toggle-card.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.toggle-input {
  display: none;
}

.toggle-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.toggle-icon {
  font-size: 1.25rem;
}

.toggle-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.toggle-desc {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.toggle-switch {
  width: 44px;
  height: 24px;
}

.toggle-track {
  width: 100%;
  height: 100%;
  background: var(--input-border);
  border-radius: 12px;
  position: relative;
  transition: background 0.2s ease;
}

.toggle-card.active .toggle-track {
  background: var(--color-primary);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-card.active .toggle-thumb {
  transform: translateX(20px);
}

/* Category Grid */
.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--surface);
  border: 1.5px solid var(--border-primary);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-chip:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.category-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.category-chip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chip-check {
  font-size: 0.7rem;
}

/* Pricing Grid */
.pricing-grid,
.date-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

/* Promotion Card */
.promotion-card .card-header {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(239, 68, 68, 0.08));
}

.promotion-toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.promotion-toggle input {
  display: none;
}

.promotion-toggle-track {
  width: 44px;
  height: 24px;
  background: var(--input-border);
  border-radius: 12px;
  position: relative;
  transition: background 0.2s ease;
}

.promotion-toggle input:checked + .promotion-toggle-track {
  background: var(--color-primary);
}

.promotion-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.promotion-toggle input:checked + .promotion-toggle-track .promotion-toggle-thumb {
  transform: translateX(20px);
}

.discount-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.discount-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: var(--surface);
  border: 1.5px solid var(--border-primary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.discount-btn:hover {
  border-color: var(--color-primary);
}

.discount-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.discount-icon {
  font-size: 1.5rem;
  font-weight: 700;
}

.discount-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.sale-preview {
  font-size: 0.8rem;
  color: var(--color-primary);
  margin: 0;
}

.shipping-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-primary);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.shipping-option:hover {
  border-color: var(--color-primary);
}

.shipping-option input {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
}

.shipping-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shipping-icon {
  font-size: 1.1rem;
}

.shipping-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* Image Upload */
.upload-zone {
  position: relative;
}

.upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
  border: 2px dashed var(--border-primary);
  border-radius: 12px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-label:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.upload-icon {
  color: var(--text-secondary);
}

.upload-text {
  text-align: center;
}

.upload-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.upload-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Image Gallery */
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  border: 1.5px solid var(--border-primary);
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.9);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: white;
  transition: transform 0.2s ease;
}

.remove-btn:hover {
  transform: scale(1.1);
}

.image-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  padding: 2px 8px;
  font-size: 0.65rem;
  font-weight: 600;
  background: var(--color-primary);
  color: white;
  border-radius: 4px;
}

/* Variants */
.add-variant-btn {
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary);
  background: transparent;
  border: 1.5px solid var(--color-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-variant-btn:hover {
  background: var(--color-primary);
  color: white;
}

.empty-variants {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.add-first-btn {
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-first-btn:hover {
  background: var(--color-primary-hover);
}

.variants-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.variant-card {
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
}

.variant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
}

.variant-number {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
}

.remove-variant-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.remove-variant-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--secondary-color);
}

.variant-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.variant-pricing {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.variant-upload-zone {
  position: relative;
  height: 100px;
}

.variant-upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  border: 2px dashed var(--border-primary);
  border-radius: 10px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.8rem;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.variant-upload-label:hover {
  border-color: var(--color-primary);
}

.variant-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.variant-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  color: white;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.variant-upload-label:hover .variant-overlay {
  opacity: 1;
}

/* Form Actions */
.form-actions {
  padding-top: 8px;
}

.submit-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 24px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(31, 139, 78, 0.4);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cropper-modal {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-primary);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-secondary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-primary);
}

.preview-hint {
  text-align: center;
  color: var(--text-secondary);
  margin: 0 0 16px;
  font-size: 0.9rem;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.preview-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.preview-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.crop-btn {
  width: 100%;
  padding: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.crop-btn:hover {
  background: #2563eb;
}

.btn-secondary {
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .field-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .editor-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .editor-hint {
    max-width: none;
    justify-content: center;
  }

  .char-count {
    align-self: flex-end;
  }

  .add-product-container {
    padding: 16px 12px 32px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-content {
    width: 100%;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .header-right {
    width: 100%;
    justify-content: space-between;
  }

  .location-badge {
    flex: 1;
    justify-content: center;
  }

  .close-btn {
    width: 36px;
    height: 36px;
  }

  .close-icon {
    width: 18px;
    height: 18px;
  }

  .card-body {
    padding: 16px;
  }

  .pricing-grid,
  .date-grid,
  .discount-options {
    grid-template-columns: 1fr;
  }

  .variant-pricing {
    grid-template-columns: 1fr;
  }

  .image-gallery {
    grid-template-columns: repeat(3, 1fr);
  }

  .preview-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Animation */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-card {
  animation: fadeIn 0.3s ease-out;
}

/* J&T Shipping Profile */
.shipping-profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.shipping-discount-section {
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--border-primary);
}

.discount-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.shipping-discount-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}

.shipping-discount-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(22, 163, 74, 0.08));
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.preview-icon {
  font-size: 1.1rem;
}

@media (max-width: 640px) {
  .shipping-profile-grid,
  .shipping-discount-grid {
    grid-template-columns: 1fr;
  }
}
</style>