import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/v1', '') || 'http://localhost:3001';

// ⚠️ Important: Socket.IO connections require authentication on the server.
// Prefer using `socketManager.connect(token)` which sends `auth: { token }` in the handshake.
// Do NOT call `io(...)` directly without providing the JWT in `auth.token` or the
// Authorization header - such connections will be rejected with "Authentication required".


class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    if (this.socket?.connected) {
      console.log('🔌 Socket already connected');
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔴 Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
    });
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Socket disconnected manually');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event emitters
  emit(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('⚠️ Socket not connected, cannot emit:', event);
    }
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  // Messaging specific methods
  joinConversation(conversationId: string) {
    console.log('📡 [SOCKET] Emitting join_conversation:', conversationId);
    this.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.emit('leave_conversation', conversationId);
  }

  sendMessage(data: {
    conversationId: string;
    senderId: string;
    senderType: 'customer' | 'vendor';
    content: string;
    messageType: string;
  }) {
    this.emit('send_message', data);
  }

  startTyping(data: { conversationId: string; userId: string; userName: string }) {
    this.emit('typing_start', data);
  }

  stopTyping(data: { conversationId: string; userId: string }) {
    this.emit('typing_stop', data);
  }

  markAsRead(data: { conversationId: string; userId: string; userType: 'customer' | 'vendor' }) {
    this.emit('mark_read', data);
  }
}

export const socketManager = new SocketManager();
export default socketManager;
