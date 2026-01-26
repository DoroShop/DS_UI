/**
 * Test script to verify promotion expiry handling in cart
 * Run this in browser console to test the functionality
 */

console.log('🧪 Testing Promotion Expiry Cart Handling');

// Function to simulate adding a product with promotion to cart
const testPromotionExpiry = async () => {
  console.log('1. Testing promotion validation...');
  
  // Test expired promotion
  const expiredPromotion = {
    isActive: true,
    discountType: 'percentage',
    discountValue: 20,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-01'), // Expired
    freeShipping: false
  };
  
  // Test active promotion
  const activePromotion = {
    isActive: true,
    discountType: 'percentage',
    discountValue: 20,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-12-31'), // Active
    freeShipping: false
  };
  
  // Test promotion validation
  const isExpiredValid = isPromotionValid(expiredPromotion);
  const isActiveValid = isPromotionValid(activePromotion);
  
  console.log('✅ Expired promotion valid:', isExpiredValid); // Should be false
  console.log('✅ Active promotion valid:', isActiveValid); // Should be true
  
  // Test price calculation
  const originalPrice = 100;
  const expiredPrice = getCurrentPrice(originalPrice, expiredPromotion);
  const activePrice = getCurrentPrice(originalPrice, activePromotion);
  
  console.log('✅ Price with expired promotion:', expiredPrice); // Should be 100 (original)
  console.log('✅ Price with active promotion:', activePrice); // Should be 80 (discounted)
  
  // Test cart refresh
  if (window.cartSync) {
    console.log('2. Testing cart sync...');
    const result = await window.cartSync.refreshPricing();
    console.log('✅ Cart sync result:', result);
  }
  
  console.log('✅ All tests completed!');
};

// Helper functions (copy from cartStores.ts for testing)
const isPromotionValid = (promotion) => {
  if (!promotion || !promotion.isActive) return false;
  const now = new Date();
  if (promotion.startDate && new Date(promotion.startDate) > now) return false;
  if (promotion.endDate && new Date(promotion.endDate) < now) return false;
  return true;
};

const getCurrentPrice = (originalPrice, promotion) => {
  if (!isPromotionValid(promotion)) {
    return originalPrice;
  }
  
  if (promotion.discountType === 'percentage') {
    return originalPrice - (originalPrice * promotion.discountValue / 100);
  } else if (promotion.discountType === 'fixed') {
    return Math.max(0, originalPrice - promotion.discountValue);
  }
  
  return originalPrice;
};

// Run the test
testPromotionExpiry();