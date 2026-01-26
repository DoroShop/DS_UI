/**
 * Cart synchronization utilities
 * Clean code utility for managing cart price updates across the application
 */

import { useCartStore } from '../stores/cartStores.ts';

/**
 * Refresh cart pricing to reflect current promotion status
 * This should be called whenever:
 * - Promotions are started/ended
 * - Promotion dates change
 * - Any pricing-related changes occur
 */
export const refreshCartPricing = async () => {
  try {
    console.log('🔄 Starting cart pricing refresh...');
    
    // Get cart store instance
    const cartStore = useCartStore();
    
    // Force refresh to get current promotion status
    await cartStore.refreshCartPricing();
    
    console.log('✅ Cart pricing synchronized with current promotion status');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to refresh cart pricing:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check for expired or invalid promotions in cart and warn
 * Also returns list of expired items and can force refresh
 */
export const checkForExpiredPromotions = (autoRefresh = false) => {
  try {
    const cartStore = useCartStore();
    let foundExpiredPromotions = false;
    const expiredItems = [];
    
    cartStore.cartData.shops.forEach(shop => {
      shop.items.forEach(item => {
        if (item.promotion) {
          const now = new Date();
          const isActive = item.promotion.isActive;
          const hasExpired = item.promotion.endDate && new Date(item.promotion.endDate) < now;
          const hasNotStarted = item.promotion.startDate && new Date(item.promotion.startDate) > now;
          
          if (!isActive || hasExpired || hasNotStarted) {
            console.warn(`⚠️  Expired/Invalid promotion found in cart for ${item.name}`);
            foundExpiredPromotions = true;
            expiredItems.push(item);
          }
        }
      });
    });
    
    if (foundExpiredPromotions && autoRefresh) {
      console.log('🔄 Expired promotions detected, forcing cart refresh...');
      return refreshCartPricing();
    }
    
    return { success: true, expiredItems, foundExpired: foundExpiredPromotions };
  } catch (error) {
    console.error('Error checking for expired promotions:', error);
    return { success: false, error: error.message, expiredItems: [] };
  }
};

/**
 * Global cart sync - expose to window for cross-component access
 */
if (typeof window !== 'undefined') {
  window.cartSync = {
    refreshPricing: refreshCartPricing,
    checkExpiredPromotions: checkForExpiredPromotions
  };
}

export default {
  refreshCartPricing,
  checkForExpiredPromotions
};