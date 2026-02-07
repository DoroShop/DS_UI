<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from "vue";
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon } from "@heroicons/vue/24/outline";
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

  // Smooth scroll the auth card back to top on view change
  nextTick(() => {
    const card = document.querySelector('.auth-card');
    if (card) card.scrollTo({ top: 0, behavior: 'smooth' });
    const form = card?.querySelector('.auth-form, .verify-wrapper');
    if (form) form.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
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

function goToHome() {
  router.push("/products");
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
 * DISABLED: Region is locked to MIMAROPA 
 */
async function handleRegionChange(code) {
  console.warn('[Auth] Region change attempted but locked to MIMAROPA');
  // No-op - region locked to default
}

/**
 * Handle province selection change
 * DISABLED: Province is locked to Oriental Mindoro 
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
    <div class="logo-bar">
      <button class="back-btn" @click="router.back()" title="Go Back">
        <ArrowLeftIcon class="back-icon" />
      </button>
      <button class="logo" @click="goToHome" title="Go to Home Page">
        <img src="../assets/DoroShop-colored-logo.png" alt="" />
        <h1>DoroShop</h1>
      </button>
    </div>

    <div class="auth-card">
      <nav class="auth-tabs" role="tablist">
        <button
          role="tab"
          :aria-selected="view === 'login'"
          :class="['auth-tab', { active: view === 'login' }]"
          @click="switchView('login')"
        >
          <p>Login</p>
        </button>

        <button
          role="tab"
          :aria-selected="view === 'register'"
          :class="['auth-tab', { active: view === 'register' }]"
          @click="switchView('register')"
        >
          Register
        </button>
      </nav>

      <!-- LOGIN -->
      <form v-if="view === 'login'" class="auth-form" autocomplete="on" @submit.prevent="handleLogin">
        <p v-if="authStore.loginError" class="login-error">{{ authStore.loginError }}</p>

        <div class="form-group floating-label">
          <input v-model.trim="loginForm.email" name="email" type="email" required placeholder=" " autocomplete="email" />
          <label>Email</label>
        </div>

        <div class="form-group floating-label password-group">
          <input
            :type="loginShowPw ? 'text' : 'password'"
            name="password"
            v-model.trim="loginForm.password"
            required
            placeholder=" "
            autocomplete="current-password"
          />
          <label>Password</label>
          <button type="button" class="pw-toggle" @click="loginShowPw = !loginShowPw" aria-label="Toggle password">
            <component :is="loginShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>

        <button type="button" class="linkish forgot" @click="switchView('forgot-password')">
          Forgot Password?
        </button>

        <button type="submit" class="btn primary full" :disabled="loginLoading">
          <span class="btn-text" v-if="authStore.loading">Logging in...</span>
          <span class="btn-text" v-else>Login</span>
        </button>

        <div class="divider"><span>or continue with</span></div>

        <div class="social-row">
          <button type="button" class="btn social google" @click="handleGoogle">
            <img src="../assets/icons8-google-32.png" alt="" />
            <span>Google</span>
          </button>
        </div>
      </form>

      <!-- REGISTER -->
      <form v-else-if="view === 'register'" class="auth-form" @submit.prevent="handleRegister">
        <!-- Personal Information Section -->
        <div class="form-section">
          <h3 class="form-section-title">Personal Information</h3>
          
          <div class="form-group floating-label">
            <input v-model.trim="regForm.name" type="text" name="name" required placeholder=" " />
            <label>Full Name</label>
          </div>

          <div class="form-group floating-label">
            <input
              v-model.trim="regForm.email"
              name="email"
              :class="{ 'error-email-ipt': authStore.registerError }"
              type="email"
              required
              placeholder=" "
            />
            <label>Email</label>
          </div>

          <div class="form-group floating-label">
            <input v-model.trim="regForm.phone" type="tel" name="tel" required placeholder=" " />
            <label>Phone Number</label>
          </div>
        </div>

        <!-- Security Section -->
        <div class="form-section">
          <h3 class="form-section-title">Security</h3>
          
          <div class="form-group floating-label password-group">
            <input
              :type="regShowPw ? 'text' : 'password'"
              name="password"
              v-model.trim="regForm.password"
              required
              minlength="8"
              placeholder=" "
            />
            <label>Password</label>
            <button type="button" class="pw-toggle" @click="regShowPw = !regShowPw" aria-label="Toggle password">
              <component :is="regShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
            </button>
          </div>

          <div class="form-group floating-label password-group">
            <input :type="regShowPw2 ? 'text' : 'password'" v-model.trim="regForm.confirm" required minlength="8" placeholder=" " />
            <label>Confirm Password</label>
            <button type="button" class="pw-toggle" @click="regShowPw2 = !regShowPw2" aria-label="Toggle password">
              <component :is="regShowPw2 ? EyeSlashIcon : EyeIcon" class="pw-icon" />
            </button>
          </div>
        </div>

        <!-- Address Section -->
        <div class="form-section">
          <h3 class="form-section-title">Address Information</h3>

          <div class="form-group floating-label">
            <input v-model.trim="regForm.address.street" name="street" type="text" required placeholder=" " />
            <label>Street Address</label>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="select-label">Region</label>
              <select v-model="regForm.address.regionCode" disabled required>
                <option :value="DEFAULT_REGION_CODE">{{ DEFAULT_REGION_NAME }}</option>
              </select>
              <small class="help">Fixed: {{ DEFAULT_REGION_NAME }}</small>
            </div>

            <div class="form-group">
              <label class="select-label">Province</label>
              <select v-model="regForm.address.provinceCode" disabled required>
                <option :value="DEFAULT_PROVINCE_CODE">{{ DEFAULT_PROVINCE_NAME }}</option>
              </select>
              <small class="help">Fixed: {{ DEFAULT_PROVINCE_NAME }}</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="select-label">City / Municipality</label>
              <select
                v-model="regForm.address.cityCode"
                @change="handleCityChange($event.target.value)"
                :disabled="!regForm.address.provinceCode || locationStore.loadingCities"
                required
              >
                <option value="" disabled>
                  {{ locationStore.loadingCities ? 'Loading cities...' : 'Select City / Municipality' }}
                </option>
                <option v-for="city in citiesForProvince" :key="city.code" :value="city.code">
                  {{ city.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="select-label">Barangay</label>
              <select
                v-model="regForm.address.barangayCode"
                @change="handleBarangayChange($event.target.value)"
                :disabled="!regForm.address.cityCode || locationStore.loadingBarangays"
                required
              >
                <option value="" disabled>
                  {{ locationStore.loadingBarangays ? 'Loading barangays...' : 'Select Barangay' }}
                </option>
                <option v-for="barangay in barangaysForCity" :key="barangay.code" :value="barangay.code">
                  {{ barangay.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-group floating-label">
            <input v-model.trim="regForm.address.zipCode" name="zip-code" type="text" required placeholder=" " :disabled="locationStore.loadingZip" />
            <label>Zip Code {{ locationStore.loadingZip ? '(loading...)' : '' }}</label>
          </div>
        </div>

        <p v-if="locationStore.error" class="login-error">{{ locationStore.error }}</p>

        <label class="checkbox-inline terms-box">
          <input type="checkbox" v-model="regForm.acceptTos" />
          <span>I agree to the Terms & Conditions</span>
        </label>

        <button type="submit" class="btn primary full" :disabled="!canSubmitRegister || authStore.loading">
          <span class="btn-text" v-if="authStore.loading">Creating Account...</span>
          <span class="btn-text" v-else>Create Account</span>
        </button>

        <p v-if="authStore.registerError" class="login-error">
          {{ authStore.registerError }}
        </p>

        <div class="divider"><span>or continue with</span></div>

        <div class="social-row">
          <button type="button" class="btn social google" @click="handleGoogle">
            <img src="../assets/icons8-google-32.png" alt="" />
            <span>Google</span>
          </button>
        </div>
      </form>

      <!-- OTP -->
      <div v-else-if="view === 'verify'" class="verify-wrapper">
        <div class="verify-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        
        <h2>Verify Your Email</h2>
        <p>Enter the 6-digit code sent to <strong>{{ regForm.email }}</strong></p>

        <form class="otp-form" @submit.prevent="handleVerify">
          <p v-if="authStore.verifyError" class="login-error">{{ authStore.verifyError }}</p>

          <div class="otp-inputs">
            <input
              v-for="(d, i) in otpDigits"
              :key="i"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              ref="inputRefs"
              v-model="otpDigits[i]"
              @input="onOtpInput(i)"
              @keydown="onKeyDown($event, i)"
              autocomplete="one-time-code"
              class="otp-box"
            />
          </div>

          <button type="button" class="linkish resend" @click="resendOtp" :disabled="resendCountdown > 0">
            {{ resendCountdown > 0 ? `Resend in ${formatResendCountdown()}` : 'Resend Code' }}
          </button>

          <button type="submit" class="btn primary full" :disabled="!otpComplete || authStore.loading">
            <span class="btn-text" v-if="authStore.loading">Verifying...</span>
            <span class="btn-text" v-else>Verify Email</span>
          </button>
        </form>
      </div>

      <!-- Forgot Password -->
      <form v-else-if="view === 'forgot-password'" class="auth-form" @submit.prevent="handleForgotPassword">
        <div class="verify-icon forgot-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        
        <h2 class="section-title">Forgot Password?</h2>
        <p class="section-subtitle">No worries! Enter your email and we'll send you a verification code to reset your password.</p>

        <p v-if="authStore.forgotPasswordError" class="login-error">{{ authStore.forgotPasswordError }}</p>

        <div class="form-group floating-label">
          <input v-model.trim="forgotPasswordForm.email" name="email" type="email" required placeholder=" " />
          <label>Email Address</label>
        </div>

        <button type="submit" class="btn primary full" :disabled="!forgotPasswordForm.email || authStore.loading">
          <span class="btn-text" v-if="authStore.loading">Sending Code...</span>
          <span class="btn-text" v-else>Send Reset Code</span>
        </button>

        <button type="button" class="linkish back" @click="switchView('login')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Login
        </button>
      </form>

      <!-- Forgot OTP -->
      <div v-else-if="view === 'forgot-otp'" class="verify-wrapper">
        <div class="verify-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        
        <h2>Enter Reset Code</h2>
        <p>Enter the 6-digit code sent to <strong>{{ forgotPasswordForm.email }}</strong></p>

        <form class="otp-form" @submit.prevent="handleVerifyForgotPasswordOtp">
          <p v-if="authStore.forgotPasswordError" class="login-error">{{ authStore.forgotPasswordError }}</p>

          <div class="otp-inputs">
            <input
              v-for="(d, i) in forgotPasswordOtp"
              :key="i"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="1"
              ref="forgotPasswordOtpRefs"
              v-model="forgotPasswordOtp[i]"
              @input="onForgotPasswordOtpInput(i)"
              @keydown="onForgotPasswordKeyDown($event, i)"
              autocomplete="one-time-code"
              class="otp-box"
            />
          </div>

          <button type="button" class="linkish resend" @click="resendForgotPasswordOtp" :disabled="resendCountdown > 0">
            {{ resendCountdown > 0 ? `Resend in ${formatResendCountdown()}` : 'Resend Code' }}
          </button>

          <button type="submit" class="btn primary full" :disabled="!forgotPasswordOtpComplete || authStore.loading">
            <span class="btn-text" v-if="authStore.loading">Verifying...</span>
            <span class="btn-text" v-else>Verify Code</span>
          </button>

          <button type="button" class="linkish back" @click="switchView('login')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Login
          </button>
        </form>
      </div>

      <!-- Reset Password -->
      <form v-else-if="view === 'reset-password'" class="auth-form" @submit.prevent="handleResetPassword">
        <div class="verify-icon reset-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        
        <h2 class="section-title">Create New Password</h2>
        <p class="section-subtitle">Your new password must be different from previously used passwords.</p>

        <p v-if="authStore.resetPasswordError" class="login-error">{{ authStore.resetPasswordError }}</p>

        <div class="form-group floating-label password-group">
          <input :type="resetShowPw ? 'text' : 'password'" v-model.trim="resetPasswordForm.newPassword" required minlength="8" placeholder=" " />
          <label>New Password</label>
          <button type="button" class="pw-toggle" @click="resetShowPw = !resetShowPw" aria-label="Toggle password">
            <component :is="resetShowPw ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>

        <div class="form-group floating-label password-group">
          <input :type="resetShowPw2 ? 'text' : 'password'" v-model.trim="resetPasswordForm.confirmPassword" required minlength="8" placeholder=" " />
          <label>Confirm New Password</label>
          <button type="button" class="pw-toggle" @click="resetShowPw2 = !resetShowPw2" aria-label="Toggle password">
            <component :is="resetShowPw2 ? EyeSlashIcon : EyeIcon" class="pw-icon" />
          </button>
        </div>

        <div
          v-if="resetPasswordForm.newPassword && resetPasswordForm.confirmPassword && resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword"
          class="password-mismatch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Passwords do not match
        </div>

        <button type="submit" class="btn primary full" :disabled="!canSubmitResetPassword || authStore.loading">
          <span class="btn-text" v-if="authStore.loading">Resetting Password...</span>
          <span class="btn-text" v-else>Reset Password</span>
        </button>

        <button type="button" class="linkish back" @click="switchView('login')">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 16px; height: 16px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Login
        </button>
      </form>

      <p v-if="statusMsg" class="status-msg" :class="statusClass">{{ statusMsg }}</p>
    </div>
  </div>
</template>

<style scoped>
/* =========================
   Modern Glassmorphism Theme
   ========================= */

.auth-wrapper {
  /* fallback theme vars (safe even if you already have :root vars) */
  --bg: #0b1324;
  --bg2: #0a1020;
  --glass: rgba(255, 255, 255, 0.08);
  --glass2: rgba(255, 255, 255, 0.06);
  --stroke: rgba(255, 255, 255, 0.14);
  --stroke2: rgba(255, 255, 255, 0.10);
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.72);
  --muted2: rgba(255, 255, 255, 0.56);
  --primary: #22c55e;
  --primary2: #1f8b4e;
  --ring: rgba(34, 197, 94, 0.18);

  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;

  padding: 24px 14px;
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;

  background: radial-gradient(1000px 600px at 20% 10%, rgba(34, 197, 94, 0.14), transparent 55%),
              radial-gradient(900px 500px at 85% 75%, rgba(72, 255, 202, 0.10), transparent 55%),
              linear-gradient(180deg, var(--bg), var(--bg2));
}

/* background image */
.auth-wrapper::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("../assets/loginBackground.png");
  background-size: cover;
  background-position: center;
  filter: saturate(1.05) contrast(1.05);
  z-index: 0;
}

/* overlay + vignette + subtle noise */
.auth-wrapper::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(800px 500px at 50% 40%, rgba(255,255,255,0.06), transparent 60%),
    radial-gradient(1000px 700px at 10% 90%, rgba(34,197,94,0.14), transparent 55%),
    radial-gradient(1200px 900px at 90% 10%, rgba(34,197,94,0.10), transparent 55%),
    linear-gradient(135deg, rgba(10,16,32,0.92) 0%, rgba(10,16,32,0.78) 45%, rgba(31,139,78,0.18) 100%);
  backdrop-filter: blur(2px);
}

/* =========================
   Logo
   ========================= */
.logo-bar {
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.back-btn:hover {
  background: rgba(255,255,255,0.12);
  border-color: rgba(34,197,94,0.45);
  color: #fff;
  transform: translateX(-2px);
}

.back-icon {
  width: 20px;
  height: 20px;
}

.logo {
  z-index: 2;
  border: 0;
  background: transparent;
  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  padding: 10px 12px;
  border-radius: 14px;

  transition: transform 0.25s ease, filter 0.25s ease, background 0.25s ease;
}

.logo:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.05);
  filter: drop-shadow(0 14px 30px rgba(0,0,0,0.35));
}

.logo img {
  height: 56px;
  width: 56px;
  object-fit: contain;
}

.logo h1 {
  margin: 0;
  margin-top: 10px;
  margin-left: -10px;
  font-size: 1.5rem;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 10px 30px rgba(0,0,0,0.45);
}

/* =========================
   Glass Card
   ========================= */
.auth-card {
  width: 100%;
  max-width: 520px;
  z-index: 2;

  background: linear-gradient(180deg, var(--glass), rgba(255,255,255,0.04));
  border-radius: 20px;
  padding: 20px;

  box-shadow:
    0 18px 70px rgba(0,0,0,0.55),
    0 1px 0 rgba(255,255,255,0.06) inset;

  position: relative;
  overflow: hidden;

  backdrop-filter: blur(22px) saturate(170%);
  -webkit-backdrop-filter: blur(22px) saturate(170%);

  transform: translateY(0);
  animation: cardIn 520ms ease-out;
}

/* gradient border (premium) */
.auth-card::before {
  content: "";
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg,
      rgba(34,197,94,0.45),
      rgba(255,255,255,0.22),
      rgba(34,197,94,0.18)
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.95;
}

.auth-card::after {
  content: "";
  position: absolute;
  inset: -80px;
  background:
    radial-gradient(closest-side at 30% 25%, rgba(34,197,94,0.16), transparent 70%),
    radial-gradient(closest-side at 75% 70%, rgba(255,255,255,0.08), transparent 70%);
  filter: blur(18px);
  opacity: 0.9;
  pointer-events: none;
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }

}

/* Smooth view transition wrapper */
.auth-card > *:not(.auth-tabs) {
  transition: opacity 0.28s ease, transform 0.28s ease;
}

/* =========================
   Tabs with sliding indicator
   ========================= */
.auth-tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;

  padding: 6px;
  border-radius: 16px;

  background: rgba(255,255,255,0.05);
  border: 1px solid var(--stroke2);
  box-shadow: 0 8px 30px rgba(0,0,0,0.25) inset;
  margin-bottom: 18px;
}

.auth-tabs::after {
  content: "";
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 6px;
  width: calc(50% - 3px);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(34,197,94,0.85), rgba(31,139,78,0.85));
  box-shadow: 0 10px 30px rgba(34,197,94,0.22);
  transform: translateX(0%);
  transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.auth-wrapper[data-mode="register"] .auth-tabs::after {
  transform: translateX(calc(100% + 6px));
}

/* for other views (forgot/verify/reset), keep indicator on left */
.auth-wrapper[data-mode="forgot-password"] .auth-tabs::after,
.auth-wrapper[data-mode="verify"] .auth-tabs::after,
.auth-wrapper[data-mode="forgot-otp"] .auth-tabs::after,
.auth-wrapper[data-mode="reset-password"] .auth-tabs::after {
  transform: translateX(0%);
}

.auth-tab {
  position: relative;
  z-index: 1;

  border: 0;
  background: transparent;
  color: var(--muted2);
  font-weight: 700;

  padding: 12px 10px;
  border-radius: 12px;

  cursor: pointer;
  transition: color 200ms ease, transform 200ms ease;
}

.auth-tab p {
  margin: 0;
  line-height: 1;
}

.auth-tab:hover {
  color: rgba(255,255,255,0.92);
  transform: translateY(-1px);
}

.auth-tab.active {
  color: #fff;
}

/* =========================
   Forms (scroll friendly)
   ========================= */
.auth-form,
.verify-wrapper {
  position: relative;
  z-index: 2;

  display: flex;
  flex-direction: column;
  gap: 14px;

  padding: 6px 8px 4px;
  max-height: min(72dvh, 620px);
  overflow: auto;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;

  /* Smooth view transitions */
  animation: formFadeIn 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes formFadeIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* pretty scrollbar */
.auth-form::-webkit-scrollbar,
.verify-wrapper::-webkit-scrollbar {
  width: 10px;
}
.auth-form::-webkit-scrollbar-thumb,
.verify-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.16);
  border-radius: 999px;
  border: 2px solid rgba(10,16,32,0.55);
}
.auth-form::-webkit-scrollbar-track,
.verify-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.section-title {
  margin: 8px 0 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
  text-align: center;
}
.section-subtitle {
  margin: 4px 0 12px;
  color: var(--muted);
  font-size: 0.93rem;
  line-height: 1.5;
  text-align: center;
}

/* =========================
   Form Sections
   ========================= */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.form-section-title {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-section-title::before {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* =========================
   Inputs + Floating Labels
   ========================= */
.form-group {
  width: 100%;
  display: grid;
  gap: 8px;
}

.floating-label {
  position: relative;
}

.floating-label input,
select {
  width: 100%;
  padding: 14px 14px;
  border-radius: 14px;

  border: 1px solid var(--stroke2);
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 15px;
  font-weight: 500;

  outline: none;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  box-shadow: 0 10px 30px rgba(0,0,0,0.18);
}

/* ─── SELECT DROPDOWN FIXES ─── */
select {
  appearance: none;
  background-color: rgba(15, 23, 42, 0.85);
  background-image:
    linear-gradient(45deg, transparent 50%, rgba(255,255,255,0.85) 50%),
    linear-gradient(135deg, rgba(255,255,255,0.85) 50%, transparent 50%);
  background-position:
    calc(100% - 18px) calc(50% - 3px),
    calc(100% - 12px) calc(50% - 3px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
  padding-right: 42px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.95);
}

/* Select dropdown options styling */
select option {
  background-color: #0f172a;
  color: rgba(255, 255, 255, 0.95);
  padding: 12px 14px;
  font-size: 15px;
  font-weight: 500;
}

select option:disabled {
  color: rgba(255, 255, 255, 0.45);
}

select option:checked,
select option:hover {
  background: linear-gradient(135deg, rgba(34,197,94,0.25), rgba(31,139,78,0.20));
  color: #fff;
}

select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: rgba(255, 255, 255, 0.55);
}

.floating-label input::placeholder {
  color: transparent;
}

.floating-label label {
  position: absolute;
  left: 14px;
  top: 14px;
  color: rgba(255,255,255,0.62);
  pointer-events: none;
  font-weight: 600;
  transition: all 160ms ease;
  padding: 0 6px;
  border-radius: 999px;
}

.floating-label input:focus,
select:focus {
  border-color: rgba(34,197,94,0.55);
  background: rgba(255,255,255,0.085);
  box-shadow:
    0 0 0 4px var(--ring),
    0 18px 45px rgba(0,0,0,0.28);
  transform: translateY(-1px);
}

.floating-label input:focus + label,
.floating-label input:not(:placeholder-shown) + label {
  top: -9px;
  left: 10px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.92);
  background: rgba(10,16,32,0.75);
  border: 1px solid rgba(34,197,94,0.35);
  backdrop-filter: blur(12px);
}

/* autofill fix */
input:-webkit-autofill {
  -webkit-text-fill-color: #fff !important;
  box-shadow: 0 0 0px 1000px rgba(255,255,255,0.06) inset !important;
  border: 1px solid var(--stroke2) !important;
}

/* ─── PASSWORD GROUP FIX ─── */
.password-group {
  position: relative;
}

.password-group input {
  padding-right: 56px; /* Make room for toggle button */
}

.pw-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 10px;

  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.72);
  cursor: pointer;

  display: grid;
  place-items: center;

  transition: transform 160ms ease, background 160ms ease, color 160ms ease, border-color 160ms ease;
}
.pw-toggle:hover {
  transform: translateY(-50%) scale(1.05);
  background: rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.95);
  border-color: rgba(255,255,255,0.18);
}
.pw-icon { width: 18px; height: 18px; }

/* selects label + helper */
.select-label {
  font-weight: 700;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.88);
}
.help {
  color: var(--muted2);
  font-size: 0.82rem;
  margin-top: -4px;
}

/* =========================
   Buttons
   ========================= */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  cursor: pointer;
  border-radius: 14px;
  transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease, background 180ms ease;
  user-select: none;
}

.btn.full { width: 100%; }

.btn.primary {
  padding: 14px 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;

  background: linear-gradient(135deg, rgba(34,197,94,1), rgba(31,139,78,1));
  box-shadow:
    0 16px 40px rgba(34,197,94,0.22),
    0 10px 25px rgba(0,0,0,0.35);
}

.btn.primary:hover {
  transform: translateY(-2px);
  filter: brightness(1.02);
  box-shadow:
    0 18px 55px rgba(34,197,94,0.26),
    0 14px 35px rgba(0,0,0,0.42);
}

.btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  filter: none;
}

.btn.social {
  padding: 12px 14px;
  width: 100%;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.16);
  box-shadow: 0 10px 25px rgba(0,0,0,0.18);
  color: rgba(255,255,255,0.92);
}

.btn.social:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.10);
}

.btn.social img { width: 18px; height: 18px; }

.btn-text { line-height: 1; }

/* =========================
   Divider
   ========================= */
.divider {
  position: relative;
  text-align: center;
  margin: 6px 0;
  color: var(--muted2);
  font-size: 0.88rem;
}
.divider span {
  padding: 0 12px;
  background: rgba(10,16,32,0.35);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 999px;
  backdrop-filter: blur(10px);
}
.divider::before,
.divider::after {
  content: "";
  position: absolute;
  top: 50%;
  width: 42%;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent);
}
.divider::before { left: 0; }
.divider::after  { right: 0; }

.social-row {
  display: grid;
  gap: 10px;
}

/* =========================
   Links
   ========================= */
.linkish {
  border: 0;
  background: transparent;
  color: rgba(34,197,94,0.95);
  cursor: pointer;
  font-weight: 700;
  text-decoration: none;
  padding: 8px 6px;
  border-radius: 10px;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.linkish:hover {
  background: rgba(34,197,94,0.10);
  color: rgba(74,222,128,1);
  transform: translateY(-1px);
}
.linkish.forgot { 
  margin-top: -6px;
  align-self: flex-end;
  font-size: 0.9rem;
}
.linkish.resend {
  font-size: 0.92rem;
}
.linkish.back { 
  color: rgba(255,255,255,0.70); 
  margin-top: 4px;
}
.linkish.back:hover { 
  color: rgba(255,255,255,0.95); 
  background: rgba(255,255,255,0.06); 
}

/* =========================
   Errors / Status
   ========================= */
.login-error {
  color: #ff8080;
  font-size: 0.88rem;
  background: rgba(255, 92, 92, 0.12);
  border: 1px solid rgba(255, 92, 92, 0.22);
  padding: 10px 12px;
  border-radius: 14px;
  backdrop-filter: blur(10px);
  line-height: 1.4;
}

.status-msg {
  margin-top: 10px;
  text-align: center;
  font-size: 0.92rem;
  color: rgba(74,222,128,1);
  background: rgba(74, 222, 128, 0.10);
  border: 1px solid rgba(74, 222, 128, 0.18);
  padding: 10px 12px;
  border-radius: 14px;
  backdrop-filter: blur(10px);
}

.password-mismatch {
  color: #ff8080;
  font-size: 0.88rem;
  background: rgba(255, 92, 92, 0.10);
  border: 1px solid rgba(255, 92, 92, 0.20);
  padding: 10px 12px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* =========================
   OTP & Verify
   ========================= */
.verify-wrapper {
  padding: 12px 8px;
}

.verify-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(31,139,78,0.12));
  border: 2px solid rgba(34,197,94,0.25);
  color: var(--primary);
}

.verify-icon svg {
  width: 32px;
  height: 32px;
}

.forgot-icon {
  background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.12));
  border-color: rgba(59,130,246,0.25);
  color: rgb(96, 165, 250);
}

.reset-icon {
  background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(147,51,234,0.12));
  border-color: rgba(168,85,247,0.25);
  color: rgb(192, 132, 252);
}

.verify-wrapper h2 {
  text-align: center;
  margin: 0 0 8px;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}
.verify-wrapper p {
  text-align: center;
  color: var(--muted);
  margin: 0 0 16px;
  line-height: 1.5;
}

.verify-wrapper p strong {
  color: var(--primary);
  font-weight: 700;
}

.otp-form { 
  display: flex; 
  flex-direction: column; 
  gap: 14px; 
}

/* ─── OTP INPUTS FIX ─── */
.otp-inputs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 4px 0;
  max-width: 380px;
  margin-left: auto;
  margin-right: auto;
}

.otp-box {
  width: 52px;
  height: 58px;
  flex-shrink: 0;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(255,255,255,0.06);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 900;
  text-align: center;
  outline: none;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
}

.otp-box:focus {
  border-color: rgba(34,197,94,0.55);
  background: rgba(255,255,255,0.085);
  box-shadow: 0 0 0 4px var(--ring);
  transform: translateY(-1px) scale(1.02);
}

/* =========================
   Checkbox
   ========================= */
.checkbox-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255,255,255,0.84);
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
}
.checkbox-inline input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}

.checkbox-inline span {
  font-size: 0.92rem;
}

/* =========================
   Focus visibility
   ========================= */
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--ring);
}

/* =========================
   Responsive
   ========================= */
@media (max-width: 520px) {
  .auth-card { 
    padding: 16px; 
    border-radius: 18px; 
  }
  .logo img { height: 50px; width: 50px; }
  .logo h1 { font-size: 1.35rem; }
  
  .otp-inputs { 
    gap: 6px;
    max-width: 100%;
  }
  .otp-box { 
    width: 48px;
    height: 54px; 
    font-size: 1.25rem; 
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  .form-section {
    padding: 14px 12px;
  }
  .verify-icon {
    width: 56px;
    height: 56px;
  }
  .verify-icon svg {
    width: 28px;
    height: 28px;
  }
  
  .pw-toggle {
    width: 38px;
    height: 38px;
  }
  .password-group input {
    padding-right: 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card { animation: none; }
  .auth-tab, .btn, input, select { transition: none; }
  .auth-form, .verify-wrapper { animation: none; }
  .auth-card > *:not(.auth-tabs) { transition: none; }
}
</style>