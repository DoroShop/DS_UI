/**
 * Auth Session Storage Utility
 * 
 * Handles persistence of registration and forgot password flow state across page refreshes.
 * Stores: current view, registration form data, forgot password data, and tokens.
 * 
 * @module authSessionStorage
 */

interface AuthSessionState {
  view: 'login' | 'register' | 'verify';
  regForm: {
    name: string;
    email: string;
    password: string;
    confirm: string;
    isVerified: boolean;
    phone: string;
    address: {
      street: string;
      region: string;
      regionCode: string;
      province: string;
      provinceCode: string;
      city: string;
      cityCode: string;
      barangay: string;
      barangayCode: string;
      zipCode: string;
    };
    acceptTos: boolean;
  };
  otpEmail: string;
  timestamp: number;
}

// NEW: Forgot password session state interface
interface ForgotPasswordSessionState {
  view: 'forgot-password' | 'forgot-otp' | 'reset-password';
  email: string;
  resetToken?: string;
  timestamp: number;
}

const STORAGE_KEY = 'doro_auth_session_state';
const FORGOT_PASSWORD_STORAGE_KEY = 'doro_forgot_password_session_state';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Save current auth session state to localStorage
 * Only saves if view is 'verify' or 'register' to avoid storing login view
 * 
 * @param view - Current view mode
 * @param regForm - Registration form data
 * @returns true if saved successfully, false otherwise
 */
export function saveAuthSessionState(
  view: 'login' | 'register' | 'verify',
  regForm: AuthSessionState['regForm']
): boolean {
  try {
    // Only persist registration/verify states, not login
    if (view === 'login') {
      clearAuthSessionState();
      return false;
    }

    const state: AuthSessionState = {
      view,
      regForm,
      otpEmail: regForm.email,
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log(`[AuthSession] State saved for view: ${view}`);
    return true;
  } catch (error) {
    console.error('[AuthSession] Failed to save session state:', error);
    return false;
  }
}

/**
 * Load and validate auth session state from localStorage
 * Returns null if state is expired, invalid, or doesn't exist
 * 
 * @returns Saved auth session state or null
 */
export function loadAuthSessionState(): AuthSessionState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const state: AuthSessionState = JSON.parse(stored);

    // Validate session hasn't expired
    const age = Date.now() - state.timestamp;
    if (age > SESSION_TIMEOUT) {
      console.log('[AuthSession] Session expired, clearing old state');
      clearAuthSessionState();
      return null;
    }

    // Validate required fields exist
    if (!state.view || !state.regForm || !state.otpEmail) {
      console.warn('[AuthSession] Invalid session state structure');
      clearAuthSessionState();
      return null;
    }

    // Only restore 'verify' or 'register' views (never restore 'login')
    if (state.view !== 'verify' && state.view !== 'register') {
      console.warn('[AuthSession] Invalid view state:', state.view);
      return null;
    }

    console.log(`[AuthSession] State restored for view: ${state.view}`);
    return state;
  } catch (error) {
    console.error('[AuthSession] Failed to load session state:', error);
    clearAuthSessionState();
    return null;
  }
}

/**
 * Clear auth session state from localStorage
 * Called after successful login or manual logout
 */
export function clearAuthSessionState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[AuthSession] Session state cleared');
  } catch (error) {
    console.error('[AuthSession] Failed to clear session state:', error);
  }
}

/**
 * Check if valid session state exists in storage
 * Useful for route guards or UI logic
 * 
 * @returns true if valid session exists and view is 'verify'
 */
export function hasActiveOtpSession(): boolean {
  const state = loadAuthSessionState();
  return state?.view === 'verify' && !!state?.otpEmail;
}

/**
 * Get saved OTP email if session is in verify state
 * 
 * @returns Email address or null
 */
export function getSavedOtpEmail(): string | null {
  const state = loadAuthSessionState();
  return state?.view === 'verify' ? state?.otpEmail || null : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD SESSION PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save forgot password session state to localStorage
 * 
 * @param view - Current forgot password view
 * @param email - User's email address
 * @param resetToken - Optional reset token (for reset-password view)
 * @returns true if saved successfully, false otherwise
 */
export function saveForgotPasswordSessionState(
  view: 'forgot-password' | 'forgot-otp' | 'reset-password',
  email: string,
  resetToken?: string
): boolean {
  try {
    const state: ForgotPasswordSessionState = {
      view,
      email,
      resetToken,
      timestamp: Date.now()
    };

    localStorage.setItem(FORGOT_PASSWORD_STORAGE_KEY, JSON.stringify(state));
    console.log(`[ForgotPasswordSession] State saved for view: ${view}, email: ${email}`);
    return true;
  } catch (error) {
    console.error('[ForgotPasswordSession] Failed to save session state:', error);
    return false;
  }
}

/**
 * Load forgot password session state from localStorage
 * Automatically clears expired or invalid sessions
 * 
 * @returns Forgot password session state or null
 */
export function loadForgotPasswordSessionState(): ForgotPasswordSessionState | null {
  try {
    const stored = localStorage.getItem(FORGOT_PASSWORD_STORAGE_KEY);
    if (!stored) return null;

    const state: ForgotPasswordSessionState = JSON.parse(stored);

    // Check if session has expired
    const age = Date.now() - state.timestamp;
    if (age > SESSION_TIMEOUT) {
      console.log('[ForgotPasswordSession] Session expired, clearing old state');
      clearForgotPasswordSessionState();
      return null;
    }

    // Validate required fields
    if (!state.view || !state.email) {
      console.warn('[ForgotPasswordSession] Invalid session state structure');
      clearForgotPasswordSessionState();
      return null;
    }

    // Validate view is one of the forgot password views
    const validViews = ['forgot-password', 'forgot-otp', 'reset-password'];
    if (!validViews.includes(state.view)) {
      console.warn('[ForgotPasswordSession] Invalid view state:', state.view);
      return null;
    }

    console.log(`[ForgotPasswordSession] State restored for view: ${state.view}, email: ${state.email}`);
    return state;
  } catch (error) {
    console.error('[ForgotPasswordSession] Failed to load session state:', error);
    clearForgotPasswordSessionState();
    return null;
  }
}

/**
 * Clear forgot password session state from localStorage
 * Called after successful password reset or manual cancellation
 */
export function clearForgotPasswordSessionState(): void {
  try {
    localStorage.removeItem(FORGOT_PASSWORD_STORAGE_KEY);
    console.log('[ForgotPasswordSession] Session state cleared');
  } catch (error) {
    console.error('[ForgotPasswordSession] Failed to clear session state:', error);
  }
}

/**
 * Check if valid forgot password session exists
 * 
 * @returns true if active forgot password session exists
 */
export function hasActiveForgotPasswordSession(): boolean {
  const state = loadForgotPasswordSessionState();
  return !!state && !!state.email;
}
