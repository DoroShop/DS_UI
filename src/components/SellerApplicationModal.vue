<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PhotoIcon,
  LockClosedIcon
} from '@heroicons/vue/24/outline'
import { useSellerApplicationStore, type SellerApplicationForm } from '../stores/sellerApplicationStore'
import { useLocationStore } from '../stores/locationStore'
import { useTheme } from '../composables/useTheme'

interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { isDark } = useTheme()
const sellerStore = useSellerApplicationStore()
const locationStore = useLocationStore()

// LOCKED LOCATION DEFAULTS: MIMAROPA (Region IV-B) & Oriental Mindoro
// These are locked and cannot be changed by users in this version
const DEFAULT_REGION_CODE = 'REGION_IV_B';
const DEFAULT_REGION_NAME = 'Mimaropa (Region IV-B)';
const DEFAULT_PROVINCE_CODE = '1705200000'; // Oriental Mindoro PSGC code
const DEFAULT_PROVINCE_NAME = 'Oriental Mindoro';

// Form state - stores codes for API selection
const form = reactive<SellerApplicationForm>({
  shopName: '',
  region: DEFAULT_REGION_CODE,
  province: DEFAULT_PROVINCE_CODE,
  municipality: '',
  barangay: '',
  address: '', // Required by SellerApplicationForm type
  zipCode: '',
  street: '',
  additionalInfo: '',
  shopAddress: '',
  governmentId: null,
  birTin: null,
  dtiOrSec: null,
  fdaCertificate: null,
  businessPermit: null,
  shopProfile: null, // New: Shop profile image (required)
})

// Shop profile image preview
const shopProfilePreview = ref<string | null>(null)
const shopProfileInput = ref<HTMLInputElement>()

// Document previews
const documentPreviews = reactive({
  governmentId: null as string | null,
  birTin: null as string | null,
  dtiOrSec: null as string | null,
  fdaCertificate: null as string | null,
  businessPermit: null as string | null,
})

// Track location names separately (for display and submission)
const locationNames = reactive({
  region: DEFAULT_REGION_NAME,
  province: DEFAULT_PROVINCE_NAME,
  municipality: '',
  barangay: '',
})

// File input refs
const govIdInput = ref<HTMLInputElement>()
const birTinInput = ref<HTMLInputElement>()
const dtiSecInput = ref<HTMLInputElement>()
const fdaInput = ref<HTMLInputElement>()
const businessPermitInput = ref<HTMLInputElement>()

// Local state
const isSubmitting = ref(false)
const showSuccess = ref(false)
const validationErrors = ref<string[]>([])

// File upload state
const uploadProgress = ref({
  governmentId: false,
  birTin: false,
  dtiOrSec: false,
  fdaCertificate: false,
  businessPermit: false,
})

// Location data
const regions = ref<{ code: string; name: string }[]>([])
const municipalities = ref<{ code: string; name: string; zipCode?: string }[]>([])
const provinces = ref<{ code: string; name: string }[]>([])
const barangays = ref<{ name: string; zipCode?: string }[]>([])

// Computed validation
const isValid = computed(() => {
  return form.shopName.trim().length >= 2 &&
         form.region &&
         form.province &&
         form.municipality &&
         form.barangay &&
         form.zipCode &&
         form.shopProfile && // Shop profile is now required
         form.governmentId &&
         form.birTin &&
         form.dtiOrSec &&
         validationErrors.value.length === 0
})

const isPdfFile = (file: File | null) => file?.type === 'application/pdf'

// Shop Profile Image Handler
const handleShopProfileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  
  if (!file) return
  
  // Validate image file
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    validationErrors.value = validationErrors.value.filter(e => !e.includes('Shop Profile'))
    validationErrors.value.push('Shop Profile: Only JPEG, PNG, or WebP images are allowed')
    return
  }
  
  if (file.size > 5 * 1024 * 1024) {
    validationErrors.value = validationErrors.value.filter(e => !e.includes('Shop Profile'))
    validationErrors.value.push('Shop Profile: Image must be less than 5MB')
    return
  }
  
  form.shopProfile = file
  validationErrors.value = validationErrors.value.filter(e => !e.includes('Shop Profile'))
  
  // Create preview URL
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
  }
  shopProfilePreview.value = URL.createObjectURL(file)
}

const removeShopProfile = () => {
  form.shopProfile = null
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
    shopProfilePreview.value = null
  }
  validationErrors.value = validationErrors.value.filter(e => !e.includes('Shop Profile'))
  if (shopProfileInput.value) {
    shopProfileInput.value.value = ''
  }
}

const refreshRegions = async () => {
  try {
    regions.value = await locationStore.fetchRegions()
  } catch (error) {
    console.error('Failed to load regions', error)
  }
}

const refreshProvinces = async (regionCode: string) => {
  if (!regionCode) return
  try {
    provinces.value = await locationStore.fetchProvinces(regionCode)
  } catch (error) {
    console.error('Failed to load provinces', error)
  }
}

const refreshMunicipalities = async (provinceCode: string) => {
  if (!provinceCode) return
  try {
    municipalities.value = await locationStore.fetchCities(provinceCode)
  } catch (error) {
    console.error('Failed to load municipalities', error)
  }
}

const refreshBarangays = async (cityCode: string) => {
  if (!cityCode) return
  try {
    barangays.value = await locationStore.fetchBarangays(cityCode)
  } catch (error) {
    console.error('Failed to load barangays', error)
  }
}

// File validation
const validateFile = (file: File | null, maxSize = 10, allowedTypes: string[] = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']) => {
  if (!file) return 'File is required'
  
  const maxSizeBytes = maxSize * 1024 * 1024 // Convert to bytes
  
  if (file.size > maxSizeBytes) {
    return `File size must be less than ${maxSize}MB`
  }
  
  if (!allowedTypes.includes(file.type)) {
    const typeNames = allowedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')
    return `Only ${typeNames} files are allowed`
  }
  
  return null
}

// File handlers
const handleFileSelect = (event: Event, field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate' | 'businessPermit') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  
  if (!file) return
  
  // Validate file
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  const error = validateFile(file, 10, allowedTypes)
  
  if (error) {
    validationErrors.value = validationErrors.value.filter(err => !err.includes(field))
    validationErrors.value.push(`${field}: ${error}`)
    return
  }
  
  // Set file to form
  form[field] = file
  
  // Remove previous errors
  validationErrors.value = validationErrors.value.filter(err => !err.includes(field))
  
  // Create preview for images
  if (file.type.startsWith('image/')) {
    const previewKey = field as keyof typeof documentPreviews
    if (previewKey in documentPreviews) {
      // Clean up previous preview
      if (documentPreviews[previewKey]) {
        URL.revokeObjectURL(documentPreviews[previewKey]!)
      }
      documentPreviews[previewKey] = URL.createObjectURL(file)
    }
  } else {
    // For PDFs, clear any existing preview
    const previewKey = field as keyof typeof documentPreviews
    if (previewKey in documentPreviews && documentPreviews[previewKey]) {
      URL.revokeObjectURL(documentPreviews[previewKey]!)
      documentPreviews[previewKey] = null
    }
  }
  
  uploadProgress.value[field] = !!file
}

const removeFile = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate' | 'businessPermit') => {
  form[field] = null
  uploadProgress.value[field] = false
  
  // Clean up image preview
  const previewKey = field as keyof typeof documentPreviews
  if (documentPreviews[previewKey]) {
    URL.revokeObjectURL(documentPreviews[previewKey]!)
    documentPreviews[previewKey] = null
  }
  
  // Clear validation errors for this field
  validationErrors.value = validationErrors.value.filter(err => !err.includes(field))
  
  // Reset file input
  if (field === 'governmentId' && govIdInput.value) {
    govIdInput.value.value = ''
  } else if (field === 'birTin' && birTinInput.value) {
    birTinInput.value.value = ''
  } else if (field === 'dtiOrSec' && dtiSecInput.value) {
    dtiSecInput.value.value = ''
  } else if (field === 'fdaCertificate' && fdaInput.value) {
    fdaInput.value.value = ''
  } else if (field === 'businessPermit' && businessPermitInput.value) {
    businessPermitInput.value.value = ''
  }
}

const getFileName = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate' | 'businessPermit') => {
  return form[field]?.name || ''
}

const getFileSize = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate' | 'businessPermit') => {
  const file = form[field]
  if (!file) return ''
  
  const size = file.size
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  } else {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
}

// Form validation
const validateForm = () => {
  const errors: string[] = []
  
  if (!form.shopName.trim() || form.shopName.trim().length < 2) {
    errors.push('Shop name must be at least 2 characters long')
  }
  
  if (!form.region) errors.push('Region is required')
  if (!form.province) errors.push('Province is required')
  if (!form.municipality) errors.push('Municipality/City is required')
  if (!form.barangay) errors.push('Barangay is required')
  if (!form.zipCode) errors.push('Zip code is required')
  
  // Validate shop profile image (required)
  if (!form.shopProfile) {
    errors.push('Shop Profile Image is required')
  }
  
  // Validate files - government ID and BIR should be images, DTI/SEC can be image or PDF
  const govIdError = validateFile(form.governmentId)
  if (govIdError) errors.push(`Government ID: ${govIdError}`)
  
  const birError = validateFile(form.birTin)
  if (birError) errors.push(`BIR TIN: ${birError}`)
  
  const dtiError = validateFile(form.dtiOrSec)
  if (dtiError) errors.push(`DTI/SEC: ${dtiError}`)

  // Business Permit is required
  if (!form.businessPermit) {
    errors.push('Business Permit is required')
  } else {
    const businessPermitError = validateFile(form.businessPermit)
    if (businessPermitError) errors.push(`Business Permit: ${businessPermitError}`)
  }

  // FDA certificate is optional but must be valid if provided
  const fdaError = form.fdaCertificate ? validateFile(form.fdaCertificate) : null
  if (fdaError) errors.push(`FDA Certificate: ${fdaError}`)
  
  validationErrors.value = errors
  return errors.length === 0
}

// Submit application
const submitApplication = async () => {
  if (!validateForm()) return
  
  isSubmitting.value = true
  
  try {
    // Submit with both codes and names for proper display
    await sellerStore.submitApplication({
      ...form,
      // Include location names for display
      regionName: locationNames.region,
      provinceName: locationNames.province,
      municipalityName: locationNames.municipality,
      barangayName: locationNames.barangay,
    })
    showSuccess.value = true
    
    // Auto close after 3 seconds
    setTimeout(() => {
      emit('success')
      closeModal()
    }, 3000)
    
  } catch (error) {
    console.error('Failed to submit application:', error)
  } finally {
    isSubmitting.value = false
  }
}

// Modal handlers
const closeModal = () => {
  if (isSubmitting.value) return
  
  resetForm()
  emit('close')
}

const resetForm = () => {
  form.shopName = ''
  form.region = DEFAULT_REGION_CODE
  form.province = DEFAULT_PROVINCE_CODE
  form.municipality = ''
  form.barangay = ''
  form.address = '' // Required by SellerApplicationForm type
  form.zipCode = ''
  form.street = ''
  form.additionalInfo = ''
  form.shopAddress = ''
  form.governmentId = null
  form.birTin = null
  form.dtiOrSec = null
  form.fdaCertificate = null
  form.businessPermit = null
  form.shopProfile = null
  
  // Reset location names
  locationNames.region = DEFAULT_REGION_NAME
  locationNames.province = DEFAULT_PROVINCE_NAME
  locationNames.municipality = ''
  locationNames.barangay = ''
  
  // Reset shop profile preview
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
    shopProfilePreview.value = null
  }
  
  // Reset document previews
  Object.keys(documentPreviews).forEach(key => {
    const previewKey = key as keyof typeof documentPreviews
    if (documentPreviews[previewKey]) {
      URL.revokeObjectURL(documentPreviews[previewKey]!)
      documentPreviews[previewKey] = null
    }
  })
  
  uploadProgress.value = {
    governmentId: false,
    birTin: false,
    dtiOrSec: false,
    fdaCertificate: false,
    businessPermit: false,
  }
  
  validationErrors.value = []
  showSuccess.value = false
  sellerStore.clearError()
  sellerStore.clearSuccess()
}

// Watch for store errors
watch(() => sellerStore.error, (error) => {
  if (error) {
    validationErrors.value = [error]
  }
})

// Load regions when modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    refreshRegions()
  }
})

// Since region and province are locked, we only need municipality watcher
watch(() => form.municipality, async (municipalityCode) => {
  // Clear child selections
  form.barangay = ''
  form.zipCode = ''
  locationNames.barangay = ''
  barangays.value = []
  
  // Set municipality name
  const selectedMunicipality = municipalities.value.find(m => m.code === municipalityCode)
  locationNames.municipality = selectedMunicipality?.name || ''
  
  if (municipalityCode) await refreshBarangays(municipalityCode)
})

watch(() => form.barangay, async (barangayName) => {
  // Set barangay name - form.barangay stores the name directly
  const selectedBarangay = barangays.value.find(b => b.name === barangayName)
  locationNames.barangay = selectedBarangay?.name || barangayName || ''
  
  if (form.municipality && barangayName && locationNames.barangay) {
    try {
      const zip = await locationStore.fetchZipCode(form.municipality, locationNames.barangay)
      if (zip) form.zipCode = zip
    } catch (error) {
      console.error('Unable to fetch zip code', error)
    }
  }
})

// Watch for success
watch(() => sellerStore.submitSuccess, (success) => {
  if (success) {
    showSuccess.value = true
  }
})

// Watch for modal opening to fetch cities for Oriental Mindoro
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen && municipalities.value.length === 0) {
    try {
      console.log('[SellerApplication] Loading cities for Oriental Mindoro...');
      const cities = await locationStore.fetchCities(DEFAULT_PROVINCE_CODE);
      municipalities.value = cities;
      console.log('[SellerApplication] Loaded cities:', cities);
    } catch (error) {
      console.error('[SellerApplication] Failed to load cities:', error);
    }
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
  }
  
  // Cleanup document previews
  Object.keys(documentPreviews).forEach(key => {
    const previewKey = key as keyof typeof documentPreviews
    if (documentPreviews[previewKey]) {
      URL.revokeObjectURL(documentPreviews[previewKey]!)
    }
  })
})
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-container">
      
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">Apply to be a Seller</h2>
        <button @click="closeModal" :disabled="isSubmitting" class="close-button">
          <XMarkIcon class="close-icon" />
        </button>
      </div>

      <!-- Success State -->
      <div v-if="showSuccess" class="success-state">
        <CheckCircleIcon class="success-icon" />
        <h3>Application Submitted!</h3>
        <p>Your seller application has been submitted successfully. We'll review it and get back to you within 3-5 business days.</p>
        <button @click="closeModal" class="btn btn-primary">
          Close
        </button>
      </div>

      <!-- Application Form -->
      <div v-else class="modal-content">
        
        <!-- Info Banner -->
        <div class="info-banner">
          <InformationCircleIcon class="info-icon" />
          <div>
            <h4>Required Documents</h4>
            <p>Please prepare the following documents (PNG/JPG or PDF, max 10MB each):</p>
            <ul>
              <li>Government-issued ID (National ID, Driver's License, Passport, or UMID)</li>
              <li>BIR TIN Registration (scan or photo)</li>
              <li>DTI or SEC Registration (scan or photo)</li>
              <li>Business Permit (scan or photo)</li>
              <li>FDA Certificate (optional, for food/health products)</li>
            </ul>
            <p><strong>Note:</strong> PDF uploads are accepted for business documents.</p>
          </div>
        </div>

        <!-- Form -->
        <form @submit.prevent="submitApplication" class="application-form">
          
          <!-- Shop Information -->
          <div class="form-section">
            <h3>Shop Information</h3>
            
            <div class="form-group">
              <label for="shopName" class="form-label">Shop Name *</label>
              <input
                id="shopName"
                v-model="form.shopName"
                type="text"
                required
                placeholder="Enter your shop name"
                class="form-input"
                :disabled="isSubmitting"
              />
            </div>

            <div class="address-grid">
              <!-- Region (Locked to MIMAROPA) -->
              <div class="form-group">
                <label for="region" class="form-label">
                  Region (Fixed) * 
                  <LockClosedIcon class="lock-icon" />
                </label>
                <select
                  id="region"
                  v-model="form.region"
                  class="form-input locked-field"
                  disabled
                >
                  <option :value="DEFAULT_REGION_CODE">{{ DEFAULT_REGION_NAME }}</option>
                </select>
                <small class="lock-description">
                  <LockClosedIcon class="lock-text-icon" />
                  Locked to {{ DEFAULT_REGION_NAME }} for this version
                </small>
              </div>

              <!-- Province (Locked to Oriental Mindoro) -->
              <div class="form-group">
                <label for="province" class="form-label">
                  Province (Fixed) * 
                  <LockClosedIcon class="lock-icon" />
                </label>
                <select
                  id="province"
                  v-model="form.province"
                  class="form-input locked-field"
                  disabled
                >
                  <option :value="DEFAULT_PROVINCE_CODE">{{ DEFAULT_PROVINCE_NAME }}</option>
                </select>
                <small class="lock-description">
                  <LockClosedIcon class="lock-text-icon" />
                  Locked to {{ DEFAULT_PROVINCE_NAME }} for this version
                </small>
              </div>

              <div class="form-group">
                <label for="municipality" class="form-label">Municipality/City *</label>
                <select
                  id="municipality"
                  v-model="form.municipality"
                  class="form-input"
                  :disabled="isSubmitting || !form.province"
                >
                  <option value="">Select municipality</option>
                  <option v-for="city in municipalities" :key="city.code" :value="city.code">
                    {{ city.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label for="barangay" class="form-label">Barangay *</label>
                <select
                  id="barangay"
                  v-model="form.barangay"
                  class="form-input"
                  :disabled="isSubmitting || !form.municipality"
                >
                  <option value="">Select barangay</option>
                  <option v-for="brgy in barangays" :key="brgy.name" :value="brgy.name">
                    {{ brgy.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label for="zipCode" class="form-label">Zip Code *</label>
                <input
                  id="zipCode"
                  v-model="form.zipCode"
                  type="text"
                  inputmode="numeric"
                  maxlength="10"
                  placeholder="Zip code"
                  class="form-input"
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-group">
                <label for="street" class="form-label">Street (optional)</label>
                <input
                  id="street"
                  v-model="form.street"
                  type="text"
                  placeholder="House/Unit, Building, Street"
                  class="form-input"
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-group">
                <label for="additionalInfo" class="form-label">Additional directions (optional)</label>
                <textarea
                  id="additionalInfo"
                  v-model="form.additionalInfo"
                  placeholder="Landmarks, delivery instructions, etc."
                  class="form-textarea"
                  rows="2"
                  :disabled="isSubmitting"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Shop Profile Image Section -->
          <div class="form-section">
            <h3>
              <PhotoIcon class="section-icon" />
              Shop Profile Image
            </h3>
            <p class="section-description">Upload a profile picture for your shop. This will be displayed on your shop page and as a map pin for your location.</p>
            
            <div class="shop-profile-upload">
              <div v-if="!form.shopProfile" class="profile-dropzone" @click="shopProfileInput?.click()">
                <PhotoIcon class="upload-icon-large" />
                <span class="upload-text">Click to upload shop profile image *</span>
                <span class="upload-hint">JPEG, PNG, or WebP (max 5MB)</span>
                <input
                  ref="shopProfileInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  @change="handleShopProfileSelect"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="profile-preview">
                <img :src="shopProfilePreview!" alt="Shop profile preview" class="profile-image" />
                <div class="profile-info">
                  <span class="profile-name">{{ form.shopProfile?.name }}</span>
                  <button 
                    type="button" 
                    @click="removeShopProfile"
                    :disabled="isSubmitting"
                    class="remove-profile-btn"
                  >
                    <XMarkIcon class="remove-icon" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Document Uploads -->
          <div class="form-section">
            <h3>Required Documents</h3>
            
            <!-- Government ID -->
            <div class="upload-group">
              <label class="upload-label">
                Government ID * <span class="format-hint">(PNG, JPG, or PDF, max 10MB)</span>
              </label>
              
              <div v-if="!form.governmentId" class="file-dropzone" @click="govIdInput?.click()">
                <DocumentArrowUpIcon class="upload-icon" />
                <span>Click to upload Government ID image</span>
                <input
                  ref="govIdInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  @change="handleFileSelect($event, 'governmentId')"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="file-preview">
                <div v-if="documentPreviews.governmentId" class="image-preview">
                  <img :src="documentPreviews.governmentId" alt="Government ID Preview" class="preview-image" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ getFileName('governmentId') }}</span>
                  <span class="file-size">{{ getFileSize('governmentId') }}</span>
                  <span v-if="isPdfFile(form.governmentId)" class="file-type-badge">PDF</span>
                </div>
                <button 
                  type="button" 
                  @click="removeFile('governmentId')"
                  :disabled="isSubmitting"
                  class="remove-file-btn"
                >
                  <XMarkIcon class="remove-icon" />
                </button>
              </div>
            </div>

            <!-- BIR TIN -->
            <div class="upload-group">
              <label class="upload-label">
                BIR TIN Registration * <span class="format-hint">(PNG, JPG, or PDF, max 10MB)</span>
              </label>
              
              <div v-if="!form.birTin" class="file-dropzone" @click="birTinInput?.click()">
                <DocumentArrowUpIcon class="upload-icon" />
                <span>Click to upload BIR TIN document image</span>
                <input
                  ref="birTinInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  @change="handleFileSelect($event, 'birTin')"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="file-preview">
                <div v-if="documentPreviews.birTin" class="image-preview">
                  <img :src="documentPreviews.birTin" alt="BIR TIN Preview" class="preview-image" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ getFileName('birTin') }}</span>
                  <span class="file-size">{{ getFileSize('birTin') }}</span>
                  <span v-if="isPdfFile(form.birTin)" class="file-type-badge">PDF</span>
                </div>
                <button 
                  type="button" 
                  @click="removeFile('birTin')"
                  :disabled="isSubmitting"
                  class="remove-file-btn"
                >
                  <XMarkIcon class="remove-icon" />
                </button>
              </div>
            </div>

            <!-- DTI/SEC -->
            <div class="upload-group">
              <label class="upload-label">
                DTI or SEC Registration * <span class="format-hint">(PNG, JPG, or PDF, max 10MB)</span>
              </label>
              
              <div v-if="!form.dtiOrSec" class="file-dropzone" @click="dtiSecInput?.click()">
                <DocumentArrowUpIcon class="upload-icon" />
                <span>Click to upload DTI/SEC document image</span>
                <input
                  ref="dtiSecInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  @change="handleFileSelect($event, 'dtiOrSec')"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="file-preview">
                <div v-if="documentPreviews.dtiOrSec" class="image-preview">
                  <img :src="documentPreviews.dtiOrSec" alt="DTI/SEC Preview" class="preview-image" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ getFileName('dtiOrSec') }}</span>
                  <span class="file-size">{{ getFileSize('dtiOrSec') }}</span>
                  <span v-if="isPdfFile(form.dtiOrSec)" class="file-type-badge">PDF</span>
                </div>
                <button 
                  type="button" 
                  @click="removeFile('dtiOrSec')"
                  :disabled="isSubmitting"
                  class="remove-file-btn"
                >
                  <XMarkIcon class="remove-icon" />
                </button>
              </div>
            </div>

            <!-- FDA Certificate (Optional) -->
            <div class="upload-group">
              <label class="upload-label">
                FDA Certificate (Optional) <span class="format-hint">(PNG, JPG, or PDF, max 10MB)</span>
              </label>
              
              <div v-if="!form.fdaCertificate" class="file-dropzone" @click="fdaInput?.click()">
                <DocumentArrowUpIcon class="upload-icon" />
                <span>Click to upload FDA Certificate (if applicable)</span>
                <input
                  ref="fdaInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  @change="handleFileSelect($event, 'fdaCertificate')"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="file-preview">
                <div v-if="documentPreviews.fdaCertificate" class="image-preview">
                  <img :src="documentPreviews.fdaCertificate" alt="FDA Certificate Preview" class="preview-image" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ getFileName('fdaCertificate') }}</span>
                  <span class="file-size">{{ getFileSize('fdaCertificate') }}</span>
                  <span v-if="isPdfFile(form.fdaCertificate)" class="file-type-badge">PDF</span>
                </div>
                <button 
                  type="button" 
                  @click="removeFile('fdaCertificate')"
                  :disabled="isSubmitting"
                  class="remove-file-btn"
                >
                  <XMarkIcon class="remove-icon" />
                </button>
              </div>
            </div>
          </div>

          <!-- Business Permit (Required) -->
          <div class="form-row">
            <div class="file-upload-section">
              <label class="file-upload-label">
                Business Permit <span class="required">*</span> <span class="format-hint">(PNG, JPG, or PDF, max 10MB)</span>
              </label>
              
              <div v-if="!form.businessPermit" class="file-dropzone" @click="businessPermitInput?.click()">
                <DocumentArrowUpIcon class="upload-icon" />
                <span>Click to upload Business Permit</span>
                <input
                  ref="businessPermitInput"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  @change="handleFileSelect($event, 'businessPermit')"
                  class="file-input"
                  :disabled="isSubmitting"
                />
              </div>
              
              <div v-else class="file-preview">
                <div v-if="documentPreviews.businessPermit" class="image-preview">
                  <img :src="documentPreviews.businessPermit" alt="Business Permit Preview" class="preview-image" />
                </div>
                <div class="file-info">
                  <span class="file-name">{{ getFileName('businessPermit') }}</span>
                  <span class="file-size">{{ getFileSize('businessPermit') }}</span>
                  <span v-if="isPdfFile(form.businessPermit)" class="file-type-badge">PDF</span>
                </div>
                <button 
                  type="button" 
                  @click="removeFile('businessPermit')"
                  :disabled="isSubmitting"
                  class="remove-file-btn"
                >
                  <XMarkIcon class="remove-icon" />
                </button>
              </div>
            </div>
          </div>

          <!-- Validation Errors -->
          <div v-if="validationErrors.length > 0" class="error-section">
            <ExclamationTriangleIcon class="error-icon" />
            <div>
              <p class="error-title">Please fix the following errors:</p>
              <ul class="error-list">
                <li v-for="error in validationErrors" :key="error">{{ error }}</li>
              </ul>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="form-actions">
            <button 
              type="button" 
              @click="closeModal"
              :disabled="isSubmitting"
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button 
              type="submit"
              :disabled="!isValid || isSubmitting"
              class="btn btn-primary"
            >
              <span v-if="isSubmitting">Submitting...</span>
              <span v-else>Submit Application</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  background: var(--surface);
  border-radius: 1rem;
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all var(--transition-fast);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.close-button {
  background: none;
  border: none;
  padding: 0.5rem;
  border-radius: 0.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
}

.success-icon {
  width: 4rem;
  height: 4rem;
  color: var(--success-color);
  margin-bottom: 1rem;
}

.success-state h3 {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-primary);
}

.success-state p {
  color: var(--text-secondary);
  margin: 0 0 2rem 0;
  line-height: 1.5;
}

.info-banner {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.info-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #3b82f6;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.info-banner h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #1e40af;
}

.info-banner p {
  font-size: 0.875rem;
  color: #1e40af;
  margin: 0 0 0.5rem 0;
}

.info-banner ul {
  font-size: 0.875rem;
  color: #1e40af;
  margin: 0;
  padding-left: 1.25rem;
}

.info-banner li {
  margin-bottom: 0.25rem;
}

.application-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.address-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-textarea {
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.format-hint {
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.file-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 2px dashed var(--border-color);
  border-radius: 0.5rem;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.file-dropzone:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.upload-icon {
  width: 2rem;
  height: 2rem;
  color: var(--text-secondary);
}

.file-input {
  display: none;
}

.file-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--surface);
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.file-size {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.remove-file-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: var(--error-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-file-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
}

.remove-icon {
  width: 1rem;
  height: 1rem;
}

.error-section {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
}

.error-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #dc2626;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.error-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: #dc2626;
}

.error-list {
  font-size: 0.875rem;
  color: #dc2626;
  margin: 0;
  padding-left: 1.25rem;
}

.error-list li {
  margin-bottom: 0.25rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--surface-hover);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-outline {
  background: transparent;
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

.btn-outline:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
}

.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

/* Section Icons */
.section-icon {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: 0.5rem;
  vertical-align: middle;
}

.section-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.5rem 0 1rem;
  line-height: 1.5;
}

/* Shop Profile Upload Styles */
.shop-profile-upload {
  margin-top: 0.5rem;
}

.profile-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border: 2px dashed var(--border-color);
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface);
}

.profile-dropzone:hover {
  border-color: var(--primary-color);
  background: var(--surface-hover);
}

.upload-icon-large {
  width: 3rem;
  height: 3rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.upload-text {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.upload-hint {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  background: var(--surface);
}

.profile-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 2px solid var(--border-color);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.profile-name {
  font-size: 0.875rem;
  color: var(--text-primary);
  word-break: break-all;
}

.remove-profile-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  color: #ef4444;
  background: transparent;
  border: 1px solid #ef4444;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  width: fit-content;
}

.remove-profile-btn:hover:not(:disabled) {
  background: #ef4444;
  color: white;
}

/* Location Section Styles */
.location-section {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.section-header-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0;
}

.section-header-toggle h3 {
  margin: 0;
  display: flex;
  align-items: center;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--primary-color);
  background: transparent;
  border: 1px solid var(--primary-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.location-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.location-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.location-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-icon {
  width: 1.125rem;
  height: 1.125rem;
}

.divider-text {
  text-align: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  position: relative;
}

.divider-text::before,
.divider-text::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background: var(--border-color);
}

.divider-text::before {
  left: 0;
}

.divider-text::after {
  right: 0;
}

.manual-coords {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.coord-input-group {
  flex: 1;
  min-width: 120px;
}

.coord-input-group label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.coord-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  background: var(--bg);
  color: var(--text-primary);
}

.coord-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.location-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  color: #dc2626;
}

.map-wrapper {
  margin-bottom: 1rem;
}

.map-container {
  width: 100%;
  height: 300px;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
  z-index: 0;
}

.map-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  text-align: center;
}

.location-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.location-coords {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.coord-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.coord-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', monospace;
}

/* Custom Map Marker Styles */
:deep(.custom-marker) {
  background: transparent;
  border: none;
}

:deep(.marker-container) {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(-50%);
}

:deep(.marker-pin) {
  width: 24px;
  height: 24px;
  background: var(--primary-color, #3b82f6);
  border: 3px solid white;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

:deep(.marker-label) {
  margin-top: 4px;
  padding: 2px 8px;
  background: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }
  
  .modal-container {
    max-height: 95vh;
    border-radius: 1rem 1rem 0 0;
    width: 100%;
    max-width: none;
  }
  
  .info-banner {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .btn {
    width: 100%;
  }
  
  .manual-coords {
    flex-direction: column;
  }
  
  .coord-input-group {
    width: 100%;
  }
  
  .location-display {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
  
  .profile-preview {
    flex-direction: column;
    text-align: center;
  }
}

/* Lock Icon Styles */
.lock-icon {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary);
  margin-left: 0.25rem;
  vertical-align: middle;
}

.lock-text-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--text-secondary);
  margin-right: 0.25rem;
  vertical-align: middle;
}

.locked-field {
  background-color: var(--bg-tertiary) !important;
  cursor: not-allowed;
  opacity: 0.7;
}

.lock-description {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  font-style: italic;
}

/* Image Preview Styles */
.image-preview {
  margin-bottom: 0.75rem;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.preview-image {
  width: 100%;
  max-width: 300px;
  height: auto;
  max-height: 200px;
  object-fit: contain;
  display: block;
  background-color: var(--bg-tertiary);
}

.file-type-badge {
  background-color: var(--primary-color);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 0.5rem;
}
</style>