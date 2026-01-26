<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { XMarkIcon, MapPinIcon, TruckIcon, ClockIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { useOrderStore } from '../stores/OrderStores'
import type { Order } from '../types/order'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../composables/useTheme'

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const props = defineProps<{
  orderId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const orderStore = useOrderStore()
const { isDark } = useTheme()

const selectedOrderId = ref(props.orderId || '')
const showOrderSelection = ref(!props.orderId)
const map = ref<L.Map | null>(null)
const mapContainer = ref<HTMLElement | null>(null)
const riderMarker = ref<L.Marker | null>(null)
const trackingInterval = ref<number | null>(null)
const manualOrderId = ref('')
const isSearching = ref(false)
const alertMessage = ref<string | null>(null)
const showAlertModal = ref(false)

const showAlert = (message: string) => {
  alertMessage.value = message
  showAlertModal.value = true
}

const closeAlertModal = () => {
  showAlertModal.value = false
  alertMessage.value = null
}

// Get selected order
const selectedOrder = computed(() => {
  if (!selectedOrderId.value) return null
  return orderStore.orders.find(
    (order) => order._id === selectedOrderId.value || order.orderId === selectedOrderId.value
  )
})

// Get shipped orders for selection
const shippedOrders = computed(() => {
  // Ensure orders are loaded
  if (!orderStore.orders || orderStore.orders.length === 0) {
    return []
  }
  return orderStore.orders.filter((order) => 
    order.status === 'shipped' && 
    order.shippingOption !== 'pickup' && 
    order.shippingOption !== 'agreement' && 
    order.shippingOption !== 'customer agreement'
  )
})

// Search for order by tracking number
const searchOrderById = async () => {
  if (!manualOrderId.value.trim()) return
  
  isSearching.value = true
  try {
    // First ensure orders are loaded
    if (!orderStore.isFetch) {
      await orderStore.fetchOrders()
    }
    
    // Find the order by tracking number
    const order = orderStore.orders.find(
      (o) => o.trackingNumber === manualOrderId.value.trim() || 
             o._id === manualOrderId.value.trim() || 
             o.orderId === manualOrderId.value.trim()
    )
    
    if (order) {
      if (order.shippingOption === 'pickup') {
        showAlert('This is a pickup order and cannot be tracked on the map.')
      } else if (order.shippingOption === 'agreement' || order.shippingOption === 'customer agreement') {
        showAlert('This order uses customer agreement delivery and cannot be tracked on the map.')
      } else if (order.status === 'shipped') {
        selectedOrderId.value = order._id || order.orderId
        showOrderSelection.value = false
        manualOrderId.value = ''
        nextTick(() => {
          if (canTrack.value) {
            initMap()
          }
        })
      } else {
        showAlert(`Order found but status is "${order.status}". Only shipped orders can be tracked.`)
      }
    } else {
      showAlert('Order not found. Please check the Tracking Number and try again.')
    }
  } catch (error) {
    console.error('Error searching for order:', error)
    showAlert('Failed to search for order. Please try again.')
  } finally {
    isSearching.value = false
  }
}

// Check if order is ready for tracking
const canTrack = computed(() => {
  if (!selectedOrder.value) return false
  return selectedOrder.value.status === 'shipped'
})

// Get tracking status message
const trackingMessage = computed(() => {
  if (!selectedOrder.value) {
    return {
      type: 'info',
      message: 'Please select an order to track',
      icon: MapPinIcon
    }
  }

  if (selectedOrder.value.shippingOption === 'pickup') {
    return {
      type: 'warning',
      message: 'This is a pickup order. Please collect your order from the store.',
      icon: ClockIcon
    }
  }

  if (selectedOrder.value.status !== 'shipped') {
    return {
      type: 'info',
      message: `Your order is ${selectedOrder.value.status}. We'll notify you when it's out for delivery.`,
      icon: ClockIcon
    }
  }

  return {
    type: 'success',
    message: 'Your order is on the way!',
    icon: TruckIcon
  }
})

// Initialize map
const initMap = async () => {
  if (!mapContainer.value || !canTrack.value) return

  await nextTick()

  // Clear existing map if any
  if (map.value) {
    map.value.remove()
    map.value = null
  }

  // Customer location (default: Oriental Mindoro, Philippines)
  const customerLocation: [number, number] = selectedOrder.value?.shippingAddress?.coordinates || [13.0583, 121.0583]

  // Create map centered on customer location with higher zoom
  map.value = L.map(mapContainer.value, {
    center: customerLocation,
    zoom: 15,
    zoomControl: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    boxZoom: true,
    keyboard: true,
    dragging: true
  })

  // Add tile layer - always use standard tiles
  const tileLayer = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

  L.tileLayer(tileLayer, {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 10
  }).addTo(map.value)

  // Invalidate size to ensure proper rendering
  setTimeout(() => {
    if (map.value) {
      map.value.invalidateSize()
    }
  }, 100)

  // Only track rider - no customer marker as requested
  // Start tracking rider location
  startTracking()
}

// Start real-time tracking
const startTracking = () => {
  if (trackingInterval.value) {
    clearInterval(trackingInterval.value)
  }

  // Initial fetch
  updateRiderLocation()

  // Update every 5 seconds
  trackingInterval.value = window.setInterval(() => {
    updateRiderLocation()
  }, 5000)
}

// Update rider location
const updateRiderLocation = async () => {
  if (!selectedOrderId.value || !map.value) return

  try {
    // Fetch rider location from store
    const riderLocation = await orderStore.fetchRiderLocation(selectedOrderId.value)
    
    if (riderLocation) {
      const riderCoords: [number, number] = [riderLocation.latitude, riderLocation.longitude]
      
      // Create or update rider marker with enhanced SVG car icon
      if (!riderMarker.value) {
        const riderIcon = L.divIcon({
          className: 'custom-marker rider-marker',
          html: `
            <div class="rider-car-marker">
              <div class="car-container">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="car-icon">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
              </div>
              <div class="pulse-ring"></div>
            </div>
          `,
          iconSize: [60, 60],
          iconAnchor: [30, 30],
        })

        riderMarker.value = L.marker(riderCoords, { icon: riderIcon })
          .addTo(map.value)
          .bindPopup(`
            <div class="rider-popup">
              <strong>🚗 Delivery Rider</strong><br>
              <span>Live tracking active</span><br>
              <small>Lat: ${riderLocation.latitude.toFixed(6)}</small><br>
              <small>Lng: ${riderLocation.longitude.toFixed(6)}</small>
            </div>
          `)
      } else {
        // Smooth marker animation
        riderMarker.value.setLatLng(riderCoords)
      }

      // Always center and focus on rider location with smooth animation
      map.value.setView(riderCoords, 16, {
        animate: true,
        pan: {
          animate: true,
          duration: 1.5
        },
        zoom: {
          animate: true
        }
      })
    }
  } catch (error) {
    console.error('Error fetching rider location:', error)
  }
}

// Select order for tracking
const selectOrder = (order: Order) => {
  selectedOrderId.value = order._id || order.orderId
  showOrderSelection.value = false
  
  nextTick(() => {
    if (canTrack.value) {
      initMap()
    }
  })
}

// Show order selection
const openOrderSelection = () => {
  showOrderSelection.value = true
}

// Close modal
const closeModal = () => {
  if (trackingInterval.value) {
    clearInterval(trackingInterval.value)
  }
  if (map.value) {
    map.value.remove()
    map.value = null
  }
  emit('close')
}

// Format date
const formatDate = (dateStr: string | Date) => {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Cleanup on unmount
onBeforeUnmount(() => {
  if (trackingInterval.value) {
    clearInterval(trackingInterval.value)
  }
  if (map.value) {
    map.value.remove()
  }
})

// Watch for order selection
watch(selectedOrderId, (newVal) => {
  if (newVal && canTrack.value) {
    nextTick(() => {
      initMap()
    })
  }
})

// Initialize on mount
onMounted(async () => {
  // Ensure orders are loaded before showing the modal
  if (!orderStore.isFetch) {
    await orderStore.fetchOrders()
  }
  
  if (selectedOrderId.value && canTrack.value) {
    nextTick(() => {
      initMap()
    })
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="closeModal">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <MapPinIcon class="header-icon" />
            <h2 class="modal-title">Track Your Order</h2>
          </div>
          <button @click="closeModal" class="close-button" title="Close">
            <XMarkIcon class="close-icon" />
          </button>
        </div>

        <!-- Order Selection View -->
        <div v-if="showOrderSelection" class="order-selection">
          <div class="selection-header">
            <h3>Track Your Order</h3>
            <p>Enter your tracking number or choose from your shipped orders</p>
          </div>

          <!-- Manual Tracking Number Input -->
          <div class="manual-search">
            <div class="search-input-group">
              <input
                v-model="manualOrderId"
                type="text"
                placeholder="Enter Tracking Number (e.g., TRK123456789)"
                class="search-input"
                @keyup.enter="searchOrderById"
                :disabled="isSearching"
              />
              <button
                @click="searchOrderById"
                class="search-button"
                :disabled="isSearching || !manualOrderId.trim()"
              >
                <MagnifyingGlassIcon v-if="!isSearching" class="search-icon" />
                <div v-else class="loading-spinner"></div>
                {{ isSearching ? 'Searching...' : 'Track' }}
              </button>
            </div>
          </div>

          <!-- Divider -->
          <div class="divider">
            <span>or choose from your orders</span>
          </div>

          <div v-if="shippedOrders.length === 0" class="no-orders">
            <TruckIcon class="no-orders-icon" />
            <p>No shipped orders available for tracking</p>
          </div>

          <div v-else class="orders-list">
            <div
              v-for="order in shippedOrders"
              :key="order._id || order.orderId"
              @click="selectOrder(order)"
              class="order-item"
            >
              <div class="order-item-header">
                <span class="order-id">Order #{{ order.orderId }}</span>
                <span class="order-status">{{ order.status }}</span>
              </div>
              <div class="order-item-details">
                <p class="order-date">{{ formatDate(order.createdAt) }}</p>
                <p class="order-items">{{ order.items.length }} item(s)</p>
                <p class="tracking-number" v-if="order.trackingNumber">
                  <strong>Tracking:</strong> {{ order.trackingNumber }}
                </p>
              </div>
              <div class="order-item-footer">
                <span class="track-text">Click to track</span>
                <MapPinIcon class="track-icon" />
              </div>
            </div>
          </div>
        </div>

        <!-- Tracking View -->
        <div v-else class="tracking-view">
          <!-- Order Info -->
          <div class="order-info" v-if="selectedOrder">
            <div class="info-row">
              <span class="info-label">Order ID:</span>
              <span class="info-value">#{{ selectedOrder.orderId }}</span>
            </div>
            <div class="info-row" v-if="selectedOrder.trackingNumber">
              <span class="info-label">Tracking Number:</span>
              <span class="info-value tracking-badge">{{ selectedOrder.trackingNumber }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value status-badge">{{ selectedOrder.status }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Items:</span>
              <span class="info-value">{{ selectedOrder.items.length }} item(s)</span>
            </div>
          </div>

          <!-- Status Message -->
          <div :class="['status-message', `status-${trackingMessage.type}`]">
            <component :is="trackingMessage.icon" class="status-icon" />
            <p>{{ trackingMessage.message }}</p>
          </div>

          <!-- Map Container -->
          <div v-if="canTrack" class="map-wrapper">
            <div ref="mapContainer" class="map-container"></div>
            <div class="map-legend">
              <div class="legend-item">
                <div class="legend-marker rider"></div>
                <span>Delivery Rider</span>
              </div>
              <div class="legend-status">
                <span class="status-text">Live Tracking</span>
                <div class="live-indicator"></div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button @click="openOrderSelection" class="btn-secondary">
              Browse Orders
            </button>
            <button @click="closeModal" class="btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Alert Modal -->
  <Teleport to="body">
    <div v-if="showAlertModal" class="alert-modal-overlay" @click.self="closeAlertModal">
      <div class="alert-modal-container">
        <div class="alert-modal-header">
          <h3>Notification</h3>
          <button @click="closeAlertModal" class="alert-close-button">&times;</button>
        </div>
        <div class="alert-modal-body">
          <p>{{ alertMessage }}</p>
        </div>
        <div class="alert-modal-footer">
          <button @click="closeAlertModal" class="alert-ok-button">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-container {
  background: var(--surface);
  border-radius: var(--border-radius-lg);
  width: 100%;
  max-width: 1000px;
  max-height: 95vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
  animation: slideUp 0.3s ease;
  transition: background-color var(--transition-fast);
  overflow: auto;
  scrollbar-width: thin;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  transition: border-color var(--transition-fast);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 1.75rem;
  height: 1.75rem;
  color: var(--primary-color);
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  transition: color var(--transition-fast);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.close-icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* Order Selection */
.order-selection {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: calc(95vh - 120px);
  flex: 1;
}

.selection-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.selection-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  transition: color var(--transition-fast);
}

.selection-header p {
  color: var(--text-secondary);
  margin: 0;
  transition: color var(--transition-fast);
}

/* Manual Search */
.manual-search {
  margin-bottom: 1.5rem;
}

.search-input-group {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s ease;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
  justify-content: center;
}

.search-button:hover:not(:disabled) {
  background: #ea580c;
  transform: translateY(-1px);
}

.search-button:disabled {
  background: var(--text-secondary);
  cursor: not-allowed;
}

.search-icon {
  width: 1rem;
  height: 1rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Divider */
.divider {
  text-align: center;
  margin: 1.5rem 0;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-color);
}

.divider span {
  background: var(--surface);
  padding: 0 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  position: relative;
  z-index: 1;
}

.no-orders {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
}

.no-orders-icon {
  width: 4rem;
  height: 4rem;
  margin: 0 auto 1rem;
  opacity: 0.5;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.order-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.order-item:hover {
  border-color: var(--primary-color);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.order-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.order-id {
  font-weight: 600;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.order-status {
  background: var(--success-600);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.order-item-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.order-date,
.order-items,
.tracking-number {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  transition: color var(--transition-fast);
}

.tracking-number {
  color: var(--primary-color);
  font-weight: 500;
}

.tracking-number strong {
  color: var(--text-primary);
}

.order-item-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
  font-size: 0.875rem;
  font-weight: 500;
}

.track-icon {
  width: 1rem;
  height: 1rem;
}

/* Tracking View */
.tracking-view {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex: 1;
  max-height: calc(95vh - 100px);
}

.order-info {
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  transition: all var(--transition-fast);
}

.info-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.status-badge {
  background: var(--success-600);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  text-transform: capitalize;
}

.tracking-badge {
  background: var(--primary-color);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: monospace;
  letter-spacing: 0.5px;
}

/* Status Message */
.status-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  margin: 0;
  border-left: 4px solid;
}

.status-message.status-info {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
}

.status-message.status-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: #f59e0b;
  color: #f59e0b;
}

.status-message.status-success {
  background: rgba(34, 197, 94, 0.1);
  border-color: #22c55e;
  color: #22c55e;
}

.status-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.status-message p {
  margin: 0;
  font-weight: 500;
}

/* Map */
.map-wrapper {
  flex: 1;
  position: relative;
  min-height: 450px;
  max-height: 600px;
  padding: 1.5rem;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 450px;
  min-height: 400px;
  max-height: 550px;
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.map-legend {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--surface);
  padding: 1rem;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: background-color var(--transition-fast);
  border: 1px solid var(--border-color);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.legend-marker {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
}

.legend-marker.rider {
  background: #f97316;
  position: relative;
}

.legend-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--success-600);
  font-weight: 600;
}

.status-text {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-indicator {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-color);
  justify-content: flex-end;
  transition: border-color var(--transition-fast);
}

.btn-secondary,
.btn-primary {
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.875rem;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--surface-hover);
}

.btn-primary {
  background: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

/* Custom Marker Styles */
:deep(.custom-marker) {
  background: transparent;
  border: none;
}

:deep(.marker-pin) {
  width: 40px;
  height: 40px;
  border-radius: 50% 50% 50% 0;
  position: absolute;
  transform: rotate(-45deg);
  left: 50%;
  top: 50%;
  margin: -20px 0 0 -20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

:deep(.marker-pin svg) {
  width: 24px;
  height: 24px;
  color: white;
  transform: rotate(45deg);
}

:deep(.customer-pin) {
  background: #3b82f6;
}

:deep(.rider-pin) {
  background: #f97316;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 0 0 rgba(249, 115, 22, 0.7);
  }
  50% {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3), 0 0 0 10px rgba(249, 115, 22, 0);
  }
}

:deep(.marker-label) {
  position: absolute;
  top: 45px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--surface);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
  color: var(--text-primary);
}

:deep(.rider-label) {
  background: #f97316;
  color: white;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-container {
    width: 100%;
    height: 100dvh;
    max-width: 100%;
    max-height: 100dvh;
    border-radius: 0;
  }

  .modal-header {
    padding: 1rem;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .order-selection {
    padding: 1rem;
    max-height: calc(100dvh - 140px);
  }

  .tracking-view {
    max-height: calc(100dvh - 120px);
  }

  .modal-actions {
    padding: 1rem;
    flex-shrink: 0;
  }

  .map-wrapper {
    min-height: 350px;
    max-height: 450px;
    padding: 1rem;
  }

  .map-container {
    height: 350px;
    min-height: 300px;
    max-height: 400px;
  }

  .order-info {
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .btn-secondary,
  .btn-primary {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: 0;
  }

  .modal-container {
    height: 100dvh;
    max-height: 100dvh;
  }

  .order-selection {
    max-height: calc(100dvh - 160px);
  }

  .tracking-view {
    max-height: calc(100dvh - 140px);
  }

  .map-legend {
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.5rem;
  }

  .legend-item {
    font-size: 0.75rem;
  }

  .map-wrapper {
    min-height: 300px;
    max-height: 350px;
    padding: 0.5rem;
  }

  .map-container {
    height: 300px;
    min-height: 250px;
    max-height: 300px;
  }
}

/* Custom Car Marker Styles */
:deep(.rider-car-marker) {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.car-container) {
  position: relative;
  z-index: 3;
}

:deep(.car-icon) {
  width: 48px;
  height: 48px;
  color: #f97316;
  background: white;
  border-radius: 50%;
  padding: 10px;
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
  border: 4px solid #f97316;
  z-index: 2;
  position: relative;
  transition: all 0.3s ease;
}

:deep(.car-icon:hover) {
  transform: scale(1.1);
  box-shadow: 0 8px 25px rgba(249, 115, 22, 0.5);
}

:deep(.pulse-ring) {
  position: absolute;
  width: 60px;
  height: 60px;
  border: 3px solid #f97316;
  border-radius: 50%;
  animation: pulseRing 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  z-index: 1;
}

@keyframes pulseRing {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

/* Rider Popup Styles */
:deep(.rider-popup) {
  text-align: center;
  padding: 0.5rem;
  min-width: 150px;
}

:deep(.rider-popup strong) {
  color: var(--primary-color);
  font-size: 1rem;
}

:deep(.rider-popup span) {
  color: var(--success-600);
  font-weight: 500;
  font-size: 0.875rem;
}

:deep(.rider-popup small) {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-family: monospace;
}

/* Enhanced Modal Container */
.modal-container {
  max-width: 1000px;
  max-height: 95vh;
}

/* Improved Status Messages */
.status-message {
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(249, 115, 22, 0.05));
  border-radius: var(--border-radius-lg);
  margin: 1rem 1.5rem;
}

.status-message.status-success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
  border-color: #22c55e;
}

.status-message.status-warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
  border-color: #f59e0b;
}

.status-message.status-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
  border-color: #3b82f6;
}

/* Alert Modal */
.alert-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.alert-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.alert-modal-container {
  background: var(--surface);
  border-radius: var(--border-radius-lg);
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-xl);
  position: relative;
}

.alert-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.alert-modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.alert-close-button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 1.5rem;
  cursor: pointer;
  transition: color 0.2s ease;
}

.alert-close-button:hover {
  color: var(--primary-color);
}

.alert-modal-body {
  margin-bottom: 1.5rem;
}

.alert-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.alert-ok-button {
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  font-size: 0.875rem;
  background: var(--primary-color);
  color: white;
}

.alert-ok-button:hover {
  opacity: 0.9;
}
</style>
