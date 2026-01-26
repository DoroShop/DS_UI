<script setup lang="ts">
import { computed } from "vue";
import { formatToPHCurrency } from "../../utils/currencyFormat";
import type { Product } from "../../types/product";

/* Props & Emits */
const props = defineProps<{
  product: Partial<Product>;
}>();

const emit = defineEmits<{
  "view-product": [product: Partial<Product>];
}>();

/* Constants */
const PLACEHOLDER_IMG =
  "https://via.placeholder.com/400x260?text=No+Image";

/* Safe access helpers */
const imgSrc = computed(() => {
  const urls = props.product?.imageUrls;
  return (Array.isArray(urls) && urls.length ? urls[0] : PLACEHOLDER_IMG) as string;
});

const productName = computed(() => props.product?.name ?? "Unnamed Product");

const productPrice = computed(() => {
  const p = props.product?.price;
  return typeof p === "number" ? p : 0;
});

const productSold = computed(() => {
  const n = props.product?.sold;
  return typeof n === "number" ? n : 0;
});

const avgRating = computed(() => {
  const r = Number(props.product?.averageRating ?? 0);
  if (Number.isNaN(r)) return 0;
  return Math.min(5, Math.max(0, r));
});

const ratingText = computed(() => avgRating.value.toFixed(1));

const numReviews = computed(() => {
  const n = props.product?.numReviews;
  return typeof n === "number" ? n : 0;
});

/* Badges */
const isNew = computed(() => Boolean(props.product?.isNew));
const isHot = computed(() => Boolean(props.product?.isHot));
const hasPromotion = computed(() => props.product?.hasPromotion || props.product?.promotionStatus === 'active');
const promotionStatus = computed(() => props.product?.promotionStatus);
const hasVariantPromotions = computed(() => {
  return props.product?.option?.some(opt => opt.hasPromotion || opt.promotionStatus === 'active') || false;
});

/* Product Approval Status */
const productStatus = computed(() => {
  // Check new status field first, fall back to isApproved
  if (props.product?.status) {
    return props.product.status;
  }
  return props.product?.isApproved ? 'approved' : 'pending_review';
});

const isPendingReview = computed(() => productStatus.value === 'pending_review');
const isApproved = computed(() => productStatus.value === 'approved');
const isRejected = computed(() => productStatus.value === 'rejected');
const rejectionReason = computed(() => props.product?.rejectionReason || '');

/* Events */
function viewProduct() {
  emit("view-product", props.product);
}
</script>

<template>
  <div class="product-card" :class="{ 'pending': isPendingReview, 'rejected': isRejected }">
    <!-- Image -->
    <div class="product-image" @click="viewProduct" role="button" tabindex="0">
      <img :src="imgSrc" :alt="productName" />
      <div class="badges">
        <!-- Approval Status Badge (Priority) -->
        <span v-if="isPendingReview" class="badge badge-pending-review">
          🕐 Pending Review
        </span>
        <span v-else-if="isRejected" class="badge badge-rejected">
          ❌ Rejected
        </span>
        <span v-else-if="isApproved" class="badge badge-approved">
          ✓ Approved
        </span>
        
        <!-- Other badges -->
        <span v-if="isNew && isApproved" class="badge badge-new">New</span>
        <span v-if="isHot && isApproved" class="badge badge-hot">Hot</span>
        <span v-if="hasPromotion && isApproved" class="badge badge-promotion active">
          <i class="icon">🎁</i> Product Sale
        </span>
        <span v-else-if="promotionStatus === 'scheduled' && isApproved" class="badge badge-promotion scheduled">
          <i class="icon">⏰</i> Scheduled
        </span>
        <span v-if="hasVariantPromotions && isApproved" class="badge badge-variant-promotion">
          <i class="icon">🏷️</i> Variant Sales
        </span>
      </div>
      
      <!-- Overlay for pending/rejected products -->
      <div v-if="!isApproved" class="status-overlay" :class="{ 'pending': isPendingReview, 'rejected': isRejected }">
        <span v-if="isPendingReview" class="overlay-text">Awaiting Admin Approval</span>
        <span v-else-if="isRejected" class="overlay-text">Product Rejected</span>
      </div>
    </div>

    <!-- Info -->
    <div class="product-info">
      <h3 class="product-name">{{ productName }}</h3>
      
      <!-- Rejection Reason Alert -->
      <div v-if="isRejected && rejectionReason" class="rejection-alert">
        <span class="rejection-icon">⚠️</span>
        <span class="rejection-text">{{ rejectionReason }}</span>
      </div>

      <!-- Promotion Status -->
      <div v-if="hasPromotion || hasVariantPromotions" class="promotion-status">
        <div v-if="hasPromotion" class="promotion-item">
          <span class="promotion-type">Product Promotion:</span>
          <span class="promotion-details active">{{ promotionStatus === 'active' ? 'Live Now' : 'Scheduled' }}</span>
        </div>
        <div v-if="hasVariantPromotions" class="promotion-item">
          <span class="promotion-type">Variant Promotions:</span>
          <span class="promotion-details active">Active on variants</span>
        </div>
      </div>

      <!-- Price + Sold -->
      <div class="product-meta">
        <div class="price">{{ formatToPHCurrency(productPrice) }}</div>
        <div class="sold">Sold ({{ productSold }})</div>
      </div>

      <!-- Rating -->
      <div class="rating" v-if="numReviews || avgRating">
        <div class="stars" aria-hidden="true">
          <span
            v-for="i in 5"
            :key="i"
            class="star"
            :class="{ filled: i <= Math.floor(avgRating) }"
            >★</span
          >
        </div>
        <span class="rating-text">{{ ratingText }} ({{ numReviews }})</span>
      </div>

      <!-- Actions -->
      <div class="actions">
        <button @click="viewProduct" class="btn small">
          View Details
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Theme Sync w/ Order Cards ===== */
.product-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: 1rem;
  overflow: hidden;
  backdrop-filter: blur(6px);
  color: var(--text-primary);
  transition: border-color 0.35s, transform 0.25s, box-shadow 0.35s;
  position: relative;
  box-shadow: var(--shadow-md);
}

.product-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

/* ===== Image ===== */
.product-image {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}
.product-image img {
  width: 100%;
  aspect-ratio: 4 / 2.6;
  object-fit: cover;
  transition: transform 0.3s ease;
  display: block;
  border-radius: 10px;
}
.product-image:hover img {
  transform: scale(1.05);
}

/* ===== Badges ===== */
.badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
}
.badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1;
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.35);
}
.badge-new {
  background: #0d9488;
  color: #fff;
}
.badge-hot {
  background: #f59e0b;
  color: #fff;
}

.badge-promotion {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge-promotion.active {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  animation: pulse 2s infinite;
}

.badge-promotion.scheduled {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.badge-variant-promotion {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: #fff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.badge .icon {
  font-size: 0.7rem;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* ===== Info ===== */
.product-info {
  padding: 1rem 0.95rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.product-name {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
  color: var(--text-primary);
}

/* ===== Promotion Status ===== */
.promotion-status {
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 0.75rem;
  margin: 0.5rem 0;
}

.promotion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.promotion-item:last-child {
  margin-bottom: 0;
}

.promotion-type {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}

.promotion-details {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.promotion-details.active {
  background: #dcfce7;
  color: #166534;
}

/* ===== Meta ===== */
.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: .9rem;
  line-height: 1.25;
}
.price {
  font-weight: 700;
  color: var(--secondary-color, #fbbf24);
  letter-spacing: .25px;
  white-space: nowrap;
}
.sold {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: .25px;
}

/* ===== Rating ===== */
.rating {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.stars {
  display: flex;
  gap: 2px;
  line-height: 1;
}
.star {
  color: var(--text-muted);
  font-size: 1rem;
  transition: color 0.2s ease;
}
.star.filled {
  color: #f59e0b;
}
.rating-text {
  line-height: 1;
}

/* ===== Actions ===== */
.actions {
  display: flex;
  margin-top: .25rem;
}

/* Button system (copied + trimmed from order-cards) */
.btn {
  --btn-bg: var(--color-primary);
  --btn-fg: var(--text-inverse);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  background: var(--btn-bg);
  color: var(--btn-fg);
  font: inherit;
  font-weight: 600;
  padding: 0.55rem 0.85rem;
  border-radius: 0.6rem;
  font-size: 0.8rem;
  letter-spacing: 0.6px;
  cursor: pointer;
  position: relative;
  transition: background 0.3s, transform 0.25s, box-shadow 0.3s;
  box-shadow: var(--shadow-md);
  width: 100%;
}
.btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  background: var(--color-primary-hover);
}
.btn:active:not(:disabled) {
  transform: translateY(-1px);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn.outline {
  --btn-bg: transparent;
  --btn-fg: var(--text-primary);
  border: 1px solid var(--border-primary);
  box-shadow: none;
}
.btn.outline:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--color-primary);
}

.btn.small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

/* ===== Product Approval Status Styles ===== */
.product-card.pending {
  border-color: #f59e0b;
  border-width: 2px;
}

.product-card.rejected {
  border-color: #ef4444;
  border-width: 2px;
  opacity: 0.85;
}

/* Status badges */
.badge-pending-review {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  color: white !important;
}

.badge-rejected {
  background: linear-gradient(135deg, #ef4444, #dc2626) !important;
  color: white !important;
}

.badge-approved {
  background: linear-gradient(135deg, #1f8b4e, #16a34a) !important;
  color: white !important;
}

/* Status overlay */
.status-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.status-overlay.pending {
  background: linear-gradient(to top, rgba(245, 158, 11, 0.9), rgba(245, 158, 11, 0.5));
}

.status-overlay.rejected {
  background: linear-gradient(to top, rgba(239, 68, 68, 0.9), rgba(239, 68, 68, 0.5));
}

.overlay-text {
  color: white;
  font-weight: 600;
  font-size: 0.8rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Rejection alert */
.rejection-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border: 1px solid #fca5a5;
  border-radius: 0.5rem;
  font-size: 0.75rem;
}

.rejection-icon {
  flex-shrink: 0;
}

.rejection-text {
  color: #991b1b;
  line-height: 1.4;
}

/* If you want primary accent for product CTA instead of white, uncomment:
.btn.primary {
  --btn-bg: var(--primary-color, #22c55e);
  --btn-fg: #fff;
}
*/

/* ===== Responsive tweaks ===== */
@media (max-width: 767px) {
  .product-info {
    padding: 0.9rem 0.85rem 0.95rem;
  }
  .product-name {
    font-size: 0.95rem;
  }
  .btn {
    font-size: 0.7rem;
    padding: 0.5rem 0.75rem;
  }
}
</style>
