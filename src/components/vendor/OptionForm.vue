<script setup lang="ts">
import { reactive, ref, defineProps, computed, defineEmits } from 'vue'
import axios from 'axios'
import CropperModal from './ImageCropper.vue'
import { useVendorDashboardStore } from '../../stores/vendor/dashboardStores'


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const endpoint = `${API_BASE_URL}/upload`
const getStore = () => useVendorDashboardStore()

const props = defineProps({
  productId: String
})

interface Promotion {
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startDate?: string
  endDate?: string
  freeShipping?: boolean
}

interface OptionFormData {
  imageUrl: string
  price: number
  label: string
  stock: number
}

const emit = defineEmits<{
  submit: [option: OptionFormData]
  cancel: []
}>()

const form = reactive<OptionFormData>({
  imageUrl: '',
  price: 0,
  label: '',
  stock: 0,
})

const cropperVisible = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const activeTab = ref('Details')

// Promotion states
const hasPromotion = ref(false)
const promotionForm = reactive<Promotion>({
  discountType: 'percentage',
  discountValue: 0,
  startDate: '',
  endDate: '',
  freeShipping: false
})

// Computed
const finalPrice = computed(() => {
  if (!hasPromotion.value || !promotionForm.discountValue) return form.price
  if (promotionForm.discountType === 'percentage') {
    return form.price - (form.price * promotionForm.discountValue) / 100
  }
  return Math.max(0, form.price - promotionForm.discountValue)
})

const savings = computed(() => {
  return form.price - finalPrice.value
})

function onImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => (form.imageUrl = ev.target?.result as string)
  reader.readAsDataURL(file)
    ; (e.target as HTMLInputElement).value = ''
}

function removeImage() {
  form.imageUrl = ''
}

function openCropper() {
  cropperVisible.value = true
}

function applyCrop(payload: { blob: Blob; url: string }) {
  const reader = new FileReader()
  reader.onload = () => {
    form.imageUrl = reader.result as string
    cropperVisible.value = false
  }
  reader.readAsDataURL(payload.blob)
}

async function handleSubmit() {
  if (form.price <= 0) return alert('Please enter a valid price greater than 0')
  try {
    isUploading.value = true
    
    // Store the label to identify the newly created option
    const optionLabel = form.label || 'Unnamed'
    
    await getStore().addOption(props.productId || '', form)
    
    // If promotion is enabled, fetch the updated product and find the new option by label
    if (hasPromotion.value && promotionForm.discountValue > 0) {
      // Get updated product from store
      const product = getStore().vendorProducts.find(p => p._id === props.productId)
      if (product && product.option && product.option.length > 0) {
        // Find the newly added option (it should be the last one or match by label)
        const newOption = product.option[product.option.length - 1]
        if (newOption && newOption._id) {
          await applyPromotion(newOption._id)
        }
      }
    }
    
    Object.assign(form, { imageUrl: '', price: 0, label: '', stock: 0 })
    hasPromotion.value = false
    Object.assign(promotionForm, {
      discountType: 'percentage',
      discountValue: 0,
      startDate: '',
      endDate: '',
      freeShipping: false
    })
    activeTab.value = 'Details' // Reset tab
  } catch (e: any) {
    alert(e.message || 'Failed to add option')
  } finally {
    isUploading.value = false
  }
}

async function applyPromotion(optionId: string) {
  try {
    const promotionPayload = {
      discountType: promotionForm.discountType,
      discountValue: promotionForm.discountValue,
      startDate: promotionForm.startDate || undefined,
      endDate: promotionForm.endDate || undefined,
      freeShipping: promotionForm.freeShipping
    }
    
    await axios.post(
      `${API_BASE_URL}/products/${props.productId}/option/${optionId}/promotion`,
      promotionPayload
    )
  } catch (error: any) {
    console.error('Failed to apply promotion:', error)
    alert(error.response?.data?.message || 'Failed to apply promotion to new variant')
  }
}
</script>

<template>
  <div class="option-form-card">
    <div class="card-header">
      <h3>Add New Option</h3>
      <div class="tabs-header">
        <button 
          :class="['tab-btn', { active: activeTab === 'Details' }]"
          @click="activeTab = 'Details'"
        >
          Details
        </button>
        <button 
          :class="['tab-btn', { active: activeTab === 'Promotion' }]"
          @click="activeTab = 'Promotion'"
        >
          Promotion
          <span v-if="hasPromotion" class="badge-dot"></span>
        </button>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="form-content">
      
      <!-- DETAILS TAB -->
      <div v-show="activeTab === 'Details'" class="tab-pane">
        <!-- Option Label -->
        <div class="form-group">
          <label for="label">Option Label</label>
          <input id="label" v-model="form.label" type="text" placeholder="e.g., Large Size, Blue Color"
            class="form-input" />
        </div>

        <div class="form-row">
          <!-- Price -->
          <div class="form-group">
            <label for="price">Price *</label>
            <input id="price" v-model.number="form.price" type="number" step="0.01" min="0" required placeholder="0.00"
              class="form-input" />
          </div>

          <!-- Stock -->
          <div class="form-group">
            <label for="stock">Stock</label>
            <input id="stock" v-model.number="form.stock" type="number" min="0" placeholder="0" class="form-input" />
          </div>
        </div>

        <!-- Image Upload + Preview -->
        <div class="form-group">
          <label>Option Image</label>
          <div class="file-upload-wrapper">
            <input type="file" accept="image/*" @change="onImageChange" class="file-input" id="option-file-upload" />
            <label for="option-file-upload" class="file-upload-label">
              <span class="icon">📷</span>
              <span>Click to upload image</span>
            </label>
          </div>
          
          <div v-if="form.imageUrl" class="image-preview-single">
            <img :src="form.imageUrl" alt="Preview" class="preview-img" />
            <div class="image-actions">
              <button type="button" class="action-btn edit" @click="openCropper" title="Crop">✂️</button>
              <button type="button" class="action-btn delete" @click="removeImage" title="Remove">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <!-- PROMOTION TAB -->
      <div v-show="activeTab === 'Promotion'" class="tab-pane">
        <div class="promotion-toggle-card">
          <div class="toggle-info">
            <h4>Enable Promotion</h4>
            <p>Offer discounts or free shipping for this variant.</p>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="hasPromotion">
            <span class="slider round"></span>
          </label>
        </div>

        <div v-if="hasPromotion" class="promotion-form">
          <div class="form-group">
            <label>Discount Type</label>
            <div class="radio-group">
              <label :class="['radio-card', { active: promotionForm.discountType === 'percentage' }]">
                <input type="radio" v-model="promotionForm.discountType" value="percentage">
                <span class="radio-content">
                  <span class="radio-icon">%</span>
                  <span class="radio-label">Percentage Off</span>
                </span>
              </label>
              <label :class="['radio-card', { active: promotionForm.discountType === 'fixed' }]">
                <input type="radio" v-model="promotionForm.discountType" value="fixed">
                <span class="radio-content">
                  <span class="radio-icon">₱</span>
                  <span class="radio-label">Fixed Amount</span>
                </span>
              </label>
            </div>
          </div>

          <div class="form-group">
            <label>
              {{ promotionForm.discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₱)' }}
            </label>
            <input 
              v-model.number="promotionForm.discountValue" 
              type="number" 
              min="0" 
              :max="promotionForm.discountType === 'percentage' ? 100 : undefined"
              step="0.01"
              class="form-input"
              :placeholder="promotionForm.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50.00'" 
            />
            
            <!-- Price Preview -->
            <div class="price-preview" v-if="promotionForm.discountValue > 0">
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

          <div class="form-group">
            <label class="checkbox-wrapper">
              <input type="checkbox" v-model="promotionForm.freeShipping">
              <span class="checkbox-custom"></span>
              <span class="checkbox-label">Offer Free Shipping 🚚</span>
            </label>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input v-model="promotionForm.startDate" type="date" class="form-input" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input v-model="promotionForm.endDate" type="date" class="form-input" :min="promotionForm.startDate || undefined" />
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
        <button type="submit" class="btn btn-primary" :disabled="isUploading">
          <span v-if="!isUploading">Add Option</span>
          <span v-else>Adding...</span>
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
          <CropperModal :imageSrc="form.imageUrl" @crop="applyCrop" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.option-form-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  overflow: hidden;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
}

.card-header {
  padding: 1.5rem 2rem 0;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.card-header h3 {
  margin: 0 0 1.5rem;
  font-size: 1.25rem;
  color: #2c3e50;
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
  color: #94a3b8;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tab-btn:hover {
  color: #64748b;
}

.tab-btn.active {
  color: #3b82f6;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 100%;
  height: 2px;
  background: #3b82f6;
}

.badge-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  margin-left: 4px;
  vertical-align: top;
}

/* Form Content */
.form-content {
  padding: 2rem;
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
  color: #475569;
  font-size: 0.9rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: all 0.2s;
  background: #f8fafc;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s;
  color: #64748b;
  font-weight: 500;
}

.file-upload-label:hover {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
}

.image-preview-single {
  position: relative;
  width: 150px;
  height: 150px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
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

.image-preview-single:hover .image-actions {
  opacity: 1;
}

.action-btn {
  background: #fff;
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
  color: #ef4444;
}

/* Promotion Styles */
.promotion-toggle-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.toggle-info h4 {
  margin: 0 0 0.25rem;
  color: #0369a1;
}

.toggle-info p {
  margin: 0;
  font-size: 0.875rem;
  color: #0c4a6e;
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
  background-color: #cbd5e1;
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
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

/* Radio Cards */
.radio-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.2s;
}

.radio-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  font-weight: 700;
  color: #64748b;
}

.radio-card.active .radio-content {
  border-color: #3b82f6;
  background: #eff6ff;
}

.radio-card.active .radio-icon {
  color: #3b82f6;
}

/* Price Preview */
.price-preview {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #64748b;
}

.preview-row.highlight {
  color: #0f172a;
  font-weight: 600;
  font-size: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.original-price {
  text-decoration: line-through;
}

.new-price {
  color: #ef4444;
}

.preview-badge {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #dcfce7;
  color: #166534;
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
  background-color: #fff;
  border: 2px solid #cbd5e1;
  border-radius: 4px;
  margin-right: 10px;
  position: relative;
  transition: all 0.2s;
}

.checkbox-wrapper:hover .checkbox-custom {
  border-color: #3b82f6;
}

.checkbox-wrapper input:checked ~ .checkbox-custom {
  background-color: #3b82f6;
  border-color: #3b82f6;
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
  color: #94a3b8;
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
  background: #f8fafc;
  border-top: 1px solid #eee;
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

.btn-primary {
  background: #3b82f6;
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.btn-primary:hover {
  background: #2563eb;
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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
}

.modal-body {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .radio-group {
    grid-template-columns: 1fr;
  }
}
</style>
