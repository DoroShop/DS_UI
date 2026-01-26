import axios from 'axios'
import { getAuthHeaders } from '../types/shared'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

function generateIdempotencyKey(): string {
  if (crypto?.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

function getOrCreateIdempotencyKey(storageKey: string): string {
  const existing = sessionStorage.getItem(storageKey)
  if (existing) return existing
  const key = generateIdempotencyKey()
  sessionStorage.setItem(storageKey, key)
  return key
}

function clearIdempotencyKey(storageKey: string): void {
  sessionStorage.removeItem(storageKey)
}

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'expired'

export interface CheckoutItem {
  vendorId: string
  productId: string
  optionId?: string
  itemId?: string
  name?: string
  label?: string
  imgUrl?: string
  price: number
  quantity: number
}

export interface CheckoutData {
  items: CheckoutItem[]
  shippingAddress: {
    street?: string
    barangay?: string
    city?: string
    province?: string
    zipCode?: string
  }
  customerName: string
  phone: string
  shippingOption?: string
  shippingFee?: number
  agreementDetails?: string
}

export interface PaymentIntentResponse {
  success: boolean
  payment: {
    _id: string
    paymentIntentId: string
    status: PaymentStatus
    amount: number
    currency: string
    qrCodeUrl?: string
    expiresAt?: string
  }
  checkoutUrl?: string
  error?: string
}

export interface PaymentStatusResponse {
  success: boolean
  status: PaymentStatus
  ordersCreated?: boolean
  orderIds?: string[]
  payment?: {
    _id: string
    status: PaymentStatus
    amount: number
    paidAt?: string
    ordersCreated?: boolean
    orderIds?: string[]
  }
  data?: {
    paymentId: string
    status: string
    amount: number
    currency: string
    type?: string
    paidAt?: string
    isFinal?: boolean
    ordersCreated?: boolean
    orderIds?: string[]
  }
  error?: string
}

export async function createQRPHPayment(
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {},
  checkoutData: CheckoutData
): Promise<PaymentIntentResponse> {
  try {
    if (!checkoutData || !checkoutData.items || checkoutData.items.length === 0) {
      return {
        success: false,
        payment: { _id: '', paymentIntentId: '', status: 'failed', amount: 0, currency: 'PHP' },
        error: 'Checkout data with items is required for QRPH payment'
      }
    }

    const headers = getAuthHeaders()
    const response = await axios.post(
      `${API_BASE_URL}/payments/checkout`,
      {
        amount: Math.round(amount * 100),
        currency: 'PHP',
        paymentMethod: 'qrph',
        description,
        metadata,
        checkoutData
      },
      { headers }
    )
    return response.data
  } catch (error: any) {
    console.error('Failed to create QRPH payment:', error)
    return {
      success: false,
      payment: { _id: '', paymentIntentId: '', status: 'failed', amount: 0, currency: 'PHP' },
      error: error.response?.data?.message || error.message || 'Failed to create payment'
    }
  }
}

export async function checkPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  try {
    const headers = { ...getAuthHeaders(), 'Cache-Control': 'no-cache' }
    const response = await axios.get(`${API_BASE_URL}/payments/status/${paymentId}`, { headers, params: { t: Date.now() } })
    const data = response.data
    return {
      success: data.success,
      status: data.data?.status || data.status || 'pending',
      payment: data.data || data.payment,
      data: data.data
    } as PaymentStatusResponse
  } catch (error: any) {
    console.error('Failed to check payment status:', error)
    return {
      success: false,
      status: 'failed',
      error: error.response?.data?.message || error.message || 'Failed to check payment status'
    }
  }
}

export async function getQRCodeUrl(paymentIntentId: string): Promise<string | null> {
  try {
    const headers = getAuthHeaders()
    const response = await axios.get(`${API_BASE_URL}/payments/${paymentIntentId}/qr`, { headers })
    return response.data.qrCodeUrl || null
  } catch (error: any) {
    console.error('Failed to get QR code:', error)
    return null
  }
}

export async function cancelPayment(
  paymentId: string
): Promise<{ success: boolean; error?: string }> {
  const storageKey = `idem.cancelPayment.${paymentId}`
  const idempotencyKey = getOrCreateIdempotencyKey(storageKey)

  try {
    const headers = { ...getAuthHeaders(), 'Idempotency-Key': idempotencyKey }
    await axios.post(`${API_BASE_URL}/payments/${paymentId}/cancel`, {}, { headers })
    clearIdempotencyKey(storageKey)
    return { success: true }
  } catch (error: any) {
    const status = error?.response?.status
    if (status && status >= 200 && status < 300) {
      clearIdempotencyKey(storageKey)
      return { success: true }
    }
    return {
      success: false,
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to cancel payment'
    }
  }
}

export function pollPaymentStatus(
  paymentId: string,
  onStatusChange: (status: PaymentStatus, payment?: any) => void,
  intervalMs = 6000,
  timeoutMs = 300000
): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastStatus: PaymentStatus | string = 'pending'
  let stopped = false

  const checkStatus = async () => {
    if (stopped) return

    const response = await checkPaymentStatus(paymentId)

    if (response.success) {
      let mappedStatus: PaymentStatus = response.status
      const backendStatus = response.data?.status || response.status

      if (backendStatus === 'awaiting_payment') mappedStatus = 'pending'
      else if (backendStatus === 'succeeded' || backendStatus === 'paid') mappedStatus = 'succeeded'

      if (mappedStatus !== lastStatus) {
        lastStatus = mappedStatus
        onStatusChange(mappedStatus, response.payment || response.data)
      }

      if (['succeeded', 'failed', 'expired', 'paid'].includes(backendStatus)) cleanup()
    }
  }

  const cleanup = () => {
    stopped = true
    if (intervalId) clearInterval(intervalId)
    if (timeoutId) clearTimeout(timeoutId)
  }

  intervalId = setInterval(checkStatus, intervalMs)
  timeoutId = setTimeout(() => {
    cleanup()
    onStatusChange('expired')
  }, timeoutMs)

  checkStatus()

  return cleanup
}

export async function downloadPaymentQRCode(paymentId: string): Promise<Blob> {
  const response = await axios.get(`${API_BASE_URL}/payments/${paymentId}/qr/download`, {
    responseType: 'blob',
    headers: getAuthHeaders()
  })
  return response.data
}
