<script setup lang="js">
import { defineEmits, computed, onMounted } from 'vue';
import { useUserStore } from '../stores/userStores';
import {
  WalletIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,

} from '@heroicons/vue/24/outline';

const emit = defineEmits(['closeWallet'])
const userStore = useUserStore()

const handleClose = () => {
  emit("closeWallet")
}

const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
}).format(amount || 0)

const balance = computed(() => formatCurrency(userStore.walletBalance))

onMounted(async () => {
  if (!userStore.userData) {
    await userStore.fetchUser()
  }
})

</script>

<template>
  <div class="wallet-card">
    <div class="wallet-header">
      <div class="header-content">
        <WalletIcon class="wallet-icon" />
        <h2 class="wallet-title">My Wallet</h2>
      </div>
      <button @click="handleClose" class="close-btn">
        <svg class="close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <div class="wallet-content">
      <div class="balance-section">
        <span class="balance-label">Available Balance</span>
        <div class="balance-amount">{{ balance }}</div>
        <div class="balance-subtitle">Wallet updates after refunds are processed.</div>
      </div>
      
      <!-- <div class="wallet-actions">
        <button class="action-btn primary">
          <ArrowUpCircleIcon class="btn-icon" />
          <span>Cash In</span>
        </button>
        <button class="action-btn secondary">
          <ArrowDownCircleIcon class="btn-icon" />
          <span>Withdraw</span>
        </button>
      </div> -->
      
      <!-- <div class="recent-activity">
        <h3 class="activity-title">Recent Activity</h3>
        <div class="activity-empty">Wallet activity will appear here after transactions or refunds.</div>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.wallet-card {
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid var(--border-primary);
  box-shadow: var(--card-shadow);
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
  width: 100%;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.wallet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: var(--color-primary-light);
  border-bottom: 1px solid var(--border-primary);
  transition: background-color 0.18s ease;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-icon {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  transition: color 0.18s ease;
}

.wallet-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  transition: color 0.18s ease;
}

.close-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background: var(--surface-hover);
}

.close-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  transition: color 0.18s ease;
}

.wallet-content {
  padding: 1.5rem;
}

.balance-section {
  text-align: center;
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, var(--color-primary) 0%, rgba(31, 139, 78, 0.3) 100%);
  border-radius: 12px;
  border: 1px solid var(--color-primary);
  color: var(--color-primary-text);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.balance-label {
  font-size: 0.875rem;
  color: var(--color-primary-text);
  font-weight: 500;
  display: block;
  margin-bottom: 0.5rem;
  opacity: 0.9;
}

.balance-amount {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary-text);
  letter-spacing: -0.02em;
  margin-bottom: 0.25rem;
  transition: color 0.18s ease;
}

.balance-subtitle {
  font-size: 0.75rem;
  color: var(--color-primary-text);
  opacity: 0.8;
}

.wallet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: var(--color-primary);
  color: var(--color-primary-text);
  border: 1px solid var(--color-primary);
}

.action-btn.primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.35);
}

.action-btn.secondary {
  background: var(--surface-active);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}

.action-btn.secondary:hover {
  background: var(--surface-hover);
  border-color: var(--border-secondary);
  transform: translateY(-1px);
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.recent-activity {
  border-top: 1px solid var(--border-primary);
  padding-top: 1.5rem;
}

.activity-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1rem 0;
  transition: color 0.18s ease;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.activity-empty {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-primary);
  border-radius: 8px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 0.9rem;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-primary);
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-icon.cash-in {
  background: var(--color-success-light);
  color: var(--color-success);
}

.activity-icon.withdraw {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.activity-icon svg {
  width: 18px;
  height: 18px;
}

.activity-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-type {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: color 0.18s ease;
}

.activity-date {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  transition: color 0.18s ease;
}

.activity-amount {
  font-size: 0.875rem;
  font-weight: 600;
}

.activity-amount.positive {
  color: var(--color-success);
}

.activity-amount.negative {
  color: var(--color-danger);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .wallet-card {
    max-width: none;
    border-radius: 0;
  }
  
  .wallet-header {
    padding: 1rem;
  }
  
  .wallet-content {
    padding: 1rem;
  }
  
  .balance-section {
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .balance-amount {
    font-size: 1.75rem;
  }
  
  .wallet-actions {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
}
</style>
