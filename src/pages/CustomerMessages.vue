<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  MagnifyingGlassIcon, 
  PaperAirplaneIcon,
  UserCircleIcon,
  CheckIcon,
  ArrowLeftIcon
} from '@heroicons/vue/24/outline'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../stores/authStores'
import { useVendorStore } from '../stores/vendorStores'
import { useRouter } from 'vue-router'
import type { Conversation, Message } from '../types/message'

const messageStore = useMessageStore()
const authStore = useAuthStore()
const vendorStore = useVendorStore()
const router = useRouter()

const searchQuery = ref('')
const selectedConversation = ref<Conversation | null>(null)
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const showConversationList = ref(true)
const vendorDetails = ref(new Map())

// Computed properties
const filteredConversations = computed(() => {
  // Ensure conversations is an array
  const conversations = Array.isArray(messageStore.conversations) ? messageStore.conversations : []
  
  if (!searchQuery.value.trim()) {
    return conversations
  }
  
  const query = searchQuery.value.toLowerCase()
  return conversations.filter(conv => {
    if (!conv) return false
    
    // Get vendor info for search
    const vendorInfo = getVendorInfo(conv)
    const vendorName = vendorInfo.name.toLowerCase()
    const lastMessageContent = conv.lastMessage?.content?.toLowerCase() || ''
    
    return vendorName.includes(query) || lastMessageContent.includes(query)
  })
})

const currentConversationMessages = computed(() => {
  if (!selectedConversation.value) return []
  return messageStore.messages[selectedConversation.value._id] || []
})

const isTyping = computed(() => {
  if (!selectedConversation.value) return false
  return messageStore.typingUsers.has(selectedConversation.value._id)
})

// Methods
async function loadConversations() {
  await messageStore.fetchConversations('customer')
  
  // Pre-fetch vendor details for all conversations
  const vendorIds = new Set()
  messageStore.conversations.forEach(conv => {
    let vendorId = null
    if (conv.participants) {
      const vendor = conv.participants.find(p => p.userType === 'vendor')
      if (vendor) vendorId = vendor._id
    } else if (typeof conv.vendorId === 'string') {
      vendorId = conv.vendorId
    } else if (conv.vendorId && typeof conv.vendorId === 'object') {
      vendorId = conv.vendorId._id
    }
    
    if (vendorId && !vendorDetails.value.has(vendorId)) {
      vendorIds.add(vendorId)
    }
  })
  
  // Fetch details for all unique vendors
  vendorIds.forEach(vendorId => {
    fetchVendorDetails(vendorId as string)
  })
}

async function selectConversation(conversation: Conversation) {
  selectedConversation.value = conversation
  showConversationList.value = false
  
  // Join conversation room for real-time updates
  messageStore.joinConversation(conversation._id)
  
  // Fetch messages for this conversation
  await messageStore.fetchMessages(conversation._id)
  
  // Mark as read
  await messageStore.markAsRead(conversation._id, 'customer')
  
  // Scroll to bottom
  await nextTick()
  scrollToBottom()
}

function backToConversations() {
  showConversationList.value = true
  selectedConversation.value = null
}

async function sendMessage() {
  if (!messageInput.value.trim() || !selectedConversation.value) return
  
  const customerId = authStore.user?._id || authStore.userId
  if (!customerId) {
    console.error('❌ [CUSTOMER MESSAGES] No customer ID found')
    return
  }
  
  await messageStore.sendMessage({
    conversationId: selectedConversation.value._id,
    senderId: customerId,
    senderType: 'customer',
    content: messageInput.value.trim(),
    messageType: 'text'
  })
  
  messageInput.value = ''
  
  // Scroll to bottom after sending
  await nextTick()
  scrollToBottom()
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatTime(date: string | Date) {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  
  return d.toLocaleDateString()
}

function getVendorInfo(conversation: Conversation) {
  if (!conversation) {
    return { name: 'Unknown Seller', image: null }
  }
  
  let vendorId = null
  
  // Extract vendor ID
  if (conversation.participants) {
    const vendor = conversation.participants.find(p => p.userType === 'vendor')
    if (vendor) {
      vendorId = vendor._id
    }
  } else if (typeof conversation.vendorId === 'string') {
    vendorId = conversation.vendorId
  } else if (conversation.vendorId && typeof conversation.vendorId === 'object') {
    vendorId = conversation.vendorId._id
  }
  
  // Check if we have cached vendor details
  if (vendorId && vendorDetails.value.has(vendorId)) {
    const details = vendorDetails.value.get(vendorId)
    return {
      name: details.storeName || details.name || 'Unknown Seller',
      image: details.imageUrl || null
    }
  }
  
  // If vendor ID exists, fetch details asynchronously
  if (vendorId && !vendorDetails.value.has(vendorId)) {
    fetchVendorDetails(vendorId)
  }
  
  // Fallback to basic info while we fetch details
  if (conversation.participants) {
    const vendor = conversation.participants.find(p => p.userType === 'vendor')
    if (vendor) {
      const name = vendor.name || 
                   (vendor.firstName && vendor.lastName ? `${vendor.firstName} ${vendor.lastName}` : null) ||
                   vendor.firstName || 'Unknown Seller'
      return { name, image: vendor.imageUrl || null }
    }
  }
  
  const vendor = typeof conversation.vendorId === 'object' ? conversation.vendorId : null
  if (vendor) {
    const name = vendor.name || 
                 (vendor.firstName && vendor.lastName ? `${vendor.firstName} ${vendor.lastName}` : null) ||
                 vendor.firstName || 'Unknown Seller'
    return { name, image: vendor.imageUrl || null }
  }
  
  return { name: 'Unknown Seller', image: null }
}

// Function to fetch vendor details
async function fetchVendorDetails(vendorId: string) {
  try {
    await vendorStore.fetchSellerInfo(vendorId)
    if (vendorStore.vendorData) {
      vendorDetails.value.set(vendorId, {
        storeName: vendorStore.vendorData.storeName,
        name: vendorStore.vendorData.storeName || 'Unknown Seller', 
        imageUrl: vendorStore.vendorData.imageUrl
      })
    }
  } catch (error) {
    console.error('Failed to fetch vendor details:', error)
  }
}

// Watch for new messages to auto-scroll
watch(() => currentConversationMessages.value.length, () => {
  nextTick(() => scrollToBottom())
})

// Lifecycle
onMounted(async () => {
  // Initialize socket connection
  await messageStore.initializeSocket()
  
  // Load conversations
  await loadConversations()
  
  // Join all conversation rooms for real-time updates
  messageStore.conversations.forEach(conv => {
    messageStore.joinConversation(conv._id)
  })
  
  // Auto-select first conversation on desktop if available
  if (window.innerWidth >= 1024 && messageStore.conversations.length > 0 && !selectedConversation.value) {
    await selectConversation(messageStore.conversations[0])
    showConversationList.value = true // Keep list visible on desktop
  }
})

onUnmounted(() => {
  // Socket cleanup is handled by the store
})
</script>

<template>
  <div class="customer-messages-page">
    <div class="messages-container">
        <!-- Conversations List -->
        <div 
          class="conversations-panel" 
          :class="{ 'hidden-mobile': !showConversationList && selectedConversation }"
        >
          <div class="conversations-header">
            <div class="conversations-header-top">
              <button class="back-button-header" @click="router.push('/products')">
                <ArrowLeftIcon class="back-icon" />
              </button>
              <h2>Messages</h2>
            </div>
            <div class="search-box">
              <MagnifyingGlassIcon class="search-icon" />
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Search sellers..."
                class="search-input"
              />
            </div>
          </div>
          
          <div class="conversations-list">
            <div 
              v-for="conversation in filteredConversations" 
              :key="conversation._id"
              class="conversation-item"
              :class="{ active: selectedConversation?._id === conversation._id }"
              @click="selectConversation(conversation)"
            >
              <div class="conversation-avatar">
                <img 
                  v-if="getVendorInfo(conversation).image" 
                  :src="getVendorInfo(conversation).image" 
                  :alt="getVendorInfo(conversation).name"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                  loading="lazy"
                />
                <UserCircleIcon v-else class="avatar-icon" />
              </div>
              
              <div class="conversation-details">
                <div class="conversation-header">
                  <span class="vendor-name">{{ getVendorInfo(conversation).name }}</span>
                  <span class="conversation-time">{{ formatTime(conversation.lastMessage?.createdAt || conversation.updatedAt) }}</span>
                </div>
                <div class="conversation-preview">
                  <span class="last-message">{{ conversation.lastMessage?.content || 'No messages yet' }}</span>
                  <span v-if="conversation.unreadCountCustomer > 0" class="unread-badge">
                    {{ conversation.unreadCountCustomer }}
                  </span>
                </div>
              </div>
            </div>
            
            <div v-if="filteredConversations.length === 0" class="empty-state">
              <p v-if="searchQuery">No conversations found</p>
              <p v-else>No messages yet. Start chatting with sellers!</p>
            </div>
          </div>
        </div>
        
        <!-- Messages Panel -->
        <div 
          class="messages-panel"
          :class="{ 'visible-mobile': selectedConversation && !showConversationList }"
        >
          <div v-if="selectedConversation" class="messages-content">
            <!-- Chat Header -->
            <div class="chat-header">
              <button 
                class="back-button mobile-only" 
                @click="backToConversations"
              >
                <ArrowLeftIcon class="back-icon" />
              </button>
              
              <div class="chat-header-info">
                <div class="chat-avatar">
                  <img 
                    v-if="getVendorInfo(selectedConversation).image" 
                    :src="getVendorInfo(selectedConversation).image" 
                    :alt="getVendorInfo(selectedConversation).name"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                    loading="lazy"
                  />
                  <UserCircleIcon v-else class="avatar-icon" />
                </div>
                <div>
                  <h3>{{ getVendorInfo(selectedConversation).name }}</h3>
                  <span class="online-status">
                    <span class="status-dot"></span>
                    Seller
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Messages List -->
            <div ref="messagesContainer" class="messages-list">
              <div 
                v-for="message in currentConversationMessages" 
                :key="message._id"
                class="message"
                :class="{ 'message-sent': message.senderType === 'customer', 'message-received': message.senderType === 'vendor' }"
              >
                <div class="message-bubble">
                  <p>{{ message.content }}</p>
                  <div class="message-meta">
                    <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                    <CheckIcon v-if="message.senderType === 'customer' && !message.isRead" class="check-icon" />
                    <CheckIcon v-if="message.senderType === 'customer' && message.isRead" class="check-icon read" />
                  </div>
                </div>
              </div>
              
              <div v-if="isTyping" class="typing-indicator">
                <div class="typing-bubble">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
            
            <!-- Message Input -->
            <div class="message-input-container">
              <input 
                v-model="messageInput"
                type="text"
                placeholder="Type a message..."
                class="message-input"
                @keypress="handleKeyPress"
              />
              <button 
                @click="sendMessage" 
                class="send-button"
                :disabled="!messageInput.trim()"
              >
                <PaperAirplaneIcon class="send-icon" />
              </button>
            </div>
          </div>
          
          <div v-else class="empty-chat desktop-only">
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
    </div>
  </div>
</template>

<style scoped>
/* Fullscreen Design */
.customer-messages-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary);
  overflow: hidden;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

/* Hide MobileNav on messaging page */
:deep(.mobile-nav) {
  display: none !important;
}

.messages-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  overflow: hidden;
}

.back-icon {
  width: 20px;
  height: 20px;
}

.page-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.messages-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  padding: 1rem;
  box-sizing: border-box;
}

.messages-container {
  display: flex;
  flex: 1;
  background: var(--bg-primary);
  gap: 1rem;
  overflow: hidden;
  padding: 1rem;
  min-height: 0;
  height: 100%;
}

/* Conversations Panel */
.conversations-panel {
  width: 350px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-primary);
}

.conversations-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.conversations-header-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.back-button-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
  position: relative;
  overflow: hidden;
}

.back-button-header::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(31, 139, 78, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.back-button-header:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateX(-3px) scale(1.05);
}

.back-button-header:hover::before {
  width: 100%;
  height: 100%;
}

.back-icon {
  width: 20px;
  height: 20px;
}

.conversations-header h2 {
  color: var(--text-primary);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  flex: 1;
}

.search-box {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
}

.search-input {
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1);
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-primary);
  transition: all 0.3s ease;
  position: relative;
}

.conversation-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: linear-gradient(135deg, var(--color-primary) 0%, #059669 100%);
  transition: width 0.3s ease;
}

.conversation-item:hover {
  background: var(--surface-hover);
  transform: translateX(4px);
}

.conversation-item:hover::before {
  width: 4px;
}

.conversation-item.active {
  background: rgba(31, 139, 78, 0.08);
  transform: translateX(4px);
}

.conversation-item.active::before {
  width: 4px;
}

.conversation-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-secondary);
  position: relative;
  transition: transform 0.2s ease;
}

.conversation-avatar::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #059669);
  opacity: 0;
  z-index: -1;
  transition: opacity 0.2s ease;
}

.conversation-item:hover .conversation-avatar {
  transform: scale(1.05);
}

.conversation-item:hover .conversation-avatar::after {
  opacity: 1;
}

.conversation-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-icon {
  width: 100%;
  height: 100%;
  color: var(--text-secondary);
}

.conversation-details {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.vendor-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.conversation-time {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.conversation-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  background: var(--color-primary);
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
}

/* Messages Panel */
.messages-panel {
  flex: 1;
  background: var(--surface);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-primary);
  min-height: 0;
  height: 100%;
}

.messages-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chat-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  background: var(--surface-hover);
  border: 1px solid var(--border-primary);
  padding: 0.5rem;
  cursor: pointer;
  color: var(--text-primary);
  border-radius: var(--radius-md);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-button:hover {
  background: var(--bg-secondary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.back-icon {
  width: 24px;
  height: 24px;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.chat-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-secondary);
}

.chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.125rem;
  font-weight: 600;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
}

.message {
  display: flex;
  max-width: 70%;
}

.message-sent {
  align-self: flex-end;
}

.message-received {
  align-self: flex-start;
}

.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-sent .message-bubble {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-bottom-right-radius: 0.25rem;
}

.message-received .message-bubble {
  background: var(--surface);
  color: var(--text-primary);
  border-bottom-left-radius: 0.25rem;
  border: 1px solid var(--border-primary);
}

.message-bubble p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  word-wrap: break-word;
}

.message-sent .message-bubble p {
  color: white;
}

.message-received .message-bubble p {
  color: var(--text-primary);
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  justify-content: flex-end;
}

.message-time {
  font-size: 0.75rem;
  opacity: 0.8;
}

.check-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.check-icon.read {
  color: #60d69e;
  opacity: 1;
}

.typing-indicator {
  align-self: flex-start;
  max-width: 70%;
}

.typing-bubble {
  background: var(--bg-secondary);
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.typing-bubble span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  animation: typing 1.4s infinite;
}

.typing-bubble span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-bubble span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.message-input-container {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--border-primary);
  background: var(--bg-primary);
}

.message-input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1);
}

.send-button {
  padding: 0.875rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-icon {
  width: 20px;
  height: 20px;
}

.empty-state,
.empty-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.empty-state {
  padding: 2rem;
  text-align: center;
}

.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

/* Responsive */
@media (max-width: 1024px) {
  .messages-wrapper {
    padding: 1rem 0.5rem;
    padding-top: 70px;
    padding-bottom: 70px;
  }
  
  .messages-container {
    height: calc(100dvh - 150px);
  }
  
  .conversations-panel {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .mobile-only {
    display: flex !important;
  }
  
  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: var(--surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.3s ease;
    margin-right: 1rem;
  }
  
  .back-button:hover {
    background: var(--surface-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: scale(1.05);
  }
  
  .customer-messages-page {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    overflow: hidden;
  }

  .messages-wrapper {
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .messages-header {
    padding: 0.75rem 1rem;
    flex-shrink: 0;
  }
  
  .page-title {
    font-size: 1.25rem;
  }
  
  .messages-container {
    flex: 1;
    padding: 0;
    gap: 0;
    overflow: hidden;
    position: relative;
  }
  
  .back-button {
    display: flex;
  }
  
  .conversations-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    border-radius: 0;
    border: none;
    z-index: 1;
  }
  
  .conversations-panel.hidden-mobile {
    display: none;
  }
  
  .messages-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    border-radius: 0;
    border: none;
    background: var(--bg-primary);
    z-index: 2;
    display: none;
  }
  
  .messages-panel.visible-mobile {
    display: block !important;
  }
  
  .messages-content {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-areas: 
      "header"
      "messages"
      "input";
  }
  
  .chat-header {
    grid-area: header;
    padding: 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border-primary);
  }
  
  .messages-list {
    grid-area: messages;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem 0.75rem;
    background: var(--bg-primary);
  }

  .message-input-container {
    grid-area: input;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem;
    border-top: 1px solid var(--border-primary);
    background: var(--surface);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .message-input {
    flex: 1;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s;
  }

  .message-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1);
  }
  
  .send-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
  }

  .send-button:active {
    transform: scale(0.95);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-icon {
    width: 22px;
    height: 22px;
  }
  
  .back-button.mobile-only {
    display: flex;
  }
  
  .desktop-only {
    display: none;
  }
  
  .message {
    max-width: 85%;
  }

  .conversations-list {
    flex: 1;
    overflow-y: auto;
  }
}
</style>