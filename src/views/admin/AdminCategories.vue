<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  XMarkIcon,
  ChevronRightIcon,
  CubeIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const searchQuery = ref('');
const showCategoryModal = ref(false);
const showDeleteModal = ref(false);
const isSubmitting = ref(false);

// Modal state
const modalMode = ref<'create' | 'edit'>('create');
const selectedCategory = ref<any>(null);

// Form data
const categoryForm = ref({
  name: '',
  description: '',
  image: null as File | null,
  imagePreview: '',
  parentCategory: '',
  isActive: true,
});

// Categories data
const categories = computed(() => adminStore.categories);

// Filtered categories
const filteredCategories = computed(() => {
  if (!searchQuery.value) return categories.value;
  const query = searchQuery.value.toLowerCase();
  return categories.value.filter((cat: any) => 
    cat.name.toLowerCase().includes(query) ||
    cat.description?.toLowerCase().includes(query)
  );
});

// Root categories (for parent selection)
const rootCategories = computed(() => {
  return categories.value.filter((cat: any) => !cat.parentCategory);
});

// Fetch data
const fetchCategories = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchCategories();
  } catch (error) {
    console.error('Failed to fetch categories:', error);
  } finally {
    isLoading.value = false;
  }
};

// Open create modal
const openCreateModal = () => {
  modalMode.value = 'create';
  selectedCategory.value = null;
  resetForm();
  showCategoryModal.value = true;
};

// Open edit modal
const openEditModal = (category: any) => {
  modalMode.value = 'edit';
  selectedCategory.value = category;
  categoryForm.value = {
    name: category.name,
    description: category.description || '',
    image: null,
    imagePreview: category.image || '',
    parentCategory: category.parentCategory?._id || category.parentCategory || '',
    isActive: category.isActive !== false,
  };
  showCategoryModal.value = true;
};

// Open delete confirmation
const openDeleteModal = (category: any) => {
  selectedCategory.value = category;
  showDeleteModal.value = true;
};

// Reset form
const resetForm = () => {
  categoryForm.value = {
    name: '',
    description: '',
    image: null,
    imagePreview: '',
    parentCategory: '',
    isActive: true,
  };
};

// Handle image selection
const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    categoryForm.value.image = file;
    categoryForm.value.imagePreview = URL.createObjectURL(file);
  }
};

// Remove image
const removeImage = () => {
  categoryForm.value.image = null;
  categoryForm.value.imagePreview = '';
};

// Submit form
const submitForm = async () => {
  if (!categoryForm.value.name.trim()) {
    alert('Category name is required');
    return;
  }
  
  isSubmitting.value = true;
  try {
    const formData = new FormData();
    formData.append('name', categoryForm.value.name);
    formData.append('description', categoryForm.value.description || '');
    if (categoryForm.value.parentCategory) {
      formData.append('parentCategory', categoryForm.value.parentCategory);
    }
    formData.append('isActive', String(categoryForm.value.isActive));
    if (categoryForm.value.image) {
      formData.append('image', categoryForm.value.image);
    } else if (modalMode.value === 'edit' && categoryForm.value.imagePreview) {
      // For edit mode, pass existing imageUrl if no new image uploaded
      formData.append('existingImageUrl', categoryForm.value.imagePreview);
    }
    
    if (modalMode.value === 'create') {
      await adminStore.createCategory(formData);
    } else {
      await adminStore.updateCategory(selectedCategory.value._id, formData);
    }
    
    showCategoryModal.value = false;
    await fetchCategories();
  } catch (error) {
    console.error('Failed to save category:', error);
    alert('Failed to save category. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Delete category
const confirmDelete = async () => {
  if (!selectedCategory.value) return;
  
  isSubmitting.value = true;
  try {
    await adminStore.deleteCategory(selectedCategory.value._id);
    showDeleteModal.value = false;
    await fetchCategories();
  } catch (error) {
    console.error('Failed to delete category:', error);
    alert('Failed to delete category. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Get subcategories count
const getSubcategoriesCount = (categoryId: string) => {
  return categories.value.filter((cat: any) => 
    cat.parentCategory === categoryId || cat.parentCategory?._id === categoryId
  ).length;
};

// Close modals
const closeModal = () => {
  showCategoryModal.value = false;
  showDeleteModal.value = false;
  selectedCategory.value = null;
};

onMounted(() => {
  fetchCategories();
});
</script>

<template>
  <div class="categories-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Categories</h1>
        <p class="page-subtitle">Manage product categories and hierarchy</p>
      </div>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Category
      </button>
    </div>

    <!-- Search -->
    <div class="search-section">
      <div class="search-box">
        <MagnifyingGlassIcon class="search-icon" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search categories..."
          class="search-input"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading categories...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredCategories.length === 0" class="empty-state">
      <FolderIcon class="empty-icon" />
      <h3>No Categories Found</h3>
      <p v-if="searchQuery">No categories match your search criteria</p>
      <p v-else>Start by creating your first category</p>
      <button v-if="!searchQuery" class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Category
      </button>
    </div>

    <!-- Categories Grid -->
    <div v-else class="categories-grid">
      <div 
        v-for="category in filteredCategories" 
        :key="category._id"
        class="category-card"
      >
        <div class="category-image">
          <img 
            v-if="category.image" 
            :src="category.image" 
            :alt="category.name"
          />
          <div v-else class="placeholder-image">
            <FolderIcon />
          </div>
          <span 
            v-if="category.isActive !== false" 
            class="active-badge"
          >
            Active
          </span>
        </div>
        
        <div class="category-content">
          <h3 class="category-name">{{ category.name }}</h3>
          <p class="category-description">
            {{ category.description || 'No description' }}
          </p>
          
          <div class="category-stats">
            <div class="stat">
              <CubeIcon class="stat-icon" />
              <span>{{ category.productCount || 0 }} products</span>
            </div>
            <div class="stat">
              <FolderIcon class="stat-icon" />
              <span>{{ getSubcategoriesCount(category._id) }} subcategories</span>
            </div>
          </div>
          
          <div v-if="category.parentCategory" class="parent-info">
            <ChevronRightIcon class="parent-icon" />
            <span>Parent: {{ typeof category.parentCategory === 'object' ? category.parentCategory.name : 'N/A' }}</span>
          </div>
        </div>
        
        <div class="category-actions">
          <button 
            class="action-btn edit"
            @click="openEditModal(category)"
            title="Edit"
          >
            <PencilSquareIcon />
          </button>
          <button 
            class="action-btn delete"
            @click="openDeleteModal(category)"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modalMode === 'create' ? 'Create Category' : 'Edit Category' }}</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <form @submit.prevent="submitForm" class="modal-body">
          <!-- Image Upload -->
          <div class="form-group">
            <label class="form-label">Category Image</label>
            <div class="image-upload">
              <div 
                v-if="categoryForm.imagePreview" 
                class="image-preview"
              >
                <img :src="categoryForm.imagePreview" alt="Preview" />
                <button 
                  type="button" 
                  class="remove-image"
                  @click="removeImage"
                >
                  <XMarkIcon />
                </button>
              </div>
              <label v-else class="upload-box">
                <PhotoIcon class="upload-icon" />
                <span>Click to upload image</span>
                <input 
                  type="file"
                  accept="image/*"
                  @change="handleImageSelect"
                  class="file-input"
                />
              </label>
            </div>
          </div>
          
          <!-- Name -->
          <div class="form-group">
            <label class="form-label" for="name">Category Name *</label>
            <input 
              v-model="categoryForm.name"
              type="text" 
              id="name"
              class="form-input"
              placeholder="Enter category name"
              required
            />
          </div>
          
          <!-- Description -->
          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea 
              v-model="categoryForm.description"
              id="description"
              class="form-textarea"
              placeholder="Enter category description"
              rows="3"
            ></textarea>
          </div>
          
          <!-- Parent Category -->
          <div class="form-group">
            <label class="form-label" for="parent">Parent Category</label>
            <select 
              v-model="categoryForm.parentCategory"
              id="parent"
              class="form-select"
            >
              <option value="">None (Root Category)</option>
              <option 
                v-for="cat in rootCategories" 
                :key="cat._id" 
                :value="cat._id"
                :disabled="selectedCategory && cat._id === selectedCategory._id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          
          <!-- Active Status -->
          <div class="form-group">
            <label class="toggle-label">
              <input 
                type="checkbox"
                v-model="categoryForm.isActive"
                class="toggle-input"
              />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Active</span>
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
            {{ isSubmitting ? 'Saving...' : (modalMode === 'create' ? 'Create Category' : 'Save Changes') }}
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
        <h2>Delete Category</h2>
        <p>
          Are you sure you want to delete <strong>{{ selectedCategory?.name }}</strong>? 
          This action cannot be undone.
        </p>
        <p v-if="getSubcategoriesCount(selectedCategory?._id)" class="warning-text">
          Warning: This category has {{ getSubcategoriesCount(selectedCategory?._id) }} subcategories that will become orphaned.
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
            {{ isSubmitting ? 'Deleting...' : 'Delete Category' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.categories-page {
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

.search-input::placeholder {
  color: var(--text-tertiary);
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

/* Categories Grid */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.category-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow: hidden;
  transition: all 0.2s ease;
}

.category-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.category-image {
  position: relative;
  height: 150px;
  background: var(--bg-secondary);
}

.category-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.placeholder-image svg {
  width: 3rem;
  height: 3rem;
}

.active-badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.25rem 0.625rem;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.category-content {
  padding: 1rem;
}

.category-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.category-description {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.category-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.stat-icon {
  width: 1rem;
  height: 1rem;
}

.parent-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-primary);
}

.parent-icon {
  width: 1rem;
  height: 1rem;
}

.category-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-secondary);
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
  max-width: 500px;
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

/* Image Upload */
.image-upload {
  width: 100%;
}

.upload-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  border: 2px dashed var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-box:hover {
  border-color: var(--color-primary);
}

.upload-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--text-tertiary);
}

.upload-box span {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.file-input {
  display: none;
}

.image-preview {
  position: relative;
  width: 100%;
  height: 200px;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s ease;
}

.remove-image:hover {
  background: rgba(0, 0, 0, 0.8);
}

.remove-image svg {
  width: 1rem;
  height: 1rem;
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

.toggle-input:checked + .toggle-switch {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(1.25rem);
}

.toggle-text {
  font-size: 0.875rem;
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
  margin: 0 0 0.75rem;
}

.warning-text {
  color: #d97706;
  background: #fef3c7;
  padding: 0.75rem;
  border-radius: var(--radius-md);
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
  
  .categories-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-content {
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>
