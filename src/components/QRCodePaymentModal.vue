<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import { formatToPHCurrency } from '../utils/currencyFormat'
import { pollPaymentStatus, cancelPayment } from '../utils/paymentApi'
import { getAuthHeaders } from '../types/shared'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  // DB payment id (used for downloads)
  paymentId: {
    type: String,
    required: false,
    default: ''
  },
  // Preferred for polling and cancellation (PayMongo intent id like 'pi_...')
  paymentIntentId: {
    type: String,
    required: false,
    default: ''
  },
  qrCodeUrl: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  expiresAt: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['close', 'success', 'failed', 'expired', 'cancelled'])

// Payment state
const status = ref('pending')
const statusMessage = ref('Waiting for payment...')
const isProcessing = ref(false)
const paymentData = ref(null)
const isDownloading = ref(false)

// Timer state
const timeRemaining = ref(300)
const timerInterval = ref(null)

// Polling cleanup function
let stopPolling = null

// Computed
const formattedTime = computed(() => {
  const mins = Math.floor(timeRemaining.value / 60)
  const secs = timeRemaining.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const isTimeLow = computed(() => timeRemaining.value < 60)

const statusConfig = computed(() => {
  switch (status.value) {
    case 'succeeded':
      return { icon: '✓', class: 'success', message: 'Payment Successful!' }
    case 'failed':
      return { icon: '✕', class: 'failed', message: 'Payment Failed' }
    case 'expired':
      return { icon: '⏰', class: 'expired', message: 'Payment Expired' }
    case 'processing':
      return { icon: '⟳', class: 'processing', message: 'Processing...' }
    default:
      return { icon: '', class: 'pending', message: 'Scan to Pay' }
  }
})

const isPending = computed(() => status.value === 'pending' || status.value === 'processing')
const isComplete = computed(() => ['succeeded', 'failed', 'expired'].includes(status.value))

// Methods
function startTimer() {
  if (props.expiresAt) {
    const expiryTime = new Date(props.expiresAt).getTime()
    const now = Date.now()
    timeRemaining.value = Math.max(0, Math.floor((expiryTime - now) / 1000))
  }

  timerInterval.value = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--
    } else {
      handleExpired()
    }
  }, 1000)
}

function stopTimer() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
}

function handleStatusChange(newStatus, payment) {
  let mappedStatus = newStatus
  if (newStatus === 'awaiting_payment') {
    mappedStatus = 'pending'
  }
  
  status.value = mappedStatus
  paymentData.value = payment
  
  switch (mappedStatus) {
    case 'succeeded':
      statusMessage.value = 'Payment successful!'
      stopTimer()
      emit('success', payment)
      break
    case 'failed':
      statusMessage.value = 'Payment failed. Please try again.'
      stopTimer()
      emit('failed')
      break
    case 'expired':
      handleExpired()
      break
    case 'processing':
      statusMessage.value = 'Processing payment...'
      break
    default:
      statusMessage.value = 'Waiting for payment...'
  }
}

function handleExpired() {
  status.value = 'expired'
  statusMessage.value = 'Payment expired. Please try again.'
  stopTimer()
  emit('expired')
}

async function handleCancel() {
  if (isProcessing.value) return
  
  isProcessing.value = true
  
  try {
    // Prefer cancel by paymentIntentId (gateway id). If not provided, attempt to resolve using payment DB id.
    let idToCancel = props.paymentIntentId || ''

    if (!idToCancel && props.paymentId) {
      // Attempt to fetch payment record to get its intent id
      const headers = getAuthHeaders()
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/${props.paymentId}`, {
        method: 'GET',
        headers: { ...headers, 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      if (resp.ok) {
        const data = await resp.json()
        idToCancel = data?.data?.paymentIntentId || ''
      }
    }

    if (!idToCancel) {
      throw new Error('Unable to determine payment intent id for cancellation')
    }

    await cancelPayment(idToCancel)
    emit('cancelled')
    emit('close')
  } catch (error) {
    console.error('Failed to cancel payment:', error)
    // Keep the modal open if cancellation failed; allow user to retry
    emit('close')
  } finally {
    isProcessing.value = false
  }
}

async function downloadQRCode() {
  if (!props.paymentId || isDownloading.value) return
  
  try {
    isDownloading.value = true
    const authHeaders = getAuthHeaders()

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/payments/${props.paymentId}/qr/download`, {
      method: 'GET',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      credentials: 'include'
    })

    if (!response.ok) {
      throw new Error('Failed to download QR code')
    }

    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = 'qr-code.png'
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename[^;=\n]*=(["\']*)([^"\']*?)\1/)
      if (match) filename = match[2]
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
  } finally {
    isDownloading.value = false
  }
}

function handleClose() {
  if (isPending.value) {
    if (confirm('Cancel this payment?')) {
      handleCancel()
    }
  } else {
    emit('close')
  }
}

// Lifecycle
watch(() => props.show, (newVal) => {
  if (newVal && (props.paymentIntentId || props.paymentId)) {
    status.value = 'pending'
    statusMessage.value = 'Waiting for payment...'
    const idToUse = props.paymentIntentId || props.paymentId

    stopPolling = pollPaymentStatus(
      idToUse,
      handleStatusChange,
      3000,
      300000
    )
    startTimer()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (stopPolling) stopPolling()
  stopTimer()
})
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="show" class="qr-overlay" @click.self="handleClose">
        <div class="qr-modal">
          <!-- Header -->
          <header class="qr-header">
            <div class="header-content">
              <div class="header-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13 0h2v2h-2zm0 4h2v2h-2zm-4-4h2v2h-2zm0 4h2v2h-2zm4-8h2v2h-2zm-4 0h2v2h-2z"/>
                </svg>
              </div>
              <h1>QR Payment</h1>
            </div>
            <button class="close-btn" @click="handleClose" :disabled="isProcessing" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </header>

          <!-- Main Content -->
          <main class="qr-content">
            <!-- Amount -->
            <div class="amount-section">
              <span class="amount-label">Amount to Pay</span>
              <span class="amount-value">{{ formatToPHCurrency(amount) }}</span>
            </div>

            <!-- QR Code -->
            <div class="qr-section" :class="{ 'is-complete': isComplete }">
              <div class="qr-wrapper">
                <div class="qr-frame">
                  <img 
                    v-if="qrCodeUrl" 
                    :src="qrCodeUrl" 
                    alt="QR Code" 
                    class="qr-image"
                  />
                  <div v-else class="qr-loading">
                    <div class="spinner"></div>
                  </div>
                </div>

                <!-- Status Overlay -->
                <div v-if="isComplete" class="status-overlay" :class="statusConfig.class">
                  <span class="status-icon">{{ statusConfig.icon }}</span>
                  <span class="status-text">{{ statusConfig.message }}</span>
                </div>
              </div>

              <!-- Timer -->
              <div v-if="isPending" class="timer-section">
                <div class="timer" :class="{ 'low': isTimeLow }">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
                  </svg>
                  <span>{{ formattedTime }}</span>
                </div>
              </div>

              <!-- Download Button -->
              <button 
                v-if="qrCodeUrl && isPending"
                @click="downloadQRCode" 
                class="download-btn"
                :disabled="isDownloading"
              >
                <svg v-if="!isDownloading" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <div v-else class="btn-spinner"></div>
                {{ isDownloading ? 'Saving...' : 'Save QR' }}
              </button>
            </div>

            <!-- Instructions -->
            <div v-if="isPending" class="instructions">
              <div class="instruction">
                <span class="step">1</span>
                <span>Open banking app</span>
              </div>
              <div class="instruction">
                <span class="step">2</span>
                <span>Scan QR code</span>
              </div>
              <div class="instruction">
                <span class="step">3</span>
                <span>Confirm payment</span>
              </div>
            </div>

            <!-- Supported Banks -->
            <div v-if="isPending" class="banks">
              <div class="bank">GCash</div>
              <div class="bank">Maya</div>
              <div class="bank">BPI</div>
              <div class="bank">BDO</div>
              <div class="bank">UB</div>
            </div>
          </main>

          <!-- Footer -->
          <footer class="qr-footer">
            <button 
              v-if="isPending"
              class="btn btn-cancel" 
              @click="handleCancel"
              :disabled="isProcessing"
            >
              {{ isProcessing ? 'Cancelling...' : 'Cancel' }}
            </button>
            
            <button 
              v-if="status === 'succeeded'"
              class="btn btn-primary" 
              @click="$emit('close')"
            >
              View Orders
            </button>
            
            <button 
              v-if="status === 'failed' || status === 'expired'"
              class="btn btn-secondary" 
              @click="$emit('close')"
            >
              Try Again
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.qr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

/* Modal Container */
.qr-modal {
  background: var(--surface, #ffffff);
  border-radius: 16px;
  width: 100%;
  max-width: 360px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}

/* Header */
.qr-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.875rem 1rem;
  background: var(--primary-color, #1bab50);
  color: white;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}

.qr-header h1 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.close-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Content */
.qr-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* Amount */
.amount-section {
  text-align: center;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(27, 171, 80, 0.08), rgba(27, 171, 80, 0.04));
  border-radius: 10px;
  width: 100%;
}

.amount-label {
  display: block;
  font-size: 0.6875rem;
  color: var(--text-secondary, #666);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.125rem;
}

.amount-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary-color, #1bab50);
}

/* QR Section */
.qr-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}

.qr-wrapper {
  position: relative;
}

.qr-frame {
  padding: 0.75rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1.5px solid var(--border-color, #e5e7eb);
}

.qr-image {
  display: block;
  width: 180px;
  height: 180px;
  border-radius: 6px;
  image-rendering: crisp-edges;
}

.qr-loading {
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-50, #f9fafb);
  border-radius: 6px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border-color, #e5e7eb);
  border-top-color: var(--primary-color, #1bab50);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Status Overlay */
.status-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
}

.status-icon {
  font-size: 2.5rem;
}

.status-text {
  font-size: 0.875rem;
  font-weight: 600;
}

.status-overlay.success {
  color: var(--success-color, #10b981);
}

.status-overlay.failed {
  color: var(--error-color, #e11d48);
}

.status-overlay.expired {
  color: var(--warning-600, #ca8a04);
}

/* Timer */
.timer-section {
  display: flex;
  justify-content: center;
}

.timer {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: var(--gray-100, #f3f4f6);
  border-radius: 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.timer.low {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Download Button */
.download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--gray-100, #f3f4f6);
  color: var(--text-primary, #1a1a1a);
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.download-btn:hover:not(:disabled) {
  background: var(--gray-200, #e5e7eb);
}

.download-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--gray-300, #d1d5db);
  border-top-color: var(--primary-color, #1bab50);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

/* Instructions */
.instructions {
  display: flex;
  justify-content: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.5rem 0;
}

.instruction {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-secondary, #666);
  text-align: center;
}

.step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: var(--primary-color, #1bab50);
  color: white;
  border-radius: 50%;
  font-size: 0.6875rem;
  font-weight: 600;
}

/* Banks */
.banks {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.375rem;
}

.bank {
  padding: 0.1875rem 0.5rem;
  background: var(--gray-100, #f3f4f6);
  border-radius: 4px;
  font-size: 0.625rem;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

/* Footer */
.qr-footer {
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  justify-content: center;
}

.btn {
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
}

.btn-cancel {
  background: transparent;
  color: var(--text-secondary, #666);
  border: 1.5px solid var(--border-color, #e5e7eb);
}

.btn-cancel:hover:not(:disabled) {
  border-color: var(--error-color, #e11d48);
  color: var(--error-color, #e11d48);
}

.btn-cancel:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary-color, #1bab50);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.05);
}

.btn-secondary {
  background: var(--gray-100, #f3f4f6);
  color: var(--text-primary, #1a1a1a);
}

.btn-secondary:hover {
  background: var(--gray-200, #e5e7eb);
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .qr-modal,
.modal-leave-active .qr-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .qr-modal,
.modal-leave-to .qr-modal {
  transform: scale(0.95);
  opacity: 0;
}

/* Mobile - Full Screen */
@media (max-width: 480px) {
  .qr-overlay {
    padding: 0;
    align-items: stretch;
  }

  .qr-modal {
    max-width: none;
    max-height: none;
    height: 100%;
    border-radius: 0;
  }

  .qr-header {
    padding: 0.75rem 1rem;
  }

  .qr-content {
    flex: 1;
    padding: 1.25rem 1rem;
    justify-content: center;
    gap: 1.25rem;
  }

  .amount-section {
    padding: 0.875rem 1rem;
  }

  .amount-value {
    font-size: 1.75rem;
  }

  .qr-image,
  .qr-loading {
    width: 200px;
    height: 200px;
  }

  .qr-frame {
    padding: 1rem;
  }

  .instructions {
    gap: 0.5rem;
  }

  .instruction {
    flex: 1;
    min-width: 0;
  }

  .qr-footer {
    padding: 1rem;
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .btn {
    width: 100%;
    padding: 0.75rem;
  }
}

/* Very small screens */
@media (max-width: 360px) {
  .qr-image,
  .qr-loading {
    width: 160px;
    height: 160px;
  }

  .qr-frame {
    padding: 0.625rem;
  }

  .amount-value {
    font-size: 1.5rem;
  }

  .instruction span:not(.step) {
    font-size: 0.5625rem;
  }

  .step {
    width: 18px;
    height: 18px;
    font-size: 0.625rem;
  }
}

/* Landscape mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .qr-overlay {
    padding: 0;
  }

  .qr-modal {
    max-width: none;
    max-height: none;
    height: 100%;
    border-radius: 0;
    flex-direction: row;
  }

  .qr-header {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding: 1rem 0.5rem;
    flex-shrink: 0;
  }

  .header-content {
    flex-direction: column;
  }

  .qr-content {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
  }

  .amount-section {
    width: auto;
    min-width: 120px;
  }

  .qr-section {
    width: auto;
  }

  .qr-image,
  .qr-loading {
    width: 140px;
    height: 140px;
  }

  .instructions {
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
  }

  .instruction {
    flex-direction: row;
    gap: 0.375rem;
  }

  .banks {
    display: none;
  }

  .qr-footer {
    flex-direction: column;
    justify-content: center;
    padding: 0.5rem;
    border-top: none;
    border-left: 1px solid var(--border-color, #e5e7eb);
    flex-shrink: 0;
  }

  .btn {
    min-width: 80px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
  }
}

/* Dark mode */
.theme-dark .qr-modal {
  background: var(--surface, #232936);
}

.theme-dark .qr-frame {
  background: var(--bg-primary, #1a1f2e);
  border-color: var(--border-color, #374151);
}

.theme-dark .qr-loading {
  background: var(--bg-primary, #1a1f2e);
}

.theme-dark .status-overlay {
  background: rgba(26, 31, 46, 0.95);
}

.theme-dark .amount-section {
  background: linear-gradient(135deg, rgba(27, 171, 80, 0.12), rgba(27, 171, 80, 0.06));
}

.theme-dark .timer {
  background: var(--bg-primary, #1a1f2e);
  color: var(--text-primary, #e5e7eb);
}

.theme-dark .download-btn {
  background: var(--bg-primary, #1a1f2e);
  color: var(--text-primary, #e5e7eb);
}

.theme-dark .download-btn:hover:not(:disabled) {
  background: var(--surface, #232936);
}

.theme-dark .bank {
  background: var(--bg-primary, #1a1f2e);
  color: var(--text-secondary, #9ca3af);
}

.theme-dark .btn-cancel {
  border-color: var(--border-color, #374151);
  color: var(--text-secondary, #9ca3af);
}

.theme-dark .btn-secondary {
  background: var(--bg-primary, #1a1f2e);
  color: var(--text-primary, #e5e7eb);
}

.theme-dark .btn-secondary:hover {
  background: var(--surface, #232936);
}
</style>
