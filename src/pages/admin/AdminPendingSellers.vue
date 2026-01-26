<script setup lang="ts">
/**
 * Admin Pending Sellers Commissions Page
 * Shows all vendors with pending COD commissions that need to be remitted
 */
import { ref, computed, onMounted } from 'vue'
import { useAdminCommissionStore } from '@/stores/admin/adminCommissionStore'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  BuildingStorefrontIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BellAlertIcon,
  EyeIcon
} from '@heroicons/vue/24/outline'

const commissionStore = useAdminCommissionStore()

// State
const showFilters = ref(false)
const expandedVendors = ref<Set<string>>(new Set())
const selectedVendor = ref<any>(null)
const showSendReminderModal = ref(false)

// Filters
const filters = ref({
  minPending: '',
  sortBy: 'totalPending',
  sortOrder: 'desc'
})

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0)
}

// Format date
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Get urgency level based on days overdue
const getUrgencyLevel = (dueDate: string) => {
  const now = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays > 7) return 'critical'
  if (diffDays > 3) return 'warning'
  if (diffDays > 0) return 'mild'
  return 'normal'
}

// Get urgency badge class
const getUrgencyClass = (level: string) => {
  return {
    'urgency-critical': level === 'critical',
    'urgency-warning': level === 'warning',
    'urgency-mild': level === 'mild',
    'urgency-normal': level === 'normal'
  }
}

// Toggle vendor expansion
const toggleVendor = (vendorId: string) => {
  if (expandedVendors.value.has(vendorId)) {
    expandedVendors.value.delete(vendorId)
  } else {
    expandedVendors.value.add(vendorId)
  }
}

// Open reminder modal
const openReminderModal = (vendor: any) => {
  selectedVendor.value = vendor
  showSendReminderModal.value = true
}

// Send reminder to vendor
const sendReminder = async () => {
  if (!selectedVendor.value) return
  
  // Call API to send reminder notification
  try {
    await commissionStore.sendReminderToVendor(selectedVendor.value.vendorId)
    showSendReminderModal.value = false
    selectedVendor.value = null
  } catch (error) {
    console.error('Failed to send reminder:', error)
  }
}

// Refresh data
const refresh = async () => {
  await commissionStore.fetchVendorsWithPendingCommissions()
}

// Computed - vendors with pending from analytics
const vendorsWithPending = computed(() => {
  return commissionStore.analytics?.topVendors || []
})

// Total pending across all vendors
const totalPendingAllVendors = computed(() => {
  return vendorsWithPending.value.reduce((sum: number, v: any) => sum + (v.totalPending || 0), 0)
})

// Lifecycle
onMounted(async () => {
  await commissionStore.fetchAnalytics()
  await commissionStore.fetchVendorsWithPendingCommissions()
})
</script>

<template>
  <div class="pending-sellers-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>
          <UserGroupIcon class="title-icon" />
          Sellers with Pending Commissions
        </h1>
        <p class="header-subtitle">Monitor and follow up on vendors who need to remit COD commissions</p>
      </div>
      
      <div class="header-actions">
        <button class="action-btn" @click="refresh" :disabled="commissionStore.loading">
          <ArrowPathIcon class="btn-icon" :class="{ 'animate-spin': commissionStore.loading }" />
          Refresh
        </button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="summary-stats">
      <div class="stat-card total">
        <div class="stat-icon">
          <BanknotesIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Total Pending</span>
          <span class="stat-value">{{ formatCurrency(totalPendingAllVendors) }}</span>
        </div>
      </div>
      
      <div class="stat-card vendors">
        <div class="stat-icon">
          <BuildingStorefrontIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Vendors with Pending</span>
          <span class="stat-value">{{ vendorsWithPending.length }}</span>
        </div>
      </div>
      
      <div class="stat-card overdue">
        <div class="stat-icon">
          <ExclamationTriangleIcon />
        </div>
        <div class="stat-content">
          <span class="stat-label">Overdue Commissions</span>
          <span class="stat-value">{{ commissionStore.overdueCount }}</span>
        </div>
      </div>
    </div>

    <!-- Vendors List -->
    <div class="vendors-list-container">
      <div class="list-header">
        <h2>Vendors List</h2>
        <span class="list-count">{{ vendorsWithPending.length }} vendors</span>
      </div>

      <!-- Loading State -->
      <div v-if="commissionStore.loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading vendors...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="vendorsWithPending.length === 0" class="empty-state">
        <BanknotesIcon class="empty-icon" />
        <h3>No Pending Commissions</h3>
        <p>All vendors have remitted their COD commissions. Great job!</p>
      </div>

      <!-- Vendors Cards -->
      <div v-else class="vendors-grid">
        <div 
          v-for="vendor in vendorsWithPending" 
          :key="vendor.vendorId"
          class="vendor-card"
          :class="{ 'expanded': expandedVendors.has(vendor.vendorId) }"
        >
          <!-- Vendor Header -->
          <div class="vendor-header" @click="toggleVendor(vendor.vendorId)">
            <div class="vendor-info">
              <div class="vendor-avatar">
                <BuildingStorefrontIcon />
              </div>
              <div class="vendor-details">
                <h3 class="vendor-name">{{ vendor.vendorName || 'Unknown Vendor' }}</h3>
                <span class="vendor-email">{{ vendor.vendorEmail }}</span>
              </div>
            </div>
            
            <div class="vendor-stats">
              <div class="pending-amount">
                <span class="amount-label">Pending</span>
                <span class="amount-value">{{ formatCurrency(vendor.totalPending) }}</span>
              </div>
              <div class="commission-count">
                <span class="count-badge">{{ vendor.count }} commission{{ vendor.count > 1 ? 's' : '' }}</span>
              </div>
              <component 
                :is="expandedVendors.has(vendor.vendorId) ? ChevronUpIcon : ChevronDownIcon" 
                class="expand-icon"
              />
            </div>
          </div>

          <!-- Expanded Content -->
          <Transition name="expand">
            <div v-if="expandedVendors.has(vendor.vendorId)" class="vendor-expanded">
              <!-- Actions -->
              <div class="vendor-actions">
                <button class="action-btn-sm primary" @click.stop="openReminderModal(vendor)">
                  <BellAlertIcon class="btn-icon" />
                  Send Reminder
                </button>
                <button class="action-btn-sm" @click.stop="$router.push(`/admin/cod-commissions?vendorId=${vendor.vendorId}`)">
                  <EyeIcon class="btn-icon" />
                  View Commissions
                </button>
              </div>

              <!-- Contact Info -->
              <div class="contact-info">
                <div class="contact-item" v-if="vendor.vendorEmail">
                  <EnvelopeIcon class="contact-icon" />
                  <a :href="`mailto:${vendor.vendorEmail}`">{{ vendor.vendorEmail }}</a>
                </div>
                <div class="contact-item" v-if="vendor.vendorPhone">
                  <PhoneIcon class="contact-icon" />
                  <a :href="`tel:${vendor.vendorPhone}`">{{ vendor.vendorPhone }}</a>
                </div>
              </div>

              <!-- Commission Breakdown -->
              <div class="commission-breakdown" v-if="vendor.commissions?.length">
                <h4>Pending Commissions</h4>
                <div class="commission-list">
                  <div 
                    v-for="commission in vendor.commissions" 
                    :key="commission._id"
                    class="commission-item"
                    :class="getUrgencyClass(getUrgencyLevel(commission.dueDate))"
                  >
                    <div class="commission-order">
                      <span class="order-number">Order #{{ commission.order?.orderNumber }}</span>
                      <span class="due-date">Due: {{ formatDate(commission.dueDate) }}</span>
                    </div>
                    <div class="commission-amount">
                      {{ formatCurrency(commission.commissionAmount) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Send Reminder Modal -->
    <Teleport to="body">
      <div v-if="showSendReminderModal" class="modal-overlay" @click.self="showSendReminderModal = false">
        <div class="modal-content reminder-modal">
          <div class="modal-header">
            <h2>Send Commission Reminder</h2>
            <button class="close-btn" @click="showSendReminderModal = false">&times;</button>
          </div>
          
          <div class="modal-body">
            <p>Are you sure you want to send a reminder notification to:</p>
            <div class="vendor-preview">
              <strong>{{ selectedVendor?.vendorName }}</strong>
              <span>{{ selectedVendor?.vendorEmail }}</span>
            </div>
            <p class="reminder-info">
              Pending Amount: <strong>{{ formatCurrency(selectedVendor?.totalPending || 0) }}</strong>
            </p>
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" @click="showSendReminderModal = false">Cancel</button>
            <button class="btn-primary" @click="sendReminder">
              <BellAlertIcon class="btn-icon" />
              Send Reminder
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pending-sellers-page {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
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
  font-size: 0.875rem;
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
  font-size: 0.875rem;
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.btn-icon {
  width: 1.125rem;
  height: 1.125rem;
}

/* Summary Stats */
.summary-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
}

.stat-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.stat-card.total .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.stat-card.vendors .stat-icon {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.stat-card.overdue .stat-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Vendors List */
.vendors-list-container {
  background: var(--bg-primary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.list-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.list-count {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0;
}

/* Vendors Grid */
.vendors-grid {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.vendor-card {
  background: var(--bg-secondary);
  border-radius: 0.75rem;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s;
}

.vendor-card:hover {
  border-color: var(--primary-color);
}

.vendor-card.expanded {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Vendor Header */
.vendor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: background 0.2s;
}

.vendor-header:hover {
  background: var(--bg-tertiary);
}

.vendor-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.vendor-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  background: var(--primary-color);
  color: white;
  border-radius: 0.75rem;
}

.vendor-avatar svg {
  width: 1.5rem;
  height: 1.5rem;
}

.vendor-details {
  display: flex;
  flex-direction: column;
}

.vendor-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.vendor-email {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.vendor-stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.pending-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.amount-label {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.amount-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ef4444;
}

.count-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
}

.expand-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-tertiary);
}

/* Expanded Content */
.vendor-expanded {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.vendor-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.action-btn-sm {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn-sm:hover {
  background: var(--bg-tertiary);
}

.action-btn-sm.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.action-btn-sm.primary:hover {
  opacity: 0.9;
}

.action-btn-sm .btn-icon {
  width: 1rem;
  height: 1rem;
}

.contact-info {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.contact-icon {
  width: 1rem;
  height: 1rem;
  color: var(--text-tertiary);
}

.contact-item a {
  color: var(--primary-color);
  text-decoration: none;
}

.contact-item a:hover {
  text-decoration: underline;
}

/* Commission Breakdown */
.commission-breakdown h4 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.commission-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.commission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border-left: 3px solid var(--border-color);
}

.commission-item.urgency-critical {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.commission-item.urgency-warning {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.05);
}

.commission-item.urgency-mild {
  border-left-color: #eab308;
}

.commission-order {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.order-number {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.due-date {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.commission-amount {
  font-weight: 700;
  color: var(--text-primary);
}

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
  background: var(--bg-primary);
  border-radius: 0.75rem;
  width: 100%;
  max-width: 400px;
  overflow: hidden;
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
  font-size: 1.125rem;
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

.vendor-preview {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.vendor-preview strong {
  color: var(--text-primary);
}

.vendor-preview span {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.reminder-info {
  color: var(--text-secondary);
}

.reminder-info strong {
  color: #ef4444;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-secondary,
.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

/* Expand Animation */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}

/* Animations */
.animate-spin {
  animation: spin 1s linear infinite;
}

/* Responsive */
@media (max-width: 768px) {
  .summary-stats {
    grid-template-columns: 1fr;
  }
  
  .vendor-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .vendor-stats {
    width: 100%;
    justify-content: space-between;
  }
  
  .contact-info {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
