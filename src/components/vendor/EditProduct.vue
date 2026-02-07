<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { QuillEditor } from '@vueup/vue-quill'
import type { Product, EditProductForm, PromotionApiPayload, ApiResponse, ApiError } from '@/types/product'

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

interface Props {
  product: Product
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'product-updated': [product: Product]
  'update-cancelled': []
}>()

// Loading and error states
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

const hasOption = computed(() => !!props.product.option?.length)

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
  // Additional options to improve performance
  bounds: document.body,
  debug: false,
  readOnly: false,
  preserveWhitespace: false
}

// Description stats computation
const descriptionStats = computed(() => {
  const count = form.description ? form.description.length : 0
  const max = 5000
  const isWarning = count > max * 0.8
  const isError = count > max
  return { count, max, isWarning, isError }
})

const form = reactive<EditProductForm>({
  name: props.product.name,
  description: props.product.description,
  price: props.product.price || 0,
  stock: props.product.stock || 0,
  option: hasOption.value ? JSON.parse(JSON.stringify(props.product.option)).map(opt => ({
    ...opt,
    promotion: opt.promotion || {
      isActive: false,
      discountType: 'percentage',
      discountValue: 0,
      startDate: null,
      endDate: null,
      freeShipping: false
    }
  })) : [],
  promotion: props.product.promotion || {
    isActive: false,
    discountType: 'percentage',
    discountValue: 0,
    startDate: null,
    endDate: null,
    freeShipping: false
  },
  // J&T Shipping Profile
  weightKg: props.product.weightKg || null,
  lengthCm: props.product.lengthCm || null,
  widthCm: props.product.widthCm || null,
  heightCm: props.product.heightCm || null,
  // Shipping Discount
  shippingDiscountType: props.product.shippingDiscountType || 'NONE',
  shippingDiscountValue: props.product.shippingDiscountValue || 0
})

const addOption = () => {
  form.option.push({ 
    _id: `new_${Date.now()}`, // Temporary ID for new options
    label: '', 
    price: 0, 
    stock: 0, 
    imageUrl: '', 
    isHot: false, 
    sold: 0,
    updatedAt: new Date().toISOString(),
    promotion: {
      isActive: false,
      discountType: 'percentage',
      discountValue: 0,
      startDate: null,
      endDate: null,
      freeShipping: false
    }
  })
}

const removeOption = (index: number) => {
  form.option.splice(index, 1)
}

const endPromotion = () => {
  form.promotion.isActive = false
  form.promotion.discountType = 'percentage'
  form.promotion.discountValue = 0
  form.promotion.startDate = null
  form.promotion.endDate = null
  form.promotion.freeShipping = false
}

const endOptionPromotion = (index: number) => {
  const option = form.option[index]
  option.promotion.isActive = false
  option.promotion.discountType = 'percentage'
  option.promotion.discountValue = 0
  option.promotion.startDate = null
  option.promotion.endDate = null
  option.promotion.freeShipping = false
}

// API call functions
const updateProduct = async (): Promise<void> => {
  if (!props.product._id) {
    throw new Error('Product ID is required')
  }

  const response = await fetch(`${API_BASE_URL}/products/${props.product._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: form.name,
      description: form.description,
      price: hasOption.value ? undefined : form.price,
      stock: hasOption.value ? undefined : form.stock,
      option: hasOption.value ? form.option : undefined,
      // J&T Shipping Profile
      weightKg: form.weightKg || undefined,
      lengthCm: form.lengthCm || undefined,
      widthCm: form.widthCm || undefined,
      heightCm: form.heightCm || undefined,
      shippingDiscountType: form.shippingDiscountType,
      shippingDiscountValue: form.shippingDiscountType !== 'NONE' ? form.shippingDiscountValue : 0
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

const updatePromotion = async (): Promise<void> => {
  if (!props.product._id) {
    throw new Error('Product ID is required')
  }

  if (form.promotion.isActive && form.promotion.discountType !== 'none') {
    // Apply promotion
    const promotionData: PromotionApiPayload = {
      discountType: form.promotion.discountType,
      discountValue: form.promotion.discountValue,
      startDate: form.promotion.startDate || undefined,
      endDate: form.promotion.endDate || undefined,
      freeShipping: form.promotion.freeShipping
    }

    const response = await fetch(`${API_BASE_URL}/products/${props.product._id}/promotion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(promotionData)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `Failed to apply promotion: ${response.status}`)
    }
  } else {
    // Remove promotion
    const response = await fetch(`${API_BASE_URL}/products/${props.product._id}/promotion`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `Failed to remove promotion: ${response.status}`)
    }
  }
}

const updateOptionPromotions = async (): Promise<void> => {
  if (!props.product._id || !hasOption.value) return

  for (const option of form.option) {
    if (!option._id) continue

    if (option.promotion.isActive) {
      // Apply option promotion
      const promotionData: PromotionApiPayload = {
        discountType: option.promotion.discountType,
        discountValue: option.promotion.discountValue,
        startDate: option.promotion.startDate || undefined,
        endDate: option.promotion.endDate || undefined,
        freeShipping: option.promotion.freeShipping
      }

      const response = await fetch(`${API_BASE_URL}/products/${props.product._id}/option/${option._id}/promotion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(promotionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to apply promotion to option ${option.label}: ${response.status}`)
      }
    } else {
      // Remove option promotion
      const response = await fetch(`${API_BASE_URL}/products/${props.product._id}/option/${option._id}/promotion`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to remove promotion from option ${option.label}: ${response.status}`)
      }
    }
  }
}

const handleSubmit = async (): Promise<void> => {
  loading.value = true
  error.value = null
  success.value = false

  try {
    // Validate form
    if (!form.name.trim()) {
      throw new Error('Product name is required')
    }

    if (!form.description.trim()) {
      throw new Error('Product description is required')
    }

    if (!hasOption.value) {
      if (form.price <= 0) {
        throw new Error('Product price must be greater than 0')
      }
      
      if (form.stock < 0) {
        throw new Error('Product stock cannot be negative')
      }

      // Validate promotion
      if (form.promotion.isActive) {
        if (form.promotion.discountValue <= 0) {
          throw new Error('Promotion discount value must be greater than 0')
        }
        
        if (form.promotion.discountType === 'percentage' && form.promotion.discountValue > 100) {
          throw new Error('Percentage discount cannot exceed 100%')
        }
        
        if (form.promotion.discountType === 'fixed' && form.promotion.discountValue >= form.price) {
          throw new Error('Fixed discount cannot be greater than or equal to product price')
        }
      }
    } else {
      // Validate options
      for (let i = 0; i < form.option.length; i++) {
        const option = form.option[i]
        
        if (!option.label.trim()) {
          throw new Error(`Option ${i + 1}: Label is required`)
        }
        
        if (option.price <= 0) {
          throw new Error(`Option ${i + 1}: Price must be greater than 0`)
        }
        
        if (option.stock < 0) {
          throw new Error(`Option ${i + 1}: Stock cannot be negative`)
        }

        // Validate option promotion
        if (option.promotion.isActive) {
          if (option.promotion.discountValue <= 0) {
            throw new Error(`Option ${i + 1}: Promotion discount value must be greater than 0`)
          }
          
          if (option.promotion.discountType === 'percentage' && option.promotion.discountValue > 100) {
            throw new Error(`Option ${i + 1}: Percentage discount cannot exceed 100%`)
          }
          
          if (option.promotion.discountType === 'fixed' && option.promotion.discountValue >= option.price) {
            throw new Error(`Option ${i + 1}: Fixed discount cannot be greater than or equal to option price`)
          }
        }
      }
    }

    // Validate shipping profile (if any field is set, validate all)
    if (form.weightKg !== null || form.lengthCm !== null || form.widthCm !== null || form.heightCm !== null) {
      if (form.weightKg !== null && form.weightKg < 0.01) {
        throw new Error('Weight must be at least 0.01 kg')
      }
      if (form.lengthCm !== null && form.lengthCm < 1) {
        throw new Error('Length must be at least 1 cm')
      }
      if (form.widthCm !== null && form.widthCm < 1) {
        throw new Error('Width must be at least 1 cm')
      }
      if (form.heightCm !== null && form.heightCm < 1) {
        throw new Error('Height must be at least 1 cm')
      }
    }

    // Validate shipping discount
    if (form.shippingDiscountType === 'PERCENT' && form.shippingDiscountValue > 100) {
      throw new Error('Shipping discount percentage cannot exceed 100%')
    }
    if (form.shippingDiscountType === 'FIXED' && form.shippingDiscountValue < 0) {
      throw new Error('Shipping discount amount cannot be negative')
    }

    // Update product data
    const updatedProduct = await updateProduct()

    // Update promotions
    if (!hasOption.value) {
      await updatePromotion()
    } else {
      await updateOptionPromotions()
    }

    success.value = true
    setTimeout(() => {
      success.value = false
    }, 3000)

    // Emit success event
    emit('product-updated', updatedProduct)

    console.log('Product updated successfully:', updatedProduct)
  } catch (err) {
    const apiError = err as ApiError
    error.value = apiError.message || 'An unexpected error occurred'
    console.error('Product update error:', err)
  } finally {
    loading.value = false
  }
}

// Computed properties for UI feedback
const canSubmit = computed(() => {
  return !loading.value && form.name.trim() && form.description.trim()
})

const discountedPrice = (originalPrice: number, promotion: any) => {
  if (!promotion?.isActive || promotion.discountValue <= 0) return originalPrice
  
  if (promotion.discountType === 'percentage') {
    return originalPrice - (originalPrice * promotion.discountValue / 100)
  } else {
    return Math.max(0, originalPrice - promotion.discountValue)
  }
}
</script>


<template>
  <div class="edit-form-container">
    <h2>Edit Product</h2>

    <!-- Success Message -->
    <div v-if="success" class="alert alert-success">
      <span class="alert-icon">✅</span>
      Product updated successfully!
    </div>

    <!-- Error Message -->
    <div v-if="error" class="alert alert-error">
      <span class="alert-icon">❌</span>
      {{ error }}
    </div>

    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Product Name</label>
        <input v-model="form.name" type="text" required />
      </div>

      <div class="form-group">
        <div class="field-header">
          <label class="field-label">Description</label>
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

      <div v-if="!hasOption">
        <div class="form-group">
          <label>Price</label>
          <input v-model.number="form.price" type="number" required />
        </div>

        <div class="form-group">
          <label>Stock</label>
          <input v-model.number="form.stock" type="number" required />
        </div>

        <!-- Promotion Section for Non-Option Products -->
        <div class="promotion-section">
          <div class="promotion-header">
            <div>
              <h3>Promotional Offer</h3>
              <p class="section-description">Create or modify special discounts and free shipping offers</p>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.promotion.isActive">
              <span class="toggle-slider"></span>
              <span class="toggle-label">{{ form.promotion.isActive ? 'Active' : 'Inactive' }}</span>
            </label>
          </div>

          <div v-if="form.promotion.isActive" class="promotion-fields">
            <!-- Discount Type -->
            <div class="form-group">
              <label>Discount Type</label>
              <div class="discount-type-buttons">
                <button type="button" 
                  :class="['discount-type-btn', { active: form.promotion.discountType === 'percentage' }]"
                  @click="form.promotion.discountType = 'percentage'">
                  <span class="discount-icon">%</span>
                  Percentage Off
                </button>
                <button type="button"
                  :class="['discount-type-btn', { active: form.promotion.discountType === 'fixed' }]"
                  @click="form.promotion.discountType = 'fixed'">
                  <span class="discount-icon">₱</span>
                  Fixed Amount
                </button>
              </div>
            </div>

            <!-- Discount Value -->
            <div class="form-group" v-if="form.promotion.discountType !== 'none'">
              <label>
                {{ form.promotion.discountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₱)' }}
              </label>
              <input v-model.number="form.promotion.discountValue" 
                type="number" 
                min="0" 
                :max="form.promotion.discountType === 'percentage' ? 100 : undefined"
                step="0.01"
                :placeholder="form.promotion.discountType === 'percentage' ? '10' : '50.00'" />
              <p class="field-hint" v-if="form.promotion.discountType === 'percentage' && form.promotion.discountValue > 0">
                Sale Price: ₱{{ discountedPrice(form.price, form.promotion).toFixed(2) }}
              </p>
              <p class="field-hint" v-if="form.promotion.discountType === 'fixed' && form.promotion.discountValue > 0">
                Sale Price: ₱{{ discountedPrice(form.price, form.promotion).toFixed(2) }}
              </p>
            </div>

            <!-- Free Shipping -->
            <div class="form-group">
              <label class="checkbox-field">
                <input type="checkbox" v-model="form.promotion.freeShipping">
                <span class="checkbox-label">
                  <span class="shipping-icon">🚚</span>
                  Offer free shipping on this product
                </span>
              </label>
            </div>

            <!-- Date Range -->
            <div class="form-grid">
              <div class="form-group">
                <label>Start Date (Optional)</label>
                <input v-model="form.promotion.startDate" 
                  type="datetime-local" />
                <p class="field-hint">Leave empty to start immediately</p>
              </div>

              <div class="form-group">
                <label>End Date (Optional)</label>
                <input v-model="form.promotion.endDate" 
                  type="datetime-local"
                  :min="form.promotion.startDate || undefined" />
                <p class="field-hint">Leave empty for ongoing offer</p>
              </div>
            </div>

            <!-- End Offer Button -->
            <button type="button" 
              class="end-offer-button" 
              @click="endPromotion"
              v-if="form.promotion.isActive">
              🚫 End Offer Now
            </button>
          </div>
        </div>
      </div>

      <div v-else>
        <h3>Options</h3>
        <div v-for="(opt, index) in form.option" :key="index" class="option-group">
          <div class="form-group">
            <label>Label</label>
            <input v-model="opt.label" type="text" required />
          </div>

          <div class="form-group">
            <label>Price</label>
            <input v-model.number="opt.price" type="number" required />
          </div>

          <div class="form-group">
            <label>Stock</label>
            <input v-model.number="opt.stock" type="number" required />
          </div>

          <div class="form-group">
            <label>Image URL</label>
            <input v-model="opt.imageUrl" type="text" />
          </div>

          <!-- Promotion for Option -->
          <div class="option-promotion-section">
            <div class="promotion-header">
              <h4>Variant Promotion</h4>
              <label class="toggle-switch-small">
                <input type="checkbox" v-model="opt.promotion.isActive">
                <span class="toggle-slider-small"></span>
              </label>
            </div>

            <div v-if="opt.promotion.isActive" class="promotion-fields-compact">
              <div class="form-group">
                <label>Type</label>
                <select v-model="opt.promotion.discountType" class="select-input">
                  <option value="percentage">% Percentage</option>
                  <option value="fixed">₱ Fixed Amount</option>
                </select>
              </div>

              <div class="form-group">
                <label>Value</label>
                <input v-model.number="opt.promotion.discountValue" 
                  type="number" 
                  min="0"
                  :max="opt.promotion.discountType === 'percentage' ? 100 : undefined"
                  step="0.01" />
              </div>

              <div class="form-group">
                <label class="checkbox-field-small">
                  <input type="checkbox" v-model="opt.promotion.freeShipping">
                  <span>🚚 Free Shipping</span>
                </label>
              </div>

              <button type="button" 
                class="end-offer-button-small" 
                @click="endOptionPromotion(index)">
                End Offer
              </button>
            </div>
          </div>

          <button type="button" class="remove-button" @click="removeOption(index)">Remove Option</button>
        </div>

        <button type="button" class="add-button" @click="addOption">Add Option</button>
      </div>

      <!-- J&T Shipping Profile Section -->
      <div class="form-group">
        <h3 class="section-title">📦 J&T Shipping Profile (Optional)</h3>
        <p class="section-description">Update weight and dimensions for J&T Express shipping</p>
        
        <div class="shipping-grid">
          <div class="form-field">
            <label>Weight (kg)</label>
            <input
              type="number"
              v-model.number="form.weightKg"
              step="0.01"
              min="0.01"
              placeholder="0.50"
            />
            <p class="field-hint">Minimum 0.01 kg</p>
          </div>

          <div class="form-field">
            <label>Length (cm)</label>
            <input
              type="number"
              v-model.number="form.lengthCm"
              step="1"
              min="1"
              placeholder="10"
            />
            <p class="field-hint">Minimum 1 cm</p>
          </div>

          <div class="form-field">
            <label>Width (cm)</label>
            <input
              type="number"
              v-model.number="form.widthCm"
              step="1"
              min="1"
              placeholder="10"
            />
            <p class="field-hint">Minimum 1 cm</p>
          </div>

          <div class="form-field">
            <label>Height (cm)</label>
            <input
              type="number"
              v-model.number="form.heightCm"
              step="1"
              min="1"
              placeholder="5"
            />
            <p class="field-hint">Minimum 1 cm</p>
          </div>
        </div>

        <div class="shipping-discount-section">
          <h4>Shipping Discount</h4>
          <p class="section-description">Offer customers a discount on J&T shipping for this product</p>
          
          <div class="discount-grid">
            <div class="form-field">
              <label>Discount Type</label>
              <select v-model="form.shippingDiscountType">
                <option value="NONE">No Discount</option>
                <option value="FIXED">Fixed Amount (₱)</option>
                <option value="PERCENT">Percentage (%)</option>
              </select>
            </div>

            <div class="form-field" v-if="form.shippingDiscountType !== 'NONE'">
              <label>
                {{ form.shippingDiscountType === 'FIXED' ? 'Discount Amount (₱)' : 'Discount Percentage (%)' }}
              </label>
              <input
                type="number"
                v-model.number="form.shippingDiscountValue"
                :step="form.shippingDiscountType === 'FIXED' ? '0.01' : '1'"
                :min="0"
                :max="form.shippingDiscountType === 'PERCENT' ? 100 : undefined"
                :placeholder="form.shippingDiscountType === 'FIXED' ? '10.00' : '15'"
              />
              <p class="field-hint" v-if="form.shippingDiscountType === 'PERCENT'">Maximum 100%</p>
              <p class="field-hint" v-else>Enter the discount amount in pesos</p>
            </div>
          </div>

          <div v-if="form.shippingDiscountType !== 'NONE' && form.shippingDiscountValue > 0" class="discount-preview">
            <p>
              <strong>Customer will save:</strong>
              {{ form.shippingDiscountType === 'FIXED' 
                ? `₱${form.shippingDiscountValue.toFixed(2)}` 
                : `${form.shippingDiscountValue}%` 
              }}
              on J&T shipping for this product
            </p>
          </div>
        </div>
      </div>

      <button 
        type="submit" 
        class="submit-button" 
        :disabled="!canSubmit"
        :class="{ 'loading': loading }"
      >
        <span v-if="loading" class="loading-spinner"></span>
        {{ loading ? 'Saving Changes...' : 'Save Changes' }}
      </button>
    </form>
  </div>
</template>



<style scoped>
.edit-form-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  color: var(--text-primary);
}

/* Alert Styles */
.alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.alert-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white !important;
  border: 1px solid #10b981;
}

.alert-error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white !important;
  border: 1px solid #ef4444;
}

.alert-icon {
  font-size: 1.2rem;
}

h2, h3 {
  margin-bottom: 1rem;
  font-size: 1.5rem;
  color: var(--text-primary);
  font-weight: 600;
}

h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

input[type="text"],
input[type="number"],
input[type="datetime-local"],
textarea,
.select-input {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.3s ease;
}

input[type="text"]:focus,
input[type="number"]:focus,
input[type="datetime-local"]:focus,
textarea:focus,
.select-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

textarea {
  min-height: 100px;
  resize: vertical;
}

/* Shipping Profile Styles */
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.section-description {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 16px 0;
}

.shipping-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.shipping-discount-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.discount-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.discount-preview {
  padding: 16px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(22, 163, 74, 0.08));
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  color: var(--text-primary);
}

.field-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .shipping-grid,
  .discount-grid {
    grid-template-columns: 1fr;
  }
}

button {
  padding: 0.5rem 1rem;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}

.submit-button {
  background: linear-gradient(135deg, var(--color-primary) 0%, #764ba2 100%);
  color: #fff !important;
  position: relative;
  transition: all 0.3s ease;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  width: 100%;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.submit-button:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
  box-shadow: none;
}

.submit-button.loading {
  background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
  cursor: wait;
}

.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.add-button {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #fff;
  margin-bottom: 1rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
}

.add-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

.remove-button {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
  margin-top: 0.5rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  transition: all 0.3s ease;
}

.remove-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
}

.option-group {
  border: 1.5px dashed var(--border-color);
  padding: 1.25rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
}

.option-group:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

/* Promotion Section Styles */
.promotion-section {
  margin: 2rem 0;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1.5px solid var(--border-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;
}

.promotion-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  pointer-events: none;
}

.promotion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
  position: relative;
  z-index: 1;
}

.promotion-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--text-primary, #111827); /* Darkened for contrast */
  font-weight: 700;
}

.section-description {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
}

.toggle-switch {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toggle-switch input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
  background-color: var(--border-color);
  border-radius: 26px;
  transition: background-color 0.3s;
  cursor: pointer;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  background-color: var(--bg-primary);
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch input[type="checkbox"]:checked + .toggle-slider {
  background-color: var(--color-primary);
}

.toggle-switch input[type="checkbox"]:checked + .toggle-slider::before {
  transform: translateX(24px);
}

.toggle-label {
  color: var(--text-primary, #111827); /* Darkened for contrast */
  font-weight: 600;
  font-size: 0.9rem;
}

.promotion-fields {
  background: var(--bg-primary);
  padding: 1.5rem;
  border-radius: 10px;
  margin-top: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 1;
}

.promotion-fields .form-group label {
  color: var(--text-primary, #374151); /* Darkened for contrast */
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.discount-type-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 0.5rem;
}

.discount-type-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary, #374151); /* Darkened for contrast */
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s;
  cursor: pointer;
}

.discount-type-btn:hover {
  border-color: var(--color-primary);
  background: var(--bg-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.discount-type-btn.active {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, var(--color-primary) 0%, #764ba2 100%);
  color: white !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.discount-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.field-hint {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary, #4b5563); /* Darkened for contrast */
  font-weight: 600;
  opacity: 1; /* Removed opacity for better readability */
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 8px;
  transition: all 0.3s;
}

.checkbox-field:hover {
  border-color: var(--color-primary);
  background: var(--bg-primary);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.checkbox-field input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--text-primary, #374151); /* Darkened for contrast */
}

.shipping-icon {
  font-size: 1.2rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.end-offer-button {
  width: 100%;
  padding: 0.75rem;
  margin-top: 1rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.3s;
}

.end-offer-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

/* Option Promotion Styles */
.option-promotion-section {
  margin-top: 1rem;
  padding: 1.25rem;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.option-promotion-section:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.toggle-switch-small {
  position: relative;
  display: inline-block;
}

.toggle-switch-small input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider-small {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  background-color: var(--border-color);
  border-radius: 20px;
  transition: background-color 0.3s;
  cursor: pointer;
}

.toggle-slider-small::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 2px;
  top: 2px;
  background-color: var(--bg-primary);
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-switch-small input[type="checkbox"]:checked + .toggle-slider-small {
  background-color: var(--color-primary);
}

.toggle-switch-small input[type="checkbox"]:checked + .toggle-slider-small::before {
  transform: translateX(20px);
}

.promotion-fields-compact {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.checkbox-field-small {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.checkbox-field-small input[type="checkbox"] {
  width: auto;
  margin: 0;
}

.end-offer-button-small {
  grid-column: span 2;
  padding: 0.5rem;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white !important;
  font-weight: 600;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.end-offer-button-small:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

@media (max-width: 768px) {
  .form-grid, .discount-type-buttons, .promotion-fields-compact {
    grid-template-columns: 1fr;
  }
  
  .end-offer-button-small {
    grid-column: span 1;
  }
}

/* Quill Editor Styles */
.field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.field-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.field-optional {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 400;
}

.description-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quill-editor-custom {
  background: white;
  border-radius: 8px;
  border: 1.5px solid var(--border-color);
  transition: all 0.2s ease;
  min-height: 300px;
}

.quill-editor-custom:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

:deep(.ql-container) {
  font-size: 0.95rem;
  border: none;
  border-radius: 0 0 8px 8px;
}

:deep(.ql-editor) {
  min-height: 250px;
  max-height: 500px;
  padding: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
}

:deep(.ql-toolbar) {
  border: none;
  border-bottom: 1.5px solid var(--border-color);
  border-radius: 8px 8px 0 0;
  background: var(--bg-secondary);
}

:deep(.ql-toolbar .ql-formats) {
  margin-right: 0.75rem;
}

:deep(.ql-toolbar button:hover),
:deep(.ql-toolbar button:focus),
:deep(.ql-toolbar button.ql-active),
:deep(.ql-toolbar.ql-snow .ql-picker-label:hover),
:deep(.ql-toolbar.ql-snow .ql-picker-item:hover) {
  color: var(--color-primary);
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border-radius: 0 0 8px 8px;
  font-size: 0.85rem;
}

.editor-stats {
  display: flex;
  gap: 0.5rem;
}

.char-count {
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-primary);
  transition: all 0.2s ease;
}

.char-count.warning {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}

.char-count.error {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.editor-hint {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-style: italic;
}

.hint-icon {
  font-size: 1rem;
}

.hint-text {
  font-size: 0.8rem;
}
</style>
