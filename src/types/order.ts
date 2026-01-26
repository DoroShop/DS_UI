export interface AgreementMessage {
  sender: "customer" | "vendor";
  message: string;
  timestamp: string | Date;
}

export interface OrderItem {
  _id?: string;
  imgUrl?: string;
  label?: string;
  quantity: number;
  productId?: string;
  optionId?: string;
  price: number;
  name: string;
}

export interface Address {
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  coordinates?: [number, number]; // [latitude, longitude]
}

export interface RiderLocation {
  latitude: number;
  longitude: number;
  timestamp: string | Date;
  speed?: number;
  heading?: number;
}

export type RefundStatus =
  | "none"
  | "requested"
  | "approved"
  | "rejected"
  | "processed"
  | "refund_requested"
  | "pending"
  | "cancelled";

export type OrderStatus =
  | "pending"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "wallet" | "gcash" | "cod";
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

export interface Order {
  _id: string;
  orderId?: string;
  customerId: string;
  vendorId: string;
  items: OrderItem[];
  name: string;
  shippingOption: string;
  shippingFee: number;
  agreementDetails?: string;
  agreementMessages: AgreementMessage[]; // Correctly typed as an array of objects
  subTotal: number;
  paymentStatus: PaymentStatus;
  shippingAddress: Address;
  trackingNumber?: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: string | Date;
  updatedAt: string | Date;

  // Refund metadata (customer visibility)
  refundStatus?: RefundStatus;
  refundReason?: string;
  refundRequestedAt?: string | Date;
  refundApprovedAt?: string | Date;
  refundNotes?: string;
  refundAmount?: number;
  refundSource?: string;
}
