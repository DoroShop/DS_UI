<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, onDeactivated, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { BuildingStorefrontIcon, ChatBubbleLeftEllipsisIcon, ArrowLeftIcon } from "@heroicons/vue/24/outline"
import { useOrderStore } from '../stores/OrderStores'
import { useReviewStore } from '../stores/reviewStore'
import { useAuthStore } from '../stores/authStores'
import type { Order, OrderItem, OrderStatus, PaymentMethod, RefundStatus } from '../types/order'
import type { ReviewableProduct } from '../types/review'
import { handleImageError } from '../utils/fallbackImage'
import CustomerChatModal from '../components/CustomerChatModal.vue'
import ConfirmationModal from '../components/ConfirmationModal.vue'
// import OrderTrackerModal from '../components/OrderTrackerModal.vue'
import ReviewModal from '../components/ReviewModal.vue'
import { useTheme } from '../composables/useTheme'
import { usePageState, hasPageState } from '../composables/usePageState'

// Define component name for keep-alive
defineOptions({
  name: 'Orders'
})

const router = useRouter()

const authStore = useAuthStore()
const orderStore = useOrderStore()
const reviewStore = useReviewStore()
const orders = computed<Order[]>(() => orderStore.orders)
const { isDark } = useTheme()

// Scroll container ref for page state
const ordersWrapper = ref<HTMLElement | null>(null)

// Chat modal state
const showChatModal = ref(false)
const selectedOrderId = ref('')
const selectedVendorName = ref('')

// Cancel confirmation modal state
const showCancelModal = ref(false)
const orderToCancel = ref('')
const isCancelling = ref(false)

// Tracker modal state
// const showTrackerModal = ref(false)
const orderToTrack = ref('')

// Review modal state
const showReviewModal = ref(false)
const productToReview = ref<ReviewableProduct | null>(null)

// Refund modal state
const showRefundModal = ref(false)
const orderToRefund = ref<Order | null>(null)
const refundReason = ref('')
const refundDetails = ref('')
const isRequestingRefund = ref(false)
const isCancellingRefund = ref(false)
const refundReasons = [
  { value: 'defective_product', label: 'Defective Product' },
  { value: 'wrong_item_received', label: 'Wrong Item Received' },
  { value: 'item_not_received', label: 'Item Not Received' },
  { value: 'item_damaged', label: 'Item Damaged' },
  { value: 'not_as_described', label: 'Not As Described' },
  { value: 'changed_mind', label: 'Changed Mind' },
  { value: 'duplicate_order', label: 'Duplicate Order' },
  { value: 'other', label: 'Other' }
]

// Infinite scroll refs
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Helper function for reason icons
const getReasonIcon = (reason: string) => {
  const icons: Record<string, string> = {
    'defective_product': '🔧',
    'wrong_item_received': '📦',
    'item_not_received': '❓',
    'item_damaged': '💔',
    'not_as_described': '📝',
    'changed_mind': '🔄',
    'duplicate_order': '📋',
    'other': '💬'
  }
  return icons[reason] || '📌'
}

// Setup infinite scroll observer
const setupInfiniteScroll = () => {
  nextTick(() => {
    if (sentinelRef.value) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (entry.isIntersecting && orderStore.hasMore && !orderStore.isLoadingMore) {
            orderStore.loadMoreOrders()
          }
        },
        { threshold: 0.1 }
      )
      observer.observe(sentinelRef.value)
    }
  })
}

// Cleanup infinite scroll observer
const cleanupInfiniteScroll = () => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

onMounted(async () => {
  console.log('[Orders] onMounted')
  
  // Check if user is authenticated before trying to fetch orders
  if (!authStore.isAuthenticated) {
    console.log('[Orders] User not authenticated, redirecting to login')
    router.push('/login')
    return
  }
  
  // Skip fetch if we have cached state
  if (hasPageState('orders') && orderStore.isFetch) {
    setupInfiniteScroll()
    return
  }
  
  try {
    await orderStore.fetchOrders()
    await reviewStore.fetchReviewableProducts()
    await reviewStore.fetchMyReviews()
  } catch (error) {
    console.error('[Orders] Failed to fetch data:', error)
    // Silently handle authentication errors - don't show alert
    if (error?.response?.status === 401) {
      router.push('/login')
      return
    }
  }
  
  setupInfiniteScroll()
})

onActivated(() => {
  console.log('[Orders] onActivated - scroll position:', orderStore.ordersScrollPosition)
  orderStore.isRestoringScroll = true
  
  // Restore scroll position synchronously
  if (ordersWrapper.value && orderStore.ordersScrollPosition > 0) {
    ordersWrapper.value.scrollTop = orderStore.ordersScrollPosition
    console.log('[Orders] Scroll restored to:', orderStore.ordersScrollPosition)
  }
  
  // Re-setup infinite scroll when component is shown
  // (after scroll restoration)
  nextTick(() => {
    orderStore.isRestoringScroll = false
    setupInfiniteScroll()
  })
})

onDeactivated(() => {
  console.log('[Orders] onDeactivated - saving scroll position')
  if (ordersWrapper.value) {
    orderStore.ordersScrollPosition = ordersWrapper.value.scrollTop
    console.log('[Orders] Scroll position saved:', orderStore.ordersScrollPosition)
  }
  cleanupInfiniteScroll()
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})

// Available order statuses (primary tabs)
const statuses: OrderStatus[] = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
const currentStatus = ref<OrderStatus>('pending')

// Filter orders by selected status, but keep refund flows inside Delivered tab
const filteredOrders = computed(() =>
  orders.value.filter(order => {
    if (order.status === currentStatus.value) return true;
    if (currentStatus.value === 'delivered') {
      const refundState = resolveRefundState(order);
      if (order.status === 'refund_requested' || refundState !== 'none') return true;
    }
    return false;
  })
)

const selectStatus = (status: OrderStatus) => {
  currentStatus.value = status
}

const getOrderCount = (status: OrderStatus) => orderStore.getOrderCount(status)

const capitalize = (val: string) =>
  val.charAt(0).toUpperCase() + val.slice(1)

const formatDate = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

const formatDeliveryTime = (dateStr: string | Date) =>
  new Date(dateStr).toLocaleTimeString('en-PH', {
    hour: '2-digit', minute: '2-digit'
  }) + ' Delivered'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount || 0)

const getOrderById = (orderId: string) =>
  orders.value.find(order => order._id === orderId || order.orderId === orderId)

// Computed property for selected order in cancel modal
const selectedOrderForCancel = computed(() =>
  orderToCancel.value ? getOrderById(orderToCancel.value) : null
)

const formatPaymentMethod = (method: PaymentMethod) => ({
  wallet: 'Digital Wallet',
  cod: 'Cash on Delivery',
  //cash: 'GCash'
})[method] || method

const formatShippingMethod = (shippingOption: string) => {
  const shippingMethods = {
    'J&T': 'J&T Express',
    'j&t': 'J&T Express',
    'jnt': 'J&T Express',
    'pickup': 'Store Pickup',
    'Pick Up': 'Store Pickup',
    'agreement': 'Customer Agreement',
    'Agreement': 'Customer Agreement',
    'delivery': 'Standard Delivery',
    'standard': 'Standard Delivery',
    'express': 'Express Delivery',
    'same-day': 'Same Day Delivery'
  };

  return shippingMethods[shippingOption] || shippingOption || 'Standard Delivery';
}

const getShippingIcon = (shippingOption: string) => {
  const icons = {
    'J&T': '🚚',
    'j&t': '🚚',
    'jnt': '🚚',
    'pickup': '🏪',
    'Pick Up': '🏪',
    'agreement': '🤝',
    'Agreement': '🤝',
    'delivery': '📦',
    'standard': '📦',
    'express': '⚡',
    'same-day': '🚀'
  };

  return icons[shippingOption] || '📦';
}

// Normalize refund states coming from API/UI so we render consistently
const resolveRefundState = (order: Order): RefundStatus => {
  const rawVal = ((order as any)?.refundStatus || '').toString().trim().toLowerCase();
  const normalized = {
    refund_requested: 'requested',
    pending: 'requested',
    requested: 'requested',
    approved: 'approved',
    processed: 'processed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    none: 'none',
  } as Record<string, RefundStatus>;

  if (!rawVal || rawVal === 'none') {
    if (order.status === 'refund_requested') return 'requested';
  }

  return normalized[rawVal] || 'none';
}

const getStatusClass = (status: OrderStatus | string) => ({
  pending: 'status-pending',
  paid: 'status-paid',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
  requested: 'status-refund-requested',
  refund_requested: 'status-refund-requested',
  approved: 'status-refund-approved',
  refund_approved: 'status-refund-approved',
  processed: 'status-refunded',
  refunded: 'status-refunded',
  rejected: 'status-refund-rejected'
})[status] || ''

const getStatusDisplayText = (status: string) => ({
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  requested: 'Refund Pending',
  refund_requested: 'Refund Pending',
  approved: 'Refund Approved',
  refund_approved: 'Refund Approved',
  processed: 'Refunded',
  refunded: 'Refunded',
  rejected: 'Refund Rejected'
})[status] || status


// Chat functions
const openChat = (order: Order) => {
  selectedOrderId.value = order._id || order.orderId
  selectedVendorName.value = 'TechStore' // You can get this from order data
  showChatModal.value = true
}

const closeChat = () => {
  showChatModal.value = false
  selectedOrderId.value = ''
  selectedVendorName.value = ''
}

// Check if order has agreement shipping
const hasAgreementShipping = (order: Order) => {
  return order.shippingOption === 'agreement'
}

// Action handlers
const openRefundModal = (order: Order) => {
  orderToRefund.value = order
  refundReason.value = ''
  refundDetails.value = ''
  showRefundModal.value = true
}

const closeRefundModal = () => {
  showRefundModal.value = false
  orderToRefund.value = null
  refundReason.value = ''
  refundDetails.value = ''
}

const requestRefund = async (order: Order) => {
  // Open modal instead of direct request
  openRefundModal(order)
}

const submitRefundRequest = async () => {
  if (!orderToRefund.value) return

  const orderId = orderToRefund.value._id || orderToRefund.value.orderId
  if (!orderId) {
    console.error('Request refund: orderId is undefined', orderToRefund.value)
    alert('Unable to request refund. Please try again.')
    return
  }

  if (!refundReason.value) {
    alert('Please select a reason for the refund.')
    return
  }

  isRequestingRefund.value = true
  try {
    await orderStore.requestRefund(orderId, refundReason.value, refundDetails.value)
    alert('Refund request submitted successfully. You will be notified once reviewed.')
    closeRefundModal()
    await orderStore.refreshOrders()
  } catch (error: any) {
    console.error('Failed to request refund:', error)
    alert(error?.response?.data?.error || error?.message || 'Failed to submit refund request. Please try again.')
  } finally {
    isRequestingRefund.value = false
  }
}

const cancelRefundRequest = async (order: Order) => {
  const orderId = order._id || order.orderId
  if (!orderId) {
    alert('Unable to cancel refund for this order.');
    return
  }

  if (!confirm('Cancel this refund request?')) return

  isCancellingRefund.value = true
  try {
    await orderStore.cancelRefund(orderId)
    alert('Refund request cancelled.')
  } catch (error: any) {
    console.error('Failed to cancel refund:', error)
    alert(error?.response?.data?.error || error?.message || 'Failed to cancel refund request.')
  } finally {
    isCancellingRefund.value = false
  }
}

// Write review handler
const writeReview = (item: OrderItem, order: Order) => {
  // Validate required fields
  if (!item.productId) {
    console.error('❌ Cannot review: productId is missing', item)
    return
  }

  const orderIdValue = order._id || order.orderId
  if (!orderIdValue) {
    console.error('❌ Cannot review: orderId is missing', order)
    return
  }

  const reviewableProduct: ReviewableProduct = {
    orderId: orderIdValue,
    productId: item.productId,
    productName: item.name,
    productImage: item.imgUrl || '',
    price: item.price,
    quantity: item.quantity,
    orderDate: order.createdAt,
    vendorId: order.vendorId
  }

  console.log('📝 Opening review modal for:', reviewableProduct)
  productToReview.value = reviewableProduct
  showReviewModal.value = true
}

// Check if product can be reviewed (not yet reviewed)
const canReviewProduct = (productId: string, orderId: string) => {
  // Validate input parameters
  if (!productId || !orderId) {
    return false
  }

  // Check if this product has already been reviewed
  const alreadyReviewed = reviewStore.myReviews.some(
    (review) => {
      // Ensure review exists and has required properties
      if (!review || !review.productId) {
        return false
      }

      // Safely extract productId from review
      const reviewProductId = typeof review.productId === 'string'
        ? review.productId
        : review.productId?._id

      // Only compare if we have valid productId
      return reviewProductId && reviewProductId === productId && review.orderId === orderId
    }
  )
  return !alreadyReviewed
}

// Handle review submitted
const handleReviewSubmitted = async () => {
  showReviewModal.value = false
  productToReview.value = null
  // Refresh reviews list
  await reviewStore.fetchReviewableProducts()
  await reviewStore.fetchMyReviews()
}

// Close review modal
const closeReviewModal = () => {
  showReviewModal.value = false
  productToReview.value = null
}

// Show cancel confirmation modal
const showCancelConfirmation = (orderId: string) => {
  if (!orderId) {
    console.error('❌ No order ID provided');
    alert('Error: Order ID is missing. Please refresh the page and try again.');
    return;
  }

  orderToCancel.value = orderId;
  showCancelModal.value = true;
}

// Handle cancel confirmation
const handleCancelConfirm = async () => {
  try {
    isCancelling.value = true;
    console.log('🔄 Cancelling order:', orderToCancel.value);

    // Call the order store to cancel the order
    await orderStore.cancelOrder(orderToCancel.value);

    // Refresh orders to show updated status
    await orderStore.fetchOrders();

    console.log('✅ Order cancelled successfully');

    // Close modal and reset state
    showCancelModal.value = false;
    orderToCancel.value = '';

    // Show success message (you could use a toast notification here instead)
    alert('Order has been cancelled successfully.');

  } catch (error) {
    console.error('❌ Failed to cancel order:', error);
    alert('Failed to cancel order. Please try again or contact support.');
  } finally {
    isCancelling.value = false;
  }
}

// Handle cancel modal close
const handleCancelClose = () => {
  if (!isCancelling.value) {
    showCancelModal.value = false;
    orderToCancel.value = '';
  }
}

const rateOrder = (orderId: string, rating: number) =>
  console.log(`Rated order ${orderId} with ${rating} stars`)

// Track order
// const trackOrder = (orderId: string) => {
//   const order = getOrderById(orderId);
//   if (order && order.shippingOption === 'pickup') {
//     alert('This is a pickup order and cannot be tracked on the map.');
//     return;
//   }
//   orderToTrack.value = orderId
//   // showTrackerModal.value = true
// }

// Close tracker modal
// const closeTrackerModal = () => {
//   showTrackerModal.value = false
//   orderToTrack.value = ''
// }

// Back navigation
const goBack = () => {
  // Check if there's a previous page in history
  if (window.history.length > 1) {
    router.back()
  } else {
    // Fallback to home page if no history
    router.push('/products')
  }
}

// Header actions
const handleFilter = () => {
  console.log('Open filter options')
  // TODO: Implement filter functionality
}

const handleSearch = () => {
  console.log('Open search')
  // TODO: Implement search functionality
}
</script>

<template>
  <section ref="ordersWrapper" class="orders-wrapper">

    <CustomerChatModal :show="showChatModal" :order-id="selectedOrderId" :vendor-name="selectedVendorName"
      @close="closeChat" />

    <ReviewModal :isOpen="showReviewModal" :product="productToReview || undefined" @close="closeReviewModal"
      @submitted="handleReviewSubmitted" />

    <ConfirmationModal :is-visible="showCancelModal" title="Cancel Order"
      :message="`Are you sure you want to cancel order ${orderToCancel}? This action cannot be undone and may affect your order history.`"
      confirm-text="Yes, Cancel Order" cancel-text="Keep Order" loading-text="Cancelling..." :is-loading="isCancelling"
      @confirm="handleCancelConfirm" @cancel="handleCancelClose">
      <template #icon>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18L18 6M6 6L18 18" stroke="#EF4444" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </template>
      <template #content>
        <div class="cancel-order-details">
          <div v-if="selectedOrderForCancel" class="order-summary">
            <h4 class="summary-title">Order Summary</h4>
            <div class="summary-info">
              <span class="info-label">Total Amount:</span>
              <span class="info-value">{{ formatCurrency((selectedOrderForCancel.subTotal || 0) +
                (selectedOrderForCancel.shippingFee || 0)) }}</span>
            </div>
            <div class="summary-info">
              <span class="info-label">Items:</span>
              <span class="info-value">{{ selectedOrderForCancel.items?.length || 0 }} item(s)</span>
            </div>
            <div class="summary-info">
              <span class="info-label">Status:</span>
              <span class="info-value">{{ capitalize(selectedOrderForCancel.status || '') }}</span>
            </div>
          </div>

          <div class="warning-section">
            <p class="warning-text">
              <strong>⚠️ What happens when you cancel:</strong>
            </p>
            <ul class="warning-list">
              <li>Your order will be immediately cancelled</li>
              <li>Any payment will be refunded within 3-5 business days</li>
              <li>You cannot reactivate this order once cancelled</li>
              <li>The vendor will be notified of the cancellation</li>
            </ul>
          </div>
        </div>
      </template>
    </ConfirmationModal>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showRefundModal" class="refund-modal-overlay" @click.self="closeRefundModal">
          <div class="refund-modal-container" :class="{ 'dark': isDark }">
            <!-- Modal Header -->
            <div class="refund-modal-header">
              <div class="header-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 10h18M3 14h18M3 6h18M3 18h18" stroke-linecap="round" />
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div class="header-text">
                <h3>Request Refund</h3>
                <p>Submit a refund request for your order</p>
              </div>
              <button class="close-btn" @click="closeRefundModal" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="refund-modal-body">
              <!-- Order Info Card -->
              <div class="order-info-card" v-if="orderToRefund">
                <div class="order-info-row">
                  <span class="info-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                    </svg>
                    Order ID
                  </span>
                  <span class="info-value">{{ orderToRefund.trackingNumber?.slice(-8) || 'N/A' }}</span>
                </div>
                <div class="order-info-row">
                  <span class="info-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    Date
                  </span>
                  <span class="info-value">{{ formatDate(orderToRefund.createdAt || orderToRefund.updatedAt) }}</span>
                </div>
                <div class="order-info-row highlight">
                  <span class="info-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                    </svg>
                    Refund Amount
                  </span>
                  <span class="info-value amount">{{ formatCurrency(orderToRefund.subTotal || 0) }}</span>
                </div>
              </div>

              <!-- Reason Selection -->
              <div class="form-section">
                <label class="form-label">
                  Reason for Refund
                  <span class="required-badge">Required</span>
                </label>
                <div class="reason-grid">
                  <button v-for="reason in refundReasons" :key="reason.value" type="button" class="reason-option"
                    :class="{ selected: refundReason === reason.value }" @click="refundReason = reason.value">
                    <span class="reason-icon">{{ getReasonIcon(reason.value) }}</span>
                    <span class="reason-text">{{ reason.label }}</span>
                  </button>
                </div>
              </div>

              <!-- Additional Details -->
              <div class="form-section">
                <label class="form-label">
                  Additional Details
                  <span class="optional-badge">Optional</span>
                </label>
                <textarea v-model="refundDetails"
                  placeholder="Describe your issue in detail to help us process your request faster..." rows="3"
                  class="details-textarea"></textarea>
              </div>

              <!-- Notice Banner -->
              <div class="notice-banner">
                <div class="notice-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </div>
                <div class="notice-content">
                  <strong>Important Information</strong>
                  <ul>
                    <li>Refunds can only be requested within 24 hours of delivery</li>
                    <li>Once approved, the amount will be credited to your wallet</li>
                    <li>You'll receive a notification when your request is reviewed</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="refund-modal-footer">
              <button class="btn-secondary" @click="closeRefundModal" :disabled="isRequestingRefund">
                Cancel
              </button>
              <button class="btn-primary" @click="submitRefundRequest" :disabled="!refundReason || isRequestingRefund">
                <span v-if="isRequestingRefund" class="loading-spinner"></span>
                {{ isRequestingRefund ? 'Submitting...' : 'Submit Request' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Order Tracker Modal -->
    <!-- <OrderTrackerModal v-if="showTrackerModal" :order-id="orderToTrack" @close="closeTrackerModal" /> -->

    <!-- Header Layout Similar to Shopping Cart -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <button @click="goBack" class="back-button">
            <ArrowLeftIcon class="back-icon" />
          </button>
          <h1 class="page-title">My Orders</h1>
        </div>
        <!-- <div class="header-right">
          <button @click="handleFilter" class="action-button secondary">
            <span>Filter</span>
          </button>
          <button @click="handleSearch" class="action-button primary">
            <span>Search Orders</span>
          </button>
        </div> -->
      </div>
      <div class="tab-nav">
        <div class="tab-nav-inner">
          <button v-for="status in statuses" :key="status" :class="{ active: currentStatus === status }"
            @click="selectStatus(status)" class="tab-button">
            <span class="tab-text">{{ capitalize(status) }}</span>
            <span v-if="getOrderCount(status) > 0" class="tab-count">{{ getOrderCount(status) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Enhanced Tab Navigation -->


    <!-- Orders List -->
    <div class="orders-container">
      <!-- Loading Skeleton -->
      <div v-if="orderStore.isLoading && filteredOrders.length === 0" class="orders-grid">
        <div v-for="n in 6" :key="n" class="order-card skeleton-card">
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-text skeleton-text-short"></div>
            <div class="skeleton-badge"></div>
          </div>
          <div class="skeleton-content">
            <div class="skeleton-text skeleton-text-long"></div>
            <div class="skeleton-text skeleton-text-medium"></div>
            <div class="skeleton-stats">
              <div class="skeleton-stat"></div>
              <div class="skeleton-stat"></div>
            </div>
          </div>
          <div class="skeleton-actions">
            <div class="skeleton-button"></div>
            <div class="skeleton-button"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredOrders.length === 0 && !orderStore.isLoading" class="empty-state">
        <div class="empty-icon">📦</div>
        <h3 class="empty-title">No {{ currentStatus }} orders</h3>
        <p class="empty-description">
          Orders with {{ currentStatus }} status will appear here when available.
        </p>
      </div>

      <!-- Orders Grid -->
      <div v-else class="orders-grid">
        <div v-for="(order, index) in filteredOrders" :key="order.orderId" class="order-card"
          :style="{ animationDelay: `${index * 50}ms` }">
          <!-- Order Header -->
          <div class="order-header">
            <div class="store-info">
              <div class="store-badge">
                <span class="store-icon">
                  <BuildingStorefrontIcon class="icon"></BuildingStorefrontIcon>
                </span>
                <span class="store-name">TechStore</span>
              </div>
              <div class="status-badges">
                <!-- <span :class="['order-status', getStatusClass(order.status)]">
                  {{ getStatusDisplayText(order.status) }}
                </span> -->
                <!-- Refund Status Badge in Header -->
                <span v-if="resolveRefundState(order) !== 'none'"
                  :class="['order-status', getStatusClass(resolveRefundState(order) === 'requested' ? 'refund_requested' : resolveRefundState(order) === 'approved' ? 'refund_approved' : resolveRefundState(order) === 'processed' ? 'refunded' : 'status-cancelled')]">
                  {{ getStatusDisplayText(resolveRefundState(order) === 'requested' ? 'refund_requested' :
                    resolveRefundState(order) === 'approved' ? 'refund_approved' : resolveRefundState(order) ===
                      'processed' ?
                      'refunded' : resolveRefundState(order)) }}
                </span>
                <!-- <span :class="['payment-status', order.paymentStatus === 'paid' ? 'payment-paid' : 'payment-unpaid']">
                  {{ order.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Unpaid' }}
                </span> -->
              </div>
            </div>
          </div>

          <!-- Delivery Status -->
          <div v-if="order.status === 'delivered'" class="delivery-status">
            <div class="delivery-icon">🚚</div>
            <div class="delivery-info">
              <div class="delivery-time">{{ formatDeliveryTime(order.updatedAt) }}</div>
              <div class="delivery-message">Your package has been delivered.</div>
            </div>
            <div class="delivery-arrow">›</div>
          </div>

          <!-- Tracking Status for Shipped Orders -->
          <div v-else-if="order.status === 'shipped'" class="delivery-status">
            <div class="delivery-icon">📦</div>
            <div class="delivery-info">
              <div class="delivery-time">In Transit</div>
              <div class="delivery-message">Tracking: {{ order.trackingNumber }}</div>
            </div>
            <div class="delivery-arrow">›</div>
          </div>

          <!-- Shipping Method Info (All Orders) -->
          <!-- <div class="delivery-info-section">
          
          </div> -->

          <!-- Order Items -->
          <div class="items-section">
            <div v-for="(item, i) in order.items" :key="i" class="item-card">
              <div class="item-main">
                <div class="item-image">
                  <img :src="item.imgUrl" :alt="item.name" @error="handleImageError" />
                </div>
                <div class="item-details">
                  <div class="item-info">
                    <h4 class="item-name">{{ item.name || "N/A" }}</h4>
                    <p class="item-variant" v-if="item.label">{{ item.label }}</p>
                    <div class="item-quantity">Quantity: x{{ item.quantity }}</div>
                  </div>
                  <div class="item-price">
                    <span class="price">{{ formatCurrency(item.price) }}</span>
                  </div>
                </div>
              </div>
              <!-- Review Button (only for delivered items) -->
              <div v-if="order.status === 'delivered' && item.productId" class="item-actions">
                <button
                  v-if="item.productId && (order._id || order.orderId) && canReviewProduct(item.productId, order._id || order.orderId)"
                  class="btn-review" @click="writeReview(item, order)">
                  ✍️ Write Review
                </button>
                <span v-else class="review-submitted">✓ Reviewed</span>
              </div>
            </div>
          </div>

          <!-- Order Total -->
          <div class="order-total">
            <span class="total-label">Shipping Fee:</span>
            <span class="total-amount">{{ formatCurrency(order?.shippingFee || 0) }}</span>
          </div>
          <div class="order-total">
            <span class="total-label">Total:</span>
            <span class="total-amount">{{ formatCurrency(order.subTotal + order.shippingFee) }}</span>
          </div>

          <!-- Action Buttons / Refund States -->
          <!-- <div class="action-buttons refund-status"
            v-if="['approved', 'processed'].includes(resolveRefundState(order))">
            <div class="refund-badge success">
              <span class="refund-icon">✓</span>
              <span class="refund-text">Refund {{ resolveRefundState(order) === 'processed' ? 'Completed' : 'Approved'
                }}</span>
            </div>
            <p class="refund-note">{{ resolveRefundState(order) === 'processed' ? 'Refund has been credited to your wallet.' : 'Refund approved and being processed.' }}</p>
          </div>

          <div class="action-buttons refund-status" v-else-if="resolveRefundState(order) === 'rejected'">
            <div class="refund-badge neutral">
              <span class="refund-icon">✖</span>
              <span class="refund-text">Refund Rejected</span>
            </div>
            <p class="refund-note">The refund was declined. Contact support if you need to dispute this.</p>
          </div> -->

          <div class="action-buttons refund-status" v-if="resolveRefundState(order) === 'cancelled'">
            <div class="refund-badge neutral">
              <span class="refund-icon">⏹</span>
              <span class="refund-text">Refund Cancelled</span>
            </div>
            <p class="refund-note">You cancelled this refund request.</p>
            <button class="btn-secondary" @click="requestRefund(order)">
              Request again
            </button>
          </div>

          <div class="action-buttons refund-status"
            v-else-if="(resolveRefundState(order) === 'requested' || order.status === 'refund_requested') && !['approved', 'processed'].includes(resolveRefundState(order))">
            <!-- <div class="refund-badge pending">
              <span class="refund-icon">⏳</span>
              <span class="refund-text">Refund Requested</span>
            </div> -->
            <button class="btn-tertiary" @click="cancelRefundRequest(order)" :disabled="isCancellingRefund">
              {{ isCancellingRefund ? 'Cancelling...' : 'Cancel refund request' }}
            </button>
            <p class="refund-note">Your refund request is being reviewed.</p>
          </div>

          <div class="action-buttons" v-else-if="order.status === 'delivered' && resolveRefundState(order) === 'none'">
            <button class="btn-secondary" @click="requestRefund(order)">
              Request refund
            </button>
          </div>

          <!-- <div class="action-buttons" v-else-if="order.status === 'shipped'">
            <button class="btn-primary" @click="trackOrder(order.orderId)">
              Track order
            </button>
            <button class="btn-primary" @click="contactSeller(order.orderId)">
              Contact seller
            </button>
          </div> -->

          <div class="action-buttons" v-else-if="order.status === 'pending' || order.status === 'paid'">
            <button class="btn-secondary" @click="showCancelConfirmation(order._id || order.orderId)">
              Cancel order
            </button>
            <span v-if="order.status === 'paid' && order.paymentMethod !== 'cod'" class="cancel-refund-note">
              (You'll receive a refund to your wallet)
            </span>
          </div>

          <!-- Order Details Footer -->
          <div class="shipping-address">
            <h4>Shipping Address</h4>
            <span>{{ order.shippingAddress.province }}, </span>
            <span>{{ order.shippingAddress.city }}, </span>
            <span>{{ order.shippingAddress.barangay }}, </span>
            <span>{{ order.shippingAddress.street }}</span>
          </div>
          <div class="order-footer">
            <div class="footer-info">
              <div class="info-row">
                <span class="info-label">Tracking:</span>
                <span class="order-id">{{ order.trackingNumber.toUpperCase() }}</span>

              </div>
              <div class="info-row">
                <span class="info-label">Delivery Method:</span>

                <div class="delivery-method">
                  <div class="delivery-details">
                    <span class="order-id">{{ formatShippingMethod(order.shippingOption) }}</span>
                    <span v-if="order.shippingFee > 0" class="delivery-fee">
                      ({{ formatCurrency(order.shippingFee) }})
                    </span>
                  </div>
                  <button v-if="hasAgreementShipping(order)" @click="openChat(order)" class="chat-link">
                    💬
                  </button>
                </div>


              </div>

              <div class="info-row">
                <span class="info-label">Order Date:</span>
                <span class="order-date">{{ formatDate(order.updatedAt) }}</span>
              </div>
            </div>
            <div class="payment-info">
              <div class="info-row">
                <span class="info-label">Payment:</span>
                <span class="payment-method">{{ formatPaymentMethod(order.paymentMethod) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span
                  :class="['payment-badge', (order.paymentStatus?.toLowerCase() === 'paid' || order.status === 'paid' || order.status === 'delivered' || order.status === 'shipped') ? 'badge-paid' : 'badge-unpaid']">
                  {{ (order.paymentStatus?.toLowerCase() === 'paid' || order.status === 'paid' || order.status ===
                    'delivered' || order.status === 'shipped') ? 'Paid' : 'Unpaid' }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Loading indicator for infinite scroll -->
      <div v-if="orderStore.isLoadingMore" class="loading-more">
        <div class="spinner"></div>
        <span>Loading more orders...</span>
      </div>

      <!-- Infinite scroll sentinel -->
      <div v-if="orderStore.hasMore" ref="sentinelRef" class="sentinel"></div>
    </div>
  </section>
</template>


<style scoped>
.orders-wrapper {
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  height: 100dvh;
  overflow: auto;
  padding-bottom: 4rem;
  transition: all var(--transition-fast);
}

/* Page Header - Shopping Cart Style */
.page-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border-color);
  /* padding: 1rem 1.5rem; */
  position: sticky;
  top: 0;
  z-index: 20;
  transition: all var(--transition-fast);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem .5rem;
  
  border-bottom: 1px solid var(--border-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: .2rem;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var( --primary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.back-button:hover {
  background: var(--surface-hover);
  color: var( --primary-color);
}

.back-button:active {
  transform: scale(0.95);
}

.back-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.page-title {
  font-size: clamp(1.25rem, 2vw, 1.7rem);
  font-weight: 600;
  color: var( --primary-color);
  margin: 0;
  letter-spacing: -0.025em;
  transition: color var(--transition-fast);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid;
}

.action-button.secondary {
  background: var(--surface);
  border-color: var(--border-color);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.action-button.secondary:hover {
  background: var(--surface-hover);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.action-button.primary {
  background: var( --primary-color, #1f8b4e);
  border-color: var( --primary-color, #1f8b4e);
  color: #ffffff;
}

.action-button.primary:hover {
  background: var( --primary-color-hover, #166b3c);
  border-color: var( --primary-color-hover, #166b3c);
}

/* Tab Navigation */
.tab-nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 60px;
  z-index: 10;
  box-shadow: var(--shadow-sm);
  max-width: 1200px;
  display: flex;
  width: 100dvw;
  justify-content: center;
  margin: 0 auto;
  transition: all var(--transition-fast);
}

.tab-nav-inner {
  display: flex;
  width: fit-content;
  overflow: auto;
  max-width: 100dvw;
  padding: 0px 10px;
}

.tab-nav-inner::-webkit-scrollbar {
  display: none;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  border: none;
  background: none;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  position: relative;
  white-space: nowrap;
  min-width: fit-content;
  border-bottom: 2px solid transparent;
}

.tab-button:hover {
  color: var( --primary-color);
  background: var(--surface-hover);
}

.tab-button.active {
  color: var( --primary-color);
  border-bottom-color: var( --primary-color);
  background: var(--surface-hover);
}

.tab-text {
  font-weight: 600;
}

.tab-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  background: var( --primary-color);
  color: white;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  padding: 0 6px;
}

.tab-button.active .tab-count {
  background: var( --primary-color);
}

/* Orders Container */
.orders-container {
  flex: 1;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  padding: var(--spacing-2);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  padding: var(--spacing-4);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: var(--spacing-3);
  opacity: 0.6;
}

.empty-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-2) 0;
  line-height: 1.2;
  transition: color var(--transition-fast);
}

.empty-description {
  font-size: 16px;
  color: var(--text-secondary);
  margin: 0;
  max-width: 400px;
  transition: color var(--transition-fast);
}

/* Orders Grid */
.orders-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  animation: fadeIn 0.3s ease;
  padding: 0.5rem;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Order Card */
.order-card {
  background: linear-gradient(180deg, color-mix(in srgb, var( --primary-color, #1f8b4e) 6%, var(--surface)) 0%, var(--surface) 50%);
  border-radius: 16px;
  box-shadow: 0 4px 24px color-mix(in srgb, var( --primary-color, #1f8b4e) 10%, transparent);
  overflow: hidden;
  transition: all 0.2s ease;
  animation: slideIn 0.3s ease forwards;
  opacity: 0;
  border: 1px solid color-mix(in srgb, var( --primary-color, #1f8b4e) 15%, var(--border-color));
  position: relative;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.order-card:hover {
  box-shadow: 0 8px 32px color-mix(in srgb, var( --primary-color, #1f8b4e) 18%, transparent);
  transform: translateY(-2px);
}

/* Order Header */
.order-header {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: color-mix(in srgb, var(--surface) 95%, var( --primary-color, #1f8b4e) 5%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.store-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  width: 100%;
  justify-content: space-between;
}

.store-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var( --primary-color);
  padding: 0.35rem 0.625rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  background: color-mix(in srgb, var( --primary-color, #1f8b4e) 8%, var(--surface));
  border: 1px solid color-mix(in srgb, var( --primary-color, #1f8b4e) 15%, transparent);
}

.store-icon {
  font-size: 14px;
}

.store-icon .icon {
  height: 1.125rem;
  aspect-ratio: 1;
  color: var( --primary-color);
}

.status-badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.order-status,
.payment-status {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.status-delivered {
  background: linear-gradient(135deg, var(--success-500, #10b981) 0%, color-mix(in srgb, var(--success-500, #10b981) 80%, #065f46 20%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--success-500, #10b981) 32%, transparent);
}

.status-shipped {
  background: linear-gradient(135deg, var(--info-500, #3b82f6) 0%, color-mix(in srgb, var(--info-500, #3b82f6) 80%, #1d4ed8 20%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--info-500, #3b82f6) 32%, transparent);
}

.status-pending,
.status-refund-requested {
  background: linear-gradient(135deg, var(--warning-500, #f59e0b) 0%, color-mix(in srgb, var(--warning-500, #f59e0b) 78%, #c2410c 22%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--warning-500, #f59e0b) 32%, transparent);
}

.status-paid,
.status-refunded,
.payment-paid {
  background: linear-gradient(135deg, var(--success-500, #10b981) 0%, color-mix(in srgb, var(--success-500, #10b981) 80%, #059669 20%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--success-500, #10b981) 32%, transparent);
}

.status-cancelled {
  background: linear-gradient(135deg, var(--danger-500, #ef4444) 0%, color-mix(in srgb, var(--danger-500, #ef4444) 80%, #b91c1c 20%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--danger-500, #ef4444) 32%, transparent);
}

.status-refund-requested {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.status-refund-approved {
  background: linear-gradient(135deg, var( --primary-color, #1f8b4e) 0%, color-mix(in srgb, var( --primary-color, #1f8b4e) 70%, #115e59 30%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var( --primary-color, #1f8b4e) 30%, transparent);
}

.status-refund-rejected {
  background: linear-gradient(135deg, var(--danger-500, #ef4444) 0%, color-mix(in srgb, var(--danger-500, #ef4444) 80%, #b91c1c 20%) 100%);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--danger-500, #ef4444) 32%, transparent);
}

.status-refunded {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.payment-paid {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.payment-unpaid {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%);
  box-shadow: 0 2px 4px rgba(100, 116, 139, 0.3);
}

/* Delivery Status */
.delivery-status {
  display: flex;
  align-items: center;
  padding: var(--spacing-2) var(--spacing-3);
  background: color-mix(in srgb, var(--bg-secondary, #f8fafc) 92%, transparent 8%);
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.delivery-icon {
  font-size: 18px;
  margin-right: var(--spacing-2);
  color: var(--gray-600);
}

.delivery-info {
  flex: 1;
}

.delivery-time {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  transition: color var(--transition-fast);
}

.delivery-message {
  font-size: 13px;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.delivery-arrow {
  font-size: 16px;
  color: var(--gray-400);
}

/* Items Section */
.items-section {
  padding: var(--spacing-3);
}

.item-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin-bottom: var(--spacing-2);
  padding: var(--spacing-2);
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  transition: all var(--transition-fast);
}

.item-card:last-child {
  margin-bottom: 0;
}

.item-main {
  display: flex;
  gap: var(--spacing-2);
  width: 100%;
}

.item-image {
  width: 70px;
  height: 70px;
  border-radius: var(--border-radius);
  overflow: hidden;
  background: var(--surface);
  flex-shrink: 0;
  box-shadow: 0 0 5px var(--shadow-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  min-width: 0;
}

/* Item Actions (Review Button) */
.item-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
}

.btn-review {
  padding: 0.375rem 0.75rem;
  background: var( --primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-review:hover {
  background: var( --primary-color-hover);
}

.review-submitted {
  color: var(--success-color);
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.4;
  transition: color var(--transition-fast);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-variant {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  transition: color var(--transition-fast);
  font-style: italic;
}

.item-quantity {
  font-size: 12px;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
  font-weight: 500;
}

.item-price {
  text-align: right;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  padding-top: 0.125rem;
}

.price {
  font-size: 15px;
  font-weight: 700;
  color: var(--secondary-color);
  transition: color var(--transition-fast);
  white-space: nowrap;
}

/* Order Total */
.order-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  transition: all var(--transition-fast);
}

.total-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.total-amount {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  align-items: center;
  background: color-mix(in srgb, var( --primary-color, #1f8b4e) 3%, var(--surface));
}

.action-buttons.refund-status {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
}

.refund-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
}

.refund-badge.pending {
  background: color-mix(in srgb, var(--warning-500, #f59e0b) 12%, var(--surface));
  color: var(--warning-500, #f59e0b);
  border: 1px solid color-mix(in srgb, var(--warning-500, #f59e0b) 30%, transparent);
}

.refund-badge.success {
  background: color-mix(in srgb, var(--success-500, #10b981) 12%, var(--surface));
  color: var(--success-500, #10b981);
  border: 1px solid color-mix(in srgb, var(--success-500, #10b981) 30%, transparent);
}

.refund-badge.neutral {
  background: color-mix(in srgb, var(--text-secondary) 8%, var(--surface));
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.refund-icon {
  font-size: 0.875rem;
}

.refund-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.cancel-refund-note {
  font-size: 0.75rem;
  color: var(--warning-500, #f59e0b);
  font-style: italic;
}

.btn-secondary,
.btn-primary,
.btn-tertiary {
  flex: 1;
  padding: 0.625rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: color-mix(in srgb, var( --primary-color, #1f8b4e) 8%, var(--surface));
  border-color: var( --primary-color);
  color: var( --primary-color);
}

.btn-primary {
  background: var( --primary-color, #1f8b4e);
  color: #ffffff;
}

.btn-primary:hover {
  background: var( --primary-color-hover, #166b3c);
}

.btn-tertiary {
  flex: none;
  padding: 0.5rem 0.875rem;
  background: transparent;
  border: 1px dashed var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
}

.btn-tertiary:hover {
  border-color: var( --primary-color);
  color: var( --primary-color);
}

/* Order Footer */
.order-footer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  transition: all var(--transition-fast);
}

.shipping-address {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  transition: all var(--transition-fast);
}

.shipping-address h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color var(--transition-fast);
}

.shipping-address span {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color var(--transition-fast);
}

.footer-info,
.payment-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.order-id,
.payment-method {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.order-date {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.payment-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-paid {
  background: var(--success-color);
  color: white;
}

.badge-unpaid {
  background: var(--error-color);
  color: white;
}

.payment-paid {
  color: var(--success-600);
}

.payment-pending {
  color: var(--warning-600);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    gap: 1rem;
  }

  .back-button {
    width: 2.25rem;
    height: 2.25rem;
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .header-right {
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }

  .action-button span {
    display: none;
  }

  .action-button.secondary::after {
    content: "⚙";
    font-size: 1rem;
  }

  .action-button.primary::after {
    content: "🔍";
    font-size: 1rem;
  }

  .orders-container {
    max-width: 100%;
    padding: var(--spacing-1);
  }

  .tab-button {
    padding: var(--spacing-2);
    font-size: 13px;
  }

  .order-footer {
    grid-template-columns: 1fr;
    gap: var(--spacing-1);
  }

  .item-image {
    width: 60px;
    height: 60px;
  }

  .item-name {
    font-size: 13px;
  }

  .item-variant,
  .item-quantity {
    font-size: 11px;
  }

  .price {
    font-size: 14px;
  }

  .btn-review {
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
  }
}

@media (max-width: 480px) {
  .store-info {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-1);
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-secondary,
  .btn-primary {
    flex: none;
  }

  .item-image {
    width: 55px;
    height: 55px;
  }

  .item-main {
    gap: 0.5rem;
  }

  .item-details {
    flex-direction: column;
    gap: 0.5rem;
  }

  .item-price {
    align-items: flex-start;
    padding-top: 0;
  }

  .price {
    font-size: 13px;
  }
}

/* Focus and Accessibility */
.tab-button:focus-visible,
.btn-secondary:focus-visible,
.btn-primary:focus-visible {
  outline: 2px solid var( --primary-color);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {

  .order-card,
  .tab-button,
  .btn-secondary,
  .btn-primary,
  .star {
    transition: none;
  }

  .orders-grid {
    animation: none;
  }

  .order-card {
    animation: none;
    opacity: 1;
  }
}

/* Delivery Info Section */
.delivery-info-section {
  padding: var(--spacing-2) var(--spacing-3);
  background: color-mix(in srgb, var( --primary-color, #1f8b4e) 5%, var(--surface));
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.delivery-method {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: 14px;
}

.delivery-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.delivery-details {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-grow: 1;
  flex-wrap: wrap;
}

.delivery-label {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.8125rem;
}

.delivery-value {
  color: var( --primary-color);
  font-weight: 600;
  font-size: 0.8125rem;
}

.delivery-fee {
  color: var(--text-secondary);
  font-weight: 400;
  font-size: 0.75rem;
}

.chat-link {
  background: var( --primary-color);
  color: white;
  border: none;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
  white-space: nowrap;
}

.chat-link:hover {
  background: var( --primary-color-hover);
}

/* Cancel Order Modal Styles */
.cancel-order-details {
  margin-top: 0.75rem;
}

.order-summary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.summary-title {
  color: #1E293B;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  font-size: 14px;
}

.summary-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 13px;
}

.summary-info:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #64748B;
  font-weight: 500;
}

.info-value {
  color: #1E293B;
  font-weight: 600;
}

.warning-section {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 8px;
  padding: 1rem;
}

.warning-text {
  color: #B91C1C;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  font-size: 14px;
}

.warning-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #7F1D1D;
  font-size: 13px;
  line-height: 1.4;
}

.warning-list li {
  margin-bottom: 0.25rem;
}

.warning-list li:last-child {
  margin-bottom: 0;
}

/* Refund Modal Styles */
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
  padding: 1rem;
}

.refund-modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.refund-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #E2E8F0;
}

/* ============================
   Modern Refund Modal Styles
   ============================ */

/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-active .refund-modal-container,
.modal-fade-leave-active .refund-modal-container {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .refund-modal-container,
.modal-fade-leave-to .refund-modal-container {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

/* Overlay */
.refund-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

/* Modal Container */
.refund-modal-container {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* Header */
.refund-modal-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface);
}

.refund-modal-header .header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var( --primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
}

.refund-modal-header .header-text {
  flex: 1;
}

.refund-modal-header .header-text h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  line-height: 1.3;
}

.refund-modal-header .header-text p {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  color: #6B7280;
}

.refund-modal-header .close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #9CA3AF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.refund-modal-header .close-btn:hover {
  background: #F3F4F6;
  color: #374151;
}

/* Body */
.refund-modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

/* Order Info Card */
.order-info-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.order-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.order-info-row:not(:last-child) {
  border-bottom: 1px solid #E5E7EB;
}

.order-info-row.highlight {
  background: linear-gradient(135deg, rgba(var(--primary-rgb, 79, 70, 229), 0.08), rgba(var(--primary-rgb, 79, 70, 229), 0.03));
  margin: 0.5rem -1rem -1rem;
  padding: 0.75rem 1rem;
  border-radius: 0 0 12px 12px;
  border-bottom: none;
}

.order-info-row .info-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6B7280;
}

.order-info-row .info-label svg {
  opacity: 0.6;
}

.order-info-row .info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.order-info-row .info-value.amount {
  font-size: 1rem;
  font-weight: 600;
  color: var( --primary-color);
}

/* Form Sections */
.form-section {
  margin-bottom: 1.5rem;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.75rem;
}

.required-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  background: #FEE2E2;
  color: #DC2626;
  border-radius: 4px;
}

.optional-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.125rem 0.375rem;
  background: #E5E7EB;
  color: #6B7280;
  border-radius: 4px;
}

/* Reason Grid */
.reason-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.625rem;
}

.reason-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  border: 2px solid #E5E7EB;
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.reason-option:hover {
  border-color: var(--border-color);
  background: var(--bg-secondary);
}

.reason-option.selected {
  border-color: var( --primary-color);
  background: color-mix(in srgb, var( --primary-color) 8%, var(--surface));
}

.reason-option .reason-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.reason-option .reason-text {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.2;
}

/* Details Textarea */
.details-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  font-size: 0.875rem;
  color: var(--text-primary);
  background: var(--surface);
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  transition: all 0.2s;
}

.details-textarea:focus {
  outline: none;
  border-color: var( --primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var( --primary-color) 15%, transparent);
}

.details-textarea::placeholder {
  color: var(--text-secondary);
}

/* Notice Banner */
.notice-banner {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: linear-gradient(135deg, #FEF3C7, #FEF9C3);
  border: 1px solid #FCD34D;
  border-radius: 12px;
}

.notice-banner .notice-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #F59E0B;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notice-banner .notice-content {
  flex: 1;
}

.notice-banner .notice-content strong {
  display: block;
  font-size: 0.875rem;
  color: #92400E;
  margin-bottom: 0.375rem;
}

.notice-banner .notice-content ul {
  margin: 0;
  padding-left: 1.125rem;
  font-size: 0.8125rem;
  color: #A16207;
  line-height: 1.5;
}

.notice-banner .notice-content li {
  margin-bottom: 0.125rem;
}

/* Footer */
.refund-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #E5E7EB;
  background: #F9FAFB;
}

.refund-modal-footer .btn-secondary {
  padding: 0.625rem 1.25rem;
  border: 2px solid #E5E7EB;
  border-radius: 10px;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.refund-modal-footer .btn-secondary:hover:not(:disabled) {
  border-color: var(--border-color);
  background: var(--bg-secondary);
}

.refund-modal-footer .btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: var( --primary-color);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.refund-modal-footer .btn-primary:hover:not(:disabled) {
  background: var( --primary-color-hover);
}

.refund-modal-footer .btn-primary:disabled,
.refund-modal-footer .btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Loading Spinner */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Dark Mode Styles */
.refund-modal-container.dark {
  background: #1F2937;
}

.refund-modal-container.dark .refund-modal-header {
  background: linear-gradient(to bottom, #1F2937, #1F2937);
  border-color: #374151;
}

.refund-modal-container.dark .header-text h3 {
  color: #F9FAFB;
}

.refund-modal-container.dark .header-text p {
  color: #9CA3AF;
}

.refund-modal-container.dark .close-btn {
  color: #6B7280;
}

.refund-modal-container.dark .close-btn:hover {
  background: #374151;
  color: #E5E7EB;
}

.refund-modal-container.dark .order-info-card {
  background: #111827;
  border-color: #374151;
}

.refund-modal-container.dark .order-info-row:not(:last-child) {
  border-color: #374151;
}

.refund-modal-container.dark .order-info-row.highlight {
  background: linear-gradient(135deg, rgba(var(--primary-rgb, 79, 70, 229), 0.15), rgba(var(--primary-rgb, 79, 70, 229), 0.08));
}

.refund-modal-container.dark .order-info-row .info-label {
  color: #9CA3AF;
}

.refund-modal-container.dark .order-info-row .info-value {
  color: #E5E7EB;
}

.refund-modal-container.dark .form-label {
  color: #E5E7EB;
}

.refund-modal-container.dark .reason-option {
  background: #111827;
  border-color: #374151;
}

.refund-modal-container.dark .reason-option:hover {
  border-color: #4B5563;
  background: #1F2937;
}

.refund-modal-container.dark .reason-option.selected {
  border-color: var( --primary-color);
  background: color-mix(in srgb, var( --primary-color) 15%, transparent);
}

.refund-modal-container.dark .reason-option .reason-text {
  color: #E5E7EB;
}

.refund-modal-container.dark .details-textarea {
  background: #111827;
  border-color: #374151;
  color: #E5E7EB;
}

.refund-modal-container.dark .details-textarea:focus {
  border-color: var( --primary-color);
}

.refund-modal-container.dark .details-textarea::placeholder {
  color: #6B7280;
}

.refund-modal-container.dark .notice-banner {
  background: linear-gradient(135deg, #422006, #451A03);
  border-color: #78350F;
}

.refund-modal-container.dark .notice-banner .notice-content strong {
  color: #FCD34D;
}

.refund-modal-container.dark .notice-banner .notice-content ul {
  color: #FBBF24;
}

.refund-modal-container.dark .refund-modal-footer {
  background: #111827;
  border-color: #374151;
}

.refund-modal-container.dark .btn-secondary {
  background: #374151;
  border-color: #4B5563;
  color: #E5E7EB;
}

.refund-modal-container.dark .btn-secondary:hover:not(:disabled) {
  background: #4B5563;
  border-color: #6B7280;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .refund-modal-container {
    max-height: 95vh;
    margin: 0.5rem;
    border-radius: 12px;
  }

  .refund-modal-header {
    padding: 1rem;
  }

  .refund-modal-header .header-icon {
    width: 40px;
    height: 40px;
  }

  .refund-modal-body {
    padding: 1rem;
  }

  .reason-grid {
    grid-template-columns: 1fr;
  }

  .refund-modal-footer {
    padding: 1rem;
    flex-direction: column-reverse;
  }

  .refund-modal-footer .btn-secondary,
  .refund-modal-footer .btn-primary {
    width: 100%;
    justify-content: center;
  }
}

/* Infinite scroll sentinel */
.sentinel {
  height: 20px;
  width: 100%;
}

/* Loading more indicator */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg) 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.loading-more .spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top: 2px solid var( --primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Skeleton Loading */
.skeleton-card {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  animation: none;
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  background: var(--skeleton-base);
  border-radius: 50%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-text {
  height: 16px;
  background: var(--skeleton-base);
  border-radius: 4px;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-text-short {
  width: 80px;
}

.skeleton-text-medium {
  width: 120px;
}

.skeleton-text-long {
  width: 200px;
  margin-bottom: var(--spacing-sm);
}

.skeleton-badge {
  width: 60px;
  height: 24px;
  background: var(--skeleton-base);
  border-radius: 12px;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-content {
  margin-bottom: var(--spacing-lg);
}

.skeleton-stats {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.skeleton-stat {
  width: 80px;
  height: 20px;
  background: var(--skeleton-base);
  border-radius: 10px;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.skeleton-button {
  height: 44px;
  background: var(--skeleton-base);
  border-radius: 8px;
  animation: shimmer 1.5s ease-in-out infinite;
  flex: 1;
}

@keyframes shimmer {
  0% {
    background: var(--skeleton-base);
  }
  50% {
    background: var(--skeleton-shimmer);
  }
  100% {
    background: var(--skeleton-base);
  }
}
</style>