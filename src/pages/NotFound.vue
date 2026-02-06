<template>
  <section class="not-found" :class="themeClass">
    <div class="not-found__glow" aria-hidden="true"></div>
    <div class="not-found__content">
      <p class="not-found__eyebrow">404 · Missing Route</p>
      <h1>DoroShop can’t find that page.</h1>
      <p class="not-found__copy">
        The link you followed might be outdated, or the page was moved. Head back to the
        marketplace to keep browsing trusted sellers.
      </p>
      <div class="not-found__actions">
        <RouterLink class="not-found__button" to="/products">
          Browse Products
        </RouterLink>
        <RouterLink class="not-found__link" to="/support">
          Visit Help Center
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useTheme } from "../composables/useTheme";

const { isDark } = useTheme();
const themeClass = computed(() => (isDark.value ? "not-found--dark" : "not-found--light"));
</script>

<style scoped>
.not-found {
  --nf-bg: var(--bg-primary);
  --nf-surface: var(--surface);
  --nf-border: var(--border-primary, rgba(255, 255, 255, 0.15));
  --nf-text: var(--text-primary);
  --nf-copy: var(--text-secondary);
  --nf-primary: var(--color-primary, #1f8b4e);
  --nf-primary-contrast: var(--color-primary-text, #ffffff);
  --nf-glow-primary: rgba(31, 139, 78, 0.2);
  --nf-glow-secondary: rgba(56, 189, 248, 0.2);

  position: relative;
  min-height: 100vh;
  padding: 4rem 1.5rem;
  display: grid;
  place-items: center;
  background: var(--nf-bg);
  color: var(--nf-text);
  overflow: hidden;
  transition: background var(--theme-transition-duration) var(--theme-transition-timing);
}

.not-found--dark {
  --nf-glow-primary: rgba(31, 139, 78, 0.35);
  --nf-glow-secondary: rgba(96, 165, 250, 0.35);
  --nf-copy: var(--text-secondary);
}

.not-found--light {
  --nf-glow-primary: rgba(31, 139, 78, 0.15);
  --nf-glow-secondary: rgba(59, 130, 246, 0.15);
}

.not-found__glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, var(--nf-glow-primary), transparent 60%),
    radial-gradient(circle at 80% 0%, var(--nf-glow-secondary), transparent 55%),
    radial-gradient(circle at 50% 80%, rgba(255, 255, 255, 0.05), transparent 70%);
  filter: blur(6px);
  opacity: 0.9;
  z-index: 0;
  animation: pulse 10s ease-in-out infinite alternate;
}

.not-found__content {
  max-width: 640px;
  text-align: center;
  position: relative;
  z-index: 1;
  padding: 3rem 2.5rem;
  border-radius: 32px;
  background: color-mix(in srgb, var(--nf-surface) 95%, transparent);
  border: 1px solid color-mix(in srgb, var(--nf-border) 70%, transparent);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
  backdrop-filter: blur(10px);
}

.not-found__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  margin-bottom: 1rem;
  color: var(--nf-copy);
}

.not-found h1 {
  font-size: clamp(2.4rem, 5vw, 3.75rem);
  margin-bottom: 1rem;
  color: var(--nf-text);
}

.not-found__copy {
  color: var(--nf-copy);
  line-height: 1.7;
  margin-bottom: 2.5rem;
}

.not-found__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
}

.not-found__button,
.not-found__link {
  padding: 0.9rem 1.9rem;
  border-radius: 999px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid transparent;
}

.not-found__button {
  background: var(--nf-primary);
  color: var(--nf-primary-contrast);
  box-shadow: 0 10px 30px rgba(31, 139, 78, 0.35);
}

.not-found__button:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(31, 139, 78, 0.45);
}

.not-found__link {
  border-color: color-mix(in srgb, var(--nf-copy) 30%, transparent);
  color: var(--nf-copy);
  background: transparent;
}

.not-found__link:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--nf-copy) 55%, transparent);
}

@media (max-width: 600px) {
  .not-found {
    padding: 2.5rem 1rem;
  }

  .not-found__content {
    padding: 2.5rem 1.5rem;
    border-radius: 24px;
  }

  .not-found__actions {
    flex-direction: column;
  }
}

@keyframes pulse {
  0% {
    opacity: 0.85;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .not-found__button,
  .not-found__link,
  .not-found__glow {
    transition: none;
    animation: none;
  }
}
</style>
