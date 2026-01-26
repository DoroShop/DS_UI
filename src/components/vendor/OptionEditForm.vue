<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { useVendorDashboardStore } from '@/stores/vendor/dashboardStores';
import ImageCropper from '@/components/ImageCropper.vue';

interface Promotion {
  _id?: string;
  isActive?: boolean;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startDate?: string | null;
  endDate?: string | null;
  freeShipping: boolean;
}

interface Option {
  _id: string;
  label: string;
  price: number;
  stock: number;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  promotion?: Promotion;
}

const props = defineProps<{
  option: Option;
  productId: string;
}>();

const emit = defineEmits(['cancel', 'update']);

const store = useVendorDashboardStore();

const form = reactive({
  label: props.option.label,
  price: props.option.price,
  stock: props.option.stock,
  imageUrl: props.option.imageUrl,
  cloudinaryPublicId: props.option.cloudinaryPublicId,
});

const promotionForm = reactive<Promotion>({
  discountType: 'percentage',
  discountValue: 0,
  startDate: null,
  endDate: null,
  freeShipping: false,
});

const hasPromotion = ref(false);
const submitting = ref(false);
const isUploading = ref(false);
const uploadError = ref<string | null>(null);
const showCropper = ref(false);
const cropImageSrc = ref('');
const croppedImageBlob = ref<Blob | null>(null);
const isEndingPromotion = ref(false);
const showEndPromotionModal = ref(false);

const promotionStatus = computed(() => {
  const promotion = props.option.promotion;
  if (!promotion || promotion.isActive === false) return 'none';

  const now = new Date();
  const startDate = promotion.startDate ? new Date(promotion.startDate) : null;
  const endDate = promotion.endDate ? new Date(promotion.endDate) : null;

  if (endDate && endDate < now) return 'expired';
  if (startDate && startDate > now) return 'scheduled';
  if ((!startDate || startDate <= now) && (!endDate || endDate >= now)) return 'active';
  
  return 'none';
});

const finalPrice = computed(() => {
  if (!hasPromotion.value || !promotionForm.discountValue) {
    return form.price;
  }
  if (promotionForm.discountType === 'fixed') {
    return Math.max(0, form.price - promotionForm.discountValue);
  }
  if (promotionForm.discountType === 'percentage') {
    return form.price * (1 - promotionForm.discountValue / 100);
  }
  return form.price;
});

const savings = computed(() => {
  const original = form.price;
  const final = finalPrice.value;
  const amount = original - final;
  const percentage = original > 0 ? Math.round((amount / original) * 100) : 0;
  return { amount, percentage };
});

const isFormValid = computed(() => {
  return form.label && form.price > 0;
});

onMounted(() => {
  if (props.option.promotion) {
    hasPromotion.value = true;
    Object.assign(promotionForm, {
      ...props.option.promotion,
      startDate: props.option.promotion.startDate ? new Date(props.option.promotion.startDate).toISOString().split('T')[0] : null,
      endDate: props.option.promotion.endDate ? new Date(props.option.promotion.endDate).toISOString().split('T')[0] : null,
    });
  }
});

watch(() => props.option, (newOption) => {
  form.label = newOption.label;
  form.price = newOption.price;
  form.stock = newOption.stock;
  form.imageUrl = newOption.imageUrl;
  form.cloudinaryPublicId = newOption.cloudinaryPublicId;

  if (newOption.promotion) {
    hasPromotion.value = true;
    Object.assign(promotionForm, {
      ...newOption.promotion,
      startDate: newOption.promotion.startDate ? new Date(newOption.promotion.startDate).toISOString().split('T')[0] : null,
      endDate: newOption.promotion.endDate ? new Date(newOption.promotion.endDate).toISOString().split('T')[0] : null,
    });
  } else {
    hasPromotion.value = false;
    Object.assign(promotionForm, {
      discountType: 'percentage',
      discountValue: 0,
      startDate: null,
      endDate: null,
      freeShipping: false,
    });
  }
}, { deep: true, immediate: true });

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      cropImageSrc.value = e.target?.result as string;
      showCropper.value = true;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

const applyCroppedImage = async (blob: Blob) => {
  croppedImageBlob.value = blob;
  showCropper.value = false;
  await uploadImage();
};

const closeCropper = () => {
  showCropper.value = false;
  cropImageSrc.value = '';
};

const uploadImage = async () => {
  if (!croppedImageBlob.value) return;

  isUploading.value = true;
  uploadError.value = null;

  const formData = new FormData();
  formData.append('image', croppedImageBlob.value, 'cropped-image.png');
  if (form.cloudinaryPublicId) {
    formData.append('public_id', form.cloudinaryPublicId);
  }

  try {
    const { data } = await axios.post(`/api/products/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    form.imageUrl = data.url;
    form.cloudinaryPublicId = data.public_id;
  } catch (error) {
    console.error('Image upload failed:', error);
    uploadError.value = 'Image upload failed. Please try again.';
  } finally {
    isUploading.value = false;
    croppedImageBlob.value = null;
  }
};

const reCrop = () => {
  if (form.imageUrl) {
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if(fileInput) fileInput.click();
  }
};

const clearImage = async () => {
  if (!form.cloudinaryPublicId) {
    form.imageUrl = undefined;
    return;
  }
  
  isUploading.value = true;
  try {
    await axios.post('/api/products/delete-image', { publicId: form.cloudinaryPublicId });
    form.imageUrl = undefined;
    form.cloudinaryPublicId = undefined;
  } catch (error) {
    console.error('Failed to delete image from Cloudinary:', error);
    uploadError.value = 'Could not remove image. Please try again.';
  } finally {
    isUploading.value = false;
  }
};

const handleImageError = () => {
  form.imageUrl = undefined; 
};

const handleSubmit = async () => {
  if (!isFormValid.value) return;

  submitting.value = true;
  try {
    const payload = {
      ...form,
      promotion: hasPromotion.value ? { ...promotionForm, isActive: true } : null,
    };
    
    if (payload.promotion) {
      payload.promotion.startDate = payload.promotion.startDate ? new Date(payload.promotion.startDate).toISOString() : null;
      payload.promotion.endDate = payload.promotion.endDate ? new Date(payload.promotion.endDate).toISOString() : null;
    }

    await store.updateOptionedProduct(props.productId, props.option._id, payload);
    emit('update');
  } catch (error) {
    console.error('Failed to update option:', error);
  } finally {
    submitting.value = false;
  }
};

const endOffer = () => {
  showEndPromotionModal.value = true;
};

const cancelEndPromotion = () => {
  showEndPromotionModal.value = false;
};

const confirmEndPromotion = async () => {
  if (!props.option.promotion) return;
  isEndingPromotion.value = true;
  try {
    await store.updateOptionedProduct(props.productId, props.option._id, { promotion: null });
    hasPromotion.value = false;
    Object.assign(promotionForm, {
      discountType: 'percentage',
      discountValue: 0,
      startDate: null,
      endDate: null,
      freeShipping: false,
    });
    emit('update');
  } catch (error) {
    console.error('Failed to end promotion:', error);
  } finally {
    isEndingPromotion.value = false;
    showEndPromotionModal.value = false;
  }
};
</script>

<template>
  <div class="modal-container">
    <div class="modal-header">
      <div class="header-content">
        <h2 class="modal-title">Edit Variant Option</h2>
        <p class="modal-subtitle">Manage pricing, stock, and promotional offers.</p>
      </div>
      <button type="button" class="close-button" @click="$emit('cancel')" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div class="modal-body">
      <form @submit.prevent="handleSubmit" id="option-edit-form">
        <div class="form-grid">
          <!-- Left Column: Image & Basic Info -->
          <div class="form-column">
            <section class="form-section">
              <h3 class="section-heading">Variant Image</h3>
              <div class="image-uploader" :class="{ 'has-image': form.imageUrl, 'is-loading': isUploading }">
                <div v-if="isUploading" class="upload-loader">
                  <div class="spinner"></div>
                  <span>Uploading...</span>
                </div>
                
                <template v-else>
                  <img v-if="form.imageUrl" :src="form.imageUrl" alt="Variant Preview" class="image-preview" @error="handleImageError" />
                  <div v-else class="upload-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="upload-icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    <span>Upload Image</span>
                  </div>
                  
                  <div class="image-actions">
                    <label for="file-upload" class="action-btn upload-btn">
                      {{ form.imageUrl ? 'Change' : 'Select File' }}
                    </label>
                    <input type="file" id="file-upload" accept="image/*" @change="handleFileChange" class="hidden-input" />
                    
                    <button v-if="form.imageUrl" type="button" class="action-btn crop-btn" @click="reCrop" title="Crop Image">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
                    </button>
                    <button v-if="form.imageUrl" type="button" class="action-btn delete-btn" @click="clearImage" title="Remove Image">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </template>
              </div>
              <p v-if="uploadError" class="error-message">{{ uploadError }}</p>
            </section>

            <section class="form-section">
              <h3 class="section-heading">Details</h3>
              <div class="input-group">
                <label for="variant-label">Label <span class="required">*</span></label>
                <input type="text" id="variant-label" v-model="form.label" placeholder="e.g. Size L, Red" required class="form-input" />
              </div>
              
              <div class="row-inputs">
                <div class="input-group">
                  <label for="variant-price">Price <span class="required">*</span></label>
                  <div class="input-wrapper">
                    <span class="currency-symbol">₱</span>
                    <input type="number" id="variant-price" v-model.number="form.price" min="0" step="0.01" required class="form-input has-prefix" />
                  </div>
                </div>
                
                <div class="input-group">
                  <label for="variant-stock">Stock</label>
                  <input type="number" id="variant-stock" v-model.number="form.stock" min="0" class="form-input" />
                </div>
              </div>
            </section>
          </div>

          <!-- Right Column: Promotion -->
          <div class="form-column">
            <section class="form-section promotion-card" :class="{ 'is-active': hasPromotion }">
              <div class="promotion-header">
                <div class="promotion-title-group">
                  <div class="icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                  </div>
                  <div>
                    <h3 class="section-heading">Promotion</h3>
                    <p class="section-desc">Run a sale on this variant</p>
                  </div>
                </div>
                <label class="switch">
                  <input type="checkbox" v-model="hasPromotion">
                  <span class="slider round"></span>
                </label>
              </div>

              <div v-if="hasPromotion" class="promotion-body">
                <div v-if="promotionStatus !== 'none' && props.option.promotion" class="active-status-banner" :class="promotionStatus">
                  <span class="status-icon" v-if="promotionStatus === 'active'">●</span>
                  <span class="status-text">
                    {{ promotionStatus === 'active' ? 'Active Now' : promotionStatus === 'scheduled' ? 'Scheduled' : 'Expired' }}
                  </span>
                  <button type="button" class="text-btn danger" @click="endOffer" :disabled="isEndingPromotion">End Offer</button>
                </div>

                <div class="row-inputs">
                  <div class="input-group">
                    <label>Discount Type</label>
                    <div class="select-wrapper">
                      <select v-model="promotionForm.discountType" class="form-select">
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₱)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div class="input-group">
                    <label>Value</label>
                    <input type="number" v-model.number="promotionForm.discountValue" min="0" :max="promotionForm.discountType === 'percentage' ? 100 : form.price" class="form-input" />
                  </div>
                </div>

                <div class="price-calculation" v-if="promotionForm.discountValue > 0">
                  <div class="calc-row">
                    <span>Original Price</span>
                    <span class="original-price">₱{{ form.price.toFixed(2) }}</span>
                  </div>
                  <div class="calc-row highlight">
                    <span>Discounted Price</span>
                    <span class="final-price">₱{{ finalPrice.toFixed(2) }}</span>
                  </div>
                  <div class="savings-tag">
                    You save ₱{{ savings.amount.toFixed(2) }} ({{ savings.percentage }}%)
                  </div>
                </div>

                <div class="row-inputs">
                  <div class="input-group">
                    <label>Start Date</label>
                    <input type="date" v-model="promotionForm.startDate" class="form-input" />
                  </div>
                  <div class="input-group">
                    <label>End Date</label>
                    <input type="date" v-model="promotionForm.endDate" :min="promotionForm.startDate" class="form-input" />
                  </div>
                </div>

                <div class="checkbox-group">
                  <label class="checkbox-container">
                    <input type="checkbox" v-model="promotionForm.freeShipping">
                    <span class="checkmark"></span>
                    <span class="checkbox-text">Free Shipping</span>
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>
      </form>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" @click="$emit('cancel')" :disabled="submitting">Cancel</button>
      <button type="submit" form="option-edit-form" class="btn btn-primary" :disabled="submitting || !isFormValid">
        <span v-if="submitting" class="spinner-sm"></span>
        {{ submitting ? 'Saving...' : 'Save Changes' }}
      </button>
    </div>

    <!-- Cropper Modal Overlay -->
    <div v-if="showCropper" class="overlay-backdrop">
      <div class="overlay-modal">
        <div class="overlay-header">
          <h3>Crop Image</h3>
          <button @click="closeCropper" class="close-icon">✕</button>
        </div>
        <div class="overlay-body">
          <ImageCropper :image-src="cropImageSrc" @crop="applyCroppedImage" @cancel="closeCropper" />
        </div>
      </div>
    </div>

    <!-- Confirmation Modal Overlay -->
    <div v-if="showEndPromotionModal" class="overlay-backdrop">
      <div class="overlay-modal confirm-modal">
        <div class="confirm-icon-wrapper">⚠️</div>
        <h3>End Promotion?</h3>
        <p>This will immediately remove the discount from this variant.</p>
        <div class="overlay-actions">
          <button class="btn btn-secondary" @click="cancelEndPromotion">Cancel</button>
          <button class="btn btn-danger" @click="confirmEndPromotion" :disabled="isEndingPromotion">
            {{ isEndingPromotion ? 'Ending...' : 'End Promotion' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Variables & Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

.modal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 90vh;
  background-color: var(--surface, #ffffff);
  color: var(--text-primary, #1f2937);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background-color: var(--surface, #ffffff);
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #111827);
}

.modal-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
  margin: 0.25rem 0 0;
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary, #6b7280); /* Darkened for contrast */
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: var(--bg-secondary, #f3f4f6);
  color: var(--text-primary, #374151);
}

/* Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  background-color: var(--bg-secondary, #f9fafb);
  overscroll-behavior: contain; /* Prevent scroll chaining */
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-section {
  background: var(--surface, #ffffff);
  padding: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-color, #e5e7eb);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.section-heading {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: var(--text-primary, #111827);
}

/* Image Uploader */
.image-uploader {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background-color: var(--bg-secondary, #f3f4f6);
  border: 2px dashed var(--border-color, #d1d5db);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: all 0.2s;
}

.image-uploader.has-image {
  border-style: solid;
  border-color: transparent;
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
  gap: 0.5rem;
}

.upload-icon {
  color: var(--text-secondary, #6b7280); /* Darkened for contrast */
}

.image-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-uploader:hover .image-actions,
.image-uploader:focus-within .image-actions {
  opacity: 1;
}

.action-btn {
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 0.375rem;
  padding: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.upload-btn {
  padding: 0.5rem 1rem;
}

.action-btn:hover {
  background: #ffffff;
}

.delete-btn {
  color: #ef4444;
}

.hidden-input {
  display: none;
}

.upload-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color, #3b82f6);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  border-top-color: var(--primary-color, #3b82f6);
  animation: spin 1s linear infinite;
}

/* Inputs */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.input-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #374151); /* Darkened for contrast */
}

.required {
  color: #ef4444;
}

.form-input, .form-select {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 0.375rem;
  font-size: 0.95rem;
  background-color: var(--surface, #ffffff);
  color: var(--text-primary, #111827);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--primary-color, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.row-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.input-wrapper {
  position: relative;
}

.currency-symbol {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary, #6b7280); /* Darkened for contrast */
  pointer-events: none;
}

.form-input.has-prefix {
  padding-left: 2rem;
}

/* Promotion Card */
.promotion-card {
  border-left: 4px solid transparent;
  transition: all 0.3s;
}

.promotion-card.is-active {
  border-left-color: var(--primary-color, #3b82f6);
  background-color: #f0f9ff;
}

.promotion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.promotion-title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #e0f2fe;
  color: #0284c7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.section-desc {
  font-size: 0.8rem;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
  margin: 0;
}

/* Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--primary-color, #3b82f6);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

/* Promotion Body */
.promotion-body {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(0,0,0,0.05);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.active-status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.active-status-banner.active {
  background-color: #dcfce7;
  color: #166534;
}

.active-status-banner.scheduled {
  background-color: #fef9c3;
  color: #854d0e;
}

.active-status-banner.expired {
  background-color: #fee2e2;
  color: #991b1b;
}

.status-icon {
  margin-right: 0.5rem;
  font-size: 0.75rem;
}

.text-btn {
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
}

.text-btn.danger {
  color: #dc2626;
}

.price-calculation {
  background-color: rgba(255,255,255,0.6);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(0,0,0,0.05);
}

.calc-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
}

.calc-row.highlight {
  color: var(--text-primary, #111827);
  font-weight: 600;
  font-size: 1rem;
  margin-top: 0.5rem;
}

.original-price {
  text-decoration: line-through;
}

.final-price {
  color: var(--primary-color, #3b82f6);
}

.savings-tag {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background-color: #dcfce7;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 0.25rem;
}

/* Checkbox */
.checkbox-container {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 30px;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 20px;
  width: 20px;
  background-color: #eee;
  border-radius: 4px;
  transition: all 0.2s;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: #ccc;
}

.checkbox-container input:checked ~ .checkmark {
  background-color: var(--primary-color, #3b82f6);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 7px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Footer */
.modal-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background-color: var(--surface, #ffffff);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.375rem;
  font-weight: 500;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-secondary {
  background-color: white;
  border: 1px solid var(--border-color, #d1d5db);
  color: var(--text-primary, #374151);
}

.btn-secondary:hover {
  background-color: var(--bg-secondary, #f9fafb);
  border-color: #9ca3af;
}

.btn-primary {
  background-color: var(--primary-color, #3b82f6);
  border: 1px solid transparent;
  color: white;
}

.btn-primary:hover {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-danger {
  background-color: #ef4444;
  color: white;
  border: none;
}

.btn-danger:hover {
  background-color: #dc2626;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

/* Overlays */
.overlay-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.overlay-modal {
  background: white;
  border-radius: 0.75rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.overlay-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overlay-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.close-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.25rem;
  color: #6b7280;
}

.overlay-body {
  padding: 1.5rem;
}

.confirm-modal {
  text-align: center;
  max-width: 400px;
}

.confirm-icon-wrapper {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.overlay-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
</style>
