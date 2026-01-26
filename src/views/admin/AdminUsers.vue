<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  UserCircleIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  FlagIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const searchQuery = ref('');
const selectedRole = ref('all');
const selectedStatus = ref('all');
const showFilters = ref(false);

// Modal states
const showRestrictModal = ref(false);
const showRoleModal = ref(false);
const showFlagModal = ref(false);
const selectedUser = ref<any>(null);
const restrictionReason = ref('');
const flagReason = ref('');
const newRole = ref('');
const actionLoading = ref(false);

// Users data
const users = computed(() => adminStore.users || []);
const pagination = computed(() => adminStore.usersPagination);

// Filter options
const roleOptions = [
  { value: 'all', label: 'All Roles' },
  { value: 'user', label: 'Users' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'admin', label: 'Admins' },
  { value: 'rider', label: 'Riders' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'flagged', label: 'Flagged' },
];

// Fetch users
const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const filters: any = {
      page: pagination.value.page,
      limit: pagination.value.limit
    };
    if (searchQuery.value) filters.search = searchQuery.value;
    if (selectedRole.value !== 'all') filters.role = selectedRole.value;
    if (selectedStatus.value === 'restricted') filters.isRestricted = true;
    if (selectedStatus.value === 'flagged') filters.isFlagged = true;
    
    await adminStore.fetchUsers(filters);
  } catch (error) {
    console.error('Failed to fetch users:', error);
  } finally {
    isLoading.value = false;
  }
};

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>;
watch(searchQuery, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    adminStore.setUsersPagination(1, pagination.value.limit);
    fetchUsers();
  }, 500);
});

watch([selectedRole, selectedStatus], () => {
  adminStore.setUsersPagination(1, pagination.value.limit);
  fetchUsers();
});

// Pagination
const handlePageChange = (page: number) => {
  adminStore.setUsersPagination(page, pagination.value.limit);
  fetchUsers();
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

// Get status badge
const getUserStatus = (user: any) => {
  if (user.isRestricted) return { label: 'Restricted', class: 'danger' };
  if (user.isFlagged) return { label: 'Flagged', class: 'warning' };
  return { label: 'Active', class: 'success' };
};

// Open restrict modal
const openRestrictModal = (user: any) => {
  selectedUser.value = user;
  restrictionReason.value = '';
  showRestrictModal.value = true;
};

// Open role modal
const openRoleModal = (user: any) => {
  selectedUser.value = user;
  newRole.value = user.role;
  showRoleModal.value = true;
};

// Open flag modal
const openFlagModal = (user: any) => {
  selectedUser.value = user;
  flagReason.value = '';
  showFlagModal.value = true;
};

// Handle restrict/unrestrict
const handleRestrict = async () => {
  if (!selectedUser.value) return;
  
  actionLoading.value = true;
  try {
    if (selectedUser.value.isRestricted) {
      await adminStore.unrestrictUser(selectedUser.value._id);
    } else {
      await adminStore.restrictUser(selectedUser.value._id, restrictionReason.value);
    }
    showRestrictModal.value = false;
    await fetchUsers();
  } catch (error) {
    console.error('Failed to update user restriction:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle role change
const handleRoleChange = async () => {
  if (!selectedUser.value || !newRole.value) return;
  
  actionLoading.value = true;
  try {
    await adminStore.assignUserRole(selectedUser.value._id, newRole.value);
    showRoleModal.value = false;
    await fetchUsers();
  } catch (error) {
    console.error('Failed to change user role:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Handle flag/unflag
const handleFlag = async () => {
  if (!selectedUser.value) return;
  
  actionLoading.value = true;
  try {
    if (selectedUser.value.isFlagged) {
      await adminStore.unflagUser(selectedUser.value._id);
    } else {
      await adminStore.flagUser(selectedUser.value._id, flagReason.value);
    }
    showFlagModal.value = false;
    await fetchUsers();
  } catch (error) {
    console.error('Failed to update user flag:', error);
  } finally {
    actionLoading.value = false;
  }
};

// Close modals
const closeModals = () => {
  showRestrictModal.value = false;
  showRoleModal.value = false;
  showFlagModal.value = false;
  selectedUser.value = null;
};

// Total pages
const totalPages = computed(() => Math.ceil(pagination.value.total / pagination.value.limit));

onMounted(async () => {
  // Ensure auth is ready
  if (!authStore.authChecked) {
    await authStore.fetchSession();
  }
  if (!authStore.isAuthenticated || !authStore.token) return;
  
  fetchUsers();
});
</script>

<template>
  <div class="users-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">User Management</h1>
        <p class="page-subtitle">Manage all users on the platform</p>
      </div>
      <div class="header-stats">
        <div class="stat-item">
          <span class="stat-value">{{ pagination.total }}</span>
          <span class="stat-label">Total Users</span>
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
          placeholder="Search by name or email..."
        />
      </div>
      
      <div class="filter-controls">
        <select v-model="selectedRole" class="filter-select">
          <option v-for="option in roleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <select v-model="selectedStatus" class="filter-select">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        
        <button class="filter-btn" @click="showFilters = !showFilters">
          <FunnelIcon class="btn-icon" />
          More Filters
        </button>
      </div>
    </div>

    <!-- Users Table -->
    <div class="table-container">
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading users...</p>
      </div>
      
      <table v-else-if="users.length > 0" class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id">
            <td>
              <div class="user-cell">
                <div class="user-avatar">
                  {{ user.name?.charAt(0).toUpperCase() || '?' }}
                </div>
                <div class="user-info">
                  <span class="user-name">{{ user.name }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </div>
            </td>
            <td>
              <span :class="`role-badge role-${user.role}`">
                {{ user.role }}
              </span>
            </td>
            <td>
              <span :class="`status-badge ${getUserStatus(user).class}`">
                {{ getUserStatus(user).label }}
              </span>
              <span v-if="user.restrictionReason" class="reason-tooltip" :title="user.restrictionReason">
                <ExclamationTriangleIcon class="reason-icon" />
              </span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <!-- Restrict/Unrestrict Button -->
                <button 
                  class="action-btn"
                  :class="user.isRestricted ? 'btn-unrestrict' : 'btn-restrict'"
                  @click="openRestrictModal(user)"
                  :title="user.isRestricted ? 'Unrestrict User' : 'Restrict User'"
                >
                  <CheckCircleIcon v-if="user.isRestricted" class="action-icon" />
                  <NoSymbolIcon v-else class="action-icon" />
                  <span class="btn-label">{{ user.isRestricted ? 'Unrestrict' : 'Restrict' }}</span>
                </button>
                <!-- Role Change Button -->
                <button 
                  class="action-btn btn-role"
                  @click="openRoleModal(user)"
                  title="Change Role"
                >
                  <ShieldCheckIcon class="action-icon" />
                  <span class="btn-label">Role</span>
                </button>
                <!-- Flag/Unflag Button -->
                <button 
                  class="action-btn"
                  :class="user.isFlagged ? 'btn-unflag' : 'btn-flag'"
                  @click="openFlagModal(user)"
                  :title="user.isFlagged ? 'Unflag User' : 'Flag User'"
                >
                  <CheckCircleIcon v-if="user.isFlagged" class="action-icon" />
                  <FlagIcon v-else class="action-icon" />
                  <span class="btn-label">{{ user.isFlagged ? 'Unflag' : 'Flag' }}</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-else class="empty-state">
        <UserCircleIcon class="empty-icon" />
        <h3>No users found</h3>
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
      
      <div class="page-numbers">
        <button 
          v-for="page in totalPages"
          :key="page"
          class="page-num"
          :class="{ 'active': page === pagination.page }"
          @click="handlePageChange(page)"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        class="page-btn"
        :disabled="pagination.page === totalPages"
        @click="handlePageChange(pagination.page + 1)"
      >
        Next
      </button>
    </div>

    <!-- Restrict Modal -->
    <div v-if="showRestrictModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ selectedUser?.isRestricted ? 'Unrestrict' : 'Restrict' }} User</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="user-preview">
            <div class="preview-avatar">
              {{ selectedUser?.name?.charAt(0).toUpperCase() }}
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ selectedUser?.name }}</span>
              <span class="preview-email">{{ selectedUser?.email }}</span>
            </div>
          </div>
          
          <template v-if="!selectedUser?.isRestricted">
            <p class="modal-text">
              Restricted users cannot make purchases, create listings, or access certain platform features.
            </p>
            <div class="form-group">
              <label>Reason for restriction</label>
              <textarea 
                v-model="restrictionReason"
                placeholder="Enter reason for restricting this user..."
                rows="3"
              ></textarea>
            </div>
          </template>
          <template v-else>
            <p class="modal-text">
              This will remove all restrictions from the user's account and restore full access.
            </p>
            <div v-if="selectedUser?.restrictionReason" class="restriction-reason">
              <strong>Current restriction reason:</strong>
              <p>{{ selectedUser.restrictionReason }}</p>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModals">Cancel</button>
          <button 
            class="btn"
            :class="selectedUser?.isRestricted ? 'btn-success' : 'btn-danger'"
            :disabled="actionLoading"
            @click="handleRestrict"
          >
            {{ actionLoading ? 'Processing...' : (selectedUser?.isRestricted ? 'Unrestrict User' : 'Restrict User') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Role Modal -->
    <div v-if="showRoleModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>Change User Role</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="user-preview">
            <div class="preview-avatar">
              {{ selectedUser?.name?.charAt(0).toUpperCase() }}
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ selectedUser?.name }}</span>
              <span class="preview-email">{{ selectedUser?.email }}</span>
            </div>
          </div>
          
          <p class="modal-text">
            Changing a user's role will affect their permissions and access across the platform.
          </p>
          
          <div class="form-group">
            <label>Select new role</label>
            <select v-model="newRole" class="form-select">
              <option value="user">User</option>
              <option value="vendor">Vendor</option>
              <option value="rider">Rider</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModals">Cancel</button>
          <button 
            class="btn btn-primary"
            :disabled="actionLoading || newRole === selectedUser?.role"
            @click="handleRoleChange"
          >
            {{ actionLoading ? 'Processing...' : 'Update Role' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Flag Modal -->
    <div v-if="showFlagModal" class="modal-overlay" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ selectedUser?.isFlagged ? 'Unflag' : 'Flag' }} User</h3>
          <button class="close-btn" @click="closeModals">
            <XMarkIcon class="close-icon" />
          </button>
        </div>
        <div class="modal-body">
          <div class="user-preview">
            <div class="preview-avatar">
              {{ selectedUser?.name?.charAt(0).toUpperCase() }}
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ selectedUser?.name }}</span>
              <span class="preview-email">{{ selectedUser?.email }}</span>
            </div>
          </div>
          
          <template v-if="!selectedUser?.isFlagged">
            <p class="modal-text">
              Flagged accounts are marked for review and monitoring. This does not restrict the user's access.
            </p>
            <div class="form-group">
              <label>Reason for flagging</label>
              <textarea 
                v-model="flagReason"
                placeholder="Enter reason for flagging this user..."
                rows="3"
              ></textarea>
            </div>
          </template>
          <template v-else>
            <p class="modal-text">
              This will remove the flag from the user's account.
            </p>
            <div v-if="selectedUser?.flagReason" class="flag-reason">
              <strong>Current flag reason:</strong>
              <p>{{ selectedUser.flagReason }}</p>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModals">Cancel</button>
          <button 
            class="btn"
            :class="selectedUser?.isFlagged ? 'btn-success' : 'btn-warning'"
            :disabled="actionLoading"
            @click="handleFlag"
          >
            {{ actionLoading ? 'Processing...' : (selectedUser?.isFlagged ? 'Remove Flag' : 'Flag User') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-page {
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

.header-stats {
  display: flex;
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.stat-value {
  font-size: 1.5rem;
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

.filter-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: var(--bg-secondary);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
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
  padding: 1rem 1.5rem;
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
}

.data-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.85rem;
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

/* User Cell */
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 500;
  color: var(--text-primary);
}

.user-email {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Badges */
.role-badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.role-user { background: #e0f2fe; color: #0284c7; }
.role-vendor { background: #f3e8ff; color: #9333ea; }
.role-admin { background: #fee2e2; color: #dc2626; }
.role-rider { background: #dcfce7; color: #16a34a; }

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }
.status-badge.warning { background: #fef3c7; color: #d97706; }

.reason-tooltip {
  margin-left: 0.5rem;
  cursor: help;
}

.reason-icon {
  width: 1rem;
  height: 1rem;
  color: #d97706;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn .btn-label {
  display: none;
}

/* Restrict Button (Orange) */
.action-btn.btn-restrict {
  background: rgba(249, 115, 22, 0.05);
  border-color: rgba(249, 115, 22, 0.3);
  color: #f97316;
}

.action-btn.btn-restrict:hover {
  background: rgba(249, 115, 22, 0.15);
  border-color: #f97316;
}

/* Unrestrict Button (Blue) */
.action-btn.btn-unrestrict {
  background: rgba(59, 130, 246, 0.05);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.action-btn.btn-unrestrict:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
}

/* Role Button (Purple) */
.action-btn.btn-role {
  background: rgba(147, 51, 234, 0.05);
  border-color: rgba(147, 51, 234, 0.3);
  color: #9333ea;
}

.action-btn.btn-role:hover {
  background: rgba(147, 51, 234, 0.15);
  border-color: #9333ea;
}

/* Flag Button (Yellow/Amber) */
.action-btn.btn-flag {
  background: rgba(245, 158, 11, 0.05);
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.action-btn.btn-flag:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
}

/* Unflag Button (Green) */
.action-btn.btn-unflag {
  background: rgba(16, 185, 129, 0.05);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.action-btn.btn-unflag:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
}

.action-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

/* Show labels on larger screens */
@media (min-width: 1200px) {
  .action-btn .btn-label {
    display: inline;
  }
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
  transition: all 0.2s ease;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--bg-secondary);
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-num {
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-num:hover {
  background: var(--bg-secondary);
}

.page-num.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
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
  max-width: 480px;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
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

.user-preview {
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
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
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

.preview-email {
  font-size: 0.875rem;
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

.form-group textarea,
.form-select {
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

.form-group textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.restriction-reason,
.flag-reason {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
}

.restriction-reason strong,
.flag-reason strong {
  color: var(--text-primary);
}

.restriction-reason p,
.flag-reason p {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.btn {
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

.btn-secondary:hover:not(:disabled) {
  background: var(--border-primary);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-success {
  background: #16a34a;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #15803d;
}

.btn-warning {
  background: #d97706;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #b45309;
}

/* Responsive */
@media (max-width: 1024px) {
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
  
  .filter-controls {
    flex-wrap: wrap;
  }
}

@media (max-width: 768px) {
  .table-container {
    overflow-x: auto;
  }
  
  .data-table {
    min-width: 700px;
  }
  
  .header-stats {
    display: none;
  }
}
</style>
