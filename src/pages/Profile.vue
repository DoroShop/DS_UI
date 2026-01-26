<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import Header from "../components/Header.vue"
import { useAuthStore } from "../stores/authStores"
import { useUserStore } from "../stores/userStores"
import { useOrderStore } from "../stores/OrderStores"
import { useMessageStore } from "../stores/messageStore"
import { useSellerApplicationStore } from "../stores/sellerApplicationStore"
import { useLocationStore } from "../stores/locationStore"
import { useTheme } from "../composables/useTheme"
import SellerApplicationModal from "../components/SellerApplicationModal.vue"
import Wallet from "../components/Wallet.vue"
import {
  UserCircleIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  IdentificationIcon,
  ArrowRightOnRectangleIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  CogIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  CameraIcon,
  PhotoIcon,
  DocumentTextIcon,
  WalletIcon,
  MapIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  MoonIcon,
  SunIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const auth = useAuthStore()
const userStore = useUserStore()
const orderStore = useOrderStore()
const messageStore = useMessageStore()
const sellerStore = useSellerApplicationStore()
const locationStore = useLocationStore()
const { isDark } = useTheme()

const isLoggingOut = ref(false)
const isLoading = ref(true)
const showSellerModal = ref(false)
const showWalletModal = ref(false)
const showEditModal = ref(false)
const isSaving = ref(false)
const isSubmitting = ref(false)
const editError = ref('')
const editSuccess = ref('')
const submitError = ref('')

// Edit form data
const editForm = reactive({
  name: '',
  phone: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    region: '',
    zipCode: ''
  }
})

// Location selection state (codes for API)
const selectedLocation = reactive({
  regionCode: '',
  provinceCode: '',
  cityCode: '',
  barangay: ''
})

// Location data for dropdowns
const regions = ref<{ code: string; name: string }[]>([])
const provinces = ref<{ code: string; name: string }[]>([])
const cities = ref<{ code: string; name: string; zipCode?: string }[]>([])
const barangays = ref<{ code: string; name: string; zipCode?: string }[]>([])
const isLoadingLocation = ref(false)

// Profile image upload
const profileImageFile = ref<File | null>(null)
const profileImagePreview = ref<string>('')
const isUploadingImage = ref(false)

// Document preview state
const showDocumentPreview = ref(false)
const previewDocumentUrl = ref('')
const previewDocumentType = ref('')

// Get user from both auth store (session) and user store (detailed info)
const user = computed(() => auth.user)
const userDetails = computed(() => userStore.userData)

// Try to get from localStorage as fallback
const localUserData = computed(() => {
  try {
    const stored = localStorage.getItem("userInfo")
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
})

// Merge all user data sources, prioritizing the most complete data
const mergedUser = computed(() => {
  return {
    ...user.value,
    ...localUserData.value,
    ...userDetails.value
  }
})

// Computed properties with proper fallbacks
const displayName = computed(() =>
  mergedUser.value?.name ||
  mergedUser.value?.fullname ||
  mergedUser.value?.username ||
  user.value?.name ||
  'User'
)

const displayEmail = computed(() => {
  // Email is mandatory during signup, check all sources
  return mergedUser.value?.email ||
    user.value?.email ||
    userDetails.value?.email ||
    'Not available'
})

const displayRole = computed(() => {
  const role = mergedUser.value?.role || user.value?.role || 'customer'
  return role.charAt(0).toUpperCase() + role.slice(1)
})

const displayId = computed(() =>
  mergedUser.value?._id ||
  mergedUser.value?.id ||
  user.value?.id ||
  user.value?._id ||
  '—'
)

const displayPhone = computed(() => {
  const phone = mergedUser.value?.phone || userDetails.value?.phone
  return phone && phone !== 'N/A' ? phone : 'Not set'
})

const displayAddress = computed(() => {
  const addr = mergedUser.value?.address || userDetails.value?.address || localUserData.value?.address
  if (!addr) return 'Not set'

  const parts = [
    addr.street,
    addr.barangay,
    addr.city,
    addr.province,
    addr.zipCode
  ].filter(p => p && p !== 'N/A' && p !== '')

  return parts.length > 0 ? parts.join(', ') : 'Not set'
})

// User stats from actual stores
const userStats = computed(() => ({
  orders: orderStore.orders?.length || 0,
  reviews: 0, // Will be populated when review store is available
  messages: messageStore.unreadCount || messageStore.computedUnreadCount || 0
}))

// Format wallet balance as currency
const walletBalance = computed(() => {
  const amount = userStore.walletBalance || 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount)
})

const handleLogout = async () => {
  if (isLoggingOut.value) return

  isLoggingOut.value = true
  try {
    await auth.logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout failed:', error)
  } finally {
    isLoggingOut.value = false
  }
}

const navigateTo = (path: string) => {
  router.push(path)
}

// Theme toggle handler
const toggleTheme = () => {
  const { toggleTheme } = useTheme()
  toggleTheme()
}

// Watchers for cascading location selection
watch(() => selectedLocation.regionCode, async (newCode) => {
  if (!newCode) {
    provinces.value = []
    cities.value = []
    barangays.value = []
    selectedLocation.provinceCode = ''
    selectedLocation.cityCode = ''
    selectedLocation.barangay = ''
    editForm.address.province = ''
    editForm.address.city = ''
    editForm.address.barangay = ''
    editForm.address.zipCode = ''
    return
  }

  isLoadingLocation.value = true
  try {
    const data = await locationStore.fetchProvinces(newCode)
    provinces.value = data
    cities.value = []
    barangays.value = []
    selectedLocation.provinceCode = ''
    selectedLocation.cityCode = ''
    selectedLocation.barangay = ''

    // Set region name
    const region = regions.value.find(r => r.code === newCode)
    editForm.address.region = region?.name || ''
  } catch (error) {
    console.error('Failed to fetch provinces:', error)
  } finally {
    isLoadingLocation.value = false
  }
})

watch(() => selectedLocation.provinceCode, async (newCode) => {
  if (!newCode) {
    cities.value = []
    barangays.value = []
    selectedLocation.cityCode = ''
    selectedLocation.barangay = ''
    editForm.address.city = ''
    editForm.address.barangay = ''
    editForm.address.zipCode = ''
    return
  }

  isLoadingLocation.value = true
  try {
    const data = await locationStore.fetchCities(newCode)
    cities.value = data
    barangays.value = []
    selectedLocation.cityCode = ''
    selectedLocation.barangay = ''

    // Set province name
    const province = provinces.value.find(p => p.code === newCode)
    editForm.address.province = province?.name || ''
  } catch (error) {
    console.error('Failed to fetch cities:', error)
  } finally {
    isLoadingLocation.value = false
  }
})

watch(() => selectedLocation.cityCode, async (newCode) => {
  if (!newCode) {
    barangays.value = []
    selectedLocation.barangay = ''
    editForm.address.barangay = ''
    editForm.address.zipCode = ''
    return
  }

  isLoadingLocation.value = true
  try {
    const data = await locationStore.fetchBarangays(newCode)
    barangays.value = data
    selectedLocation.barangay = ''

    // Set city name and auto-fill zip code if available
    const city = cities.value.find(c => c.code === newCode)
    editForm.address.city = city?.name || ''
    if (city?.zipCode) {
      editForm.address.zipCode = city.zipCode
    }
  } catch (error) {
    console.error('Failed to fetch barangays:', error)
  } finally {
    isLoadingLocation.value = false
  }
})

watch(() => selectedLocation.barangay, async (newBarangay) => {
  if (!newBarangay) {
    editForm.address.barangay = ''
    return
  }

  editForm.address.barangay = newBarangay

  // Try to fetch zip code for barangay
  if (selectedLocation.cityCode) {
    const zip = await locationStore.fetchZipCode(selectedLocation.cityCode, newBarangay)
    if (zip) {
      editForm.address.zipCode = zip
    }
  }
})

// Edit Profile handlers
const handleEditProfile = async () => {
  // Populate form with current data
  editForm.name = displayName.value || ''
  editForm.phone = displayPhone.value === 'Not set' ? '' : displayPhone.value

  const addr = mergedUser.value?.address || {}
  editForm.address.street = addr.street || ''
  editForm.address.barangay = addr.barangay || ''
  editForm.address.city = addr.city || ''
  editForm.address.province = addr.province || ''
  editForm.address.region = addr.region || ''
  editForm.address.zipCode = addr.zipCode || ''

  // Reset location selection
  selectedLocation.regionCode = ''
  selectedLocation.provinceCode = ''
  selectedLocation.cityCode = ''
  selectedLocation.barangay = ''

  // Set current profile image
  profileImagePreview.value = mergedUser.value?.imageUrl || ''
  profileImageFile.value = null

  editError.value = ''
  editSuccess.value = ''
  showEditModal.value = true

  // Load regions for dropdown
  try {
    isLoadingLocation.value = true
    regions.value = await locationStore.fetchRegions()
  } catch (error) {
    console.error('Failed to fetch regions:', error)
  } finally {
    isLoadingLocation.value = false
  }
}

const closeEditModal = () => {
  showEditModal.value = false
  profileImageFile.value = null
  profileImagePreview.value = ''
  editError.value = ''
  editSuccess.value = ''
}

// Handle profile image selection
const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]

    // Validate file type
    if (!file.type.startsWith('image/')) {
      editError.value = 'Please select an image file'
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      editError.value = 'Image size must be less than 5MB'
      return
    }

    profileImageFile.value = file
    profileImagePreview.value = URL.createObjectURL(file)
    editError.value = ''
  }
}

const triggerImageUpload = () => {
  const input = document.getElementById('profile-image-input')
  if (input) input.click()
}

// Save profile changes
const saveProfile = async () => {
  isSaving.value = true
  editError.value = ''
  editSuccess.value = ''

  try {
    // Prepare update data
    const updateData: any = {
      name: editForm.name,
      phone: editForm.phone,
      address: editForm.address
    }

    // If there's a new profile image, upload it first
    if (profileImageFile.value) {
      isUploadingImage.value = true
      try {
        const formData = new FormData()
        formData.append('image', profileImageFile.value)

        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload/profile-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${auth.token}`
          },
          body: formData,
          credentials: 'include'
        })

        if (response.ok) {
          const result = await response.json()
          updateData.imageUrl = result.imageUrl || result.url
        } else {
          console.error('Failed to upload image')
        }
      } catch (uploadErr) {
        console.error('Image upload error:', uploadErr)
      } finally {
        isUploadingImage.value = false
      }
    }

    // Update user profile
    await userStore.updateUser(updateData)

    // Refresh user data
    userStore.isFetched = false
    await userStore.fetchUser()
    await auth.fetchSession()

    editSuccess.value = 'Profile updated successfully!'

    // Close modal after a short delay
    setTimeout(() => {
      closeEditModal()
    }, 1500)

  } catch (err: any) {
    editError.value = err.response?.data?.message || err.message || 'Failed to update profile'
  } finally {
    isSaving.value = false
  }
}

// Seller application handlers
const openSellerApplication = () => {
  showSellerModal.value = true
}

const closeSellerModal = () => {
  showSellerModal.value = false
}

const handleSellerApplicationSuccess = async () => {
  showSellerModal.value = false
  // Refresh seller application status
  await sellerStore.fetchApplicationStatus()
}

// Handle cancel application
const handleCancelApplication = async () => {
  if (!confirm('Are you sure you want to cancel your seller application? This will permanently delete your uploaded documents and you will need to reapply.')) {
    return
  }

  try {
    await sellerStore.cancelApplication()
    alert('Your seller application has been cancelled successfully.')
  } catch (error) {
    alert('Failed to cancel application. Please try again.')
  }
}

// Computed properties for seller application
const canApplyToBeSeller = computed(() => {
  const userRole = user.value?.role
  return userRole !== 'vendor' && userRole !== 'admin' && sellerStore.canApply
})

const sellerApplicationStatus = computed(() => {
  return sellerStore.statusText
})

// Document preview functions
const fixDocumentUrl = (url: string | undefined | null) => {
  if (!url) return ''
  let fixedUrl = url
  if (fixedUrl.toLowerCase().includes('.pdf') && fixedUrl.includes('/image/upload/')) {
    fixedUrl = fixedUrl.replace('/image/upload/', '/raw/upload/')
  }
  if (fixedUrl.includes('/fl_attachment/')) {
    fixedUrl = fixedUrl.replace('/fl_attachment/', '/')
  }
  fixedUrl = fixedUrl.replace(/,?fl_attachment,?/g, '')
  return fixedUrl
}

const isPdfUrl = (url: string | undefined | null) => {
  if (!url) return false
  const lowerUrl = url.toLowerCase()
  return lowerUrl.includes('.pdf') || lowerUrl.includes('/raw/upload/')
}

const openDocumentPreview = (url: string, type: string) => {
  const safeUrl = fixDocumentUrl(url)
  previewDocumentUrl.value = safeUrl
  previewDocumentType.value = type
  showDocumentPreview.value = true
}

const closeDocumentPreview = () => {
  showDocumentPreview.value = false
  previewDocumentUrl.value = ''
  previewDocumentType.value = ''
}

// Status formatting
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'pending': return 'Under Review'
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    default: return 'Unknown'
  }
}

// Date formatting
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(async () => {
  isLoading.value = true

  // Ensure user session is loaded
  if (!auth.authChecked) {
    await auth.fetchSession()
  }

  // Fetch user data and orders for stats
  try {
    await Promise.all([
      userStore.fetchUser(),
      orderStore.fetchOrders(),
      sellerStore.fetchApplicationStatus()
    ])
  } catch (error) {
    console.error('Failed to load profile data:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Header />
  <main class="profile-page">

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <div class="skeleton-hero">
        <div class="skeleton-avatar skeleton-shimmer"></div>
        <div class="skeleton-text skeleton-title skeleton-shimmer"></div>
        <div class="skeleton-text skeleton-subtitle skeleton-shimmer"></div>
        <div class="skeleton-badge skeleton-shimmer"></div>
      </div>

      <div class="skeleton-stats">
        <div class="skeleton-stat-card skeleton-shimmer"></div>
        <div class="skeleton-stat-card skeleton-shimmer"></div>
        <div class="skeleton-stat-card skeleton-shimmer"></div>
      </div>

      <div class="skeleton-section">
        <div class="skeleton-section-header skeleton-shimmer"></div>
        <div class="skeleton-info-row skeleton-shimmer"></div>
        <div class="skeleton-info-row skeleton-shimmer"></div>
        <div class="skeleton-info-row skeleton-shimmer"></div>
        <div class="skeleton-info-row skeleton-shimmer"></div>
      </div>

      <div class="skeleton-section">
        <div class="skeleton-section-header skeleton-shimmer"></div>
        <div class="skeleton-action-btn skeleton-shimmer"></div>
        <div class="skeleton-action-btn skeleton-shimmer"></div>
        <div class="skeleton-action-btn skeleton-shimmer"></div>
      </div>
    </div>

    <!-- Profile Content -->
    <div v-else class="profile-container">

      <!-- Hero Section with Avatar -->
      <section class="profile-hero">
        <div class="hero-content">
          <div class="avatar-wrapper">
            <div class="avatar">
              <img v-if="mergedUser?.imageUrl" :src="mergedUser.imageUrl" alt="Profile" class="avatar-image" />
              <UserCircleIcon v-else class="avatar-icon" />
            </div>
            <button class="avatar-edit-btn" @click="handleEditProfile" title="Change profile picture">
              <PencilSquareIcon class="edit-icon" />
            </button>
          </div>

          <div class="hero-info">
            <h1 class="profile-name">{{ displayName }}</h1>
            <p class="profile-email">
              <EnvelopeIcon class="email-icon" />
              {{ displayEmail }}
            </p>
            <div class="profile-badge" :class="`badge-${user?.role || 'customer'}`">
              <ShieldCheckIcon class="badge-icon" />
              <span>{{ displayRole }}</span>
            </div>

            <!-- Seller Application Status -->
            <div v-if="user?.role !== 'vendor' && user?.role !== 'admin'" class="seller-status">
              <div v-if="sellerStore.application?.status === 'pending'" class="status-badge status-pending">
                🕒 Seller Application: {{ sellerApplicationStatus }}
              </div>
              <div v-else-if="sellerStore.application?.status === 'approved'" class="status-badge status-approved">
                ✅ Seller Application: {{ sellerApplicationStatus }}
              </div>
              <div v-else-if="sellerStore.application?.status === 'rejected'" class="status-badge status-rejected">
                ❌ Seller Application: {{ sellerApplicationStatus }}
                <p v-if="sellerStore.application?.rejectionReason" class="rejection-reason">
                  Reason: {{ sellerStore.application.rejectionReason }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="stats-grid">
        <div class="stat-card" @click="navigateTo('/orders')">
          <ShoppingBagIcon class="stat-icon stat-icon-orders" />
          <div class="stat-content">
            <p class="stat-value">{{ userStats.orders }}</p>
            <p class="stat-label">Orders</p>
          </div>
        </div>

        <div class="stat-card">
          <CheckCircleIcon class="stat-icon stat-icon-reviews" />
          <div class="stat-content">
            <p class="stat-value">{{ userStats.reviews }}</p>
            <p class="stat-label">Reviews</p>
          </div>
        </div>

        <div class="stat-card" @click="navigateTo('/messages')">
          <ChatBubbleLeftRightIcon class="stat-icon stat-icon-messages" />
          <div class="stat-content">
            <p class="stat-value">{{ userStats.messages }}</p>
            <p class="stat-label">Messages</p>
          </div>
        </div>
      </section>

      <!-- Wallet Balance Section -->
      <section class="wallet-balance-section">
        <div class="wallet-balance-card">
          <div class="wallet-card-header">
            <div class="wallet-card-title-group">
              <WalletIcon class="wallet-card-icon" />
              <div>
                <h3 class="wallet-card-title">My Wallet</h3>
                <p class="wallet-card-subtitle">Available Balance</p>
              </div>
            </div>
          </div>
          
          <div class="wallet-card-content">
            <div class="balance-display">
              <p class="balance-amount">{{ walletBalance }}</p>
              <p class="balance-info">Wallet updates after refunds are processed.</p>
            </div>
            
            <!-- <div class="wallet-card-actions">
              <button class="wallet-action-btn primary" @click="showWalletModal = true">
                <ArrowUpCircleIcon class="action-icon-small" />
                <span>Details</span>
              </button>
              <button class="wallet-action-btn secondary" @click="showWalletModal = true">
                <ArrowDownCircleIcon class="action-icon-small" />
                <span>Withdraw</span>
              </button>
            </div> -->
          </div>
        </div>
      </section>

      <section class="actions-section">
        <h2 class="section-title quick-action">Quick Actions</h2>

        <div class="actions-grid">
          <button class="action-card" @click="navigateTo('/orders')">
            <ShoppingBagIcon class="action-icon" />
            <div class="action-content">
              <h3>My Orders</h3>
            </div>
          </button>

          <button class="action-card" @click="navigateTo('/messages')">
            <ChatBubbleLeftRightIcon class="action-icon" />
            <div class="action-content">
              <h3>Messages</h3>
            </div>
          </button>
<!-- 
          <button class="action-card" @click="showWalletModal = true">
            <WalletIcon class="action-icon" />
            <div class="action-content">
              <h3>My Wallet</h3>
            </div>
          </button> -->

          <button class="action-card" @click="toggleTheme">
            <SunIcon v-if="isDark" class="action-icon" />
            <MoonIcon v-else class="action-icon" />
            <div class="action-content">
              <h3>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</h3>
            </div>
          </button>
          
          <button v-if="user?.role === 'vendor'" class="action-card" @click="navigateTo('/vendor/dashboard')">
            <BuildingStorefrontIcon class="action-icon" />
            <div class="action-content">
              <h3>Vendor Dashboard</h3>
            </div>
          </button>

          <!-- Admin Dashboard Button -->
          <button v-if="user?.role === 'admin'" class="action-card action-card-admin"
            @click="navigateTo('/admin/dashboard')">
            <CogIcon class="action-icon" />
            <div class="action-content">
              <h3>Admin Dashboard</h3>
            </div>
          </button>

          <!-- Seller Application Button -->
          <button v-if="canApplyToBeSeller" class="action-card action-card-seller" @click="openSellerApplication"
            :disabled="sellerStore.isPending">
            <BuildingStorefrontIcon class="action-icon" />
            <div class="action-content">
              <h3>{{ sellerStore.isPending ? 'Application Pending' : 'Apply to be a Seller' }}</h3>
              <p>{{ sellerStore.isPending ? 'Your application is under review' : 'Start selling your products' }}</p>
            </div>
          </button>

          <!-- Cancel Application Button -->
          <button v-if="sellerStore.isPending" class="action-card action-card-cancel" @click="handleCancelApplication"
            :disabled="sellerStore.loading">
            <ExclamationTriangleIcon class="action-icon" />
            <div class="action-content">
              <h3>Cancel Application</h3>
              <p>Cancel your pending seller application</p>
            </div>
          </button>

          <!-- Reapply Button for Rejected Applications -->
          <button v-if="sellerStore.isRejected && user?.role !== 'vendor'" class="action-card action-card-reapply"
            @click="openSellerApplication">
            <BuildingStorefrontIcon class="action-icon" />
            <div class="action-content">
              <h3>Reapply to be a Seller</h3>
              <p>Submit a new seller application</p>
            </div>
          </button>
        </div>
      </section>

      <section class="info-section">
        <div class="section-header">
          <h2>Account Information</h2>
          <button class="edit-btn" @click="handleEditProfile">
            <PencilSquareIcon class="btn-icon" />
            <span>Edit Profile</span>
          </button>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <div class="info-icon-wrapper">
              <UserCircleIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">Full Name</p>
              <p class="info-value">{{ displayName }}</p>
            </div>
          </div>

          <div class="info-item">
            <div class="info-icon-wrapper">
              <EnvelopeIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">Email Address</p>
              <p class="info-value">{{ displayEmail }}</p>
            </div>
          </div>

          <div class="info-item">
            <div class="info-icon-wrapper">
              <PhoneIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">Phone Number</p>
              <p class="info-value">{{ displayPhone }}</p>
            </div>
          </div>

          <div class="info-item">
            <div class="info-icon-wrapper">
              <ShieldCheckIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">Account Type</p>
              <p class="info-value">{{ displayRole }}</p>
            </div>
          </div>

          <div class="info-item">
            <div class="info-icon-wrapper">
              <IdentificationIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">User ID</p>
              <p class="info-value user-id">{{ displayId }}</p>
            </div>
          </div>

          <div class="info-item info-item-full">
            <div class="info-icon-wrapper">
              <MapPinIcon class="info-icon" />
            </div>
            <div class="info-content">
              <p class="info-label">Address</p>
              <p class="info-value">{{ displayAddress }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Seller Application Details -->
      <section v-if="sellerStore.application && sellerStore.application.status !== 'not_applied'"
        class="application-section">
        <div class="section-header">
          <h2>Seller Application Details</h2>
          <span class="status-badge" :class="`status-${sellerStore.application.status}`">
            {{ getStatusLabel(sellerStore.application.status) }}
          </span>
        </div>

        <div class="application-details">
          <div class="application-info">
            <div class="info-row">
              <strong>Shop Name:</strong>
              <span>{{ sellerStore.application.shopName || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Shop Address:</strong>
              <span>{{ sellerStore.application.shopAddress || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Region:</strong>
              <span>{{ sellerStore.application.address?.region || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Province:</strong>
              <span>{{ sellerStore.application.address?.province || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Municipality/City:</strong>
              <span>{{ sellerStore.application.address?.municipality || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Barangay:</strong>
              <span>{{ sellerStore.application.address?.barangay || 'N/A' }}</span>
            </div>
            <div class="info-row">
              <strong>Zip Code:</strong>
              <span>{{ sellerStore.application.address?.zipCode || 'N/A' }}</span>
            </div>
            <div class="info-row" v-if="sellerStore.application.address?.street">
              <strong>Street:</strong>
              <span>{{ sellerStore.application.address?.street }}</span>
            </div>
            <div class="info-row" v-if="sellerStore.application.address?.additionalInfo">
              <strong>Directions:</strong>
              <span>{{ sellerStore.application.address?.additionalInfo }}</span>
            </div>
            <div class="info-row">
              <strong>Submitted:</strong>
              <span>{{ formatDate(sellerStore.application.submittedAt) }}</span>
            </div>
            <div v-if="sellerStore.application.reviewedAt" class="info-row">
              <strong>Reviewed:</strong>
              <span>{{ formatDate(sellerStore.application.reviewedAt) }}</span>
            </div>
            <div v-if="sellerStore.application.rejectionReason" class="info-row">
              <strong>Rejection Reason:</strong>
              <span class="rejection-text">{{ sellerStore.application.rejectionReason }}</span>
            </div>
          </div>

          <!-- Document Preview -->
          <div class="documents-preview">
            <h3>Submitted Documents</h3>
            <div class="document-grid">
              <div v-if="sellerStore.application.governmentIdUrl" class="document-item"
                @click="openDocumentPreview(sellerStore.application.governmentIdUrl, 'Government ID')">
                <img v-if="!isPdfUrl(sellerStore.application.governmentIdUrl)"
                  :src="sellerStore.application.governmentIdUrl" alt="Government ID" class="document-thumbnail" />
                <div v-else class="document-pdf">
                  <DocumentTextIcon class="pdf-icon" />
                  <span>PDF</span>
                </div>
                <span class="document-label">Government ID</span>
              </div>

              <div v-if="sellerStore.application.birTinUrl" class="document-item"
                @click="openDocumentPreview(sellerStore.application.birTinUrl, 'BIR TIN Registration')">
                <img v-if="!isPdfUrl(sellerStore.application.birTinUrl)" :src="sellerStore.application.birTinUrl"
                  alt="BIR TIN" class="document-thumbnail" />
                <div v-else class="document-pdf">
                  <DocumentTextIcon class="pdf-icon" />
                  <span>PDF</span>
                </div>
                <span class="document-label">BIR TIN</span>
              </div>

              <div v-if="sellerStore.application.dtiOrSecUrl" class="document-item"
                @click="openDocumentPreview(sellerStore.application.dtiOrSecUrl, 'DTI/SEC Registration')">
                <img v-if="!isPdfUrl(sellerStore.application.dtiOrSecUrl)" :src="sellerStore.application.dtiOrSecUrl"
                  alt="DTI/SEC" class="document-thumbnail" />
                <div v-else class="document-pdf">
                  <DocumentTextIcon class="pdf-icon" />
                  <span>PDF</span>
                </div>
                <span class="document-label">DTI/SEC</span>
              </div>

              <div v-if="sellerStore.application?.fdaCertificateUrl" class="document-item"
                @click="openDocumentPreview(sellerStore.application?.fdaCertificateUrl, 'FDA Certificate')">
                <img v-if="!isPdfUrl(sellerStore.application?.fdaCertificateUrl)"
                  :src="sellerStore.application.fdaCertificateUrl" alt="FDA Certificate" class="document-thumbnail" />
                <div v-else class="document-pdf">
                  <DocumentTextIcon class="pdf-icon" />
                  <span>PDF</span>
                </div>
                <span class="document-label">FDA Certificate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Stats -->


      <!-- Account Information -->


      <!-- Quick Actions -->
      <section>
        <button class="logout-btn" @click="handleLogout" :disabled="isLoggingOut">
          <ArrowRightOnRectangleIcon class="logout-icon" />
          <span>{{ isLoggingOut ? 'Logging out...' : 'Sign Out' }}</span>
        </button>
      </section>

      <section class="bottom-space">
      </section>

    </div>

    <!-- Seller Application Modal -->
    <SellerApplicationModal :is-open="showSellerModal" @close="closeSellerModal"
      @success="handleSellerApplicationSuccess" />

    <!-- Wallet Modal -->
    <div v-if="showWalletModal" class="wallet-modal-overlay" @click.self="showWalletModal = false">
      <Wallet @closeWallet="showWalletModal = false" />
    </div>

    <!-- Document Preview Modal -->
    <div v-if="showDocumentPreview" class="modal-overlay" @click.self="closeDocumentPreview">
      <div class="document-preview-modal">
        <div class="preview-modal-header">
          <h3>{{ previewDocumentType }}</h3>
          <button class="close-btn" @click="closeDocumentPreview">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="preview-modal-body">
          <img v-if="!isPdfUrl(previewDocumentUrl)" :src="previewDocumentUrl" :alt="previewDocumentType"
            class="full-preview-img" />
          <div v-else class="pdf-preview">
            <DocumentTextIcon class="pdf-icon" />
            <p>This document is a PDF. Open it in a new tab to view.</p>
          </div>
        </div>
        <div class="preview-modal-footer">
          <a :href="previewDocumentUrl" target="_blank" class="btn btn-primary">
            <ArrowTopRightOnSquareIcon class="btn-icon" />
            Open in New Tab
          </a>
        </div>
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="edit-profile-modal">
        <div class="edit-modal-header">
          <h3>Edit Profile</h3>
          <button class="close-btn" @click="closeEditModal" :disabled="isSaving">
            <XMarkIcon class="close-icon" />
          </button>
        </div>

        <div class="edit-modal-body">
          <!-- Success/Error Messages -->
          <div v-if="editSuccess" class="alert alert-success">
            <CheckCircleIcon class="alert-icon" />
            {{ editSuccess }}
          </div>
          <div v-if="editError" class="alert alert-error">
            <ExclamationTriangleIcon class="alert-icon" />
            {{ editError }}
          </div>

          <!-- Profile Image Upload -->
          <div class="image-upload-section">
            <div class="image-preview-wrapper" @click="triggerImageUpload">
              <img v-if="profileImagePreview" :src="profileImagePreview" alt="Profile" class="profile-preview-img" />
              <div v-else class="image-placeholder">
                <UserCircleIcon class="placeholder-icon" />
              </div>
              <div class="image-upload-overlay">
                <CameraIcon class="camera-icon" />
                <span>Change Photo</span>
              </div>
            </div>
            <input type="file" id="profile-image-input" accept="image/*" @change="handleImageSelect"
              class="hidden-input" />
            <p class="image-hint">Click to upload a new photo (max 5MB)</p>
          </div>

          <!-- Form Fields -->
          <div class="form-group">
            <label for="edit-name">Full Name</label>
            <input type="text" id="edit-name" v-model="editForm.name" placeholder="Enter your full name"
              :disabled="isSaving" />
          </div>

          <div class="form-group">
            <label for="edit-phone">Phone Number</label>
            <input type="tel" id="edit-phone" v-model="editForm.phone" placeholder="e.g., +63 912 345 6789"
              :disabled="isSaving" />
          </div>

          <div class="form-divider">
            <span>Address Information</span>
          </div>

          <!-- Location Selection Dropdowns -->
          <div class="form-row">
            <div class="form-group">
              <label for="edit-region">Region</label>
              <select id="edit-region" v-model="selectedLocation.regionCode" :disabled="isSaving || isLoadingLocation" class="form-select">
                <option value="">Select Region</option>
                <option v-for="region in regions" :key="region.code" :value="region.code">
                  {{ region.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-province">Province</label>
              <select id="edit-province" v-model="selectedLocation.provinceCode" :disabled="isSaving || isLoadingLocation || !selectedLocation.regionCode" class="form-select">
                <option value="">Select Province</option>
                <option v-for="province in provinces" :key="province.code" :value="province.code">
                  {{ province.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-city">City/Municipality</label>
              <select id="edit-city" v-model="selectedLocation.cityCode" :disabled="isSaving || isLoadingLocation || !selectedLocation.provinceCode" class="form-select">
                <option value="">Select City/Municipality</option>
                <option v-for="city in cities" :key="city.code" :value="city.code">
                  {{ city.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-barangay">Barangay</label>
              <select id="edit-barangay" v-model="selectedLocation.barangay" :disabled="isSaving || isLoadingLocation || !selectedLocation.cityCode" class="form-select">
                <option value="">Select Barangay</option>
                <option v-for="brgy in barangays" :key="brgy.name" :value="brgy.name">
                  {{ brgy.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-street">Street Address</label>
              <input type="text" id="edit-street" v-model="editForm.address.street"
                placeholder="House/Building number, Street" :disabled="isSaving" />
            </div>
            <div class="form-group form-group-small">
              <label for="edit-zipcode">ZIP Code</label>
              <input type="text" id="edit-zipcode" v-model="editForm.address.zipCode" placeholder="e.g., 5200"
                :disabled="isSaving" />
            </div>
          </div>

          <!-- Loading indicator for location -->
          <div v-if="isLoadingLocation" class="location-loading">
            <span class="spinner-small"></span>
            <span>Loading location data...</span>
          </div>
        </div>

        <div class="edit-modal-footer">
          <button class="btn btn-secondary" @click="closeEditModal" :disabled="isSaving">
            Cancel
          </button>
          <button class="btn btn-primary" @click="saveProfile" :disabled="isSaving">
            <span v-if="isSaving" class="btn-loading">
              <span class="spinner-small"></span>
              Saving...
            </span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* ============================================
   MAIN CONTAINER & LAYOUT
   ============================================ */

.profile-page {
  min-height: 100vh;
  background-color: var(--bg-primary);
  padding-top: 4.5rem;
  padding-bottom: 2rem;
  transition: background-color var(--theme-transition-duration) var(--theme-transition-timing);
}

.profile-container {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* ============================================
   LOADING STATE
   ============================================ */

.loading-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Skeleton Styles */
.skeleton-hero {
  background: var(--surface, white);
  border-radius: 16px;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.skeleton-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-text {
  height: 20px;
  border-radius: 8px;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-title {
  width: 180px;
  height: 24px;
}

.skeleton-subtitle {
  width: 140px;
  height: 16px;
}

.skeleton-badge {
  width: 100px;
  height: 28px;
  border-radius: 20px;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.skeleton-stat-card {
  background: var(--surface, white);
  border-radius: 12px;
  height: 80px;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-section {
  background: var(--surface, white);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-section-header {
  height: 24px;
  width: 60%;
  border-radius: 8px;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-info-row {
  height: 48px;
  border-radius: 8px;
  background: var(--bg-secondary, #f3f4f6);
}

.skeleton-action-btn {
  height: 56px;
  border-radius: 12px;
  background: var(--bg-secondary, #f3f4f6);
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }

  100% {
    background-position: 1000px 0;
  }
}

.skeleton-shimmer {
  background: linear-gradient(90deg,
      var(--bg-secondary, #f3f4f6) 25%,
      var(--border-color, #e5e7eb) 50%,
      var(--bg-secondary, #f3f4f6) 75%);
  background-size: 1000px 100%;
  animation: shimmer 2s infinite linear;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ============================================
   HERO SECTION
   ============================================ */

.profile-hero {
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl) var(--spacing-md);
  box-shadow: var(--card-shadow);
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
  text-align: center;
  border: 1px solid var(--border-primary);
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  transition: transform var(--transition-fast) ease;
}

.avatar:hover {
  transform: scale(1.05);
}

.avatar-icon {
  width: 52px;
  height: 52px;
  color: white;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  border: 3px solid var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  box-shadow: var(--shadow-md);
}

.avatar-edit-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.1);
}

.edit-icon {
  width: 14px;
  height: 14px;
  color: white;
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.profile-name {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.profile-email {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.email-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  transition: all var(--transition-fast) ease;
}

.badge-customer {
  background: var(--color-info-light);
  color: var(--color-info-text);
}

.badge-vendor {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.badge-admin {
  background: var(--color-warning-light);
  color: var(--color-warning-text);
}

.badge-icon {
  width: 14px;
  height: 14px;
}

/* Seller Application Status Styles */
.seller-status {
  margin-top: var(--spacing-sm);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s ease;
  border: none;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-approved {
  background: #dcfce7;
  color: #166534;
}

.status-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.rejection-reason {
  margin-top: var(--spacing-xs);
  font-size: 0.75rem;
  opacity: 0.8;
  font-style: italic;
}

/* ============================================
   STATS GRID
   ============================================ */

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  box-shadow: var(--card-shadow);
  text-align: center;
}

.stat-card:hover {
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-2px);
  border-color: var(--color-primary);
}

@media (max-width: 768px) {
  .stat-card {
    padding: 1rem;
  }
}

.stat-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
}

.stat-icon-orders {
  color: var(--color-primary);
}

.stat-icon-reviews {
  color: var(--color-primary);
}

.stat-icon-messages {
  color: var(--color-primary);
}

.stat-content {
  width: 100%;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: var(--spacing-xs) 0 0;
  font-weight: 500;
}

/* ============================================
   WALLET BALANCE SECTION
   ============================================ */

.wallet-balance-card {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  box-shadow: var(--card-shadow);
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.wallet-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--border-primary);
}

.wallet-card-title-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.wallet-card-icon {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
  flex-shrink: 0;
  transition: color var(--theme-transition-duration) var(--theme-transition-timing);
}

.wallet-card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  transition: color var(--theme-transition-duration) var(--theme-transition-timing);
}

.wallet-card-subtitle {
  margin: var(--spacing-xs) 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color var(--theme-transition-duration) var(--theme-transition-timing);
}

.wallet-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.balance-display {
  background: linear-gradient(135deg, var(--color-primary) 0%, rgba(31, 139, 78, 0.3) 100%);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.balance-amount {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-primary-text);
  letter-spacing: -0.02em;
  transition: color var(--theme-transition-duration) var(--theme-transition-timing);
}

.balance-info {
  margin: var(--spacing-sm) 0 0;
  font-size: 0.875rem;
  color: var(--color-primary-text);
  opacity: 0.85;
  transition: opacity var(--theme-transition-duration) var(--theme-transition-timing);
}

.wallet-card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.wallet-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--theme-transition-duration) ease;
  white-space: nowrap;
}

.wallet-action-btn.primary {
  background: var(--color-primary);
  color: var(--color-primary-text);
  border: 1px solid var(--color-primary);
}

.wallet-action-btn.primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.35);
  transform: translateY(-1px);
}

.wallet-action-btn.secondary {
  background: var(--surface-active);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.wallet-action-btn.secondary:hover {
  background: var(--surface-hover);
  border-color: var(--border-secondary);
  transform: translateY(-1px);
}

.action-icon-small {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .wallet-balance-card {
    padding: var(--spacing-md);
  }

  .wallet-card-header {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
  }

  .wallet-card-title {
    font-size: 1.125rem;
  }

  .balance-display {
    padding: var(--spacing-md);
  }

  .balance-amount {
    font-size: 2rem;
  }

  .wallet-card-actions {
    grid-template-columns: 1fr;
  }
}

/* ============================================
   INFO SECTION
   ============================================ */

.info-section {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  box-shadow: var(--card-shadow);
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-primary);
}

.section-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--btn-secondary-bg);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--btn-secondary-text);
  font-weight: 500;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  min-height: 36px;
}

.edit-btn:hover {
  background: var(--btn-secondary-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-secondary);
  transition: background var(--transition-fast) ease;
}

.info-item:last-child {
  border-bottom: none;
}

.info-item:hover {
  background: transparent;
}

.info-item-full {
  grid-column: 1 / -1;
}

.info-icon-wrapper {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0.15rem;
}

.info-icon {
  width: 20px;
  height: 20px;
  color: var(--text-tertiary);
}

.info-content {
  flex: 1;
  min-width: 0;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin: 0 0 var(--spacing-xs);
  font-weight: 500;
}

.info-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin: 0;
  font-weight: 500;
  word-break: break-word;
}

.user-id {
  font-family: var(--font-mono);
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* ============================================
   ACTIONS SECTION
   ============================================ */

.actions-section {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  box-shadow: var(--card-shadow);
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.bottom-space {
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-primary);
}

.actions-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.action-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  text-align: left;
  min-height: 56px;
}

@media (max-width: 768px) {
  .action-card {
    padding: 1rem;
  }
}

.action-card:hover {
  border-color: var(--color-primary);
  background: var(--surface-hover);
  transform: translateY(-1px);
  box-shadow: var(--card-shadow-hover);
}

.action-icon {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.action-content h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

/* Seller Application Action Cards */
.action-card-seller {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.action-card-seller h3,
.action-card-seller p {
  color: white;
}

.action-card-seller .action-icon {
  color: white;
}

.action-card-seller:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-card-reapply {
  border-color: #f59e0b;
}

.action-card-reapply:hover {
  border-color: #d97706;
  background: #fef3c7;
}

.action-card-reapply .action-icon {
  color: #f59e0b;
}

.action-card-cancel {
  border-color: #ef4444;
}

.action-card-cancel:hover {
  border-color: #dc2626;
  background: #fee2e2;
}

.action-card-cancel .action-icon {
  color: #ef4444;
}

/* Admin Dashboard Action Card */
.action-card-admin {
  border-color: var(--color-primary);
}

.action-card-admin h3,
.action-card-admin p {
  color: var(--primary-color);
}


.action-card-admin:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.action-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.action-card:disabled:hover {
  border-color: var(--border-primary);
  background: var(--bg-secondary);
  transform: none;
  box-shadow: none;
}

/* ============================================
   LOGOUT SECTION
   ============================================ */

.logout-section {
  display: flex;
  justify-content: center;
  padding: var(--spacing-lg) 0;
}

.logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-lg);
  min-height: 48px;
  background: transparent;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-lg);
  color: var(--color-danger);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--transition-fast) ease;

}

.logout-btn:hover:not(:disabled) {
  background: var(--color-danger);
  color: white;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.logout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.logout-icon {
  width: 20px;
  height: 20px;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
  }

  .info-grid {
    gap: 0;
  }

  .actions-grid {
    gap: 0.65rem;
  }

  .section-header h2,
  .section-title {
    font-size: 1.05rem;
  }
}

@media (max-width: 768px) {
  .profile-page {
    padding-top: 4.5rem;
    padding-bottom: var(--spacing-lg);
  }

  .profile-container {
    gap: var(--spacing-md);
    padding: 0 var(--spacing-md);
  }

  .profile-hero {
    padding: var(--spacing-lg) var(--spacing-md);
  }

  .hero-content {
    gap: var(--spacing-sm);
  }

  .avatar {
    width: 80px;
    height: 80px;
  }

  .avatar-icon {
    width: 52px;
    height: 52px;
  }

  .profile-name {
    font-size: 1.25rem;
  }

  .profile-email {
    justify-content: center;
  }

  .info-section,
  .actions-section {
    padding: var(--spacing-lg);
  }

  .section-header {
    margin-bottom: var(--spacing-md);
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .profile-container {
    padding: 0 var(--spacing-sm);
  }

  .profile-hero {
    padding: var(--spacing-lg) var(--spacing-md);
  }

  .avatar {
    width: 80px;
    height: 80px;
  }

  .avatar-icon {
    width: 52px;
    height: 52px;
  }

  .profile-name {
    font-size: 1.2rem;
  }

  .section-header h2,
  .section-title {
    font-size: 1.05rem;
  }

  .stat-card {
    padding: var(--spacing-sm) var(--spacing-xs);
  }

  .stat-value {
    font-size: 1.35rem;
  }

  .stat-label {
    font-size: 0.7rem;
  }

  .info-section,
  .actions-section,
  .application-section {
    padding: var(--spacing-md);
  }

  .action-card {
    padding: var(--spacing-sm);
  }

  .document-grid {
    grid-template-columns: 1fr;
  }
}

/* ============================================
   DARK MODE ENHANCEMENTS
   ============================================ */

@media (prefers-color-scheme: dark) {
  .avatar {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }

  .stat-card:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  }
}

/* ============================================
   SELLER APPLICATION SECTION
   ============================================ */

.application-section {
  background: var(--surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-primary);
  padding: var(--spacing-lg);
  box-shadow: var(--card-shadow);
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.application-section .section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-primary);
}

.application-section .section-header .status-badge {
  font-size: 0.75rem;
  padding: 0.35rem 0.75rem;
}

.application-section .section-header h2 {
  margin: 0;
}

.application-details {
  display: grid;
  gap: var(--spacing-lg);
}

.application-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--border-secondary);
  font-size: 0.875rem;
}

.info-row strong {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.8rem;
}

.info-row span {
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

.info-row:last-child {
  border-bottom: none;
}

.rejection-text {
  color: var(--danger-color);
  font-style: italic;
}

.documents-preview {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.documents-preview h3 {
  margin: 0 0 var(--spacing-sm) 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.document-item {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.document-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--card-shadow-hover);
  transform: translateY(-1px);
}

.document-thumbnail {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-md);
  margin-bottom: 0;
}

.document-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ============================================
   WALLET MODAL
   ============================================ */

.wallet-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--spacing-md);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ============================================
   DOCUMENT PREVIEW MODAL
   ============================================ */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000000;
  padding: var(--spacing-md);
}

.document-preview-modal {
  background: var(--surface);
  border-radius: var(--border-radius-lg);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-2xl);
}

.preview-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
}

.preview-modal-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  padding: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast) ease;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.preview-modal-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg);
}

.full-preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--border-radius-md);
}

.pdf-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--text-primary);
}

.document-pdf {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: #dcfce7;
  border: 1px solid #86efac;
  width: 100%;
  height: 80px;
  padding: 0.5rem;
  border-radius: 8px;
  color: #16a34a;
  gap: 0.25rem;
}

.pdf-icon {
  width: 2rem;
  height: 2rem;
  color: #16a34a;
}

.document-pdf span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #16a34a;
}

.preview-modal-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px var(--spacing-lg);
  border-radius: var(--border-radius-md);
  font-weight: 600;
  text-decoration: none;
  transition: all var(--transition-fast);
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 7px;
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-color-dark);
  transform: translateY(-1px);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */

@media (max-width: 768px) {
  .application-details {
    grid-template-columns: 1fr;
  }

  .info-row {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .document-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .document-preview-modal {
    max-width: 95vw;
    max-height: 95vh;
  }
}

@media (max-width: 480px) {
  .document-grid {
    grid-template-columns: 1fr;
  }
}

/* ============================================
   EDIT PROFILE MODAL
   ============================================ */

.edit-profile-modal {
  background: var(--surface);
  border-radius: var(--radius-lg, 1rem);
  width: 100%;
  max-width: 520px;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}

.edit-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

@media (max-width: 576px) {
  .edit-modal-header {
    padding: 1rem 1.25rem;
  }
}

.edit-modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.edit-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

@media (max-width: 576px) {
  .edit-modal-body {
    padding: 1.25rem;
  }
}

/* Alerts */
.alert {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
}

.alert-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.alert-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.alert-error {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
}

/* Image Upload Section */
.image-upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
}

.image-preview-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid var(--border-color);
  transition: all 0.3s ease;
}

.image-preview-wrapper:hover {
  border-color: var(--primary-color, #1f8b4e);
}

.image-preview-wrapper:hover .image-upload-overlay {
  opacity: 1;
}

.profile-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.placeholder-icon {
  width: 60%;
  height: 60%;
  color: var(--text-tertiary);
}

.image-upload-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.camera-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: white;
}

.image-upload-overlay span {
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.hidden-input {
  display: none;
}

.image-hint {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
}

/* Form Styles */
.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-select {
  width: 100%;
  padding: 0.75rem 1rem;
  min-height: 48px;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.9375rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-select:focus {
  outline: none;
  border-color: var(--primary-color, #1f8b4e);
  box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1);
}

.form-group input:disabled,
.form-group select:disabled,
.form-select:disabled {
  background: var(--bg-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

.location-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.form-group-small {
  max-width: 150px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
}

.form-divider::before,
.form-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.form-divider span {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Modal Footer */
.edit-modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--surface);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner-small {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Edit Profile Modal Responsive */
@media (max-width: 576px) {
  .edit-profile-modal {
    max-width: 100%;
    border-radius: 0;
  }

  .form-row {
    grid-template-columns: 1fr;
  }


  .edit-modal-footer .btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
