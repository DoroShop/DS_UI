<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useCartStore } from '../stores/cartStores';
import { useUserStore } from '../stores/userStores';
import { useRouter } from 'vue-router';
import { formatToPHCurrency } from '../utils/currencyFormat.js';
import CheckoutModal from "../components/ChecoutModal.vue"
import {
    CheckIcon,
    TrashIcon,
    ShoppingCartIcon,
    BuildingStorefrontIcon,
    PlusIcon,
    MinusIcon,
    TruckIcon
} from '@heroicons/vue/24/outline';

import {
    ArrowLeftIcon
} from '@heroicons/vue/24/solid';
import { useTheme } from '../composables/useTheme';

// Define component name for keep-alive
defineOptions({
    name: 'Cart'
})

const cartStore = useCartStore();
const userStore = useUserStore()
const router = useRouter()
const { isDark } = useTheme()
const selectedItems = ref(null)
const checkoutData = computed(() => cartStore.selectedItemData)
const isCheckOut = ref(false)

// Promotion validation functions
const isPromotionValid = (promotion: any) => {
    if (!promotion || !promotion.isActive) return false;
    const now = new Date();
    // Check start date - promotion hasn't started yet
    if (promotion.startDate && new Date(promotion.startDate) > now) return false;
    // Check end date - promotion has expired  
    if (promotion.endDate && new Date(promotion.endDate) < now) return false;
    return true;
};

const hasValidFreeShipping = (promotion: any) => {
    return isPromotionValid(promotion) && promotion.freeShipping === true;
};

const sortedShops = computed(() => {
    return [...cartStore.cartData.shops].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
    });
});


const checkOut = () => {
    cartStore.getSelectedItem()
    selectedItems.value = checkoutData.value
    // Save selected items for refresh recovery
    localStorage.setItem('pendingCheckoutItems', JSON.stringify(selectedItems.value))
    isCheckOut.value = true
    console.table(checkoutData.value)
}

const goBack = () => {
    router.back()
}

onMounted(async () => {
    await cartStore.fetchCart();
    await userStore.fetchUser()
    await nextTick()
    localStorage.setItem("userInfo", JSON.stringify(userStore.userData))
    
    // Check if there's saved checkout state (modal was open before refresh)
    const savedState = localStorage.getItem('checkoutModalState')
    if (savedState) {
        try {
            const state = JSON.parse(savedState)
            // Check if state is recent (within 30 minutes)
            if (state.isOpen && Date.now() - state.timestamp < 30 * 60 * 1000) {
                restoreCheckoutModal()
            }
        } catch (e) {
            console.error('Failed to check checkout state:', e)
        }
    }
});

const closeCheckout = () => {
    isCheckOut.value = false
    // Clear saved items when modal is closed
    localStorage.removeItem('pendingCheckoutItems')
}

// Restore modal state on page refresh
const restoreCheckoutModal = () => {
    // Check if there are selected items in localStorage or cart store
    const pendingItems = localStorage.getItem('pendingCheckoutItems')
    if (pendingItems) {
        try {
            selectedItems.value = JSON.parse(pendingItems)
            isCheckOut.value = true
            console.log('Restored checkout modal from refresh')
        } catch (e) {
            console.error('Failed to restore checkout items:', e)
        }
    } else {
        // Try to use current cart selection
        cartStore.getSelectedItem()
        selectedItems.value = checkoutData.value
        if (selectedItems.value && selectedItems.value.length > 0) {
            isCheckOut.value = true
        }
    }
}

</script>

<template>
    <CheckoutModal :selectedItems="selectedItems" :show="isCheckOut" @close="closeCheckout" @restore-modal="restoreCheckoutModal"></CheckoutModal>
    <section class="cart-container">
        <div class="page-header">
            <div class="header-content">
                <div class="header-left">
                    <button @click="goBack" class="back-button">
                        <ArrowLeftIcon class="back-icon" />
                    </button>
                    <h1 class="page-title">Shopping Cart</h1>
                </div>
                <div class="header-right">
                    <button class="action-btn btn-select" @click="cartStore.toggleSelectAll"
                        :class="{ active: cartStore.isAllSelected }" :disabled="cartStore.cartData.shops.length === 0">
                        <CheckIcon class="icon" />
                        <span class="btn-text">
                            {{ cartStore.isAllSelected ? 'Deselect' : 'Select All' }}
                        </span>
                    </button>
                    <button class="action-btn btn-delete" @click="cartStore.clearCart"
                        :disabled="!cartStore.isAllSelected">
                        <TrashIcon class="icon" />
                        <span class="btn-text">Delete</span>
                        <span class="btn-count">({{ cartStore.selectedItems.length }})</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="cart-content">
            <div v-if="cartStore.cartData.shops.length === 0" class="empty-cart">
                <ShoppingCartIcon class="empty-icon" />
                <h2>Your cart is empty</h2>
                <p>Add some items to get started!</p>
            </div>

            <div v-else class="shops-list">
                <div v-for="shop in sortedShops" :key="shop.shopId" class="shop-section">
                    <div class="shop-header">
                        <div class="shop-info">
                            <input type="checkbox" :id="`shop-${shop.shopId}`"
                                :checked="cartStore.isShopSelected(shop.shopId)"
                                @change="cartStore.toggleShopSelection(shop.shopId)" class="shop-checkbox" />
                            <label :for="`shop-${shop.shopId}`" class="shop-name">
                                <BuildingStorefrontIcon class="shop-icon" />
                                <span>{{ shop.shopName }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="items-list">
                        <div v-for="item in shop.items" :key="item.itemId" class="cart-item">
                            <div class="item-checkbox">
                                <input type="checkbox" :id="`item-${item.itemId}`"
                                    :checked="cartStore.selectedItems.includes(item.itemId)"
                                    @change="cartStore.toggleItemSelection(item.itemId)" />
                            </div>

                            <div class="item-image">
                                <img :src="item.imgUrl" :alt="item.name" loading="lazy" />
                            </div>

                            <div class="item-info">
                                <div class="item-details">
                                    <h3 class="item-name">{{ item.name }}</h3>
                                    <h3 class="item-ctgry">{{ item.label }}</h3>
                                    <div class="item-pricing">
                                        <!-- Show discounted pricing when item has discount -->
                                        <template v-if="item.hasDiscount && item.originalPrice > item.price">
                                            <p class="item-price-original">{{ formatToPHCurrency(item.originalPrice) }}
                                            </p>
                                            <p class="item-price-sale">{{ formatToPHCurrency(item.price) }}</p>
                                            <div class="badge-group">
                                                <span class="discount-badge"><span>SALE</span></span>
                                                <span v-if="hasValidFreeShipping(item.promotion)"
                                                    class="free-shipping-badge">
                                                    <TruckIcon class="truck-icon" />
                                                    <span> Free Shipping</span>
                                                </span>
                                            </div>
                                        </template>
                                        <!-- Show regular price when no discount -->
                                        <template v-else>
                                            <p class="item-price">{{ formatToPHCurrency(item.price) }}</p>
                                            <div v-if="hasValidFreeShipping(item.promotion)" class="badge-group">
                                                <span class="free-shipping-badge">Free Shipping</span>
                                            </div>
                                        </template>
                                    </div>
                                </div>

                                <div class="item-controls">
                                    <div class="quantity-section">
                                        <div class="quantity-controls">
                                            <button class="qty-btn qty-minus"
                                                @click="cartStore.handleDecrement(item.productId, item.optionId, shop.shopId)"
                                                :disabled="item.quantity <= 1" aria-label="Decrease quantity">
                                                <MinusIcon class="icon" />
                                            </button>
                                            <span class="quantity">{{ item.quantity }}</span>
                                            <button class="qty-btn qty-plus"
                                                @click="cartStore.handleIncrement(item.productId, item.optionId, shop.shopId)"
                                                :disabled="item.quantity >= 50" aria-label="Increase quantity">
                                                <PlusIcon class="icon" />
                                            </button>
                                        </div>
                                    </div>

                                    <button class="btn-delete-item"
                                        @click="cartStore.deleteItem(shop.shopId, item.itemId, item.productId, item.optionId)"
                                        aria-label="Delete item">
                                        <TrashIcon class="icon" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="cartStore.cartData.shops.length > 0" class="checkout-sticky">
            <div class="checkout-content">
                <div class="checkout-summary">
                    <div class="summary-line">
                        <span class="summary-label">
                            {{ cartStore.selectedItemsCount }} item{{ cartStore.selectedItemsCount !== 1 ? 's' : '' }}
                            selected
                        </span>
                        <span class="summary-total">{{ formatToPHCurrency(cartStore.total) }}</span>
                    </div>
                </div>

                <button @click="checkOut" class="btn-checkout" :disabled="cartStore.selectedItems.length === 0"
                    :class="{ disabled: cartStore.selectedItems.length === 0 }">
                    <span>CHECK OUT</span>
                </button>
            </div>
            <!-- <div class="mobile-nav">
                <MobileNav activeItem="cart"></MobileNav>
            </div> -->
        </div>

    </section>
</template>


<style scoped>
.mobile-nav {
    position: relative;
}

.cart-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    background-color: var(--bg-primary);
    min-height: 100dvh;
    max-height: 100dvh;
    overflow: auto;
    padding-bottom: 140px;
    /* Space for sticky checkout */
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
    margin-bottom: 1.5rem;
}

.truck-icon {
    height: 15px;
    aspect-ratio: 1;
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

.header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
    white-space: nowrap;
}

.btn-select {
    background: var(--surface);
    border-color: var(--primary-color);
    color: var(--primary-color);
}

.btn-select:hover:not(:disabled) {
    background: var(--primary-color);
    color: white;
    transform: translateY(-1px);
}

.btn-select.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}

.btn-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-delete {
    background: var(--surface);
    border-color: var(--error-color);
    color: var(--error-color);
}

.btn-delete:hover:not(:disabled) {
    background: var(--error-color);
    color: white;
    transform: translateY(-1px);
}

.btn-delete:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

.btn-count {
    font-weight: 600;
}

.icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
}

/* Empty Cart */
.empty-cart {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-secondary);
    transition: color var(--transition-fast);
}

.empty-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    color: var(--text-secondary);
    transition: color var(--transition-fast);
}

.empty-cart h2 {
    font-size: 24px;
    margin-bottom: 12px;
    color: var(--primary-color);
    transition: color var(--transition-fast);
}

/* Shop Sections */
.shops-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
    margin-bottom: 4rem;
}

.shop-section {
    background: var(--surface);
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-medium);
    overflow: hidden;
    transition: all var(--transition-fast);
    border: 1px solid var(--border-color);
}

.shop-section:hover {
    box-shadow: 0 6px 20px var(--shadow-color);
}

.shop-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    transition: all var(--transition-fast);
}

.shop-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.shop-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
}

.shop-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition-fast);
}

.shop-name:hover {
    color: var(--primary-color);
}

.shop-icon {
    width: 20px;
    height: 20px;
    color: var(--primary-color);
}

.btn-delete-shop {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--secondary-color);
    border-radius: 6px;
    background: var(--surface);
    color: var(--secondary-color);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
}

.btn-delete-shop:hover {
    background: var(--secondary-color);
    color: white;
    transform: translateY(-1px);
}

/* Cart Items */
.items-list {
    padding: 0;
}

.cart-item {
    display: grid;
    grid-template-columns: 40px 100px 1fr;
    gap: 16px;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-color);
    transition: all var(--transition-fast);
}

.cart-item:hover {
    background: var(--surface-hover);
}

.cart-item:last-child {
    border-bottom: none;
}

@media (max-width: 768px) {
    .cart-item {
        padding: 16px 12px;
    }
}

.item-checkbox input {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--primary-color);
    margin-top: 4px;
}

.item-image {
    width: 100px;
    height: 100px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-color);
}

.item-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: var(--transition);
}

.item-image:hover img {
    transform: scale(1.05);
}

.item-info {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
}

.item-details {
    flex: 1;
}

.item-name,
.item-ctgry {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    line-height: 1.4;
    display: -webkit-box;
    max-width: 80%;
    text-overflow: ellipsis;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    transition: color var(--transition-fast);
}

.item-ctgry {
    font-size: clamp(10px, 2vw, 12px);
    color: var(--text-secondary);
}

.item-price {
    font-size: clamp(14px, 1.5vw, 16px);
    color: var(--color-success, #22C55E);
    margin: 0;
    font-weight: 600;
}

.item-pricing {
    display: flex;
    gap: 0.375rem;
    margin: 0.5rem 0;
}

.item-price-original {
    font-size: clamp(12px, 1.5vw, 14px);
    color: var(--text-tertiary, #7f8c8d);
    text-decoration: line-through;
    margin: 0;
    font-weight: 400;
}

.item-price-sale {
    font-size: clamp(14px, 1.5vw, 16px);
    font-weight: 600;
    color: var(--color-success, #22C55E);
    margin: 0;
}

.badge-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.25rem;
}

.discount-badge {
    display: flex;
    align-items: center;
    background: var(--color-success, #22C55E);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: clamp(10px, 1.5vw, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    line-height: 1.2;
}

.free-shipping-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--color-success-light, rgba(34, 197, 94, 0.1));
    color: var(--color-success, #22C55E);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: clamp(10px, 1.5vw, 12px);
    font-weight: 600;
    line-height: 1.2;
}

.item-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
}


.quantity-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 4px;
    width: fit-content;
    transition: background-color var(--transition-fast);
}

.qty-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
}

.qty-btn:hover:not(:disabled) {
    border-color: var(--color-success, #22C55E);
    background: var(--color-success-light, rgba(34, 197, 94, 0.1));
    color: var(--color-success, #22C55E);
    transform: scale(1.05);
}

.qty-btn:active:not(:disabled) {
    transform: scale(0.95);
}

.qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

.quantity {
    font-size: clamp(14px, 1.5vw, 16px);
    font-weight: 600;
    min-width: 32px;
    text-align: center;
    color: var(--primary-color);
}

.item-total {
    text-align: right;
    min-width: 80px;
}




.btn-delete-item {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-tertiary, #7f8c8d);
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-delete-item:hover {
    border-color: var(--error-color, #e74c3c);
    background: var(--error-light, rgba(231, 76, 60, 0.1));
    color: var(--error-color, #e74c3c);
}

.btn-delete-item:active {
    background: var(--error-color, #e74c3c);
    color: white;
    transform: scale(0.95);
}

/* Sticky Checkout */
.checkout-sticky {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--surface-alpha);
    border-top: 1px solid var(--border-color);
    box-shadow: 0 -4px 12px var(--shadow-color);
    z-index: 1000;
    backdrop-filter: blur(8px);
    margin-bottom: 3.5rem;
    transition: all var(--transition-fast);
}

.checkout-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    padding: 16px 24px;
    gap: 12px;
}

.checkout-summary {
    width: 100%;
}

.summary-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.summary-label {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
}

.summary-total {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-success, #22C55E);
}

.summary-subtotal {
    font-size: 12px;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
}

.btn-checkout {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 8px;
    background: var(--color-success, #22C55E);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: 0.025em;
}

.btn-checkout:hover:not(.disabled) {
    background: var(--color-success-dark, #16a34a);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--shadow-success, rgba(34, 197, 94, 0.3));
}

.btn-checkout:active:not(.disabled) {
    transform: translateY(0);
}

.btn-checkout.disabled {
    background: var(--text-tertiary, #94A3B8);
    color: white;
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

.subtotal {
    font-size: 16px;
    transition: var(--transition);
}

.btn-checkout:hover:not(.disabled) .subtotal {
    transform: translateX(4px);
}

.checkout-spacer {
    height: 80px;
}

/* Responsive Design */
@media (min-width: 840px) {
    .checkout-sticky {
        margin-bottom: 0;
    }

    .shops-list {
        margin-bottom: 0;
    }


}

@media (max-width: 840px) {
    .page-header {
        padding: 1rem;
    }

    .page-title {
        font-size: 1.5rem;
    }
}

@media (max-width: 768px) {
    .cart-container {
        padding: 0;
        padding-bottom: 140px;
    }

    .page-header {
        padding: 0.875rem 1rem;
    }

    .page-title {
        font-size: 1.25rem;
    }

    .header-right {
        gap: 0.5rem;
    }

    .action-btn {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
    }

    .action-btn .btn-text {
        display: none;
    }

    .btn-count {
        display: inline;
    }

    .shop-header {
        gap: 12px;
        padding: 12px;
    }

    .shop-info {
        justify-content: flex-start;
    }

    .delete-text {
        display: none;
    }

    .shops-list {
        gap: 16px;
        padding: 0 12px;
    }

    .cart-item {
        grid-template-columns: 30px 80px 1fr;
        gap: 12px;
        padding: 16px 12px;
    }

    .item-image {
        width: 80px;
        height: 80px;
    }

    .item-name {
        font-size: 15px;
        max-width: 100%;
    }


    .item-controls {
        gap: 10px;
        margin-top: 8px;
    }

    .quantity-controls {
        gap: 10px;
    }

    .item-total {
        text-align: center;
    }

    .btn-delete-item {
        align-self: center;
    }

    .checkout-content {
        padding: 14px 16px;
        gap: 10px;
    }

    .summary-label {
        font-size: 13px;
    }

    .summary-total {
        font-size: 18px;
    }

    .btn-checkout {
        padding: 14px 16px;
        font-size: 15px;
    }
}

@media (max-width: 480px) {
    .page-header {
        padding: 0.75rem;
    }

    .page-title {
        font-size: 1.125rem;
    }

    .back-button {
        width: 2rem;
        height: 2rem;
    }

    .back-icon {
        width: 1.25rem;
        height: 1.25rem;
    }

    .action-btn {
        padding: 0.5rem;
        font-size: 0.7rem;
    }

    .shops-list {
        padding: 0 8px;
    }

    .cart-item {
        grid-template-columns: 28px 75px 1fr;
        gap: 10px;
        padding: 12px 8px;
    }

    .item-image {
        width: 75px;
        height: 75px;
    }

    .item-name {
        font-size: 14px;
    }

    /* .discount-badge,
    .free-shipping-badge {
        font-size: 0.65rem;
        padding: 0.1rem 0.4rem;
    } */

    .checkout-content {
        padding: 12px;
        gap: 10px;
    }

    .summary-label {
        font-size: 12px;
    }

    .summary-total {
        font-size: 16px;
    }

    .btn-checkout {
        padding: 13px;
        font-size: 14px;
    }
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible {
    outline: 2px solid var(--secondary-color);
    outline-offset: 2px;
}

/* Loading states */
.cart-item.loading {
    opacity: 0.6;
    pointer-events: none;
}

/* Animation for smooth interactions */

.cart-item {
    animation: fadeIn 0.3s ease-out;
}
</style>