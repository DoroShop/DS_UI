<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  MagnifyingGlassIcon, 
  PaperAirplaneIcon,
  UserCircleIcon,
  CheckIcon,
  ArrowLeftIcon
} from '@heroicons/vue/24/outline'
import { useMessageStore } from '@/stores/messageStore'
import { useAuthStore } from '@/stores/authStores'
import { useRouter } from 'vue-router'
import type { Conversation, Message } from '@/types/message'

const emits = defineEmits(['navigate'])

const messageStore = useMessageStore()
const authStore = useAuthStore()
const router = useRouter()

const searchQuery = ref('')
const selectedConversation = ref<Conversation | null>(null)
const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const showConversationList = ref(true)

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
    
    // Get customer info for search
    const customerInfo = getCustomerInfo(conv)
    const customerName = customerInfo.name.toLowerCase()
    const lastMessageContent = conv.lastMessage?.content?.toLowerCase() || ''
    
    return customerName.includes(query) || lastMessageContent.includes(query)
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
  await messageStore.fetchConversations('vendor')
}

async function selectConversation(conversation: Conversation) {
  selectedConversation.value = conversation
  showConversationList.value = false // Hide conversation list on mobile
  
  // Join conversation room for real-time updates
  messageStore.joinConversation(conversation._id)
  
  // Fetch messages for this conversation
  await messageStore.fetchMessages(conversation._id)
  
  // Mark as read
  await messageStore.markAsRead(conversation._id, 'vendor')
  
  // Scroll to bottom
  await nextTick()
  scrollToBottom()
}

async function sendMessage() {
  if (!messageInput.value.trim() || !selectedConversation.value) return
  
  const vendorId = authStore.user?._id || authStore.userId
  if (!vendorId) {
    console.error('❌ [VENDOR MESSAGES] No vendor ID found')
    return
  }
  
  await messageStore.sendMessage({
    conversationId: selectedConversation.value._id,
    senderId: vendorId,
    senderType: 'vendor',
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

function backToConversations() {
  showConversationList.value = true
  selectedConversation.value = null
}

function goBackToAnalytics() {
  // Emit to parent dashboard to change active page
  emits('navigate', 'Analytics')
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

function getCustomerInfo(conversation: Conversation) {
  if (!conversation) {
    return { name: 'Unknown Customer', image: null }
  }
  
  // Check participants array first (if API returns it)
  if (conversation.participants) {
    const customer = conversation.participants.find(p => p.userType === 'customer')
    if (customer) {
      const name = customer.name || 
                   (customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : null) ||
                   customer.firstName || 'Unknown Customer'
      return { name, image: customer.imageUrl || null }
    }
  }
  
  // Fallback to customerId field
  const customer = typeof conversation.customerId === 'object' ? conversation.customerId : null
  if (customer) {
    const name = customer.name || 
                 (customer.firstName && customer.lastName ? `${customer.firstName} ${customer.lastName}` : null) ||
                 customer.firstName || 'Unknown Customer'
    return { name, image: customer.imageUrl || null }
  }
  
  return { name: 'Unknown Customer', image: null }
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
  
  // Don't auto-select first conversation - show message history first
})

onUnmounted(() => {
  // Socket cleanup is handled by the store
})
</script>

<template>
  <div class="messages-container">
    <!-- Conversations List -->
    <div 
      class="conversations-panel"
      :class="{ 'hidden-mobile': !showConversationList && selectedConversation }"
    >
      <div class="conversations-header">
        <div class="header-top">
          <button class="back-button" @click="goBackToAnalytics" title="Back to Analytics">
            <ArrowLeftIcon class="back-icon" />
          </button>
          <h2>Messages</h2>
        </div>
        <div class="search-box">
          <MagnifyingGlassIcon class="search-icon" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search customers..."
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
              v-if="getCustomerInfo(conversation).image" 
              :src="getCustomerInfo(conversation).image" 
              :alt="getCustomerInfo(conversation).name"
            />
            <UserCircleIcon v-else class="avatar-icon" />
          </div>
          
          <div class="conversation-details">
            <div class="conversation-header">
              <span class="customer-name">{{ getCustomerInfo(conversation).name }}</span>
              <span class="conversation-time">{{ formatTime(conversation.lastMessage?.createdAt || conversation.updatedAt) }}</span>
            </div>
            <div class="conversation-preview">
              <span class="last-message">{{ conversation.lastMessage?.content || 'No messages yet' }}</span>
              <span v-if="conversation.unreadCountVendor > 0" class="unread-badge">
                {{ conversation.unreadCountVendor }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-if="filteredConversations.length === 0" class="empty-state">
          <p v-if="searchQuery">No conversations found</p>
          <p v-else>No messages yet</p>
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
            title="Back to conversations"
          >
            <ArrowLeftIcon class="back-icon" />
          </button>
          
          <div class="chat-header-info">
            <div class="chat-avatar">
              <img 
                v-if="getCustomerInfo(selectedConversation).image" 
                :src="getCustomerInfo(selectedConversation).image" 
                :alt="getCustomerInfo(selectedConversation).name"
              />
              <UserCircleIcon v-else class="avatar-icon" />
            </div>
            <div>
              <h3>{{ getCustomerInfo(selectedConversation).name }}</h3>
              <span class="online-status">
                <span class="status-dot"></span>
                Customer
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
            :class="{ 'message-sent': message.senderType === 'vendor', 'message-received': message.senderType === 'customer' }"
          >
            <div class="message-bubble">
              <p>{{ message.content }}</p>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                <CheckIcon v-if="message.senderType === 'vendor' && !message.isRead" class="check-icon" />
                <CheckIcon v-if="message.senderType === 'vendor' && message.isRead" class="check-icon read" />
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
      
      <div v-else class="empty-chat">
        <p>Select a conversation to start messaging</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-container {
  display: flex;
  height: 100dvh;
  background: var(--bg-primary);
  gap: 1rem;
  overflow: hidden;
  padding: 1rem;
  min-height: 0;
  box-sizing: border-box;
  position: relative;
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
  min-height: 0;
}

.conversations-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}

.header-top {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.back-button:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateX(-2px) scale(1.05);
}

.back-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.conversations-header h2 {
  color: var(--text-primary);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
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
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(31, 139, 78, 0.1), 0 2px 8px rgba(31, 139, 78, 0.1);
  transform: translateY(-1px);
}

.search-input::placeholder {
  transition: color 0.3s ease;
}

.search-input:focus::placeholder {
  color: var(--color-primary);
  opacity: 0.7;
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

.customer-name {
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
}

.messages-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  gap: 1rem;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  transition: all 0.2s ease;
  animation: messageSlideIn 0.3s ease-out;
}

.message-bubble:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  background: linear-gradient(135deg, var(--color-primary) 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.send-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 20px rgba(31, 139, 78, 0.3);
}

.send-button:hover:not(:disabled)::before {
  width: 100%;
  height: 100%;
}

.send-button:active {
  transform: translateY(0) scale(0.98);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
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
}

/* Mobile styles */
.mobile-only {
  display: none;
}

/* Responsive */
@media (max-width: 1024px) {
  .messages-container {
    height: calc(100dvh - 120px);
  }
  
  .conversations-panel {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .messages-container {
    flex-direction: column;
    height: 100dvh;
    padding: 0;
    gap: 0;
  }
  
  .mobile-only {
    display: flex !important;
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
    display: flex !important;
  }
  
  .chat-header {
    padding: 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .chat-header-info {
    gap: 0.75rem;
  }
  
  .message {
    max-width: 85%;
  }
  
  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
    flex-shrink: 0;
  }
  
  .back-button:hover {
    background: var(--surface-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: scale(1.05);
  }
}
</style>
