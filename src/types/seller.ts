
export interface FeatureSeller {
  storeName: string,
  description: string,
  imageUrl: string,
  userId: string,
  followers: string[],
  rating: number,
  numRatings: number,
  totalProducts: number
}

export interface Address {
  street: string,
  barangay: string,
  city: string,
  address: string,
  province: string,
  zipCode: string
}

export interface Seller extends FeatureSeller {
  address: Address,
  // Additional fields from backend
  totalOrders?: number,
  totalRevenue?: number,
  totalSales?: number,
  totalReviews?: number,
  approvedProducts?: number,
  responseRate?: number,
  responseTime?: string,
  isVerified?: boolean,
  isOnline?: boolean,
  createdAt?: string,
  phone?: string,
  phoneNumber?: string,
  email?: string,
  categories?: string[]
}

