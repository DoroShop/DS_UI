I'll enhance the Store Information section with a modern, clean UI that clearly distinguishes between editable and read-only fields. Here's the complete enhanced code:

```vue
<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
  LockClosedIcon,
  CheckCircleIcon,
} from "@heroicons/vue/24/outline";
import { MapPinIcon as MapPinSolidIcon, SparklesIcon } from "@heroicons/vue/24/solid";
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores";
import { useSubscriptionStore } from "../../../stores/vendor/subscriptionStore";
import { formatToPHCurrency } from "../../../utils/currencyFormat";
import { getAuthHeaders } from "../../../types/shared";
import QRCodePaymentModal from "../../QRCodePaymentModal.vue";
import { getQRCodeUrl } from "../../../utils/paymentApi";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/* ----------------------- Store ----------------------- */
const store = useVendorDashboardStore();
const subscriptionStore = useSubscriptionStore();
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

  // Load subscription status
  try {
    await subscriptionStore.fetchSubscription();
  } catch (e) {
    console.warn("Failed to fetch subscription on mount", e);
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

/* ─────────── Image Upload State ─────────── */
const profileImageFile = ref(null);
const bannerImageFile = ref(null);
const profileImagePreview = ref("");
const bannerImagePreview = ref("");
const imageUploading = ref(false);

const profileFileInput = ref(null);
const bannerFileInput = ref(null);

const handleProfileImageSelect = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    window.alert("Please select a valid image file.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    window.alert("Image must be less than 5MB.");
    return;
  }
  profileImageFile.value = file;
  profileImagePreview.value = URL.createObjectURL(file);
};

const handleBannerImageSelect = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    window.alert("Please select a valid image file.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    window.alert("Image must be less than 5MB.");
    return;
  }
  bannerImageFile.value = file;
  bannerImagePreview.value = URL.createObjectURL(file);
};

const removeProfileImage = () => {
  profileImageFile.value = null;
  profileImagePreview.value = "";
  if (profileFileInput.value) profileFileInput.value.value = "";
};

const removeBannerImage = () => {
  bannerImageFile.value = null;
  bannerImagePreview.value = "";
  if (bannerFileInput.value) bannerFileInput.value.value = "";
};

const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await axios.post(`${API_BASE_URL}/upload/profile-image`, formData, {
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data?.imageUrl || res.data?.url || "";
};

/* ─────────── Address API State ─────────── */
const addressRegions = ref([]);
const addressProvinces = ref([]);
const addressCities = ref([]);
const addressBarangays = ref([]);
const addressLoading = ref(false);

const selectedRegion = ref("");
const selectedProvince = ref("");
const selectedCity = ref("");
const selectedBarangay = ref("");
const addressZipCode = ref("");

const fetchRegions = async () => {
  try {
    addressLoading.value = true;
    const res = await axios.get(`${API_BASE_URL}/locations/regions`);
    addressRegions.value = res.data?.data || res.data || [];
  } catch (e) {
    console.warn("Failed to fetch regions:", e);
  } finally {
    addressLoading.value = false;
  }
};

const fetchProvinces = async (regionCode) => {
  if (!regionCode) { addressProvinces.value = []; return; }
  try {
    addressLoading.value = true;
    const res = await axios.get(`${API_BASE_URL}/locations/regions/${regionCode}/provinces`);
    addressProvinces.value = res.data?.data || res.data || [];
  } catch (e) {
    console.warn("Failed to fetch provinces:", e);
  } finally {
    addressLoading.value = false;
  }
};

const fetchCities = async (provinceCode) => {
  if (!provinceCode) { addressCities.value = []; return; }
  try {
    addressLoading.value = true;
    const res = await axios.get(`${API_BASE_URL}/locations/provinces/${provinceCode}/cities`);
    addressCities.value = res.data?.data || res.data || [];
  } catch (e) {
    console.warn("Failed to fetch cities:", e);
  } finally {
    addressLoading.value = false;
  }
};

const fetchBarangays = async (cityCode) => {
  if (!cityCode) { addressBarangays.value = []; return; }
  try {
    addressLoading.value = true;
    const res = await axios.get(`${API_BASE_URL}/locations/cities/${cityCode}/barangays`);
    addressBarangays.value = res.data?.data || res.data || [];
  } catch (e) {
    console.warn("Failed to fetch barangays:", e);
  } finally {
    addressLoading.value = false;
  }
};

const onRegionChange = (code) => {
  selectedRegion.value = code;
  selectedProvince.value = "";
  selectedCity.value = "";
  selectedBarangay.value = "";
  addressProvinces.value = [];
  addressCities.value = [];
  addressBarangays.value = [];
  editForm.province = "";
  editForm.city = "";
  editForm.barangay = "";

  if (code) fetchProvinces(code);
};

const onProvinceChange = (code) => {
  selectedProvince.value = code;
  selectedCity.value = "";
  selectedBarangay.value = "";
  addressCities.value = [];
  addressBarangays.value = [];

  const prov = addressProvinces.value.find((p) => p.code === code);
  editForm.province = prov?.name || "";
  editForm.city = "";
  editForm.barangay = "";

  if (code) fetchCities(code);
};

const onCityChange = (code) => {
  selectedCity.value = code;
  selectedBarangay.value = "";
  addressBarangays.value = [];

  const city = addressCities.value.find((c) => c.code === code);
  editForm.city = city?.name || "";
  editForm.barangay = "";

  // Auto-fill ZIP code from city data
  if (city?.zipCode) {
    addressZipCode.value = city.zipCode;
  }

  if (code) fetchBarangays(code);
};

const onBarangayChange = (code) => {
  selectedBarangay.value = code;
  const brgy = addressBarangays.value.find((b) => b.code === code);
  editForm.barangay = brgy?.name || "";
};

/* ─────────── Manual Lat/Lng Input ─────────── */
const manualLat = ref("");
const manualLng = ref("");

const applyManualCoords = () => {
  const lat = parseFloat(manualLat.value);
  const lng = parseFloat(manualLng.value);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    window.alert("Please enter valid coordinates. Latitude: -90 to 90, Longitude: -180 to 180.");
    return;
  }
  editLocation.lat = lat;
  editLocation.lng = lng;

  const latlng = L.latLng(lat, lng);
  if (locationMarker.value) {
    locationMarker.value.setLatLng(latlng);
  } else if (locationMap.value) {
    locationMarker.value = L.marker(latlng, { draggable: true }).addTo(locationMap.value);
    locationMarker.value.on("dragend", (ev) => {
      const pos = ev.target.getLatLng();
      editLocation.lat = pos.lat;
      editLocation.lng = pos.lng;
      manualLat.value = pos.lat.toFixed(6);
      manualLng.value = pos.lng.toFixed(6);
    });
  }
  locationMap.value?.setView(latlng, 15);
};

const gettingLocation = ref(false);

const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    window.alert("Geolocation is not supported by your browser.");
    return;
  }
  gettingLocation.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      editLocation.lat = lat;
      editLocation.lng = lng;
      manualLat.value = lat.toFixed(6);
      manualLng.value = lng.toFixed(6);

      const latlng = L.latLng(lat, lng);
      if (locationMarker.value) {
        locationMarker.value.setLatLng(latlng);
      } else if (locationMap.value) {
        locationMarker.value = L.marker(latlng, { draggable: true }).addTo(locationMap.value);
        locationMarker.value.on("dragend", (ev) => {
          const pos = ev.target.getLatLng();
          editLocation.lat = pos.lat;
          editLocation.lng = pos.lng;
          manualLat.value = pos.lat.toFixed(6);
          manualLng.value = pos.lng.toFixed(6);
        });
      }
      locationMap.value?.setView(latlng, 15);
      gettingLocation.value = false;
    },
    (err) => {
      gettingLocation.value = false;
      window.alert("Failed to get your location. Please ensure location access is enabled.");
      console.warn("Geolocation error:", err);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

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

  // Reset image upload state
  profileImageFile.value = null;
  bannerImageFile.value = null;
  profileImagePreview.value = v.imageUrl || "";
  bannerImagePreview.value = v.bannerUrl || "";

  // Reset address dropdowns
  selectedRegion.value = "";
  selectedProvince.value = "";
  selectedCity.value = "";
  selectedBarangay.value = "";
  addressZipCode.value = v.address?.zipCode || "";
  addressProvinces.value = [];
  addressCities.value = [];
  addressBarangays.value = [];

  // Reset manual lat/lng
  const loc = v.location;
  if (loc?.coordinates?.length === 2) {
    manualLat.value = loc.coordinates[1].toFixed(6);
    manualLng.value = loc.coordinates[0].toFixed(6);
  } else {
    manualLat.value = "";
    manualLng.value = "";
  }

  // Fetch regions for address dropdowns
  fetchRegions();

  showEditModal.value = true;
};

const validateEdit = () => {
  const errs = {};
  
  // Validate email
  if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
    errs.email = "Please enter a valid email address";
  }
  
  // Validate phone
  if (editForm.phone && !/^[\d\s\-\+\(\)]+$/.test(editForm.phone)) {
    errs.phone = "Please enter a valid phone number";
  }
  
  editErrors.value = errs;
  return Object.keys(errs).length === 0;
};

const saveEdit = async () => {
  if (!validateEdit()) return;

  try {
    imageUploading.value = true;

    // Upload images if new files were selected
    let finalImageUrl = editForm.imageUrl.trim();
    let finalBannerUrl = editForm.bannerUrl.trim();

    if (profileImageFile.value) {
      finalImageUrl = await uploadImage(profileImageFile.value);
    }
    if (bannerImageFile.value) {
      finalBannerUrl = await uploadImage(bannerImageFile.value);
    }

    const payload = {
      imageUrl: finalImageUrl,
      bannerUrl: finalBannerUrl,
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      description: editForm.description.trim(),
      address: {
        street: editForm.street.trim(),
        barangay: editForm.barangay.trim(),
        city: editForm.city.trim(),
        province: editForm.province.trim(),
        zipCode: addressZipCode.value.trim(),
      },
    };

    // Include storeName if the vendor is approved
    if (vendor.value?.isApproved) {
      payload.storeName = editForm.storeName.trim();
    }

    await getStore().updateVendor?.(payload);
    showEditModal.value = false;
  } catch (err) {
    console.error("Vendor update failed:", err);
    window.alert("Failed to update profile. Please try again.");
  } finally {
    imageUploading.value = false;
  }
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

/* ─── Navigate to Subscription page ─── */
const goToSubscription = () => {
  localStorage.setItem("activePageVendorDashboard", "Subscription");
  window.location.reload();
};

/* -------------------- Wallet UI Helpers ---------------- */
const isBankDetailsRequired = computed(() => {
  return actionType.value === "withdraw";
});

const walletModalTitle = computed(() => (actionType.value === "cashin" ? "Cash In" : "Withdraw"));
const walletModalSubtitle = computed(() => {
  if (actionType.value === "cashin") return "Top up your wallet via QRPH (scan QR).";
  return "Withdraw via GCash or PayMaya.";
});

/* ─────────── Pinned Products (Subscription Benefit) ─────────── */
const pinnedProducts = ref([]);
const pinnedLoading = ref(false);
const showPinModal = ref(false);
const pinningProductId = ref(null);

const approvedProducts = computed(() => {
  const prods = getStore().vendorProducts || [];
  return prods.filter(
    (p) => p.status === "approved" && !p.isDisabled
  );
});

const unpinnedProducts = computed(() => {
  const pinnedIds = new Set(pinnedProducts.value.map((p) => String(p._id)));
  return approvedProducts.value.filter((p) => !pinnedIds.has(String(p._id)));
});

const canPin = computed(() => pinnedProducts.value.length < 3);

const isSubscribed = computed(() => {
  return subscriptionStore.isSubscribed;
});

const loadPinnedProducts = async () => {
  pinnedLoading.value = true;
  try {
    pinnedProducts.value = await getStore().getPinnedProducts();
  } catch (e) {
    console.warn("Failed to load pinned products:", e);
  } finally {
    pinnedLoading.value = false;
  }
};

const handlePinProduct = async (productId) => {
  pinningProductId.value = productId;
  try {
    await getStore().pinProduct(productId);
    await loadPinnedProducts();
    showPinModal.value = false;
  } catch (e) {
    // Error already shown by store
  } finally {
    pinningProductId.value = null;
  }
};

const handleUnpinProduct = async (productId) => {
  pinningProductId.value = productId;
  try {
    await getStore().unpinProduct(productId);
    await loadPinnedProducts();
  } catch (e) {
    // Error already shown by store
  } finally {
    pinningProductId.value = null;
  }
};

/* ─────────── Map Location Picker ─────────── */
const locationMapContainer = ref(null);
const locationMap = ref(null);
const locationMarker = ref(null);
const editLocation = reactive({ lat: null, lng: null });
const locationSaving = ref(false);

const currentLocation = computed(() => {
  const loc = vendor.value?.location;
  if (loc?.coordinates?.length === 2) {
    return { lng: loc.coordinates[0], lat: loc.coordinates[1] };
  }
  return null;
});

const initLocationMap = () => {
  if (locationMap.value) return;
  nextTick(() => {
    const container = locationMapContainer.value;
    if (!container) return;

    const center = currentLocation.value
      ? [currentLocation.value.lat, currentLocation.value.lng]
      : [12.5, 121.0]; // Default to Mindoro area

    const zoom = currentLocation.value ? 15 : 9;

    locationMap.value = L.map(container, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(locationMap.value);

    if (currentLocation.value) {
      editLocation.lat = currentLocation.value.lat;
      editLocation.lng = currentLocation.value.lng;
      manualLat.value = currentLocation.value.lat.toFixed(6);
      manualLng.value = currentLocation.value.lng.toFixed(6);
      locationMarker.value = L.marker([currentLocation.value.lat, currentLocation.value.lng], {
        draggable: true,
      }).addTo(locationMap.value);

      locationMarker.value.on("dragend", (e) => {
        const pos = e.target.getLatLng();
        editLocation.lat = pos.lat;
        editLocation.lng = pos.lng;
        manualLat.value = pos.lat.toFixed(6);
        manualLng.value = pos.lng.toFixed(6);
      });
    }

    locationMap.value.on("click", (e) => {
      editLocation.lat = e.latlng.lat;
      editLocation.lng = e.latlng.lng;
      manualLat.value = e.latlng.lat.toFixed(6);
      manualLng.value = e.latlng.lng.toFixed(6);

      if (locationMarker.value) {
        locationMarker.value.setLatLng(e.latlng);
      } else {
        locationMarker.value = L.marker(e.latlng, { draggable: true }).addTo(locationMap.value);
        locationMarker.value.on("dragend", (ev) => {
          const pos = ev.target.getLatLng();
          editLocation.lat = pos.lat;
          editLocation.lng = pos.lng;
          manualLat.value = pos.lat.toFixed(6);
          manualLng.value = pos.lng.toFixed(6);
        });
      }
    });

    // Handle map resize when modal opens
    setTimeout(() => locationMap.value?.invalidateSize(), 200);
  });
};

const destroyLocationMap = () => {
  if (locationMap.value) {
    locationMap.value.remove();
    locationMap.value = null;
    locationMarker.value = null;
    editLocation.lat = null;
    editLocation.lng = null;
  }
};

const saveShopLocation = async () => {
  if (editLocation.lat == null || editLocation.lng == null) return;
  locationSaving.value = true;
  try {
    await getStore().updateShopLocation(editLocation.lat, editLocation.lng);
  } catch (e) {
    // Error shown in store
  } finally {
    locationSaving.value = false;
  }
};

const removeShopLocation = async () => {
  if (!confirm("Remove your shop's map location?")) return;
  locationSaving.value = true;
  try {
    await getStore().removeShopLocation();
    if (locationMarker.value) {
      locationMarker.value.remove();
      locationMarker.value = null;
    }
    editLocation.lat = null;
    editLocation.lng = null;
  } catch (e) {
    // Error shown in store
  } finally {
    locationSaving.value = false;
  }
};

// Watch edit modal to init/destroy map
watch(showEditModal, (val) => {
  if (val) {
    nextTick(() => initLocationMap());
  } else {
    destroyLocationMap();
  }
});

// Load pinned products on mount
onMounted(async () => {
  await loadPinnedProducts();
});

onUnmounted(() => {
  destroyLocationMap();
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

              <!-- ─── Section 1: Store Information (ENHANCED) ─── -->
              <div class="formBlock">
                <div class="formBlock__header">
                  <div class="formBlock__dot"></div>
                  <div class="formBlock__title">Store Information</div>
                </div>
                <div class="formBlock__content">
                  
                  <!-- Read-Only Fields Grid -->
                  <div class="infoGrid">
                    <!-- Store Name -->
                    <div class="infoCard infoCard--locked">
                      <div class="infoCard__header">
                        <div class="infoCard__icon infoCard__icon--locked">
                          <LockClosedIcon class="ico-sm" />
                        </div>
                        <div class="infoCard__label">
                          <span class="infoCard__title">Store Name</span>
                          <span class="infoCard__badge infoCard__badge--locked">Read-only</span>
                        </div>
                      </div>
                      <div class="infoCard__value">{{ editForm.storeName || 'Not set' }}</div>
                      <div class="infoCard__hint">
                        <span v-if="!vendor?.isApproved">Editable after shop approval</span>
                        <span v-else>Contact support to change store name</span>
                      </div>
                    </div>

                    <!-- Address -->
                    <div class="infoCard infoCard--locked">
                      <div class="infoCard__header">
                        <div class="infoCard__icon infoCard__icon--locked">
                          <MapPinIcon class="ico-sm" />
                        </div>
                        <div class="infoCard__label">
                          <span class="infoCard__title">Store Address</span>
                          <span class="infoCard__badge infoCard__badge--locked">Read-only</span>
                        </div>
                      </div>
                      <div class="infoCard__value infoCard__value--multiline">
                        {{ fullAddress || 'No address set' }}
                      </div>
                      <div class="infoCard__hint">Update address in the Address section below</div>
                    </div>
                  </div>

                  <!-- Editable Fields -->
                  <div class="editableSection">
                    <div class="editableSection__header">
                      <CheckCircleIcon class="ico-sm" style="color: var(--primary);" />
                      <span>Editable Contact Information</span>
                    </div>

                    <div class="cols" style="margin-top: 14px;">
                      <!-- Email -->
                      <div class="field">
                        <label class="label">
                          <EnvelopeIcon class="ico-sm" style="opacity: 0.6; vertical-align: -2px; margin-right: 4px;" />
                          Email Address
                          <span class="label__badge label__badge--ok">Editable</span>
                        </label>
                        <input
                          v-model="editForm.email"
                          type="email"
                          class="input input--editable"
                          :class="{ 'input--err': editErrors.email }"
                          placeholder="store@example.com"
                        />
                        <p v-if="editErrors.email" class="err">{{ editErrors.email }}</p>
                        <p v-else class="hint">Customer inquiries will be sent here</p>
                      </div>

                      <!-- Phone -->
                      <div class="field">
                        <label class="label">
                          <PhoneIcon class="ico-sm" style="opacity: 0.6; vertical-align: -2px; margin-right: 4px;" />
                          Phone Number
                          <span class="label__badge label__badge--ok">Editable</span>
                        </label>
                        <input
                          v-model="editForm.phone"
                          type="tel"
                          class="input input--editable"
                          :class="{ 'input--err': editErrors.phone }"
                          placeholder="+63 9XX XXX XXXX"
                        />
                        <p v-if="editErrors.phone" class="err">{{ editErrors.phone }}</p>
                        <p v-else class="hint">Customers can reach you at this number</p>
                      </div>
                    </div>
                  </div>

                  <!-- Description (Editable) -->
                  <div class="field" style="margin-top: 14px;">
                    <label class="label">
                      Store Description
                      <span class="label__badge label__badge--ok">Editable</span>
                    </label>
                    <textarea
                      v-model="editForm.description"
                      class="textarea"
                      placeholder="Tell customers about your store, products, and services..."
                      rows="4"
                    ></textarea>
                    <p class="hint">{{ editForm.description.length }} / 500 characters</p>
                  </div>

                </div>
              </div>

              <!-- ─── Section 2: Store Images (File Upload) ─── -->
              <div class="formBlock">
                <div class="formBlock__header">
                  <div class="formBlock__dot"></div>
                  <div class="formBlock__title">Store Images</div>
                </div>
                <div class="formBlock__content">
                  <div class="imgUploadRow">
                    <!-- Profile Image Upload -->
                    <div class="imgUploadCard">
                      <div class="imgUploadCard__preview" @click="profileFileInput?.click()">
                        <img v-if="profileImagePreview" :src="profileImagePreview" alt="Profile Preview" class="imgUploadCard__img" />
                        <div v-else class="imgUploadCard__placeholder">
                          <CameraIcon class="ico" style="width: 28px; height: 28px; opacity: 0.4;" />
                          <span>Profile Image</span>
                        </div>
                        <div class="imgUploadCard__overlay">
                          <CameraIcon class="ico" />
                          <span>Change</span>
                        </div>
                      </div>
                      <input ref="profileFileInput" type="file" accept="image/*" style="display: none;" @change="handleProfileImageSelect" />
                      <div class="imgUploadCard__info">
                        <span class="imgUploadCard__label">Profile Image</span>
                        <span class="hint">Square, 400x400px</span>
                      </div>
                      <button v-if="profileImageFile" type="button" class="imgUploadCard__remove" @click="removeProfileImage" aria-label="Remove">
                        <XMarkIcon class="ico-sm" />
                      </button>
                    </div>

                    <!-- Banner Image Upload -->
                    <div class="imgUploadCard imgUploadCard--wide">
                      <div class="imgUploadCard__preview imgUploadCard__preview--wide" @click="bannerFileInput?.click()">
                        <img v-if="bannerImagePreview" :src="bannerImagePreview" alt="Banner Preview" class="imgUploadCard__img" />
                        <div v-else class="imgUploadCard__placeholder">
                          <CameraIcon class="ico" style="width: 28px; height: 28px; opacity: 0.4;" />
                          <span>Banner Image</span>
                        </div>
                        <div class="imgUploadCard__overlay">
                          <CameraIcon class="ico" />
                          <span>Change</span>
                        </div>
                      </div>
                      <input ref="bannerFileInput" type="file" accept="image/*" style="display: none;" @change="handleBannerImageSelect" />
                      <div class="imgUploadCard__info">
                        <span class="imgUploadCard__label">Banner Image</span>
                        <span class="hint">Wide, 1200x400px</span>
                      </div>
                      <button v-if="bannerImageFile" type="button" class="imgUploadCard__remove" @click="removeBannerImage" aria-label="Remove">
                        <XMarkIcon class="ico-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ─── Section 3: Store Address (Read-Only) ─── -->
              <div class="formBlock">
                <div class="formBlock__header">
                  <div class="formBlock__dot"></div>
                  <div class="formBlock__title">Store Address</div>
                </div>
                <div class="formBlock__content">
                  <p class="hint" style="margin-bottom: 12px;">Your store address cannot be edited. Contact support if you need to update it.</p>
                  
                  <div class="addressReadOnly">
                    <MapPinIcon class="ico-sm" style="color: var(--primary); flex-shrink: 0;" />
                    <div class="addressReadOnly__text">
                      <p v-if="vendor?.address && (vendor.address.street || vendor.address.city || vendor.address.province)">
                        {{ [vendor.address.street, vendor.address.barangay, vendor.address.city, vendor.address.province, vendor.address.zipCode].filter(Boolean).join(', ') }}
                      </p>
                      <p v-else style="margin: 0; color: var(--muted);">No address set</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ─── Section 4: Shop Map Location (Subscription Gated) ─── -->
              <div class="formBlock">
                <div class="formBlock__header">
                  <div class="formBlock__dot"></div>
                  <div class="formBlock__title">
                    <MapPinSolidIcon class="ico" style="color: var(--primary); margin-right: 6px; vertical-align: -3px;" />
                    Shop Map Location
                  </div>
                </div>
                <div class="formBlock__content">

                  <!-- Subscription Gate for map -->
                  <div v-if="!isSubscribed" class="subGate">
                    <div class="subGate__icon">
                      <MapPinSolidIcon class="ico" />
                    </div>
                    <h3 class="subGate__title">Subscribe to Pin Your Shop</h3>
                    <p class="subGate__desc">Show your store on the Nearby Shops map so customers can find you easily. This feature requires an active subscription.</p>
                    <button type="button" class="btn btn--primary btn--sm" style="margin-top: 8px;" @click="goToSubscription">
                      View Subscription Plans
                    </button>
                  </div>

                  <!-- Subscribed: Full map location picker -->
                  <template v-else>
                    <p class="hint" style="margin-bottom: 10px;">
                      Set your shop's location using the map, by entering coordinates, or using your current GPS location.
                    </p>

                    <!-- Manual Coordinates + GPS Button -->
                    <div class="coordRow">
                      <div class="field" style="flex: 1;">
                        <label class="label">Latitude</label>
                        <input v-model="manualLat" class="input input--mono" placeholder="e.g. 12.879721" type="text" />
                      </div>
                      <div class="field" style="flex: 1;">
                        <label class="label">Longitude</label>
                        <input v-model="manualLng" class="input input--mono" placeholder="e.g. 121.053886" type="text" />
                      </div>
                      <div class="coordRow__actions">
                        <button type="button" class="btn btn--sm" @click="applyManualCoords" :disabled="!manualLat || !manualLng">
                          Apply
                        </button>
                        <button type="button" class="btn btn--primary btn--sm" @click="useCurrentLocation" :disabled="gettingLocation">
                          {{ gettingLocation ? 'Locating...' : 'Use My Location' }}
                        </button>
                      </div>
                    </div>

                    <!-- Map -->
                    <div ref="locationMapContainer" class="locationMap"></div>

                    <div v-if="editLocation.lat != null" class="locationCoords">
                      <span>Lat: {{ editLocation.lat?.toFixed(6) }}, Lng: {{ editLocation.lng?.toFixed(6) }}</span>
                    </div>

                    <div class="locationActions">
                      <button
                        type="button"
                        class="btn btn--primary btn--sm"
                        :disabled="editLocation.lat == null || locationSaving"
                        @click="saveShopLocation"
                      >
                        {{ locationSaving ? 'Saving...' : 'Save Location' }}
                      </button>
                      <button
                        v-if="currentLocation"
                        type="button"
                        class="btn btn--ghost btn--sm"
                        :disabled="locationSaving"
                        @click="removeShopLocation"
                      >
                        Remove Location
                      </button>
                    </div>
                  </template>
                </div>
              </div>

              <footer class="modal__foot modal__foot--sticky">
                <button type="button" class="btn btn--muted" @click="showEditModal = false" :disabled="imageUploading">
                  Cancel
                </button>
                <button type="submit" class="btn btn--primary" :disabled="imageUploading">
                  {{ imageUploading ? 'Uploading...' : 'Save Changes' }}
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
  background: linear-gradient(180deg, #2ee071 0%, #1ab256 100%);
  color: var(--text-primary);
  transition: all 300ms;
}
.btn--primary:hover { opacity: .75 }

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
  padding-bottom: 0;
  max-height: 72vh;
  overflow: auto;
}
.modal__foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.10);
  background: var(--surface);
}
.modal__foot--sticky {
  position: sticky;
  bottom: -1px;
  background: var(--surface);
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
  border-color: rgba(34,197,94,0.55);background: rgba(2, 6, 23, 0.75);
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
/* ------------------------------------------------------------------ /
/  QR /
/ ------------------------------------------------------------------ */
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
/* ------------------------------------------------------------------ /
/  EMPTY /
/ ------------------------------------------------------------------ */
.empty {
padding: 18px;
border-radius: var(--r-lg);
border: 1px solid rgba(255,255,255,0.10);
background: rgba(255,255,255,0.06);
box-shadow: var(--shadow);
}
/* ------------------------------------------------------------------ /
/  ANIM /
/ ------------------------------------------------------------------ */
.fade-enter-active, .fade-leave-active { transition: all 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px) scale(0.99); }
/* ------------------------------------------------------------------ /
/  RESPONSIVE /
/ ------------------------------------------------------------------ */
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
/* ─── Pinned Products ─────────────────────────────────────────── */
.pinnedList { display: flex; flex-direction: column; gap: 10px; }
.pinnedEmpty {
text-align: center; padding: 28px 16px;
color: var(--muted);
}
.pinnedEmpty__icon {
width: 40px; height: 40px;
color: var(--primary);
margin: 0 auto 10px;
opacity: .5;
}
.pinnedItem {
display: flex; align-items: center; gap: 12px;
padding: 10px 14px;
background: var(--card);
border: 1px solid var(--border);
border-radius: var(--r-sm);
transition: background .15s;
}
.pinnedItem:hover { background: rgba(255,255,255,.08); }
.pinnedItem__img {
width: 48px; height: 48px;
border-radius: 8px;
object-fit: cover;
background: rgba(255,255,255,.04);
flex-shrink: 0;
}
.pinnedItem__info { flex: 1; min-width: 0; }
.pinnedItem__name {
font-weight: 600; font-size: .9rem;
white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pinnedItem__price { font-size: .8rem; color: var(--primary); margin-top: 2px; }
.pinnedCounter {
text-align: right; font-size: .78rem; color: var(--muted2);
margin-top: 8px; padding-right: 4px;
}
/* Pin select modal list */
.pinSelectList { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; }
.pinSelectItem {
display: flex; align-items: center; gap: 12px;
padding: 10px 14px;
border-radius: var(--r-sm);
cursor: pointer;
transition: background .15s;
border: 1px solid var(--border);
}
.pinSelectItem:hover { background: rgba(34,197,94,.08); border-color: var(--primary); }
.pinSelectItem--disabled { opacity: .5; pointer-events: none; }
.pinSelectItem__img {
width: 42px; height: 42px;
border-radius: 8px;
object-fit: cover;
background: rgba(255,255,255,.04);
flex-shrink: 0;
}
.pinSelectItem__info { flex: 1; min-width: 0; }
.pinSelectItem__name {
font-weight: 600; font-size: .85rem;
white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pinSelectItem__meta { font-size: .78rem; color: var(--muted); margin-top: 2px; }
.pinSelectItem__action {
font-size: .8rem; font-weight: 600;
color: var(--primary);
flex-shrink: 0;
}
/* ─── Map Location Picker ─────────────────────────────────────── */
.locationMap {
width: 100%;
height: 280px;
border-radius: var(--r-sm);
border: 1px solid var(--border);
overflow: hidden;
z-index: 0;
}
.locationCoords {
margin-top: 8px;
font-size: .8rem;
color: var(--muted);
font-family: monospace;
}
.locationActions {
display: flex; gap: 8px;
margin-top: 10px;
}
/* ─── Subscription Gate ─────────────────────────────────────── */
.subGate {
display: flex;
flex-direction: column;
align-items: center;
text-align: center;
padding: 32px 20px;
border-radius: var(--r);
border: 1px dashed rgba(34, 197, 94, 0.25);
background: rgba(34, 197, 94, 0.04);
}
.subGate__icon {
width: 48px;
height: 48px;
border-radius: 14px;
display: grid;
place-items: center;
background: rgba(34, 197, 94, 0.12);
border: 1px solid rgba(34, 197, 94, 0.20);
color: var(--primary);
margin-bottom: 12px;
}
.subGate__icon .ico { width: 24px; height: 24px; }
.subGate__title {
margin: 0 0 6px;
font-size: 15px;
font-weight: 700;
letter-spacing: -0.01em;
}
.subGate__desc {
margin: 0;
font-size: 13px;
color: var(--muted);
max-width: 380px;
line-height: 1.45;
}
/* ─── Form Block Redesigned ─────────────────────────────────── */
.formBlock__header {
display: flex;
align-items: center;
gap: 10px;
margin-bottom: 12px;
}
.formBlock__dot {
width: 6px;
height: 6px;
border-radius: 50%;
background: var(--primary);
flex-shrink: 0;
}
.formBlock__content {
padding-left: 16px;
border-left: 1px solid rgba(255, 255, 255, 0.06);
}
/* ─── Label Badges ──────────────────────────────────────────── */
.label__badge {
display: inline-block;
font-size: 10px;
font-weight: 600;
text-transform: uppercase;
padding: 2px 6px;
border-radius: 4px;
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.10);
color: var(--muted2);
margin-left: 6px;
vertical-align: middle;
letter-spacing: 0.03em;
}
.label__badge--ok {
background: rgba(34, 197, 94, 0.10);
border-color: rgba(34, 197, 94, 0.20);
color: var(--primary);
}
.input--readonly {
opacity: 0.65;
cursor: not-allowed;
}
.input--mono {
font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
font-size: 13px;
letter-spacing: 0.02em;
}
/* ─── Image Upload Cards ────────────────────────────────────── */
.imgUploadRow {
display: flex;
gap: 14px;
flex-wrap: wrap;
}
.imgUploadCard {
position: relative;
flex: 0 0 auto;
}
.imgUploadCard--wide { flex: 1 1 auto; min-width: 200px; }
.imgUploadCard__preview {
width: 100px;
height: 100px;
border-radius: var(--r-sm);
border: 2px dashed rgba(255, 255, 255, 0.14);
overflow: hidden;
cursor: pointer;
position: relative;
display: flex;
align-items: center;
justify-content: center;
background: rgba(2, 6, 23, 0.45);
transition: border-color 0.15s ease, background 0.15s ease;
}
.imgUploadCard__preview:hover {
border-color: rgba(34, 197, 94, 0.40);
background: rgba(34, 197, 94, 0.04);
}
.imgUploadCard__preview--wide {
width: 100%;
height: 100px;
}
.imgUploadCard__img {
width: 100%;
height: 100%;
object-fit: cover;
}
.imgUploadCard__placeholder {
display: flex;
flex-direction: column;
align-items: center;
gap: 4px;
color: var(--muted2);
font-size: 11px;
}
.imgUploadCard__overlay {
position: absolute;
inset: 0;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 4px;
background: rgba(0, 0, 0, 0.55);
color: white;
font-size: 11px;
font-weight: 600;
opacity: 0;
transition: opacity 0.15s ease;
}
.imgUploadCard__preview:hover .imgUploadCard__overlay {
opacity: 1;
}
.imgUploadCard__info {
margin-top: 6px;
display: flex;
flex-direction: column;
gap: 2px;
}
.imgUploadCard__label {
font-size: 12px;
font-weight: 600;
color: rgba(255, 255, 255, 0.8);
}
.imgUploadCard__remove {
position: absolute;
top: -6px;
right: -6px;
width: 22px;
height: 22px;
border-radius: 50%;
border: 1px solid rgba(239, 68, 68, 0.30);
background: rgba(239, 68, 68, 0.15);
color: #fb7185;
cursor: pointer;
display: grid;
place-items: center;
transition: background 0.12s ease;
}
.imgUploadCard__remove:hover {
background: rgba(239, 68, 68, 0.30);
}
/* ─── Address Preview ───────────────────────────────────────── */
.addressPreview {
display: flex;
align-items: flex-start;
gap: 8px;
margin-top: 12px;
padding: 10px 12px;
border-radius: var(--r-sm);
background: rgba(34, 197, 94, 0.06);
border: 1px solid rgba(34, 197, 94, 0.14);
font-size: 13px;
color: rgba(255, 255, 255, 0.82);
line-height: 1.4;
}
/* ─── Address Read-Only ─────────────────────────────────────── */
.addressReadOnly {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: var(--r-sm);
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.12);
}
.addressReadOnly__text {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.5;
}
.addressReadOnly__text p {
  margin: 0;
}
.addressReadOnly__empty {
  flex: 1;
  font-size: 13px;
}
/* ─── Coordinate Row ────────────────────────────────────────── */
.coordRow {
display: flex;
gap: 10px;
align-items: flex-end;
margin-bottom: 12px;
flex-wrap: wrap;
}
.coordRow__actions {
display: flex;
gap: 6px;
padding-bottom: 1px;
}
.btn--sm {
padding: 8px 12px;
font-size: 12px;
border-radius: 10px;
}
/* ─── Select (dropdown) Styles ──────────────────────────────── */
select.input {
cursor: pointer;
appearance: none;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.5)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
background-repeat: no-repeat;
background-position: right 12px center;
padding-right: 32px;
}
select.input:disabled {
opacity: 0.5;
cursor: not-allowed;
}
/* ═══════════════════════════════════════════════════════════════
ENHANCED STORE INFORMATION SECTION
═══════════════════════════════════════════════════════════════ */
/* ─── Info Grid (Read-only fields) ──────────────────────────── */
.infoGrid {
display: grid;
gap: 12px;
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
margin-bottom: 16px;
}
.infoCard {
position: relative;
padding: 14px;
border-radius: var(--r-sm);
background: rgba(15, 23, 42, 0.35);
border: 1px solid rgba(255, 255, 255, 0.10);
transition: all 0.2s ease;
}
.infoCard--locked {
background: rgba(15, 23, 42, 0.25);
border: 1px dashed rgba(255, 255, 255, 0.08);
}
.infoCard__header {
display: flex;
align-items: flex-start;
gap: 10px;
margin-bottom: 10px;
}
.infoCard__icon {
width: 32px;
height: 32px;
border-radius: 10px;
display: grid;
place-items: center;
background: rgba(34, 197, 94, 0.12);
border: 1px solid rgba(34, 197, 94, 0.18);
color: var(--primary);
flex-shrink: 0;
}
.infoCard__icon--locked {
background: rgba(148, 163, 184, 0.10);
border-color: rgba(148, 163, 184, 0.15);
color: rgba(148, 163, 184, 0.65);
}
.infoCard__label {
flex: 1;
display: flex;
flex-direction: column;
gap: 4px;
}
.infoCard__title {
font-size: 12px;
font-weight: 600;
color: rgba(255, 255, 255, 0.75);
text-transform: uppercase;
letter-spacing: 0.05em;
}
.infoCard__badge {
display: inline-block;
font-size: 9px;
font-weight: 600;
text-transform: uppercase;
padding: 2px 6px;
border-radius: 4px;
background: rgba(34, 197, 94, 0.10);
border: 1px solid rgba(34, 197, 94, 0.20);
color: var(--primary);
letter-spacing: 0.03em;
width: fit-content;
}
.infoCard__badge--locked {
background: rgba(148, 163, 184, 0.10);
border-color: rgba(148, 163, 184, 0.18);
color: rgba(148, 163, 184, 0.70);
}
.infoCard__value {
font-size: 15px;
font-weight: 700;
color: rgba(255, 255, 255, 0.92);
line-height: 1.4;
margin-bottom: 6px;
letter-spacing: -0.01em;
}
.infoCard__value--multiline {
font-size: 13px;
font-weight: 500;
line-height: 1.5;
}
.infoCard--locked .infoCard__value {
color: rgba(255, 255, 255, 0.65);
}
.infoCard__hint {
font-size: 11px;
color: var(--muted2);
line-height: 1.4;
}
/* ─── Editable Section ──────────────────────────────────────── */
.editableSection {
margin-top: 16px;
padding: 16px;
border-radius: var(--r-sm);
background: rgba(34, 197, 94, 0.04);
border: 1px solid rgba(34, 197, 94, 0.12);
}
.editableSection__header {
display: flex;
align-items: center;
gap: 8px;
margin-bottom: 12px;
font-size: 13px;
font-weight: 600;
color: var(--primary);
letter-spacing: -0.01em;
}
.input--editable {
background: rgba(2, 6, 23, 0.65);
border-color: rgba(34, 197, 94, 0.20);
}
.input--editable:focus {
border-color: rgba(34, 197, 94, 0.45);
background: rgba(2, 6, 23, 0.85);
box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.08);
}
/* ─── Description Box (Read-only) ───────────────────────────── */
.descriptionBox {
padding: 12px;
border-radius: var(--r-sm);
background: rgba(15, 23, 42, 0.25);
border: 1px dashed rgba(255, 255, 255, 0.08);
color: rgba(255, 255, 255, 0.70);
font-size: 13px;
line-height: 1.6;
min-height: 60px;
display: flex;
align-items: center;
}
.descriptionBox p {
margin: 0;
}

/* ─── Location Status Card ─────────────────────────────────── */
.locationStatus {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-radius: var(--r-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(15, 23, 42, 0.25);
}

.locationStatus--active {
  border-color: rgba(34, 197, 94, 0.25);
  background: rgba(34, 197, 94, 0.05);
}

.locationStatus--empty {
  border-color: rgba(251, 191, 36, 0.25);
  background: rgba(251, 191, 36, 0.05);
}

.locationStatus__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.locationStatus__icon--muted {
  background: rgba(148, 163, 184, 0.6);
}

.locationStatus__content {
  flex: 1;
}

.locationStatus__title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.locationStatus__desc {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.locationStatus__debug {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.debugItem {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.debugLabel {
  color: rgba(255, 255, 255, 0.6);
  min-width: 120px;
  font-weight: 500;
}

.debugValue {
  color: rgba(255, 255, 255, 0.8);
  font-family: ui-monospace, SFMono-Regular, 'Cascadia Code', monospace;
}

.debugValue--success {
  color: rgb(34, 197, 94);
  font-weight: 500;
}

.debugValue--warning {
  color: rgb(251, 191, 36);
  font-weight: 500;
}

/* ─── Location Preview Map ─────────────────────────────────── */
.locationPreview {
  width: 100%;
  height: 200px;
  border-radius: var(--r-sm);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.4);
}

.locationPreview :deep(.leaflet-popup-content-wrapper) {
  background: rgba(15, 23, 42, 0.95);
  color: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  backdrop-filter: blur(10px);
}

.locationPreview :deep(.leaflet-popup-tip) {
  background: rgba(15, 23, 42, 0.95);
}

.locationPreview :deep(.leaflet-tooltip) {
  background: rgba(15, 23, 42, 0.95);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

.shop-marker {
  border: none !important;
  background: transparent !important;
}

/* ─── Responsive Adjustments ────────────────────────────────── */
@media (max-width: 720px) {
.infoGrid {
grid-template-columns: 1fr;
}
.editableSection {
padding: 12px;
}

.locationStatus {
  flex-direction: column;
  gap: 12px;
}

.locationStatus__icon {
  align-self: flex-start;
}

.locationPreview {
  height: 150px;
}

.debugItem {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.debugLabel {
  min-width: unset;
  font-size: 12px;
}
}
</style>