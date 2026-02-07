<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { getAuthHeaders } from "../../types/shared";
import { Toast } from "../../components/composable/Toast.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const tab = ref("plans");
const plans = ref([]);
const subscriptions = ref([]);
const loading = ref(false);
const error = ref(null);

const planQuery = ref("");
const subQuery = ref("");

const editPlanDraft = ref(null);
const newPlanDraft = ref({
  name: "",
  code: "",
  description: "",
  price: 0,
  interval: "monthly",
  features: "",
  discountPercent: 0,
  discountExpiresAt: null,
  isActive: true,
});
const busy = ref(false);

const formatPHP = (v) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

const formatDate = (v) => (v ? new Date(v).toLocaleDateString() : "—");

const fetchPlans = async () => {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await axios.get(`${API_BASE_URL}/admin/plans`, {
      headers: getAuthHeaders(),
    });
    plans.value = Array.isArray(data.plans || data) ? data.plans || data : [];
  } catch (err) {
    error.value = err;
  } finally {
    loading.value = false;
  }
};

const fetchSubscriptions = async () => {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await axios.get(`${API_BASE_URL}/admin/subscriptions`, {
      headers: getAuthHeaders(),
    });
    subscriptions.value = Array.isArray(data.subscriptions || data)
      ? data.subscriptions || data
      : [];
  } catch (err) {
    error.value = err;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await fetchPlans();
  await fetchSubscriptions();
});

const openEditPlan = (plan) => {
  editPlanDraft.value = { ...plan, features: (plan.features || []).join(", ") };
};

const savePlan = async (plan) => {
  busy.value = true;
  try {
    const payload = { ...plan };
    payload.features =
      plan.features && typeof plan.features === "string"
        ? plan.features
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : plan.features;

    if (!plan._id) {
      await axios.post(`${API_BASE_URL}/admin/plans`, payload, {
        headers: getAuthHeaders(),
      });
      await fetchPlans();
      editPlanDraft.value = null;
    } else {
      await axios.put(`${API_BASE_URL}/admin/plans/${plan._id}`, payload, {
        headers: getAuthHeaders(),
      });
      await fetchPlans();
      editPlanDraft.value = null;
    }
  } catch (err) {
    Toast('Save failed: ' + (err?.response?.data?.message || err?.message || 'Unknown error'), 'error');
  } finally {
    busy.value = false;
  }
};

const createPlan = async () => {
  await savePlan(newPlanDraft.value);
  newPlanDraft.value = {
    name: "",
    code: "",
    description: "",
    price: 0,
    interval: "monthly",
    features: "",
    discountPercent: 0,
    discountExpiresAt: null,
    isActive: true,
  };
};

const deletePlan = async (planId) => {
  if (!confirm("Delete plan? This is irreversible")) return;
  try {
    await axios.delete(`${API_BASE_URL}/admin/plans/${planId}`, {
      headers: getAuthHeaders(),
    });
    await fetchPlans();
  } catch (err) {
    Toast('Delete failed', 'error');
  }
};

const updateSubscription = async (subId, updates) => {
  try {
    await axios.put(`${API_BASE_URL}/admin/subscriptions/${subId}`, updates, {
      headers: getAuthHeaders(),
    });
    await fetchSubscriptions();
    await fetchPlans();
  } catch (err) {
    Toast('Update failed', 'error');
  }
};

const activePlans = computed(() => plans.value.filter((p) => p.isActive));

const filteredPlans = computed(() => {
  const q = planQuery.value.trim().toLowerCase();
  if (!q) return plans.value;
  return plans.value.filter((p) => {
    const hay = [
      p?.name,
      p?.code,
      p?.interval,
      p?.currency,
      (p?.features || []).join(", "),
    ]
      .map((x) => String(x || "").toLowerCase())
      .join(" • ");
    return hay.includes(q);
  });
});

const filteredSubs = computed(() => {
  const q = subQuery.value.trim().toLowerCase();
  if (!q) return subscriptions.value;
  return subscriptions.value.filter((s) => {
    const seller = s?.sellerId?.name || s?.sellerId?.email || s?.sellerId;
    const plan = s?.planId?.name || s?.planId?.code || s?.planId;
    const hay = [seller, plan, s?.status, formatDate(s?.currentPeriodEnd)]
      .map((x) => String(x || "").toLowerCase())
      .join(" • ");
    return hay.includes(q);
  });
});

const stats = computed(() => {
  const totalPlans = plans.value.length;
  const active = plans.value.filter((p) => p.isActive).length;
  const totalSubs = subscriptions.value.length;
  const activeSubs = subscriptions.value.filter(
    (s) => String(s?.status || "").toLowerCase() === "active"
  ).length;
  return { totalPlans, active, totalSubs, activeSubs };
});

const changePlanForSub = async (subId) => {
  const target = prompt("Enter planId (24-hex) or plan code to assign:");
  if (!target) return;
  const body = {};
  if (/^[0-9a-fA-F]{24}$/.test(target)) body.planId = target;
  else body.planCode = target;
  await updateSubscription(subId, body);
};
</script>

<template>
  <div class="admin-subscriptions">
    <div class="bg" aria-hidden="true"></div>

    <header class="topbar">
      <div class="topbar__left">
        <div class="kicker">Admin</div>
        <h1 class="title">Subscriptions</h1>
        <p class="subtitle">Manage plans, pricing, discounts, and seller subscriptions.</p>
      </div>

      <div class="topbar__right">
        <div class="tabs" role="tablist" aria-label="Subscription tabs">
          <button
            class="tab"
            :class="{ active: tab === 'plans' }"
            type="button"
            role="tab"
            :aria-selected="tab === 'plans'"
            @click="tab = 'plans'"
          >
            Plans
          </button>
          <button
            class="tab"
            :class="{ active: tab === 'subscriptions' }"
            type="button"
            role="tab"
            :aria-selected="tab === 'subscriptions'"
            @click="tab = 'subscriptions'"
          >
            Subscriptions
          </button>
        </div>
      </div>
    </header>

    <section class="stats">
      <div class="stat">
        <div class="stat__label">Plans</div>
        <div class="stat__value">
          <span v-if="loading" class="skel skel--num"></span>
          <span v-else>{{ stats.totalPlans }}</span>
        </div>
        <div class="stat__meta">
          <span class="badge badge--ok">{{ stats.active }} active</span>
        </div>
      </div>

      <div class="stat">
        <div class="stat__label">Subscriptions</div>
        <div class="stat__value">
          <span v-if="loading" class="skel skel--num"></span>
          <span v-else>{{ stats.totalSubs }}</span>
        </div>
        <div class="stat__meta">
          <span class="badge badge--info">{{ stats.activeSubs }} active</span>
        </div>
      </div>

      <div class="stat stat--actions">
        <button class="btn btn--ghost" type="button" :disabled="loading" @click="tab === 'plans' ? fetchPlans() : fetchSubscriptions()">
          Refresh
        </button>
        <button class="btn btn--ghost" type="button" :disabled="loading" @click="onMounted">
          Reload all
        </button>
      </div>
    </section>

    <div v-if="error" class="alert" role="alert">
      <div class="alert__title">Something went wrong</div>
      <div class="alert__desc">
        {{ error?.response?.data?.message || error?.message || "Failed to load data." }}
      </div>
    </div>

    <section v-if="tab === 'plans'" class="layout">
      <div class="card">
        <div class="card__head">
          <div>
            <h2 class="card__title">Create plan</h2>
            <p class="card__subtitle">Keep naming consistent and use short plan codes.</p>
          </div>
          <span class="pill">New</span>
        </div>

        <div class="form">
          <div class="field">
            <label class="label">Name</label>
            <input v-model="newPlanDraft.name" class="input" placeholder="e.g. Pro Seller" />
          </div>

          <div class="field">
            <label class="label">Code</label>
            <input v-model="newPlanDraft.code" class="input" placeholder="e.g. pro_monthly" />
          </div>

          <div class="field">
            <label class="label">Interval</label>
            <select v-model="newPlanDraft.interval" class="input">
              <option value="monthly">Monthly</option>
              <option value="3 months">3 months</option>
            </select>
          </div>

          <div class="field field--wide">
            <label class="label">Description</label>
            <input v-model="newPlanDraft.description" class="input" placeholder="Short description for admin reference" />
          </div>

          <div class="field">
            <label class="label">Price (PHP)</label>
            <input v-model.number="newPlanDraft.price" class="input" type="number" min="0" step="1" placeholder="0" />
          </div>

          <div class="field field--wide">
            <label class="label">Features</label>
            <input v-model="newPlanDraft.features" class="input" placeholder="Comma separated (e.g. Analytics, Priority support)" />
          </div>

          <div class="field">
            <label class="label">Discount %</label>
            <input v-model.number="newPlanDraft.discountPercent" class="input" type="number" min="0" max="100" placeholder="0" />
          </div>

          <div class="field">
            <label class="label">Expires</label>
            <input v-model="newPlanDraft.discountExpiresAt" class="input" type="date" />
          </div>

          <div class="field">
            <label class="label">Status</label>
            <label class="switch">
              <input type="checkbox" v-model="newPlanDraft.isActive" />
              <span class="switch__ui"></span>
              <span class="switch__text">{{ newPlanDraft.isActive ? "Active" : "Inactive" }}</span>
            </label>
          </div>
        </div>

        <div class="card__footer">
          <button class="btn btn--primary" type="button" :disabled="busy" @click="createPlan">
            Create plan
          </button>
        </div>
      </div>

      <div class="card card--table">
        <div class="card__head card__head--table">
          <div>
            <h2 class="card__title">Plans</h2>
            <p class="card__subtitle">Edit pricing, features, and discount settings.</p>
          </div>

          <div class="tools">
            <div class="search">
              <input v-model.trim="planQuery" class="input input--search" placeholder="Search plans…" />
            </div>
            <button class="btn btn--ghost" type="button" :disabled="loading" @click="fetchPlans">
              Refresh
            </button>
          </div>
        </div>

        <div class="table-wrap" :aria-busy="loading ? 'true' : 'false'">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Price</th>
                <th>Interval</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Features</th>
                <th class="th-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <tr v-for="i in 6" :key="'skel-plan-' + i">
                <td colspan="8">
                  <div class="row-skel">
                    <span class="skel"></span>
                    <span class="skel"></span>
                    <span class="skel"></span>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-if="!filteredPlans.length">
                <td colspan="8" class="empty">
                  <div class="empty__title">No plans found</div>
                  <div class="empty__desc">Try a different search keyword.</div>
                </td>
              </tr>

              <tr v-for="p in filteredPlans" :key="p._id">
                <td data-label="Name" class="cell-strong">
                  <div class="cell-title">{{ p.name }}</div>
                  <div class="cell-sub">{{ p.description || "—" }}</div>
                </td>
                <td data-label="Code">
                  <span class="mono">{{ p.code }}</span>
                </td>
                <td data-label="Price">{{ formatPHP(p.price) }}</td>
                <td data-label="Interval">
                  <span class="badge badge--soft">{{ p.interval }}</span>
                </td>
                <td data-label="Discount">
                  <span v-if="p.discountPercent" class="badge badge--warn">
                    {{ p.discountPercent }}% · until {{ p.discountExpiresAt ? formatDate(p.discountExpiresAt) : "—" }}
                  </span>
                  <span v-else class="muted">—</span>
                </td>
                <td data-label="Status">
                  <span class="badge" :class="p.isActive ? 'badge--ok' : 'badge--muted'">
                    {{ p.isActive ? "Active" : "Inactive" }}
                  </span>
                </td>
                <td data-label="Features" class="muted">
                  {{ (p.features || []).join(", ") || "—" }}
                </td>
                <td data-label="Actions" class="actions">
                  <button class="btn btn--soft" type="button" @click="openEditPlan(p)">Edit</button>
                  <button class="btn btn--danger" type="button" @click="deletePlan(p._id)">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <transition name="pop">
        <div v-if="editPlanDraft" class="modal" role="dialog" aria-modal="true">
          <div class="modal__card">
            <div class="modal__head">
              <div>
                <div class="kicker">Edit</div>
                <h3 class="modal__title">{{ editPlanDraft.name || "Plan" }}</h3>
              </div>
              <button class="icon-btn" type="button" aria-label="Close" @click="editPlanDraft = null">
                ✕
              </button>
            </div>

            <div class="modal__body">
              <div class="form form--modal">
                <div class="field">
                  <label class="label">Name</label>
                  <input v-model="editPlanDraft.name" class="input" />
                </div>

                <div class="field">
                  <label class="label">Code</label>
                  <input v-model="editPlanDraft.code" class="input" disabled />
                </div>

                <div class="field">
                  <label class="label">Interval</label>
                  <select v-model="editPlanDraft.interval" class="input">
                    <option value="monthly">Monthly</option>
                    <option value="3 months">3 months</option>
                  </select>
                </div>

                <div class="field field--wide">
                  <label class="label">Description</label>
                  <input v-model="editPlanDraft.description" class="input" />
                </div>

                <div class="field">
                  <label class="label">Price (PHP)</label>
                  <input v-model.number="editPlanDraft.price" class="input" type="number" min="0" />
                </div>

                <div class="field field--wide">
                  <label class="label">Features</label>
                  <input v-model="editPlanDraft.features" class="input" placeholder="Comma separated" />
                </div>

                <div class="field">
                  <label class="label">Discount %</label>
                  <input v-model.number="editPlanDraft.discountPercent" class="input" type="number" min="0" max="100" />
                </div>

                <div class="field">
                  <label class="label">Expires</label>
                  <input v-model="editPlanDraft.discountExpiresAt" class="input" type="date" />
                </div>

                <div class="field">
                  <label class="label">Status</label>
                  <label class="switch">
                    <input type="checkbox" v-model="editPlanDraft.isActive" />
                    <span class="switch__ui"></span>
                    <span class="switch__text">{{ editPlanDraft.isActive ? "Active" : "Inactive" }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="modal__footer">
              <button class="btn btn--primary" type="button" :disabled="busy" @click="savePlan(editPlanDraft)">
                Save
              </button>
              <button class="btn btn--ghost" type="button" :disabled="busy" @click="editPlanDraft = null">
                Close
              </button>
            </div>
          </div>

          <button class="modal__backdrop" type="button" aria-label="Close overlay" @click="editPlanDraft = null"></button>
        </div>
      </transition>
    </section>

    <section v-if="tab === 'subscriptions'" class="layout layout--single">
      <div class="card card--table">
        <div class="card__head card__head--table">
          <div>
            <h2 class="card__title">Subscriptions</h2>
            <p class="card__subtitle">Cancel at period end or reassign a plan.</p>
          </div>

          <div class="tools">
            <div class="search">
              <input v-model.trim="subQuery" class="input input--search" placeholder="Search sellers / plans…" />
            </div>
            <button class="btn btn--ghost" type="button" :disabled="loading" @click="fetchSubscriptions">
              Refresh
            </button>
          </div>
        </div>

        <div class="table-wrap" :aria-busy="loading ? 'true' : 'false'">
          <table class="table">
            <thead>
              <tr>
                <th>Seller</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period End</th>
                <th class="th-actions">Actions</th>
              </tr>
            </thead>

            <tbody v-if="loading">
              <tr v-for="i in 6" :key="'skel-sub-' + i">
                <td colspan="5">
                  <div class="row-skel">
                    <span class="skel"></span>
                    <span class="skel"></span>
                    <span class="skel"></span>
                  </div>
                </td>
              </tr>
            </tbody>

            <tbody v-else>
              <tr v-if="!filteredSubs.length">
                <td colspan="5" class="empty">
                  <div class="empty__title">No subscriptions found</div>
                  <div class="empty__desc">Try searching by seller email, name, or plan code.</div>
                </td>
              </tr>

              <tr v-for="s in filteredSubs" :key="s._id">
                <td data-label="Seller" class="cell-strong">
                  <div class="cell-title">{{ s.sellerId?.name || s.sellerId?.email || s.sellerId }}</div>
                  <div class="cell-sub muted">{{ s.sellerId?.email ? s.sellerId.email : "" }}</div>
                </td>

                <td data-label="Plan">
                  <span class="badge badge--soft">{{ s.planId?.name || s.planId?.code || "—" }}</span>
                </td>

                <td data-label="Status">
                  <span
                    class="badge"
                    :class="String(s.status || '').toLowerCase() === 'active' ? 'badge--ok' : 'badge--muted'"
                  >
                    {{ s.status || "—" }}
                  </span>
                </td>

                <td data-label="Period End">{{ s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "—" }}</td>

                <td data-label="Actions" class="actions">
                  <button class="btn btn--soft" type="button" @click="updateSubscription(s._id, { cancelAtPeriodEnd: true })">
                    Cancel at period end
                  </button>
                  <button
                    v-if="activePlans.length"
                    class="btn btn--ghost"
                    type="button"
                    @click="changePlanForSub(s._id)"
                  >
                    Change plan
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-subscriptions {
  --bg0: #070a12;
  --bg1: #0b1220;
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.62);
  --muted2: rgba(255, 255, 255, 0.45);
  --surface: rgba(255, 255, 255, 0.06);
  --surface2: rgba(255, 255, 255, 0.08);
  --border: rgba(255, 255, 255, 0.10);
  --shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
  --primary: #34d399;
  --primary2: #60a5fa;
  --warn: #fbbf24;
  --danger: #fb7185;

  position: relative;
  padding: 18px;
  min-height: 100%;
  color: var(--text);
}

@media (prefers-color-scheme: light) {
  .admin-subscriptions {
    --bg0: #f7f8ff;
    --bg1: #eef2ff;
    --text: rgba(10, 12, 20, 0.92);
    --muted: rgba(10, 12, 20, 0.62);
    --muted2: rgba(10, 12, 20, 0.48);
    --surface: rgba(255, 255, 255, 0.72);
    --surface2: rgba(255, 255, 255, 0.88);
    --border: rgba(10, 12, 20, 0.10);
    --shadow: 0 18px 60px rgba(10, 12, 20, 0.12);
    --primary: #16a34a;
    --primary2: #2563eb;
    --warn: #f59e0b;
    --danger: #e11d48;
  }
}

.bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(900px 380px at 15% 10%, rgba(52, 211, 153, 0.22), transparent 60%),
    radial-gradient(900px 380px at 85% 5%, rgba(96, 165, 250, 0.20), transparent 60%),
    radial-gradient(1000px 520px at 50% 110%, rgba(251, 191, 36, 0.10), transparent 60%),
    linear-gradient(180deg, var(--bg0), var(--bg1));
  pointer-events: none;
}

.admin-subscriptions > * {
  position: relative;
  z-index: 1;
}

.topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 16px 6px;
}

.kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted2);
}

.title {
  margin: 6px 0 0;
  font-size: 26px;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13.5px;
}

.tabs {
  display: inline-flex;
  padding: 6px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface2), var(--surface));
  border-radius: 999px;
  box-shadow: var(--shadow);
}

.tab {
  border: 0;
  background: transparent;
  color: var(--muted);
  padding: 10px 14px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

@media (prefers-color-scheme: light) {
  .tab:hover {
    background: rgba(10, 12, 20, 0.06);
  }
}

.tab.active {
  color: var(--text);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.22), rgba(96, 165, 250, 0.18));
  border: 1px solid rgba(255, 255, 255, 0.14);
}

@media (prefers-color-scheme: light) {
  .tab.active {
    border: 1px solid rgba(10, 12, 20, 0.10);
  }
}

.stats {
  margin: 10px 0 14px;
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  padding: 0 16px;
}

.stat {
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface2), var(--surface));
  border-radius: 18px;
  padding: 14px 14px;
  box-shadow: var(--shadow);
}

.stat__label {
  color: var(--muted2);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stat__value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.03em;
}

.stat__meta {
  margin-top: 10px;
}

.stat--actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
}

.alert {
  margin: 0 16px 14px;
  border: 1px solid rgba(251, 113, 133, 0.35);
  background: linear-gradient(180deg, rgba(251, 113, 133, 0.16), rgba(251, 113, 133, 0.08));
  border-radius: 18px;
  padding: 14px 14px;
}

.alert__title {
  font-weight: 900;
  letter-spacing: -0.02em;
}

.alert__desc {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 14px;
  padding: 0 16px 16px;
  align-items: start;
}

.layout--single {
  grid-template-columns: 1fr;
}

.card {
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface2), var(--surface));
  border-radius: 20px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.card--table {
  min-width: 0;
}

.card__head {
  padding: 14px 14px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border);
}

.card__head--table {
  align-items: center;
}

.card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.card__subtitle {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 13px;
}

.pill {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.22), rgba(96, 165, 250, 0.16));
}

.tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search {
  min-width: 260px;
}

.form {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  padding: 14px;
}

.form--modal {
  grid-template-columns: 1fr 1fr 1fr;
  padding: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field--wide {
  grid-column: span 3;
}

.label {
  font-size: 12px;
  color: var(--muted2);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.input {
  width: 100%;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  border-radius: 14px;
  padding: 11px 12px;
  outline: none;
  transition: border 0.15s ease, transform 0.15s ease, background 0.15s ease;
}

@media (prefers-color-scheme: light) {
  .input {
    background: rgba(10, 12, 20, 0.04);
  }
}

.input:focus {
  border-color: rgba(52, 211, 153, 0.45);
  background: rgba(255, 255, 255, 0.06);
}

@media (prefers-color-scheme: light) {
  .input:focus {
    background: rgba(10, 12, 20, 0.05);
  }
}

.input:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.input--search {
  padding-left: 12px;
}

.card__footer {
  padding: 14px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.btn {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  border-radius: 14px;
  padding: 10px 12px;
  font-weight: 900;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, border 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.09);
}

@media (prefers-color-scheme: light) {
  .btn {
    background: rgba(10, 12, 20, 0.04);
  }
  .btn:hover:not(:disabled) {
    background: rgba(10, 12, 20, 0.06);
  }
}

.btn--primary {
  border-color: rgba(52, 211, 153, 0.40);
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.30), rgba(96, 165, 250, 0.22));
}

.btn--soft {
  border-color: rgba(96, 165, 250, 0.35);
  background: rgba(96, 165, 250, 0.12);
}

.btn--ghost {
  background: transparent;
}

.btn--danger {
  border-color: rgba(251, 113, 133, 0.40);
  background: rgba(251, 113, 133, 0.12);
  color: var(--text);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 900;
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

@media (prefers-color-scheme: light) {
  .badge {
    background: rgba(10, 12, 20, 0.04);
  }
}

.badge--ok {
  border-color: rgba(52, 211, 153, 0.38);
  background: rgba(52, 211, 153, 0.14);
}

.badge--info {
  border-color: rgba(96, 165, 250, 0.38);
  background: rgba(96, 165, 250, 0.14);
}

.badge--warn {
  border-color: rgba(251, 191, 36, 0.42);
  background: rgba(251, 191, 36, 0.14);
}

.badge--soft {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

.badge--muted {
  color: var(--muted);
}

.muted {
  color: var(--muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 800;
  font-size: 12px;
  color: var(--text);
}

.table-wrap {
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  min-width: 860px;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  font-size: 12px;
  color: var(--muted2);
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04));
}

@media (prefers-color-scheme: light) {
  .table thead th {
    background: linear-gradient(180deg, rgba(10, 12, 20, 0.04), rgba(10, 12, 20, 0.02));
  }
}

.table tbody td {
  padding: 12px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.04);
}

@media (prefers-color-scheme: light) {
  .table tbody tr:hover td {
    background: rgba(10, 12, 20, 0.03);
  }
}

.th-actions {
  text-align: right;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.cell-strong .cell-title {
  font-weight: 900;
  letter-spacing: -0.01em;
}

.cell-strong .cell-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.empty {
  padding: 26px 12px !important;
  text-align: center;
}

.empty__title {
  font-weight: 900;
  letter-spacing: -0.02em;
}

.empty__desc {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.row-skel {
  display: grid;
  grid-template-columns: 1fr 0.9fr 0.6fr;
  gap: 10px;
  align-items: center;
}

.skel {
  height: 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.06));
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}

@media (prefers-color-scheme: light) {
  .skel {
    background: linear-gradient(90deg, rgba(10, 12, 20, 0.06), rgba(10, 12, 20, 0.12), rgba(10, 12, 20, 0.06));
  }
}

.skel--num {
  display: inline-block;
  width: 46px;
  height: 26px;
  border-radius: 12px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch__ui {
  width: 44px;
  height: 26px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  position: relative;
  transition: background 0.15s ease, border 0.15s ease;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
}

@media (prefers-color-scheme: light) {
  .switch__ui {
    background: rgba(10, 12, 20, 0.04);
  }
}

.switch__ui::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 4px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  transform: translateY(-50%);
  transition: left 0.15s ease, background 0.15s ease;
}

@media (prefers-color-scheme: light) {
  .switch__ui::after {
    background: rgba(10, 12, 20, 0.88);
  }
}

.switch input:checked + .switch__ui {
  border-color: rgba(52, 211, 153, 0.42);
  background: rgba(52, 211, 153, 0.16);
}

.switch input:checked + .switch__ui::after {
  left: 22px;
}

.switch__text {
  font-weight: 900;
  font-size: 13px;
  color: var(--muted);
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
}

.modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  cursor: pointer;
}

.modal__card {
  position: relative;
  z-index: 1;
  width: min(920px, 96vw);
  border-radius: 22px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface2), var(--surface));
  box-shadow: var(--shadow);
  overflow: hidden;
}

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px;
  border-bottom: 1px solid var(--border);
}

.modal__title {
  margin: 4px 0 0;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.icon-btn {
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  width: 38px;
  height: 38px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 900;
}

@media (prefers-color-scheme: light) {
  .icon-btn {
    background: rgba(10, 12, 20, 0.04);
  }
}

.modal__body {
  padding: 14px;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid var(--border);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .stats {
    grid-template-columns: 1fr 1fr;
  }
  .stat--actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .search {
    min-width: 200px;
  }
  .form {
    grid-template-columns: 1fr 1fr;
  }
  .field--wide {
    grid-column: span 2;
  }
}

@media (max-width: 720px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .stats {
    grid-template-columns: 1fr;
    padding: 0 12px;
  }
  .layout {
    padding: 0 12px 12px;
  }
  .card__head {
    padding: 12px;
  }
  .form {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .field--wide {
    grid-column: span 1;
  }
  .tools {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .search {
    min-width: 100%;
  }

  .table {
    min-width: 0;
  }
  .table thead {
    display: none;
  }
  .table,
  .table tbody,
  .table tr,
  .table td {
    display: block;
    width: 100%;
  }
  .table tbody tr {
    border: 1px solid var(--border);
    border-radius: 18px;
    overflow: hidden;
    margin: 10px 10px;
    background: linear-gradient(180deg, var(--surface2), var(--surface));
  }
  .table tbody td {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px solid var(--border);
    padding: 10px 12px;
  }
  .table tbody td:last-child {
    border-bottom: 0;
  }
  .table tbody td::before {
    content: attr(data-label);
    color: var(--muted2);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    flex: 0 0 auto;
    max-width: 44%;
  }
  .actions {
    justify-content: flex-start;
  }
}
</style>
