import { defineStore } from 'pinia';
import axios from 'axios';
import type {
  Conversation,
  Message,
  MessageType,
  ConversationsResponse,
  MessagesResponse,
  UnreadCountResponse,
  CreateConversationData,
  SendMessageData,
  UserType,
} from '../types/message';
import { getAuthHeaders } from '../types/shared';
import { Alert } from '../components/composable/Alert';
import { socketManager } from '../utils/socket';
import { useAuthStore } from './authStores';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useMessageStore = defineStore('message', {
  state: () => ({
    conversations: [] as Conversation[],
    currentConversation: null as Conversation | null,
    messages: {} as Record<string, Message[]>, // Changed to object mapping conversationId to messages
    unreadCount: 0,
    conversationsWithUnread: 0,
    isLoading: false,
    error: null as string | null,
    currentPage: 1,
    totalPages: 1,
    hasMore: false,
    typingUsers: new Map<string, string>(), // conversationId -> userName
    isSocketConnected: false,
    pendingMessageIds: new Set<string>(), // Track temp message IDs to prevent duplicates
  }),

  getters: {
    getConversationById: (state) => (conversationId: string) => {
      return state.conversations.find((conv) => conv._id === conversationId);
    },

    getMessagesByConversation: (state) => (conversationId: string) => {
      return state.messages[conversationId] || [];
    },

    isTypingInConversation: (state) => (conversationId: string) => {
      return state.typingUsers.get(conversationId) || null;
    },

    sortedConversations: (state) => {
      return [...state.conversations].sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
    },

    // Get unread count computed from conversations
    computedUnreadCount: (state) => {
      const authStore = useAuthStore();
      const userType = authStore.user?.role === 'vendor' ? 'vendor' : 'customer';
      return state.conversations.reduce((total, conv) => {
        return total + (userType === 'vendor' ? conv.unreadCountVendor : conv.unreadCountCustomer);
      }, 0);
    },
  },

  actions: {
    // Initialize Socket.IO connection
    initializeSocket() {
      const authStore = useAuthStore();
      const token = authStore.token || localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('⚠️ No auth token, cannot connect socket');
        return;
      }

      try {
        socketManager.connect(token);
        this.setupSocketListeners();
        this.isSocketConnected = true;
        console.log('✅ [MESSAGE] Socket initialized');
      } catch (error) {
        console.error('❌ [MESSAGE] Socket initialization failed:', error);
      }
    },

    // Setup Socket.IO event listeners
    setupSocketListeners() {
      // New message received
      socketManager.on('new_message', (message: Message) => {
        console.log('💬 [SOCKET] New message received:', message);
        
        // Get current user to check if this is our own message
        const authStore = useAuthStore();
        const currentUserId = authStore.user?._id || authStore.userId;
        const messageSenderId = typeof message.senderId === 'string' ? message.senderId : message.senderId._id;
        const isSentByMe = messageSenderId === currentUserId;
        
        // Add message to the correct conversation's message array with Vue reactivity
        const conversationId = message.conversationId;
        if (!this.messages[conversationId]) {
          this.messages[conversationId] = [];
        }
        
        // Check if message with this exact ID already exists
        const messageExistsById = this.messages[conversationId].some(m => m._id === message._id);
        if (messageExistsById) {
          console.log('⏭️ [SOCKET] Message with ID already exists, skipping');
          return;
        }
        
        // If this is a message sent by me, look for the temp message to replace
        if (isSentByMe) {
          // Find temp message with matching content
          const tempMessageIndex = this.messages[conversationId].findIndex(m => 
            m._id.startsWith('temp-') && 
            m.content === message.content &&
            this.pendingMessageIds.has(m._id)
          );
          
          if (tempMessageIndex !== -1) {
            // Replace temp message with real one
            const tempId = this.messages[conversationId][tempMessageIndex]._id;
            this.messages[conversationId] = this.messages[conversationId].map(m => 
              m._id === tempId ? message : m
            );
            this.pendingMessageIds.delete(tempId);
            console.log('✅ [SOCKET] Replaced temp message with real message');
            return; // Exit early to prevent duplicate conversation update
          } else {
            // No temp message found, but this is our message - skip to avoid duplicate
            console.log('⏭️ [SOCKET] No temp message found for our message, skipping to avoid duplicate');
            return;
          }
        }
        
        // This is a message from someone else, add it
        this.messages[conversationId] = [...this.messages[conversationId], message];
        console.log('✅ [SOCKET] Added new message from another user');
        
        // Update conversation's last message - use array replacement for reactivity
        const conversationIndex = this.conversations.findIndex(
          (conv) => conv._id === message.conversationId
        );
        if (conversationIndex !== -1) {
          const conversation = this.conversations[conversationIndex];
          const updatedConversation = {
            ...conversation,
            lastMessage: {
              content: message.content,
              senderId: typeof message.senderId === 'string' ? message.senderId : message.senderId._id,
              senderType: message.senderType,
              createdAt: message.createdAt,
            },
            updatedAt: message.createdAt,
          };
          
          // Increment unread count for the receiver
          const authStore = useAuthStore();
          const isReceiver = message.senderId !== authStore.user?._id && message.senderId !== authStore.userId;
          if (isReceiver) {
            if (message.senderType === 'customer') {
              updatedConversation.unreadCountVendor = (conversation.unreadCountVendor || 0) + 1;
            } else {
              updatedConversation.unreadCountCustomer = (conversation.unreadCountCustomer || 0) + 1;
            }
          }
          
          // Replace conversation to trigger reactivity
          this.conversations = [
            ...this.conversations.slice(0, conversationIndex),
            updatedConversation,
            ...this.conversations.slice(conversationIndex + 1)
          ];
          
          // Update total unread count
          if (isReceiver) {
            this.unreadCount++;
          }
        }
      });

      // User typing indicator
      socketManager.on('user_typing', (data: { conversationId: string; userName: string; userId: string }) => {
        console.log('✍️ [SOCKET] User typing:', data.userName);
        this.typingUsers.set(data.conversationId, data.userName);
      });

      // User stopped typing
      socketManager.on('user_stopped_typing', (data: { conversationId: string }) => {
        this.typingUsers.delete(data.conversationId);
      });

      // Messages marked as read
      socketManager.on('messages_read', (data: { conversationId: string; readBy: string }) => {
        console.log('✓ [SOCKET] Messages read:', data.conversationId);
        
        // Update messages read status for the conversation with new array for reactivity
        if (this.messages[data.conversationId]) {
          this.messages[data.conversationId] = [...this.messages[data.conversationId].map((msg) =>
            msg.isRead === false
              ? { ...msg, isRead: true, readAt: new Date() }
              : msg
          )];
        }

        // Update conversation unread count - use array replacement for reactivity
        const conversationIndex = this.conversations.findIndex((conv) => conv._id === data.conversationId);
        if (conversationIndex !== -1) {
          const conversation = this.conversations[conversationIndex];
          const updatedConversation = {
            ...conversation,
            unreadCountCustomer: 0,
            unreadCountVendor: 0,
          };
          
          // Replace conversation to trigger reactivity
          this.conversations = [
            ...this.conversations.slice(0, conversationIndex),
            updatedConversation,
            ...this.conversations.slice(conversationIndex + 1)
          ];
        }
      });

      // Message sent confirmation
      socketManager.on('message_sent', (data: { success: boolean; message?: Message }) => {
        if (data.success && data.message) {
          console.log('✅ [SOCKET] Message sent successfully');
        }
      });

      // Message error
      socketManager.on('message_error', (data: { error: string }) => {
        console.error('❌ [SOCKET] Message error:', data.error);
        Alert(data.error, 'error', 'var(--secondary-color)');
      });

      // Joined conversation
      socketManager.on('joined_conversation', (data: { conversationId: string }) => {
        console.log('✅ [SOCKET] Joined conversation:', data.conversationId);
      });

      // Left conversation
      socketManager.on('left_conversation', (data: { conversationId: string }) => {
        console.log('👋 [SOCKET] Left conversation:', data.conversationId);
      });
    },

    // Get or create conversation
    async getOrCreateConversation(data: CreateConversationData) {
      this.isLoading = true;
      this.error = null;

      try {
        const headers = getAuthHeaders();
        const response = await axios.post(
          `${API_BASE_URL}/messages/conversation`,
          data,
          { headers }
        );

        if (response.data.success) {
          this.currentConversation = response.data.data;
          
          // Add to conversations if not exists
          const exists = this.conversations.find((conv) => conv._id === response.data.data._id);
          if (!exists) {
            this.conversations.unshift(response.data.data);
          }

          // Join Socket.IO room
          socketManager.joinConversation(response.data.data._id);
          
          console.log('✅ [MESSAGE] Conversation created/retrieved:', response.data.data._id);
          return response.data.data;
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to create conversation';
        console.error('❌ [MESSAGE] Error creating conversation:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    // Fetch user conversations
    async fetchConversations(userType: UserType = 'customer', page = 1) {
      this.isLoading = true;
      this.error = null;

      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `${API_BASE_URL}/messages/conversations`,
          {
            headers,
            params: { userType, page, limit: 20 },
          }
        );

        if (response.data.success) {
          const data: ConversationsResponse = response.data.data;

          // Ensure conversations array exists and has valid data
          const conversations = Array.isArray(data.conversations) ? data.conversations : [];
          
          if (page === 1) {
            this.conversations = conversations;
          } else {
            this.conversations.push(...conversations);
          }

          this.currentPage = data.page || 1;
          this.totalPages = data.totalPages || 1;
          this.hasMore = data.hasMore || false;

          console.log('✅ [MESSAGE] Conversations fetched:', conversations.length);
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch conversations';
        console.error('❌ [MESSAGE] Error fetching conversations:', err);
      } finally {
        this.isLoading = false;
      }
    },

    // Fetch messages for a conversation
    async fetchMessages(conversationId: string, page = 1) {
      this.isLoading = true;
      this.error = null;

      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `${API_BASE_URL}/messages/conversation/${conversationId}/messages`,
          {
            headers,
            params: { page, limit: 50 },
          }
        );

        if (response.data.success) {
          const data: MessagesResponse = response.data.data;

          // Store messages by conversation ID
          if (page === 1) {
            this.messages[conversationId] = data.messages || [];
          } else {
            if (!this.messages[conversationId]) {
              this.messages[conversationId] = [];
            }
            this.messages[conversationId].unshift(...(data.messages || []));
          }

          this.currentPage = data.page;
          this.totalPages = data.totalPages;
          this.hasMore = data.hasMore;

          console.log('✅ [MESSAGE] Messages fetched:', data.messages?.length || 0);
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch messages';
        console.error('❌ [MESSAGE] Error fetching messages:', err);
      } finally {
        this.isLoading = false;
      }
    },

    // Send message via Socket.IO
    async sendMessage(data: SendMessageData & { senderId: string; senderType: UserType }) {
      // Validate required fields
      if (!data.conversationId) {
        console.error('❌ [MESSAGE] conversationId is required');
        Alert('Cannot send message: Invalid conversation', 'error', 'var(--secondary-color)');
        return;
      }
      if (!data.senderId) {
        console.error('❌ [MESSAGE] senderId is required');
        Alert('Cannot send message: User not authenticated', 'error', 'var(--secondary-color)');
        return;
      }
      if (!data.content?.trim()) {
        console.error('❌ [MESSAGE] content is required');
        return;
      }

      try {
        const messageData = {
          conversationId: String(data.conversationId),
          senderId: String(data.senderId),
          senderType: data.senderType,
          content: data.content.trim(),
          messageType: data.messageType || 'text',
        };

        console.log('💬 [MESSAGE] Sending message via socket:', messageData);
        
        // Optimistic UI update - add message immediately
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMessage: Message = {
          _id: tempId,
          conversationId: messageData.conversationId,
          senderId: messageData.senderId,
          senderType: messageData.senderType,
          content: messageData.content,
          messageType: messageData.messageType as MessageType,
          isRead: false,
          createdAt: new Date(),
        };
        
        // Track this temp message
        this.pendingMessageIds.add(tempId);
        
        if (!this.messages[messageData.conversationId]) {
          this.messages[messageData.conversationId] = [];
        }
        // Use array spreading to trigger reactivity
        this.messages[messageData.conversationId] = [...this.messages[messageData.conversationId], optimisticMessage];
        
        // Update conversation last message
        const conversation = this.conversations.find(c => c._id === messageData.conversationId);
        if (conversation) {
          conversation.lastMessage = {
            content: messageData.content,
            senderId: messageData.senderId,
            senderType: messageData.senderType,
            createdAt: new Date(),
          };
          conversation.updatedAt = new Date();
        }
        
        socketManager.sendMessage(messageData);
      } catch (err: any) {
        console.error('❌ [MESSAGE] Error sending message:', err);
        Alert('Failed to send message', 'error', 'var(--secondary-color)');
        throw err;
      }
    },

    // Send message via REST API (fallback)
    async sendMessageREST(data: SendMessageData) {
      this.error = null;

      try {
        const headers = getAuthHeaders();
        const response = await axios.post(
          `${API_BASE_URL}/messages/send`,
          data,
          { headers }
        );

        if (response.data.success) {
          this.messages.push(response.data.data);
          console.log('✅ [MESSAGE] Message sent via REST:', response.data.data._id);
          return response.data.data;
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to send message';
        console.error('❌ [MESSAGE] Error sending message:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
        throw err;
      }
    },

    // Mark messages as read
    async markAsRead(conversationId: string, userType: UserType) {
      try {
        const headers = getAuthHeaders();
        await axios.post(
          `${API_BASE_URL}/messages/conversation/${conversationId}/read`,
          { userType },
          { headers }
        );

        // Update local state for the conversation with new array for reactivity
        if (this.messages[conversationId]) {
          this.messages[conversationId] = [...this.messages[conversationId].map((msg) =>
            !msg.isRead
              ? { ...msg, isRead: true, readAt: new Date() }
              : msg
          )];
        }

        // Update conversation unread count - use array replacement for reactivity
        const conversationIndex = this.conversations.findIndex(c => c._id === conversationId);
        if (conversationIndex !== -1) {
          const conversation = this.conversations[conversationIndex];
          const updatedConversation = {
            ...conversation,
            unreadCountVendor: userType === 'vendor' ? 0 : conversation.unreadCountVendor,
            unreadCountCustomer: userType === 'customer' ? 0 : conversation.unreadCountCustomer,
          };
          
          // Replace conversation to trigger reactivity
          this.conversations = [
            ...this.conversations.slice(0, conversationIndex),
            updatedConversation,
            ...this.conversations.slice(conversationIndex + 1)
          ];
        }

        console.log('✅ [MESSAGE] Messages marked as read');
      } catch (err: any) {
        console.error('❌ [MESSAGE] Error marking as read:', err);
      }
    },

    // Get unread count
    async fetchUnreadCount(userType: UserType = 'customer') {
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `${API_BASE_URL}/messages/unread-count`,
          {
            headers,
            params: { userType },
          }
        );

        if (response.data.success) {
          const data: UnreadCountResponse = response.data.data;
          this.unreadCount = data.totalUnread;
          this.conversationsWithUnread = data.conversationsWithUnread;
          console.log('✅ [MESSAGE] Unread count:', data.totalUnread);
        }
      } catch (err: any) {
        console.error('❌ [MESSAGE] Error fetching unread count:', err);
      }
    },

    // Start typing indicator
    startTyping(conversationId: string, userId: string, userName: string) {
      socketManager.startTyping({ conversationId, userId, userName });
    },

    // Stop typing indicator
    stopTyping(conversationId: string, userId: string) {
      socketManager.stopTyping({ conversationId, userId });
    },

    // Join conversation room
    joinConversation(conversationId: string) {
      console.log('🚪 [MESSAGE] Joining conversation room:', conversationId);
      socketManager.joinConversation(conversationId);
    },

    // Leave conversation room
    leaveConversation(conversationId: string) {
      socketManager.leaveConversation(conversationId);
    },

    // Set current conversation
    setCurrentConversation(conversation: Conversation | null) {
      this.currentConversation = conversation;
    },

    // Clear messages
    clearMessages() {
      this.messages = {};
      this.currentPage = 1;
      this.totalPages = 1;
      this.hasMore = false;
    },

    // Disconnect socket
    disconnectSocket() {
      socketManager.disconnect();
      this.isSocketConnected = false;
    },
  },
});
