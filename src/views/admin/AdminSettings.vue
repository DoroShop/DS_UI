<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAdminDashboardStore } from '../../stores/admin/adminDashboardStore';
import {
  Cog6ToothIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BellIcon,
  EnvelopeIcon,
  PaintBrushIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline';

const adminStore = useAdminDashboardStore();

const isLoading = ref(true);
const isSaving = ref(false);
const activeSection = ref('general');
const hasChanges = ref(false);
const saveSuccess = ref(false);

// Settings data
const settings = computed(() => adminStore.systemSettings);

// Local settings copy for editing
const localSettings = reactive({
  general: {
    siteName: 'DORODORO',
    siteDescription: 'Your one-stop marketplace for everything',
    supportEmail: 'support@dorodoro.com',
    supportPhone: '+234 800 000 0000',
    maintenanceMode: false,
  },
  commission: {
    defaultRate: 7,
    minimumRate: 3,
    maximumRate: 15,
    applyToAllCategories: true,
    categoryRates: [] as { categoryId: string; categoryName: string; rate: number }[],
  },
  orders: {
    autoConfirmDays: 7,
    returnWindowDays: 14,
    cancellationWindowHours: 24,
    requirePhoneVerification: true,
    requireEmailVerification: true,
  },
  sellers: {
    autoApproveProducts: false,
    requireDocumentVerification: true,
    minimumPayoutAmount: 5000,
    payoutSchedule: 'weekly',
    allowNewRegistrations: true,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    orderAlerts: true,
    promotionAlerts: true,
    systemAlerts: true,
  },
  security: {
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    sessionTimeoutMinutes: 60,
    requireTwoFactor: false,
    passwordMinLength: 8,
    requireSpecialChar: true,
  },
});

// Sections
const sections = [
  { id: 'general', label: 'General', icon: Cog6ToothIcon },
  { id: 'commission', label: 'Commission', icon: CurrencyDollarIcon },
  { id: 'orders', label: 'Orders', icon: DocumentTextIcon },
  { id: 'sellers', label: 'Sellers', icon: ShieldCheckIcon },
  { id: 'notifications', label: 'Notifications', icon: BellIcon },
  { id: 'security', label: 'Security', icon: ShieldCheckIcon },
];

// Payout schedule options
const payoutScheduleOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// Fetch settings
const fetchSettings = async () => {
  isLoading.value = true;
  try {
    await adminStore.fetchSystemSettings();
    // Merge fetched settings with defaults
    if (settings.value) {
      Object.assign(localSettings.general, settings.value.general || {});
      Object.assign(localSettings.commission, settings.value.commission || {});
      Object.assign(localSettings.orders, settings.value.orders || {});
      Object.assign(localSettings.sellers, settings.value.sellers || {});
      Object.assign(localSettings.notifications, settings.value.notifications || {});
      Object.assign(localSettings.security, settings.value.security || {});
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error);
  } finally {
    isLoading.value = false;
  }
};

// Save settings
const saveSettings = async () => {
  isSaving.value = true;
  saveSuccess.value = false;
  
  try {
    await adminStore.updateSystemSettings({
      general: localSettings.general,
      commission: localSettings.commission,
      orders: localSettings.orders,
      sellers: localSettings.sellers,
      notifications: localSettings.notifications,
      security: localSettings.security,
    });
    
    hasChanges.value = false;
    saveSuccess.value = true;
    
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings. Please try again.');
  } finally {
    isSaving.value = false;
  }
};

// Mark changes
const markChanged = () => {
  hasChanges.value = true;
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
};

onMounted(() => {
  fetchSettings();
});
</script>

<template>
  <div class="settings-page">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">System Settings</h1>
        <p class="page-subtitle">Configure platform settings and preferences</p>
      </div>
      <div class="header-actions">
        <div v-if="saveSuccess" class="save-success">
          <CheckIcon class="success-icon" />
          <span>Settings saved successfully</span>
        </div>
        <button 
          class="save-btn"
          :disabled="!hasChanges || isSaving"
          @click="saveSettings"
        >
          <ArrowPathIcon v-if="isSaving" class="btn-icon spinning" />
          <CheckIcon v-else class="btn-icon" />
          {{ isSaving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <!-- Unsaved Changes Warning -->
    <div v-if="hasChanges" class="changes-warning">
      <ExclamationTriangleIcon class="warning-icon" />
      <span>You have unsaved changes</span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>Loading settings...</p>
    </div>

    <div v-else class="settings-layout">
      <!-- Sidebar Navigation -->
      <aside class="settings-sidebar">
        <nav class="settings-nav">
          <button 
            v-for="section in sections" 
            :key="section.id"
            :class="['nav-item', { active: activeSection === section.id }]"
            @click="activeSection = section.id"
          >
            <component :is="section.icon" class="nav-icon" />
            <span>{{ section.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- Settings Content -->
      <main class="settings-content">
        <!-- General Settings -->
        <section v-show="activeSection === 'general'" class="settings-section">
          <div class="section-header">
            <Cog6ToothIcon class="section-icon" />
            <div>
              <h2>General Settings</h2>
              <p>Basic platform configuration</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="siteName">Site Name</label>
              <input 
                v-model="localSettings.general.siteName"
                type="text" 
                id="siteName"
                class="form-input"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group full-width">
              <label class="form-label" for="siteDescription">Site Description</label>
              <textarea 
                v-model="localSettings.general.siteDescription"
                id="siteDescription"
                class="form-textarea"
                rows="2"
                @input="markChanged"
              ></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="supportEmail">Support Email</label>
              <input 
                v-model="localSettings.general.supportEmail"
                type="email" 
                id="supportEmail"
                class="form-input"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="supportPhone">Support Phone</label>
              <input 
                v-model="localSettings.general.supportPhone"
                type="tel" 
                id="supportPhone"
                class="form-input"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Maintenance Mode</span>
                  <span class="toggle-description">Enable to put the site in maintenance mode</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.general.maintenanceMode"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Commission Settings -->
        <section v-show="activeSection === 'commission'" class="settings-section">
          <div class="section-header">
            <CurrencyDollarIcon class="section-icon" />
            <div>
              <h2>Commission Settings</h2>
              <p>Configure platform commission rates</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="defaultRate">Default Commission Rate (%)</label>
              <input 
                v-model.number="localSettings.commission.defaultRate"
                type="number" 
                id="defaultRate"
                class="form-input"
                min="0"
                max="100"
                @input="markChanged"
              />
              <span class="form-hint">Current: {{ localSettings.commission.defaultRate }}%</span>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="minimumRate">Minimum Rate (%)</label>
              <input 
                v-model.number="localSettings.commission.minimumRate"
                type="number" 
                id="minimumRate"
                class="form-input"
                min="0"
                max="100"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="maximumRate">Maximum Rate (%)</label>
              <input 
                v-model.number="localSettings.commission.maximumRate"
                type="number" 
                id="maximumRate"
                class="form-input"
                min="0"
                max="100"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Apply to All Categories</span>
                  <span class="toggle-description">Use the default rate for all product categories</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.commission.applyToAllCategories"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
          
          <div class="info-box">
            <CurrencyDollarIcon class="info-icon" />
            <div>
              <strong>Commission Calculation</strong>
              <p>Commission is calculated as {{ localSettings.commission.defaultRate }}% of the order subtotal (excluding shipping) and deducted from seller payouts.</p>
            </div>
          </div>
        </section>

        <!-- Orders Settings -->
        <section v-show="activeSection === 'orders'" class="settings-section">
          <div class="section-header">
            <DocumentTextIcon class="section-icon" />
            <div>
              <h2>Order Settings</h2>
              <p>Configure order processing rules</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="autoConfirmDays">Auto-confirm After (days)</label>
              <input 
                v-model.number="localSettings.orders.autoConfirmDays"
                type="number" 
                id="autoConfirmDays"
                class="form-input"
                min="1"
                @input="markChanged"
              />
              <span class="form-hint">Orders auto-confirm if buyer doesn't take action</span>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="returnWindowDays">Return Window (days)</label>
              <input 
                v-model.number="localSettings.orders.returnWindowDays"
                type="number" 
                id="returnWindowDays"
                class="form-input"
                min="0"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="cancellationWindowHours">Cancellation Window (hours)</label>
              <input 
                v-model.number="localSettings.orders.cancellationWindowHours"
                type="number" 
                id="cancellationWindowHours"
                class="form-input"
                min="0"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Require Phone Verification</span>
                  <span class="toggle-description">Buyers must verify phone before placing orders</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.orders.requirePhoneVerification"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Require Email Verification</span>
                  <span class="toggle-description">Buyers must verify email before placing orders</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.orders.requireEmailVerification"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Sellers Settings -->
        <section v-show="activeSection === 'sellers'" class="settings-section">
          <div class="section-header">
            <ShieldCheckIcon class="section-icon" />
            <div>
              <h2>Seller Settings</h2>
              <p>Configure seller requirements and payouts</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="minimumPayoutAmount">Minimum Payout Amount</label>
              <input 
                v-model.number="localSettings.sellers.minimumPayoutAmount"
                type="number" 
                id="minimumPayoutAmount"
                class="form-input"
                min="0"
                @input="markChanged"
              />
              <span class="form-hint">{{ formatCurrency(localSettings.sellers.minimumPayoutAmount) }}</span>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="payoutSchedule">Payout Schedule</label>
              <select 
                v-model="localSettings.sellers.payoutSchedule"
                id="payoutSchedule"
                class="form-select"
                @change="markChanged"
              >
                <option v-for="option in payoutScheduleOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Auto-approve Products</span>
                  <span class="toggle-description">Skip product review and automatically approve listings</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.sellers.autoApproveProducts"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Require Document Verification</span>
                  <span class="toggle-description">Sellers must submit business documents for verification</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.sellers.requireDocumentVerification"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Allow New Registrations</span>
                  <span class="toggle-description">Allow new sellers to register on the platform</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.sellers.allowNewRegistrations"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Notifications Settings -->
        <section v-show="activeSection === 'notifications'" class="settings-section">
          <div class="section-header">
            <BellIcon class="section-icon" />
            <div>
              <h2>Notification Settings</h2>
              <p>Configure platform notifications</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Email Notifications</span>
                  <span class="toggle-description">Send notifications via email</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.emailNotifications"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Push Notifications</span>
                  <span class="toggle-description">Send browser push notifications</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.pushNotifications"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">SMS Notifications</span>
                  <span class="toggle-description">Send notifications via SMS</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.smsNotifications"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="divider full-width">
              <span>Alert Types</span>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Order Alerts</span>
                  <span class="toggle-description">Notifications for new orders and status updates</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.orderAlerts"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Promotion Alerts</span>
                  <span class="toggle-description">Notifications for promotions and marketing</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.promotionAlerts"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">System Alerts</span>
                  <span class="toggle-description">Critical system notifications for admins</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.notifications.systemAlerts"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- Security Settings -->
        <section v-show="activeSection === 'security'" class="settings-section">
          <div class="section-header">
            <ShieldCheckIcon class="section-icon" />
            <div>
              <h2>Security Settings</h2>
              <p>Configure platform security options</p>
            </div>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="maxLoginAttempts">Max Login Attempts</label>
              <input 
                v-model.number="localSettings.security.maxLoginAttempts"
                type="number" 
                id="maxLoginAttempts"
                class="form-input"
                min="1"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="lockoutDuration">Lockout Duration (minutes)</label>
              <input 
                v-model.number="localSettings.security.lockoutDurationMinutes"
                type="number" 
                id="lockoutDuration"
                class="form-input"
                min="1"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="sessionTimeout">Session Timeout (minutes)</label>
              <input 
                v-model.number="localSettings.security.sessionTimeoutMinutes"
                type="number" 
                id="sessionTimeout"
                class="form-input"
                min="1"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label" for="passwordMinLength">Minimum Password Length</label>
              <input 
                v-model.number="localSettings.security.passwordMinLength"
                type="number" 
                id="passwordMinLength"
                class="form-input"
                min="6"
                @input="markChanged"
              />
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Require Two-Factor Authentication</span>
                  <span class="toggle-description">Require 2FA for all admin accounts</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.security.requireTwoFactor"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
            
            <div class="form-group full-width">
              <label class="toggle-card">
                <div class="toggle-info">
                  <span class="toggle-title">Require Special Character in Password</span>
                  <span class="toggle-description">Passwords must contain at least one special character</span>
                </div>
                <div class="toggle-wrapper">
                  <input 
                    type="checkbox"
                    v-model="localSettings.security.requireSpecialChar"
                    class="toggle-input"
                    @change="markChanged"
                  />
                  <span class="toggle-switch"></span>
                </div>
              </label>
            </div>
          </div>
          
          <div class="warning-box">
            <ExclamationTriangleIcon class="warning-icon" />
            <div>
              <strong>Security Notice</strong>
              <p>Changing security settings may affect all users. Ensure you understand the implications before making changes.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.page-subtitle {
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.save-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #16a34a;
  font-size: 0.875rem;
}

.success-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

.btn-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Changes Warning */
.changes-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fef3c7;
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
  color: #92400e;
  font-size: 0.875rem;
}

.warning-icon {
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 3px solid var(--border-primary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

/* Settings Layout */
.settings-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 2rem;
}

/* Sidebar */
.settings-sidebar {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 0.5rem;
  height: fit-content;
  position: sticky;
  top: 1rem;
}

.settings-nav {
  display: flex;
  flex-direction: column;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--color-primary);
  color: white;
}

.nav-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Settings Content */
.settings-content {
  background: var(--surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  padding: 1.5rem;
}

.settings-section {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.section-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-primary);
}

.section-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--color-primary);
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.section-header p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: span 2;
}

.form-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-input,
.form-textarea,
.form-select {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color 0.2s ease;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-textarea {
  resize: vertical;
}

.form-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Toggle Card */
.toggle-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle-card:hover {
  background: var(--border-primary);
}

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toggle-title {
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-description {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.toggle-wrapper {
  position: relative;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  display: block;
  width: 2.75rem;
  height: 1.5rem;
  background: var(--border-primary);
  border-radius: 999px;
  position: relative;
  transition: background 0.2s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 1.125rem;
  height: 1.125rem;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-input:checked + .toggle-switch {
  background: var(--color-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(1.25rem);
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: var(--text-tertiary);
  font-size: 0.75rem;
  text-transform: uppercase;
  margin: 1rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-primary);
}

/* Info Box */
.info-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #e0f2fe;
  border-radius: var(--radius-md);
  margin-top: 1.5rem;
}

.info-box .info-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #0284c7;
  flex-shrink: 0;
}

.info-box strong {
  display: block;
  color: #0369a1;
  margin-bottom: 0.25rem;
}

.info-box p {
  margin: 0;
  font-size: 0.85rem;
  color: #0369a1;
}

/* Warning Box */
.warning-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: #fef3c7;
  border-radius: var(--radius-md);
  margin-top: 1.5rem;
}

.warning-box .warning-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #d97706;
  flex-shrink: 0;
}

.warning-box strong {
  display: block;
  color: #92400e;
  margin-bottom: 0.25rem;
}

.warning-box p {
  margin: 0;
  font-size: 0.85rem;
  color: #92400e;
}

/* Responsive */
@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  
  .settings-sidebar {
    position: static;
  }
  
  .settings-nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .nav-item {
    flex: 0 0 auto;
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .header-actions {
    width: 100%;
    flex-direction: column;
  }
  
  .save-btn {
    width: 100%;
    justify-content: center;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .form-group.full-width {
    grid-column: span 1;
  }
  
  .divider.full-width {
    grid-column: span 1;
  }
}
</style>
