/**
 * Admin Commission Store
 * Manages commission data for admin dashboard
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { getAuthHeaders } from '../../types/shared'
import { useAuthStore } from '../authStores'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api/v1'

export interface AdminCommission {
  _id: string
  vendor: {
    _id: string
    name: string
    email: string
  }
  shop: {
    _id: string
    shopName: string
  }
  order: {
    _id: string
    orderNumber: string
    totalAmount: number
    status: string
  }
  orderAmount: number
  commissionRate: number
  commissionAmount: number
  status: 'pending' | 'remitted' | 'overdue' | 'waived' | 'disputed'
  dueDate: string
  remittedAt?: string
  remindersSent: number
  adminNotes?: string
  statusHistory: Array<{
    status: string
    changedAt: string
    changedBy?: string
    reason?: string
  }>
  createdAt: string
}

export interface CommissionAnalytics {
  period: string
  totalStats: Array<{ _id: string; count: number; totalAmount: number }>
  dailyStats: Array<any>
  topVendors: Array<{
    vendorId: string
    vendorName: string
    vendorEmail: string
    vendorPhone?: string
    totalPending: number
    count: number
    commissions?: Array<{
      _id: string
      commissionAmount: number
      status: string
      dueDate: string
      createdAt: string
      order?: {
        _id: string
        orderNumber: string
      }
    }>
    oldestDueDate?: string
  }>
  overdueAnalysis: Array<{ _id: string | number; count: number; totalAmount: number }>
}

export const useAdminCommissionStore = defineStore('adminCommission', () => {
  // State
  const commissions = ref<AdminCommission[]>([])
  const analytics = ref<CommissionAnalytics | null>(null)
  const statusSummary = ref<Record<string, { count: number; total: number }>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Computed
  const totalPending = computed(() => 
    (statusSummary.value.pending?.total || 0) + (statusSummary.value.overdue?.total || 0)
  )
  
  const totalRemitted = computed(() => statusSummary.value.remitted?.total || 0)
  
  const overdueCount = computed(() => statusSummary.value.overdue?.count || 0)

  // Actions
  const fetchCommissions = async (filters: {
    page?: number
    limit?: number
    status?: string
    vendorId?: string
    shopId?: string
    startDate?: string
    endDate?: string
    sortBy?: string
    sortOrder?: string
  } = {}) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'Admin not authenticated'
      return
    }
    
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })
      
      const response = await axios.get(`${API_URL}/commissions/admin/all?${params}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        commissions.value = response.data.data.commissions
        pagination.value = response.data.data.pagination
        statusSummary.value = response.data.data.statusSummary || {}
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch commissions'
      console.error('Error fetching admin commissions:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchAnalytics = async (period = '30d') => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'Admin not authenticated'
      return
    }
    
    try {
      const response = await axios.get(`${API_URL}/commissions/admin/analytics?period=${period}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        analytics.value = response.data.data
      }
    } catch (err: any) {
      console.error('Error fetching commission analytics:', err)
    }
  }

  const fetchCommissionById = async (commissionId: string) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'Admin not authenticated'
      return null
    }
    
    try {
      const response = await axios.get(`${API_URL}/commissions/admin/${commissionId}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        return response.data.data
      }
      return null
    } catch (err: any) {
      console.error('Error fetching commission:', err)
      return null
    }
  }

  const updateCommissionStatus = async (commissionId: string, status: string, notes?: string) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'Admin not authenticated'
      return { success: false, error: 'Admin not authenticated' }
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.patch(
        `${API_URL}/commissions/admin/${commissionId}/status`,
        { status, notes },
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state
        const index = commissions.value.findIndex(c => c._id === commissionId)
        if (index !== -1) {
          commissions.value[index] = response.data.data
        }
        
        return { success: true, commission: response.data.data }
      }
      
      return { success: false, error: 'Update failed' }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update commission'
      error.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const fetchVendorsWithPendingCommissions = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'Admin not authenticated'
      return []
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_URL}/commissions/admin/vendors-pending`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        // Update analytics with detailed vendor data
        if (analytics.value) {
          analytics.value.topVendors = response.data.data.vendors || []
        }
        return response.data.data.vendors || []
      }
      return []
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch vendors with pending commissions'
      console.error('Error fetching vendors:', err)
      return []
    } finally {
      loading.value = false
    }
  }

  const sendReminderToVendor = async (vendorId: string) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      return { success: false, error: 'Admin not authenticated' }
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/commissions/admin/send-reminder`,
        { vendorId },
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        return { success: true }
      }
      return { success: false, error: 'Failed to send reminder' }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to send reminder'
      return { success: false, error: errorMessage }
    }
  }

  return {
    // State
    commissions,
    analytics,
    statusSummary,
    loading,
    error,
    pagination,
    // Computed
    totalPending,
    totalRemitted,
    overdueCount,
    // Actions
    fetchCommissions,
    fetchAnalytics,
    fetchCommissionById,
    updateCommissionStatus,
    fetchVendorsWithPendingCommissions,
    sendReminderToVendor,
    clearError
  }
})
