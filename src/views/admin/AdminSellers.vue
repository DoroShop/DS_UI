<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import { useTheme } from '../../composables/useTheme';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  BuildingStorefrontIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  NoSymbolIcon,
  StarIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  IdentificationIcon,
  MapPinIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const { isDark } = useTheme();

const props = defineProps<{
  showApplications?: boolean;
}>();

const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const searchQuery = ref('');
const selectedStatus = ref('all');
const activeTab = ref(props.showApplications ? 'applications' : 'sellers');

// Modal states
const showDetailModal = ref(false);
const showRejectModal = ref(false);
const selectedSeller = ref<any>(null);
const selectedApplication = ref<any>(null);
const rejectionReason = ref('');
const actionLoading = ref(false);

// Map state for application review
const applicationMapContainer = ref<HTMLDivElement | null>(null);
const applicationMap = ref<L.Map | null>(null);
const applicationMarker = ref<L.Marker | null>(null);

// Data
const sellers = computed(() => adminStore.sellers || []);
const applications = computed(() => adminStore.pendingApplications || []);
const historyApplications = computed(() => adminStore.applicationHistory || []);
const historyPagination = computed(() => adminStore.applicationHistoryPagination);
const pagination = computed(() => adminStore.sellersPagination);
const historyStatusFilter = ref('all');

// Filter options
const sellerStatusOptions = [
  { value: 'all', label: 'All Sellers' },
  { value: 'active', label: 'Active' },
  { value: 'restricted', label: 'Restricted' },
];

const applicationStatusOptions = [
  { value: 'all', label: 'All Applications' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const historyStatusOptions = [
  { value: 'all', label: 'All History' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatCompactPHP(value, decimals = 1) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "₱0";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  const trimZeros = (s) => s.replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
  const fmt = (num) => trimZeros(num.toFixed(decimals));

  const withPeso = (txt) => `${sign}₱${txt}`;

  if (abs < 1000) return withPeso(String(abs));

  if (abs < 1_000_000) {
    const v = abs / 1000;
    const rounded = Number(fmt(v));
    if (rounded >= 1000) return withPeso(fmt(abs / 1_000_000) + "M");
    return withPeso(fmt(v) + "K");
  }

  if (abs < 1_000_000_000) {
    const v = abs / 1_000_000;
    const rounded = Number(fmt(v));
    if (rounded >= 1000) return withPeso(fmt(abs / 1_000_000_000) + "B");
    return withPeso(fmt(v) + "M");
  }

  return withPeso(fmt(abs / 1_000_000_000) + "B");
}

// Fetch data
const fetchData = async () => {
  isLoading.value = true;
  try {
    if (activeTab.value === 'applications') {
      await adminStore.fetchPendingApplications();
    } else if (activeTab.value === 'history') {
      const filters: any = {
        page: historyPagination.value.page,
        limit: historyPagination.value.limit
      };
      if (searchQuery.value) filters.search = searchQuery.value;
      if (historyStatusFilter.value !== 'all') filters.status = historyStatusFilter.value;
      await adminStore.fetchApplicationHistory(filters);
    } else {
      const filters: any = {
        page: pagination.value.page,
        limit: pagination.value.limit
      };
      if (searchQuery.value) filters.search = searchQuery.value;
      if (selectedStatus.value !== 'all') {
        filters.status = selectedStatus.value;
      }
      await adminStore.fetchSellers(filters);
      // Enhanced debug: Log the first seller to see the complete data structure
      if (sellers.value.length > 0) {
        console.log('Sample seller data:', JSON.stringify(sellers.value[0], null, 2));
        console.log('Metrics specifically:', sellers.value[0].metrics);
        console.log('All seller objects:', sellers.value.map(s => ({ name: s.name, hasMetrics: !!s.metrics, metrics: s.metrics })));
      } else {
        console.log('No sellers found in response');
      }
    }
  } catch (error) {
    console.error('Failed to fetch data:', error);
  } finally {
    isLoading.value = false;
  }
};

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    adminStore.setSellersPagination(1, pagination.value.limit);
    fetchData();
  }, 500);
});

watch([selectedStatus, activeTab], () => {
  adminStore.setSellersPagination(1, pagination.value.limit);
  fetchData();
});

watch(historyStatusFilter, () => {
  fetchData();
});

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

// Format currency - Philippine Peso
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

// Document preview modal
const showDocumentPreview = ref(false);
const previewDocumentUrl = ref('');
const previewDocumentType = ref('');

/**
 * Check if a URL points to a PDF file
 */
const isPdfUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  // Check for .pdf extension or Cloudinary raw upload (used for PDFs)
  return lowerUrl.includes('.pdf') || (lowerUrl.includes('/raw/upload/') && !lowerUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i));
};

/**
 * Get the direct download URL for a document (for actual downloads only)
 */
const getDirectDocUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  let fixedUrl = url;
  // For PDFs, ensure raw delivery type
  if (fixedUrl.toLowerCase().includes('.pdf') && fixedUrl.includes('/image/upload/')) {
    fixedUrl = fixedUrl.replace('/image/upload/', '/raw/upload/');
  }
  // Remove fl_attachment if present
  fixedUrl = fixedUrl.replace('/fl_attachment/', '/');
  fixedUrl = fixedUrl.replace(/,?fl_attachment,?/g, '');
  return fixedUrl;
};

/**
 * Get the viewable URL for a document.
 * - Images: direct Cloudinary URL
 * - PDFs: Google Docs Viewer URL (renders inline without download)
 */
const getViewableUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  const directUrl = getDirectDocUrl(url);
  if (isPdfUrl(directUrl)) {
    // Use Google Docs Viewer to render PDFs inline — avoids Cloudinary
    // Content-Disposition: attachment header that forces downloads
    return `https://docs.google.com/gview?url=${encodeURIComponent(directUrl)}&embedded=true`;
  }
  return directUrl;
};

const openDocumentPreview = (url: string, type: string) => {
  previewDocumentUrl.value = url; // store the original URL
  previewDocumentType.value = type;
  showDocumentPreview.value = true;
};

const closeDocumentPreview = () => {
  showDocumentPreview.value = false;
  previewDocumentUrl.value = '';
  previewDocumentType.value = '';
};

// Download document properly (fetch + blob to bypass cross-origin restrictions)
const isDownloading = ref(false);
const downloadDocument = async (url: string | undefined | null, docName: string) => {
  if (!url) return;
  isDownloading.value = true;
  try {
    const directUrl = getDirectDocUrl(url);
    const response = await fetch(directUrl);
    const blob = await response.blob();
    
    // Determine file extension from URL or content type
    const contentType = response.headers.get('content-type') || '';
    let extension = '.pdf';
    if (contentType.includes('image/jpeg') || directUrl.match(/\.jpe?g$/i)) extension = '.jpg';
    else if (contentType.includes('image/png') || directUrl.match(/\.png$/i)) extension = '.png';
    else if (contentType.includes('image/webp') || directUrl.match(/\.webp$/i)) extension = '.webp';
    else if (contentType.includes('application/pdf') || directUrl.match(/\.pdf$/i)) extension = '.pdf';
    
    const fileName = `${docName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}${extension}`;
    
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback: open in new tab
    window.open(getDirectDocUrl(url), '_blank');
  } finally {
    isDownloading.value = false;
  }
};

// Get status badge
const getStatusBadge = (status: string) => {
  const badges: Record<string, { label: string; class: string }> = {
    pending: { label: 'Pending Review', class: 'warning' },
    approved: { label: 'Approved', class: 'success' },
    rejected: { label: 'Rejected', class: 'danger' },
    active: { label: 'Active', class: 'success' },
    restricted: { label: 'Restricted', class: 'danger' },
  };
  return badges[status] || { label: status, class: 'default' };
};

// Open detail modal
const openDetailModal = (item: any, type: 'seller' | 'application') => {
  if (type === 'seller') {
    selectedSeller.value = item;
    selectedApplication.value = null;
  } else {
    selectedApplication.value = item;
    selectedSeller.value = null;
  }
  showDetailModal.value = true;
};

// Open reject modal
const openRejectModal = (application: any) => {
  selectedApplication.value = application;
  rejectionReason.value = '';
  showRejectModal.value = true;
};

// Handle approve application
const handleApproveApplication = async (application: any) => {
  actionLoading.value = true;
  try {
    await adminStore.reviewSellerApplication(application._id, 'approved');
    await fetchData();
    showDetailModal.value = false;
  } catch (error) {
    console.error('Failed to approve application:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle reject application
const handleRejectApplication = async () => {
  if (!selectedApplication.value || !rejectionReason.value) return;
  
  actionLoading.value = true;
  try {
    await adminStore.reviewSellerApplication(selectedApplication.value._id, 'rejected', rejectionReason.value);
    showRejectModal.value = false;
    showDetailModal.value = false;
    await fetchData();
  } catch (error) {
    console.error('Failed to reject application:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle restrict/unrestrict seller
const handleToggleRestriction = async (seller: any) => {
  actionLoading.value = true;
  try {
    if (seller.isRestricted) {
      await adminStore.unrestrictUser(seller._id);
    } else {
      await adminStore.restrictUser(seller._id, 'Restricted by admin');
    }
    await fetchData();
  } catch (error) {
    console.error('Failed to update restriction:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Close modals
const closeModals = () => {
  showDetailModal.value = false;
  showRejectModal.value = false;
  selectedSeller.value = null;
  selectedApplication.value = null;
  destroyApplicationMap();
};

// Map functions for application review
const initApplicationMap = async (shopLocation: any) => {
  await nextTick();
  
  if (!applicationMapContainer.value || applicationMap.value) return;
  if (!shopLocation?.coordinates || shopLocation.coordinates.length !== 2) return;
  
  const [lng, lat] = shopLocation.coordinates;
  
  applicationMap.value = L.map(applicationMapContainer.value, {
    center: [lat, lng],
    zoom: 15,
    zoomControl: true
  });
  
  // Always use standard OpenStreetMap tiles
  const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  L.tileLayer(tileUrl, {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(applicationMap.value);
  
  // Add marker with shop name
  const shopName = selectedApplication.value?.sellerApplication?.shopName || 'Shop Location';
  const shopProfileUrl = selectedApplication.value?.sellerApplication?.shopProfileUrl;
  
  // Create custom icon
  const customIcon = L.divIcon({
    className: 'admin-map-marker',
    html: `
      <div class="marker-container">
        ${shopProfileUrl 
          ? `<img src="${shopProfileUrl}" alt="${shopName}" class="marker-image" />`
          : `<div class="marker-pin"></div>`
        }
        <span class="marker-label">${shopName}</span>
      </div>
    `,
    iconSize: [50, 60],
    iconAnchor: [25, 60]
  });
  
  applicationMarker.value = L.marker([lat, lng], { icon: customIcon }).addTo(applicationMap.value);
};

const destroyApplicationMap = () => {
  if (applicationMap.value) {
    applicationMap.value.remove();
    applicationMap.value = null;
    applicationMarker.value = null;
  }
};

// Watch for selected application changes to init map
watch(() => selectedApplication.value, async (app) => {
  if (app?.sellerApplication?.shopLocation?.coordinates) {
    await nextTick();
    setTimeout(() => initApplicationMap(app.sellerApplication.shopLocation), 100);
  }
}, { deep: true });

// Check if application has location
const hasShopLocation = computed(() => {
  const loc = selectedApplication.value?.sellerApplication?.shopLocation;
  return loc?.coordinates && loc.coordinates.length === 2;
});

// Create missing vendor profiles
const createMissingVendorProfiles = async () => {
  actionLoading.value = true;
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/seller/admin/create-missing-vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Vendor profiles created:', result);
      alert(`Success: ${result.message}`);
      await fetchData(); // Refresh the sellers list
    } else {
      console.error('Failed to create vendor profiles:', result.error);
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('Error creating vendor profiles:', error);
    alert('Error: Failed to create vendor profiles');
  } finally {
    actionLoading.value = false;
  }
};

// Pagination
const handlePageChange = (page: number) => {
  adminStore.setSellersPagination(page, pagination.value.limit);
  fetchData();
};

const handleHistoryPageChange = (page: number) => {
  adminStore.applicationHistoryPagination.page = page;
  fetchData();
};

const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit));
const historyTotalPages = computed(() => historyPagination.value.totalPages);

// Pending applications count
const pendingApplicationsCount = computed(() => {
  return applications.value.filter((app: any) => app.status === 'pending').length;
});

// Format date with time
const formatDateTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

onMounted(async () => {
  // Ensure auth is ready
  if (!authStore.authChecked) {
    await authStore.fetchSession();
  }
  if (!authStore.isAuthenticated || !authStore.token) return;
  
  fetchData();
  if (!props.showApplications) {
    adminStore.fetchPendingApplications(); // Also fetch applications for count
  }
});
</script>

<template>
  <div class="sellers-page">
    <!-- Page Header -->
    <div class="page-header">
      <button 
        class="tab-btn"
        :class="{ 'active': activeTab === 'sellers' }"
        @click="activeTab = 'sellers'"
      >
        <BuildingStorefrontIcon class="tab-icon" />
        Sellers
      </button>
      <button 
        class="tab-btn"
        :class="{ 'active': activeTab === 'applications' }"
        @click="activeTab = 'applications'"
      >
        <DocumentTextIcon class="tab-icon" />
        Applications
        <span v-if="pendingApplicationsCount > 0" class="tab-badge">
          {{ pendingApplicationsCount }}
        </span>
      </button>
      <button 
        class="tab-btn"
        :class="{ 'active': activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        <ClockIcon class="tab-icon" />
        History
      </button>
    </div>

    <!-- Filters Section -->
    <div class="filters-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          :placeholder="activeTab === 'sellers' ? 'Search sellers...' : activeTab === 'history' ? 'Search history...' : 'Search applications...'"
        />
      </div>
      
      <div class="filter-controls">
        <select 
          v-if="activeTab === 'sellers'"
          v-model="selectedStatus" 
          class="filter-select"
        >
          <option v-for="option in sellerStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <select 
          v-else-if="activeTab === 'history'"
          v-model="historyStatusFilter" 
          class="filter-select"
        >
          <option v-for="option in historyStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>

        <select 
          v-else
          v-model="selectedStatus" 
          class="filter-select"
        >
          <option v-for="option in applicationStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>

    <!-- Sellers Tab Content -->
    <template v-else-if="activeTab === 'sellers'">
      <div v-if="sellers.length > 0" class="data-grid">
        <div 
          v-for="seller in sellers" 
          :key="seller._id"
          class="seller-card"
        >
          <div class="seller-header">
            <div class="seller-avatar">
              {{ seller.sellerApplication?.shopName?.charAt(0) || seller.name?.charAt(0) || 'S' }}
            </div>
            <div class="seller-info">
              <h3 class="seller-name">{{ seller.sellerApplication?.shopName || seller.name || 'Unknown Seller' }}</h3>
              <span class="seller-email">{{ seller.email }}</span>
            </div>
            <span :class="`status-badge ${seller.isRestricted ? 'danger' : 'success'}`">
              {{ seller.isRestricted ? 'Restricted' : 'Active' }}
            </span>
          </div>
          
          <div class="seller-stats">
            <!-- Debug info - remove this after fixing -->
            <div v-if="false" style="background: #0000; z-index: 99999999999; padding: 10px; margin-bottom: 10px; font-size: 12px; border-radius: 4px;">
              <strong>Debug Info:</strong><br>
              Has metrics: {{ !!seller.metrics }}<br>
              Raw metrics: {{ JSON.stringify(seller.metrics) }}<br>
            
        
            </div>
            
            <div class="stat-item">
              <span class="stat-value">{{ seller.metrics?.totalProducts ?? 0 }}</span>
              <span class="stat-label">Products</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ seller.metrics?.totalOrders ?? 0 }}</span>
              <span class="stat-label">Orders</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ formatCompactPHP(((seller.metrics?.totalRevenue ?? 0) * 0.93)) }}</span>
              <span class="stat-label">Net Revenue</span>
            </div>
            <div class="stat-item">
              <div class="rating">
                <StarIcon class="star-icon" />
                <span>{{Number(seller.metrics.averageRating).toFixed(1) || 'N/A' }}</span>
              </div>
              <span class="stat-label">Rating</span>
            </div>
          </div>
          
          <div class="seller-footer">
            <span class="join-date">Joined {{ formatDate(seller.createdAt) }}</span>
            <div class="seller-actions">
              <button 
                class="action-btn preview"
                @click="openDetailModal(seller, 'seller')"
                title="View Details"
              >
                <EyeIcon class="btn-icon" />
                <span class="btn-text">View</span>
              </button>
              <button 
                class="action-btn"
                :class="seller.isRestricted ? 'unrestrict' : 'restrict'"
                @click="handleToggleRestriction(seller)"
                :disabled="actionLoading"
                :title="seller.isRestricted ? 'Unrestrict Seller' : 'Restrict Seller'"
              >
                <CheckCircleIcon v-if="seller.isRestricted" class="btn-icon" />
                <NoSymbolIcon v-else class="btn-icon" />
                <span class="btn-text">{{ seller.isRestricted ? 'Unrestrict' : 'Restrict' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <BuildingStorefrontIcon class="empty-icon" />
        <h3>No sellers found</h3>
        <p>Try adjusting your search or filters</p>
      </div>
    </template>

    <!-- Applications Tab Content -->
    <template v-else-if="activeTab === 'applications'">
      <div v-if="applications.length > 0" class="applications-list">
        <div 
          v-for="app in applications" 
          :key="app._id"
          class="application-card"
        >
          <div class="app-header">
            <div class="app-avatar">
              {{ app.sellerApplication?.shopName?.charAt(0) || app.name?.charAt(0) || 'A' }}
            </div>
            <div class="app-info">
              <h3 class="app-name">{{ app.sellerApplication?.shopName || 'Shop Name Not Set' }}</h3>
              <span class="app-user">{{ app.name || 'Unknown' }} • {{ app.email }}</span>
            </div>
            <span :class="`status-badge ${getStatusBadge(app.sellerApplication?.status || 'pending').class}`">
              {{ getStatusBadge(app.sellerApplication?.status || 'pending').label }}
            </span>
          </div>
          
          <div class="app-details">
            <div class="detail-item">
              <span class="detail-label">
                <BuildingStorefrontIcon class="detail-icon" />
                Shop Name
              </span>
              <span class="detail-value">{{ app.sellerApplication?.shopName || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <MapPinIcon class="detail-icon" />
                Shop Address
              </span>
              <span class="detail-value">{{ app.sellerApplication?.shopAddress || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Region</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.region || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Province</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.province || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Municipality/City</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.municipality || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Barangay</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.barangay || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Zip Code</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.zipCode || 'N/A' }}</span>
            </div>
            <div class="detail-item" v-if="app.sellerApplication?.address?.street">
              <span class="detail-label">Street</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.street }}</span>
            </div>
            <div class="detail-item" v-if="app.sellerApplication?.address?.additionalInfo">
              <span class="detail-label">Directions</span>
              <span class="detail-value">{{ app.sellerApplication?.address?.additionalInfo }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Applicant</span>
              <span class="detail-value">{{ app.name || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Submitted</span>
              <span class="detail-value">{{ formatDate(app.sellerApplication?.submittedAt || app.createdAt) }}</span>
            </div>
          </div>
          
          <!-- Documents Section -->
          <div class="documents-preview-section">
            <h4 class="documents-title">
              <DocumentCheckIcon class="section-title-icon" />
              Required Documents
            </h4>
            <div class="documents-grid">
              <!-- Government ID -->
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.governmentIdUrl }">
                <div class="document-icon-wrapper">
                  <IdentificationIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">Government ID</span>
                  <span class="document-desc">National ID, Driver's License, Passport, or UMID</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.governmentIdUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.governmentIdUrl, 'Government ID')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <!-- BIR/TIN -->
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.birTinUrl }">
                <div class="document-icon-wrapper bir">
                  <ShieldCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">BIR Registration (TIN)</span>
                  <span class="document-desc">Tax Identification Number Document</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.birTinUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.birTinUrl, 'BIR Registration (TIN)')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <!-- DTI/SEC -->
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.dtiOrSecUrl }">
                <div class="document-icon-wrapper dti">
                  <DocumentTextIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">DTI or SEC Registration</span>
                  <span class="document-desc">Business Registration Certificate</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.dtiOrSecUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.dtiOrSecUrl, 'DTI/SEC Registration')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <!-- Business Permit -->
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.businessPermitUrl }">
                <div class="document-icon-wrapper permit">
                  <DocumentCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">Business Permit</span>
                  <span class="document-desc">Municipal/City Business Permit</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.businessPermitUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.businessPermitUrl, 'Business Permit')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <!-- FDA Certificate (Optional) -->
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.fdaCertificateUrl }">
                <div class="document-icon-wrapper fda">
                  <ShieldCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">FDA Certificate</span>
                  <span class="document-desc">Optional for food/health products</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.fdaCertificateUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.fdaCertificateUrl, 'FDA Certificate')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Optional</span>
              </div>
            </div>
          </div>
          
          <div class="app-footer">
            <div class="app-documents-count">
              <DocumentTextIcon class="doc-icon" />
              <span>
                {{ 
                  [
                    app.sellerApplication?.governmentIdUrl, 
                    app.sellerApplication?.birTinUrl, 
                    app.sellerApplication?.dtiOrSecUrl,
                    app.sellerApplication?.businessPermitUrl,
                    app.sellerApplication?.fdaCertificateUrl
                  ].filter(Boolean).length 
                }} of 5 documents submitted
              </span>
            </div>

            <div class="app-actions">
              <button 
                class="action-btn preview"
                @click="openDetailModal(app, 'application')"
              >
                <EyeIcon class="btn-icon" />
                Review Details
              </button>
              <template v-if="app.sellerApplication?.status === 'pending'">
                <button 
                  class="action-btn approve"
                  @click="handleApproveApplication(app)"
                  :disabled="actionLoading"
                >
                  <CheckIcon class="btn-icon" />
                  Approve
                </button>
                <button 
                  class="action-btn decline"
                  @click="openRejectModal(app)"
                  :disabled="actionLoading"
                >
                  <XMarkIcon class="btn-icon" />
                  Reject
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <DocumentTextIcon class="empty-icon" />
        <h3>No applications found</h3>
        <p v-if="selectedStatus === 'pending'">All applications have been reviewed!</p>
        <p v-else>Try adjusting your search or filters</p>
      </div>
    </template>

    <!-- History Tab Content -->
    <template v-else-if="activeTab === 'history'">
      <div v-if="historyApplications.length > 0" class="applications-list">
        <div 
          v-for="app in historyApplications" 
          :key="app._id"
          class="application-card history-card"
          :class="{ 'approved-card': app.sellerApplication?.status === 'approved', 'rejected-card': app.sellerApplication?.status === 'rejected' }"
        >
          <div class="app-header">
            <div class="app-avatar" :class="{ 'approved-avatar': app.sellerApplication?.status === 'approved', 'rejected-avatar': app.sellerApplication?.status === 'rejected' }">
              {{ app.sellerApplication?.shopName?.charAt(0) || app.name?.charAt(0) || 'A' }}
            </div>
            <div class="app-info">
              <h3 class="app-name">{{ app.sellerApplication?.shopName || 'Shop Name Not Set' }}</h3>
              <span class="app-user">{{ app.name || 'Unknown' }} • {{ app.email }}</span>
            </div>
            <span :class="`status-badge ${getStatusBadge(app.sellerApplication?.status || 'pending').class}`">
              {{ getStatusBadge(app.sellerApplication?.status || 'pending').label }}
            </span>
          </div>
          
          <div class="app-details history-details">
            <div class="detail-item">
              <span class="detail-label">
                <BuildingStorefrontIcon class="detail-icon" />
                Shop Name
              </span>
              <span class="detail-value">{{ app.sellerApplication?.shopName || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <MapPinIcon class="detail-icon" />
                Shop Address
              </span>
              <span class="detail-value">{{ app.sellerApplication?.shopAddress || 'N/A' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <ClockIcon class="detail-icon" />
                Submitted
              </span>
              <span class="detail-value">{{ formatDateTime(app.sellerApplication?.submittedAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">
                <CheckCircleIcon class="detail-icon" v-if="app.sellerApplication?.status === 'approved'" />
                <XCircleIcon class="detail-icon" v-else />
                Reviewed
              </span>
              <span class="detail-value">{{ formatDateTime(app.sellerApplication?.reviewedAt) }}</span>
            </div>
            <div class="detail-item" v-if="app.sellerApplication?.reviewedBy">
              <span class="detail-label">Reviewed By</span>
              <span class="detail-value">{{ app.sellerApplication.reviewedBy.name || app.sellerApplication.reviewedBy.email || 'Admin' }}</span>
            </div>
            <div class="detail-item full-width" v-if="app.sellerApplication?.status === 'rejected' && app.sellerApplication?.rejectionReason">
              <span class="detail-label rejection-label">
                <XCircleIcon class="detail-icon" />
                Rejection Reason
              </span>
              <span class="detail-value rejection-reason">{{ app.sellerApplication.rejectionReason }}</span>
            </div>
          </div>
          
          <!-- Documents Section -->
          <div class="documents-preview-section">
            <h4 class="documents-title">
              <DocumentCheckIcon class="section-title-icon" />
              Submitted Documents
            </h4>
            <div class="documents-grid">
              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.governmentIdUrl }">
                <div class="document-icon-wrapper">
                  <IdentificationIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">Government ID</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.governmentIdUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.governmentIdUrl, 'Government ID')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.birTinUrl }">
                <div class="document-icon-wrapper bir">
                  <ShieldCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">BIR Registration</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.birTinUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.birTinUrl, 'BIR Registration')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <div class="document-card" :class="{ 'has-document': app.sellerApplication?.dtiOrSecUrl }">
                <div class="document-icon-wrapper dti">
                  <DocumentTextIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">DTI/SEC</span>
                </div>
                <button 
                  v-if="app.sellerApplication?.dtiOrSecUrl"
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.dtiOrSecUrl, 'DTI/SEC Registration')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
                <span v-else class="no-document">Not Submitted</span>
              </div>

              <div v-if="app.sellerApplication?.businessPermitUrl" class="document-card has-document">
                <div class="document-icon-wrapper permit">
                  <DocumentCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">Business Permit</span>
                </div>
                <button 
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.businessPermitUrl, 'Business Permit')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
              </div>

              <div v-if="app.sellerApplication?.fdaCertificateUrl" class="document-card has-document">
                <div class="document-icon-wrapper fda">
                  <ShieldCheckIcon class="document-type-icon" />
                </div>
                <div class="document-info">
                  <span class="document-label">FDA Certificate</span>
                </div>
                <button 
                  class="view-doc-btn"
                  @click="openDocumentPreview(app.sellerApplication.fdaCertificateUrl, 'FDA Certificate')"
                >
                  <EyeIcon class="btn-icon" />
                  View
                </button>
              </div>
            </div>
          </div>

          <div class="app-footer">
            <div class="app-actions">
              <button 
                class="action-btn preview"
                @click="openDetailModal(app, 'application')"
              >
                <EyeIcon class="btn-icon" />
                View Full Details
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <ClockIcon class="empty-icon" />
        <h3>No application history</h3>
        <p>Reviewed applications will appear here</p>
      </div>

      <!-- History Pagination -->
      <div v-if="historyTotalPages > 1" class="pagination">
        <button 
          class="page-btn"
          :disabled="historyPagination.page === 1"
          @click="handleHistoryPageChange(historyPagination.page - 1)"
        >
          Previous
        </button>
        <div class="page-info">
          Page {{ historyPagination.page }} of {{ historyTotalPages }}
        </div>
        <button 
          class="page-btn"
          :disabled="historyPagination.page === historyTotalPages"
          @click="handleHistoryPageChange(historyPagination.page + 1)"
        >
          Next
        </button>
      </div>
    </template>

    <!-- Pagination -->
    <div v-if="activeTab === 'sellers' && totalPages > 1" class="pagination">
      <button 
        class="page-btn"
        :disabled="pagination.page === 1"
        @click="handlePageChange(pagination.page - 1)"
      >
        Previous
      </button>
      <div class="page-info">
        Page {{ pagination.page }} of {{ totalPages }}
      </div>
      <button 
        class="page-btn"
        :disabled="pagination.page === totalPages"
        @click="handlePageChange(pagination.page + 1)"
      >
        Next
      </button>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal detail-modal">
        <div class="modal-header">
          <h3>{{ selectedSeller ? 'Seller Details' : 'Application Details' }}</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <!-- Seller Detail -->
          <template v-if="selectedSeller">
            <div class="profile-section">
              <div class="profile-avatar large brand-bg">
                {{ selectedSeller.sellerApplication?.shopName?.charAt(0) || selectedSeller.name?.charAt(0) || 'S' }}
              </div>
              <div class="profile-info">
                <h2>{{ selectedSeller.sellerApplication?.shopName || selectedSeller.name || 'Unknown Seller' }}</h2>
                <span class="profile-email">{{ selectedSeller.email }}</span>
                <span :class="`status-badge ${selectedSeller.isRestricted ? 'danger' : 'success'}`">
                  {{ selectedSeller.isRestricted ? 'Restricted' : 'Active' }}
                </span>
              </div>
            </div>
            
            <div class="stats-grid">
              <div class="stat-box">
                <span class="stat-value">{{ selectedSeller.metrics?.totalProducts ?? 0 }}</span>
                <span class="stat-label">Products</span>
              </div>
              <div class="stat-box">
                <span class="stat-value">{{ selectedSeller.metrics?.totalOrders ?? 0 }}</span>
                <span class="stat-label">Orders</span>
              </div>
              <div class="stat-box">
                <span class="stat-value">{{ formatCompactPHP(selectedSeller.metrics?.totalRevenue ?? 0) }}</span>
                <span class="stat-label">Revenue</span>
              </div>
              <div class="stat-box">
                <span class="stat-value">{{ selectedSeller.metrics?.averageRating ? Number(selectedSeller.metrics.averageRating).toFixed(1) : 'N/A' }}</span>
                <span class="stat-label">Rating</span>
              </div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Seller Name</span>
                <span class="info-value">{{ selectedSeller.name || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone</span>
                <span class="info-value">{{ selectedSeller.phone || 'N/A' }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">Shop Address</span>
                <span class="info-value">{{ selectedSeller.sellerApplication?.shopAddress || selectedSeller.address?.street || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Joined</span>
                <span class="info-value">{{ formatDate(selectedSeller.createdAt) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Completed Orders</span>
                <span class="info-value">{{ selectedSeller.metrics?.completedOrders ?? 0 }}</span>
              </div>
            </div>
          </template>
          
          <!-- Application Detail -->
          <template v-else-if="selectedApplication">
            <div class="profile-section">
              <div v-if="selectedApplication.sellerApplication?.shopProfileUrl" class="profile-avatar-img large">
                <img :src="selectedApplication.sellerApplication.shopProfileUrl" :alt="selectedApplication.sellerApplication?.shopName" />
              </div>
              <div v-else class="profile-avatar large brand-bg">
                {{ selectedApplication.sellerApplication?.shopName?.charAt(0) || 'A' }}
              </div>
              <div class="profile-info">
                <h2>{{ selectedApplication.sellerApplication?.shopName || 'Shop Name Not Set' }}</h2>
                <span class="profile-email">{{ selectedApplication.email }}</span>
                <span :class="`status-badge ${getStatusBadge(selectedApplication.sellerApplication?.status || 'pending').class}`">
                  {{ getStatusBadge(selectedApplication.sellerApplication?.status || 'pending').label }}
                </span>
              </div>
            </div>
            
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Applicant Name</span>
                <span class="info-value">{{ selectedApplication.name || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">{{ selectedApplication.email || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone</span>
                <span class="info-value">{{ selectedApplication.phone || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Submitted Date</span>
                <span class="info-value">{{ formatDate(selectedApplication.sellerApplication?.submittedAt || selectedApplication.createdAt) }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">Shop Address</span>
                <span class="info-value">{{ selectedApplication.sellerApplication?.shopAddress || 'N/A' }}</span>
              </div>
            </div>
            
            <!-- Shop Location Map Section -->
            <div v-if="hasShopLocation" class="location-map-section">
              <h4 class="section-header">
                <MapPinIcon class="section-header-icon" />
                Shop Location
              </h4>
              <div class="map-preview-container">
                <div ref="applicationMapContainer" class="application-map"></div>
                <div class="location-coords-info">
                  <span class="coords-label">Coordinates:</span>
                  <span class="coords-value">
                    {{ selectedApplication.sellerApplication?.shopLocation?.coordinates?.[1]?.toFixed(6) }}, 
                    {{ selectedApplication.sellerApplication?.shopLocation?.coordinates?.[0]?.toFixed(6) }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Documents Section in Modal -->
            <div class="documents-section">
              <h4 class="section-header">
                <DocumentCheckIcon class="section-header-icon" />
                Required Documents
              </h4>
              <div class="modal-documents-grid">
                <!-- Government ID -->
                <div class="modal-document-card" :class="{ 'submitted': selectedApplication.sellerApplication?.governmentIdUrl }">
                  <div class="modal-doc-header">
                    <div class="modal-doc-icon-wrap id-doc">
                      <IdentificationIcon class="modal-doc-icon" />
                    </div>
                    <div class="modal-doc-title">
                      <span class="modal-doc-name">Government-Issued ID</span>
                      <span class="modal-doc-desc">National ID, Driver's License, Passport, or UMID</span>
                    </div>
                  </div>
                  <div class="modal-doc-content">
                    <template v-if="selectedApplication.sellerApplication?.governmentIdUrl">
                      <template v-if="isPdfUrl(selectedApplication.sellerApplication.governmentIdUrl)">
                        <div class="pdf-preview-placeholder" @click="openDocumentPreview(selectedApplication.sellerApplication.governmentIdUrl, 'Government ID')">
                          <DocumentTextIcon class="pdf-placeholder-icon" />
                          <span class="pdf-label">PDF Document</span>
                          <span class="pdf-click-hint">Click to view inline</span>
                        </div>
                      </template>
                      <template v-else>
                        <img 
                          :src="selectedApplication.sellerApplication.governmentIdUrl" 
                          alt="Government ID"
                          class="doc-preview-img"
                          @click="openDocumentPreview(selectedApplication.sellerApplication.governmentIdUrl, 'Government ID')"
                        />
                      </template>
                      <div class="doc-actions">
                        <button class="doc-action-btn view" @click="openDocumentPreview(selectedApplication.sellerApplication.governmentIdUrl, 'Government ID')">
                          <EyeIcon class="action-icon" />
                          View
                        </button>
                      </div>
                    </template>
                    <div v-else class="no-doc-placeholder">
                      <PhotoIcon class="placeholder-icon" />
                      <span>Not Submitted</span>
                    </div>
                  </div>
                </div>

                <!-- BIR/TIN -->
                <div class="modal-document-card" :class="{ 'submitted': selectedApplication.sellerApplication?.birTinUrl }">
                  <div class="modal-doc-header">
                    <div class="modal-doc-icon-wrap bir-doc">
                      <ShieldCheckIcon class="modal-doc-icon" />
                    </div>
                    <div class="modal-doc-title">
                      <span class="modal-doc-name">BIR Registration (TIN)</span>
                      <span class="modal-doc-desc">Tax Identification Number Document</span>
                    </div>
                  </div>
                  <div class="modal-doc-content">
                    <template v-if="selectedApplication.sellerApplication?.birTinUrl">
                      <template v-if="isPdfUrl(selectedApplication.sellerApplication.birTinUrl)">
                        <div class="pdf-preview-placeholder" @click="openDocumentPreview(selectedApplication.sellerApplication.birTinUrl, 'BIR Registration (TIN)')">
                          <DocumentTextIcon class="pdf-placeholder-icon" />
                          <span class="pdf-label">PDF Document</span>
                          <span class="pdf-click-hint">Click to view inline</span>
                        </div>
                      </template>
                      <template v-else>
                        <img 
                          :src="selectedApplication.sellerApplication.birTinUrl" 
                          alt="BIR TIN"
                          class="doc-preview-img"
                          @click="openDocumentPreview(selectedApplication.sellerApplication.birTinUrl, 'BIR Registration (TIN)')"
                        />
                      </template>
                      <div class="doc-actions">
                        <button class="doc-action-btn view" @click="openDocumentPreview(selectedApplication.sellerApplication.birTinUrl, 'BIR Registration (TIN)')">
                          <EyeIcon class="action-icon" />
                          View
                        </button>
                      </div>
                    </template>
                    <div v-else class="no-doc-placeholder">
                      <PhotoIcon class="placeholder-icon" />
                      <span>Not Submitted</span>
                    </div>
                  </div>
                </div>

                <!-- DTI/SEC -->
                <div class="modal-document-card" :class="{ 'submitted': selectedApplication.sellerApplication?.dtiOrSecUrl }">
                  <div class="modal-doc-header">
                    <div class="modal-doc-icon-wrap dti-doc">
                      <DocumentTextIcon class="modal-doc-icon" />
                    </div>
                    <div class="modal-doc-title">
                      <span class="modal-doc-name">DTI or SEC Registration</span>
                      <span class="modal-doc-desc">Business Registration Certificate</span>
                    </div>
                  </div>
                  <div class="modal-doc-content">
                    <template v-if="selectedApplication.sellerApplication?.dtiOrSecUrl">
                      <template v-if="isPdfUrl(selectedApplication.sellerApplication.dtiOrSecUrl)">
                        <div class="pdf-preview-placeholder" @click="openDocumentPreview(selectedApplication.sellerApplication.dtiOrSecUrl, 'DTI/SEC Registration')">
                          <DocumentTextIcon class="pdf-placeholder-icon" />
                          <span class="pdf-label">PDF Document</span>
                          <span class="pdf-click-hint">Click to view inline</span>
                        </div>
                      </template>
                      <template v-else>
                        <img 
                          :src="selectedApplication.sellerApplication.dtiOrSecUrl" 
                          alt="DTI/SEC"
                          class="doc-preview-img"
                          @click="openDocumentPreview(selectedApplication.sellerApplication.dtiOrSecUrl, 'DTI/SEC Registration')"
                        />
                      </template>
                      <div class="doc-actions">
                        <button class="doc-action-btn view" @click="openDocumentPreview(selectedApplication.sellerApplication.dtiOrSecUrl, 'DTI/SEC Registration')">
                          <EyeIcon class="action-icon" />
                          View
                        </button>
                      </div>
                    </template>
                    <div v-else class="no-doc-placeholder">
                      <PhotoIcon class="placeholder-icon" />
                      <span>Not Submitted</span>
                    </div>
                  </div>
                </div>

                <!-- Business Permit -->
                <div class="modal-document-card" :class="{ 'submitted': selectedApplication.sellerApplication?.businessPermitUrl }">
                  <div class="modal-doc-header">
                    <div class="modal-doc-icon-wrap permit-doc">
                      <DocumentCheckIcon class="modal-doc-icon" />
                    </div>
                    <div class="modal-doc-title">
                      <span class="modal-doc-name">Business Permit</span>
                      <span class="modal-doc-desc">Local Government Business Permit</span>
                    </div>
                  </div>
                  <div class="modal-doc-content">
                    <template v-if="selectedApplication.sellerApplication?.businessPermitUrl">
                      <template v-if="isPdfUrl(selectedApplication.sellerApplication.businessPermitUrl)">
                        <div class="pdf-preview-placeholder" @click="openDocumentPreview(selectedApplication.sellerApplication.businessPermitUrl, 'Business Permit')">
                          <DocumentTextIcon class="pdf-placeholder-icon" />
                          <span class="pdf-label">PDF Document</span>
                          <span class="pdf-click-hint">Click to view inline</span>
                        </div>
                      </template>
                      <template v-else>
                        <img 
                          :src="selectedApplication.sellerApplication.businessPermitUrl" 
                          alt="Business Permit"
                          class="doc-preview-img"
                          @click="openDocumentPreview(selectedApplication.sellerApplication.businessPermitUrl, 'Business Permit')"
                        />
                      </template>
                      <div class="doc-actions">
                        <button class="doc-action-btn view" @click="openDocumentPreview(selectedApplication.sellerApplication.businessPermitUrl, 'Business Permit')">
                          <EyeIcon class="action-icon" />
                          View
                        </button>
                      </div>
                    </template>
                    <div v-else class="no-doc-placeholder">
                      <PhotoIcon class="placeholder-icon" />
                      <span>Not Submitted</span>
                    </div>
                  </div>
                </div>

                <!-- FDA Certificate (Optional) -->
                <div class="modal-document-card" :class="{ 'submitted': selectedApplication.sellerApplication?.fdaCertificateUrl, 'optional': !selectedApplication.sellerApplication?.fdaCertificateUrl }">
                  <div class="modal-doc-header">
                    <div class="modal-doc-icon-wrap fda-doc">
                      <ShieldCheckIcon class="modal-doc-icon" />
                    </div>
                    <div class="modal-doc-title">
                      <span class="modal-doc-name">FDA Certificate <span class="optional-tag">(Optional)</span></span>
                      <span class="modal-doc-desc">Required for food/health products</span>
                    </div>
                  </div>
                  <div class="modal-doc-content">
                    <template v-if="selectedApplication.sellerApplication?.fdaCertificateUrl">
                      <template v-if="isPdfUrl(selectedApplication.sellerApplication.fdaCertificateUrl)">
                        <div class="pdf-preview-placeholder" @click="openDocumentPreview(selectedApplication.sellerApplication.fdaCertificateUrl, 'FDA Certificate')">
                          <DocumentTextIcon class="pdf-placeholder-icon" />
                          <span class="pdf-label">PDF Document</span>
                          <span class="pdf-click-hint">Click to view inline</span>
                        </div>
                      </template>
                      <template v-else>
                        <img 
                          :src="selectedApplication.sellerApplication.fdaCertificateUrl" 
                          alt="FDA Certificate"
                          class="doc-preview-img"
                          @click="openDocumentPreview(selectedApplication.sellerApplication.fdaCertificateUrl, 'FDA Certificate')"
                        />
                      </template>
                      <div class="doc-actions">
                        <button class="doc-action-btn view" @click="openDocumentPreview(selectedApplication.sellerApplication.fdaCertificateUrl, 'FDA Certificate')">
                          <EyeIcon class="action-icon" />
                          View
                        </button>
                      </div>
                    </template>
                    <div v-else class="no-doc-placeholder">
                      <PhotoIcon class="placeholder-icon" />
                      <span>Not Submitted (Optional)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="selectedApplication.sellerApplication?.rejectionReason" class="rejection-section">
              <h4>Rejection Reason</h4>
              <p>{{ selectedApplication.sellerApplication.rejectionReason }}</p>
            </div>
          </template>
        </div>
        
        <div v-if="selectedApplication?.sellerApplication?.status === 'pending'" class="modal-footer">
          <button 
            class="btn btn-danger"
            @click="showRejectModal = true; showDetailModal = false"
            :disabled="actionLoading"
          >
            <XMarkIcon class="btn-icon" />
            Reject
          </button>
          <button 
            class="btn btn-success"
            @click="handleApproveApplication(selectedApplication)"
            :disabled="actionLoading"
          >
            <CheckIcon class="btn-icon" />
            {{ actionLoading ? 'Approving...' : 'Approve Application' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Document Preview Modal -->
    <div v-if="showDocumentPreview" class="modal-overlay document-preview-overlay" @click.self="closeDocumentPreview">
      <div class="document-preview-modal" :class="{ 'pdf-mode': isPdfUrl(previewDocumentUrl) }">
        <div class="preview-modal-header">
          <h3>{{ previewDocumentType }}</h3>
          <div class="preview-header-actions">
            <span v-if="isPdfUrl(previewDocumentUrl)" class="preview-badge pdf-badge">PDF</span>
            <span v-else class="preview-badge img-badge">IMAGE</span>
            <button class="close-btn" @click="closeDocumentPreview">
              <XMarkIcon class="close-icon" />
            </button>
          </div>
        </div>
        <div class="preview-modal-body">
          <!-- PDF Preview via Google Docs Viewer -->
          <template v-if="isPdfUrl(previewDocumentUrl)">
            <div class="pdf-viewer-container">
              <iframe 
                :src="getViewableUrl(previewDocumentUrl)" 
                class="pdf-iframe"
                frameborder="0"
                allowfullscreen
                title="PDF Document Preview"
              ></iframe>
            </div>
          </template>
          <!-- Image Preview -->
          <template v-else>
            <img 
              :src="getViewableUrl(previewDocumentUrl)" 
              :alt="previewDocumentType" 
              class="full-preview-img"
              loading="lazy"
            />
          </template>
        </div>
        <div class="preview-modal-footer">
          <button class="btn btn-secondary" @click="closeDocumentPreview">
            Close
          </button>
          <button 
            class="btn btn-outline" 
            @click="downloadDocument(previewDocumentUrl, previewDocumentType)"
            :disabled="isDownloading"
          >
            <ArrowTopRightOnSquareIcon class="btn-icon" />
            {{ isDownloading ? 'Downloading...' : 'Download' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal && selectedApplication" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>Reject Application</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="app-preview">
            <div class="preview-avatar">
              {{ selectedApplication.sellerApplication?.shopName?.charAt(0) || 'A' }}
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ selectedApplication.sellerApplication?.shopName || 'Shop Name' }}</span>
              <span class="preview-user">{{ selectedApplication.name || 'Applicant' }}</span>
            </div>
          </div>
          
          <p class="modal-text">
            Please provide a reason for rejecting this application. This will be communicated to the applicant.
          </p>
          
          <div class="form-group">
            <label>Rejection Reason <span class="required">*</span></label>
            <textarea 
              v-model="rejectionReason"
              placeholder="Enter the reason for rejecting this application..."
              rows="4"
            ></textarea>
          </div>
          
          <div class="common-reasons">
            <span class="reasons-label">Common reasons:</span>
            <div class="reason-chips">
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Incomplete or missing business documentation.'"
              >
                Incomplete documents
              </button>
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Business information could not be verified.'"
              >
                Unable to verify
              </button>
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Business category not supported on our platform.'"
              >
                Unsupported category
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModals">Cancel</button>
          <button 
            class="btn btn-danger"
            :disabled="actionLoading || !rejectionReason"
            @click="handleRejectApplication"
          >
            {{ actionLoading ? 'Processing...' : 'Reject Application' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sellers-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.page-subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.stat-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

.stat-icon {
  width: 1.125rem;
  height: 1.125rem;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  padding-bottom: 0;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-icon {
  width: 1.125rem;
  height: 1.125rem;
}

.tab-badge {
  background: var(--color-danger);
  color: white;
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
}

/* Filters Section */
.filters-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1rem;
  height: 1rem;
  color: var(--text-tertiary);
}

.filter-controls {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Data Grid (Sellers) */
.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.seller-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.25rem;
  transition: all 0.2s ease;
}

.seller-card:hover {
  box-shadow: var(--shadow-md);
}

.seller-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.seller-avatar {
  width: 3rem;
  height: 3rem;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.seller-info {
  flex: 1;
  min-width: 0;
}

.seller-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-email {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.seller-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.rating {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.star-icon {
  width: 1rem;
  height: 1rem;
  color: #f59e0b;
  fill: #f59e0b;
}

.seller-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.join-date {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.seller-actions {
  display: flex;
  gap: 0.5rem;
}

/* Applications List */
.applications-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.application-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.25rem;
}

/* History Card Styles */
.history-card.approved-card {
  border-left: 4px solid #16a34a;
}

.history-card.rejected-card {
  border-left: 4px solid #dc2626;
}

.approved-avatar {
  background: #dcfce7 !important;
  color: #16a34a !important;
}

.rejected-avatar {
  background: #fee2e2 !important;
  color: #dc2626 !important;
}

.history-details .full-width {
  grid-column: 1 / -1;
}

.rejection-label {
  color: #dc2626;
}

.rejection-reason {
  color: #991b1b;
  background: #fef2f2;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid #fecaca;
  font-size: 0.85rem;
  line-height: 1.5;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.app-avatar {
  width: 3rem;
  height: 3rem;
  background: #e0f2fe;
  color: #0284c7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.app-info {
  flex: 1;
  min-width: 0;
}

.app-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.app-user {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.app-details {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1rem 0;
  border-top: 1px solid var(--border-primary);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.app-description {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.app-description p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.app-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.app-documents {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.doc-icon {
  width: 1rem;
  height: 1rem;
}

.app-actions {
  display: flex;
  gap: 0.5rem;
}

/* Action Buttons */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.action-btn.approve {
  background: #dcfce7;
  border-color: #16a34a;
  color: #16a34a;
}

.action-btn.approve:hover:not(:disabled) {
  background: #16a34a;
  color: white;
}

.action-btn.decline {
  background: #fee2e2;
  border-color: #dc2626;
  color: #dc2626;
}

.action-btn.decline:hover:not(:disabled) {
  background: #dc2626;
  color: white;
}

/* Restrict Button (Orange) */
.action-btn.restrict {
  background: rgba(249, 115, 22, 0.1);
  border-color: #f97316;
  color: #f97316;
}

.action-btn.restrict:hover:not(:disabled) {
  background: #f97316;
  color: white;
}

/* Unrestrict Button (Blue) */
.action-btn.unrestrict {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
}

.action-btn.unrestrict:hover:not(:disabled) {
  background: #3b82f6;
  color: white;
}

/* Preview Button */
.action-btn.preview {
  background: rgba(99, 102, 241, 0.1);
  border-color: #6366f1;
  color: #6366f1;
}

.action-btn.preview:hover:not(:disabled) {
  background: #6366f1;
  color: white;
}

/* Button text */
.btn-text {
  display: none;
}

@media (min-width: 768px) {
  .btn-text {
    display: inline;
    margin-left: 0.25rem;
  }
}

.action-btn.danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #dc2626;
  color: #dc2626;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Status Badge */
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }
.status-badge.warning { background: #fef3c7; color: #d97706; }

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  color: var(--text-tertiary);
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.empty-state p {
  margin: 0;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.page-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 500px;
  box-shadow: var(--shadow-xl);
  max-height: 90vh;
  overflow-y: auto;
}

.detail-modal {
  max-width: 600px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 10;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-tertiary);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  padding: 1.5rem;
}

.profile-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.profile-avatar.large {
  width: 4rem;
  height: 4rem;
  font-size: 1.5rem;
}

.profile-info h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.profile-email {
  display: block;
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-box {
  text-align: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat-box .stat-value {
  font-size: 1.25rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-item.full {
  grid-column: span 2;
}

.info-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.info-value {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.description-section,
.documents-section {
  margin-bottom: 1.5rem;
}

.description-section h4,
.documents-section h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.description-section p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.document-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: background 0.2s ease;
}

.document-link:hover {
  background: var(--border-primary);
}

.doc-icon,
.external-icon {
  width: 1rem;
  height: 1rem;
}

.external-icon {
  margin-left: auto;
  color: var(--text-tertiary);
}

.rejection-section {
  background: #fee2e2;
  padding: 1rem;
  border-radius: var(--radius-md);
}

.rejection-section h4 {
  color: #dc2626;
  font-size: 0.9rem;
  margin: 0 0 0.5rem;
}

.rejection-section p {
  margin: 0;
  color: #991b1b;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
  position: sticky;
  bottom: 0;
  background: var(--surface);
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary { background: var(--bg-secondary); color: var(--text-primary); }
.btn-success { background: #16a34a; color: white; }
.btn-danger { background: #dc2626; color: white; }

/* Reject Modal */
.app-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.preview-avatar {
  width: 3rem;
  height: 3rem;
  background: #e0f2fe;
  color: #0284c7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
}

.preview-info {
  display: flex;
  flex-direction: column;
}

.preview-name {
  font-weight: 600;
  color: var(--text-primary);
}

.preview-user {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.modal-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 1rem;
  line-height: 1.5;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.required {
  color: #dc2626;
}

.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
}

.common-reasons {
  margin-top: 1rem;
}

.reasons-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 0.5rem;
}

.reason-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.reason-chip {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reason-chip:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Enhanced Branding - Primary Green */
.brand-bg {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%) !important;
}

.seller-avatar {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
}

.app-avatar {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  color: #1f8b4e;
}

/* Documents Preview Section */
.documents-preview-section {
  margin: 1rem 0;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.03) 0%, rgba(31, 139, 78, 0.08) 100%);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(31, 139, 78, 0.15);
}

.documents-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #1f8b4e;
  margin: 0 0 1rem;
}

.section-title-icon {
  width: 1.125rem;
  height: 1.125rem;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.document-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  transition: all 0.2s ease;
}

.document-card.has-document {
  border-color: rgba(31, 139, 78, 0.3);
  background: rgba(31, 139, 78, 0.05);
}

.document-card.has-document:hover {
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.15);
  border-color: #1f8b4e;
}

.document-icon-wrapper {
  width: 2.5rem;
  height: 2.5rem;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.document-icon-wrapper.bir {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
}

.document-icon-wrapper.dti {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
}

.document-icon-wrapper.permit {
  background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
}

.document-icon-wrapper.fda {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
}

.document-type-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #1f8b4e;
}

.document-icon-wrapper.bir .document-type-icon {
  color: #1976d2;
}

.document-icon-wrapper.dti .document-type-icon {
  color: #f57c00;
}

.document-icon-wrapper.permit .document-type-icon {
  color: #8e24aa;
}

.document-icon-wrapper.fda .document-type-icon {
  color: #c62828;
}

.document-info {
  flex: 1;
  min-width: 0;
}

.document-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-desc {
  display: block;
  font-size: 0.65rem;
  color: var(--text-tertiary);
  margin-top: 0.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.view-doc-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: #1f8b4e;
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.view-doc-btn:hover {
  background: #166c3b;
  transform: translateY(-1px);
}

.no-document {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  font-style: italic;
  padding: 0.375rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
}

.app-documents-count {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Modal Document Styles */
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1f8b4e;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(31, 139, 78, 0.2);
}

.section-header-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-documents-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-document-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
  transition: all 0.2s ease;
}

.modal-document-card.submitted {
  border-color: rgba(31, 139, 78, 0.3);
}

.modal-doc-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
}

.modal-doc-icon-wrap {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-doc-icon-wrap.id-doc {
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
}

.modal-doc-icon-wrap.id-doc .modal-doc-icon {
  color: #1f8b4e;
}

.modal-doc-icon-wrap.bir-doc {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
}

.modal-doc-icon-wrap.bir-doc .modal-doc-icon {
  color: #1976d2;
}

.modal-doc-icon-wrap.dti-doc {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
}

.modal-doc-icon-wrap.dti-doc .modal-doc-icon {
  color: #f57c00;
}

.modal-doc-icon-wrap.permit-doc {
  background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
}

.modal-doc-icon-wrap.permit-doc .modal-doc-icon {
  color: #8e24aa;
}

.modal-doc-icon-wrap.fda-doc {
  background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
}

.modal-doc-icon-wrap.fda-doc .modal-doc-icon {
  color: #c62828;
}

.optional-tag {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--text-tertiary);
  font-style: italic;
}

.modal-doc-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-doc-title {
  flex: 1;
}

.modal-doc-name {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.modal-doc-desc {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.125rem;
}

.modal-doc-content {
  padding: 1rem;
}

.doc-preview-img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  transition: transform 0.2s ease;
  border: 1px solid var(--border-primary);
}

.doc-preview-img:hover {
  transform: scale(1.02);
}

.doc-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.doc-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: #1f8b4e;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
}

.doc-action-btn:hover {
  background: #166c3b;
}

.doc-action-btn.view {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
}

.doc-action-btn.view:hover {
  background: linear-gradient(135deg, #166c3b 0%, #138b3c 100%);
}

.doc-action-btn.external {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.doc-action-btn.external:hover {
  background: var(--bg-secondary);
  border-color: #1f8b4e;
  color: #1f8b4e;
}

.action-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.no-doc-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-tertiary);
  text-align: center;
}

.placeholder-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

/* Document Preview Modal */
.document-preview-overlay {
  background: rgba(0, 0, 0, 0.85);
}

.document-preview-modal {
  background: var(--surface);
  border-radius: var(--radius-lg);
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.preview-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.preview-modal-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.preview-modal-header .close-btn {
  color: white;
}

.preview-header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pdf-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.img-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.preview-modal-body {
  flex: 1;
  overflow: auto;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.full-preview-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.preview-modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-primary {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  text-decoration: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #166c3b 0%, #138b3c 100%);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  text-decoration: none;
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  text-decoration: none;
}

.btn-outline:hover {
  background: var(--color-primary);
  color: white;
}

/* PDF Preview Styles */
.document-preview-modal.pdf-modal {
  width: 90vw;
  height: 90vh;
  max-width: 1200px;
}

.pdf-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.pdf-iframe {
  width: 100%;
  height: 60vh;
  min-height: 400px;
  border: none;
  border-radius: var(--radius-md);
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.pdf-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.pdf-fallback {
  display: block;
  text-align: center;
  padding: 1rem;
  background: rgba(31, 139, 78, 0.05);
  border-radius: var(--radius-md);
  border: 1px solid rgba(31, 139, 78, 0.2);
  max-width: 400px;
}

.pdf-fallback-icon {
  width: 2rem;
  height: 2rem;
  color: var(--color-primary);
  margin: 0 auto 0.5rem;
  display: block;
}

.pdf-fallback p {
  margin: 0 0 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.pdf-fallback small {
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

/* PDF Preview Placeholder in Document Cards */
.pdf-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #fee2e2 0%, #fef3c7 100%);
  border: 2px dashed #d97706;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.pdf-preview-placeholder:hover {
  background: linear-gradient(135deg, #fecaca 0%, #fde68a 100%);
  border-color: #b45309;
  transform: translateY(-2px);
}

.pdf-placeholder-icon {
  width: 3rem;
  height: 3rem;
  color: #d97706;
  margin-bottom: 0.5rem;
}

.pdf-label {
  font-weight: 600;
  color: #92400e;
  margin-bottom: 0.25rem;
}

.pdf-click-hint {
  font-size: 0.75rem;
  color: #b45309;
}

/* Detail Label with Icons */
.detail-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.detail-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--text-tertiary);
}

/* Enhanced Action Buttons */
.action-btn.preview {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  border-color: transparent;
}

.action-btn.preview:hover:not(:disabled) {
  background: linear-gradient(135deg, #166c3b 0%, #138b3c 100%);
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    max-width: none;
  }
  
  .data-grid {
    grid-template-columns: 1fr;
  }
  
  .seller-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .app-details {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .documents-grid {
    grid-template-columns: 1fr;
  }
  
  .document-card {
    flex-wrap: wrap;
  }
  
  .document-info {
    flex-basis: calc(100% - 3.5rem);
  }
  
  .view-doc-btn,
  .no-document {
    flex-basis: 100%;
    justify-content: center;
    margin-top: 0.5rem;
  }
}

/* Shop Profile Image Avatar */
.profile-avatar-img {
  border-radius: 0.75rem;
  overflow: hidden;
  background: var(--surface);
  border: 2px solid var(--border-color);
}

.profile-avatar-img.large {
  width: 80px;
  height: 80px;
}

.profile-avatar-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Shop Location Map Section */
.location-map-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.map-preview-container {
  margin-top: 0.75rem;
}

.application-map {
  width: 100%;
  height: 250px;
  border-radius: 0.5rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
  z-index: 0;
}

.location-coords-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border-radius: 0.375rem;
  font-size: 0.8125rem;
}

.coords-label {
  color: var(--text-secondary);
}

.coords-value {
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 500;
}

/* Admin Map Marker Styles */
:deep(.admin-map-marker) {
  background: transparent;
  border: none;
}

:deep(.admin-map-marker .marker-container) {
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateY(-100%);
}

:deep(.admin-map-marker .marker-image) {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid var(--primary-color, #3b82f6);
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

:deep(.admin-map-marker .marker-pin) {
  width: 24px;
  height: 24px;
  background: var(--primary-color, #3b82f6);
  border: 3px solid white;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

:deep(.admin-map-marker .marker-label) {
  margin-top: 4px;
  padding: 2px 8px;
  background: white;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
