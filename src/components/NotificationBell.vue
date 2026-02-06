<script setup lang="ts">
/**
 * NotificationBell Component
 * Shows notification count in header with dropdown for recent notifications
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import BellIcon from '@heroicons/vue/24/outline/BellIcon'
import XMarkIcon from '@heroicons/vue/24/outline/XMarkIcon'
import CheckIcon from '@heroicons/vue/24/outline/CheckIcon'
import BellAlertIcon from '@heroicons/vue/24/solid/BellAlertIcon'

const router = useRouter()
const notificationStore = useNotificationStore()

const showDropdown = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// Computed
const unreadCount = computed(() => notificationStore.unreadCount)
const hasUnread = computed(() => unreadCount.value > 0)
const recentNotifications = computed(() => notificationStore.notifications.slice(0, 5))

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// Get icon color based on notification type
const getTypeColor = (type: string) => {
  switch (type) {
    case 'commission_reminder': return 'type-warning'
    case 'commission_overdue': return 'type-danger'
    case 'commission_received': return 'type-success'
    case 'order': return 'type-info'
    default: return ''
  }
}

// Toggle dropdown
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
}

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

// Mark single notification as read
const markAsRead = async (notificationId: string, event: Event) => {
  event.stopPropagation()
  await notificationStore.markAsRead(notificationId)
}

// Mark all as read
const markAllAsRead = async () => {
  await notificationStore.markAllAsRead()
}

// Go to notification details
const goToNotification = async (notification: any) => {
  // Mark as read if unread
  if (!notification.isRead) {
    await notificationStore.markAsRead(notification._id)
  }
  
  // Navigate based on notification type
  if (notification.type.startsWith('commission')) {
    router.push('/vendor/commissions')
  } else if (notification.type === 'order') {
    router.push('/orders')
  } else {
    router.push('/notifications')
  }
  
  showDropdown.value = false
}

// View all notifications
const viewAll = () => {
  showDropdown.value = false
  router.push('/notifications')
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  // Fetch notifications on mount
  await notificationStore.fetchNotifications({ limit: 10 })
  
  // Fetch unread count
  await notificationStore.fetchUnreadCount()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="notification-bell" ref="dropdownRef">
    <button 
      class="bell-button" 
      :class="{ 'has-unread': hasUnread }"
      @click="toggleDropdown"
      title="Notifications"
      :aria-label="`Notifications ${hasUnread ? `(${unreadCount} unread)` : ''}`"
    >
      <component 
        :is="hasUnread ? BellAlertIcon : BellIcon" 
        class="bell-icon"
        :class="{ 'animate-ring': hasUnread }" 
      />
      <span v-if="hasUnread" class="unread-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>
    
    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="showDropdown" class="dropdown-menu">
        <div class="dropdown-header">
          <span class="header-title">Notifications</span>
          <button 
            v-if="hasUnread" 
            class="mark-all-btn"
            @click="markAllAsRead"
          >
            <CheckIcon class="btn-icon" />
            Mark all read
          </button>
        </div>
        
        <div class="dropdown-body">
          <div v-if="notificationStore.loading" class="loading-state">
            Loading...
          </div>
          
          <div v-else-if="recentNotifications.length === 0" class="empty-state">
            <BellIcon class="empty-icon" />
            <span>No notifications yet</span>
          </div>
          
          <div v-else class="notification-list">
            <div 
              v-for="notification in recentNotifications" 
              :key="notification._id"
              class="notification-item"
              :class="{ 'unread': !notification.isRead }"
              @click="goToNotification(notification)"
            >
              <div class="notification-indicator" :class="getTypeColor(notification.type)"></div>
              <div class="notification-content">
                <span class="notification-title">{{ notification.title }}</span>
                <span class="notification-message">{{ notification.message }}</span>
                <span class="notification-time">{{ formatRelativeTime(notification.createdAt) }}</span>
              </div>
              <button 
                v-if="!notification.isRead"
                class="read-btn"
                @click="markAsRead(notification._id, $event)"
                title="Mark as read"
              >
                <CheckIcon class="btn-icon" />
              </button>
            </div>
          </div>
        </div>
        
        <div class="dropdown-footer">
          <button class="view-all-btn" @click="viewAll">
            View all notifications
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
  display: flex;
  align-items: center;
}

.bell-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: none;
  border: none;
  color: var(--text-white);
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 2.75rem;
  min-width: 2.75rem;
}

.bell-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.bell-icon {
  width: var(--icon-width);
  height: var(--icon-width);
  color: var(--text-white);
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.bell-button.has-unread .bell-icon {
  color: var(--primary-color);
}

.unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  background-color: var(--primary-color-2);
  color: white;
  font-size: 0.625rem;
  font-weight: 700;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Dropdown */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 360px;
  max-height: 480px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  font-weight: 600;
  color: var(--text-primary);
}

.mark-all-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  color: var(--primary-color);
  font-size: 0.75rem;
  cursor: pointer;
  border-radius: 0.25rem;
}

.mark-all-btn:hover {
  background: var(--bg-secondary);
}

.btn-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.dropdown-body {
  max-height: 320px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--text-tertiary);
}

.empty-icon {
  width: 2rem;
  height: 2rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.notification-list {
  padding: 0.5rem 0;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.notification-item:hover {
  background: var(--bg-secondary);
}

.notification-item.unread {
  background: var(--bg-secondary);
}

.notification-indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  margin-top: 0.375rem;
  flex-shrink: 0;
  background: var(--text-tertiary);
}

.type-warning .notification-indicator,
.notification-indicator.type-warning {
  background: #f59e0b;
}

.type-danger .notification-indicator,
.notification-indicator.type-danger {
  background: #ef4444;
}

.type-success .notification-indicator,
.notification-indicator.type-success {
  background: #22c55e;
}

.type-info .notification-indicator,
.notification-indicator.type-info {
  background: #3b82f6;
}

.notification-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.notification-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.3;
}

.notification-message {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notification-time {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}

.read-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.read-btn:hover {
  background: var(--bg-tertiary);
  color: var(--primary-color);
}

.dropdown-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
}

.view-all-btn {
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.view-all-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* Animations */
.animate-ring {
  animation: ring 2s ease-in-out infinite;
}

@keyframes ring {
  0%, 100% { transform: rotate(0deg); }
  10%, 30% { transform: rotate(15deg); }
  20%, 40% { transform: rotate(-15deg); }
  50% { transform: rotate(0deg); }
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 640px) {
  .dropdown-menu {
    position: fixed;
    top: 3.5rem;
    right: 0.5rem;
    left: 0.5rem;
    width: auto;
  }
}
</style>
