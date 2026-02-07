<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import { Toast } from '../../components/composable/Toast.js';
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  BuildingStorefrontIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const selectedPeriod = ref<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);

// Data from store
const commissionReport = computed(() => adminStore.commissionReport);
const escrowSummary = computed(() => adminStore.escrowSummary);
const pendingReleases = computed(() => adminStore.pendingReleases);
const revenueData = ref<any[]>([]);
const topSellers = ref<any[]>([]);
const recentTransactions = ref<any[]>([]);
const payoutsLoading = ref(false);




// Commission breakdown data
const commissionBreakdown = computed(() => {
  const collected = commissionReport.value?.summary?.totalCommission || 0;
  const pending = (commissionReport.value?.summary?.totalRevenue || 0) * 0.07 - collected;
  const refunded = 0; // Calculate from refunds if available
  const total = collected + pending + refunded;

  return {
    collected: { amount: collected, percent: total > 0 ? (collected / total) * 100 : 0 },
    pending: { amount: Math.max(0, pending), percent: total > 0 ? (Math.max(0, pending) / total) * 100 : 0 },
    refunded: { amount: refunded, percent: total > 0 ? (refunded / total) * 100 : 0 }
  };
});

// Fetch data
const fetchCommissionReport = async () => {
  isLoading.value = true;
  try {
    // Fetch commission report
    await adminStore.fetchCommissionReport({
      period: selectedPeriod.value,
      year: selectedYear.value,
      month: selectedMonth.value,
    });

    await adminStore.fetchEscrowSummary();
    await adminStore.fetchPendingReleases({ limit: 10 });

    // Fetch sales chart data for revenue visualization
    await fetchSalesChartData();

    // Fetch top sellers data
    await fetchTopSellers();

    setTimeout(() => {
      console.log('Commission Report:', topSellers.value);
    }, 5); // Refresh every 5 minutes

    // Fetch recent transactions
    await fetchRecentTransactions();
  } catch (error) {
    console.error('Failed to fetch commission report:', error);
  } finally {
    isLoading.value = false;
  }
};

// Fetch real sales chart data
const fetchSalesChartData = async () => {
  try {
    const chartData = await adminStore.fetchSalesChart('monthly', selectedYear.value);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Transform chart data to expected format
    if (chartData && chartData.length > 0) {
      revenueData.value = months.map((month, index) => {
        const monthData = chartData.find((d: any) => d._id === index + 1);
        const revenue = monthData?.revenue || 0;
        return {
          month,
          revenue,
          commission: revenue * 0.07,
          orders: monthData?.count || 0,
        };
      });
    } else {
      // Initialize with empty data if no chart data
      revenueData.value = months.map(month => ({
        month,
        revenue: 0,
        commission: 0,
        orders: 0,
      }));
    }
  } catch (error) {
    console.error('Failed to fetch sales chart data:', error);
    // Initialize with empty data on error
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    revenueData.value = months.map(month => ({
      month,
      revenue: 0,
      commission: 0,
      orders: 0,
    }));
  }
};

// Fetch real top sellers data - sorted by revenue descending
const fetchTopSellers = async () => {
  try {
    const sellers = await adminStore.fetchTopSellers(5);
    // Sort by revenue descending
    topSellers.value = sellers
      .map((s: any) => ({
        name: s.vendor?.shopName || s.vendor?.userId?.name || 'Unknown',
        revenue: s.vendor?.totalRevenue|| 0,
        commission: (s.vendor?.totalRevenue || 0) * 0.07,
        orders: s.vendor?.totalOrders || 0,
      }))
      .sort((a: any, b: any) => b.revenue - a.revenue);

  } catch (error) {
    console.error('Failed to fetch top sellers:', error);
    topSellers.value = [];
  }
};

// Fetch recent transactions (delivered orders)
const fetchRecentTransactions = async () => {
  try {
    const response = await adminStore.fetchOrders({
      status: 'delivered',
      limit: 5,
      page: 1
    });
    recentTransactions.value = response.orders || [];
  } catch (error) {
    console.error('Failed to fetch recent transactions:', error);
    recentTransactions.value = [];
  }
};

const releasePayout = async (orderId: string) => {
  payoutsLoading.value = true;
  try {
    await adminStore.releasePayout(orderId, 'Released via dashboard');
    await Promise.all([adminStore.fetchEscrowSummary(), adminStore.fetchPendingReleases({ limit: 10 })]);
  } catch (error) {
    console.error('Failed to release payout:', error);
  } finally {
    payoutsLoading.value = false;
  }
};

const holdPayout = async (orderId: string) => {
  const reason = prompt('Add a hold reason');
  if (!reason) return;
  payoutsLoading.value = true;
  try {
    await adminStore.holdPayout(orderId, reason);
    await Promise.all([adminStore.fetchEscrowSummary(), adminStore.fetchPendingReleases({ limit: 10 })]);
  } catch (error) {
    console.error('Failed to hold payout:', error);
  } finally {
    payoutsLoading.value = false;
  }
};

// Format currency - Philippine Peso
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// Format number
const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num || 0);
};

// Format date
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Get bar height for chart
const getBarHeight = (value: number, max: number) => {
  if (!max || max === 0) return '0%';
  return `${(value / max) * 100}%`;
};

// Get max value for chart
const maxRevenue = computed(() => {
  if (!revenueData.value || revenueData.value.length === 0) return 1;
  const max = Math.max(...revenueData.value.map((d: any) => d.revenue || 0));
  return max > 0 ? max : 1;
});

// Period options
const periodOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

// Year options
const yearOptions = computed(() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => currentYear - i);
});

// Month options
const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// Export report
const exportReport = async (format: 'csv' | 'excel') => {
  try {
    const data = await adminStore.exportData('commission', {
      year: selectedYear.value,
      month: selectedMonth.value,
    });

    // Convert to CSV or Excel format
    if (format === 'csv' && data) {
      const csvContent = convertToCSV(data);
      downloadFile(csvContent, `commission-report-${selectedYear.value}-${selectedMonth.value}.csv`, 'text/csv');
    } else {
      Toast(`Export as ${format.toUpperCase()} is not yet implemented.`, 'error');
    }
  } catch (error) {
    console.error('Failed to export report:', error);
    Toast('Failed to export report. Please try again.', 'error');
  }
};

// Helper: Convert data to CSV
const convertToCSV = (data: any[]) => {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  return [headers, ...rows].join('\n');
};

// Helper: Download file
const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

watch([selectedPeriod, selectedYear, selectedMonth], () => {
  fetchCommissionReport();
});

onMounted(() => {
  fetchCommissionReport();
});
</script>

<template>
  <div class="commission-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Commission & Revenue</h1>
        <p class="page-subtitle">Track platform revenue and commission earnings</p>
      </div>
      <div class="header-actions">
        <button class="export-btn" @click="exportReport('csv')">
          <ArrowDownTrayIcon class="btn-icon" />
          Export CSV
        </button>
        <button class="export-btn primary" @click="exportReport('excel')">
          <ArrowDownTrayIcon class="btn-icon" />
          Export Excel
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <CalendarIcon class="filter-icon" />
        <select v-model="selectedPeriod" class="filter-select">
          <option v-for="option in periodOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <select v-model="selectedYear" class="filter-select">
          <option v-for="year in yearOptions" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>

      <div v-if="selectedPeriod !== 'yearly'" class="filter-group">
        <select v-model="selectedMonth" class="filter-select">
          <option v-for="month in monthOptions" :key="month.value" :value="month.value">
            {{ month.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading commission data...</p>
    </div>

    <template v-else>
      <!-- Overview Cards -->
      <div class="overview-cards">
        <div class="overview-card revenue">
          <div class="card-icon">
            <CurrencyDollarIcon />
          </div>
          <div class="card-content">
            <span class="card-label">Total Revenue</span>
            <span class="card-value">{{ formatCurrency(commissionReport?.summary?.totalRevenue || 0) }}</span>
            <div class="card-trend up">
              <ArrowTrendingUpIcon class="trend-icon" />
              <span>From delivered orders</span>
            </div>
          </div>
        </div>

        <div class="overview-card commission">
          <div class="card-icon">
            <ChartBarIcon />
          </div>
          <div class="card-content">
            <span class="card-label">Total Commission (7%)</span>
            <span class="card-value">{{ formatCurrency(commissionReport?.summary?.totalCommission || 0) }}</span>
            <div class="card-trend up">
              <ArrowTrendingUpIcon class="trend-icon" />
              <span>Platform earnings</span>
            </div>
          </div>
        </div>

        <div class="overview-card pending">
          <div class="card-icon">
            <CurrencyDollarIcon />
          </div>
          <div class="card-content">
            <span class="card-label">Seller Earnings</span>
            <span class="card-value">{{ formatCurrency(commissionReport?.summary?.totalSellerEarnings || 0) }}</span>
            <span class="card-note">Net earnings (93%)</span>
          </div>
        </div>

        <div class="overview-card orders">
          <div class="card-icon">
            <ChartBarIcon />
          </div>
          <div class="card-content">
            <span class="card-label">Completed Orders</span>
            <span class="card-value">{{ formatNumber(commissionReport?.summary?.totalOrders || 0) }}</span>
            <div class="card-trend up">
              <ArrowTrendingUpIcon class="trend-icon" />
              <span>Orders with commission</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Payout / Release Overview -->
      <div class="payout-overview">
        <div class="section-header">
          <div>
            <h2>Escrow & Payouts</h2>
            <p>Digital orders awaiting release to sellers</p>
          </div>
        </div>

        <div class="payout-cards">
          <div class="payout-card pending">
            <div class="icon-wrap">
              <ClockIcon />
            </div>
            <div>
              <p>Pending Release</p>
              <strong>{{ formatCurrency(escrowSummary?.pendingReleaseTotal || 0) }}</strong>
              <small>{{ escrowSummary?.pendingCount || 0 }} orders</small>
            </div>
          </div>
          <div class="payout-card released">
            <div class="icon-wrap">
              <CheckCircleIcon />
            </div>
            <div>
              <p>Released to Sellers</p>
              <strong>{{ formatCurrency(escrowSummary?.releasedTotal || 0) }}</strong>
              <small>{{ escrowSummary?.releasedCount || 0 }} orders</small>
            </div>
          </div>
          <div class="payout-card held">
            <div class="icon-wrap">
              <BuildingStorefrontIcon />
            </div>
            <div>
              <p>On Hold</p>
              <strong>{{ formatCurrency(escrowSummary?.heldTotal || 0) }}</strong>
              <small>Requires manual review</small>
            </div>
          </div>
        </div>

        <div class="payout-table">
          <div class="payout-table-header">
            <h3>Pending Releases</h3>
            <button class="refresh-btn" @click="fetchCommissionReport" :disabled="payoutsLoading">
              Refresh
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!pendingReleases?.length">
                <td colspan="7" class="empty">No pending releases</td>
              </tr>
              <tr v-for="release in pendingReleases" :key="release.orderId">
                <td>#{{ release.orderId?.slice(-6) }}</td>
                <td>{{ release.vendorId }}</td>
                <td>{{ formatCurrency(release.payoutAmount) }}</td>
                <td>{{ release.paymentMethod?.toUpperCase() || 'Digital' }}</td>
                <td><span class="status-chip">{{ release.payoutStatus }}</span></td>
                <td>{{ formatDate(release.createdAt) }}</td>
                <td class="actions">
                  <button class="primary" @click="releasePayout(release.orderId)" :disabled="payoutsLoading">Release</button>
                  <button class="ghost" @click="holdPayout(release.orderId)" :disabled="payoutsLoading">Hold</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Revenue Chart -->
      <div class="chart-section">
        <div class="section-header">
          <h2>Revenue Overview</h2>
          <div class="legend">
            <span class="legend-item revenue">
              <span class="legend-dot"></span>
              Revenue
            </span>
            <span class="legend-item commission">
              <span class="legend-dot"></span>
              Commission
            </span>
          </div>
        </div>

        <div class="chart-container">
          <div class="chart-grid">
            <div class="y-axis">
              <span>{{ formatCurrency(maxRevenue) }}</span>
              <span>{{ formatCurrency(maxRevenue * 0.75) }}</span>
              <span>{{ formatCurrency(maxRevenue * 0.5) }}</span>
              <span>{{ formatCurrency(maxRevenue * 0.25) }}</span>
              <span>₦0</span>
            </div>
            <div class="bars-container">
              <div v-for="(data, index) in revenueData" :key="index" class="bar-group">
                <div class="bars">
                  <div class="bar revenue-bar" :style="{ height: getBarHeight(data.revenue, maxRevenue) }"
                    :title="`Revenue: ${formatCurrency(data.revenue)}`"></div>
                  <div class="bar commission-bar" :style="{ height: getBarHeight(data.commission, maxRevenue) }"
                    :title="`Commission: ${formatCurrency(data.commission)}`"></div>
                </div>
                <span class="bar-label">{{ data.month }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="two-column">
        <!-- Top Sellers -->
        <div class="card-section">
          <div class="section-header">
            <h2>Top Performing Sellers</h2>
            <router-link to="/admin/sellers" class="view-all">View All</router-link>
          </div>
          <div v-if="topSellers.length > 0" class="sellers-list">
            <div v-for="(seller, index) in topSellers" :key="index" class="seller-item">
              <div class="seller-rank">{{ index + 1 }}</div>
              <div class="seller-avatar">
                <BuildingStorefrontIcon />
              </div>
              <div class="seller-info">
                <span class="seller-name">{{ seller.name }}</span>
                <span class="seller-orders">{{ seller.orders }} orders</span>
              </div>
              <div class="seller-revenue">
                <span class="revenue-amount">{{ formatCurrency(seller.revenue) }}</span>
                <span class="commission-amount">{{ formatCurrency(seller.commission) }} commission</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <BuildingStorefrontIcon class="empty-icon" />
            <p>No seller data available yet</p>
          </div>
        </div>

        <!-- Commission Breakdown -->
        <div class="card-section">
          <div class="section-header">
            <h2>Commission Breakdown</h2>
          </div>
          <div class="breakdown-content">
            <div class="breakdown-item">
              <div class="breakdown-label">
                <span class="dot collected"></span>
                <span>Collected Commission</span>
              </div>
              <span class="breakdown-value">{{ formatCurrency(commissionBreakdown.collected.amount) }}</span>
              <div class="breakdown-bar">
                <div class="bar-fill collected" :style="{ width: commissionBreakdown.collected.percent + '%' }"></div>
              </div>
            </div>

            <div class="breakdown-item">
              <div class="breakdown-label">
                <span class="dot pending"></span>
                <span>Pending Commission</span>
              </div>
              <span class="breakdown-value">{{ formatCurrency(commissionBreakdown.pending.amount) }}</span>
              <div class="breakdown-bar">
                <div class="bar-fill pending" :style="{ width: commissionBreakdown.pending.percent + '%' }"></div>
              </div>
            </div>

            <div class="breakdown-item">
              <div class="breakdown-label">
                <span class="dot refunded"></span>
                <span>Refunded Commission</span>
              </div>
              <span class="breakdown-value">{{ formatCurrency(commissionBreakdown.refunded.amount) }}</span>
              <div class="breakdown-bar">
                <div class="bar-fill refunded" :style="{ width: commissionBreakdown.refunded.percent + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="commission-rate">
            <span class="rate-label">Platform Commission Rate</span>
            <span class="rate-value">7%</span>
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="transactions-section">
        <div class="section-header">
          <h2>Recent Commission Transactions</h2>
          <router-link to="/admin/orders" class="view-all">View All Orders</router-link>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Seller</th>
                <th>Order Amount</th>
                <th>Commission (7%)</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentTransactions.length === 0">
                <td colspan="6" class="empty-row">No recent transactions found</td>
              </tr>
              <tr v-for="transaction in recentTransactions" :key="transaction._id">
                <td class="order-id">#{{ transaction.orderId || transaction._id?.slice(-8) }}</td>
                <td>{{ transaction.vendorId?.name || transaction.seller?.storeName || 'Unknown Seller' }}</td>
                <td>{{ formatCurrency(transaction.subTotal || 0) }}</td>
                <td class="commission-cell">{{ formatCurrency((transaction.subTotal || 0) * 0.07) }}</td>
                <td>
                  <span :class="`status-badge ${transaction.status === 'delivered' ? 'success' : 'warning'}`">
                    {{ transaction.status === 'delivered' ? 'Collected' : 'Pending' }}
                  </span>
                </td>
                <td class="date-cell">{{ formatDate(transaction.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.commission-page {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.page-subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:hover {
  background: var(--bg-secondary);
}

.export-btn.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.export-btn.primary:hover {
  opacity: 0.9;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Filters */
.filters-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-tertiary);
}

.filter-select {
  padding: 0.625rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Overview Cards */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.overview-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
}

.card-icon {
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.overview-card.revenue .card-icon {
  background: #dcfce7;
  color: #16a34a;
}

.overview-card.commission .card-icon {
  background: #e0f2fe;
  color: #0284c7;
}

.overview-card.pending .card-icon {
  background: #fef3c7;
  color: #d97706;
}

.overview-card.orders .card-icon {
  background: #f3e8ff;
  color: #9333ea;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.card-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.card-trend.up {
  color: #16a34a;
}

.card-trend.down {
  color: #dc2626;
}

.trend-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.card-note {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Chart Section */
.chart-section {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.legend {
  display: flex;
  gap: 1.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.legend-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 2px;
}

.legend-item.revenue .legend-dot {
  background: #16a34a;
}

.legend-item.commission .legend-dot {
  background: #0284c7;
}

.view-all {
  font-size: 0.85rem;
  color: var(--color-primary);
  text-decoration: none;
}

.view-all:hover {
  text-decoration: underline;
}

/* Chart */
.chart-container {
  height: 300px;
}

.chart-grid {
  display: flex;
  height: 100%;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-right: 1rem;
  font-size: 0.7rem;
  color: var(--text-tertiary);
  text-align: right;
  min-width: 80px;
}

.bars-container {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  border-left: 1px solid var(--border-primary);
  border-bottom: 1px solid var(--border-primary);
  padding: 0 0.5rem;
}

.bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.bars {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  height: 250px;
  width: 100%;
}

.bar {
  flex: 1;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  cursor: pointer;
}

.bar:hover {
  opacity: 0.8;
}

.revenue-bar {
  background: #16a34a;
}

.commission-bar {
  background: #0284c7;
}

.bar-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Two Column Layout */
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.card-section {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.5rem;
}

/* Sellers List */
.sellers-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.seller-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.seller-rank {
  width: 1.5rem;
  height: 1.5rem;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.seller-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--surface);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.seller-avatar svg {
  width: 1.25rem;
  height: 1.25rem;
}

.seller-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.seller-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.seller-orders {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.seller-revenue {
  text-align: right;
  display: flex;
  flex-direction: column;
}

.revenue-amount {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.commission-amount {
  font-size: 0.75rem;
  color: #16a34a;
}

/* Commission Breakdown */
.breakdown-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breakdown-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}

.dot.collected {
  background: #16a34a;
}

.dot.pending {
  background: #d97706;
}

.dot.refunded {
  background: #dc2626;
}

.breakdown-value {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.breakdown-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
}

.bar-fill.collected {
  background: #16a34a;
}

.bar-fill.pending {
  background: #d97706;
}

.bar-fill.refunded {
  background: #dc2626;
}

.commission-rate {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

/* Payout Overview Section */
.payout-overview {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.payout-overview .section-header {
  margin-bottom: 1.25rem;
}

.payout-overview .section-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.payout-overview .section-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.payout-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.payout-card {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
  background: var(--surface);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.payout-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px rgba(0, 0, 0, 0.08);
}

.payout-card.pending {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.02));
  border-color: rgba(245, 158, 11, 0.2);
}

.payout-card.released {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.02));
  border-color: rgba(34, 197, 94, 0.2);
}

.payout-card.held {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.02));
  border-color: rgba(239, 68, 68, 0.2);
}

.payout-card .icon-wrap {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.payout-card .icon-wrap svg {
  width: 24px;
  height: 24px;
}

.payout-card.pending .icon-wrap {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.payout-card.released .icon-wrap {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.payout-card.held .icon-wrap {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.payout-card p {
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.payout-card strong {
  display: block;
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.payout-card small {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.payout-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.payout-table-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--border-primary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.payout-table {
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-primary);
}

.payout-table table {
  width: 100%;
  border-collapse: collapse;
}

.payout-table th,
.payout-table td {
  padding: 0.875rem 1rem;
  text-align: left;
}

.payout-table th {
  background: var(--bg-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border-primary);
}

.payout-table td {
  font-size: 0.875rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-primary);
}

.payout-table tbody tr:last-child td {
  border-bottom: none;
}

.payout-table tbody tr:hover {
  background: var(--bg-secondary);
}

.payout-table .status-chip {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: capitalize;
}

.payout-table .empty {
  text-align: center;
  padding: 2rem !important;
  color: var(--text-tertiary);
}

.payout-table .actions {
  display: flex;
  gap: 0.5rem;
}

.payout-table button.primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  border: none;
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.payout-table button.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #16a34a, #15803d);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.payout-table button.ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  padding: 0.5rem 0.875rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.payout-table button.ghost:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.payout-table button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  color: var(--text-tertiary);
  margin-bottom: 1rem;
}

.empty-state p {
  color: var(--text-secondary);
  margin: 0;
}

.rate-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.rate-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary);
}

/* Transactions Table */
.transactions-section {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.5rem;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 0.875rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border-primary);
}

.data-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.order-id {
  font-family: monospace;
  font-weight: 600;
  color: var(--text-primary);
}

.commission-cell {
  color: #16a34a;
  font-weight: 500;
}

.date-cell {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.status-badge {
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.warning {
  background: #fef3c7;
  color: #d97706;
}

.empty-row {
  text-align: center;
  padding: 2rem !important;
  color: var(--text-tertiary);
}

/* Responsive */
@media (max-width: 1200px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .payout-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .export-btn {
    flex: 1;
  }

  .filters-section {
    flex-wrap: wrap;
  }

  .overview-cards {
    grid-template-columns: 1fr;
  }

  .payout-cards {
    grid-template-columns: 1fr;
  }

  .y-axis {
    display: none;
  }

  .payout-table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
</style>
