<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from 'vue-router';
import {
  ClockIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
} from "@heroicons/vue/24/outline";
import { useSubscriptionStore } from "../../../stores/vendor/subscriptionStore";
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores";
import { formatToPHCurrency } from "../../../utils/currencyFormat.js";
import { pollPaymentStatus } from "../../../utils/paymentApi";
import QRCodePaymentModal from "../../../components/QRCodePaymentModal.vue";
import { Toast } from "../../../components/composable/Toast.js";
import axios from "axios";
import { getAuthHeaders } from "../../../types/shared";
const API_URL = import.meta.env.VITE_API_BASE_URL || "";
const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const vendorDashboardStore = useVendorDashboardStore();

const subscription = computed(() => subscriptionStore.subscription);
const plans = computed(() => subscriptionStore.plans);
const isLoading = computed(() => subscriptionStore.isLoading);
const currentPlan = computed(() => subscriptionStore.currentPlan);
const daysUntilExpiry = computed(() => subscriptionStore.daysUntilExpiry);

const showCancelModal = ref(false);
const showChangePlanModal = ref(false);
const selectedPlanForChange = ref(null);
const selectedPaymentMethod = ref("wallet");

const openChangePlanModal = () => {
  selectedPlanForChange.value = null;
  selectedPaymentMethod.value = "wallet";
  showChangePlanModal.value = true;
};

const formatCurrency = (amount, currency) => {
  if ((currency || "PHP") === "PHP") return formatToPHCurrency(amount);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount || 0);
  } catch {
    return String(amount ?? 0);
  }
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const isDiscountActive = (plan) => {
  const dp = Number(plan?.discountPercent || 0);

  if (!dp) return false;
  if (plan?.discountExpiresAt) {
    const d = new Date(plan.discountExpiresAt).getTime();
    return Number.isFinite(d) && d > Date.now();
  }
  return true;
};

const discountedPrice = (plan) => {
  const dp = Number(plan?.discountPercent || 0);
  if (!isDiscountActive(plan)) return plan?.price || 0;
  return Math.round((plan.price || 0) * (1 - dp / 100));
};

const selectPlan = (plan) => {
  selectedPlanForChange.value = plan;
  showChangePlanModal.value = true;
};

const confirmCancel = async () => {
  await subscriptionStore.cancelSubscription();
  showCancelModal.value = false;
};

const PENDING_SUBSCRIPTION_KEY = "pendingSubscriptionPayment";

const showQRModal = ref(false);
const qrPaymentData = ref({
  dbPaymentId: "",
  qrCodeUrl: "",
  amount: 0,
  expiresAt: null,
  paymentIntentId: "",
});
let qrStopPolling = null;

function persistPendingSubscriptionPayment(planCode = null) {
  try {
    const data = {
      ...qrPaymentData.value,
      planCode,
    };
    localStorage.setItem(PENDING_SUBSCRIPTION_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to persist pending subscription payment:", e);
  }
}

function clearPendingSubscriptionPayment() {
  try {
    localStorage.removeItem(PENDING_SUBSCRIPTION_KEY);
  } catch (e) {
    console.warn("Failed to clear pending subscription payment:", e);
  }
}

function restorePendingSubscriptionPayment() {
  try {
    const raw = localStorage.getItem(PENDING_SUBSCRIPTION_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (!stored || !stored.expiresAt) return;
    const expiry = new Date(stored.expiresAt).getTime();
    if (Date.now() > expiry) {
      clearPendingSubscriptionPayment();
      return;
    }

    qrPaymentData.value = {
      dbPaymentId: stored.dbPaymentId || stored.paymentId || "",
      qrCodeUrl: stored.qrCodeUrl || "",
      amount: stored.amount || 0,
      expiresAt: stored.expiresAt,
      paymentIntentId: stored.paymentIntentId || "",
    };

    // Re-open modal and start polling
    showQRModal.value = true;

    const idToPoll =
      qrPaymentData.value.paymentIntentId || qrPaymentData.value.dbPaymentId;

    qrStopPolling = pollPaymentStatus(
      idToPoll,
      async (status, paymentDataResp) => {
        if (status === "succeeded") {
          try {
            if (
              subscriptionStore &&
              typeof subscriptionStore.confirmSubscriptionWithPayment ===
              "function"
            ) {
              // Try to read planCode from stored metadata — fallback to current UI flow
              const storedPlanCode = stored.planCode || null;
              if (storedPlanCode)
                await subscriptionStore.confirmSubscriptionWithPayment(
                  storedPlanCode,
                  idToPoll,
                );
            }
            clearPendingSubscriptionPayment();
            handleQRModalClose();
            Toast("Subscription activated successfully!", "success", 3000);
            router.go(0);
          } catch (err) {
            console.error(
              "Error finalizing restored subscription payment:",
              err,
            );
          }
        } else if (status === "failed" || status === "expired") {
          clearPendingSubscriptionPayment();
          handleQRModalClose();
          Toast("Payment failed or expired. Please try again.", "error", 4000);
        }
      },
    );
  } catch (e) {
    console.error("Failed to restore pending subscription payment:", e);
    clearPendingSubscriptionPayment();
  }
}

function handleQRModalClose() {
  if (typeof qrStopPolling === "function") {
    try {
      qrStopPolling();
    } catch (e) {
      console.warn("Failed to stop polling", e);
    }
    qrStopPolling = null;
  }
  showQRModal.value = false;
}

const confirmChangePlan = async () => {
  if (!selectedPlanForChange.value) return;

  const plan = selectedPlanForChange.value;

  console.log("Changing to plan:", plan.code, "with payment method:", vendorDashboardStore.walletBalance);

  try {
    if (
     discountedPrice(plan) > 0 &&
      selectedPaymentMethod.value === "wallet" &&
      discountedPrice(plan) > vendorDashboardStore.walletBalance
    ) {
      alert(
        "Insufficient wallet balance. Please choose QRPH payment or top up your wallet.",
      );
      return;
    }

    if (selectedPaymentMethod.value === "wallet") {
      await subscriptionStore.changePlan(plan.code, "wallet");
      showChangePlanModal.value = false;
      selectedPlanForChange.value = null;

      console.log("Started polling for subscription payment status");

      router.go(0)
      return;
    }

    // QRPH flow - prefer store helper, fallback to direct API call when helper missing
    let payment;
    if (
      subscriptionStore &&
      typeof subscriptionStore.createSubscriptionPayment === "function"
    ) {
      payment = await subscriptionStore.createSubscriptionPayment(plan.code);
    }

    const discountAmount = Number(
      (1 - (plan.discountPercent || 0) / 100).toFixed(2),
    );

    const disCountedAmount = () => {
      return Math.ceil(plan.price * discountAmount) >= 1
        ? Math.ceil(plan.price * discountAmount)
        : 1;
    };

    if (!payment) throw new Error("Failed to create payment");

    qrPaymentData.value = {
      dbPaymentId: payment._id,
      qrCodeUrl: payment.qrCodeUrl,
      amount: isDiscountActive(plan)
        ? disCountedAmount()
        : plan.price,
      expiresAt:
        payment.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      paymentIntentId: payment.paymentIntentId || payment.paymentIntent,
    };

    // Persist pending payment so modal survives refresh (store planCode to finalize on restore)
    persistPendingSubscriptionPayment(plan.code);

    // Open QR modal and start polling for payment status
    showChangePlanModal.value = false;
    selectedPlanForChange.value = null;
    showQRModal.value = true;

    const paymentIntentId =
      qrPaymentData.value.paymentIntentId || qrPaymentData.value.dbPaymentId;

    qrStopPolling = pollPaymentStatus(
      paymentIntentId,
      async (status, paymentDataResp) => {
        if (status === "succeeded") {
          try {
            if (
              subscriptionStore &&
              typeof subscriptionStore.confirmSubscriptionWithPayment ===
              "function"
            ) {
              await subscriptionStore.confirmSubscriptionWithPayment(
                plan.code,
                paymentIntentId,
              );
            } else {
              // direct finalize call as fallback
              const idempotencyKey = `sub.confirm.${paymentIntentId}`;
              await axios.post(
                `${API_URL}/sellers/subscription/start-or-change`,
                {
                  planCode: plan.code,
                  paymentMethod: "qrph",
                  paymentIntentId,
                },
                {
                  headers: {
                    ...getAuthHeaders(),
                    "Idempotency-Key": idempotencyKey,
                  },
                },
              );
            }

            clearPendingSubscriptionPayment();
            handleQRModalClose();
            Toast("Subscription activated successfully!", "success", 3000);
            router.go(0);
          } catch (err) {
            console.error("Error confirming subscription after payment:", err);
            Toast(
              "Failed to finalize subscription after payment",
              "error",
              4000,
            );
          }
        } else if (status === "failed" || status === "expired") {
          clearPendingSubscriptionPayment();
          Toast("Payment failed or expired. Please try again.", "error", 4000);
          handleQRModalClose();
        }
      },
      
    );

  } catch (err) {
    console.error("Change plan with payment error:", err);
    Toast(err?.message || "Failed to change plan", "error", 3000);
    handleQRModalClose();
  }
};

// const renewSubscription = async () => {
//   await subscriptionStore.renewSubscription();
// };

onMounted(async () => {
  await subscriptionStore.fetchSubscription();
  await subscriptionStore.fetchPlans();
  // Restore pending subscription QR payment if the user refreshed the page
  restorePendingSubscriptionPayment();
});
</script>


<template>
  <div class="subscription-page">
    <div class="subscription-container">
      <header class="page-header">
        <div class="header-content">
          <div class="header-pill">
            <span class="pill-dot"></span>
            Manage your plan
          </div>

          <h1 class="main-title">
            <span class="title-gradient">Subscription</span>
            <span class="title-light">Management</span>
          </h1>

          <p class="main-subtitle">
            Review your current plan, billing details, and upgrade anytime as
            your store grows.
          </p>
        </div>
      </header>

      <section v-if="isLoading" class="current-subscription">
        <div class="status-header">
          <div class="status-title-group">
            <div class="status-icon-wrapper skeleton"></div>
            <div class="skeleton-lines">
              <div class="skeleton skeleton-line w-220"></div>
              <div class="skeleton skeleton-line w-160"></div>
            </div>
          </div>
          <div class="skeleton skeleton-pill w-140"></div>
        </div>

        <div class="subscription-grid">
          <div class="info-card skeleton-card">
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton-lines">
              <div class="skeleton skeleton-line w-120"></div>
              <div class="skeleton skeleton-line w-200"></div>
              <div class="skeleton skeleton-line w-240"></div>
            </div>
          </div>

          <div class="info-card skeleton-card">
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton-lines">
              <div class="skeleton skeleton-line w-120"></div>
              <div class="skeleton skeleton-line w-220"></div>
            </div>
          </div>

          <div class="info-card skeleton-card">
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton-lines">
              <div class="skeleton skeleton-line w-140"></div>
              <div class="skeleton skeleton-line w-200"></div>
              <div class="skeleton skeleton-line w-160"></div>
            </div>
          </div>
        </div>

        <div class="action-bar">
          <div class="skeleton skeleton-btn"></div>
          <div class="skeleton skeleton-btn"></div>
        </div>
      </section>

      <section v-else-if="subscription" class="current-subscription">
        <div class="status-header">
          <div class="status-title-group">
            <div class="status-icon-wrapper">
              <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 class="status-title">Active Subscription</h2>
              <p class="status-desc">Your current plan details</p>
            </div>
          </div>

          <span :class="['status-pill', `status-${subscription.status}`]">
            <span class="status-dot"></span>
            {{
              subscription.status.charAt(0).toUpperCase() +
              subscription.status.slice(1)
            }}
          </span>
        </div>

        <div class="subscription-grid">
          <div class="info-card card-plan">
            <div class="card-icon-wrapper">
              <DocumentTextIcon class="card-icon" />
            </div>
            <div class="card-content">
              <p class="card-label">Current Plan</p>
              <h3 class="card-value">
                {{ subscription.planId?.name || "N/A" }}
              </h3>
              <p class="card-subtext">
                {{ subscription.planId?.description || "" }}
              </p>
            </div>
          </div>

          <div class="info-card card-price">
            <div class="card-icon-wrapper">
              <CurrencyDollarIcon class="card-icon" />
            </div>
            <div class="card-content">
              <p class="card-label">Billing Amount</p>
              <h3 class="card-value">
                <template v-if="
                  subscription.planId && isDiscountActive(subscription.planId)
                ">
                  <span class="card-price-discount"
                    :aria-label="`${subscription.planId.discountPercent}% off until ${subscription.planId.discountExpiresAt ? formatDate(subscription.planId.discountExpiresAt) : 'no expiry'}`">
                    {{
                      formatCurrency(
                        discountedPrice(subscription.planId),
                        subscription.planId.currency,
                      )
                    }}
                  </span>
                  <span class="card-interval">/{{ subscription.planId.interval }}</span>
                  <div class="card-original-price">
                    {{
                      formatCurrency(
                        subscription.planId.price,
                        subscription.planId.currency,
                      )
                    }}
                  </div>
                </template>
                <template v-else>
                  {{
                    formatCurrency(
                      subscription.planId?.price || 0,
                      subscription.planId?.currency || "PHP",
                    )
                  }}
                  <span class="card-interval">/{{ subscription.planId?.interval }}</span>
                </template>
              </h3>
            </div>
          </div>

          <div class="info-card card-billing">
            <div class="card-icon-wrapper">
              <ClockIcon class="card-icon" />
            </div>
            <div class="card-content">
              <p class="card-label">Next Billing Date</p>
              <h3 class="card-value">
                {{ formatDate(subscription.currentPeriodEnd) }}
              </h3>
              <p v-if="daysUntilExpiry !== null" class="card-subtext">
                <span class="days-badge">{{ daysUntilExpiry }} days</span>
                remaining
              </p>
            </div>
          </div>
        </div>

        <!-- <div class="action-bar">
          <button
            v-if="subscription.status === 'active' && !subscription.cancelAtPeriodEnd"
            type="button"
            :disabled="isLoading"
            @click="showCancelModal = true"
            class="action-btn btn-cancel"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel Subscription
          </button>

          <button
            v-if="subscription.status === 'expired' || subscription.cancelAtPeriodEnd"
            type="button"
            :disabled="isLoading"
            @click="renewSubscription"
            class="action-btn btn-renew"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Renew Subscription
          </button>

          <button
            type="button"
            :disabled="isLoading"
            @click="openChangePlanModal"
            class="action-btn btn-change"
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Change Plan
          </button>
        </div> -->
      </section>

      <section class="plans-section">
        <div class="section-header">
          <h2 class="section-title">Choose a Plan</h2>
          <p class="section-subtitle">
            Flexible pricing that scales with your store
          </p>
        </div>

        <div v-if="isLoading && !plans?.length" class="plans-container">
          <div v-for="n in 3" :key="n" class="plan-card skeleton-plan">
            <div class="skeleton skeleton-pill w-120"></div>
            <div class="skeleton skeleton-line w-200"></div>
            <div class="skeleton skeleton-line w-260"></div>
            <div class="skeleton skeleton-price"></div>
            <div class="skeleton skeleton-line w-240"></div>
            <div class="skeleton skeleton-line w-220"></div>
            <div class="skeleton skeleton-line w-200"></div>
            <div class="skeleton skeleton-btn"></div>
          </div>
        </div>

        <div v-else class="plans-container">
          <div v-for="plan in plans" :key="plan._id" :class="[
            'plan-card',
            {
              'plan-active': currentPlan?._id === plan._id,
              'plan-popular': plan.code === 'pro-monthly',
            },
          ]">
            <div v-if="plan.code === 'pro-monthly'" class="popular-tag">
              <svg class="tag-icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              Most Popular
            </div>

            <div v-if="currentPlan?._id === plan._id" class="current-tag">
              <svg class="tag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Current Plan
            </div>

            <div class="plan-header">
              <h3 class="plan-name">{{ plan.name }}</h3>
              <p class="plan-desc">{{ plan.description }}</p>
            </div>

            <div v-if="isDiscountActive(plan)" class="discount-badge"
              :aria-label="`${plan.discountPercent}% off until ${plan.discountExpiresAt ? formatDate(plan.discountExpiresAt) : 'no expiry'}`">
              {{ plan.discountPercent }}% OFF until
              {{
                plan.discountExpiresAt
                  ? formatDate(plan.discountExpiresAt)
                  : "no expiry"
              }}
            </div>

            <div class="plan-price-wrapper">
              <div class="plan-currency">
                {{ plan.currency === "PHP" ? "₱" : "$" }}
              </div>

              <div v-if="isDiscountActive(plan)" class="plan-pricing">
                <div class="plan-original-price">
                  {{ Math.round(plan.price) }}
                </div>
                <div class="plan-price">
                  {{ Math.round(discountedPrice(plan)) }}
                </div>
              </div>

              <div v-else>
                <div class="plan-price">{{ Math.round(plan.price) }}</div>
              </div>

              <div class="plan-period">
                <span class="period-sep">/</span>
                <span class="period-text">{{ plan.interval }}</span>
              </div>
            </div>

            <ul class="plan-features">
              <li v-for="feature in plan.features" :key="feature" class="feature-item">
                <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="feature-text">{{ feature }}</span>
              </li>
            </ul>

            <button type="button" :class="[
              'plan-cta',
              { 'cta-disabled': currentPlan?._id === plan._id },
            ]" :disabled="isLoading || currentPlan?._id === plan._id" @click.stop="selectPlan(plan)">
              <span v-if="currentPlan?._id === plan._id">Your Current Plan</span>
              <span v-else>
                Select {{ plan.name }}
                <svg class="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="subscription?.history?.length" class="history-section">
        <div class="section-header">
          <h2 class="section-title">Activity Timeline</h2>
          <p class="section-subtitle">
            Track your subscription changes and updates
          </p>
        </div>

        <div class="timeline">
          <div v-for="(event, index) in subscription.history.slice().reverse()" :key="event._id || event.at"
            class="timeline-item">
            <div class="timeline-marker">
              <div class="marker-dot"></div>
              <div v-if="index !== subscription.history.length - 1" class="marker-line"></div>
            </div>

            <div class="timeline-content">
              <div class="timeline-header">
                <h4 class="timeline-event">{{ event.event }}</h4>
                <time class="timeline-date">{{ formatDate(event.at) }}</time>
              </div>
              <p class="timeline-note">{{ event.note }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <transition name="modal">
      <div v-if="showCancelModal" class="modal-backdrop" @click="showCancelModal = false">
        <div class="modal-wrapper" @click.stop>
          <div class="modal-content">
            <div class="modal-header">
              <div class="modal-icon modal-icon-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="modal-title">Cancel Subscription</h3>
              <button type="button" @click="showCancelModal = false" class="modal-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <p class="modal-text">
                Are you sure you want to cancel your subscription? Your plan
                will remain active until
                <strong>{{ formatDate(subscription?.currentPeriodEnd) }}</strong>.
              </p>
            </div>
            <div class="modal-footer">
              <button type="button" @click="showCancelModal = false" class="modal-btn btn-secondary">
                Keep Subscription
              </button>
              <button type="button" @click="confirmCancel" class="modal-btn btn-danger">
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <transition name="modal">
      <div v-if="showChangePlanModal" class="modal-backdrop" @click="showChangePlanModal = false">
        <div class="modal-wrapper" @click.stop>
          <div class="modal-content modal-large">
            <div class="modal-header">
              <div class="modal-icon modal-icon-info">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 class="modal-title">Change Your Plan</h3>
              <button type="button" @click="showChangePlanModal = false" class="modal-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="modal-body">
              <p class="modal-text">
                Select a new plan. Changes take effect immediately and billing
                will be prorated.
              </p>

              <div class="plan-options">
                <div v-for="plan in plans" :key="plan._id" @click="selectedPlanForChange = plan" :class="[
                  'plan-option',
                  {
                    'option-selected':
                      selectedPlanForChange?._id === plan._id,
                  },
                ]" role="button" tabindex="0">
                  <div class="option-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div class="option-content">
                    <h4 class="option-name">{{ plan.name }}</h4>
                    <p class="option-desc">{{ plan.description }}</p>
                  </div>
                  <div class="option-price">
                    {{ formatCurrency(Math.round(discountedPrice(plan))) }}
                    <span class="option-period">/{{ plan.interval }}</span>
                  </div>
                </div>
              </div>

              <div v-if="selectedPlanForChange?.price > 0" class="payment-section">
                <h4 class="payment-title">Payment Method</h4>
                <div class="payment-options">
                  <div @click="selectedPaymentMethod = 'wallet'" :class="[
                    'payment-option',
                    { 'option-selected': selectedPaymentMethod === 'wallet' },
                  ]" role="button" tabindex="0">
                    <div class="option-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div class="option-content">
                      <h4 class="option-name">Wallet Balance</h4>
                      <p class="option-desc">
                        Available:
                        {{ formatCurrency(vendorDashboardStore.walletBalance, "PHP") }}
                      </p>
                    </div>
                  </div>
                  <div @click="selectedPaymentMethod = 'qrph'" :class="[
                    'payment-option',
                    { 'option-selected': selectedPaymentMethod === 'qrph' },
                  ]" role="button" tabindex="0">
                    <div class="option-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div class="option-content">
                      <h4 class="option-name">QRPH Payment</h4>
                      <p class="option-desc">Pay via QR code</p>
                    </div>
                  </div>
                </div>
                <div v-if="
                  selectedPaymentMethod === 'wallet' &&
                  discountedPrice(selectedPlanForChange) > vendorDashboardStore.walletBalance
                " class="payment-warning">
                  <p>
                    Insufficient wallet balance. Please top up or choose QRPH
                    payment.
                  </p>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" @click="showChangePlanModal = false" class="modal-btn btn-secondary">
                Cancel
              </button>
              <button type="button" @click="confirmChangePlan" :disabled="!selectedPlanForChange ||
                isLoading ||
                (discountedPrice(selectedPlanForChange) > 0 &&
                  selectedPaymentMethod === 'wallet' &&
                  discountedPrice(selectedPlanForChange) > vendorDashboardStore.walletBalance)
                " class="modal-btn btn-primary">
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <QRCodePaymentModal v-if="showQRModal" :show="showQRModal" :paymentId="qrPaymentData.dbPaymentId"
      :paymentIntentId="qrPaymentData.paymentIntentId" :qrCodeUrl="qrPaymentData.qrCodeUrl"
      :amount="qrPaymentData.amount" :expiresAt="qrPaymentData.expiresAt" @close="
        () => {
          showQRModal = false;
        }
      " @success="
        () => {
          clearPendingSubscriptionPayment();
        }
      " @failed="
        () => {
          clearPendingSubscriptionPayment();
        }
      " @expired="
        () => {
          clearPendingSubscriptionPayment();
        }
      " @cancelled="
        () => {
          clearPendingSubscriptionPayment();
        }
      " />
  </div>
</template>


<style scoped>
.subscription-page {
  --page-pad: clamp(12px, 1.8vw, 20px);
  --gap: clamp(10px, 1.2vw, 14px);
  --card-pad: clamp(12px, 1.2vw, 16px);
  --maxw: 1320px;

  /* Map component tokens to the global theme system (themes.css) */
  --brand: var(--color-primary);
  --brand-2: var(--color-primary-hover);
  --info: var(--color-info);
  --purple: var(--color-info-hover);

  --bg: var(--bg-primary);
  --bg-2: var(--bg-secondary);

  --txt: var(--text-primary);
  --txt2: var(--text-secondary);
  --txt3: var(--text-tertiary);
  --txt-muted: var(--text-muted);
  --txt-inverse: var(--btn-primary-text);

  --bdr: var(--border-primary);
  --bdr2: var(--border-secondary);

  --success: var(--color-success);
  --success-1: var(--color-success-hover);
  --success-bg: var(--color-success-light);
  --success-bdr: var(--border-secondary);
  --success-bdr: color-mix(in srgb,
      var(--color-success) 28%,
      var(--border-primary));
  --success-txt: var(--color-success-text);

  --warning: var(--color-warning);
  --warning-1: var(--color-warning-hover);
  --warning-bg: var(--color-warning-light);
  --warning-bdr: var(--border-secondary);
  --warning-bdr: color-mix(in srgb,
      var(--color-warning) 30%,
      var(--border-primary));
  --warning-txt: var(--color-warning-text);

  --danger: var(--color-danger);
  --danger-1: var(--color-danger-hover);
  --danger-bg: var(--color-danger-light);
  --danger-bdr: var(--border-secondary);
  --danger-bdr: color-mix(in srgb,
      var(--color-danger) 28%,
      var(--border-primary));
  --danger-txt: var(--color-danger-text);

  --shadow: var(--card-shadow);
  --shadow2: var(--card-shadow-hover);

  --r-sm: var(--radius-md);
  --r-md: var(--radius-lg);
  --r-lg: var(--radius-xl);
  --r-xl: var(--radius-xl);
  --r-full: var(--radius-full);

  --t-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-base: 240ms cubic-bezier(0.4, 0, 0.2, 1);
  --t-slow: 340ms cubic-bezier(0.4, 0, 0.2, 1);

  min-height: 100vh;
  background: linear-gradient(180deg, var(--bg), var(--bg-2));
  color: var(--txt);
  position: relative;
  overflow-x: hidden;
  padding: 2.5rem 0 4rem;
  font-family: var(--font-sans,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      "Helvetica Neue",
      Arial,
      sans-serif);
}

.subscription-container {
  max-width: var(--maxw);
  margin: 0 auto;
  padding: 0 2rem;
  position: relative;
  z-index: 1;
}

.page-header {
  text-align: center;
  margin-bottom: 3.2rem;
}

.header-content {
  max-width: 860px;
  margin: 0 auto;
}

.header-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.95rem;
  border-radius: var(--r-full);
  border: 1px solid var(--bdr);
  background: var(--surface);
  color: var(--txt2);
  font-weight: 800;
  font-size: 0.85rem;
  letter-spacing: 0.01em;
  margin-bottom: 1.2rem;
  box-shadow: var(--shadow-sm);
}

.pill-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--info));
  box-shadow: 0 0 0 5px rgba(31, 139, 78, 0.16);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--brand) 18%, transparent);
}

.main-title {
  font-size: clamp(2.2rem, 5vw, 4rem);
  font-weight: 950;
  line-height: 1.02;
  margin-bottom: 1.05rem;
  letter-spacing: -0.03em;
}

.title-gradient {
  background: linear-gradient(135deg, var(--brand), var(--info));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: inline-block;
}

.title-light {
  color: var(--txt);
}

.main-subtitle {
  font-size: clamp(1rem, 1.5vw, 1.2rem);
  color: var(--txt2);
  line-height: 1.65;
  max-width: 680px;
  margin: 0 auto;
}

.current-subscription {
  border-radius: var(--r-xl);
  padding: 2.2rem;
  margin-bottom: 3.6rem;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--bdr);
  background: var(--surface);
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
  position: relative;
  z-index: 1;
}

.status-title-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-icon-wrapper {
  width: 54px;
  height: 54px;
  background: linear-gradient(135deg, var(--brand), var(--info));
  border-radius: var(--r-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--bdr);
}

.status-icon {
  width: 28px;
  height: 28px;
  color: var(--txt-inverse);
  stroke-width: 2.6;
}

.status-title {
  font-size: 1.7rem;
  font-weight: 950;
  color: var(--txt);
  margin-bottom: 0.2rem;
}

.status-desc {
  font-size: 0.94rem;
  color: var(--txt2);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 1.05rem;
  border-radius: var(--r-full);
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--surface);
  border: 1px solid var(--bdr);
  color: var(--txt2);
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.55;
    transform: scale(0.9);
  }
}

.status-active {
  background: var(--success-bg);
  color: var(--success-txt);
  border: 1px solid var(--success-bdr);
}

.status-active .status-dot {
  background: var(--success);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.16);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 18%, transparent);
}

.status-expired {
  background: var(--danger-bg);
  color: var(--danger-txt);
  border: 1px solid var(--danger-bdr);
}

.status-expired .status-dot {
  background: var(--danger);
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.16);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--danger) 18%, transparent);
}

.status-canceled {
  background: var(--warning-bg);
  color: var(--warning-txt);
  border: 1px solid var(--warning-bdr);
}

.status-canceled .status-dot {
  background: var(--warning);
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--warning) 18%, transparent);
}

.subscription-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.15rem;
  margin-bottom: 1.6rem;
  position: relative;
  z-index: 1;
}

.info-card {
  border-radius: var(--r-lg);
  padding: 1.45rem;
  display: flex;
  gap: 1rem;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    background var(--t-base),
    border-color var(--t-base);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--bdr);
  background: var(--surface);
}

.info-card::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  width: 5px;
  height: 100%;
}

.info-card:hover {
  transform: translateY(-4px);
  border-color: var(--bdr2);
  box-shadow: var(--shadow2);
  background: var(--surface-hover);
}

.card-plan::after {
  background: linear-gradient(180deg, var(--brand), var(--info));
}

.card-price::after {
  background: linear-gradient(180deg, var(--success), var(--success-1));
}

.card-billing::after {
  background: linear-gradient(180deg, var(--info), var(--brand-2));
}

.card-icon-wrapper {
  width: 54px;
  height: 54px;
  border-radius: var(--r-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--bdr);
  background: var(--surface-hover);
}

.card-plan .card-icon-wrapper {
  background: var(--color-primary-light);
  border-color: var(--bdr2);
}

.card-price .card-icon-wrapper {
  background: var(--color-success-light);
  border-color: var(--bdr2);
}

.card-billing .card-icon-wrapper {
  background: var(--color-info-light);
  border-color: var(--bdr2);
}

.card-icon {
  width: 26px;
  height: 26px;
  color: var(--txt);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 0.78rem;
  color: var(--txt3);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  margin-bottom: 0.45rem;
  font-weight: 950;
}

.card-value {
  font-size: 1.55rem;
  font-weight: 1000;
  color: var(--txt);
  margin-bottom: 0.3rem;
  line-height: 1.15;
}

.card-interval {
  font-size: 1rem;
  color: var(--txt2);
  font-weight: 850;
}

.card-subtext {
  font-size: 0.95rem;
  color: var(--txt2);
  line-height: 1.45;
}

.days-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--brand), var(--info));
  color: var(--txt-inverse);
  padding: 0.22rem 0.6rem;
  border-radius: 10px;
  font-weight: 950;
  border: 1px solid rgba(31, 139, 78, 0.18);
  border: 1px solid color-mix(in srgb, var(--info) 26%, var(--bdr));
  box-shadow: var(--shadow-sm);
}

.action-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  justify-content: center;
  padding-top: 1.25rem;
  border-top: 1px solid var(--bdr);
  position: relative;
  z-index: 1;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.92rem 1.55rem;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 950;
  letter-spacing: 0.01em;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    opacity var(--t-base),
    border-color var(--t-base);
  position: relative;
  overflow: hidden;
}

.action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  filter: saturate(0.85);
}

.action-btn:focus-visible,
.plan-cta:focus-visible,
.modal-btn:focus-visible,
.modal-close:focus-visible,
.plan-option:focus-visible {
  outline: 3px solid rgba(31, 139, 78, 0.55);
  outline: 3px solid color-mix(in srgb, var(--brand) 60%, transparent);
  outline-offset: 3px;
}

.action-btn::before,
.plan-cta::before {
  content: "";
  position: absolute;
  inset: -2px;
  background: radial-gradient(240px 140px at 30% 20%,
      rgba(255, 255, 255, 0.2),
      transparent 55%);
  background: radial-gradient(240px 140px at 30% 20%,
      color-mix(in srgb, var(--btn-primary-text) 18%, transparent),
      transparent 55%);
  opacity: 0;
  transition: opacity var(--t-base);
}

.action-btn:hover::before,
.plan-cta:hover::before {
  opacity: 1;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2.6;
  position: relative;
  z-index: 1;
}

.btn-cancel {
  background: var(--danger);
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--danger) 26%, transparent);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--danger-1);
}

.btn-renew {
  background: var(--success);
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--success) 24%, transparent);
}

.btn-renew:hover:not(:disabled) {
  background: var(--success-1);
}

.btn-change {
  background: var(--btn-primary-bg);
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--btn-primary-bg) 26%, transparent);
}

.btn-change:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}

.plans-section {
  margin-bottom: 4rem;
}

.section-header {
  text-align: center;
  margin-bottom: 2.6rem;
}

.section-title {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 1000;
  color: var(--txt);
  margin-bottom: 0.7rem;
  letter-spacing: -0.02em;
}

.section-subtitle {
  font-size: 1.05rem;
  color: var(--txt2);
}

.plans-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.6rem;
}

.plan-card {
  border-radius: var(--r-xl);
  padding: 2rem;
  display: flex;
  flex-direction: column;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    border-color var(--t-base);
  position: relative;
  cursor: default;
  overflow: hidden;
  border: 1px solid var(--bdr);
  background: var(--surface);
  box-shadow: var(--shadow);
  min-height: 520px;
}

.plan-card::after {
  content: none;
}

.plan-card:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow2);
  border-color: var(--bdr2);
}

.plan-active {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent),
    var(--shadow);
  border-color: color-mix(in srgb, var(--brand) 34%, var(--bdr));
}

.plan-popular {
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--warning) 20%, transparent),
    var(--shadow);
  border-color: color-mix(in srgb, var(--warning) 36%, var(--bdr));
}

.popular-tag,
.current-tag {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.52rem 0.9rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  z-index: 2;
}

.popular-tag {
  background: linear-gradient(135deg, var(--warning), var(--warning-1));
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--warning) 24%, transparent);
}

.current-tag {
  background: linear-gradient(135deg, var(--success), var(--success-1));
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--success) 22%, transparent);
}

.tag-icon {
  width: 14px;
  height: 14px;
}

.plan-header {
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 1;
}

.plan-name {
  font-size: 1.7rem;
  font-weight: 1000;
  color: var(--txt);
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.plan-desc {
  font-size: 0.95rem;
  color: var(--txt2);
  line-height: 1.6;
}

.plan-price-wrapper {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-bottom: 1.6rem;
  position: relative;
  z-index: 1;
}

.plan-currency {
  font-size: 1.7rem;
  font-weight: 950;
  color: var(--txt2);
}

.plan-price {
  font-size: clamp(2.6rem, 5vw, 4rem);
  font-weight: 1100;
  background: linear-gradient(135deg, var(--brand), var(--info));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.plan-period {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  color: var(--txt2);
  font-size: 1rem;
}

.period-sep {
  font-weight: 500;
  opacity: 0.95;
}

.period-text {
  font-weight: 900;
}

/* Discount badge and price styles */
.discount-badge {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.38rem 0.7rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  z-index: 2;
  background: linear-gradient(135deg, var(--warning), var(--warning-1));
  color: var(--txt-inverse);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--warning) 24%, transparent);
}

.plan-original-price {
  font-size: 1rem;
  color: var(--txt2);
  text-decoration: line-through;
  margin-right: 0.6rem;
  font-weight: 700;
}

.card-original-price {
  font-size: 0.9rem;
  color: var(--txt2);
  text-decoration: line-through;
  margin-top: 0.25rem;
}

.card-price-discount {
  font-size: 1.55rem;
  font-weight: 1000;
  color: var(--txt);
  margin-right: 0.6rem;
}

.plan-pricing {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.plan-features {
  list-style: none;
  margin-bottom: 1.6rem;
  flex-grow: 1;
  position: relative;
  z-index: 1;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  color: var(--txt2);
  font-size: 0.95rem;
  line-height: 1.55;
}

.feature-text {
  color: var(--txt2);
}

.feature-icon {
  width: 20px;
  height: 20px;
  color: var(--success);
  stroke-width: 2.7;
  flex-shrink: 0;
  margin-top: 0.15rem;
}

.plan-cta {
  width: 100%;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  font-size: 1rem;
  font-weight: 1000;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    opacity var(--t-base),
    border-color var(--t-base),
    background var(--t-base),
    color var(--t-base);
  background: var(--btn-primary-bg);
  color: var(--txt-inverse);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--btn-primary-bg) 20%, transparent);
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.plan-cta:hover:not(:disabled) {
  transform: translateY(-2px);
  background: var(--btn-primary-hover);
  box-shadow: 0 22px 46px color-mix(in srgb, var(--btn-primary-bg) 26%, transparent);
}

.cta-disabled {
  background: var(--btn-secondary-bg);
  color: var(--txt3);
  cursor: not-allowed;
  box-shadow: none;
  border-color: var(--bdr);
}

.cta-arrow {
  width: 18px;
  height: 18px;
  stroke-width: 2.7;
  transition: transform var(--t-base);
}

.plan-cta:hover .cta-arrow {
  transform: translateX(4px);
}

.history-section {
  margin-bottom: 4rem;
}

.timeline {
  max-width: 820px;
  margin: 0 auto;
}

.timeline-item {
  display: flex;
  gap: 1.25rem;
  margin-bottom: 1.6rem;
  position: relative;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.marker-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand), var(--info));
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--brand) 16%, transparent);
  position: relative;
  z-index: 2;
}

.marker-line {
  width: 2px;
  flex: 1;
  background: linear-gradient(180deg, var(--bdr2), transparent);
  margin-top: 0.55rem;
}

.timeline-content {
  flex: 1;
  border-radius: var(--r-lg);
  padding: 1.4rem;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    background var(--t-base),
    border-color var(--t-base);
  border: 1px solid var(--bdr);
  background: var(--surface);
}

.timeline-content:hover {
  background: var(--surface-hover);
  transform: translateX(4px);
  box-shadow: var(--shadow);
  border-color: var(--bdr2);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.65rem;
  gap: 1rem;
}

.timeline-event {
  font-size: 1.05rem;
  font-weight: 1000;
  color: var(--txt);
  text-transform: capitalize;
}

.timeline-date {
  font-size: 0.85rem;
  color: var(--txt3);
  white-space: nowrap;
}

.timeline-note {
  font-size: 0.95rem;
  color: var(--txt2);
  line-height: 1.6;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--modal-backdrop);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-wrapper {
  width: 100%;
  max-width: 520px;
  animation: modalPop 0.26s cubic-bezier(0.2, 0.9, 0.2, 1);
}

.modal-large {
  max-width: 760px;
}

@keyframes modalPop {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-content {
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--shadow2);
  border: 1px solid var(--modal-border);
  background: var(--modal-bg);
}

.modal-header {
  padding: 1.6rem;
  border-bottom: 1px solid var(--bdr);
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.modal-icon {
  width: 50px;
  height: 50px;
  border-radius: var(--r-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--bdr);
}

.modal-icon svg {
  width: 26px;
  height: 26px;
  stroke-width: 2.6;
  color: var(--txt-inverse);
}

.modal-icon-warning {
  background: linear-gradient(135deg, var(--warning), var(--warning-1));
}

.modal-icon-info {
  background: linear-gradient(135deg, var(--brand), var(--info));
}

.modal-title {
  font-size: 1.35rem;
  font-weight: 1000;
  color: var(--txt);
  flex: 1;
}

.modal-close {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-hover);
  border: 1px solid var(--bdr);
  cursor: pointer;
  transition:
    transform var(--t-fast),
    background var(--t-fast),
    border-color var(--t-fast);
}

.modal-close:hover {
  background: var(--surface-active);
  border-color: var(--bdr2);
  transform: translateY(-1px);
}

.modal-close svg {
  width: 20px;
  height: 20px;
  stroke-width: 2.6;
  color: var(--txt2);
}

.modal-body {
  padding: 1.6rem;
}

.modal-text {
  font-size: 1rem;
  color: var(--txt2);
  line-height: 1.7;
  margin-bottom: 1.2rem;
}

.modal-text strong {
  color: var(--txt);
  font-weight: 950;
}

.plan-options {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 0.35rem;
  scrollbar-width: thin;
  scrollbar-color: var(--border-secondary) transparent;
}

.plan-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: var(--r-lg);
  cursor: pointer;
  transition:
    transform var(--t-base),
    background var(--t-base),
    border-color var(--t-base),
    box-shadow var(--t-base);
  border: 1px solid var(--bdr);
  background: var(--surface);
}

.plan-option:hover {
  background: var(--surface-hover);
  border-color: var(--bdr2);
  transform: translateY(-1px);
}

.option-selected {
  background: color-mix(in srgb,
      var(--color-primary-light) 60%,
      var(--surface));
  border-color: color-mix(in srgb, var(--brand) 28%, var(--bdr));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
}

.option-check {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--bdr2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--t-base);
  background: var(--surface);
}

.option-selected .option-check {
  background: linear-gradient(135deg, var(--brand), var(--info));
  border-color: color-mix(in srgb, var(--brand) 34%, var(--bdr));
}

.option-check svg {
  width: 14px;
  height: 14px;
  stroke-width: 3;
  color: var(--txt-inverse);
  opacity: 0;
  transition: opacity var(--t-fast);
}

.option-selected .option-check svg {
  opacity: 1;
}

.option-content {
  flex: 1;
  min-width: 0;
}

.option-name {
  font-size: 1.05rem;
  font-weight: 1000;
  color: var(--txt);
  margin-bottom: 0.22rem;
}

.option-desc {
  font-size: 0.9rem;
  color: var(--txt2);
}

.option-price {
  font-size: 1.05rem;
  font-weight: 1000;
  color: var(--txt);
  white-space: nowrap;
}

.option-period {
  font-size: 0.9rem;
  color: var(--txt3);
  font-weight: 900;
}

.payment-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--bdr);
}

.payment-title {
  font-size: 1.1rem;
  font-weight: 1000;
  color: var(--txt);
  margin-bottom: 1rem;
}

.payment-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.payment-option {
  padding: 1rem;
  border: 2px solid var(--bdr2);
  border-radius: var(--r-md);
  cursor: pointer;
  transition: all var(--t-base);
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.payment-option:hover {
  border-color: var(--brand);
  background: color-mix(in srgb, var(--brand) 4%, var(--bg));
}

.payment-warning {
  margin-top: 1rem;
  padding: 0.75rem;
  background: var(--warning-bg);
  border: 1px solid var(--warning-bdr);
  border-radius: var(--r-md);
  color: var(--warning-txt);
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1.25rem 1.6rem;
  border-top: 1px solid var(--bdr);
  display: flex;
  justify-content: flex-end;
  gap: 0.85rem;
}

.modal-btn {
  padding: 0.8rem 1.25rem;
  border-radius: 14px;
  font-size: 0.95rem;
  font-weight: 1000;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    transform var(--t-base),
    box-shadow var(--t-base),
    opacity var(--t-base),
    background var(--t-base),
    border-color var(--t-base);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border-color: var(--bdr);
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover);
  transform: translateY(-1px);
  border-color: var(--bdr2);
}

.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--btn-primary-bg) 20%, transparent);
}

.btn-primary:hover {
  background: var(--btn-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 22px 46px color-mix(in srgb, var(--btn-primary-bg) 26%, transparent);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 16px 36px color-mix(in srgb, var(--btn-primary-bg) 16%, transparent);
}

.btn-danger {
  background: var(--danger);
  color: var(--txt-inverse);
  box-shadow: 0 16px 36px color-mix(in srgb, var(--danger) 18%, transparent);
}

.btn-danger:hover {
  background: var(--danger-1);
  transform: translateY(-2px);
  box-shadow: 0 22px 46px color-mix(in srgb, var(--danger) 22%, transparent);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--t-base);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.skeleton {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-md);
  background: var(--bg-secondary);
  border: 1px solid var(--bdr);
}

.skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-60%);
  background: linear-gradient(90deg,
      transparent,
      rgba(15, 23, 42, 0.1),
      transparent);
  background: linear-gradient(90deg,
      transparent,
      color-mix(in srgb, var(--text-primary) 14%, transparent),
      transparent);
  animation: shimmer 1.25s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-60%);
  }

  100% {
    transform: translateX(60%);
  }
}

.skeleton-lines {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.skeleton-line {
  height: 12px;
}

.skeleton-pill {
  height: 34px;
  border-radius: 999px;
}

.skeleton-icon {
  width: 54px;
  height: 54px;
  border-radius: 14px;
}

.skeleton-btn {
  width: 220px;
  height: 46px;
  border-radius: 14px;
}

.skeleton-price {
  width: 70%;
  height: 56px;
  border-radius: 14px;
}

.skeleton-card {
  align-items: center;
  gap: 1rem;
}

.skeleton-plan {
  min-height: 520px;
  cursor: default;
}

.skeleton-plan>* {
  position: relative;
  z-index: 1;
}

.w-120 {
  width: 120px;
}

.w-140 {
  width: 140px;
}

.w-160 {
  width: 160px;
}

.w-200 {
  width: 200px;
}

.w-220 {
  width: 220px;
}

.w-240 {
  width: 240px;
}

.w-260 {
  width: 260px;
}

@media (max-width: 1024px) {
  .plans-container {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

@media (max-width: 768px) {
  .subscription-page {
    padding: 2rem 0 3rem;
  }

  .subscription-container {
    padding: 0 1rem;
  }

  .current-subscription {
    padding: 1.5rem;
  }

  .status-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .subscription-grid {
    grid-template-columns: 1fr;
  }

  .action-bar {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
  }

  .plans-container {
    grid-template-columns: 1fr;
  }

  .plan-card {
    min-height: auto;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1.3rem;
  }

  .modal-footer {
    flex-direction: column;
  }

  .modal-btn {
    width: 100%;
  }

  .skeleton-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton::after {
    animation: none !important;
  }

  * {
    scroll-behavior: auto !important;
  }
}
</style>
