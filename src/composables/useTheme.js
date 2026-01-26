/**
 * useTheme.js
 * Global theme composable for Dark/Light mode management
 * Handles system preference detection, localStorage persistence, and CSS variable injection
 */

import { ref, computed, watch, onMounted } from 'vue';

const STORAGE_KEY = 'dashboard-theme';
const THEME_CLASS_PREFIX = 'theme-';

// Shared reactive state (singleton pattern)
const currentTheme = ref('light');
const isInitialized = ref(false);

/**
 * Detects the user's system color scheme preference
 * @returns {'light' | 'dark'}
 */
function detectSystemPreference() {
  if (typeof window === 'undefined') return 'light';
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  return mediaQuery.matches ? 'dark' : 'light';
}

/**
 * Reads theme from localStorage or falls back to system preference
 * @returns {'light' | 'dark'}
 */
function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  
  return detectSystemPreference();
}

/**
 * Applies theme to document by updating:
 * 1. CSS class on <html> element
 * 2. localStorage for persistence
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Remove old theme classes
  root.classList.remove(`${THEME_CLASS_PREFIX}light`, `${THEME_CLASS_PREFIX}dark`);
  
  // Add new theme class
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  
  // Update localStorage
  localStorage.setItem(STORAGE_KEY, theme);
  
  // Update meta theme-color for mobile browsers
  updateMetaThemeColor(theme);
}

/**
 * Updates the meta theme-color tag for mobile browser chrome
 * @param {string} theme - 'light' or 'dark'
 */
function updateMetaThemeColor(theme) {
  if (typeof document === 'undefined') return;
  
  let metaTag = document.querySelector('meta[name="theme-color"]');
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.name = 'theme-color';
    document.head.appendChild(metaTag);
  }
  
  // Match your dashboard primary colors
  metaTag.content = theme === 'dark' ? '#0c182e' : '#f8fafc';
}

/**
 * Main composable function
 * @returns {object} Theme management utilities
 */
export function useTheme() {
  // Initialize theme on first use
  if (!isInitialized.value) {
    const initial = getInitialTheme();
    currentTheme.value = initial;
    applyTheme(initial);
    isInitialized.value = true;
    
    // Listen for system preference changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        // Only auto-switch if user hasn't manually set a preference
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          const newTheme = e.matches ? 'dark' : 'light';
          currentTheme.value = newTheme;
          applyTheme(newTheme);
        }
      };
      
      // Modern API
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.addListener(handleChange);
      }
    }
  }
  
  // Computed properties
  const isDark = computed(() => currentTheme.value === 'dark');
  const isLight = computed(() => currentTheme.value === 'light');
  
  /**
   * Sets the theme to a specific value
   * @param {string} theme - 'light' or 'dark'
   */
  const setTheme = (theme) => {
    if (theme !== 'light' && theme !== 'dark') {
      console.warn(`Invalid theme: ${theme}. Using 'light' as fallback.`);
      theme = 'light';
    }
    
    currentTheme.value = theme;
    applyTheme(theme);
  };
  
  /**
   * Toggles between light and dark themes
   */
  const toggleTheme = () => {
    const newTheme = currentTheme.value === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };
  
  /**
   * Resets to system preference
   */
  const resetToSystem = () => {
    localStorage.removeItem(STORAGE_KEY);
    const systemTheme = detectSystemPreference();
    setTheme(systemTheme);
  };
  
  return {
    theme: currentTheme,
    isDark,
    isLight,
    setTheme,
    toggleTheme,
    resetToSystem
  };
}
