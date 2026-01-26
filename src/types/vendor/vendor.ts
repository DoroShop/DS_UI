// types/vendor.ts

export interface Address {
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
}

export interface MonthlyRevenueComparison {
  month: string
  currentValue: number
  previousValue: number
}

export interface AccountBalance {
  cash: number
  usdt: number
}

export interface Vendor {
  _id: string
  userId: string
  storeName: string
  description?: string
  address?: Address
  imageUrl?: string
  bannerUrl?: string
  isApproved: boolean
  documentsSubmitted: boolean
  documents: string[]
  followers: string[]
  rating: number
  numRatings: number
  accountBalance: AccountBalance
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  topBuyer?: string[]
  profileViews: number
  productClicks: number
  currentMonthlyRevenue: number
  monthlyRevenueComparison: MonthlyRevenueComparison[]
  createdAt: string
  updatedAt: string
}
