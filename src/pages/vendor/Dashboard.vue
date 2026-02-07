<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeftIcon, Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import Analytics from '../../components/vendor/views/Analytics.vue';
import Navigation from '../../components/vendor/Navigation.vue';
import Products from '../../components/vendor/views/Products.vue';
import Orders from '../../components/vendor/views/Orders.vue';
import Inventory from '../../components/vendor/views/Inventory.vue';
import Messages from '../../components/vendor/views/Messages.vue';
import Financials from '../../components/vendor/views/Financials.vue';
import Withdrawals from '../../components/vendor/views/Withdrawals.vue';
import DashboardAnalytics from '../../components/vendor/views/DashboardAnalytics.vue';
import { useVendorDashboardStore } from '../../stores/vendor/dashboardStores';
import VendorProfile from '../../components/vendor/views/VendorProfile.vue';
import Subscription from '../../components/vendor/views/Subscription.vue';
import ShippingDiscounts from '../../components/vendor/views/ShippingDiscounts.vue';
import ThemeToggle from '../../components/ThemeToggle.vue';

const router = useRouter()

// Loading and error states
const isInitialLoading = ref(true)
const loadingError = ref(null)

onMounted(async () => {
  try {
    const vendorDashboard = useVendorDashboardStore()
    await vendorDashboard.fetchVendor()
  } catch (error) {
    console.error('Failed to load vendor dashboard:', error)
    loadingError.value = error.message || 'Failed to load dashboard'
  } finally {
    isInitialLoading.value = false
  }
})

const active = ref(localStorage.getItem("activePageVendorDashboard") || 'Analytics')
const isMobileMenuOpen = ref(false)

// Check if we're in messages view for layout changes
const isMessagesView = computed(() => active.value === 'Messages')

const sample = (name) => {
  active.value = name
  localStorage.setItem("activePageVendorDashboard", name)
  // Close mobile menu when item is selected
  isMobileMenuOpen.value = false
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

onUnmounted(() => {
  localStorage.removeItem("activePageVendorDashboard")
})
</script>
<template>
  <main>
    <!-- Loading State -->
    <div v-if="isInitialLoading" class="dashboard-loading">
      <div class="loading-spinner"></div>
      <p>Loading your vendor dashboard...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="loadingError" class="dashboard-error">
      <div class="error-icon">⚠️</div>
      <h2>Failed to Load Dashboard</h2>
      <p>{{ loadingError }}</p>
      <button @click="location.reload()" class="retry-button">Try Again</button>
    </div>

    <!-- Dashboard Content -->
    <section v-else :class="{ 'messages-layout': isMessagesView }">
      <Navigation 
        v-show="!isMessagesView" 
        :active="active"
        :isMobileMenuOpen="isMobileMenuOpen"
        @navigate="sample"
        @closeMobileMenu="isMobileMenuOpen = false"
      />

      <div class="content" :class="{ 'messages-fullscreen': isMessagesView }">
        <header v-show="!isMessagesView">
          <div class="header-left">
            <!-- Mobile Hamburger Button -->
            <button 
              class="hamburger-btn" 
              @click="toggleMobileMenu"
              :class="{ active: isMobileMenuOpen }"
              aria-label="Toggle navigation menu"
            >
              <Bars3Icon class="hamburger-icon" />
       
            </button>
            
            <!-- <button class="back-button" @click="router.push('/products')" title="Back to Products">
              <ArrowLeftIcon class="back-icon" />
              <span>Back</span>
            </button> -->
            <h1>{{ active }}</h1>
          </div>
          <div class="header-right">
            <ThemeToggle :showLabel="true" size="medium" />
          </div>
        </header>
        <Analytics v-if="active === 'Analytics'"></Analytics>
        <DashboardAnalytics v-if="active === 'Store Overview'"></DashboardAnalytics>
        <Products v-if="active === 'Products'"></Products>
        <Orders v-if="active === 'Orders'"></Orders>
        <Financials v-if="active === 'Financials'"></Financials>
        <Withdrawals v-if="active === 'Withdrawals'"></Withdrawals>
        <Subscription v-if="active === 'Subscription'"></Subscription>
        <ShippingDiscounts v-if="active === 'Shipping Discounts'"></ShippingDiscounts>
        <Messages v-if="active === 'Messages'" @navigate="sample"></Messages>
        <Inventory v-if="active === 'Inventory'"></Inventory>
        <VendorProfile v-if="active === 'Profile'"></VendorProfile>
      </div>
    </section>
  </main>
</template>



<style scoped>
.dashboard-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1.5rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(var(--primary-color-rgb), 0.2);
  border-left: 4px solid rgb(var(--primary-color-rgb));
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.dashboard-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
}

.error-icon {
  font-size: 3rem;
}

.dashboard-error h2 {
  color: var(--text-primary);
  margin: 0;
}

.dashboard-error p {
  color: var(--text-secondary);
  max-width: 400px;
  margin: 0;
}

.retry-button {
  padding: 0.75rem 1.5rem;
  background: rgb(var(--primary-color-rgb));
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.retry-button:hover {
  background: rgba(var(--primary-color-rgb), 0.9);
}

main {
  width: 100dvw;
  min-height: 100dvh;
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.02) 0%, rgba(31, 139, 78, 0.05) 100%);
  background-color: var(--bg-primary);
  transition: background-color 0.3s ease, background 0.3s ease;
}

section {
  position: relative;
  display: flex;
  max-width: 1700px;
  margin: 0 auto;
  gap: 0;
  min-height: 100dvh;
  transition: all 0.3s ease;
}

section.messages-layout {
  max-width: none;
  margin: 0;
  gap: 0;
}

.content {
  flex: 1;
  width: 100%;
  padding: 0;
  background-color: transparent;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

.content.messages-fullscreen {
  width: 100%;
  margin-left: 0;
  max-width: none;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  color: var(--text-primary);
  font-size: clamp(14px, 2vw, 1rem);
  background: var(--dashboard-primary);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-primary);
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

header:hover {
  box-shadow: 0 2px 8px rgba(31, 139, 78, 0.08);
}

.header-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hamburger-btn {
  display: none;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-sm);
  color: white;
}

.hamburger-btn:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.hamburger-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.hamburger-icon {
  width: 20px;
  height: 20px;
  color: currentColor;
  transition: transform 0.3s ease;
}

.hamburger-btn.active .hamburger-icon {
  transform: rotate(90deg);
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
}

.back-button:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateX(-2px);
}

.back-icon {
  width: 16px;
  height: 16px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

header h1 {
  margin: 0;
  color: var(--text-primary);
  font-weight: 700;
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--text-primary) 0%, #1f8b4e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Responsive layout */
@media (max-width: 1024px) {
  section {
    gap: 0;
  }
  
  .content.messages-fullscreen {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .content.messages-fullscreen {
    width: 100%;
    margin-left: 0;
    padding: 0;
  }
  
  header {
    padding: 1rem;
  }
  
  header h1 {
    font-size: 1.25rem;
  }
  
  .header-right {
    gap: 0.5rem;
  }
  
  .hamburger-btn {
    display: flex;
  }
}

@media (max-width: 480px) {
  header {
    padding: 0.875rem;
  }
  
  header h1 {
    font-size: 1.125rem;
  }
}
</style>