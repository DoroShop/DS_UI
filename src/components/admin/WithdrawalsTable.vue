<template>
  <div class="wrap">
    <div class="head">
      <div class="title">
        <div class="t">Withdrawal History</div>
        <div class="s">Filter, search, and review payout records.</div>
      </div>

      <div class="filters">
        <div class="field">
          <div class="lbl">Status</div>
          <select v-model="localFilters.status" @change="applyFilters" class="control">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div class="field grow">
          <div class="lbl">Search</div>
          <input v-model="localFilters.q" @input="debouncedFilter" class="control" placeholder="Vendor, payout ref, or email…" />
        </div>

        <button class="btn ghost" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div class="body">
      <div v-if="loading" class="state">
        <div class="spinner"></div>
        <div class="state-txt">Loading withdrawals…</div>
      </div>

      <div v-else-if="items.length === 0" class="state">
        <div class="empty-ic">—</div>
        <div class="state-txt">No withdrawals found</div>
      </div>

      <div v-else>
        <div class="table-card desktop">
          <div class="scroll-wrap" role="region" aria-label="Withdrawals table" tabindex="0">
            <div class="scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Account</th>
                    <th>Payout Ref</th>
                    <th>Proof</th>
                    <th>Reason</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="w in items" :key="w._id" class="row">
                    <td class="cell">{{ formatDate(w.createdAt) }}</td>

                    <td class="cell">
                      <div class="amt-v">{{ formatAmount(w.amount) }}</div>
                      <div class="muted id">{{ w._id }}</div>
                    </td>

                    <td class="cell">
                      <div class="vendor-name">{{ w.vendor?.storeName || w.userId?.name || w.userId?.email || "—" }}</div>
                      <div class="muted vendor-sub">{{ w.userId?.email || "—" }}</div>
                    </td>

                    <td class="cell">
                      <span :class="['pill', 'p-' + (w.status || 'pending')]">{{ cap(w.status || "pending") }}</span>
                    </td>

                    <td class="cell">{{ w.provider || "Bank Transfer" }}</td>

                    <td class="cell mono">{{ maskAcct(w.bankAccount?.accountNumber) }}</td>

                    <td class="cell mono">{{ w.payoutRef || "—" }}</td>

                    <td class="cell">
                      <button v-if="w.adminProofUrl" class="btn mini" @click="$emit('open-proof', w.adminProofUrl)">View</button>
                      <span v-else class="muted">—</span>
                    </td>

                    <td class="cell">
                      <span :class="['reason-tag', isBad(w.status) ? 'bad' : '']">{{ w.reason || w.failureReason || "—" }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="scroll-hint" aria-hidden="true"></div>
          </div>

          <div class="foot">
            <div class="info">
              Page <b>{{ pagination?.page || 1 }}</b> of <b>{{ pagination?.totalPages || 1 }}</b>
              <span class="dot">•</span>
              <span class="muted">{{ pagination?.totalDocs || items.length }} total</span>
            </div>

            <div class="pager">
              <button
                class="btn ghost"
                :disabled="pagination?.hasPrevPage === false || (pagination?.page || 1) <= 1"
                @click="gotoPage((pagination?.page || 1) - 1)"
              >
                Previous
              </button>
              <button class="btn" :disabled="pagination?.hasNextPage === false" @click="gotoPage((pagination?.page || 1) + 1)">
                Next
              </button>
            </div>
          </div>
        </div>

        <div class="mobile">
          <div class="cards">
            <article class="card" v-for="w in items" :key="w._id">
              <div class="card-top">
                <div class="left">
                  <div class="vendor-name-lg">{{ w.vendor?.storeName || w.userId?.name || w.userId?.email || "—" }}</div>
                  <div class="muted">{{ w.userId?.email || "—" }}</div>
                </div>
                <div class="right">
                  <div class="amt-v-lg">{{ formatAmount(w.amount) }}</div>
                  <span :class="['pill', 'p-' + (w.status || 'pending')]">{{ cap(w.status || "pending") }}</span>
                </div>
              </div>

              <div class="card-meta">
                <div class="kv">
                  <div class="k">Date</div>
                  <div class="v">{{ formatDate(w.createdAt) }}</div>
                </div>

                <div class="kv">
                  <div class="k">Provider</div>
                  <div class="v">{{ w.provider || "Bank Transfer" }}</div>
                </div>

                <div class="kv">
                  <div class="k">Account</div>
                  <div class="v mono">{{ maskAcct(w.bankAccount?.accountNumber) }}</div>
                </div>

                <div class="kv">
                  <div class="k">Payout Ref</div>
                  <div class="v mono">{{ w.payoutRef || "—" }}</div>
                </div>

                <div class="kv wide">
                  <div class="k">Reason</div>
                  <div class="v">
                    <span :class="['reason-tag', 'mobile-tag', isBad(w.status) ? 'bad' : '']">{{ w.reason || w.failureReason || "—" }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <div class="muted id">{{ w._id }}</div>
                <button v-if="w.adminProofUrl" class="btn mini" @click="$emit('open-proof', w.adminProofUrl)">View proof</button>
                <span v-else class="muted">No proof</span>
              </div>
            </article>
          </div>

          <div class="foot mobile-foot">
            <div class="info">
              Page <b>{{ pagination?.page || 1 }}</b> of <b>{{ pagination?.totalPages || 1 }}</b>
              <span class="dot">•</span>
              <span class="muted">{{ pagination?.totalDocs || items.length }} total</span>
            </div>

            <div class="pager mobile-pager">
              <button
                class="btn ghost"
                :disabled="pagination?.hasPrevPage === false || (pagination?.page || 1) <= 1"
                @click="gotoPage((pagination?.page || 1) - 1)"
              >
                Previous
              </button>
              <button class="btn" :disabled="pagination?.hasNextPage === false" @click="gotoPage((pagination?.page || 1) + 1)">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue"
import debounce from "lodash.debounce"

defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  pagination: { type: Object, default: () => ({ page: 1, limit: 10, totalPages: 1 }) },
})

const emit = defineEmits(["page-change", "open-proof", "filter-change"])

const localFilters = ref({ status: "", q: "" })

function applyFilters() {
  emit("filter-change", { ...localFilters.value })
}

const debouncedFilter = debounce(() => applyFilters(), 350)

function resetFilters() {
  localFilters.value = { status: "", q: "" }
  applyFilters()
}

function gotoPage(page) {
  if (!page || page < 1) return
  emit("page-change", page)
}

function formatAmount(amount) {
  if (amount === null || amount === undefined) return "—"
  return `₱${(Number(amount) / 100).toFixed(2)}`
}

function formatDate(date) {
  if (!date) return "—"
  const d = new Date(date)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString()
}

function cap(s) {
  if (!s) return ""
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function maskAcct(n) {
  if (!n) return "—"
  const s = String(n)
  return s.length > 4 ? `•••• ${s.slice(-4)}` : s
}

function isBad(status) {
  return status === "failed" || status === "cancelled"
}
</script>

<style scoped>
.wrap {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 0.95rem;
}

.head {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--card-shadow);
  padding: 0.95rem;
}

.title {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0.85rem;
}

.t {
  font-weight: 1000;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  font-size: 1.05rem;
}

.s {
  color: var(--text-secondary);
  font-size: 0.92rem;
  line-height: 1.35;
}

.filters {
  display: grid;
  grid-template-columns: 190px 1fr auto;
  gap: 0.7rem;
  align-items: end;
  min-width: 0;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.lbl {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 1000;
  letter-spacing: 0.02em;
}

.control {
  width: 100%;
  padding: 0.72rem 0.8rem;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: var(--input-bg);
  color: var(--input-text);
  outline: none;
  font-size: 0.92rem;
  min-width: 0;
}

.control:focus {
  border-color: var(--input-border-focus);
}

.grow {
  min-width: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.62rem 0.9rem;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 1000;
  font-size: 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: transform var(--theme-transition-duration) var(--theme-transition-timing),
    background var(--theme-transition-duration) var(--theme-transition-timing),
    border-color var(--theme-transition-duration) var(--theme-transition-timing),
    opacity var(--theme-transition-duration) var(--theme-transition-timing);
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

.btn.mini {
  padding: 0.48rem 0.72rem;
  border-radius: 999px;
  font-size: 0.82rem;
}

.body {
  min-width: 0;
}

.table-card {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  overflow: hidden;
}

.scroll-wrap {
  width: 100%;
  max-width: 100%;
  background: var(--surface);
}

.scroll {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable both-edges;
  padding-bottom: 10px;
}

.scroll-hint {
  height: 10px;
  border-top: 1px solid var(--border-primary);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--surface) 75%, var(--bg-secondary)),
    color-mix(in srgb, var(--surface) 92%, transparent),
    color-mix(in srgb, var(--surface) 75%, var(--bg-secondary))
  );
}

.scroll {
  scrollbar-width: auto;
  scrollbar-color: color-mix(in srgb, var(--text-muted) 60%, transparent)
    color-mix(in srgb, var(--border-primary) 60%, transparent);
}

.scroll::-webkit-scrollbar {
  height: 12px;
}

.scroll::-webkit-scrollbar-track {
  background: color-mix(in srgb, var(--border-primary) 55%, transparent);
  border-radius: 999px;
  margin: 6px 10px;
}

.scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-muted) 70%, transparent);
  border-radius: 999px;
  border: 3px solid color-mix(in srgb, var(--border-primary) 40%, transparent);
}

.scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-secondary) 85%, transparent);
}

.table {
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  text-align: left;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 1000;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface) 92%, var(--bg-secondary));
  border-bottom: 1px solid var(--border-primary);
  padding: 0.85rem 0.9rem;
  white-space: nowrap;
}

tbody td {
  padding: 0.85rem 0.9rem;
  border-bottom: 1px solid var(--border-primary);
  vertical-align: top;
  color: var(--text-primary);
  font-weight: 750;
  white-space: nowrap;
}

.row:hover td {
  background: color-mix(in srgb, var(--surface) 72%, var(--bg-secondary));
}

.muted {
  color: var(--text-muted);
  font-weight: 650;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.02em;
}

.vendor-name {
  font-weight: 1000;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vendor-sub {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.amt-v {
  font-weight: 1100;
  color: var(--color-primary);
}

.id {
  margin-top: 0.2rem;
  font-size: 0.78rem;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 82%, var(--bg-secondary));
  font-size: 0.75rem;
  font-weight: 1000;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.p-pending {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-warning) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-warning-text) 92%, var(--text-primary));
}

.p-processing {
  border-color: color-mix(in srgb, var(--color-info) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-info) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-info-text) 92%, var(--text-primary));
}

.p-succeeded {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-success) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-success-text) 92%, var(--text-primary));
}

.p-failed {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 12%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
}

.p-cancelled {
  opacity: 0.85;
}

.reason-tag {
  display: inline-block;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.25rem 0.55rem;
  border-radius: 12px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 85%, var(--bg-secondary));
  color: var(--text-primary);
  font-weight: 800;
  font-size: 0.82rem;
}

.reason-tag.bad {
  border-color: color-mix(in srgb, var(--color-danger) 30%, var(--border-primary));
  background: color-mix(in srgb, var(--color-danger) 10%, var(--surface));
  color: color-mix(in srgb, var(--color-danger-text) 92%, var(--text-primary));
}

.foot {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem 0.9rem;
  background: color-mix(in srgb, var(--surface) 92%, var(--bg-secondary));
  border-top: 1px solid var(--border-primary);
  flex-wrap: wrap;
}

.info {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.dot {
  margin: 0 0.35rem;
  opacity: 0.65;
}

.pager {
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  flex-wrap: wrap;
}

.state {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  padding: 2.4rem 1rem;
  text-align: center;
  color: var(--text-secondary);
}

.state-txt {
  margin-top: 0.75rem;
  font-weight: 900;
  color: var(--text-primary);
}

.empty-ic {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--border-primary);
  display: inline-grid;
  place-items: center;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface) 78%, var(--bg-secondary));
}

.spinner {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.desktop { display: block; }
.mobile { display: none; }

.cards {
  display: grid;
  gap: 0.85rem;
}

.card {
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: var(--surface);
  box-shadow: var(--card-shadow);
  padding: 0.9rem;
  display: grid;
  gap: 0.75rem;
}

.card-top {
  display: flex;
  justify-content: space-between;
  gap: 0.8rem;
  align-items: flex-start;
}

.vendor-name-lg {
  font-weight: 1100;
  color: var(--text-primary);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amt-v-lg {
  font-weight: 1200;
  color: var(--color-primary);
  text-align: right;
  white-space: nowrap;
}

.card-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem 0.75rem;
  min-width: 0;
}

.k {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  font-weight: 1000;
  margin-bottom: 0.2rem;
}

.v {
  font-weight: 800;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kv.wide {
  grid-column: 1 / -1;
}

.mobile-tag {
  max-width: 100%;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}

.mobile-foot {
  margin-top: 0.85rem;
  border-radius: 18px;
  border: 1px solid var(--border-primary);
  background: color-mix(in srgb, var(--surface) 92%, var(--bg-secondary));
  box-shadow: var(--card-shadow);
}

.mobile-pager {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 900px) {
  .filters {
    grid-template-columns: 1fr;
  }

  .btn.ghost {
    width: 100%;
  }
}

@media (max-width: 760px) {
  .desktop { display: none; }
  .mobile { display: block; }

  .head {
    padding: 0.85rem;
    border-radius: 16px;
  }
}
</style>
