<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  MapPinIcon,
  PhotoIcon
} from '@heroicons/vue/24/outline'
import { useSellerApplicationStore, type SellerApplicationForm } from '../stores/sellerApplicationStore'
import { useLocationStore } from '../stores/locationStore'
import { useTheme } from '../composables/useTheme'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

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

// Form state - stores codes for API selection
const form = reactive<SellerApplicationForm>({
  shopName: '',
  region: '',
  province: '',
  municipality: '',
  barangay: '',
  zipCode: '',
  street: '',
  additionalInfo: '',
  shopAddress: '',
  governmentId: null,
  birTin: null,
  dtiOrSec: null,
  fdaCertificate: null,
  shopProfile: null, // New: Shop profile image (required)
})

// Shop location state (optional)
const shopLocation = reactive({
  latitude: null as number | null,
  longitude: null as number | null,
  useCurrentLocation: false
})

// Shop profile image preview
const shopProfilePreview = ref<string | null>(null)
const shopProfileInput = ref<HTMLInputElement>()

// Track location names separately (for display and submission)
const locationNames = reactive({
  region: '',
  province: '',
  municipality: '',
  barangay: '',
})

// File input refs
const govIdInput = ref<HTMLInputElement>()
const birTinInput = ref<HTMLInputElement>()
const dtiSecInput = ref<HTMLInputElement>()
const fdaInput = ref<HTMLInputElement>()

// Local state
const isSubmitting = ref(false)
const showSuccess = ref(false)
const validationErrors = ref<string[]>([])

// Map state
const mapContainer = ref<HTMLDivElement>()
const map = ref<L.Map | null>(null)
const marker = ref<L.Marker | null>(null)
const showLocationSection = ref(false)
const isGettingLocation = ref(false)
const locationError = ref('')
const manualLatitude = ref('')
const manualLongitude = ref('')
// File upload state
const uploadProgress = ref({
  governmentId: false,
  birTin: false,
  dtiOrSec: false,
  fdaCertificate: false,
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

// Check if location is set
const hasLocation = computed(() => {
  return shopLocation.latitude !== null && shopLocation.longitude !== null
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

// Map Functions
const initializeMap = async () => {
  await nextTick()
  
  if (!mapContainer.value || map.value) return
  
  // Default to Philippines center
  const defaultCenter: [number, number] = [12.8797, 121.7740]
  const initialCenter = hasLocation.value 
    ? [shopLocation.latitude!, shopLocation.longitude!] as [number, number]
    : defaultCenter
  
  map.value = L.map(mapContainer.value, {
    center: initialCenter,
    zoom: hasLocation.value ? 15 : 6,
    zoomControl: true
  })
  
  // Always use standard OpenStreetMap tiles
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  
  L.tileLayer(tileUrl, {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value)
  
  // Add marker if location exists
  if (hasLocation.value) {
    addMarker(shopLocation.latitude!, shopLocation.longitude!)
  }
  
  // Click on map to set location
  map.value.on('click', (e: L.LeafletMouseEvent) => {
    setLocation(e.latlng.lat, e.latlng.lng)
  })
}

const destroyMap = () => {
  if (map.value) {
    map.value.remove()
    map.value = null
    marker.value = null
  }
}

const addMarker = (lat: number, lng: number) => {
  if (!map.value) return
  
  // Remove existing marker
  if (marker.value) {
    map.value.removeLayer(marker.value)
  }
  
  // Create custom icon with shop name
  const customIcon = L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-container">
        <div class="marker-pin"></div>
        <span class="marker-label">${form.shopName || 'Your Shop'}</span>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50]
  })
  
  marker.value = L.marker([lat, lng], { 
    icon: customIcon,
    draggable: true 
  }).addTo(map.value)
  
  // Update location on marker drag
  marker.value.on('dragend', () => {
    const pos = marker.value?.getLatLng()
    if (pos) {
      setLocation(pos.lat, pos.lng, false)
    }
  })
}

const setLocation = (lat: number, lng: number, updateMap = true) => {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    locationError.value = 'Invalid coordinates'
    return
  }
  
  shopLocation.latitude = parseFloat(lat.toFixed(6))
  shopLocation.longitude = parseFloat(lng.toFixed(6))
  manualLatitude.value = shopLocation.latitude.toString()
  manualLongitude.value = shopLocation.longitude.toString()
  locationError.value = ''
  
  if (updateMap && map.value) {
    addMarker(lat, lng)
    map.value.setView([lat, lng], 15)
  }
}

const getCurrentLocation = () => {
  if (!navigator.geolocation) {
    locationError.value = 'Geolocation is not supported by your browser'
    return
  }
  
  isGettingLocation.value = true
  locationError.value = ''
  
  // Try high accuracy first for better precision
  const tryGetLocation = (highAccuracy: boolean, isRetry = false) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position.coords.latitude, position.coords.longitude)
        shopLocation.useCurrentLocation = true
        isGettingLocation.value = false
      },
      (error) => {
        // If high accuracy failed and this isn't a retry, try with low accuracy
        if (highAccuracy && !isRetry && error.code === error.TIMEOUT) {
          console.log('High accuracy timed out, trying low accuracy...')
          tryGetLocation(false, true)
          return
        }
        
        isGettingLocation.value = false
        switch (error.code) {
          case error.PERMISSION_DENIED:
            locationError.value = 'Location access denied. Please enable location permission in your browser settings.'
            break
          case error.POSITION_UNAVAILABLE:
            locationError.value = 'Location information unavailable. Please enter coordinates manually.'
            break
          case error.TIMEOUT:
            locationError.value = 'Location request timed out. Please try again or enter coordinates manually.'
            break
          default:
            locationError.value = 'Unable to get your location. Please enter coordinates manually.'
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 20000 : 30000,
        maximumAge: 0 // Always get fresh location for accuracy
      }
    )
  }
  
  // Start with high accuracy
  tryGetLocation(true)
}

const applyManualCoordinates = () => {
  const lat = parseFloat(manualLatitude.value)
  const lng = parseFloat(manualLongitude.value)
  
  if (isNaN(lat) || isNaN(lng)) {
    locationError.value = 'Please enter valid numbers for coordinates'
    return
  }
  
  if (lat < -90 || lat > 90) {
    locationError.value = 'Latitude must be between -90 and 90'
    return
  }
  
  if (lng < -180 || lng > 180) {
    locationError.value = 'Longitude must be between -180 and 180'
    return
  }
  
  setLocation(lat, lng)
}

const removeLocation = () => {
  shopLocation.latitude = null
  shopLocation.longitude = null
  shopLocation.useCurrentLocation = false
  manualLatitude.value = ''
  manualLongitude.value = ''
  locationError.value = ''
  
  if (marker.value && map.value) {
    map.value.removeLayer(marker.value)
    marker.value = null
    map.value.setView([12.8797, 121.7740], 6)
  }
}

const toggleLocationSection = async () => {
  showLocationSection.value = !showLocationSection.value
  
  if (showLocationSection.value) {
    await nextTick()
    initializeMap()
  } else {
    destroyMap()
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
const handleFileSelect = (event: Event, field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] || null
  
  form[field] = file
  
  // Validate file
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
  const error = validateFile(file, 10, allowedTypes)
  
  // Update validation errors
  const errorKey = `${field}Error`
  validationErrors.value = validationErrors.value.filter(err => !err.includes(field))
  
  if (error) {
    validationErrors.value.push(`${field}: ${error}`)
  }
  
  uploadProgress.value[field] = !!file
}

const removeFile = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate') => {
  form[field] = null
  uploadProgress.value[field] = false
  
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
  }
}

const getFileName = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate') => {
  return form[field]?.name || ''
}

const getFileSize = (field: 'governmentId' | 'birTin' | 'dtiOrSec' | 'fdaCertificate') => {
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

  // FDA certificate is optional but must be valid if provided
  const fdaError = form.fdaCertificate ? validateFile(form.fdaCertificate) : null
  if (fdaError) errors.push(`FDA Certificate: ${fdaError}`)
  
  // Validate location if coordinates are partially filled
  if ((shopLocation.latitude !== null && shopLocation.longitude === null) ||
      (shopLocation.latitude === null && shopLocation.longitude !== null)) {
    errors.push('Please provide both latitude and longitude, or leave both empty')
  }
  
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
      // Include shop location if provided
      shopLatitude: shopLocation.latitude,
      shopLongitude: shopLocation.longitude,
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
  form.region = ''
  form.province = ''
  form.municipality = ''
  form.barangay = ''
  form.zipCode = ''
  form.street = ''
  form.additionalInfo = ''
  form.shopAddress = ''
  form.governmentId = null
  form.birTin = null
  form.dtiOrSec = null
  form.fdaCertificate = null
  form.shopProfile = null
  
  // Reset location names
  locationNames.region = ''
  locationNames.province = ''
  locationNames.municipality = ''
  locationNames.barangay = ''
  
  // Reset shop profile preview
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
    shopProfilePreview.value = null
  }
  
  // Reset shop location
  shopLocation.latitude = null
  shopLocation.longitude = null
  shopLocation.useCurrentLocation = false
  manualLatitude.value = ''
  manualLongitude.value = ''
  locationError.value = ''
  showLocationSection.value = false
  
  // Destroy map
  destroyMap()
  
  uploadProgress.value = {
    governmentId: false,
    birTin: false,
    dtiOrSec: false,
    fdaCertificate: false,
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

watch(() => form.region, async (regionCode) => {
  // Clear child selections
  form.province = ''
  form.municipality = ''
  form.barangay = ''
  form.zipCode = ''
  locationNames.province = ''
  locationNames.municipality = ''
  locationNames.barangay = ''
  provinces.value = []
  municipalities.value = []
  barangays.value = []
  
  // Set region name
  const selectedRegion = regions.value.find(r => r.code === regionCode)
  locationNames.region = selectedRegion?.name || ''
  
  if (regionCode) await refreshProvinces(regionCode)
})

watch(() => form.province, async (provinceCode) => {
  // Clear child selections
  form.municipality = ''
  form.barangay = ''
  form.zipCode = ''
  locationNames.municipality = ''
  locationNames.barangay = ''
  municipalities.value = []
  barangays.value = []
  
  // Set province name
  const selectedProvince = provinces.value.find(p => p.code === provinceCode)
  locationNames.province = selectedProvince?.name || ''
  
  if (provinceCode) await refreshMunicipalities(provinceCode)
})

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

watch(() => form.barangay, async (barangayCode) => {
  // Set barangay name
  const selectedBarangay = barangays.value.find(b => b.code === barangayCode)
  locationNames.barangay = selectedBarangay?.name || barangayCode || ''
  
  if (form.municipality && barangayCode && locationNames.barangay) {
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

// Cleanup on unmount
onUnmounted(() => {
  destroyMap()
  if (shopProfilePreview.value) {
    URL.revokeObjectURL(shopProfilePreview.value)
  }
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
              <div class="form-group">
                <label for="region" class="form-label">Region *</label>
                <select
                  id="region"
                  v-model="form.region"
                  class="form-input"
                  :disabled="isSubmitting"
                >
                  <option value="">Select region</option>
                  <option v-for="region in regions" :key="region.code" :value="region.code">
                    {{ region.name }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label for="province" class="form-label">Province *</label>
                <select
                  id="province"
                  v-model="form.province"
                  class="form-input"
                  :disabled="isSubmitting || !form.region"
                >
                  <option value="">Select province</option>
                  <option v-for="province in provinces" :key="province.code" :value="province.code">
                    {{ province.name }}
                  </option>
                </select>
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

          <!-- Shop Location Section (Optional) -->
          <div class="form-section location-section">
            <div class="section-header-toggle">
              <h3>
                <MapPinIcon class="section-icon" />
                Shop Location (Optional)
              </h3>
              <button 
                type="button" 
                @click="toggleLocationSection" 
                class="toggle-btn"
                :disabled="isSubmitting"
              >
                {{ showLocationSection ? 'Hide' : 'Add Location' }}
              </button>
            </div>
            <p class="section-description">
              Add your shop's exact location to help customers find you on the map. 
              Your shop will appear on the "Nearby Shops" page for customers looking for local stores.
            </p>

            <div v-if="showLocationSection" class="location-content">
              <!-- Location Actions -->
              <div class="location-actions">
                <button 
                  type="button" 
                  @click="getCurrentLocation" 
                  class="btn btn-secondary location-btn"
                  :disabled="isSubmitting || isGettingLocation"
                >
                  <MapPinIcon class="btn-icon" />
                  {{ isGettingLocation ? 'Getting Location...' : 'Use My Current Location' }}
                </button>
                
                <span class="divider-text">or enter coordinates manually</span>
                
                <div class="manual-coords">
                  <div class="coord-input-group">
                    <label>Latitude</label>
                    <input
                      v-model="manualLatitude"
                      type="text"
                      placeholder="e.g., 14.5995"
                      class="coord-input"
                      :disabled="isSubmitting"
                    />
                  </div>
                  <div class="coord-input-group">
                    <label>Longitude</label>
                    <input
                      v-model="manualLongitude"
                      type="text"
                      placeholder="e.g., 120.9842"
                      class="coord-input"
                      :disabled="isSubmitting"
                    />
                  </div>
                  <button 
                    type="button" 
                    @click="applyManualCoordinates" 
                    class="btn btn-sm btn-outline"
                    :disabled="isSubmitting || !manualLatitude || !manualLongitude"
                  >
                    Apply
                  </button>
                </div>
              </div>

              <!-- Location Error -->
              <div v-if="locationError" class="location-error">
                <ExclamationTriangleIcon class="error-icon" />
                {{ locationError }}
              </div>

              <!-- Map Container -->
              <div class="map-wrapper">
                <div ref="mapContainer" class="map-container"></div>
                <p class="map-hint">Click on the map or drag the marker to set your shop's exact location</p>
              </div>

              <!-- Current Location Display -->
              <div v-if="hasLocation" class="location-display">
                <div class="location-coords">
                  <span class="coord-label">Coordinates:</span>
                  <span class="coord-value">{{ shopLocation.latitude }}, {{ shopLocation.longitude }}</span>
                </div>
                <button 
                  type="button" 
                  @click="removeLocation" 
                  class="btn btn-sm btn-danger"
                  :disabled="isSubmitting"
                >
                  Remove Location
                </button>
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
                <div class="file-info">
                  <span class="file-name">{{ getFileName('governmentId') }}</span>
                  <span class="file-size">{{ getFileSize('governmentId') }}</span>
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
                <div class="file-info">
                  <span class="file-name">{{ getFileName('birTin') }}</span>
                  <span class="file-size">{{ getFileSize('birTin') }}</span>
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
                <div class="file-info">
                  <span class="file-name">{{ getFileName('dtiOrSec') }}</span>
                  <span class="file-size">{{ getFileSize('dtiOrSec') }}</span>
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
                <div class="file-info">
                  <span class="file-name">{{ getFileName('fdaCertificate') }}</span>
                  <span class="file-size">{{ getFileSize('fdaCertificate') }}</span>
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
</style>