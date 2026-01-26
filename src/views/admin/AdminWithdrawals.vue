<script setup>
import { ref, onMounted, watch, computed } from "vue"
import { useRoute } from "vue-router"
import axios from "axios"
import { getAuthHeaders } from "../../types/shared"
import {
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  ArrowPathIcon,
  BanknotesIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowUpTrayIcon,
  PhotoIcon,
} from "@heroicons/vue/24/outline"
import WithdrawalsTable from "../../components/admin/WithdrawalsTable.vue"
import ProofModal from "../../components/common/ProofModal.vue"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

const withdrawals = ref([])
const loading = ref(false)
const error = ref(null)

const route = useRoute()
const props = defineProps({ initialTab: { type: String, default: null } })

const currentTab = ref("pending")
const historyItems = ref([])
const historyLoading = ref(false)
const historyError = ref(null)
const historyPagination = ref({
  page: 1,
  limit: 10,
  totalPages: 1,
  totalDocs: 0,
  hasNextPage: false,
  hasPrevPage: false,
})
const historyFilters = ref({ status: "", q: "" })

const showProofModal = ref(false)
const proofUrl = ref(null)

const pendingQuery = ref("")
const showPendingFilters = ref(false)
const expanded = ref(new Set())
const busy = ref(new Set())

const fileNames = ref({})
const payoutRefs = ref({})
const statusDrafts = ref({})

const toast = ref({ show: false, type: "success", title: "", message: "" })
let toastTimer = null

const money = (centavos) => `₱${(Number(centavos || 0) / 100).toFixed(2)}`
const dt = (iso) => {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

const pendingCount = computed(() => withdrawals.value.length)
const pendingTotal = computed(() => withdrawals.value.reduce((sum, w) => sum + Number(w?.amount || 0), 0))
const verifiedCount = computed(() => withdrawals.value.filter((w) => !!w?.vendor?.isApproved).length)
const unverifiedCount = computed(() => withdrawals.value.length - verifiedCount.value)

const filteredWithdrawals = computed(() => {
  const q = pendingQuery.value.trim().toLowerCase()
  if (!q) return withdrawals.value
  return withdrawals.value.filter((w) => {
    const vendorName = (w?.vendor?.storeName || w?.userId?.name || w?.userId?.email || "").toString().toLowerCase()
    const bank = (w?.bankAccount?.bankName || "").toString().toLowerCase()
    const acct = (w?.bankAccount?.accountNumber || "").toString().toLowerCase()
    const provider = (w?.provider || "").toString().toLowerCase()
    const id = (w?._id || "").toString().toLowerCase()
    return vendorName.includes(q) || bank.includes(q) || acct.includes(q) || provider.includes(q) || id.includes(q)
  })
})

const showToast = (type, title, message = "") => {
  toast.value = { show: true, type, title, message }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value.show = false
  }, 3200)
}

const closeToast = () => {
  toast.value.show = false
  if (toastTimer) clearTimeout(toastTimer)
}

const toggleExpanded = (id) => {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}

const isExpanded = (id) => expanded.value.has(id)

const setBusy = (id, v) => {
  if (v) busy.value.add(id)
  else busy.value.delete(id)
}

const isBusy = (id) => busy.value.has(id)

const fetchWithdrawals = async () => {
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.get(`${API_BASE_URL}/payments/admin/withdrawals?status=pending&limit=100`, {
      headers: getAuthHeaders(),
    })
    withdrawals.value = data?.data && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
    const nextNames = {}
    const nextRefs = {}
    const nextStatus = {}
    for (const w of withdrawals.value) {
      nextNames[w._id] = fileNames.value[w._id] || ""
      nextRefs[w._id] = payoutRefs.value[w._id] || ""
      nextStatus[w._id] = statusDrafts.value[w._id] || w.status || "pending"
    }
    fileNames.value = nextNames
    payoutRefs.value = nextRefs
    statusDrafts.value = nextStatus
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
}

const fetchHistory = async (page = 1, limit = historyPagination.value.limit, filters = {}) => {
  historyLoading.value = true
  historyError.value = null
  try {
    const params = { page, limit, ...filters }
    const { data } = await axios.get(`${API_BASE_URL}/payments/admin/withdrawals`, {
      headers: getAuthHeaders(),
      params,
    })

    historyItems.value = data?.data || []

    if (data?.pagination) {
      historyPagination.value = {
        page: data.pagination.page,
        limit: data.pagination.limit,
        totalPages: data.pagination.totalPages,
        totalDocs: data.pagination.totalDocs,
        hasNextPage: data.pagination.hasNextPage,
        hasPrevPage: data.pagination.hasPrevPage,
      }
    } else {
      historyPagination.value = {
        page,
        limit,
        totalPages: 1,
        totalDocs: historyItems.value.length,
        hasNextPage: false,
        hasPrevPage: false,
      }
    }
  } catch (err) {
    historyError.value = err
  } finally {
    historyLoading.value = false
  }
}

function onHistoryPageChange(page) {
  fetchHistory(page, historyPagination.value.limit, historyFilters.value)
}

function onHistoryFilterChange(filters) {
  historyFilters.value = { ...historyFilters.value, ...filters }
  fetchHistory(1, historyPagination.value.limit, historyFilters.value)
}

function openProofModal(url) {
  proofUrl.value = url
  showProofModal.value = true
}

function closeProofModal() {
  proofUrl.value = null
  showProofModal.value = false
}

const uploadProof = async (file) => {
  const fd = new FormData()
  fd.append("images", file)
  const { data } = await axios.post(`${API_BASE_URL}/upload/temp`, fd, {
    headers: { ...getAuthHeaders(), "Content-Type": "multipart/form-data" },
  })
  return data?.images?.length ? data.images[0].url : null
}

const onProofChange = (id, e) => {
  const f = e?.target?.files?.[0]
  fileNames.value = { ...fileNames.value, [id]: f ? f.name : "" }
}

const approve = async (paymentId) => {
  setBusy(paymentId, true)
  try {
    let adminProofUrl = null
    const input = document.getElementById(`proof-${paymentId}`)
    if (input && input.files && input.files[0]) adminProofUrl = await uploadProof(input.files[0])
    const payoutRef = (payoutRefs.value[paymentId] || "").trim() || null
    await axios.post(
      `${API_BASE_URL}/payments/${paymentId}/approve`,
      { adminProofUrl, payoutRef },
      { headers: getAuthHeaders() }
    )
    showToast("success", "Approved", "Withdrawal marked as approved.")
    await fetchWithdrawals()
  } catch (err) {
    showToast("error", "Approve failed", "Please try again.")
  } finally {
    setBusy(paymentId, false)
  }
}

const reject = async (paymentId) => {
  const reason = prompt("Reason for rejection")
  if (!reason) return

  setBusy(paymentId, true)
  try {
    await axios.post(`${API_BASE_URL}/payments/${paymentId}/reject`, { reason }, { headers: getAuthHeaders() })
    showToast("success", "Rejected", "Withdrawal has been rejected.")
    await fetchWithdrawals()
  } catch (err) {
    showToast("error", "Reject failed", "Please try again.")
  } finally {
    setBusy(paymentId, false)
  }
}

const updateStatus = async (paymentId) => {
  setBusy(paymentId, true)
  try {
    const status = statusDrafts.value[paymentId] || "processing"
    const proofInput = document.getElementById(`proof-${paymentId}`)
    let adminProofUrl = null
    if (proofInput && proofInput.files && proofInput.files[0]) adminProofUrl = await uploadProof(proofInput.files[0])
    const payoutRef = (payoutRefs.value[paymentId] || "").trim() || null

    await axios.post(
      `${API_BASE_URL}/payments/${paymentId}/status`,
      { status, adminProofUrl, payoutRef },
      { headers: getAuthHeaders() }
    )

    showToast("success", "Updated", "Status updated successfully.")
    await fetchWithdrawals()
  } catch (err) {
    showToast("error", "Update failed", "Please try again.")
  } finally {
    setBusy(paymentId, false)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showToast("success", "Copied", "Copied to clipboard.")
  } catch (err) {
    const textArea = document.createElement("textarea")
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand("copy")
    document.body.removeChild(textArea)
    showToast("success", "Copied", "Copied to clipboard.")
  }
}

const setTab = async (tab) => {
  currentTab.value = tab
  if (tab === "history") await fetchHistory(1)
}

onMounted(async () => {
  await fetchWithdrawals()
  if ((route.query && route.query.tab === "history") || props.initialTab === "history") {
    await setTab("history")
  }
})

watch(
  () => props.initialTab,
  async (newTab) => {
    if (newTab === "history") await setTab("history")
    if (newTab === "pending") currentTab.value = "pending"
  }
)

watch(
  () => route.fullPath,
  async () => {
    if ((route.query && route.query.tab === "history") || route.name === "AdminWithdrawalsHistory" || route.path.endsWith("/history")) {
      await setTab("history")
    }
  }
)
</script>

<template>
  <div class="page">
    <div class="toast" v-if="toast.show">
      <div class="toast-card" :class="`toast-${toast.type}`">
        <div class="toast-dot" :class="`dot-${toast.type}`"></div>
        <div class="toast-main">
          <div class="toast-title">{{ toast.title }}</div>
          <div class="toast-msg" v-if="toast.message">{{ toast.message }}</div>
        </div>
        <button class="toast-close" @click="closeToast" aria-label="Close">
          <XCircleIcon class="i18" />
        </button>
      </div>
    </div>

    <header class="head">
      <div class="head-bg"></div>

      <div class="head-row">
        <div class="head-left">
          <div class="mark">
            <div class="mark-ic">
              <BanknotesIcon class="i18" />
            </div>
            <div class="mark-txt">
              <div class="h1">Withdrawals</div>
              <div class="h2">
                <span class="live"></span>
                <span>{{ pendingCount }} pending</span>
                <span class="sep">•</span>
                <span class="muted">Total {{ money(pendingTotal) }}</span>
              </div>
            </div>
          </div>

          <div class="tabs">
            <button class="tab" :class="{ active: currentTab === 'pending' }" @click="setTab('pending')">Pending</button>
            <button class="tab" :class="{ active: currentTab === 'history' }" @click="setTab('history')">History</button>
          </div>
        </div>

        <div class="head-right">
          <button class="btn ghost" v-if="currentTab === 'pending'" @click="showPendingFilters = !showPendingFilters">
            <FunnelIcon class="i16" />
            Options
          </button>
          <button class="btn" @click="fetchWithdrawals" :disabled="loading">
            <ArrowPathIcon class="i16" :class="{ spin: loading }" />
            Refresh
          </button>
        </div>
      </div>

      <div v-if="currentTab === 'pending'" class="head-tools">
        <div class="search">
          <MagnifyingGlassIcon class="i16 muted" />
          <input v-model="pendingQuery" class="search-input" placeholder="Search vendor, bank, account, provider, ID…" />
          <div class="chip" v-if="pendingQuery.trim()">{{ filteredWithdrawals.length }} shown</div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-k">Queue value</div>
            <div class="stat-v">{{ money(pendingTotal) }}</div>
          </div>
          <div class="stat">
            <div class="stat-k">Verified sellers</div>
            <div class="stat-v">{{ verifiedCount }}</div>
          </div>
          <div class="stat">
            <div class="stat-k">Unverified</div>
            <div class="stat-v">{{ unverifiedCount }}</div>
          </div>
        </div>
      </div>

      <transition name="fade">
        <div v-if="currentTab === 'pending' && showPendingFilters" class="note">
          <div class="note-ic">
            <ClockIcon class="i18" />
          </div>
          <div class="note-txt">
            <div class="note-title">Clean payout trail</div>
            <div class="note-sub">Attach proof and add a payout reference. Use “Processing” while you’re sending the payout.</div>
          </div>
        </div>
      </transition>
    </header>

    <main class="main">
      <div v-if="loading" class="state">
        <div class="spinner"></div>
        <div class="state-title">Loading withdrawals…</div>
        <div class="state-sub">Fetching the latest pending requests.</div>
      </div>

      <div v-else-if="error" class="state error">
        <div class="state-ic">
          <XCircleIcon class="i28" />
        </div>
        <div class="state-title">Failed to load</div>
        <div class="state-sub">{{ error?.message || "An unexpected error occurred" }}</div>
        <button class="btn" @click="fetchWithdrawals">Try again</button>
      </div>

      <template v-else>
        <div v-if="currentTab === 'pending'">
          <div v-if="filteredWithdrawals.length === 0" class="state">
            <div class="state-ic">
              <BanknotesIcon class="i28" />
            </div>
            <div class="state-title">No pending withdrawals</div>
            <div class="state-sub">You’re all caught up.</div>
          </div>

          <div v-else class="cards">
            <article class="card" v-for="w in filteredWithdrawals" :key="w._id">
              <div class="card-top">
                <div class="card-left">
                  <div class="ava">{{ (w.vendor?.storeName || w.userId?.name || "V").charAt(0).toUpperCase() }}</div>

                  <div class="idblock">
                    <div class="name">
                      <span class="name-main">{{ w.vendor?.storeName || w.userId?.name || (w.userId?.email || "Unknown Vendor") }}</span>
                      <span class="badge" :class="w.vendor?.isApproved ? 'b-ok' : 'b-warn'">
                        <CheckCircleIcon v-if="w.vendor?.isApproved" class="i14" />
                        <ClockIcon v-else class="i14" />
                        {{ w.vendor?.isApproved ? "Verified" : "Unverified" }}
                      </span>
                    </div>

                    <div class="sub">
                      <span class="muted">{{ dt(w.createdAt) }}</span>
                      <span class="sep">•</span>
                      <span class="mono muted">{{ w._id }}</span>
                      <button class="icon" @click="copyToClipboard(w._id)" aria-label="Copy ID" title="Copy ID">
                        <ClipboardDocumentIcon class="i16" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="card-right">
                  <div class="amt">
                    <div class="amt-v">{{ money(w.amount) }}</div>
                    <div class="amt-k">Withdrawal</div>
                  </div>

                  <div class="stack">
                    <div class="sb" :class="`s-${w.status || 'pending'}`">
                      <ClockIcon v-if="(w.status || 'pending') === 'pending'" class="i14" />
                      <ArrowPathIcon v-else-if="w.status === 'processing'" class="i14 spin" />
                      <CheckCircleIcon v-else-if="w.status === 'succeeded'" class="i14" />
                      <XCircleIcon v-else-if="w.status === 'failed'" class="i14" />
                      {{ (w.status || "pending").charAt(0).toUpperCase() + (w.status || "pending").slice(1) }}
                    </div>

                    <button class="btn tiny ghost" @click="toggleExpanded(w._id)">
                      {{ isExpanded(w._id) ? "Close" : "Review" }}
                      <ChevronUpIcon v-if="isExpanded(w._id)" class="i14" />
                      <ChevronDownIcon v-else class="i14" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="card-mid">
                <div class="kv">
                  <div class="kv-k">Provider</div>
                  <div class="kv-v">{{ w.provider || "Bank Transfer" }}</div>
                </div>

                <div class="kv">
                  <div class="kv-k">Account</div>
                  <div class="kv-v mono">
                    {{ w.bankAccount?.accountNumber || "—" }}
                    <button
                      v-if="w.bankAccount?.accountNumber"
                      class="icon"
                      @click="copyToClipboard(w.bankAccount.accountNumber)"
                      aria-label="Copy account number"
                      title="Copy account number"
                    >
                      <ClipboardDocumentIcon class="i16" />
                    </button>
                  </div>
                </div>

                <div class="kv" v-if="w.bankAccount?.bankName">
                  <div class="kv-k">Bank</div>
                  <div class="kv-v">{{ w.bankAccount.bankName }}</div>
                </div>
              </div>

              <transition name="drawer">
                <div class="drawer" v-show="isExpanded(w._id)">
                  <div class="drawer-grid">
                    <section class="panel">
                      <div class="panel-h">
                        <div class="panel-t">Payout details</div>
                        <div class="panel-s">Attach proof and set status for audit-ready tracking.</div>
                      </div>

                      <div class="form">
                        <div class="form-row">
                          <div class="up">
                            <input
                              type="file"
                              :id="`proof-${w._id}`"
                              accept="image/*"
                              class="up-in"
                              @change="(e) => onProofChange(w._id, e)"
                            />
                            <label class="up-box" :for="`proof-${w._id}`">
                              <div class="up-ic">
                                <ArrowUpTrayIcon class="i18" />
                              </div>
                              <div class="up-txt">
                                <div class="up-top">Upload proof</div>
                                <div class="up-sub">
                                  <span v-if="fileNames[w._id]" class="file">
                                    <PhotoIcon class="i14" />
                                    <span class="file-n">{{ fileNames[w._id] }}</span>
                                  </span>
                                  <span v-else class="muted">PNG / JPG</span>
                                </div>
                              </div>
                            </label>
                          </div>

                          <label class="field">
                            <span class="lbl">Payout reference</span>
                            <input v-model="payoutRefs[w._id]" type="text" placeholder="Optional (e.g., TXN-1234)" class="control" autocomplete="off" />
                          </label>
                        </div>

                        <div class="form-row">
                          <label class="field">
                            <span class="lbl">Status</span>
                            <select v-model="statusDrafts[w._id]" class="control">
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="succeeded">Succeeded</option>
                              <option value="failed">Failed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </label>

                          <button class="btn soft wide" @click="updateStatus(w._id)" :disabled="isBusy(w._id)">
                            <ArrowPathIcon class="i16" :class="{ spin: isBusy(w._id) }" />
                            Update
                          </button>
                        </div>
                      </div>
                    </section>

                    <aside class="panel cta">
                      <div class="panel-h">
                        <div class="panel-t">Decision</div>
                        <div class="panel-s">Approve once payout is complete. Reject requires a reason.</div>
                      </div>

                      <div class="cta-stack">
                        <button class="btn ok wide" @click="approve(w._id)" :disabled="isBusy(w._id)">
                          <CheckCircleIcon class="i16" />
                          Approve
                        </button>
                        <button class="btn bad wide" @click="reject(w._id)" :disabled="isBusy(w._id)">
                          <XCircleIcon class="i16" />
                          Reject
                        </button>
                      </div>
                    </aside>
                  </div>
                </div>
              </transition>
            </article>
          </div>
        </div>

        <div v-else class="history">
          <WithdrawalsTable
            :items="historyItems"
            :loading="historyLoading"
            :pagination="historyPagination"
            @page-change="onHistoryPageChange"
            @open-proof="openProofModal"
            @filter-change="onHistoryFilterChange"
          />
          <ProofModal :show="showProofModal" :url="proofUrl" @close="closeProofModal" />
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: none;
  padding: clamp(12px, 2.2vw, 18px);
  box-sizing: border-box;
}

.head {
  position: sticky;
  top: 0;
  z-index: 30;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.head-bg {
  height: 86px;
  background: radial-gradient(
      1200px 220px at 18% 20%,
      color-mix(in srgb, var(--color-primary) 20%, transparent),
      transparent 60%
    ),
    radial-gradient(
      900px 220px at 85% 10%,
      color-mix(in srgb, var(--color-info) 16%, transparent),
      transparent 60%
    );
  border-bottom: 1px solid color-mix(in srgb, var(--border-primary) 70%, transparent);
}

.head-row {
  margin-top: -64px;
  padding: 0.9rem 0.9rem 0.75rem;
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: center;
  flex-wrap: wrap;
}

.head-left {
  display: flex;
  gap: 0.9rem;
  align-items: center;
  min-width: 0;
  flex-wrap: wrap;
}

.head-right {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.mark {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}

.mark-ic {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 14%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 24%, var(--border-primary));
}

.mark-txt {
  min-width: 0;
}

.h1 {
  font-weight: 950;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  font-size: 1.08rem;
  line-height: 1.1;
}

.h2 {
  margin-top: 0.25rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: var(--text-secondary);
  font-size: 0.86rem;
  flex-wrap: wrap;
}

.live {
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--color-primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.sep {
  opacity: 0.65;
}

.tabs {
  display: inline-flex;
  padding: 0.25rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 76%, var(--bg-secondary));
}

.tab {
  border: 0;
  background: transparent;
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  font-weight: 950;
  font-size: 0.86rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--theme-transition-duration) var(--theme-transition-timing);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--card-shadow);
}

.head-tools {
  padding: 0 0.9rem 0.9rem;
  display: grid;
  gap: 0.75rem;
}

.search {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: var(--input-bg);
}

.search-input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--input-text);
  font-size: 0.92rem;
}

.chip {
  flex: 0 0 auto;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 85%, var(--bg-secondary));
  font-weight: 950;
  font-size: 0.78rem;
  color: var(--text-primary);
}

.stats {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat {
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 82%, var(--bg-secondary));
  padding: 0.75rem 0.8rem;
  min-height: 62px;
}

.stat-k {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 900;
}

.stat-v {
  margin-top: 0.15rem;
  font-size: 1.04rem;
  font-weight: 1000;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note {
  margin: 0 0.9rem 0.95rem;
  border-radius: 16px;
  border: 1px dashed color-mix(in srgb, var(--border-primary) 85%, transparent);
  background: color-mix(in srgb, var(--surface) 84%, var(--bg-secondary));
  padding: 0.85rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.note-ic {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg-secondary));
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  flex: 0 0 auto;
}

.note-title {
  font-weight: 1000;
  color: var(--text-primary);
}

.note-sub {
  margin-top: 0.2rem;
  color: var(--text-secondary);
  line-height: 1.35;
  font-size: 0.92rem;
}

.main {
  margin-top: 0.95rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  justify-items: left;
  gap: 0.9rem;
}

.card {
  width: 100%;
  height: fit-content;
  max-width: 500px;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  transition: transform var(--theme-transition-duration) var(--theme-transition-timing),
    box-shadow var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing);
}

.card:hover {
  transform: translateY(-1px);
  box-shadow: var(--card-shadow-hover);
  border-color: var(--border-secondary);
}

.card-top {
  padding: 0.9rem;
  display: flex;
  justify-content: space-between;
  gap: 0.9rem;
  align-items: center;
  border-bottom: 1px solid var(--border-primary);
  flex-wrap: wrap;
}

.card-left {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.ava {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 1000;
  color: var(--color-primary);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary) 22%, var(--surface)),
    color-mix(in srgb, var(--color-info) 18%, var(--surface))
  );
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--border-primary));
  flex: 0 0 auto;
}

.idblock {
  min-width: 0;
  flex: 1;
}

.name {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  min-width: 0;
  flex-wrap: wrap;
}

.name-main {
  font-weight: 1000;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 420px;
}

.badge {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.24rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  font-size: 0.76rem;
  font-weight: 950;
  flex: 0 0 auto;
}

.b-ok {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-success) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-success-text) 92%, var(--text-primary));
}

.b-warn {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-warning) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary));
}

.sub {
  margin-top: 0.25rem;
  display: flex;
  gap: 0.45rem;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
}

.card-right {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.amt {
  text-align: left;
  min-width: 0;
}

.amt-v {
  font-weight: 1100;
  font-size: 1.18rem;
  color: var(--color-primary);
  letter-spacing: -0.02em;
  line-height: 1;
}

.amt-k {
  margin-top: 0.25rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 900;
}

.stack {
  display: grid;
  gap: 0.5rem;
  justify-items: end;
  margin-left: auto;
}

.sb {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 76%, var(--bg-secondary));
  color: var(--text-primary);
  font-weight: 1000;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.s-pending {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-warning) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary));
}

.s-processing {
  border-color: color-mix(in srgb, var(--color-info) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-info) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-info-text) 92%, var(--text-primary));
}

.s-succeeded {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-success) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-success-text) 92%, var(--text-primary));
}

.s-failed {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
}

.s-cancelled {
  opacity: 0.85;
}

.card-mid {
  padding: 0.85rem 0.9rem;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.65rem;
}

.kv {
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 84%, var(--bg-secondary));
  padding: 0.65rem 0.7rem;
  min-height: 54px;
}

.kv-k {
  font-size: 0.78rem;
  font-weight: 950;
  color: var(--text-secondary);
}

.kv-v {
  margin-top: 0.18rem;
  display: flex;
  gap: 0.4rem;
  align-items: center;
  min-width: 0;
  color: var(--text-primary);
  font-weight: 950;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer {
  border-top: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 86%, var(--bg-secondary));
  padding: 0.9rem;
}

.drawer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
}

.panel {
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 82%, var(--bg-secondary));
  padding: 0.85rem;
}

.panel-h {
  margin-bottom: 0.75rem;
}

.panel-t {
  font-weight: 1100;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.panel-s {
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.35;
}

.form {
  display: grid;
  gap: 0.75rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
  align-items: end;
}

.field {
  display: grid;
  gap: 0.35rem;
}

.lbl {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 1000;
  letter-spacing: 0.02em;
}

.control {
  width: 100%;
  padding: 0.7rem 0.75rem;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: var(--input-bg);
  color: var(--input-text);
  outline: none;
  font-size: 0.9rem;
  transition: border-color var(--theme-transition-duration) var(--theme-transition-timing);
}

.control:focus {
  border-color: var(--input-border-focus);
}

.up-in {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.up-box {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.8rem;
  border-radius: 16px;
  border: 1px dashed color-mix(in srgb, var(--border-primary) 85%, transparent);
  background: color-mix(in srgb, var(--surface) 76%, var(--bg-secondary));
  cursor: pointer;
  transition: background var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing),
    transform var(--theme-transition-duration) var(--theme-transition-timing);
  min-height: 48px;
}

.up-box:hover {
  background: color-mix(in srgb, var(--surface) 66%, var(--bg-secondary));
  border-color: var(--border-secondary);
}

.up-box:active {
  transform: translateY(1px);
}

.up-ic {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--border-primary));
  background: color-mix(in srgb, var(--color-primary) 10%, var(--surface));
  color: var(--color-primary);
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.up-txt {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.up-top {
  font-weight: 1100;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.up-sub {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.file {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  font-weight: 1000;
  font-size: 0.78rem;
  min-width: 0;
}

.file-n {
  min-width: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  display: inline-flex;
  gap: 0.45rem;
  align-items: center;
  justify-content: center;
  padding: 0.66rem 0.95rem;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 1000;
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform var(--theme-transition-duration) var(--theme-transition-timing),
    background var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing),
    opacity var(--theme-transition-duration) var(--theme-transition-timing);
  user-select: none;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface) 70%, var(--bg-secondary));
  border-color: var(--border-secondary);
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
}

.btn.soft {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--color-primary) 22%, var(--border-primary));
}

.btn.tiny {
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 1000;
}

.btn.wide {
  width: 100%;
}

.btn.ok {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-success) 16%, var(--surface));
}

.btn.ok:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-success) 22%, var(--surface));
}

.btn.bad {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 14%, var(--surface));
}

.btn.bad:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 20%, var(--surface));
}

.icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing),
    transform var(--theme-transition-duration) var(--theme-transition-timing);
  flex: 0 0 auto;
}

.icon:hover {
  background: color-mix(in srgb, var(--surface) 70%, var(--bg-secondary));
  border-color: var(--border-secondary);
  color: var(--text-primary);
}

.icon:active {
  transform: translateY(1px);
}

.state {
  display: grid;
  place-items: center;
  gap: 0.35rem;
  padding: 3rem 1rem;
  text-align: center;
  color: var(--text-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--card-shadow);
}

.state.error {
  border-color: color-mix(in srgb, var(--color-danger) 25%, var(--border-primary));
}

.state-title {
  font-weight: 1100;
  color: var(--text-primary);
  font-size: 1.06rem;
  letter-spacing: -0.02em;
}

.state-sub {
  color: var(--text-secondary);
  max-width: 720px;
}

.state-ic {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--surface) 76%, var(--bg-secondary));
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.spinner {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  animation: spin 1s linear infinite;
}

.toast {
  position: fixed;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 60;
  display: grid;
  justify-items: center;
}

.toast-card {
  width: min(520px, calc(100vw - 24px));
  border-radius: 18px;
  padding: 0.8rem 0.85rem;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--card-shadow-hover);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.toast-dot {
  width: 10px;
  height: 10px;
  border-radius: 99px;
  margin-top: 0.35rem;
  flex: 0 0 auto;
}

.dot-success {
  background: var(--color-success);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-success) 18%, transparent);
}

.dot-error {
  background: var(--color-danger);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 18%, transparent);
}

.toast-main {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.toast-title {
  font-weight: 1100;
  color: var(--text-primary);
}

.toast-msg {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.25;
}

.toast-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  padding: 0.1rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.toast-close:hover {
  color: var(--text-primary);
}

.toast-success {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--border-primary));
}

.toast-error {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--border-primary));
}

.muted {
  color: var(--text-muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.02em;
}

.i28 {
  width: 28px;
  height: 28px;
}

.i18 {
  width: 18px;
  height: 18px;
}

.i16 {
  width: 16px;
  height: 16px;
}

.i14 {
  width: 14px;
  height: 14px;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms var(--theme-transition-timing);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: max-height 260ms var(--theme-transition-timing), opacity 180ms var(--theme-transition-timing);
  overflow: hidden;
}

.drawer-enter-from,
.drawer-leave-to {
  max-height: 0;
  opacity: 0;
}

.drawer-enter-to,
.drawer-leave-from {
  max-height: 780px;
  opacity: 1;
}

@media (max-width: 860px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
