<script setup lang="ts">
import { reactive, computed, ref, watch, nextTick, onMounted } from "vue";
import { handleImageError } from "../utils/fallbackImage";
import { formatToPHCurrency } from "../utils/currencyFormat";
import { useCartStore } from "../stores/cartStores";
import { useUserStore } from "../stores/userStores";
import { useOrderStore } from "../stores/OrderStores";
import { Alert } from "../components/composable/Alert.js";
import { createQRPHPayment } from "../utils/paymentApi";
import QRCodePaymentModal from "./QRCodePaymentModal.vue";
import { useCheckoutAddressOverride } from "../composables/useCheckoutAddressOverride";

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

// Whether edited address should be saved to user profile when saving
const saveToProfile = ref(false);

// Checkout address override helper (transient localStorage persistence)
const { get: getCheckoutAddressOverride, set: setCheckoutAddressOverride, clear: clearCheckoutAddressOverride } = useCheckoutAddressOverride();

const shippingFee = ref<number | null>(0);

const subtotal = computed(() => Number(cartStore.itemsSubtotal || 0));
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
  if (!val) return "Phone number is required.";
  return isValidPHPhone(val) ? "" : "Invalid PH phone number.";
});

const canConfirm = computed(
  () =>
    Boolean((customerName.value || "").trim()) &&
    isAddressValid.value &&
    Boolean(selectedPaymentMethod.value) &&
    Boolean(selectedDelivery.value) &&
    !phoneError.value &&
    !isSubmitting.value
);

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

    const user = userStore.user || getUserData();
    if (user) {
      customerName.value = user.name || "";
      phoneNumber.value = user.phone || "";
      setAddress(user.address);
    }

    // Prefer a transient checkout override if present
    const override = getCheckoutAddressOverride();
    if (override) {
      setAddress(override);
      // When using an override we default to not saving to profile
      saveToProfile.value = false;
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

watch([selectedDelivery, hasFreeShipping], ([delivery, freeShipping]) => {
  if (freeShipping) shippingFee.value = 0;
  else if (delivery === "jnt") shippingFee.value = 60;
  else if (delivery === "pickup") shippingFee.value = 0;
  else if (delivery === "agreement") shippingFee.value = null;
  else shippingFee.value = 0;
});

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
      Alert(response?.error || "Failed to create QRPH payment. Please try another payment method.");
      return;
    }

    const qrCodeUrl = getQrCodeUrl(response);
    if (!qrCodeUrl) {
      Alert("Payment created but QR code is missing. Please contact support.");
      return;
    }

    setQrPaymentData(response, qrCodeUrl);
    persistPendingPayment();
    await openQrModalAndCloseCheckout();
  } catch (error) {
    console.error("QRPH payment error:", error);
    Alert("Failed to initiate QRPH payment. Please try again.");
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

  Alert("Payment successful! Your order has been placed. Check your Orders page for details!");
  emit("close");
}

function handleQRPaymentFailed() {
  showQRModal.value = false;
  clearPendingPayment();
  Alert("Payment failed. Please try again or select a different payment method.");
}

function handleQRPaymentExpired() {
  showQRModal.value = false;
  clearPendingPayment();
  Alert("Payment expired. Please try again.");
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
  const fee = getShippingFeeForOrder();
  const itemsSubtotal = calculateItemsSubtotal(items);
  const subTotal = itemsSubtotal + fee;

  return {
    shippingFee: fee,
    shippingAddress: { ...address },
    paymentMethod: selectedPaymentMethod.value,
    shippingOption: selectedDelivery.value,
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
  Alert("Order(s) placed successfully — check your Orders page for details!");
  emit("close");
};

const finalizeCheckoutFailure = (error: unknown) => {
  console.error("submitOrder error", error);
  Alert("An unexpected error occurred while creating your order. Please try again.");
};

const finalizeCheckoutAlways = async () => {
  isSubmitting.value = false;
  cartStore.isFetched = false;
  await cartStore.fetchCart();
};

async function submitOrder() {
  if (!canConfirm.value) return;

  if (isQrphSelected()) {
    await initiateQRPHPayment();
    return;
  }

  isSubmitting.value = true;

  // Ensure the current address is persisted as a transient override unless the user chose to save to profile
  if (!saveToProfile.value) {
    setCheckoutAddressOverride({ ...address });
  } else {
    clearCheckoutAddressOverride();
  }

  try {
    const itemsByVendor = groupSelectedItemsByVendor(props.selectedItems);

    for (const [vendorId, vendorItems] of Object.entries(itemsByVendor)) {
      const orderData = buildOrderData(vendorId, vendorItems);
      const created = await createVendorOrder(orderData);

      if (!created) {
        Alert("Failed to place order for one of the vendors. Please try again or contact support.");
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
    const userInfo = { address, name: customerName.value, phone: phoneNumber.value };
    try {
      if (saveToProfile.value) {
        await userStore.updateUser(userInfo);
        // If the user saved to profile, remove any transient override
        clearCheckoutAddressOverride();
        Alert("Profile updated");
      } else {
        // Persist a transient checkout-only override (does not touch profile)
        setCheckoutAddressOverride({ ...address });
        Alert("Address saved for this checkout only");
      }
    } catch (err) {
      console.error("Failed to update user", err);
      Alert("Failed to save profile changes");
    }
  }
  isEditing.value = !isEditing.value;
};

const handleClose = () => {
  // Persist current address as a transient override if it looks valid and user didn't choose to save it to profile
  if (isAddressValid.value && !saveToProfile.value) {
    setCheckoutAddressOverride({ ...address });
  } else if (saveToProfile.value) {
    clearCheckoutAddressOverride();
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
        <div class="modal-header">
          <h2 class="modal-title">Checkout</h2>
        </div>

        <div class="modal-body">
          <section class="card">
            <div class="address-header">
              <h3 class="section-title">
                <UserIcon class="section-icon" />
                Customer Information
              </h3>
              <button v-if="hasAddress" @click="saveCustomerInfo" class="edit-btn" :disabled="isSubmitting">
                {{ isEditing ? "Save" : "Edit" }}
              </button>
            </div>

            <div v-if="isEditing || !hasAddress" class="address-form">
              <div class="input-group">
                <input
                  type="text"
                  v-model="customerName"
                  id="name"
                  @focus="focused.name = true"
                  @blur="focused.name = !!customerName"
                  placeholder=" "
                />
                <label :for="'name'" :class="{ floated: focused.name || customerName }">Full Name</label>
              </div>

              <div class="input-group">
                <input
                  type="text"
                  v-model="phoneNumber"
                  id="phone"
                  @focus="focused.phone = true"
                  @blur="focused.phone = !!phoneNumber"
                  placeholder=" "
                />
                <label :for="'phone'" :class="{ floated: focused.phone || phoneNumber }">Contact Number</label>
              </div>
              <p v-if="phoneError" class="error">{{ phoneError }}</p>

              <div class="input-group" v-for="(value, key) in address" :key="key">
                <input
                  v-model="address[key as keyof typeof address]"
                  :id="key"
                  type="text"
                  @focus="focused[key] = true"
                  @blur="focused[key] = !!address[key as keyof typeof address]"
                  placeholder=" "
                />
                <label :for="key" :class="{ floated: focused[key] || address[key as keyof typeof address] }">
                  {{ key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1") }}
                </label>
              </div>

              <div class="save-to-profile" v-if="isEditing">
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="saveToProfile" />
                  <span>Save this address to my profile</span>
                </label>
              </div>

              <p v-if="!isAddressValid" class="error">Please complete all address fields.</p>
            </div>

            <div v-else class="address-display">
              <p class="customer-name"><strong>{{ customerName }}</strong></p>
              <p class="customer-phone">{{ phoneNumber }}</p>
              <p class="customer-address">
                {{ address.street }}, {{ address.barangay }}, {{ address.city }}, {{ address.province }},
                {{ address.zipCode }}
              </p>
            </div>
          </section>

          <section class="card">
            <h3 class="section-title">
              <CubeIcon class="section-icon" />
              Order Summary
            </h3>
            <div class="items-list">
              <div v-for="(item, i) in props.selectedItems" :key="i" class="item">
                <img :src="item.imgUrl" alt="Product" @error="handleImageError" class="item-img" />
                <div class="item-details">
                  <p class="item-label">{{ item.name }}</p>
                  <p class="item-meta">{{ item.label }}</p>
                  <p class="item-meta">Qty: {{ item.quantity }}</p>
                </div>
                <p class="item-price">{{ formatToPHCurrency(Number(item.price) * Number(item.quantity)) }}</p>
              </div>
            </div>
            <hr class="divider" />
            <div class="totals">
              <div class="subtotal">
                <span>Subtotal:</span>
                <strong>{{ formatToPHCurrency(cartStore.itemsSubtotal) }}</strong>
              </div>
              <div class="subtotal">
                <span>Shipping:</span>
                <strong v-if="hasFreeShipping" class="free-shipping-label">
                  <TruckIcon class="free-ship-icon" /> FREE
                </strong>
                <strong v-else-if="shippingFee === null">TBD</strong>
                <strong v-else>{{ formatToPHCurrency(shippingFee as number) }}</strong>
              </div>
              <div class="subtotal total">
                <span>Total:</span>
                <strong>{{ formatToPHCurrency(totalAmount) }}</strong>
              </div>
            </div>
          </section>

          <section class="card">
            <h3 class="section-title">
              <TruckIcon class="section-icon" />
              Delivery Options
            </h3>
            <div class="radio-group">
              <label class="radio-tile" :class="{ selected: selectedDelivery === 'pickup' }">
                <input type="radio" value="pickup" v-model="selectedDelivery" :disabled="isSubmitting" />
                <div class="delivery-option">
                  <span class="option-label">
                    <BuildingStorefrontIcon class="option-icon" />
                    Pick Up
                  </span>
                  <small>Free - Pick up from seller</small>
                </div>
              </label>
              <label class="radio-tile" :class="{ selected: selectedDelivery === 'agreement' }">
                <input type="radio" value="agreement" v-model="selectedDelivery" :disabled="isSubmitting" />
                <div class="agreement-option">
                  <span class="option-label">
                    <UserIcon class="option-icon" />
                    Connect with Seller
                  </span>
                  <small>Discuss delivery with seller</small>
                </div>
              </label>
            </div>
            <transition name="fade">
              <div v-if="selectedDelivery === 'agreement'" class="agreement-details">
                <h4 class="agreement-title">Agreement Details</h4>
                <div class="input-group">
                  <textarea
                    v-model="customerAgreement"
                    id="customerAgreement"
                    placeholder="e.g., I prefer Lalamove, please message me for details..."
                    class="agreement-textarea"
                  ></textarea>
                </div>
              </div>
            </transition>
            <p v-if="!selectedDelivery" class="error">Please select a delivery option.</p>
          </section>

          <section class="card">
            <h3 class="section-title">
              <CreditCardIcon class="section-icon" />
              Payment Methods
            </h3>
            <div class="radio-group">
              <label class="radio-tile" :class="{ selected: selectedPaymentMethod === 'wallet' }">
                <input type="radio" value="wallet" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <div class="payment-option">
                  <span class="option-label">
                    <WalletIcon class="option-icon" />
                    Wallet
                  </span>
                </div>
              </label>

              <label class="radio-tile" :class="{ selected: selectedPaymentMethod === 'qrph' }">
                <input type="radio" value="qrph" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <div class="payment-option">
                  <span class="option-label">
                    <QrCodeIcon class="option-icon" />
                    QRPH
                  </span>
                  <small>Scan to pay via bank/e-wallet</small>
                </div>
              </label>

              <label class="radio-tile" :class="{ selected: selectedPaymentMethod === 'cod' }">
                <input type="radio" value="cod" v-model="selectedPaymentMethod" :disabled="isSubmitting" />
                <div class="payment-option">
                  <span class="option-label">
                    <BanknotesIcon class="option-icon" />
                    Cash on Delivery
                  </span>
                </div>
              </label>
            </div>
            <p v-if="!selectedPaymentMethod" class="error">Please select a payment method.</p>
          </section>

          <div class="bottom-spacer"></div>
        </div>

        <div class="modal-footer">
          <button class="btn cancel" @click="handleClose" :disabled="isSubmitting">Cancel</button>
          <button class="btn confirm" :disabled="!canConfirm" @click="submitOrder">
            <span v-if="isSubmitting">Processing...</span>
            <span v-else-if="selectedPaymentMethod === 'qrph'">Pay with QRPH</span>
            <span v-else>Place Order</span>
          </button>
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
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

/* Modal Overlay - Fullscreen on Mobile */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900000;
  padding: 0;
  backdrop-filter: blur(8px);
}

/* Modal Container - Fullscreen on Mobile */
.modal-container {
  background: var(--bg-primary);
  width: 100%;
  height: 100dvh;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: none;
}

/* Header - Sticky on mobile */
.modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 10;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.close-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: var(--surface-hover);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  transition: all 0.2s;
}

.close-button:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-color: var(--primary-color);
  transform: rotate(90deg);
}

/* Body - Single column with proper spacing */
.modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--bg-primary);
}

/* Cards - Modern spacing */
.card {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Section and Option Icons */
.section-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
  flex-shrink: 0;
}

.option-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.radio-tile.selected .option-icon {
  color: var(--primary-color);
}

.free-ship-icon {
  width: 14px;
  height: 14px;
}

.divider {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 1rem 0;
}

/* Order Summary */
.items-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.item {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.item-img {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.item-details {
  flex: 1;
  min-width: 0;
}

.item-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
  line-height: 1.3;
  margin-bottom: 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.item-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.item-price {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary-color);
  flex-shrink: 0;
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.875rem;
}

.subtotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-secondary);
}

.subtotal strong {
  color: var(--text-primary);
  font-weight: 600;
}

.free-shipping-label {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white !important;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-weight: 600 !important;
  font-size: 0.7rem;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.total {
  font-size: 1rem;
  font-weight: 700;
  padding-top: 0.625rem;
  border-top: 2px solid var(--border-color);
  margin-top: 0.25rem;
}

.total strong {
  color: var(--primary-color);
  font-size: 1.125rem;
}

/* Radio Tiles */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radio-tile {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--surface);
}

.radio-tile:active {
  transform: scale(0.98);
}

.radio-tile.selected {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.radio-tile input {
  accent-color: var(--primary-color);
  height: 1.125rem;
  width: 1.125rem;
  margin-top: 0.125rem;
  flex-shrink: 0;
}

.delivery-option,
.agreement-option,
.payment-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.option-label {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.agreement-option small,
.delivery-option small,
.payment-option small {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 400;
  line-height: 1.3;
}

.agreement-details {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid var(--border-color);
}

.agreement-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.625rem;
}

/* Customer Info */
.address-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.edit-btn {
  font-size: 0.8125rem;
  font-weight: 600;
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  transition: color 0.2s;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
}

.edit-btn:hover {
  background: rgba(16, 185, 129, 0.1);
}

.address-form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.input-group {
  position: relative;
}

.input-group input,
.agreement-textarea {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.9375rem;
  color: var(--text-primary);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-group input:focus,
.agreement-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.input-group label {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  background: var(--surface);
  padding: 0 0.375rem;
  color: var(--text-secondary);
  pointer-events: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-group input:not(:placeholder-shown)+label,
.input-group input:focus+label,
.input-group label.floated {
  top: 0;
  transform: translateY(-50%) scale(0.85);
  color: var(--primary-color);
  font-weight: 600;
}

.agreement-textarea {
  min-height: 90px;
  resize: vertical;
  font-family: inherit;
}

.address-display {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.customer-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.customer-phone {
  color: var(--text-secondary);
}

.customer-address {
  color: var(--text-secondary);
}

/* Bottom spacer to prevent content hiding under fixed footer */
.bottom-spacer {
  height: 140px;
  flex-shrink: 0;
}

/* Fixed Footer with Actions */
.modal-footer {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem 1.25rem;
  background: var(--surface);
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 0.75rem;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.btn {
  padding: 1rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: center;
  position: relative;
  overflow: hidden;
  display: flex;
  flex: 1 1 0;
}

.btn.confirm {
  background: linear-gradient(135deg, #10b981 0%, var(--primary-color) 100%);
  color: white;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.25);
}

.btn.confirm:active:not(:disabled) {
  transform: scale(0.98);
}

.btn.confirm:disabled {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
  cursor: not-allowed;
  box-shadow: none;
  opacity: 0.6;
}

.btn.cancel {
  background: var(--surface);
  color: var(--text-secondary);
  border: 2px solid var(--border-color);
}

.btn.cancel:active:not(:disabled) {
  transform: scale(0.98);
  background: var(--surface-hover);
}

.error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.375rem;
  font-weight: 500;
}

/* Tablet and Desktop */
@media (min-width: 768px) {
  .modal-overlay {
    padding: 1.5rem;
  }

  .modal-container {
    max-width: 600px;
    height: auto;
    max-height: 90dvh;
    border-radius: 20px;
    border: 1px solid var(--border-color);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  }

  .modal-header {
    padding: 1.5rem;
  }

  .modal-title {
    font-size: 1.5rem;
  }

  .close-button {
    width: 36px;
    height: 36px;
  }

  .modal-body {
    padding: 1.5rem;
    gap: 1.25rem;
  }

  .card {
    padding: 1.5rem;
  }

  .section-title {
    font-size: 1.125rem;
  }

  .item-img {
    width: 64px;
    height: 64px;
  }

  .item-label {
    font-size: 0.9375rem;
  }

  .modal-footer {
    padding: 1.5rem;
    flex-direction: row;
  }

  .btn {
    flex: 1;
  }

  .btn.confirm {
    order: 2;
  }

  .btn.cancel {
    order: 1;
  }

  .bottom-spacer {
    display: none;
  }
}

/* Large Desktop */
@media (min-width: 1024px) {
  .modal-container {
    max-width: 700px;
  }
}
</style>
