<script setup lang="ts">
/**
 * Vendor Commissions Page
 * Displays pending COD commissions and allows remittance via wallet
 */
import { ref, computed, onMounted } from 'vue'
import { useCommissionStore } from '@/stores/vendor/commissionStore'
import { useUserStore } from '@/stores/userStores'
import { useRouter } from 'vue-router'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  WalletIcon,
  DocumentTextIcon
} from '@heroicons/vue/24/outline'

const commissionStore = useCommissionStore()
const userStore = useUserStore()
const router = useRouter()

// State
const selectedCommissions = ref<string[]>([])
const showRemitModal = ref(false)
const remittingId = ref<string | null>(null)
const successMessage = ref('')
const showSuccessToast = ref(false)

// Computed
const walletBalance = computed(() => userStore.walletBalance || 0)

const canRemitSelected = computed(() => {
  if (selectedCommissions.value.length === 0) return false
  
  const totalAmount = commissionStore.commissions
    .filter(c => selectedCommissions.value.includes(c._id))
    .reduce((sum, c) => sum + c.commissionAmount, 0)
  
  return walletBalance.value >= totalAmount
})

const selectedTotal = computed(() => {
  return commissionStore.commissions
    .filter(c => selectedCommissions.value.includes(c._id))
    .reduce((sum, c) => sum + c.commissionAmount, 0)
})

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
    day: 'numeric'
  })
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'status-pending'
    case 'overdue': return 'status-overdue'
    case 'remitted': return 'status-remitted'
    default: return ''
  }
}

const getDaysUntilDue = (dueDate: string) => {
  const due = new Date(dueDate)
  const now = new Date()
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

const toggleSelectAll = () => {
  const pendingIds = commissionStore.pendingCommissions.map(c => c._id)
  if (selectedCommissions.value.length === pendingIds.length) {
    selectedCommissions.value = []
  } else {
    selectedCommissions.value = [...pendingIds]
  }
}

const toggleSelect = (id: string) => {
  const index = selectedCommissions.value.indexOf(id)
  if (index === -1) {
    selectedCommissions.value.push(id)
  } else {
    selectedCommissions.value.splice(index, 1)
  }
}

const remitSingle = async (commissionId: string) => {
  const commission = commissionStore.commissions.find(c => c._id === commissionId)
  if (!commission) return
  
  if (walletBalance.value < commission.commissionAmount) {
    alert(`Insufficient wallet balance. Required: ${formatCurrency(commission.commissionAmount)}, Available: ${formatCurrency(walletBalance.value)}`)
    return
  }
  
  remittingId.value = commissionId
  
  const result = await commissionStore.remitCommission(commissionId)
  
  remittingId.value = null
  
  if (result.success) {
    successMessage.value = `Commission remitted successfully! New balance: ${formatCurrency(result.newBalance)}`
    showSuccessToast.value = true
    
    // Refresh wallet balance
    await userStore.fetchUser()
    
    setTimeout(() => {
      showSuccessToast.value = false
    }, 5000)
  } else {
    alert(result.error)
  }
}

const remitSelected = async () => {
  if (!canRemitSelected.value) {
    alert('Insufficient wallet balance for selected commissions')
    return
  }
  
  const result = await commissionStore.bulkRemitCommissions(selectedCommissions.value)
  
  if (result.success) {
    const { successful, failed } = result.results
    successMessage.value = `${successful.length} commission(s) remitted successfully.${failed.length > 0 ? ` ${failed.length} failed.` : ''}`
    showSuccessToast.value = true
    selectedCommissions.value = []
    
    // Refresh wallet balance
    await userStore.fetchUser()
    
    setTimeout(() => {
      showSuccessToast.value = false
    }, 5000)
  } else {
    alert(result.error)
  }
}

const refresh = async () => {
  await Promise.all([
    commissionStore.fetchPendingCommissions(),
    commissionStore.fetchCommissionSummary()
  ])
}

// Lifecycle
onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="commissions-page">
    <!-- Success Toast -->
    <Transition name="toast">
      <div v-if="showSuccessToast" class="success-toast">
        <CheckCircleIcon class="toast-icon" />
        <span>{{ successMessage }}</span>
      </div>
    </Transition>

    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>COD Commissions</h1>
        <p class="header-subtitle">Manage your pending commissions from Cash on Delivery orders</p>
      </div>
      <button class="refresh-btn" @click="refresh" :disabled="commissionStore.loading">
        <ArrowPathIcon class="btn-icon" :class="{ 'animate-spin': commissionStore.loading }" />
        Refresh
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid" v-if="commissionStore.summary">
      <div class="summary-card wallet-card">
        <WalletIcon class="card-icon" />
        <div class="card-content">
          <span class="card-label">Wallet Balance</span>
          <span class="card-value">{{ formatCurrency(walletBalance) }}</span>
        </div>
      </div>
      
      <div class="summary-card pending-card">
        <ClockIcon class="card-icon" />
        <div class="card-content">
          <span class="card-label">Pending</span>
          <span class="card-value">{{ formatCurrency(commissionStore.summary.pending.amount) }}</span>
          <span class="card-count">{{ commissionStore.summary.pending.count }} orders</span>
        </div>
      </div>
      
      <div class="summary-card overdue-card" v-if="commissionStore.summary.overdue.count > 0">
        <ExclamationTriangleIcon class="card-icon" />
        <div class="card-content">
          <span class="card-label">Overdue</span>
          <span class="card-value">{{ formatCurrency(commissionStore.summary.overdue.amount) }}</span>
          <span class="card-count">{{ commissionStore.summary.overdue.count }} orders</span>
        </div>
      </div>
      
      <div class="summary-card remitted-card">
        <CheckCircleIcon class="card-icon" />
        <div class="card-content">
          <span class="card-label">Total Remitted</span>
          <span class="card-value">{{ formatCurrency(commissionStore.summary.remitted.amount) }}</span>
          <span class="card-count">{{ commissionStore.summary.remitted.count }} orders</span>
        </div>
      </div>
    </div>

    <!-- Warning Banner -->
    <div v-if="commissionStore.hasOverdue" class="warning-banner">
      <ExclamationTriangleIcon class="warning-icon" />
      <div class="warning-content">
        <strong>You have overdue commissions!</strong>
        <p>Please remit your pending commissions as soon as possible to avoid penalties.</p>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div class="bulk-actions" v-if="commissionStore.pendingCommissions.length > 0">
      <div class="selection-info">
        <label class="select-all-checkbox">
          <input 
            type="checkbox" 
            :checked="selectedCommissions.length === commissionStore.pendingCommissions.length"
            :indeterminate="selectedCommissions.length > 0 && selectedCommissions.length < commissionStore.pendingCommissions.length"
            @change="toggleSelectAll"
          />
          <span>Select All ({{ commissionStore.pendingCommissions.length }})</span>
        </label>
        
        <span v-if="selectedCommissions.length > 0" class="selected-count">
          {{ selectedCommissions.length }} selected - Total: {{ formatCurrency(selectedTotal) }}
        </span>
      </div>
      
      <button 
        v-if="selectedCommissions.length > 0"
        class="bulk-remit-btn"
        :disabled="!canRemitSelected || commissionStore.loading"
        @click="remitSelected"
      >
        <BanknotesIcon class="btn-icon" />
        Remit Selected ({{ formatCurrency(selectedTotal) }})
      </button>
    </div>

    <!-- Commissions List -->
    <div class="commissions-list" v-if="commissionStore.commissions.length > 0">
      <div 
        v-for="commission in commissionStore.commissions" 
        :key="commission._id"
        class="commission-card"
        :class="{ 'selected': selectedCommissions.includes(commission._id) }"
      >
        <div class="card-checkbox" v-if="commission.status !== 'remitted'">
          <input 
            type="checkbox" 
            :checked="selectedCommissions.includes(commission._id)"
            @change="toggleSelect(commission._id)"
          />
        </div>
        
        <div class="card-main">
          <div class="order-info">
            <span class="order-number">
              <DocumentTextIcon class="inline-icon" />
              Order #{{ commission.metadata?.orderNumber || commission.order?.orderNumber }}
            </span>
            <span class="status-badge" :class="getStatusColor(commission.status)">
              {{ commission.status }}
            </span>
          </div>
          
          <div class="commission-details">
            <div class="detail-item">
              <span class="detail-label">Order Amount</span>
              <span class="detail-value">{{ formatCurrency(commission.orderAmount) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Commission Rate</span>
              <span class="detail-value">{{ commission.commissionRate }}%</span>
            </div>
            <div class="detail-item highlight">
              <span class="detail-label">Commission Due</span>
              <span class="detail-value">{{ formatCurrency(commission.commissionAmount) }}</span>
            </div>
          </div>
          
          <div class="due-date-info">
            <template v-if="commission.status === 'remitted'">
              <CheckCircleIcon class="due-icon success" />
              <span>Remitted on {{ formatDate(commission.remittedAt!) }}</span>
            </template>
            <template v-else>
              <ClockIcon class="due-icon" :class="{ 'overdue': getDaysUntilDue(commission.dueDate) < 0 }" />
              <span :class="{ 'text-danger': getDaysUntilDue(commission.dueDate) < 0 }">
                {{ getDaysUntilDue(commission.dueDate) < 0 
                  ? `${Math.abs(getDaysUntilDue(commission.dueDate))} days overdue`
                  : `Due in ${getDaysUntilDue(commission.dueDate)} days`
                }}
              </span>
            </template>
          </div>
        </div>
        
        <div class="card-actions" v-if="commission.status !== 'remitted'">
          <button 
            class="remit-btn"
            :disabled="walletBalance < commission.commissionAmount || remittingId === commission._id"
            @click="remitSingle(commission._id)"
          >
            <ArrowPathIcon v-if="remittingId === commission._id" class="btn-icon animate-spin" />
            <BanknotesIcon v-else class="btn-icon" />
            {{ remittingId === commission._id ? 'Processing...' : 'Remit Now' }}
          </button>
          
          <span v-if="walletBalance < commission.commissionAmount" class="insufficient-notice">
            Insufficient balance
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!commissionStore.loading" class="empty-state">
      <CheckCircleIcon class="empty-icon" />
      <h3>No Pending Commissions</h3>
      <p>You're all caught up! All COD commissions have been remitted.</p>
    </div>

    <!-- Loading State -->
    <div v-if="commissionStore.loading" class="loading-state">
      <ArrowPathIcon class="loading-icon animate-spin" />
      <span>Loading commissions...</span>
    </div>

    <!-- Pagination -->
    <div v-if="commissionStore.pagination.pages > 1" class="pagination">
      <button 
        :disabled="commissionStore.pagination.page === 1"
        @click="commissionStore.fetchPendingCommissions(commissionStore.pagination.page - 1)"
      >
        Previous
      </button>
      <span>Page {{ commissionStore.pagination.page }} of {{ commissionStore.pagination.pages }}</span>
      <button 
        :disabled="commissionStore.pagination.page === commissionStore.pagination.pages"
        @click="commissionStore.fetchPendingCommissions(commissionStore.pagination.page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<style scoped>
.commissions-page {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.header-content h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.header-subtitle {
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.refresh-btn {
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

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.inline-icon {
  width: 1rem;
  height: 1rem;
  vertical-align: middle;
  margin-right: 0.25rem;
}

/* Summary Grid */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

.card-icon {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
}

.wallet-card .card-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.pending-card .card-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.overdue-card .card-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.remitted-card .card-icon {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.card-content {
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.card-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Warning Banner */
.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
}

.warning-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #ef4444;
  flex-shrink: 0;
}

.warning-content strong {
  color: #ef4444;
  display: block;
  margin-bottom: 0.25rem;
}

.warning-content p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}

/* Bulk Actions */
.bulk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.select-all-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.selected-count {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.bulk-remit-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.bulk-remit-btn:hover:not(:disabled) {
  background: #16a34a;
}

.bulk-remit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Commission Card */
.commissions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.commission-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  transition: all 0.2s;
}

.commission-card.selected {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.card-checkbox {
  padding-top: 0.25rem;
}

.card-checkbox input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.card-main {
  flex: 1;
}

.order-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.order-number {
  font-weight: 600;
  color: var(--text-primary);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-overdue {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-remitted {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.commission-details {
  display: flex;
  gap: 2rem;
  margin-bottom: 0.75rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.detail-value {
  font-weight: 600;
  color: var(--text-primary);
}

.detail-item.highlight .detail-value {
  color: #3b82f6;
  font-size: 1.125rem;
}

.due-date-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.due-icon {
  width: 1rem;
  height: 1rem;
}

.due-icon.overdue {
  color: #ef4444;
}

.due-icon.success {
  color: #22c55e;
}

.text-danger {
  color: #ef4444 !important;
}

/* Card Actions */
.card-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
}

.remit-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #22c55e;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.remit-btn:hover:not(:disabled) {
  background: #16a34a;
}

.remit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.insufficient-notice {
  font-size: 0.75rem;
  color: #ef4444;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 3rem;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: #22c55e;
  margin: 0 auto 1rem;
}

.empty-state h3 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-secondary);
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.loading-icon {
  width: 1.5rem;
  height: 1.5rem;
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

/* Success Toast */
.success-toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background: #22c55e;
  color: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.toast-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .commission-details {
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .bulk-actions {
    flex-direction: column;
    gap: 1rem;
  }
  
  .commission-card {
    flex-direction: column;
  }
  
  .card-actions {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
