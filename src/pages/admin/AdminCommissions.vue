<script setup lang="ts">
/**
 * Admin Commissions Dashboard
 * View and manage all vendor commissions
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useAdminCommissionStore } from '@/stores/admin/adminCommissionStore'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  UserIcon,
  BuildingStorefrontIcon,
  DocumentTextIcon,
  ChartBarIcon,
  EyeIcon,
  PencilSquareIcon
} from '@heroicons/vue/24/outline'

const commissionStore = useAdminCommissionStore()

// State
const showFilters = ref(false)
const showDetailModal = ref(false)
const showStatusModal = ref(false)
const selectedCommission = ref<any>(null)
const statusForm = ref({
  status: '',
  notes: ''
})

// Filters
const filters = ref({
  status: '',
  vendorId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc'
})

// Computed
const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'remitted', label: 'Remitted' },
  { value: 'waived', label: 'Waived' },
  { value: 'disputed', label: 'Disputed' }
]

// Methods
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'status-pending'
    case 'overdue': return 'status-overdue'
    case 'remitted': return 'status-remitted'
    case 'waived': return 'status-waived'
    case 'disputed': return 'status-disputed'
    default: return ''
  }
}

const fetchWithFilters = async (page = 1) => {
  await commissionStore.fetchCommissions({
    page,
    ...filters.value
  })
}

const applyFilters = () => {
  fetchWithFilters(1)
  showFilters.value = false
}

const clearFilters = () => {
  filters.value = {
    status: '',
    vendorId: '',
    startDate: '',
    endDate: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
  fetchWithFilters(1)
}

const viewDetails = async (commission: any) => {
  selectedCommission.value = await commissionStore.fetchCommissionById(commission._id)
  if (selectedCommission.value) {
    showDetailModal.value = true
  }
}

const openStatusModal = (commission: any) => {
  selectedCommission.value = commission
  statusForm.value = {
    status: commission.status,
    notes: ''
  }
  showStatusModal.value = true
}

const updateStatus = async () => {
  if (!selectedCommission.value) return
  
  const result = await commissionStore.updateCommissionStatus(
    selectedCommission.value._id,
    statusForm.value.status,
    statusForm.value.notes
  )
  
  if (result.success) {
    showStatusModal.value = false
    selectedCommission.value = null
  }
}

const refresh = async () => {
  await Promise.all([
    fetchWithFilters(commissionStore.pagination.page),
    commissionStore.fetchAnalytics()
  ])
}

// Lifecycle
onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="admin-commissions">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>
          <BanknotesIcon class="title-icon" />
          Commission Management
        </h1>
        <p class="header-subtitle">Monitor and manage vendor COD commissions</p>
      </div>
      
      <div class="header-actions">
        <button class="action-btn" @click="refresh" :disabled="commissionStore.loading">
          <ArrowPathIcon class="btn-icon" :class="{ 'animate-spin': commissionStore.loading }" />
          Refresh
        </button>
        <button class="action-btn primary" @click="showFilters = !showFilters">
          <FunnelIcon class="btn-icon" />
          Filters
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card total-card">
        <div class="card-icon-wrapper">
          <BanknotesIcon class="card-icon" />
        </div>
        <div class="card-content">
          <span class="card-label">Total Pending</span>
          <span class="card-value">{{ formatCurrency(commissionStore.totalPending) }}</span>
        </div>
      </div>
      
      <div class="summary-card pending-card">
        <div class="card-icon-wrapper">
          <ClockIcon class="card-icon" />
        </div>
        <div class="card-content">
          <span class="card-label">Pending</span>
          <span class="card-value">{{ commissionStore.statusSummary.pending?.count || 0 }}</span>
          <span class="card-amount">{{ formatCurrency(commissionStore.statusSummary.pending?.total || 0) }}</span>
        </div>
      </div>
      
      <div class="summary-card overdue-card">
        <div class="card-icon-wrapper">
          <ExclamationTriangleIcon class="card-icon" />
        </div>
        <div class="card-content">
          <span class="card-label">Overdue</span>
          <span class="card-value">{{ commissionStore.overdueCount }}</span>
          <span class="card-amount">{{ formatCurrency(commissionStore.statusSummary.overdue?.total || 0) }}</span>
        </div>
      </div>
      
      <div class="summary-card remitted-card">
        <div class="card-icon-wrapper">
          <CheckCircleIcon class="card-icon" />
        </div>
        <div class="card-content">
          <span class="card-label">Total Remitted</span>
          <span class="card-value">{{ formatCurrency(commissionStore.totalRemitted) }}</span>
        </div>
      </div>
    </div>

    <!-- Top Vendors with Pending (Analytics) -->
    <div v-if="commissionStore.analytics?.topVendors?.length" class="analytics-section">
      <h3>
        <ChartBarIcon class="section-icon" />
        Top Vendors with Pending Commissions
      </h3>
      <div class="top-vendors-grid">
        <div 
          v-for="vendor in commissionStore.analytics.topVendors" 
          :key="vendor.vendorId"
          class="vendor-card"
        >
          <div class="vendor-info">
            <UserIcon class="vendor-icon" />
            <div>
              <span class="vendor-name">{{ vendor.vendorName }}</span>
              <span class="vendor-email">{{ vendor.vendorEmail }}</span>
            </div>
          </div>
          <div class="vendor-stats">
            <span class="pending-amount">{{ formatCurrency(vendor.totalPending) }}</span>
            <span class="pending-count">{{ vendor.count }} commissions</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Panel -->
    <Transition name="slide">
      <div v-if="showFilters" class="filters-panel">
        <div class="filters-grid">
          <div class="filter-group">
            <label>Status</label>
            <select v-model="filters.status">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Start Date</label>
            <input type="date" v-model="filters.startDate" />
          </div>
          
          <div class="filter-group">
            <label>End Date</label>
            <input type="date" v-model="filters.endDate" />
          </div>
          
          <div class="filter-group">
            <label>Sort By</label>
            <select v-model="filters.sortBy">
              <option value="createdAt">Created Date</option>
              <option value="dueDate">Due Date</option>
              <option value="commissionAmount">Amount</option>
              <option value="status">Status</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Order</label>
            <select v-model="filters.sortOrder">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
        
        <div class="filters-actions">
          <button class="btn-secondary" @click="clearFilters">Clear</button>
          <button class="btn-primary" @click="applyFilters">Apply Filters</button>
        </div>
      </div>
    </Transition>

    <!-- Commissions Table -->
    <div class="commissions-table-container">
      <table class="commissions-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Vendor / Shop</th>
            <th>Amount</th>
            <th>Commission</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="commission in commissionStore.commissions" :key="commission._id">
            <td>
              <div class="order-cell">
                <DocumentTextIcon class="cell-icon" />
                <span>{{ commission.order?.orderNumber || 'N/A' }}</span>
              </div>
            </td>
            <td>
              <div class="vendor-cell">
                <span class="vendor-name">{{ commission.vendor?.name || 'Unknown' }}</span>
                <span class="shop-name">
                  <BuildingStorefrontIcon class="cell-icon-small" />
                  {{ commission.shop?.shopName || 'N/A' }}
                </span>
              </div>
            </td>
            <td>{{ formatCurrency(commission.orderAmount) }}</td>
            <td class="commission-amount">{{ formatCurrency(commission.commissionAmount) }}</td>
            <td>
              <span class="status-badge" :class="getStatusColor(commission.status)">
                {{ commission.status }}
              </span>
            </td>
            <td>{{ formatDate(commission.dueDate) }}</td>
            <td>
              <div class="table-actions">
                <button class="icon-btn" @click="viewDetails(commission)" title="View Details">
                  <EyeIcon class="btn-icon" />
                </button>
                <button class="icon-btn" @click="openStatusModal(commission)" title="Update Status">
                  <PencilSquareIcon class="btn-icon" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Empty State -->
      <div v-if="commissionStore.commissions.length === 0 && !commissionStore.loading" class="empty-state">
        <BanknotesIcon class="empty-icon" />
        <h3>No Commissions Found</h3>
        <p>No commissions match your current filters.</p>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="commissionStore.pagination.pages > 1" class="pagination">
      <button 
        :disabled="commissionStore.pagination.page === 1"
        @click="fetchWithFilters(commissionStore.pagination.page - 1)"
      >
        Previous
      </button>
      <span>Page {{ commissionStore.pagination.page }} of {{ commissionStore.pagination.pages }}</span>
      <button 
        :disabled="commissionStore.pagination.page === commissionStore.pagination.pages"
        @click="fetchWithFilters(commissionStore.pagination.page + 1)"
      >
        Next
      </button>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h2>Commission Details</h2>
          <button class="close-btn" @click="showDetailModal = false">&times;</button>
        </div>
        
        <div class="modal-body" v-if="selectedCommission">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">Order Number</span>
              <span class="detail-value">{{ selectedCommission.order?.orderNumber }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Vendor</span>
              <span class="detail-value">{{ selectedCommission.vendor?.name }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Shop</span>
              <span class="detail-value">{{ selectedCommission.shop?.shopName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Order Amount</span>
              <span class="detail-value">{{ formatCurrency(selectedCommission.orderAmount) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Commission Rate</span>
              <span class="detail-value">{{ selectedCommission.commissionRate }}%</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Commission Amount</span>
              <span class="detail-value highlight">{{ formatCurrency(selectedCommission.commissionAmount) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Status</span>
              <span class="status-badge" :class="getStatusColor(selectedCommission.status)">
                {{ selectedCommission.status }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Due Date</span>
              <span class="detail-value">{{ formatDate(selectedCommission.dueDate) }}</span>
            </div>
            <div class="detail-item" v-if="selectedCommission.remittedAt">
              <span class="detail-label">Remitted At</span>
              <span class="detail-value">{{ formatDate(selectedCommission.remittedAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Reminders Sent</span>
              <span class="detail-value">{{ selectedCommission.remindersSent }}</span>
            </div>
          </div>
          
          <div v-if="selectedCommission.statusHistory?.length" class="history-section">
            <h4>Status History</h4>
            <div class="history-list">
              <div v-for="(entry, idx) in selectedCommission.statusHistory" :key="idx" class="history-item">
                <span class="history-status" :class="getStatusColor(entry.status)">{{ entry.status }}</span>
                <span class="history-date">{{ formatDate(entry.changedAt) }}</span>
                <span class="history-reason" v-if="entry.reason">{{ entry.reason }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Update Modal -->
    <div v-if="showStatusModal" class="modal-overlay" @click.self="showStatusModal = false">
      <div class="modal-content status-modal">
        <div class="modal-header">
          <h2>Update Commission Status</h2>
          <button class="close-btn" @click="showStatusModal = false">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>New Status</label>
            <select v-model="statusForm.status">
              <option value="pending">Pending</option>
              <option value="remitted">Remitted</option>
              <option value="overdue">Overdue</option>
              <option value="waived">Waived</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Notes (Optional)</label>
            <textarea 
              v-model="statusForm.notes" 
              placeholder="Add notes about this status change..."
              rows="3"
            ></textarea>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-secondary" @click="showStatusModal = false">Cancel</button>
          <button class="btn-primary" @click="updateStatus" :disabled="commissionStore.loading">
            {{ commissionStore.loading ? 'Updating...' : 'Update Status' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-commissions {
  padding: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.header-content h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.title-icon {
  width: 2rem;
  height: 2rem;
  color: var(--primary-color);
}

.header-subtitle {
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.action-btn.primary {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
}

.card-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.5rem;
}

.card-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.total-card .card-icon-wrapper { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
.pending-card .card-icon-wrapper { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.overdue-card .card-icon-wrapper { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.remitted-card .card-icon-wrapper { background: rgba(34, 197, 94, 0.1); color: #22c55e; }

.card-content {
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-amount {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Analytics Section */
.analytics-section {
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
}

.analytics-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem;
  font-size: 1rem;
  color: var(--text-primary);
}

.section-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--primary-color);
}

.top-vendors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.vendor-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
}

.vendor-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.vendor-icon {
  width: 2rem;
  height: 2rem;
  color: var(--text-tertiary);
}

.vendor-info .vendor-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
}

.vendor-info .vendor-email {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.vendor-stats {
  text-align: right;
}

.pending-amount {
  display: block;
  font-weight: 700;
  color: #ef4444;
}

.pending-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Filters Panel */
.filters-panel {
  padding: 1.25rem;
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  margin-bottom: 1.5rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.filter-group select,
.filter-group input {
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-primary);
}

.filters-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary,
.btn-primary {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-primary {
  background: var(--primary-color);
  border: 1px solid var(--primary-color);
  color: white;
}

/* Table */
.commissions-table-container {
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.commissions-table {
  width: 100%;
  border-collapse: collapse;
}

.commissions-table th,
.commissions-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.commissions-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.commissions-table tbody tr:hover {
  background: var(--bg-secondary);
}

.order-cell,
.vendor-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.order-cell {
  flex-direction: row;
  align-items: center;
}

.cell-icon {
  width: 1rem;
  height: 1rem;
  color: var(--text-tertiary);
  margin-right: 0.5rem;
}

.cell-icon-small {
  width: 0.875rem;
  height: 0.875rem;
  vertical-align: middle;
  margin-right: 0.25rem;
}

.vendor-cell .vendor-name {
  font-weight: 600;
  color: var(--text-primary);
}

.vendor-cell .shop-name {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.commission-amount {
  font-weight: 600;
  color: var(--primary-color);
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.status-overdue { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.status-remitted { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-waived { background: rgba(107, 114, 128, 0.1); color: #6b7280; }
.status-disputed { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

.table-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
}

.icon-btn .btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: var(--text-tertiary);
  margin: 0 auto 1rem;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Modals */
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
  background: var(--bg-primary);
  border-radius: 0.75rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.detail-modal {
  max-width: 600px;
}

.status-modal {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-tertiary);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
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

.detail-value.highlight {
  color: var(--primary-color);
  font-size: 1.125rem;
}

.history-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
}

.history-section h4 {
  margin: 0 0 1rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}

.history-status {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.history-date {
  color: var(--text-tertiary);
}

.history-reason {
  color: var(--text-secondary);
  font-style: italic;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
}

/* Animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 1024px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .commissions-table-container {
    overflow-x: auto;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
