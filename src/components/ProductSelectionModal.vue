<script setup lang="ts">
import { ref, defineProps, watch, defineEmits, nextTick, computed } from "vue";
import { Alert } from "./composable/Alert.js";
import { XMarkIcon } from '@heroicons/vue/24/solid';
import type { ProductOption, SelectedItems } from '../types/product';
import { useProductsStore } from "../stores/productStores";
import { useCartStore } from "../stores/cartStores";
import { useTheme } from "../composables/useTheme";

const productStore = useProductsStore()
const cartStore = useCartStore()
const { isDark } = useTheme()
const props = defineProps<{
  isOpen: boolean;
  optData: any;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// Selected option ID as string to match ProductOption._id
const selectedOptionId = ref<string>("");

// Selected item details for UI
const selectedItem = ref<SelectedItems>({
  price: 0,
  label: "",
  img: "",
  productId: "",
  optionId: ""
});

// Computed property for available options (only those with stock > 0)
const availableOptions = computed(() => {
  return props.optData?.option?.filter((opt: ProductOption) => opt.stock > 0) || [];
});

const closeModal = () => emit('close');

// Format currency using the app's currency formatter
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

// When modal opens, initialize selection with first option
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && availableOptions.value.length > 0) {
      const firstOption = availableOptions.value[0];
      updateSelectedItem(firstOption);
    }
  },
  { immediate: true }
);

// Change selected option
const updateSelectedItem = (option: ProductOption) => {
  let finalPrice = option.price;
  let hasPromo = false;
  
  // Check for active promotion
  if (option.hasPromotion && option.promotion) {
    hasPromo = true;
    if (option.promotion.discountType === 'percentage') {
      finalPrice = option.price * (1 - option.promotion.discountValue / 100);
    } else if (option.promotion.discountType === 'fixed') {
      finalPrice = Math.max(0, option.price - option.promotion.discountValue);
    }
  }

  selectedItem.value = {
    price: finalPrice,
    label: option.label || '',
    img: option.imageUrl,
    optionId: option._id,
    productId: props.optData._id,
    originalPrice: option.price,
    hasPromotion: hasPromo,
    discountType: option.promotion?.discountType,
    discountValue: option.promotion?.discountValue,
    freeShipping: option.promotion?.freeShipping || false
  };
  selectedOptionId.value = option._id;
};

const handleOptionChange = (option: ProductOption) => {
  updateSelectedItem(option);
};

const localLoading = ref(false);

const addToCart = async () => {
  if (!selectedOptionId.value) {
    Alert("Please select a product option first.", "warning", "#c56c00");
    return;
  }
  localLoading.value = true;
  try {
    await productStore.addToCart(selectedItem.value.optionId, selectedItem.value.productId)
    closeModal();
  } finally {
    localLoading.value = false;
  }
}

</script>


<template>
  <transition name="modal-fade">
    <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-container" @click.stop>
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <div class="product-preview">
              <img :src="optData?.imageUrls?.[0] || selectedItem.img" :alt="optData?.name" class="product-thumb" />
              <div class="product-info">
                <h2 class="product-title">{{ optData?.name }}</h2>
                <p class="product-subtitle">Choose your preferred option</p>
              </div>
            </div>
          </div>
          <button @click="closeModal" class="close-button" aria-label="Close modal">
            <XMarkIcon class="close-icon" />
          </button>
        </div>

        <!-- Selected Option Display -->
        <div class="selected-option-section">
          <div class="selected-option-card">
            <div class="option-visual">
              <img :src="selectedItem.img" :alt="selectedItem.label" class="option-image" />
              <div v-if="selectedItem.hasPromotion" class="promotion-indicator">
                <span class="promotion-label">SALE</span>
              </div>
            </div>
            <div class="option-details">
              <h3 class="option-title">{{ selectedItem.label }}</h3>
              <div class="pricing-section">
                <div class="price-row">
                  <span class="current-price">{{ formatCurrency(selectedItem.price) }}</span>
                  <span v-if="selectedItem.hasPromotion" class="original-price">
                    {{ formatCurrency(selectedItem.originalPrice) }}
                  </span>
                </div>
                <div v-if="selectedItem.hasPromotion" class="savings-info">
                  <span class="savings-text">
                    Save {{ selectedItem.discountType === 'percentage' ? `${selectedItem.discountValue}%` : formatCurrency(selectedItem.discountValue) }}
                  </span>
                </div>
              </div>
              <div v-if="selectedItem.freeShipping" class="shipping-info">
                <span class="shipping-badge">🚚 Free Shipping</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Options Grid -->
        <div class="options-section">
          <div class="section-header">
            <h4 class="section-title">Available Options</h4>
            <span class="options-count">{{ availableOptions.length }} option{{ availableOptions.length !== 1 ? 's' : '' }}</span>
          </div>

          <div class="options-grid">
            <div
              v-for="(option, index) in availableOptions"
              :key="option._id"
              @click="handleOptionChange(option)"
              :class="['option-item', {
                'selected': selectedOptionId === option._id,
                'has-promotion': option.hasPromotion,
                'has-free-shipping': option.promotion?.freeShipping
              }]"
              :aria-label="`Select ${option.label}`"
              tabindex="0"
              @keydown.enter="handleOptionChange(option)"
              @keydown.space.prevent="handleOptionChange(option)"
            >
              <div class="option-visual">
                <img :src="option.imageUrl || selectedItem.img" :alt="option.label" class="option-thumb" />
                <div v-if="selectedOptionId === option._id" class="selection-indicator">
                  <div class="check-mark">✓</div>
                </div>
                <div v-if="option.hasPromotion" class="option-promotion-badge">
                  <span>SALE</span>
                </div>
              </div>

              <div class="option-content">
                <h5 class="option-name">{{ option.label }}</h5>
                <div class="option-meta">
                  <span class="stock-info">{{ option.stock }} in stock</span>
                  <div v-if="option.promotion?.freeShipping" class="free-shipping-indicator">
                    <span>Free shipping</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="action-section">
          <button
            @click="addToCart"
            :disabled="localLoading || !selectedOptionId"
            class="add-to-cart-button"
            :class="{ 'loading': localLoading }"
          >
            <template v-if="localLoading">
              <span class="loading-spinner"></span>
              <span class="button-text">Adding to Cart...</span>
            </template>
            <template v-else>
              <span class="button-text">Add to Cart</span>
              <span class="button-price">{{ formatCurrency(selectedItem.price) }}</span>
            </template>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>


<style scoped>
/* ==========================================================================
   MODAL OVERLAY & CONTAINER - Mobile First
   ========================================================================== */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.3s ease-out;
}

.modal-container {
  background: var(--surface, #ffffff);
  border-radius: 1.5rem;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border-color, #e0e0e0);
  display: flex;
  flex-direction: column;
  position: relative;
  animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ==========================================================================
   MODAL HEADER - Clean and Modern
   ========================================================================== */

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: var(--surface, #ffffff);
  position: relative;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.product-preview {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.product-thumb {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  object-fit: cover;
  border: 2px solid var(--border-color, #e0e0e0);
  flex-shrink: 0;
}

.product-info {
  min-width: 0;
  flex: 1;
}

.product-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #666666);
  margin: 0;
  font-weight: 500;
}

.close-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  color: var(--text-secondary, #666666);
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: -0.25rem;
  margin-right: -0.25rem;
}

.close-button:hover {
  background: var(--bg-secondary, #f8f9fa);
  color: var(--text-primary, #1a1a1a);
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* ==========================================================================
   SELECTED OPTION SECTION - Highlighted Display
   ========================================================================== */

.selected-option-section {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: linear-gradient(135deg, var(--bg-primary, #ffffff) 0%, var(--bg-secondary, #f8f9fa) 100%);
}

.selected-option-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface, #ffffff);
  border-radius: 1rem;
  border: 2px solid var(--primary-color, #1bab50);
  box-shadow: 0 4px 12px rgba(26, 171, 80, 0.1);
  position: relative;
  overflow: hidden;
}

.selected-option-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-color, #1bab50), var(--secondary-color, #ff6600));
}

.option-visual {
  position: relative;
  flex-shrink: 0;
}

.option-image {
  width: 4rem;
  height: 4rem;
  border-radius: 0.75rem;
  object-fit: cover;
  border: 2px solid var(--border-color, #e0e0e0);
}

.promotion-indicator {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  background: linear-gradient(135deg, var(--secondary-color, #ff6600), #ff8533);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(255, 102, 0, 0.3);
  z-index: 2;
}

.option-details {
  flex: 1;
  min-width: 0;
}

.option-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin: 0 0 0.5rem 0;
  line-height: 1.3;
}

.pricing-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.current-price {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-color, #1bab50);
}

.original-price {
  font-size: 1rem;
  color: var(--text-secondary, #666666);
  text-decoration: line-through;
  font-weight: 500;
}

.savings-info {
  margin-top: 0.25rem;
}

.savings-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--secondary-color, #ff6600);
  background: rgba(255, 102, 0, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  display: inline-block;
}

.shipping-info {
  margin-top: 0.5rem;
}

.shipping-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--success-color, #10b981);
  background: rgba(16, 185, 129, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

/* ==========================================================================
   OPTIONS SECTION - Grid Layout
   ========================================================================== */

.options-section {
  padding: 1.5rem;
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin: 0;
}

.options-count {
  font-size: 0.875rem;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--primary-color, #1bab50) transparent;
}

.option-item {
  background: var(--surface, #ffffff);
  border: 2px solid var(--border-color, #e0e0e0);
  border-radius: 0.75rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  overflow: hidden;
}

.option-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: var(--primary-color, #1bab50);
}

.option-item.selected {
  border-color: var(--primary-color, #1bab50);
  background: linear-gradient(135deg, rgba(26, 171, 80, 0.05), rgba(26, 171, 80, 0.02));
  box-shadow: 0 0 0 3px rgba(26, 171, 80, 0.1);
  transform: translateY(-2px);
}

.option-item.has-promotion {
  border-color: var(--secondary-color, #ff6600);
}

.option-item.has-free-shipping::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 20px 20px 0;
  border-color: transparent var(--success-color, #10b981) transparent transparent;
}

.option-visual {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
}

.option-thumb {
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
  object-fit: cover;
  border: 1px solid var(--border-color, #e0e0e0);
}

.selection-indicator {
  position: absolute;
  top: -0.5rem;
  left: -0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--primary-color, #1bab50);
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(26, 171, 80, 0.3);
  z-index: 3;
}

.check-mark {
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.option-promotion-badge {
  position: absolute;
  bottom: -0.25rem;
  right: -0.25rem;
  background: linear-gradient(135deg, var(--secondary-color, #ff6600), #ff8533);
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(255, 102, 0, 0.3);
  z-index: 2;
}

.option-content {
  text-align: center;
  width: 100%;
  min-width: 0;
}

.option-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.option-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

.stock-info {
  font-size: 0.75rem;
  color: var(--text-secondary, #666666);
  font-weight: 500;
}

.free-shipping-indicator {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--success-color, #10b981);
  background: rgba(16, 185, 129, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

/* ==========================================================================
   ACTION SECTION - CTA Button
   ========================================================================== */

.action-section {
  padding: 1.5rem;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--surface, #ffffff);
}

.add-to-cart-button {
  width: 100%;
  background: linear-gradient(135deg, var(--primary-color, #1bab50), #2e8b47);
  color: white;
  border: none;
  border-radius: 0.75rem;
  padding: 1rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  box-shadow: 0 4px 14px rgba(26, 171, 80, 0.3);
  position: relative;
  overflow: hidden;
}

.add-to-cart-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.add-to-cart-button:hover::before {
  left: 100%;
}

.add-to-cart-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(26, 171, 80, 0.4);
  filter: brightness(1.05);
}

.add-to-cart-button:active {
  transform: translateY(0);
}

.add-to-cart-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 14px rgba(26, 171, 80, 0.2);
}

.add-to-cart-button.loading {
  pointer-events: none;
}

.button-text {
  font-weight: 600;
  z-index: 1;
  display: flex;
  align-items: center;
  font-size: 1.05rem;
}

.button-price {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-weight: 700;
  font-size: 0.875rem;
  z-index: 1;
}

.loading-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2.5px solid rgba(255,255,255,0.5);
  border-top: 2.5px solid #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0;
  vertical-align: middle;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ==========================================================================
   ANIMATIONS & TRANSITIONS
   ========================================================================== */

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ==========================================================================
   RESPONSIVE DESIGN - Mobile First
   ========================================================================== */

/* Tablet and larger screens */
@media (min-width: 768px) {
  .modal-overlay {
    padding: 2rem;
  }

  .modal-container {
    max-width: 500px;
    max-height: 80vh;
  }

  .modal-header {
    padding: 2rem;
  }

  .selected-option-section,
  .options-section,
  .action-section {
    padding: 2rem;
  }

  .options-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .option-item {
    padding: 1rem;
  }

  .option-visual {
    width: 4rem;
    height: 4rem;
  }
}

/* Desktop screens */
@media (min-width: 1024px) {
  .modal-container {
    max-width: 520px;
  }

  .options-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* ==========================================================================
   ACCESSIBILITY & FOCUS STATES
   ========================================================================== */

.option-item:focus {
  outline: 2px solid var(--primary-color, #1bab50);
  outline-offset: 2px;
}

.close-button:focus {
  outline: 2px solid var(--primary-color, #1bab50);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .modal-container {
    border: 2px solid;
  }

  .option-item {
    border-width: 3px;
  }

  .selected-option-card {
    border-width: 3px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .modal-overlay,
  .modal-container,
  .option-item,
  .add-to-cart-button {
    animation: none;
    transition: none;
  }

  .add-to-cart-button::before {
    display: none;
  }
}

/* ==========================================================================
   DARK THEME SUPPORT
   ========================================================================== */

.theme-dark .modal-container {
  background: var(--bg-primary, #1a1f2e);
  border-color: var(--border-color, #374151);
}

.theme-dark .modal-header {
  border-color: var(--border-color, #374151);
  background: var(--bg-primary, #1a1f2e);
}

.theme-dark .selected-option-section {
  background: linear-gradient(135deg, var(--bg-primary, #1a1f2e) 0%, var(--surface, #232936) 100%);
  border-color: var(--border-color, #374151);
}

.theme-dark .selected-option-card {
  background: var(--surface, #232936);
  border-color: var(--primary-color, #1bab50);
}

.theme-dark .options-section {
  border-color: var(--border-color, #374151);
}

.theme-dark .option-item {
  background: var(--surface, #232936);
  border-color: var(--border-color, #374151);
}

.theme-dark .action-section {
  border-color: var(--border-color, #374151);
  background: var(--bg-primary, #1a1f2e);
}

/* ==========================================================================
   CUSTOM SCROLLBAR
   ========================================================================== */

.options-grid::-webkit-scrollbar {
  width: 6px;
}

.options-grid::-webkit-scrollbar-track {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 3px;
}

.options-grid::-webkit-scrollbar-thumb {
  background: var(--primary-color, #1bab50);
  border-radius: 3px;
}

.options-grid::-webkit-scrollbar-thumb:hover {
  background: var(--primary-color-2, #2e8b47);
}

/* ==========================================================================
   PRINT STYLES
   ========================================================================== */

@media print {
  .modal-overlay,
  .modal-container {
    display: none !important;
  }
}
</style>
