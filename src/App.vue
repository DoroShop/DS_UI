<script setup>
import MobileNav from './components/MobileNav.vue'
import ToastNotification from './components/ToastNotification.vue'

</script>

<template>
  <!-- Toast Notification System -->
  <ToastNotification />
  
  <!-- Keep components alive when navigating -->
  <router-view v-slot="{ Component }">
    <keep-alive :include="['Home', 'Cart', 'ViewProduct', 'ViewSeller', 'Search', 'ProductSearchResult', 'Orders']">
      <component :is="Component" />
    </keep-alive>
  </router-view>
  <MobileNav />
</template>
