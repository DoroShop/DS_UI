<template>
  <div class="not-found-wrapper">
    <!-- Background layers -->
    <div class="not-found-bg"></div>
    <div class="not-found-overlay"></div>

    <!-- Content -->
    <div class="not-found-container">
      <!-- Logo -->
      <button class="logo" @click="goHome" title="Go to Home Page">
        <img src="../assets/DoroShop-colored-logo.png" alt="DoroShop Logo">
        <h1>DoroShop</h1>
      </button>

      <!-- Glass Card -->
      <div class="not-found-card">
        <div class="status-code">404</div>
        
        <div class="error-icon-wrapper">
          <svg class="error-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" 
                  fill="currentColor" opacity="0.2"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12 8v4m0 4h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>

        <h2 class="error-title">{{ errorTitle }}</h2>
        <p class="error-message">{{ errorMessage }}</p>

        <div class="error-details" v-if="errorContext">
          <span class="error-label">{{ errorContext }}</span>
        </div>

        <div class="action-buttons">
          <RouterLink to="/products" class="btn btn-primary">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 3h18v18H3z" stroke-width="2" stroke-linejoin="round"/>
              <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Browse Products
          </RouterLink>
          
          <button @click="goBack" class="btn btn-secondary">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Go Back
          </button>
        </div>

        <div class="help-links">
          <RouterLink to="/" class="help-link">Home</RouterLink>
          <span class="separator">·</span>
          <RouterLink to="/search" class="help-link">Search</RouterLink>
          <span class="separator">·</span>
          <RouterLink to="/user/me" class="help-link">My Account</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { useTheme } from "../composables/useTheme";

const route = useRoute();
const router = useRouter();
const { isDark } = useTheme();

// Determine error context from route query
const errorSource = computed(() => route.query.source);
const itemId = computed(() => route.query.id);

const errorTitle = computed(() => {
  switch (errorSource.value) {
    case 'product':
      return 'Product Not Found';
    case 'seller':
      return 'Shop Not Found';
    case 'order':
      return 'Order Not Found';
    default:
      return 'Page Not Found';
  }
});

const errorMessage = computed(() => {
  switch (errorSource.value) {
    case 'product':
      return 'The product you\'re looking for might have been removed, had its name changed, or is temporarily unavailable.';
    case 'seller':
      return 'This shop is no longer available or the link might be incorrect. Browse other trusted sellers in our marketplace.';
    case 'order':
      return 'We couldn\'t find this order. Please check your order history or contact support if you need assistance.';
    default:
      return 'The page you\'re looking for doesn\'t exist. It might have been moved or deleted.';
  }
});

const errorContext = computed(() => {
  if (itemId.value && errorSource.value) {
    return `${errorSource.value.toUpperCase()} ID: ${itemId.value}`;
  }
  return '';
});

const goHome = () => {
  router.push('/products');
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/products');
  }
};
</script>

<style scoped>
/* Premium Glassmorphism Design - matching Auth.vue */
.not-found-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
  position: relative;
  overflow: hidden;
  font-family: Inter, sans-serif;
}

/* Background image with gradient overlay */
.not-found-bg {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url('../assets/loginBackground.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.not-found-overlay {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(11, 19, 36, 0.88) 0%,
    rgba(11, 19, 36, 0.78) 50%,
    rgba(239, 68, 68, 0.2) 100%
  );
  z-index: 1;
}

/* Container */
.not-found-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 540px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

/* Logo */
.logo {
  display: flex;
  align-items: center;
  gap: -0.5rem;
  background: transparent;
  border: 0;
  cursor: pointer;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
  transition: transform 0.3s ease, filter 0.3s ease;
}

.logo:hover {
  transform: translateY(-2px);
  filter: drop-shadow(0 6px 18px rgba(239, 68, 68, 0.5));
}

.logo img {
  height: 5rem;
  margin-left: -0.8rem;
}

.logo h1 {
  color: #fff;
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Premium Glassmorphism Card */
.not-found-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  padding: 3rem 2.5rem;
  border-radius: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 2px 4px rgba(255, 255, 255, 0.05) inset;
  border: 1px solid rgba(255, 255, 255, 0.18);
  text-align: center;
  animation: cardFadeIn 0.6s ease-out;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Status Code */
.status-code {
  font-size: clamp(5rem, 12vw, 8rem);
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, #ef4444 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
  letter-spacing: -0.05em;
  text-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
}

/* Error Icon */
.error-icon-wrapper {
  margin: 1.5rem auto;
  width: 72px;
  height: 72px;
  position: relative;
}

.error-icon {
  width: 100%;
  height: 100%;
  color: #ef4444;
  filter: drop-shadow(0 4px 12px rgba(239, 68, 68, 0.4));
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}

/* Text Content */
.error-title {
  font-size: clamp(1.75rem, 3.5vw, 2.25rem);
  font-weight: 700;
  color: #ffffff;
  margin: 1.5rem 0 1rem;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.error-message {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 1.5rem;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Error Details */
.error-details {
  margin: 1.5rem 0;
  padding: 0.75rem 1.25rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  backdrop-filter: blur(10px);
}

.error-label {
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.02em;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 1rem;
  margin: 2rem 0 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.9rem 1.75rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  border: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  text-decoration: none;
}

.btn::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.btn:hover::before {
  opacity: 1;
}

.btn-primary {
  background: linear-gradient(135deg, #1f8b4e 0%, #22c55e 100%);
  color: #ffffff;
  box-shadow: 
    0 4px 16px rgba(31, 139, 78, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 6px 24px rgba(31, 139, 78, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15) inset;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.btn-icon {
  width: 18px;
  height: 18px;
  stroke-width: 2;
}

/* Help Links */
.help-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.help-link {
  color: rgba(255, 255, 255, 0.6);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.help-link:hover {
  color: rgba(255, 255, 255, 0.95);
  text-decoration: underline;
}

.separator {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 640px) {
  .not-found-card {
    padding: 2rem 1.5rem;
    backdrop-filter: blur(20px);
  }

  .logo img {
    height: 4rem;
  }

  .logo h1 {
    font-size: 1.5rem;
  }

  .status-code {
    font-size: 4.5rem;
  }

  .action-buttons {
    flex-direction: column;
    width: 100%;
  }

  .btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .not-found-wrapper {
    padding: 0.5rem;
  }

  .not-found-card {
    padding: 1.75rem 1.25rem;
    border-radius: 16px;
  }

  .error-icon-wrapper {
    width: 56px;
    height: 56px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found-card,
  .btn,
  .error-icon {
    animation: none;
    transition: none;
  }
}
</style>
