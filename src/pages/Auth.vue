<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from "vue";
import { EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/authStores";
import { useLocationStore } from "../stores/locationStore";
import { useTheme } from "../composables/useTheme";
import { useRoute, useRouter } from "vue-router";
import { 
  saveAuthSessionState, 
  loadAuthSessionState, 
  clearAuthSessionState,
  saveForgotPasswordSessionState,
  loadForgotPasswordSessionState,
  clearForgotPasswordSessionState
} from "../utils/authSessionStorage";

const authStore = useAuthStore();
const locationStore = useLocationStore();
const { isDark } = useTheme();
const route = useRoute();
const router = useRouter();
const view = ref("login");
const statusMsg = ref("");

/**
 * Switch between auth views (login/register/verify/forgot-password/forgot-otp/reset-password)
 * Saves the view state to localStorage for recovery on page refresh
 */
function switchView(v) {
  view.value = v;
  statusMsg.value = "";
  
  // Clear relevant error states when switching views
  if (v === "login") {
    authStore.loginError = null;
    clearAuthSessionState();
  } else if (v === "register") {
    authStore.registerError = null;
  } else if (v === "verify") {
    authStore.verifyError = null;
  } else if (v === "forgot-password") {
    authStore.forgotPasswordError = null;
  } else if (v === "forgot-otp") {
    authStore.forgotPasswordError = null;
  } else if (v === "reset-password") {
    authStore.resetPasswordError = null;
  }
  
  // Save view state to localStorage for persistence
  if (v !== "login") {
    if (v === "register" || v === "verify") {
      // Registration flow - save to auth session storage
      saveAuthSessionState(v, regForm);
    } else if (v === "forgot-password" || v === "forgot-otp" || v === "reset-password") {
      // Forgot password flow - save to forgot password session storage
      saveForgotPasswordSessionState(v, forgotPasswordForm.email, resetToken.value);
    }
  } else {
    // Login view - clear all session storage
    clearAuthSessionState();
    clearForgotPasswordSessionState();
  }
}

const loginForm = reactive({ email: "", password: "" });
const loginShowPw = ref(false);
const loginLoading = ref(false);

// NEW: Forgot password forms
const forgotPasswordForm = reactive({ email: "" });
const resetPasswordForm = reactive({ 
  newPassword: "", 
  confirmPassword: "" 
});
const forgotPasswordOtp = ref(["", "", "", "", "", ""]);
const forgotPasswordOtpRefs = ref([]);
const resetToken = ref("");
const resetShowPw = ref(false);
const resetShowPw2 = ref(false);

async function handleLogin() {
  // Get redirect URL from query parameters
  const redirectTo = route.query.redirect;
  await authStore.loginUser(loginForm.email, loginForm.password, redirectTo);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration Form with Cascading Location Selection
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// FIXED LOCATION DEFAULTS: MIMAROPA (Region IV-B) & Oriental Mindoro
// These are locked and cannot be changed by users in this version
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_REGION_CODE = 'REGION_IV_B';
const DEFAULT_REGION_NAME = 'Mimaropa (Region IV-B)';
const DEFAULT_PROVINCE_CODE = '1705200000'; // Oriental Mindoro PSGC code
const DEFAULT_PROVINCE_NAME = 'Oriental Mindoro';

const regForm = reactive({
  name: "",
  email: "",
  password: "",
  confirm: "",
  isVerified: true,
  phone: "",
  address: {
    street: "",
    region: DEFAULT_REGION_NAME,
    regionCode: DEFAULT_REGION_CODE,
    province: DEFAULT_PROVINCE_NAME,
    provinceCode: DEFAULT_PROVINCE_CODE,
    city: "",
    cityCode: "",
    barangay: "",
    barangayCode: "",
    zipCode: "",
  },
  acceptTos: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Location Selection State
// ─────────────────────────────────────────────────────────────────────────────

// Computed: Get filtered data based on current selections
const provincesForRegion = computed(() => {
  if (!regForm.address.regionCode) return [];
  return locationStore.getProvinces(regForm.address.regionCode);
});

const citiesForProvince = computed(() => {
  if (!regForm.address.provinceCode) return [];
  return locationStore.getCities(regForm.address.provinceCode);
});

const barangaysForCity = computed(() => {
  if (!regForm.address.cityCode) return [];
  return locationStore.getBarangays(regForm.address.cityCode);
});

// ─────────────────────────────────────────────────────────────────────────────
// Location Change Handlers (with proper cascade clearing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle region selection change
 * DISABLED: Region is locked to MIMAROPA for this version
 */
async function handleRegionChange(code) {
  console.warn('[Auth] Region change attempted but locked to MIMAROPA');
  // No-op - region locked to default
}

/**
 * Handle province selection change
 * DISABLED: Province is locked to Oriental Mindoro for this version
 */
async function handleProvinceChange(code) {
  console.warn('[Auth] Province change attempted but locked to Oriental Mindoro');
  // No-op - province locked to default
}

/**
 * Handle city selection change
 * - Sets city name and code
 * - Clears child selections (barangay, zip)
 * - Fetches barangays for the selected city
 */
async function handleCityChange(code) {
  // Clear child selections first
  regForm.address.barangay = "";
  regForm.address.barangayCode = "";
  regForm.address.zipCode = "";

  // Set new city
  regForm.address.cityCode = code;
  const selectedCity = citiesForProvince.value.find((c) => c.code === code);
  regForm.address.city = selectedCity?.name || "";

  // Auto-fill zip from city if available
  if (selectedCity?.zipCode) {
    regForm.address.zipCode = selectedCity.zipCode;
  }

  // Fetch barangays if city selected
  if (code) {
    try {
      await locationStore.fetchBarangays(code);
    } catch (error) {
      console.error('[Auth] Failed to load barangays:', error);
    }
  }
}

/**
 * Handle barangay selection change
 * - Sets barangay name and code
 * - Attempts to fetch/set zip code
 */
async function handleBarangayChange(code) {
  regForm.address.barangayCode = code;
  const barangay = barangaysForCity.value.find((b) => b.code === code);
  regForm.address.barangay = barangay?.name || "";

  // Try to get zip code if not already set
  if (regForm.address.cityCode && barangay?.name && !regForm.address.zipCode) {
    try {
      const zip = await locationStore.fetchZipCode(regForm.address.cityCode, barangay.name);
      if (zip) {
        regForm.address.zipCode = zip;
      }
    } catch (error) {
      console.warn('[Auth] Failed to load zip code:', error);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On component mount:
 * 1. Load regions (for reference)
 * 2. Auto-load provinces for MIMAROPA region
 * 3. Auto-load cities for Oriental Mindoro province
 * 4. Restore registration state from localStorage if user was in the middle of signup
 * 5. Reset OTP inputs if restoring to verify view
 */
onMounted(async () => {
  try {
    // Load regions (for completeness, though we don't show it)
    await locationStore.fetchRegions().catch((err) => {
      console.error('[Auth] Failed to load regions on mount:', err);
    });
    
    // Auto-load provinces for the locked MIMAROPA region
    console.log('[Auth] Auto-loading provinces for MIMAROPA...');
    await locationStore.fetchProvinces(DEFAULT_REGION_CODE);
    
    // Auto-load cities for the locked Oriental Mindoro province
    console.log('[Auth] Auto-loading cities for Oriental Mindoro...');
    await locationStore.fetchCities(DEFAULT_PROVINCE_CODE);
  } catch (error) {
    console.error('[Auth] Failed to auto-load location data:', error);
  }

  // Check if user has a saved registration session (was interrupted mid-signup)
  const savedState = loadAuthSessionState();
  if (savedState) {
    console.log(`[Auth] Restoring ${savedState.view} state from localStorage`);
    
    // Restore the view
    view.value = savedState.view;
    
    // Restore registration form data (but keep locked location values)
    Object.assign(regForm, savedState.regForm);
    
    // Ensure location fields stay locked to defaults
    regForm.address.region = DEFAULT_REGION_NAME;
    regForm.address.regionCode = DEFAULT_REGION_CODE;
    regForm.address.province = DEFAULT_PROVINCE_NAME;
    regForm.address.provinceCode = DEFAULT_PROVINCE_CODE;
    
    // If we're restoring to verify view, restart the resend countdown
    if (savedState.view === "verify") {
      startResendCountdown();
      // Clear OTP input fields (user needs to re-enter)
      otpDigits.value = ["", "", "", "", "", ""];
    }
  } else {
    // Check if user has a saved forgot password session
    const forgotPasswordState = loadForgotPasswordSessionState();
    if (forgotPasswordState) {
      console.log(`[Auth] Restoring forgot password ${forgotPasswordState.view} state from localStorage`);
      
      // Restore the view
      view.value = forgotPasswordState.view;
      
      // Restore email
      forgotPasswordForm.email = forgotPasswordState.email;
      
      // Restore reset token if available
      if (forgotPasswordState.resetToken) {
        resetToken.value = forgotPasswordState.resetToken;
      }
      
      // If we're restoring to forgot-otp view, restart the resend countdown
      if (forgotPasswordState.view === "forgot-otp") {
        startResendCountdown();
        // Clear OTP input fields (user needs to re-enter)
        forgotPasswordOtp.value = ["", "", "", "", "", ""];
      }
    }
  }
});

/**
 * Watch for successful login and clear persisted session data
 * This ensures we don't keep registration or forgot password data in localStorage after user is logged in
 */
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated && view.value !== "login") {
      console.log('[Auth] User authenticated, clearing saved session state');
      clearAuthSessionState();
      clearForgotPasswordSessionState();
      // Reset view to login for next visitor
      view.value = "login";
    }
  }
);

const regShowPw = ref(false);
const regShowPw2 = ref(false);

const canSubmitRegister = computed(() => {
  return (
    regForm.name &&
    regForm.email &&
    regForm.password.length >= 8 &&
    regForm.password === regForm.confirm &&
    regForm.phone &&
    regForm.address.street &&
    // Locked location validation - these should always be true
    regForm.address.regionCode === DEFAULT_REGION_CODE &&
    regForm.address.provinceCode === DEFAULT_PROVINCE_CODE &&
    regForm.address.cityCode &&
    regForm.address.barangay &&
    regForm.address.zipCode &&
    regForm.acceptTos
  );
});

async function handleRegister() {
  if (!canSubmitRegister.value) {
    console.log('❌ Registration form validation failed:', {
      canSubmit: canSubmitRegister.value,
      form: regForm
    });
    return;
  }

  try {
    console.log('🔄 Starting registration process for:', regForm.email);
    await authStore.requestOtp(regForm.email);
    await nextTick();

    // Only proceed if no error occurred
    if (!authStore.registerError) {
      console.log('✅ OTP sent successfully, switching to verify view');
      view.value = "verify";
      
      // Persist registration state and view to localStorage
      // This ensures user stays on verify page even after page refresh
      saveAuthSessionState("verify", regForm);
      
      startResendCountdown();
    } else {
      console.error('❌ OTP request failed:', authStore.registerError);
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
    // Error will be handled by the store
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Forgot Password Flow
// ─────────────────────────────────────────────────────────────────────────────
async function handleForgotPassword() {
  if (!forgotPasswordForm.email) return;

  try {
    await authStore.requestForgotPasswordOtp(forgotPasswordForm.email);
    if (!authStore.forgotPasswordError) {
      view.value = "forgot-otp";
      // Save state when proceeding to OTP view
      saveForgotPasswordSessionState("forgot-otp", forgotPasswordForm.email);
      startResendCountdown();
    }
  } catch (error) {
    console.error('Forgot password request failed:', error);
  }
}

const forgotPasswordOtpComplete = computed(() => 
  forgotPasswordOtp.value.every((d) => d)
);

function onForgotPasswordOtpInput(i) {
  forgotPasswordOtp.value[i] = forgotPasswordOtp.value[i].replace(/\D/g, "");
  if (forgotPasswordOtp.value[i] && i < forgotPasswordOtp.value.length - 1) {
    forgotPasswordOtpRefs.value[i + 1]?.focus();
  }
}

function onForgotPasswordKeyDown(e, i) {
  if (e.key === "Backspace" && !forgotPasswordOtp.value[i] && i > 0) {
    forgotPasswordOtpRefs.value[i - 1]?.focus();
  }
}

async function handleVerifyForgotPasswordOtp() {
  if (!forgotPasswordOtpComplete.value) return;

  try {
    const otp = forgotPasswordOtp.value.join("");
    const result = await authStore.verifyForgotPasswordOtp(forgotPasswordForm.email, otp);
    
    if (!authStore.forgotPasswordError && result.resetToken) {
      resetToken.value = result.resetToken;
      view.value = "reset-password";
      // Save state when proceeding to reset password view
      saveForgotPasswordSessionState("reset-password", forgotPasswordForm.email, resetToken.value);
    }
  } catch (error) {
    console.error('Forgot password OTP verification failed:', error);
  }
}

async function resendForgotPasswordOtp() {
  if (resendCountdown.value > 0) return;

  try {
    await authStore.requestForgotPasswordOtp(forgotPasswordForm.email);
    if (!authStore.forgotPasswordError) {
      statusMsg.value = "Password reset code resent";
      startResendCountdown();
    }
  } catch (error) {
    console.error('Failed to resend forgot password OTP:', error);
  }
}

const canSubmitResetPassword = computed(() => {
  return resetPasswordForm.newPassword.length >= 8 && 
         resetPasswordForm.newPassword === resetPasswordForm.confirmPassword;
});

async function handleResetPassword() {
  if (!canSubmitResetPassword.value) return;

  try {
    await authStore.resetPassword(
      forgotPasswordForm.email, 
      resetToken.value, 
      resetPasswordForm.newPassword
    );
    
    if (!authStore.resetPasswordError) {
      statusMsg.value = "Password reset successful! You can now login.";
      // Clear forms and redirect to login
      forgotPasswordForm.email = "";
      resetPasswordForm.newPassword = "";
      resetPasswordForm.confirmPassword = "";
      forgotPasswordOtp.value = ["", "", "", "", "", ""];
      resetToken.value = "";
      // Clear session state after successful reset
      clearForgotPasswordSessionState();
      view.value = "login";
    }
  } catch (error) {
    console.error('Password reset failed:', error);
  }
}

// OTP logic with auto-focus
const otpDigits = ref(["", "", "", "", "", ""]);
const inputRefs = ref([]);
const verifyLoading = ref(false);
const resendCountdown = ref(0);

const otpComplete = computed(() => otpDigits.value.every((d) => d));

function onOtpInput(i) {
  otpDigits.value[i] = otpDigits.value[i].replace(/\D/g, "");

  if (otpDigits.value[i] && i < otpDigits.value.length - 1) {
    inputRefs.value[i + 1]?.focus();
  }
}

function onKeyDown(e, i) {
  if (e.key === "Backspace" && !otpDigits.value[i] && i > 0) {
    inputRefs.value[i - 1]?.focus();
  }
}

async function handleVerify() {
  if (!otpComplete.value) return;

  try {
    let otp = otpDigits.value.join("");
    await authStore.verifyAndRegister({ ...regForm, otp });
    await nextTick();

    // Only attempt login if registration was successful
    if (!authStore.verifyError && !authStore.registerError) {
      console.log('✅ Registration verified successfully, logging in...');
      await authStore.loginUser(regForm.email, regForm.password);
      
      // Clear persisted session state after successful registration+login
      clearAuthSessionState();
    }
  } catch (error) {
    console.error('Verification error:', error);
    // Error will be displayed via store state
  }
}

function startResendCountdown() {
  resendCountdown.value = 350; // example: 125 seconds
  const interval = setInterval(() => {
    resendCountdown.value--;

    if (resendCountdown.value <= 0) {
      clearInterval(interval);
    }
  }, 1000);
}

function formatResendCountdown() {
  const time = resendCountdown.value;
  if (time >= 60) {
    const mins = Math.floor(time / 60);
    return `${mins}m`;
  } else {
    return `${time}s`;
  }
}

async function resendOtp() {
  if (resendCountdown.value > 0) return;

  try {
    await authStore.requestOtp(regForm.email);
    if (!authStore.registerError) {
      statusMsg.value = "OTP resent";
      // Update saved session state with current form data
      saveAuthSessionState("verify", regForm);
      startResendCountdown();
    }
  } catch (error) {
    console.error('Failed to resend OTP:', error);
  }
}

const statusClass = computed(() => ({ ok: true }));
function emitSuccessClose() {
  view.value = "login";
}

async function handleGoogle() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/v1';
  window.location.href = `${apiUrl}/user/google`;
}

async function handleFacebook() {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/v1';
  window.location.href = `${apiUrl}/user/facebook`;
}
</script>



<template>

  <div class="auth-wrapper" :data-mode="view">

    <div class="logo">
      <img src="../assets/DoroShop-colored-logo.png" alt="">
      <h1>DoroShop</h1>
    </div>
    <div class="auth-card">
      <nav class="auth-tabs" role="tablist">
        <button role="tab" :aria-selected="view === 'login'" :class="['auth-tab', { active: view === 'login' }]"
          @click="switchView('login')">

          <p>Login</p>
        </button>
        <button role="tab" :aria-selected="view === 'register'" :class="['auth-tab', { active: view === 'register' }]"
          @click="switchView('register')">
          Register
        </button>
      </nav>

      <!-- LOGIN -->
      <form v-if="view === 'login'" class="auth-form" autocomplete="on" @submit.prevent="handleLogin">
        <p v-if="authStore.loginError" class="login-error">
          {{ authStore.loginError }}
        </p>

        <div class="form-group floating-label">
          <input v-model.trim="loginForm.email" name="email" type="email" required placeholder=" "
            autocomplete="email" />
          <label>Email</label>
        </div>

        <div class="form-group floating-label password-group">
          <input :type="loginShowPw ? 'text' : 'password'" name="password" v-model.trim="loginForm.password" required
            placeholder=" " autocomplete="current-password" />
          <label>Password</label>
          <button type="button" class="pw-toggle" @click="loginShowPw = !loginShowPw">
            <component :is="loginShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>

        <button type="submit" class="btn primary full" :disabled="loginLoading">
          <p v-if="authStore.loading">Logging in...</p>
          <p v-else>Login</p>
        </button>

        <!-- NEW: Forgot Password Link -->
        <button type="button" class="forgot-password-link" @click="switchView('forgot-password')">
          Forgot Password?
        </button>

        <div class="divider"><span>or continue with</span></div>
        <div class="social-row">
          <button type="button" class="btn social google" @click="handleGoogle">
            <img src="../assets/icons8-google-32.png" alt="">
            <p>Google</p>
          </button>
          <!-- <button type="button" class="btn social facebook" @click="handleFacebook">
            <img src="../assets/icons8-facebook-32.png" alt="">
            <p>Facebook</p>
          </button> -->
        </div>
      </form>

      <!-- REGISTER -->
      <form v-else-if="view === 'register'" class="auth-form" @submit.prevent="handleRegister">

        <div class="form-group floating-label">
          <input v-model.trim="regForm.name" type="text" name="name" required placeholder=" " />
          <label>Full Name</label>
        </div>
        <div class="form-group floating-label">
          <input v-model.trim="regForm.email" name="email" :class="{ 'error-email-ipt': authStore.registerError }"
            type="email" required placeholder=" " />
          <label>Email</label>
        </div>
        <div class="form-group floating-label password-group">
          <input :type="regShowPw ? 'text' : 'password'" name="password" v-model.trim="regForm.password" required
            minlength="8" placeholder=" " />
          <label>Password</label>
          <button type="button" class="pw-toggle" @click="regShowPw = !regShowPw">
            <component :is="regShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>
        <div class="form-group floating-label password-group">
          <input :type="regShowPw2 ? 'text' : 'password'" v-model.trim="regForm.confirm" required minlength="8"
            placeholder=" " />
          <label>Confirm Password</label>
          <button type="button" class="pw-toggle" @click="regShowPw2 = !regShowPw2">
            <component :is="regShowPw2 ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>
        <div class="form-group floating-label">
          <input v-model.trim="regForm.phone" type="tel" name="tel" required placeholder=" " />
          <label>Phone Number</label>
        </div>

        <div class="form-group floating-label">
          <input v-model.trim="regForm.address.street" name="street" type="text" required placeholder=" " />
          <label>Street</label>
        </div>

        <!-- REGION SELECT - LOCKED TO MIMAROPA -->
        <div class="form-group">
          <label class="select-label">Region (Fixed)</label>
          <select v-model="regForm.address.regionCode" disabled required>
            <option :value="DEFAULT_REGION_CODE">
              {{ DEFAULT_REGION_NAME }}
            </option>
          </select>
          <small style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">
            🔒 Locked to {{ DEFAULT_REGION_NAME }} for this version
          </small>
        </div>

        <!-- PROVINCE SELECT - LOCKED TO ORIENTAL MINDORO -->
        <div class="form-group">
          <label class="select-label">Province (Fixed)</label>
          <select v-model="regForm.address.provinceCode" disabled required>
            <option :value="DEFAULT_PROVINCE_CODE">
              {{ DEFAULT_PROVINCE_NAME }}
            </option>
          </select>
          <small style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">
            🔒 Locked to {{ DEFAULT_PROVINCE_NAME }} for this version
          </small>
        </div>

        <!-- CITY/MUNICIPALITY SELECT -->
        <div class="form-group">
          <label class="select-label">City / Municipality</label>
          <select v-model="regForm.address.cityCode" @change="handleCityChange($event.target.value)"
            :disabled="!regForm.address.provinceCode || locationStore.loadingCities" required>
            <option value="" disabled>
              {{ locationStore.loadingCities ? 'Loading cities...' : 'Select City / Municipality' }}
            </option>
            <option v-for="city in citiesForProvince" :key="city.code" :value="city.code">
              {{ city.name }}
            </option>
          </select>
        </div>

        <!-- BARANGAY SELECT -->
        <div class="form-group">
          <label class="select-label">Barangay</label>
          <select v-model="regForm.address.barangayCode" @change="handleBarangayChange($event.target.value)"
            :disabled="!regForm.address.cityCode || locationStore.loadingBarangays" required>
            <option value="" disabled>
              {{ locationStore.loadingBarangays ? 'Loading barangays...' : 'Select Barangay' }}
            </option>
            <option v-for="barangay in barangaysForCity" :key="barangay.code" :value="barangay.code">
              {{ barangay.name }}
            </option>
          </select>
        </div>

        <!-- ZIP CODE -->
        <div class="form-group floating-label">
          <input v-model.trim="regForm.address.zipCode" name="zip-code" type="text" required placeholder=" "
            :disabled="locationStore.loadingZip" />
          <label>Zip Code {{ locationStore.loadingZip ? '(loading...)' : '' }}</label>
        </div>

        <p v-if="locationStore.error" class="login-error">{{ locationStore.error }}</p>
        <label class="checkbox-inline terms-box">
          <input type="checkbox" v-model="regForm.acceptTos" />
          <span>I agree to the Terms</span>
        </label>

        <!-- Debug info for development -->
        <div v-if="false"
          style="background: #f5f5f5; padding: 10px; margin: 10px 0; font-size: 12px; border-radius: 4px;">
          <strong>Form Validation Debug:</strong><br>
          Can Submit: {{ canSubmitRegister }}<br>
          Name: {{ !!regForm.name }}<br>
          Email: {{ !!regForm.email }}<br>
          Password (8+ chars): {{ regForm.password.length >= 8 }}<br>
          Passwords Match: {{ regForm.password === regForm.confirm }}<br>
          Phone: {{ !!regForm.phone }}<br>
          Street: {{ !!regForm.address.street }}<br>
          Barangay: {{ !!regForm.address.barangay }}<br>
          City: {{ !!regForm.address.city }}<br>
          Zip Code: {{ !!regForm.address.zipCode }}<br>
          Terms Accepted: {{ regForm.acceptTos }}<br>
        </div>

        <button type="submit" class="btn primary full" :disabled="!canSubmitRegister || authStore.loading">
          <p v-if="authStore.loading">Please wait...</p>
          <p v-else>Register</p>
        </button>
        <p v-if="authStore.registerError" class="login-error">
          {{ authStore.registerError }}
        </p>
      </form>

      <!-- OTP -->
      <div v-else-if="view === 'verify'" class="verify-wrapper">
        <h2>Verify Your Email</h2>
        <p>
          Enter the 6-digit code sent to {{ regForm.email }}.
        </p>

        <form class="otp-form" @submit.prevent="handleVerify">
          <p v-if="authStore.verifyError" class="login-error">
            {{ authStore.verifyError }}
          </p>
          <div class="otp-inputs">
            <input v-for="(d, i) in otpDigits" :key="i" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1"
              ref="inputRefs" v-model="otpDigits[i]" @input="onOtpInput(i)" @keydown="onKeyDown($event, i)"
              autocomplete="one-time-code" class="otp-box" />
          </div>
          <button type="button" class="linkish" @click="resendOtp" :disabled="resendCountdown > 0">
            Resend ({{ formatResendCountdown() }})
          </button>
          <button type="submit" class="btn primary verify" :disabled="!otpComplete || authStore.loading">
            <p v-if="authStore.loading">Verifying...</p>
            <p v-else>Verify</p>
          </button>
        </form>
      </div>

      <!-- NEW: Forgot Password Form -->
      <form v-else-if="view === 'forgot-password'" class="auth-form" @submit.prevent="handleForgotPassword">
        <h2>Forgot Password</h2>
        <p>Enter your email address and we'll send you a verification code to reset your password.</p>
        
        <p v-if="authStore.forgotPasswordError" class="login-error">
          {{ authStore.forgotPasswordError }}
        </p>

        <div class="form-group floating-label">
          <input v-model.trim="forgotPasswordForm.email" name="email" type="email" required placeholder=" " />
          <label>Email Address</label>
        </div>

        <button type="submit" class="btn primary full" :disabled="!forgotPasswordForm.email || authStore.loading">
          <p v-if="authStore.loading">Sending Code...</p>
          <p v-else>Send Reset Code</p>
        </button>

        <button type="button" class="linkish back-to-login" @click="switchView('login')">
          Back to Login
        </button>
      </form>

      <!-- NEW: Forgot Password OTP Verification -->
      <div v-else-if="view === 'forgot-otp'" class="verify-wrapper">
        <h2>Enter Reset Code</h2>
        <p>
          Enter the 6-digit code sent to {{ forgotPasswordForm.email }}.
        </p>

        <form class="otp-form" @submit.prevent="handleVerifyForgotPasswordOtp">
          <p v-if="authStore.forgotPasswordError" class="login-error">
            {{ authStore.forgotPasswordError }}
          </p>
          <div class="otp-inputs">
            <input v-for="(d, i) in forgotPasswordOtp" :key="i" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1"
              ref="forgotPasswordOtpRefs" v-model="forgotPasswordOtp[i]" @input="onForgotPasswordOtpInput(i)" 
              @keydown="onForgotPasswordKeyDown($event, i)" autocomplete="one-time-code" class="otp-box" />
          </div>
          <button type="button" class="linkish" @click="resendForgotPasswordOtp" :disabled="resendCountdown > 0">
            Resend Code ({{ formatResendCountdown() }})
          </button>
          <button type="submit" class="btn primary verify" :disabled="!forgotPasswordOtpComplete || authStore.loading">
            <p v-if="authStore.loading">Verifying...</p>
            <p v-else>Verify Code</p>
          </button>
          <button type="button" class="linkish back-to-login" @click="switchView('login')">
            Back to Login
          </button>
        </form>
      </div>

      <!-- NEW: Reset Password Form -->
      <form v-else-if="view === 'reset-password'" class="auth-form" @submit.prevent="handleResetPassword">
        <h2>Reset Password</h2>
        <p>Enter your new password.</p>
        
        <p v-if="authStore.resetPasswordError" class="login-error">
          {{ authStore.resetPasswordError }}
        </p>

        <div class="form-group floating-label password-group">
          <input :type="resetShowPw ? 'text' : 'password'" v-model.trim="resetPasswordForm.newPassword" required minlength="8" placeholder=" " />
          <label>New Password</label>
          <button type="button" class="pw-toggle" @click="resetShowPw = !resetShowPw">
            <component :is="resetShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>
        
        <div class="form-group floating-label password-group">
          <input :type="resetShowPw2 ? 'text' : 'password'" v-model.trim="resetPasswordForm.confirmPassword" required minlength="8" placeholder=" " />
          <label>Confirm New Password</label>
          <button type="button" class="pw-toggle" @click="resetShowPw2 = !resetShowPw2">
            <component :is="resetShowPw2 ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>

        <div v-if="resetPasswordForm.newPassword && resetPasswordForm.confirmPassword && resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword" 
             class="password-mismatch">
          Passwords do not match
        </div>

        <button type="submit" class="btn primary full" :disabled="!canSubmitResetPassword || authStore.loading">
          <p v-if="authStore.loading">Resetting Password...</p>
          <p v-else>Reset Password</p>
        </button>

        <button type="button" class="linkish back-to-login" @click="switchView('login')">
          Back to Login
        </button>
      </form>


      <p v-if="statusMsg" class="status-msg" :class="statusClass">{{ statusMsg }}</p>
    </div>
  </div>
</template>



<style scoped>
.auth-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  min-height: 100dvh;
  color: var(--text-primary);
  font-family: Inter, sans-serif;
  padding: 1rem;
  flex-direction: column;
  transition: all var(--transition-fast);
}

.logo {
  width: 100%;
  height: fit-content;
  display: flex;
  align-items: center;
  color: var(--primary-color);
  justify-content: center;
  margin-bottom: 1rem;
}

.logo h1 {
  margin-top: 10px;
}

.logo img {
  height: 6rem;
  aspect-ratio: 1;
  padding: 0;
  margin: 0;
  inset: 0;
  margin-left: -1rem;
}

.auth-card {
  background: var(--surface);
  padding: 2rem;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 8px 16px var(--shadow-color);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.auth-tab {
  background: transparent;
  border: 2px solid transparent;
  padding: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-primary);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.auth-tab:hover {
  background: var(--surface-hover);
}

.auth-tab.active {
  background: var(--primary-color);
  color: var(--text-inverse);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  position: relative;
  display: flex;
  flex-direction: column;
}

.floating-label input,
select {
  padding: 1rem 0.75rem;
  font-size: 1rem;
  width: 100%;
  background: var(--bg-primary);
  border: 2px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  box-sizing: border-box;
  transition: all var(--transition-fast);
}

.floating-label input:focus,
select:focus {
  border-color: var(--primary-color);
  outline: none;
  background: var(--surface);
}

.login-error {
  color: rgb(255, 62, 14) !important;
  font-size: 12px;
}


.floating-label label {
  position: absolute;
  left: 0.75rem;
  top: 1rem;
  color: var(--text-secondary);
  transition: 0.2s ease all;
  pointer-events: none;
}

.floating-label input:focus+label,
.floating-label input:not(:placeholder-shown)+label {
  top: -0.6rem;
  left: 0.5rem;
  font-size: 0.75rem;
  color: var(--primary-color);
  background: var(--surface);
  padding: 0 0.25rem;
  border-radius: 4px;
}

.select-label {
  margin-bottom: 0.4rem;
  color: var(--text-primary);
  font-weight: 500;
  transition: color var(--transition-fast);
}


.error-email-ipt {
  border: 1px solid rgb(255, 62, 14) !important;
}

.btn {
  display: flex;
  gap: 5px;
  align-items: center;
  justify-content: center;
}

.btn.primary {
  background: var(--primary-color);
  color: #fff;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.3s ease;
}

.verify {
  width: 100%;
  margin-top: 1rem;

}

.verify p {
  color: white !important;
}

.btn img {
  height: 1.35rem;
  aspect-ratio: 1;
}

.btn.primary:hover {
  background: #18693e;
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.divider {
  text-align: center;
  font-size: 0.875rem;
  color: rgb(104, 104, 104);
  position: relative;
  padding: 1rem 0;
}


.social-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.btn.social {
  padding: 0.6rem;
  border-radius: 6px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: #f1f1ea;

  transition: background 0.3s ease;

}

.social p{
  color: rgb(80, 80, 80);
}

.btn.social:hover {
  background: #f3f4f6;
}

.status-msg {
  text-align: center;
  font-size: 0.875rem;
  color: #34d399;
  margin-top: 1rem;
}

.pw-toggle {
  position: absolute;
  right: 0.75rem;
  top: 1.2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  padding: 0;
}

.pw-icon {
  width: 20px;
  height: 20px;
}

.linkish {
  background: none;
  border: none;
  color: var(--secondary-color);
  text-decoration: underline;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  cursor: pointer;
}

.otp-inputs {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 2rem 0;
}

.otp-inputs input {
  width: 2.5rem;
  height: 2.5rem;
  text-align: center;
  font-size: 1.25rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  background: #fff;
  color: #1e293b;
}

.verify-wrapper p {
  color: var(--text-primary);
  width: 100%;
  text-align: center;
}

.verify-wrapper h2,
.success-wrapper h2 {
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.success-wrapper {
  text-align: center;
}

.checkbox-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-top: 0.25rem;
}

/* NEW: Forgot Password Styles */
.forgot-password-link {
  background: none;
  border: none;
  color: var(--primary-color);
  text-decoration: underline;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
  margin: 0.5rem 0;
  text-align: center;
  width: 100%;
  transition: color 0.2s ease;
}

.forgot-password-link:hover {
  color: var(--primary-dark);
}

.back-to-login {
  color: var(--text-secondary);
  text-decoration: underline;
  font-size: 0.85rem;
  cursor: pointer;
  background: none;
  border: none;
  padding: 0.5rem 0;
  text-align: center;
  width: 100%;
  margin-top: 1rem;
  transition: color 0.2s ease;
}

.back-to-login:hover {
  color: var(--text-primary);
}

.password-mismatch {
  color: var(--error-color);
  font-size: 0.85rem;
  margin-top: 0.25rem;
  margin-bottom: 0.5rem;
}
</style>
