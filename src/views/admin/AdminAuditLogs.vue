<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  UserIcon,
  CalendarIcon,
  ComputerDesktopIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const searchQuery = ref('');
const actionFilter = ref<string>('all');
const dateRange = ref({
  start: '',
  end: '',
});
const showDetailModal = ref(false);
const selectedLog = ref<any>(null);

// Audit logs data
const auditLogs = computed(() => adminStore.auditLogs);

// Filtered logs
const filteredLogs = computed(() => {
  let result = auditLogs.value;
  
  if (actionFilter.value !== 'all') {
    result = result.filter((log: any) => log.action === actionFilter.value);
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((log: any) => 
      log.action?.toLowerCase().includes(query) ||
      log.admin?.name?.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query) ||
      log.targetId?.toLowerCase().includes(query)
    );
  }
  
  if (dateRange.value.start) {
    const startDate = new Date(dateRange.value.start);
    result = result.filter((log: any) => new Date(log.createdAt) >= startDate);
  }
  
  if (dateRange.value.end) {
    const endDate = new Date(dateRange.value.end);
    endDate.setHours(23, 59, 59);
    result = result.filter((log: any) => new Date(log.createdAt) <= endDate);
  }
  
  return result;
});

// Available actions (extracted from logs)
const availableActions = computed(() => {
  const actions = new Set(auditLogs.value.map((log: any) => log.action).filter(Boolean));
  return Array.from(actions).sort();
});

// Action categories
const actionCategories: Record<string, { label: string; color: string; icon: any }> = {
  login: { label: 'Login', color: '#0284c7', icon: ShieldCheckIcon },
  logout: { label: 'Logout', color: '#6b7280', icon: ShieldCheckIcon },
  user_create: { label: 'User Created', color: '#16a34a', icon: UserIcon },
  user_update: { label: 'User Updated', color: '#d97706', icon: UserIcon },
  user_delete: { label: 'User Deleted', color: '#dc2626', icon: UserIcon },
  user_restrict: { label: 'User Restricted', color: '#dc2626', icon: ExclamationTriangleIcon },
  user_unrestrict: { label: 'User Unrestricted', color: '#16a34a', icon: UserIcon },
  product_approve: { label: 'Product Approved', color: '#16a34a', icon: InformationCircleIcon },
  product_reject: { label: 'Product Rejected', color: '#dc2626', icon: ExclamationTriangleIcon },
  seller_approve: { label: 'Seller Approved', color: '#16a34a', icon: InformationCircleIcon },
  seller_reject: { label: 'Seller Rejected', color: '#dc2626', icon: ExclamationTriangleIcon },
  refund_approve: { label: 'Refund Approved', color: '#16a34a', icon: InformationCircleIcon },
  refund_reject: { label: 'Refund Rejected', color: '#dc2626', icon: ExclamationTriangleIcon },
  settings_update: { label: 'Settings Updated', color: '#9333ea', icon: ComputerDesktopIcon },
  default: { label: 'Action', color: '#6b7280', icon: DocumentTextIcon },
};

// Fetch data
const fetchAuditLogs = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchAuditLogs({
      action: actionFilter.value === 'all' ? undefined : actionFilter.value,
      startDate: dateRange.value.start || undefined,
      endDate: dateRange.value.end || undefined,
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
  } finally {
    isLoading.value = false;
  }
};

// Get action info
const getActionInfo = (action: string) => {
  return actionCategories[action] || actionCategories.default;
};

// Open detail modal
const openDetailModal = (log: any) => {
  selectedLog.value = log;
  showDetailModal.value = true;
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
    second: '2-digit',
  });
};

// Format relative time
const formatRelativeTime = (date: string) => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(date);
};

// Reset filters
const resetFilters = () => {
  searchQuery.value = '';
  actionFilter.value = 'all';
  dateRange.value = { start: '', end: '' };
  fetchAuditLogs();
};

// Close modal
const closeModal = () => {
  showDetailModal.value = false;
  selectedLog.value = null;
};

watch([actionFilter, dateRange], () => {
  fetchAuditLogs();
}, { deep: true });

onMounted(() => {
  fetchAuditLogs();
});
</script>

<template>
  <div class="audit-logs-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Audit Logs</h1>
        <p class="page-subtitle">Track all administrative actions on the platform</p>
      </div>
      <button class="refresh-btn" @click="fetchAuditLogs">
        <ArrowPathIcon class="btn-icon" />
        Refresh
      </button>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search logs..."
          class="search-input"
        />
      </div>
      
      <div class="filter-group">
        <FunnelIcon class="filter-icon" />
        <select v-model="actionFilter" class="filter-select">
          <option value="all">All Actions</option>
          <option v-for="action in availableActions" :key="action" :value="action">
            {{ getActionInfo(action).label }}
          </option>
        </select>
      </div>
      
      <div class="date-filters">
        <div class="date-group">
          <CalendarIcon class="filter-icon" />
          <input 
            v-model="dateRange.start"
            type="date" 
            class="date-input"
            placeholder="Start Date"
          />
        </div>
        <span class="date-separator">to</span>
        <input 
          v-model="dateRange.end"
          type="date" 
          class="date-input"
        />
      </div>
      
      <button 
        v-if="searchQuery || actionFilter !== 'all' || dateRange.start || dateRange.end"
        class="reset-btn"
        @click="resetFilters"
      >
        <XMarkIcon class="btn-icon" />
        Reset
      </button>
    </div>

    <!-- Stats -->
    <div class="logs-stats">
      <span class="stat-text">
        Showing <strong>{{ filteredLogs.length }}</strong> of <strong>{{ auditLogs.length }}</strong> logs
      </span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading audit logs...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredLogs.length === 0" class="empty-state">
      <DocumentTextIcon class="empty-icon" />
      <h3>No Audit Logs</h3>
      <p v-if="searchQuery || actionFilter !== 'all' || dateRange.start || dateRange.end">
        No logs match your filter criteria
      </p>
      <p v-else>No administrative actions have been recorded yet</p>
    </div>

    <!-- Logs Timeline -->
    <div v-else class="logs-timeline">
      <div 
        v-for="log in filteredLogs" 
        :key="log._id"
        class="log-item"
        @click="openDetailModal(log)"
      >
        <div 
          class="log-icon"
          :style="{ backgroundColor: getActionInfo(log.action).color + '20', color: getActionInfo(log.action).color }"
        >
          <component :is="getActionInfo(log.action).icon" />
        </div>
        
        <div class="log-content">
          <div class="log-header">
            <span 
              class="action-badge"
              :style="{ backgroundColor: getActionInfo(log.action).color + '20', color: getActionInfo(log.action).color }"
            >
              {{ getActionInfo(log.action).label }}
            </span>
            <span class="log-time">{{ formatRelativeTime(log.createdAt) }}</span>
          </div>
          
          <p class="log-details">{{ log.details || 'No details provided' }}</p>
          
          <div class="log-meta">
            <span class="meta-item">
              <UserIcon class="meta-icon" />
              {{ log.admin?.name || log.adminName || 'System' }}
            </span>
            <span v-if="log.targetId" class="meta-item">
              <DocumentTextIcon class="meta-icon" />
              Target: {{ log.targetId.slice(-8) }}
            </span>
            <span v-if="log.ipAddress" class="meta-item">
              <ComputerDesktopIcon class="meta-icon" />
              {{ log.ipAddress }}
            </span>
          </div>
        </div>
        
        <div class="log-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Audit Log Details</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <div class="modal-body">
          <!-- Action Badge -->
          <div class="detail-action">
            <span 
              class="action-badge large"
              :style="{ backgroundColor: getActionInfo(selectedLog?.action).color + '20', color: getActionInfo(selectedLog?.action).color }"
            >
              <component :is="getActionInfo(selectedLog?.action).icon" class="badge-icon" />
              {{ getActionInfo(selectedLog?.action).label }}
            </span>
          </div>
          
          <!-- Details Grid -->
          <div class="details-grid">
            <div class="detail-item">
              <span class="detail-label">Log ID</span>
              <span class="detail-value code">{{ selectedLog?._id }}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Timestamp</span>
              <span class="detail-value">{{ formatDate(selectedLog?.createdAt) }}</span>
            </div>
            
            <div class="detail-item">
              <span class="detail-label">Admin</span>
              <span class="detail-value">{{ selectedLog?.admin?.name || selectedLog?.adminName || 'System' }}</span>
            </div>
            
            <div v-if="selectedLog?.admin?.email" class="detail-item">
              <span class="detail-label">Admin Email</span>
              <span class="detail-value">{{ selectedLog?.admin?.email }}</span>
            </div>
            
            <div v-if="selectedLog?.targetId" class="detail-item">
              <span class="detail-label">Target ID</span>
              <span class="detail-value code">{{ selectedLog?.targetId }}</span>
            </div>
            
            <div v-if="selectedLog?.targetType" class="detail-item">
              <span class="detail-label">Target Type</span>
              <span class="detail-value">{{ selectedLog?.targetType }}</span>
            </div>
            
            <div v-if="selectedLog?.ipAddress" class="detail-item">
              <span class="detail-label">IP Address</span>
              <span class="detail-value code">{{ selectedLog?.ipAddress }}</span>
            </div>
            
            <div v-if="selectedLog?.userAgent" class="detail-item full-width">
              <span class="detail-label">User Agent</span>
              <span class="detail-value small">{{ selectedLog?.userAgent }}</span>
            </div>
          </div>
          
          <!-- Description -->
          <div class="detail-section">
            <h3>Description</h3>
            <p class="description-content">{{ selectedLog?.details || 'No description provided' }}</p>
          </div>
          
          <!-- Metadata -->
          <div v-if="selectedLog?.metadata" class="detail-section">
            <h3>Additional Data</h3>
            <pre class="metadata-content">{{ JSON.stringify(selectedLog?.metadata, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audit-logs-page {
  max-width: 1200px;
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

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: var(--bg-secondary);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Filters */
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 300px;
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

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-tertiary);
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

.date-filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.date-separator {
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.reset-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: #fee2e2;
  border: none;
  border-radius: var(--radius-md);
  color: #dc2626;
  font-size: 0.875rem;
  cursor: pointer;
}

.reset-btn:hover {
  background: #fecaca;
}

/* Stats */
.logs-stats {
  margin-bottom: 1rem;
}

.stat-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-text strong {
  color: var(--text-primary);
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

/* Logs Timeline */
.logs-timeline {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
}

.log-item {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item:hover {
  background: var(--bg-secondary);
}

.log-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.action-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.action-badge.large {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.badge-icon {
  width: 1rem;
  height: 1rem;
}

.log-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.log-details {
  font-size: 0.9rem;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
  line-height: 1.4;
}

.log-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.meta-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.log-arrow {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
}

.log-arrow svg {
  width: 1rem;
  height: 1rem;
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
  background: var(--surface);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
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

.detail-action {
  text-align: center;
  margin-bottom: 1.5rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-item.full-width {
  grid-column: span 2;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  word-break: break-all;
}

.detail-value.code {
  font-family: monospace;
  background: var(--bg-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
}

.detail-value.small {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h3 {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin: 0 0 0.75rem;
}

.description-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.5;
}

.metadata-content {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: 1rem;
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-primary);
  font-family: monospace;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .refresh-btn {
    width: 100%;
    justify-content: center;
  }
  
  .filters-section {
    flex-direction: column;
  }
  
  .search-box {
    max-width: none;
  }
  
  .date-filters {
    flex-wrap: wrap;
  }
  
  .log-item {
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .log-arrow {
    display: none;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-item.full-width {
    grid-column: span 1;
  }
}
</style>
