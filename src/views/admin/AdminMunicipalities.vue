<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const searchQuery = ref('');
const showModal = ref(false);
const showDeleteModal = ref(false);
const isSubmitting = ref(false);

// Modal state
const modalMode = ref<'create' | 'edit'>('create');
const selectedMunicipality = ref<any>(null);

// Form data
const municipalityForm = ref({
  name: '',
  province: 'Oriental Mindoro',
  isActive: true,
});

// Municipalities data
const municipalities = computed(() => adminStore.municipalities);

// Filtered municipalities
const filteredMunicipalities = computed(() => {
  if (!searchQuery.value) return municipalities.value;
  const query = searchQuery.value.toLowerCase();
  return municipalities.value.filter((m: any) => 
    m.name.toLowerCase().includes(query) ||
    m.province?.toLowerCase().includes(query)
  );
});

// Stats
const stats = computed(() => ({
  total: municipalities.value.length,
  active: municipalities.value.filter((m: any) => m.isActive).length,
  inactive: municipalities.value.filter((m: any) => !m.isActive).length,
}));

// Fetch data
const fetchMunicipalities = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchMunicipalities(true);
  } catch (error) {
    console.error('Failed to fetch municipalities:', error);
  } finally {
    isLoading.value = false;
  }
};

// Open create modal
const openCreateModal = () => {
  modalMode.value = 'create';
  selectedMunicipality.value = null;
  resetForm();
  showModal.value = true;
};

// Open edit modal
const openEditModal = (municipality: any) => {
  modalMode.value = 'edit';
  selectedMunicipality.value = municipality;
  municipalityForm.value = {
    name: municipality.name,
    province: municipality.province || 'Oriental Mindoro',
    isActive: municipality.isActive !== false,
  };
  showModal.value = true;
};

// Open delete confirmation
const openDeleteModal = (municipality: any) => {
  selectedMunicipality.value = municipality;
  showDeleteModal.value = true;
};

// Reset form
const resetForm = () => {
  municipalityForm.value = {
    name: '',
    province: 'Oriental Mindoro',
    isActive: true,
  };
};

// Submit form
const submitForm = async () => {
  if (!municipalityForm.value.name.trim()) {
    alert('Municipality name is required');
    return;
  }
  
  isSubmitting.value = true;
  try {
    if (modalMode.value === 'create') {
      await adminStore.createMunicipality(municipalityForm.value);
    } else {
      await adminStore.updateMunicipality(selectedMunicipality.value._id, municipalityForm.value);
    }
    
    showModal.value = false;
    await fetchMunicipalities();
  } catch (error) {
    console.error('Failed to save municipality:', error);
    alert('Failed to save municipality. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Delete municipality
const confirmDelete = async () => {
  if (!selectedMunicipality.value) return;
  
  isSubmitting.value = true;
  try {
    await adminStore.deleteMunicipality(selectedMunicipality.value._id);
    showDeleteModal.value = false;
    await fetchMunicipalities();
  } catch (error) {
    console.error('Failed to delete municipality:', error);
    alert('Failed to delete municipality. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Toggle status
const toggleStatus = async (municipality: any) => {
  try {
    await adminStore.updateMunicipality(municipality._id, {
      isActive: !municipality.isActive
    });
    await fetchMunicipalities();
  } catch (error) {
    console.error('Failed to toggle municipality status:', error);
    alert('Failed to update municipality status.');
  }
};

// Close modals
const closeModal = () => {
  showModal.value = false;
  showDeleteModal.value = false;
  selectedMunicipality.value = null;
};

onMounted(() => {
  fetchMunicipalities();
});
</script>

<template>
  <div class="municipalities-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Municipalities</h1>
        <p class="page-subtitle">Manage available municipalities for product locations</p>
      </div>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Municipality
      </button>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <MapPinIcon class="stat-icon" />
        <div class="stat-content">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">Total</span>
        </div>
      </div>
      <div class="stat-card active">
        <CheckCircleIcon class="stat-icon" />
        <div class="stat-content">
          <span class="stat-value">{{ stats.active }}</span>
          <span class="stat-label">Active</span>
        </div>
      </div>
      <div class="stat-card inactive">
        <XCircleIcon class="stat-icon" />
        <div class="stat-content">
          <span class="stat-value">{{ stats.inactive }}</span>
          <span class="stat-label">Inactive</span>
        </div>
      </div>
    </div>

    <!-- Search -->
    <div class="search-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search municipalities..."
          class="search-input"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading municipalities...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredMunicipalities.length === 0" class="empty-state">
      <MapPinIcon class="empty-icon" />
      <h3>No Municipalities Found</h3>
      <p v-if="searchQuery">No municipalities match your search criteria</p>
      <p v-else>Start by adding your first municipality</p>
      <button v-if="!searchQuery" class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Municipality
      </button>
    </div>

    <!-- Municipalities List -->
    <div v-else class="municipalities-list">
      <div 
        v-for="municipality in filteredMunicipalities" 
        :key="municipality._id"
        class="municipality-card"
        :class="{ inactive: !municipality.isActive }"
      >
        <div class="municipality-info">
          <MapPinIcon class="municipality-icon" />
          <div class="municipality-details">
            <h3 class="municipality-name">{{ municipality.name }}</h3>
            <span class="municipality-province">{{ municipality.province }}</span>
          </div>
          <span 
            class="status-badge"
            :class="municipality.isActive ? 'active' : 'inactive'"
          >
            {{ municipality.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>
        
        <div class="municipality-actions">
          <button 
            class="action-btn toggle"
            @click="toggleStatus(municipality)"
            :title="municipality.isActive ? 'Deactivate' : 'Activate'"
          >
            <CheckCircleIcon v-if="!municipality.isActive" />
            <XCircleIcon v-else />
          </button>
          <button 
            class="action-btn edit"
            @click="openEditModal(municipality)"
            title="Edit"
          >
            <PencilSquareIcon />
          </button>
          <button 
            class="action-btn delete"
            @click="openDeleteModal(municipality)"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modalMode === 'create' ? 'Add Municipality' : 'Edit Municipality' }}</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <form @submit.prevent="submitForm" class="modal-body">
          <div class="form-group">
            <label class="form-label" for="name">Municipality Name *</label>
            <input 
              v-model="municipalityForm.name"
              type="text" 
              id="name"
              class="form-input"
              placeholder="Enter municipality name"
              required
            />
          </div>
          
          <div class="form-group">
            <label class="form-label" for="province">Province</label>
            <input 
              v-model="municipalityForm.province"
              type="text" 
              id="province"
              class="form-input"
              placeholder="Enter province"
            />
          </div>
          
          <div class="form-group">
            <label class="toggle-label">
              <input 
                type="checkbox"
                v-model="municipalityForm.isActive"
                class="toggle-input"
              />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Active</span>
            </label>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="submit-btn" :disabled="isSubmitting">
              {{ isSubmitting ? 'Saving...' : (modalMode === 'create' ? 'Create' : 'Update') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h2>Delete Municipality</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <div class="modal-body">
          <p class="delete-warning">
            Are you sure you want to delete <strong>{{ selectedMunicipality?.name }}</strong>?
          </p>
          <p class="delete-note">
            This action cannot be undone. Products using this municipality will need to be updated.
          </p>
        </div>
        
        <div class="modal-footer">
          <button class="cancel-btn" @click="closeModal">
            Cancel
          </button>
          <button class="delete-btn" @click="confirmDelete" :disabled="isSubmitting">
            {{ isSubmitting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.municipalities-page {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.page-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.9rem;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.create-btn:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
}

.stat-card .stat-icon {
  width: 2rem;
  height: 2rem;
  color: var(--text-secondary);
}

.stat-card.active .stat-icon {
  color: var(--color-success);
}

.stat-card.inactive .stat-icon {
  color: var(--color-error);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Search */
.search-section {
  margin-bottom: 1.5rem;
}

.search-box {
  position: relative;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-tertiary);
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
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
  padding: 4rem 2rem;
  background: var(--surface);
  border: 2px dashed var(--border-primary);
  border-radius: var(--radius-lg);
  text-align: center;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
}

/* Municipalities List */
.municipalities-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.municipality-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.municipality-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.municipality-card.inactive {
  opacity: 0.7;
  background: var(--bg-secondary);
}

.municipality-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
}

.municipality-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--color-primary);
}

.municipality-details {
  display: flex;
  flex-direction: column;
}

.municipality-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.municipality-province {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.status-badge.inactive {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.municipality-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn svg {
  width: 1.125rem;
  height: 1.125rem;
}

.action-btn.toggle {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.action-btn.toggle:hover {
  background: var(--color-primary);
  color: white;
}

.action-btn.edit {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.action-btn.edit:hover {
  background: #3b82f6;
  color: white;
}

.action-btn.delete {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.action-btn.delete:hover {
  background: var(--color-error);
  color: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-backdrop);
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-secondary);
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

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  color: var(--text-primary);
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
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
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--bg-tertiary);
  border-radius: 50px;
  transition: background 0.2s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-input:checked + .toggle-switch {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(20px);
}

.toggle-text {
  font-size: 0.9rem;
  color: var(--text-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
  margin-top: 1rem;
}

.cancel-btn {
  padding: 0.75rem 1.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: var(--bg-tertiary);
}

.submit-btn {
  padding: 0.75rem 1.25rem;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Delete Modal */
.delete-modal .modal-body {
  text-align: center;
}

.delete-warning {
  font-size: 1rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.delete-note {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.delete-btn {
  padding: 0.75rem 1.25rem;
  background: var(--color-error);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn:hover:not(:disabled) {
  background: #dc2626;
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 640px) {
  .municipalities-page {
    padding: 1rem;
  }
  
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .municipality-card {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .municipality-info {
    width: 100%;
  }
  
  .municipality-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
