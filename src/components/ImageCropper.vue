<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUploadStore } from '../stores/uploadStore'
import { Alert } from './composable/Alert.js'
import { useUserStore } from "../stores/userStores"
// Store
const router = useRouter()
const uploadStore = useUploadStore()
const userStore = useUserStore()

// Reactive data
const selectedImage = ref<string>('')
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement>()
const imageContainer = ref<HTMLElement>()
const sourceImage = ref<HTMLImageElement>()
const previewCanvas = ref<HTMLCanvasElement>()

// Crop state - enforcing square aspect ratio
const cropState = reactive({
  x: 0,
  y: 0,
  size: 200, // Single size property for square
  isDragging: false,
  isResizing: false,
  resizeHandle: '',
  dragStart: { x: 0, y: 0 },
  containerBounds: { width: 0, height: 0 },
  imageNaturalSize: { width: 0, height: 0 },
  imageDisplaySize: { width: 0, height: 0 }
})

const previewSize = 200
const cropSize = ref(200) // Single size input for square

// Resize handles - only corner handles for maintaining square ratio
const resizeHandles = [
  { position: 'nw' }, { position: 'ne' },
  { position: 'sw' }, { position: 'se' }
]

// Computed styles
const cropAreaStyle = computed(() => ({
  left: `${cropState.x}px`,
  top: `${cropState.y}px`,
  width: `${cropState.size}px`,
  height: `${cropState.size}px`
}))

const overlayStyle = computed(() => ({
  clipPath: `polygon(0% 0%, 0% 100%, ${cropState.x}px 100%, ${cropState.x}px ${cropState.y}px, ${cropState.x + cropState.size}px ${cropState.y}px, ${cropState.x + cropState.size}px ${cropState.y + cropState.size}px, ${cropState.x}px ${cropState.y + cropState.size}px, ${cropState.x}px 100%, 100% 100%, 100% 0%)`
}))

// File handling
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    processFile(input.files[0])
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragOver.value = false

  const files = event.dataTransfer?.files
  if (files && files[0]) {
    processFile(files[0])
  }
}

const processFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }

  // Clear previous results
  uploadStore.clearResults()

  const reader = new FileReader()
  reader.onload = (e) => {
    selectedImage.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

// Crop initialization
const initializeCrop = async () => {
  await nextTick()

  const img = sourceImage.value
  const container = imageContainer.value

  if (!img || !container) return

  // Get container dimensions
  const containerRect = container.getBoundingClientRect()
  cropState.containerBounds.width = containerRect.width
  cropState.containerBounds.height = containerRect.height

  // Get image natural and display dimensions
  cropState.imageNaturalSize.width = img.naturalWidth
  cropState.imageNaturalSize.height = img.naturalHeight
  cropState.imageDisplaySize.width = img.offsetWidth
  cropState.imageDisplaySize.height = img.offsetHeight

  // Set initial square size based on image dimensions
  const maxSize = Math.min(cropState.imageDisplaySize.width, cropState.imageDisplaySize.height)
  const initialSize = Math.min(200, maxSize * 0.8)

  cropState.size = initialSize
  cropSize.value = initialSize

  // Center the crop area
  cropState.x = Math.max(0, (cropState.imageDisplaySize.width - cropState.size) / 2)
  cropState.y = Math.max(0, (cropState.imageDisplaySize.height - cropState.size) / 2)

  updatePreview()
}

// Drag functionality
const startDrag = (event: MouseEvent | TouchEvent) => {
  event.preventDefault()

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  cropState.isDragging = true
  cropState.dragStart.x = clientX - cropState.x
  cropState.dragStart.y = clientY - cropState.y

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', handleDrag)
  document.addEventListener('touchend', stopDrag)
}

const handleDrag = (event: MouseEvent | TouchEvent) => {
  if (!cropState.isDragging && !cropState.isResizing) return

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  if (cropState.isDragging) {
    const newX = clientX - cropState.dragStart.x
    const newY = clientY - cropState.dragStart.y

    cropState.x = Math.max(0, Math.min(newX, cropState.imageDisplaySize.width - cropState.size))
    cropState.y = Math.max(0, Math.min(newY, cropState.imageDisplaySize.height - cropState.size))
  }

  if (cropState.isResizing) {
    handleResize(clientX, clientY)
  }

  updatePreview()
}

const stopDrag = () => {
  cropState.isDragging = false
  cropState.isResizing = false
  cropState.resizeHandle = ''

  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
}

// Resize functionality - maintaining square aspect ratio
const startResize = (event: MouseEvent | TouchEvent, handle: string) => {
  event.stopPropagation()
  event.preventDefault()

  cropState.isResizing = true
  cropState.resizeHandle = handle

  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

  cropState.dragStart.x = clientX
  cropState.dragStart.y = clientY

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', handleDrag)
  document.addEventListener('touchend', stopDrag)
}

const handleResize = (clientX: number, clientY: number) => {
  const deltaX = clientX - cropState.dragStart.x
  const deltaY = clientY - cropState.dragStart.y
  const handle = cropState.resizeHandle

  // Calculate the delta based on the handle direction
  let delta = 0

  if (handle === 'se') {
    // Southeast: use the larger of the two deltas to maintain square
    delta = Math.max(deltaX, deltaY)
  } else if (handle === 'sw') {
    // Southwest: use deltaY for size, adjust x position
    delta = deltaY
  } else if (handle === 'ne') {
    // Northeast: use deltaX for size, adjust y position  
    delta = deltaX
  } else if (handle === 'nw') {
    // Northwest: use the negative of the smaller delta
    delta = -Math.min(deltaX, deltaY)
  }

  let newSize = cropState.size + delta
  let newX = cropState.x
  let newY = cropState.y

  // Adjust position for handles that affect top/left
  if (handle.includes('w')) {
    newX = cropState.x - delta
  }
  if (handle.includes('n')) {
    newY = cropState.y - delta
  }

  // Ensure minimum size
  if (newSize < 50) {
    newSize = 50
    return
  }

  // Ensure crop area stays within image bounds
  const maxX = cropState.imageDisplaySize.width - newSize
  const maxY = cropState.imageDisplaySize.height - newSize

  if (newX < 0 || newX > maxX || newY < 0 || newY > maxY) {
    return
  }

  // Apply changes
  cropState.size = newSize
  cropState.x = newX
  cropState.y = newY
  cropSize.value = Math.round(newSize)

  cropState.dragStart.x = clientX
  cropState.dragStart.y = clientY
}

// Preview and export
const updatePreview = () => {
  const canvas = previewCanvas.value
  const img = sourceImage.value

  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Calculate scale factors
  const scaleX = cropState.imageNaturalSize.width / cropState.imageDisplaySize.width
  const scaleY = cropState.imageNaturalSize.height / cropState.imageDisplaySize.height

  // Source coordinates in natural image size
  const sourceX = cropState.x * scaleX
  const sourceY = cropState.y * scaleY
  const sourceSize = cropState.size * Math.min(scaleX, scaleY)

  // Clear canvas
  ctx.clearRect(0, 0, previewSize, previewSize)

  // Draw cropped square image
  ctx.drawImage(
    img,
    sourceX, sourceY, sourceSize, sourceSize,
    0, 0, previewSize, previewSize
  )
}

const getCroppedImageBlob = (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = sourceImage.value

    if (!ctx || !img) {
      resolve(null)
      return
    }

    // Set canvas size to square crop dimensions
    canvas.width = cropSize.value
    canvas.height = cropSize.value

    // Calculate scale factors
    const scaleX = cropState.imageNaturalSize.width / cropState.imageDisplaySize.width
    const scaleY = cropState.imageNaturalSize.height / cropState.imageDisplaySize.height

    // Source coordinates
    const sourceX = cropState.x * scaleX
    const sourceY = cropState.y * scaleY
    const sourceSize = cropState.size * Math.min(scaleX, scaleY)

    // Draw full-resolution cropped square image
    ctx.drawImage(
      img,
      sourceX, sourceY, sourceSize, sourceSize,
      0, 0, cropSize.value, cropSize.value
    )

    canvas.toBlob(resolve, 'image/png')
  })
}

const downloadCroppedImage = async () => {
  const blob = await getCroppedImageBlob()
  if (blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `square-cropped-image-${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(url)
  }
}

// Cloudinary upload functionality using store
const uploadToCloudinary = async () => {
  const blob = await getCroppedImageBlob()
  if (!blob) {
    alert('Failed to generate cropped image')
    return
  }


  try {
    const filename = `square-cropped-image-${Date.now()}.png`
    await uploadStore.uploadCroppedImage(blob, filename)
    await nextTick()
    await userStore.updateUser({ avatar: uploadStore.imageUrl })

    router.push("/user/me")
  } catch (error) {
    Alert("Failed to change profile picture", "error", "var(--secondary-color)")
    router.push("/user/me")
    console.log(error)

  }

}

// Utility functions
const updateCropFromInput = () => {
  const newSize = Math.max(50, cropSize.value)
  const maxSize = Math.min(
    cropState.imageDisplaySize.width - cropState.x,
    cropState.imageDisplaySize.height - cropState.y
  )

  cropState.size = Math.min(newSize, maxSize)
  cropSize.value = cropState.size

  // Adjust position if crop area goes outside image bounds
  cropState.x = Math.max(0, Math.min(cropState.x, cropState.imageDisplaySize.width - cropState.size))
  cropState.y = Math.max(0, Math.min(cropState.y, cropState.imageDisplaySize.height - cropState.size))

  updatePreview()
}

const resetImage = () => {
  selectedImage.value = ''
  cropState.x = 0
  cropState.y = 0
  cropState.size = 200
  cropSize.value = 200
  uploadStore.clearResults()
}

const copyUrlToClipboard = async (url: string) => {
  const success = await uploadStore.copyToClipboard(url)
  if (success) {
    alert('URL copied to clipboard!')
  } else {
    alert('Failed to copy URL to clipboard')
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('resize', initializeCrop)
})

onUnmounted(() => {
  window.removeEventListener('resize', initializeCrop)
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
})
</script>

<template>
  <div class="image-upload-container">
    <!-- <div class="upload-header">
      <h2>Image Upload & Crop</h2>
      <p>Upload an image, crop it to a perfect square, and save to Cloudinary</p>
    </div> -->

    <!-- Upload Area -->
    <div v-if="!selectedImage" class="upload-area" :class="{ 'drag-over': isDragOver }" @drop="handleDrop"
      @dragover.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false" @click="triggerFileInput">
      <div class="upload-content">
        <div class="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h3>Drop your image here</h3>
        <p>or click to browse files</p>
        <div class="supported-formats">
          <span>Supports: JPG, PNG, GIF • Square crop only</span>
        </div>
      </div>
      <input ref="fileInput" type="file" accept="image/*" @change="handleFileSelect" style="display: none;">
    </div>

    <!-- Crop Area -->
    <div v-if="selectedImage" class="crop-container">
      <!-- <div class="crop-header">
  

      </div> -->

      <div class="crop-workspace">
        <div class="image-container" ref="imageContainer">
          <img ref="sourceImage" :src="selectedImage" @load="initializeCrop" class="source-image">


          <div class="crop-overlay" :style="overlayStyle"></div>

          <div class="crop-area" :style="cropAreaStyle" @mousedown="startDrag" @touchstart="startDrag">
            <!-- Resize Handles - Only corner handles for square resize -->
            <div v-for="handle in resizeHandles" :key="handle.position" :class="`resize-handle ${handle.position}`"
              @mousedown="startResize($event, handle.position)" @touchstart="startResize($event, handle.position)">
            </div>
          </div>
        </div>

        <!-- Preview & Controls -->
        <div class="preview-container">
          <!-- <h4>Square Preview</h4> -->
          <!-- <div class="preview-wrapper">
            <canvas ref="previewCanvas" class="preview-canvas" :width="previewSize" :height="previewSize"></canvas>
          </div> -->

          <div class="crop-controls">
            <!-- <div class="size-controls">
              <label>Square Size:</label>
              <div class="size-inputs">
                <input v-model.number="cropSize" type="number" min="50" @input="updateCropFromInput" placeholder="Size">
                <span>px</span>
              </div>
              <div class="size-info">
                <span class="info-text">Output: {{ cropSize }}×{{ cropSize }}px</span>
              </div>
            </div> -->

            <!-- Upload Controls -->
            <div class="upload-controls">
              <!-- <button @click="downloadCroppedImage" class="download-btn" :disabled="uploadStore.isUploading">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Square Image
              </button> -->

              <button @click="uploadToCloudinary" class="upload-btn" :disabled="uploadStore.isUploading"
                :class="{ 'uploading': uploadStore.isUploading }">
                <div v-if="uploadStore.isUploading" class="spinner"></div>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10,9 9,9 8,9" />
                </svg>
                {{ uploadStore.isUploading ? 'Uploading...' : 'Save Profile' }}
              </button>
              <button @click="resetImage" class="reset-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>

              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Results -->
      <!-- <div v-if="uploadStore.hasResults" class="upload-results">
        <h3>Upload Results</h3>
        <div class="results-grid">
          <div v-for="(result, index) in uploadStore.uploadResults" :key="index" class="result-item"
            :class="{ 'success': result.success, 'error': !result.success }">
            <div v-if="result.success" class="success-result">
              <div class="result-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
                <span>Upload Successful!</span>
              </div>
              <div class="result-image">
                <img :src="result.url" :alt="`Uploaded image ${index + 1}`" />
              </div>
              <div class="result-details">
                <p class="url-text">
                  <strong>URL:</strong>
                  <a :href="result.url" target="_blank" rel="noopener noreferrer">
                    {{ result.url }}
                  </a>
                </p>
                <button @click="copyUrlToClipboard(result.url!)" class="copy-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy URL
                </button>
              </div>
            </div>

            <div v-else class="error-result">
              <div class="result-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span>Upload Failed</span>
              </div>
              <p class="error-message">{{ result.error || 'Unknown error occurred' }}</p>
            </div>
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>


<style scoped>
.image-upload-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
}

.upload-header {
  text-align: center;
  margin-bottom: 2rem;
}

/* Upload Area */
.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;

  cursor: pointer;
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  position: relative;
  overflow: hidden;
}

.upload-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.05) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.upload-area:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
}

.upload-area:hover::before {
  opacity: 1;
}

.upload-area.drag-over {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  transform: scale(1.02);
}

.upload-content {
  position: relative;
  z-index: 1;
}

.upload-icon {
  color: #6b7280;
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}

.upload-area:hover .upload-icon {
  color: #3b82f6;
  transform: scale(1.1);
}

.upload-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.upload-content p {
  color: #6b7280;
  margin-bottom: 1rem;
}

.supported-formats {
  display: inline-block;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Crop Container */
.crop-container {
  margin-top: 2rem;
}

.crop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.crop-header h3 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #374151;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: #e5e7eb;
  transform: translateY(-1px);
}

.crop-workspace {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  align-items: start;
  place-items: center;
}

/* Image Container */
.image-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  width: fit-content !important;
  aspect-ratio: 1;
  max-height: 400px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: auto;
  scrollbar-width-y: thin;
  background-color: rgba(56, 56, 56, 0.349);
}

.source-image {
  display: block;
  max-width: 100%;
  max-height: 600px;
  width: auto;
  height: auto;
}

/* Crop Overlay */
.crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  transition: clip-path 0.1s ease;
}

/* Crop Area */
.crop-area {
  position: absolute;
  border: 2px solid #3b82f6;
  cursor: move;
  background: rgba(59, 130, 246, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
  transition: all 0.2s ease;

}

.crop-area:hover {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

/* Resize Handles - Only corner handles for square */
.resize-handle {
  position: absolute;
  background: #3b82f6;
  border: 2px solid white;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
}

.resize-handle:hover {
  background: #2563eb;
  transform: scale(1.2);
}

.resize-handle.nw {
  top: -6px;
  left: -6px;
  cursor: nw-resize;
}

.resize-handle.ne {
  top: -6px;
  right: -6px;
  cursor: ne-resize;
}

.resize-handle.sw {
  bottom: -6px;
  left: -6px;
  cursor: sw-resize;
}

.resize-handle.se {
  bottom: -6px;
  right: -6px;
  cursor: se-resize;
}

/* Preview Container */
.preview-container {

  width: 100%;
  border-radius: 12px;
  padding: 1.5rem;
}

.preview-container h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.preview-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.preview-canvas {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Controls */
.crop-controls {
  space-y: 1rem;
}

.size-controls {
  margin-bottom: 1.5rem;
}

.size-controls label {
  display: block;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.size-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.size-inputs input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.size-inputs input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.size-inputs span {
  color: #6b7280;
  font-weight: 500;
}

.size-info {
  margin-bottom: 1rem;
}

.info-text {
  font-size: 0.875rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.5rem;
  border-radius: 6px;
  display: inline-block;

}

.upload-controls {
  display: flex;
  gap: 0.75rem;
}

.download-btn,
.upload-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
}

.download-btn {
  background: #6b7280;
  border: none;
  color: white;
  box-shadow: 0 2px 8px rgba(107, 114, 128, 0.3);
}

.download-btn:hover {
  background: #4b5563;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(107, 114, 128, 0.4);
}

.upload-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.upload-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
}

.upload-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.upload-btn.uploading {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
}

/* Spinner */
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Upload Results */
.upload-results {
  margin-top: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.upload-results h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
}

.results-grid {
  display: grid;
  gap: 1rem;
}

.result-item {
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid;
  transition: all 0.2s ease;
}

.result-item.success {
  border-color: #10b981;
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
}

.result-item.error {
  border-color: #ef4444;
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.result-item.success .result-header {
  color: #059669;
}

.result-item.error .result-header {
  color: #dc2626;
}

.result-image {
  margin-bottom: 1rem;
}

.result-image img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.result-details {
  space-y: 0.5rem;
}

.url-text {
  font-size: 0.875rem;
  color: #374151;
  word-break: break-all;
}

.url-text a {
  color: #3b82f6;
  text-decoration: none;
}

.url-text a:hover {
  text-decoration: underline;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #374151;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: #e5e7eb;
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin: 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .image-upload-container {
    padding: 1rem;
  }

  .crop-workspace {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .upload-area {
    padding: 2rem 1rem;
  }

  .crop-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .upload-controls {
    gap: 0.5rem;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .resize-handle {
    width: 16px;
    height: 16px;
  }

  .resize-handle.nw {
    top: -8px;
    left: -8px;
  }

  .resize-handle.ne {
    top: -8px;
    right: -8px;
  }

  .resize-handle.sw {
    bottom: -8px;
    left: -8px;
  }

  .resize-handle.se {
    bottom: -8px;
    right: -8px;
  }
}
</style>