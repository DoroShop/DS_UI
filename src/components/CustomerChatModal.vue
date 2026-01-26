<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { Socket } from 'socket.io-client';
import socketManager from '../utils/socket';
import { useAuthStore } from '../stores/authStores';
import { PaperAirplaneIcon, XMarkIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/vue/24/outline';
import type { AgreementMessage } from '../types/order';
import { getAuthHeaders } from '../types/shared';

const authStore = useAuthStore();
let _onConnect: ((...args: any[]) => void) | null = null;
let _onDisconnect: ((...args: any[]) => void) | null = null;
let _onNewAgreementMessage: ((...args: any[]) => void) | null = null;

interface Props {
  orderId: string;
  vendorName?: string;
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['close']);

const messages = ref<AgreementMessage[]>([]);
const newMessage = ref('');
const isSending = ref(false);
const isConnected = ref(false);
const isLoading = ref(false);
let socket: Socket | null = null;

const scrollToBottom = () => {
  nextTick(() => {
    const chatHistory = document.querySelector('.customer-chat-history');
    if (chatHistory) {
      chatHistory.scrollTop = chatHistory.scrollHeight;
    }
  });
};

const connectSocket = () => {
  if (socketManager.isConnected()) return;

  // Ensure token exists; attempt to fetch session if unknown
  if (!authStore.token) {
    authStore.fetchSession().catch(() => {});
  }

  const token = authStore.token;
  if (!token) {
    console.warn('[SOCKET] No auth token available; chat socket will not connect until authenticated');
    return;
  }

  socketManager.connect(token);

  _onConnect = () => {
    console.log('Customer chat connected via manager');
    isConnected.value = true;
    socketManager.emit('join_order', props.orderId);
  };

  _onDisconnect = () => {
    console.log('Customer chat disconnected');
    isConnected.value = false;
  };

  _onNewAgreementMessage = (data: { orderId: string; message: AgreementMessage }) => {
    if (data.orderId === props.orderId) {
      const exists = messages.value.some(m => 
        m.message === data.message.message && 
        Math.abs(new Date(m.timestamp).getTime() - new Date(data.message.timestamp).getTime()) < 1000
      );
      if (!exists) {
        messages.value.push(data.message);
        scrollToBottom();
      }
    }
  };

  socketManager.on('connect', _onConnect);
  socketManager.on('disconnect', _onDisconnect);
  socketManager.on('new_agreement_message', _onNewAgreementMessage);
};

// Debug function to test order access and user permissions
const debugOrderAccess = async () => {
  try {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/v1';
    const authHeaders = getAuthHeaders();
    
    console.log('🔍 Debug: Testing order access...');
    console.log('Order ID:', props.orderId);
    console.log('Auth headers:', authHeaders);
    
    const response = await fetch(`${apiUrl}/order/${props.orderId}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });
    
    console.log('🔍 Debug: Order fetch response status:', response.status);
    
    if (response.ok) {
      const order = await response.json();
      console.log('🔍 Debug: Order data:', {
        orderId: order._id,
        customerId: order.customerId,
        vendorId: order.vendorId,
        hasAgreementMessages: !!order.agreementMessages,
        messageCount: order.agreementMessages?.length || 0
      });
      return order;
    } else {
      console.error('🔍 Debug: Failed to fetch order:', response.status, await response.text());
      return null;
    }
  } catch (error) {
    console.error('🔍 Debug: Order access error:', error);
    return null;
  }
};

const loadMessages = async () => {
  if (!props.orderId) return;
  
  isLoading.value = true;
  try {
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/v1';
    
    // Get fresh auth headers each time
    const authHeaders = getAuthHeaders();
    console.log('🔍 LoadMessages: Auth headers:', { 
      hasAuth: !!authHeaders.Authorization,
      authStart: authHeaders.Authorization ? authHeaders.Authorization.substring(0, 20) + '...' : 'None'
    });
    
    const response = await fetch(`${apiUrl}/order/${props.orderId}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
    });

    if (response.ok) {
      const order = await response.json();
      messages.value = order.agreementMessages || [];
      scrollToBottom();
    } else {
      console.error('Failed to load messages:', response.statusText);
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    isLoading.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value || !isConnected.value) return;

  const messageText = newMessage.value.trim();
  isSending.value = true;

  try {
    // Debug order access before sending message
    console.log('🔍 Running order access debug before sending message...');
    await debugOrderAccess();

    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/v1';
    
    // FIXED: Get fresh auth headers on each request (like vendor does)
    const authHeaders = getAuthHeaders();
    
    // Enhanced logging for debugging
    console.log('Sending message with details:', { 
      messageText, 
      orderId: props.orderId, 
      authHeaders,
      apiUrl: `${apiUrl}/order/${props.orderId}/agreement-message`,
      hasToken: !!authHeaders.Authorization,
      tokenStart: authHeaders.Authorization ? authHeaders.Authorization.substring(0, 20) + '...' : 'None'
    });
    
    const requestBody = { message: messageText };
    console.log('Request body:', JSON.stringify(requestBody));

    // Try using fetch first (current approach)
    let response = await fetch(`${apiUrl}/order/${props.orderId}/agreement-message`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Response headers:', headers);

    if (response.ok) {
      console.log('Message sent successfully via fetch');
      newMessage.value = '';
    } else {
      const errorText = await response.text();
      console.error('Fetch request failed:', response.status, errorText);
      
      // Try with axios as fallback (similar to vendor approach)
      console.log('🔄 Retrying with Axios...');
      
      try {
        // Import axios dynamically
        const axios = await import('axios');
        
        const axiosResponse = await axios.default.post(`${apiUrl}/order/${props.orderId}/agreement-message`, requestBody, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...authHeaders,
          },
          withCredentials: true,
        });
        
        if (axiosResponse.status >= 200 && axiosResponse.status < 300) {
          console.log('Message sent successfully via Axios fallback');
          newMessage.value = '';
          return; // Success with axios, exit early
        }
      } catch (axiosError: any) {
        console.error('Axios fallback also failed:', axiosError);
      }
      
      // Both fetch and axios failed
      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
        console.error('Parsed error details:', errorDetails);
      } catch (e) {
        console.error('Could not parse error response as JSON');
      }
      
      throw new Error(`Failed to send message: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error('Error sending message:', error);
    console.error('Error stack:', error.stack);
    alert('Failed to send message. Please check the console for details and try again.');
  } finally {
    isSending.value = false;
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

const formatDate = (timestamp: string | Date) => {
  return new Date(timestamp).toLocaleString('en-PH', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

watch(() => props.show, (isVisible) => {
  if (isVisible) {
    loadMessages();
    connectSocket();
  } else {
    if (socket) {
      socket.emit('leave_order', props.orderId);
      socket.disconnect();
      socket = null;
    }
    messages.value = [];
    newMessage.value = '';
  }
});

onUnmounted(() => {
  if (props.orderId) {
    socketManager.emit('leave_order', props.orderId);
  }

  if (_onNewAgreementMessage) socketManager.off('new_agreement_message', _onNewAgreementMessage);
  if (_onConnect) socketManager.off('connect', _onConnect);
  if (_onDisconnect) socketManager.off('disconnect', _onDisconnect);
});
</script>

<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click="emit('close')">
      <div class="modal-container" @click.stop>
        <!-- Header -->
        <div class="modal-header">
          <div class="header-info">
            <h3 class="modal-title">Chat with {{ vendorName || 'Vendor' }}</h3>
            <div class="connection-status" :class="{ connected: isConnected }">
              <span class="status-dot"></span>
              <span class="status-text">{{ isConnected ? 'Connected' : 'Connecting...' }}</span>
            </div>
          </div>
          <button @click="emit('close')" class="close-btn">
            <XMarkIcon class="close-icon" />
          </button>
        </div>

        <!-- Chat History -->
        <div class="customer-chat-history" v-if="!isLoading">
          <div v-if="messages.length === 0" class="empty-chat">
            <ChatBubbleLeftEllipsisIcon class="empty-icon" />
            <p>No messages yet. Start a conversation with the vendor about your delivery arrangement.</p>
          </div>

          <div v-for="(message, index) in messages" :key="index" 
               :class="['message-bubble', message.sender]">
            <div class="message-content">
              <p class="message-text">{{ message.message }}</p>
              <span class="message-time">{{ formatDate(message.timestamp) }}</span>
            </div>
          </div>
        </div>

        <div v-else class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading conversation...</p>
        </div>

        <!-- Input Area -->
        <div class="input-area">
          <div class="input-wrapper">
            <textarea
              v-model="newMessage"
              placeholder="Type your message..."
              @keydown="handleKeyDown"
              :disabled="isSending || !isConnected"
              class="message-input"
              rows="1"
            ></textarea>
            <button
              @click="sendMessage"
              :disabled="isSending || !newMessage.trim() || !isConnected"
              class="send-btn"
            >
              <PaperAirplaneIcon class="send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* Modal Transitions */
.modal-fade-enter-active, .modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from, .modal-fade-leave-to {
  opacity: 0;
}

/* Modal Layout */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-container {
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  background: var(--surface, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 60px -10px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color, #e5e7eb);
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  background: var(--surface-hover, #f8fafc);
}

.header-info {
  flex: 1;
}

.modal-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning-500, #f59e0b);
  animation: pulse 2s infinite;
}

.connection-status.connected .status-dot {
  background: var(--primary-color, #10b981);
  animation: none;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  color: #6b7280;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--surface-hover, #f3f4f6);
  color: var(--text-primary, #111827);
}

.close-icon {
  width: 20px;
  height: 20px;
}

/* Chat History */
.customer-chat-history {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 300px;
  max-height: 400px;
  background: var(--bg-secondary, #f8fafc);
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #6b7280;
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top: 3px solid var(--primary-color, #0f766e);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Message Bubbles */
.message-bubble {
  display: flex;
  max-width: 85%;
  animation: messageSlide 0.3s ease-out;
}

@keyframes messageSlide {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-bubble.vendor {
  align-self: flex-start;
}

.message-bubble.customer {
  align-self: flex-end;
}

.message-content {
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message-bubble.vendor .message-content {
  background: var(--surface, #f1f5f9);
  color: var(--text-primary, #1e293b);
  border-bottom-left-radius: 0.25rem;
}

.message-bubble.customer .message-content {
  background: var(--primary-color, #0f766e);
  color: var(--text-on-primary, #ffffff);
  border-bottom-right-radius: 0.25rem;
}

.message-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.message-time {
  font-size: 0.6rem;
  opacity: 0.7;
  align-self: flex-end;
}

.message-bubble.vendor .message-time {
  align-self: flex-start;
}

/* Input Area */
.input-area {
  padding: 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  background: var(--surface, #f8fafc);
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  max-height: 100px;
}

.message-input:focus {
  border-color: var(--primary-color, #0f766e);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.14);
}

.message-input:disabled {
  background: var(--surface-hover, #f9fafb);
  color: var(--text-secondary, #6b7280);
  cursor: not-allowed;
}

.send-btn {
  width: 44px;
  height: 44px;
  background: var(--primary-color, #0f766e);
  color: var(--text-on-primary, #ffffff);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  box-shadow: 0 10px 24px rgba(15, 118, 110, 0.28);
}

.send-btn:hover:not(:disabled) {
  background: var(--primary-strong, #115e59);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(17, 94, 89, 0.32);
}

.send-btn:disabled {
  background: var(--border-color, #d1d5db);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.send-icon {
  width: 18px;
  height: 18px;
}

/* Responsive Design */
@media (max-width: 640px) {
  .modal-container {
    max-height: 90vh;
    margin: 0.5rem;
  }

  .modal-header {
    padding: 1rem;
  }

  .customer-chat-history {
    padding: 0.75rem;
  }

  .input-area {
    padding: 0.75rem;
  }

  .message-bubble {
    max-width: 95%;
  }
}
</style>