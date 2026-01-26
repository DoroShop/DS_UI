<template>
  <div class="messaging-interface" :class="{ 'keyboard-active': isKeyboardActive }">
    <!-- Enhanced Top Navigation -->
    <div class="tab-navigation">
      <div class="tab-nav-container">
        <button :class="['tab-button', { 'active': activeTab === 'messages' }]" @click="switchTab('messages')">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Messages
          <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
        </button>
        <button :class="['tab-button', { 'active': activeTab === 'chatbot' }]" @click="switchTab('chatbot')">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6" />
            <path d="m15.5 3.5-3 3-3-3" />
            <path d="m15.5 20.5-3-3-3 3" />
          </svg>
          AI Assistant
          <div class="online-indicator"></div>
        </button>
      </div>
    </div>

    <!-- Enhanced Slideable Container with Swipe Support -->
    <div class="content-container" ref="contentContainer" @touchstart="handleTouchStart" @touchmove="handleTouchMove"
      @touchend="handleTouchEnd" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp">
      <div class="sliding-content" :class="{ 'transitioning': isTransitioning }" :style="{
        transform: `translateX(calc(${activeTab === 'messages' ? '0%' : '-50%'} + ${swipeOffset}px))`,
        transition: isTransitioning ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
      }">
        <!-- Enhanced Messages Tab -->
        <div class="tab-panel messages-panel">
          <!-- Conversation List -->
          <div class="conversations-list">
            <div class="list-header">
              <h2>Messages</h2>
              <p class="subtitle">{{ conversations.length }} conversations</p>
            </div>

            <div class="conversations-container">
              <div v-for="(chat, index) in conversations" :key="chat.id" class="conversation-item"
                @click="navigateToChat(chat)">
                <div class="avatar-container">
                  <img class="avatar" :src="chat.avatar" :alt="chat.name" />
                  <div v-if="chat.online" class="online-status"></div>
                </div>

                <div class="conversation-info">
                  <div class="conversation-header">
                    <h3 class="contact-name">{{ chat.name }}</h3>
                    <span class="timestamp">{{ formatTime(chat.timestamp) }}</span>
                  </div>
                  <p class="last-message">{{ chat.lastMessage }}</p>
                </div>

                <div v-if="chat.unreadCount > 0" class="unread-indicator">
                  {{ chat.unreadCount }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Enhanced AI Assistant Tab -->
        <div class="tab-panel chatbot-panel">
          <div class="chatbot-view">
            <div class="chatbot-header">
              <div class="bot-info">
                <div class="bot-avatar">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div>
                  <h3 class="bot-name">Website Assistant</h3>
                  <p class="bot-status">
                    <span class="status-dot"></span>
                    Always online • Instant help
                  </p>
                </div>
              </div>
            </div>

            <!-- Quick Help Suggestions -->
            <div v-if="showQuickHelp" class="quick-help-section">
              <h4 class="quick-help-title">How can I help you today?</h4>
              <div class="quick-help-grid">
                <button v-for="suggestion in quickHelpSuggestions" :key="suggestion.id" class="quick-help-card"
                  @click="selectQuickHelp(suggestion)">
                  <div class="quick-help-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path :d="suggestion.icon" />
                    </svg>
                  </div>
                  <div class="quick-help-content">
                    <h5>{{ suggestion.title }}</h5>
                    <p>{{ suggestion.description }}</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="chatbot-messages" ref="chatbotContainer">
              <div v-for="(msg, idx) in chatbotMessages" :key="idx"
                :class="['message-bubble', msg.from === 'me' ? 'sent' : 'received']">
                <div class="message-content" v-html="msg.text"></div>
                <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
              </div>

              <!-- Typing Indicator -->
              <div v-if="isTyping" class="typing-indicator">
                <div class="typing-bubble">
                  <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mobile-optimized input with keyboard handling -->
            <div class="chatbot-input-container" :class="{ 'keyboard-focused': isKeyboardActive }">
              <form class="chatbot-form" @submit.prevent="sendToChatbot">
                <div class="input-wrapper">
                  <input 
                    v-model="chatbotInput" 
                    type="text"
                    placeholder="Ask me about passwords, orders, account settings..." 
                    class="chatbot-input"
                    :disabled="isTyping" 
                    ref="chatbotInputRef" 
                    @focus="handleInputFocus"
                    @blur="handleInputBlur"
                    @touchstart="handleInputTouch"
                  />
                  <button type="submit" class="send-button" :disabled="!chatbotInput.trim() || isTyping">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Swipe Indicator -->
    <div v-if="Math.abs(swipeOffset) > 20 && isDragging" class="swipe-indicator">
      <div class="swipe-hint">
        <svg v-if="swipeOffset > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5m7-7-7 7 7 7" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
        <span>{{ swipeOffset > 0 ? 'Messages' : 'AI Assistant' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

// Router
const router = useRouter()

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

interface QuickHelpSuggestion {
  id: string
  title: string
  description: string
  icon: string
  question: string
}

// Reactive state
const activeTab = ref<'messages' | 'chatbot'>('messages')
const chatbotInput = ref('')
const isTyping = ref(false)
const showQuickHelp = ref(true)
const isKeyboardActive = ref(false)

// Swipe-related state
const isDragging = ref(false)
const swipeOffset = ref(0)
const isTransitioning = ref(false)
const startX = ref(0)
const startY = ref(0)
const lastX = ref(0)
const startTime = ref(0)

// Refs for scrolling and swipe detection
const chatbotContainer = ref<HTMLElement>()
const contentContainer = ref<HTMLElement>()
const chatbotInputRef = ref<HTMLInputElement>()

// Keyboard and viewport handling
let initialViewportHeight = 0
let resizeTimeout 

// Quick Help Suggestions
const quickHelpSuggestions = ref<QuickHelpSuggestion[]>([
  {
    id: 'password',
    title: 'Change Password',
    description: 'Learn how to update your password',
    icon: 'M12 1v6m6 2.5l-3.5 2L16 14l-4-3-4 3 1.5-2.5L6 9.5m6-8.5v6',
    question: 'How do I change my password?'
  },
  {
    id: 'orders',
    title: 'Place Orders',
    description: 'Guide to ordering products',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6',
    question: 'How do I order products?'
  },
  {
    id: 'account',
    title: 'Account Settings',
    description: 'Manage your account preferences',
    icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z',
    question: 'How do I update my account settings?'
  },
  {
    id: 'shipping',
    title: 'Shipping Info',
    description: 'Track orders and shipping details',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    question: 'How do I track my shipping?'
  },
  {
    id: 'payment',
    title: 'Payment Methods',
    description: 'Add or update payment options',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 003 3z',
    question: 'How do I add a payment method?'
  },
  {
    id: 'support',
    title: 'Contact Support',
    description: 'Get help from our team',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    question: 'How do I contact customer support?'
  }
])

// AI Knowledge Base
const aiResponses = {
  password: {
    keywords: ['password', 'change password', 'reset password', 'forgot password', 'update password'],
    response: `<strong>🔐 Changing Your Password</strong><br><br>
    Here's how to update your password:<br><br>
    <strong>1.</strong> Go to your <strong>Account Settings</strong><br>
    <strong>2.</strong> Click on <strong>"Security"</strong> tab<br>
    <strong>3.</strong> Select <strong>"Change Password"</strong><br>
    <strong>4.</strong> Enter your current password<br>
    <strong>5.</strong> Create a new strong password<br>
    <strong>6.</strong> Confirm and save changes<br><br>
    <em>💡 Tip: Use a mix of letters, numbers, and symbols for better security!</em>`
  },
  orders: {
    keywords: ['order', 'buy', 'purchase', 'shopping', 'cart', 'checkout', 'product'],
    response: `<strong>🛒 How to Order Products</strong><br><br>
    Follow these simple steps:<br><br>
    <strong>1.</strong> Browse our <strong>Product Catalog</strong><br>
    <strong>2.</strong> Click <strong>"Add to Cart"</strong> on items you want<br>
    <strong>3.</strong> Review your cart and quantities<br>
    <strong>4.</strong> Click <strong>"Checkout"</strong><br>
    <strong>5.</strong> Enter shipping information<br>
    <strong>6.</strong> Select payment method<br>
    <strong>7.</strong> Review and confirm your order<br><br>
    <em>📦 You'll receive a confirmation email with tracking info!</em>`
  },
  account: {
    keywords: ['account', 'profile', 'settings', 'personal info', 'update profile'],
    response: `<strong>⚙️ Account Settings</strong><br><br>
    You can manage your account here:<br><br>
    <strong>• Personal Info:</strong> Name, email, phone<br>
    <strong>• Address Book:</strong> Shipping addresses<br>
    <strong>• Payment Methods:</strong> Cards and billing<br>
    <strong>• Preferences:</strong> Notifications and privacy<br>
    <strong>• Order History:</strong> View past purchases<br><br>
    <em>Access all settings from the profile menu in the top right corner!</em>`
  },
  shipping: {
    keywords: ['shipping', 'delivery', 'track', 'tracking', 'when will arrive'],
    response: `<strong>📦 Shipping & Tracking</strong><br><br>
    <strong>Track Your Order:</strong><br>
    <strong>1.</strong> Go to <strong>"My Orders"</strong><br>
    <strong>2.</strong> Find your order<br>
    <strong>3.</strong> Click <strong>"Track Package"</strong><br><br>
    <strong>Shipping Options:</strong><br>
    <strong>• Standard:</strong> 5-7 business days<br>
    <strong>• Express:</strong> 2-3 business days<br>
    <strong>• Overnight:</strong> Next business day<br><br>
    <em>📧 You'll get email updates at each shipping milestone!</em>`
  },
  payment: {
    keywords: ['payment', 'credit card', 'billing', 'pay', 'card', 'paypal'],
    response: `<strong>💳 Payment Methods</strong><br><br>
    <strong>Add New Payment Method:</strong><br>
    <strong>1.</strong> Go to <strong>Account Settings</strong><br>
    <strong>2.</strong> Select <strong>"Payment Methods"</strong><br>
    <strong>3.</strong> Click <strong>"Add New Card"</strong><br>
    <strong>4.</strong> Enter card details securely<br>
    <strong>5.</strong> Set as default (optional)<br><br>
    <strong>We Accept:</strong><br>
    <strong>• Credit/Debit Cards</strong> (Visa, MasterCard, Amex)<br>
    <strong>• PayPal</strong><br>
    <strong>• Apple Pay / Google Pay</strong><br><br>
    <em>🔒 All payments are encrypted and secure!</em>`
  },
  support: {
    keywords: ['support', 'help', 'contact', 'customer service', 'assistance'],
    response: `<strong>🎧 Customer Support</strong><br><br>
    <strong>Contact Options:</strong><br><br>
    <strong>📧 Email:</strong> support@website.com<br>
    <strong>📞 Phone:</strong> 1-800-HELP (24/7)<br>
    <strong>💬 Live Chat:</strong> Available 9 AM - 9 PM<br>
    <strong>📝 Help Center:</strong> Browse FAQs and guides<br><br>
    <strong>Response Times:</strong><br>
    <strong>• Live Chat:</strong> Immediate<br>
    <strong>• Email:</strong> Within 24 hours<br>
    <strong>• Phone:</strong> Average 2 minutes<br><br>
    <em>I'm here to help too! Ask me anything! 😊</em>`
  },
  general: {
    keywords: ['hello', 'hi', 'help', 'what can you do'],
    response: `<strong>👋 Hello! I'm your Website Assistant</strong><br><br>
    I can help you with:<br><br>
    <strong>🔐</strong> Password and security questions<br>
    <strong>🛒</strong> Ordering and shopping guidance<br>
    <strong>⚙️</strong> Account settings and profile updates<br>
    <strong>📦</strong> Shipping and tracking information<br>
    <strong>💳</strong> Payment methods and billing<br>
    <strong>🎧</strong> Customer support contacts<br><br>
    <em>Just ask me anything about using our website!</em>`
  }
}

const conversations = ref<Conversation[]>([
  {
    id: 1,
    name: 'Daryl Bacongco',
    avatar: 'https://scontent.fmnl17-8.fna.fbcdn.net/v/t39.30808-6/484165215_666283732518614_3099240070135907019_n.jpg?_nc_cat=104&ccb=1-7&_nc_sid=a5f93a&_nc_eui2=AeFle-XUo1Iv1c1V4fzS5SiDbhk-aP2C35luGT5o_YLfmc8RwJyWJ_br295SyR8xw_52aF07d1PLpkiwmJLtn0kk&_nc_ohc=5tJqZJ9hmR4Q7kNvwF3lTo9&_nc_oc=AdmaUDidTbwp2sAVRFr8_mEUggUFd37elersz4e1CFGiQh04zQuE38uUlR6QcpkcSXM&_nc_zt=23&_nc_ht=scontent.fmnl17-8.fna&_nc_gid=KD2nsfoL_2EBrgfCI42UaA&oh=00_AfQ5tERcx8XNjO-8icHsNXoX0NsnmXKbw7Ef0pvjqEr9og&oe=687A58CE',
    lastMessage: 'Ano na?',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    online: true,
    unreadCount: 2,
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
    name: 'Sample',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    lastMessage: 'Sige! 👍',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
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

const chatbotMessages = ref<Message[]>([
  { from: 'other', text: '<strong>👋 Welcome! I\'m your Website Assistant</strong><br><br>I can help you with passwords, orders, account settings, shipping, payments, and more!<br><br><em>Try asking me something or use the quick help options below! 😊</em>', timestamp: new Date(Date.now() - 1000 * 60 * 60) }
])

// Computed properties
const unreadCount = computed(() => {
  return conversations.value.reduce((total, conv) => total + conv.unreadCount, 0)
})

// Navigation function
const navigateToChat = (chat: Conversation) => {
  // Mark as read
  chat.unreadCount = 0
  
  // Navigate to individual chat route
  router.push(`/message/${chat.id}`)
}

// Keyboard and viewport handling
const handleViewportResize = () => {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
  
  resizeTimeout = setTimeout(() => {
    const currentHeight = window.visualViewport?.height || window.innerHeight
    const heightDifference = initialViewportHeight - currentHeight
    
    // If the viewport height decreased significantly (keyboard appeared)
    if (heightDifference > 150) {
      isKeyboardActive.value = true
      // Scroll to input when keyboard appears
      nextTick(() => {
        if (chatbotInputRef.value) {
          chatbotInputRef.value.scrollIntoView({ 
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
  
  // Delay to ensure keyboard is fully shown
  setTimeout(() => {
    if (chatbotInputRef.value) {
      chatbotInputRef.value.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, 300)
}

const handleInputBlur = () => {
  // Delay to prevent flickering when switching between inputs
  setTimeout(() => {
    if (!document.activeElement || document.activeElement.tagName !== 'INPUT') {
      isKeyboardActive.value = false
    }
  }, 100)
}

const handleInputTouch = () => {
  // Ensure input is visible on touch devices
  setTimeout(() => {
    if (chatbotInputRef.value) {
      chatbotInputRef.value.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      })
    }
  }, 100)
}

// Touch and Swipe Event Handlers
const handleTouchStart = (e: TouchEvent) => {
  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  lastX.value = touch.clientX
  startTime.value = Date.now()
  isDragging.value = false
  swipeOffset.value = 0
  isTransitioning.value = false
}

const handleTouchMove = (e: TouchEvent) => {
  if (!startX.value) return

  const touch = e.touches[0]
  const deltaX = touch.clientX - startX.value
  const deltaY = touch.clientY - startY.value

  // Only start horizontal dragging if the movement is more horizontal than vertical
  if (!isDragging.value && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
    isDragging.value = true
    e.preventDefault()
  }

  if (isDragging.value) {
    e.preventDefault()

    const containerWidth = contentContainer.value?.offsetWidth || 0
    const maxOffset = containerWidth * 0.5 // Limit swipe to 50% of container width

    // Apply resistance when swiping beyond bounds
    let newOffset = deltaX

    // Apply resistance for invalid swipes
    if ((activeTab.value === 'messages' && newOffset > 0) ||
      (activeTab.value === 'chatbot' && newOffset < 0)) {
      newOffset = newOffset * 0 // Reduce movement when swiping in wrong direction
    }

    // Limit the maximum offset
    newOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset))

    swipeOffset.value = newOffset
  }
}

const handleTouchEnd = (e: TouchEvent) => {
  if (!isDragging.value) {
    resetSwipeState()
    return
  }

  const endTime = Date.now()
  const timeDiff = endTime - startTime.value
  const distance = Math.abs(swipeOffset.value)
  const velocity = distance / timeDiff

  // Determine if swipe should trigger tab change
  const threshold = 120 // Minimum distance to trigger swipe
  const velocityThreshold = .5 // Minimum velocity to trigger swipe

  const shouldSwipe = distance > threshold || velocity > velocityThreshold

  if (shouldSwipe) {
    if (swipeOffset.value > 0 && activeTab.value === 'chatbot') {
      // Swipe right to go to messages
      switchTab('messages')
    } else if (swipeOffset.value < 0 && activeTab.value === 'messages') {
      // Swipe left to go to chatbot
      switchTab('chatbot')
    }
  }

  resetSwipeState()
}

// Mouse Events for Desktop Support
const handleMouseDown = (e: MouseEvent) => {
  startX.value = e.clientX
  startY.value = e.clientY
  lastX.value = e.clientX
  startTime.value = Date.now()
  isDragging.value = false
  swipeOffset.value = 0
  isTransitioning.value = false

  e.preventDefault()
}

const handleMouseMove = (e: MouseEvent) => {
  if (!startX.value) return

  const deltaX = e.clientX - startX.value
  const deltaY = e.clientY - startY.value

  if (!isDragging.value && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
    isDragging.value = true
    document.body.style.userSelect = 'none' // Prevent text selection
  }

  if (isDragging.value) {
    const containerWidth = contentContainer.value?.offsetWidth || 0
    const maxOffset = containerWidth * 0.5

    let newOffset = deltaX

    if ((activeTab.value === 'messages' && newOffset > 0) ||
      (activeTab.value === 'chatbot' && newOffset < 0)) {
      newOffset = newOffset * 0.3
    }

    newOffset = Math.max(-maxOffset, Math.min(maxOffset, newOffset))
    swipeOffset.value = newOffset
  }
}

const handleMouseUp = () => {
  if (!isDragging.value) {
    resetSwipeState()
    return
  }

  const endTime = Date.now()
  const timeDiff = endTime - startTime.value
  const distance = Math.abs(swipeOffset.value)
  const velocity = distance / timeDiff

  const threshold = 80
  const velocityThreshold = 0.3
  const shouldSwipe = distance > threshold || velocity > velocityThreshold

  if (shouldSwipe) {
    if (swipeOffset.value > 0 && activeTab.value === 'chatbot') {
      switchTab('messages')
    } else if (swipeOffset.value < 0 && activeTab.value === 'messages') {
      switchTab('chatbot')
    }
  }

  resetSwipeState()
  document.body.style.userSelect = '' // Restore text selection
}

const resetSwipeState = () => {
  isDragging.value = false
  swipeOffset.value = 0
  isTransitioning.value = true
  startX.value = 0
  startY.value = 0
  lastX.value = 0
  startTime.value = 0

  // Reset transition state after animation
  setTimeout(() => {
    isTransitioning.value = false
  }, 400)
}

// Enhanced tab switching with smooth animation
const switchTab = (tab: 'messages' | 'chatbot') => {
  if (activeTab.value === tab) return

  isTransitioning.value = true
  activeTab.value = tab
  swipeOffset.value = 0

  if (tab === 'chatbot') {
    showQuickHelp.value = chatbotMessages.value.length <= 1
  }

  setTimeout(() => {
    isTransitioning.value = false
  }, 400)
}

// Existing methods
const selectQuickHelp = (suggestion: QuickHelpSuggestion) => {
  showQuickHelp.value = false
  chatbotInput.value = suggestion.question

  // Automatically send the question
  nextTick(() => {
    sendToChatbot()
  })
}

const getAIResponse = (userMessage: string): string => {
  const message = userMessage.toLowerCase()

  // Check each category for keyword matches
  for (const [category, data] of Object.entries(aiResponses)) {
    if (data.keywords.some(keyword => message.includes(keyword))) {
      return data.response
    }
  }

  // Fallback responses for unmatched queries
  const fallbackResponses = [
    `<strong>🤔 I understand you're asking about:</strong> "${userMessage}"<br><br>While I specialize in website help, I'd be happy to assist! Try asking about:<br><br><strong>• Password changes</strong><br><strong>• Ordering products</strong><br><strong>• Account settings</strong><br><strong>• Shipping info</strong><br><strong>• Payment methods</strong><br><strong>• Customer support</strong><br><br><em>Or contact our support team for specialized help!</em>`,
    `<strong>💡 Thanks for your question!</strong><br><br>I'm designed to help with website-related questions. Here are some things I can definitely help with:<br><br><strong>🔐</strong> Account security and passwords<br><strong>🛒</strong> Shopping and ordering<br><strong>⚙️</strong> Account management<br><strong>📦</strong> Shipping and delivery<br><strong>💳</strong> Payment options<br><br><em>Feel free to ask about any of these topics!</em>`,
    `<strong>🎯 I'd love to help!</strong><br><br>I'm your website assistant, specializing in common questions about our platform. Try asking me:<br><br><strong>"How do I change my password?"</strong><br><strong>"How do I order products?"</strong><br><strong>"How do I track shipping?"</strong><br><strong>"How do I add a payment method?"</strong><br><br><em>What would you like to know? 😊</em>`
  ]

  return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
}

const sendToChatbot = () => {
  if (!chatbotInput.value.trim() || isTyping.value) return

  const userMessage: Message = {
    from: 'me',
    text: chatbotInput.value.trim(),
    timestamp: new Date()
  }

  chatbotMessages.value.push(userMessage)
  const userText = chatbotInput.value.trim()
  chatbotInput.value = ''
  showQuickHelp.value = false

  nextTick(() => {
    scrollToBottom(chatbotContainer.value)
  })

  // Show typing indicator
  isTyping.value = true

  // Simulate AI response after 1-3 seconds
  setTimeout(() => {
    isTyping.value = false

    const aiResponse = getAIResponse(userText)

    const botReply: Message = {
      from: 'other',
      text: aiResponse,
      timestamp: new Date()
    }

    chatbotMessages.value.push(botReply)

    nextTick(() => {
      scrollToBottom(chatbotContainer.value)
    })
  }, 1500 + Math.random() * 1500)
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

// Lifecycle
onMounted(() => {
  // Store initial viewport height
  initialViewportHeight = window.visualViewport?.height || window.innerHeight
  
  // Add viewport resize listener
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize)
  } else {
    window.addEventListener('resize', handleViewportResize)
  }
  
  nextTick(() => {
    scrollToBottom(chatbotContainer.value)
  })
})

onUnmounted(() => {
  // Clean up event listeners
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

.messaging-interface {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  width: 100dvw;
  transition: height 0.3s ease;
}

/* Keyboard active state adjustments */
.messaging-interface.keyboard-active {
  height: 100vh; /* Fallback for older browsers */
  height: 100dvh;
}

/* Enhanced Tab Navigation */
.tab-navigation {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding: 0.5rem 1rem;
  z-index: 10;
  width: 100vw;
  flex-shrink: 0;
}

.tab-nav-container {
  display: flex;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  max-width: 400px;
  margin: 0 auto;
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: relative;
}

.tab-button.active {
  background: white;
  color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  width: 18px;
  height: 18px;
}

.unread-badge {
  position: absolute;
  top: -2px;
  right: 8px;
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.online-indicator {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Content Container with Swipe Support */
.content-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  touch-action: pan-y;
  user-select: none;
  min-height: 0;
}

.sliding-content {
  display: flex;
  width: 200%;
  height: 100%;
  will-change: transform;
}

.sliding-content.transitioning {
  transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.tab-panel {
  width: 100dvw;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  user-select: text;
  min-height: 0;
}

/* Swipe Indicator */
.swipe-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 24px;
  z-index: 1000;
  pointer-events: none;
  backdrop-filter: blur(10px);
}

.swipe-hint {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  font-size: 1rem;
}

.swipe-hint svg {
  width: 24px;
  height: 24px;
}

/* Messages Panel */
.conversations-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-header {
  padding: 1.5rem 1rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.list-header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.25rem;
}

.subtitle {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

.conversations-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.conversation-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  position: relative;
}

.conversation-item:hover {
  background: #f8fafc;
  transform: translateX(4px);
}

.conversation-item:active {
  transform: translateX(2px) scale(0.98);
  background: #f1f5f9;
}

.avatar-container {
  position: relative;
  margin-right: 0.75rem;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e2e8f0;
}

.online-status {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  background: #10b981;
  border: 2px solid white;
  border-radius: 50%;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.contact-name {
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  font-size: 1rem;
}

.timestamp {
  font-size: 0.8rem;
  color: #64748b;
}

.last-message {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-indicator {
  background: var(--primary-color);
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 12px;
  min-width: 20px;
  text-align: center;
}

/* Chatbot Panel Specific Styles */
.chatbot-panel {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.chatbot-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chatbot-header {
  padding: 1.5rem 1rem;
  background: linear-gradient(135deg, var(--primary-color) 0%, #328163 100%);
  color: white;
  flex-shrink: 0;
}

.bot-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bot-avatar {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bot-avatar svg {
  width: 24px;
  height: 24px;
}

.bot-name {
  font-weight: 600;
  margin: 0;
  font-size: 1.2rem;
}

.bot-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.9;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

/* Quick Help Section */
.quick-help-section {
  padding: 1.5rem 1rem;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.quick-help-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem;
  text-align: center;
}

.quick-help-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 0.75rem;
}

.quick-help-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  text-align: left;
}

.quick-help-card:hover {
  background: #f1f5f9;
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
}

.quick-help-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--primary-color) 0%, #327550 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.quick-help-icon svg {
  width: 20px;
  height: 20px;
}

.quick-help-content {
  flex: 1;
  min-width: 0;
}

.quick-help-content h5 {
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
}

.quick-help-content p {
  color: #64748b;
  font-size: 0.8rem;
  margin: 0;
  line-height: 1.3;
}

/* Messages Container */
.chatbot-messages {
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

/* Typing Indicator */
.typing-indicator {
  align-self: flex-start;
  margin-bottom: 0.5rem;
}

.typing-bubble {
  background: #f1f5f9;
  padding: 1rem;
  border-radius: 18px;
  border-bottom-left-radius: 6px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typingDot 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingDot {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

/* Enhanced Input Container with Keyboard Support */
.chatbot-input-container {
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  background: white;
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
}

/* Keyboard focused state - ensures input stays visible */
.chatbot-input-container.keyboard-focused {
  position: sticky;
  bottom: 0;
  z-index: 100;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
}

.chatbot-form {
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

.chatbot-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  outline: none;
  color: #1e293b;
  min-height: 44px; /* Ensure minimum touch target */
}

.chatbot-input::placeholder {
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

/* Responsive Design */
@media (max-width: 768px) {
  .messaging-interface {
    height: 100vh;
    height: 100dvh;
  }

  .tab-nav-container {
    margin: 0;
    max-width: none;
  }

  .tab-button {
    font-size: 0.85rem;
    padding: 0.6rem 0.75rem;
  }

  .tab-icon {
    width: 16px;
    height: 16px;
  }

  .conversation-item {
    padding: 0.75rem;
  }

  .avatar {
    width: 44px;
    height: 44px;
  }

  .message-bubble {
    max-width: 85%;
  }

  .message-content {
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
  }

  .list-header {
    padding: 1rem;
  }

  .list-header h2 {
    font-size: 1.3rem;
  }

  .quick-help-grid {
    grid-template-columns: 1fr;
  }

  .quick-help-card {
    padding: 0.6rem;
  }

  .quick-help-icon {
    width: 36px;
    height: 36px;
  }

  .swipe-indicator {
    padding: 0.75rem 1.25rem;
  }

  .swipe-hint {
    font-size: 0.9rem;
  }

  .swipe-hint svg {
    width: 20px;
    height: 20px;
  }

  /* Enhanced mobile keyboard support */
  .messaging-interface.keyboard-active .chatbot-input-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
  }

  .messaging-interface.keyboard-active .chatbot-messages {
    padding-bottom: 120px; /* Extra space for input */
  }
}

/* Custom Scrollbar */
.conversations-container::-webkit-scrollbar,
.chatbot-messages::-webkit-scrollbar {
  width: 4px;
}

.conversations-container::-webkit-scrollbar-track,
.chatbot-messages::-webkit-scrollbar-track {
  background: #f1f5f9;
}

.conversations-container::-webkit-scrollbar-thumb,
.chatbot-messages::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}

.conversations-container::-webkit-scrollbar-thumb:hover,
.chatbot-messages::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .conversation-item:hover {
    transform: none;
    background: transparent;
  }

  .conversation-item:active {
    background: #f1f5f9;
    transform: scale(0.98);
  }

  .send-button:hover {
    transform: none;
  }

  .quick-help-card:hover {
    transform: none;
    box-shadow: none;
  }

  .quick-help-card:active {
    transform: scale(0.98);
    background: #e2e8f0;
  }
}

/* Improved touch targets */
@media (max-width: 768px) {
  .tab-button {
    min-height: 44px;
  }

  .conversation-item {
    min-height: 72px;
  }

  .send-button {
    min-width: 44px;
    min-height: 44px;
  }
}

/* Prevent zoom on input focus for iOS */
@media screen and (max-width: 768px) {
  .chatbot-input {
    font-size: 16px; /* Prevents zoom on iOS */
  }
}
</style>