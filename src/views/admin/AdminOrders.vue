<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  XMarkIcon,
  ShoppingCartIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowPathIcon,
  MapPinIcon,
  UserIcon,
  PhoneIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
  PhotoIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const searchQuery = ref('');
const selectedStatus = ref('all');
const selectedDateRange = ref('all');

// Modal state
const showDetailModal = ref(false);
const selectedOrder = ref<any>(null);

// Data
const orders = computed(() => adminStore.orders || []);
const pagination = computed(() => adminStore.ordersPagination);

// Status options
const statusOptions = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Date range options
const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

// Fetch orders
const fetchOrders = async () => {
  isLoading.value = true;
  try {
    const filters: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    };
    if (searchQuery.value) filters.search = searchQuery.value;
    if (selectedStatus.value !== 'all') filters.status = selectedStatus.value;
    if (selectedDateRange.value !== 'all') filters.dateRange = selectedDateRange.value;
    
    await adminStore.fetchOrders(filters);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
  } finally {
    isLoading.value = false;
  }
};

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    adminStore.setOrdersPagination(1, pagination.value.limit);
    fetchOrders();
  }, 500);
});

watch([selectedStatus, selectedDateRange], () => {
  adminStore.setOrdersPagination(1, pagination.value.limit);
  fetchOrders();
});

// Calculate order total from items if subTotal is missing
const getOrderTotal = (order: any): number => {
  // First try subTotal
  if (order.subTotal && order.subTotal > 0) return order.subTotal;
  // Then try totalAmount
  if (order.totalAmount && order.totalAmount > 0) return order.totalAmount;
  // Calculate from items if both are missing/zero
  if (order.items && Array.isArray(order.items)) {
    return order.items.reduce((sum: number, item: any) => {
      const price = item.price || item.product?.price || 0;
      const qty = item.quantity || 1;
      return sum + (price * qty);
    }, 0);
  }
  return 0;
};

// Format currency - Philippine Peso
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount || 0);
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
  const badges: Record<string, { label: string; class: string; icon: any }> = {
    pending: { label: 'Pending', class: 'warning', icon: ClockIcon },
    processing: { label: 'Processing', class: 'info', icon: ArrowPathIcon },
    shipped: { label: 'Shipped', class: 'primary', icon: TruckIcon },
    delivered: { label: 'Delivered', class: 'success', icon: CheckCircleIcon },
    cancelled: { label: 'Cancelled', class: 'danger', icon: XCircleIcon },
  };
  return badges[status] || { label: status, class: 'default', icon: ClockIcon };
};

// Open detail modal
const openDetailModal = (order: any) => {
  selectedOrder.value = order;
  showDetailModal.value = true;
};

// Close modal
const closeModal = () => {
  showDetailModal.value = false;
  selectedOrder.value = null;
};

// Pagination
const handlePageChange = (page: number) => {
  adminStore.setOrdersPagination(page, pagination.value.limit);
  fetchOrders();
};

const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit));

// Order stats
const orderStats = computed(() => {
  if (!adminStore.dashboardStats) return null;
  return {
    total: adminStore.dashboardStats.orders?.total || 0,
    pending: orders.value.filter((o: any) => o.status === 'pending').length,
    processing: orders.value.filter((o: any) => o.status === 'processing').length,
    delivered: orders.value.filter((o: any) => o.status === 'delivered').length,
  };
});

onMounted(async () => {
  // Ensure auth is ready
  if (!authStore.authChecked) {
    await authStore.fetchSession();
  }
  if (!authStore.isAuthenticated || !authStore.token) return;
  
  // Fetch dashboard stats for order totals
  if (!adminStore.dashboardStats) {
    await adminStore.fetchDashboardStats();
  }
  
  fetchOrders();
});
</script>

<template>
  <div class="orders-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Order Management</h1>
        <p class="page-subtitle">Track and manage all platform orders</p>
      </div>
    </div>

    <!-- Stats Overview -->
    <div v-if="orderStats" class="stats-row">
    
      <div class="stat-card">
        <div class="stat-icon total">
          <ShoppingCartIcon />
        </div>
        <div class="stat-content">
          <span class="stat-value order-total">{{ orderStats.total }}</span>
          <span class="stat-label">Total Orders</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon pending">
          <ClockIcon />
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ orderStats.pending }}</span>
          <span class="stat-label">Pending</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon processing">
          <ArrowPathIcon />
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ orderStats.processing }}</span>
          <span class="stat-label">Processing</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon delivered">
          <CheckCircleIcon />
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ orderStats.delivered }}</span>
          <span class="stat-label">Delivered</span>
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
          placeholder="Search by order ID or customer..."
        />
      </div>
      
      <div class="filter-controls">
        <select v-model="selectedStatus" class="filter-select">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <select v-model="selectedDateRange" class="filter-select">
          <option v-for="option in dateRangeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Orders Table -->
    <div class="table-container">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading orders...</p>
      </div>
      
      <table v-else-if="orders.length > 0" class="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Commission</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order._id">
            <!-- <div>
              {{ order}}
            </div> -->
            <td>
              <span class="order-id">#{{ order.orderId || order._id?.slice(-8) }}</span>
            </td>
            <td>
              <div class="customer-cell">
                <div class="customer-avatar">
                  {{ (order.customerId?.name || order.user?.name || 'U')?.charAt(0).toUpperCase() }}
                </div>
                <div class="customer-info">
                  <span class="customer-name">{{ order.customerId?.name || order.user?.name || 'Customer' }}</span>
                  <span class="customer-email">{{ order.customerId?.email || order.user?.email || '' }}</span>
                </div>
              </div>
            </td>
            <td>
              <div class="items-preview">
                <div class="item-images">
                  <img 
                    v-for="(item, idx) in order.items?.slice(0, 3)" 
                    :key="idx"
                    :src="order.items[0].imgUrl || item.product?.img || item.mainImage || '/placeholder.png'"
                    :alt="item.product?.name || item.name"
                    class="item-thumb"
                  />
                  <span v-if="order.items?.length > 3" class="more-items">+{{ order.items.length - 3 }}</span>
                </div>
                <span class="items-count">{{ order.items?.length || 0 }} item(s)</span>
              </div>
            </td>
            <td>
              <span class="order-total">{{ formatCurrency(getOrderTotal(order)) }}</span>
            </td>
            <td>
              <span class="commission">{{ formatCurrency(getOrderTotal(order) * 0.07) }}</span>
            </td>
            <td>
              <span :class="`status-badge ${getStatusBadge(order.status).class}`">
                <component :is="getStatusBadge(order.status).icon" class="status-icon" />
                {{ getStatusBadge(order.status).label }}
              </span>
            </td>
            <td>
              <span class="order-date">{{ formatDate(order.createdAt) }}</span>
            </td>
            <td>
              <button class="view-btn" @click="openDetailModal(order)">
                <EyeIcon class="btn-icon" />
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="empty-state">
        <ShoppingCartIcon class="empty-icon" />
        <h3>No orders found</h3>
        <p>Try adjusting your filters or search query</p>
      </div>
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

    <!-- Order Detail Modal -->
    <div v-if="showDetailModal && selectedOrder" class="modal-overlay" @click.self="closeModal">
      <div class="modal order-modal">
        <div class="modal-header">
          <h3>Order Details</h3>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <!-- Order Header -->
          <div class="order-header">
            <div class="order-id-section">
              <span class="order-id-label">Order ID</span>
              <span class="order-id-value">#{{ selectedOrder.orderId || selectedOrder._id?.slice(-8) }}</span>
            </div>
            <span :class="`status-badge large ${getStatusBadge(selectedOrder.status).class}`">
              <component :is="getStatusBadge(selectedOrder.status).icon" class="status-icon" />
              {{ getStatusBadge(selectedOrder.status).label }}
            </span>
          </div>

          <!-- Customer Info -->
          <div class="info-section">
            <h4>
              <UserIcon class="section-icon" />
              Customer Information
            </h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Name</span>
                <span class="info-value">{{ selectedOrder.customerId?.name || selectedOrder.user?.name || 'Customer' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">{{ selectedOrder.customerId?.email || selectedOrder.user?.email || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone</span>
                <span class="info-value">{{ selectedOrder.customerId?.phone || selectedOrder.user?.phone || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <!-- Seller Info -->
          <div class="info-section seller-section">
            <h4>
              <BuildingStorefrontIcon class="section-icon" />
              Seller Information
            </h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Seller Name</span>
                <span class="info-value">{{ selectedOrder.vendorId?.name || selectedOrder.vendorId?.sellerApplication?.shopName || 'Seller' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">{{ selectedOrder.vendorId?.email || 'N/A' }}</span>
              </div>
            </div>
          </div>

          <!-- Shipping Info -->
          <div class="info-section">
            <h4>
              <MapPinIcon class="section-icon" />
              Shipping Address
            </h4>
            <p class="address-text">
              {{ selectedOrder.shippingAddress?.street || 'N/A' }}<br>
              {{ selectedOrder.shippingAddress?.city }}, {{ selectedOrder.shippingAddress?.state }}<br>
              {{ selectedOrder.shippingAddress?.country }}
            </p>
          </div>

          <!-- Order Items -->
          <div class="info-section">
            <h4>
              <ShoppingCartIcon class="section-icon" />
              Order Items
            </h4>
            <div class="items-list">
              <div 
                v-for="(item, index) in selectedOrder.items" 
                :key="index"
                class="order-item"
              >
                <div class="item-image">
                  <img 
                    v-if="item.product?.mainImage || item.product?.images?.[0] || item.mainImage"
                    :src="item.product?.mainImage || item.product?.images?.[0] || item.mainImage"
                    :alt="item.product?.name || item.name"
                    class="product-image"
                  />
                  <div v-else class="no-image">
                    <PhotoIcon class="no-image-icon" />
                  </div>
                </div>
                <div class="item-details">
                  <span class="item-name">{{ item.product?.name || item.name || 'Product' }}</span>
                  <span class="item-variant" v-if="item.variant">{{ item.variant }}</span>
                  <span class="item-quantity">Qty: {{ item.quantity }}</span>
                </div>
                <div class="item-price">
                  {{ formatCurrency((item.price || item.product?.price || 0) * (item.quantity || 1)) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Payment Summary -->
          <div class="info-section">
            <h4>
              <CurrencyDollarIcon class="section-icon" />
              Payment Summary
            </h4>
            <div class="payment-summary">
              <div class="summary-row">
                <span>Subtotal</span>
                <span>{{ formatCurrency(getOrderTotal(selectedOrder)) }}</span>
              </div>
              <div class="summary-row">
                <span>Shipping</span>
                <span>{{ formatCurrency(selectedOrder.shippingCost || selectedOrder.shippingFee || 0) }}</span>
              </div>
              <div class="summary-row">
                <span>Tax</span>
                <span>{{ formatCurrency(selectedOrder.tax || 0) }}</span>
              </div>
              <div class="summary-row total">
                <span>Total</span>
                <span>{{ formatCurrency(getOrderTotal(selectedOrder)) }}</span>
              </div>
              <div class="summary-row commission">
                <span>Platform Commission (7%)</span>
                <span>{{ formatCurrency(getOrderTotal(selectedOrder) * 0.07) }}</span>
              </div>
              <div class="summary-row seller-earnings">
                <span>Seller Earnings (93%)</span>
                <span>{{ formatCurrency(getOrderTotal(selectedOrder) * 0.93) }}</span>
              </div>
            </div>
          </div>

          <!-- Order Timeline -->
          <div class="info-section">
            <h4>Order Timeline</h4>
            <div class="timeline">
              <div class="timeline-item">
                <div class="timeline-marker done"></div>
                <div class="timeline-content">
                  <span class="timeline-title">Order Placed</span>
                  <span class="timeline-date">{{ formatDate(selectedOrder.createdAt) }}</span>
                </div>
              </div>
              <div v-if="selectedOrder.status !== 'pending'" class="timeline-item">
                <div class="timeline-marker" :class="{ 'done': ['processing', 'shipped', 'delivered'].includes(selectedOrder.status) }"></div>
                <div class="timeline-content">
                  <span class="timeline-title">Processing</span>
                  <span class="timeline-date" v-if="selectedOrder.processedAt">{{ formatDate(selectedOrder.processedAt) }}</span>
                </div>
              </div>
              <div v-if="['shipped', 'delivered'].includes(selectedOrder.status)" class="timeline-item">
                <div class="timeline-marker" :class="{ 'done': ['shipped', 'delivered'].includes(selectedOrder.status) }"></div>
                <div class="timeline-content">
                  <span class="timeline-title">Shipped</span>
                  <span class="timeline-date" v-if="selectedOrder.shippedAt">{{ formatDate(selectedOrder.shippedAt) }}</span>
                </div>
              </div>
              <div v-if="selectedOrder.status === 'delivered'" class="timeline-item">
                <div class="timeline-marker done"></div>
                <div class="timeline-content">
                  <span class="timeline-title">Delivered</span>
                  <span class="timeline-date" v-if="selectedOrder.deliveredAt">{{ formatDate(selectedOrder.deliveredAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.orders-page {
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

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
}

.stat-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.stat-icon.total { background: #e0f2fe; color: #0284c7; }
.stat-icon.pending { background: #fef3c7; color: #d97706; }
.stat-icon.processing { background: #e0e7ff; color: #4f46e5; }
.stat-icon.delivered { background: #dcfce7; color: #16a34a; }

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
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

/* Table Container */
.table-container {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
}

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

/* Data Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 1rem 1.25rem;
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
}

.data-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.order-id {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.customer-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.customer-avatar {
  width: 2rem;
  height: 2rem;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.customer-info {
  display: flex;
  flex-direction: column;
}

.customer-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.customer-email {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.items-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.order-total {
  font-weight: 600;
  color: var(--text-primary);
}

.commission {
  font-size: 0.875rem;
  color: #16a34a;
  font-weight: 500;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.large {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}

.status-badge.warning { background: #fef3c7; color: #d97706; }
.status-badge.info { background: #e0e7ff; color: #4f46e5; }
.status-badge.primary { background: #e0f2fe; color: #0284c7; }
.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }

.status-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.order-date {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-btn:hover {
  background: var(--bg-secondary);
}

.btn-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
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
  margin-top: 1.5rem;
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
  max-width: 600px;
  box-shadow: var(--shadow-xl);
  max-height: 90vh;
  overflow-y: auto;
}

.order-modal {
  max-width: 700px;
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

/* Order Header */
.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.order-id-section {
  display: flex;
  flex-direction: column;
}

.order-id-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.order-id-value {
  font-size: 1.25rem;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-primary);
}

/* Info Sections */
.info-section {
  margin-bottom: 1.5rem;
}

.info-section h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
}

.section-icon {
  width: 1rem;
  height: 1rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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

.address-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Items List */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.item-image {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface);
  flex-shrink: 0;
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.no-image-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.item-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.item-quantity {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.item-price {
  font-weight: 600;
  color: var(--text-primary);
}

/* Payment Summary */
.payment-summary {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.summary-row.total {
  border-top: 1px solid var(--border-primary);
  margin-top: 0.5rem;
  padding-top: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  font-size: 1rem;
}

.summary-row.commission {
  color: #16a34a;
  font-weight: 500;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-left: 1rem;
}

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  position: relative;
}

.timeline-item::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 20px;
  bottom: -1rem;
  width: 2px;
  background: var(--border-primary);
}

.timeline-item:last-child::before {
  display: none;
}

.timeline-marker {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border-primary);
  border: 2px solid var(--surface);
  flex-shrink: 0;
  z-index: 1;
}

.timeline-marker.done {
  background: #16a34a;
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.timeline-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.timeline-date {
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

/* Enhanced Branding - Primary Green */
.customer-avatar {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
}

.stat-icon.delivered {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  color: #1f8b4e;
}

/* Product Image Items in Table */
.items-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.item-images {
  display: flex;
  align-items: center;
}

.item-thumb {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 2px solid var(--surface);
  margin-left: -0.5rem;
  background: var(--bg-secondary);
}

.item-thumb:first-child {
  margin-left: 0;
}

.more-items {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  margin-left: -0.5rem;
  border: 2px solid var(--surface);
}

/* Enhanced Product Image in Modal */
.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.item-variant {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Seller Section */
.seller-section h4 {
  color: #1f8b4e;
}

/* Enhanced Payment Summary */
.summary-row.seller-earnings {
  color: #1f8b4e;
  font-weight: 500;
}

/* Modern Status Badge Enhancement */
.status-badge {
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.1) 0%, rgba(31, 139, 78, 0.2) 100%);
  border: 1px solid rgba(31, 139, 78, 0.3);
}

.status-badge.success {
  background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
  border: 1px solid rgba(31, 139, 78, 0.3);
  color: #1f8b4e;
}

/* View Button Enhancement */
.view-btn {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  border: none;
}

.view-btn:hover {
  background: linear-gradient(135deg, #166c3b 0%, #138b3c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
}

/* Enhanced Timeline */
.timeline-marker.done {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  box-shadow: 0 2px 8px rgba(31, 139, 78, 0.3);
}

/* Modal Header Enhancement */
.order-modal .modal-header {
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.05) 0%, rgba(31, 139, 78, 0.1) 100%);
  border-bottom: 2px solid rgba(31, 139, 78, 0.2);
}

/* Info Section Headers */
.info-section h4 {
  color: #1f8b4e;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(31, 139, 78, 0.15);
}

.section-icon {
  color: #1f8b4e;
}

/* Responsive */
@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

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
  
  .stats-row {
    grid-template-columns: 1fr;
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  .data-table {
    min-width: 800px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .item-images {
    display: none;
  }
}
</style>
