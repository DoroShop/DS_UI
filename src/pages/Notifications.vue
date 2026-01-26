<script setup lang="ts">
/**
 * Notifications Page
 * Displays user notifications with filtering and actions
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useRouter } from 'vue-router'
import {
  BellIcon,
  BellAlertIcon,
  CheckIcon,
  CheckCircleIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  WalletIcon,
  CogIcon,
  InformationCircleIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline'

const notificationStore = useNotificationStore()
const router = useRouter()

// State
const activeFilter = ref<string | null>(null)
const showFilterMenu = ref(false)

// Computed
const filteredNotifications = computed(() => {
  if (!activeFilter.value) return notificationStore.notifications
  return notificationStore.notifications.filter(n => n.type.includes(activeFilter.value!))
})

// Methods
const getNotificationIcon = (type: string) => {
  if (type.includes('commission')) return BanknotesIcon
  if (type.includes('order')) return ShoppingBagIcon
  if (type.includes('wallet') || type.includes('payment')) return WalletIcon
  if (type.includes('admin')) return CogIcon
  if (type.includes('alert') || type.includes('overdue')) return ExclamationTriangleIcon
  return BellIcon
}

const getNotificationColor = (type: string, priority: string) => {
  if (priority === 'urgent') return 'notification-urgent'
  if (priority === 'high') return 'notification-high'
  if (type.includes('overdue')) return 'notification-urgent'
  if (type.includes('commission')) return 'notification-commission'
  if (type.includes('success') || type.includes('remitted')) return 'notification-success'
  return 'notification-default'
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric'
  })
}

const handleNotificationClick = async (notification: any) => {
  // Mark as read
  if (!notification.isRead) {
    await notificationStore.markAsRead(notification._id)
  }
  
  // Navigate if action URL exists
  if (notification.actionUrl) {
    router.push(notification.actionUrl)
  }
}

const handleMarkAsRead = async (e: Event, notificationId: string) => {
  e.stopPropagation()
  await notificationStore.markAsRead(notificationId)
}

const handleDelete = async (e: Event, notificationId: string) => {
  e.stopPropagation()
  await notificationStore.deleteNotification(notificationId)
}

const markAllRead = async () => {
  await notificationStore.markAllAsRead()
}

const deleteAllRead = async () => {
  if (confirm('Delete all read notifications?')) {
    await notificationStore.deleteReadNotifications()
    await notificationStore.fetchNotifications()
  }
}

const setFilter = (filter: string | null) => {
  activeFilter.value = filter
  showFilterMenu.value = false
}

const refresh = async () => {
  await notificationStore.fetchNotifications()
}

// Lifecycle
onMounted(async () => {
  await notificationStore.fetchNotifications()
})
</script>

<template>
  <div class="notifications-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-title">
          <BellIcon class="title-icon" />
          <h1>Notifications</h1>
          <span v-if="notificationStore.unreadCount > 0" class="unread-badge">
            {{ notificationStore.unreadCount }}
          </span>
        </div>
        <p class="header-subtitle">Stay updated with your account activity</p>
      </div>
      
      <div class="header-actions">
        <button class="action-btn" @click="refresh" :disabled="notificationStore.loading">
          <ArrowPathIcon class="btn-icon" :class="{ 'animate-spin': notificationStore.loading }" />
        </button>
        
        <div class="filter-dropdown">
          <button class="action-btn" @click="showFilterMenu = !showFilterMenu">
            <FunnelIcon class="btn-icon" />
          </button>
          
          <div v-if="showFilterMenu" class="filter-menu">
            <button @click="setFilter(null)" :class="{ active: !activeFilter }">
              All Notifications
            </button>
            <button @click="setFilter('commission')" :class="{ active: activeFilter === 'commission' }">
              <BanknotesIcon class="menu-icon" /> Commissions
            </button>
            <button @click="setFilter('order')" :class="{ active: activeFilter === 'order' }">
              <ShoppingBagIcon class="menu-icon" /> Orders
            </button>
            <button @click="setFilter('wallet')" :class="{ active: activeFilter === 'wallet' }">
              <WalletIcon class="menu-icon" /> Wallet
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions" v-if="notificationStore.notifications.length > 0">
      <button 
        class="quick-btn"
        @click="markAllRead"
        :disabled="notificationStore.unreadCount === 0"
      >
        <CheckCircleIcon class="btn-icon" />
        Mark all as read
      </button>
      
      <button 
        class="quick-btn danger"
        @click="deleteAllRead"
      >
        <TrashIcon class="btn-icon" />
        Clear read
      </button>
    </div>

    <!-- Urgent Notifications Banner -->
    <div v-if="notificationStore.urgentNotifications.length > 0" class="urgent-banner">
      <BellAlertIcon class="urgent-icon" />
      <span>You have {{ notificationStore.urgentNotifications.length }} urgent notification(s) requiring attention</span>
    </div>

    <!-- Notifications List -->
    <div class="notifications-list">
      <TransitionGroup name="notification-list">
        <div 
          v-for="notification in filteredNotifications" 
          :key="notification._id"
          class="notification-item"
          :class="[
            getNotificationColor(notification.type, notification.priority),
            { 'unread': !notification.isRead }
          ]"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-icon-wrapper" :class="getNotificationColor(notification.type, notification.priority)">
            <component :is="getNotificationIcon(notification.type)" class="notification-icon" />
          </div>
          
          <div class="notification-content">
            <div class="notification-header">
              <h3 class="notification-title">{{ notification.title }}</h3>
              <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
            </div>
            <p class="notification-message">{{ notification.message }}</p>
            
            <div v-if="notification.actionUrl" class="notification-action">
              <span class="action-link">View details →</span>
            </div>
          </div>
          
          <div class="notification-actions">
            <button 
              v-if="!notification.isRead"
              class="icon-btn"
              @click="handleMarkAsRead($event, notification._id)"
              title="Mark as read"
            >
              <CheckIcon class="btn-icon" />
            </button>
            <button 
              class="icon-btn danger"
              @click="handleDelete($event, notification._id)"
              title="Delete"
            >
              <TrashIcon class="btn-icon" />
            </button>
          </div>
          
          <div v-if="!notification.isRead" class="unread-indicator"></div>
        </div>
      </TransitionGroup>
    </div>

    <!-- Empty State -->
    <div v-if="notificationStore.notifications.length === 0 && !notificationStore.loading" class="empty-state">
      <BellIcon class="empty-icon" />
      <h3>No Notifications</h3>
      <p>You're all caught up! Check back later for updates.</p>
    </div>

    <!-- Loading State -->
    <div v-if="notificationStore.loading" class="loading-state">
      <ArrowPathIcon class="loading-icon animate-spin" />
      <span>Loading notifications...</span>
    </div>

    <!-- Pagination -->
    <div v-if="notificationStore.pagination.pages > 1" class="pagination">
      <button 
        :disabled="notificationStore.pagination.page === 1"
        @click="notificationStore.fetchNotifications({ page: notificationStore.pagination.page - 1 })"
      >
        Previous
      </button>
      <span>Page {{ notificationStore.pagination.page }} of {{ notificationStore.pagination.pages }}</span>
      <button 
        :disabled="notificationStore.pagination.page === notificationStore.pagination.pages"
        @click="notificationStore.fetchNotifications({ page: notificationStore.pagination.page + 1 })"
      >
        Next
      </button>
    </div>
  </div>
</template>

<style scoped>
.notifications-page {
  padding: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.title-icon {
  width: 2rem;
  height: 2rem;
  color: var(--primary-color);
}

.header-title h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.5rem;
  background: #ef4444;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 9999px;
}

.header-subtitle {
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--text-primary);
}

.filter-dropdown {
  position: relative;
}

.filter-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  z-index: 100;
}

.filter-menu button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.2s;
}

.filter-menu button:hover {
  background: var(--bg-secondary);
}

.filter-menu button.active {
  background: var(--primary-color);
  color: white;
}

.menu-icon {
  width: 1rem;
  height: 1rem;
}

/* Quick Actions */
.quick-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-btn.danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Urgent Banner */
.urgent-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  color: #ef4444;
  font-weight: 500;
}

.urgent-icon {
  width: 1.25rem;
  height: 1.25rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Notifications List */
.notifications-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.notification-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.notification-item.unread {
  background: rgba(59, 130, 246, 0.03);
}

.unread-indicator {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--primary-color);
  border-radius: 0.75rem 0 0 0.75rem;
}

.notification-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.notification-icon-wrapper.notification-default {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.notification-icon-wrapper.notification-commission {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.notification-icon-wrapper.notification-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.notification-icon-wrapper.notification-high {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.notification-icon-wrapper.notification-urgent {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.notification-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.notification-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.notification-time {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.notification-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.notification-action {
  margin-top: 0.5rem;
}

.action-link {
  font-size: 0.8125rem;
  color: var(--primary-color);
  font-weight: 500;
}

.notification-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.notification-item:hover .notification-actions {
  opacity: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
}

.icon-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.icon-btn .btn-icon {
  width: 1rem;
  height: 1rem;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  color: var(--text-tertiary);
  margin: 0 auto 1rem;
}

.empty-state h3 {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-secondary);
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.loading-icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.notification-list-enter-active,
.notification-list-leave-active {
  transition: all 0.3s ease;
}

.notification-list-enter-from,
.notification-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* Responsive */
@media (max-width: 640px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .quick-actions {
    flex-direction: column;
  }
  
  .quick-btn {
    justify-content: center;
  }
  
  .notification-actions {
    opacity: 1;
  }
}
</style>
