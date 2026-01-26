export type MessageType = 'text' | 'image' | 'product' | 'order';
export type UserType = 'customer' | 'vendor';
export type ContextType = 'general' | 'product' | 'order';

export interface User {
  _id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  email?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string | User;
  senderType: UserType;
  content: string;
  messageType: MessageType;
  imageUrl?: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  readAt?: string | Date;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface Conversation {
  _id: string;
  customerId: string | User;
  vendorId: string | User;
  participants?: Array<{ _id: string; name?: string; firstName?: string; lastName?: string; imageUrl?: string; userType: UserType }>;
  contextType?: ContextType;
  contextId?: string;
  lastMessage?: {
    content: string;
    senderId: string;
    senderType: UserType;
    createdAt: string | Date;
  };
  unreadCountCustomer: number;
  unreadCountVendor: number;
  isArchivedByCustomer?: boolean;
  isArchivedByVendor?: boolean;
  isBlockedByCustomer?: boolean;
  isBlockedByVendor?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface MessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface UnreadCountResponse {
  totalUnread: number;
  conversationsWithUnread: number;
}

export interface CreateConversationData {
  vendorId: string;
  contextType?: ContextType;
  contextId?: string;
}

export interface SendMessageData {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  imageUrl?: string;
  referenceId?: string;
  referenceType?: string;
}

export interface TypingData {
  conversationId: string;
  userId: string;
  userName?: string;
}

export interface MarkReadData {
  conversationId: string;
  userType: UserType;
}
