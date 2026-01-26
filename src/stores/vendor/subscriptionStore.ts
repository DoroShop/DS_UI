/**
 * Subscription Store
 * Manages subscription state for vendors
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { getAuthHeaders } from "../../types/shared";
import { useAuthStore } from "../authStores";
import { Toast } from "../../components/composable/Toast.js";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

export interface Plan {
  _id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "monthly" | "quarterly";
  features: string[];
  limits: {
    products: number;
    storage: number;
    analytics: boolean;
  };
  // Optional discount fields returned from the API
  discountPercent?: number;
  discountExpiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  _id: string;
  sellerId: string;
  planId: Plan;
  status: "active" | "expired" | "canceled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  expiredAt?: string;
  history: Array<{
    event: string;
    fromPlanId?: string;
    toPlanId?: string;
    note: string;
    at?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const useSubscriptionStore = defineStore("subscription", () => {
  // State
  const subscription = ref<Subscription | null>(null);
  const plans = ref<Plan[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isSubscribed = computed(() => subscription.value?.status === "active");
  const currentPlan = computed(() => subscription.value?.planId);
  const daysUntilExpiry = computed(() => {
    if (!subscription.value?.currentPeriodEnd) return null;
    const end = new Date(subscription.value.currentPeriodEnd);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  });

  // Actions
  const fetchSubscription = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await axios.get(`${API_URL}/sellers/subscription`, {
        headers: getAuthHeaders(),
      });
      subscription.value = response.data.subscription;
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to fetch subscription";
      console.error("Fetch subscription error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const changePlan = async (
    planCode: string,
    paymentMethod: "wallet" | "qrph" = "wallet",
    paymentIntentId?: string,
  ) => {
    isLoading.value = true;
    error.value = null;
    try {
      const payload: any = { planCode, paymentMethod };
      if (paymentIntentId) payload.paymentIntentId = paymentIntentId;

      const response = await axios.post(
        `${API_URL}/sellers/subscription/start-or-change`,
        payload,
        {
          headers: getAuthHeaders(),
        },
      );
      subscription.value = response.data.subscription;
      Toast("Plan changed successfully!", "success", 3000);
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to change plan";
      Toast(error.value, "error", 3000);
      console.error("Change plan error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  // Create a subscription QRPH payment (frontend will show QR and poll)
  const isDiscountActive = (plan) => {
    const pct = Number(plan?.discountPercent || 0);
    if (pct <= 0) return false;

    const exp = plan?.discountExpiresAt;
    if (!exp) return true; // no expiry means always valid

    return new Date(exp).getTime() > Date.now();
  };

  const createSubscriptionPayment = async (planCode: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const plan = plans.value.find((p) => p.code === planCode);
      if (!plan) throw new Error("Plan not found");

      const discountAmount = Number((1 - (plan.discountPercent || 0) / 100).toFixed(2));


      const disCountedPrice = () => {
        return Math.ceil(((plan.price) * discountAmount)) >= 1 ? Math.ceil(((plan.price) * discountAmount)) : 1;
      }
      
      const amountCentavos = Math.round((isDiscountActive(plan) ? disCountedPrice() : plan.price) * 100);
      console.log(
        "Creating subscription payment for plan",
        planCode,
        "amountCentavos",
        plan,
      );
      const response = await axios.post(
        `${API_URL}/payments/subscription`,
        {
          amount: amountCentavos,
          paymentMethod: "qrph",
          subscription: { planCode },
        },
        { headers: getAuthHeaders() },
      );

      return response.data.payment;
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message ||
        "Failed to create subscription payment";
      Toast(error.value, "error", 3000);
      console.error("Create subscription payment error:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const confirmSubscriptionWithPayment = async (
    planCode: string,
    paymentIntentId: string,
  ) => {
    isLoading.value = true;
    error.value = null;
    try {
      // Add an idempotency key header to protect from double-execution
      const idempotencyKey = `sub.confirm.${paymentIntentId}`;
      const headers = {
        ...getAuthHeaders(),
        "Idempotency-Key": idempotencyKey,
      };
      const response = await axios.post(
        `${API_URL}/sellers/subscription/start-or-change`,
        {
          planCode,
          paymentMethod: "qrph",
          paymentIntentId,
        },
        { headers },
      );

      subscription.value = response.data.subscription;
      Toast("Subscription activated successfully!", "success", 3000);
      return subscription.value;
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to confirm subscription";
      Toast(error.value, "error", 3000);
      console.error("Confirm subscription with payment error:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const renewSubscription = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await axios.post(
        `${API_URL}/sellers/subscription/renew`,
        {},
        {
          headers: getAuthHeaders(),
        },
      );
      subscription.value = response.data.subscription;
      Toast("Subscription renewed successfully!", "success", 3000);
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to renew subscription";
      Toast(error.value, "error", 3000);
      console.error("Renew subscription error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const cancelSubscription = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await axios.post(
        `${API_URL}/sellers/subscription/cancel`,
        {},
        {
          headers: getAuthHeaders(),
        },
      );
      subscription.value = response.data.subscription;
      Toast("Subscription will be canceled at period end", "info", 3000);
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to cancel subscription";
      Toast(error.value, "error", 3000);
      console.error("Cancel subscription error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  const fetchPlans = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await axios.get(`${API_URL}/public/plans`);
      plans.value = response.data.data;
    } catch (err: any) {
      error.value =
        err.response?.data?.error?.message || "Failed to fetch plans";
      console.error("Fetch plans error:", err);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // State
    subscription,
    plans,
    isLoading,
    error,

    // Getters
    isSubscribed,
    currentPlan,
    daysUntilExpiry,

    // Actions
    fetchSubscription,
    changePlan,
    createSubscriptionPayment,
    confirmSubscriptionWithPayment,
    renewSubscription,
    cancelSubscription,
    fetchPlans,
  };
});
