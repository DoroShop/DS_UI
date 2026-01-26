<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const toasts = ref<Array<ToastOptions & { id: number }>>([]);
let toastId = 0;

const showToast = (options: ToastOptions) => {
  const id = toastId++;
  const toast = {
    id,
    message: options.message,
    type: options.type || 'success',
    duration: options.duration || 3000,
  };
  
  toasts.value.push(toast);
  
  setTimeout(() => {
    removeToast(id);
  }, toast.duration);
};

const removeToast = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
};

const getIcon = (type: string) => {
  switch (type) {
    case 'success': return CheckCircleIcon;
    case 'error': return XCircleIcon;
    case 'warning': return ExclamationCircleIcon;
    case 'info': return InformationCircleIcon;
    default: return CheckCircleIcon;
  }
};

// Expose showToast method globally
defineExpose({ showToast });

// Make it accessible globally via window
onMounted(() => {
  (window as any).__showToast = showToast;
});
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.type}`]"
        @click="removeToast(toast.id)"
      >
        <component :is="getIcon(toast.type)" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click.stop="removeToast(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 70px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: var(--surface, #ffffff);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  min-width: 300px;
  max-width: 400px;
  pointer-events: auto;
  cursor: pointer;
  border-left: 4px solid;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.toast:hover {
  transform: translateX(-5px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2), 0 6px 15px rgba(0, 0, 0, 0.15);
}

.toast-success {
  border-left-color: var(--primary-color, #1f8b4e);
  background: linear-gradient(to right, rgba(31, 139, 78, 0.05), var(--surface, #ffffff));
}

.toast-error {
  border-left-color: var(--secondary-color, #ff6600);
  background: linear-gradient(to right, rgba(255, 102, 0, 0.05), var(--surface, #ffffff));
}

.toast-warning {
  border-left-color: #f59e0b;
  background: linear-gradient(to right, rgba(245, 158, 11, 0.05), var(--surface, #ffffff));
}

.toast-info {
  border-left-color: #3b82f6;
  background: linear-gradient(to right, rgba(59, 130, 246, 0.05), var(--surface, #ffffff));
}

.toast-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.toast-success .toast-icon {
  color: var(--primary-color, #1f8b4e);
}

.toast-error .toast-icon {
  color: var(--secondary-color, #ff6600);
}

.toast-warning .toast-icon {
  color: #f59e0b;
}

.toast-info .toast-icon {
  color: #3b82f6;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  line-height: 1.4;
}

.toast-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666666);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #1a1a1a);
}

/* Toast animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(50px) scale(0.95);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Responsive */
@media (max-width: 640px) {
  .toast-container {
    bottom: 70px;
    right: 10px;
    left: 10px;
  }

  .toast {
    min-width: auto;
    width: 100%;
  }
}
</style>
