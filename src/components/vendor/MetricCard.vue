<!-- components/MetricCard.vue -->
<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: String,
  value: [String, Number],
  change: Number,
  icon: {} || null,
  color: String,
});

// Compute icon background color based on color prop
const iconBgClass = computed(() => {
  const colorMap = {
    'bg-indigo': 'icon-indigo',
    'bg-green': 'icon-green',
    'bg-yellow': 'icon-yellow',
    'bg-orange': 'icon-orange',
    'bg-pink': 'icon-pink',
    'bg-blue': 'icon-blue',
  };
  return colorMap[props.color] || 'icon-default';
});
</script>

<template>
  <div class="metric-card">
    <div class="metric-icon-wrapper" :class="iconBgClass">
      <component :is="icon" class="metric-icon" v-if="icon" />
    </div>
    <div class="metric-content">
      <p class="metric-title">{{ title }}</p>
      <div class="metric-value-row">
        <span class="metric-number">{{ value }}</span>
        <span v-if="change !== undefined && change !== null" 
              class="metric-change" 
              :class="{ positive: change > 0, negative: change < 0 }">
          <svg v-if="change > 0" class="change-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
          </svg>
          <svg v-else-if="change < 0" class="change-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
          </svg>
          {{ Math.abs(change) }}%
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.metric-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-info));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-hover);
  border-color: var(--border-secondary);
}

.metric-card:hover::before {
  opacity: 1;
}

/* Icon wrapper with themed backgrounds */
.metric-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.metric-card:hover .metric-icon-wrapper {
  transform: scale(1.05);
}

.metric-icon {
  width: 24px;
  height: 24px;
  stroke-width: 2;
}

/* Icon color variants */
.icon-indigo {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.icon-green {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.icon-yellow {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.icon-orange {
  background: rgba(251, 146, 60, 0.1);
  color: #fb923c;
}

.icon-pink {
  background: rgba(236, 72, 153, 0.1);
  color: #ec4899;
}

.icon-blue {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.icon-default {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

/* Content */
.metric-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.metric-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.4;
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.metric-number {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -0.02em;
}

.metric-change {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  line-height: 1;
}

.change-icon {
  width: 14px;
  height: 14px;
}

.metric-change.positive {
  color: var(--color-success);
  background: var(--color-success-light);
}

.metric-change.negative {
  color: var(--color-danger);
  background: var(--color-danger-light);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .metric-card {
    padding: 1rem;
  }
  
  .metric-icon-wrapper {
    width: 40px;
    height: 40px;
  }
  
  .metric-icon {
    width: 20px;
    height: 20px;
  }
  
  .metric-number {
    font-size: 1.5rem;
  }
  
  .metric-title {
    font-size: 0.8125rem;
  }
}
.bg-indigo {
  background-color: #6365f1;
}

.bg-green {
  background-color: #22c55e;
}

.bg-yellow {
  background-color: #eab308;
}

.bg-orange {
  background-color: #f97316;
}

.bg-pink {
  background-color: #ec4899;
}
</style>
