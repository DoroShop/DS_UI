<script setup>
import { ref, onMounted, computed, watch, onBeforeUnmount } from "vue"
import axios from "axios"
import {
  ArrowDownCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  XMarkIcon,
  EyeIcon,
  BanknotesIcon
} from "@heroicons/vue/24/outline"
import { getAuthHeaders } from "../../../types/shared"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""
const PER_PAGE = 10

const withdrawals = ref([])
const loading = ref(false)
const refreshing = ref(false)
const error = ref("")
const currentPage = ref(1)
const totalPages = ref(1)
const totalWithdrawals = ref(0)
const hasNextPage = ref(false)
const hasPrevPage = ref(false)

const selectedStatus = ref("")
const searchQuery = ref("")

const showCancelModal = ref(false)
const cancelReason = ref("")
const cancelling = ref(false)
const selectedWithdrawal = ref(null)

const showProofModal = ref(false)
const proofImageUrl = ref("")

const statusOptions = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "succeeded", label: "Succeeded" },
    { value: "rejected", label: "Rejected" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" }
]

const statusPills = computed(() => statusOptions)

const filteredWithdrawals = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return withdrawals.value
  return withdrawals.value.filter((w) => {
    const id = String(w._id || "").toLowerCase()
    const st = String(w.status || "").toLowerCase()
    const acc = String(w.bankAccount?.accountNumber || "")
    const provider = String(w.provider || "").toLowerCase()
    const ref = String(w.payoutRef || "").toLowerCase()
    return id.includes(q) || st.includes(q) || acc.includes(q) || provider.includes(q) || ref.includes(q)
  })
})

const pageRangeLabel = computed(() => {
  if (!totalWithdrawals.value) return "Showing 0"
  const start = (currentPage.value - 1) * PER_PAGE + 1
  const end = Math.min(currentPage.value * PER_PAGE, totalWithdrawals.value)
  return `Showing ${start}–${end} of ${totalWithdrawals.value}`
})

const formatDate = (dateString) => {
  if (!dateString) return "—"
  const d = new Date(dateString)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d)
}

const formatAmount = (amount) => {
  const value = Number(amount || 0) / 100
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value)
}

const maskAccount = (acc) => {
  const s = String(acc || "")
  if (!s) return "N/A"
  const last4 = s.slice(-4)
  return `•••• ${last4}`
}

const humanMethod = (w) => {
  const p = String(w.provider || "").toLowerCase()
  if (!p) return "Bank Transfer"
  if (p === "paymongo") return "PayMongo"
  if (p === "gcash") return "GCash"
  if (p === "maya" || p === "paymaya") return "Maya"
  if (p === "bank_transfer") return "Bank Transfer"
  return p.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const statusMeta = (status) => {
  const s = String(status || "").toLowerCase()
  if (s === "pending") return { icon: ClockIcon, tone: "warning", label: "Pending" }
  if (s === "rejected") return { icon: ExclamationTriangleIcon, tone: "danger", label: "Rejected" }
  if (s === "processing") return { icon: ArrowPathIcon, tone: "info", label: "Processing" }
  if (s === "succeeded") return { icon: CheckCircleIcon, tone: "success", label: "Succeeded" }
  if (s === "failed") return { icon: XCircleIcon, tone: "danger", label: "Failed" }
  if (s === "cancelled") return { icon: ExclamationTriangleIcon, tone: "muted", label: "Cancelled" }
  return { icon: ClockIcon, tone: "muted", label: "Unknown" }
}

const canCancel = (w) => {
  const s = String(w?.status || "").toLowerCase()
  return s === "pending" || s === "processing"
}

const fetchWithdrawals = async (page = 1, status = selectedStatus.value) => {
  loading.value = !refreshing.value
  error.value = ""
  try {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (status) params.append("status", status)

    const { data } = await axios.get(`${API_BASE_URL}/payments/vendor/withdrawals?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    withdrawals.value = data?.data || []
    currentPage.value = data?.pagination?.currentPage || page
    totalPages.value = data?.pagination?.totalPages || 1
    totalWithdrawals.value = data?.pagination?.totalWithdrawals || 0
    hasNextPage.value = !!data?.pagination?.hasNextPage
    hasPrevPage.value = !!data?.pagination?.hasPrevPage
  } catch (err) {
    error.value = err?.response?.data?.message || "Failed to load withdrawal history"
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const refreshWithdrawals = async () => {
  refreshing.value = true
  await fetchWithdrawals(currentPage.value, selectedStatus.value)
}

const goToPage = async (page) => {
  if (page < 1 || page > totalPages.value) return
  await fetchWithdrawals(page, selectedStatus.value)
}

const setStatus = async (value) => {
  selectedStatus.value = value
  currentPage.value = 1
  await fetchWithdrawals(1, value)
}

const openCancelModal = (w) => {
  selectedWithdrawal.value = w
  cancelReason.value = ""
  showCancelModal.value = true
}

const closeCancelModal = () => {
  showCancelModal.value = false
  cancelReason.value = ""
  selectedWithdrawal.value = null
  cancelling.value = false
}

const cancelWithdrawal = async () => {
  const w = selectedWithdrawal.value
  if (!w?._id || cancelling.value) return
  cancelling.value = true
  error.value = ""
  try {
    const { data } = await axios.post(
      `${API_BASE_URL}/payments/${w._id}/cancel-withdrawal`,
      { reason: cancelReason.value?.trim() || "Cancelled by vendor" },
      { headers: getAuthHeaders() }
    )

    if (data?.success) {
      const idx = withdrawals.value.findIndex((x) => x._id === w._id)
      if (idx !== -1) {
        withdrawals.value[idx] = { ...withdrawals.value[idx], status: "cancelled", updatedAt: new Date().toISOString() }
      }
      closeCancelModal()
      await refreshWithdrawals()
    }
  } catch (err) {
    error.value = err?.response?.data?.message || "Failed to cancel withdrawal"
  } finally {
    cancelling.value = false
  }
}

const openProofModal = (imageUrl) => {
  proofImageUrl.value = imageUrl
  showProofModal.value = true
}

const closeProofModal = () => {
  showProofModal.value = false
  proofImageUrl.value = ""
}

const onKeyDown = (e) => {
  if (e.key === "Escape") {
    if (showProofModal.value) closeProofModal()
    if (showCancelModal.value) closeCancelModal()
  }
}

watch(selectedStatus, () => { })
onMounted(() => {
  window.addEventListener("keydown", onKeyDown)
  fetchWithdrawals()
})
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown)
})
</script>

<template>
  <div class="w-page">
    <div class="w-hero">
      <div class="w-hero-left">
        <div class="w-hero-icon">
          <ArrowDownCircleIcon class="w-hero-icon-svg" />
        </div>
        <div class="w-hero-text">
          <h1 class="w-title">Withdrawals</h1>
          <p class="w-subtitle">
            Track your payout requests and status updates
            <span v-if="totalWithdrawals > 0" class="w-subtitle-strong">· {{ totalWithdrawals }} total</span>
          </p>
        </div>
      </div>

      <div class="w-hero-actions">
        <button class="w-btn w-btn-ghost" @click="refreshWithdrawals" :disabled="loading || refreshing">
          <ArrowPathIcon class="w-ic" :class="{ spin: refreshing }" />
          Refresh
        </button>
      </div>
    </div>

    <div class="w-panel">
      <div class="w-panel-top">
        <div class="w-tabs" role="tablist" aria-label="Withdrawal status filters">
          <button v-for="t in statusPills" :key="t.value" class="w-tab" :class="{ active: selectedStatus === t.value }"
            @click="setStatus(t.value)" type="button">
            {{ t.label }}
          </button>
        </div>

        <div class="w-toolbar">
          <div class="w-field">
            <FunnelIcon class="w-field-ic" />
            <select v-model="selectedStatus" class="w-select" @change="setStatus(selectedStatus)">
              <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <div class="w-field w-field-grow">
            <MagnifyingGlassIcon class="w-field-ic" />
            <input v-model="searchQuery" class="w-input" type="text"
              placeholder="Search by ID, status, account, provider, reference…" />
            <button v-if="searchQuery" class="w-clear" type="button" @click="searchQuery = ''">
              <XMarkIcon class="w-ic" />
            </button>
          </div>
        </div>
      </div>

      <div class="w-panel-body">
        <div v-if="loading && !refreshing" class="w-state">
          <div class="w-skel">
            <div class="w-skel-row" v-for="i in 6" :key="i"></div>
          </div>
          <div class="w-state-text">Loading withdrawals…</div>
        </div>

        <div v-else-if="error" class="w-state">
          <XCircleIcon class="w-state-ic danger" />
          <div class="w-state-title">Something went wrong</div>
          <div class="w-state-text">{{ error }}</div>
          <button class="w-btn w-btn-primary" @click="refreshWithdrawals">Try again</button>
        </div>

        <div v-else-if="filteredWithdrawals.length === 0" class="w-state">
          <BanknotesIcon class="w-state-ic muted" />
          <div class="w-state-title">No withdrawals found</div>
          <div class="w-state-text">
            <span v-if="selectedStatus || searchQuery">Try changing filters or search terms.</span>
            <span v-else>You don’t have any withdrawal requests yet.</span>
          </div>
        </div>

        <div v-else>
          <div class="w-table-wrap">
            <table class="w-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Account</th>
                  <th>Requested</th>
                  <th>Proof</th>
                  <th class="w-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="w in filteredWithdrawals" :key="w._id" :class="{ proof: !!w.adminProofUrl }">
                  <td class="w-td-amount">
                    <div class="w-amount">{{ formatAmount(w.amount) }}</div>
                    <div class="w-muted mono">ID: {{ String(w._id).slice(-10) }}</div>
                  </td>

                  <td>
                    <div class="w-badge" :class="statusMeta(w.status).tone">
                      <component :is="statusMeta(w.status).icon" class="w-badge-ic"
                        :class="{ spin: String(w.status).toLowerCase() === 'processing' }" />
                      {{ statusMeta(w.status).label }}
                    </div>
                    <div v-if="w.payoutRef" class="w-muted mono">Ref: {{ w.payoutRef }}</div>
                  </td>

                  <td>
                    <div class="w-strong">{{ humanMethod(w) }}</div>
                    <div class="w-muted">{{ w.provider ? String(w.provider).replaceAll("_", " ") : "—" }}</div>
                  </td>

                  <td>
                    <div class="w-strong">{{ maskAccount(w.bankAccount?.accountNumber) }}</div>
                    <div class="w-muted">{{ w.bankAccount?.bankName || "—" }}</div>
                  </td>

                  <td>
                    <div class="w-strong mono">{{ formatDate(w.createdAt) }}</div>
                    <div v-if="w.updatedAt && w.updatedAt !== w.createdAt" class="w-muted">Updated: {{
                      formatDate(w.updatedAt) }}</div>
                  </td>

                  <td>
                    <button v-if="w.adminProofUrl" class="w-link" type="button"
                      @click="openProofModal(w.adminProofUrl)">
                      <EyeIcon class="w-ic" />
                      View
                    </button>
                    <span v-else class="w-muted">—</span>
                  </td>

                  <td class="w-td-actions">
                    <button class="w-btn w-btn-danger" type="button" :disabled="!canCancel(w)"
                      @click="openCancelModal(w)">
                      Cancel
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="w-cards">
            <div v-for="w in filteredWithdrawals" :key="w._id" class="w-card" :class="{ proof: !!w.adminProofUrl }">
              <div class="w-card-top">
                <div>
                  <div class="w-amount">{{ formatAmount(w.amount) }}</div>
                  <div class="w-muted mono">ID: {{ String(w._id).slice(-12) }}</div>
                </div>
                <div class="w-badge" :class="statusMeta(w.status).tone">
                  <component :is="statusMeta(w.status).icon" class="w-badge-ic"
                    :class="{ spin: String(w.status).toLowerCase() === 'processing' }" />
                  {{ statusMeta(w.status).label }}
                </div>
              </div>

              <div class="w-card-grid">
                <div class="w-kv">
                  <div class="w-k">Method</div>
                  <div class="w-v">{{ humanMethod(w) }}</div>
                </div>
                <div class="w-kv">
                  <div class="w-k">Account</div>
                  <div class="w-v">{{ maskAccount(w.bankAccount?.accountNumber) }}</div>
                </div>
                <div class="w-kv">
                  <div class="w-k">Bank</div>
                  <div class="w-v">{{ w.bankAccount?.bankName || "—" }}</div>
                </div>
                <div class="w-kv">
                  <div class="w-k">Requested</div>
                  <div class="w-v mono">{{ formatDate(w.createdAt) }}</div>
                </div>
                <div class="w-kv" v-if="w.payoutRef">
                  <div class="w-k">Reference</div>
                  <div class="w-v mono">{{ w.payoutRef }}</div>
                </div>
              </div>

              <div class="w-card-actions">
                <button v-if="w.adminProofUrl" class="w-btn w-btn-ghost" type="button"
                  @click="openProofModal(w.adminProofUrl)">
                  <EyeIcon class="w-ic" />
                  Proof
                </button>
                <button class="w-btn w-btn-danger" type="button" :disabled="!canCancel(w)" @click="openCancelModal(w)">
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <div class="w-footer">
            <div class="w-footer-left">{{ pageRangeLabel }}</div>
            <div class="w-pager" v-if="totalPages > 1">
              <button class="w-btn w-btn-ghost" :disabled="!hasPrevPage" @click="goToPage(currentPage - 1)">
                <ChevronLeftIcon class="w-ic" />
                Prev
              </button>

              <div class="w-pages">
                <button v-for="p in Math.min(5, totalPages)" :key="p" class="w-pagebtn"
                  :class="{ active: p === currentPage }" @click="goToPage(p)">
                  {{ p }}
                </button>
                <span v-if="totalPages > 5" class="w-ellipsis">…</span>
                <button v-if="totalPages > 5" class="w-pagebtn" :class="{ active: totalPages === currentPage }"
                  @click="goToPage(totalPages)">
                  {{ totalPages }}
                </button>
              </div>

              <button class="w-btn w-btn-ghost" :disabled="!hasNextPage" @click="goToPage(currentPage + 1)">
                Next
                <ChevronRightIcon class="w-ic" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showCancelModal" class="w-modal" @click="closeCancelModal">
      <div class="w-modal-card" @click.stop>
        <div class="w-modal-head">
          <div class="w-modal-title">Cancel withdrawal</div>
          <button class="w-iconbtn" type="button" @click="closeCancelModal">
            <XMarkIcon class="w-ic" />
          </button>
        </div>

        <div class="w-modal-body">
          <div class="w-alert">
            <ExclamationTriangleIcon class="w-alert-ic" />
            <div class="w-alert-text">
              This will cancel the payout request. If your backend refunds the amount back to your wallet, it should
              reflect after the update.
            </div>
          </div>

          <div class="w-modal-kv">
            <div class="w-k">Amount</div>
            <div class="w-v strong">{{ formatAmount(selectedWithdrawal?.amount) }}</div>
          </div>

          <div class="w-modal-field">
            <div class="w-k">Reason (optional)</div>
            <textarea v-model="cancelReason" class="w-textarea" rows="3"
              placeholder="Add a short reason for cancellation…"></textarea>
          </div>
        </div>

        <div class="w-modal-foot">
          <button class="w-btn w-btn-ghost" type="button" @click="closeCancelModal">Keep</button>
          <button class="w-btn w-btn-danger" type="button" :disabled="cancelling" @click="cancelWithdrawal">
            <span v-if="cancelling">Cancelling…</span>
            <span v-else>Cancel withdrawal</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="showProofModal" class="w-modal" @click="closeProofModal">
      <div class="w-proof-card" @click.stop>
        <div class="w-modal-head">
          <div class="w-modal-title">Payment proof</div>
          <button class="w-iconbtn" type="button" @click="closeProofModal">
            <XMarkIcon class="w-ic" />
          </button>
        </div>
        <div class="w-proof-body">
          <img :src="proofImageUrl" alt="Payment proof" class="w-proof-img" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.w-page {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: clamp(16px, 3vw, 28px);
  min-height: 100dvh;
  --bg: var(--bg-primary, #0b1020);
  --surface: var(--surface, #0f172a);
  --surface2: var(--bg-secondary, #0b1225);
  --border: var(--border-primary, rgba(148, 163, 184, 0.16));
  --text: var(--text-primary, #e5e7eb);
  --muted: var(--text-secondary, rgba(226, 232, 240, 0.75));
  --muted2: var(--text-muted, rgba(226, 232, 240, 0.55));
  --primary: var(--color-primary, #7c3aed);
  --primary2: var(--color-primary-hover, #6d28d9);
  --danger: var(--color-danger, #ef4444);
  --danger2: var(--color-danger-dark, #dc2626);
  --shadow: var(--card-shadow, 0 10px 30px rgba(0, 0, 0, 0.25));
  --shadow2: var(--card-shadow-hover, 0 16px 40px rgba(0, 0, 0, 0.28));
  color: var(--text);
}

.w-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 18px 18px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.16), rgba(15, 23, 42, 0.75));
  box-shadow: var(--shadow);
}

.w-hero-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.w-hero-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(124, 58, 237, 0.18);
  border: 1px solid rgba(124, 58, 237, 0.25);
}

.w-hero-icon-svg {
  width: 22px;
  height: 22px;
}

.w-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.w-subtitle {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.w-subtitle-strong {
  color: rgba(229, 231, 235, 0.9);
  font-weight: 600;
}

.w-hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.w-panel {
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: clip;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.w-panel-top {
  padding: 14px 14px 10px;
  background: linear-gradient(180deg, rgba(2, 6, 23, 0.35), rgba(15, 23, 42, 0));
  border-bottom: 1px solid var(--border);
}

.w-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.w-tab {
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.18);
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 999px;
  font-weight: 650;
  font-size: 0.86rem;
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
  user-select: none;
}

.w-tab:hover {
  transform: translateY(-1px);
  background: rgba(124, 58, 237, 0.12);
  color: rgba(229, 231, 235, 0.9);
  border-color: rgba(124, 58, 237, 0.25);
}

.w-tab.active {
  background: rgba(124, 58, 237, 0.22);
  border-color: rgba(124, 58, 237, 0.35);
  color: rgba(255, 255, 255, 0.95);
}

.w-toolbar {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 10px;
  align-items: center;
}

.w-field {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.25);
  border-radius: 12px;
  padding: 10px 10px;
  min-height: 42px;
}

.w-field-grow {
  position: relative;
}

.w-field-ic {
  width: 16px;
  height: 16px;
  color: var(--muted2);
  flex: 0 0 auto;
}

.w-select,
.w-input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.92rem;
}

.w-select {
  appearance: none;
}

.w-input::placeholder {
  color: rgba(226, 232, 240, 0.45);
}

.w-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: rgba(226, 232, 240, 0.08);
  border: 1px solid rgba(226, 232, 240, 0.12);
  color: rgba(255, 255, 255, 0.85);
  width: 30px;
  height: 30px;
  border-radius: 10px;
  cursor: pointer;
}

.w-panel-body {
  padding: 14px;
  min-height: 520px;
}

.w-btn {
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.24);
  color: rgba(255, 255, 255, 0.92);
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 650;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, opacity 140ms ease;
}

.w-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.w-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(124, 58, 237, 0.28);
}

.w-btn-ghost {
  background: rgba(2, 6, 23, 0.12);
}

.w-btn-primary {
  background: rgba(124, 58, 237, 0.95);
  border-color: rgba(124, 58, 237, 0.7);
}

.w-btn-primary:hover:not(:disabled) {
  background: var(--primary2);
  border-color: rgba(124, 58, 237, 0.8);
}

.w-btn-danger {
  background: rgba(239, 68, 68, 0.95);
  border-color: rgba(239, 68, 68, 0.7);
}

.w-btn-danger:hover:not(:disabled) {
  background: var(--danger2);
  border-color: rgba(239, 68, 68, 0.85);
}

.w-ic {
  width: 16px;
  height: 16px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.w-state {
  min-height: 520px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 10px;
  padding: 22px;
}

.w-state-ic {
  width: 48px;
  height: 48px;
}

.w-state-ic.danger {
  color: rgba(239, 68, 68, 0.95);
}

.w-state-ic.muted {
  color: rgba(148, 163, 184, 0.9);
}

.w-state-title {
  font-weight: 750;
  font-size: 1.05rem;
}

.w-state-text {
  color: var(--muted);
  max-width: 520px;
  line-height: 1.55;
}

.w-skel {
  width: 100%;
  max-width: 980px;
  display: grid;
  gap: 10px;
}

.w-skel-row {
  height: 54px;
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.06), rgba(148, 163, 184, 0.14), rgba(148, 163, 184, 0.06));
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

.w-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.12);
}

.w-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.w-table thead th {
  text-align: left;
  padding: 12px 12px;
  color: rgba(226, 232, 240, 0.8);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.22);
}

.w-table tbody td {
  padding: 14px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.14);
  vertical-align: top;
}

.w-table tbody tr:hover {
  background: rgba(124, 58, 237, 0.06);
}

.w-table tbody tr.proof {
  box-shadow: inset 3px 0 0 rgba(34, 197, 94, 0.65);
}

.w-td-amount .w-amount {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.w-muted {
  color: var(--muted2);
  margin-top: 6px;
  font-size: 0.82rem;
}

.w-strong {
  font-weight: 700;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.w-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 8px 10px;
  font-weight: 750;
  font-size: 0.82rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(2, 6, 23, 0.18);
}

.w-badge-ic {
  width: 14px;
  height: 14px;
}

.w-badge.success {
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.25);
}

.w-badge.info {
  background: rgba(59, 130, 246, 0.14);
  border-color: rgba(59, 130, 246, 0.25);
}

.w-badge.warning {
  background: rgba(245, 158, 11, 0.14);
  border-color: rgba(245, 158, 11, 0.25);
}

.w-badge.danger {
  background: rgba(239, 68, 68, 0.14);
  border-color: rgba(239, 68, 68, 0.25);
}

.w-badge.muted {
  background: rgba(148, 163, 184, 0.12);
  border-color: rgba(148, 163, 184, 0.22);
}

.w-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(124, 58, 237, 0.25);
  background: rgba(124, 58, 237, 0.12);
  color: rgba(255, 255, 255, 0.92);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 700;
  transition: transform 140ms ease, background 140ms ease;
}

.w-link:hover {
  transform: translateY(-1px);
  background: rgba(124, 58, 237, 0.18);
}

.w-th-actions,
.w-td-actions {
  text-align: right;
  width: 140px;
}

.w-cards {
  display: none;
  margin-top: 10px;
  gap: 12px;
}

.w-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(2, 6, 23, 0.18);
  padding: 14px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}

.w-card.proof {
  box-shadow: inset 3px 0 0 rgba(34, 197, 94, 0.65), 0 8px 20px rgba(0, 0, 0, 0.18);
}

.w-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.w-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  margin-top: 12px;
}

.w-kv .w-k {
  color: var(--muted2);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.w-kv .w-v {
  margin-top: 6px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  font-size: 0.92rem;
}

.w-kv .w-v.strong {
  font-weight: 850;
}

.w-card-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.w-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 12px 2px 2px;
  color: var(--muted);
  font-size: 0.9rem;
}

.w-pager {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.w-pages {
  display: flex;
  gap: 6px;
  align-items: center;
}

.w-pagebtn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.18);
  color: rgba(255, 255, 255, 0.9);
  font-weight: 800;
  cursor: pointer;
}

.w-pagebtn.active {
  background: rgba(124, 58, 237, 0.95);
  border-color: rgba(124, 58, 237, 0.7);
}

.w-ellipsis {
  color: var(--muted2);
  padding: 0 6px;
  font-weight: 800;
}

.w-modal {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  display: grid;
  place-items: center;
  padding: 16px;
  z-index: 1000;
}

.w-modal-card {
  width: min(560px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.92);
  box-shadow: var(--shadow2);
  overflow: hidden;
}

.w-proof-card {
  width: min(980px, 100%);
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.92);
  box-shadow: var(--shadow2);
  overflow: hidden;
}

.w-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.22);
}

.w-modal-title {
  font-weight: 850;
  letter-spacing: -0.02em;
}

.w-iconbtn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(2, 6, 23, 0.22);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.w-modal-body {
  padding: 14px;
}

.w-alert {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 1px solid rgba(245, 158, 11, 0.28);
  background: rgba(245, 158, 11, 0.14);
  border-radius: 16px;
  padding: 12px;
}

.w-alert-ic {
  width: 18px;
  height: 18px;
  color: rgba(245, 158, 11, 0.95);
  margin-top: 2px;
}

.w-alert-text {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;
  font-size: 0.92rem;
}

.w-modal-kv {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0 6px;
}

.w-modal-field {
  margin-top: 10px;
}

.w-textarea {
  width: 100%;
  margin-top: 8px;
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.18);
  color: rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  padding: 12px;
  outline: none;
  resize: vertical;
  min-height: 92px;
}

.w-textarea:focus {
  border-color: rgba(124, 58, 237, 0.45);
  box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.12);
}

.w-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.18);
}

.w-proof-body {
  display: grid;
  place-items: center;
  padding: 10px;
  background: rgba(2, 6, 23, 0.14);
}

.w-proof-img {
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(2, 6, 23, 0.18);
}

@media (max-width: 900px) {
  .w-toolbar {
    grid-template-columns: 1fr;
  }

  .w-table-wrap {
    display: none;
  }

  .w-cards {
    display: grid;
  }

  .w-panel-body {
    min-height: 520px;
  }

  .w-card-grid {
    grid-template-columns: 1fr;
  }

  .w-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .w-hero-actions {
    justify-content: flex-start;
  }

  .w-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .w-pager {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spin {
    animation: none;
  }

  .w-btn,
  .w-tab,
  .w-link {
    transition: none;
  }
}

.w-btn:focus-visible,
.w-tab:focus-visible,
.w-input:focus-visible,
.w-select:focus-visible,
.w-link:focus-visible,
.w-pagebtn:focus-visible,
.w-iconbtn:focus-visible {
  outline: 2px solid rgba(124, 58, 237, 0.85);
  outline-offset: 2px;
}
</style>
