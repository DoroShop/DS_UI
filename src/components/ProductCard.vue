<script setup lang="ts">
import { ref, computed, defineProps, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ShoppingCartIcon, StarIcon, MapPinIcon } from '@heroicons/vue/24/solid';
import { Alert } from './composable/Alert';
import { formatToPHCurrency } from '../utils/currencyFormat';
import SelectProduct from "./ProductSelectionModal.vue";
import { useProductsStore } from '../stores/productStores';
import type { Product } from '../types/product';
import { useVendorStore } from '../stores/vendorStores';
import { handleImageError } from '../utils/fallbackImage';
import { useCartStore } from '../stores/cartStores';
import { useTheme } from '../composables/useTheme';

const router = useRouter();

const cartStore = useCartStore();
const productStore = useProductsStore();
const vendorStore = useVendorStore();
const { isDark } = useTheme();
const isOpen = ref(false);
const selectedProductData = ref<Product | null>(null);
const addingToCart = ref<string | null>(null);
const addingOptionToCart = ref(false);

const props = defineProps<{
    typesOfProductList: 'FeaturedProducts' | 'AllProducts' | 'SearchResultProducts' | 'RelatedProducts' | 'VendorProducts'
}>();

const products = computed(() => {
    if (props.typesOfProductList === "FeaturedProducts") return productStore.featuredProducts;
    else if (props.typesOfProductList === "AllProducts") return productStore.products;
    else if (props.typesOfProductList === "SearchResultProducts") return productStore.searchResultProducts
    else if (props.typesOfProductList === "RelatedProducts") return productStore.relatedProducts
    else if (props.typesOfProductList === "VendorProducts") return vendorStore.vendorProducts
    return [];
});

console.log('ProductCard component initialized with product list type:', products.value);

// Format rating to consistent decimal display
const formatRating = (rating: number | undefined): string => {
    if (!rating || rating === 0) return '0.0';
    return rating.toFixed(1);
};

// Format number of reviews
const formatReviewCount = (count: number | undefined): string => {
    if (!count) return '0';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
};

// Format sold count
const formatSoldCount = (count: number | undefined): string => {
    if (!count) return '0';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count.toString();
};

// Promotion helpers
const isPromotionValid = (promotion: any) => {
    if (!promotion || !promotion.isActive) return false;
    const now = new Date();
    // Check start date - promotion hasn't started yet
    if (promotion.startDate && new Date(promotion.startDate) > now) return false;
    // Check end date - promotion has expired  
    if (promotion.endDate && new Date(promotion.endDate) < now) return false;
    return true;
};

const calculateDiscountedPrice = (originalPrice: number, promotion: any) => {
    if (!isPromotionValid(promotion)) return originalPrice;
    
    if (promotion.discountType === 'percentage') {
        return originalPrice - (originalPrice * promotion.discountValue / 100);
    } else if (promotion.discountType === 'fixed') {
        return Math.max(0, originalPrice - promotion.discountValue);
    }
    return originalPrice;
};

const getDiscountPercentage = (promotion: any) => {
    if (!isPromotionValid(promotion) || promotion.discountType === 'none') return 0;
    
    if (promotion.discountType === 'percentage') {
        return promotion.discountValue;
    }
    return 0;
};

const hasActivePromotion = (item: Product) => {
    return isPromotionValid(item.promotion);
};

// Helper function to check if promotion has actual discount (not just free shipping)
const hasActualDiscount = (promotion: any) => {
    if (!isPromotionValid(promotion)) return false;
    const { discountType, discountValue } = promotion;
    return discountType && discountType !== 'none' && discountValue > 0;
};

// Helper function to check if promotion offers meaningful free shipping
const hasValidFreeShipping = (promotion: any) => {
    // Only show free shipping if we have a valid active promotion with freeShipping enabled
    return isPromotionValid(promotion) && promotion.freeShipping === true;
};

const updateSelectedProductData = (newProduct: Product) => {
    selectedProductData.value = newProduct;
};

const addProductToCart = async (item: Product) => {
    if (addingToCart.value === item._id) return;
    addingToCart.value = item._id;
    try {
        if (!item.option || item.option.length === 0) {
            await productStore.addToCart(item._id, item._id);
            addingToCart.value = null;
            return;
        }
        isOpen.value = true;
        updateSelectedProductData(item);
    } finally {
        addingToCart.value = null;
    }
};

// Option selection handler (for SelectProduct modal)
const handleOptionAddToCart = async (productId: string, optionId: string) => {
    if (addingOptionToCart.value) return;
    addingOptionToCart.value = true;
    try {
        await productStore.addToCart(productId, optionId);
        isOpen.value = false;
    } finally {
        addingOptionToCart.value = false;
    }
};

const handleClose = () => {
    isOpen.value = false;
};

// const handleImageError = (event: Event) => {
//     const target = event.target as HTMLImageElement;
//     target.src =
//         "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400";
// };


const viewProduct = (productId) => {
    console.log('ProductCard viewProduct called with ID:', productId, 'Type:', typeof productId);
    if (!productId || productId === 'undefined' || productId === 'null') {
        console.error('ProductCard: Invalid product ID provided:', productId);
        return;
    }
    router.push(`/product/${productId}`)
}
</script>

<template>
    <SelectProduct :isOpen="isOpen" :optData="selectedProductData" @close="handleClose"
        @add-to-cart="handleOptionAddToCart"
        :loading="addingOptionToCart"
    />
    <section class="product-card">
        <div class="product-content-container">
            <div class="products-container">
                <div v-for="(item, index) in products" :key="item._id" class="cards cart-item">
                    <div class="img-con">
                        <!-- Promotion Badges -->
                        <div class="badge-container">
                            <span v-if="hasActivePromotion(item) && hasActualDiscount(item.promotion) && getDiscountPercentage(item.promotion) > 0" 
                                class="discount-badge">
                                🏷️ -{{ getDiscountPercentage(item.promotion) }}%
                            </span>
                            <span v-if="hasActivePromotion(item) && hasActualDiscount(item.promotion) && item.promotion.discountType === 'fixed'" 
                                class="discount-badge fixed-badge">
                                💰 -₱{{ item.promotion.discountValue }}
                            </span>
                            <span v-if="hasValidFreeShipping(item.promotion)" 
                                class="shipping-badge">
                                🚚 FREE SHIPPING
                            </span>
                            <!-- Limited Time Offer Badge -->
                            <span v-if="hasActivePromotion(item) && item.promotion.endDate" 
                                class="limited-time-badge">
                                ⏰ LIMITED
                            </span>
                        </div>
                        <!-- Hot Deal Corner Banner (only for actual discounts) -->
                        <div v-if="hasActivePromotion(item) && hasActualDiscount(item.promotion)" class="hot-deal-banner">
                            ⚡ HOT DEAL
                        </div>
                        <img :src="item?.imageUrls[0]" 
                            @click="viewProduct(item._id)" 
                            fetchpriority="auto" 
                            decoding="async"
                            :alt="item?.name"
                            @error="handleImageError" />
                    </div>
                    <div class="details-con">
                        <p class="name">{{ item.name }}</p>
                      
                        <div class="rating-sold">
                            <span>
                                <StarIcon class="icon"></StarIcon>
                                <span>{{ formatRating(item.averageRating) }} ({{ formatReviewCount(item.numReviews) }})</span>
                                <span class="divider">|</span>
                                <span>{{ formatSoldCount(item.sold) }} sold</span>
                            </span>
                        </div>
                          <p class="description">
                            <MapPinIcon class="icon-location"></MapPinIcon>
                            <span>
                                {{ item.municipality }}
                            </span>
                        </p>
                        <div class="price-add-btn">
                            <button @click="addProductToCart(item)" :disabled="addingToCart === item._id">
                                <template v-if="addingToCart === item._id">
                                    <span class="spinner white"></span>
                                    <span>Adding...</span>
                                </template>
                                <template v-else>
                                    <div class="price-info">
                                        <template v-if="hasActivePromotion(item) && hasActualDiscount(item.promotion)">
                                            <span class="original-price">{{ formatToPHCurrency(item.price) }}</span>
                                            <span class="sale-price">
                                                🔥 {{ formatToPHCurrency(calculateDiscountedPrice(item.price, item.promotion)) }}
                                            </span>
                                        </template>
                                        <template v-else>
                                            <span>{{ formatToPHCurrency(item.price) }}</span>
                                        </template>
                                    </div>
                                    <ShoppingCartIcon class="icon" />
                                </template>
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
/* in App.vue or style.css */
.swal2-popup.custom-icon-size .swal2-icon {
    font-size: 50px;
}




.product-card {
    width: 100%;
    height: fit-content;
    margin-bottom: 1rem;
}

.product-content-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: .7rem;
}

.products-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
    gap: .5rem;
    max-width: 100%;
    width: fit-content;
    box-sizing: border-box;
    contain: layout style;
}

.cards {
    animation: fadeIn 0.3s ease-out;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
    cursor: pointer;
    min-height: 12rem;
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-small);
    max-width: 300px;
    background: var(--surface);
    will-change: transform;
    transform: translateZ(0);
    contain: layout style paint;
}

.cards:hover {
    transform: translateY(-5px) translateZ(0);
    box-shadow: var(--shadow-medium);
}

.img-con {
    width: 100%;
    background-color: var(--bg-secondary);
    display: flex;
    align-items: center;
    position: relative;
    contain: layout paint;
}

.badge-container {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 10;
    will-change: transform;
}

.discount-badge {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 0.75rem;
    box-shadow: 0 3px 10px rgba(239, 68, 68, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    animation: pulse 2s ease-in-out infinite;
    display: flex;
    align-items: center;
    gap: 4px;
}

.fixed-badge {
    background: linear-gradient(135deg, #f59e0b, #d97706);
}

@keyframes pulse {
    0%, 100% {
        transform: scale3d(1, 1, 1);
        box-shadow: 0 3px 10px rgba(239, 68, 68, 0.5);
    }
    50% {
        transform: scale3d(1.08, 1.08, 1);
        box-shadow: 0 5px 15px rgba(239, 68, 68, 0.7);
    }
}

.shipping-badge {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.7rem;
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 4px;
    will-change: transform;
}

.limited-time-badge {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.7rem;
    box-shadow: 0 3px 10px rgba(139, 92, 246, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 4px;
    animation: blink 1.5s ease-in-out infinite;
    will-change: opacity;
}

@keyframes blink {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.7;
    }
}

.hot-deal-banner {
    position: absolute;
    top: 0;
    right: 0;
    background: linear-gradient(135deg, #ff6b6b, #ff4757);
    color: white;
    padding: 6px 16px;
    font-weight: 800;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    transform: rotate(45deg) translate(25%, -50%);
    transform-origin: center;
    box-shadow: 0 4px 12px rgba(255, 71, 87, 0.6);
    z-index: 9;
    min-width: 120px;
    text-align: center;
}

.img-con img {
    width: 100%;
    aspect-ratio: 4/3.2;
    background-position: center;
    object-fit: cover;
    background-size: contain;
    will-change: auto;
    content-visibility: auto;
}

.details-con {
    padding: 5px 10px;
    background-color: var(--surface);
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: .5rem;
    justify-content: space-between;
    transition: background-color var(--transition-fast);
    contain: layout paint;
}

.details-con .name {
    font-size: clamp(.8rem, 1.5vw, .9rem);
    max-width: 100%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    hyphens: auto;
    font-weight: 600;
    color: var(--text-primary);
    transition: color var(--transition-fast);
}

.details-con .description {
    max-width: 80%;
    display: flex;
    font-size: clamp(.7rem, 1.2vw, .75rem);
    align-items: center;
}

.icon-location{
    width: clamp(.9rem, 1.5vw, 1rem);
    aspect-ratio: 1;
    margin-right: 4px;
    color: var(--primary-color);
    vertical-align: middle;
}

.rating-sold {
    display: flex;
    align-items: center;
}

.rating-sold .icon {
    width: clamp(1rem, 1vw, 1.5rem);
    aspect-ratio: 1;
    color: #fbbf24;
}

.rating-sold span {
    font-size: clamp(.7rem, 1vw, .75rem);
    height: 100%;
    display: flex;
    align-items: center;
    gap: 3px;
    color: var(--text-secondary);
    transition: color var(--transition-fast);
}

.rating-sold span span {
    margin-top: 5px;
}

.divider {
    color: var(--text-secondary);
    opacity: 0.5;
}

.price-add-btn {
    display: flex;
    justify-content: flex-end;
    flex-wrap: nowrap;
}

.price-add-btn button {
    font-size: clamp(14px, 2.5vw, 16px);
    color: white;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 7px;
    border: 0;
    background-color: var(--primary-color);
    border-radius: .5rem;
    width: 100%;
    max-width: 100%;
    margin-top: 0.35rem;
    overflow: hidden;
    flex-wrap: nowrap;
    gap: 5px;
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
}

.price-info {
    display: flex;
    align-items: center;
    justify-content: center;
    
    gap: 2px;
}

.original-price {
    font-size: 0.75rem;
    text-decoration: line-through;
    opacity: 0.8;
    font-weight: 400;
    margin-right: 2px;
}

.sale-price {
    font-size: clamp(14px, 2.5vw, 16px);
    font-weight: 700;
    color: #fbbf24;
}

.price-add-btn button span {
    margin-top: 3px;
}

.price-add-btn button .icon {
    height: 1.2rem;
    aspect-ratio: 1;
}

.spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255,255,255,0.3);
    border-top: 2.5px solid #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 6px;
    vertical-align: middle;
}
.spinner.white {
    border: 2.5px solid rgba(255,255,255,0.3);
    border-top: 2.5px solid #fff;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

@media (min-width: 720px) {

    .products-container {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

    }

    .price-add-btn button {
        padding: 8px;
    }

    .price-add-btn button:hover {
        opacity: var(--hover-opacity);
    }



}

@media (max-width: 768px) {}

@media (max-width: 680px) {
    .details-con {
        gap: .25rem;
    }

    .cards:hover {
        transform: none;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .rating-sold .icon {
        height: .85rem;

    }


}
</style>