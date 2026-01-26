<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import {
  HomeIcon,
  UsersIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  TagIcon,
  PhotoIcon,
  MegaphoneIcon,
  CreditCardIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
  MagnifyingGlassIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
} from '@heroicons/vue/24/outline';

const router = useRouter();
const route = useRoute();
const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isSidebarOpen = ref(true);
const isMobileMenuOpen = ref(false);

// Navigation items
const navigationItems = [
  { 
    name: 'Dashboard', 
    path: '/admin', 
    icon: HomeIcon,
    exact: true 
  },
  { 
    name: 'Users', 
    path: '/admin/users', 
    icon: UsersIcon,
    badge: null
  },
  { 
    name: 'Sellers', 
    path: '/admin/sellers', 
    icon: BuildingStorefrontIcon,
    children: [
      { name: 'All Sellers', path: '/admin/sellers' },
      { name: 'Applications', path: '/admin/sellers/applications', badge: 'pendingApplications' }
    ]
  },
  { 
    name: 'Products', 
    path: '/admin/products', 
    icon: CubeIcon,
    children: [
      { name: 'All Products', path: '/admin/products' },
      { name: 'Pending Approval', path: '/admin/products/pending', badge: 'pendingProducts' }
    ]
  },
  { 
    name: 'Orders', 
    path: '/admin/orders', 
    icon: ShoppingCartIcon 
  },
  { 
    name: 'Commission & Revenue', 
    path: '/admin/commission', 
    icon: ChartBarIcon,
    children: [
      { name: 'Revenue Overview', path: '/admin/commission' },
      { name: 'COD Commissions', path: '/admin/cod-commissions' },
      { name: 'Pending Sellers', path: '/admin/pending-sellers', badge: 'pendingCommissions' }
    ]
  },
  { 
    name: 'Subscriptions', 
    path: '/admin/subscriptions', 
    icon: DocumentCheckIcon 
  },
  { 
    name: 'Categories', 
    path: '/admin/categories', 
    icon: TagIcon 
  },
  { 
    name: 'Municipalities', 
    path: '/admin/municipalities', 
    icon: MapPinIcon 
  },
  { 
    name: 'Banners', 
    path: '/admin/banners', 
    icon: PhotoIcon 
  },
  { 
    name: 'Announcements', 
    path: '/admin/announcements', 
    icon: MegaphoneIcon 
  },
  { 
    name: 'Refunds', 
    path: '/admin/refunds', 
    icon: CreditCardIcon,
    badge: 'pendingRefunds'
  },
  { 
    name: 'Withdrawals', 
    path: '/admin/withdrawals', 
    icon: BanknotesIcon,
    children: [
      { name: 'Pending', path: '/admin/withdrawals' },
      { name: 'History', path: '/admin/withdrawals/history' }
    ],
    badge: 'pendingWithdrawals'
  },
{ 
    name: 'Audit Logs', 
    path: '/admin/audit-logs', 
    icon: ClipboardDocumentListIcon 
  },
  { 
    name: 'Settings', 
    path: '/admin/settings', 
    icon: Cog6ToothIcon 
  },
];

const expandedMenus = ref<string[]>([]);

const toggleSubmenu = (name: string) => {
  const index = expandedMenus.value.indexOf(name);
  if (index === -1) {
    expandedMenus.value.push(name);
  } else {
    expandedMenus.value.splice(index, 1);
  }
};

const isActiveRoute = (path: string, exact = false) => {
  if (exact) {
    return route.path === path;
  }
  return route.path.startsWith(path);
};

const getBadgeCount = (badgeKey: string | null) => {
  if (!badgeKey || !adminStore.dashboardStats) return 0;
  switch (badgeKey) {
    case 'pendingApplications':
      return adminStore.dashboardStats.pendingActions?.sellerApplications || 0;
    case 'pendingProducts':
      return adminStore.dashboardStats.pendingActions?.productApprovals || 0;
    case 'pendingCommissions':
      return adminStore.dashboardStats.pendingActions?.pendingCommissions || 0;
    case 'pendingWithdrawals':
      return adminStore.dashboardStats.pendingActions?.withdrawals || 0;
    default:
      return 0;
  }
};

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(async () => {
  try {
    // Ensure auth session is loaded first
    if (!authStore.authChecked) {
      await authStore.fetchSession();
    }
    // Only fetch if authenticated as admin
    if (authStore.isAuthenticated && authStore.user?.role === 'admin') {
      await adminStore.fetchDashboardStats();
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
  }
});

const pendingActionsCount = computed(() => adminStore.pendingActionsCount);
</script>

<template>
  <div class="admin-layout">
    <!-- Mobile Menu Overlay -->
    <div 
      v-if="isMobileMenuOpen" 
      class="mobile-overlay"
      @click="toggleMobileMenu"
    ></div>

    <!-- Sidebar -->
    <aside 
      class="sidebar"
      :class="{ 
        'collapsed': !isSidebarOpen,
        'mobile-open': isMobileMenuOpen 
      }"
    >
      <!-- Logo -->
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-icon">🛒</span>
          <span v-if="isSidebarOpen" class="logo-text">DoroShop Admin</span>
        </div>
        <button class="close-mobile" @click="toggleMobileMenu">
          <XMarkIcon class="icon" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li 
            v-for="item in navigationItems" 
            :key="item.name"
            class="nav-item"
            :class="{ 'has-children': item.children }"
          >
            <!-- Main Nav Item -->
            <template v-if="item.children">
              <button 
                class="nav-link parent"
                :class="{ 'active': isActiveRoute(item.path) }"
                @click="toggleSubmenu(item.name)"
              >
                <component :is="item.icon" class="nav-icon" />
                <span v-if="isSidebarOpen" class="nav-text">{{ item.name }}</span>
                <span 
                  v-if="isSidebarOpen && getBadgeCount(item.badge || null) > 0" 
                  class="badge"
                >
                  {{ getBadgeCount(item.badge || null) }}
                </span>
                <svg 
                  v-if="isSidebarOpen"
                  class="chevron"
                  :class="{ 'rotated': expandedMenus.includes(item.name) }"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </button>
              <!-- Sub Items -->
              <ul 
                v-if="isSidebarOpen && expandedMenus.includes(item.name)"
                class="sub-nav"
              >
                <li v-for="child in item.children" :key="child.name">
                  <router-link 
                    :to="child.query ? { path: child.path, query: child.query } : child.path"
                    class="nav-link sub"
                    :class="{ 'active': isActiveRoute(child.path, true) }"
                  >
                    <span class="nav-text">{{ child.name }}</span>
                    <span 
                      v-if="child.badge && getBadgeCount(child.badge) > 0" 
                      class="badge"
                    >
                      {{ getBadgeCount(child.badge) }}
                    </span>
                  </router-link>
                </li>
              </ul>
            </template>
            <template v-else>
              <router-link 
                :to="item.query ? { path: item.path, query: item.query } : item.path"
                class="nav-link"
                :class="{ 'active': isActiveRoute(item.path, item.exact) }"
              >
                <component :is="item.icon" class="nav-icon" />
                <span v-if="isSidebarOpen" class="nav-text">{{ item.name }}</span>
                <span 
                  v-if="isSidebarOpen && item.badge && getBadgeCount(item.badge) > 0" 
                  class="badge"
                >
                  {{ getBadgeCount(item.badge) }}
                </span>
              </router-link>
            </template>
          </li>
        </ul>
      </nav>

      <!-- Sidebar Footer -->
      <div class="sidebar-footer">
        <button class="logout-btn" @click="handleLogout">
          <ArrowLeftOnRectangleIcon class="nav-icon" />
          <span v-if="isSidebarOpen">Logout</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="main-wrapper" :class="{ 'sidebar-collapsed': !isSidebarOpen }">
      <!-- Top Header -->
      <header class="top-header">
        <div class="header-left">
          <button class="toggle-sidebar" @click="toggleSidebar">
            <Bars3Icon class="icon" />
          </button>
          <button class="mobile-menu-btn" @click="toggleMobileMenu">
            <Bars3Icon class="icon" />
          </button>
          <div class="search-box">
            <MagnifyingGlassIcon class="search-icon" />
            <input type="text" placeholder="Search..." />
          </div>
        </div>
        <div class="header-right">
          <!-- Pending Actions Indicator -->
          <div v-if="pendingActionsCount > 0" class="pending-actions">
            <router-link to="/admin/products/pending" class="pending-link">
              <ExclamationTriangleIcon class="icon warning" />
              <span>{{ pendingActionsCount }} pending actions</span>
            </router-link>
          </div>
          
          <!-- Notifications -->
          <button class="notification-btn">
            <BellIcon class="icon" />
            <span v-if="pendingActionsCount > 0" class="notification-badge">{{ pendingActionsCount }}</span>
          </button>
          
          <!-- Admin Profile -->
          <div class="admin-profile">
            <div class="avatar">
              {{ authStore.user?.name?.charAt(0).toUpperCase() || 'A' }}
            </div>
            <div class="profile-info">
              <span class="name">{{ authStore.user?.name || 'Admin' }}</span>
              <span class="role">Administrator</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Page Content -->
      <main class="main-content">
        <router-view :key="$route.fullPath" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  height: 100dvh;
  min-height: 100dvh;

  background: var(--bg-primary);
}

/* Sidebar Styles */
.sidebar {
  width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border-primary);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  z-index: 1000;
}

.sidebar.collapsed {
  width: 80px;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  font-size: 1.75rem;
}

.logo-text {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.close-mobile {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
}

/* Navigation Styles */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  margin-bottom: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all 0.2s ease;
  border: none;
  background: none;
  width: 100%;
  cursor: pointer;
  font-size: 0.9rem;
}

.nav-link:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-link.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

.nav-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-primary);
}

.nav-link.parent {
  position: relative;
}

.nav-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

.nav-text {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.badge {
  background: var(--color-danger);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  min-width: 1.25rem;
  text-align: center;
}

.chevron {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s ease;
}

.chevron.rotated {
  transform: rotate(180deg);
}

/* Sub Navigation */
.sub-nav {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--bg-secondary);
}

.nav-link.sub {
  padding-left: 3.5rem;
  font-size: 0.85rem;
}

/* Sidebar Footer */
.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  width: 100%;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

/* Main Wrapper */
.main-wrapper {
  flex: 1;
  margin-left: 280px;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  min-height: 100dvh;
  transition: margin-left 0.3s ease;
}

.main-wrapper.sidebar-collapsed {
  margin-left: 80px;
}

/* Top Header */
.top-header {
  height: 70px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.toggle-sidebar,
.mobile-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.toggle-sidebar:hover,
.mobile-menu-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.mobile-menu-btn {
  display: none;
}

.icon {
  width: 1.5rem;
  height: 1.5rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box input {
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  width: 300px;
  transition: all 0.2s ease;
}

.search-box input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: var(--text-tertiary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.pending-actions {
  display: flex;
  align-items: center;
}

.pending-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--color-warning-light);
  color: var(--color-warning-text);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
}

.pending-link .icon.warning {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-warning);
}

.notification-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.notification-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.notification-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--color-danger);
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  min-width: 1rem;
  text-align: center;
}

.admin-profile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
}

.profile-info {
  display: flex;
  flex-direction: column;
}

.profile-info .name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-info .role {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Main Content */
.main-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

/* Mobile Overlay */
.mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* Responsive Styles */
@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
  }
  
  .sidebar.mobile-open {
    transform: translateX(0);
  }
  
  .main-wrapper {
    margin-left: 0;
  }
  
  .main-wrapper.sidebar-collapsed {
    margin-left: 0;
  }
  
  .toggle-sidebar {
    display: none;
  }
  
  .mobile-menu-btn {
    display: flex;
  }
  
  .close-mobile {
    display: flex;
  }
  
  .mobile-overlay {
    display: block;
  }
  
  .search-box input {
    width: 200px;
  }
}

@media (max-width: 768px) {
  .search-box {
    display: none;
  }
  
  .pending-actions {
    display: none;
  }
  
  .profile-info {
    display: none;
  }
  
  .top-header {
    padding: 0 1rem;
  }
  
  .main-content {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .header-right {
    gap: 0.75rem;
  }
}
</style>
