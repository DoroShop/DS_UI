<template>
  <div class="chat-view-container">
    <!-- Chat Header -->
    <div class="chat-header">
      <button class="back-button" @click="goBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5m7-7-7 7 7 7" />
        </svg>
      </button>

      <div class="chat-contact-info" v-if="currentChat">
        <img class="header-avatar" :src="currentChat.avatar" :alt="currentChat.name" />
        <div>
          <h3 class="header-name">{{ currentChat.name }}</h3>
          <p class="header-status">{{ currentChat.online ? 'Online' : 'Last seen recently' }}</p>
        </div>
      </div>
    </div>

    <!-- Messages Container -->
    <div class="messages-container" ref="messagesContainer" v-if="currentChat">
      <div v-for="(msg, idx) in currentChat.messages" :key="idx"
        :class="['message-bubble', msg.from === 'me' ? 'sent' : 'received']">
        <div class="message-content">
          {{ msg.text }}
        </div>
        <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input-container" :class="{ 'keyboard-focused': isKeyboardActive }">
      <form class="message-form" @submit.prevent="sendMessage">
        <div class="input-wrapper">
          <input 
            v-model="messageInput" 
            type="text" 
            placeholder="Type a message..." 
            class="message-input"
            ref="messageInputRef"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
          />
          <button type="submit" class="send-button" :disabled="!messageInput.trim()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

// Router
const router = useRouter()
const route = useRoute()

// Props
const props = defineProps<{
  chatId: string
}>()

// Types
interface Message {
  from: string
  text: string
  timestamp: Date
}

interface Conversation {
  id: number
  name: string
  avatar: string
  lastMessage: string
  timestamp: Date
  online: boolean
  unreadCount: number
  messages: Message[]
}

// Reactive state
const messageInput = ref('')
const isKeyboardActive = ref(false)

// Refs
const messagesContainer = ref<HTMLElement>()
const messageInputRef = ref<HTMLInputElement>()

// Keyboard handling
let initialViewportHeight = 0
let resizeTimeout: number | null = null

// Mock conversations data (same as in MessagingInterface)
const conversations = ref<Conversation[]>([
  {
    id: 1,
    name: 'Sarah Johnson',
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    lastMessage: 'Hey! How are you doing today?',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    online: true,
    unreadCount: 0,
    messages: [
      { from: 'me', text: 'Hi Sarah! How have you been?', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
      { from: 'Sarah', text: 'Hey! I\'ve been great, thanks for asking. How about you?', timestamp: new Date(Date.now() - 1000 * 60 * 50) },
      { from: 'me', text: 'I\'m doing well! Just finished a great workout session.', timestamp: new Date(Date.now() - 1000 * 60 * 45) },
      { from: 'Sarah', text: 'That\'s awesome! What kind of workout did you do?', timestamp: new Date(Date.now() - 1000 * 60 * 40) },
      { from: 'me', text: 'I did some yoga and cardio. Really helps me stay focused!', timestamp: new Date(Date.now() - 1000 * 60 * 35) },
      { from: 'Sarah', text: 'Hey! How are you doing today?', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    ]
  },
  {
    id: 2,
    name: 'Mike Chen',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    lastMessage: 'The project looks great! 👍',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    online: false,
    unreadCount: 0,
    messages: [
      { from: 'me', text: 'Hey Mike! Did you get a chance to review the project?', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3) },
      { from: 'Mike', text: 'Yes, I just finished looking at it. Really impressive work!', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5) },
      { from: 'me', text: 'Thanks! I put a lot of effort into the user interface.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.3) },
      { from: 'Mike', text: 'It shows! The design is clean and intuitive.', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.1) },
      { from: 'Mike', text: 'The project looks great! 👍', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    ]
  }
])

// Computed
const currentChat = computed(() => {
  const chatId = parseInt(props.chatId)
  return conversations.value.find(chat => chat.id === chatId)
})

// Methods
const goBack = () => {
  router.push('/')
}

const sendMessage = () => {
  if (!messageInput.value.trim() || !currentChat.value) return

  const newMessage: Message = {
    from: 'me',
    text: messageInput.value.trim(),
    timestamp: new Date()
  }

  currentChat.value.messages.push(newMessage)
  currentChat.value.lastMessage = newMessage.text
  currentChat.value.timestamp = newMessage.timestamp

  messageInput.value = ''

  nextTick(() => {
    scrollToBottom(messagesContainer.value)
  })

  // Simulate reply after 1-2 seconds
  setTimeout(() => {
    if (currentChat.value) {
      const replies = [
        'That sounds interesting!',
        'I see what you mean.',
        'Thanks for sharing that with me.',
        'That\'s a great point!',
        'I appreciate you telling me that.',
        'Interesting perspective!',
      ]

      const reply: Message = {
        from: currentChat.value.name,
        text: replies[Math.floor(Math.random() * replies.length)],
        timestamp: new Date()
      }

      currentChat.value.messages.push(reply)
      currentChat.value.lastMessage = reply.text
      currentChat.value.timestamp = reply.timestamp

      nextTick(() => {
        scrollToBottom(messagesContainer.value)
      })
    }
  }, 1000 + Math.random() * 1000)
}

const scrollToBottom = (element: HTMLElement | undefined) => {
  if (element) {
    element.scrollTop = element.scrollHeight
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`

  return date.toLocaleDateString()
}

// Keyboard handling
const handleViewportResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  
  resizeTimeout = setTimeout(() => {
    const currentHeight = window.visualViewport?.height || window.innerHeight
    const heightDifference = initialViewportHeight - currentHeight
    
    if (heightDifference > 150) {
      isKeyboardActive.value = true
      nextTick(() => {
        if (messageInputRef.value) {
          messageInputRef.value.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          })
        }
      })
    } else {
      isKeyboardActive.value = false
    }
  }, 100)
}

const handleInputFocus = () => {
  isKeyboardActive.value = true
  
  setTimeout(() => {
    if (messageInputRef.value) {
      messageInputRef.value.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, 300)
}

const handleInputBlur = () => {
  setTimeout(() => {
    if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
      isKeyboardActive.value = false
    }
  }, 100)
}

// Lifecycle
onMounted(() => {
  initialViewportHeight = window.visualViewport?.height || window.innerHeight
  
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize)
  } else {
    window.addEventListener('resize', handleViewportResize)
  }
  
  nextTick(() => {
    scrollToBottom(messagesContainer.value)
  })
})

onUnmounted(() => {
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize)
  } else {
    window.removeEventListener('resize', handleViewportResize)
  }
  
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
})
</script>

<style scoped>
:root {
  --primary-color: #10b981;
}

.chat-view-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Chat Header */
.chat-header {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
}

.back-button {
  background: none;
  border: none;
  padding: 0.5rem;
  margin-right: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s ease;
}

.back-button:hover {
  background: #e2e8f0;
  color: var(--primary-color);
}

.back-button svg {
  width: 20px;
  height: 20px;
}

.chat-contact-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.header-name {
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  font-size: 1.1rem;
}

.header-status {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0;
}

/* Messages Container */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  scroll-behavior: smooth;
  min-height: 0;
}

.message-bubble {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  animation: messageSlideIn 0.3s ease-out;
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

.message-bubble.sent {
  align-self: flex-end;
}

.message-bubble.received {
  align-self: flex-start;
}

.message-content {
  padding: 0.75rem 1rem;
  border-radius: 18px;
  font-size: 0.95rem;
  line-height: 1.4;
  word-wrap: break-word;
}

.message-bubble.sent .message-content {
  background: linear-gradient(135deg, var(--primary-color) 0%, #2b7061 100%);
  color: white;
  border-bottom-right-radius: 6px;
}

.message-bubble.received .message-content {
  background: #f1f5f9;
  color: #1e293b;
  border-bottom-left-radius: 6px;
}

.message-time {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.25rem;
  align-self: flex-end;
}

.message-bubble.received .message-time {
  align-self: flex-start;
}

/* Message Input */
.message-input-container {
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.message-input-container.keyboard-focused {
  position: sticky;
  bottom: 0;
  z-index: 100;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
}

.message-form {
  display: flex;
}

.input-wrapper {
  display: flex;
  width: 100%;
  background: #f8fafc;
  border-radius: 24px;
  padding: 4px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.input-wrapper:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  transform: translateY(-1px);
}

.message-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  outline: none;
  color: #1e293b;
  min-height: 44px;
}

.message-input::placeholder {
  color: #94a3b8;
}

.send-button {
  background: linear-gradient(135deg, var(--primary-color) 0%, #177c66 100%);
  border: none;
  border-radius: 20px;
  padding: 0.75rem;
  cursor: pointer;
  color: white;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}

.send-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #197954 0%, #127759 100%);
  transform: scale(1.05);
}

.send-button:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  transform: none;
}

.send-button svg {
  width: 18px;
  height: 18px;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .message-bubble {
    max-width: 85%;
  }

  .message-content {
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
  }

  .message-input-container.keyboard-focused {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
  }

  .message-input {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}

/* Custom Scrollbar */
.messages-container::-webkit-scrollbar {
  width: 4px;
}

.messages-container::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>