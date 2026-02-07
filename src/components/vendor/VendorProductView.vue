<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
  type Ref,
} from "vue";
import { useRouter } from "vue-router";
import OptionForm from "./OptionForm.vue";
import OptionEditForm from "./OptionEditForm.vue";
import ProductEditForm from "./ProductEditForm.vue";
import {
  Product,
  ProductOption as Option,
} from "../../types/product";
import { formatToPHCurrency } from "../../utils/currencyFormat";
import { useVendorDashboardStore } from "../../stores/vendor/dashboardStores";
import { confirmAndDeleteVariant } from "../composable/Alert";

/* Heroicons (outline) */
import {
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
  SparklesIcon,
} from "@heroicons/vue/24/outline";

const vendorDashboardStore = useVendorDashboardStore();
const router = useRouter();

/* -----------------------------------
   Props & Emits
----------------------------------- */
const props = defineProps<{
  product: Product;
}>();

const emit = defineEmits<{
  close: [];
  "add-option": [productId: string, option: Omit<Option, "_id">];
  "update-product": [productId: string, product: Partial<Product>];
  "update-option": [
    productId: string,
    optionId: string,
    option: Partial<Option>
  ];
  "promotionUpdated": [];
}>();

/* -----------------------------------
   Local UI State
----------------------------------- */
const showAddForm = ref(false);
const editingProduct = ref(false);
const editingOption = ref<string | null>(null);

/* show/hide modal fade scale handled by wrapper appear */
const isMounted = ref(false); // for transition enter

/* -----------------------------------
   Focus Trap
----------------------------------- */
const modalRoot: Ref<HTMLElement | null> = ref(null);
let lastActiveEl: Element | null = null;

function trapFocus(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const root = modalRoot.value;
  if (!root) return;
  const focusable = root.querySelectorAll<
    HTMLElement
  >(
    'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      (last as HTMLElement).focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      (first as HTMLElement).focus();
    }
  }
}

function handleEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeModal();
}

/* -----------------------------------
   Mount / Unmount Side Effects
----------------------------------- */
onMounted(() => {
  lastActiveEl = document.activeElement;
  document.addEventListener("keydown", trapFocus);
  document.addEventListener("keydown", handleEsc);
  document.body.style.overflow = "hidden";
  // trigger enter transition
  requestAnimationFrame(() => (isMounted.value = true));
  // focus close btn after render
  nextTick(() => {
    modalRoot.value?.querySelector<HTMLElement>(".close-btn")?.focus();
  });
});

onUnmounted(() => {
  document.removeEventListener("keydown", trapFocus);
  document.removeEventListener("keydown", handleEsc);
  document.body.style.overflow = "";
  if (lastActiveEl instanceof HTMLElement) lastActiveEl.focus();
});

/* -----------------------------------
   Computed Safe Product Data
----------------------------------- */
const productImage = computed(() => {
  const imgs = props.product?.imageUrls ?? [];
  return imgs.length ? imgs[0] : "https://via.placeholder.com/600x400?text=No+Image";
});

const productDescription = computed(
  () => props.product?.description?.trim() || "No description."
);

const productStock = computed(() => props.product?.stock ?? 0);
const productSold = computed(() => props.product?.sold ?? 0);
const productRating = computed(() =>
  Number.isFinite(props.product?.averageRating)
    ? props.product.averageRating.toFixed(1)
    : "0.0"
);

/* Some products may have `option` missing; normalize */
const productOptions = computed<Option[]>(() => {
  const raw: any = (props.product as any).option ?? (props.product as any).options;
  return Array.isArray(raw) ? raw : [];
});

/* -----------------------------------
   UI Event Handlers
----------------------------------- */
function closeModal() {
  // fade out then emit close
  isMounted.value = false;
  setTimeout(() => emit("close"), 160); // match CSS leave
}

function handleOverlayClick() {
  closeModal();
}

function toggleEditProduct() {
  editingProduct.value = !editingProduct.value;
  if (editingProduct.value) {
    showAddForm.value = false;
    editingOption.value = null;
  }
}

function handleUpdateProduct(updatedProduct: Partial<Product>) {
  emit("update-product", props.product._id, updatedProduct);
  editingProduct.value = false;
}

function startEditOption(optionId: string) {
  editingOption.value = optionId;
  showAddForm.value = false;
  editingProduct.value = false;
}

async function handleUpdateOption() {
  editingOption.value = null;
  // Refresh product data to show updated promotions
  await vendorDashboardStore.fetchVendor();
  // Emit event to parent to refresh promotion data
  emit('promotionUpdated');
}

function handlePromotionUpdate() {
  // Handle promotion ended event
  handleUpdateOption();
}

async function handleDeleteOption(productId: string, variantId: string) {
  try {
    const { isConfirmed } = await confirmAndDeleteVariant();
    if (!isConfirmed) return;
    await vendorDashboardStore.deleteProduct(productId, variantId);
  } catch (error) {
    console.error(error);
  }
}

async function deleteProduct(productId: string) {
  try {
    const { isConfirmed } = await confirmAndDeleteVariant();
    if (!isConfirmed) return;
    await vendorDashboardStore.deleteProduct(productId, null);
    closeModal();
  } catch (error) {
    console.error("Failed to delete product:", error);
  }
}

/* Reset sub-states if product prop changes (rare but safe) */
watch(
  () => props.product._id,
  () => {
    editingProduct.value = false;
    editingOption.value = null;
    showAddForm.value = false;
  }
);
</script>

<template>
  <div
    class="modal-overlay"
    :class="{ 'is-open': isMounted }"
    @click="handleOverlayClick"
  >
    <div
      ref="modalRoot"
      class="modal-content"
      role="dialog"
      aria-modal="true"
      :aria-label="product.name"
      @click.stop
    >
      <!-- Header -->
      <div class="modal-header">
        <h2 class="modal-title">
          <SparklesIcon class="icon" />
          {{ product.name }}
        </h2>
        <button
          @click="closeModal"
          class="close-btn"
          aria-label="Close"
          type="button"
        >
          <XMarkIcon class="icon" />
        </button>
      </div>

      <div class="modal-body">
        <!-- PRODUCT SUMMARY (hidden when editing product) -->
        <transition name="fade">
          <div
            v-if="!editingProduct"
            class="product-details"
          >
            <img
              :src="productImage"
              :alt="product.name"
              class="product-image"
            />

            <div class="product-info">
              <div v-if="productDescription" class="description-content" v-html="productDescription"></div>
              <p v-else class="description">No description available.</p>
              <div class="meta-info">
                <div class="meta-item">
                  <span class="label">Stock:</span>
                  <span class="value">{{ productStock }}</span>
                </div>
                <div class="meta-item">
                  <span class="label">Sold:</span>
                  <span class="value">{{ productSold }}</span>
                </div>
                <div class="meta-item">
                  <span class="label">Rating:</span>
                  <span class="value">{{ productRating }}/5</span>
                </div>
                <div class="meta-item">
                  <span class="label">Price:</span>
                  <span class="value price">{{ formatToPHCurrency(product.price) }}</span>
                </div>
              </div>
            </div>
          </div>
        </transition>

        <!-- Header Actions -->
        <div class="header-actions" v-if="!editingProduct">
          <button
            @click="toggleEditProduct"
            class="btn tiny outline"
            type="button"
          >
            <PencilSquareIcon class="icon mini" /> Edit Product
          </button>
          <button
            @click="deleteProduct(product._id)"
            class="btn tiny danger outline"
            type="button"
          >
            <TrashIcon class="icon mini" /> Delete Product
          </button>
        </div>

        <!-- EDIT PRODUCT FORM -->
        <transition name="slide-v">
          <ProductEditForm
            v-if="editingProduct"
            :product="product"
            @successfullUpdate="closeModal"
            @submit="handleUpdateProduct"
            @cancel="editingProduct = false"
          />
        </transition>

        <!-- Rejection Reason Banner -->
        <div v-if="product.status === 'rejected' && product.rejectionReason" class="rejection-banner">
          <div class="rejection-banner-icon">⚠️</div>
          <div class="rejection-banner-content">
            <strong>Product Rejected by Admin</strong>
            <p>{{ product.rejectionReason }}</p>
            <span v-if="product.rejectedAt" class="rejection-date">Rejected on {{ new Date(product.rejectedAt).toLocaleDateString() }}</span>
          </div>
        </div>

        <!-- Pending Review Banner -->
        <div v-if="product.status === 'pending_review'" class="pending-banner">
          <div class="pending-banner-icon">🕐</div>
          <div class="pending-banner-content">
            <strong>Awaiting Admin Approval</strong>
            <p>This product is under review. You can still edit it while waiting.</p>
          </div>
        </div>

        <!-- OPTIONS SECTION -->
        <div class="options-section">
          <div class="section-header">
            <h3>Product Options</h3>
            <button
              v-if="!showAddForm && product.isOption"
              @click="showAddForm = true"
              class="btn tiny outline"
              type="button"
            >
              <PlusCircleIcon class="icon mini" /> Add Option
            </button>
            <span v-if="!product.isOption" class="no-options-hint">
              Standard product — variants not available
            </span>
          </div>

          <!-- ADD OPTION FORM (only for optioned products) -->
          <transition name="slide-v">
            <OptionForm
              v-if="showAddForm && product.isOption"
              :productId="product._id"
              @cancel="showAddForm = false"
            />
          </transition>

          <!-- OPTIONS GRID -->
          <div
            v-if="productOptions.length > 0"
            class="options-grid"
          >
            <div
              v-for="option in productOptions"
              :key="option._id"
              class="option-card"
            >
              <!-- View Mode -->
              <template v-if="editingOption !== option._id">
                <div
                  v-if="option.imageUrl"
                  class="option-image"
                >
                  <img
                    :src="option.imageUrl"
                    :alt="option.label"
                  />
                </div>
                <div class="option-info">
                  <h4 class="option-label">
                    {{ option.label || "Unnamed Option" }}
                  </h4>
                  <div class="option-details">
                    <span class="option-price">
                      {{ formatToPHCurrency(option.price) }}
                    </span>
                    <span class="option-stock">Stock ({{ option.stock ?? 0 }})</span>
                    <span class="option-sold">Sold ({{ option.sold ?? 0 }})</span>
                  </div>
                  <div
                    v-if="option.isHot"
                    class="option-badge"
                  >
                    Hot
                  </div>
                  <div class="option-actions">
                    <button
                      @click="startEditOption(option._id)"
                      class="btn tiny outline"
                      type="button"
                    >
                      <PencilSquareIcon class="icon mini" /> Edit
                    </button>
                    <button
                      @click="handleDeleteOption(product._id, option._id)"
                      class="btn tiny danger outline"
                      type="button"
                    >
                      <TrashIcon class="icon mini" /> Delete
                    </button>
                  </div>
                </div>
              </template>

              <!-- Edit Mode -->
              <transition name="slide-v">
                <OptionEditForm
                  v-if="editingOption === option._id"
                  :option="option"
                  :productId="product._id"
                  @submit="handleUpdateOption"
                  @cancel="editingOption = null"
                  @promotionEnded="handlePromotionUpdate"
                />
              </transition>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="!showAddForm"
            class="empty-options"
          >
            <p>No options available for this product.</p>
          </div>
        </div>
      </div> <!-- /modal-body -->
    </div> <!-- /modal-content -->
  </div>
</template>

<style scoped>
/* ------- Transitions ------- */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-v-enter-active,
.slide-v-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-v-enter-from,
.slide-v-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}
.slide-v-enter-to,
.slide-v-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 1000px;
}

/* ============================================
   MODAL OVERLAY & BACKDROP
   ============================================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100000;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 1rem;
}

.modal-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* ============================================
   MODAL CONTENT
   ============================================ */
.modal-content {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  width: 100%;
  max-width: 1100px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  box-shadow: 
    0 25px 60px -10px rgba(0, 0, 0, 0.3),
    0 0 0 1px var(--border-primary);
  color: var(--text-primary);
  position: relative;
  transform: scale(0.94) translateY(20px);
  opacity: 0;
  transition:
    opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-overlay.is-open .modal-content {
  transform: scale(1) translateY(0);
  opacity: 1;
}

@media (max-width: 1140px) {
	.modal-content {
		max-width: calc(100vw - 2rem);
	}
}

@media (max-width: 640px) {
	.modal-content {
		max-width: calc(100vw - 1rem);
		max-height: 95vh;
	}
}

/* Custom scrollbar for modal */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.modal-content::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: var(--radius-md);
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-hover);
}

/* ============================================
   MODAL HEADER
   ============================================ */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 2rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}

.modal-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-primary);
}

.modal-title .icon {
  width: 1.75rem;
  height: 1.75rem;
  stroke-width: 2;
  color: var(--color-primary);
}

.close-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  width: 2.5rem;
  height: 2.5rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  line-height: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-secondary);
}

.close-btn .icon {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.5;
}

.close-btn:hover {
  background: var(--surface-hover);
  border-color: var(--color-danger);
  color: var(--color-danger);
  transform: scale(1.05);
}

.close-btn:active {
  transform: scale(0.95);
}

/* ============================================
   MODAL BODY
   ============================================ */
.modal-body {
  padding: 2rem 2rem 2.5rem;
}

/* ============================================
   PRODUCT DETAILS SECTION
   ============================================ */
.product-details {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
}

@media (max-width: 900px) {
	.product-details {
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}
}

.product-image {
  width: 100%;
  aspect-ratio: 4/2.5;
  object-fit: cover;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  background: var(--bg-primary);
  box-shadow: var(--shadow-md);
  transition: transform 0.3s ease;
}

.product-image:hover {
  transform: scale(1.02);
}

.product-info .description {
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: normal;
  overflow-wrap: break-word;
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
}

/* Rich text description styles */
.description-content {
  margin: 0 0 1.5rem;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--text-secondary);
  padding: 1rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.description-content :deep(p) {
  margin: 0 0 1rem 0;
  display: block;
}

.description-content :deep(p:last-child) {
  margin-bottom: 0;
}

.description-content :deep(h1),
.description-content :deep(h2),
.description-content :deep(h3),
.description-content :deep(h4),
.description-content :deep(h5),
.description-content :deep(h6) {
  color: var(--text-primary);
  font-weight: 700;
  margin: 1rem 0 0.5rem 0;
}

.description-content :deep(h1) {
  font-size: 1.5rem;
}

.description-content :deep(h2) {
  font-size: 1.25rem;
}

.description-content :deep(h3) {
  font-size: 1.1rem;
}

.description-content :deep(strong),
.description-content :deep(b) {
  font-weight: 700;
  color: var(--text-primary);
}

.description-content :deep(em),
.description-content :deep(i) {
  font-style: italic;
}

.description-content :deep(u) {
  text-decoration: underline;
}

.description-content :deep(s) {
  text-decoration: line-through;
  opacity: 0.7;
}

.description-content :deep(ul),
.description-content :deep(ol) {
  margin: 0.75rem 0 1rem 1.5rem;
  padding: 0;
}

.description-content :deep(li) {
  margin: 0.35rem 0;
}

.description-content :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.description-content :deep(a:hover) {
  text-decoration: underline;
  color: var(--text-primary);
}

.description-content :deep(blockquote) {
  border-left: 4px solid var(--color-primary);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--text-secondary);
  font-style: italic;
}

.description-content :deep(.ql-align-center) {
  text-align: center;
}

.description-content :deep(.ql-align-right) {
  text-align: right;
}

.description-content :deep(.ql-align-justify) {
  text-align: justify;
}

.description-content :deep(.ql-indent-1) {
  padding-left: 3em;
}

.description-content :deep(.ql-indent-2) {
  padding-left: 6em;
}

.meta-info {
  display: grid;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.meta-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  transition: all 0.2s ease;
}

.meta-item:hover {
  border-color: var(--color-primary);
  transform: translateX(4px);
}

.meta-item .label {
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.meta-item .value {
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  font-size: 1rem;
}

.meta-item .value.price {
  color: var(--color-primary);
  font-size: 1.25rem;
}

/* ============================================
   HEADER ACTIONS
   ============================================ */
.header-actions {
  display: flex;
  gap: 0.875rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

/* ============================================
   BUTTON SYSTEM
   ============================================ */
.btn {
  --btn-bg: var(--color-primary);
  --btn-fg: white;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  background: var(--btn-bg);
  color: var(--btn-fg);
  font: inherit;
  font-weight: 600;
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  letter-spacing: 0.01em;
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-md);
}

.btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.tiny {
  padding: 0.5rem 0.875rem;
  font-size: 0.8rem;
}

.btn.outline {
  --btn-bg: transparent;
  --btn-fg: var(--text-primary);
  border: 2px solid var(--border-primary);
  box-shadow: none;
  background: var(--surface);
}

.btn.outline:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn.danger {
  --btn-bg: var(--color-danger);
  --btn-fg: white;
}

.btn.danger.outline {
  --btn-bg: transparent;
  --btn-fg: var(--color-danger);
  border-color: var(--color-danger);
  background: var(--surface);
}

.btn.danger.outline:hover {
  background: var(--color-danger);
  color: white;
  border-color: var(--color-danger);
}

.icon {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
}

.icon.mini {
  width: 1rem;
  height: 1rem;
}

/* ============================================
   OPTIONS SECTION
   ============================================ */
.options-section {
  border-top: 1px solid var(--border-primary);
  padding-top: 2rem;
  margin-top: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-header h3::before {
  content: '';
  width: 4px;
  height: 1.5rem;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
}

/* ============================================
   OPTIONS GRID
   ============================================ */
.options-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  align-items: start;
}

.option-card {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.option-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.option-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.option-card:hover::before {
  opacity: 1;
}

.option-image {
  width: 100%;
  aspect-ratio: 4/2.5;
  overflow: hidden;
  background: var(--bg-secondary);
}

.option-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.option-card:hover .option-image img {
  transform: scale(1.05);
}

.option-info {
  padding: 1.25rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.option-label {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.option-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.option-price {
  font-weight: 700;
  font-size: 1.125rem;
  color: var(--color-primary);
}

.option-stock,
.option-sold {
  color: var(--text-tertiary);
  font-size: 0.8rem;
  font-weight: 500;
}

.option-badge {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  background: linear-gradient(135deg, var(--color-warning), var(--color-warning-hover));
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: var(--shadow-md);
}

.option-actions {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border-primary);
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
}

/* ============================================
   EMPTY STATE
   ============================================ */
.empty-options {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-tertiary);
  font-size: 0.95rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-primary);
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */
@media (max-width: 1024px) {
  .product-details {
    grid-template-columns: 320px 1fr;
    gap: 1.5rem;
  }

  .options-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, auto-fit));
  }
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.75rem;
  }

  .modal-content {
    max-height: 95vh;
  }

  .modal-header {
    padding: 1.25rem 1.5rem 1rem;
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .modal-title .icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .close-btn {
    width: 2.25rem;
    height: 2.25rem;
  }

  .modal-body {
    padding: 1.5rem 1.5rem 2rem;
  }

  .product-details {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1.25rem;
  }

  .header-actions {
    gap: 0.75rem;
  }

  .btn {
    flex: 1;
    justify-content: center;
    min-width: 0;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.875rem;
  }

  .section-header h3 {
    font-size: 1.125rem;
  }

  .options-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-content {
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header {
    padding: 1rem 1.25rem 0.875rem;
  }

  .modal-title {
    font-size: 1.125rem;
  }

  .modal-body {
    padding: 1.25rem 1.25rem 1.5rem;
  }

  .product-details {
    padding: 1rem;
  }

  .meta-item {
    padding: 0.75rem 0.875rem;
  }

  .btn.tiny {
    padding: 0.45rem 0.75rem;
    font-size: 0.75rem;
  }

  .option-info {
    padding: 1rem;
  }
}

/* Rejection & Pending Banners */
.rejection-banner {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  margin-bottom: 1.25rem;
}

.rejection-banner-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.rejection-banner-content strong {
  display: block;
  color: var(--color-danger, #dc2626);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.rejection-banner-content p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary, #1e293b);
  line-height: 1.4;
}

.rejection-date {
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 0.375rem;
  display: inline-block;
}

.pending-banner {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  margin-bottom: 1.25rem;
}

.pending-banner-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.pending-banner-content strong {
  display: block;
  color: var(--color-warning, #d97706);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.pending-banner-content p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
}

.no-options-hint {
  font-size: 0.8rem;
  color: var(--text-tertiary, #94a3b8);
  font-style: italic;
}
</style>
