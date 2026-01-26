/**
 * Commission Store
 * Manages commission state for vendors
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { getAuthHeaders } from '../../types/shared'
import { useAuthStore } from '../authStores'

const API_URL = import.meta.env.VITE_API_BASE_URL || ""

export interface Commission {
  _id: string
  order: {
    _id: string
    orderNumber: string
    totalAmount: number
    status: string
  }
  shop: {
    _id: string
    shopName: string
  }
  orderAmount: number
  commissionRate: number
  commissionAmount: number
  paymentMethod: string
  status: 'pending' | 'remitted' | 'overdue' | 'waived' | 'disputed'
  dueDate: string
  remittedAt?: string
  remindersSent: number
  metadata?: {
    orderNumber: string
    customerName: string
  }
  createdAt: string
}

export interface CommissionSummary {
  pending: { amount: number; count: number }
  remitted: { amount: number; count: number }
  overdue: { amount: number; count: number }
  totalPendingAmount: number
}

export interface RemittanceHistory {
  remittedAt: string
  amount: number
  method: string
  referenceNumber: string
  status: string
}

export const useCommissionStore = defineStore('commission', () => {
  // State
  const commissions = ref<Commission[]>([])
  const summary = ref<CommissionSummary | null>(null)
  const remittanceHistory = ref<RemittanceHistory[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Computed
  const pendingCommissions = computed(() => 
    commissions.value.filter(c => c.status === 'pending' || c.status === 'overdue')
  )
  
  const overdueCommissions = computed(() =>
    commissions.value.filter(c => c.status === 'overdue')
  )
  
  // Calculate total from actual pending commissions, fallback to summary
  const totalPending = computed(() => {
    const fromCommissions = pendingCommissions.value.reduce((sum, c) => sum + (c.commissionAmount || 0), 0)
    return fromCommissions > 0 ? fromCommissions : (summary.value?.totalPendingAmount || 0)
  })
  
  const hasOverdue = computed(() => (summary.value?.overdue.count || 0) > 0)

  // Actions
  const fetchPendingCommissions = async (page = 1, status?: string) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'User not authenticated'
      return
    }
    
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' })
      if (status) params.append('status', status)
      
      const response = await axios.get(`${API_URL}/commissions/pending?${params}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        commissions.value = response.data.data.commissions
        pagination.value = response.data.data.pagination
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch commissions'
      console.error('Error fetching commissions:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchCommissionSummary = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      return
    }
    
    try {
      const response = await axios.get(`${API_URL}/commissions/summary`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        summary.value = response.data.data
      }
    } catch (err: any) {
      console.error('Error fetching commission summary:', err)
    }
  }

  const remitCommission = async (commissionId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.post(
        `${API_URL}/commissions/${commissionId}/remit`,
        {},
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state
        const index = commissions.value.findIndex(c => c._id === commissionId)
        if (index !== -1) {
          commissions.value.splice(index, 1)
        }
        
        // Refresh summary
        await fetchCommissionSummary()
        
        return {
          success: true,
          newBalance: response.data.data.newWalletBalance,
          transactionId: response.data.data.transactionId
        }
      }
      
      return { success: false, error: 'Remittance failed' }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to remit commission'
      error.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  const bulkRemitCommissions = async (commissionIds: string[]) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.post(
        `${API_URL}/commissions/bulk-remit`,
        { commissionIds },
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Refresh data
        await Promise.all([
          fetchPendingCommissions(),
          fetchCommissionSummary()
        ])
        
        return {
          success: true,
          results: response.data.data
        }
      }
      
      return { success: false, error: 'Bulk remittance failed' }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to remit commissions'
      error.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const fetchRemittanceHistory = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get(`${API_URL}/commissions/remittance-history`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        remittanceHistory.value = response.data.data.history || []
      }
    } catch (err: any) {
      console.error('Error fetching remittance history:', err)
      // Don't set error for this secondary request
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    commissions,
    summary,
    remittanceHistory,
    loading,
    error,
    pagination,
    // Computed
    pendingCommissions,
    overdueCommissions,
    totalPending,
    hasOverdue,
    // Actions
    fetchPendingCommissions,
    fetchCommissionSummary,
    fetchRemittanceHistory,
    remitCommission,
    bulkRemitCommissions,
    clearError
  }
})
