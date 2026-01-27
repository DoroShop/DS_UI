<script setup>
import { ref, reactive, computed, nextTick, onMounted, watch } from "vue";
import { EyeIcon, EyeSlashIcon } from "@heroicons/vue/24/outline";
import { useAuthStore } from "../stores/authStores";
import { useLocationStore } from "../stores/locationStore";
import { useTheme } from "../composables/useTheme";

const authStore = useAuthStore();
const locationStore = useLocationStore();
const { isDark } = useTheme();
const view = ref("login");
const statusMsg = ref("");

function switchView(v) {
  view.value = v;
  statusMsg.value = "";
}

const loginForm = reactive({ email: "", password: "" });
const loginShowPw = ref(false);
const loginLoading = ref(false);

async function handleLogin() {
  await authStore.loginUser(loginForm.email, loginForm.password);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration Form with Cascading Location Selection
// ─────────────────────────────────────────────────────────────────────────────
const regForm = reactive({
  name: "",
  email: "",
  password: "",
  confirm: "",
  isVerified: true,
  phone: "",
  address: {
    street: "",
    region: "",
    regionCode: "",
    province: "",
    provinceCode: "",
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
 * - Sets region name and code
 * - Clears all child selections (province, city, barangay, zip)
 * - Fetches provinces for the selected region
 */
async function handleRegionChange(code) {
  // Clear all child selections first
  regForm.address.province = "";
  regForm.address.provinceCode = "";
  regForm.address.city = "";
  regForm.address.cityCode = "";
  regForm.address.barangay = "";
  regForm.address.barangayCode = "";
  regForm.address.zipCode = "";

  // Set new region
  regForm.address.regionCode = code;
  regForm.address.region = locationStore.regions.find((r) => r.code === code)?.name || "";

  // Fetch provinces if region selected
  if (code) {
    try {
      await locationStore.fetchProvinces(code);
    } catch (error) {
      console.error('[Auth] Failed to load provinces:', error);
    }
  }
}

/**
 * Handle province selection change
 * - Sets province name and code
 * - Clears child selections (city, barangay, zip)
 * - Fetches cities for the selected province
 */
async function handleProvinceChange(code) {
  // Clear child selections first
  regForm.address.city = "";
  regForm.address.cityCode = "";
  regForm.address.barangay = "";
  regForm.address.barangayCode = "";
  regForm.address.zipCode = "";

  // Set new province
  regForm.address.provinceCode = code;
  regForm.address.province = provincesForRegion.value.find((p) => p.code === code)?.name || "";

  // Fetch cities if province selected
  if (code) {
    try {
      await locationStore.fetchCities(code);
    } catch (error) {
      console.error('[Auth] Failed to load cities:', error);
    }
  }
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
// Lifecycle: Load regions on mount
// ─────────────────────────────────────────────────────────────────────────────
onMounted(() => {
  locationStore.fetchRegions().catch((err) => {
    console.error('[Auth] Failed to load regions on mount:', err);
  });
});

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
    regForm.address.regionCode &&
    regForm.address.provinceCode &&
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
      startResendCountdown();
    } else {
      console.error('❌ OTP request failed:', authStore.registerError);
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
    // Error will be handled by the store
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
      await authStore.loginUser(regForm.email, regForm.password);
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
<!-- 
        <div class="divider"><span>or continue with</span></div>
        <div class="social-row">
          <button type="button" class="btn social google" @click="handleGoogle">
            <img src="../assets/icons8-google-32.png" alt="">
            <p>Google</p>
          </button>
          <button type="button" class="btn social facebook" @click="handleFacebook">
            <img src="../assets/icons8-facebook-32.png" alt="">
            <p>Facebook</p>
          </button>
        </div> -->
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

        <!-- REGION SELECT -->
        <div class="form-group">
          <label class="select-label">Region</label>
          <select v-model="regForm.address.regionCode" @change="handleRegionChange($event.target.value)"
            :disabled="locationStore.loadingRegions" required>
            <option value="" disabled>
              {{ locationStore.loadingRegions ? 'Loading regions...' : 'Select Region' }}
            </option>
            <option v-for="region in locationStore.regions" :key="region.code" :value="region.code">
              {{ region.name }}
            </option>
          </select>
        </div>

        <!-- PROVINCE SELECT -->
        <div class="form-group">
          <label class="select-label">Province</label>
          <select v-model="regForm.address.provinceCode" @change="handleProvinceChange($event.target.value)"
            :disabled="!regForm.address.regionCode || locationStore.loadingProvinces" required>
            <option value="" disabled>
              {{ locationStore.loadingProvinces ? 'Loading provinces...' : 'Select Province' }}
            </option>
            <option v-for="province in provincesForRegion" :key="province.code" :value="province.code">
              {{ province.name }}
            </option>
          </select>
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
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.btn.social {
  padding: 0.6rem;
  border-radius: 6px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: #f1f1ea;
  color: #0f172a;
  transition: background 0.3s ease;

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
  color: #000000;
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
  color: #303030;
  margin-top: 0.25rem;
}
</style>
