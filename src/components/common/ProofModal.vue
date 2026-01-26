<template>
  <div v-if="show" class="proof-modal-overlay" @click="close">
    <div class="proof-modal" @click.stop>
      <div class="proof-modal-header">
        <h3 class="proof-modal-title">Payment Proof</h3>
        <button class="proof-modal-close" @click="close">✕</button>
      </div>
      <div class="proof-modal-body">
        <img :src="url" alt="Payment proof" class="proof-image" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
const props = defineProps({ show: Boolean, url: String });
const emit = defineEmits(['close']);

function close() {
  emit('close');
}
</script>

<style scoped>
.proof-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.proof-modal {
  width: 90%;
  max-width: 900px;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--card-shadow);
}
.proof-modal-header {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-primary);
  background: var(--bg-secondary);
}
.proof-modal-title { margin:0; font-weight:600; }
.proof-modal-close { background:none; border:none; cursor:pointer; font-size:1.25rem }
.proof-modal-body { display:flex; justify-content:center; padding: var(--spacing-md); }
.proof-image { max-width:100%; max-height:70vh; object-fit:contain; border-radius:var(--radius-md) }
</style>