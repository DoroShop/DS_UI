<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { Toast } from '../../components/composable/Toast.js';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserIcon,
  BuildingStorefrontIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const isInitialLoad = ref(true);
const searchQuery = ref('');
const statusFilter = ref<string>('all');
const showDetailModal = ref(false);
const showActionModal = ref(false);
const isSubmitting = ref(false);

const selectedRefund = ref<any>(null);
const actionType = ref<'approve' | 'reject'>('approve');
const actionNote = ref('');

// Refunds data - ensure it's always an array
const refunds = computed(() => adminStore.refunds || []);

// Fail-safe: once data arrives, stop showing loader even if the flag desyncs
watch(refunds, (val) => {
  if (Array.isArray(val) && val.length >= 0) {
    isLoading.value = false;
    isInitialLoad.value = false;
  }
}, { immediate: true });

// Filtered refunds
const filteredRefunds = computed(() => {
  let result = refunds.value;
  
  if (statusFilter.value !== 'all') {
    result = result.filter((r: any) => r.status === statusFilter.value);
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((r: any) => {
      const orderIdStr = getOrderId(r).toLowerCase();
      const customerName = getCustomerName(r).toLowerCase();
      const reason = (r.reason || '').toLowerCase();
      return orderIdStr.includes(query) || customerName.includes(query) || reason.includes(query);
    });
  }
  
  return result;
});

// Helpers to safely read nested refund data
const getOrderId = (refund: any) => {
  const raw = refund?.orderId?._id || refund?.orderId || refund?.order;
  return raw ? String(raw) : '';
};

const getOrderIdDisplay = (refund: any) => {
  const raw = getOrderId(refund);
  return raw ? raw.slice(-8).toUpperCase() : 'N/A';
};

const getCustomerName = (refund: any) =>
  refund?.customerId?.name || refund?.customer?.name || refund?.user?.name || 'Unknown';

const getCustomerEmail = (refund: any) =>
  refund?.customerId?.email || refund?.customer?.email || refund?.user?.email || '';

const getAmountValue = (refund: any) => refund?.amount ?? refund?.totalRefundAmount ?? 0;

const getStatusText = (refund: any) => refund?.status || 'pending';

// Stats
const stats = computed(() => ({
  total: refunds.value.length,
  pending: refunds.value.filter((r: any) => getStatusText(r) === 'pending').length,
  approved: refunds.value.filter((r: any) => getStatusText(r) === 'approved').length,
  rejected: refunds.value.filter((r: any) => getStatusText(r) === 'rejected').length,
  totalAmount: refunds.value
    .filter((r: any) => r.status === 'approved')
    .reduce((sum: number, r: any) => sum + (getAmountValue(r)), 0),
}));

// Fetch data
const fetchRefunds = async () => {
  // Only show full loading spinner on initial load
  if (isInitialLoad.value) {
    isLoading.value = true;
  }
  try {
    const filters: any = {};
    if (statusFilter.value !== 'all') {
      filters.status = statusFilter.value;
    }
    await adminStore.fetchRefundRequests(filters);
  } catch (error) {
    console.error('Failed to fetch refunds:', error);
  } finally {
    isLoading.value = false;
    isInitialLoad.value = false;
  }
};

// Open detail modal
const openDetailModal = (refund: any) => {
  selectedRefund.value = refund;
  showDetailModal.value = true;
};

// Open action modal
const openActionModal = (refund: any, action: 'approve' | 'reject') => {
  selectedRefund.value = refund;
  actionType.value = action;
  actionNote.value = '';
  showActionModal.value = true;
};

// Process refund action
const processAction = async () => {
  if (!selectedRefund.value) return;
  
  isSubmitting.value = true;
  try {
    const refundId = selectedRefund.value._id;
    if (actionType.value === 'approve') {
      // First approve, then process to credit wallet
      await adminStore.approveRefund(refundId, actionNote.value);
      await adminStore.processRefund(refundId);
    } else {
      await adminStore.rejectRefund(refundId, actionNote.value);
    }
    
    showActionModal.value = false;
    showDetailModal.value = false;
    await fetchRefunds();
  } catch (error) {
    console.error('Failed to process refund:', error);
    Toast('Failed to process refund. Please try again.', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (date: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format refund reason code to human readable text
const formatRefundReason = (reason: string) => {
  if (!reason) return '';
  const reasonLabels: Record<string, string> = {
    'defective_product': 'Defective Product',
    'wrong_item_received': 'Wrong Item Received',
    'item_not_received': 'Item Not Received',
    'item_damaged': 'Item Damaged',
    'not_as_described': 'Not As Described',
    'changed_mind': 'Changed Mind',
    'duplicate_order': 'Duplicate Order',
    'other': 'Other'
  };
  return reasonLabels[reason] || reason;
};

// Get status class
const getStatusClass = (status: string) => {
  switch (status) {
    case 'approved': return 'success';
    case 'rejected': return 'danger';
    case 'processed': return 'success';
    case 'cancelled': return 'neutral';
    case 'processing': return 'warning';
    default: return 'pending';
  }
};

// Close modals
const closeModal = () => {
  showDetailModal.value = false;
  showActionModal.value = false;
  selectedRefund.value = null;
};

watch(statusFilter, () => {
  fetchRefunds();
});

onMounted(() => {
  fetchRefunds();
});
</script>

<template>
  <div class="refunds-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Refund Requests</h1>
        <p class="page-subtitle">Review and process customer refund requests</p>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon total">
          <ArrowPathIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Requests</span>
          <span class="stat-value">{{ stats.total }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon pending">
          <ClockIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Pending</span>
          <span class="stat-value">{{ stats.pending }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon approved">
          <CheckIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Approved</span>
          <span class="stat-value">{{ stats.approved }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon rejected">
          <XCircleIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Rejected</span>
          <span class="stat-value">{{ stats.rejected }}</span>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon amount">
          <CurrencyDollarIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Refunded</span>
          <span class="stat-value">{{ formatCurrency(stats.totalAmount) }}</span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search by order ID, customer, or reason..."
          class="search-input"
        />
      </div>
      
      <div class="filter-group">
        <select v-model="statusFilter" class="filter-select">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="processing">Processing</option>
        </select>
      </div>
    </div>

    <!-- Loading State - only show if loading AND no data yet -->
    <div v-if="isLoading && refunds.length === 0" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading refund requests...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && filteredRefunds.length === 0" class="empty-state">
      <ArrowPathIcon class="empty-icon" />
      <h3>No Refund Requests</h3>
      <p v-if="searchQuery || statusFilter !== 'all'">No refunds match your filters</p>
      <p v-else>No refund requests have been submitted yet</p>
    </div>

    <!-- Refunds Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="refund in filteredRefunds" :key="refund._id">
            <td class="request-id">#{{ refund._id?.slice(-8).toUpperCase() || 'N/A' }}</td>
            <td class="order-cell">
              <span class="order-id">#{{ getOrderIdDisplay(refund) }}</span>
            </td>
            <td class="customer-cell">
              <div class="customer-info">
                <span class="customer-name">{{ getCustomerName(refund) }}</span>
                <span class="customer-email">{{ getCustomerEmail(refund) }}</span>
              </div>
            </td>
            <td class="amount-cell">{{ formatCurrency(getAmountValue(refund)) }}</td>
            <td class="reason-cell">
              <span class="reason-text">{{ refund.reason || 'No reason provided' }}</span>
            </td>
            <td>
              <span :class="['status-badge', getStatusClass(getStatusText(refund))]">
                {{ getStatusText(refund) }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(refund.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button 
                  class="action-btn view"
                  @click="openDetailModal(refund)"
                  title="View Details"
                >
                  <EyeIcon />
                </button>
                <template v-if="getStatusText(refund) === 'pending'">
                  <button 
                    class="action-btn approve"
                    @click="openActionModal(refund, 'approve')"
                    title="Approve"
                  >
                    <CheckIcon />
                  </button>
                  <button 
                    class="action-btn reject"
                    @click="openActionModal(refund, 'reject')"
                    title="Reject"
                  >
                    <XCircleIcon />
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h2>Refund Request Details</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Status Badge -->
          <div class="detail-status">
            <span :class="['status-badge large', getStatusClass(getStatusText(selectedRefund))]">
              {{ getStatusText(selectedRefund) }}
            </span>
          </div>
          
          <!-- Request Info -->
          <div class="detail-section">
            <h3>Request Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Request ID</span>
                <span class="detail-value">#{{ selectedRefund?._id?.slice(-8).toUpperCase() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Amount</span>
                <span class="detail-value amount">{{ formatCurrency(getAmountValue(selectedRefund)) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Submitted</span>
                <span class="detail-value">{{ formatDate(selectedRefund?.createdAt) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Order ID</span>
                <span class="detail-value">#{{ getOrderIdDisplay(selectedRefund) }}</span>
              </div>
            </div>
          </div>
          
          <!-- Customer Info -->
          <div class="detail-section">
            <h3>
              <UserIcon class="section-icon" />
              Customer
            </h3>
            <div class="info-card">
              <span class="info-name">{{ selectedRefund?.user?.name || selectedRefund?.customer?.name || 'Unknown Customer' }}</span>
              <span class="info-email">{{ selectedRefund?.user?.email || selectedRefund?.customer?.email || 'N/A' }}</span>
            </div>
          </div>
          
          <!-- Seller Info -->
          <div v-if="selectedRefund?.seller || selectedRefund?.vendor" class="detail-section">
            <h3>
              <BuildingStorefrontIcon class="section-icon" />
              Seller
            </h3>
            <div class="info-card">
              <span class="info-name">{{ selectedRefund?.seller?.businessName || selectedRefund?.vendor?.businessName || 'Unknown Seller' }}</span>
              <span class="info-email">{{ selectedRefund?.seller?.email || selectedRefund?.vendor?.email || 'N/A' }}</span>
            </div>
          </div>
          
          <!-- Reason -->
          <div class="detail-section">
            <h3>
              <DocumentTextIcon class="section-icon" />
              Reason for Refund
            </h3>
            <p class="reason-content">{{ formatRefundReason(selectedRefund?.reason) || 'No reason provided' }}</p>
          </div>

          <!-- Customer Details/Message -->
          <div v-if="selectedRefund?.reasonDetails || selectedRefund?.refundNotes" class="detail-section">
            <h3>
              <ChatBubbleLeftEllipsisIcon class="section-icon" />
              Customer Message
            </h3>
            <p class="customer-message">{{ selectedRefund?.reasonDetails || selectedRefund?.refundNotes }}</p>
          </div>
          
          <!-- Admin Notes -->
          <div v-if="selectedRefund?.adminNote" class="detail-section">
            <h3>Admin Notes</h3>
            <p class="admin-note">{{ selectedRefund?.adminNote }}</p>
          </div>
          
          <!-- Action Buttons -->
          <div v-if="getStatusText(selectedRefund) === 'pending'" class="detail-actions">
            <button 
              class="action-button approve"
              @click="openActionModal(selectedRefund, 'approve')"
            >
              <CheckIcon class="btn-icon" />
              Approve Refund
            </button>
            <button 
              class="action-button reject"
              @click="openActionModal(selectedRefund, 'reject')"
            >
              <XCircleIcon class="btn-icon" />
              Reject Request
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Modal -->
    <div v-if="showActionModal" class="modal-overlay" @click.self="showActionModal = false">
      <div class="modal-content action-modal">
        <div :class="['action-icon-wrapper', actionType]">
          <CheckIcon v-if="actionType === 'approve'" />
          <XCircleIcon v-else />
        </div>
        
        <h2>{{ actionType === 'approve' ? 'Approve Refund' : 'Reject Request' }}</h2>
        <p class="action-description">
          <template v-if="actionType === 'approve'">
            You are about to approve a refund of <strong>{{ formatCurrency(getAmountValue(selectedRefund)) }}</strong> 
            for order <strong>#{{ getOrderIdDisplay(selectedRefund) }}</strong>.
          </template>
          <template v-else>
            You are about to reject the refund request for order 
            <strong>#{{ getOrderIdDisplay(selectedRefund) }}</strong>.
          </template>
        </p>
        
        <div class="form-group">
          <label class="form-label" for="note">
            {{ actionType === 'approve' ? 'Note (optional)' : 'Rejection Reason' }}
          </label>
          <textarea 
            v-model="actionNote"
            id="note"
            class="form-textarea"
            :placeholder="actionType === 'approve' ? 'Add a note for this approval...' : 'Please provide a reason for rejection...'"
            rows="3"
            :required="actionType === 'reject'"
          ></textarea>
        </div>
        
        <div class="action-buttons-modal">
          <button 
            class="cancel-btn"
            @click="showActionModal = false"
            :disabled="isSubmitting"
          >
            Cancel
          </button>
          <button 
            :class="['confirm-btn', actionType]"
            @click="processAction"
            :disabled="isSubmitting || (actionType === 'reject' && !actionNote.trim())"
          >
            {{ isSubmitting ? 'Processing...' : (actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.refunds-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
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
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
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
.stat-icon.approved { background: #dcfce7; color: #16a34a; }
.stat-icon.rejected { background: #fee2e2; color: #dc2626; }
.stat-icon.amount { background: #f3e8ff; color: #9333ea; }

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Filters */
.filters-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-tertiary);
}

.search-input {
  width: 100%;
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.filter-select {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
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

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0;
}

/* Table */
.table-container {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
}

.data-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.request-id {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.order-id {
  font-family: monospace;
  color: var(--color-primary);
}

.customer-info {
  display: flex;
  flex-direction: column;
}

.customer-name {
  font-weight: 500;
  color: var(--text-primary);
}

.customer-email {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.amount-cell {
  font-weight: 600;
  color: var(--text-primary);
}

.reason-text {
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 200px;
}

.date-cell {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.pending { background: #fef3c7; color: #d97706; }
.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.warning { background: #fef3c7; color: #d97706; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }

.status-badge.large {
  padding: 0.375rem 1rem;
  font-size: 0.85rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 0.875rem;
  height: 0.875rem;
}

.action-btn.view { background: #e0f2fe; color: #0284c7; }
.action-btn.view:hover { background: #bae6fd; }
.action-btn.approve { background: #dcfce7; color: #16a34a; }
.action-btn.approve:hover { background: #bbf7d0; }
.action-btn.reject { background: #fee2e2; color: #dc2626; }
.action-btn.reject:hover { background: #fecaca; }

/* Modal */
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

.modal-content {
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
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
}

.modal-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-md);
}

.close-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  padding: 1.5rem;
}

.detail-status {
  text-align: center;
  margin-bottom: 1.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.section-icon {
  width: 1rem;
  height: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
}

.detail-value {
  font-weight: 500;
  color: var(--text-primary);
}

.detail-value.amount {
  font-size: 1.125rem;
  color: #16a34a;
}

.info-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-name {
  font-weight: 500;
  color: var(--text-primary);
}

.info-email {
  font-size: 0.85rem;
  color: var(--text-tertiary);
}

.reason-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.customer-message {
  background: color-mix(in srgb, var(--color-info, #3b82f6) 8%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--color-info, #3b82f6) 20%, transparent);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.5;
  font-style: italic;
}

.admin-note {
  background: #fef3c7;
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-size: 0.9rem;
  color: #92400e;
}

.detail-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.action-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button .btn-icon {
  width: 1rem;
  height: 1rem;
}

.action-button.approve {
  background: #16a34a;
  color: white;
}

.action-button.approve:hover {
  background: #15803d;
}

.action-button.reject {
  background: #dc2626;
  color: white;
}

.action-button.reject:hover {
  background: #b91c1c;
}

/* Action Modal */
.action-modal {
  max-width: 450px;
  text-align: center;
  padding: 2rem;
}

.action-icon-wrapper {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon-wrapper.approve {
  background: #dcfce7;
  color: #16a34a;
}

.action-icon-wrapper.reject {
  background: #fee2e2;
  color: #dc2626;
}

.action-icon-wrapper svg {
  width: 2rem;
  height: 2rem;
}

.action-modal h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.action-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
  text-align: left;
}

.action-modal .form-group {
  text-align: left;
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  resize: vertical;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.action-buttons-modal {
  display: flex;
  gap: 0.75rem;
}

.cancel-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.confirm-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  color: white;
}

.confirm-btn.approve { background: #16a34a; }
.confirm-btn.approve:hover:not(:disabled) { background: #15803d; }
.confirm-btn.reject { background: #dc2626; }
.confirm-btn.reject:hover:not(:disabled) { background: #b91c1c; }

.confirm-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
  
  .filters-section {
    flex-direction: column;
  }
  
  .search-box {
    max-width: none;
  }
  
  .table-container {
    overflow-x: auto;
  }
  
  .data-table {
    min-width: 800px;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-actions {
    flex-direction: column;
  }
}
</style>
