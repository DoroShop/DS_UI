<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import MobileNav from "./components/MobileNav.vue";
import ToastNotification from "./components/ToastNotification.vue";

const route = useRoute();
const keepAliveLookup = new Set(["Products", "Cart"]);
const keepAliveMax = 3;

const shouldDisplayMobileNav = computed(() => route.meta?.hideMobileNav !== true);
const shouldCacheRoute = (name) => (name ? keepAliveLookup.has(name) : false);
</script>

<template>
  <ToastNotification />

  <router-view v-slot="{ Component, route: activeRoute }">
    <keep-alive :max="keepAliveMax">
      <component
        v-if="Component && shouldCacheRoute(activeRoute?.name)"
        :is="Component"
        :key="activeRoute?.name ?? activeRoute?.fullPath"
      />
    </keep-alive>
    <component
      v-if="Component && !shouldCacheRoute(activeRoute?.name)"
      :is="Component"
      :key="activeRoute?.fullPath"
    />
  </router-view>

  <MobileNav v-if="shouldDisplayMobileNav" />
</template>
