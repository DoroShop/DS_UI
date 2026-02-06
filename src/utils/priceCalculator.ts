/**
 * Price Calculator Utility
 * Centralizes all price calculation logic for consistency across the application.
 * Eliminates duplicate discount calculations and ensures accurate pricing everywhere.
 */

/**
 * Represents a product promotion/discount structure
 */
export interface Promotion {
  isActive: boolean;
  discountType?: 'percentage' | 'fixed' | 'none';
  discountValue?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  [key: string]: any;
}

/**
 * Validates if a promotion is currently active and within valid date range
 * Single source of truth for promotion validation
 *
 * @param promotion - The promotion object to validate
 * @returns true if promotion is active and within date range, false otherwise
 */
export const isPromotionValid = (promotion: Promotion | null | undefined): boolean => {
  if (!promotion || !promotion.isActive) {
    return false;
  }

  const now = new Date();

  // Check start date - promotion hasn't started yet
  if (promotion.startDate && new Date(promotion.startDate) > now) {
    return false;
  }

  // Check end date - promotion has expired
  if (promotion.endDate && new Date(promotion.endDate) < now) {
    return false;
  }

  return true;
};

/**
 * Calculates the final price after applying promotion discount
 * This is the single source of truth for all pricing calculations
 *
 * @param basePrice - The original price before discount
 * @param promotion - The promotion object (if any)
 * @returns The final price after discount is applied (0 or higher)
 *
 * @example
 * // Percentage discount: $100 with 20% off = $80
 * calculateFinalPrice(100, { isActive: true, discountType: 'percentage', discountValue: 20 })
 * // => 80
 *
 * @example
 * // Fixed discount: $100 with -$20 off = $80
 * calculateFinalPrice(100, { isActive: true, discountType: 'fixed', discountValue: 20 })
 * // => 80
 *
 * @example
 * // No discount or inactive promotion
 * calculateFinalPrice(100, null)
 * // => 100
 */
export const calculateFinalPrice = (
  basePrice: number,
  promotion?: Promotion | null
): number => {
  // Always validate promotion status in real-time
  if (!isPromotionValid(promotion)) {
    return basePrice;
  }

  if (promotion!.discountType === 'percentage') {
    const discountAmount = (basePrice * promotion!.discountValue!) / 100;
    return basePrice - discountAmount;
  } else if (promotion!.discountType === 'fixed') {
    return Math.max(0, basePrice - promotion!.discountValue!);
  }

  return basePrice;
};

/**
 * Checks if a promotion provides an actual discount
 * Useful for determining if discount badge should be shown
 *
 * @param promotion - The promotion object to check
 * @returns true if promotion is valid and provides a discount value > 0
 */
export const hasActualDiscount = (promotion?: Promotion | null): boolean => {
  if (!isPromotionValid(promotion)) {
    return false;
  }

  const { discountType, discountValue } = promotion!;
  return discountType && discountType !== 'none' && discountValue! > 0;
};

/**
 * Calculates the discount percentage for display purposes
 * Handles both percentage and fixed discounts
 *
 * @param basePrice - The original price
 * @param promotion - The promotion object
 * @returns The discount as a percentage (0-100), or 0 if no discount
 *
 * @example
 * // Percentage discount
 * getDiscountPercentage(100, { isActive: true, discountType: 'percentage', discountValue: 20 })
 * // => 20
 *
 * @example
 * // Fixed discount: ($20 off $100 = 20%)
 * getDiscountPercentage(100, { isActive: true, discountType: 'fixed', discountValue: 20 })
 * // => 20
 */
export const getDiscountPercentage = (
  basePrice: number,
  promotion?: Promotion | null
): number => {
  if (!isPromotionValid(promotion) || basePrice === 0) {
    return 0;
  }

  if (promotion!.discountType === 'percentage') {
    return Math.min(100, promotion!.discountValue! || 0);
  } else if (promotion!.discountType === 'fixed') {
    const percentage = (promotion!.discountValue! / basePrice) * 100;
    return Math.min(100, percentage);
  }

  return 0;
};
