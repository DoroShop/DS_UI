<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores";
import { useAuthStore } from "../../../stores/authStores";
import type { Product } from "../../../types/product";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const authStore = useAuthStore();
const vendorStore = useVendorDashboardStore();

function getAuthHeaders() {
  return { Authorization: `Bearer ${authStore.token}` };
}

/* ─── Types ───────────────────────────────────────────────────────────── */
interface Customer {
  _id: string;
  name: string;
  email: string;
  imageUrl?: string;
}

interface ShippingDiscount {
  _id: string;
  vendorId: string;
  productId: any; // populated
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  audience: "general" | "specific";
  eligibleCustomers: Customer[];
  isActive: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ─── State ───────────────────────────────────────────────────────────── */
const discounts = ref<ShippingDiscount[]>([]);
const customers = ref<Customer[]>([]);
const loading = ref(true);
const saving = ref(false);
const showCreateModal = ref(false);
const showEditModal = ref(false);
const editingDiscount = ref<ShippingDiscount | null>(null);
const filterStatus = ref<"all" | "active" | "ended">("all");
const customerSearch = ref("");

const form = ref({
  productId: "",
  discountType: "PERCENT" as "FIXED" | "PERCENT",
  discountValue: 10,
  audience: "general" as "general" | "specific",
  selectedCustomerIds: [] as string[],
  endDate: "",
});

/* ─── Computed ────────────────────────────────────────────────────────── */
const vendorProducts = computed(() => vendorStore.vendorProducts || []);

const filteredDiscounts = computed(() => {
  if (filterStatus.value === "all") return discounts.value;
  if (filterStatus.value === "active") return discounts.value.filter((d) => d.isActive);
  return discounts.value.filter((d) => !d.isActive);
});

const activeCount = computed(() => discounts.value.filter((d) => d.isActive).length);
const endedCount = computed(() => discounts.value.filter((d) => !d.isActive).length);

const filteredCustomers = computed(() => {
  if (!customerSearch.value) return customers.value;
  const q = customerSearch.value.toLowerCase();
  return customers.value.filter(
    (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  );
});

const productsWithoutDiscount = computed(() => {
  const discountedProductIds = new Set(
    discounts.value.filter((d) => d.isActive).map((d) => d.productId?._id || d.productId)
  );
  return vendorProducts.value.filter(
    (p: Product) => !discountedProductIds.has(p._id) && p.status === "approved"
  );
});

/* ─── API ─────────────────────────────────────────────────────────────── */
async function fetchDiscounts() {
  loading.value = true;
  try {
    const { data } = await axios.get(`${API_BASE_URL}/shipping-discounts`, {
      headers: getAuthHeaders(),
    });
    discounts.value = data.data || [];
  } catch (err) {
    console.error("Failed to fetch shipping discounts:", err);
  } finally {
    loading.value = false;
  }
}

async function fetchCustomers() {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/shipping-discounts/customers`, {
      headers: getAuthHeaders(),
    });
    customers.value = data.data || [];
  } catch (err) {
    console.error("Failed to fetch customers:", err);
  }
}

async function createDiscount() {
  if (!form.value.productId) return;
  saving.value = true;
  try {
    await axios.post(
      `${API_BASE_URL}/shipping-discounts`,
      {
        productId: form.value.productId,
        discountType: form.value.discountType,
        discountValue: form.value.discountValue,
        audience: form.value.audience,
        eligibleCustomers:
          form.value.audience === "specific" ? form.value.selectedCustomerIds : [],
        endDate: form.value.endDate || null,
      },
      { headers: getAuthHeaders() }
    );
    showCreateModal.value = false;
    resetForm();
    await fetchDiscounts();
  } catch (err: any) {
    alert(err.response?.data?.error || err.message || "Failed to create discount");
  } finally {
    saving.value = false;
  }
}

async function updateDiscount() {
  if (!editingDiscount.value) return;
  saving.value = true;
  try {
    await axios.put(
      `${API_BASE_URL}/shipping-discounts/${editingDiscount.value._id}`,
      {
        discountType: form.value.discountType,
        discountValue: form.value.discountValue,
        audience: form.value.audience,
        eligibleCustomers:
          form.value.audience === "specific" ? form.value.selectedCustomerIds : [],
        endDate: form.value.endDate || null,
      },
      { headers: getAuthHeaders() }
    );
    showEditModal.value = false;
    editingDiscount.value = null;
    resetForm();
    await fetchDiscounts();
  } catch (err: any) {
    alert(err.response?.data?.error || err.message || "Failed to update discount");
  } finally {
    saving.value = false;
  }
}

async function endDiscount(discountId: string) {
  if (!confirm("End this shipping discount? Customers will no longer receive this discount."))
    return;
  try {
    await axios.patch(
      `${API_BASE_URL}/shipping-discounts/${discountId}/end`,
      {},
      { headers: getAuthHeaders() }
    );
    await fetchDiscounts();
  } catch (err: any) {
    alert(err.response?.data?.error || err.message || "Failed to end discount");
  }
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function resetForm() {
  form.value = {
    productId: "",
    discountType: "PERCENT",
    discountValue: 10,
    audience: "general",
    selectedCustomerIds: [],
    endDate: "",
  };
  customerSearch.value = "";
}

function openCreate() {
  resetForm();
  showCreateModal.value = true;
}

function openEdit(discount: ShippingDiscount) {
  editingDiscount.value = discount;
  form.value = {
    productId: discount.productId?._id || discount.productId,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    audience: discount.audience,
    selectedCustomerIds: discount.eligibleCustomers.map((c: any) => c._id || c),
    endDate: discount.endDate ? discount.endDate.slice(0, 16) : "",
  };
  showEditModal.value = true;
}

function toggleCustomer(customerId: string) {
  const idx = form.value.selectedCustomerIds.indexOf(customerId);
  if (idx > -1) form.value.selectedCustomerIds.splice(idx, 1);
  else form.value.selectedCustomerIds.push(customerId);
}

function formatDate(d: string | null) {
  if (!d) return "No expiry";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getProductImage(discount: ShippingDiscount) {
  return discount.productId?.imageUrls?.[0] || "/placeholder.png";
}

function getProductName(discount: ShippingDiscount) {
  return discount.productId?.name || "Unknown Product";
}

/* ─── Init ────────────────────────────────────────────────────────────── */
onMounted(async () => {
  await Promise.all([fetchDiscounts(), fetchCustomers()]);
});
</script>

<template>
  <div class="shipping-discounts-page">
    <!-- ============ HEADER ============ -->
    <div class="page-header">
      <div class="header-text">
        <h2 class="page-title">Shipping Discounts</h2>
        <p class="page-subtitle">Create and manage shipping fee discounts for your products</p>
      </div>
      <button class="btn-create" @click="openCreate">+ New Discount</button>
    </div>

    <!-- ============ FILTER TABS ============ -->
    <div class="filter-bar">
      <button :class="['filter-tab', { active: filterStatus === 'all' }]" @click="filterStatus = 'all'">
        All ({{ discounts.length }})
      </button>
      <button :class="['filter-tab', { active: filterStatus === 'active' }]" @click="filterStatus = 'active'">
        Active ({{ activeCount }})
      </button>
      <button :class="['filter-tab', { active: filterStatus === 'ended' }]" @click="filterStatus = 'ended'">
        Ended ({{ endedCount }})
      </button>
    </div>

    <!-- ============ LOADING ============ -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading discounts...</p>
    </div>

    <!-- ============ EMPTY STATE ============ -->
    <div v-else-if="filteredDiscounts.length === 0" class="empty-state">
      <div class="empty-icon">🚚</div>
      <h3>No shipping discounts {{ filterStatus !== 'all' ? `(${filterStatus})` : '' }}</h3>
      <p>Create a discount to offer reduced shipping fees to your customers.</p>
      <button class="btn-create" @click="openCreate" v-if="filterStatus === 'all'">+ Create Your First Discount</button>
    </div>

    <!-- ============ TABLE (desktop) ============ -->
    <div v-else class="discounts-table-wrap">
      <table class="discounts-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Discount</th>
            <th>Audience</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in filteredDiscounts" :key="d._id" :class="{ 'row-ended': !d.isActive }">
            <td>
              <div class="product-cell">
                <img :src="getProductImage(d)" :alt="getProductName(d)" class="product-thumb" />
                <span class="product-name">{{ getProductName(d) }}</span>
              </div>
            </td>
            <td>
              <span class="discount-value">
                {{ d.discountType === 'PERCENT' ? `${d.discountValue}%` : `₱${d.discountValue.toFixed(2)}` }}
              </span>
            </td>
            <td>
              <div class="audience-tag">
                <span class="tag-icon">{{ d.audience === 'general' ? '🌍' : '👥' }}</span>
                <span>{{ d.audience === 'general' ? 'Everyone' : `${d.eligibleCustomers.length} selected` }}</span>
              </div>
              <div v-if="d.audience === 'specific' && d.eligibleCustomers.length" class="eligible-inline">
                <template v-for="(c, i) in d.eligibleCustomers.slice(0, 3)" :key="c._id">
                  <img v-if="c.imageUrl" :src="c.imageUrl" :alt="c.name" class="mini-avatar" :title="c.name" />
                  <span v-else class="mini-initial" :title="c.name">{{ c.name?.[0] || '?' }}</span>
                </template>
                <span v-if="d.eligibleCustomers.length > 3" class="mini-more">+{{ d.eligibleCustomers.length - 3 }}</span>
              </div>
            </td>
            <td>
              <span :class="['status-chip', d.isActive ? 'active' : 'ended']">
                <span class="status-dot"></span>
                {{ d.isActive ? 'Active' : 'Ended' }}
              </span>
            </td>
            <td><span class="date-text">{{ formatDate(d.endDate) }}</span></td>
            <td><span class="date-text">{{ formatDate(d.createdAt) }}</span></td>
            <td>
              <div class="actions-cell" v-if="d.isActive">
                <button class="btn-icon" @click="openEdit(d)" title="Edit">✏️</button>
                <button class="btn-icon danger" @click="endDiscount(d._id)" title="End discount">⏹</button>
              </div>
              <span v-else class="ended-label">Ended</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ============ MOBILE CARDS (below 768px) ============ -->
    <div v-if="!loading && filteredDiscounts.length > 0" class="discounts-cards">
      <div v-for="d in filteredDiscounts" :key="'m-' + d._id" class="mobile-card" :class="{ 'row-ended': !d.isActive }">
        <div class="mc-top">
          <img :src="getProductImage(d)" :alt="getProductName(d)" class="product-thumb" />
          <div class="mc-product-info">
            <span class="product-name">{{ getProductName(d) }}</span>
            <span :class="['status-chip', d.isActive ? 'active' : 'ended']" style="margin-top:0.25rem">
              <span class="status-dot"></span>
              {{ d.isActive ? 'Active' : 'Ended' }}
            </span>
          </div>
        </div>
        <div class="mc-details">
          <div>
            <div class="mc-detail-label">Discount</div>
            <div class="mc-detail-value discount-value">
              {{ d.discountType === 'PERCENT' ? `${d.discountValue}%` : `₱${d.discountValue.toFixed(2)}` }}
            </div>
          </div>
          <div>
            <div class="mc-detail-label">Audience</div>
            <div class="mc-detail-value">
              {{ d.audience === 'general' ? 'Everyone' : `${d.eligibleCustomers.length} selected` }}
            </div>
          </div>
          <div>
            <div class="mc-detail-label">Expires</div>
            <div class="mc-detail-value">{{ formatDate(d.endDate) }}</div>
          </div>
          <div>
            <div class="mc-detail-label">Created</div>
            <div class="mc-detail-value">{{ formatDate(d.createdAt) }}</div>
          </div>
        </div>
        <div class="mc-actions" v-if="d.isActive">
          <button class="mc-btn" @click="openEdit(d)">Edit</button>
          <button class="mc-btn danger" @click="endDiscount(d._id)">End</button>
        </div>
      </div>
    </div>

    <!-- ============ CREATE MODAL ============ -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Create Shipping Discount</h3>
            <button class="close-btn" @click="showCreateModal = false">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>Product <span class="req">*</span></label>
              <select v-model="form.productId" class="form-input">
                <option value="" disabled>Select a product</option>
                <option v-for="p in productsWithoutDiscount" :key="p._id" :value="p._id">
                  {{ p.name }} — ₱{{ p.price.toFixed(2) }}
                </option>
              </select>
              <span v-if="productsWithoutDiscount.length === 0" class="field-hint warn">
                All approved products already have an active discount.
              </span>
            </div>

            <div class="form-group">
              <label>Discount Type</label>
              <div class="radio-row">
                <label :class="['radio-card', { active: form.discountType === 'PERCENT' }]">
                  <input type="radio" v-model="form.discountType" value="PERCENT" />
                  <span class="rc-icon">%</span>
                  <span class="rc-label">Percentage</span>
                </label>
                <label :class="['radio-card', { active: form.discountType === 'FIXED' }]">
                  <input type="radio" v-model="form.discountType" value="FIXED" />
                  <span class="rc-icon">₱</span>
                  <span class="rc-label">Fixed Amount</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>{{ form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount Amount (₱)' }}</label>
              <input v-model.number="form.discountValue" type="number" min="0" :max="form.discountType === 'PERCENT' ? 100 : undefined" step="0.01" class="form-input" />
            </div>

            <div class="form-group">
              <label>Who gets this discount?</label>
              <div class="radio-row">
                <label :class="['radio-card', { active: form.audience === 'general' }]">
                  <input type="radio" v-model="form.audience" value="general" />
                  <span class="rc-icon">🌍</span>
                  <span class="rc-label">All Customers</span>
                </label>
                <label :class="['radio-card', { active: form.audience === 'specific' }]">
                  <input type="radio" v-model="form.audience" value="specific" />
                  <span class="rc-icon">👥</span>
                  <span class="rc-label">Specific Customers</span>
                </label>
              </div>
            </div>

            <div v-if="form.audience === 'specific'" class="form-group customer-picker">
              <label>Select Customers ({{ form.selectedCustomerIds.length }} selected)</label>
              <input v-model="customerSearch" type="text" class="form-input" placeholder="Search by name or email..." />
              <div class="customer-list">
                <div v-if="filteredCustomers.length === 0" class="no-customers">
                  No customers found. Customers appear here after they place orders with you.
                </div>
                <label v-for="cust in filteredCustomers" :key="cust._id" class="customer-row" :class="{ selected: form.selectedCustomerIds.includes(cust._id) }">
                  <input type="checkbox" :checked="form.selectedCustomerIds.includes(cust._id)" @change="toggleCustomer(cust._id)" />
                  <img v-if="cust.imageUrl" :src="cust.imageUrl" :alt="cust.name" class="cust-avatar" />
                  <span v-else class="cust-avatar-blank">{{ cust.name?.[0] || '?' }}</span>
                  <div class="cust-info">
                    <span class="cust-name">{{ cust.name }}</span>
                    <span class="cust-email">{{ cust.email }}</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>End Date <span class="optional">(optional)</span></label>
              <input v-model="form.endDate" type="datetime-local" class="form-input" />
              <span class="field-hint">Leave empty for no expiry.</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="showCreateModal = false" :disabled="saving">Cancel</button>
            <button class="btn-primary" @click="createDiscount" :disabled="saving || !form.productId || form.discountValue <= 0">
              {{ saving ? 'Creating...' : 'Create Discount' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ============ EDIT MODAL ============ -->
    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Edit Shipping Discount</h3>
            <button class="close-btn" @click="showEditModal = false">&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label>Product</label>
              <div class="read-only-product">
                <img v-if="editingDiscount?.productId?.imageUrls?.[0]" :src="editingDiscount.productId.imageUrls[0]" class="ro-thumb" />
                <span>{{ editingDiscount?.productId?.name || 'Product' }}</span>
              </div>
            </div>

            <div class="form-group">
              <label>Discount Type</label>
              <div class="radio-row">
                <label :class="['radio-card', { active: form.discountType === 'PERCENT' }]">
                  <input type="radio" v-model="form.discountType" value="PERCENT" />
                  <span class="rc-icon">%</span>
                  <span class="rc-label">Percentage</span>
                </label>
                <label :class="['radio-card', { active: form.discountType === 'FIXED' }]">
                  <input type="radio" v-model="form.discountType" value="FIXED" />
                  <span class="rc-icon">₱</span>
                  <span class="rc-label">Fixed Amount</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>{{ form.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount Amount (₱)' }}</label>
              <input v-model.number="form.discountValue" type="number" min="0" :max="form.discountType === 'PERCENT' ? 100 : undefined" step="0.01" class="form-input" />
            </div>

            <div class="form-group">
              <label>Who gets this discount?</label>
              <div class="radio-row">
                <label :class="['radio-card', { active: form.audience === 'general' }]">
                  <input type="radio" v-model="form.audience" value="general" />
                  <span class="rc-icon">🌍</span>
                  <span class="rc-label">All Customers</span>
                </label>
                <label :class="['radio-card', { active: form.audience === 'specific' }]">
                  <input type="radio" v-model="form.audience" value="specific" />
                  <span class="rc-icon">👥</span>
                  <span class="rc-label">Specific Customers</span>
                </label>
              </div>
            </div>

            <div v-if="form.audience === 'specific'" class="form-group customer-picker">
              <label>Select Customers ({{ form.selectedCustomerIds.length }} selected)</label>
              <input v-model="customerSearch" type="text" class="form-input" placeholder="Search by name or email..." />
              <div class="customer-list">
                <div v-if="filteredCustomers.length === 0" class="no-customers">No customers found.</div>
                <label v-for="cust in filteredCustomers" :key="cust._id" class="customer-row" :class="{ selected: form.selectedCustomerIds.includes(cust._id) }">
                  <input type="checkbox" :checked="form.selectedCustomerIds.includes(cust._id)" @change="toggleCustomer(cust._id)" />
                  <img v-if="cust.imageUrl" :src="cust.imageUrl" :alt="cust.name" class="cust-avatar" />
                  <span v-else class="cust-avatar-blank">{{ cust.name?.[0] || '?' }}</span>
                  <div class="cust-info">
                    <span class="cust-name">{{ cust.name }}</span>
                    <span class="cust-email">{{ cust.email }}</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>End Date <span class="optional">(optional)</span></label>
              <input v-model="form.endDate" type="datetime-local" class="form-input" />
              <span class="field-hint">Leave empty for no expiry.</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="showEditModal = false" :disabled="saving">Cancel</button>
            <button class="btn-primary" @click="updateDiscount" :disabled="saving || form.discountValue <= 0">
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.shipping-discounts-page {
  padding: clamp(1rem, 3vw, 2rem);
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

/* ============ HEADER ============ */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.header-text {}
.page-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.page-subtitle {
  color: var(--text-secondary);
  font-size: 0.825rem;
  margin: 0.25rem 0 0;
}

.btn-create {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.6rem 1.25rem;
  background: var(--btn-primary-bg, var(--color-primary));
  color: var(--text-inverse, #fff);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.btn-create:hover { background: var(--btn-primary-hover, var(--color-primary-hover)); transform: translateY(-1px); }

/* ============ FILTER TABS ============ */
.filter-bar {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  background: var(--surface-variant, var(--bg-secondary));
  padding: 0.25rem;
  border-radius: var(--radius-md);
  width: fit-content;
}

.filter-tab {
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.filter-tab:hover { color: var(--text-primary); background: var(--surface); }
.filter-tab.active {
  background: var(--surface, #fff);
  color: var(--color-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

/* ============ LOADING / EMPTY ============ */
.loading-state,
.empty-state {
  text-align: center;
  padding: 4rem 1.5rem;
  color: var(--text-secondary);
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto 1rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--color-primary-light, rgba(27, 171, 80, 0.1));
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin: 0 auto 1rem;
}
.empty-state h3 {
  color: var(--text-primary);
  margin: 0 0 0.375rem;
  font-size: 1.05rem;
}
.empty-state p {
  margin: 0 0 1.25rem;
  font-size: 0.85rem;
  max-width: 360px;
  margin-inline: auto;
}

/* ============ DISCOUNT TABLE ============ */
.discounts-table-wrap {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.discounts-table {
  width: 100%;
  border-collapse: collapse;
}

.discounts-table thead th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-tertiary);
  background: var(--table-header-bg, var(--bg-secondary));
  border-bottom: 1px solid var(--border-primary);
  white-space: nowrap;
}
.discounts-table thead th:first-child { padding-left: 1.25rem; }
.discounts-table thead th:last-child { padding-right: 1.25rem; text-align: right; }

.discounts-table tbody tr {
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-primary);
}
.discounts-table tbody tr:last-child { border-bottom: none; }
.discounts-table tbody tr:hover { background: var(--table-row-hover, var(--surface-hover)); }
.discounts-table tbody tr.row-ended { opacity: 0.55; }

.discounts-table td {
  padding: 0.875rem 1rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  vertical-align: middle;
}
.discounts-table td:first-child { padding-left: 1.25rem; }
.discounts-table td:last-child { padding-right: 1.25rem; }

/* Product cell */
.product-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.product-thumb {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  border: 1px solid var(--border-primary);
  flex-shrink: 0;
}
.product-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

/* Discount value */
.discount-value {
  font-weight: 700;
  color: var(--color-primary);
}

/* Status chip */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.625rem;
  border-radius: var(--radius-full, 999px);
  font-size: 0.72rem;
  font-weight: 600;
}
.status-chip.active {
  background: var(--color-success-light, #dcfce7);
  color: var(--color-success-text, #16a34a);
}
.status-chip.ended {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-tertiary, #94a3b8);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Audience */
.audience-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.audience-tag .tag-icon { font-size: 0.9rem; }

/* Eligible preview row */
.eligible-inline {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
}
.mini-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--surface, #fff);
  object-fit: cover;
}
.mini-avatar:not(:first-child) { margin-left: -6px; }
.mini-initial {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 600;
  border: 1.5px solid var(--surface, #fff);
}
.mini-initial:not(:first-child) { margin-left: -6px; }
.mini-more {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  margin-left: 0.25rem;
}

/* Actions cell */
.actions-cell {
  display: flex;
  gap: 0.375rem;
  justify-content: flex-end;
}
.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}
.btn-icon:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light, rgba(27,171,80,0.06)); }
.btn-icon.danger:hover { border-color: var(--color-danger, #ef4444); color: var(--color-danger, #ef4444); background: rgba(239,68,68,0.06); }

.ended-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-style: italic;
}

/* Date text */
.date-text {
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ============ MOBILE CARDS (shown below 768px) ============ */
.discounts-cards {
  display: none;
}

/* ============ MODALS ============ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop, rgba(0,0,0,0.45));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.modal-box {
  background: var(--modal-bg, var(--surface));
  border: 1px solid var(--modal-border, var(--border-primary));
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.125rem 1.5rem;
  border-bottom: 1px solid var(--border-primary);
}
.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text-primary); }

.modal-body {
  padding: 1.25rem 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-primary);
}

/* ============ FORM ============ */
.form-group {
  margin-bottom: 1.125rem;
}
.form-group label {
  display: block;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}
.req { color: var(--color-danger, #ef4444); }
.optional { font-weight: 400; color: var(--text-tertiary); font-size: 0.72rem; }

.form-input {
  width: 100%;
  padding: 0.575rem 0.875rem;
  border: 1px solid var(--input-border, var(--border-primary));
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  background: var(--input-bg, var(--surface));
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: var(--input-border-focus, var(--color-primary));
  box-shadow: 0 0 0 3px var(--color-primary-light, rgba(27,171,80,0.12));
}

.field-hint {
  display: block;
  font-size: 0.72rem;
  color: var(--text-tertiary);
  margin-top: 0.25rem;
}
.field-hint.warn { color: var(--color-warning, #f59e0b); }

.radio-row {
  display: flex;
  gap: 0.625rem;
}

.radio-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.875rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--surface);
}
.radio-card input[type="radio"] { display: none; }
.radio-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light, rgba(27,171,80,0.06));
}
.rc-icon { font-size: 1.05rem; }
.rc-label { font-weight: 500; font-size: 0.8rem; color: var(--text-primary); }

/* ============ CUSTOMER PICKER ============ */
.customer-picker .form-input {
  margin-bottom: 0.5rem;
}

.customer-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.no-customers {
  padding: 1.25rem;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.8rem;
}

.customer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-primary);
}
.customer-row:last-child { border-bottom: none; }
.customer-row:hover { background: var(--surface-hover, var(--bg-secondary)); }
.customer-row.selected { background: var(--color-primary-light, rgba(27,171,80,0.05)); }
.customer-row input[type="checkbox"] { accent-color: var(--color-primary); flex-shrink: 0; }

.cust-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.cust-avatar-blank {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.cust-info { display: flex; flex-direction: column; min-width: 0; }
.cust-name { font-weight: 500; font-size: 0.8rem; color: var(--text-primary); }
.cust-email { font-size: 0.7rem; color: var(--text-tertiary); }

/* Read-only product in edit modal */
.read-only-product {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.875rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}
.ro-thumb {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

/* ============ BUTTONS ============ */
.btn-primary {
  padding: 0.6rem 1.5rem;
  background: var(--btn-primary-bg, var(--color-primary));
  color: var(--text-inverse, #fff);
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover:not(:disabled) { background: var(--btn-primary-hover, var(--color-primary-hover)); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.6rem 1.5rem;
  background: var(--btn-secondary-bg, transparent);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-secondary:hover:not(:disabled) { background: var(--surface-hover, var(--bg-secondary)); }

/* ============ RESPONSIVE ============ */
@media (max-width: 768px) {
  .discounts-table-wrap { display: none; }
  .discounts-cards { display: flex; flex-direction: column; gap: 0.75rem; }

  .mobile-card {
    background: var(--surface);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: 1rem;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.2s;
  }
  .mobile-card:hover { border-color: var(--color-primary); }
  .mobile-card.row-ended { opacity: 0.55; }

  .mc-top {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-primary);
  }
  .mc-product-info {
    flex: 1;
    min-width: 0;
  }
  .mc-product-info .product-name {
    display: block;
    max-width: none;
  }

  .mc-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
    margin-bottom: 0.75rem;
  }
  .mc-detail-label {
    font-size: 0.68rem;
    color: var(--text-tertiary);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .mc-detail-value {
    font-size: 0.825rem;
    color: var(--text-primary);
    margin-top: 0.1rem;
  }

  .mc-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-primary);
  }
  .mc-btn {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    background: transparent;
    border-radius: var(--radius-md);
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }
  .mc-btn:hover { background: var(--color-primary); color: #fff; }
  .mc-btn.danger { border-color: var(--color-danger, #ef4444); color: var(--color-danger, #ef4444); }
  .mc-btn.danger:hover { background: var(--color-danger, #ef4444); color: #fff; }

  .radio-row { flex-direction: column; }
  .page-header { flex-direction: column; align-items: flex-start; }
  .btn-create { width: 100%; text-align: center; justify-content: center; }
  .filter-bar { width: 100%; }
  .filter-tab { flex: 1; text-align: center; }
  .modal-box { max-height: 100vh; border-radius: var(--radius-lg); }
}
</style>
