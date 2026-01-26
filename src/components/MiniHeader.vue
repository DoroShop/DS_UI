<script setup lang="ts">
import {
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ArrowLeftIcon,
} from "@heroicons/vue/24/outline";
import { useRouter } from "vue-router";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const { isDark } = useTheme();

const goBack = () => {
  router.back();
};

const goToSearch = () => {
  router.push("/products/search");
};

const goToCart = () => {
  router.push("/cart"); // ✅ Fixed
};
</script>


<template>
  <header class="product-header-nav">
    <div class="header-container">
      <div class="header-left">
        <button @click="goBack" class="header-back-btn">
          <ArrowLeftIcon class="icon" />
        </button>
      </div>

      <div class="header-center">
        <div class="search-container">
          <div class="search-input-wrapper">
            <MagnifyingGlassIcon class="search-icon" />
            <input type="text" placeholder="Search products..." class="search-input" @click="goToSearch" readonly />
          </div>
        </div>
      </div>

      <div class="header-right">
        <button @click="goToCart" class="header-cart-btn">
          <ShoppingCartIcon class="icon" />
          <span class="cart-badge">{{ 1 + 1 }}</span>
        </button>
      </div>
    </div>
  </header>
</template>


<style scoped>
.product-header-nav {
  width: 100%;
  background-color: var(--surface);
  box-shadow: var(--shadow-small);
  position: sticky;
  top: 0;
  z-index: 11;
  max-width: 1200px;
  margin: 0 auto;
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.header-container {
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 10px;
  gap: 10px;
  align-items: center;
}


.header-left,
.header-right {
  width: fit-content;
  height: 100%;
  display: flex;
  align-items: center;
}

.header-back-btn {
  padding: 0px 0px;
  display: flex;
  align-items: center;
  height: 100%;
  background-color: transparent;
  border: 0;
  outline: 0;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.header-back-btn:hover {
  color: var(--primary-color);
}

.cart-icon {
  width: 18px;
  height: 18px;
}

.search-icon {
  height: 1rem;
}

.icon {
  height: 1.5rem;
}

.header-center {
  flex: 1 1 auto;
  display: flex;
}

.search-container {
  flex: 1 1 auto;

  display: flex;
}

.header-right {
  padding: 0px 5px;
}

.search-input-wrapper {
  display: flex;
  flex: 1 1 auto;
  background-color: var(--bg-secondary);
  border-radius: 10px;
  overflow: hidden;
  align-items: center;
  padding: 0 10px;
  gap: 5px;
  border: 2px solid var(--primary-color);
  box-shadow: var(--shadow-small);
  transition: all var(--transition-fast);
}

.search-input {
  flex: 1 1 auto;
  display: flex;
  border: 0;
  outline: none;
  background-color: transparent;
  padding: 10px 0;
  color: var(--text-primary);
  transition: color var(--transition-fast);
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.7;
}

.header-cart-btn {
  background-color: transparent;
  border: 0;
  color: var(--secondary-color);
  position: relative;
  margin-top: 5px;
  cursor: pointer;
}

.header-cart-btn .icon {
  height: 1.7rem;
}

.cart-badge {
  position: absolute;
  font-size: clamp(10.78px, 2.5vw, 13px);
  top: -7px;
  right: -7px;
  background-color: var(--secondary-color);
  border-radius: 50rem;
  color: white;
  width: clamp(24px, 3vw, 26px);
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  font-weight: 600;
  border: 2px solid var(--surface);
  transition: all var(--transition-fast);
}

@media (min-width: 767px) {
  .search-input-wrapper {
    padding: 8px 1rem;
  }
}
</style>