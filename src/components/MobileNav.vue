  <script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTheme } from '../composables/useTheme'

import {
  HomeIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  BuildingStorefrontIcon
} from '@heroicons/vue/24/outline'

import {
  HomeIcon as HomeIconSolid,
  ChatBubbleLeftIcon as ChatBubbleLeftIconSolid,
  UserIcon as UserIconSolid,
  ShoppingBagIcon as ShoppingBagIconSolid,
  ShoppingCartIcon as ShoppingCartIconSolid,
   BuildingStorefrontIcon as  BuildingStorefrontIconSolid
} from '@heroicons/vue/24/solid'

const { theme } = useTheme()

interface NavItem {
  id: string
  label: string
  icon: any
  activeIcon: any
  navigate: string
}

const router = useRouter()
const route = useRoute()

const active = ref('home')

const navItems: NavItem[] = [
  { id: 'home', navigate: '/products', label: 'Home', icon: HomeIcon, activeIcon: HomeIconSolid },
  { id: 'cart', navigate: '/cart', label: 'Cart', icon: ShoppingCartIcon, activeIcon: ShoppingCartIconSolid },
  { id: 'shops', navigate: '/shops/nearby', label: 'Shops', icon: BuildingStorefrontIcon, activeIcon: BuildingStorefrontIconSolid },
  { id: 'orders', navigate: '/orders', label: 'Orders', icon: ShoppingBagIcon, activeIcon: ShoppingBagIconSolid },
  { id: 'profile', navigate: '/user/me', label: 'Profile', icon: UserIcon, activeIcon: UserIconSolid }
]

const shouldShowNav = computed(() =>
  // Show mobile nav on all routes unless explicitly hidden via route meta
  !route.meta?.hideMobileNav
)

// Update active state on route change
const updateActiveFromRoute = () => {
  const match = navItems.find(item => route.path.startsWith(item.navigate))
  active.value = match?.id || 'home'
}

onMounted(() => {
  updateActiveFromRoute()
})

watch(() => route.path, updateActiveFromRoute)


const navigateTo = (itemId: string, path: string) => {
  // Use router navigation and ignore duplicate navigation errors
  router.push(path).catch(() => {})
  active.value = itemId
}
</script>

<template>
  <nav v-if="shouldShowNav" class="mobile-nav">
    <div class="nav-container">
      <button v-for="item in navItems" :key="item.id" class="nav-item" :class="{ active: active === item.id }"
        type="button" :aria-label="item.label" @click="navigateTo(item.id, item.navigate)">
        <component :is="active === item.id ? item.activeIcon : item.icon" class="nav-icon" />
        <span v-if="active === item.id" class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>


<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 0;
  background: transparent;
  pointer-events: auto;
  transition: all var(--transition-fast);
  -webkit-font-smoothing: antialiased;
}

.nav-container {
  background-color: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-around;
  align-items: center;
  pointer-events: all;
  width: 100%;
  padding: 0.5rem 10px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  transition: all var(--transition-fast);
}

.nav-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 14px;
  transition: all var(--transition-fast);
  flex: 1;
  justify-content: center;
  padding: 0.5rem 0.25rem;
  min-height: 44px; /* touch target size */
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(0,0,0,0.06);
}

.nav-item:hover {
  background-color: var(--surface-hover);
}

.nav-icon {
  width: 24px;
  height: 24px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.nav-item:hover .nav-icon {
  color: var(--text-primary);
}

.nav-item.active {
  background-color: var(--primary-color);
  transform: translateY(-2px);
  border-radius: 0.8rem;
  padding: 0.6rem 0.7rem;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
}

.nav-item.active .nav-icon {
  color: white;
}

.nav-label {
  font-size: 0.85rem;
  font-weight: 600;
  display: none;
  color: white;
  letter-spacing: 0.01em;
}

.nav-item.active .nav-label {
  display: block;
}

/* Smooth theme transitions */
.nav-container,
.nav-item,
.nav-icon {
  transition: all var(--transition-fast);
}

/* Hide nav bar on large screen */
@media (min-width: 841px) {
  .mobile-nav {
    display: none;
  }
}

/* Enhanced mobile experience */
@media (max-width: 480px) {
  .nav-container {
    padding: 0.4rem 8px;
  }

  .nav-item {
    padding: 0.45rem 0.2rem;
  }

  .nav-item.active {
    padding: 0.55rem 0.6rem;
  }

  .nav-icon {
    width: 22px;
    height: 22px;
  }

  .nav-label {
    font-size: 0.8rem;
  }
}

/* Safe area support for devices with notches */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .nav-container {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
  }
}
</style>
