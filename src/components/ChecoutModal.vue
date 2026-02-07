<script setup lang="ts">
import { reactive, computed, ref, watch, nextTick, onMounted } from "vue";
import { handleImageError } from "../utils/fallbackImage";
import { formatToPHCurrency } from "../utils/currencyFormat";
import { useCartStore } from "../stores/cartStores";
import { useUserStore } from "../stores/userStores";
import { useOrderStore } from "../stores/OrderStores";
import { useAuthStore } from "../stores/authStores";
import { Toast } from "../components/composable/Toast.js";
import { createQRPHPayment } from "../utils/paymentApi";
import QRCodePaymentModal from "./QRCodePaymentModal.vue";
import { useCheckoutAddressOverride } from "../composables/useCheckoutAddressOverride";
import { useShippingStore } from "../stores/shippingStore";

import {
  UserIcon,
  CubeIcon,
  TruckIcon,
  CreditCardIcon,
  BuildingStorefrontIcon,
  WalletIcon,
  QrCodeIcon,
  BanknotesIcon,
} from "@heroicons/vue/24/outline";

type Promotion = {
  isActive?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  freeShipping?: boolean;
};

type SelectedItem = {
  vendorId?: string;
  productId?: string;
  optionId?: string | null;
  itemId?: string | null;
  name?: string;
  label?: string;
  imgUrl?: string;
  price?: number | string;
  quantity?: number | string;
  promotion?: Promotion;
};

type Address = {
  street: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
};

const cartStore = useCartStore();
const userStore = useUserStore();
const orderStore = useOrderStore();
const shippingStore = useShippingStore();
const authStore = useAuthStore();

const props = defineProps({
  show: Boolean,
  selectedItems: {
    type: Array as () => SelectedItem[],
    default: () => [],
  },
});

const emit = defineEmits(["close", "confirm", "restore-modal"]);

const CHECKOUT_STATE_KEY = "checkoutModalState";
const PENDING_QR_PAYMENT_KEY = "pendingQRPayment";
const PENDING_CHECKOUT_ITEMS_KEY = "pendingCheckoutItems";

const isPromotionValid = (promotion?: Promotion | null) => {
  if (!promotion?.isActive) return false;

  const now = Date.now();
  const start = promotion.startDate ? new Date(promotion.startDate).getTime() : null;
  const end = promotion.endDate ? new Date(promotion.endDate).getTime() : null;

  if (start !== null && start > now) return false;
  if (end !== null && end < now) return false;
  return true;
};

const hasValidFreeShipping = (promotion?: Promotion | null) =>
  isPromotionValid(promotion) && promotion?.freeShipping === true;

const address = reactive<Address>({
  street: "",
  barangay: "",
  city: "",
  province: "",
  zipCode: "",
});

const focused = reactive<Record<string, boolean>>({
  name: false,
  phone: false,
  street: false,
  barangay: false,
  city: false,
  province: false,
  zipCode: false,
});

const customerName = ref("");
const phoneNumber = ref("");
const dataLoaded = ref(false);
const initInFlight = ref<Promise<void> | null>(null);

const selectedPaymentMethod = ref("cod");
const selectedDelivery = ref("pickup");
const customerAgreement = ref("");
const isEditing = ref(false);
const isSubmitting = ref(false);

// Checkout address override helper (personalized shipping info persistence)
const { get: getShippingInfo, set: setShippingInfo, getAddress: getCheckoutAddressOverride, setAddress: setCheckoutAddressOverride, clear: clearCheckoutAddressOverride } = useCheckoutAddressOverride();

const shippingFee = ref<number | null>(0);

const subtotal = computed(() => {
  // Use selectedItems from props for Buy Now, fallback to cart for normal checkout
  if (props.selectedItems && props.selectedItems.length > 0) {
    return calculateItemsSubtotal(props.selectedItems);
  }
  return Number(cartStore.itemsSubtotal || 0);
});
const normalizedShippingFee = computed(() => (typeof shippingFee.value === "number" ? shippingFee.value : 0));
const totalAmount = computed(() => subtotal.value + normalizedShippingFee.value);

const hasFreeShipping = computed(() => (props.selectedItems || []).some((i) => hasValidFreeShipping(i.promotion)));

const isAddressValid = computed(
  () => Boolean(address.street && address.barangay && address.city && address.province && address.zipCode)
);

const hasAddress = computed(() => Object.values(address).some((v) => Boolean(String(v).trim())));

const isValidPHPhone = (value: string) => /^(09\d{9}|\+639\d{9})$/.test(value);

const phoneError = computed(() => {
  const val = (phoneNumber.value || "").trim();
  if (!val) return ""; // Don't show error for empty phone - just block submission
  return isValidPHPhone(val) ? "" : "Invalid PH phone number format (09XXXXXXXXX).";
});

const walletBalance = computed(() => {
  return authStore.user?.wallet || 0;
});

const canConfirm = computed(() => {
  const hasName = Boolean((customerName.value || "").trim());
  const hasValidAddress = isAddressValid.value; 
  const hasPayment = Boolean(selectedPaymentMethod.value);
  const hasDelivery = Boolean(selectedDelivery.value);
  const hasValidPhone = Boolean((phoneNumber.value || "").trim()) && !phoneError.value;
  const notSubmitting = !isSubmitting.value;
  
  // Check wallet balance if using wallet payment
  const hasSufficientWallet = selectedPaymentMethod.value !== 'wallet' || 
    (walletBalance.value >= totalAmount.value);

  // Debug logging to help identify issues
  const result = hasName && hasValidAddress && hasPayment && hasDelivery && hasValidPhone && hasSufficientWallet && notSubmitting;
  console.log('🔍 Button Status:', {
    hasName,
    hasValidAddress,
    hasPayment,
    hasDelivery, 
    hasValidPhone,
    hasSufficientWallet,
    walletBalance: walletBalance.value,
    totalAmount: totalAmount.value,
    paymentMethod: selectedPaymentMethod.value,
    phoneValue: phoneNumber.value,
    phoneError: phoneError.value,
    notSubmitting,
    result
  });

  return result;
});

const getUserData = () => {
  const raw = localStorage.getItem("userInfo");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setAddress = (a: Partial<Address> | undefined) => {
  const src = a || {};
  Object.assign(address, {
    street: src.street || "",
    barangay: src.barangay || "",
    city: src.city || "",
    province: src.province || "",
    zipCode: src.zipCode || "",
  });
};

const initializeUserData = async () => {
  if (dataLoaded.value) return;
  if (initInFlight.value) return initInFlight.value;

  initInFlight.value = (async () => {
    if (!userStore.isFetched) {
      try {
        await userStore.fetchUser();
      } catch (err) {
        console.warn("Failed to fetch user data from server:", err);
      }
    }

    // Load personalized shipping info from localStorage if available
    const savedShippingInfo = getShippingInfo();
    console.log('🏠 Loading saved shipping info:', savedShippingInfo);
    
    if (savedShippingInfo) {
      customerName.value = savedShippingInfo.name || "";
      phoneNumber.value = savedShippingInfo.phone || "";
      setAddress(savedShippingInfo.address);
    } else {
      // Start with empty fields for first-time users
      customerName.value = "";
      phoneNumber.value = "";
      setAddress({});
    }

    dataLoaded.value = true;
  })();

  try {
    await initInFlight.value;
  } finally {
    initInFlight.value = null;
  }
};

watch(
  () => props.show,
  async (open) => {
    if (open) await initializeUserData();
  },
  { immediate: true }
);

// Watch for delivery method changes and calculate shipping
watch([selectedDelivery, hasFreeShipping, () => address.city, () => address.province], async ([delivery, freeShipping, city, province]) => {
  if (freeShipping) {
    shippingFee.value = 0;
    shippingStore.clearQuote();
    return;
  }
  
  if (delivery === "pickup") {
    shippingFee.value = 0;
    shippingStore.clearQuote();
  } else if (delivery === "agreement") {
    shippingFee.value = null;
    shippingStore.clearQuote();
  } else if (delivery === "jnt") {
    // Only calculate J&T shipping if we have address filled in
    if (city && province) {
      await calculateJNTShipping();
    } else {
      // No address yet — clear any stale quote but don't assume a fee
      shippingFee.value = null;
      shippingStore.clearQuote();
    }
  } else {
    shippingFee.value = 0;
    shippingStore.clearQuote();
  }
});

// Function to calculate J&T shipping quote
const calculateJNTShipping = async () => {
  try {
    const items = props.selectedItems && props.selectedItems.length > 0 
      ? props.selectedItems 
      : cartStore.selectedItemData;

    if (!items || items.length === 0) {
      shippingFee.value = null;
      shippingStore.clearQuote();
      return;
    }

    const response = await shippingStore.quoteJnt(
      { province: address.province, city: address.city },
      items.map(item => ({
        productId: item.productId || '',
        quantity: Number(item.quantity) || 1
      }))
    );
    
    if (response?.success && shippingStore.hasValidQuote) {
      shippingFee.value = shippingStore.totalShippingFee;
    } else {
      // Quote failed — surface the error and block checkout (no ₱60 fallback)
      shippingFee.value = null;
      if (response?.issue) {
        console.warn('Shipping quote issue:', response.issue, response.error);
        Toast(shippingStore.getErrorMessage(response.issue), 'warning', 'var(--secondary-color)', 3000);
      }
    }
  } catch (error) {
    console.error('Failed to calculate shipping:', error);
    shippingFee.value = null;
    shippingStore.clearQuote();
  }
};

const saveCheckoutStateNow = () => {
  const state = {
    isOpen: true,
    selectedDelivery: selectedDelivery.value,
    selectedPaymentMethod: selectedPaymentMethod.value,
    customerAgreement: customerAgreement.value,
    timestamp: Date.now(),
  };
  localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state));
};

let saveTimer: number | null = null;
const saveCheckoutState = () => {
  if (!props.show) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveCheckoutStateNow();
    saveTimer = null;
  }, 300);
};

const clearCheckoutState = () => localStorage.removeItem(CHECKOUT_STATE_KEY);

watch([selectedDelivery, selectedPaymentMethod, customerAgreement], saveCheckoutState);
watch(() => props.show, (open) => open && saveCheckoutState());

const showQRModal = ref(false);
const qrPaymentData = ref({
  paymentId: "",
  qrCodeUrl: "",
  amount: 0,
  expiresAt: "",
});

const getShippingOptionLabel = (delivery: string) => {
  if (delivery === "pickup") return "Pick Up";
  if (delivery === "agreement") return "Customer Agreement";
  return delivery;
};

const mapSelectedItems = (items: SelectedItem[]) =>
  (items || []).map((item) => ({
    vendorId: item.vendorId,
    productId: item.productId,
    optionId: item.optionId || null,
    itemId: item.itemId || null,
    name: item.name || "",
    label: item.label || "",
    imgUrl: item.imgUrl || "",
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 1),
  }));

const buildCheckoutData = () => ({
  items: mapSelectedItems(props.selectedItems),
  shippingAddress: { ...address },
  customerName: customerName.value,
  phone: phoneNumber.value,
  shippingOption: getShippingOptionLabel(selectedDelivery.value),
  shippingFee: normalizedShippingFee.value,
  agreementDetails: selectedDelivery.value === "agreement" ? customerAgreement.value : "",
});

const buildPaymentDetails = () => {
  const itemCount = (props.selectedItems || []).length;
  return {
    description: `Order from ${customerName.value} - ${itemCount} item(s)`,
    metadata: {
      customerName: customerName.value,
      phone: phoneNumber.value,
      itemCount,
      shippingOption: selectedDelivery.value,
    },
  };
};

const requestQrphPayment = async (description: string, metadata: any, checkoutData: any) =>
  createQRPHPayment(totalAmount.value, description, metadata, checkoutData);

const isPaymentSuccess = (response: any) => Boolean(response && response.success);

const getQrCodeUrl = (response: any) => response?.payment?.qrCodeUrl || "";

const setQrPaymentData = (response: any, qrCodeUrl: string) => {
  qrPaymentData.value = {
    paymentId: response.payment._id,
    qrCodeUrl,
    amount: totalAmount.value,
    expiresAt: response.payment.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
};

const persistPendingPayment = () => {
  localStorage.setItem(PENDING_QR_PAYMENT_KEY, JSON.stringify(qrPaymentData.value));
  localStorage.setItem(PENDING_CHECKOUT_ITEMS_KEY, JSON.stringify(props.selectedItems));
};

const openQrModalAndCloseCheckout = async () => {
  showQRModal.value = true;
  await nextTick();
  emit("close");
};

async function initiateQRPHPayment() {
  if (!canConfirm.value) return;

  isSubmitting.value = true;

  try {
    const checkoutData = buildCheckoutData();
    const { description, metadata } = buildPaymentDetails();
    const response = await requestQrphPayment(description, metadata, checkoutData);

    if (!isPaymentSuccess(response)) {
      Toast(response?.error || "Failed to create QRPH payment. Please try another payment method.", "error", 4000);
      return;
    }

    const qrCodeUrl = getQrCodeUrl(response);
    if (!qrCodeUrl) {
      Toast("Payment created but QR code is missing. Please contact support.", "error", 4000);
      return;
    }

    setQrPaymentData(response, qrCodeUrl);
    persistPendingPayment();
    await openQrModalAndCloseCheckout();
  } catch (error) {
    console.error("QRPH payment error:", error);
    Toast("Failed to initiate QRPH payment. Please try again.", "error", 3000);
  } finally {
    isSubmitting.value = false;
  }
}

const clearPendingPayment = () => {
  localStorage.removeItem(PENDING_QR_PAYMENT_KEY);
  localStorage.removeItem(PENDING_CHECKOUT_ITEMS_KEY);
  localStorage.removeItem("pendingCheckoutData");
};

async function handleQRPaymentSuccess() {
  showQRModal.value = false;
  clearPendingPayment();

  try {
    cartStore.isFetched = false;
    await cartStore.fetchCart();
  } catch (err) {
    console.error("Failed to sync cart after payment:", err);
  }

  Toast("Payment successful! Your order has been placed. Check your Orders page for details!", "success", 4000);
  emit("close");
}

function handleQRPaymentFailed() {
  showQRModal.value = false;
  clearPendingPayment();
  Toast("Payment failed. Please try again or select a different payment method.", "error", 4000);
}

function handleQRPaymentExpired() {
  showQRModal.value = false;
  clearPendingPayment();
  Toast("Payment expired. Please try again.", "error", 3000);
}

function handleQRPaymentCancelled() {
  showQRModal.value = false;
  clearPendingPayment();
}

const isQrphSelected = () => selectedPaymentMethod.value === "qrph";

const groupSelectedItemsByVendor = (items: SelectedItem[]) =>
  (items || []).reduce<Record<string, SelectedItem[]>>((acc, item) => {
    const vendorId = item?.vendorId;
    if (!vendorId) return acc;
    (acc[vendorId] ||= []).push(item);
    return acc;
  }, {});

const generateTrackingNumber = () => {
  const timestamp = Date.now();
  const randomHex = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase();
  return `DSTRK${timestamp}${randomHex}`;
};

const calculateItemsSubtotal = (items: SelectedItem[]) =>
  items.reduce((total, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.quantity || 1);
    return total + price * qty;
  }, 0);

const getShippingFeeForOrder = () => (typeof shippingFee.value === "number" ? shippingFee.value : 0);

const buildOrderData = (vendorId: string, items: SelectedItem[]) => {
  const isJnt = selectedDelivery.value === "jnt";
  // For J&T the backend recomputes the fee server-side; pass 0 so we don't
  // risk sending a stale or mismatched amount.
  const fee = isJnt ? 0 : getShippingFeeForOrder();
  const itemsSubtotal = calculateItemsSubtotal(items);
  const subTotal = itemsSubtotal + fee;

  return {
    shippingFee: fee,
    shippingAddress: { ...address },
    paymentMethod: selectedPaymentMethod.value,
    shippingOption: isJnt ? "J&T" : getShippingOptionLabel(selectedDelivery.value),
    agreementDetails: selectedDelivery.value === "agreement" ? customerAgreement.value : "",
    phone: phoneNumber.value,
    name: customerName.value,
    items,
    vendorId,
    subTotal: subTotal.toFixed(2),
    trackingNumber: generateTrackingNumber(),
  };
};

const createVendorOrder = async (orderData: any) => {
  const response = await orderStore.createOrder(orderData);
  return Boolean(response && !response.error);
};

const removeVendorItemsFromCart = async (vendorId: string, items: SelectedItem[]) => {
  const deletePromises = items.map(async (item) => {
    try {
      const result = await cartStore.deleteItem(vendorId, item.itemId, item.productId, item.optionId);
      if (!result.success) {
        console.warn(`Failed to remove item ${item.itemId} from cart:`, result.message);
      }
      return result;
    } catch (err) {
      console.error(`Error removing item ${item.itemId} from cart:`, err);
      return { success: false, message: String(err) };
    }
  });

  await Promise.allSettled(deletePromises);
};

const finalizeCheckoutSuccess = () => {
  clearCheckoutState();
  // Clear transient override on successful checkout to avoid leaking address across sessions
  clearCheckoutAddressOverride();
  Toast("Order(s) placed successfully — check your Orders page for details!", "success", 4000);
  emit("close");
};

const finalizeCheckoutFailure = (error: unknown) => {
  console.error("submitOrder error", error);
  Toast("An unexpected error occurred while creating your order. Please try again.", "error", 4000);
};

const finalizeCheckoutAlways = async () => {
  isSubmitting.value = false;
  cartStore.isFetched = false;
  await cartStore.fetchCart();
};

async function submitOrder() {
  if (!canConfirm.value) return;

  // Hard guard: J&T must have a valid server-side quote before we proceed
  if (selectedDelivery.value === "jnt" && !shippingStore.hasValidQuote) {
    Toast(
      shippingStore.getErrorMessage(shippingStore.quoteError),
      "error",
      "var(--secondary-color)",
      3000
    );
    return;
  }

  if (isQrphSelected()) {
    await initiateQRPHPayment();
    return;
  }

  isSubmitting.value = true;

  // Always save personalized shipping info to localStorage
  const shippingInfo = {
    name: customerName.value,
    phone: phoneNumber.value,
    address: { ...address }
  };
  console.log('💾 Saving shipping info on order submit:', shippingInfo);
  setShippingInfo(shippingInfo);

  try {
    const itemsByVendor = groupSelectedItemsByVendor(props.selectedItems);

    for (const [vendorId, vendorItems] of Object.entries(itemsByVendor)) {
      const orderData = buildOrderData(vendorId, vendorItems);
      const created = await createVendorOrder(orderData);

      if (!created) {
        Toast("Failed to place order for one of the vendors. Please try again or contact support.", "error", 4000);
        continue;
      }

      removeVendorItemsFromCart(vendorId, vendorItems);
    }

    finalizeCheckoutSuccess();
  } catch (error) {
    finalizeCheckoutFailure(error);
  } finally {
    await finalizeCheckoutAlways();
  }
}

const saveCustomerInfo = async () => {
  if (isEditing.value) {
    try {
      // Save complete personalized shipping info to localStorage
      const shippingInfo = {
        name: customerName.value,
        phone: phoneNumber.value,
        address: { ...address }
      };
      console.log('💾 Saving personalized shipping info:', shippingInfo);
      setShippingInfo(shippingInfo);
      Toast("Shipping information saved successfully!", "success", 3000);
    } catch (err) {
      console.error("Failed to save shipping info", err);
      Toast("Failed to save shipping information", "error", 3000);
    }
  }
  isEditing.value = !isEditing.value;
};

const handleClose = () => {
  // Save personalized shipping info if valid
  if (isAddressValid.value && customerName.value.trim() && phoneNumber.value.trim()) {
    const shippingInfo = {
      name: customerName.value,
      phone: phoneNumber.value,
      address: { ...address }
    };
    console.log('💾 Saving shipping info on close:', shippingInfo);
    setShippingInfo(shippingInfo);
  }

  clearCheckoutState();
  emit("close");
};

const restoreCheckoutState = () => {
  const savedState = localStorage.getItem(CHECKOUT_STATE_KEY);
  if (!savedState) return;

  try {
    const state = JSON.parse(savedState);
    if (state.isOpen && Date.now() - state.timestamp < 30 * 60 * 1000) {
      if (state.selectedDelivery) selectedDelivery.value = state.selectedDelivery;
      if (state.selectedPaymentMethod) selectedPaymentMethod.value = state.selectedPaymentMethod;
      if (state.customerAgreement) customerAgreement.value = state.customerAgreement;
      emit("restore-modal");
    } else {
      clearCheckoutState();
    }
  } catch (e) {
    console.error("Failed to restore checkout state:", e);
    clearCheckoutState();
  }
};

const restorePendingPayment = () => {
  const pendingPayment = localStorage.getItem(PENDING_QR_PAYMENT_KEY);
  if (!pendingPayment) return;

  try {
    const paymentData = JSON.parse(pendingPayment);
    const expiryTime = new Date(paymentData.expiresAt).getTime();
    if (Date.now() < expiryTime + 600000) {
      qrPaymentData.value = paymentData;
      showQRModal.value = true;
    } else {
      clearPendingPayment();
    }
  } catch (e) {
    console.error("Failed to recover pending payment:", e);
    clearPendingPayment();
  }
};

onMounted(async () => {
  await initializeUserData();
  restoreCheckoutState();
  restorePendingPayment();
});
</script>

<template>
  <transition name="fade">
    <div v-if="show" class="modal-overlay">
      <div class="modal-container">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">Checkout</h2>
          <button class="close-btn" @click="handleClose" aria-label="Close">✕</button>
        </div>

        <div class="modal-body">
          <!-- 1. Shipping Address -->
          <section class="card">
            <div class="card-header">
              <h3 class="section-title">
                <UserIcon class="section-icon" />
                Delivery Details
              </h3>
              <button v-if="isAddressValid" @click="saveCustomerInfo" class="edit-btn" :disabled="isSubmitting">
                {{ isEditing ? "Save" : "Edit" }}
              </button>
            </div>

            <div v-if="isEditing || !isAddressValid" class="form-grid">
              <div class="input-group full-width">
                <input v-model="customerName" id="name" type="text"
                  @focus="focused.name = true" @blur="focused.name = !!customerName" placeholder=" " />
                <label for="name" :class="{ floated: focused.name || customerName }">Full Name</label>
              </div>

              <div class="input-group full-width">
                <input v-model="phoneNumber" id="phone" type="tel"
                  @focus="focused.phone = true" @blur="focused.phone = !!phoneNumber" placeholder=" " />
                <label for="phone" :class="{ floated: focused.phone || phoneNumber }">Contact Number</label>
                <p v-if="phoneError && phoneNumber" class="field-error">{{ phoneError }}</p>
              </div>

              <div class="input-group" v-for="(value, key) in address" :key="key">
                <input v-model="address[key as keyof typeof address]" :id="key" type="text"
                  @focus="focused[key] = true" @blur="focused[key] = !!address[key as keyof typeof address]" placeholder=" " />
                <label :for="key" :class="{ floated: focused[key] || address[key as keyof typeof address] }">
                  {{ key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1') }}
                </label>
              </div>
            </div>

            <div v-else class="address-summary">
              <p class="addr-name">{{ customerName }}</p>
              <p class="addr-phone">{{ phoneNumber }}</p>
              <p class="addr-line">{{ address.street }}, {{ address.barangay }}, {{ address.city }}, {{ address.province }} {{ address.zipCode }}</p>
            </div>
          </section>

          <!-- 2. Items -->
          <section class="card">
            <h3 class="section-title">
              <CubeIcon class="section-icon" />
              Your Items
            </h3>
            <div class="items-list">
              <div v-for="(item, i) in props.selectedItems" :key="i" class="item-row">
                <img :src="item.imgUrl" alt="" @error="handleImageError" class="item-img" />
                <div class="item-info">
                  <p class="item-name">{{ item.name }}</p>
                  <p v-if="item.label" class="item-variant">{{ item.label }}</p>
                  <p class="item-qty">Qty: {{ item.quantity }}</p>
                </div>
                <p class="item-price">{{ formatToPHCurrency(Number(item.price) * Number(item.quantity)) }}</p>
              </div>
            </div>
          </section>

          <!-- 3. Delivery Option -->
          <section class="card">
            <h3 class="section-title">
              <TruckIcon class="section-icon" />
              Delivery Method
            </h3>
            <div class="option-group">
              <label class="option-tile" :class="{ active: selectedDelivery === 'pickup' }">
                <input type="radio" value="pickup" v-model="selectedDelivery" :disabled="isSubmitting" />
                <BuildingStorefrontIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">Pick Up</span>
                  <span class="opt-desc">Free — Collect from the seller</span>
                </div>
                <span class="opt-price free">Free</span>
              </label>

              <label class="option-tile" :class="{ active: selectedDelivery === 'jnt' }">
                <input type="radio" value="jnt" v-model="selectedDelivery" :disabled="isSubmitting" />
                <TruckIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">J&T Express</span>
                  <span v-if="shippingStore.isLoadingQuote" class="opt-desc loading">Calculating...</span>
                  <span v-else-if="selectedDelivery === 'jnt' && shippingStore.quoteError" class="opt-desc error-text">
                    {{ shippingStore.getErrorMessage(shippingStore.quoteError) }}
                  </span>
                  <span v-else class="opt-desc">Door-to-door delivery</span>
                </div>
                <span v-if="selectedDelivery === 'jnt' && shippingStore.hasValidQuote" class="opt-price">
                  {{ formatToPHCurrency(shippingStore.totalShippingFee) }}
                </span>
              </label>

              <label class="option-tile" :class="{ active: selectedDelivery === 'agreement' }">
                <input type="radio" value="agreement" v-model="selectedDelivery" :disabled="isSubmitting" />
                <UserIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">Seller Arrangement</span>
                  <span class="opt-desc">Discuss delivery with the seller</span>
                </div>
              </label>
            </div>

            <transition name="slide">
              <div v-if="selectedDelivery === 'agreement'" class="agreement-box">
                <textarea v-model="customerAgreement" placeholder="e.g., I prefer Lalamove, please message me for details..." class="agreement-input" />
              </div>
            </transition>

            <!-- J&T discount note (only if there's a discount) -->
            <div v-if="selectedDelivery === 'jnt' && shippingStore.hasValidQuote && shippingStore.totalShippingDiscount > 0" class="discount-note">
              <span class="discount-badge">Discount Applied</span>
              <span>You save {{ formatToPHCurrency(shippingStore.totalShippingDiscount) }} on shipping!</span>
            </div>
          </section>

          <!-- 4. Payment -->
          <section class="card">
            <h3 class="section-title">
              <CreditCardIcon class="section-icon" />
              Payment
            </h3>
            <div class="option-group">
              <label class="option-tile" :class="{ active: selectedPaymentMethod === 'cod' }">
                <input type="radio" value="cod" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <BanknotesIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">Cash on Delivery</span>
                  <span class="opt-desc">Pay when you receive</span>
                </div>
              </label>

              <label class="option-tile" :class="{ 
                active: selectedPaymentMethod === 'wallet', 
                'insufficient': selectedPaymentMethod === 'wallet' && walletBalance < totalAmount 
              }">
                <input type="radio" value="wallet" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <WalletIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">Wallet</span>
                  <span class="opt-desc">Balance: {{ formatToPHCurrency(walletBalance) }}</span>
                  <span v-if="selectedPaymentMethod === 'wallet' && walletBalance < totalAmount" class="opt-error">
                    Insufficient balance (need {{ formatToPHCurrency(totalAmount - walletBalance) }} more)
                  </span>
                </div>
              </label>

              <label class="option-tile" :class="{ active: selectedPaymentMethod === 'qrph' }">
                <input type="radio" value="qrph" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <QrCodeIcon class="opt-icon" />
                <div class="opt-text">
                  <span class="opt-label">QRPH</span>
                  <span class="opt-desc">Scan to pay via bank or e-wallet</span>
                </div>
              </label>
            </div>
          </section>

          <!-- 5. Order Total (sticky-feeling summary) -->
          <section class="card summary-card">
            <h3 class="section-title">Order Summary</h3>
            <div class="summary-rows">
              <div class="sum-row">
                <span>Subtotal ({{ props.selectedItems?.length || 0 }} {{ (props.selectedItems?.length || 0) === 1 ? 'item' : 'items' }})</span>
                <span>{{ formatToPHCurrency(subtotal) }}</span>
              </div>
              <div class="sum-row">
                <span>Shipping</span>
                <span v-if="hasFreeShipping" class="free-tag">FREE</span>
                <span v-else-if="shippingFee === null" class="tbd">To be determined</span>
                <span v-else>{{ formatToPHCurrency(shippingFee as number) }}</span>
              </div>
              <div v-if="shippingStore.totalShippingDiscount > 0 && selectedDelivery === 'jnt'" class="sum-row discount-row">
                <span>Shipping Discount</span>
                <span>-{{ formatToPHCurrency(shippingStore.totalShippingDiscount) }}</span>
              </div>
            </div>
            <div class="sum-total">
              <span>Total</span>
              <span class="total-amount">{{ formatToPHCurrency(totalAmount) }}</span>
            </div>
          </section>

          <div class="bottom-spacer"></div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <div class="button-actions">
            <button class="btn-cancel" @click="handleClose" :disabled="isSubmitting">Cancel</button>
            <button class="btn-place-order" :disabled="!canConfirm" @click="submitOrder">
              <span v-if="isSubmitting" class="btn-loading">
                <span class="spinner"></span> Processing...
              </span>
              <span v-else-if="selectedPaymentMethod === 'qrph'">Pay {{ formatToPHCurrency(totalAmount) }}</span>
              <span v-else>Place Order · {{ formatToPHCurrency(totalAmount) }}</span>
            </button>
          </div>
          
          <!-- Debug info for disabled button - appears under button actions -->
          <div v-if="!canConfirm && !isSubmitting" class="debug-info">
            <span class="debug-label">Missing:</span>
            <span v-if="!(customerName || '').trim()" class="debug-item">Name</span>
            <span v-if="!isAddressValid" class="debug-item">Complete Address</span>
            <span v-if="!(phoneNumber || '').trim()" class="debug-item">Phone</span>
            <span v-if="!selectedPaymentMethod" class="debug-item">Payment Method</span>
            <span v-if="selectedPaymentMethod === 'wallet' && walletBalance < totalAmount" class="debug-item">Insufficient Wallet Balance</span>
            <span v-if="!selectedDelivery" class="debug-item">Delivery Option</span>
          </div>
        </div>
      </div>
    </div>
  </transition>

  <QRCodePaymentModal
    :show="showQRModal"
    :payment-id="qrPaymentData.paymentId"
    :qr-code-url="qrPaymentData.qrCodeUrl"
    :amount="qrPaymentData.amount"
    :expires-at="qrPaymentData.expiresAt"
    @close="showQRModal = false"
    @success="handleQRPaymentSuccess"
    @failed="handleQRPaymentFailed"
    @expired="handleQRPaymentExpired"
    @cancelled="handleQRPaymentCancelled"
  />
</template>


<style scoped>
/* ─── Transitions ─────────────────────────────────────────────────────────── */
.fade-enter-active, .fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(12px); }
.slide-enter-active, .slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.slide-enter-to { max-height: 200px; }

/* ─── Overlay ─────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900000;
  backdrop-filter: blur(4px);
}

/* ─── Container ───────────────────────────────────────────────────────────── */
.modal-container {
  background: var(--bg-primary, #fff);
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ─── Header ──────────────────────────────────────────────────────────────── */
.modal-header {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: var(--surface, #fff);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  border-radius: 50%;
  transition: 0.2s;
}
.close-btn:hover { background: var(--hover-bg, #f3f4f6); }

/* ─── Body ────────────────────────────────────────────────────────────────── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.75rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ─── Cards ───────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface, #fff);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 1rem 1.125rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.card-header .section-title { margin-bottom: 0; }

.section-icon {
  width: 18px;
  height: 18px;
  color: var(--primary-color);
  flex-shrink: 0;
}

.edit-btn {
  font-size: 0.8125rem;
  font-weight: 600;
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  transition: 0.15s;
}
.edit-btn:hover { background: rgba(27, 171, 80, 0.08); }

/* ─── Form ────────────────────────────────────────────────────────────────── */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input-group {
  position: relative;
}

.input-group input {
  width: 100%;
  padding: 0.75rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface, #fff);
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.input-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(27, 171, 80, 0.1);
}

.input-group label {
  position: absolute;
  left: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.8125rem;
  background: var(--surface, #fff);
  padding: 0 0.25rem;
  color: var(--text-secondary);
  pointer-events: none;
  transition: 0.2s ease;
}
.input-group input:not(:placeholder-shown) + label,
.input-group input:focus + label,
.input-group label.floated {
  top: 0;
  transform: translateY(-50%) scale(0.85);
  color: var(--primary-color);
  font-weight: 600;
}

.field-error {
  font-size: 0.7rem;
  color: var(--error-color, #e11d48);
  margin-top: 0.25rem;
}

/* ─── Address Summary ─────────────────────────────────────────────────────── */
.address-summary {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.5;
}
.addr-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.125rem;
}
.addr-phone { margin-bottom: 0.125rem; }

/* ─── Items ───────────────────────────────────────────────────────────────── */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  max-height: 240px;
  overflow-y: auto;
}

.item-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.item-img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.8125rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-variant,
.item-qty {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.item-price {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--primary-color);
  flex-shrink: 0;
}

/* ─── Option Tiles (delivery + payment) ───────────────────────────────────── */
.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-tile {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s;
  background: var(--surface, #fff);
}
.option-tile:active { transform: scale(0.99); }
.option-tile.active {
  border-color: var(--primary-color);
  background: rgba(27, 171, 80, 0.04);
}

.option-tile input[type="radio"] {
  display: none;
}

.opt-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.option-tile.active .opt-icon { color: var(--primary-color); }

.opt-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.opt-label {
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.opt-desc {
  font-size: 0.7rem;
  color: var(--text-secondary);
  line-height: 1.3;
}
.opt-desc.loading { color: var(--secondary-color); }
.opt-desc.error-text { color: var(--error-color, #e11d48); }

.opt-error {
  font-size: 0.65rem;
  color: var(--error-color, #e11d48);
  font-weight: 500;
  margin-top: 0.125rem;
}

.option-tile.insufficient {
  border-color: var(--error-color, #e11d48);
  background: rgba(225, 29, 72, 0.04);
}

.option-tile.insufficient .opt-icon {
  color: var(--error-color, #e11d48);
}

.opt-price {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
}
.opt-price.free {
  color: var(--primary-color);
  font-size: 0.75rem;
  background: rgba(27, 171, 80, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: 20px;
}

/* ─── Agreement ───────────────────────────────────────────────────────────── */
.agreement-box {
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px solid var(--border-color);
}

.agreement-input {
  width: 100%;
  min-height: 70px;
  padding: 0.625rem 0.875rem;
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface, #fff);
  font-size: 0.8125rem;
  color: var(--text-primary);
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s;
}
.agreement-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* ─── Discount Note ───────────────────────────────────────────────────────── */
.discount-note {
  margin-top: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: rgba(27, 171, 80, 0.06);
  border-radius: 8px;
  font-size: 0.75rem;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.discount-badge {
  background: var(--primary-color);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

/* ─── Order Summary Card ──────────────────────────────────────────────────── */
.summary-card {
  background: var(--surface, #fff);
}

.summary-rows {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-bottom: 0.625rem;
  border-bottom: 1.5px solid var(--border-color);
  margin-bottom: 0.625rem;
}

.sum-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.discount-row span:last-child { color: var(--primary-color); font-weight: 600; }

.free-tag {
  color: var(--primary-color);
  font-weight: 700;
  font-size: 0.75rem;
  background: rgba(27, 171, 80, 0.1);
  padding: 0.1rem 0.5rem;
  border-radius: 20px;
}

.tbd {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.75rem;
}

.sum-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
}

.total-amount {
  color: var(--primary-color);
  font-size: 1.125rem;
}

/* ─── Bottom Spacer ───────────────────────────────────────────────────────── */
.bottom-spacer { height: 100px; flex-shrink: 0; }

/* ─── Footer ──────────────────────────────────────────────────────────────── */
.modal-footer {
  position: sticky;
  bottom: 0;
  padding: 0.75rem 1rem;
  background: var(--surface, #fff);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.button-actions {
  display: flex;
  gap: 0.625rem;
}

.btn-cancel {
  flex: 0 0 auto;
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  background: var(--surface, #fff);
  color: var(--text-secondary);
  cursor: pointer;
  transition: 0.15s;
}
.btn-cancel:active:not(:disabled) { transform: scale(0.97); }

.btn-place-order {
  flex: 1;
  padding: 0.75rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  color: #fff;
  background: var(--primary-color);
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
}
.btn-place-order:active:not(:disabled) { transform: scale(0.97); opacity: 0.9; }
.btn-place-order:disabled {
  background: #d1d5db;
  cursor: not-allowed;
  color: #9ca3af;
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
.btn-loading { display: flex; align-items: center; gap: 0.375rem; }
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Debug Info ──────────────────────────────────────────────────────────── */
.debug-info {
  font-size: 0.75rem;
  color: var(--error-color, #e11d48);
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(225, 29, 72, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(225, 29, 72, 0.2);
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.debug-label {
  font-weight: 600;
}

.debug-item {
  background: rgba(225, 29, 72, 0.1);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.7rem;
}

/* ─── Tablet / Desktop ────────────────────────────────────────────────────── */
@media (min-width: 640px) {
  .modal-container {
    max-width: 520px;
    height: auto;
    max-height: 92dvh;
    border-radius: 16px;
    border: 1px solid var(--border-color);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.12);
  }

  .modal-body { padding: 1rem 1.25rem 0; gap: 0.875rem; }
  .card { padding: 1.125rem 1.25rem; }
  .section-title { font-size: 1rem; }
  .item-img { width: 52px; height: 52px; }
  .modal-footer { padding: 1rem 1.25rem; }
  .bottom-spacer { display: none; }
}

@media (min-width: 1024px) {
  .modal-container { max-width: 560px; }
}
</style>
