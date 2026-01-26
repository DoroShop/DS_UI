// types/product.ts
export interface SelectedItems {
  price: number;
  label: string;
  img: string;
  productId: string;
  optionId: string;
  originalPrice?: number;
  hasPromotion?: boolean;
  discountType?: 'percentage' | 'fixed' | 'none';
  discountValue?: number;
}

export interface CategorySelectedEvent {
  type: "municipality" | "product" | "filter";
  value: string;
}

export interface ProductOption {
  imageUrl: string;
  price: number;
  label: string | null;
  isHot: boolean;
  _id: string;
  stock: number;
  sold: number;
  updatedAt: string;
  promotion?: Promotion;
  // Added from backend virtuals
  hasPromotion?: boolean;
  promotionStatus?: 'active' | 'scheduled' | 'expired' | 'inactive';
}

export interface Promotion {
  isActive: boolean;
  discountType: 'percentage' | 'fixed' | 'none';
  discountValue: number;
  startDate?: string;
  endDate?: string;
  freeShipping: boolean;
}

export interface ProductReview {
  _id: string,
  reviewerName: string,
  // userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  _id: string;
  vendorId: string | undefined;
  name: string;
  price: number;
  description: string;
  stock: number;
  sold: number;
  storeName: string | undefined,
  option: ProductOption[];
  categories: string[];
  imageUrls: string[];
  isNew: boolean;
  isHot: boolean;
  isApproved: boolean;
  // Product approval status
  status?: 'pending_review' | 'approved' | 'rejected';
  rejectionReason?: string;
  approvedAt?: string;
  rejectedAt?: string;
  reviews: ProductReview[] | undefined;
  averageRating: number;
  numReviews: number;
  createdAt: string;
  municipality: string;
  updatedAt: string;
  isOption: boolean;
  promotion?: Promotion;
  // Added from backend virtuals
  hasPromotion?: boolean;
  promotionStatus?: 'active' | 'scheduled' | 'expired' | 'inactive';
  // Category can be a single category string (legacy) or accessed from categories array
  category?: string;
}

// Edit Product Form Types
export interface EditProductForm {
  name: string;
  description: string;
  price: number;
  stock: number;
  option: ProductOption[];
  promotion: Promotion;
}

export interface PromotionApiPayload {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  startDate?: string;
  endDate?: string;
  freeShipping?: boolean;
}

export interface ApiResponse<T = any> {
  message: string;
  product?: T;
  error?: string;
}

// API Error Types
export interface ApiError {
  message: string;
  status?: number;
}
