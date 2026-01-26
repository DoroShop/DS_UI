// src/types/cart.ts

export interface OrderItem {
  productId: string;
  optionId: string;
  quantity: number;
  itemId: string;
  price: number;
  originalPrice?: number;
  imgUrl: string;
  name: string;
  label: string;
  promotion?: any;
  hasDiscount?: boolean;
  promotionStatus?: {
    isValid: boolean;
    isActive: boolean;
    hasExpired: boolean;
    hasStarted: boolean;
  };
}

export interface OrderStructure {
  items: OrderItem[];
  shippingFee: number;
  shopId: string;
  shopName: string;
  date: Date,
}

export interface CartState {
  cartData: {
    shops: OrderStructure[];
  };
  isFetched: boolean,
  Count: number,
  selectedItems: string[];
  pendingUpdates: {};
  debounceTimers: {},
  selectedItemData: []
}
