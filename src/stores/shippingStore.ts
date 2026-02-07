import { defineStore } from 'pinia'
import axios from 'axios'
import { getAuthHeaders } from '../types/shared'
import type {
  ShippingQuoteRequest,
  ShippingQuoteResponse,
  ShippingQuoteResult,
  ShippingAddress,
  ShippingErrorIssue
} from '../types/shipping'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// ─── Helper: normalise a user-facing address into the code fields the API needs
function toCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '-')
}

/**
 * Build the payload expected by POST /v1/shipping/jnt/quote.
 *
 * Accepts a destination that may carry province/city *or* provinceCode/cityCode
 * (or both) and normalises it so the backend always gets provinceCode + cityCode.
 */
export function buildJntQuotePayload(
  destination: Record<string, any>,
  items: Array<{ productId: string; quantity: number | string }>
): ShippingQuoteRequest {
  const provinceCode = toCode(
    String(destination.provinceCode || destination.province || '')
  )
  const cityCode = toCode(
    String(destination.cityCode || destination.city || '')
  )

  return {
    destination: { provinceCode, cityCode },
    items: items.map((i) => ({
      productId: String(i.productId),
      quantity: Number(i.quantity) || 1
    })),
    serviceType: 'EZ',
    toggles: { itemAdditionalFee: false, itemSize: false }
  }
}

export const useShippingStore = defineStore('shipping', {
  state: () => ({
    currentQuote: null as ShippingQuoteResponse | null,
    isLoadingQuote: false,
    quoteError: null as string | null,
    missingProfiles: [] as string[],
    addresses: [] as ShippingAddress[],
    isLoadingAddresses: false
  }),

  getters: {
    hasValidQuote: (state): boolean => {
      return !!state.currentQuote && !state.quoteError
    },

    totalShippingFee: (state): number => {
      return state.currentQuote?.summary?.totalFinalShippingFeePhp ?? 0
    },

    totalShippingDiscount: (state): number => {
      return state.currentQuote?.summary?.totalShippingDiscountPhp ?? 0
    },

    totalBaseShipping: (state): number => {
      return state.currentQuote?.summary?.totalBaseShippingFeePhp ?? 0
    },

    shipmentCount: (state): number => {
      return state.currentQuote?.shipments?.length ?? 0
    }
  },

  actions: {
    /**
     * Low-level call — accepts a fully-formed ShippingQuoteRequest.
     */
    async calculateShippingQuote(request: ShippingQuoteRequest): Promise<ShippingQuoteResult> {
      this.isLoadingQuote = true
      this.quoteError = null
      this.missingProfiles = []
      this.currentQuote = null

      try {
        const headers = getAuthHeaders()
        const response = await axios.post(
          `${API_BASE_URL}/shipping/jnt/quote`,
          request,
          { headers }
        )

        if (response.data?.success) {
          this.currentQuote = response.data.data
          return { success: true, data: response.data.data }
        }

        this.quoteError = 'UNKNOWN'
        return { success: false, error: 'Unexpected response format' }
      } catch (err: any) {
        const errorData = err?.response?.data
        const issue = errorData?.issue || errorData?.error || 'UNKNOWN'

        this.quoteError = issue

        if (issue === 'MISSING_SHIPPING_PROFILE' && errorData?.details?.missingProducts) {
          this.missingProfiles = errorData.details.missingProducts
        }

        return {
          success: false,
          error: errorData?.error || err.message,
          issue,
          details: errorData?.details
        }
      } finally {
        this.isLoadingQuote = false
      }
    },

    /**
     * High-level convenience — builds the payload from raw address + cart items
     * and calls the quote endpoint. This is the preferred entry point for the
     * checkout flow.
     */
    async quoteJnt(
      destination: Record<string, any>,
      items: Array<{ productId: string; quantity: number | string }>
    ): Promise<ShippingQuoteResult> {
      const payload = buildJntQuotePayload(destination, items)

      // Pre-validate so we don't waste a round-trip
      if (!payload.destination.provinceCode || !payload.destination.cityCode) {
        const msg = 'Province and city are required for J&T shipping.'
        this.quoteError = 'INVALID_ADDRESS'
        return { success: false, error: msg, issue: 'INVALID_ADDRESS' }
      }

      return this.calculateShippingQuote(payload)
    },

    async fetchAddresses(province: string = 'ORIENTAL-MINDORO'): Promise<ShippingAddress[]> {
      this.isLoadingAddresses = true
      try {
        const response = await axios.get(
          `${API_BASE_URL}/shipping/addresses`,
          { params: { province } }
        )

        if (response.data?.success) {
          this.addresses = response.data.data
          return this.addresses
        }
        return []
      } catch (err: any) {
        console.error('Failed to fetch shipping addresses:', err)
        return []
      } finally {
        this.isLoadingAddresses = false
      }
    },

    clearQuote() {
      this.currentQuote = null
      this.quoteError = null
      this.missingProfiles = []
    },

    getErrorMessage(issue: string | null): string {
      if (!issue) return ''

      const messages: Record<string, string> = {
        INVALID_ADDRESS: 'Address not supported for J&T Express delivery.',
        MISSING_SHIPPING_PROFILE: 'Some products are missing shipping weight/dimensions. Please contact the seller.',
        RATE_NOT_FOUND: 'No shipping rate configured for this weight yet. Please try a different delivery option.',
        UNSUPPORTED_WEIGHT: 'Order is too heavy for J&T bag limit (max 8kg). Please split your order or choose another delivery method.',
        VALIDATION_ERROR: 'Invalid shipping details. Please check your address and try again.',
        UNKNOWN: 'Unable to calculate shipping. Please try again or choose a different delivery option.'
      }

      return messages[issue] || messages.UNKNOWN
    }
  }
})
