<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted, onActivated, onDeactivated, defineAsyncComponent, watch } from "vue";
const ProductCard = defineAsyncComponent(() => import("../components/ProductCard.vue"));
import { formatToPHCurrency } from "../utils/currencyFormat"
import {
  ShoppingCartIcon,
  HandThumbUpIcon,
  ChatBubbleLeftIcon,
  MapPinIcon,
  TruckIcon,
  ShieldCheckIcon,
  BuildingStorefrontIcon,
  CheckBadgeIcon,
  MinusIcon,
  PlusIcon,
} from "@heroicons/vue/24/outline";
import { StarIcon, HeartIcon } from "@heroicons/vue/24/solid";
import { ProductOption } from "../types/product";
import MiniHeader from "../components/MiniHeader.vue";
import CheckoutModal from "../components/ChecoutModal.vue";
import { Alert } from "../components/composable/Alert"
import { useProductsStore } from "../stores/productStores"
import { useReviewStore } from "../stores/reviewStore"
import { useAuthStore } from "../stores/authStores"
import { useCartStore } from "../stores/cartStores"
import { useOrderStore } from "../stores/OrderStores"
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "../composables/useTheme";

// Define component name for keep-alive
defineOptions({
  name: 'ViewProduct'
})

const route = useRoute();
const router = useRouter();
const productStore = useProductsStore();
const reviewStore = useReviewStore();
const authStore = useAuthStore();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const { isDark } = useTheme();

// Loading state
const isLoading = ref(true);
const isLoadingReviews = ref(false);
const isImageTransitioning = ref(false);

// Scroll position tracking for keep-alive
let savedScrollPosition = 0;

// Component state
const selectedImage = ref<string>("");
const selectedOption = ref<ProductOption | null>(null);
const currentImageIndex = ref(0);
const isWishlisted = ref(false);
const quantity = ref(1);
const activeTab = ref<'description' | 'reviews'>('description');
const showOptions = ref(false);
const showOptionsModal = ref(false);
const showCheckoutModal = ref(false);
const buyNowItems = ref([]);
const isBuyNowLoading = ref(false);
const showQuantityModal = ref(false);
const buyNowQuantity = ref(1);

// ============================================
// IMAGE SLIDER - BULLETPROOF IMPLEMENTATION
// ============================================
class ImageSlider {
  private intervalId: number | null = null;
  private timeoutId: number | null = null;
  private isActive: boolean = false;
  private isTransitioning: boolean = false;
  private userInteracting: boolean = false;
  
  private readonly SLIDE_INTERVAL = 3000; // 3 seconds - FIXED
  private readonly USER_DELAY = 5000; // 5 seconds after user interaction
  
  constructor() {
    console.log('🎬 ImageSlider initialized');
  }
  
  /**
   * Start the automatic slideshow
   * GUARANTEED to only have ONE interval running
   */
  start(images: string[], currentIndex: number, onSlide: (nextIndex: number) => void): void {
    // CRITICAL: Always stop first
    this.stop();
    
    // Validate
    if (!images || images.length <= 1) {
      console.log('⏭️ Not starting - need 2+ images');
      return;
    }
    
    if (this.userInteracting) {
      console.log('⏭️ Not starting - user is interacting');
      return;
    }
    
    if (this.isActive) {
      console.log('⚠️ Already active - this should never happen');
      return;
    }
    
    console.log('▶️ Starting slideshow - interval:', this.SLIDE_INTERVAL);
    this.isActive = true;
    
    // Create interval with FIXED timing
    this.intervalId = window.setInterval(() => {
      // Safety checks inside interval
      if (this.userInteracting || this.isTransitioning) {
        return; // Skip this cycle
      }
      
      const nextIndex = (currentIndex + 1) % images.length;
      console.log('🎬 Auto-slide:', currentIndex, '→', nextIndex);
      onSlide(nextIndex);
      currentIndex = nextIndex; // Update for next iteration
    }, this.SLIDE_INTERVAL);
  }
  
  /**
   * Stop the slideshow completely
   * GUARANTEED to clear all timers
   */
  stop(): void {
    if (this.intervalId !== null) {
      console.log('⏹️ Stopping slideshow');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.timeoutId !== null) {
      console.log('⏹️ Clearing restart timeout');
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.isActive = false;
    this.userInteracting = false;
  }
  
  /**
   * Pause slideshow temporarily for user interaction
   * Will auto-resume after delay
   */
  pauseForUserInteraction(images: string[], currentIndex: number, onSlide: (nextIndex: number) => void): void {
    console.log('👆 User interaction - pausing slideshow');
    
    // Stop everything
    this.stop();
    
    // Mark as user interacting
    this.userInteracting = true;
    
    // Schedule restart
    this.timeoutId = window.setTimeout(() => {
      console.log('⏰ User interaction timeout - resuming slideshow');
      this.userInteracting = false;
      this.start(images, currentIndex, onSlide);
    }, this.USER_DELAY);
  }
  
  /**
   * Set transition state
   */
  setTransitioning(value: boolean): void {
    this.isTransitioning = value;
  }
  
  /**
   * Get current state
   */
  getState() {
    return {
      isActive: this.isActive,
      userInteracting: this.userInteracting,
      isTransitioning: this.isTransitioning,
      hasInterval: this.intervalId !== null,
      hasTimeout: this.timeoutId !== null
    };
  }
  
  /**
   * Complete cleanup
   */
  destroy(): void {
    console.log('🧹 Destroying ImageSlider');
    this.stop();
  }
}

// Create slider instance
const imageSlider = new ImageSlider();

// Review state
const sortBy = ref<'createdAt' | 'rating' | 'helpful'>('createdAt');
const currentReviewPage = ref(1);

// Track current product ID (reactive for route changes)
const productId = computed(() => {
  const id = route.params.id;
  return String(id);
});
let loadedProductId = ''; // Track which product is currently loaded

const product = computed(() => {
  return productStore.productById
})

// Computed: Calculate accurate average rating from reviews
const calculatedRating = computed(() => {
  const stats = reviewStore.reviewStats;
  if (stats && stats.averageRating) {
    return Number(stats.averageRating).toFixed(1);
  }
  return product.value?.averageRating?.toFixed(1) || '0.0';
});

const totalReviews = computed(() => {
  const stats = reviewStore.reviewStats;
  if (stats && stats.totalReviews !== undefined) {
    return stats.totalReviews;
  }
  return product.value?.numReviews || 0;
});

// Review computed properties
const reviews = computed(() => reviewStore.productReviews);
const reviewStats = computed(() => reviewStore.reviewStats);
const hasMoreReviews = computed(() => reviewStore.hasMore);

// Description for display (already sanitized by backend)
const sanitizedDescription = computed(() => {
  return product.value?.description || '';
});

const productStock = computed(() => {
  const prod = product?.value;
  if (!prod) return 0;

  if (Array.isArray(prod.option) && prod.option.length > 0) {
    return prod.option.reduce((total: number, option: any) => {
      return total + (option?.stock ?? 0);
    }, 0);
  }

  return prod.stock ?? 0;
});

// Computed: Selected option stock
const currentStock = computed(() => {
  if (selectedOption.value) {
    return selectedOption.value.stock || 0;
  }
  return productStock.value;
});

// Computed: Current price based on selection
const currentPrice = computed(() => {
  if (selectedOption.value) {
    return selectedOption.value.price;
  }
  return product.value?.price || 0;
});

// Quantity controls with validation
const setQuantity = (value: number) => {
  const max = currentStock.value || 1;
  if (value < 1) {
    quantity.value = 1;
  } else if (value > max) {
    quantity.value = max;
  } else {
    quantity.value = Math.floor(value);
  }
};

const incrementQuantity = () => {
  if (quantity.value < currentStock.value) {
    quantity.value++;
  }
};

const decrementQuantity = () => {
  if (quantity.value > 1) {
    quantity.value--;
  }
};

// Watch quantity input for validation
watch(quantity, (newVal) => {
  if (typeof newVal !== 'number' || isNaN(newVal)) {
    quantity.value = 1;
  }
});

const addToCart = async () => {
  if (product?.value?.option.length <= 0) {
    await productStore.addToCart(product.value?._id, product.value?._id, quantity.value);
    return;
  }

  showOptionsModal.value = true;
};

const toggleWishlist = () => {
  isWishlisted.value = !isWishlisted.value;
};

// Load product data
function createDeferred() {
  let resolve: any, reject: any;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const pendingLoads = new Map<string, Promise<void>>();

const loadProductData = async (id: string) => {
  if (!route.path.startsWith('/product/')) {
    return;
  }

  if (!id || id === 'undefined' || id === 'null') {
    console.warn('ViewProduct: Invalid product ID');
    return;
  }

  // Fast path: already loaded
  if (loadedProductId === id && product.value?._id === id) {
    if (product.value?.imageUrls?.length > 0) {
      selectedImage.value = product.value.imageUrls[0];
      currentImageIndex.value = 0;
      startImageSlideshow();
    }
    return;
  }

  if (pendingLoads.has(id)) {
    try {
      await pendingLoads.get(id);
    } catch (err) {
      console.error('Previous load failed:', err);
      return;
    }

    if (product.value?.imageUrls && product.value.imageUrls.length > 0) {
      selectedImage.value = product.value.imageUrls[0];
      currentImageIndex.value = 0;
      startImageSlideshow();
    }

    loadedProductId = id;
    return;
  }

  const deferred = createDeferred();
  pendingLoads.set(id, deferred.promise);

  isLoading.value = true;
  let loadError: any = null;
  
  try {
    // CRITICAL: Stop slideshow before loading
    imageSlider.stop();
    
    // Clear state
    productStore.productById = {} as any;
    productStore.relatedProducts = [];
    selectedImage.value = "";
    currentImageIndex.value = 0;

    await productStore.fetchProductsById(id);
    isLoading.value = false;

    productStore.fetchRelatedProducts(id).catch(err => {
      console.error('Failed to load related products:', err);
    });

    isLoadingReviews.value = true;
    Promise.all([
      reviewStore.fetchProductReviews(id, 1, sortBy.value),
      reviewStore.fetchReviewStats(id)
    ]).catch(err => {
      console.error('Failed to load reviews:', err);
    }).finally(() => {
      isLoadingReviews.value = false;
    });

    if (product.value?.imageUrls && product.value?.imageUrls?.length > 0) {
      selectedImage.value = product.value.imageUrls[0];
      currentImageIndex.value = 0;
      startImageSlideshow();
    }
    loadedProductId = id;
  } catch (error: any) {
    loadError = error;
    const status = error?.status || error?.response?.status;
    const message = error?.message || 'Failed to load product.';
    console.error('Failed to load product:', error);

    if (status === 404) {
      router.replace({ name: 'NotFound', query: { source: 'product', id } });
      return;
    }
  } finally {
    isLoading.value = false;
    if (loadError) {
      try { deferred.reject(loadError); } catch (e) { /* ignore */ }
      pendingLoads.delete(id);
      throw loadError;
    } else {
      try { deferred.resolve(); } catch (e) { /* ignore */ }
      pendingLoads.delete(id);
    }
  }
};

onMounted(async () => {
  if (!route.path.startsWith('/product/')) {
    return;
  }

  // Initialize authentication state
  try {
    await authStore.fetchSession();
    console.log('🔐 Auth initialized - isAuthenticated:', authStore.isAuthenticated);
  } catch (error) {
    console.error('🔐 Auth initialization failed:', error);
  }

  await new Promise(resolve => setTimeout(resolve, 10));
  await loadProductData(productId.value);
});

onUnmounted(() => {
  console.log('🧹 Component unmounting');
  imageSlider.destroy();
  reviewStore.clearProductReviews();
});

onActivated(async () => {
  if (!route.path.startsWith('/product/')) {
    return;
  }

  if (!productId.value || productId.value === 'undefined' || productId.value === 'null') {
    return;
  }

  if (productId.value !== loadedProductId) {
    savedScrollPosition = 0;
    await loadProductData(productId.value);
  } else {
    if (product.value?.imageUrls && product.value.imageUrls.length > 1) {
      startImageSlideshow();
    }
    
    if (savedScrollPosition > 0) {
      setTimeout(() => {
        window.scrollTo(0, savedScrollPosition);
      }, 0);
    }
  }
});

onDeactivated(() => {
  console.log('⏸️ Component deactivated');
  savedScrollPosition = window.scrollY;
  imageSlider.stop();
});

// Watch for route param changes
watch(productId, async (newId, oldId) => {
  if (newId && newId !== oldId && newId !== loadedProductId) {
    savedScrollPosition = 0;
    const container = document.querySelector('.product-details-page');
    if (container) {
      container.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);
    await loadProductData(newId);
  }
});

/**
 * Smooth image transition
 */
const transitionToImage = (image: string, index: number) => {
  if (isImageTransitioning.value) {
    return;
  }

  imageSlider.setTransitioning(true);
  isImageTransitioning.value = true;
  currentImageIndex.value = index;

  setTimeout(() => {
    selectedImage.value = image;
    setTimeout(() => {
      isImageTransitioning.value = false;
      imageSlider.setTransitioning(false);
    }, 300);
  }, 50);
};

/**
 * Start slideshow using the ImageSlider class
 */
const startImageSlideshow = () => {
  if (!product.value?.imageUrls || product.value.imageUrls.length <= 1) {
    return;
  }
  
  console.log('🎬 Starting slideshow wrapper');
  
  imageSlider.start(
    product.value.imageUrls,
    currentImageIndex.value,
    (nextIndex) => {
      if (product.value?.imageUrls) {
        transitionToImage(product.value.imageUrls[nextIndex], nextIndex);
      }
    }
  );
};

/**
 * Handle manual image selection
 */
const selectImageManually = (image: string, index: number) => {
  console.log('👆 User selected image:', index);
  
  // Transition immediately
  transitionToImage(image, index);
  
  // Pause slideshow and schedule restart
  if (product.value?.imageUrls && product.value.imageUrls.length > 1) {
    imageSlider.pauseForUserInteraction(
      product.value.imageUrls,
      index,
      (nextIndex) => {
        if (product.value?.imageUrls) {
          transitionToImage(product.value.imageUrls[nextIndex], nextIndex);
        }
      }
    );
  }
};

const selectOption = (option: ProductOption) => {
  selectedOption.value = option;
  quantity.value = 1;
  if (option.imageUrl) {
    selectedImage.value = option.imageUrl;
  }
};

const closeOptionsModal = () => {
  showOptionsModal.value = false;
  selectedOption.value = null;
};

const confirmAddToCart = async () => {
  if (!selectedOption.value) return;

  await productStore.addToCart(selectedOption.value._id, productStore.productId, quantity.value);
  showOptionsModal.value = false;
  selectedOption.value = null;
};

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  target.src = "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400";
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US").format(num);
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "Recently";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Quantity controls for buy now modal
const setBuyNowQuantity = (value: number) => {
  const max = currentStock.value || 1;
  if (value < 1) {
    buyNowQuantity.value = 1;
  } else if (value > max) {
    buyNowQuantity.value = max;
  } else {
    buyNowQuantity.value = Math.floor(value);
  }
};

const incrementBuyNowQuantity = () => {
  if (buyNowQuantity.value < currentStock.value) {
    buyNowQuantity.value++;
  }
};

const decrementBuyNowQuantity = () => {
  if (buyNowQuantity.value > 1) {
    buyNowQuantity.value--;
  }
};

const confirmBuyNow = () => {
  // User confirmed quantity, proceed to checkout
  let selectedProductOption = selectedOption.value;
  
  // If no option is selected and product has options, use the first one
  if (!selectedProductOption && product.value.option && product.value.option.length > 0) {
    selectedProductOption = product.value.option[0];
  }
  
  // Format the item according to CheckoutModal expected structure
  const checkoutItem = {
    vendorId: product.value.vendorId?._id || product.value.vendorId,
    productId: product.value._id,
    optionId: selectedProductOption?._id || null,
    itemId: null,
    name: product.value.name,
    label: selectedProductOption?.label || 'Default',
    imgUrl: selectedImage.value || product.value.images[0]?.url || '',
    price: selectedProductOption?.price || product.value.price,
    quantity: buyNowQuantity.value,
    promotion: product.value.promotion
  };

  console.log('🛒 Opening checkout with item:', checkoutItem);
  
  // Set the items for checkout
  buyNowItems.value = [checkoutItem];
  
  // Close quantity modal and open checkout modal
  showQuantityModal.value = false;
  showCheckoutModal.value = true;
};

const cancelQuantitySelection = () => {
  showQuantityModal.value = false;
  buyNowQuantity.value = 1;
};

const buyNow = async () => {
  console.log('🛒 Buy Now clicked - Auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    authChecked: authStore.authChecked,
    user: authStore.user?.role
  });

  isBuyNowLoading.value = true;
  
  try {
    // Ensure authentication state is loaded
    if (!authStore.authChecked) {
      console.log('🔄 Fetching auth session...');
      await authStore.fetchSession();
    }

    // Check if user is logged in
    if (!authStore.isAuthenticated) {
      console.log('❌ User not authenticated, redirecting to login');
      // Save current product page URL to redirect back after login
      const currentPath = route.fullPath;
      router.push({
        path: '/login',
        query: { redirect: currentPath }
      });
      return;
    }

    console.log('✅ User authenticated, showing quantity selector');
    
    // Check if product is loaded
    if (!product.value) {
      console.error('❌ Product not loaded yet');
      Alert('Product not loaded. Please try again.', 'error');
      return;
    }
    
    // Reset quantity to current quantity and show modal
    buyNowQuantity.value = quantity.value;
    showQuantityModal.value = true;
    
  } catch (error) {
    console.error('❌ Buy Now error:', error);
    Alert('Something went wrong. Please try again.', 'error');
  } finally {
    isBuyNowLoading.value = false;
  }
};

const viewVendor = (vendorId) => {
  router.push(`/view/vendor/${vendorId}`)
}

// Review methods
const handleSortChange = async () => {
  currentReviewPage.value = 1;
  await reviewStore.fetchProductReviews(productId.value, 1, sortBy.value);
};

const loadMoreReviews = async () => {
  if (!hasMoreReviews.value || isLoadingReviews.value) return;
  currentReviewPage.value++;
  await reviewStore.fetchProductReviews(productId.value, currentReviewPage.value, sortBy.value);
};

const toggleHelpful = async (reviewId: string) => {
  await reviewStore.toggleHelpful(reviewId);
};

const getStarArray = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => i + 1);
};

const getRatingPercentage = (stars: number) => {
  if (!reviewStats.value) return 0;
  const total = reviewStats.value.totalReviews;
  const count = reviewStats.value.ratingDistribution[stars] || 0;
  return total > 0 ? (count / total) * 100 : 0;
};

const formatReviewDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getUserName = (user: any) => {
  if (typeof user === 'string') return 'Anonymous';
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous';
};

const getUserAvatar = (user: any) => {
  if (typeof user === 'string') return '';
  return user.imageUrl || '';
};

</script>


<template>
  <div class="product-details-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <button @click="router.back()" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
              stroke="currentColor" class="back-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 class="page-title">Product Details</h1>
        </div>
      </div>
    </div>
    <div class="container">
      <!-- Skeleton Loading State -->
      <div v-if="isLoading" class="product-main skeleton-container">
        <div class="product-images">
          <div class="main-image skeleton-image">
            <div class="skeleton-shimmer"></div>
          </div>
          <div class="thumb-con">
            <div class="image-thumbnails">
              <div v-for="i in 4" :key="i" class="thumbnail skeleton-thumb">
                <div class="skeleton-shimmer"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="product-details">
          <div class="product-info">
            <div class="skeleton-badge"></div>
            <div class="skeleton-title"></div>
            <div class="skeleton-rating"></div>
            <div class="skeleton-price"></div>
            <div class="skeleton-meta">
              <div class="skeleton-meta-item"></div>
              <div class="skeleton-meta-item"></div>
              <div class="skeleton-meta-item"></div>
            </div>
            <div class="skeleton-stock"></div>
            <div class="skeleton-options">
              <div class="skeleton-option-card"></div>
              <div class="skeleton-option-card"></div>
              <div class="skeleton-option-card"></div>
            </div>
            <div class="skeleton-quantity"></div>
            <div class="skeleton-buttons">
              <div class="skeleton-btn"></div>
              <div class="skeleton-btn"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actual Product Content -->
      <div v-else class="product-main">

        <div class="product-images">
          <div class="main-image" :class="{ transitioning: isImageTransitioning }">
            <img v-if="selectedImage" :src="selectedImage" :alt="product.name" @error="handleImageError"
              loading="lazy" />
            <div v-else class="placeholder-image">
              <div class="placeholder-icon">📷</div>
              <p>No Image Available</p>
            </div>
            <!-- Wishlist Button -->
            <button class="wishlist-btn" @click="toggleWishlist" :class="{ active: isWishlisted }">
              <HeartIcon class="heart-icon" />
            </button>
          </div>

          <div class="thumb-con">
            <div v-if="product.imageUrls && product.imageUrls.length > 0" class="image-thumbnails">
              <button v-for="(image, index) in product.imageUrls" :key="index"
                :class="['thumbnail', { active: currentImageIndex === index }]"
                @click="selectImageManually(image, index)">
                <img :src="image" :alt="`${product.name} ${index + 1}`" fetchpriority="low" loading="lazy"
                  @error="handleImageError" />
              </button>
            </div>
          </div>

          <div v-if="product.imageUrls && product.imageUrls.length > 1" class="image-indicators">
            <button v-for="(image, index) in product.imageUrls" :key="`indicator-${index}`"
              :class="['indicator', { active: currentImageIndex === index }]"
              @click="selectImageManually(image, index)"></button>
          </div>

          <!-- Seller Card - Desktop -->
          <div class="seller-card-desktop" @click="viewVendor(product.vendorId)">
            <div class="seller-avatar">
              <img src="../assets/fruit.png" alt="Store" loading="lazy" fetchpriority="low" />
              <CheckBadgeIcon v-if="product.isVerifiedSeller" class="verified-icon" />
            </div>
            <div class="seller-info">
              <h4 class="seller-name">{{ product.storeName }}</h4>
              <!-- <div class="seller-stats">
                <span class="seller-rating">
                  <StarIcon class="star-mini" />
                  {{ product.ratings || '4.8' }}
                </span>
                <span class="seller-products">{{ product.sellerProductCount || '50' }}+ Products</span>
              </div> -->
            </div>
            <BuildingStorefrontIcon class="visit-shop-icon" />
          </div>
        </div>

        <div class="product-details">
          <div class="product-info">
            <!-- Category Badge -->
            <div class="category-badge" v-if="product.category">
              {{ product.category }}
            </div>

            <!-- Product Header -->
            <div class="product-header">
              <h1 class="product-title">{{ product.name }}</h1>

              <!-- Rating Display - Using calculated rating -->
              <div class="rating-display">
                <div class="stars-row">
                  <StarIcon v-for="star in getStarArray(5)" :key="star"
                    :class="['star-display', { filled: star <= Math.round(parseFloat(calculatedRating)) }]" />
                </div>
                <span class="rating-value">{{ calculatedRating }}</span>
                <span class="reviews-count">({{ totalReviews }} reviews)</span>
                <span class="separator">|</span>
                <span class="sold-count">{{ formatNumber(product.sold || 0) }} Sold</span>
              </div>

              <div class="price-section">
                <span class="current-price">{{ formatToPHCurrency(currentPrice) }}</span>
                <span v-if="product.originalPrice && product.originalPrice > currentPrice" class="original-price">
                  {{ formatToPHCurrency(product.originalPrice) }}
                </span>
                <div class="badges">
                  <span v-if="product.isNew" class="badge badge-new">New</span>
                  <span v-if="product.isHot" class="badge badge-hot">🔥 Hot</span>
                  <span v-if="product.discount" class="badge badge-discount">-{{ product.discount }}%</span>
                </div>
              </div>
            </div>

            <!-- Product Meta -->
            <div class="product-meta">
              <div class="meta-item">
                <MapPinIcon class="meta-icon" />
                <span>{{ product.municipality || 'Oriental Mindoro' }}</span>
              </div>
              <div class="meta-item">
                <TruckIcon class="meta-icon" />
                <span>Free Shipping Available</span>
              </div>
              <div class="meta-item">
                <ShieldCheckIcon class="meta-icon" />
                <span>Buyer Protection</span>
              </div>
            </div>

            <!-- Stock Status -->
            <div class="stock-section">
              <div class="stock-status"
                :class="{ 'low-stock': currentStock < 10 && currentStock > 0, 'out-of-stock': currentStock === 0 }">
                <span v-if="currentStock > 10" class="in-stock">✓ In Stock</span>
                <span v-else-if="currentStock > 0" class="low-stock-text">Only {{ currentStock }} left!</span>
                <span v-else class="out-of-stock-text">Out of Stock</span>
              </div>
              <span class="stock-count">{{ currentStock }} units available</span>
            </div>

            <!-- Action Buttons (Desktop) -->
            <div class="action-buttons desktop-only">
              <button class="btn btn-primary btn-large" :disabled="currentStock === 0" @click="addToCart">
                <ShoppingCartIcon class="btn-icon" />
                <span v-if="currentStock === 0">Out of Stock</span>
                <span v-else>Add to Cart</span>
              </button>
              <button class="btn btn-secondary btn-large" :disabled="currentStock === 0 || isBuyNowLoading" @click="buyNow">
                <span v-if="isBuyNowLoading">Processing...</span>
                <span v-else-if="currentStock === 0">Unavailable</span>
                <span v-else>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Product Details Tabs -->
      <div class="product-details-tabs">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button :class="['tab-button', { active: activeTab === 'description' }]" @click="activeTab = 'description'">
            <span class="tab-label">Description</span>
          </button>
          <button :class="['tab-button', { active: activeTab === 'reviews' }]" @click="activeTab = 'reviews'">
            <span class="tab-label">Reviews</span>
            <span v-if="totalReviews > 0" class="tab-count">({{ totalReviews }})</span>
          </button>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Description Tab -->
          <div :class="['tab-pane description-pane', { active: activeTab === 'description' }]">
            <div class="description-content" v-html="sanitizedDescription"></div>
            <p v-if="!sanitizedDescription" class="no-description">No description available.</p>
          </div>

          <!-- Reviews Tab -->
          <div :class="['tab-pane reviews-pane', { active: activeTab === 'reviews' }]">
            <!-- Review Loading State -->
            <div v-if="isLoadingReviews" class="loading-reviews">
              <div class="loading-spinner"></div>
              <p>Loading reviews...</p>
            </div>

            <!-- Review Stats -->
            <div v-else-if="reviewStats" class="review-stats">
              <div class="stats-summary">
                <div class="average-rating">
                  <div class="rating-number">{{ reviewStats.averageRating?.toFixed(1) || calculatedRating }}</div>
                  <div class="rating-stars">
                    <StarIcon v-for="star in getStarArray(5)" :key="star"
                      :class="['star-icon', { filled: star <= Math.round(reviewStats.averageRating || 0) }]" />
                  </div>
                  <div class="rating-count">{{ reviewStats.totalReviews || totalReviews }} reviews</div>
                </div>

                <div class="rating-distribution">
                  <div v-for="stars in [5, 4, 3, 2, 1]" :key="stars" class="distribution-row">
                    <span class="stars-label">{{ stars }}</span>
                    <StarIcon class="star-small" />
                    <div class="progress-bar">
                      <div class="progress-fill" :style="{ width: `${getRatingPercentage(stars)}%` }"></div>
                    </div>
                    <span class="count-label">{{ reviewStats.ratingDistribution?.[stars] || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Reviews List -->
            <div v-if="reviews.length > 0" class="reviews-list">
              <div v-for="review in reviews" :key="review._id" class="review-item">
                <div class="review-header">
                  <div class="reviewer-info">
                    <img v-if="getUserAvatar(review.userId)" :src="getUserAvatar(review.userId)"
                      :alt="getUserName(review.userId)" class="reviewer-avatar"
                      @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" loading="lazy"
                      fetchpriority="low" />
                    <div class="reviewer-avatar-placeholder" v-else>
                      {{ getUserName(review.userId).charAt(0).toUpperCase() }}
                    </div>
                    <div class="reviewer-details">
                      <h4 class="reviewer-name">{{ getUserName(review.userId) }}
                        <div v-if="review.isVerifiedPurchase" class="verified-badge">
                          ✓ Verified Purchase
                        </div>
                      </h4>
                      <div class="review-rating">
                        <StarIcon v-for="star in getStarArray(5)" :key="star"
                          :class="['star-icon-small', { filled: star <= review.rating }]" />
                      </div>
                      <div class="review-date">{{ formatReviewDate(review.createdAt) }}</div>
                    </div>
                  </div>
                </div>

                <p class="review-comment">{{ review.comment }}</p>

                <!-- Review Images -->
                <div v-if="review.images && review.images.length > 0" class="review-images">
                  <img v-for="(image, idx) in review.images" :key="idx" :src="image" :alt="`Review image ${idx + 1}`"
                    class="review-image" loading="lazy" fetchpriority="low" />
                </div>

                <!-- Vendor Response -->
                <div v-if="review.vendorResponse" class="vendor-response">
                  <div class="response-header">
                    <ChatBubbleLeftIcon class="response-icon" />
                    <strong>Vendor Response</strong>
                  </div>
                  <p class="response-text">{{ review.vendorResponse.comment }}</p>
                  <span class="response-date">{{ formatReviewDate(review.vendorResponse.respondedAt) }}</span>
                </div>

                <!-- Review Actions -->
                <div class="review-actions">
                  <button class="helpful-btn" @click="toggleHelpful(review._id)">
                    <HandThumbUpIcon class="action-icon" />
                    <span>Helpful ({{ review.helpfulCount }})</span>
                  </button>
                </div>
              </div>

              <!-- Load More Button -->
              <div v-if="hasMoreReviews" class="load-more-container">
                <button class="btn-load-more" @click="loadMoreReviews" :disabled="isLoadingReviews">
                  {{ isLoadingReviews ? 'Loading...' : 'Load More Reviews' }}
                </button>
              </div>
            </div>

            <div v-else-if="!isLoadingReviews" class="no-reviews">
              <div class="no-reviews-icon">⭐</div>
              <h3>No reviews yet</h3>
              <p>Be the first to review this product!</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Products Section -->
      <div v-if="productStore.relatedProducts.length > 0" class="related-products">
        <h2>Related Products</h2>
        <div class="related-grid">
          <ProductCard typesOfProductList="RelatedProducts"></ProductCard>
        </div>
      </div>

      <!-- Mobile spacing for sticky buttons -->
      <div class="mobile-spacing"></div>
    </div>

    <!-- Sticky Mobile Action Buttons -->
    <div class="sticky-mobile-actions">
      <div class="mobile-action-container">
        <div class="vendor-avatar" @click="viewVendor(product.vendorId)">
          <img src="../assets/fruit.png" alt="Store" loading="lazy" fetchpriority="low" />
          <p>{{ product.storeName }}</p>
        </div>
        <!-- <div class="mobile-price-info">
          <div class="mobile-price">
            {{ formatToPHCurrency(currentPrice) }}
          </div>
          <div class="mobile-stock">
            <span v-if="currentStock > 0">{{ currentStock }} in stock</span>
            <span v-else>Out of stock</span>
          </div>
        </div> -->
        <div class="mobile-button-wrapper">
          <button class="btn btn-primary mobile-add-to-cart" :disabled="currentStock === 0" @click="addToCart">
            <ShoppingCartIcon class="cart-icon" />
            <span v-if="currentStock === 0">Out of Stock</span>
            <span v-else>Add to Cart</span>
          </button>
          <button class="mobile-buy-now" :disabled="currentStock === 0 || isBuyNowLoading" @click="buyNow">
            <span v-if="isBuyNowLoading">Processing...</span>
            <span v-else-if="currentStock === 0">Unavailable</span>
            <span v-else>Buy Now</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Options Selection Modal -->
    <div v-if="showOptionsModal" class="modal-overlay" @click="closeOptionsModal">
      <div class="options-modal" @click.stop>
        <div class="modal-header">
          <h3>Choose Your Option</h3>
          <button @click="closeOptionsModal" class="modal-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2"
              stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="options-container">
            <div v-for="option in product.option" :key="option._id" :class="['option-item', {
              selected: selectedOption?._id === option._id,
              'out-of-stock': option.stock === 0,
              available: option.stock > 0
            }]" @click="option.stock > 0 && selectOption(option)">

              <!-- Selection Indicator -->
              <div class="option-radio">
                <div class="radio-circle" :class="{ checked: selectedOption?._id === option._id }"></div>
              </div>

              <!-- Option Image -->
              <div class="option-image-wrapper">
                <img v-if="option.imageUrl" :src="option.imageUrl" :alt="option.label" class="option-image"
                  @error="handleImageError" />
                <div v-else class="option-image-placeholder">
                  <span class="placeholder-icon">📦</span>
                </div>
                <div v-if="option.stock === 0" class="stock-overlay">
                  <span class="sold-out-text">Sold Out</span>
                </div>
              </div>

              <!-- Option Details -->
              <div class="option-details">
                <h4 class="option-name">{{ option.label }}</h4>
                <div class="option-price">{{ formatToPHCurrency(option.price) }}</div>
                <div class="option-stock-info" :class="{ 'low-stock': option.stock > 0 && option.stock < 10 }">
                  <span v-if="option.stock > 0">{{ option.stock }} left</span>
                  <span v-else>Out of stock</span>
                </div>
              </div>

              <!-- Hot Badge -->
              <div v-if="option.isHot" class="hot-badge">
                <span class="hot-text">🔥 Hot</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="showOptionsModal = false" class="btn btn-secondary">Cancel</button>
          <button @click="confirmAddToCart" :disabled="!selectedOption || selectedOption.stock === 0"
            class="btn btn-primary">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Quantity Selection Modal for Buy Now -->
  <div v-if="showQuantityModal" class="modal-overlay" @click="cancelQuantitySelection">
    <div class="quantity-modal" @click.stop>
      <div class="modal-header">
        <div>
          <h3>Select Quantity</h3>
          <p class="modal-subtitle">Confirm your order details</p>
        </div>
        <button @click="cancelQuantitySelection" class="close-btn" aria-label="Close modal">✕</button>
      </div>
      
      <div class="modal-body">
        <!-- Product Information Card -->
        <div class="product-info">
          <img :src="selectedImage || (product?.images?.[0]?.url) || ''" 
               :alt="product?.name || 'Product'" 
               class="product-image"
               @error="handleImageError" />
          <div class="product-details">
            <h4>{{ product?.name }}</h4>
            <div class="price-stock">
              <p class="product-price">{{ formatToPHCurrency(currentPrice) }}</p>
              <p class="stock-info">{{ currentStock }} in stock</p>
            </div>
          </div>
        </div>
        
        <!-- Quantity Selection -->
        <div class="quantity-selector">
          <label for="quantity">QUANTITY</label>
          <div class="quantity-controls">
            <button @click="decrementBuyNowQuantity" 
                    :disabled="buyNowQuantity <= 1" 
                    class="qty-btn"
                    aria-label="Decrease quantity">
              <MinusIcon class="qty-icon" />
            </button>
            <span class="qty-display" id="quantity">{{ buyNowQuantity }}</span>
            <button @click="incrementBuyNowQuantity" 
                    :disabled="buyNowQuantity >= currentStock" 
                    class="qty-btn"
                    aria-label="Increase quantity">
              <PlusIcon class="qty-icon" />
            </button>
          </div>
        </div>
        
        <!-- Order Summary -->
        <div class="order-summary">
          <div class="summary-row">
            <span>Subtotal ({{ buyNowQuantity }} item{{ buyNowQuantity !== 1 ? 's' : '' }})</span>
            <strong>{{ formatToPHCurrency(currentPrice * buyNowQuantity) }}</strong>
          </div>
          <p class="shipping-note">🚚 Shipping calculated at checkout</p>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div class="modal-footer">
        <button @click="cancelQuantitySelection" class="btn btn-secondary">Cancel</button>
        <button @click="confirmBuyNow" 
                :disabled="buyNowQuantity === 0 || buyNowQuantity > currentStock" 
                class="btn btn-primary">
          Proceed to Checkout
        </button>
      </div>
      
      <p class="delivery-note">💡 You can review and update delivery details at checkout</p>
    </div>
  </div>

  <!-- Checkout Modal for Buy Now -->
  <CheckoutModal
    :show="showCheckoutModal"
    :selectedItems="buyNowItems"
    @close="showCheckoutModal = false"
  />
</template>

<style scoped>
.product-details-page {
  background-color: var(--bg-primary);
  height: 100dvh;
  min-height: 100dvh;
  padding-top: 0;
  overflow-x: hidden;
  transition: background-color var(--transition-fast);
}

/* Page Header */
.page-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: all var(--transition-fast);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  color: var(--primary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.back-button:hover {
  background: var(--surface-hover);
  color: var(--primary-color);
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
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--primary-color);
  margin: 0;
  letter-spacing: -0.025em;
  transition: color var(--transition-fast);
}

/* Modern Header */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

/* Main Product Section */
.product-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 3rem;
}

/* Product Images */
.product-images {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-image {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  min-height: 300px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow);
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border: 1px solid var(--border-color);
}

.main-image img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: contain;
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

.main-image.transitioning img {
  opacity: 0.7;
  transform: scale(0.98);
}

.wishlist-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.wishlist-btn:hover {
  transform: scale(1.1);
  background: var(--surface-hover);
  border-color: var(--primary-color);
}

.wishlist-btn.active .heart-icon {
  color: var(--primary-color);
  fill: var(--primary-color);
}

.heart-icon {
  width: 22px;
  height: 22px;
  color: var(--text-secondary);
}

.placeholder-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  height: 100%;
  transition: all var(--transition-fast);
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.thumb-con {
  max-width: 100dvw;
  display: flex;
  overflow: auto;
  scrollbar-width: thin;
}

.image-thumbnails {
  width: fit-content;
  display: flex;
  gap: 10px;
  padding: 5px 8px;
  scroll-snap-type: x mandatory;
}

.image-thumbnails button {
  display: flex;
  overflow: auto;
  min-width: 60px;
  border: 2px solid var(--border-color);
  padding: 2px;
  transition: all var(--transition-fast);
}

.thumbnail {
  width: 80px;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  background: none;
  padding: 0;
}

.thumbnail:hover,
.thumbnail.active {
  border-color: var(--primary-color);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.2);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Image Indicators */
.image-indicators {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--border-color);
  cursor: pointer;
  transition: all 0.3s ease;
}

.indicator.active {
  background: var(--primary-color);
  transform: scale(1.3);
  width: 24px;
  border-radius: 4px;
}

.indicator:hover {
  background: var(--secondary-color);
}

/* Seller Card Desktop */
.seller-card-desktop {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.seller-card-desktop:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.1);
}

.seller-avatar {
  position: relative;
  flex-shrink: 0;
}

.seller-avatar img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--secondary-color);
  background: var(--bg-secondary);
  padding: 2px;
}

.verified-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  color: var(--primary-color);
  background: white;
  border-radius: 50%;
}

.seller-info {
  flex: 1;
  min-width: 0;
}

.seller-name {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seller-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.seller-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.star-mini {
  width: 14px;
  height: 14px;
  color: #fbbf24;
}

.visit-shop-icon {
  width: 24px;
  height: 24px;
  color: var(--primary-color);
  flex-shrink: 0;
}

/* Product Info */
.product-info {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 50vw;
  padding: 0px 8px;
}

.category-badge {
  display: inline-block;
  width: fit-content;
  padding: 0.35rem 0.8rem;
  background: rgba(31, 139, 78, 0.1);
  color: var(--primary-color);
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-new {
  background: var(--primary-color);
  color: white;
}

.badge-hot {
  background: linear-gradient(135deg, #ff6600, #ff8533);
  color: white;
}

.badge-discount {
  background: #ef4444;
  color: white;
}

.product-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  transition: color var(--transition-fast);
  margin: 0;
}

/* Rating Display */
.rating-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stars-row {
  display: flex;
  gap: 2px;
}

.star-display {
  width: 18px;
  height: 18px;
  color: var(--border-color);
}

.star-display.filled {
  color: #fbbf24;
}

.rating-value {
  font-weight: 700;
  color: var(--secondary-color);
  font-size: 1rem;
}

.reviews-count {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.separator {
  color: var(--border-color);
}

.sold-count {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Price Section */
.price-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.current-price {
  font-size: 2rem;
  font-weight: 700;
  color: var(--secondary-color);
}

.original-price {
  font-size: 1rem;
  color: var(--text-secondary);
  text-decoration: line-through;
}

/* Product Meta */
.product-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.meta-icon {
  width: 18px;
  height: 18px;
  color: var(--primary-color);
}

/* Stock Section */
.stock-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.stock-status {
  font-weight: 600;
  font-size: 0.9rem;
}

.in-stock {
  color: var(--primary-color);
}

.low-stock-text {
  color: #d97706;
}

.out-of-stock-text {
  color: #dc2626;
}

.stock-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Product Options - Mobile First Design */
.product-options {
  margin: 1.5rem 0;
  padding: 1.25rem;
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.options-title {
  margin: 0 0 1.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
}

.options-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.close-options-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: var(--bg-secondary);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
}

.close-options-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
  transform: scale(1.1);
}

.close-icon {
  width: 16px;
  height: 16px;
}

.options-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

.option-item {
  position: relative;
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 80px;
}

.option-item:hover:not(.out-of-stock) {
  border-color: var(--primary-color);
  box-shadow: 0 4px 20px rgba(31, 139, 78, 0.12);
  transform: translateY(-2px);
}

.option-item.selected {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.04) 0%, rgba(31, 139, 78, 0.02) 100%);
  box-shadow: 0 4px 20px rgba(31, 139, 78, 0.15);
}

.option-item.out-of-stock {
  opacity: 0.6;
  cursor: not-allowed;
  border-color: var(--border-color);
}

.option-item.available {
  border-color: var(--border-color);
}

.option-radio {
  margin-right: 1rem;
  flex-shrink: 0;
}

.radio-circle {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  position: relative;
  transition: all 0.3s ease;
}

.radio-circle.checked {
  border-color: var(--primary-color);
  background: var(--primary-color);
}

.radio-circle.checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.option-image-wrapper {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  margin-right: 1rem;
  flex-shrink: 0;
  background: var(--bg-secondary);
}

.option-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.option-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.placeholder-icon {
  font-size: 1.5rem;
}

.stock-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.sold-out-text {
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.option-details {
  flex: 1;
  min-width: 0;
}

.option-name {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-price {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--secondary-color);
  margin-bottom: 0.25rem;
}

.option-stock-info {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.option-stock-info.low-stock {
  color: #d97706;
}

.hot-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, #ff6b35, #f7931e);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}

.hot-text {
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
  white-space: nowrap;
}

/* Quantity Section */
.quantity-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.quantity-section label {
  font-weight: 500;
  color: var(--text-primary);
}

.quantity-controls {
  display: flex;
  align-items: center;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.qty-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qty-btn .qty-icon {
  width: 18px;
  height: 18px;
}

.qty-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-input {
  width: 60px;
  height: 40px;
  border: none;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface);
  -moz-appearance: textfield;
}

.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.qty-input:focus {
  outline: none;
}

.qty-max-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 52px;
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.btn-large {
  flex: 1;
  font-size: 1rem;
  padding: 1rem 1.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary-color), #166b3e);
  color: white;
  box-shadow: 0 4px 14px rgba(31, 139, 78, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(31, 139, 78, 0.4);
}

.btn-secondary {
  background: linear-gradient(135deg, var(--secondary-color), #e55a00);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 102, 0, 0.4);
}

.btn:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.6;
}

/* Product Details Tabs */
.product-details-tabs {
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow-medium);
  border: 1px solid var(--border-color);
  margin-top: 2rem;
  overflow: hidden;
  transition: all var(--transition-fast);
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  font-weight: 500;
  color: var(--text-secondary);
  border-bottom: 3px solid transparent;
}

.tab-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.tab-button.active {
  color: var(--primary-color);
  background: var(--surface);
  border-bottom-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(27, 171, 80, 0.15);
}

.tab-button.active::before {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 2px 2px 0 0;
  box-shadow: 0 2px 8px rgba(27, 171, 80, 0.3);
}

.tab-label {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  position: relative;
  z-index: 1;
}

.tab-count {
  background: var(--secondary-color);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.25rem;
  position: relative;
  z-index: 1;
}

/* Tab Content */
.tab-content {
  position: relative;
  min-height: 300px;
}

.tab-pane {
  padding: 2rem;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
}

.tab-pane.active {
  opacity: 1;
  transform: translateY(0);
  position: relative;
  pointer-events: auto;
}

/* Description Pane */
.description-pane {
  padding: 1rem;
}

.description-content {
  line-height: 1.8;
  color: var(--text-primary);
  font-size: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: none;
}

.description-content :deep(p) {
  margin: 0 0 1.25rem 0;
  opacity: 0.9;
  display: block;
  font-size: 1rem;
  line-height: 1.8;
}

.description-content :deep(p:last-child) {
  margin-bottom: 0;
}

/* Ensure Quill classes display correctly */
.description-content :deep(.ql-align-center) {
  text-align: center;
}

.description-content :deep(.ql-align-right) {
  text-align: right;
}

.description-content :deep(.ql-align-justify) {
  text-align: justify;
}

.description-content :deep(strong),
.description-content :deep(b) {
  font-weight: 700;
  color: var(--text-primary);
  opacity: 1;
}

.description-content :deep(em),
.description-content :deep(i) {
  font-style: italic;
  opacity: 0.9;
}

.description-content :deep(ul),
.description-content :deep(ol) {
  margin: 1rem 0 1.5rem 0;
  padding: 0 0 0 1.5rem;
}

.description-content :deep(li) {
  margin: 0.5rem 0;
  opacity: 0.9;
  line-height: 1.7;
}

.description-content :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 2rem 0 1rem 0;
  color: var(--text-primary);
  line-height: 1.3;
  letter-spacing: -0.025em;
}

.description-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1.75rem 0 1rem 0;
  color: var(--text-primary);
  line-height: 1.4;
  letter-spacing: -0.02em;
}

.description-content :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.5rem 0 0.75rem 0;
  color: var(--text-primary);
  line-height: 1.4;
}

.description-content :deep(h4) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem 0;
  color: var(--text-primary);
  line-height: 1.4;
}

.description-content :deep(u) {
  text-decoration: underline;
}

.description-content :deep(s) {
  text-decoration: line-through;
  opacity: 0.7;
}

.description-content :deep(br) {
  display: block;
  content: "";
  margin: 0.5rem 0;
}

/* Links styling */
.description-content :deep(a) {
  color: var(--primary-color);
  text-decoration: none;
  transition: color 0.2s ease;
}

.description-content :deep(a:hover) {
  text-decoration: underline;
  color: var(--secondary-color);
}

/* Quill indent classes */
.description-content :deep(.ql-indent-1) {
  padding-left: 3em;
}

.description-content :deep(.ql-indent-2) {
  padding-left: 6em;
}

.description-content :deep(.ql-indent-3) {
  padding-left: 9em;
}

/* Blockquote styling */
.description-content :deep(blockquote) {
  border-left: 4px solid var(--primary-color);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* Code styling */
.description-content :deep(pre),
.description-content :deep(code) {
  background: var(--bg-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

.no-description {
  color: var(--text-secondary);
  font-style: italic;
  opacity: 0.7;
}

/* Reviews Pane */
.reviews-pane {
  padding: 2rem;
}

/* Loading Reviews */
.loading-reviews {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.loading-reviews p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

/* Review Stats */
.review-stats {
  background: var(--bg-secondary);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  border: 1px solid var(--border-color);
}

.stats-summary {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2rem;
  align-items: center;
}

.average-rating {
  text-align: center;
  padding: 1rem;
}

.rating-number {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.rating-stars {
  display: flex;
  gap: 0.25rem;
  justify-content: center;
  margin: 0.5rem 0;
}

.star-icon {
  width: 24px;
  height: 24px;
  color: var(--border-color);
  transition: all 0.2s ease;
}

.star-icon.filled {
  color: #fbbf24;
  filter: drop-shadow(0 0 4px rgba(251, 191, 36, 0.3));
}

.rating-count {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.rating-distribution {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.distribution-row {
  display: grid;
  grid-template-columns: 1.5rem 1.5rem 1fr 2.5rem;
  align-items: center;
  gap: 0.5rem;
}

.stars-label {
  text-align: right;
  font-weight: 600;
  color: var(--text-primary);
}

.star-small {
  width: 16px;
  height: 16px;
  color: #fbbf24;
}

.progress-bar {
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 4px;
}

.count-label {
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

/* Reviews List */
.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.review-item {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

.review-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
  border-color: var(--primary-color);
}

.review-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.reviewer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border-color);
}

.reviewer-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.1rem;
  border: 2px solid var(--border-color);
}

.reviewer-details {
  flex: 1;
}

.reviewer-name {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.verified-badge {
  background: var(--primary-color);
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.review-rating {
  display: flex;
  gap: 0.125rem;
  margin-bottom: 0.25rem;
}

.star-icon-small {
  width: 16px;
  height: 16px;
  color: var(--border-color);
}

.star-icon-small.filled {
  color: #fbbf24;
}

.review-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.review-comment {
  margin: 0 0 1rem 0;
  line-height: 1.6;
  color: var(--text-primary);
  font-size: 0.95rem;
}

/* Review Images */
.review-images {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.review-image {
  width: 100%;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: transform 0.2s ease;
}

.review-image:hover {
  transform: scale(1.05);
}

/* Vendor Response */
.vendor-response {
  background: var(--surface);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
  border-left: 3px solid var(--secondary-color);
}

.response-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--secondary-color);
  font-weight: 600;
}

.response-icon {
  width: 16px;
  height: 16px;
}

.response-text {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.response-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Review Actions */
.review-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
}

.helpful-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
}

.helpful-btn:hover {
  background: var(--surface-hover);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action-icon {
  width: 14px;
  height: 14px;
}

/* Load More Button */
.load-more-container {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.btn-load-more {
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(27, 171, 80, 0.3);
}

.btn-load-more:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(27, 171, 80, 0.4);
}

.btn-load-more:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* No Reviews */
.no-reviews {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
}

.no-reviews-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.no-reviews h3 {
  margin: 0 0 0.5rem 0;
  color: var(--text-primary);
  font-size: 1.25rem;
}

.no-reviews p {
  margin: 0;
  font-size: 0.95rem;
}

.reviews-controls label {
  font-weight: 600;
  color: var(--text-primary);
}

.sort-select {
  padding: 0.5rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  background: var(--background-alt);
  color: var(--text-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.sort-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Related Products */
.related-products {
  background: var(--surface);
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: var(--shadow-medium);
  padding-bottom: 2rem;
  border: 1px solid var(--border-color);
  margin-top: 1.5rem;
  transition: all var(--transition-fast);
}

.related-products h2 {
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
  font-weight: 600;
}

/* Mobile Sticky Actions */
.sticky-mobile-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border-color);
  padding: 0.875rem 1rem;
  display: none;
  z-index: 999;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
}

.mobile-action-container {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  justify-content: space-between;
}

.vendor-avatar {
  flex-direction: column;
  aspect-ratio: 1;
  padding-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.vendor-avatar p {
  font-size: 0.7rem;
  max-width: 7ch;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.vendor-avatar img {
  width: 42px;
  aspect-ratio: 1;
  background-color: var(--bg-secondary);
  border-radius: 50%;
  padding: 2px;
  border: 2px solid var(--secondary-color);
}

.mobile-price-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.mobile-price {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--secondary-color);
}

.mobile-stock {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.mobile-button-wrapper {
  flex: 1;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.mobile-add-to-cart {
  height: 48px;
  padding: 0 1.1rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: linear-gradient(135deg, var(--primary-color), #166b3e);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
  transition: all 0.25s ease;
}

.mobile-buy-now {
  height: 48px;
  padding: 0 1.05rem;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  background: linear-gradient(135deg, var(--secondary-color), #e55a00);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(255, 102, 0, 0.25);
  transition: all 0.25s ease;
}

.mobile-buy-now:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(255, 102, 0, 0.35);
}

.mobile-buy-now:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  box-shadow: none;
  cursor: not-allowed;
}

.mobile-add-to-cart:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(31, 139, 78, 0.35);
}

.mobile-add-to-cart:disabled {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  box-shadow: none;
}

.cart-icon {
  width: 18px;
  height: 18px;
}

.mobile-spacing {
  margin-bottom: 0rem;
  display: none;
}

.desktop-only {
  display: flex;
}

@media (max-width: 990px) {
  .product-options {
    margin: 1rem 0;
    padding: 1rem;
    border-radius: 12px;
  }

  .options-header {
    margin-bottom: 1rem;
  }

  .close-options-btn {
    width: 28px;
    height: 28px;
  }

  .close-icon {
    width: 14px;
    height: 14px;
  }

  .options-title {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .option-item {
    padding: 0.875rem;
    min-height: 70px;
  }

  .option-image-wrapper {
    width: 50px;
    height: 50px;
  }

  .option-name {
    font-size: 0.95rem;
  }

  .option-price {
    font-size: 1rem;
  }
}

@media (min-width: 768px) {
  .options-container {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }

  .option-item {
    padding: 1.25rem;
    min-height: 90px;
  }

  .option-image-wrapper {
    width: 70px;
    height: 70px;
  }
}

@media (min-width: 1024px) {
  .product-options {
    padding: 1.5rem;
  }

  .options-container {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .option-item {
    padding: 1.5rem;
    min-height: 100px;
  }

  .option-image-wrapper {
    width: 80px;
    height: 80px;
  }

  .options-title {
    font-size: 1.25rem;
  }
}

/* Responsive Design */
@media (max-width: 840px) {
  .page-header {
    padding: 0.875rem 1rem;
  }

  .page-title {
    font-size: 1.3rem;
  }

  .seller-card-desktop {
    display: none;
  }

  .product-info {
    max-width: 100vw;
  }

  .product-details-page {
    padding-top: 0;
  }

  .related-products {
    padding: 1rem;
    padding-bottom: 1.5rem;
  }

  .product-description,
  .reviews-section {
    padding: 1rem;
  }

  .image-thumbnails {
    padding: 3px 8px;
  }

  .container {
    padding: 0.5rem 0.5rem 1rem;
  }

  .product-main {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  .main-image {
    height: auto;
    border-radius: 0;
  }

  .product-title {
    font-size: 1.4rem;
  }

  .current-price {
    font-size: 1.7rem;
  }

  .desktop-only {
    display: none;
  }

  .sticky-mobile-actions {
    display: block;
  }

  .mobile-spacing {
    display: block;
  }

  .image-indicators {
    margin-top: 0.5rem;
  }

  .indicator {
    width: 6px;
    height: 6px;
  }

  .indicator.active {
    width: 18px;
  }

  .option-card {
    min-width: 150px;
  }

  .review-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .rating-display {
    font-size: 0.85rem;
  }

  .product-meta {
    flex-direction: column;
    gap: 0.5rem;
  }

  .quantity-section {
    flex-wrap: wrap;
  }
}

@media (max-width: 660px) {
  .main-image {
    border-radius: 0;
  }

  .product-images {
    gap: 5px;
  }

  .image-thumbnails {
    gap: 8px;
    padding: 3px 4px;
  }

  .thumbnail {
    width: 60px;
    padding: 0;
  }

  .image-indicators {
    display: flex;
    gap: 6px;
  }

  .product-description,
  .reviews-section {
    padding: 0.6rem;
  }

  .review-item {
    padding: 1rem;
  }

  .review-stats {
    padding: 1rem;
  }

  .stats-summary {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .distribution-row {
    grid-template-columns: 1.2rem 1.2rem 1fr 2rem;
  }

  .related-products {
    margin-top: 1.25rem;
  }

  .mobile-spacing {
    height: 95px;
  }

  .wishlist-btn {
    width: 36px;
    height: 36px;
  }

  .heart-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 0.75rem;
  }

  .page-title {
    font-size: 1.2rem;
  }

  .star-icon-small {
    width: 12px;
  }

  .back-button {
    width: 2rem;
    height: 2rem;
  }

  .back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .product-title {
    font-size: 1.25rem;
  }

  .current-price {
    font-size: 1.5rem;
  }

  .mobile-action-container {
    gap: 0.5rem;
  }

  .mobile-price-info {
    text-align: center;
  }

  .mobile-add-to-cart {
    padding: 0 1rem;
    font-size: 0.9rem;
  }

  .mobile-buy-now {
    padding: 0 0.95rem;
    font-size: 0.9rem;
  }

  .reviews-controls {
    gap: 0.5rem;
  }

  .review-item {
    padding: 0.7rem;
  }

  .related-products {
    padding: 0rem;
    border: 0;
    background-color: transparent;
  }

  .star-display {
    width: 14px;
    height: 14px;
  }

  .rating-value {
    font-size: 0.9rem;
  }

  .reviews-count,
  .sold-count {
    font-size: 0.8rem;
  }
}

@media (max-width: 360px) {
  .mobile-add-to-cart {
    padding: 0 0.875rem;
    font-size: 0.85rem;
  }

  .cart-icon {
    width: 16px;
    height: 16px;
  }

  .mobile-buy-now {
    padding: 0 0.85rem;
    font-size: 0.85rem;
  }
}

/* ============================================
   SKELETON LOADING STYLES
   ============================================ */

.skeleton-container {
  pointer-events: none;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.skeleton-shimmer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%);
  animation: shimmer 1.5s infinite;
}

.skeleton-image {
  background: var(--bg-secondary);
  aspect-ratio: 4/3;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}

.skeleton-thumb {
  width: 64px;
  height: 64px;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.skeleton-badge {
  width: 100px;
  height: 24px;
  background: var(--bg-secondary);
  border-radius: 12px;
  margin-bottom: 1rem;
}

.skeleton-title {
  width: 80%;
  height: 32px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.skeleton-rating {
  width: 200px;
  height: 20px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 1rem;
}

.skeleton-price {
  width: 150px;
  height: 40px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.skeleton-meta {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.skeleton-meta-item {
  width: 180px;
  height: 16px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.skeleton-stock {
  width: 120px;
  height: 20px;
  background: var(--bg-secondary);
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.skeleton-options {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.skeleton-option-card {
  width: 140px;
  height: 100px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.skeleton-quantity {
  width: 140px;
  height: 44px;
  background: var(--bg-secondary);
  border-radius: 10px;
  margin-bottom: 1.5rem;
}

.skeleton-buttons {
  display: flex;
  gap: 1rem;
}

.skeleton-btn {
  flex: 1;
  height: 50px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

/* Options Selection Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.options-modal {
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--text-secondary);
}

.modal-close-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.modal-footer .btn {
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-footer .btn-secondary {
  background: var(--border-color);
  color: var(--text-secondary);
}

.modal-footer .btn-secondary:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.modal-footer .btn-primary {
  background: var(--primary-color);
  color: white;
}

.modal-footer .btn-primary:hover:not(:disabled) {
  background: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(27, 171, 80, 0.3);
}

.modal-footer .btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Mobile Styles for Tabs */
@media (max-width: 768px) {
  .tab-navigation {
    padding: 0 1rem;
  }

  .tab-button {
    padding: 0.875rem 1rem;
    font-size: 0.9rem;
  }

  .tab-label {
    font-size: 0.85rem;
  }

  .tab-count {
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
  }

  .tab-pane {
    padding: 1.5rem 1rem;
  }

  .description-pane,
  .reviews-pane {
    padding: 1.5rem 1rem;
  }

  .stats-summary {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .rating-distribution {
    gap: 0.75rem;
  }

  .distribution-row {
    grid-template-columns: 1rem 1rem 1fr 2rem;
    gap: 0.375rem;
  }

  .review-item {
    padding: 1.25rem;
  }

  .review-header {
    gap: 0.75rem;
  }

  .reviewer-avatar,
  .reviewer-avatar-placeholder {
    width: 40px;
    height: 40px;
  }

  .reviewer-name {
    font-size: 0.95rem;
  }

  .review-rating {
    gap: 0.1rem;
  }

  .star-icon-small {
    width: 14px;
    height: 14px;
  }

  .review-date {
    font-size: 0.75rem;
  }

  .verified-badge {
    padding: 0.125rem 0.5rem;
    font-size: 0.7rem;
  }

  .review-comment {
    font-size: 0.9rem;
  }

  .review-images {
    grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
    gap: 0.375rem;
  }

  .review-image {
    height: 70px;
  }

  .vendor-response {
    padding: 0.875rem;
  }

  .response-text {
    font-size: 0.85rem;
  }

  .review-actions {
    gap: 0.75rem;
  }

  .helpful-btn {
    padding: 0.375rem 0.875rem;
    font-size: 0.8rem;
  }

  .action-icon {
    width: 12px;
    height: 12px;
  }

  .btn-load-more {
    padding: 0.625rem 1.5rem;
    font-size: 0.9rem;
  }

  .no-reviews {
    padding: 2rem 1rem;
  }

  .no-reviews-icon {
    font-size: 2.5rem;
  }

  .no-reviews h3 {
    font-size: 1.1rem;
  }
}

@media (max-width: 480px) {
  .tab-navigation {
    padding: 0 0.5rem;
  }

  .tab-button {
    padding: 0.75rem 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .tab-label {
    font-size: 0.8rem;
    display: block;
  }

  .tab-count {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    font-size: 0.65rem;
    padding: 0.1rem 0.3rem;
  }

  .tab-pane {
    padding: 1rem 0.5rem;
  }

  .rating-number {
    font-size: 2.5rem;
  }

  .rating-stars {
    margin: 0.375rem 0;
  }

  .star-icon {
    width: 20px;
    height: 20px;
  }

  /* Mobile Tab Styles */
  .tab-navigation {
    padding: 0 0.5rem;
  }

  .tab-button {
    padding: 0.875rem 1rem;
    font-size: 0.9rem;
  }

  .tab-icon {
    font-size: 1rem;
  }

  .tab-label {
    font-size: 0.85rem;
  }

  .tab-count {
    font-size: 0.7rem;
  }

  .tab-pane {
    padding: 1.5rem 1rem;
  }
}

/* Quantity Modal Styles - Premium Design */
.quantity-modal {
  background: var(--bg-primary);
  border-radius: 12px;
  max-width: 450px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.quantity-modal .modal-header {
  padding: 28px 28px 20px 28px;
  border-bottom: 1px solid var(--border-color);
  position: relative;
}

.quantity-modal .modal-header h3 {
  margin: 0 0 6px 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.quantity-modal .modal-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 400;
}

.quantity-modal .close-btn {
  background: var(--surface);
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 20px;
  right: 20px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.quantity-modal .close-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.quantity-modal .modal-body {
  padding: 28px;
}

/* Product Info - Enhanced Presentation */
.quantity-modal .product-info {
  display: flex;
  gap: 18px;
  margin-bottom: 28px;
  padding: 16px;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.quantity-modal .product-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.quantity-modal .product-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.quantity-modal .product-details h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quantity-modal .price-stock {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quantity-modal .product-price {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-color);
}

.quantity-modal .stock-info {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Quantity Section - Modern Controls */
.quantity-modal .quantity-selector {
  margin-bottom: 28px;
}

.quantity-modal .quantity-selector label {
  display: block;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.quantity-modal .quantity-controls {
  display: flex;
  align-items: center;
  gap: 0;
  width: fit-content;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface);
}

.quantity-modal .qty-btn {
  background: var(--surface);
  border: none;
  color: var(--text-primary);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.quantity-modal .qty-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.quantity-modal .qty-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2.5;
}

.quantity-modal .qty-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.quantity-modal .qty-btn:first-child {
  border-right: 2px solid var(--border-color);
}

.quantity-modal .qty-btn:last-child {
  border-left: 2px solid var(--border-color);
}

.quantity-modal .qty-display {
  width: 56px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--surface);
}

/* Order Summary - Professional Layout */
.quantity-modal .order-summary {
  border-top: 2px solid var(--border-color);
  border-bottom: 2px solid var(--border-color);
  padding: 20px 0;
  margin-bottom: 24px;
}

.quantity-modal .summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 0;
}

.quantity-modal .summary-row:last-child {
  margin-bottom: 0;
}

.quantity-modal .summary-row span {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}

.quantity-modal .summary-row strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Final Summary Row - Highlighted */
.quantity-modal .summary-row:nth-child(2) span {
  font-weight: 700;
  color: var(--text-primary);
}

.quantity-modal .summary-row:nth-child(2) strong {
  font-size: 18px;
  color: var(--primary-color);
}

.quantity-modal .shipping-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

/* Action Buttons - Modern Style */
.quantity-modal .modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 28px 0 28px;
}

.quantity-modal .btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.3s ease;
  text-align: center;
  text-transform: capitalize;
  letter-spacing: 0.3px;
}

.quantity-modal .btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
}

.quantity-modal .btn-secondary:hover {
  background: var(--border-color);
  border-color: var(--border-color);
}

.quantity-modal .btn-primary {
  background: var(--primary-color);
  color: white;
  border: 2px solid var(--primary-color);
}

.quantity-modal .btn-primary:hover:not(:disabled) {
  background: #15922f;
  border-color: #15922f;
  box-shadow: 0 8px 16px rgba(34, 197, 94, 0.3);
  transform: translateY(-2px);
}

.quantity-modal .btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.quantity-modal .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quantity-modal .delivery-note {
  margin: 0;
  padding: 12px 28px 20px 28px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
}

/* Dark mode support */
.theme-dark .quantity-modal {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.theme-dark .quantity-modal .modal-header {
  border-bottom-color: var(--border-color);
}

.theme-dark .quantity-modal .modal-header h3 {
  color: var(--text-primary);
}

.theme-dark .quantity-modal .close-btn {
  background: var(--surface);
  color: var(--text-secondary);
}

.theme-dark .quantity-modal .close-btn:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.theme-dark .quantity-modal .product-info {
  background: var(--surface);
  border-color: var(--border-color);
}

.theme-dark .quantity-modal .product-image {
  border-color: var(--border-color);
}

.theme-dark .quantity-modal .product-details h4 {
  color: var(--text-primary);
}

.theme-dark .quantity-modal .stock-info {
  color: var(--text-secondary);
}

.theme-dark .quantity-modal .quantity-controls {
  border-color: var(--border-color);
  background: var(--surface);
}

.theme-dark .quantity-modal .qty-btn {
  background: var(--surface);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.theme-dark .quantity-modal .qty-btn:hover:not(:disabled) {
  background: var(--primary-color);
  color: white;
}

.theme-dark .quantity-modal .qty-display {
  background: var(--surface);
  color: var(--text-primary);
}

.theme-dark .quantity-modal .order-summary {
  border-color: var(--border-color);
}

.theme-dark .quantity-modal .btn-secondary {
  background: var(--surface);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.theme-dark .quantity-modal .btn-secondary:hover {
  background: var(--border-color);
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .quantity-modal {
    margin: 16px;
    width: calc(100% - 32px);
    max-width: none;
    border-radius: 12px;
  }
  
  .quantity-modal .modal-header {
    padding: 20px 20px 16px 20px;
  }
  
  .quantity-modal .modal-header h3 {
    font-size: 18px;
  }
  
  .quantity-modal .modal-body {
    padding: 20px;
  }
  
  .quantity-modal .modal-footer {
    padding: 16px 20px 0 20px;
    gap: 10px;
  }
  
  .quantity-modal .btn {
    padding: 11px 16px;
    font-size: 13px;
  }
  
  .quantity-modal .product-info {
    gap: 12px;
    padding: 12px;
  }
  
  .quantity-modal .product-image {
    width: 70px;
    height: 70px;
  }
  
  .quantity-modal .product-details h4 {
    font-size: 14px;
  }
  
  .quantity-modal .product-price {
    font-size: 16px;
  }
  
  .quantity-modal .order-summary {
    padding: 16px 0;
    margin-bottom: 20px;
  }
  
  .quantity-modal .delivery-note {
    padding: 10px 20px 16px 20px;
    font-size: 11px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
