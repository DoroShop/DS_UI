// Admin Dashboard Store - Comprehensive Admin State Management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';
import { getAuthHeaders } from '../../types/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useAdminDashboardStore = defineStore('adminDashboard', () => {
  // ============================================
  // STATE
  // ============================================
  
  // Dashboard Stats
  const dashboardStats = ref<any>(null);
  const topProducts = ref<any[]>([]);
  const topSellers = ref<any[]>([]);
  const salesChartData = ref<any[]>([]);
  
  // Users
  const users = ref<any[]>([]);
  const usersPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const selectedUser = ref<any>(null);
  
  // Sellers
  const sellers = ref<any[]>([]);
  const sellersPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const selectedSeller = ref<any>(null);
  const sellerPerformance = ref<any>(null);
  
  // Seller Applications
  const pendingApplications = ref<any[]>([]);
  
  // Products
  const products = ref<any[]>([]);
  const productsPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const pendingProducts = ref<any[]>([]);
  
  // Orders
  const orders = ref<any[]>([]);
  const ordersPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const selectedOrder = ref<any>(null);
  const commissionReport = ref<any>(null);
  const escrowSummary = ref<any>(null);
  const pendingReleases = ref<any[]>([]);
  const pendingReleasesMeta = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  
  // Categories
  const categories = ref<any[]>([]);
  
  // Municipalities
  const municipalities = ref<any[]>([]);
  
  // Banners
  const banners = ref<any[]>([]);
  
  // Announcements
  const announcements = ref<any[]>([]);
  const announcementsPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  
  // Refunds
  const refunds = ref<any[]>([]);
  const refundsPagination = ref({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const selectedRefund = ref<any>(null);
  
  // System Settings
  const systemSettings = ref<any>(null);
  
  // Audit Logs
  const auditLogs = ref<any[]>([]);
  const auditLogsPagination = ref({ total: 0, page: 1, limit: 50, totalPages: 0 });
  
  // Loading states
  const loading = ref({
    dashboard: false,
    users: false,
    sellers: false,
    products: false,
    orders: false,
    categories: false,
    banners: false,
    announcements: false,
    refunds: false,
    settings: false,
    auditLogs: false
  });
  
  // Error state
  const error = ref<string | null>(null);

  // ============================================
  // COMPUTED
  // ============================================
  const pendingActionsCount = computed(() => {
    return (dashboardStats.value?.pendingActions?.sellerApplications || 0) +
           (dashboardStats.value?.pendingActions?.productApprovals || 0);
  });

  // ============================================
  // DASHBOARD & ANALYTICS ACTIONS
  // ============================================
  async function fetchDashboardStats() {
    loading.value.dashboard = true;
    error.value = null;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/stats`, {
        withCredentials: true, headers: getAuthHeaders()
      });
      dashboardStats.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch dashboard stats';
      throw err;
    } finally {
      loading.value.dashboard = false;
    }
  }

  async function fetchTopProducts(limit = 10) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/top-products`, {
        params: { limit },
        withCredentials: true, headers: getAuthHeaders()
      });
      topProducts.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      console.error('Failed to fetch top products:', err);
      throw err;
    }
  }

  async function fetchTopSellers(limit = 10) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/top-sellers`, {
        params: { limit },
        withCredentials: true, headers: getAuthHeaders()
      });
      topSellers.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      console.error('Failed to fetch top sellers:', err);
      throw err;
    }
  }

  async function fetchSalesChart(period = 'monthly', year?: number) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/sales-chart`, {
        params: { period, year },
        withCredentials: true, headers: getAuthHeaders()
      });
      salesChartData.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      console.error('Failed to fetch sales chart:', err);
      throw err;
    }
  }

  async function exportData(type: string, filters = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/export/${type}`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      return response.data.data;
    } catch (err: any) {
      console.error('Failed to export data:', err);
      throw err;
    }
  }

  // ============================================
  // USER MANAGEMENT ACTIONS
  // ============================================
  async function fetchUsers(filters: any = {}) {
    loading.value.users = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/users`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      users.value = response.data.users;
      usersPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch users';
      throw err;
    } finally {
      loading.value.users = false;
    }
  }

  async function fetchUserById(userId: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/users/${userId}`, {
        withCredentials: true, headers: getAuthHeaders()
      });
      selectedUser.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch user';
      throw err;
    }
  }

  async function restrictUser(userId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/users/${userId}/restrict`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      // Update local state
      const index = users.value.findIndex(u => u._id === userId);
      if (index !== -1) {
        users.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to restrict user';
      throw err;
    }
  }

  async function unrestrictUser(userId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/users/${userId}/unrestrict`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = users.value.findIndex(u => u._id === userId);
      if (index !== -1) {
        users.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to unrestrict user';
      throw err;
    }
  }

  async function changeUserRole(userId: string, role: string) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/users/${userId}/role`,
        { role },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = users.value.findIndex(u => u._id === userId);
      if (index !== -1) {
        users.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to change user role';
      throw err;
    }
  }

  async function flagUser(userId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/users/${userId}/flag`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = users.value.findIndex(u => u._id === userId);
      if (index !== -1) {
        users.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to flag user';
      throw err;
    }
  }

  async function unflagUser(userId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/users/${userId}/unflag`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = users.value.findIndex(u => u._id === userId);
      if (index !== -1) {
        users.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to unflag user';
      throw err;
    }
  }

  // ============================================
  // SELLER MANAGEMENT ACTIONS
  // ============================================
  async function fetchSellers(filters: any = {}) {
    loading.value.sellers = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/sellers`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      sellers.value = response.data.sellers;
      sellersPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch sellers';
      throw err;
    } finally {
      loading.value.sellers = false;
    }
  }

  async function fetchSellerPerformance(sellerId: string) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/dashboard/sellers/${sellerId}/performance`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      sellerPerformance.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch seller performance';
      throw err;
    }
  }

  // ============================================
  // SELLER APPLICATION ACTIONS
  // ============================================
  async function fetchPendingApplications() {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/applications/pending`, {
        withCredentials: true, headers: getAuthHeaders()
      });
      pendingApplications.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch pending applications';
      throw err;
    }
  }

  async function reviewSellerApplication(userId: string, decision: 'approved' | 'rejected', rejectionReason?: string) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/applications/${userId}/review`,
        { decision, rejectionReason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      // Remove from pending list
      pendingApplications.value = pendingApplications.value.filter(a => a._id !== userId);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to review application';
      throw err;
    }
  }

  // ============================================
  // PRODUCT MANAGEMENT ACTIONS
  // ============================================
  async function fetchProducts(filters: any = {}) {
    loading.value.products = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/products`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      products.value = response.data.products;
      productsPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch products';
      throw err;
    } finally {
      loading.value.products = false;
    }
  }

  async function fetchPendingProducts(pagination: any = {}) {
    loading.value.products = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/products/pending`, {
        params: pagination,
        withCredentials: true, headers: getAuthHeaders()
      });
      pendingProducts.value = response.data.products;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch pending products';
      throw err;
    } finally {
      loading.value.products = false;
    }
  }

  async function approveProduct(productId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/products/${productId}/approve`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      // Remove from pending list
      pendingProducts.value = pendingProducts.value.filter(p => p._id !== productId);
      // Update in products list
      const index = products.value.findIndex(p => p._id === productId);
      if (index !== -1) {
        products.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to approve product';
      throw err;
    }
  }

  async function rejectProduct(productId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/products/${productId}/reject`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      pendingProducts.value = pendingProducts.value.filter(p => p._id !== productId);
      // Also update in main products list
      const index = products.value.findIndex(p => p._id === productId);
      if (index !== -1) {
        products.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to reject product';
      throw err;
    }
  }

  // Alias for rejectProduct (for backward compatibility)
  async function declineProduct(productId: string, reason: string) {
    return rejectProduct(productId, reason);
  }

  async function resetProductToPending(productId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/products/${productId}/reset`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      // Update in products list
      const index = products.value.findIndex(p => p._id === productId);
      if (index !== -1) {
        products.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to reset product';
      throw err;
    }
  }

  async function disableProduct(productId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/products/${productId}/disable`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = products.value.findIndex(p => p._id === productId);
      if (index !== -1) {
        products.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to disable product';
      throw err;
    }
  }

  async function enableProduct(productId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/products/${productId}/enable`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = products.value.findIndex(p => p._id === productId);
      if (index !== -1) {
        products.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to enable product';
      throw err;
    }
  }

  async function deleteProduct(productId: string) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/dashboard/products/${productId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      products.value = products.value.filter(p => p._id !== productId);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete product';
      throw err;
    }
  }

  // ============================================
  // ORDER & COMMISSION ACTIONS
  // ============================================
  async function fetchOrders(filters: any = {}) {
    loading.value.orders = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/orders`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      orders.value = response.data.orders;
      ordersPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch orders';
      throw err;
    } finally {
      loading.value.orders = false;
    }
  }

  async function fetchOrderDetails(orderId: string) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/dashboard/orders/${orderId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      selectedOrder.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch order details';
      throw err;
    }
  }

  async function updateOrderStatus(orderId: string, status: string, notes?: string) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/orders/${orderId}/status`,
        { status, notes },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = orders.value.findIndex(o => o._id === orderId);
      if (index !== -1) {
        orders.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update order status';
      throw err;
    }
  }

  async function fetchCommissionReport(filters: any = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/commission/report`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      commissionReport.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch commission report';
      throw err;
    }
  }

  async function fetchCommissionSummary() {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/commission/summary`, {
        withCredentials: true, headers: getAuthHeaders()
      });
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch commission summary';
      throw err;
    }
  }

  async function fetchPendingCODCommissions(filters: any = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/commission/pending-cod`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch pending COD commissions';
      throw err;
    }
  }

  // ============================================
  // PAYOUT / ESCROW ACTIONS
  // ============================================
  async function fetchEscrowSummary() {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/escrow/summary`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      escrowSummary.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch escrow summary';
      throw err;
    }
  }

  async function fetchPendingReleases(filters: any = {}) {
    const { page = 1, limit = 20, vendorId, minAmount, maxAmount, payoutStatus } = filters;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/escrow/releases`, {
        params: { page, limit, vendorId, minAmount, maxAmount, payoutStatus },
        withCredentials: true,
        headers: getAuthHeaders()
      });
      pendingReleases.value = response.data.data?.results || [];
      pendingReleasesMeta.value = {
        total: response.data.data?.total || 0,
        page: response.data.data?.page || page,
        limit: response.data.data?.limit || limit,
        totalPages: Math.ceil((response.data.data?.total || 0) / (response.data.data?.limit || limit || 1))
      };
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch pending releases';
      throw err;
    }
  }

  async function releasePayout(orderId: string, notes?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/escrow/releases/${orderId}/release`,
        { notes },
        { withCredentials: true, headers: getAuthHeaders() }
      );

      // Remove released item from pending cache if present
      pendingReleases.value = pendingReleases.value.filter((r: any) => r.orderId !== orderId);
      return response.data?.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to release payout';
      throw err;
    }
  }

  async function holdPayout(orderId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/escrow/releases/${orderId}/hold`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      return response.data?.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to hold payout';
      throw err;
    }
  }

  async function collectCODCommission(orderId: string, notes?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/commission/${orderId}/collect`,
        { notes },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      // Update order in list if exists
      const index = orders.value.findIndex(o => o._id === orderId);
      if (index !== -1) {
        orders.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to collect commission';
      throw err;
    }
  }

  async function waiveCommission(orderId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/commission/${orderId}/waive`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = orders.value.findIndex(o => o._id === orderId);
      if (index !== -1) {
        orders.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to waive commission';
      throw err;
    }
  }

  // ============================================
  // CATEGORY ACTIONS
  // ============================================
  async function fetchCategories(includeInactive = false) {
    loading.value.categories = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/categories`, {
        params: { includeInactive },
        withCredentials: true, headers: getAuthHeaders()
      });
      categories.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch categories';
      throw err;
    } finally {
      loading.value.categories = false;
    }
  }

  async function createCategory(data: any) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/categories`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      categories.value.push(response.data.data);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create category';
      throw err;
    }
  }

  async function updateCategory(categoryId: string, data: any) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/categories/${categoryId}`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = categories.value.findIndex(c => c._id === categoryId);
      if (index !== -1) {
        categories.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update category';
      throw err;
    }
  }

  async function deleteCategory(categoryId: string) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/dashboard/categories/${categoryId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      categories.value = categories.value.filter(c => c._id !== categoryId);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete category';
      throw err;
    }
  }

  async function toggleCategoryStatus(categoryId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/categories/${categoryId}/toggle`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = categories.value.findIndex(c => c._id === categoryId);
      if (index !== -1) {
        categories.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to toggle category status';
      throw err;
    }
  }

  // ============================================
  // MUNICIPALITY ACTIONS
  // ============================================
  async function fetchMunicipalities(includeInactive = true) {
    try {
      const endpoint = includeInactive 
        ? `${API_BASE_URL}/admin/dashboard/municipalities`
        : `${API_BASE_URL}/admin/dashboard/municipalities/active`;
      const response = await axios.get(endpoint, {
        withCredentials: true, headers: getAuthHeaders()
      });
      municipalities.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch municipalities';
      throw err;
    }
  }

  async function createMunicipality(data: { name: string; province?: string; isActive?: boolean }) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/municipalities`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      municipalities.value.push(response.data.data);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create municipality';
      throw err;
    }
  }

  async function updateMunicipality(id: string, data: { name?: string; province?: string; isActive?: boolean }) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/municipalities/${id}`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = municipalities.value.findIndex(m => m._id === id);
      if (index !== -1) {
        municipalities.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update municipality';
      throw err;
    }
  }

  async function deleteMunicipality(id: string) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/dashboard/municipalities/${id}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      municipalities.value = municipalities.value.filter(m => m._id !== id);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete municipality';
      throw err;
    }
  }

  // ============================================
  // BANNER ACTIONS
  // ============================================
  async function fetchBanners(filters: any = {}) {
    loading.value.banners = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/banners`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      banners.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch banners';
      throw err;
    } finally {
      loading.value.banners = false;
    }
  }

  async function createBanner(data: any) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/banners`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      banners.value.push(response.data.data);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create banner';
      throw err;
    }
  }

  async function updateBanner(bannerId: string, data: any) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/banners/${bannerId}`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = banners.value.findIndex(b => b._id === bannerId);
      if (index !== -1) {
        banners.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update banner';
      throw err;
    }
  }

  async function deleteBanner(bannerId: string) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/dashboard/banners/${bannerId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      banners.value = banners.value.filter(b => b._id !== bannerId);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete banner';
      throw err;
    }
  }

  async function toggleBannerStatus(bannerId: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/banners/${bannerId}/toggle`,
        {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = banners.value.findIndex(b => b._id === bannerId);
      if (index !== -1) {
        banners.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to toggle banner status';
      throw err;
    }
  }

  // ============================================
  // ANNOUNCEMENT ACTIONS
  // ============================================
  async function fetchAnnouncements(filters: any = {}) {
    loading.value.announcements = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/announcements`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      announcements.value = response.data.announcements;
      announcementsPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch announcements';
      throw err;
    } finally {
      loading.value.announcements = false;
    }
  }

  async function createAnnouncement(data: any) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/announcements`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      announcements.value.unshift(response.data.data);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to create announcement';
      throw err;
    }
  }

  async function updateAnnouncement(announcementId: string, data: any) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/announcements/${announcementId}`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = announcements.value.findIndex(a => a._id === announcementId);
      if (index !== -1) {
        announcements.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update announcement';
      throw err;
    }
  }

  async function deleteAnnouncement(announcementId: string) {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/admin/dashboard/announcements/${announcementId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      announcements.value = announcements.value.filter(a => a._id !== announcementId);
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to delete announcement';
      throw err;
    }
  }

  // ============================================
  // REFUND ACTIONS
  // ============================================
  async function fetchRefunds(filters: any = {}) {
    loading.value.refunds = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/refunds`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      refunds.value = response.data.refunds;
      refundsPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch refunds';
      throw err;
    } finally {
      loading.value.refunds = false;
    }
  }

  async function fetchRefundDetails(refundId: string) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/dashboard/refunds/${refundId}`,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      selectedRefund.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch refund details';
      throw err;
    }
  }

  async function approveRefund(refundId: string, notes?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/refunds/${refundId}/approve`,
        { notes },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = refunds.value.findIndex(r => r._id === refundId);
      if (index !== -1) {
        refunds.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to approve refund';
      throw err;
    }
  }

  async function rejectRefund(refundId: string, reason: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/refunds/${refundId}/reject`,
        { reason },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = refunds.value.findIndex(r => r._id === refundId);
      if (index !== -1) {
        refunds.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to reject refund';
      throw err;
    }
  }

  async function processRefund(refundId: string, options?: { status: string; note?: string }) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/refunds/${refundId}/process`,
        options || {},
        { withCredentials: true, headers: getAuthHeaders() }
      );
      const index = refunds.value.findIndex(r => r._id === refundId);
      if (index !== -1) {
        refunds.value[index] = response.data.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to process refund';
      throw err;
    }
  }

  // Alias for fetchRefunds - used by AdminRefunds.vue
  async function fetchRefundRequests(filters: any = {}) {
    return fetchRefunds(filters);
  }

  // ============================================
  // SYSTEM SETTINGS ACTIONS
  // ============================================
  async function fetchSettings() {
    loading.value.settings = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/settings`, {
        withCredentials: true, headers: getAuthHeaders()
      });
      systemSettings.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch settings';
      throw err;
    } finally {
      loading.value.settings = false;
    }
  }

  async function updateSettings(data: any) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/settings`,
        data,
        { withCredentials: true, headers: getAuthHeaders() }
      );
      systemSettings.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update settings';
      throw err;
    }
  }

  async function toggleMaintenanceMode(enabled: boolean, message?: string) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/dashboard/settings/maintenance`,
        { enabled, message },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      systemSettings.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to toggle maintenance mode';
      throw err;
    }
  }

  async function updateCommissionRate(rate: number) {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/admin/dashboard/settings/commission`,
        { rate },
        { withCredentials: true, headers: getAuthHeaders() }
      );
      systemSettings.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to update commission rate';
      throw err;
    }
  }

  // ============================================
  // AUDIT LOG ACTIONS
  // ============================================
  async function fetchAuditLogs(filters: any = {}) {
    loading.value.auditLogs = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/dashboard/audit-logs`, {
        params: filters,
        withCredentials: true, headers: getAuthHeaders()
      });
      auditLogs.value = response.data.logs;
      auditLogsPagination.value = {
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages
      };
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.error || 'Failed to fetch audit logs';
      throw err;
    } finally {
      loading.value.auditLogs = false;
    }
  }

  // ============================================
  // PAGINATION SETTER FUNCTIONS
  // ============================================
  function setUsersPagination(page: number, limit: number = 20) {
    usersPagination.value.page = page;
    usersPagination.value.limit = limit;
  }

  function setSellersPagination(page: number, limit: number = 20) {
    sellersPagination.value.page = page;
    sellersPagination.value.limit = limit;
  }

  function setProductsPagination(page: number, limit: number = 20) {
    productsPagination.value.page = page;
    productsPagination.value.limit = limit;
  }

  function setOrdersPagination(page: number, limit: number = 20) {
    ordersPagination.value.page = page;
    ordersPagination.value.limit = limit;
  }

  function setAnnouncementsPagination(page: number, limit: number = 20) {
    announcementsPagination.value.page = page;
    announcementsPagination.value.limit = limit;
  }

  function setRefundsPagination(page: number, limit: number = 20) {
    refundsPagination.value.page = page;
    refundsPagination.value.limit = limit;
  }

  function setAuditLogsPagination(page: number, limit: number = 50) {
    auditLogsPagination.value.page = page;
    auditLogsPagination.value.limit = limit;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function clearError() {
    error.value = null;
  }

  function resetState() {
    dashboardStats.value = null;
    topProducts.value = [];
    topSellers.value = [];
    salesChartData.value = [];
    users.value = [];
    sellers.value = [];
    products.value = [];
    orders.value = [];
    categories.value = [];
    banners.value = [];
    announcements.value = [];
    refunds.value = [];
    auditLogs.value = [];
    systemSettings.value = null;
    error.value = null;
  }

  return {
    // State
    dashboardStats,
    topProducts,
    topSellers,
    salesChartData,
    users,
    usersPagination,
    selectedUser,
    sellers,
    sellersPagination,
    selectedSeller,
    sellerPerformance,
    pendingApplications,
    products,
    productsPagination,
    pendingProducts,
    orders,
    ordersPagination,
    selectedOrder,
    commissionReport,
    escrowSummary,
    pendingReleases,
    pendingReleasesMeta,
    categories,
    banners,
    announcements,
    announcementsPagination,
    refunds,
    refundsPagination,
    selectedRefund,
    systemSettings,
    auditLogs,
    auditLogsPagination,
    loading,
    error,
    
    // Computed
    pendingActionsCount,
    
    // Dashboard Actions
    fetchDashboardStats,
    fetchTopProducts,
    fetchTopSellers,
    fetchSalesChart,
    exportData,
    
    // User Actions
    fetchUsers,
    fetchUserById,
    restrictUser,
    unrestrictUser,
    changeUserRole,
    flagUser,
    unflagUser,
    
    // Seller Actions
    fetchSellers,
    fetchSellerPerformance,
    fetchPendingApplications,
    reviewSellerApplication,
    
    // Product Actions
    fetchProducts,
    fetchPendingProducts,
    approveProduct,
    rejectProduct,
    declineProduct,
    resetProductToPending,
    disableProduct,
    enableProduct,
    deleteProduct,
    
    // Order Actions
    fetchOrders,
    fetchOrderDetails,
    updateOrderStatus,
    fetchCommissionReport,
    fetchCommissionSummary,
    fetchPendingCODCommissions,
    collectCODCommission,
    waiveCommission,
    fetchEscrowSummary,
    fetchPendingReleases,
    releasePayout,
    holdPayout,
    
    // Category Actions
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    
    // Municipality Actions
    municipalities,
    fetchMunicipalities,
    createMunicipality,
    updateMunicipality,
    deleteMunicipality,
    
    // Banner Actions
    fetchBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    
    // Announcement Actions
    fetchAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    
    // Refund Actions
    fetchRefunds,
    fetchRefundRequests,
    fetchRefundDetails,
    approveRefund,
    rejectRefund,
    processRefund,
    
    // Settings Actions
    fetchSettings,
    updateSettings,
    toggleMaintenanceMode,
    updateCommissionRate,
    
    // Audit Log Actions
    fetchAuditLogs,
    
    // Pagination Setters
    setUsersPagination,
    setSellersPagination,
    setProductsPagination,
    setOrdersPagination,
    setAnnouncementsPagination,
    setRefundsPagination,
    setAuditLogsPagination,
    
    // Utility
    clearError,
    resetState
  };
});
