<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  CubeIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline';

// Product Status Constants
const PRODUCT_STATUS = {
  ALL: 'all',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const searchQuery = ref('');
const selectedStatus = ref(PRODUCT_STATUS.PENDING_REVIEW);
const selectedCategory = ref('all');

// Modal states
const showPreviewModal = ref(false);
const showRejectModal = ref(false);
const selectedProduct = ref<any>(null);
const rejectionReason = ref('');
const actionLoading = ref(false);
const previewImageIndex = ref(0);

// Products data
const products = computed(() => adminStore.products || []);
const pagination = computed(() => adminStore.productsPagination);

// Filter options
const statusOptions = [
  { value: PRODUCT_STATUS.ALL, label: 'All Products' },
  { value: PRODUCT_STATUS.PENDING_REVIEW, label: 'Pending Review' },
  { value: PRODUCT_STATUS.APPROVED, label: 'Approved' },
  { value: PRODUCT_STATUS.REJECTED, label: 'Rejected' },
];

// Categories loaded from API
const categoryOptions = ref<Array<{value: string; label: string}>>([
  { value: 'all', label: 'All Categories' },
]);

// Fetch products
const fetchProducts = async () => {
  isLoading.value = true;
  try {
    const filters: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    };
    if (searchQuery.value) filters.search = searchQuery.value;
    if (selectedStatus.value !== PRODUCT_STATUS.ALL) filters.status = selectedStatus.value;
    if (selectedCategory.value !== 'all') filters.category = selectedCategory.value;
    
    await adminStore.fetchProducts(filters);
  } catch (error) {
    console.error('Failed to fetch products:', error);
  } finally {
    isLoading.value = false;
  }
};



// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    adminStore.setProductsPagination(1, pagination.value.limit);
    fetchProducts();
  }, 500);
});

watch([selectedStatus, selectedCategory], () => {
  adminStore.setProductsPagination(1, pagination.value.limit);
  fetchProducts();
});

// Pagination
const handlePageChange = (page: number) => {
  adminStore.setProductsPagination(page, pagination.value.limit);
  fetchProducts();
};

// Format currency - Philippine Peso
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Get status badge
const getStatusBadge = (status: string) => {
  const badges: Record<string, { label: string; class: string }> = {
    pending_review: { label: 'Pending Review', class: 'warning' },
    approved: { label: 'Approved', class: 'success' },
    rejected: { label: 'Rejected', class: 'danger' },
  };
  return badges[status] || { label: status, class: 'default' };
};

// Open preview modal
const openPreviewModal = (product: any) => {
  selectedProduct.value = product;
  previewImageIndex.value = 0;
  showPreviewModal.value = true;
};

// Open reject modal
const openRejectModal = (product: any) => {
  selectedProduct.value = product;
  rejectionReason.value = '';
  showRejectModal.value = true;
};

// Handle approve
const handleApprove = async (product: any) => {
  actionLoading.value = true;
  try {
    await adminStore.approveProduct(product._id);
    await fetchProducts();
    showPreviewModal.value = false;
  } catch (error) {
    console.error('Failed to approve product:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle decline
const handleDecline = async () => {
  if (!selectedProduct.value || !rejectionReason.value) return;
  
  actionLoading.value = true;
  try {
    await adminStore.declineProduct(selectedProduct.value._id, rejectionReason.value);
    showRejectModal.value = false;
    await fetchProducts();
    showPreviewModal.value = false;
  } catch (error) {
    console.error('Failed to decline product:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle reset to pending
const handleResetToPending = async (product: any) => {
  actionLoading.value = true;
  try {
    await adminStore.resetProductToPending(product._id);
    await fetchProducts();
  } catch (error) {
    console.error('Failed to reset product:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Navigate images in preview
const nextImage = () => {
  if (!selectedProduct.value?.imageUrls) return;
  previewImageIndex.value = (previewImageIndex.value + 1) % selectedProduct.value.imageUrls.length;
};

const prevImage = () => {
  if (!selectedProduct.value?.imageUrls) return;
  previewImageIndex.value = previewImageIndex.value === 0 
    ? selectedProduct.value.imageUrls.length - 1 
    : previewImageIndex.value - 1;
};

// Close modals
const closeModals = () => {
  showPreviewModal.value = false;
  showRejectModal.value = false;
  selectedProduct.value = null;
};

// Total pages
const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit));

// Pending count
const pendingCount = computed(() => {
  if (selectedStatus.value === PRODUCT_STATUS.PENDING_REVIEW) {
    return products.value.length;
  }
  return adminStore.dashboardStats?.pendingActions?.productApprovals || 0;
});

onMounted(async () => {
  // Ensure auth is ready
  if (!authStore.authChecked) {
    await authStore.fetchSession();
  }
  if (!authStore.isAuthenticated || !authStore.token) return;
  
  // Fetch categories
  try {
    const fetchedCategories = await adminStore.fetchCategories();
    if (fetchedCategories && fetchedCategories.length > 0) {
      categoryOptions.value = [
        { value: 'all', label: 'All Categories' },
        ...fetchedCategories.map((cat: any) => ({
          value: cat._id || cat.id,
          label: cat.name
        }))
      ];
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error);
  }
  
  // Initial fetch with the default pending_review filter
  fetchProducts();
});
</script>

<template>
  <div class="products-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Product Management</h1>
        <p class="page-subtitle">Review and approve products before they appear on the marketplace</p>
      </div>
      <div class="header-stats">
        <div class="stat-badge pending">
          <ClockIcon class="stat-icon" />
          <span>{{ pendingCount }} Pending</span>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <div class="filters-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search products by name..."
        />
      </div>
      
      <div class="filter-controls">
        <select v-model="selectedStatus" class="filter-select">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <select v-model="selectedCategory" class="filter-select">
          <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Products Grid -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading products...</p>
    </div>
    
    <div v-else-if="products.length > 0" class="products-grid">
      <div 
        v-for="product in products" 
        :key="product._id"
        class="product-card"
      >
        <div class="product-image" @click="openPreviewModal(product)">
          <img 
            v-if="product.mainImage || product.imageUrls?.[0]" 
            :src="product.mainImage || product.imageUrls[0]" 
            :alt="product.name"
          />
          <div v-else class="no-image">
            <PhotoIcon class="no-image-icon" />
          </div>
          <div class="image-overlay">
            <EyeIcon class="overlay-icon" />
            <span>Preview</span>
          </div>
        </div>
        
        <div class="product-content">
          <div class="product-header">
            <h3 class="product-name">{{ product.name }}</h3>
            <span :class="`status-badge ${getStatusBadge(product.status).class}`">
              {{ getStatusBadge(product.status).label }}
            </span>
          </div>
          
          <div class="product-meta">
            <span class="product-price">{{ formatCurrency(product.price || 0) }}</span>
            <span class="product-stock">{{ product.stock || 0 }} in stock</span>
          </div>
          
          <div class="product-seller">
            <span class="seller-label">Seller:</span>
            <span class="seller-name">{{ product.seller?.storeName || product.seller?.name || 'Unknown' }}</span>
          </div>
          
          <div class="product-date">
            <span>Submitted: {{ formatDate(product.createdAt) }}</span>
          </div>
          
          <div class="product-actions">
            <template v-if="product.status === PRODUCT_STATUS.PENDING_REVIEW">
              <button 
                class="action-btn approve"
                @click="handleApprove(product)"
                :disabled="actionLoading"
              >
                <CheckIcon class="btn-icon" />
                Approve
              </button>
              <button 
                class="action-btn decline"
                @click="openRejectModal(product)"
                :disabled="actionLoading"
              >
                <XMarkIcon class="btn-icon" />
                Decline
              </button>
            </template>
            <template v-else>
              <button 
                class="action-btn preview"
                @click="openPreviewModal(product)"
              >
                <EyeIcon class="btn-icon" />
                View Details
              </button>
              <button 
                v-if="product.status !== PRODUCT_STATUS.PENDING_REVIEW"
                class="action-btn reset"
                @click="handleResetToPending(product)"
                :disabled="actionLoading"
              >
                <ArrowPathIcon class="btn-icon" />
                Reset
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <CubeIcon class="empty-icon" />
      <h3>No products found</h3>
      <p v-if="selectedStatus === 'pending_review'">All products have been reviewed!</p>
      <p v-else>Try adjusting your filters or search query</p>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
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

    <!-- Preview Modal -->
    <div v-if="showPreviewModal && selectedProduct" class="modal-overlay" @click.self="closeModals">
      <div class="modal preview-modal">
        <div class="modal-header">
          <h3>Product Preview</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="preview-content">
            <!-- Image Gallery -->
            <div class="image-gallery">
              <div class="main-image">
                <img 
                  v-if="selectedProduct.imageUrls?.[previewImageIndex]"
                  :src="selectedProduct.imageUrls[previewImageIndex]" 
                  :alt="selectedProduct.name"
                />
                <div v-else class="no-image">
                  <PhotoIcon class="no-image-icon" />
                </div>
                
                <button 
                  v-if="selectedProduct.imageUrls?.length > 1"
                  class="nav-btn prev"
                  @click="prevImage"
                >
                  <ChevronLeftIcon class="nav-icon" />
                </button>
                <button 
                  v-if="selectedProduct.imageUrls?.length > 1"
                  class="nav-btn next"
                  @click="nextImage"
                >
                  <ChevronRightIcon class="nav-icon" />
                </button>
              </div>
              
              <div v-if="selectedProduct.imageUrls?.length > 1" class="thumbnail-strip">
                <button 
                  v-for="(image, index) in selectedProduct.imageUrls"
                  :key="index"
                  class="thumbnail"
                  :class="{ 'active': index === previewImageIndex }"
                  @click="previewImageIndex = index"
                >
                  <img :src="image" :alt="`Image ${index + 1}`" />
                </button>
              </div>
            </div>
            
            <!-- Product Details -->
            <div class="product-details">
              <div class="detail-header">
                <h2 class="detail-title">{{ selectedProduct.name }}</h2>
                <span :class="`status-badge large ${getStatusBadge(selectedProduct.status).class}`">
                  {{ getStatusBadge(selectedProduct.status).label }}
                </span>
              </div>
              
              <div class="detail-price">
                {{ formatCurrency(selectedProduct.price || 0) }}
              </div>
              
              <div class="detail-section description-section">
                <h4>Description</h4>
                <div v-if="selectedProduct.description" class="description-content" v-html="selectedProduct.description"></div>
                <p v-else class="no-description">No description provided</p>
              </div>
              
              <div class="detail-grid">
                <div class="detail-item">
                  <span class="detail-label">Category</span>
                  <span class="detail-value">{{ selectedProduct.category?.name || 'Uncategorized' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Stock</span>
                  <span class="detail-value">{{ selectedProduct.stock || 0 }} units</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">SKU</span>
                  <span class="detail-value">{{ selectedProduct.sku || 'N/A' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Brand</span>
                  <span class="detail-value">{{ selectedProduct.brand || 'N/A' }}</span>
                </div>
              </div>
              
              <div class="detail-section seller-info">
                <h4>Seller Information</h4>
                <div class="seller-card">
                  <div class="seller-avatar">
                    {{ selectedProduct.seller?.name?.charAt(0).toUpperCase() || 'S' }}
                  </div>
                  <div class="seller-details">
                    <span class="seller-name">{{ selectedProduct.seller?.storeName || selectedProduct.seller?.name }}</span>
                    <span class="seller-email">{{ selectedProduct.seller?.email }}</span>
                  </div>
                </div>
              </div>
              
              <div v-if="selectedProduct.rejectionReason" class="rejection-info">
                <h4>Rejection Reason</h4>
                <p>{{ selectedProduct.rejectionReason }}</p>
              </div>
              
              <div class="detail-dates">
                <span>Created: {{ formatDate(selectedProduct.createdAt) }}</span>
                <span v-if="selectedProduct.approvedAt">Approved: {{ formatDate(selectedProduct.approvedAt) }}</span>
                <span v-if="selectedProduct.rejectedAt">Rejected: {{ formatDate(selectedProduct.rejectedAt) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="selectedProduct.status === 'pending_review'" class="modal-footer">
          <button 
            class="btn btn-danger"
            @click="showRejectModal = true; showPreviewModal = false"
            :disabled="actionLoading"
          >
            <XMarkIcon class="btn-icon" />
            Decline Product
          </button>
          <button 
            class="btn btn-success"
            @click="handleApprove(selectedProduct)"
            :disabled="actionLoading"
          >
            <CheckIcon class="btn-icon" />
            {{ actionLoading ? 'Approving...' : 'Approve Product' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reject Modal -->
    <div v-if="showRejectModal && selectedProduct" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>Decline Product</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="product-preview-mini">
            <img 
              v-if="selectedProduct.mainImage || selectedProduct.imageUrls?.[0]" 
              :src="selectedProduct.mainImage || selectedProduct.imageUrls[0]" 
              :alt="selectedProduct.name"
              class="preview-img"
            />
            <div v-else class="preview-img no-image">
              <PhotoIcon class="no-image-icon-sm" />
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ selectedProduct.name }}</span>
              <span class="preview-price">{{ formatCurrency(selectedProduct.price || 0) }}</span>
            </div>
          </div>
          
          <p class="modal-text">
            Please provide a reason for declining this product. This will be sent to the seller.
          </p>
          
          <div class="form-group">
            <label>Rejection Reason <span class="required">*</span></label>
            <textarea 
              v-model="rejectionReason"
              placeholder="Enter the reason for declining this product..."
              rows="4"
            ></textarea>
          </div>
          
          <div class="common-reasons">
            <span class="reasons-label">Common reasons:</span>
            <div class="reason-chips">
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Product images do not meet quality standards.'"
              >
                Poor image quality
              </button>
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Product description is incomplete or misleading.'"
              >
                Incomplete description
              </button>
              <button 
                class="reason-chip"
                @click="rejectionReason = 'This product category is not allowed on our platform.'"
              >
                Prohibited category
              </button>
              <button 
                class="reason-chip"
                @click="rejectionReason = 'Product pricing appears incorrect or suspicious.'"
              >
                Pricing issues
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModals">Cancel</button>
          <button 
            class="btn btn-danger"
            :disabled="actionLoading || !rejectionReason"
            @click="handleDecline"
          >
            {{ actionLoading ? 'Processing...' : 'Decline Product' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.products-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
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

/* Products Grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.product-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
  transition: all 0.2s ease;
}

.product-card:hover {
  box-shadow: var(--shadow-md);
}

.product-image {
  position: relative;
  aspect-ratio: 4/3;
  background: var(--bg-secondary);
  cursor: pointer;
  overflow: hidden;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-image img {
  transform: scale(1.05);
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.no-image-icon {
  width: 3rem;
  height: 3rem;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: white;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.product-image:hover .image-overlay {
  opacity: 1;
}

.overlay-icon {
  width: 2rem;
  height: 2rem;
}

.product-content {
  padding: 1rem;
}

.product-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.product-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.warning { background: #fef3c7; color: #d97706; }
.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }

.status-badge.large {
  padding: 0.375rem 0.75rem;
  font-size: 0.8rem;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.product-price {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.product-stock {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.product-seller {
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

.seller-label {
  color: var(--text-tertiary);
}

.seller-name {
  color: var(--text-secondary);
  font-weight: 500;
}

.product-date {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.product-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem;
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

.action-btn.preview:hover {
  background: var(--bg-secondary);
}

.action-btn.reset {
  background: #e0f2fe;
  border-color: #0284c7;
  color: #0284c7;
}

.action-btn.reset:hover:not(:disabled) {
  background: #0284c7;
  color: white;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

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
  transition: all 0.2s ease;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--bg-secondary);
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

.preview-modal {
  max-width: 900px;
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

/* Preview Modal Content */
.preview-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.image-gallery {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.main-image {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.main-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: white;
}

.nav-btn.prev { left: 0.5rem; }
.nav-btn.next { right: 0.5rem; }

.nav-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.thumbnail-strip {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
}

.thumbnail {
  width: 60px;
  height: 60px;
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.thumbnail.active {
  border-color: var(--color-primary);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.detail-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.detail-price {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

.detail-section {
  margin-bottom: 0.5rem;
}

.detail-section h4 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.detail-section p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

/* Rich text description styles */
.description-content {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.7;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.description-content :deep(p) {
  margin: 0 0 0.75rem 0;
}

.description-content :deep(p:last-child) {
  margin-bottom: 0;
}

.description-content :deep(h1),
.description-content :deep(h2),
.description-content :deep(h3),
.description-content :deep(h4) {
  color: var(--text-primary);
  font-weight: 600;
  margin: 0.75rem 0 0.5rem 0;
}

.description-content :deep(h1) {
  font-size: 1.25rem;
}

.description-content :deep(h2) {
  font-size: 1.1rem;
}

.description-content :deep(h3) {
  font-size: 1rem;
}

.description-content :deep(h4) {
  font-size: 0.95rem;
}

.description-content :deep(strong),
.description-content :deep(b) {
  font-weight: 600;
  color: var(--text-primary);
}

.description-content :deep(em),
.description-content :deep(i) {
  font-style: italic;
}

.description-content :deep(u) {
  text-decoration: underline;
}

.description-content :deep(ul),
.description-content :deep(ol) {
  margin: 0.5rem 0 0.75rem 1.25rem;
  padding: 0;
}

.description-content :deep(li) {
  margin: 0.25rem 0;
}

.description-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.description-content :deep(a:hover) {
  text-decoration: underline;
}

/* Quill alignment classes */
.description-content :deep(.ql-align-center) {
  text-align: center;
}

.description-content :deep(.ql-align-right) {
  text-align: right;
}

.description-content :deep(.ql-align-justify) {
  text-align: justify;
}

/* Quill indent classes */
.description-content :deep(.ql-indent-1) {
  padding-left: 3em;
}

.description-content :deep(.ql-indent-2) {
  padding-left: 6em;
}

/* Blockquote styling */
.description-content :deep(blockquote) {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin: 0.5rem 0;
  color: var(--text-secondary);
  font-style: italic;
}

.no-description {
  color: var(--text-tertiary);
  font-style: italic;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

.seller-info .seller-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.seller-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.seller-details {
  display: flex;
  flex-direction: column;
}

.seller-details .seller-name {
  font-weight: 600;
  color: var(--text-primary);
}

.seller-email {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.rejection-info {
  background: #fee2e2;
  padding: 1rem;
  border-radius: var(--radius-md);
}

.rejection-info h4 {
  color: #dc2626;
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
}

.rejection-info p {
  color: #991b1b;
  margin: 0;
  font-size: 0.9rem;
}

.detail-dates {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
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
  transition: all 0.2s ease;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-success {
  background: #16a34a;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #15803d;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

/* Reject Modal */
.product-preview-mini {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1rem;
}

.preview-img {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.preview-img.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
}

.no-image-icon-sm {
  width: 2rem;
  height: 2rem;
  color: var(--text-tertiary);
}

.preview-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.preview-name {
  font-weight: 600;
  color: var(--text-primary);
}

.preview-price {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-primary);
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

.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
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
  
  .products-grid {
    grid-template-columns: 1fr;
  }
  
  .preview-content {
    grid-template-columns: 1fr;
  }
  
  .preview-modal {
    max-width: 100%;
  }
}
</style>
