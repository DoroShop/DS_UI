<script setup>
import { ref, computed, reactive, watch } from 'vue'
import MetricCard from '../MetricCard.vue'
import {
  ChartBarIcon,
  ShoppingBagIcon,
  CubeIcon,
  InboxIcon,
  StarIcon,
  ArrowTrendingUpIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import { useVendorDashboardStore } from '../../../stores/vendor/dashboardStores'
import { formatToPHCurrency } from "../../../utils/currencyFormat.js"

const vendorDashboard = useVendorDashboardStore()
const vendorData = computed(() => vendorDashboard.vendor)


const metricCards = computed(() => [
  {
    title: 'Total Revenue',
    value: formattedTotalRevenue.value,
    change: revenueIncreasePercentage.value,
    icon: ChartBarIcon,
    color: 'bg-indigo',
  },
  {
    title: 'Total Orders',
    value: (vendorData.value?.totalOrders || 0).toLocaleString(),
    icon: ShoppingBagIcon,
    color: 'bg-green',
  },
  {
    title: 'Total Products',
    value: (vendorDashboard.vendorProducts?.length || 0).toLocaleString(),
    icon: CubeIcon,
    color: 'bg-yellow',
  },
  {
    title: 'Average Ratings',
    value: ((vendorData.value?.rating / vendorData.value?.numRatings) || 0).toFixed(1),
    icon: StarIcon,
    color: 'bg-orange',
  },
  {
    title: 'Profile Views',
    value: (vendorData.value?.profileViews || 0).toLocaleString(),
    icon: InboxIcon,
    color: 'bg-pink',
  },
  {
    title: 'Product Clicks',
    value: (vendorData.value?.productClicks || 0).toLocaleString(),
    icon: InboxIcon,
    color: 'bg-purple',
  },
])

console.log("Vendor Data in Analytics:", vendorData.value)

const tooltipStyle = computed(() => ({
  position: 'absolute',
  left: tooltip.x + 'px',
  top: tooltip.y + 'px',
  transform: 'translateX(-50%)',
  zIndex: 50
}))

const showTooltip = (event, value, period, monthName = '') => {
  tooltip.show = true
  tooltip.period = period
  tooltip.value = value
  tooltip.formattedValue = formatToPHCurrency(value)
  tooltip.monthName = monthName
  
  const chartContainer = event.target.closest('.chart-area') || event.target.closest('.line-chart-container')
  const containerRect = chartContainer?.getBoundingClientRect()
  
  if (containerRect) {
    // Position tooltip to follow cursor position more accurately
    tooltip.x = event.clientX - containerRect.left
    tooltip.y = event.clientY - containerRect.top + 600 // Slightly above cursor
  } else {
    // Fallback positioning
    const rect = event.target.getBoundingClientRect()
    tooltip.x = rect.left + (rect.width / 2)
    tooltip.y = rect.top - 40
  }
}

const hideTooltip = () => {
  tooltip.show = false
}
const tooltip = reactive({
  show: false,
  value: '',
  formattedValue: '',
  period: '',
  monthName: '',
  x: 0,
  y: 0
})


const currentYear = new Date().getFullYear()
const previousYear = currentYear - 1

const rawChartData = computed(() => vendorData.value?.monthlyRevenueComparison || [])

const parseValue = (val) => parseFloat(String(val || '0').replace(/,/g, '')) || 0

// Get current and previous year data from the new schema
const currentYearData = computed(() => {
  const data = rawChartData.value.find(data => data.year === currentYear)?.revenues || {}
  return data
})

const previousYearData = computed(() => {
  const data = rawChartData.value.find(data => data.year === previousYear)?.revenues || {}
  return data
})

// Convert the schema data to chart format
const chartDataRaw = computed(() => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December']
  
  return months.map(month => ({
    month,
    currentValue: currentYearData.value[month] || 0,
    previousValue: previousYearData.value[month] || 0,
    shortMonth: month.slice(0, 3)
  }))
})

const numericMax = computed(() => {
  if (!chartDataRaw.value.length) return 0
  return Math.max(...chartDataRaw.value.flatMap(d => [d.currentValue, d.previousValue]))
})

const maxCurrent = computed(() => {
  if (!chartDataRaw.value.length) return 0
  return Math.max(...chartDataRaw.value.map(d => d.currentValue))
})

const paddedMax = computed(() => {
  const step = 1000
  const max = numericMax.value
  const padding = max < 100000 ? 1 : 1.5
  return Math.ceil((max * padding || step) / step) * step
})

const yAxisSteps = computed(() => {
  const steps = []
  const stepSize = maxCurrent.value < 100000 ? 10000 : 30000
  for (let i = paddedMax.value; i >= 0; i -= stepSize) {
    steps.push(`₱${(i / 1000).toFixed(0)}k`)
  }
  return steps
})

const chartData = computed(() => {
  if (!chartDataRaw.value.length) return []

  return chartDataRaw.value.map(d => {
    const currentVal = parseValue(d.currentValue)
    const previousVal = parseValue(d.previousValue)
    const currentHeight = paddedMax.value === 0 ? 0 : Math.max((currentVal / paddedMax.value) * 100, 2)
    const previousHeight = paddedMax.value === 0 ? 0 : Math.max((previousVal / paddedMax.value) * 100, 2)

    return {
      ...d,
      currentValue: currentVal,
      previousValue: previousVal,
      currentHeight,
      previousHeight
    }
  })
})

// Calculate revenue change based on current month
const revenuechange = computed(() => {
  try {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' })
    const currentMonthRevenue = currentYearData.value?.[currentMonth] || 0
    const previousMonthRevenue = previousYearData.value?.[currentMonth] || 0
    
    if (previousMonthRevenue === 0) return 0
    return parseFloat(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue * 100).toFixed(1))
  } catch (error) {
    console.warn('Error calculating revenue change:', error)
    return 0
  }
})

const isRevenuePositive = computed(() => revenuechange.value >= 0)
const changeRevenueText = computed(() => `${isRevenuePositive.value ? '+' : ''}${revenuechange.value}% from last period`)

// Calculate total revenue across all years and months
const totalRevenueAllTime = computed(() => {
  if (!rawChartData.value.length) return 0
  
  let total = 0
  rawChartData.value.forEach(yearData => {
    if (yearData.revenues) {
      Object.values(yearData.revenues).forEach(monthRevenue => {
        total += monthRevenue || 0
      })
    }
  })
  
  return total
})

// Format revenue for display (₱500K, ₱1M, ₱1.2M, etc.)
const formatRevenueDisplay = (amount) => {
  if (amount >= 1000000) {
    const millions = amount / 1000000
    return `₱${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`
  } else if (amount >= 500000) {
    const thousands = amount / 1000
    return `₱${thousands.toFixed(0)}K`
  } else if (amount >= 1000) {
    const thousands = amount / 1000
    return `₱${thousands.toFixed(1)}K`
  } else {
    return formatToPHCurrency(amount)
  }
}

const formattedTotalRevenue = computed(() => formatRevenueDisplay(totalRevenueAllTime.value))

// Calculate current year revenue analytics
const currentYearTotalRevenue = computed(() => {
  if (!currentYearData.value) return 0
  
  return Object.values(currentYearData.value).reduce((total, monthRevenue) => {
    return total + (monthRevenue || 0)
  }, 0)
})

const previousYearsTotalRevenue = computed(() => {
  if (!rawChartData.value.length) return 0
  
  let total = 0
  rawChartData.value.forEach(yearData => {
    // Skip current year
    if (yearData.year !== currentYear && yearData.revenues) {
      Object.values(yearData.revenues).forEach(monthRevenue => {
        total += monthRevenue || 0
      })
    }
  })
  
  return total
})

const revenueIncreasePercentage = computed(() => {
  if (previousYearsTotalRevenue.value === 0) return 0
  
  const increase = ((currentYearTotalRevenue.value - previousYearsTotalRevenue.value) / previousYearsTotalRevenue.value) * 100
  return parseFloat(increase.toFixed(1))
})

const currentYearContributionPercentage = computed(() => {
  if (totalRevenueAllTime.value === 0) return 0
  
  const contribution = (currentYearTotalRevenue.value / totalRevenueAllTime.value) * 100
  return parseFloat(contribution.toFixed(1))
})

// Calculate current month revenue from monthlyRevenueComparison
const currentMonthRevenue = computed(() => {
  try {
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' })
    const currentYearRevenues = currentYearData.value
    
    if (!currentYearRevenues || !currentYearRevenues[currentMonth]) return 0
    
    return currentYearRevenues[currentMonth] || 0
  } catch (error) {
    console.warn('Error calculating current month revenue:', error)
    return 0
  }
})

// Calculate Compound Monthly Growth Rate (CMGR) and Average Monthly Growth
const averageMonthlyGrowth = computed(() => {
  try {
    const currentYearRevenues = currentYearData.value
    if (!currentYearRevenues || Object.keys(currentYearRevenues).length === 0) return 0
    
    // Get all months with revenue data (non-zero values) in chronological order
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    
    const revenueEntries = months
      .map(month => ({ month, revenue: currentYearRevenues[month] || 0 }))
      .filter(entry => entry.revenue > 0)
    
    if (revenueEntries.length < 2) return 0
    
    const firstMonthRevenue = revenueEntries[0].revenue
    const lastMonthRevenue = revenueEntries[revenueEntries.length - 1].revenue
    const numberOfMonths = revenueEntries.length
    
    // CMGR Formula: ((Last Month Revenue / First Month Revenue) ^ (1 / (Number of Months - 1))) - 1
    const cmgr = Math.pow(lastMonthRevenue / firstMonthRevenue, 1 / (numberOfMonths - 1)) - 1
    
    return parseFloat((cmgr * 100).toFixed(2))
  } catch (error) {
    console.warn('Error calculating CMGR:', error)
    return 0
  }
})

// Calculate Average of Individual Monthly Growth Rates
const averageIndividualGrowthRates = computed(() => {
  try {
    const currentYearRevenues = currentYearData.value
    if (!currentYearRevenues || Object.keys(currentYearRevenues).length === 0) return 0
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    
    const revenueEntries = months
      .map(month => ({ month, revenue: currentYearRevenues[month] || 0 }))
      .filter(entry => entry.revenue > 0)
    
    if (revenueEntries.length < 2) return 0
    
    // Calculate individual monthly growth rates
    const monthlyGrowthRates = []
    for (let i = 1; i < revenueEntries.length; i++) {
      const currentRevenue = revenueEntries[i].revenue
      const previousRevenue = revenueEntries[i - 1].revenue
      
      if (previousRevenue > 0) {
        const monthlyGrowthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100
        monthlyGrowthRates.push(monthlyGrowthRate)
      }
    }
    
    if (monthlyGrowthRates.length === 0) return 0
    
    // Calculate average of all monthly growth rates
    const avgGrowthRate = monthlyGrowthRates.reduce((sum, rate) => sum + rate, 0) / monthlyGrowthRates.length
    
    return parseFloat(avgGrowthRate.toFixed(2))
  } catch (error) {
    console.warn('Error calculating average individual growth rates:', error)
    return 0
  }
})

const isGrowthPositive = computed(() => averageMonthlyGrowth.value >= 0)
const growthChangeText = computed(() => {
  const cmgr = averageMonthlyGrowth.value
  const avgIndividual = averageIndividualGrowthRates.value
  
  return `CMGR: ${cmgr >= 0 ? '+' : ''}${cmgr}% | Avg: ${avgIndividual >= 0 ? '+' : ''}${avgIndividual}%`
})

// Chart type toggle
const chartType = ref('bar') // 'bar' or 'line'

// Profile image error handling
const imageError = ref(false)

const handleImageError = () => {
  imageError.value = true
}

// Reset image error when vendor data changes
watch(() => vendorData.value?.imageUrl, () => {
  imageError.value = false
})

const toggleChartType = () => {
  chartType.value = chartType.value === 'bar' ? 'line' : 'bar'
}

// Line chart calculations
const lineChartPoints = computed(() => {
  if (!chartData.value.length) return { current: '', previous: '' }
  
  const width = 600
  const height = 200
  const padding = 40
  
  const currentPoints = chartData.value.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / (chartData.value.length - 1)
    const y = height - padding - (d.currentHeight / 100) * (height - 2 * padding)
    return `${x},${y}`
  }).join(' ')
  
  const previousPoints = chartData.value.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / (chartData.value.length - 1)
    const y = height - padding - (d.previousHeight / 100) * (height - 2 * padding)
    return `${x},${y}`
  }).join(' ')
  
  return { current: currentPoints, previous: previousPoints }
})
</script>

<template>
  <div class="dashboard">
    <!-- <header class="mobile-header">
        <div class="mobile-header-content">
          <h1>Dashboard</h1>
          <div class="user-profile-mobile">
            <img
              src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150"
              alt="User" class="user-avatar-mobile">
          </div>
        </div>
      </header> -->
    <main class="main-content">
      <div class="content-wrapper">
        <!-- <header class="desktop-header">
            <div class="header-content">
              <h1>Dashboard Overview</h1>
            </div>
          </header> -->

        <div class="dashboard-grid">

          <div class="profile-card">
            <div class="profile-header">
              <div class="profile-image-container">
                <img
                  v-if="!imageError && vendorData?.imageUrl"
                  :src="vendorData?.imageUrl"
                  alt="Profile" 
                  class="profile-image"
                  @error="handleImageError">
                <div 
                  v-else 
                  class="profile-image profile-image-fallback"
                >
                  <UserCircleIcon class="profile-icon" />
                </div>
              </div>
              <h3>{{ vendorData?.storeName || "Loading..."}}</h3>
              <p class="profile-subtitle">Welcome Back</p>
            </div>
            <div class="profile-stats">
              <div class="stat">
                <span class="stat-number">{{ vendorData?.followers.length || 0}}</span>
                <span class="stat-label">Followers</span>
              </div>
              <!-- <div class="stat">
                <span class="stat-number">{{ vendorData?.profileViews || 0}}</span>
                <span class="stat-label">Profile Views</span>
              </div> -->
            </div>
          </div>

          <div class="metrics-grid">
            <MetricCard v-for="(card, index) in metricCards" :key="index" :title="card?.title" :value="card?.value"
              :change="card?.change" :icon="card?.icon" :color="card?.color" />
          </div>

          <div class="analytics-card">
            <div class="analytics-header">
              <div class="analytics-title">
                <h3>Revenue Analytics/Monthly</h3>
                <p>Monthly performance overview</p>
              </div>
            </div>

            <div class="analytics-summary">
              <div class="summary-item">
                <div class="summary-icon revenue">
                  <ArrowTrendingUpIcon />
                </div>
                <div class="summary-content">
                  <span class="summary-label">Current Monthly Revenue</span>
                  <span class="summary-value current-month-revenue">{{ formatToPHCurrency(currentMonthRevenue) }}</span>
                  <span :class="[isRevenuePositive ? 'positive' : 'negative', 'summary-change']">
                    {{ changeRevenueText }}
                  </span>

                </div>
              </div>

              <div class="summary-item">
                <div class="summary-icon growth">
                  <ChartBarIcon />
                </div>
                <div class="summary-content">
                  <span class="summary-label">Average Monthly Growth</span>
                  <span class="summary-value average-growth">{{ averageMonthlyGrowth }}%</span>
                  <span :class="[isGrowthPositive ? 'positive' : 'negative', 'summary-change']">
                    {{ growthChangeText }}
                  </span>

                </div>
              </div>
            </div>

            <!-- Revenue Analytics Section -->
            <div class="revenue-analytics-section">
              <h4 class="analytics-section-title">{{ currentYear }} Revenue Performance</h4>
              <div class="revenue-insights">
                <div class="insight-item">
                  <div class="insight-icon increase">
                    <ArrowTrendingUpIcon />
                  </div>
                  <div class="insight-content">
                    <span class="insight-text">
                      Revenue increased by <strong>{{ Math.abs(revenueIncreasePercentage) }}%</strong> 
                      {{ revenueIncreasePercentage >= 0 ? 'compared to previous years' : 'decrease from previous years' }}
                    </span>
                  </div>
                </div>
                
                <div class="insight-item">
                  <div class="insight-icon contribution">
                    <ChartBarIcon />
                  </div>
                  <div class="insight-content">
                    <span class="insight-text">
                      The current year contributes <strong>{{ currentYearContributionPercentage }}%</strong> 
                      of the total revenue
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="chartDataRaw?.length > 0" class="chart-container">
              <div class="chart-header">
                <h4>Monthly Revenue Comparison</h4>
                <div class="chart-controls">
                  <div class="chart-toggle">
                    <button 
                      @click="toggleChartType" 
                      :class="['toggle-btn', chartType === 'bar' ? 'active' : '']"
                    >
                      Bar Chart
                    </button>
                    <button 
                      @click="toggleChartType" 
                      :class="['toggle-btn', chartType === 'line' ? 'active' : '']"
                    >
                      Line Chart
                    </button>
                  </div>
                  <div class="chart-legend">
                    <div class="legend-item">
                      <span class="legend-dot current"></span>
                      <span>{{ currentYear }}</span>
                    </div>
                    <div class="legend-item">
                      <span class="legend-dot previous"></span>
                      <span>{{ previousYear }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Bar Chart -->
              <div v-if="chartType === 'bar'" class="chart-content">
                <div class="chart-wrapper">
                  <!-- Dynamic Y Axis -->
                  <div class="chart-y-axis">
                    <span v-for="label in yAxisSteps" :key="label" class="y-label">{{ label }}</span>
                  </div>

                  <div class="chart-area">
                    <div class="chart-grid">
                      <div v-for="i in yAxisSteps.length - 1" :key="i" class="grid-line"></div>
                    </div>

                    <div class="chart-bars">
                      <div v-for="(data, index) in chartData" :key="index" class="bar-container">
                        <div class="bar-group">
                          <div class="bar current" :style="{ height: data.currentHeight + '%' }"
                            @mouseenter="showTooltip($event, data.currentValue, currentYear, data.shortMonth)" @mouseleave="hideTooltip">
                          </div>
                          <div class="bar previous" :style="{ height: data.previousHeight + '%' }"
                            @mouseenter="showTooltip($event, data.previousValue, previousYear, data.shortMonth)" @mouseleave="hideTooltip">
                          </div>
                        </div>
                        <span class="bar-label">{{ data?.shortMonth }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Line Chart -->
              <div v-else class="chart-content">
                <div class="chart-wrapper">
                  <!-- Dynamic Y Axis -->
                  <div class="chart-y-axis">
                    <span v-for="label in yAxisSteps" :key="label" class="y-label">{{ label }}</span>
                  </div>

                  <div class="chart-area">
                    <div class="chart-grid">
                      <div v-for="i in yAxisSteps.length - 1" :key="i" class="grid-line"></div>
                    </div>

                    <div class="line-chart-container">
                      <svg width="100%" height="240" viewBox="0 0 600 200" class="line-chart">
                        <!-- Current year line -->
                        <polyline
                          :points="lineChartPoints.current"
                          class="line current-line"
                          fill="none"
                          stroke="#1f8b4e"
                          stroke-width="3"
                        />
                        <!-- Previous year line -->
                        <polyline
                          :points="lineChartPoints.previous"
                          class="line previous-line"
                          fill="none"
                          stroke="#3b82f6"
                          stroke-width="3"
                        />
                        <!-- Data points for current year -->
                        <g v-for="(data, index) in chartData" :key="`current-${index}`">
                          <circle
                            :cx="40 + (index * (600 - 2 * 40)) / (chartData.length - 1)"
                            :cy="200 - 40 - (data.currentHeight / 100) * (200 - 2 * 40)"
                            r="4"
                            fill="#1f8b4e"
                            class="data-point current-point"
                            @mouseenter="showTooltip($event, data.currentValue, currentYear, data.shortMonth)"
                            @mouseleave="hideTooltip"
                          />
                        </g>
                        <!-- Data points for previous year -->
                        <g v-for="(data, index) in chartData" :key="`previous-${index}`">
                          <circle
                            :cx="40 + (index * (600 - 2 * 40)) / (chartData.length - 1)"
                            :cy="200 - 40 - (data.previousHeight / 100) * (200 - 2 * 40)"
                            r="4"
                            fill="#3b82f6"
                            class="data-point previous-point"
                            @mouseenter="showTooltip($event, data.previousValue, previousYear, data.shortMonth)"
                            @mouseleave="hideTooltip"
                          />
                        </g>
                      </svg>
                      
                      <!-- Month labels -->
                      <div class="line-chart-labels">
                        <span 
                          v-for="(data, index) in chartData" 
                          :key="index" 
                          class="line-label"
                          :style="{ left: `${(index / (chartData.length - 1)) * 100}%` }"
                        >
                          {{ data?.shortMonth }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div v-else class="no-data-message">
              <p>No revenue data available yet. Start selling to see your analytics!</p>
            </div>

            <div v-if="tooltip.show" class="chart-tooltip" :style="tooltipStyle">
              <div class="tooltip-content">
                <span class="tooltip-month" v-if="tooltip.monthName">{{ tooltip.monthName }}</span>
                <span class="tooltip-period">{{ tooltip.period }}</span>
                <span class="tooltip-value">{{ tooltip.formattedValue }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  </div>
</template>


<style scoped>
/* Theme-aware Analytics Dashboard */
.dashboard {
  max-height: 100dvh;
  width: 100%;
  flex: 1 1 auto;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 2rem);
  background: transparent;
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: auto;
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile Header */
.mobile-header {
  display: block;
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
  padding: 1rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.mobile-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
}

.mobile-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.user-avatar-mobile {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}



/* Main Content */
.main-content {
  flex: 1;
  padding: 1rem 8px;
  padding-bottom: 5rem;
  /* Space for mobile nav */
  overflow-y: auto;
}

.content-wrapper {
  margin: 0 auto;
}

/* Desktop Header - Hidden on mobile */
.desktop-header {
  display: none;
}

/* Dashboard Grid - Mobile Layout */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(aout-fit, 1fr);
  gap: 1rem;
  grid-template-areas:
    "profile"
    "metrics"
    "analytics"
}

/* Profile Card */
.profile-card {
  grid-area: profile;
  background: var(--surface);
  border-radius: 20px;
  padding: 2rem;
  border: 1px solid var(--border-primary);
  box-shadow: 0 4px 16px rgba(31, 139, 78, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.profile-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #1f8b4e 0%, #26a65b 100%);
}

.profile-card:hover {
  box-shadow: 0 8px 24px rgba(31, 139, 78, 0.15);
  transform: translateY(-4px);
  border-color: rgba(31, 139, 78, 0.2);
}

.profile-header {
  text-align: center;
  margin-bottom: 2rem;
}

.profile-image-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.25rem;
}

.profile-image {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #1f8b4e;
  box-shadow: 0 4px 16px rgba(31, 139, 78, 0.25);
  transition: transform 0.3s ease;
}

.profile-image:hover {
  transform: scale(1.05);
}

.profile-image-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
  color: white;
  cursor: pointer;
}

.profile-image-fallback:hover {
  background: linear-gradient(135deg, #166b3c 0%, #1f8b4e 100%);
}

.profile-icon {
  width: 60px;
  height: 60px;
}

.profile-header h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.profile-subtitle {
  color: var(--text-tertiary);
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.profile-stats {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 2px solid var(--border-primary);
}

.stat {
  text-align: center;
  flex: 1;
  padding: 1rem;
  background: rgba(31, 139, 78, 0.05);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stat:hover {
  background: rgba(31, 139, 78, 0.1);
  transform: translateY(-2px);
}

.stat-number {
  display: block;
  font-size: 1.75rem;
  font-weight: 800;
  color: #1f8b4e;
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  margin-top: 0.5rem;
}

/* Metrics Grid */
.metrics-grid {
  grid-area: metrics;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}



/* Enhanced Analytics Card */
.analytics-card {
  grid-area: analytics;
  background: var(--surface);
  border-radius: 20px;
  padding: 2rem;
  border: 1px solid var(--border-primary);
  max-width: 100vw;
  overflow: auto;
  box-shadow: 0 4px 16px rgba(31, 139, 78, 0.08);
  transition: all 0.3s ease;
  position: relative;
}

.analytics-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #1f8b4e 0%, #26a65b 100%);
}

.analytics-card:hover {
  box-shadow: 0 8px 24px rgba(31, 139, 78, 0.12);
}

.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.analytics-title h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.analytics-title p {
  margin: 0;
  font-size: 0.95rem;
  color: var(--text-tertiary);
  font-weight: 500;
}

.period-select {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.period-select:focus {
  border-color: var(--input-border-focus);
}

.analytics-summary {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

@media (min-width: 640px) {
  .analytics-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.05) 0%, rgba(31, 139, 78, 0.02) 100%);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.summary-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #1f8b4e 0%, #26a65b 100%);
}

.summary-item:hover {
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.1) 0%, rgba(31, 139, 78, 0.05) 100%);
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(31, 139, 78, 0.12);
  border-color: rgba(31, 139, 78, 0.3);
}

.summary-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
  position: relative;
}

.summary-item:hover .summary-icon {
  transform: scale(1.1) rotate(5deg);
}

.summary-icon svg {
  width: 28px;
  height: 28px;
  position: relative;
  z-index: 2;
}

.summary-icon.revenue {
  background: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
}

.summary-icon.growth {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.summary-label {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}

.summary-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.summary-change {
  font-size: 0.875rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.85rem;
  border-radius: 20px;
  width: fit-content;
}

.summary-change.positive {
  color: #1f8b4e;
  background: rgba(31, 139, 78, 0.15);
}

.summary-change.negative {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.15);
}

/* Revenue Analytics Section */
.revenue-analytics-section {
  margin: 2rem 0;
  padding: 2rem;
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.03) 0%, rgba(31, 139, 78, 0.01) 100%);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.revenue-analytics-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #1f8b4e 0%, #26a65b 100%);
}

.analytics-section-title {
  margin: 0 0 1.5rem 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
  letter-spacing: -0.02em;
}

.revenue-insights {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .revenue-insights {
    flex-direction: row;
    gap: 2rem;
  }
}

.insight-item {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1;
  padding: 1.5rem;
  background: var(--surface);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.insight-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(31, 139, 78, 0.1);
  border-color: rgba(31, 139, 78, 0.3);
}

.insight-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.insight-icon svg {
  width: 24px;
  height: 24px;
}

.insight-icon.increase {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
}

.insight-icon.contribution {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.insight-content {
  flex: 1;
}

.insight-text {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
  font-weight: 500;
}

.insight-text strong {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 1.1em;
}

.chart-container {
  position: relative;
  max-width: 100%;
  overflow: hidden;
}

.chart-content {
  max-width: 100%;
  overflow: auto;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.chart-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 639px) {
  .chart-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .chart-toggle {
    order: 1;
    width: 100%;
  }

  .chart-legend {
    order: 2;
    justify-content: center;
  }

  .toggle-btn {
    flex: 1;
    text-align: center;
  }
}

.chart-toggle {
  display: flex;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 4px;
  gap: 2px;
}

.toggle-btn {
  background: transparent;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.toggle-btn.active {
  background: var(--color-primary);
  color: white;
  box-shadow: 0 2px 4px rgba(31, 139, 78, 0.2);
}

.chart-legend {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  transition: background 0.15s ease;
}

.legend-item:hover {
  background: var(--surface-hover);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.current {
  background: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.negative {
  color: var(--color-danger);
}

.legend-dot.previous {
  background: var(--color-info);
  box-shadow: 0 0 0 2px var(--color-info-light);
}

.chart-wrapper {
  display: flex;
  gap: 1rem;
  min-width: fit-content;
}

.chart-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 240px;
  padding: 0.5rem 0;
}

.y-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: right;
  font-weight: 500;
}

.chart-area {
  flex: 1;
  position: relative;
}

.chart-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.grid-line {
  height: 1px;
  background: var(--border-secondary);
  width: 100%;
  opacity: 0.5;
}

.chart-bars {
  display: flex;
  gap: 0.5rem;
  height: 240px;
  padding: 2rem 0;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;

}

.bar-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.bar-group {
  display: flex;
  gap: 2px;
  align-items: end;
  width: 100%;
  height: 200px;
}

.bar {
  flex: 1;
  min-height: 8px;
  border-radius: 4px 4px 0 0;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  width: 12px;
  border-radius: 4px;
  transition: height 0.3s;
}

.bg-purple {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
}

.bar:hover {
  opacity: 0.9;
  transform: scaleY(1.05) scaleX(1.1);
  filter: brightness(1.1);
}

.bar.current {
  background: linear-gradient(180deg, #1f8b4e, #166b3c);
  box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
  border: 1px solid rgba(31, 139, 78, 0.2);
}

.bar.previous {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.bar-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
  margin-top: 0.5rem;
  font-weight: 500;
}

.chart-tooltip {
  position: absolute;
  background: var(--surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: 0.75rem;
  font-size: 0.75rem;
  pointer-events: none;
  z-index: 10;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tooltip-month {
  color: var(--color-primary);
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tooltip-period {
  color: var(--text-tertiary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
}

.tooltip-value {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 0.875rem;
}

.no-data-message {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--text-secondary);
  background: linear-gradient(135deg, rgba(31, 139, 78, 0.05) 0%, rgba(31, 139, 78, 0.02) 100%);
  border: 2px dashed var(--border-primary);
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 500;
}

.no-data-message p {
  margin: 0;
}

/* Line Chart Styles */
.line-chart-container {
  position: relative;
  width: 100%;
  height: 240px;
}

.line-chart {
  width: 100%;
  height: 200px;
  position: absolute;
  top: 0;
  left: 0;
}

.line {
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: all 0.3s ease;
}

.current-line {
  stroke: #1f8b4e;
  filter: drop-shadow(0 2px 4px rgba(31, 139, 78, 0.3));
}

.previous-line {
  stroke: #3b82f6;
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3));
}

.data-point {
  cursor: pointer;
  transition: all 0.3s ease;
}

.data-point:hover {
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
  transform: scale(1.2);
}

.current-point {
  fill: #1f8b4e;
}

.current-point:hover {
  fill: #166b3c;
}

.previous-point {
  fill: #3b82f6;
}

.previous-point:hover {
  fill: #2563eb;
}

.line-chart-labels {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 40px;
}

.line-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  text-align: center;
  font-weight: 500;
  position: absolute;
  transform: translateX(-50%);
}

/* Calendar - Now at bottom */
.calendar-card {
  grid-area: calendar;
  background: var(--surface);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  border: 1px solid var(--border-primary);
  box-shadow: var(--card-shadow);
  transition: box-shadow 0.2s ease;
}

.calendar-card:hover {
  box-shadow: var(--card-shadow-hover);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.calendar-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
  border-color: var(--color-primary);
}

.nav-btn:active {
  transform: scale(0.95);
}

.nav-btn svg {
  width: 20px;
  height: 20px;
}

.current-month {
  font-size: 0.875rem;
  color: var(--text-secondary);
  min-width: 120px;
  font-weight: 600;
  text-align: center;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.weekday {
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-weight: 600;
  padding: 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid transparent;
}

.calendar-day:hover {
  background: var(--surface-hover);
  border-color: var(--color-primary);
  transform: scale(1.05);
}

.calendar-day.other-month {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.calendar-day.today {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.calendar-day.selected {
  background: var(--color-success);
  color: white;
  font-weight: 600;
  box-shadow: 0 0 0 2px var(--color-success-light);
}

.event-dot {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 4px;
  height: 4px;
  background: var(--color-warning);
  border-radius: 50%;
  box-shadow: 0 0 4px var(--color-warning);
}

/* Mobile Bottom Navigation */
/* .mobile-nav {
  display: flex;
  background: #1e293b;
  border-top: 1px solid #334155;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
} */

/* .mobile-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  text-decoration: none;
  color: #64748b;
  transition: color 0.2s;
  gap: 0.25rem;
} */

/* .mobile-nav-item:hover,
.mobile-nav-item.active {
  color: #3b82f6;
} */

/* .mobile-nav-icon {
  width: 20px;
  height: 20px;
}

.mobile-nav-item span {
  font-size: 0.75rem;
  font-weight: 500;
} */

/* Tablet Styles */
@media (min-width: 640px) {
  .profile-card {
    display: flex;
    flex-direction: column;
  }

  .main-content {
    padding: 1rem;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .analytics-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .dashboard-grid {
    gap: 1.5rem;
    grid-template-areas:
      "profile metrics"
      "analytics analytics"
      "calendar calendar";
  }

  .chart-controls {
    flex-direction: row;
    gap: 1.5rem;
  }

  .chart-toggle {
    order: 1;
  }

  .chart-legend {
    order: 2;
  }
}

/* Desktop Styles */
@media (min-width: 1024px) {
  .dashboard {
    flex-direction: row;
  }


  .mobile-header {
    display: none;
  }

  /* Show desktop header */
  .desktop-header {
    display: block;
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .user-profile-desktop {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar-desktop {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }

  /* Adjust main content */
  .main-content {
    flex: 1;
    padding-bottom: 2rem;
  }

  /* Desktop grid layout */
  .dashboard-grid {
    grid-template-columns: 300px 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "profile metrics"
      "analytics analytics"
      "calendar calendar";
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Large Desktop */
@media (min-width: 1200px) {
  .content-wrapper {
    max-width: 1200px;
  }

  .dashboard-grid {
    grid-template-columns: 280px 1fr;
    grid-template-areas:
      "profile metrics calendar"
      "analytics analytics calendar";
  }

  .calendar-card {
    grid-row: 1 / 3;
  }
}
</style>