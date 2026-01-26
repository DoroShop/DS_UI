<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  nextTick,
  defineAsyncComponent
} from "vue"

import Header from "../components/Header.vue"
import Banner from "../components/Banner.vue"
import Category from "../components/Category.vue"
import FeaturedSeller from "../components/FeaturedSeller.vue"
import FeaturedProduct from "../components/ProductCard.vue"
const LoadingCard = defineAsyncComponent(() => import("../components/Loading.vue"))

import { useCartStore } from "../stores/cartStores"
import { useProductsStore } from "../stores/productStores"
import { useAuthStore } from "../stores/authStores"
import { useTheme } from "../composables/useTheme"

// Define component name for keep-alive
defineOptions({
  name: 'Home'
})

const productsStore = useProductsStore()
const cartStore = useCartStore()
const authStore = useAuthStore()
const { isDark } = useTheme()
const forceRefresh = ref(false)

const targetSection = ref<HTMLElement | null>(null)
const scrollContainer = ref<HTMLDivElement | null>(null)

let scrollTimeout: ReturnType<typeof setTimeout> | null = null

// Track scroll position continuously (saves to store on every scroll)
const trackScrollPosition = () => {
  if (scrollContainer.value) {
    productsStore.homeScrollPosition = scrollContainer.value.scrollTop
  }
}

// ✅ Debounced scroll to avoid layout shifts
const handleScroll = () => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    if (targetSection.value) {
      targetSection.value.scrollIntoView({
        behavior: "smooth",
        block: "start"
      })
    }
  }, 100)
}

const loadProducts = async () => {
  try {
    // Only fetch if not already fetched (store checks this internally too)
    if (!productsStore.isFetched) {
      await productsStore.fetchFeaturedVendor()
      await productsStore.fetchProducts() // Don't pass true - let store decide
    }
    await nextTick()
    if (scrollContainer.value) {
      productsStore.initializeInfiniteScroll(scrollContainer.value)
    } else {
      console.warn("Scroll container is null, cannot initialize infinite scroll.")
    }
  } catch (error) {
    console.error("Error loading products:", error)
  }
}

onMounted(() => {
  loadProducts()

  // Add scroll listener to track position continuously
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', trackScrollPosition, { passive: true })
  }
})

// Save scroll position when leaving (navigating to another page)
onDeactivated(() => {
  // Remove scroll listener when deactivated
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', trackScrollPosition)
  }
})

// Restore scroll position when coming back
onActivated(() => {

  // Re-add scroll listener
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', trackScrollPosition, { passive: true })
    productsStore.initializeInfiniteScroll(scrollContainer.value)
  }

  // Restore scroll position - must wait for DOM to be fully ready
  const savedPosition = productsStore.homeScrollPosition
  if (savedPosition > 0 && scrollContainer.value) {
    const restoreScroll = () => {
      if (!scrollContainer.value) return false

      const container = scrollContainer.value

      // Only attempt if container has enough content
      if (container.scrollHeight >= savedPosition) {
        container.scrollTop = savedPosition
        return true
      }
      return false
    }

    // Immediate attempt
    if (!restoreScroll()) {
      // If failed, retry with delays (waiting for content to render)
      const retryTimes = [0, 16, 50, 100, 200, 300]
      retryTimes.forEach(delay => {
        setTimeout(() => {
          if (scrollContainer.value && scrollContainer.value.scrollTop !== savedPosition) {
            restoreScroll()
          }
        }, delay)
      })
    }
  }
})

// 🧹 Clean up infinite scroll listeners
onBeforeUnmount(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', trackScrollPosition)
    productsStore.cleanupInfiniteScroll(scrollContainer.value)
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
})
</script>

<template>
  <Header />
  <main ref="scrollContainer" class="product-listing-container">
    <!-- <Banner /> -->
    <Category class="sticky" @scrollTop="handleScroll" />

    <section class="content">
      <span ref="targetSection"></span>
      <FeaturedSeller />

      <!-- Loading State -->
      <div v-if="productsStore.isLoading" class="loading-wrapper">
        <div class="loading-header">
          <div class="skeleton-heading shimmer"></div>
        </div>
        <div class="loading-con">
          <LoadingCard v-for="n in 15" :key="n" />
        </div>
      </div>

      <!-- Products Content -->
      <div v-else-if="productsStore.products.length > 0" class="animation">
        <h3 v-if="productsStore.featuredProducts.length > 0">Featured Products</h3>
        <FeaturedProduct v-if="productsStore.featuredProducts.length > 0" typesOfProductList="FeaturedProducts" />
        <div class="product-heading">
          <h3 class="heading">Mindoro's Products</h3>
          <p>Explore the Unique Products From Oriental Mindoro</p>
        </div>
        <FeaturedProduct typesOfProductList="AllProducts" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!productsStore.isLoading" class="no-product">
        <p>No products yet.</p>
      </div>
    </section>

    <div class="mobile-spacing"></div>
    <!-- <MobileNav activeItem="home"></MobileNav> -->
  </main>
</template>

<style scoped>
.mobile-spacing {
  height: 3rem;
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

.animation {
  animation: fadeIn .3s ease-out;
}

.product-listing-container {
  max-height: 100dvh;
  height: 100dvh;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  padding: 10px 0;
  max-width: 1180px;
  margin: 0 auto;
  padding-bottom: 0;
  background-color: var(--bg-primary);
  transition: background-color var(--transition-fast);
}

.no-product {
  min-height: 7rem;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  justify-content: center;
  transition: color var(--transition-fast);
}

.loading-con {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 10px;
}

.isLoading {
  width: 100%;
  text-align: center;
  padding: 3rem;
  font-size: 16px;
}

.content {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: var(--bg-primary);
  transition: background-color var(--transition-fast);
}

.product-listing-container h3 {
  font-size: clamp(1rem, 3vw, 1.5rem);
  margin: 0 auto;
  width: 100%;
  max-width: 1200px;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.sticky {
  position: sticky !important;
  top: 4.8rem;
}

.loading-wrapper {
  width: 100%;
  animation: fadeIn 0.3s ease-out;
}

.loading-header {
  margin-bottom: 1rem;
  padding: 0 0.5rem;
}

.skeleton-heading {
  height: 28px;
  width: 200px;
  background: var(--skeleton-base, #e5e7eb);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.skeleton-heading.shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
      transparent 0%,
      var(--skeleton-shimmer, rgba(255, 255, 255, 0.4)) 50%,
      transparent 100%);
  animation: shimmer 1.8s infinite;
  transform: translateX(-100%);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 1200px) {
  .product-listing-container {
    padding: 0;
  }
}

@media (max-width: 820px) {
  .sticky {
    position: sticky;
    top: 4.2rem;
  }
}

.product-heading {
  text-align: center;
  margin: 1.5rem auto;
  width: 100%;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  height: 120px;
  /* 👈 lock the height */
  overflow: hidden;
  transition: opacity 0.3s ease;
}


.product-heading .heading {
  font-size: clamp(1.2rem, 2vw, 2rem);
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.product-heading p {
  max-width: 80%;
  width: 100%;
  text-align: center;
  font-size: clamp(16px, 2vw, 18px);
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

@media (max-width: 768px) {
  .content {
    padding: 7px;
    gap: 8px;
  }
}

@media (min-width: 720px) {
  .loading-con {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
}
</style>
