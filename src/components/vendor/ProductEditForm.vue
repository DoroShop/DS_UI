<script setup lang="ts">
import { reactive, ref, onMounted, computed } from "vue";
import axios from "axios";
import { QuillEditor } from "@vueup/vue-quill";
import CropperModal from "./ImageCropper.vue";
import { useVendorDashboardStore } from "../../stores/vendor/dashboardStores";
import { dataUrlToFile } from "../../utils/convertToFile";
import type { Product, Promotion } from "../../types/product";

const getStore = () => useVendorDashboardStore();

interface CropPayload {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  format: string;
}

interface ProductFormData {
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrls: string[];
  municipality: string;
  categories: string[];
  promotion: Promotion;
  // J&T Shipping Profile
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  shippingDiscountType: 'NONE' | 'FIXED' | 'PERCENT';
  shippingDiscountValue: number;
}

const props = defineProps<{ product: Product }>();
const emit = defineEmits<{
  submit: [product: Partial<Product>];
  cancel: [];
  successfullUpdate: [];
}>();

const form = reactive<ProductFormData>({
  name: "",
  description: "",
  price: 0,
  stock: 0,
  imageUrls: [],
  municipality: "",
  categories: [],
  promotion: {
    isActive: false,
    discountType: 'none',
    discountValue: 0,
    startDate: '',
    endDate: ''
  },
  weightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  shippingDiscountType: 'NONE',
  shippingDiscountValue: 0
});

const originalImageUrls = ref<string[]>([]);
const deletedImages = ref<string[]>([]);
const isUpdating = ref(false);
const uploadProgress = ref(0);
const cropperVisible = ref(false);
const cropImageSrc = ref("");
let currentCropIndex: number | null = null;
const validationErrors = ref<string[]>([]);

const fixedCategories = [
  "Native Delicacies",
  "Dried Fish & Seafood",
  "Fruits & Produce",
  "Local Snacks",
  "Herbal & Wellness Products",
  "Coffee & Cacao",
  "Honey Products",
  "Handicrafts",
  "Woodcrafts",
  "Woven Products",
  "Souvenir Items",
  "Condiments & Spices",
  "Apparel & Accessories",
];

const activeTab = ref('Details');

// Quill editor configuration
const editorOptions = {
  theme: 'snow',
  placeholder: 'Describe your product in detail...',
  modules: {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  },
  bounds: document.body,
  debug: false,
  readOnly: false,
  preserveWhitespace: false
};

// Description stats
const descriptionStats = computed(() => {
  const count = form.description ? form.description.length : 0;
  const max = 5000;
  return { count, max, isWarning: count > max * 0.8, isError: count > max };
});

// Promotion Preview
const finalPrice = computed(() => {
  if (!form.promotion.isActive || !form.promotion.discountValue) return form.price;
  if (form.promotion.discountType === 'percentage') {
    return form.price - (form.price * form.promotion.discountValue) / 100;
  }
  return Math.max(0, form.price - form.promotion.discountValue);
});

const savings = computed(() => form.price - finalPrice.value);

// J&T Shipping validation
const shippingValid = computed(() => {
  return (
    form.weightKg !== null && form.weightKg > 0 &&
    form.lengthCm !== null && form.lengthCm > 0 &&
    form.widthCm !== null && form.widthCm > 0 &&
    form.heightCm !== null && form.heightCm > 0
  );
});

const shippingMissing = computed(() => {
  const missing: string[] = [];
  if (!form.weightKg || form.weightKg <= 0) missing.push('Weight');
  if (!form.lengthCm || form.lengthCm <= 0) missing.push('Length');
  if (!form.widthCm || form.widthCm <= 0) missing.push('Width');
  if (!form.heightCm || form.heightCm <= 0) missing.push('Height');
  return missing;
});

// Category management (fixed list only)
function toggleCategory(category: string) {
  const index = form.categories.indexOf(category);
  if (index !== -1) {
    form.categories.splice(index, 1);
  } else {
    if (form.categories.length >= 3) return;
    form.categories.push(category);
  }
}

onMounted(() => {
  // Filter categories to only include valid fixedCategories entries
  // This cleans up any corrupted entries (e.g. &amp; encoding from previous saves)
  const loadedCategories = [...(props.product.categories || [])];
  const validCategories = loadedCategories.filter(cat => fixedCategories.includes(cat));

  Object.assign(form, {
    name: props.product.name,
    description: props.product.description || "",
    price: props.product.price,
    stock: props.product.stock,
    imageUrls: [...props.product.imageUrls],
    municipality: props.product.municipality,
    categories: validCategories,
    promotion: props.product.promotion ? { ...props.product.promotion } : {
      isActive: false,
      discountType: 'none',
      discountValue: 0,
      startDate: '',
      endDate: ''
    },
    weightKg: props.product.weightKg ?? null,
    lengthCm: props.product.lengthCm ?? null,
    widthCm: props.product.widthCm ?? null,
    heightCm: props.product.heightCm ?? null,
    shippingDiscountType: props.product.shippingDiscountType || 'NONE',
    shippingDiscountValue: props.product.shippingDiscountValue || 0,
  });
  originalImageUrls.value = [...props.product.imageUrls];
  deletedImages.value = [];
});

const isExisting = (url: string): boolean =>
  originalImageUrls.value.includes(url) || /^https?:\/\//i.test(url);

function extractPublicIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const uploadMatch = url.match(/\/upload\/(.*)/);
    if (!uploadMatch) return null;
    let pathAfterUpload = uploadMatch[1];
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    const transformationPattern = /^(?:[a-z]_[^/,]+(?:,[a-z]_[^/,]+)*\/)+/;
    pathAfterUpload = pathAfterUpload.replace(transformationPattern, '');
    pathAfterUpload = pathAfterUpload.replace(/\.[^/.]+$/, '');
    return pathAfterUpload || null;
  } catch (error) {
    console.error('Extract Public ID Error:', error);
    return null;
  }
}

function onImageChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) form.imageUrls.push(result);
    };
    reader.readAsDataURL(file);
  });
  (event.target as HTMLInputElement).value = "";
}

function openCropper(index: number) {
  currentCropIndex = index;
  cropImageSrc.value = form.imageUrls[index];
  cropperVisible.value = true;
}

function applyCrop(payload: CropPayload) {
  const reader = new FileReader();
  reader.onload = () => {
    if (currentCropIndex !== null) {
      form.imageUrls[currentCropIndex] = reader.result as string;
    }
    cropperVisible.value = false;
    currentCropIndex = null;
  };
  reader.readAsDataURL(payload.blob);
}

function removeImage(index: number) {
  const imageUrl = form.imageUrls[index];
  if (originalImageUrls.value.includes(imageUrl) && imageUrl.includes('cloudinary.com')) {
    deletedImages.value.push(imageUrl);
  }
  form.imageUrls.splice(index, 1);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const endpoint = `${API_BASE_URL}/upload`;

async function deleteRemovedImagesFromCloudinary(): Promise<void> {
  if (deletedImages.value.length === 0) return;
  try {
    const publicIds = deletedImages.value
      .map(url => extractPublicIdFromUrl(url))
      .filter(id => id !== null) as string[];
    if (publicIds.length === 0) return;
    const response = await axios.delete(`${API_BASE_URL}/upload/delete-batch`, {
      data: { publicIds }
    });
    console.log('Cloudinary deletion result:', response.data);
  } catch (error: any) {
    console.error('Failed to delete images from Cloudinary:', error);
  }
}

async function uploadNewImagesIfAny(): Promise<string[]> {
  const newImages = form.imageUrls.filter(
    (url) => !isExisting(url) && (url.startsWith("data:") || url.startsWith("blob:"))
  );
  if (newImages.length === 0) {
    uploadProgress.value = 100;
    return form.imageUrls;
  }
  const formData = new FormData();
  let index = 0;
  for (const src of newImages) {
    if (src.startsWith("data:")) {
      formData.append("images", dataUrlToFile(src, index++));
    } else {
      const blob = await fetch(src).then((res) => res.blob());
      const ext = blob.type.split("/")[1] || "jpg";
      formData.append(
        "images",
        new File([blob], `upload-${Date.now()}-${index++}.${ext}`, { type: blob.type })
      );
    }
  }
  uploadProgress.value = 0;
  try {
    const response = await axios.post(endpoint, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (evt.total) {
          uploadProgress.value = Math.round((evt.loaded / evt.total) * 100);
        }
      },
    });
    const uploadedUrls = response.data.images?.map((i: any) => i.url) || response.data.urls || [];
    return [...form.imageUrls.filter(isExisting), ...uploadedUrls];
  } catch (error: any) {
    console.error("Upload failed:", error);
    throw new Error(error.response?.data?.message || "Upload failed");
  }
}

function validate(): boolean {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Product name is required.");
  if (form.price <= 0) errors.push("Price must be greater than 0.");
  if (!form.weightKg || form.weightKg <= 0) errors.push("Weight (kg) is required for J&T shipping.");
  if (!form.lengthCm || form.lengthCm <= 0) errors.push("Length (cm) is required for J&T shipping.");
  if (!form.widthCm || form.widthCm <= 0) errors.push("Width (cm) is required for J&T shipping.");
  if (!form.heightCm || form.heightCm <= 0) errors.push("Height (cm) is required for J&T shipping.");
  validationErrors.value = errors;
  return errors.length === 0;
}

async function handleSubmit() {
  if (isUpdating.value) return;
  if (!validate()) {
    activeTab.value = validationErrors.value.some(e => e.includes('J&T')) ? 'Shipping' : 'Details';
    return;
  }

  try {
    isUpdating.value = true;
    uploadProgress.value = 0;

    const finalImageUrls = await uploadNewImagesIfAny();
    const payload: Partial<Product> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price,
      stock: form.stock,
      imageUrls: finalImageUrls,
      municipality: form.municipality.trim(),
      categories: form.categories,
      promotion: form.promotion,
      weightKg: form.weightKg,
      lengthCm: form.lengthCm,
      widthCm: form.widthCm,
      heightCm: form.heightCm,
    };

    emit("submit", payload);
    await getStore().updateBaseProduct(props.product._id, payload);
    await deleteRemovedImagesFromCloudinary();
    
    emit("successfullUpdate");
    uploadProgress.value = 100;
  } catch (err: any) {
    console.error(err);
    alert(err.message || "Failed to update product");
  } finally {
    isUpdating.value = false;
  }
}
</script>

<template>
  <div class="product-edit-card">
    <div class="card-header">
      <h3>Edit Product</h3>
      <div class="tabs-header">
        <button 
          :class="['tab-btn', { active: activeTab === 'Details' }]"
          @click="activeTab = 'Details'"
        >
          Details
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'Shipping' }]"
          @click="activeTab = 'Shipping'"
        >
          Shipping
          <span v-if="!shippingValid" class="badge-dot warn"></span>
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'Promotion' }]"
          @click="activeTab = 'Promotion'"
        >
          Promotion
          <span v-if="form.promotion.isActive" class="badge-dot"></span>
        </button>
      </div>
    </div>

    <!-- Validation Errors Banner -->
    <div v-if="validationErrors.length > 0" class="validation-banner">
      <strong>Please fix the following:</strong>
      <ul>
        <li v-for="(err, i) in validationErrors" :key="i">{{ err }}</li>
      </ul>
    </div>

    <form @submit.prevent="handleSubmit" class="form-content">
      
      <!-- DETAILS TAB -->
      <div v-show="activeTab === 'Details'" class="tab-pane">
        <!-- Name -->
        <div class="form-group">
          <label for="name">Product Name <span class="required">*</span></label>
          <input id="name" v-model="form.name" type="text" required class="form-input" placeholder="e.g. Handmade Basket" />
        </div>

        <!-- Description -->
        <div class="form-group">
          <div class="field-header">
            <label for="description">Description</label>
            <span class="field-optional">(Optional)</span>
          </div>
          <div class="description-editor">
            <QuillEditor
              v-model:content="form.description"
              :options="editorOptions"
              contentType="html"
              class="quill-editor-custom"
              placeholder="Describe your product in detail..."
            />
            <div class="editor-footer">
              <div class="editor-stats">
                <span 
                  class="char-count" 
                  :class="{ 
                    warning: descriptionStats.isWarning && !descriptionStats.isError,
                    error: descriptionStats.isError 
                  }"
                >
                  {{ descriptionStats.count }}/{{ descriptionStats.max }}
                </span>
              </div>
              <div class="editor-hint">
                <span class="hint-icon">💡</span>
                <span class="hint-text">Use formatting to highlight features and specifications</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-row">
          <!-- Price -->
          <div class="form-group">
            <label for="price">Price (₱) <span class="required">*</span></label>
            <input id="price" v-model.number="form.price" type="number" min="0" step="0.01" required class="form-input" />
          </div>

          <!-- Stock -->
          <div class="form-group">
            <label for="stock">Stock <span class="required">*</span></label>
            <input id="stock" v-model.number="form.stock" type="number" min="0" required class="form-input" />
          </div>
        </div>

        <!-- Municipality (auto from shop, read-only) -->
        <div class="form-group">
          <label for="municipality">Municipality</label>
          <input id="municipality" :value="form.municipality" type="text" class="form-input read-only-input" readonly disabled />
          <span class="field-hint">Auto-set from your shop location</span>
        </div>

        <!-- Categories (fixed list) -->
        <div class="form-group">
          <div class="category-header">
            <label>🏷️ Categories</label>
            <span class="category-count">{{ form.categories.length }}/3</span>
          </div>
          <p class="field-hint">Select up to 3 categories that best describe your product</p>
          <div class="category-chips-grid">
            <button
              v-for="cat in fixedCategories"
              :key="cat"
              type="button"
              :class="['category-chip-btn', { selected: form.categories.includes(cat) }]"
              @click="toggleCategory(cat)"
              :disabled="!form.categories.includes(cat) && form.categories.length >= 3"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <!-- Images -->
        <div class="form-group">
          <label>Product Images</label>
          <div class="file-upload-wrapper">
            <input type="file" accept="image/*" multiple @change="onImageChange" class="file-input" id="file-upload" />
            <label for="file-upload" class="file-upload-label">
              <span class="icon">📷</span>
              <span>Click to upload images</span>
            </label>
          </div>
          
          <div v-if="form.imageUrls.length > 0" class="image-preview-grid">
            <div v-for="(img, idx) in form.imageUrls" :key="idx" class="image-preview-item">
              <img :src="img" alt="Preview" class="preview-img" />
              <div class="image-actions">
                <button type="button" class="action-btn edit" @click="openCropper(idx)" title="Crop">✂️</button>
                <button type="button" class="action-btn delete" @click="removeImage(idx)" title="Remove">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SHIPPING TAB -->
      <div v-show="activeTab === 'Shipping'" class="tab-pane">
        <div class="shipping-notice" :class="{ 'valid': shippingValid, 'invalid': !shippingValid }">
          <div class="notice-icon">{{ shippingValid ? '✅' : '⚠️' }}</div>
          <div class="notice-content">
            <h4>{{ shippingValid ? 'Shipping info complete' : 'J&T Shipping info required' }}</h4>
            <p v-if="!shippingValid">Missing: {{ shippingMissing.join(', ') }}. All dimensions are mandatory for J&T delivery.</p>
            <p v-else>All required shipping dimensions are set.</p>
          </div>
        </div>

        <div class="section-title">📦 Package Dimensions</div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="weightKg">Weight (kg) <span class="required">*</span></label>
            <input id="weightKg" v-model.number="form.weightKg" type="number" min="0.01" step="0.01" class="form-input" placeholder="e.g. 0.5" />
          </div>
          <div class="form-group">
            <label for="lengthCm">Length (cm) <span class="required">*</span></label>
            <input id="lengthCm" v-model.number="form.lengthCm" type="number" min="1" step="0.1" class="form-input" placeholder="e.g. 30" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="widthCm">Width (cm) <span class="required">*</span></label>
            <input id="widthCm" v-model.number="form.widthCm" type="number" min="1" step="0.1" class="form-input" placeholder="e.g. 20" />
          </div>
          <div class="form-group">
            <label for="heightCm">Height (cm) <span class="required">*</span></label>
            <input id="heightCm" v-model.number="form.heightCm" type="number" min="1" step="0.1" class="form-input" placeholder="e.g. 15" />
          </div>
        </div>

        <div class="section-title">🏷️ Shipping Discount</div>

        <div class="shipping-discount-info">
          <div v-if="form.shippingDiscountType !== 'NONE'" class="discount-status active">
            <span class="discount-badge">
              {{ form.shippingDiscountType === 'PERCENT'
                ? `${form.shippingDiscountValue}% off`
                : `₱${form.shippingDiscountValue.toFixed(2)} off` }}
            </span>
            <span>shipping fee</span>
          </div>
          <div v-else class="discount-status inactive">
            <span>No shipping discount active</span>
          </div>
          <p class="discount-hint">
            Manage shipping discounts from the <strong>Shipping Discounts</strong> page in the sidebar.
          </p>
        </div>
      </div>

      <!-- PROMOTION TAB -->
      <div v-show="activeTab === 'Promotion'" class="tab-pane">
        <div class="promotion-toggle-card">
          <div class="toggle-info">
            <h4>Enable Promotion</h4>
            <p>Offer discounts for this product.</p>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="form.promotion.isActive">
            <span class="slider round"></span>
          </label>
        </div>

        <div v-if="form.promotion.isActive" class="promotion-form">
          <div class="form-group">
            <label>Discount Type</label>
            <div class="radio-group">
              <label :class="['radio-card', { active: form.promotion.discountType === 'percentage' }]">
                <input type="radio" v-model="form.promotion.discountType" value="percentage">
                <span class="radio-content">
                  <span class="radio-icon">%</span>
                  <span class="radio-label">Percentage Off</span>
                </span>
              </label>
              <label :class="['radio-card', { active: form.promotion.discountType === 'fixed' }]">
                <input type="radio" v-model="form.promotion.discountType" value="fixed">
                <span class="radio-content">
                  <span class="radio-icon">₱</span>
                  <span class="radio-label">Fixed Amount</span>
                </span>
              </label>
            </div>
          </div>

          <div class="form-group" v-if="form.promotion.discountType !== 'none'">
            <label>
              {{ form.promotion.discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₱)' }}
            </label>
            <input 
              v-model.number="form.promotion.discountValue" 
              type="number" 
              min="0" 
              :max="form.promotion.discountType === 'percentage' ? 100 : undefined"
              step="0.01"
              class="form-input"
              :placeholder="form.promotion.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50.00'" 
            />
            
            <!-- Price Preview -->
            <div class="price-preview" v-if="form.promotion.discountValue > 0">
              <div class="preview-row">
                <span>Original Price:</span>
                <span class="original-price">₱{{ form.price.toFixed(2) }}</span>
              </div>
              <div class="preview-row highlight">
                <span>New Price:</span>
                <span class="new-price">₱{{ finalPrice.toFixed(2) }}</span>
              </div>
              <div class="preview-badge">
                Save ₱{{ savings.toFixed(2) }}
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input v-model="form.promotion.startDate" type="datetime-local" class="form-input" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input v-model="form.promotion.endDate" type="datetime-local" class="form-input" :min="form.promotion.startDate || undefined" />
            </div>
          </div>
        </div>
        
        <div v-else class="empty-state">
          <span class="empty-icon">🏷️</span>
          <p>Activate promotion to see options</p>
        </div>
      </div>

      <!-- Actions Footer -->
      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="btn btn-secondary" :disabled="isUpdating">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="isUpdating">
          <span v-if="!isUpdating">Update Product</span>
          <span v-else>Updating... {{ uploadProgress > 0 ? `(${uploadProgress}%)` : '' }}</span>
        </button>
      </div>
    </form>

    <!-- Crop Modal -->
    <div v-if="cropperVisible" class="modal-backdrop">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Crop Image</h3>
          <button @click="cropperVisible = false" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <CropperModal :imageSrc="cropImageSrc" @crop="applyCrop" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-edit-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border-primary, #e2e8f0);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 1.5rem 2rem 0;
  background: var(--surface, #fff);
  border-bottom: 1px solid var(--border-primary, #eee);
}

.card-header h3 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
  color: var(--text-primary, #2c3e50);
  font-weight: 700;
}

/* Tabs */
.tabs-header {
  display: flex;
  gap: 2rem;
}

.tab-btn {
  background: none;
  border: none;
  padding: 0.75rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-tertiary, #94a3b8);
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover {
  color: var(--text-secondary, #64748b);
}

.tab-btn.active {
  color: var(--color-primary, #3b82f6);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--color-primary, #3b82f6);
}

.badge-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--color-danger, #ef4444);
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: top;
}

.badge-dot.warn {
  background: var(--color-warning, #f59e0b);
}

/* Validation Banner */
.validation-banner {
  margin: 0 2rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  color: var(--color-danger, #ef4444);
  font-size: 0.85rem;
  margin-top: 1rem;
}

.validation-banner strong {
  display: block;
  margin-bottom: 0.25rem;
}

.validation-banner ul {
  margin: 0;
  padding-left: 1.25rem;
}

.validation-banner li {
  margin-bottom: 0.125rem;
}

/* Required asterisk */
.required {
  color: var(--color-danger, #ef4444);
}

/* Form Content */
.form-content {
  padding: 2rem;
  background-color: var(--bg-secondary, #f8fafc);
}

.tab-pane {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--text-secondary, #475569);
  font-size: 0.9rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--input-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.2s;
  background: var(--input-bg, #f8fafc);
  color: var(--input-text);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--input-border-focus, #3b82f6);
  background: var(--input-bg, #fff);
  box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1);
}

/* File Upload */
.file-upload-wrapper {
  position: relative;
  margin-bottom: 1rem;
}

.file-input {
  position: absolute;
  width: 0.1px;
  height: 0.1px;
  opacity: 0;
  overflow: hidden;
  z-index: -1;
}

.file-upload-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px dashed var(--border-secondary, #cbd5e1);
  border-radius: 8px;
  background: var(--bg-secondary, #f8fafc);
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary, #64748b);
  font-weight: 500;
}

.file-upload-label:hover {
  border-color: var(--color-primary, #3b82f6);
  background: var(--bg-tertiary, #eff6ff);
  color: var(--color-primary, #3b82f6);
}

/* Read-only input */
.read-only-input {
  background: var(--bg-secondary, #f1f5f9) !important;
  color: var(--text-secondary, #64748b) !important;
  cursor: not-allowed;
  opacity: 0.8;
}

.field-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 0.35rem;
}

/* Category fixed picker */
.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.category-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.category-chip-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--surface, #fff);
  color: var(--text-primary, #1e293b);
  border: 1px solid var(--border-primary, #e2e8f0);
}

.category-chip-btn:hover:not(:disabled):not(.selected) {
  border-color: var(--color-primary, #1bab50);
  color: var(--color-primary, #1bab50);
}

.category-chip-btn.selected {
  background: var(--color-primary, #1bab50);
  color: #fff;
  border-color: var(--color-primary, #1bab50);
}

.category-chip-btn:disabled:not(.selected) {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Shipping Discount Info Block */
.shipping-discount-info {
  padding: 1rem 1.25rem;
  border-radius: 10px;
  border: 1px solid var(--border-primary, #e2e8f0);
  background: var(--bg-secondary, #f8fafc);
}

.discount-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
}

.discount-status.active .discount-badge {
  display: inline-flex;
  padding: 0.2rem 0.625rem;
  background: #dcfce7;
  color: #16a34a;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.discount-status.inactive {
  color: var(--text-secondary, #64748b);
}

.discount-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
  margin: 0;
}

.discount-hint strong {
  color: var(--color-primary, #1bab50);
}

/* Shipping Notice */
.shipping-notice {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 1px solid;
}

.shipping-notice.valid {
  background: rgba(22, 163, 74, 0.06);
  border-color: rgba(22, 163, 74, 0.2);
}

.shipping-notice.invalid {
  background: rgba(245, 158, 11, 0.06);
  border-color: rgba(245, 158, 11, 0.25);
}

.notice-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.notice-content h4 {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
  color: var(--text-primary, #1e293b);
}

.notice-content p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
}

.section-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary, #1e293b);
  margin-bottom: 1rem;
  margin-top: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-primary, #e2e8f0);
}

.image-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 1rem;
}

.image-preview-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-primary, #e2e8f0);
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-preview-item:hover .image-actions {
  opacity: 1;
}

.action-btn {
  background: var(--surface, #fff);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: scale(1.1);
}

.action-btn.delete {
  color: var(--color-danger, #ef4444);
}

/* Promotion Styles */
.promotion-toggle-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: var(--color-info-light, #f0f9ff);
  border: 1px solid var(--border-secondary, #bae6fd);
  border-radius: 8px;
  margin-bottom: 2rem;
}

.toggle-info h4 {
  margin: 0 0 0.25rem;
  color: var(--color-info-text, #0369a1);
}

.toggle-info p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-info-text, #0c4a6e);
}

/* Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
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
  background-color: var(--border-secondary, #cbd5e1);
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--color-primary, #3b82f6);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

/* Radio Cards */
.radio-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}

.radio-card {
  display: block;
  cursor: pointer;
  position: relative;
}

.radio-card input {
  position: absolute;
  opacity: 0;
}

.radio-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem;
  border: 2px solid var(--border-primary, #e2e8f0);
  border-radius: 8px;
  transition: all 0.2s;
}

.radio-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
  color: var(--text-secondary, #64748b);
}

.radio-card.active .radio-content {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}

.radio-card.active .radio-icon {
  color: var(--color-primary, #3b82f6);
}

/* Price Preview */
.price-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 8px;
  border: 1px dashed var(--border-secondary, #cbd5e1);
}

.preview-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
}

.preview-row.highlight {
  color: var(--text-primary, #0f172a);
  font-weight: 600;
  font-size: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary, #e2e8f0);
}

.original-price {
  text-decoration: line-through;
}

.new-price {
  color: var(--color-danger, #ef4444);
}

.preview-badge {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: var(--color-success-light, #dcfce7);
  color: var(--color-success-text, #166534);
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 999px;
}

/* Checkbox */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.checkbox-wrapper input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  height: 20px;
  width: 20px;
  background-color: var(--surface, #fff);
  border: 2px solid var(--border-secondary, #cbd5e1);
  border-radius: 4px;
  margin-right: 10px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-wrapper:hover .checkbox-custom {
  border-color: var(--color-primary, #3b82f6);
}

.checkbox-wrapper input:checked ~ .checkbox-custom {
  background-color: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
}

.checkbox-custom:after {
  content: "";
  position: absolute;
  display: none;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-wrapper input:checked ~ .checkbox-custom:after {
  display: block;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-tertiary, #94a3b8);
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Footer */
.form-actions {
  padding: 1.5rem 2rem;
  background: var(--bg-secondary, #f8fafc);
  border-top: 1px solid var(--border-primary, #eee);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.95rem;
}

.btn-secondary {
  background: var(--btn-secondary-bg, #e2e8f0);
  color: var(--btn-secondary-text, #475569);
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover, #cbd5e1);
}

.btn-primary {
  background: var(--btn-primary-bg, #3b82f6);
  color: var(--btn-primary-text, white);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.btn-primary:hover {
  background: var(--btn-primary-hover, #2563eb);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

/* Modal for Cropper */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--modal-backdrop, rgba(0, 0, 0, 0.5));
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--modal-bg, white);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--modal-border, #e2e8f0);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
}

.modal-body {
  padding: 1.5rem;
  background-color: var(--bg-secondary, #f8fafc);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .radio-group {
    grid-template-columns: 1fr;
  }
}

/* Quill Editor Styles */
.field-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.field-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.field-optional {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  font-weight: 400;
}

.description-editor {
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.quill-editor-custom {
  min-height: 250px;
}

.quill-editor-custom :deep(.ql-container) {
  font-size: 0.95rem;
  font-family: inherit;
  border: none;
  padding: 1rem;
}

.quill-editor-custom :deep(.ql-editor) {
  min-height: 200px;
  max-height: 500px;
  padding: 0;
  color: var(--text-primary);
}

.quill-editor-custom :deep(.ql-editor.ql-blank::before) {
  color: var(--text-tertiary);
  font-style: normal;
}

.quill-editor-custom :deep(.ql-toolbar) {
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  padding: 0.75rem;
  border-radius: 0;
}

.quill-editor-custom :deep(.ql-toolbar.ql-snow .ql-stroke) {
  stroke: var(--text-secondary);
}

.quill-editor-custom :deep(.ql-toolbar.ql-snow .ql-fill),
.quill-editor-custom :deep(.ql-toolbar.ql-snow .ql-stroke.ql-fill) {
  fill: var(--text-secondary);
}

.quill-editor-custom :deep(.ql-toolbar.ql-snow button:hover .ql-stroke),
.quill-editor-custom :deep(.ql-toolbar.ql-snow button:focus .ql-stroke),
.quill-editor-custom :deep(.ql-toolbar.ql-snow button.ql-active .ql-stroke) {
  stroke: var(--color-primary);
}

.quill-editor-custom :deep(.ql-toolbar.ql-snow button:hover .ql-fill),
.quill-editor-custom :deep(.ql-toolbar.ql-snow button:focus .ql-fill),
.quill-editor-custom :deep(.ql-toolbar.ql-snow button.ql-active .ql-fill) {
  fill: var(--color-primary);
}

.editor-footer {
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.editor-stats {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.char-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 0.25rem 0.5rem;
  background: var(--surface);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

.char-count.warning {
  color: var(--color-warning);
  border-color: var(--color-warning);
  background: rgba(255, 193, 7, 0.1);
}

.char-count.error {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: rgba(255, 76, 76, 0.1);
}

.editor-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--text-tertiary);
}

.hint-icon {
  font-size: 0.9rem;
}

.hint-text {
  max-width: 300px;
}

@media (max-width: 768px) {
  .editor-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .quill-editor-custom :deep(.ql-container) {
    padding: 0.75rem;
  }

  .quill-editor-custom :deep(.ql-editor) {
    min-height: 150px;
  }

  .quill-editor-custom :deep(.ql-toolbar) {
    padding: 0.5rem;
  }
}
</style>
