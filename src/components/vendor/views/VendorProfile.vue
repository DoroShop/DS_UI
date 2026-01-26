<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  PencilSquareIcon,
  WalletIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  UsersIcon,
  EyeIcon,
  StarIcon,
  ShoppingBagIcon,
  XMarkIcon,
  CameraIcon,
  MapPinIcon,
  EnvelopeIcon,
  PhoneIcon,
} from "@heroicons/vue/24/outline";
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores";
import { formatToPHCurrency } from "../../../utils/currencyFormat";
import QRCodePaymentModal from "../../QRCodePaymentModal.vue";
import { getQRCodeUrl } from "../../../utils/paymentApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/* ----------------------- Store ----------------------- */
const store = useVendorDashboardStore();
const { vendor } = storeToRefs(store);
const getStore = () => store;

onMounted(async () => {
  const s = getStore();
  if (!vendor.value && typeof s.fetchVendor === "function") {
    await s.fetchVendor();
  }

  if (typeof s.fetchWithdrawals === "function") {
    try {
      await s.fetchWithdrawals();
    } catch (e) {
      console.warn("Failed to fetch withdrawals on mount", e);
    }
  }

  // Restore any pending cash-in that wasn't completed
  try {
    restorePendingCashIn();
  } catch (e) {
    console.warn("Failed to restore pending cash-in on mount", e);
  }
});

watch(
  () => getStore().vendorId,
  (id, old) => {
    const s = getStore();
    if (id && id !== old && typeof s.fetchVendor === "function") {
      s.fetchVendor();
    }
  }
);

/* --------------------- Constants --------------------- */
const defaultAvatar =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face";
const defaultBanner =
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop";

/* -------------------- Computed UI -------------------- */
const followerCount = computed(() => vendor.value?.followers?.length ?? 0);
const profileViews = computed(() => vendor.value?.profileViews ?? 0);
const totalOrders = computed(() => vendor.value?.totalOrders ?? 0);
const rating = computed(() => vendor.value?.rating ?? 0);

const fullAddress = computed(() => {
  const a = vendor.value?.address || {};
  const parts = [a.street, a.barangay, a.city, a.province, a.zipCode]
    .map((s) => (s || "").trim())
    .filter(Boolean);
  return parts.join(", ");
});

/* ---------------- Modal State --------------- */
const showEditModal = ref(false);
const showWalletModal = ref(false);
const actionType = ref("");

/* ------------------- Edit Form ----------------------- */
const editForm = reactive({
  storeName: "",
  description: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
  zipCode: "",
  imageUrl: "",
  bannerUrl: "",
  email: "",
  phone: "",
  website: "",
});
const editErrors = ref({});

const openEditModal = () => {
  const v = vendor.value ?? {};
  Object.assign(editForm, {
    storeName: v.storeName || "",
    description: v.description || "",
    imageUrl: v.imageUrl || "",
    bannerUrl: v.bannerUrl || "",
    email: v.email || "",
    phone: v.phone || "",
    website: v.website || "",
    street: v.address?.street || "",
    barangay: v.address?.barangay || "",
    city: v.address?.city || "",
    province: v.address?.province || "",
    zipCode: v.address?.zipCode || "",
  });
  editErrors.value = {};
  showEditModal.value = true;
};

const validateEdit = () => {
  const errs = {};
  // Removed storeName validation
  editErrors.value = errs;
  return Object.keys(errs).length === 0;
};

const saveEdit = async () => {
  if (!validateEdit()) return;

  const payload = {
    // Excluded: storeName, description, email, phone, website
    imageUrl: editForm.imageUrl.trim(),
    bannerUrl: editForm.bannerUrl.trim(),
    address: {
      street: editForm.street.trim(),
      barangay: editForm.barangay.trim(),
      city: editForm.city.trim(),
      province: editForm.province.trim(),
      zipCode: editForm.zipCode.trim(),
    },
  };

  try {
    await getStore().updateVendor?.(payload);
  } catch (err) {
    console.error("Vendor update failed:", err);
  }

  showEditModal.value = false;
};

/* ------------------- Wallet -------------------------- */
const walletCash = computed(() => vendor.value?.wallet ?? 0);
const walletUsdt = computed(() => vendor.value?.accountBalance?.usdt ?? 0);

const walletForm = reactive({
  amount: "",
  payoutMethod: "gcash",
  bankAccount: {
    accountNumber: "",
    accountName: "",
    bankName: "",
  },
});

const walletError = ref("");
const isSubmitting = ref(false);
const cashInQr = ref(null);

const WITHDRAW_METHODS = ["gcash", "paymaya"];

const PENDING_VENDOR_CASHIN_KEY = "PENDING_VENDOR_CASHIN";

const clearCashInQr = () => {
  cashInQr.value = null;
};

const persistPendingCashIn = (payload) => {
  try {
    localStorage.setItem(PENDING_VENDOR_CASHIN_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Failed to persist pending cash-in:", e);
  }
};

const clearPendingCashIn = () => {
  try {
    localStorage.removeItem(PENDING_VENDOR_CASHIN_KEY);
  } catch (e) {
    console.warn("Failed to clear pending cash-in:", e);
  }
};

const restorePendingCashIn = async () => {
  try {
    const raw = localStorage.getItem(PENDING_VENDOR_CASHIN_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const expiry = data.expiresAt ? new Date(data.expiresAt).getTime() : null;
    if (expiry && Date.now() > expiry + 600000) {
      // expired beyond recovery window
      clearPendingCashIn();
      return;
    }

    // If url is missing, attempt to fetch via paymentIntentId
    if (!data.url && data.paymentIntentId) {
      try {
        const qr = await getQRCodeUrl(data.paymentIntentId);
        if (qr) data.url = qr;
      } catch (e) {
        console.warn("Failed to fetch QR on restore:", e);
      }
    }

    cashInQr.value = data;
    showWalletModal.value = true;
  } catch (e) {
    console.error("Failed to restore pending cash-in:", e);
    clearPendingCashIn();
  }
};

const closeCashIn = () => {
  showWalletModal.value = false;
  clearCashInQr();
};

watch(showWalletModal, (val) => {
  if (!val) clearCashInQr();
});

const handleCashInSuccess = async (payment) => {
  clearPendingCashIn();
  clearCashInQr();
  showWalletModal.value = false;
  try {
    await getStore().fetchVendor();
    if (typeof getStore().fetchWithdrawals === "function") await getStore().fetchWithdrawals();
  } catch (e) {
    console.warn("Failed to refresh vendor data after cash-in:", e);
  }
  window.alert("Cash-in successful — wallet updated");
};

const handleCashInFailed = () => {
  clearPendingCashIn();
  clearCashInQr();
  window.alert("Cash-in failed. Please try again.");
};

const handleCashInExpired = () => {
  clearPendingCashIn();
  clearCashInQr();
  window.alert("Cash-in expired. Please try again.");
};

const handleCashInCancelled = () => {
  clearPendingCashIn();
  clearCashInQr();
  window.alert("Cash-in cancelled.");
};

const openWallet = (type) => {
  actionType.value = type;

  walletForm.amount = "";
  walletForm.bankAccount.accountNumber = "";
  walletForm.bankAccount.accountName = "";
  walletForm.bankAccount.bankName = "";
  walletError.value = "";

  walletForm.payoutMethod = type === "cashin" ? "qrph" : "gcash";
  showWalletModal.value = true;
};

watch(
  () => actionType.value,
  (t) => {
    if (t === "withdraw" && !WITHDRAW_METHODS.includes(walletForm.payoutMethod)) {
      walletForm.payoutMethod = "gcash";
      return;
    }
    if (t === "cashin" && walletForm.payoutMethod !== "qrph") {
      walletForm.payoutMethod = "qrph";
    }
  }
);

watch(
  () => walletForm.payoutMethod,
  (method) => {
    if (actionType.value === "withdraw" && !WITHDRAW_METHODS.includes(method)) {
      walletForm.payoutMethod = "gcash";
      return;
    }
    if (actionType.value === "cashin" && method !== "qrph") {
      walletForm.payoutMethod = "qrph";
    }
  }
);

const handleWalletAction = async () => {
  const amt = Number(walletForm.amount);

  if (isNaN(amt) || amt <= 0) {
    walletError.value = "Invalid amount.";
    return;
  }

  if (actionType.value === "withdraw") {
    if (!WITHDRAW_METHODS.includes(walletForm.payoutMethod)) {
      walletError.value = "Withdrawal is only available via GCash or PayMaya.";
      walletForm.payoutMethod = "gcash";
      return;
    }

    if (amt * 100 < 10000) {
      walletError.value = "Minimum withdrawal amount is 100 PHP.";
      return;
    }

    if (amt > walletCash.value) {
      walletError.value = "Insufficient balance.";
      return;
    }
  }

  try {
    isSubmitting.value = true;

    if (actionType.value === "cashin") {
      clearCashInQr();

      const res = await getStore().cashIn?.({
        amount: amt,
        paymentMethod: "qrph",
      });

      // Expected server payload: { success, message, data: { paymentId, paymentIntentId, qrCodeUrl, amount, expiresAt } }
      if (res && res.success && res.data) {
        const pd = res.data;
        const pending = {
          url: pd.qrCodeUrl,
          paymentId: pd.paymentId || (pd.payment && pd.payment._id),
          paymentIntentId: pd.paymentIntentId,
          amount: pd.amount || Math.round(amt * 100),
          expiresAt: pd.expiresAt || null,
        };


        console.log("qrph", pending)

        // If server didn't return an image URL, attempt to fetch it using paymentIntentId
        if (!pending.url && pending.paymentIntentId) {
          try {
            const qr = await getQRCodeUrl(pending.paymentIntentId);
            if (qr) pending.url = qr;
          } catch (e) {
            console.warn("Failed to fetch QR code URL:", e);
          }
        }

        cashInQr.value = pending;
        persistPendingCashIn(pending);
        walletError.value = "";
        // Keep modal open so the vendor can scan and pay
        showWalletModal.value = true;
        return;
      }

      await getStore().fetchWithdrawals();
      await getStore().fetchVendor();
      window.alert("Cash-in initiated");
    } else {
      if (!walletForm.bankAccount.accountNumber || !walletForm.bankAccount.accountName) {
        walletError.value = "Account number and account name are required.";
        return;
      }

      await getStore().withdraw?.({
        amount: amt,
        payoutMethod: walletForm.payoutMethod,
        bankAccount: {
          accountNumber: walletForm.bankAccount.accountNumber,
          accountName: walletForm.bankAccount.accountName,
        },
      });

      await getStore().fetchWithdrawals();
      await getStore().fetchVendor();
      window.alert("Withdrawal request submitted.");
    }

    if (!(actionType.value === "cashin" && cashInQr.value)) {
      showWalletModal.value = false;
    }
  } catch (err) {
    console.error(err);
    walletError.value = `${actionType.value === "cashin" ? "Cash in" : "Withdraw"} failed.`;
  } finally {
    isSubmitting.value = false;
  }
};

/* ---------------- Withdrawals computed & actions ---------------- */
const withdrawals = computed(() => getStore().withdrawals || []);

const cancelWithdrawal = async (paymentId) => {
  if (!confirm("Are you sure you want to cancel this pending withdrawal?")) return;
  try {
    await getStore().cancelWithdrawal(paymentId, "Cancelled by vendor");
    await getStore().fetchWithdrawals();
    window.alert("Withdrawal cancelled");
  } catch (err) {
    console.error("Cancel failed", err);
    window.alert("Failed to cancel withdrawal");
  }
};

/* -------------------- Loading / State ---------------- */
const isLoading = computed(() => getStore().loading ?? false);
const hasVendor = computed(() => !!vendor.value);

/* -------------------- Wallet UI Helpers ---------------- */
const isBankDetailsRequired = computed(() => {
  return actionType.value === "withdraw";
});

const walletModalTitle = computed(() => (actionType.value === "cashin" ? "Cash In" : "Withdraw"));
const walletModalSubtitle = computed(() => {
  if (actionType.value === "cashin") return "Top up your wallet via QRPH (scan QR).";
  return "Withdraw via GCash or PayMaya.";
});
</script>

<template>
  <div class="vp">
    <div v-if="isLoading && !hasVendor" class="vp__skeleton">
      <div class="sk sk--header"></div>
      <div class="sk-grid">
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
        <div class="sk sk--card"></div>
      </div>
    </div>

    <template v-else-if="hasVendor">
      <header class="hero" :style="{ backgroundImage: `url(${vendor.bannerUrl || defaultBanner})` }">
        <div class="hero__overlay"></div>

        <div class="hero__content">
          <div class="hero__left">
            <div class="avatar">
              <img class="avatar__img" :src="vendor.imageUrl || defaultAvatar" :alt="vendor.storeName" />
              <button class="avatar__edit" @click="openEditModal" aria-label="Edit profile picture">
                <CameraIcon class="ico" />
              </button>
            </div>

            <div class="hero__meta">
              <div class="pill">
                <span class="dot"></span>
                Verified Vendor
              </div>

              <h1 class="hero__title">{{ vendor.storeName }}</h1>
              <p class="hero__desc">{{ vendor.description }}</p>

              <div class="hero__contacts">
                <div v-if="fullAddress" class="contact">
                  <MapPinIcon class="ico-sm" />
                  <span>{{ fullAddress }}</span>
                </div>
                <div v-if="vendor.email" class="contact">
                  <EnvelopeIcon class="ico-sm" />
                  <span>{{ vendor.email }}</span>
                </div>
                <div v-if="vendor.phone" class="contact">
                  <PhoneIcon class="ico-sm" />
                  <span>{{ vendor.phone }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="hero__right">
            <button class="btn btn--glass" @click="openEditModal">
              <PencilSquareIcon class="ico" />
              Edit Profile
            </button>
          </div>
        </div>
      </header>

      <main class="grid">
        <section class="card">
          <div class="card__head">
            <h2 class="card__title">Performance Overview</h2>
            <p class="card__sub">Quick stats about your store activity.</p>
          </div>

          <div class="stats">
            <div class="stat">
              <div class="stat__icon"><UsersIcon class="ico" /></div>
              <div class="stat__info">
                <div class="stat__value">{{ followerCount.toLocaleString() }}</div>
                <div class="stat__label">Followers</div>
              </div>
            </div>

            <div class="stat">
              <div class="stat__icon"><EyeIcon class="ico" /></div>
              <div class="stat__info">
                <div class="stat__value">{{ profileViews.toLocaleString() }}</div>
                <div class="stat__label">Profile Views</div>
              </div>
            </div>

            <div class="stat">
              <div class="stat__icon"><ShoppingBagIcon class="ico" /></div>
              <div class="stat__info">
                <div class="stat__value">{{ totalOrders.toLocaleString() }}</div>
                <div class="stat__label">Total Orders</div>
              </div>
            </div>

            <div class="stat">
              <div class="stat__icon"><StarIcon class="ico" /></div>
              <div class="stat__info">
                <div class="stat__value">{{ rating.toFixed(1) }}</div>
                <div class="stat__label">Rating • {{ vendor.numRatings || 0 }} reviews</div>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__head card__head--row">
            <div>
              <h2 class="card__title">Wallet</h2>
              <p class="card__sub">Manage your earnings and payouts.</p>
            </div>
            <div class="pill pill--soft">
              <span class="dot dot--ok"></span>
              Active
            </div>
          </div>

          <div class="balances">
            <div class="bal bal--primary">
              <div class="bal__top">
                <span class="bal__label">Cash Balance</span>
                <span class="bal__chip">PHP</span>
              </div>
              <div class="bal__amt">{{ formatToPHCurrency(walletCash) }}</div>
              <div class="bal__hint">Available for withdrawals</div>
            </div>

            <!-- <div class="bal">
              <div class="bal__top">
                <span class="bal__label">Digital Currency</span>
                <span class="bal__chip">USDT</span>
              </div>
              <div class="bal__amt">{{ walletUsdt.toFixed(4) }}</div>
              <div class="bal__hint">Stable balance</div>
            </div> -->
          </div>

          <div class="actions">
            <button class="btn btn--primary" @click="openWallet('cashin')">
              <ArrowDownTrayIcon class="ico" />
              Cash In
            </button>
            <button class="btn btn--muted" @click="openWallet('withdraw')">
              <ArrowUpTrayIcon class="ico" />
              Withdraw
            </button>
          </div>

          <div v-if="withdrawals && withdrawals.length" class="list">
            <div class="list__head">
              <h3 class="list__title">My Withdrawals</h3>
              <p class="list__sub">Track your payout requests and proofs.</p>
            </div>

            <div class="rows">
              <div v-for="w in withdrawals" :key="w._id" class="row">
                <div class="row__main">
                  <div class="row__amt">{{ formatToPHCurrency((w.amount || 0) / 100) }}</div>
                  <div class="row__meta">
                    <span :class="['badge', `badge--${w.status}`]">{{ w.status }}</span>
                    <span class="row__date">{{ new Date(w.createdAt).toLocaleString() }}</span>
                  </div>
                </div>

                <div class="row__actions">
                  <a
                    v-if="(w.adminProofUrl || w.proofImageUrl)"
                    class="link"
                    :href="w.adminProofUrl || w.proofImageUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Proof
                  </a>

                  <span v-if="w.provider" class="row__provider">{{ w.provider }}</span>

                  <button v-if="w.status === 'pending'" class="btn btn--ghost" @click="cancelWithdrawal(w._id)">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </template>

    <div v-else class="empty">
      <p>Could not load vendor profile. Please try again later.</p>
    </div>

    <teleport to="body">
      <transition name="fade">
        <div v-if="showWalletModal" class="backdrop" @click.self="showWalletModal = false">
          <div class="modal">
            <header class="modal__head">
              <div class="modal__headLeft">
                <div class="modal__icon modal__icon--wallet">
                  <WalletIcon class="ico" />
                </div>
                <div>
                  <h3 class="modal__title">{{ walletModalTitle }}</h3>
                  <p class="modal__sub">{{ walletModalSubtitle }}</p>
                </div>
              </div>

              <button class="iconbtn" @click="showWalletModal = false" aria-label="Close modal">
                <XMarkIcon class="ico" />
              </button>
            </header>

            <form class="modal__body" @submit.prevent="handleWalletAction">
              <template v-if="actionType === 'cashin' && cashInQr">
                <div class="qrBox">
                  <div class="qrBox__title">Scan QR Code</div>
                  <div class="qrBox__img">
                    <img :src="cashInQr.url" alt="QR Code" />
                  </div>
                  <div class="qrBox__hint">After paying, tap <b>Done</b>.</div>

                  <div class="qrBox__actions">
                    <a class="btn btn--muted" :href="cashInQr.url" target="_blank" rel="noopener noreferrer">Open QR</a>
                    <a
                      class="btn btn--muted"
                      :href="`${API_BASE_URL}/payments/${cashInQr.paymentId}/qr/download`"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                    <button type="button" class="btn btn--primary" @click="closeCashIn">Done</button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="formBlock">
                  <div class="formBlock__title">Details</div>

                  <div class="cols">
                    <div class="field">
                      <label class="label">Amount (PHP)</label>
                      <input v-model="walletForm.amount" type="number" step="0.01" class="input" required />
                      <div v-if="actionType === 'withdraw'" class="hint">
                        Minimum withdrawal: <b>100 PHP</b>
                      </div>
                      <div v-if="actionType === 'cashin'" class="hint">
                        Cash in is available via <b>QRPH</b> only.
                      </div>
                    </div>

                    <div class="field">
                      <label class="label">Method</label>

                      <select v-if="actionType === 'withdraw'" v-model="walletForm.payoutMethod" class="input">
                        <option value="gcash">GCash</option>
                        <option value="paymaya">PayMaya</option>
                      </select>

                      <select v-else v-model="walletForm.payoutMethod" class="input" disabled>
                        <option value="qrph">QRPH (Generate QR)</option>
                      </select>

                      <div class="hint">
                        Selected: <b>{{ walletForm.payoutMethod.toUpperCase() }}</b>
                      </div>
                    </div>
                  </div>

                  <div v-if="isBankDetailsRequired" class="formBlock">
                    <div class="formBlock__title">Account Details</div>
                    <div class="cols">
                      <div class="field">
                        <label class="label">Account Number</label>
                        <input v-model="walletForm.bankAccount.accountNumber" class="input" placeholder="Account number" />
                      </div>
                      <div class="field">
                        <label class="label">Account Name</label>
                        <input v-model="walletForm.bankAccount.accountName" class="input" placeholder="Account name" />
                      </div>
                    </div>
                  </div>
                </div>

                <p v-if="walletError" class="err err--block">{{ walletError }}</p>

                <footer class="modal__foot modal__foot--sticky">
                  <button type="button" class="btn btn--muted" @click="showWalletModal = false" :disabled="isSubmitting">
                    Cancel
                  </button>
                  <button type="submit" class="btn btn--primary" :disabled="isSubmitting">
                    {{ isSubmitting ? "Processing..." : (actionType === "cashin" ? "Confirm Cash In" : "Confirm Withdraw") }}
                  </button>
                </footer>
              </template>
            </form>
          </div>
        </div>
      </transition>
    </teleport>

  <QRCodePaymentModal
    :show="!!cashInQr"
    :payment-id="(cashInQr && (cashInQr.paymentIntentId || cashInQr.paymentId)) || ''"
    :qr-code-url="(cashInQr && cashInQr.url) ? cashInQr.url : ''"
    :amount="cashInQr ? Number(cashInQr.amount) / 100 : 0"
    :expires-at="cashInQr && cashInQr.expiresAt"
    @close="() => { /* close modal UI only, leave pending persisted until cancelled/expired/success */ clearCashInQr(); }"
    @success="handleCashInSuccess"
    @failed="handleCashInFailed"
    @expired="handleCashInExpired"
    @cancelled="handleCashInCancelled"
  />

    <!-- Edit Profile Modal -->
    <teleport to="body">
      <transition name="fade">
        <div v-if="showEditModal" class="backdrop" @click.self="showEditModal = false">
          <div class="modal modal--lg">
            <header class="modal__head">
              <div class="modal__headLeft">
                <div class="modal__icon">
                  <PencilSquareIcon class="ico" />
                </div>
                <div>
                  <h3 class="modal__title">Edit Store Profile</h3>
                  <p class="modal__sub">Update your store information</p>
                </div>
              </div>
              <button class="iconbtn" @click="showEditModal = false" aria-label="Close modal">
                <XMarkIcon class="ico" />
              </button>
            </header>

            <form class="modal__body" @submit.prevent="saveEdit">
              <!-- Store Basic Info -->
              <div class="formBlock">
                <div class="formBlock__title">Store Information</div>
                <div class="cols">
                  <div class="field">
                    <label class="label">Store Name</label>
                    <input v-model="editForm.storeName" class="input" :class="{ 'input--err': editErrors.storeName }" placeholder="Enter store name" readonly />
                    <p v-if="editErrors.storeName" class="err">{{ editErrors.storeName }}</p>
                  </div>
                  <div class="field">
                    <label class="label">Email</label>
                    <input v-model="editForm.email" type="email" class="input" placeholder="store@example.com" readonly />
                  </div>
                </div>

                <div class="cols" style="margin-top: 12px;">
                  <div class="field">
                    <label class="label">Phone</label>
                    <input v-model="editForm.phone" class="input" placeholder="+63 9XX XXX XXXX" readonly />
                  </div>
                  <div class="field">
                    <label class="label">Website</label>
                    <input v-model="editForm.website" class="input" placeholder="https://yourstore.com" readonly />
                  </div>
                </div>

                <div class="field" style="margin-top: 12px;">
                  <label class="label">Description</label>
                  <textarea v-model="editForm.description" class="textarea" rows="3" placeholder="Tell customers about your store..." readonly></textarea>
                </div>
              </div>

              <!-- Image URLs -->
              <div class="formBlock">
                <div class="formBlock__title">Store Images</div>
                <div class="cols">
                  <div class="field">
                    <label class="label">Profile Image URL</label>
                    <input v-model="editForm.imageUrl" class="input" placeholder="https://..." />
                    <p class="hint">Square image recommended (400x400px)</p>
                  </div>
                  <div class="field">
                    <label class="label">Banner Image URL</label>
                    <input v-model="editForm.bannerUrl" class="input" placeholder="https://..." />
                    <p class="hint">Wide image recommended (1200x400px)</p>
                  </div>
                </div>

                <!-- Image Previews -->
                <div v-if="editForm.imageUrl || editForm.bannerUrl" class="imgPreviews">
                  <div v-if="editForm.imageUrl" class="imgPreview">
                    <img :src="editForm.imageUrl" alt="Profile Preview" @error="(e) => e.target.style.display='none'" />
                    <span>Profile</span>
                  </div>
                  <div v-if="editForm.bannerUrl" class="imgPreview imgPreview--wide">
                    <img :src="editForm.bannerUrl" alt="Banner Preview" @error="(e) => e.target.style.display='none'" />
                    <span>Banner</span>
                  </div>
                </div>
              </div>

              <!-- Address -->
              <div class="formBlock">
                <div class="formBlock__title">Store Address</div>
                <div class="cols">
                  <div class="field">
                    <label class="label">Street Address</label>
                    <input v-model="editForm.street" class="input" placeholder="123 Main Street" />
                  </div>
                  <div class="field">
                    <label class="label">Barangay</label>
                    <input v-model="editForm.barangay" class="input" placeholder="Barangay name" />
                  </div>
                </div>

                <div class="cols" style="margin-top: 12px;">
                  <div class="field">
                    <label class="label">City/Municipality</label>
                    <input v-model="editForm.city" class="input" placeholder="City name" />
                  </div>
                  <div class="field">
                    <label class="label">Province</label>
                    <input v-model="editForm.province" class="input" placeholder="Province name" />
                  </div>
                </div>

                <div class="field" style="margin-top: 12px; max-width: 200px;">
                  <label class="label">ZIP Code</label>
                  <input v-model="editForm.zipCode" class="input" placeholder="e.g., 5200" />
                </div>
              </div>

              <footer class="modal__foot modal__foot--sticky">
                <button type="button" class="btn btn--muted" @click="showEditModal = false">
                  Cancel
                </button>
                <button type="submit" class="btn btn--primary">
                  Save Changes
                </button>
              </footer>
            </form>
          </div>
        </div>
      </transition>
    </teleport>

  </div>
</template>



<style scoped>
/* ------------------------------------------------------------------ */
/*  DESIGN SYSTEM (Clean, modern, neutral) */
/* ------------------------------------------------------------------ */
.vp {
  --bg: #0b1220;
  --card: rgba(255, 255, 255, 0.06);
  --cardSolid: #0f172a;
  --border: rgba(255, 255, 255, 0.10);
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.68);
  --muted2: rgba(255, 255, 255, 0.52);

  --primary: #22c55e;
  --primary2: #16a34a;

  --shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  --shadow2: 0 12px 40px rgba(0, 0, 0, 0.45);

  --r-sm: 12px;
  --r: 16px;
  --r-lg: 22px;

  min-height: 100dvh;
  padding: 18px;
  background:
    radial-gradient(900px 500px at 15% 10%, rgba(34, 197, 94, 0.16), transparent 60%),
    radial-gradient(800px 500px at 80% 15%, rgba(59, 130, 246, 0.10), transparent 60%),
    linear-gradient(180deg, #070b14 0%, #0b1220 100%);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}

.ico {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
.ico-sm {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}

/* ------------------------------------------------------------------ */
/*  SKELETON */
/* ------------------------------------------------------------------ */
.vp__skeleton {
  display: grid;
  gap: 14px;
}
.sk {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--r);
  position: relative;
  overflow: hidden;
}
.sk::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.10) 45%,
    transparent 70%
  );
  transform: translateX(-100%);
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  to { transform: translateX(100%); }
}
.sk--header { height: 240px; border-radius: var(--r-lg); }
.sk-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, 1fr); }
.sk--card { height: 140px; }

/* ------------------------------------------------------------------ */
/*  HERO */
/* ------------------------------------------------------------------ */
.hero {
  position: relative;
  border-radius: var(--r-lg);
  min-height: 260px;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  box-shadow: var(--shadow2);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.hero__overlay {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 95%),
    radial-gradient(600px 260px at 20% 10%, rgba(34,197,94,0.25), transparent 60%);
  backdrop-filter: blur(3px);
}
.hero__content {
  position: relative;
  z-index: 1;
  padding: 22px;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.hero__left {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  min-width: 0;
}
.avatar {
  position: relative;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.22);
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0,0,0,0.45);
  flex: 0 0 auto;
}
.avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar__edit {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(15, 23, 42, 0.75);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}
.avatar__edit:hover { transform: scale(1.05); background: rgba(15,23,42,0.92); }

.hero__meta { min-width: 0; }
.hero__title {
  margin: 10px 0 6px;
  font-size: clamp(20px, 2.6vw, 34px);
  line-height: 1.1;
  letter-spacing: -0.02em;
}
.hero__desc {
  margin: 0;
  color: rgba(255,255,255,0.82);
  max-width: 68ch;
}
.hero__contacts {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  color: rgba(255,255,255,0.75);
  font-size: 13px;
}
.contact {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.10);
}

.hero__right { display: flex; align-items: flex-end; }

/* Pills */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.85);
}
.pill--soft {
  background: rgba(34,197,94,0.10);
  border-color: rgba(34,197,94,0.22);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.70);
}
.dot--ok { background: var(--primary); }

/* ------------------------------------------------------------------ */
/*  GRID */
/* ------------------------------------------------------------------ */
.grid {
  margin-top: 16px;
  display: grid;
  gap: 14px;
  grid-template-columns: 1.05fr 0.95fr;
}
.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow);
  padding: 16px;
}
.card__head {
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
  margin-bottom: 12px;
}
.card__head--row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card__title {
  margin: 0;
  font-size: 16px;
  letter-spacing: -0.01em;
}
.card__sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

/* ------------------------------------------------------------------ */
/*  STATS */
/* ------------------------------------------------------------------ */
.stats {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--r);
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(255,255,255,0.10);
}
.stat__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.18);
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.92);
}
.stat__value {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
}
.stat__label {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

/* ------------------------------------------------------------------ */
/*  WALLET */
/* ------------------------------------------------------------------ */
.balances {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 10px;
}
.bal {
  border-radius: var(--r);
  padding: 14px;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(255,255,255,0.10);
}
.bal--primary {
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.18);
}
.bal__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bal__label { font-size: 12px; color: var(--muted); }
.bal__chip {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.82);
}
.bal__amt {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.02em;
}
.bal__hint { margin-top: 6px; font-size: 12px; color: var(--muted2); }

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

/* ------------------------------------------------------------------ */
/*  WITHDRAWALS LIST */
/* ------------------------------------------------------------------ */
.list { margin-top: 14px; }
.list__head { margin-bottom: 10px; }
.list__title { margin: 0; font-size: 14px; }
.list__sub { margin: 4px 0 0; color: var(--muted); font-size: 12px; }

.rows {
  display: grid;
  gap: 10px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: var(--r);
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(255,255,255,0.10);
}
.row__amt { font-size: 14px; font-weight: 800; }
.row__meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}
.row__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}
.row__provider {
  font-size: 12px;
  color: var(--muted);
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
}
.link {
  color: rgba(255,255,255,0.88);
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
}
.link:hover { background: rgba(255,255,255,0.10); }

/* badges */
.badge {
  font-size: 12px;
  text-transform: uppercase;
  padding: 5px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
}
.badge--pending { background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.22); }
.badge--processing { background: rgba(59,130,246,0.14); border-color: rgba(59,130,246,0.22); }
.badge--succeeded { background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.22); }
.badge--failed { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.22); }
.badge--cancelled { background: rgba(148,163,184,0.12); border-color: rgba(148,163,184,0.18); }

/* ------------------------------------------------------------------ */
/*  BUTTONS */
/* ------------------------------------------------------------------ */
.btn {
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.90);
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 700;
  font-size: 13px;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;
}
.btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.10); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

.btn--primary {
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary2) 100%);
  border-color: rgba(34,197,94,0.35);
  color: #07110a;
}
.btn--primary:hover { background: linear-gradient(180deg, #2ee071 0%, #1ab256 100%); }

.btn--muted {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.12);
}

.btn--ghost {
  background: transparent;
  border-color: rgba(255,255,255,0.14);
}
.btn--glass {
  background: rgba(255,255,255,0.10);
  border-color: rgba(255,255,255,0.18);
}

/* ------------------------------------------------------------------ */
/*  MODAL */
/* ------------------------------------------------------------------ */
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}
.modal {
  width: 100%;
  max-width: 640px;
  background: rgba(15, 23, 42, 0.86);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow2);
  overflow: hidden;
}
.modal--lg { max-width: 820px; }

.modal__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
}
.modal__headLeft {
  display: flex;
  gap: 10px;
  align-items: center;
}
.modal__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.18);
}
.modal__icon--wallet {
  background: rgba(59,130,246,0.12);
  border-color: rgba(59,130,246,0.18);
}
.modal__title {
  margin: 0;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.modal__sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.iconbtn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
  cursor: pointer;
}
.iconbtn:hover { background: rgba(255,255,255,0.10); }

.modal__body {
  padding: 14px;
  max-height: 72vh;
  overflow: auto;
}
.modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.03);
}
.modal__foot--sticky {
  position: sticky;
  bottom: -1px;
}

/* ------------------------------------------------------------------ */
/*  FORMS */
/* ------------------------------------------------------------------ */
.formBlock { margin-bottom: 14px; }
.formBlock__title {
  font-size: 12px;
  color: rgba(255,255,255,0.80);
  margin: 0 0 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.cols--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }

.field { display: flex; flex-direction: column; gap: 8px; }
.label { font-size: 12px; color: rgba(255,255,255,0.78); }
.req { color: #fb7185; font-weight: 800; margin-left: 4px; }

.input, .textarea, select.input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(2, 6, 23, 0.55);
  color: rgba(255,255,255,0.90);
  outline: none;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}
.input:focus, .textarea:focus, select.input:focus {
  border-color: rgba(34,197,94,0.55);
  background: rgba(2, 6, 23, 0.75);
}
.input--err { border-color: rgba(239, 68, 68, 0.60) !important; }
.hint { font-size: 12px; color: var(--muted2); }
.err { font-size: 12px; color: #fb7185; margin: 0; }

/* Image Previews */
.imgPreviews {
  display: flex;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.imgPreview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.imgPreview img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.12);
}
.imgPreview--wide img {
  width: 160px;
  height: 60px;
}
.imgPreview span {
  font-size: 11px;
  color: var(--muted);
}
.err--block {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(251,113,133,0.35);
  background: rgba(251,113,133,0.10);
}

/* ------------------------------------------------------------------ */
/*  QR */
/* ------------------------------------------------------------------ */
.qrBox {
  padding: 12px;
  border-radius: var(--r);
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(2, 6, 23, 0.45);
}
.qrBox__title {
  font-weight: 900;
  letter-spacing: -0.01em;
}
.qrBox__img {
  margin-top: 12px;
  display: grid;
  place-items: center;
  padding: 12px;
  border-radius: var(--r);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
}
.qrBox__img img {
  width: min(320px, 100%);
  height: auto;
  border-radius: 12px;
  background: white;
  padding: 10px;
}
.qrBox__hint { margin-top: 10px; color: var(--muted); font-size: 12px; }
.qrBox__actions {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

/* ------------------------------------------------------------------ */
/*  EMPTY */
/* ------------------------------------------------------------------ */
.empty {
  padding: 18px;
  border-radius: var(--r-lg);
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  box-shadow: var(--shadow);
}

/* ------------------------------------------------------------------ */
/*  ANIM */
/* ------------------------------------------------------------------ */
.fade-enter-active, .fade-leave-active { transition: all 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px) scale(0.99); }

/* ------------------------------------------------------------------ */
/*  RESPONSIVE */
/* ------------------------------------------------------------------ */
@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .sk-grid { grid-template-columns: 1fr; }
  .hero__content { align-items: flex-end; flex-direction: column; }
  .hero__left { width: 100%; align-items: flex-end; }
  .hero__right { width: 100%; }
  .actions { grid-template-columns: 1fr; }
  .balances { grid-template-columns: 1fr; }
  .stats { grid-template-columns: 1fr; }
  .cols, .cols--3 { grid-template-columns: 1fr; }

  /* Bottom-sheet modal feel on mobile */
  .backdrop { align-items: flex-end; }
  .modal {
    border-radius: 18px 18px 0 0;
    max-width: 100%;
  }
  .modal__body { max-height: 78vh; }
  .qrBox__actions { grid-template-columns: 1fr; }
}
</style>
