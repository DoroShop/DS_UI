<script setup>
import { ref, computed, onMounted, watch } from "vue"
import { storeToRefs } from "pinia"
import {
  BanknotesIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChartBarIcon,
  WalletIcon,
  ArrowPathIcon,
} from "@heroicons/vue/24/outline"
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores"
import { useCommissionStore } from "../../../stores/vendor/commissionStore"
import { useAuthStore } from "../../../stores/authStores"
import { formatToPHCurrency } from "../../../utils/currencyFormat.js"

const vendorStore = useVendorDashboardStore()
const commissionStore = useCommissionStore()
const authStore = useAuthStore()
const { vendor } = storeToRefs(vendorStore)

const financialSummary = computed(() => vendorStore.financialSummary)
const monthlyBreakdown = computed(() => vendorStore.monthlyBreakdown)
const recentOrders = computed(() => vendorStore.recentOrders)
const recentOrdersPage = computed(() => vendorStore.recentOrdersPage || 1)
const recentOrdersLimit = computed(() => vendorStore.recentOrdersLimit || 20)
const recentOrdersTotal = computed(() => vendorStore.recentOrdersTotal || 0)
const recentOrdersTotalPages = computed(() => Math.max(1, Math.ceil(recentOrdersTotal.value / recentOrdersLimit.value)))
const pendingCODCommissions = computed(() => vendorStore.pendingCODCommissions)
const isLoading = computed(() => vendorStore.financialsLoading)

const commissionSummary = computed(() => commissionStore.summary)
const pendingCommissions = computed(() => commissionStore.pendingCommissions)
const isRemitting = computed(() => commissionStore.loading)

const toNumber = (v) => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const lower = (v) => (typeof v === "string" ? v.toLowerCase() : "")

const walletBalance = computed(() => toNumber(vendor.value?.wallet))

const activeTab = ref("overview")
const showRemitModal = ref(false)
const remitError = ref("")
const remitSuccess = ref(false)

const formatDate = (dateString) =>
  dateString ? new Date(dateString).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "N/A"

const STATUS_CLASS = Object.freeze({
  paid: "badge-success",
  pending: "badge-warning",
  waived: "badge-info",
  delivered: "badge-success",
  completed: "badge-success",
  processing: "badge-info",
  shipped: "badge-info",
  released: "badge-success",
  pending_release: "badge-warning",
  held: "badge-info",
})
const getStatusBadgeClass = (status) => STATUS_CLASS[lower(status)] || "badge-default"

const PAYOUT_CLASS = Object.freeze({
  released: "badge-success",
  pending: "badge-warning",
  held: "badge-info",
  pending_release: "badge-warning",
})
const getPayoutBadgeClass = (status, method) => (lower(method) === "cod" ? "badge-default" : PAYOUT_CLASS[lower(status)] || "badge-default")
const getPaymentMethodClass = (method) => (lower(method) === "cod" ? "badge-cod" : "badge-digital")

const months = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
const fullMonths = Object.freeze(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"])

const getMonthData = (month) => monthlyBreakdown.value?.[month] ?? null

const maxMonthlyValue = computed(() =>
  fullMonths.reduce((max, m) => Math.max(max, toNumber(getMonthData(m)?.grossRevenue)), 0)
)

const getBarHeight = (month) => {
  const max = maxMonthlyValue.value
  const value = toNumber(getMonthData(month)?.grossRevenue)
  if (!max) return 0
  return Math.max((value / max) * 100, 2)
}

const totalPending = computed(() => toNumber(commissionStore.totalPending))
const balanceAfterRemit = computed(() => Math.max(0, walletBalance.value - totalPending.value))
const hasPending = computed(() => totalPending.value > 0)

const canRemitAll = computed(() => {
  const pending = totalPending.value
  return pending > 0 && walletBalance.value >= pending
})

const openRemitModal = () => {
  remitError.value = ""
  remitSuccess.value = false
  showRemitModal.value = true
}
const closeRemitModal = () => {
  showRemitModal.value = false
  remitError.value = ""
}

const fetchOrdersPage = async (page = 1, limit = recentOrdersLimit.value) => {
  try {
    await vendorStore.fetchVendorFinancials({ page, limit })
  } catch (e) {
    console.error('[Financials] fetchOrdersPage error', e)
  }
}

const goToPage = async (page) => {
  if (page < 1 || page > recentOrdersTotalPages.value) return
  await fetchOrdersPage(page, recentOrdersLimit.value)
  window?.requestAnimationFrame?.(() => {
    const el = document.querySelector('.panel')
    if (el && 'scrollTop' in el) {
      // Use bracket to avoid TS-type assertions in JS file
      el['scrollTop'] = 0
    }
  })
}

const prevPage = async () => {
  if (recentOrdersPage.value > 1) await goToPage(recentOrdersPage.value - 1)
}

const nextPage = async () => {
  if (recentOrdersPage.value < recentOrdersTotalPages.value) await goToPage(recentOrdersPage.value + 1)
}

// When switching to orders tab, ensure current page data is loaded
watch(
  () => activeTab.value,
  async (v) => {
    if (v === 'orders') {
      await fetchOrdersPage(recentOrdersPage.value || 1, recentOrdersLimit.value)
    }
  }
)

const getPendingCommissionIds = () =>
  pendingCommissions.value
    .map((c) => c?._id)
    .filter((id) => typeof id === "string" && id.length > 0)

const remitAllPending = async () => {
  remitError.value = ""

  const pending = totalPending.value
  const balance = walletBalance.value

  if (pending <= 0) return (remitError.value = "No pending commissions to remit")
  if (!Number.isFinite(balance)) return (remitError.value = "Invalid wallet balance. Please refresh and try again.")
  if (balance < pending) {
    const needed = pending - balance
    return (remitError.value = `Insufficient wallet balance. Have: ₱${balance.toFixed(2)}, Need: ₱${pending.toFixed(2)}, Short by: ₱${needed.toFixed(2)}`)
  }

  const commissionIds = getPendingCommissionIds()
  if (!commissionIds.length) return (remitError.value = "No pending commissions found")

  try {
    const result = await commissionStore.bulkRemitCommissions(commissionIds)

    if (!result?.success) {
      remitError.value = result?.error || "Failed to remit commissions"
      return
    }

    remitSuccess.value = true

    await Promise.all([
      authStore.fetchSession(),
      vendorStore.fetchVendorFinancials({ force: true, page: recentOrdersPage.value || 1, limit: recentOrdersLimit.value }),
      vendorStore.fetchPendingCODCommissions(),
      commissionStore.fetchPendingCommissions(),
      commissionStore.fetchCommissionSummary(),
    ])

    setTimeout(closeRemitModal, 2000)
  } catch (e) {
    remitError.value = "Something went wrong while remitting. Please try again."
    console.error("[Financials] remitAllPending error:", e)
  }
}

const refreshAll = async () => {
  const page = activeTab.value === 'orders' ? recentOrdersPage.value || 1 : 1
  await Promise.all([
    authStore.fetchSession(),
    vendorStore.fetchVendorFinancials({ force: true, page, limit: recentOrdersLimit.value }),
    vendorStore.fetchPendingCODCommissions(),
    commissionStore.fetchCommissionSummary(),
    commissionStore.fetchPendingCommissions(),
  ])
}

onMounted(async () => {
  await authStore.fetchSession();

  await Promise.all([
    vendorStore.fetchVendorFinancials(),           // now cached by TTL
    vendorStore.fetchPendingCODCommissions(),      // now cached by TTL
    commissionStore.fetchCommissionSummary(),      // (you can also add TTL there)
    commissionStore.fetchPendingCommissions(),
  ]);
});

</script>

<template>
  <section class="fin">
    <div class="top">
      <div class="top-left">
        <div class="mark">
          <div class="mark-ic">
            <BanknotesIcon class="i20" />
          </div>
          <div class="mark-txt">
            <div class="h">Financial Overview</div>
            <div class="sub">Track earnings, commissions, releases, and payouts.</div>
          </div>
        </div>
      </div>

      <div class="top-right">
        <div class="chip">
          <span class="chip-k">Wallet</span>
          <span class="chip-v">{{ formatToPHCurrency(walletBalance) }}</span>
        </div>

        <button class="btn" :disabled="isLoading" @click="refreshAll">
          <ArrowPathIcon class="i16" :class="{ spin: isLoading }" />
          Refresh
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="state">
      <div class="spinner"></div>
      <div class="state-t">Loading financial data…</div>
      <div class="state-s">Fetching latest stats for your store.</div>
    </div>

    <div v-else class="body">
      <div class="grid">
        <div class="card tone-blue">
          <div class="card-ic">
            <CurrencyDollarIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Total Gross Revenue</div>
            <div class="v">{{ formatToPHCurrency(financialSummary?.totalGrossRevenue || 0) }}</div>
            <div class="s">From {{ financialSummary?.totalOrders || 0 }} orders</div>
          </div>
        </div>

        <div class="card tone-green">
          <div class="card-ic">
            <BanknotesIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Your Net Earnings</div>
            <div class="v strong">{{ formatToPHCurrency(financialSummary?.netEarningsExpected || financialSummary?.totalNetEarnings || 0) }}</div>
            <div class="s">After commission (delivered orders)</div>
          </div>
        </div>

        <div class="card tone-emerald">
          <div class="card-ic">
            <CheckCircleIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Commission Paid</div>
            <div class="v">{{ formatToPHCurrency(financialSummary?.totalCommissionPaid || 0) }}</div>
            <div class="s">Auto-deducted from digital payments</div>
          </div>
        </div>

        <div class="card tone-amber">
          <div class="card-ic">
            <ClockIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Pending Commission</div>
            <div class="v warn">{{ formatToPHCurrency(financialSummary?.codPendingCommission || 0) }}</div>
            <div class="s">From COD orders (to remit)</div>
          </div>
        </div>

        <div class="card tone-indigo">
          <div class="card-ic">
            <ClockIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Pending Admin Release</div>
            <div class="v">{{ formatToPHCurrency(financialSummary?.pendingAdminRelease || 0) }}</div>
            <div class="s">Digital orders awaiting release</div>
          </div>
        </div>

        <!-- <div class="card tone-slate">
          <div class="card-ic">
            <CheckCircleIcon class="i22" />
          </div>
          <div class="card-main">
            <div class="k">Released to Wallet</div>
            <div class="v">{{ formatToPHCurrency(financialSummary?.netEarningsReleased || 0) }}</div>
            <div class="s">Already credited by admin</div>
          </div>
        </div> -->
      </div>

      <div class="info">
        <InformationCircleIcon class="i20" />
        <div class="info-txt">
          <div class="info-h">Platform Commission: {{ Math.round(financialSummary?.commissionRate) || 7 }}%</div>
          <div class="info-p">
            Digital payments: commission is auto-deducted and released after delivery verification.
            COD: you receive the full payment and remit the {{ Math.round(financialSummary?.commissionRate) || 7 }}% commission to the platform.
          </div>
        </div>
      </div>

      <div v-if="hasPending" class="remit">
        <div class="remit-top">
          <div class="remit-title">
            <ExclamationTriangleIcon class="i18" />
            <div>
              <div class="rt">Commission to Remit</div>
              <div class="rs">Action needed for COD commissions.</div>
            </div>
          </div>
          <span class="tag danger">Action Required</span>
        </div>

        <div class="remit-grid">
          <div class="mini">
            <div class="mini-k">Pending Amount</div>
            <div class="mini-v danger">{{ formatToPHCurrency(totalPending) }}</div>
          </div>

          <div class="mini">
            <div class="mini-k">Wallet Balance</div>
            <div class="mini-v" :class="{ danger: walletBalance < totalPending }">{{ formatToPHCurrency(walletBalance) }}</div>
          </div>

          <div class="mini">
            <div class="mini-k">After Remittance</div>
            <div class="mini-v">{{ formatToPHCurrency(balanceAfterRemit) }}</div>
          </div>
        </div>

        <div class="remit-actions">
          <button class="btn primary" :disabled="!canRemitAll || isRemitting" @click="openRemitModal">
            <WalletIcon class="i16" />
            {{ isRemitting ? "Processing..." : "Remit All Commissions" }}
          </button>

          <div v-if="walletBalance < totalPending" class="notice">
            <ExclamationTriangleIcon class="i16" />
            Insufficient wallet balance. Please top up your wallet.
          </div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
          <ChartBarIcon class="i16" />
          Monthly Overview
        </button>

        <button class="tab" :class="{ active: activeTab === 'orders' }" @click="activeTab = 'orders'">
          <DocumentTextIcon class="i16" />
          Order History
        </button>

        <button class="tab" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
          <ClockIcon class="i16" />
          Pending COD
          <span v-if="pendingCODCommissions?.length" class="badge">{{ pendingCODCommissions.length }}</span>
        </button>
      </div>

      <div class="panel">
        <div v-if="activeTab === 'overview'" class="section">
          <div class="section-top">
            <div>
              <div class="section-h">Monthly Revenue Breakdown</div>
              <div class="section-s">{{ new Date().getFullYear() }}</div>
            </div>
          </div>

          <div class="chart">
            <div class="bars">
              <div v-for="(month, index) in fullMonths" :key="month" class="bar-item">
                <div class="bar-rail" :title="`${months[index]}: ${formatToPHCurrency(getMonthData(month)?.grossRevenue || 0)}`">
                  <div class="bar-fill" :style="{ height: getBarHeight(month) + '%' }"></div>
                </div>
                <div class="bar-lbl">{{ months[index] }}</div>
              </div>
            </div>
          </div>

          <div class="table-shell">
            <div class="table-scroll">
              <table class="t">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Orders</th>
                    <th>Gross Revenue</th>
                    <th>Commission Paid</th>
                    <th>Commission Pending</th>
                    <th>Net Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="month in fullMonths" :key="month">
                    <td class="strong">{{ month }}</td>
                    <td>{{ getMonthData(month)?.orderCount || 0 }}</td>
                    <td>{{ formatToPHCurrency(getMonthData(month)?.grossRevenue || 0) }}</td>
                    <td class="ok">{{ formatToPHCurrency(getMonthData(month)?.commissionPaid || 0) }}</td>
                    <td class="warn">{{ formatToPHCurrency(getMonthData(month)?.commissionPending || 0) }}</td>
                    <td class="ok strong">{{ formatToPHCurrency(getMonthData(month)?.netEarnings || 0) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="scroll-hint">
              <span class="hint-dot"></span>
              Scroll horizontally to see all columns
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'orders'" class="section">
          <div class="section-top">
            <div>
              <div class="section-h">Recent Order History</div>
              <div class="section-s">Latest delivered/processed orders</div>
            </div>
          </div>

          <div v-if="!recentOrders?.length" class="empty">
            <DocumentTextIcon class="i28" />
            <div class="empty-t">No orders yet</div>
            <div class="empty-s">Start selling to see your order history.</div>
          </div>

          <div v-else class="table-shell">
            <div class="table-scroll">
              <table class="t">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Gross</th>
                    <th>Commission</th>
                    <!-- <th>Payout</th> -->
                    <th>Status</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in recentOrders" :key="order.orderId">
                    <td class="mono strong">#{{ order.orderNumber }}</td>
                    <td>{{ formatDate(order.date) }}</td>
                    <td class="clip">{{ order.buyerName }}</td>
                    <td>
                      <span :class="['pill2', getPaymentMethodClass(order.paymentMethod)]">{{ order.paymentMethod }}</span>
                    </td>
                    <td>{{ formatToPHCurrency(order.grossAmount) }}</td>
                    <td>{{ formatToPHCurrency(order.commissionAmount) }}</td>
                    <!-- <td>
                      <span :class="['pill2', getPayoutBadgeClass(order.payoutStatus, order.paymentMethod)]">
                        {{ lower(order.paymentMethod) === "cod" ? "COD (n/a)" : order.payoutStatus || "pending" }}
                      </span>
                    </td> -->
                    
                    <td>
                      <span :class="['pill2', getStatusBadgeClass(order.paymentStatus)]">{{ order.paymentStatus }}</span>
                    </td>
                    <td class="ok strong">{{ formatToPHCurrency(order.netEarnings) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="scroll-hint">
              <span class="hint-dot"></span>
              Scroll horizontally to see all columns
            </div>

            <div class="pagination">
              <div class="page-info">
                Showing
                <strong>
                  {{ ((recentOrdersPage - 1) * recentOrdersLimit) + 1 }}
                  -
                  {{ Math.min(recentOrdersPage * recentOrdersLimit, recentOrdersTotal) }}
                </strong>
                of <strong>{{ recentOrdersTotal }}</strong>
              </div>

              <div class="page-controls">
                <button class="btn" :disabled="recentOrdersPage <= 1" @click="prevPage">Prev</button>
                <div class="pages">
                  <button
                    v-for="p in Math.min(7, recentOrdersTotalPages)"
                    :key="p"
                    class="btn"
                    :class="{ active: p === recentOrdersPage }"
                    @click="goToPage(p)">
                    {{ p }}
                  </button>
                </div>
                <button class="btn" :disabled="recentOrdersPage >= recentOrdersTotalPages" @click="nextPage">Next</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'pending'" class="section">
          <div class="section-top">
            <div>
              <div class="section-h">Pending COD Commissions</div>
              <div class="section-s">COD orders where you received full payment. Please remit the commission amount.</div>
            </div>
          </div>

          <div v-if="!pendingCODCommissions?.length" class="empty okbox">
            <CheckCircleIcon class="i28" />
            <div class="empty-t">All caught up</div>
            <div class="empty-s">No pending COD commissions.</div>
          </div>

          <div v-else>
            <div class="alert">
              <ExclamationTriangleIcon class="i18" />
              <div class="alert-txt">
                <div class="alert-h">
                  Total Pending Commission:
                  {{ formatToPHCurrency(pendingCODCommissions.reduce((sum, order) => sum + toNumber(order?.commissionDue), 0)) }}
                </div>
                <div class="alert-s">From {{ pendingCODCommissions.length }} COD order(s)</div>
              </div>
            </div>

            <div class="table-shell">
              <div class="table-scroll">
                <table class="t">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Delivered Date</th>
                      <th>Customer</th>
                      <th>Order Total</th>
                      <th>Commission Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="order in pendingCODCommissions" :key="order.orderId">
                      <td class="mono strong">#{{ order.orderNumber }}</td>
                      <td>{{ formatDate(order.deliveredDate) }}</td>
                      <td class="clip">
                        <div class="stack">
                          <span class="strong">{{ order.buyerName }}</span>
                          <span class="muted">{{ order.buyerPhone }}</span>
                        </div>
                      </td>
                      <td>{{ formatToPHCurrency(order.grossAmount) }}</td>
                      <td class="warn strong">{{ formatToPHCurrency(order.commissionDue) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="scroll-hint">
                <span class="hint-dot"></span>
                Scroll horizontally to see all columns
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showRemitModal" class="modal" @click.self="closeRemitModal">
        <div class="modal-card">
          <div class="modal-head">
            <div class="mh">
              <div class="mht">Confirm Commission Remittance</div>
              <div class="mhs">This will deduct pending commission from your wallet.</div>
            </div>
            <button class="x" @click="closeRemitModal" aria-label="Close">×</button>
          </div>

          <div class="modal-body">
            <div v-if="remitSuccess" class="success">
              <CheckCircleIcon class="i36" />
              <div class="success-t">Remittance Successful</div>
              <div class="success-s">Your commission has been remitted successfully.</div>
            </div>

            <div v-else>
              <div class="summary">
                <div class="sr">
                  <span>Pending Commission</span>
                  <b class="danger">{{ formatToPHCurrency(totalPending) }}</b>
                </div>
                <div class="sr">
                  <span>Current Wallet Balance</span>
                  <b>{{ formatToPHCurrency(walletBalance) }}</b>
                </div>
                <div class="sr total">
                  <span>Balance After Remittance</span>
                  <b>{{ formatToPHCurrency(balanceAfterRemit) }}</b>
                </div>
              </div>

              <div v-if="remitError" class="err">
                <ExclamationTriangleIcon class="i16" />
                <span>{{ remitError }}</span>
              </div>
            </div>
          </div>

          <div class="modal-foot" v-if="!remitSuccess">
            <button class="btn ghost" @click="closeRemitModal">Cancel</button>
            <button class="btn primary" @click="remitAllPending" :disabled="!canRemitAll || isRemitting">
              <ArrowPathIcon v-if="isRemitting" class="i16 spin" />
              <WalletIcon v-else class="i16" />
              {{ isRemitting ? "Processing..." : "Confirm Remittance" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.fin {
  width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  overflow: auto;
  padding: clamp(0.9rem, 2.6vw, 1.5rem);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

.top {
  position: relative;
  top: 0;
  z-index: 15;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--card-shadow);
  flex-wrap: wrap;
}

.top-left {
  min-width: 0;
  flex: 1 1 auto;
}

.top-right {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  background: color-mix(in srgb, var(--color-primary) 14%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--border-primary));
  color: var(--color-primary);
  flex: 0 0 auto;
}

.mark-txt {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.h {
  font-weight: 1000;
  letter-spacing: -0.02em;
  font-size: 1.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub {
  color: var(--text-secondary);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.55rem;
  padding: 0.58rem 0.75rem;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 72%, var(--bg-secondary));
  white-space: nowrap;
}

.chip-k {
  color: var(--text-secondary);
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.chip-v {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 16px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  max-width: 100%;
}

.grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  max-width: 100%;
}

.card {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  padding: 0.95rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  min-width: 0;
  position: relative;
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

.card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--tone) 18%, transparent), transparent 55%);
  pointer-events: none;
}

.card-ic {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--tone) 14%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--tone) 22%, var(--border-primary));
  color: var(--tone);
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
}

.card-main {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.k {
  color: var(--text-secondary);
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.v {
  font-weight: 1100;
  font-size: 1.15rem;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.v.strong {
  color: color-mix(in srgb, var(--color-primary) 85%, var(--text-primary));
}

.v.warn {
  color: color-mix(in srgb, var(--color-warning-text) 95%, var(--text-primary));
}

.s {
  color: var(--text-muted);
  font-weight: 650;
  font-size: 0.7rem;
  line-height: 1.25;
}

.tone-blue { --tone: var(--color-info); }
.tone-green { --tone: var(--color-primary); }
.tone-emerald { --tone: var(--color-success); }
.tone-amber { --tone: var(--color-warning); }
.tone-indigo { --tone: color-mix(in srgb, var(--color-info) 65%, var(--color-primary)); }
.tone-slate { --tone: color-mix(in srgb, var(--text-secondary) 70%, var(--color-info)); }

.info {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--border-primary));
  background: color-mix(in srgb, var(--color-primary) 7%, var(--surface));
  padding: 0.95rem;
  box-shadow: var(--card-shadow);
}

.info-txt {
  display: grid;
  gap: 0.25rem;
}

.info-h {
  font-weight: 1000;
  color: var(--text-primary);
}

.info-p {
  color: var(--text-secondary);
  line-height: 1.45;
  font-size: 0.92rem;
}

.remit {
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 18%, var(--border-primary));
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-danger) 7%, var(--surface)),
    color-mix(in srgb, var(--color-warning) 7%, var(--surface))
  );
  box-shadow: var(--card-shadow);
  padding: 0.95rem;
  display: grid;
  gap: 0.9rem;
}

.remit-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.remit-title {
  display: inline-flex;
  gap: 0.6rem;
  align-items: center;
}

.rt {
  font-weight: 1100;
  color: var(--text-primary);
}

.rs {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.tag {
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 72%, var(--bg-secondary));
  font-size: 0.75rem;
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.tag.danger {
  border-color: color-mix(in srgb, var(--color-danger) 28%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
}

.remit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.mini {
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 82%, var(--bg-secondary));
  padding: 0.85rem;
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.mini-k {
  color: var(--text-muted);
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.mini-v {
  font-weight: 1100;
  font-size: 1.1rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-v.danger {
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
}

.remit-actions {
  display: grid;
  gap: 0.6rem;
}

.notice {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 10%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
  font-weight: 850;
  font-size: 0.9rem;
}

.tabs {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border-secondary) transparent;
}

.tabs::-webkit-scrollbar {
  height: 10px;
}

.tabs::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--border-secondary) 85%, transparent);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.tabs::-webkit-scrollbar-track {
  background: transparent;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.65rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 72%, var(--bg-secondary));
  color: var(--text-secondary);
  font-weight: 950;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing),
    color var(--theme-transition-duration) var(--theme-transition-timing),
    transform var(--theme-transition-duration) var(--theme-transition-timing);
  white-space: nowrap;
  flex: 0 0 auto;
}

.tab:hover {
  background: color-mix(in srgb, var(--surface) 60%, var(--bg-secondary));
  border-color: var(--border-secondary);
  color: var(--text-primary);
}

.tab:active {
  transform: translateY(1px);
}

.tab.active {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--surface));
  border-color: color-mix(in srgb, var(--color-primary) 24%, var(--border-primary));
  color: color-mix(in srgb, var(--color-primary) 92%, var(--text-primary));
}

.badge {
  margin-left: 0.1rem;
  padding: 0.14rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-danger) 85%, transparent);
  color: var(--color-danger-text);
  font-size: 0.74rem;
  font-weight: 1000;
}

.panel {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  padding: clamp(0.85rem, 2vw, 1.2rem);
}

.section {
  display: grid;
  gap: 0.95rem;
}

.section-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.section-h {
  font-weight: 1100;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.section-s {
  margin-top: 0.15rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.chart {
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 72%, var(--bg-secondary));
  padding: 0.85rem;
}

.bars {
  height: 160px;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.5rem;
  align-items: end;
}

.bar-item {
  display: grid;
  gap: 0.4rem;
  justify-items: center;
  min-width: 0;
}

.bar-rail {
  width: 100%;
  max-width: 36px;
  height: 130px;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 80%, var(--bg-secondary));
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}

.bar-fill {
  width: 100%;
  height: 0%;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--color-primary) 90%, white),
    color-mix(in srgb, var(--color-primary) 85%, transparent)
  );
  border-radius: 12px 12px 0 0;
  transition: height 0.35s ease;
}

.bar-lbl {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 800;
}

.table-shell {
  display: grid;
  gap: 0.5rem;
}

.table-scroll {
  overflow: auto;
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 85%, var(--bg-secondary));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-primary) 30%, transparent);
  scrollbar-width: auto;
  scrollbar-color: color-mix(in srgb, var(--border-secondary) 90%, transparent) transparent;
}

.table-scroll::-webkit-scrollbar {
  height: 12px;
  width: 12px;
}

.table-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--border-secondary) 88%, transparent);
  border-radius: 999px;
  border: 3px solid transparent;
  background-clip: padding-box;
}

.table-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.t {
  width: 100%;
  min-width: 980px;
  border-collapse: separate;
  border-spacing: 0;
}

.t thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  text-align: center;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 1000;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-primary);
  padding: 0.85rem 0.9rem;
  white-space: nowrap;
  background-color: var(--primary-color);
}

.t tbody td {
  padding: 0.85rem 0.9rem;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-primary);
  font-weight: 750;
  white-space: nowrap;
    text-align: center;
}

.t tbody tr:hover td {
  background: color-mix(in srgb, var(--surface) 68%, var(--bg-secondary));
}

.scroll-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--text-muted);
  font-weight: 800;
  font-size: 0.84rem;
  padding: 0 0.15rem;
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.6rem;
}

.page-info { color: var(--text-secondary); font-weight: 900; }
.page-controls { display: inline-flex; gap: 0.5rem; align-items: center; }
.page-controls .pages { display: inline-flex; gap: 0.35rem; }
.page-controls .btn.active { background: color-mix(in srgb, var(--color-primary) 10%, var(--surface)); border-color: color-mix(in srgb, var(--color-primary) 24%, var(--border-primary)); color: color-mix(in srgb, var(--color-primary) 92%, var(--text-primary)); }
.page-controls .btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ok { color: color-mix(in srgb, var(--color-success-text) 88%, var(--text-primary)); }
.warn { color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary)); }
.danger { color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary)); }
.strong { font-weight: 1100; }
.muted { color: var(--text-muted); font-weight: 650; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; letter-spacing: 0.02em; }
.clip { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.stack { display: grid; gap: 0.1rem; }

.pill2 {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg-secondary));
  font-weight: 950;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.badge-cod { background: color-mix(in srgb, var(--color-warning) 12%, var(--surface)); border-color: color-mix(in srgb, var(--color-warning) 30%, var(--border-primary)); color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary)); }
.badge-digital { background: color-mix(in srgb, var(--color-info) 12%, var(--surface)); border-color: color-mix(in srgb, var(--color-info) 30%, var(--border-primary)); color: color-mix(in srgb, var(--color-info-text) 92%, var(--text-primary)); }
.badge-success { background: color-mix(in srgb, var(--color-success) 12%, var(--surface)); border-color: color-mix(in srgb, var(--color-success) 30%, var(--border-primary)); color: color-mix(in srgb, var(--color-success-text) 92%, var(--text-primary)); }
.badge-warning { background: color-mix(in srgb, var(--color-warning) 12%, var(--surface)); border-color: color-mix(in srgb, var(--color-warning) 30%, var(--border-primary)); color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary)); }
.badge-info { background: color-mix(in srgb, var(--color-info) 12%, var(--surface)); border-color: color-mix(in srgb, var(--color-info) 30%, var(--border-primary)); color: color-mix(in srgb, var(--color-info-text) 92%, var(--text-primary)); }
.badge-default { background: color-mix(in srgb, var(--surface) 78%, var(--bg-secondary)); border-color: var(--border-primary); color: var(--text-secondary); }

.empty {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 2.2rem 1rem;
  border-radius: 16px;
  border: 1px dashed color-mix(in srgb, var(--border-primary) 80%, transparent);
  background: color-mix(in srgb, var(--surface) 80%, var(--bg-secondary));
  color: var(--text-secondary);
}

.empty.okbox {
  border-color: color-mix(in srgb, var(--color-success) 30%, var(--border-primary));
  background: color-mix(in srgb, var(--color-success) 8%, var(--surface));
}

.empty-t {
  margin-top: 0.6rem;
  font-weight: 1100;
  color: var(--text-primary);
}

.empty-s {
  margin-top: 0.25rem;
  color: var(--text-secondary);
}

.alert {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  padding: 0.85rem 0.95rem;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-warning) 28%, var(--border-primary));
  background: color-mix(in srgb, var(--color-warning) 10%, var(--surface));
}

.alert-h {
  font-weight: 1100;
  color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary));
}

.alert-s {
  margin-top: 0.15rem;
  color: var(--text-secondary);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 0.9rem;
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
  opacity: 0.55;
  cursor: not-allowed;
}

.btn.ghost {
  background: transparent;
}

.btn.primary {
  border: 0;
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 92%, white), color-mix(in srgb, var(--color-primary) 85%, transparent));
  color: var(--color-primary-text);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--color-primary) 22%, transparent);
}

.btn.primary:hover:not(:disabled) {
  filter: brightness(0.98);
  transform: translateY(-1px);
}

.state {
  display: grid;
  place-items: center;
  gap: 0.35rem;
  padding: 3.2rem 1rem;
  text-align: center;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
}

.state-t {
  font-weight: 1100;
  color: var(--text-primary);
  margin-top: 0.35rem;
}

.state-s {
  color: var(--text-secondary);
}

.spinner {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  animation: spin 1s linear infinite;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-card {
  width: 100%;
  max-width: 520px;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 1rem 1.1rem;
  border-bottom: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 90%, var(--bg-secondary));
}

.mht {
  font-weight: 1100;
  color: var(--text-primary);
}

.mhs {
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

.x {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}

.x:hover {
  color: var(--text-primary);
  border-color: var(--border-secondary);
  background: color-mix(in srgb, var(--surface) 70%, var(--bg-secondary));
}

.modal-body {
  padding: 1rem 1.1rem;
}

.summary {
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg-secondary));
  overflow: hidden;
}

.sr {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border-bottom: 1px solid var(--border-primary);
  color: var(--text-secondary);
}

.sr b {
  color: var(--text-primary);
}

.sr.total {
  border-bottom: 0;
  background: color-mix(in srgb, var(--surface) 90%, var(--bg-secondary));
  font-weight: 1000;
}

.err {
  margin-top: 0.85rem;
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.75rem 0.85rem;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 10%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
  font-weight: 850;
}

.success {
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.35rem;
  padding: 1.2rem 0.6rem;
}

.success-t {
  font-weight: 1100;
  color: var(--text-primary);
}

.success-s {
  color: var(--text-secondary);
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0.9rem 1.1rem;
  border-top: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 92%, var(--bg-secondary));
  flex-wrap: wrap;
}

.i36 { width: 36px; height: 36px; }
.i28 { width: 28px; height: 28px; }
.i22 { width: 22px; height: 22px; }
.i20 { width: 20px; height: 20px; }
.i18 { width: 18px; height: 18px; }
.i16 { width: 16px; height: 16px; }

.spin { animation: spin 1s linear infinite; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1100px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 780px) {
  .grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .remit-grid { grid-template-columns: 1fr; }
  .bars { height: 140px; gap: 0.35rem; }
  .bar-rail { max-width: 30px; }
}

@media (max-width: 520px) {
  .top-right { justify-content: flex-start; }
  .chip { width: 100%; justify-content: space-between; }
  .btn { width: 100%; }
}
</style>
