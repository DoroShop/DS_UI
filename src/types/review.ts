export interface Review {
  _id: string;
  productId: string | {
    _id: string;
    name: string;
    imageUrls: string[];
    price: number;
  };
  userId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    imageUrl: string;
  };
  orderId: string;
  vendorId: string;
  rating: number;
  comment: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  helpfulUsers?: string[];
  vendorResponse?: {
    comment: string;
    respondedAt: string | Date;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ReviewableProduct {
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  orderDate: string | Date;
  vendorId: string;
}

export interface CreateReviewData {
  productId: string;
  orderId: string;
  rating: number;
  comment: string;
  images?: string[];
}

export interface UpdateReviewData {
  rating?: number;
  comment?: string;
  images?: string[];
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
