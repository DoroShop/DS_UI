/**
 * Notification Store
 * Manages notification state for all users
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { getAuthHeaders } from '../types/shared'
import { useAuthStore } from './authStores'

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api/v1'

export interface Notification {
  _id: string
  type: string
  title: string
  message: string
  isRead: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  referenceType?: string
  referenceId?: string
  actionUrl?: string
  metadata?: Record<string, any>
  createdAt: string
}

export const useNotificationStore = defineStore('notification', () => {
  // State
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Computed
  const hasUnread = computed(() => unreadCount.value > 0)
  
  const urgentNotifications = computed(() =>
    notifications.value.filter(n => n.priority === 'urgent' && !n.isRead)
  )
  
  const commissionNotifications = computed(() =>
    notifications.value.filter(n => 
      n.type.includes('commission') && !n.isRead
    )
  )

  // Actions
  const fetchNotifications = async (options: {
    page?: number
    limit?: number
    type?: string
    unreadOnly?: boolean
  } = {}) => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      error.value = 'User not authenticated'
      return
    }
    
    loading.value = true
    error.value = null
    
    try {
      const params = new URLSearchParams()
      params.append('page', (options.page || 1).toString())
      params.append('limit', (options.limit || 20).toString())
      if (options.type) params.append('type', options.type)
      if (options.unreadOnly) params.append('unreadOnly', 'true')
      
      const response = await axios.get(`${API_URL}/notifications?${params}`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        notifications.value = response.data.data.notifications
        pagination.value = response.data.data.pagination
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch notifications'
      console.error('Error fetching notifications:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchUnreadCount = async () => {
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !authStore.token) {
      return
    }
    
    try {
      const response = await axios.get(`${API_URL}/notifications/unread-count`, {
        headers: getAuthHeaders(),
        withCredentials: true
      })
      
      if (response.data.success) {
        unreadCount.value = response.data.data.unreadCount
      }
    } catch (err: any) {
      console.error('Error fetching unread count:', err)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await axios.patch(
        `${API_URL}/notifications/${notificationId}/read`,
        {},
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state
        const notification = notifications.value.find(n => n._id === notificationId)
        if (notification) {
          notification.isRead = true
        }
        
        // Update unread count
        if (unreadCount.value > 0) {
          unreadCount.value--
        }
        
        return true
      }
      
      return false
    } catch (err: any) {
      console.error('Error marking notification as read:', err)
      return false
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await axios.patch(
        `${API_URL}/notifications/read-all`,
        {},
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state
        notifications.value.forEach(n => n.isRead = true)
        unreadCount.value = 0
        return true
      }
      
      return false
    } catch (err: any) {
      console.error('Error marking all as read:', err)
      return false
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await axios.delete(
        `${API_URL}/notifications/${notificationId}`,
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state
        const index = notifications.value.findIndex(n => n._id === notificationId)
        if (index !== -1) {
          const wasUnread = !notifications.value[index].isRead
          notifications.value.splice(index, 1)
          
          if (wasUnread && unreadCount.value > 0) {
            unreadCount.value--
          }
        }
        
        return true
      }
      
      return false
    } catch (err: any) {
      console.error('Error deleting notification:', err)
      return false
    }
  }

  const deleteReadNotifications = async () => {
    try {
      const response = await axios.delete(
        `${API_URL}/notifications/read`,
        { 
          headers: getAuthHeaders(),
          withCredentials: true 
        }
      )
      
      if (response.data.success) {
        // Update local state - keep only unread
        notifications.value = notifications.value.filter(n => !n.isRead)
        return true
      }
      
      return false
    } catch (err: any) {
      console.error('Error deleting read notifications:', err)
      return false
    }
  }

  // Socket.IO integration - call this when receiving real-time notification
  const addNotification = (notification: Notification) => {
    notifications.value.unshift(notification)
    if (!notification.isRead) {
      unreadCount.value++
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    // Computed
    hasUnread,
    urgentNotifications,
    commissionNotifications,
    // Actions
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteReadNotifications,
    addNotification,
    clearError
  }
})
