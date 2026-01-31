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

  // Helper Functions - SINGLE SOURCE OF TRUTH for price calculations

  /**
   * Check if a plan's discount is currently active
   * @param plan - The subscription plan object
   * @returns true if discount is active, false otherwise
   */
  const isDiscountActive = (plan: Plan | null | undefined): boolean => {
    const discountPercent = Number(plan?.discountPercent || 0);
    
    if (!discountPercent) return false;
    
    if (plan?.discountExpiresAt) {
      const expiryTime = new Date(plan.discountExpiresAt).getTime();
      return Number.isFinite(expiryTime) && expiryTime > Date.now();
    }
    
    return true;
  };

  /**
   * Calculate the final price after discount
   * SINGLE SOURCE OF TRUTH for all price calculations
   * Uses Math.round for consistent rounding across the entire application
   * 
   * @param plan - The subscription plan object
   * @returns The final price in pesos (minimum 1 peso)
   */
  const calculateFinalPrice = (plan: Plan | null | undefined): number => {
    const basePrice = Number(plan?.price || 0);
    
    if (!isDiscountActive(plan)) {
      return basePrice;
    }
    
    const discountPercent = Number(plan.discountPercent || 0);
    const discountMultiplier = 1 - (discountPercent / 100);
    const discountedPrice = basePrice * discountMultiplier;
    
    // Use Math.round for consistent rounding everywhere
    const finalPrice = Math.round(discountedPrice);
    
    // Ensure minimum price of 1 peso
    return Math.max(finalPrice, 1);
  };

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

  /**
   * Create a subscription QRPH payment
   * Frontend will show QR code and poll for payment status
   * 
   * @param planCode - The plan code to create payment for
   * @returns Payment object with QR code URL and payment details
   */
  const createSubscriptionPayment = async (planCode: string) => {
    isLoading.value = true;
    error.value = null;

    try {
      const plan = plans.value.find((p) => p.code === planCode);
      if (!plan) throw new Error("Plan not found");

      // Use the centralized price calculation function
      const finalPricePesos = calculateFinalPrice(plan);
      
      // Convert to centavos for payment API (1 peso = 100 centavos)
      const amountCentavos = finalPricePesos * 100;

      console.log(
        "Creating subscription payment - Plan:",
        planCode,
        "| Final price:",
        finalPricePesos,
        "pesos |",
        "Amount:",
        amountCentavos,
        "centavos"
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

  /**
   * Confirm subscription after successful payment
   * Uses idempotency key to prevent double-execution
   * 
   * @param planCode - The plan code to activate
   * @param paymentIntentId - The payment intent ID from successful payment
   * @returns Updated subscription object
   */
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

    // Helper Functions (exposed for use in components)
    isDiscountActive,
    calculateFinalPrice,

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