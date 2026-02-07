// types/shipping.ts — Types for unified J&T shipping module

export interface ShippingQuoteRequest {
  destination: {
    provinceCode: string;
    cityCode: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface JntShipment {
  sellerId: string;
  origin: { provinceCode: string; cityCode: string };
  destination: { provinceCode: string; cityCode: string };
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;
  billKg: number;
  fee: number;
  tier: 'BAG' | 'RATE_TABLE';
  bagSpec: string | null;
  display: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    weightKg: number;
  }>;
}

export interface JntQuoteTotals {
  shippingFeeTotal: number;
  billKgTotalNote: string;
}

export interface ShippingQuoteResponse {
  quoteId: string | null;
  method: 'JNT_MINDORO';
  destination: { provinceCode: string; cityCode: string };
  shipments: JntShipment[];
  totals: JntQuoteTotals;
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
  | 'SHIPPING_NOT_SUPPORTED'
  | 'MANUAL_QUOTE_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_WEIGHT';
