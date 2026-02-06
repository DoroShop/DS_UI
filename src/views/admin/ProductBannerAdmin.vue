<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { getAuthHeaders } from "../../types/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const banners = ref([]);
const loading = ref(false);
const error = ref(null);

const searchQuery = ref("");
const selectedPlacement = ref("product_page");

const showUploadModal = ref(false);
const showEditModal = ref(false);
const editingBanner = ref(null);

const uploadFiles = ref([]);
const uploadFormData = ref({
  placement: "product_page",
  title: "",
  altText: "",
  linkUrl: "",
  isActive: true
});

const busy = ref(false);

const placements = [
  { value: "product_page", label: "Product Page" },
  { value: "home_hero", label: "Home Hero" },
  { value: "category_top", label: "Category Top" }
];

const filteredBanners = computed(() => {
  if (!searchQuery.value) return banners.value;
  const query = searchQuery.value.toLowerCase();
  return banners.value.filter(banner => 
    banner.title?.toLowerCase().includes(query) ||
    banner.altText?.toLowerCase().includes(query) ||
    banner.placement?.toLowerCase().includes(query)
  );
});

const fetchBanners = async () => {
  loading.value = true;
  error.value = null;
  try {
    const params = selectedPlacement.value ? { placement: selectedPlacement.value } : {};
    const { data } = await axios.get(`${API_BASE_URL}/admin/product-banners`, {
      headers: getAuthHeaders(),
      params
    });
    banners.value = data.data?.banners || [];
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
};

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files);
  uploadFiles.value = files;
};

const uploadBanners = async () => {
  if (!uploadFiles.value.length) {
    alert('Please select at least one image');
    return;
  }

  if (!uploadFormData.value.altText) {
    alert('Alt text is required for accessibility');
    return;
  }

  busy.value = true;
  try {
    // Upload each file separately
    for (const file of uploadFiles.value) {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('placement', uploadFormData.value.placement);
      formData.append('title', uploadFormData.value.title);
      formData.append('altText', uploadFormData.value.altText);
      formData.append('linkUrl', uploadFormData.value.linkUrl);
      formData.append('isActive', uploadFormData.value.isActive);

      await axios.post(`${API_BASE_URL}/admin/product-banners`, formData, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      });
    }

    await fetchBanners();
    closeUploadModal();
    alert('Banners uploaded successfully!');
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    busy.value = false;
  }
};

const openEditModal = (banner) => {
  editingBanner.value = { ...banner };
  showEditModal.value = true;
};

const updateBanner = async () => {
  if (!editingBanner.value?.altText) {
    alert('Alt text is required');
    return;
  }

  busy.value = true;
  try {
    const { _id, ...updateData } = editingBanner.value;
    await axios.put(`${API_BASE_URL}/admin/product-banners/${_id}`, updateData, {
      headers: getAuthHeaders()
    });

    await fetchBanners();
    closeEditModal();
    alert('Banner updated successfully!');
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    busy.value = false;
  }
};

const toggleBannerStatus = async (bannerId) => {
  busy.value = true;
  try {
    await axios.patch(`${API_BASE_URL}/admin/product-banners/${bannerId}/toggle`, {}, {
      headers: getAuthHeaders()
    });
    await fetchBanners();
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    busy.value = false;
  }
};

const moveBanner = async (bannerId, direction) => {
  const currentBanner = banners.value.find(b => b._id === bannerId);
  const currentIndex = banners.value.indexOf(currentBanner);
  
  let targetIndex;
  if (direction === 'up') {
    targetIndex = Math.max(0, currentIndex - 1);
  } else {
    targetIndex = Math.min(banners.value.length - 1, currentIndex + 1);
  }

  if (targetIndex === currentIndex) return;

  // Swap sort orders
  const targetBanner = banners.value[targetIndex];
  const reorderData = [
    { id: currentBanner._id, sortOrder: targetBanner.sortOrder },
    { id: targetBanner._id, sortOrder: currentBanner.sortOrder }
  ];

  busy.value = true;
  try {
    await axios.patch(`${API_BASE_URL}/admin/product-banners/reorder`, {
      banners: reorderData
    }, {
      headers: getAuthHeaders()
    });
    await fetchBanners();
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    busy.value = false;
  }
};

const deleteBanner = async (bannerId, bannerTitle) => {
  if (!confirm(`Are you sure you want to delete "${bannerTitle || 'this banner'}"? This action cannot be undone.`)) {
    return;
  }

  busy.value = true;
  try {
    await axios.delete(`${API_BASE_URL}/admin/product-banners/${bannerId}`, {
      headers: getAuthHeaders()
    });
    await fetchBanners();
    alert('Banner deleted successfully!');
  } catch (err) {
    error.value = err.response?.data?.error || err.message;
    alert('Failed to delete banner: ' + (err.response?.data?.error || err.message));
  } finally {
    busy.value = false;
  }
};

const closeUploadModal = () => {
  showUploadModal.value = false;
  uploadFiles.value = [];
  uploadFormData.value = {
    placement: "product_page",
    title: "",
    altText: "",
    linkUrl: "",
    isActive: true
  };
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingBanner.value = null;
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
};

onMounted(() => {
  fetchBanners();
});
</script>

<template>
  <div class="product-banner-admin">
    <div class="admin-header">
      <div class="header-content">
        <div class="kicker">Admin</div>
        <h1>Product Page Banner Slider</h1>
        <p>Manage banner slider content for the product page (16:9 image banners)</p>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls-section">
      <div class="controls-left">
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="Search banners..."
          class="search-input"
        />
        <select v-model="selectedPlacement" @change="fetchBanners" class="placement-select">
          <option value="">All Placements</option>
          <option v-for="placement in placements" :key="placement.value" :value="placement.value">
            {{ placement.label }}
          </option>
        </select>
      </div>
      <div class="controls-right">
        <button @click="showUploadModal = true" class="btn-primary">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Upload Banners
        </button>
        <button @click="fetchBanners" class="btn-secondary" :disabled="loading">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      Error: {{ error }}
    </div>

    <!-- Banners Table -->
    <div class="table-container">
      <table v-if="!loading && filteredBanners.length" class="banners-table">
        <thead>
          <tr>
            <th>Preview</th>
            <th>Title/Alt Text</th>
            <th>Placement</th>
            <th>Status</th>
            <th>Order</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="banner in filteredBanners" :key="banner._id" :class="{ inactive: !banner.isActive }">
            <td class="preview-cell">
              <div class="banner-preview">
                <img 
                  :src="banner.responsiveSizes?.small || banner.imageUrl" 
                  :alt="banner.altText"
                  class="preview-image"
                />
              </div>
            </td>
            <td class="info-cell">
              <div class="banner-title">{{ banner.title || 'No title' }}</div>
              <div class="banner-alt">{{ banner.altText }}</div>
              <div v-if="banner.linkUrl" class="banner-link">🔗 {{ banner.linkUrl }}</div>
            </td>
            <td>
              <span class="placement-badge">{{ banner.placement }}</span>
            </td>
            <td>
              <button 
                @click="toggleBannerStatus(banner._id)"
                :class="['status-btn', banner.isActive ? 'active' : 'inactive']"
                :disabled="busy"
              >
                {{ banner.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td class="order-cell">
              <div class="order-controls">
                <button 
                  @click="moveBanner(banner._id, 'up')"
                  class="order-btn"
                  :disabled="busy"
                  title="Move Up"
                >
                  ↑
                </button>
                <span class="order-number">{{ banner.sortOrder }}</span>
                <button 
                  @click="moveBanner(banner._id, 'down')"
                  class="order-btn"
                  :disabled="busy"
                  title="Move Down"
                >
                  ↓
                </button>
              </div>
            </td>
            <td>{{ formatDate(banner.createdAt) }}</td>
            <td class="actions-cell">
              <button @click="openEditModal(banner)" class="btn-edit" :disabled="busy">
                Edit
              </button>
              <button @click="deleteBanner(banner._id, banner.title)" class="btn-delete" :disabled="busy">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading banners...</p>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !filteredBanners.length" class="empty-state">
        <p>No banners found for the selected criteria.</p>
        <button @click="showUploadModal = true" class="btn-primary">
          Upload Your First Banner
        </button>
      </div>
    </div>

    <!-- Upload Modal -->
    <div v-if="showUploadModal" class="modal-overlay" @click.self="closeUploadModal">
      <div class="modal">
        <div class="modal-header">
          <h3>Upload Banner(s)</h3>
          <button @click="closeUploadModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Images (16:9 aspect ratio recommended)</label>
            <input 
              type="file"
              @change="handleFileSelect"
              accept="image/*"
              multiple
              class="file-input"
            />
            <p class="file-hint">Select one or more images. Max 5MB each. Will be converted to WebP format and cropped to 16:9.</p>
          </div>

          <div class="form-group">
            <label>Placement</label>
            <select v-model="uploadFormData.placement" class="form-select">
              <option v-for="placement in placements" :key="placement.value" :value="placement.value">
                {{ placement.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Title (optional)</label>
            <input 
              v-model="uploadFormData.title"
              type="text" 
              class="form-input"
              placeholder="Optional title for internal reference"
            />
          </div>

          <div class="form-group">
            <label>Alt Text (required) *</label>
            <input 
              v-model="uploadFormData.altText"
              type="text" 
              class="form-input"
              placeholder="Describe the image for accessibility"
              required
            />
          </div>

          <div class="form-group">
            <label>Link URL (optional)</label>
            <input 
              v-model="uploadFormData.linkUrl"
              type="url" 
              class="form-input"
              placeholder="https://example.com (optional)"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input 
                v-model="uploadFormData.isActive"
                type="checkbox"
                class="form-checkbox"
              />
              Active (show on website)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeUploadModal" class="btn-secondary" :disabled="busy">
            Cancel
          </button>
          <button @click="uploadBanners" class="btn-primary" :disabled="busy || !uploadFiles.length">
            {{ busy ? 'Uploading...' : `Upload ${uploadFiles.length} Banner(s)` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEditModal && editingBanner" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Banner</h3>
          <button @click="closeEditModal" class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Preview</label>
            <div class="edit-preview">
              <img 
                :src="editingBanner.responsiveSizes?.small || editingBanner.imageUrl" 
                :alt="editingBanner.altText"
                class="preview-image"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Placement</label>
            <select v-model="editingBanner.placement" class="form-select">
              <option v-for="placement in placements" :key="placement.value" :value="placement.value">
                {{ placement.label }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Title (optional)</label>
            <input 
              v-model="editingBanner.title"
              type="text" 
              class="form-input"
              placeholder="Optional title for internal reference"
            />
          </div>

          <div class="form-group">
            <label>Alt Text (required) *</label>
            <input 
              v-model="editingBanner.altText"
              type="text" 
              class="form-input"
              placeholder="Describe the image for accessibility"
              required
            />
          </div>

          <div class="form-group">
            <label>Link URL (optional)</label>
            <input 
              v-model="editingBanner.linkUrl"
              type="url" 
              class="form-input"
              placeholder="https://example.com (optional)"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input 
                v-model="editingBanner.isActive"
                type="checkbox"
                class="form-checkbox"
              />
              Active (show on website)
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeEditModal" class="btn-secondary" :disabled="busy">
            Cancel
          </button>
          <button @click="updateBanner" class="btn-primary" :disabled="busy">
            {{ busy ? 'Updating...' : 'Update Banner' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-banner-admin {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.admin-header {
  margin-bottom: 30px;
}

.header-content .kicker {
  color: #6366f1;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.header-content h1 {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  margin: 0 0 8px 0;
}

.header-content p {
  color: var(--text-secondary, #6b7280);
  font-size: 16px;
  margin: 0;
}

.controls-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: var(--background-secondary, #f9fafb);
  border-radius: 12px;
}

.controls-left {
  display: flex;
  gap: 12px;
}

.controls-right {
  display: flex;
  gap: 12px;
}

.search-input, .placement-select {
  padding: 10px 14px;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  background: white;
}

.search-input {
  width: 200px;
}

.placement-select {
  min-width: 150px;
}

.btn-primary, .btn-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-primary {
  background: #6366f1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5856eb;
}

.btn-secondary {
  background: white;
  color: var(--text-primary, #374151);
  border-color: var(--border, #d1d5db);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--background-secondary, #f9fafb);
}

.btn-primary:disabled, .btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  width: 16px;
  height: 16px;
}

.error-message {
  background: #fee2e2;
  color: #991b1b;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #fca5a5;
}

.table-container {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.banners-table {
  width: 100%;
  border-collapse: collapse;
}

.banners-table th {
  background: var(--background-secondary, #f9fafb);
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-primary, #374151);
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.banners-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border, #f3f4f6);
  vertical-align: middle;
}

.banners-table tr.inactive {
  opacity: 0.6;
}

.preview-cell {
  width: 120px;
}

.banner-preview {
  width: 80px;
  height: 45px; /* 16:9 ratio */
  border-radius: 6px;
  overflow: hidden;
  background: var(--background-secondary, #f3f4f6);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-cell {
  max-width: 300px;
}

.banner-title {
  font-weight: 600;
  color: var(--text-primary, #111827);
  margin-bottom: 4px;
}

.banner-alt {
  font-size: 14px;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 4px;
}

.banner-link {
  font-size: 12px;
  color: #6366f1;
}

.placement-badge {
  background: var(--background-secondary, #f3f4f6);
  color: var(--text-secondary, #374151);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.status-btn.active {
  background: #d1fae5;
  color: #065f46;
  border-color: #a7f3d0;
}

.status-btn.inactive {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

.order-cell {
  width: 100px;
}

.order-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border, #d1d5db);
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.2s ease;
}

.order-btn:hover:not(:disabled) {
  background: var(--background-secondary, #f9fafb);
  border-color: #6366f1;
}

.order-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.order-number {
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  min-width: 20px;
  text-align: center;
}

.actions-cell {
  white-space: nowrap;
}

.btn-edit, .btn-delete {
  padding: 6px 12px;
  margin: 0 4px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-edit {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}

.btn-edit:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #93c5fd;
}

.btn-delete {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

.btn-delete:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}

.loading-state, .empty-state {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-secondary, #6b7280);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 16px;
  border: 3px solid var(--border, #e5e7eb);
  border-top: 3px solid #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary, #6b7280);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--background-secondary, #f3f4f6);
  color: var(--text-primary, #374151);
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border, #e5e7eb);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: var(--text-primary, #374151);
}

.form-input, .form-select, .file-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.file-input {
  padding: 8px;
}

.file-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.form-checkbox {
  width: auto !important;
}

.edit-preview {
  width: 160px;
  height: 90px; /* 16:9 ratio */
  border-radius: 8px;
  overflow: hidden;
  background: var(--background-secondary, #f3f4f6);
  border: 1px solid var(--border, #e5e7eb);
}

@media (max-width: 768px) {
  .product-banner-admin {
    padding: 16px;
  }
  
  .controls-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .controls-left, .controls-right {
    justify-content: space-between;
  }
  
  .banners-table {
    font-size: 14px;
  }
  
  .banners-table th, 
  .banners-table td {
    padding: 12px 8px;
  }
  
  .modal {
    margin: 10px;
  }
}
</style>