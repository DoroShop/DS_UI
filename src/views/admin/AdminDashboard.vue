<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { useAuthStore } from '../../stores/authStores';
import {
  UsersIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentCheckIcon,
  CalendarDaysIcon,
  ChartBarIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();
const authStore = useAuthStore();

const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref('');
const selectedPeriod = ref<'daily' | 'weekly' | 'monthly'>('weekly');

// Computed stats from store - handles both nested and flat data structures
const stats = computed(() => adminStore.dashboardStats);

// Debug log to help troubleshoot
const debugStats = () => {
  console.log('Dashboard Stats:', stats.value);
  console.log('Users:', stats.value?.users);
  console.log('Products:', stats.value?.products);
  console.log('Orders:', stats.value?.orders);
};

const quickStats = computed(() => {
  const data = stats.value;
  if (!data) return [];
  
  // Handle multiple data structure formats from backend
  const totalUsers = data.users?.total ?? data.totalUsers ?? 0;
  const activeSellers = data.users?.sellers ?? data.activeSellers ?? 0;
  const totalProducts = data.products?.total ?? data.totalProducts ?? 0;
  const totalOrders = data.orders?.total ?? data.totalOrders ?? 0;
  
  // Calculate trends based on period comparison
  const ordersTrend = data.orders?.thisWeek && data.orders?.total 
    ? Math.round((data.orders.thisWeek / Math.max(data.orders.total, 1)) * 100) 
    : 0;
  
  return [
    {
      title: 'Total Users',
      value: totalUsers,
      icon: UsersIcon,
      color: 'blue',
      trend: `${totalUsers > 0 ? '+' : ''}${totalUsers}`,
      trendUp: true,
      subtitle: 'Registered buyers'
    },
    {
      title: 'Active Sellers',
      value: activeSellers,
      icon: BuildingStorefrontIcon,
      color: 'green',
      trend: `${activeSellers} vendors`,
      trendUp: true,
      subtitle: 'Verified merchants'
    },
    {
      title: 'Total Products',
      value: totalProducts,
      icon: CubeIcon,
      color: 'purple',
      trend: `${data.products?.pendingApproval || 0} pending`,
      trendUp: true,
      subtitle: 'Listed items'
    },
    {
      title: 'Total Orders',
      value: totalOrders,
      icon: ShoppingCartIcon,
      color: 'orange',
      trend: `${data.orders?.thisWeek || 0} this week`,
      trendUp: (data.orders?.thisWeek || 0) > 0,
      subtitle: `${data.orders?.completed || 0} completed`
    },
  ];
});

const revenueStats = computed(() => {
  const data = stats.value;
  if (!data?.revenue) return null;
  
  return {
    totalRevenue: data.revenue.total ?? data.revenue.totalRevenue ?? 0,
    todayRevenue: data.revenue.today ?? 0,
    weekRevenue: data.revenue.thisWeek ?? 0,
    monthRevenue: data.revenue.thisMonth ?? 0,
    totalCommission: data.revenue.platformCommission ?? data.revenue.totalCommission ?? 0,
    pendingCommission: data.revenue.pendingCommission ?? 0,
  };
});

const pendingActions = computed(() => {
  const data = stats.value;
  if (!data?.pendingActions) return [];
  
  return [
    {
      title: 'Seller Applications',
      count: data.pendingActions.sellerApplications ?? 0,
      icon: BuildingStorefrontIcon,
      link: '/admin/sellers?tab=applications',
      color: 'blue',
      description: 'Awaiting approval'
    },
    {
      title: 'Product Approvals',
      count: data.pendingActions.productApprovals ?? data.products?.pendingApproval ?? 0,
      icon: CubeIcon,
      link: '/admin/products?status=pending',
      color: 'purple',
      description: 'Ready for review'
    },
    {
      title: 'Pending Refunds',
      count: data.pendingActions.refunds ?? 0,
      icon: CurrencyDollarIcon,
      link: '/admin/refunds',
      color: 'orange',
      description: 'Requires processing'
    },
  ];
});

// Order statistics for quick overview
const orderStats = computed(() => {
  const data = stats.value?.orders;
  if (!data) return null;
  
  return {
    today: data.today ?? 0,
    thisWeek: data.thisWeek ?? 0,
    thisMonth: data.thisMonth ?? 0,
    completed: data.completed ?? 0
  };
});

const recentOrders = computed(() => stats.value?.recentOrders || []);
const recentUsers = computed(() => stats.value?.recentUsers || []);

// Format currency - Philippine Peso
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Format compact numbers for large values
const formatCompact = (num: number) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat().format(num);
};

// Format number with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num ?? 0);
};

// Format date
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Get status color
const getOrderStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
    refunded: 'danger',
  };
  return colors[status?.toLowerCase()] || 'default';
};

// Fetch data with error handling
const fetchDashboardData = async () => {
  isLoading.value = true;
  hasError.value = false;
  errorMessage.value = '';
  
  try {
    // Ensure auth session is loaded first
    if (!authStore.authChecked) {
      await authStore.fetchSession();
    }
    
    // Only fetch if authenticated
    if (authStore.isAuthenticated && authStore.token) {
      await adminStore.fetchDashboardStats();
      
      // Debug log
      if (import.meta.env.DEV) {
        debugStats();
      }
    } else {
      hasError.value = true;
      errorMessage.value = 'Authentication required. Please log in.';
    }
  } catch (error: any) {
    console.error('Failed to fetch dashboard data:', error);
    hasError.value = true;
    errorMessage.value = error.response?.data?.message || error.message || 'Failed to load dashboard data';
  } finally {
    isLoading.value = false;
  }
};

// Refresh data
const refreshData = () => {
  fetchDashboardData();
};

// Handle period change
watch(selectedPeriod, async () => {
  await fetchDashboardData();
});

onMounted(() => {
  fetchDashboardData();
});
</script>

<template>
  <div class="admin-dashboard">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Dashboard Overview</h1>
        <p class="page-subtitle">Welcome back! Here's what's happening with your platform today.</p>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="refreshData" :disabled="isLoading">
          <ArrowTrendingUpIcon class="refresh-icon" :class="{ spinning: isLoading }" />
          Refresh
        </button>
        <select v-model="selectedPeriod" class="period-select">
          <option value="daily">Today</option>
          <option value="weekly">This Week</option>
          <option value="monthly">This Month</option>
        </select>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="hasError" class="error-container">
      <ExclamationTriangleIcon class="error-icon" />
      <h3>Unable to Load Dashboard</h3>
      <p>{{ errorMessage }}</p>
      <button class="retry-btn" @click="refreshData">Try Again</button>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading dashboard data...</p>
    </div>

    <template v-else>
      <!-- Quick Stats Cards -->
      <div class="stats-grid">
        <div 
          v-for="stat in quickStats" 
          :key="stat.title"
          class="stat-card"
          :class="`stat-${stat.color}`"
        >
          <div class="stat-icon">
            <component :is="stat.icon" />
          </div>
          <div class="stat-content">
            <h3 class="stat-title">{{ stat.title }}</h3>
            <p class="stat-value">{{ formatNumber(stat.value) }}</p>
            <div class="stat-meta">
              <span class="stat-subtitle">{{ stat.subtitle }}</span>
              <span class="stat-trend" :class="{ 'up': stat.trendUp, 'down': !stat.trendUp }">
                {{ stat.trend }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Timeline Stats -->
      <div v-if="orderStats" class="order-timeline">
        <div class="section-header">
          <h2><CalendarDaysIcon class="section-icon" /> Order Activity</h2>
          <p>Orders across different time periods</p>
        </div>
        <div class="timeline-cards">
          <div class="timeline-card today">
            <div class="timeline-value">{{ formatNumber(orderStats.today) }}</div>
            <div class="timeline-label">Today</div>
          </div>
          <div class="timeline-divider"></div>
          <div class="timeline-card week">
            <div class="timeline-value">{{ formatNumber(orderStats.thisWeek) }}</div>
            <div class="timeline-label">This Week</div>
          </div>
          <div class="timeline-divider"></div>
          <div class="timeline-card month">
            <div class="timeline-value">{{ formatNumber(orderStats.thisMonth) }}</div>
            <div class="timeline-label">This Month</div>
          </div>
          <div class="timeline-divider"></div>
          <div class="timeline-card completed">
            <div class="timeline-value">{{ formatNumber(orderStats.completed) }}</div>
            <div class="timeline-label">Completed</div>
          </div>
        </div>
      </div>

      <!-- Revenue Section -->
      <div class="revenue-section" v-if="revenueStats">
        <div class="section-header">
          <h2><CurrencyDollarIcon class="section-icon" /> Revenue & Commission</h2>
          <p>Platform earnings overview</p>
        </div>
        <div class="revenue-cards">
          <div class="revenue-card total">
            <div class="revenue-icon">
              <CurrencyDollarIcon />
            </div>
            <div class="revenue-content">
              <h4>Total Revenue</h4>
              <p class="revenue-value">{{ formatCurrency(revenueStats.totalRevenue) }}</p>
              <span class="revenue-label">Platform-wide sales</span>
            </div>
          </div>
          <div class="revenue-card commission">
            <div class="revenue-icon">
              <CheckCircleIcon />
            </div>
            <div class="revenue-content">
              <h4>Platform Commission (7%)</h4>
              <p class="revenue-value">{{ formatCurrency(revenueStats.totalCommission) }}</p>
              <span class="revenue-label">Earned from completed orders</span>
            </div>
          </div>
          <div class="revenue-card pending">
            <div class="revenue-icon">
              <ClockIcon />
            </div>
            <div class="revenue-content">
              <h4>Pending Commission</h4>
              <p class="revenue-value">{{ formatCurrency(revenueStats.pendingCommission) }}</p>
              <span class="revenue-label">From ongoing orders</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Actions Section -->
      <div class="pending-section">
        <div class="section-header">
          <h2><ExclamationTriangleIcon class="section-icon" /> Pending Actions</h2>
          <p>Items requiring your attention</p>
        </div>
        <div class="pending-grid">
          <router-link 
            v-for="action in pendingActions"
            :key="action.title"
            :to="action.link"
            class="pending-card"
            :class="`pending-${action.color}`"
          >
            <div class="pending-icon">
              <component :is="action.icon" />
            </div>
            <div class="pending-content">
              <h4>{{ action.title }}</h4>
              <p class="pending-count">{{ action.count }}</p>
              <span v-if="action.count > 0" class="pending-status">
                <ExclamationTriangleIcon class="warning-icon" />
                {{ action.description }}
              </span>
              <span v-else class="pending-clear">
                <CheckCircleIcon class="check-icon" />
                All clear
              </span>
            </div>
          </router-link>
        </div>
      </div>

      <!-- Recent Activity Grid -->
      <div class="activity-grid">
        <!-- Recent Orders -->
        <div class="activity-card">
          <div class="card-header">
            <h3>Recent Orders</h3>
            <router-link to="/admin/orders" class="view-all">View all</router-link>
          </div>
          <div class="card-content">
            <div v-if="recentOrders.length === 0" class="empty-state">
              <ShoppingCartIcon class="empty-icon" />
              <p>No recent orders</p>
            </div>
            <ul v-else class="orders-list">
              <li v-for="order in recentOrders" :key="order._id" class="order-item">
                <div class="order-info">
                  <span class="order-id">#{{ order.orderId || order._id?.slice(-8) }}</span>
                  <span class="order-customer">{{ order.user?.name || 'Unknown Customer' }}</span>
                </div>
                <div class="order-details">
                  <span class="order-amount">{{ formatCurrency(order.totalAmount || 0) }}</span>
                  <span :class="`status-badge ${getOrderStatusColor(order.status)}`">
                    {{ order.status }}
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Recent Users -->
        <div class="activity-card">
          <div class="card-header">
            <h3>New Users</h3>
            <router-link to="/admin/users" class="view-all">View all</router-link>
          </div>
          <div class="card-content">
            <div v-if="recentUsers.length === 0" class="empty-state">
              <UsersIcon class="empty-icon" />
              <p>No recent users</p>
            </div>
            <ul v-else class="users-list">
              <li v-for="user in recentUsers" :key="user._id" class="user-item">
                <div class="user-avatar">
                  {{ user.name?.charAt(0).toUpperCase() || '?' }}
                </div>
                <div class="user-info">
                  <span class="user-name">{{ user.name || 'Unknown' }}</span>
                  <span class="user-email">{{ user.email || 'No email' }}</span>
                </div>
                <div class="user-meta">
                  <span class="user-role" :class="`role-${user.role}`">{{ user.role }}</span>
                  <span class="user-date">{{ formatDate(user.createdAt) }}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <h3>Quick Actions</h3>
        <div class="actions-grid">
          <router-link to="/admin/products/pending" class="action-btn">
            <DocumentCheckIcon class="action-icon" />
            <span>Review Products</span>
          </router-link>
          <router-link to="/admin/sellers/applications" class="action-btn">
            <BuildingStorefrontIcon class="action-icon" />
            <span>Review Applications</span>
          </router-link>
          <router-link to="/admin/refunds" class="action-btn">
            <CurrencyDollarIcon class="action-icon" />
            <span>Process Refunds</span>
          </router-link>
          <router-link to="/admin/commission" class="action-btn">
            <ChartBarIcon class="action-icon" />
            <span>View Reports</span>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.page-subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.refresh-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-icon {
  width: 1rem;
  height: 1rem;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

.period-select {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
}

.period-select:focus {
  border-color: var(--primary-color);
}

/* Error State */
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  text-align: center;
}

.error-icon {
  width: 4rem;
  height: 4rem;
  color: #dc2626;
  margin-bottom: 1rem;
}

.error-container h3 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.error-container p {
  color: var(--text-secondary);
  margin: 0 0 1.5rem;
}

.retry-btn {
  padding: 0.75rem 2rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: #166b3e;
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.stat-blue .stat-icon { background: #e0f2fe; color: #0284c7; }
.stat-green .stat-icon { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #1f8b4e; }
.stat-purple .stat-icon { background: #f3e8ff; color: #9333ea; }
.stat-orange .stat-icon { background: #ffedd5; color: #ea580c; }

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-title {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  line-height: 1.2;
}

.stat-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.stat-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.stat-trend {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.stat-trend.up { 
  background: #dcfce7; 
  color: #16a34a; 
}

.stat-trend.down { 
  background: #fee2e2; 
  color: #dc2626; 
}

/* Order Timeline */
.order-timeline {
  margin-bottom: 2rem;
}

.timeline-cards {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 1.5rem;
  overflow-x: auto;
}

.timeline-card {
  flex: 1;
  text-align: center;
  padding: 0.5rem 1rem;
}

.timeline-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.timeline-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.timeline-card.today .timeline-value { color: var(--primary-color); }
.timeline-card.week .timeline-value { color: #0284c7; }
.timeline-card.month .timeline-value { color: #9333ea; }
.timeline-card.completed .timeline-value { color: #16a34a; }

.timeline-divider {
  width: 1px;
  height: 3rem;
  background: var(--border-color);
  flex-shrink: 0;
}

/* Section Headers */
.section-header {
  margin-bottom: 1rem;
}

.section-header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.section-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--primary-color);
}

.section-header p {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin: 0;
}

/* Revenue Section */
.revenue-section {
  margin-bottom: 2rem;
}

.revenue-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.revenue-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  border: 1px solid var(--border-color);
}

.revenue-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.revenue-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.revenue-card.total .revenue-icon { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #1f8b4e; }
.revenue-card.commission .revenue-icon { background: #e0f2fe; color: #0284c7; }
.revenue-card.pending .revenue-icon { background: #fef3c7; color: #d97706; }

.revenue-content {
  flex: 1;
}

.revenue-content h4 {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 0.35rem;
  font-weight: 500;
}

.revenue-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.2rem;
}

.revenue-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Pending Section */
.pending-section {
  margin-bottom: 2rem;
}

.pending-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}

.pending-card {
  background: var(--surface);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  border: 1px solid var(--border-color);
  text-decoration: none;
  transition: all 0.2s ease;
}

.pending-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.08);
  border-color: rgba(31, 139, 78, 0.3);
}

.pending-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pending-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.pending-blue .pending-icon { background: #e0f2fe; color: #0284c7; }
.pending-purple .pending-icon { background: #f3e8ff; color: #9333ea; }
.pending-orange .pending-icon { background: #ffedd5; color: #ea580c; }

.pending-content {
  flex: 1;
}

.pending-content h4 {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 0.35rem;
  font-weight: 500;
}

.pending-count {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.35rem;
}

.pending-status,
.pending-clear {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.pending-status {
  color: #d97706;
}

.pending-clear {
  color: #16a34a;
}

.warning-icon,
.check-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* Activity Grid */
.activity-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.activity-card {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
}

.card-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.view-all {
  font-size: 0.8rem;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.view-all:hover {
  text-decoration: underline;
}

.card-content {
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

/* Orders List */
.orders-list,
.users-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.order-item:hover {
  background: var(--surface-hover);
}

.order-item:last-child {
  border-bottom: none;
}

.order-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.order-id {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.order-customer {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.order-details {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.order-amount {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.status-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-badge.warning { background: #fef3c7; color: #d97706; }
.status-badge.info { background: #e0f2fe; color: #0284c7; }
.status-badge.primary { background: #e0e7ff; color: #4f46e5; }
.status-badge.success { background: #dcfce7; color: #16a34a; }
.status-badge.danger { background: #fee2e2; color: #dc2626; }
.status-badge.default { background: var(--surface-hover); color: var(--text-secondary); }

/* Users List */
.user-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  transition: background 0.15s;
}

.user-item:hover {
  background: var(--surface-hover);
}

.user-item:last-child {
  border-bottom: none;
}

.user-avatar {
  width: 2.25rem;
  height: 2.25rem;
  background: linear-gradient(135deg, var(--primary-color), #16a34a);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.user-name {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  flex-shrink: 0;
}

.user-role {
  padding: 0.1rem 0.5rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.role-user { background: #e0f2fe; color: #0284c7; }
.role-vendor { background: #f3e8ff; color: #9333ea; }
.role-admin { background: #fee2e2; color: #dc2626; }
.role-rider { background: #dcfce7; color: #16a34a; }

.user-date {
  font-size: 0.7rem;
  color: var(--text-tertiary);
}

/* Quick Actions */
.quick-actions {
  background: var(--surface);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid var(--border-color);
}

.quick-actions h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.875rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.action-btn:hover {
  background: rgba(31, 139, 78, 0.08);
  color: var(--primary-color);
  border-color: rgba(31, 139, 78, 0.2);
}

.action-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.action-btn span {
  font-size: 0.8rem;
  font-weight: 500;
  text-align: center;
}

/* Responsive */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .revenue-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .revenue-cards .revenue-card:last-child {
    grid-column: span 2;
  }
  
  .pending-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .pending-grid .pending-card:last-child {
    grid-column: span 2;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .timeline-cards {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .timeline-divider {
    display: none;
  }

  .timeline-card {
    flex: 1 1 calc(50% - 0.5rem);
    min-width: 120px;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .revenue-cards {
    grid-template-columns: 1fr;
  }
  
  .revenue-cards .revenue-card:last-child {
    grid-column: auto;
  }
  
  .pending-grid {
    grid-template-columns: 1fr;
  }
  
  .pending-grid .pending-card:last-child {
    grid-column: auto;
  }
  
  .activity-grid {
    grid-template-columns: 1fr;
  }
  
  .actions-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .timeline-card {
    flex: 1 1 calc(50% - 0.5rem);
  }
}

@media (max-width: 480px) {
  .stat-value {
    font-size: 1.5rem;
  }

  .timeline-value {
    font-size: 1.35rem;
  }

  .revenue-value {
    font-size: 1.15rem;
  }

  .pending-count {
    font-size: 1.5rem;
  }
}
</style>
