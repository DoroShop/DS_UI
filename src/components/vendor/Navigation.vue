<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  ChartBarIcon,
  CubeIcon,
ChartPieIcon,
  ShoppingBagIcon,
  CogIcon,
  UserCircleIcon,
  ChatBubbleLeftIcon,
  BanknotesIcon,
  ArrowDownCircleIcon,
  CreditCardIcon,
  TruckIcon
} from '@heroicons/vue/24/outline'
import { useMessageStore } from '@/stores/messageStore'

const props = defineProps({
  active: {
    type: String,
    default: 'Analytics'
  }
})

const emits = defineEmits(['navigate'])
const messageStore = useMessageStore()

const current = ref(props.active)

const unreadMessagesCount = computed(() => messageStore.unreadCount || 0)

const navItems = [
  { name: 'Analytics', icon: ChartPieIcon },
  { name: 'Store Overview', icon: ChartBarIcon },
  { name: 'Products', icon: CubeIcon },
  { name: 'Orders', icon: ShoppingBagIcon },
  { name: 'Shipping Discounts', icon: TruckIcon },
  { name: 'Financials', icon: BanknotesIcon },
  { name: 'Withdrawals', icon: ArrowDownCircleIcon },
  { name: 'Subscription', icon: CreditCardIcon },
  { name: 'Messages', icon: ChatBubbleLeftIcon, badge: unreadMessagesCount },
  { name: 'Inventory', icon: CogIcon },
  { name: 'Profile', icon: UserCircleIcon }
]

function select(name) {
  current.value = name
  emits('navigate', name)
}

// Watch for prop changes
watch(() => props.active, (newActive) => {
  current.value = newActive
}, { immediate: true })

onMounted(() => {
  // Fetch unread count for vendor
  messageStore.fetchUnreadCount('vendor')
})
</script>

<template>
  <div>
    <!-- Desktop Sidebar -->
    <aside class="sidebar">
      <div class="side-bar-fixed">
        <div class="sidebar-con">
          <div class="logo">
            <ChartBarIcon class="logo-icon" />
            <h2>Dashboard</h2>
          </div>
          <nav class="nav-menu">
            <a v-for="item in navItems" :key="item.name" href="#" class="nav-item"
              :class="{ active: current === item.name }" @click.prevent="select(item.name)">
              <component :is="item.icon" class="nav-icon" />
              <span>{{ item.name }}</span>
              <span v-if="item.badge && item.badge.value > 0" class="nav-badge">
                {{ item.badge.value }}
              </span>
            </a>
          </nav>
        </div>
      </div>
    </aside>

    <!-- Mobile Bottom Nav -->
    <nav class="mobile-nav" v-show="props.active !== 'Messages'">
      <a v-for="item in navItems" :key="item.name" href="#" class="mobile-nav-item"
        :class="{ active: current === item.name }" @click.prevent="select(item.name)">
        <div class="mobile-nav-item-content">
          <component :is="item.icon" class="mobile-nav-icon" />
          <span v-if="item.badge && item.badge.value > 0" class="mobile-badge">
            {{ item.badge.value }}
          </span>
        </div>
        <span>{{ item.name }}</span>
      </a>
    </nav>
  </div>
</template>

<style scoped>
/* ========== MOBILE NAV ========== */
.mobile-nav {
  display: flex;
  background: var(--surface);
  border-top: 1px solid var(--border-primary);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.mobile-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 0.25rem;
  position: relative;
}

.mobile-nav-item:hover {
  color: var(--color-primary);
  background: var(--surface-hover);
}

.mobile-nav-item.active {
  color: var(--color-primary);
}

.mobile-nav-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-primary);
  border-radius: 0 0 3px 3px;
}

.mobile-nav-item-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-nav-icon {
  width: 20px;
  height: 20px;
}

.mobile-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  background: var(--secondary-color);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  min-width: 16px;
  text-align: center;
  border: 2px solid var(--surface);
}

.mobile-nav-item span {
  font-size: 0.75rem;
  font-weight: 600;
}

/* ========== DESKTOP SIDEBAR ========== */
.sidebar {
  display: none;
  position: relative;
  top: 0;
  left: 0;
  z-index: 1000;
  height: 100vh;
  background: var(--surface);
  width: 280px;
  border-right: 1px solid var(--border-primary);
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
  overflow-y: auto;

}

.side-bar-fixed {
  position: fixed;
  top: 0;
  width: 280px;
  height: 100vh;
  padding: 1.5rem;
  background: var(--surface);
}

.sidebar-con {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.logo-icon {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
}

.logo h2 {
  color: var(--text-primary);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  gap: 0.75rem;
  font-weight: 500;
  position: relative;
}

.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
  transform: translateX(4px);
}

.nav-item.active {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
  color: white;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
  font-weight: 600;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 0 4px 4px 0;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
}

.nav-icon {
  width: 20px;
  height: 20px;
}

.nav-badge {
  margin-left: auto;
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
}

/* ========== RESPONSIVE RULES ========== */
@media (min-width: 1024px) {
  .mobile-nav {
    display: none;
  }

  .sidebar {
    display: block;
  }
}
</style>
