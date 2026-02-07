// types/shipping.ts — Types for J&T Fixed Shipping module

export interface ShippingQuoteRequest {
  destination: {
    provinceCode: string;
    cityCode: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  serviceType: string;
  toggles: {
    itemAdditionalFee: boolean;
    itemSize: boolean;
  };
}

export interface ShippingDiscountBreakdown {
  productId: string;
  productName: string;
  qty: number;
  shippingDiscountType: string;
  shippingDiscountValue: number;
  computedDiscountPhp: number;
}

export interface ShipmentWeights {
  actualWeightKg: number;
  volumetricWeightKg: number;
  chargeableWeightKg: number;
  chargeableWeightKgRounded: number;
  volumetricDivisor: number;
  roundingStep: number;
}

export interface ShipmentFees {
  baseShippingFeePhp: number;
  totalShippingDiscountPhp: number;
  finalShippingFeePhp: number;
}

export interface Shipment {
  vendorId: string;
  origin: { provinceCode: string; cityCode: string };
  bagSpecUsed: string;
  weights: ShipmentWeights;
  fees: ShipmentFees;
  discountBreakdown: ShippingDiscountBreakdown[];
}

export interface ShippingQuoteSummary {
  totalBaseShippingFeePhp: number;
  totalShippingDiscountPhp: number;
  totalFinalShippingFeePhp: number;
}

export interface ShippingQuoteResponse {
  courier: string;
  zone: string;
  serviceType: string;
  destination: { provinceCode: string; cityCode: string };
  shipments: Shipment[];
  summary: ShippingQuoteSummary;
  calculatedAt: string;
}

export interface ShippingQuoteResult {
  success: boolean;
  data?: ShippingQuoteResponse;
  error?: string;
  issue?: string;
  details?: {
    missingProducts?: string[];
    [key: string]: any;
  };
}

export interface ShippingAddress {
  provinceCode: string;
  cityCode: string;
  displayName: string;
  isActive: boolean;
}

export type ShippingErrorIssue =
  | 'INVALID_ADDRESS'
  | 'MISSING_SHIPPING_PROFILE'
  | 'RATE_NOT_FOUND'
  | 'UNSUPPORTED_WEIGHT';
