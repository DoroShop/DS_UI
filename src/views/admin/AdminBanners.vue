<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
  EyeIcon,
  LinkIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const showBannerModal = ref(false);
const showDeleteModal = ref(false);
const showPreviewModal = ref(false);
const isSubmitting = ref(false);
const activeTab = ref<'active' | 'inactive' | 'all'>('all');

// Modal state
const modalMode = ref<'create' | 'edit'>('create');
const selectedBanner = ref<any>(null);

// Form data
const bannerForm = ref({
  title: '',
  subtitle: '',
  link: '',
  image: null as File | null,
  imagePreview: '',
  productImage: null as File | null,
  productImagePreview: '',
  position: 1,
  isActive: true,
  startDate: '',
  endDate: '',
  // New fields for background customization
  backgroundType: 'gradient' as 'gradient' | 'image' | 'glassmorphism',
  gradientColor: 'linear-gradient(135deg, #cfee7a 0%, #f8cf2a 50%, #ffa726 100%)',
  hasButton: true,
  buttonText: 'Shop Now',
  // Background only mode - shows just the background with no content
  backgroundOnly: false,
});

// Gradient options for selection
const gradientOptions = [
  // Vibrant Gradients
  { name: 'Sunset Gold', value: 'linear-gradient(135deg, #cfee7a 0%, #f8cf2a 50%, #ffa726 100%)' },
  { name: 'Purple Blue', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { name: 'Pink Red', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { name: 'Blue Cyan', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { name: 'Green Teal', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { name: 'Pink Yellow', value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { name: 'Purple Pink', value: 'linear-gradient(135deg, #667eea 0%, #f093fb 100%)' },
  { name: 'Ocean Blue', value: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
  { name: 'Warm Flame', value: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)' },
  { name: 'Electric Violet', value: 'linear-gradient(135deg, #4776E6 0%, #8E54E9 100%)' },
  // Soft Pastel Gradients
  { name: 'Soft Pastel', value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { name: 'Soft Pink', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  { name: 'Peach', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { name: 'Lavender', value: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { name: 'Mint', value: 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)' },
  { name: 'Cotton Candy', value: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { name: 'Blush', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ee9ca7 100%)' },
  { name: 'Serenity', value: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' },
  // Nature Gradients
  { name: 'Forest', value: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)' },
  { name: 'Sunset', value: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)' },
  { name: 'Dawn', value: 'linear-gradient(135deg, #F3904F 0%, #3B4371 100%)' },
  { name: 'Aurora', value: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { name: 'Tropical', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { name: 'Ocean', value: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)' },
  { name: 'Spring', value: 'linear-gradient(135deg, #C6FFDD 0%, #FBD786 50%, #f7797d 100%)' },
  { name: 'Autumn', value: 'linear-gradient(135deg, #DAD299 0%, #B0DAB9 100%)' },
  // Professional Gradients
  { name: 'Midnight', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { name: 'Charcoal', value: 'linear-gradient(135deg, #3a3d40 0%, #181719 100%)' },
  { name: 'Steel', value: 'linear-gradient(135deg, #485563 0%, #29323c 100%)' },
  { name: 'Royal', value: 'linear-gradient(135deg, #141E30 0%, #243B55 100%)' },
  { name: 'Navy', value: 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)' },
  { name: 'Corporate', value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
  { name: 'Slate', value: 'linear-gradient(135deg, #606c88 0%, #3f4c6b 100%)' },
  { name: 'Executive', value: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)' },
  // Unique Gradients
  { name: 'Neon', value: 'linear-gradient(135deg, #12c2e9 0%, #c471ed 50%, #f64f59 100%)' },
  { name: 'Rainbow', value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 50%, #f6d365 100%)' },
  { name: 'Cosmic', value: 'linear-gradient(135deg, #ff00cc 0%, #333399 100%)' },
  { name: 'Cherry', value: 'linear-gradient(135deg, #EB3349 0%, #F45C43 100%)' },
  { name: 'Aqua', value: 'linear-gradient(135deg, #13547a 0%, #80d0c7 100%)' },
  { name: 'Grape', value: 'linear-gradient(135deg, #5f2c82 0%, #49a09d 100%)' },
  { name: 'Mango', value: 'linear-gradient(135deg, #ffe259 0%, #ffa751 100%)' },
  { name: 'Berry', value: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' },
  // Solid Colors (as gradients for consistency)
  { name: 'Deep Red', value: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)' },
  { name: 'Deep Blue', value: 'linear-gradient(135deg, #2980b9 0%, #3498db 100%)' },
  { name: 'Deep Green', value: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)' },
  { name: 'Deep Purple', value: 'linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%)' },
  { name: 'Deep Orange', value: 'linear-gradient(135deg, #d35400 0%, #e67e22 100%)' },
  { name: 'Deep Teal', value: 'linear-gradient(135deg, #16a085 0%, #1abc9c 100%)' },
  // Premium Gradients
  { name: 'Gold', value: 'linear-gradient(135deg, #BF953F 0%, #FCF6BA 50%, #B38728 100%)' },
  { name: 'Silver', value: 'linear-gradient(135deg, #bdc3c7 0%, #ecf0f1 50%, #95a5a6 100%)' },
  { name: 'Rose Gold', value: 'linear-gradient(135deg, #b76e79 0%, #eacda3 100%)' },
  { name: 'Bronze', value: 'linear-gradient(135deg, #cd7f32 0%, #b8860b 100%)' },
  // Animated Feel Gradients
  { name: 'Fire', value: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { name: 'Ice', value: 'linear-gradient(135deg, #74ebd5 0%, #ACB6E5 100%)' },
  { name: 'Lightning', value: 'linear-gradient(135deg, #F7971E 0%, #FFD200 100%)' },
  { name: 'Northern Lights', value: 'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)' },
  { name: 'Sunset Beach', value: 'linear-gradient(135deg, #ff6e7f 0%, #bfe9ff 100%)' },
  { name: 'Mystic', value: 'linear-gradient(135deg, #757F9A 0%, #D7DDE8 100%)' },
];

// Get preview style for gradient/glassmorphism
const getPreviewStyle = () => {
  if (bannerForm.value.backgroundType === 'glassmorphism') {
    return {
      background: bannerForm.value.gradientColor,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    };
  }
  return { background: bannerForm.value.gradientColor };
};

// Banners data
const banners = computed(() => adminStore.banners);

// Filtered banners
const filteredBanners = computed(() => {
  if (activeTab.value === 'all') return banners.value;
  const isActive = activeTab.value === 'active';
  return banners.value.filter((banner: any) => banner.isActive === isActive);
});

// Fetch data
const fetchBanners = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchBanners();
  } catch (error) {
    console.error('Failed to fetch banners:', error);
  } finally {
    isLoading.value = false;
  }
};

// Open create modal
const openCreateModal = () => {
  modalMode.value = 'create';
  selectedBanner.value = null;
  resetForm();
  showBannerModal.value = true;
};

// Open edit modal
const openEditModal = (banner: any) => {
  modalMode.value = 'edit';
  selectedBanner.value = banner;
  bannerForm.value = {
    title: banner.title || '',
    subtitle: banner.subtitle || '',
    link: banner.link || '',
    image: null,
    imagePreview: banner.image || banner.imageUrl || '',
    position: banner.position || 1,
    isActive: banner.isActive !== false,
    startDate: banner.startDate ? new Date(banner.startDate).toISOString().split('T')[0] : '',
    endDate: banner.endDate ? new Date(banner.endDate).toISOString().split('T')[0] : '',
    // New fields
    backgroundType: banner.backgroundType || 'image',
    gradientColor: banner.gradientColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    hasButton: banner.hasButton !== false,
    buttonText: banner.buttonText || 'Shop Now',
    productImage: null,
    productImagePreview: banner.productImageUrl || '',
    backgroundOnly: banner.backgroundOnly || false,
  };
  showBannerModal.value = true;
};

// Open preview modal
const openPreviewModal = (banner: any) => {
  selectedBanner.value = banner;
  showPreviewModal.value = true;
};

// Open delete confirmation
const openDeleteModal = (banner: any) => {
  selectedBanner.value = banner;
  showDeleteModal.value = true;
};

// Reset form
const resetForm = () => {
  bannerForm.value = {
    title: '',
    subtitle: '',
    link: '',
    image: null,
    imagePreview: '',
    productImage: null,
    productImagePreview: '',
    position: banners.value.length + 1,
    isActive: true,
    startDate: '',
    endDate: '',
    backgroundType: 'gradient',
    gradientColor: 'linear-gradient(135deg, #cfee7a 0%, #f8cf2a 50%, #ffa726 100%)',
    hasButton: true,
    buttonText: 'Shop Now',
    backgroundOnly: false,
  };
};

// Handle background image selection
const handleBackgroundImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    bannerForm.value.image = file;
    bannerForm.value.imagePreview = URL.createObjectURL(file);
  }
};

// Handle product image selection
const handleProductImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const file = input.files[0];
    bannerForm.value.productImage = file;
    bannerForm.value.productImagePreview = URL.createObjectURL(file);
  }
};

// Remove background image
const removeBackgroundImage = () => {
  bannerForm.value.image = null;
  bannerForm.value.imagePreview = '';
};

// Alias for template compatibility
const removeImage = removeBackgroundImage;

// Remove product image
const removeProductImage = () => {
  bannerForm.value.productImage = null;
  bannerForm.value.productImagePreview = '';
};

// Submit form
const submitForm = async () => {
  // For create mode with image background, background image is required
  if (modalMode.value === 'create' && bannerForm.value.backgroundType === 'image' && !bannerForm.value.image) {
    alert('Background image is required for image-type banner');
    return;
  }
  
  isSubmitting.value = true;
  try {
    const formData = new FormData();
    formData.append('title', bannerForm.value.title);
    formData.append('subtitle', bannerForm.value.subtitle || '');
    formData.append('link', bannerForm.value.link || '');
    formData.append('position', String(bannerForm.value.position));
    formData.append('isActive', String(bannerForm.value.isActive));
    
    // New fields for background customization
    formData.append('backgroundType', bannerForm.value.backgroundType);
    formData.append('gradientColor', bannerForm.value.gradientColor);
    formData.append('hasButton', String(bannerForm.value.hasButton));
    formData.append('buttonText', bannerForm.value.buttonText);
    formData.append('backgroundOnly', String(bannerForm.value.backgroundOnly));
    
    if (bannerForm.value.startDate) {
      formData.append('startDate', bannerForm.value.startDate);
    }
    if (bannerForm.value.endDate) {
      formData.append('endDate', bannerForm.value.endDate);
    }
    
    // Background image (for image-type banners)
    if (bannerForm.value.image) {
      formData.append('image', bannerForm.value.image);
    } else if (modalMode.value === 'edit' && bannerForm.value.imagePreview) {
      // For edit mode, pass existing imageUrl if no new image uploaded
      formData.append('existingImageUrl', bannerForm.value.imagePreview);
    }
    
    // Product image (optional overlay image)
    if (bannerForm.value.productImage) {
      formData.append('productImage', bannerForm.value.productImage);
    } else if (modalMode.value === 'edit' && bannerForm.value.productImagePreview) {
      formData.append('existingProductImageUrl', bannerForm.value.productImagePreview);
    }
    
    if (modalMode.value === 'create') {
      await adminStore.createBanner(formData);
    } else {
      await adminStore.updateBanner(selectedBanner.value._id, formData);
    }
    
    showBannerModal.value = false;
    await fetchBanners();
  } catch (error) {
    console.error('Failed to save banner:', error);
    alert('Failed to save banner. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Delete banner
const confirmDelete = async () => {
  if (!selectedBanner.value) return;
  
  isSubmitting.value = true;
  try {
    await adminStore.deleteBanner(selectedBanner.value._id);
    showDeleteModal.value = false;
    await fetchBanners();
  } catch (error) {
    console.error('Failed to delete banner:', error);
    alert('Failed to delete banner. Please try again.');
  } finally {
    isSubmitting.value = false;
  }
};

// Toggle banner status
const toggleBannerStatus = async (banner: any) => {
  try {
    await adminStore.updateBanner(banner._id, { isActive: !banner.isActive });
    await fetchBanners();
  } catch (error) {
    console.error('Failed to update banner status:', error);
  }
};

// Format date
const formatDate = (date: string) => {
  if (!date) return 'No date';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Close modals
const closeModal = () => {
  showBannerModal.value = false;
  showDeleteModal.value = false;
  showPreviewModal.value = false;
  selectedBanner.value = null;
};

onMounted(() => {
  fetchBanners();
});
</script>

<template>
  <div class="banners-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Banners</h1>
        <p class="page-subtitle">Manage homepage banners and promotions</p>
      </div>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Banner
      </button>
    </div>

    <!-- Tabs -->
    <div class="tabs-section">
      <button 
        :class="['tab-btn', { active: activeTab === 'all' }]"
        @click="activeTab = 'all'"
      >
        All Banners
        <span class="tab-count">{{ banners.length }}</span>
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'active' }]"
        @click="activeTab = 'active'"
      >
        Active
        <span class="tab-count">{{ banners.filter((b: any) => b.isActive).length }}</span>
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'inactive' }]"
        @click="activeTab = 'inactive'"
      >
        Inactive
        <span class="tab-count">{{ banners.filter((b: any) => !b.isActive).length }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading banners...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredBanners.length === 0" class="empty-state">
      <PhotoIcon class="empty-icon" />
      <h3>No Banners Found</h3>
      <p v-if="activeTab !== 'all'">No {{ activeTab }} banners available</p>
      <p v-else>Start by creating your first banner</p>
      <button class="create-btn" @click="openCreateModal">
        <PlusIcon class="btn-icon" />
        Add Banner
      </button>
    </div>

    <!-- Banners List -->
    <div v-else class="banners-list">
      <div 
        v-for="(banner, index) in filteredBanners" 
        :key="banner._id"
        class="banner-item"
      >
        <div class="banner-position">
          <span class="position-number">{{ banner.position || index + 1 }}</span>
          <button class="reorder-btn" title="Reorder">
            <ArrowsUpDownIcon />
          </button>
        </div>
        
        <div class="banner-preview">
          <img 
            v-if="banner.image" 
            :src="banner.image" 
            :alt="banner.title || 'Banner'"
          />
          <div v-else class="placeholder-image">
            <PhotoIcon />
          </div>
        </div>
        
        <div class="banner-info">
          <h3 class="banner-title">{{ banner.title || 'Untitled Banner' }}</h3>
          <p v-if="banner.subtitle" class="banner-subtitle">{{ banner.subtitle }}</p>
          <div class="banner-meta">
            <span v-if="banner.link" class="meta-item link">
              <LinkIcon class="meta-icon" />
              {{ banner.link.substring(0, 30) }}{{ banner.link.length > 30 ? '...' : '' }}
            </span>
            <span class="meta-item date">
              {{ formatDate(banner.startDate) }} - {{ formatDate(banner.endDate) }}
            </span>
          </div>
        </div>
        
        <div class="banner-status">
          <label class="toggle-label">
            <input 
              type="checkbox"
              :checked="banner.isActive"
              @change="toggleBannerStatus(banner)"
              class="toggle-input"
            />
            <span class="toggle-switch"></span>
          </label>
          <span :class="['status-text', { active: banner.isActive }]">
            {{ banner.isActive ? 'Active' : 'Inactive' }}
          </span>
        </div>
        
        <div class="banner-actions">
          <button 
            class="action-btn preview"
            @click="openPreviewModal(banner)"
            title="Preview"
          >
            <EyeIcon />
          </button>
          <button 
            class="action-btn edit"
            @click="openEditModal(banner)"
            title="Edit"
          >
            <PencilSquareIcon />
          </button>
          <button 
            class="action-btn delete"
            @click="openDeleteModal(banner)"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>

    <!-- Banner Modal -->
    <div v-if="showBannerModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ modalMode === 'create' ? 'Create Banner' : 'Edit Banner' }}</h2>
          <button class="close-btn" @click="closeModal">
            <XMarkIcon />
          </button>
        </div>
        
        <form @submit.prevent="submitForm" class="modal-body">
          <!-- Background Type -->
          <div class="form-group">
            <label class="form-label">Background Type</label>
            <div class="radio-group">
              <label class="radio-label">
                <input 
                  type="radio" 
                  v-model="bannerForm.backgroundType" 
                  value="image"
                  class="radio-input"
                />
                <span class="radio-custom"></span>
                <span>Image Background</span>
              </label>
              <label class="radio-label">
                <input 
                  type="radio" 
                  v-model="bannerForm.backgroundType" 
                  value="gradient"
                  class="radio-input"
                />
                <span class="radio-custom"></span>
                <span>Gradient Background</span>
              </label>
              <label class="radio-label">
                <input 
                  type="radio" 
                  v-model="bannerForm.backgroundType" 
                  value="glassmorphism"
                  class="radio-input"
                />
                <span class="radio-custom"></span>
                <span>Glassmorphism</span>
              </label>
            </div>
          </div>

          <!-- Background Only Mode Toggle -->
          <div class="form-group">
            <div class="background-only-toggle">
              <label class="toggle-label">
                <input 
                  type="checkbox"
                  v-model="bannerForm.backgroundOnly"
                  class="toggle-input"
                />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Background Only Mode</span>
              </label>
              <p class="toggle-hint">When enabled, only the background will be shown without any text, buttons, or product images.</p>
            </div>
          </div>
          
          <!-- Background Image Upload (shown when backgroundType is 'image') -->
          <div v-if="bannerForm.backgroundType === 'image'" class="form-group">
            <label class="form-label">Background Image {{ bannerForm.backgroundOnly ? '*' : '(Optional)' }}</label>
            <div class="image-upload">
              <div 
                v-if="bannerForm.imagePreview" 
                class="image-preview banner"
              >
                <img :src="bannerForm.imagePreview" alt="Preview" />
                <button 
                  type="button" 
                  class="remove-image"
                  @click="removeImage"
                >
                  <XMarkIcon />
                </button>
              </div>
              <label v-else class="upload-box banner">
                <PhotoIcon class="upload-icon" />
                <span>Click to upload background image</span>
                <span class="upload-hint">Recommended: 16:9 ratio (1920x1080px), JPG or PNG</span>
                <input 
                  type="file"
                  accept="image/*"
                  @change="handleBackgroundImageSelect"
                  class="file-input"
                />
              </label>
            </div>
          </div>
          
          <!-- Gradient Color (shown when backgroundType is 'gradient' or 'glassmorphism') -->
          <div v-if="bannerForm.backgroundType === 'gradient' || bannerForm.backgroundType === 'glassmorphism'" class="form-group">
            <label class="form-label">{{ bannerForm.backgroundType === 'glassmorphism' ? 'Base Color' : 'Gradient Style' }}</label>
            <div class="gradient-options">
              <!-- Color Gradients -->
              <div class="gradient-section">
                <span class="gradient-section-label">Select a Gradient</span>
                <div class="gradient-grid">
                  <button
                    v-for="gradient in gradientOptions"
                    :key="gradient.value"
                    type="button"
                    class="gradient-option"
                    :class="{ active: bannerForm.gradientColor === gradient.value }"
                    :style="{ background: gradient.value }"
                    @click="bannerForm.gradientColor = gradient.value"
                    :title="gradient.name"
                  >
                    <span class="gradient-name">{{ gradient.name }}</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="gradient-preview" :class="{ 'glassmorphism': bannerForm.backgroundType === 'glassmorphism' }" :style="getPreviewStyle()"></div>
          </div>
          
          <!-- Content Fields (hidden when backgroundOnly is enabled) -->
          <template v-if="!bannerForm.backgroundOnly">
            <!-- Product Image (optional, for gradient banners to show product) -->
            <div class="form-group">
              <label class="form-label">Product Image (Optional)</label>
              <div class="image-upload">
                <div 
                  v-if="bannerForm.productImagePreview" 
                  class="image-preview product"
                >
                  <img :src="bannerForm.productImagePreview" alt="Product Preview" />
                  <button 
                    type="button" 
                    class="remove-image"
                    @click="removeProductImage"
                  >
                    <XMarkIcon />
                  </button>
                </div>
                <label v-else class="upload-box product">
                  <PhotoIcon class="upload-icon" />
                  <span>Click to upload product image</span>
                  <span class="upload-hint">Optional: Show product on banner</span>
                  <input 
                    type="file"
                    accept="image/*"
                    @change="handleProductImageSelect"
                    class="file-input"
                  />
                </label>
              </div>
            </div>
            
            <!-- Title -->
            <div class="form-group">
              <label class="form-label" for="title">Title</label>
              <input 
                v-model="bannerForm.title"
                type="text" 
                id="title"
                class="form-input"
                placeholder="Enter banner title (optional)"
              />
            </div>
            
            <!-- Subtitle -->
            <div class="form-group">
              <label class="form-label" for="subtitle">Subtitle</label>
              <input 
                v-model="bannerForm.subtitle"
                type="text" 
                id="subtitle"
                class="form-input"
                placeholder="Enter banner subtitle (optional)"
              />
            </div>
            
            <!-- Button Settings -->
            <div class="form-group">
              <label class="toggle-label">
                <input 
                  type="checkbox"
                  v-model="bannerForm.hasButton"
                  class="toggle-input"
                />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Show Button</span>
              </label>
            </div>
            
            <!-- Button Text (shown when hasButton is true) -->
            <div v-if="bannerForm.hasButton" class="form-group">
              <label class="form-label" for="buttonText">Button Text</label>
              <input 
                v-model="bannerForm.buttonText"
                type="text" 
                id="buttonText"
                class="form-input"
                placeholder="Shop Now"
              />
            </div>
          </template>
          
          <!-- Link -->
          <div class="form-group">
            <label class="form-label" for="link">Link URL</label>
            <input 
              v-model="bannerForm.link"
              type="url" 
              id="link"
              class="form-input"
              placeholder="https://example.com/page"
            />
          </div>
          
          <!-- Position -->
          <div class="form-group">
            <label class="form-label" for="position">Display Order</label>
            <input 
              v-model.number="bannerForm.position"
              type="number" 
              id="position"
              class="form-input"
              placeholder="1"
              min="1"
            />
          </div>
          
          <!-- Date Range -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="startDate">Start Date</label>
              <input 
                v-model="bannerForm.startDate"
                type="date" 
                id="startDate"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="endDate">End Date</label>
              <input 
                v-model="bannerForm.endDate"
                type="date" 
                id="endDate"
                class="form-input"
              />
            </div>
          </div>
          
          <!-- Active Status -->
          <div class="form-group">
            <label class="toggle-label">
              <input 
                type="checkbox"
                v-model="bannerForm.isActive"
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
            {{ isSubmitting ? 'Saving...' : (modalMode === 'create' ? 'Create Banner' : 'Save Changes') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreviewModal" class="modal-overlay preview" @click.self="closeModal">
      <div class="preview-modal">
        <button class="close-preview" @click="closeModal">
          <XMarkIcon />
        </button>
        <img 
          v-if="selectedBanner?.image" 
          :src="selectedBanner.image" 
          :alt="selectedBanner.title || 'Banner'"
        />
        <div v-if="selectedBanner?.title || selectedBanner?.subtitle" class="preview-content">
          <h2 v-if="selectedBanner?.title">{{ selectedBanner.title }}</h2>
          <p v-if="selectedBanner?.subtitle">{{ selectedBanner.subtitle }}</p>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content delete-modal">
        <div class="delete-icon-wrapper">
          <TrashIcon />
        </div>
        <h2>Delete Banner</h2>
        <p>
          Are you sure you want to delete this banner? This action cannot be undone.
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
            {{ isSubmitting ? 'Deleting...' : 'Delete Banner' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banners-page {
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

/* Banners List */
.banners-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.banner-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1rem;
  transition: all 0.2s ease;
}

.banner-item:hover {
  border-color: var(--color-primary);
}

.banner-position {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.position-number {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.reorder-btn {
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: grab;
  transition: color 0.2s ease;
}

.reorder-btn:hover {
  color: var(--text-primary);
}

.reorder-btn svg {
  width: 1rem;
  height: 1rem;
}

.banner-preview {
  width: 200px;
  height: 80px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-secondary);
}

.banner-preview img {
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
  width: 2rem;
  height: 2rem;
}

.banner-info {
  flex: 1;
  min-width: 0;
}

.banner-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.banner-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
}

.banner-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.meta-item.link {
  color: var(--color-primary);
}

.meta-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.banner-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.status-text {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.status-text.active {
  color: #16a34a;
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

/* Background Only Mode Toggle */
.background-only-toggle {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.toggle-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin: 0.5rem 0 0;
  line-height: 1.4;
}

.banner-actions {
  display: flex;
  gap: 0.5rem;
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

.action-btn.preview {
  background: #f3e8ff;
  color: #9333ea;
}

.action-btn.preview:hover {
  background: #e9d5ff;
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

.modal-overlay.preview {
  background: rgba(0, 0, 0, 0.9);
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

.form-input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
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

.upload-box.banner {
  padding: 3rem 2rem;
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

.upload-hint {
  font-size: 0.75rem !important;
  color: var(--text-tertiary) !important;
}

.file-input {
  display: none;
}

.image-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-preview.banner {
  max-height: 200px;
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

/* Radio Group */
.radio-group {
  display: flex;
  gap: 1.5rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.radio-input {
  display: none;
}

.radio-custom {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-primary);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
}

.radio-input:checked + .radio-custom {
  border-color: var(--color-primary);
}

.radio-input:checked + .radio-custom::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: var(--color-primary);
  border-radius: 50%;
}

/* Gradient Options Grid */
.gradient-options {
  margin-top: 0.5rem;
}

.gradient-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gradient-section-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gradient-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.5rem;
  max-height: 250px;
  overflow-y: auto;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.gradient-option {
  position: relative;
  height: 50px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.gradient-option:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.gradient-option.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

.gradient-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 4px;
  font-size: 0.6rem;
  font-weight: 500;
  color: white;
  background: rgba(0, 0, 0, 0.5);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Gradient Preview */
.gradient-preview {
  margin-top: 0.75rem;
  aspect-ratio: 16 / 9;
  max-height: 150px;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.gradient-preview.glassmorphism {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.gradient-preview.glassmorphism::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.gradient-preview.glassmorphism::after {
  content: 'Glassmorphism Effect';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 1;
}

/* Product Image Upload */
.upload-box.product {
  padding: 1.5rem;
}

.image-preview.product {
  height: 150px;
  max-width: 200px;
}

.image-preview.product img {
  object-fit: contain;
  background: var(--bg-secondary);
}

.remove-image svg {
  width: 1rem;
  height: 1rem;
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

/* Preview Modal */
.preview-modal {
  position: relative;
  max-width: 90vw;
  max-height: 80vh;
}

.preview-modal img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
}

.close-preview {
  position: absolute;
  top: -2.5rem;
  right: 0;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-preview:hover {
  background: #f3f4f6;
}

.close-preview svg {
  width: 1.25rem;
  height: 1.25rem;
  color: #374151;
}

.preview-content {
  text-align: center;
  margin-top: 1rem;
  color: white;
}

.preview-content h2 {
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
}

.preview-content p {
  margin: 0;
  opacity: 0.8;
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
  
  .banner-item {
    flex-wrap: wrap;
  }
  
  .banner-preview {
    width: 100%;
    height: 120px;
    order: -1;
  }
  
  .banner-position {
    flex-direction: row;
  }
  
  .banner-info {
    flex: 1 1 100%;
  }
  
  .banner-status,
  .banner-actions {
    margin-top: 0.5rem;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
