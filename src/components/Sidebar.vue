<script setup lang="js">
import { ref, defineEmits, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/authStores';
import { useUserStore } from '../stores/userStores';
import { useTheme } from '../composables/useTheme';
import { useOrderStore } from '../stores/OrderStores';
import {
  HomeIcon,
  ChatBubbleLeftIcon,
  WalletIcon,
  ClipboardDocumentListIcon,
  HeartIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ShoppingBagIcon,
  BellIcon,
  StarIcon,
  BuildingStorefrontIcon
} from '@heroicons/vue/24/outline';

const emit = defineEmits(['handleClick'])
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const userStore = useUserStore();
const orderStore = useOrderStore();
const { isDark } = useTheme();

// User info computed
const userName = computed(() => {
  return authStore.user?.name || userStore.user?.firstName || 'User';
});

const userEmail = computed(() => {
  return authStore.user?.email || '';
});

const userAvatar = computed(() => {
  return authStore.user?.imageUrl || null;
});

// Stats
const totalOrders = computed(() => orderStore.orders?.length || 0);
const pendingOrders = computed(() => {
  return orderStore.orders?.filter(o => 
    o.status === 'pending' || o.status === 'processing' || o.status === 'shipped'
  ).length || 0;
});

const handleCl = () => {
  emit('handleClick')
  activeTab.value = "wallet"
}

// Compute active tab based on current route
const activeTab = computed(() => {
  if (route.path === '/orders') return 'orders';
  if (route.path === '/messages') return 'messages';
  if (route.path === '/user/me') return 'dashboard';
  if (route.path.includes('/user')) return 'dashboard';
  return 'dashboard';
});

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, route: '/user/me' },
  { id: 'orders', label: 'My Orders', icon: ClipboardDocumentListIcon, route: '/orders', badge: pendingOrders },
  { id: 'messages', label: 'Messages', icon: ChatBubbleLeftIcon, route: '/messages' },
  { id: 'wallet', label: 'Wallet', icon: WalletIcon, action: 'wallet' },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, route: '/user/me' },
];

const navigateTo = (item) => {
  if (item.action === 'wallet') {
    handleCl();
  } else if (item.route) {
    router.push(item.route);
  }
};

const isLoggingOut = ref(false);
const showLogoutModal = ref(false);

const showLogoutConfirmation = () => {
  showLogoutModal.value = true;
};

const cancelLogout = () => {
  showLogoutModal.value = false;
};

// Handle escape key to close modal
const handleKeyDown = (event) => {
  if (event.key === 'Escape' && showLogoutModal.value) {
    cancelLogout();
  }
};

// Add/remove event listener for escape key
onMounted(async() => {
  document.addEventListener('keydown', handleKeyDown);
  await orderStore.fetchOrders();
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});

// Function to clear specific cookie
const clearCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
  
  const hostParts = window.location.hostname.split('.');
  if (hostParts.length > 1) {
    const rootDomain = hostParts.slice(-2).join('.');
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
  }
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;secure;samesite=strict`;
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname};secure;samesite=strict`;
};

// Function to clear all cookies
const clearAllCookies = () => {
  const authCookies = [
    'token', 'auth-token', 'authToken', 'access_token', 'accessToken',
    'jwt', 'JWT', 'session', 'sessionId', 'session_id',
    'connect.sid', 'PHPSESSID', 'JSESSIONID', 'ASP.NET_SessionId',
    'refresh_token', 'refreshToken', 'user', 'userId', 'user_id'
  ];
  
  authCookies.forEach(cookieName => {
    clearCookie(cookieName);
  });
  
  const cookies = document.cookie.split(";");
  
  cookies.forEach(cookie => {
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    
    if (name) {
      clearCookie(name);
    }
  });
  
  console.log('All cookies cleared including:', authCookies.join(', '));
};

const confirmLogout = async () => {
  showLogoutModal.value = false;

  try {
    isLoggingOut.value = true;
    console.log('🚀 Starting logout process...');
    
    await authStore.logout();
    
    const logoutSuccess = await authStore.verifyLogout();
    console.log('✅ Logout verification:', logoutSuccess ? 'SUCCESS' : 'FAILED');
    
    localStorage.clear();
    sessionStorage.clear();
    clearAllCookies();
    
    authStore.authChecked = true;
    
    await router.push('/login');
    
  } catch (error) {
    console.error('❌ Logout failed:', error);
    
    authStore.token = null;
    authStore.isAuthenticated = false;
    authStore.userId = '';
    authStore.userRole = '';
    authStore.user = null;
    authStore.authChecked = true;
    authStore.loading = false;
    authStore.error = null;
    authStore._sessionPromise = null;
    authStore.loginError = null;
    authStore.registerError = null;
    authStore.verifyError = null;
    
    localStorage.clear();
    sessionStorage.clear();
    clearAllCookies();
    
    await router.push('/login');
  } finally {
    isLoggingOut.value = false;
    showLogoutModal.value = false;
  }
};
</script>

<template>
  <aside class="account-sidebar">
    <!-- User Profile Section -->
    <div class="user-profile">
      <div class="avatar-container">
        <img v-if="userAvatar" :src="userAvatar" alt="Profile" class="user-avatar" />
        <div v-else class="avatar-placeholder">
          <UserCircleIcon class="placeholder-icon" />
        </div>
      </div>
      <div class="user-info">
        <h3 class="user-name" :title="userName">{{ userName }}</h3>
        <p class="user-email" :title="userEmail">{{ userEmail }}</p>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="quick-stats">
      <div class="stat-item">
        <span class="stat-value">{{ totalOrders }}</span>
        <span class="stat-label">Orders</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ pendingOrders }}</span>
        <span class="stat-label">Pending</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button 
        v-for="item in navItems"
        :key="item.id"
        class="sidebar-link" 
        :class="{ active: activeTab === item.id }" 
        @click="navigateTo(item)"
      >
        <component :is="item.icon" class="sidebar-icon" />
        <span class="link-text">{{ item.label }}</span>
        <span v-if="item.badge && item.badge.value > 0" class="nav-badge">
          {{ item.badge.value }}
        </span>
      </button>

      <div class="nav-divider"></div>

      <button class="sidebar-link logout" @click="showLogoutConfirmation" :disabled="isLoggingOut">
        <ArrowRightOnRectangleIcon v-if="!isLoggingOut" class="sidebar-icon" />
        <div v-else class="loading-spinner"></div>
        <span class="link-text">{{ isLoggingOut ? 'Logging out...' : 'Logout' }}</span>
      </button>
    </nav>

    <!-- Become a Seller CTA -->
    <div class="seller-cta" v-if="authStore.userRole !== 'seller'">
      <BuildingStorefrontIcon class="cta-icon" />
      <div class="cta-content">
        <span class="cta-title">Start Selling</span>
        <span class="cta-subtitle">Earn money on DoroShop</span>
      </div>
    </div>

    <!-- Logout Confirmation Modal -->
    <div v-if="showLogoutModal" class="modal-overlay" @click="cancelLogout">
      <div class="logout-modal" @click.stop>
        <div class="modal-header">
          <div class="modal-icon">
            <ArrowRightOnRectangleIcon class="logout-icon" />
          </div>
          <h3 class="modal-title">Confirm Logout</h3>
          <p class="modal-message">Are you sure you want to logout? You'll need to sign in again to access your account.</p>
        </div>
        
        <div class="modal-actions">
          <button @click="cancelLogout" class="btn-cancel">
            Cancel
          </button>
          <button @click="confirmLogout" class="btn-confirm" :disabled="isLoggingOut">
            <span v-if="!isLoggingOut">Logout</span>
            <span v-else class="logout-loading">
              <div class="mini-spinner"></div>
              Logging out...
            </span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.account-sidebar {
  width: 100%;
  max-width: 18rem;
  min-width: 18rem;
  background-color: var(--surface);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 10;
  border: 1px solid var(--border-color);
  transition: all 0.3s ease;
}

/* User Profile Section */
.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.1) 0%, rgba(255, 102, 0, 0.05) 100%);
  border-radius: 12px;
  margin-bottom: 8px;
}

.avatar-container {
  flex-shrink: 0;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #1f8b4e;
}

.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  width: 28px;
  height: 28px;
  color: white;
}

.user-info {
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  max-width: 14ch;
  margin: 0 0 2px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Quick Stats */
.quick-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 800;
  color: #1f8b4e;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border-color);
}

/* Navigation */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  background-color: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  position: relative;
}

.sidebar-link:hover {
  background-color: var(--surface-hover);
  transform: translateX(4px);
}

.sidebar-link.active {
  background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
}

.sidebar-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 0 4px 4px 0;
}

.sidebar-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.link-text {
  flex: 1;
}

.nav-badge {
  background: #ff6600;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  min-width: 20px;
  text-align: center;
}

.sidebar-link.active .nav-badge {
  background: rgba(255, 255, 255, 0.25);
}

.nav-divider {
  height: 1px;
  background: var(--border-color);
  margin: 8px 0;
}

.sidebar-link.logout {
  margin-top: auto;
  color: #dc2626;
}

.sidebar-link.logout:hover:not(:disabled) {
  background-color: rgba(220, 38, 38, 0.1);
}

.sidebar-link.logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

/* Seller CTA */
.seller-cta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: linear-gradient(135deg, rgba(255, 102, 0, 0.1) 0%, rgba(255, 102, 0, 0.05) 100%);
  border: 1px dashed rgba(255, 102, 0, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: auto;
}

.seller-cta:hover {
  background: linear-gradient(135deg, rgba(255, 102, 0, 0.15) 0%, rgba(255, 102, 0, 0.1) 100%);
  border-color: #ff6600;
  transform: translateY(-2px);
}

.cta-icon {
  width: 24px;
  height: 24px;
  color: #ff6600;
  flex-shrink: 0;
}

.cta-content {
  display: flex;
  flex-direction: column;
}

.cta-title {
  font-size: 14px;
  font-weight: 600;
  color: #ff6600;
}

.cta-subtitle {
  font-size: 11px;
  color: var(--text-secondary);
}

/* Loading Spinner */
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid #dc2626;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Logout Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.logout-modal {
  background: var(--surface);
  border-radius: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 90%;
  padding: 24px;
  animation: scaleIn 0.2s ease;
  position: relative;
  border: 1px solid var(--border-color);
}

@keyframes scaleIn {
  from { 
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  text-align: center;
  margin-bottom: 24px;
}

.modal-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: rgba(220, 38, 38, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-icon {
  width: 32px;
  height: 32px;
  color: #dc2626;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.modal-message {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel,
.btn-confirm {
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-cancel:hover {
  background: var(--surface-hover);
}

.btn-confirm {
  background: #dc2626;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.btn-confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.logout-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Responsive */
@media (max-width: 820px) {
  .account-sidebar {
    top: 4.2rem;
  }
}

@media (max-width: 540px) {
  .account-sidebar {
    display: none;
  }
  
  .modal-actions {
    flex-direction: column;
  }
  
  .btn-cancel,
  .btn-confirm {
    width: 100%;
  }
}

/* Focus states for accessibility */
.sidebar-link:focus-visible,
.btn-cancel:focus-visible,
.btn-confirm:focus-visible {
  outline: 3px solid #1f8b4e;
  outline-offset: 2px;
}
</style>
