<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  FaceSmileIcon,
  EllipsisVerticalIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/vue/24/outline';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { useMessageStore } from '../stores/messageStore';
import { useAuthStore } from '../stores/authStores';
import type { Message, User } from '../types/message';
import { handleImageError } from '../utils/fallbackImage';
import { useTheme } from '../composables/useTheme';

const props = defineProps<{
  isOpen: boolean;
  vendorId: string;
  vendorName: string;
  vendorImage?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'expand'): void;
}>();

const messageStore = useMessageStore();
const authStore = useAuthStore();
const { isDark } = useTheme();

// State
const messageText = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const messageInput = ref<HTMLInputElement | null>(null);
const typingTimeout = ref<number | null>(null);
const isInitialized = ref(false);

// Computed
const currentUser = computed(() => authStore.user);
const currentUserId = computed(() => {
  const user = authStore.user;
  return user?._id || authStore.userId || null;
});
const currentConversation = computed(() => messageStore.currentConversation);
const messages = computed(() => {
  if (!currentConversation.value) return [];
  return messageStore.getMessagesByConversation(currentConversation.value._id);
});
const isTyping = computed(() => {
  if (!currentConversation.value) return null;
  return messageStore.isTypingInConversation(currentConversation.value._id);
});

// Methods
const initializeChat = async () => {
  if (isInitialized.value) return;
  
  try {
    // Initialize socket if not connected
    if (!messageStore.isSocketConnected) {
      messageStore.initializeSocket();
    }

    // Get or create conversation
    const conversation = await messageStore.getOrCreateConversation({
      vendorId: props.vendorId,
      contextType: 'general',
    });

    if (conversation) {
      // Fetch messages
      await messageStore.fetchMessages(conversation._id);
      
      // Mark as read
      await messageStore.markAsRead(conversation._id, 'customer');
      
      isInitialized.value = true;
      
      // Scroll to bottom
      await nextTick();
      scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to initialize chat:', error);
  }
};

const sendMessage = async () => {
  if (!messageText.value.trim() || !currentConversation.value || !currentUserId.value) {
    console.warn('Cannot send message: missing required data', {
      hasText: !!messageText.value.trim(),
      hasConversation: !!currentConversation.value,
      hasUserId: !!currentUserId.value,
      userId: currentUserId.value
    });
    return;
  }

  const content = messageText.value.trim();
  const conversationId = currentConversation.value._id;
  const userId = currentUserId.value;

  // Validate conversation ID and user ID
  if (!conversationId || !userId) {
    console.error('Invalid conversation or user ID:', {
      conversationId,
      userId
    });
    return;
  }

  messageText.value = '';

  // Stop typing indicator
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
    messageStore.stopTyping(conversationId, userId);
  }

  try {
    console.log('📤 Sending message:', {
      conversationId,
      senderId: userId,
      content: content.substring(0, 50) + '...'
    });

    await messageStore.sendMessage({
      conversationId,
      senderId: userId,
      senderType: 'customer',
      content,
      messageType: 'text',
    });

    // Scroll to bottom
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
    messageText.value = content; // Restore message on error
  }
};

const handleTyping = () => {
  if (!currentConversation.value || !currentUserId.value) return;

  const userName = currentUser.value?.name || 
    `${currentUser.value?.firstName || ''} ${currentUser.value?.lastName || ''}`.trim() ||
    'Customer';
  
  // Emit typing start
  messageStore.startTyping(
    currentConversation.value._id,
    currentUserId.value,
    userName
  );

  // Clear existing timeout
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
  }

  // Set new timeout to stop typing
  typingTimeout.value = window.setTimeout(() => {
    if (currentConversation.value && currentUserId.value) {
      messageStore.stopTyping(currentConversation.value._id, currentUserId.value);
    }
  }, 2000);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const closeModal = () => {
  if (currentConversation.value) {
    messageStore.leaveConversation(currentConversation.value._id);
  }
  emit('close');
};

const expandChat = () => {
  emit('expand');
};

const formatTime = (date: string | Date) => {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const getMessageUser = (message: Message): User | null => {
  if (typeof message.senderId === 'string') {
    return message.senderType === 'customer' ? currentUser.value : {
      _id: props.vendorId,
      name: props.vendorName,
      imageUrl: props.vendorImage,
    } as User;
  }
  return message.senderId;
};

const isOwnMessage = (message: Message): boolean => {
  const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId._id;
  return senderId === currentUserId.value;
};

// Watchers
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    isInitialized.value = false;
    await initializeChat();
    await nextTick();
    messageInput.value?.focus();
  } else {
    // Clean up when closing
    if (currentConversation.value) {
      messageStore.leaveConversation(currentConversation.value._id);
    }
    messageStore.clearMessages();
    isInitialized.value = false;
  }
});

watch(messages, async () => {
  await nextTick();
  scrollToBottom();
});

// Lifecycle
onUnmounted(() => {
  if (typingTimeout.value) {
    clearTimeout(typingTimeout.value);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="chat-modal-overlay" @click="closeModal">
        <div class="chat-modal" @click.stop>
          <!-- Header -->
          <div class="chat-header">
            <div class="vendor-info">
              <div class="vendor-avatar">
                <img 
                  :src="vendorImage || 'https://via.placeholder.com/40'" 
                  :alt="vendorName"
                  @error="handleImageError"
                />
                <span class="online-indicator"></span>
              </div>
              <div class="vendor-details">
                <h3 class="vendor-name">{{ vendorName }}</h3>
                <span v-if="isTyping" class="typing-status">{{ isTyping }} is typing...</span>
                <span v-else class="online-status">Active now</span>
              </div>
            </div>
            <div class="header-actions">
              <button class="expand-btn" @click="expandChat" title="Open full chat">
                <ArrowsPointingOutIcon class="icon" />
              </button>
              <button class="close-btn" @click="closeModal">
                <XMarkIcon class="icon" />
              </button>
            </div>
          </div>

          <!-- Messages Area -->
          <div ref="messagesContainer" class="messages-area">
            <div v-if="messageStore.isLoading" class="loading-messages">
              <div class="spinner"></div>
              <p>Loading messages...</p>
            </div>
            
            <div v-else-if="messages.length === 0" class="empty-messages">
              <div class="empty-icon">💬</div>
              <p>Start a conversation with {{ vendorName }}</p>
              <span class="empty-hint">Send a message to begin chatting</span>
            </div>

            <div v-else class="messages-list">
              <div
                v-for="message in messages"
                :key="message._id"
                class="message-wrapper"
                :class="{ 'own-message': isOwnMessage(message) }"
              >
                <div v-if="!isOwnMessage(message)" class="message-avatar">
                  <img 
                    :src="vendorImage || 'https://via.placeholder.com/32'" 
                    :alt="vendorName"
                    @error="handleImageError"
                  />
                </div>
                
                <div class="message-bubble">
                  <p class="message-text">{{ message.content }}</p>
                  <div class="message-meta">
                    <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                    <CheckIcon v-if="isOwnMessage(message) && message.isRead" class="read-icon" />
                  </div>
                </div>
              </div>

              <!-- Typing Indicator -->
              <div v-if="isTyping" class="message-wrapper typing-indicator-wrapper">
                <div class="message-avatar">
                  <img 
                    :src="vendorImage || 'https://via.placeholder.com/32'" 
                    :alt="vendorName"
                    @error="handleImageError"
                  />
                </div>
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Input Area -->
          <div class="input-area">
            <div class="input-wrapper">
              <button class="emoji-btn" title="Emoji">
                <FaceSmileIcon class="icon" />
              </button>
              
              <input
                ref="messageInput"
                v-model="messageText"
                type="text"
                placeholder="Type a message..."
                class="message-input"
                @keydown.enter="sendMessage"
                @input="handleTyping"
              />

              <button class="attach-btn" title="Attach image">
                <PhotoIcon class="icon" />
              </button>

              <button 
                class="send-btn" 
                :disabled="!messageText.trim()"
                @click="sendMessage"
              >
                <PaperAirplaneIcon class="icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.chat-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.chat-modal {
  width: 100%;
  max-width: 500px;
  height: 600px;
  background: var(--surface);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--primary-color);
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.vendor-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.vendor-avatar {
  position: relative;
  flex-shrink: 0;
}

.vendor-avatar img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: #10b981;
  border: 2px solid var(--primary-color);
  border-radius: 50%;
}

.vendor-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.vendor-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.online-status,
.typing-status {
  font-size: 12px;
  opacity: 0.9;
}

.typing-status {
  font-style: italic;
  animation: pulse 1.5s ease-in-out infinite;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.expand-btn,
.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.expand-btn:hover,
.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.expand-btn .icon,
.close-btn .icon {
  width: 20px;
  height: 20px;
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--bg-primary);
}

.loading-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 8px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-wrapper {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message-wrapper.own-message {
  flex-direction: row-reverse;
}

.message-avatar img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border-primary);
}

.own-message .message-bubble {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2);
}

.message-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  justify-content: flex-end;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.own-message .message-time {
  color: rgba(255, 255, 255, 0.9);
}

.read-icon {
  width: 14px;
  height: 14px;
  color: #10b981;
}

/* Typing Indicator */
.typing-indicator-wrapper {
  animation: fadeIn 0.3s ease;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  width: fit-content;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

/* Input Area */
.input-area {
  padding: 16px 20px;
  background: var(--surface);
  border-top: 1px solid var(--border-color);
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 8px 12px;
  transition: border-color 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--primary-color);
}

.emoji-btn,
.attach-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  border-radius: 8px;
}

.emoji-btn:hover,
.attach-btn:hover {
  background: var(--surface-hover);
  color: var(--primary-color);
}

.emoji-btn .icon,
.attach-btn .icon {
  width: 20px;
  height: 20px;
}

.message-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 14px;
  color: var(--text-primary);
  padding: 4px 8px;
}

.message-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: var(--primary-hover);
  transform: scale(1.05);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn .icon {
  width: 18px;
  height: 18px;
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .chat-modal,
.modal-leave-to .chat-modal {
  transform: scale(0.9) translateY(20px);
}

/* Responsive */
@media (max-width: 768px) {
  .chat-modal {
    max-width: none;
    height: 100%;
    border-radius: 0;
  }

  .chat-modal-overlay {
    padding: 0;
  }
}

/* Scrollbar */
.messages-area::-webkit-scrollbar {
  width: 6px;
}

.messages-area::-webkit-scrollbar-track {
  background: transparent;
}

.messages-area::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.messages-area::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>
