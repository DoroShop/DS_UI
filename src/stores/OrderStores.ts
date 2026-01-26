import { defineStore } from 'pinia'
import axios from 'axios'
import type { Order, RiderLocation } from '../types/order'
import { getAuthHeaders } from '../types/shared'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export const useOrderStore = defineStore('order', {
  state: () => ({
    orders: [] as Order[],
    statusCounts: {
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    } as Record<string, number>,
    isLoading: false,
    isLoadingMore: false,
    error: null as string | null,
    isFetch: false,
    page: 1,
    hasMore: true,
    pageCache: new Map<number, Order[]>(),
    riderLocations: new Map<string, RiderLocation>(), // Cache rider locations by orderId
    ordersScrollPosition: 0,
    isRestoringScroll: false
  }),

  getters: {
    totalOrders: (state) => state.orders.length,
    ordersByStatus: (state) => {
      return (status: Order['status']) =>
        state.orders.filter(order => order.status === status)
    },
    getOrderCount: (state) => {
      return (status: string) => state.statusCounts[status] || 0
    }
  },

  actions: {
    async fetchStatusCounts() {
      try {
        const headers = getAuthHeaders()
        const res = await axios.get(`${API_BASE_URL}/order/counts`, { headers })
        if (res.data.success) {
          this.statusCounts = res.data.data
        }
      } catch (err: any) {
        console.error('Failed to fetch status counts:', err)
      }
    },

    async fetchOrdersPage(page: number = 1, append: boolean = false) {
      if (this.pageCache.has(page)) {
        if (append) {
          this.orders = [...this.orders, ...this.pageCache.get(page)!]
        } else {
          this.orders = this.pageCache.get(page)!
        }
        return
      }

      const loadingKey = append ? 'isLoadingMore' : 'isLoading'
      this[loadingKey] = true
      this.error = null

      try {
        const headers = getAuthHeaders()
        const res = await axios.get(`${API_BASE_URL}/order?page=${page}&limit=10`, { headers })

        const { orders, pagination } = res.data
        this.pageCache.set(page, orders)

        if (append) {
          this.orders = [...this.orders, ...orders]
        } else {
          this.orders = orders
        }

        this.page = pagination.page
        this.hasMore = pagination.hasMore
        this.isFetch = true
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch orders.'
      } finally {
        this[loadingKey] = false
      }
    },

    async fetchOrders() {
      if (this.isFetch) return

      await this.fetchStatusCounts()
      await this.fetchOrdersPage(1, false)
    },

    async loadMoreOrders() {
      if (!this.hasMore || this.isLoadingMore) return

      const nextPage = this.page + 1
      await this.fetchOrdersPage(nextPage, true)
    },

    async createOrder(orderData) {
      try {
        const headers = getAuthHeaders()
        const response = await axios.post(`${API_BASE_URL}/order`, orderData, { headers })
        console.log('Order created successfully:', response.data)
        return response.data
      } catch (error) {
        console.error('Failed to create order:', error.response?.data || error.message)
        throw error
      }
    },

    async cancelOrder(orderId: string) {
      try {
        this.isLoading = true
        this.error = null
        
        if (!orderId) {
          throw new Error('Order ID is required')
        }
        
        // Get fresh auth headers for the request
        const authHeaders = getAuthHeaders()
        
        console.log('📡 Cancelling order:', orderId)
        
        const response = await axios.put(
          `${API_BASE_URL}/order/cancel/${orderId}`,
          {},
          { headers: authHeaders }
        )
        
        console.log('Order cancelled successfully:', response.data)
        
        // Update local order status if the order exists in our store
        const orderIndex = this.orders.findIndex(order => order._id === orderId || order.orderId === orderId)
        if (orderIndex !== -1) {
          this.orders[orderIndex].status = 'cancelled'
        }
        
        return response.data
      } catch (error) {
        console.error('Failed to cancel order:', error)
        this.error = error?.response?.data?.message || 'Failed to cancel order.'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async fetchRiderLocation(orderId: string): Promise<RiderLocation | null> {
      try {
        const headers = getAuthHeaders()
        
        // In production, this would be a real API call
        // For now, we'll simulate rider location that moves over time
        const response = await axios.get(`${API_BASE_URL}/order/tracking/${orderId}`, {
          headers
        }).catch(() => {
          // Fallback to simulated data if API doesn't exist yet
          return { data: this.simulateRiderLocation(orderId) }
        })
        
        const riderLocation: RiderLocation = response.data
        
        // Cache the location
        this.riderLocations.set(orderId, riderLocation)
        
        return riderLocation
      } catch (error) {
        console.error('Failed to fetch rider location:', error)
        
        // Return simulated location as fallback
        return this.simulateRiderLocation(orderId)
      }
    },

    async requestRefund(orderId: string, reason: string, reasonDetails?: string) {
      try {
        this.isLoading = true
        this.error = null
        
        if (!orderId) {
          throw new Error('Order ID is required')
        }
        
        const authHeaders = getAuthHeaders()
        console.log('📡 Requesting refund for order:', orderId)
        
        const response = await axios.post(
          `${API_BASE_URL}/order/${orderId}/request-refund`,
          { reason, reasonDetails },
          { headers: authHeaders }
        )
        
        console.log('Refund requested successfully:', response.data)
        
        // Update local order if exists
        const orderIndex = this.orders.findIndex(order => order._id === orderId || order.orderId === orderId)
        if (orderIndex !== -1) {
          this.orders[orderIndex].refundStatus = 'requested'
          this.orders[orderIndex].status = 'refund_requested'
        }

        // Force refresh to ensure cached lists reflect the new refund state
        this.isFetch = false
        await this.fetchOrders()

        return response.data
      } catch (error: any) {
        console.error('Failed to request refund:', error)
        this.error = error?.response?.data?.message || 'Failed to request refund.'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    async cancelRefund(orderId: string) {
      try {
        this.isLoading = true
        this.error = null

        if (!orderId) {
          throw new Error('Order ID is required')
        }

        const authHeaders = getAuthHeaders()
        const response = await axios.post(
          `${API_BASE_URL}/order/${orderId}/cancel-refund`,
          {},
          { headers: authHeaders }
        )

        const orderIndex = this.orders.findIndex(order => order._id === orderId || order.orderId === orderId)
        if (orderIndex !== -1) {
          this.orders[orderIndex].refundStatus = 'cancelled'
          this.orders[orderIndex].status = 'delivered'
        }

        this.isFetch = false
        await this.fetchOrders()

        return response.data
      } catch (error: any) {
        console.error('Failed to cancel refund:', error)
        this.error = error?.response?.data?.message || 'Failed to cancel refund.'
        throw error
      } finally {
        this.isLoading = false
      }
    },

    // Force refresh orders (bypass isFetch flag)
    async refreshOrders() {
      this.isFetch = false
      return this.fetchOrders()
    },

    simulateRiderLocation(orderId: string): RiderLocation {
      // Get order to find customer location
      const order = this.orders.find(o => o._id === orderId || o.orderId === orderId)
      
      if (!order) {
        // Default location: Oriental Mindoro center
        return {
          latitude: 13.0583,
          longitude: 121.0583,
          timestamp: new Date(),
          speed: 0,
          heading: 0
        }
      }

      // Get customer coordinates or use default
      const customerCoords = order.shippingAddress?.coordinates || [13.0583, 121.0583]
      
      // Get cached location or create initial position
      const cached = this.riderLocations.get(orderId)
      
      if (cached) {
        // Move rider slightly towards customer (simulate movement)
        const currentLat = cached.latitude
        const currentLng = cached.longitude
        const targetLat = customerCoords[0]
        const targetLng = customerCoords[1]
        
        // Calculate movement (0.0005 degrees per update, about 55 meters)
        const latDiff = targetLat - currentLat
        const lngDiff = targetLng - currentLng
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)
        
        if (distance < 0.001) {
          // Already very close, don't move
          return {
            ...cached,
            timestamp: new Date()
          }
        }
        
        const step = 0.0005
        const ratio = step / distance
        
        return {
          latitude: currentLat + (latDiff * ratio),
          longitude: currentLng + (lngDiff * ratio),
          timestamp: new Date(),
          speed: 25, // km/h
          heading: Math.atan2(lngDiff, latDiff) * 180 / Math.PI
        }
      } else {
        // Initial position: Start from a point away from customer
        // Offset by ~0.01 degrees (about 1.1 km)
        return {
          latitude: customerCoords[0] - 0.01,
          longitude: customerCoords[1] + 0.008,
          timestamp: new Date(),
          speed: 25,
          heading: 45
        }
      }
    },

    clearRiderLocation(orderId: string) {
      this.riderLocations.delete(orderId)
    }

  }
})
