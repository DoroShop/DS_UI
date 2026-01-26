<script setup>
/**
 * ThemeToggle.vue
 * Accessible theme toggle component with icon, label, and smooth transitions
 * Supports keyboard navigation and ARIA attributes
 */

import { computed, ref } from 'vue';
import { SunIcon, MoonIcon } from '@heroicons/vue/24/outline';
import { useTheme } from '../composables/useTheme';

const { theme, isDark, toggleTheme } = useTheme();

// Props for customization
const props = defineProps({
  showLabel: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'medium', // 'small', 'medium', 'large'
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  }
});

// Computed classes
const buttonClasses = computed(() => [
  'theme-toggle',
  `theme-toggle--${props.size}`,
  isDark.value ? 'theme-toggle--dark' : 'theme-toggle--light'
]);

// Animation state
const isAnimating = ref(false);

const handleToggle = () => {
  if (isAnimating.value) return;
  
  isAnimating.value = true;
  toggleTheme();
  
  // Reset animation state after transition
  setTimeout(() => {
    isAnimating.value = false;
  }, 300);
};

// Computed label
const themeLabel = computed(() => 
  isDark.value ? 'Switch to Light Mode' : 'Switch to Dark Mode'
);
</script>

<template>
  <button
    :class="buttonClasses"
    :aria-label="themeLabel"
    :aria-pressed="isDark"
    type="button"
    @click="handleToggle"
    :disabled="isAnimating"
  >
    <!-- Icon container with transition -->
    <span class="theme-toggle__icon" :class="{ 'is-animating': isAnimating }">
      <Transition name="icon-fade" mode="out-in">
        <SunIcon v-if="!isDark" key="sun" class="theme-toggle__sun" />
        <MoonIcon v-else key="moon" class="theme-toggle__moon" />
      </Transition>
    </span>
    
    <!-- Optional label -->
    <span v-if="showLabel" class="theme-toggle__label">
      {{ isDark ? 'Dark' : 'Light' }}
    </span>
  </button>
</template>

<style scoped>
/**
 * Theme Toggle Component Styles
 * Uses CSS variables from themes.css for consistency
 */

.theme-toggle {
  /* Layout */
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  
  /* Appearance */
  background-color: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  
  /* Typography */
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
  font-family: var(--font-sans);
  
  /* Interaction */
  cursor: pointer;
  user-select: none;
  
  /* Transitions */
  transition: 
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
  
  /* Positioning */
  position: relative;
  overflow: hidden;
}

/* Hover state */
.theme-toggle:hover:not(:disabled) {
  background-color: var(--surface-hover);
  border-color: var(--border-secondary);
  box-shadow: var(--shadow-sm);
}

/* Active/Pressed state */
.theme-toggle:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: none;
}

/* Focus state for accessibility */
.theme-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-color: var(--color-primary);
}

/* Disabled state */
.theme-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Size variants */
.theme-toggle--small {
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  gap: 0.375rem;
}

.theme-toggle--small .theme-toggle__icon {
  width: 1rem;
  height: 1rem;
}

.theme-toggle--medium {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  gap: 0.5rem;
}

.theme-toggle--medium .theme-toggle__icon {
  width: 1.25rem;
  height: 1.25rem;
}

.theme-toggle--large {
  padding: 0.625rem 1rem;
  font-size: 1rem;
  gap: 0.625rem;
}

.theme-toggle--large .theme-toggle__icon {
  width: 1.5rem;
  height: 1.5rem;
}

/* Icon container */
.theme-toggle__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  position: relative;
}

.theme-toggle__icon.is-animating {
  pointer-events: none;
}

/* Icon styles */
.theme-toggle__sun,
.theme-toggle__moon {
  width: 100%;
  height: 100%;
  stroke-width: 2;
  position: absolute;
  top: 0;
  left: 0;
}

.theme-toggle__sun {
  color: #f59e0b; /* Warm sun color */
}

.theme-toggle__moon {
  color: #60a5fa; /* Cool moon color */
}

/* Label */
.theme-toggle__label {
  white-space: nowrap;
  color: var(--text-secondary);
  transition: color 0.15s ease;
}

.theme-toggle:hover .theme-toggle__label {
  color: var(--text-primary);
}

/* ============================================
   ICON TRANSITION ANIMATIONS
   ============================================ */

/* Fade transition */
.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.icon-fade-enter-from {
  opacity: 0;
  transform: scale(0.8) rotate(-45deg);
}

.icon-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) rotate(45deg);
}

.icon-fade-enter-to,
.icon-fade-leave-from {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}

/* ============================================
   THEME-SPECIFIC STYLES
   ============================================ */

/* Light mode specific */
.theme-toggle--light {
  /* Subtle gradient for light mode */
  background: linear-gradient(135deg, var(--surface) 0%, var(--bg-secondary) 100%);
}

/* Dark mode specific */
.theme-toggle--dark {
  /* Subtle gradient for dark mode */
  background: linear-gradient(135deg, var(--surface) 0%, var(--bg-tertiary) 100%);
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */

/* Mobile: Hide label on very small screens */
@media (max-width: 380px) {
  .theme-toggle__label {
    display: none;
  }
  
  .theme-toggle {
    padding: 0.5rem;
  }
}

/* Tablet and up: Full display */
@media (min-width: 640px) {
  .theme-toggle {
    min-width: 120px;
  }
}

/* ============================================
   ACCESSIBILITY ENHANCEMENTS
   ============================================ */

/* High contrast mode */
@media (prefers-contrast: high) {
  .theme-toggle {
    border: 2px solid currentColor;
  }
  
  .theme-toggle:focus-visible {
    outline-width: 3px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .theme-toggle,
  .theme-toggle__icon,
  .theme-toggle__sun,
  .theme-toggle__moon,
  .icon-fade-enter-active,
  .icon-fade-leave-active {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}

/* ============================================
   KEYBOARD NAVIGATION INDICATOR
   ============================================ */

/* Show clear focus for keyboard users */
.theme-toggle:focus:not(:focus-visible) {
  outline: none;
}

/* Pressed state visual feedback */
.theme-toggle[aria-pressed="true"] {
  background: var(--surface-hover);
}

/* ============================================
   LOADING/ANIMATION STATE
   ============================================ */

.theme-toggle:disabled .theme-toggle__icon {
  animation: subtle-pulse 1s ease-in-out infinite;
}

@keyframes subtle-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* ============================================
   COMPACT VARIANT (icon only)
   ============================================ */

.theme-toggle--compact {
  padding: 0.5rem;
  gap: 0;
}

.theme-toggle--compact .theme-toggle__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
