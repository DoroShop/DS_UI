<script setup lang="js">
import { ref, onMounted, onBeforeUnmount, nextTick, computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import {useAuthStore} from '../stores/authStores';
import Sidebar from "./Sidebar.vue"
import Wallet from "./Wallet.vue"
// import OrderTrackerModal from "./OrderTrackerModal.vue"
import NotificationBell from "./NotificationBell.vue"
import ShoppingCartIcon from '@heroicons/vue/24/outline/ShoppingCartIcon';
import UserIcon from '@heroicons/vue/24/outline/UserIcon';
import MagnifyingGlassIcon from '@heroicons/vue/24/outline/MagnifyingGlassIcon';
import MapPinIcon from '@heroicons/vue/24/outline/MapPinIcon';
import MoonIcon from '@heroicons/vue/24/outline/MoonIcon';
import SunIcon from '@heroicons/vue/24/outline/SunIcon';
import Bars3Icon from '@heroicons/vue/24/outline/Bars3Icon';
import XMarkIcon from '@heroicons/vue/24/outline/XMarkIcon';
import TruckIcon from '@heroicons/vue/24/outline/TruckIcon';
import ChatBubbleLeftIcon from '@heroicons/vue/24/outline/ChatBubbleLeftIcon';
import { useCartStore } from '../stores/cartStores';
import { useOrderStore } from '../stores/OrderStores';
import { useTheme } from '../composables/useTheme';


const authStore = useAuthStore();   

const userName = authStore.user?.name || 'Guest';

const router = useRouter();
const cartStore = useCartStore();
const orderStore = useOrderStore();
const messageStoreRef = shallowRef(null);
const { isDark, toggleTheme } = useTheme();

const ensureMessageStore = async () => {
    if (messageStoreRef.value) return messageStoreRef.value;
    const module = await import('../stores/messageStore');
    const store = module.useMessageStore();
    messageStoreRef.value = store;
    return store;
}

const isAccountOpen = ref(false);
const isWalletOpen = ref(false)
const isMobileMenuOpen = ref(false);
const isSearchExpanded = ref(false);
const showTrackerModal = ref(false);
const containerRef = ref(null);
const openButtonRef = ref(null);

const trackableOrdersCount = computed(() => {
    return orderStore.orders.filter(order => 
        order.status === 'shipped' && 
        order.shippingOption !== 'pickup' && 
        order.shippingOption !== 'agreement' && 
        order.shippingOption !== 'customer agreement'
    ).length;
});

const unreadMessagesCount = computed(() => {
    const store = messageStoreRef.value;
    if (!store) return 0;
    return store.unreadCount || store.computedUnreadCount;
});

const toggleMobileMenu = () => {
    isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const toggleSearch = () => {
    isSearchExpanded.value = !isSearchExpanded.value;
};

const closeSearch = () => {
    isSearchExpanded.value = false;
};

const goToMessages = async () => {
    await ensureMessageStore();
    router.push('/messages');
};

// ✅ Reset mobile state if viewport becomes large
const handleResize = () => {
    if (window.innerWidth >= 992) {
        isMobileMenuOpen.value = false;
        isSearchExpanded.value = false;
    }
};


const handleClickOutside = (event) => {
    const clickedInsideContainer =
        containerRef.value && containerRef.value.contains(event.target);

    const clickedOnOpenButton =
        openButtonRef.value && openButtonRef.value.contains(event.target);

    if (!clickedInsideContainer && !clickedOnOpenButton) {
        if (isAccountOpen.value || isWalletOpen.value) {
            isAccountOpen.value = false;
            isWalletOpen.value = false;
        }
    }
};


const openAccountInfo = async () => {
    isAccountOpen.value = !isAccountOpen.value;
};

const goToLoginPage = async () => {
    router.push("/login")
};


function onFocus() {
    router.push("/products/search")
}
const totalItems = computed(() => cartStore.countItem);
onMounted(async () => {
    await cartStore.fetchCart();
    // await orderStore.fetchOrders();
    console.log("userrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr", authStore.user)
    window.addEventListener('resize', handleResize);
    document.addEventListener('click', handleClickOutside);
    if (authStore.isAuthenticated) {
        const hydrateMessages = async () => {
            try {
                const store = await ensureMessageStore();
                store.initializeSocket?.();
            } catch (error) {
                console.error('Failed to warm message store', error);
            }
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(hydrateMessages, { timeout: 2000 });
        } else {
            setTimeout(hydrateMessages, 1200);
        }
    }
}); 

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('click', handleClickOutside);
});

const openWallet = () => {
    isWalletOpen.value = true;
}

const closeWallet = () => {
    isWalletOpen.value = false;
}

const goToCart = () => {
    router.push("/cart")
}

// const openTracker = () => {
//     showTrackerModal.value = true;
// }

// const closeTracker = () => {
//     showTrackerModal.value = false;
// }
</script>

<template>
    <header class="header">
        <div class="container">
            <!-- <OrderTrackerModal
                v-if="showTrackerModal"
                @close="closeTracker"
            /> -->

            <div class="sidebars-container" ref="containerRef">
                <TransitionGroup name="slide-fade">
                    <Sidebar v-if="isAccountOpen" class="account" @handleClick="openWallet"></Sidebar>
                    <Wallet v-if="isWalletOpen" @closeWallet="closeWallet"></Wallet>
                </TransitionGroup>
            </div>

            <div class="logo-section">
                <router-link to="/products" class="logo">
                    <img src="../assets/DoroShop-logo.webp" alt="DoroShop" loading="lazy"/>
                    <h3 class="logo-text">DoroShop</h3>
                </router-link>
            </div>

            <div class="desktop-search">
                <div class="search-container">
                    <input @focus="onFocus" type="text" placeholder="Search products..." class="search-input" />
                    <!-- <button class="search-button">
                        <span class="search-text">Search</span>
                        <MagnifyingGlassIcon class="search-icon" />
                    </button> -->
                </div>
            </div>

       
            <div class="actions-section desktop-actions">
                <div class="action-icons">
                    <button @click="toggleTheme" class="icon-button theme-toggle" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
                        <Transition name="theme-icon" mode="out-in">
                            <SunIcon v-if="isDark" key="sun" class="action-icon" />
                            <MoonIcon v-else key="moon" class="action-icon" />
                        </Transition>
                    </button>
                    <!-- <button @click="openTracker" class="icon-button" title="Track your order">
                        <TruckIcon class="action-icon" />
                        <span v-if="trackableOrdersCount > 0" class="cart-badge">{{ trackableOrdersCount }}</span>
                    </button> -->
                    <button @click="goToMessages" class="icon-button" title="Messages">
                        <ChatBubbleLeftIcon class="action-icon" />
                        <span v-if="unreadMessagesCount > 0" class="cart-badge">{{ unreadMessagesCount }}</span>
                    </button>
                    <button class="icon-button" title="Nearby Shops" @click="router.push('/shops/nearby')">
                        <MapPinIcon class="action-icon" />
                    </button>
                    <button class="icon-button" @click="goToCart" title="Shopping cart">
                        <ShoppingCartIcon class="action-icon" />
                        <span class="cart-badge">{{ totalItems }}</span>
                    </button>
                    <NotificationBell />
             
                 
                </div>
                <button ref="openButtonRef" v-if="authStore.isAuthenticated" @click="openAccountInfo" class="account-button">
                    <UserIcon class="account-icon" />
                    <span class="account-text">{{ userName }}</span>
                </button>
                  <button ref="openButtonRef" v-else @click="goToLoginPage" class="account-button">
                    <UserIcon class="account-icon" />
                    <span class="account-text">Sign in</span>
                </button>
            </div>

        </div>
    </header>
</template>
<style scoped>
.header {
    width: 100vw;
    background-color: var(--primary-color);
    box-shadow: var(--shadow-md);
    z-index: 1000;
    min-height: 4rem;
    position: fixed;
    top: 0;
    transition: background-color var(--transition-fast);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.container {
    animation: fadeIn 0.15s ease-out;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: fit-content;
    min-height: 4rem;
    max-height: 5.5rem;
    position: relative;
}

/* Logo Section */
.logo-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    height: 5rem;
}

.logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 100%;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    transition: opacity 0.2s ease;
}

.logo:hover {
    opacity: 0.8;
}

.logo img {
    padding: 0;
    margin: 0;
    display: flex;
    width: clamp(4rem, 3vw, 5rem);
    aspect-ratio: 1;
}

.logo-placeholder {
    width: 2.5rem;
    height: 2.5rem;
    background: linear-gradient(135deg, var(--accent-color), #f97316);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: 1rem;
}

.logo-text {
    font-size: var(--font-size-xl);
    font-weight: 700;
    color: var(--text-white);
    white-space: nowrap;
    margin-top: 8px;
    margin-left: -10px;
}

/* Search Section */

.desktop-search {
    width: 100%;
    background-color: transparent;
    height: 100%;
    min-height: 4rem;
    display: flex;
    padding: 8px 0.5rem;
    display: flex;
    justify-content: center;
}

.search-container {
    background-color: var(--surface);
    flex: 1 1 auto;
    display: flex;
    padding: 3px;
    border-radius: 8px;
    max-width: 35rem;
    transition: background-color var(--transition-fast);
}

.search-container input {
    flex: 1 1 auto;
    padding: 0px 1rem;
    border: 0;
    outline: 0;
    background-color: transparent;
    color: var(--text-primary);
    transition: color var(--transition-fast);
}

.search-container input::placeholder {
    color: var(--text-secondary);
}

.search-container button {
    padding: 0px 12px;
    display: flex;
    align-items: center;
    gap: 5px;
    background-color: var(--primary-color);
    border: 0;
    outline: 0;
    justify-self: center;
    color: var(--text-white);
    border-radius: 6px;
    transition: background-color var(--transition-fast);
}

.search-icon {
    width: 1.2rem;
    aspect-ratio: 1;
}

/* Actions Section */
.actions-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
}

.action-icons {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.1rem 1rem;
    background-color: var(--secondary-color);
    border-radius: 0.25rem;
}

.icon-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: none;
    border: none;
    color: var(--text-white);
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all var(--transition-fast);
    min-height: 2.75rem;
    min-width: 2.75rem;
}

.icon-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: scale(1.05);
}

.action-icon {
    width: var(--icon-width);
    height: var(--icon-width);
}

.cart-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    background-color: var(--primary-color-2);
    color: var(--text-white);
    font-size: 0.75rem;
    font-weight: bold;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    min-width: 1.25rem;
    text-align: center;
}

.account-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--surface);
    border-radius: 50rem;
    border: none;
    border-radius: 9999px;
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--text-primary);
    font-weight: 500;
    min-height: 2.75rem;
}

.account-button:hover {
    transform: scale(1.02);
    box-shadow: var(--shadow-md);
}

.account-icon {
    width: 1.25rem;
    height: 1.25rem;
}

.account-text {
  font-size: var(--font-size-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 10ch; /* ~10 characters */
  display: inline-block; /* needed so max-width applies */
}


/* Mobile Elements */
.mobile-search-toggle {
    display: none;
    background: none;
    border: none;
    color: var(--text-white);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: background-color var(--transition-fast);
    min-height: 2.75rem;
    min-width: 2.75rem;
}

.mobile-search-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
}

.search-toggle-icon {
    width: 1.5rem;
    height: 1.5rem;
}

.mobile-search-overlay {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--primary-color);
    padding: 1rem;
    box-shadow: var(--shadow-lg);
    z-index: 10;
}

.mobile-search-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.mobile-search-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    outline: none;
    font-size: var(--font-size-base);
    background-color: var(--surface);
    color: var(--text-primary);
    transition: all var(--transition-fast);
}

.mobile-search-input::placeholder {
    color: var(--text-secondary);
}

.mobile-search-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background-color: var(--secondary-color);
    border: none;
    border-radius: 0.5rem;
    color: var(--text-white);
    cursor: pointer;
    min-height: 3rem;
    min-width: 3rem;
}

.mobile-search-icon {
    width: 1.25rem;
    height: 1.25rem;
}

.mobile-search-close {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    background: none;
    border: none;
    color: var(--text-white);
    cursor: pointer;
    border-radius: 0.5rem;
    min-height: 3rem;
    min-width: 3rem;
}

.close-icon {
    width: 1.25rem;
    height: 1.25rem;
}

.mobile-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--bg-primary);
    box-shadow: var(--shadow-lg);
    z-index: 10;
    transition: background-color var(--transition-fast);
}

.mobile-menu-content {
    padding: 1rem;
}

.mobile-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.mobile-action-button {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    border-radius: 0.5rem;
    transition: background-color var(--transition-fast);
    color: var(--text-primary);
    font-size: var(--font-size-base);
    min-height: 3.5rem;
}

.mobile-action-button:hover {
    background-color: var(--surface-hover);
}

.mobile-action-button.primary {
    background-color: var(--primary-color);
    color: var(--text-white);
}

.mobile-action-button.primary:hover {
    opacity: var(--hover-opacity);
}

.mobile-action-icon {
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
}

/* Responsive Design */
/* Fade-slide animation for transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-20px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
    opacity: 1;
    transform: translateY(0);
}

/* Improve buttons with smooth transitions */
.icon-button,
.account-button,
.mobile-action-button {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/*
  Enter and leave animations can use different
  durations and timing functions.
*/

.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.4s ease;
}

.slide-fade-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.slide-fade-enter-to {
    transform: translateX(0);
    opacity: 1;
}

.slide-fade-leave-from {
    transform: translateX(0);
    opacity: 1;
}

.slide-fade-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

.sidebars-container {
    width: auto;
    height: fit-content;
    display: flex;
    position: absolute;
    gap: 1rem;
    top: 5.5em;
    z-index: 100;
    right: 0;
    flex-direction: row-reverse;
}

/* Large screens (≥1200px) */
@media (min-width: 1200px) {
    .container {
        padding: 1rem 1rem;
    }
}

/* Medium screens (≤1199px) */
@media (max-width: 1199px) {
    .action-icons {
        gap: 0rem !important;
    }
}

/* Tablets (≤992px) */
@media (max-width: 992px) {
    .logo-text {
        display: none;
    }

    .account-text {
        display: none;
    }

    .action-icons {
        gap: 0.25rem;
    }

    .account-button {
        height: 100%;
        aspect-ratio: 1;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
    }
}

/* Small tablets (≤768px) */

@media (max-width: 820px) {
    .container {
        gap: 0.5rem;
        height: 4.2rem;
    }

    .sidebars-container {
        top: 4.2rem;
    }

    .desktop-actions {
        display: none;
    }

    .mobile-search-toggle {
        display: flex;
    }

    .logo-section {
        flex: 1;
    }
}



@media (max-width: 630px) {
    .logo-section {
        display: none;
    }
}

/* Mobile phones (≤576px) */
@media (max-width: 576px) {
    .container {
        padding: 0.5rem 0.75rem;
        min-height: 3.5rem;
    }

    .logo-placeholder {
        width: 2rem;
        height: 2rem;
        font-size: 0.875rem;
    }

    .mobile-search-overlay {
        padding: 0.75rem;
    }

    .mobile-menu-content {
        padding: 0.75rem;
    }

    .mobile-action-button {
        padding: 0.75rem;
        min-height: 3rem;
    }
}

@media (max-width: 540px) {

    .container {
        padding: 0;
        margin: 0;
    }
}

/* Extra small phones (≤375px) */
@media (max-width: 375px) {
    .container {
        padding: 0.5rem;
    }

    .logo-placeholder {
        width: 1.75rem;
        height: 1.75rem;
        font-size: 0.75rem;
    }
}

/* Theme Toggle Animation */
.theme-toggle {
    overflow: hidden;
}

.theme-icon-enter-active,
.theme-icon-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.theme-icon-enter-from {
    opacity: 0;
    transform: rotate(-90deg) scale(0.8);
}

.theme-icon-leave-to {
    opacity: 0;
    transform: rotate(90deg) scale(0.8);
}

.theme-icon-enter-to,
.theme-icon-leave-from {
    opacity: 1;
    transform: rotate(0deg) scale(1);
}
</style>
