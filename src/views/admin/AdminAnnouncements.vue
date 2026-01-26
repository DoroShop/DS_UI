<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MegaphoneIcon,
  XMarkIcon,
  CalendarIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const showAnnouncementModal = ref(false);
const showDeleteModal = ref(false);
const isSubmitting = ref(false);
const activeTab = ref<'active' | 'scheduled' | 'expired' | 'all'>('all');

// Modal state
const modalMode = ref<'create' | 'edit'>('create');
const selectedAnnouncement = ref<any>(null);

// Form data
const announcementForm = ref({
  title: '',
  content: '',
  type: 'info',
  targetAudience: 'all',
  isActive: true,
  startDate: '',
  endDate: '',
  isPinned: false,
});

// Announcements data
const announcements = computed(() => adminStore.announcements);

// Filtered announcements
const filteredAnnouncements = computed(() => {
  const now = new Date();
  
  return announcements.value.filter((ann: any) => {
    const startDate = ann.startDate ? new Date(ann.startDate) : null;
    const endDate = ann.endDate ? new Date(ann.endDate) : null;
    
    switch (activeTab.value) {
      case 'active':
        return ann.isActive && (!startDate || startDate <= now) && (!endDate || endDate >= now);
      case 'scheduled':
        return ann.isActive && startDate && startDate > now;
      case 'expired':
        return endDate && endDate < now;
      default:
        return true;
    }
  });
});

// Announcement types
const announcementTypes = [
  { value: 'info', label: 'Information', icon: InformationCircleIcon, color: '#0284c7' },
  { value: 'warning', label: 'Warning', icon: ExclamationTriangleIcon, color: '#d97706' },
  { value: 'success', label: 'Success', icon: CheckCircleIcon, color: '#16a34a' },
  { value: 'promotion', label: 'Promotion', icon: MegaphoneIcon, color: '#9333ea' },
];

// Target audiences
const targetAudiences = [
  { value: 'all', label: 'All Users' },
  { value: 'buyers', label: 'Buyers Only' },
  { value: 'sellers', label: 'Sellers Only' },
  { value: 'new_users', label: 'New Users' },
];

// Fetch data
const fetchAnnouncements = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchAnnouncements();
  } catch (error) {
    console.error('Failed to fetch announcements:', error);
  } finally {
    isLoading.value = false;
  }
};

// Open create modal
const openCreateModal = () => {
  modalMode.value = 'create';
  selectedAnnouncement.value = null;
  resetForm();
  showAnnouncementModal.value = true;
};

// Open edit modal
const openEditModal = (announcement: any) => {
  modalMode.value = 'edit';
  selectedAnnouncement.value = announcement;
  announcementForm.value = {
    title: announcement.title,
    content: announcement.content,
    type: announcement.type || 'info',
    targetAudience: announcement.targetAudience || 'all',
    isActive: announcement.isActive !== false,
    startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().split('T')[0] : '',
    endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().split('T')[0] : '',
    isPinned: announcement.isPinned || false,
  };
  showAnnouncementModal.value = true;
};

// Open delete confirmation
const openDeleteModal = (announcement: any) => {
  selectedAnnouncement.value = announcement;
  showDeleteModal.value = true;
};

// Reset form
const resetForm = () => {
  announcementForm.value = {
    title: '',
    content: '',
    type: 'info',
    targetAudience: 'all',
    isActive: true,
    startDate: '',
    endDate: '',
    isPinned: false,
  };
};

// Submit form
const submitForm = async () => {
  if (!announcementForm.value.title.trim() || !announcementForm.value.content.trim()) {
    alert('Title and content are required');
    return;
  }
  
  isSubmitting.value = true;
  try {
    const data = {
      ...announcementForm.value,
      startDate: announcementForm.value.startDate || undefined,
      endDate: announcementForm.value.endDate || undefined,
    };
    
    if (modalMode.value === 'create') {
      await adminStore.createAnnouncement(data);
    } else {
      await adminStore.updateAnnouncement(selectedAnnouncement.value._id, data);
    }
    
    showAnnouncementModal.value = false;
    await fetchAnnouncements();
  } catch (error) {
    console.error('Failed to save announcement:', error);
    alert('Failed to save announcement. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Delete announcement
const confirmDelete = async () => {
  if (!selectedAnnouncement.value) return;
  
  isSubmitting.value = true;
  try {
    await adminStore.deleteAnnouncement(selectedAnnouncement.value._id);
    showDeleteModal.value = false;
    await fetchAnnouncements();
  } catch (error) {
    console.error('Failed to delete announcement:', error);
    alert('Failed to delete announcement. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Toggle announcement status
const toggleStatus = async (announcement: any) => {
  try {
    await adminStore.updateAnnouncement(announcement._id, { isActive: !announcement.isActive });
    await fetchAnnouncements();
  } catch (error) {
    console.error('Failed to update announcement status:', error);
  }
};

// Get type info
const getTypeInfo = (type: string) => {
  return announcementTypes.find(t => t.value === type) || announcementTypes[0];
};

// Get audience label
const getAudienceLabel = (value: string) => {
  return targetAudiences.find(a => a.value === value)?.label || 'All Users';
};

// Format date
const formatDate = (date: string) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Get status
const getStatus = (announcement: any) => {
  const now = new Date();
  const startDate = announcement.startDate ? new Date(announcement.startDate) : null;
  const endDate = announcement.endDate ? new Date(announcement.endDate) : null;
  
  if (!announcement.isActive) return { label: 'Inactive', class: 'inactive' };
  if (endDate && endDate < now) return { label: 'Expired', class: 'expired' };
  if (startDate && startDate > now) return { label: 'Scheduled', class: 'scheduled' };
  return { label: 'Active', class: 'active' };
};

// Close modals
const closeModal = () => {
  showAnnouncementModal.value = false;
  showDeleteModal.value = false;
  selectedAnnouncement.value = null;
};

onMounted(() => {
  fetchAnnouncements();
});
</script>

<template>
  <div class="announcements-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Announcements</h1>
        <p class="page-subtitle">Manage platform announcements and notifications</p>
      </div>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        New Announcement
      </button>
    </div>

    <!-- Tabs -->
    <div class="tabs-section">
      <button 
        :class="['tab-btn', { active: activeTab === 'all' }]"
        @click="activeTab = 'all'"
      >
        All
        <span class="tab-count">{{ announcements.length }}</span>
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'active' }]"
        @click="activeTab = 'active'"
      >
        Active
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'scheduled' }]"
        @click="activeTab = 'scheduled'"
      >
        Scheduled
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'expired' }]"
        @click="activeTab = 'expired'"
      >
        Expired
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading announcements...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredAnnouncements.length === 0" class="empty-state">
      <MegaphoneIcon class="empty-icon" />
      <h3>No Announcements</h3>
      <p v-if="activeTab !== 'all'">No {{ activeTab }} announcements found</p>
      <p v-else>Create your first announcement to notify users</p>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        New Announcement
      </button>
    </div>

    <!-- Announcements List -->
    <div v-else class="announcements-list">
      <div 
        v-for="announcement in filteredAnnouncements" 
        :key="announcement._id"
        :class="['announcement-card', { pinned: announcement.isPinned }]"
      >
        <div 
          class="type-indicator"
          :style="{ backgroundColor: getTypeInfo(announcement.type).color }"
        ></div>
        
        <div class="announcement-content">
          <div class="announcement-header">
            <div class="header-left">
              <component 
                :is="getTypeInfo(announcement.type).icon" 
                class="type-icon"
                :style="{ color: getTypeInfo(announcement.type).color }"
              />
              <h3 class="announcement-title">
                {{ announcement.title }}
                <span v-if="announcement.isPinned" class="pinned-badge">Pinned</span>
              </h3>
            </div>
            <span :class="['status-badge', getStatus(announcement).class]">
              {{ getStatus(announcement).label }}
            </span>
          </div>
          
          <p class="announcement-text">{{ announcement.content }}</p>
          
          <div class="announcement-meta">
            <span class="meta-item">
              <UserGroupIcon class="meta-icon" />
              {{ getAudienceLabel(announcement.targetAudience) }}
            </span>
            <span v-if="announcement.startDate || announcement.endDate" class="meta-item">
              <CalendarIcon class="meta-icon" />
              <span v-if="announcement.startDate">{{ formatDate(announcement.startDate) }}</span>
              <span v-if="announcement.startDate && announcement.endDate"> - </span>
              <span v-if="announcement.endDate">{{ formatDate(announcement.endDate) }}</span>
            </span>
            <span class="meta-item type">
              {{ getTypeInfo(announcement.type).label }}
            </span>
          </div>
        </div>
        
        <div class="announcement-actions">
          <label class="toggle-label">
            <input 
              type="checkbox"
              :checked="announcement.isActive"
              @change="toggleStatus(announcement)"
              class="toggle-input"
            />
            <span class="toggle-switch small"></span>
          </label>
          <button 
            class="action-btn edit"
            @click="openEditModal(announcement)"
            title="Edit"
          >
            <PencilSquareIcon />
          </button>
          <button 
            class="action-btn delete"
            @click="openDeleteModal(announcement)"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>

    <!-- Announcement Modal -->
    <div v-if="showAnnouncementModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modalMode === 'create' ? 'Create Announcement' : 'Edit Announcement' }}</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <form @submit.prevent="submitForm" class="modal-body">
          <!-- Title -->
          <div class="form-group">
            <label class="form-label" for="title">Title *</label>
            <input 
              v-model="announcementForm.title"
              type="text" 
              id="title"
              class="form-input"
              placeholder="Enter announcement title"
              required
            />
          </div>
          
          <!-- Content -->
          <div class="form-group">
            <label class="form-label" for="content">Content *</label>
            <textarea 
              v-model="announcementForm.content"
              id="content"
              class="form-textarea"
              placeholder="Enter announcement content"
              rows="4"
              required
            ></textarea>
          </div>
          
          <!-- Type -->
          <div class="form-group">
            <label class="form-label">Type</label>
            <div class="type-options">
              <label 
                v-for="type in announcementTypes" 
                :key="type.value"
                :class="['type-option', { active: announcementForm.type === type.value }]"
              >
                <input 
                  type="radio"
                  v-model="announcementForm.type"
                  :value="type.value"
                  class="radio-input"
                />
                <component :is="type.icon" class="type-opt-icon" :style="{ color: type.color }" />
                <span>{{ type.label }}</span>
              </label>
            </div>
          </div>
          
          <!-- Target Audience -->
          <div class="form-group">
            <label class="form-label" for="audience">Target Audience</label>
            <select 
              v-model="announcementForm.targetAudience"
              id="audience"
              class="form-select"
            >
              <option v-for="audience in targetAudiences" :key="audience.value" :value="audience.value">
                {{ audience.label }}
              </option>
            </select>
          </div>
          
          <!-- Date Range -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="startDate">Start Date</label>
              <input 
                v-model="announcementForm.startDate"
                type="date" 
                id="startDate"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="endDate">End Date</label>
              <input 
                v-model="announcementForm.endDate"
                type="date" 
                id="endDate"
                class="form-input"
              />
            </div>
          </div>
          
          <!-- Options -->
          <div class="form-group options">
            <label class="toggle-label">
              <input 
                type="checkbox"
                v-model="announcementForm.isActive"
                class="toggle-input"
              />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Active</span>
            </label>
            
            <label class="toggle-label">
              <input 
                type="checkbox"
                v-model="announcementForm.isPinned"
                class="toggle-input"
              />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Pin to top</span>
            </label>
          </div>
        </form>
        
        <div class="modal-footer">
          <button 
            type="button" 
            class="cancel-btn"
            @click="closeModal"
            :disabled="isSubmitting"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="submit-btn"
            @click="submitForm"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Saving...' : (modalMode === 'create' ? 'Create Announcement' : 'Save Changes') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content delete-modal">
        <div class="delete-icon-wrapper">
          <TrashIcon />
        </div>
        <h2>Delete Announcement</h2>
        <p>
          Are you sure you want to delete "<strong>{{ selectedAnnouncement?.title }}</strong>"? 
          This action cannot be undone.
        </p>
        <div class="delete-actions">
          <button 
            class="cancel-btn"
            @click="closeModal"
            :disabled="isSubmitting"
          >
            Cancel
          </button>
          <button 
            class="delete-btn"
            @click="confirmDelete"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announcements-page {
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

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-btn:hover {
  opacity: 0.9;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Tabs */
.tabs-section {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  position: relative;
  transition: color 0.2s ease;
}

.tab-btn.active {
  color: var(--color-primary);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

.tab-count {
  background: var(--bg-secondary);
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
}

.tab-btn.active .tab-count {
  background: var(--color-primary);
  color: white;
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

/* Empty State */
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
  margin: 0 0 1.5rem;
}

/* Announcements List */
.announcements-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.announcement-card {
  display: flex;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
  transition: all 0.2s ease;
}

.announcement-card:hover {
  border-color: var(--color-primary);
}

.announcement-card.pinned {
  border-color: #d97706;
  background: linear-gradient(135deg, var(--surface) 0%, rgba(217, 119, 6, 0.05) 100%);
}

.type-indicator {
  width: 4px;
  flex-shrink: 0;
}

.announcement-content {
  flex: 1;
  padding: 1.25rem;
  min-width: 0;
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.type-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  margin-top: 2px;
}

.announcement-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pinned-badge {
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.125rem 0.375rem;
  background: #fef3c7;
  color: #d97706;
  border-radius: 999px;
  text-transform: uppercase;
}

.status-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.active { background: #dcfce7; color: #16a34a; }
.status-badge.scheduled { background: #e0f2fe; color: #0284c7; }
.status-badge.expired { background: #f3f4f6; color: #6b7280; }
.status-badge.inactive { background: #fee2e2; color: #dc2626; }

.announcement-text {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.announcement-meta {
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

.meta-item.type {
  padding: 0.125rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: 999px;
}

.meta-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.announcement-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-left: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

/* Toggle */
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  width: 2.75rem;
  height: 1.5rem;
  background: var(--border-primary);
  border-radius: 999px;
  position: relative;
  transition: background 0.2s ease;
}

.toggle-switch.small {
  width: 2.25rem;
  height: 1.25rem;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.125rem;
  height: 1.125rem;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-switch.small::after {
  width: 0.875rem;
  height: 0.875rem;
  top: 3px;
  left: 3px;
}

.toggle-input:checked + .toggle-switch {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(1.25rem);
}

.toggle-input:checked + .toggle-switch.small::after {
  transform: translateX(1rem);
}

.toggle-text {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.action-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 1rem;
  height: 1rem;
}

.action-btn.edit {
  background: #e0f2fe;
  color: #0284c7;
}

.action-btn.edit:hover {
  background: #bae6fd;
}

.action-btn.delete {
  background: #fee2e2;
  color: #dc2626;
}

.action-btn.delete:hover {
  background: #fecaca;
}

/* Modal Overlay */
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
  max-width: 550px;
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
  transition: all 0.2s ease;
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

.form-group {
  margin-bottom: 1.25rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group.options {
  display: flex;
  gap: 2rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-textarea {
  resize: vertical;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Type Options */
.type-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-option:hover {
  border-color: var(--text-tertiary);
}

.type-option.active {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.05);
}

.radio-input {
  display: none;
}

.type-opt-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.type-option span {
  font-size: 0.85rem;
  color: var(--text-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}

.cancel-btn {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn {
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Delete Modal */
.delete-modal {
  max-width: 400px;
  text-align: center;
  padding: 2rem;
}

.delete-icon-wrapper {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1rem;
  background: #fee2e2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #dc2626;
}

.delete-icon-wrapper svg {
  width: 2rem;
  height: 2rem;
}

.delete-modal h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.delete-modal p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0;
}

.delete-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.delete-actions .cancel-btn,
.delete-actions .delete-btn {
  flex: 1;
}

.delete-btn {
  padding: 0.625rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn:hover:not(:disabled) {
  background: #b91c1c;
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .create-btn {
    width: 100%;
    justify-content: center;
  }
  
  .tabs-section {
    overflow-x: auto;
  }
  
  .announcement-card {
    flex-direction: column;
  }
  
  .type-indicator {
    width: 100%;
    height: 4px;
  }
  
  .announcement-actions {
    flex-direction: row;
    justify-content: flex-end;
    border-left: none;
    border-top: 1px solid var(--border-primary);
  }
  
  .type-options {
    grid-template-columns: 1fr;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .form-group.options {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
