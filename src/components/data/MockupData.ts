export const mockOrders = [
  {
    orderId: "ORD123456",
    name: "Juan Dela Cruz",
    status: "pending",
    paymentStatus: "Pending",
    paymentMethod: "gcash",
    subTotal: 2199,
    createdAt: "2025-01-12T10:23:00Z",
    shippingAddress: {
      street: "123 Market St.",
      barangay: "Bagumbayan",
      city: "Taguig",
      province: "Metro Manila",
      zipCode: "1630"
    },
    items: [
      {
        orderImageUrl: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        label: "Bluetooth Headphones",
        quantity: 1,
        price: 2199
      }
    ]
  },
  {
    orderId: "ORD123457",
    name: "Maria Santos",
    status: "paid",
    paymentStatus: "Paid",
    paymentMethod: "wallet",
    subTotal: 1599,
    createdAt: "2025-01-12T09:15:00Z",
    shippingAddress: {
      street: "456 Main Ave.",
      barangay: "San Antonio",
      city: "Makati",
      province: "Metro Manila",
      zipCode: "1200"
    },
    items: [
      {
        orderImageUrl: "https://images.pexels.com/photos/341523/pexels-photo-341523.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        label: "Wireless Mouse",
        quantity: 2,
        price: 799.50
      }
    ]
  },
  {
    orderId: "ORD123458",
    name: "Carlos Rodriguez",
    status: "shipped",
    paymentStatus: "Paid",
    paymentMethod: "cod",
    subTotal: 3299,
    createdAt: "2025-01-11T14:30:00Z",
    trackingNumber: "TRK789012",
    shippingAddress: {
      street: "789 Commerce St.",
      barangay: "Poblacion",
      city: "Quezon City",
      province: "Metro Manila",
      zipCode: "1100"
    },
    items: [
      {
        orderImageUrl: "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&dpr=1",
        label: "Gaming Keyboard",
        quantity: 1,
        price: 3299
      }
    ]
  }
]

export const mockProducts = [
  {
    id: 1,
    name: "Bluetooth Headphones",
    price: 2199,
    stock: 25,
    views: 1250,
    image: "https://images.pexels.com/photos/3394650/pexels-photo-3394650.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1",
    category: "Electronics"
  },
  {
    id: 2,
    name: "Wireless Mouse",
    price: 799.50,
    stock: 3,
    views: 890,
    image: "https://images.pexels.com/photos/341523/pexels-photo-341523.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1",
    category: "Electronics"
  },
  {
    id: 3,
    name: "Gaming Keyboard",
    price: 3299,
    stock: 12,
    views: 2100,
    image: "https://images.pexels.com/photos/788946/pexels-photo-788946.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1",
    category: "Electronics"
  },
  {
    id: 4,
    name: "USB Cable",
    price: 199,
    stock: 2,
    views: 450,
    image: "https://images.pexels.com/photos/163184/usb-cable-cable-black-plug-163184.jpeg?auto=compress&cs=tinysrgb&w=200&h=200&dpr=1",
    category: "Accessories"
  }
]

export const mockDashboardData = {
  totalRevenue: 985432,
  totalOrders: 212,
  totalProducts: 84,
  cashBalance: 125000,
  usdtBalance: 2500,
  followers: 1834,
  profileViews: 5420,
  productClicks: 12340,
  rating: 4.8,
  reviewCount: 142,
  topBuyers: [
    { name: "Juan Dela Cruz", orders: 12, amount: 25000 },
    { name: "Maria Santos", orders: 8, amount: 18500 },
    { name: "Carlos Rodriguez", orders: 6, amount: 15200 }
  ],
  verificationBadges: [
    { name: "ID Verified", verified: true },
    { name: "Address Verified", verified: true },
    { name: "Business License", verified: false }
  ]
}