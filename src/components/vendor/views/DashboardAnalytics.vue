<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from 'vue-router'
import {
  useAnalyticsStore,
  type AnalyticsProduct,
  type AnalyticsCustomer,
  type AnalyticsLocation,
  type RangeKey,
} from "../../../stores/vendor/proAnalytics";
import { useSubscriptionStore } from '../../../stores/vendor/subscriptionStore'
import Subscription from './Subscription.vue'

type TabKey = "overview" | "recommendations" | "products" | "customers" | "locations";
type RecoLevel = "high" | "medium" | "low";

type RecoItem = {
  key: string;
  level: RecoLevel;
  levelLabel: string;
  title: string;
  why: string;
  actions: string[];
  metric?: string;
};

const analytics = useAnalyticsStore();
const subscriptionStore = useSubscriptionStore();
const router = useRouter();
const showSubscriptionBanner = ref(false)

const ranges: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
];

const activeTab = ref<TabKey>("overview");
const searchQuery = ref("");
const topSort = ref<"sellerRevenue" | "sold">("sellerRevenue");
const lastRefreshAt = ref<Date | null>(null);

const toast = ref<{ show: boolean; text: string }>({ show: false, text: "" });
let toastTimer: number | null = null;

onMounted(async () => {
  // Fetch subscription first; if vendor is subscribed, then load analytics data.
  try {
    await subscriptionStore.fetchSubscription();
    showSubscriptionBanner.value = !subscriptionStore.isSubscribed;
  } catch (err) {
    // If fetch fails, be conservative and show the subscription UI so seller can verify
    console.warn('Failed to fetch subscription status:', err);
    showSubscriptionBanner.value = true;
  }

  if (!showSubscriptionBanner.value) {
    await analytics.ensureAnalytics();
  }
});

watch(
  () => analytics.rangeKey,
  async () => {
    await analytics.ensureAnalytics({ silent: true });
  }
);

watch(
  () => analytics.loading,
  (loading, prev) => {
    if (prev && !loading) lastRefreshAt.value = new Date();
  }
);

function setRange(key: RangeKey) {
  analytics.setRange(key);
}

function refresh() {
  analytics.fetchAnalytics({ force: true });
}

const ready = computed(() => !!analytics.data && analytics.data.success);

// Expose helper for template
const isNotSubscribed = computed(() => showSubscriptionBanner.value)

function goToSubscription() {
  try {
    // set the vendor dashboard active page and navigate to vendor dashboard
    localStorage.setItem('activePageVendorDashboard', 'Subscription')
    router.push('/vendor/dashboard')
  } catch (e) {
    console.error('Failed to navigate to subscription page:', e)
    // fallback: go to vendor dashboard root
    try { router.push('/vendor/dashboard') } catch {}
  }
}
const showSkeleton = computed(() => analytics.loading && !ready.value && !analytics.error);

const periodText = computed(() => {
  const p = analytics.data?.period;
  if (!p) return "";
  const s = new Date(p.startDate);
  const e = new Date(p.endDate);
  const fmt = (d: Date) => d.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" });
  return `${String(p.rangeKey || "").toUpperCase()} • ${fmt(s)} – ${fmt(e)}`;
});

const updatedText = computed(() => {
  if (analytics.loading) return "Updating…";
  if (!lastRefreshAt.value) return "Updated";
  const ms = Date.now() - lastRefreshAt.value.getTime();
  const m = Math.floor(ms / 60000);
  if (m <= 0) return "Updated just now";
  if (m === 1) return "Updated 1 min ago";
  if (m < 60) return `Updated ${m} mins ago`;
  const h = Math.floor(m / 60);
  if (h === 1) return "Updated 1 hr ago";
  return `Updated ${h} hrs ago`;
});

const searchPlaceholder = computed(() => {
  if (activeTab.value === "products") return "Search products…";
  if (activeTab.value === "customers") return "Search customers…";
  if (activeTab.value === "locations") return "Search locations…";
  if (activeTab.value === "recommendations") return "Search recommendations…";
  return "Search…";
});

const current = computed(() => analytics.data?.current);
const trends = computed(() => analytics.data?.trends || null);

const products = computed<AnalyticsProduct[]>(() => current.value?.products || []);
const customers = computed<AnalyticsCustomer[]>(() => current.value?.customers || []);
const locations = computed<AnalyticsLocation[]>(() => current.value?.locations || []);

const rates = computed(() => current.value?.rates || { platform: 0.07, seller: 0.93 });

const totals = computed(() => {
  const t = current.value?.totals || {};
  return {
    totalOrders: Number(t.totalOrders || 0),
    totalSold: Number(t.totalSold || 0),
    totalGrossRevenue: Number(t.totalGrossRevenue || 0),
    totalPlatformCommission: Number(t.totalPlatformCommission || 0),
    totalSellerRevenue: Number(t.totalSellerRevenue || 0),
  };
});

const sellerPct = computed(() => {
  const gross = totals.value.totalGrossRevenue || 0;
  if (gross <= 0) return 0;
  return (totals.value.totalSellerRevenue / gross) * 100;
});

const platformPct = computed(() => {
  const gross = totals.value.totalGrossRevenue || 0;
  if (gross <= 0) return 0;
  return (totals.value.totalPlatformCommission / gross) * 100;
});

const totalViews = computed(() => products.value.reduce((s, p) => s + Number(p.views || 0), 0));
const totalUniqueViews = computed(() => products.value.reduce((s, p) => s + Number(p.uniqueViews || 0), 0));

function q() {
  return String(searchQuery.value || "").trim().toLowerCase();
}

function matches(text: unknown) {
  const query = q();
  if (!query) return true;
  return String(text || "").toLowerCase().includes(query);
}

function formatCompact(value: unknown) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function formatCurrency(value: unknown) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(value: unknown) {
  const n = Number(value || 0);
  return `${(n * 100).toFixed(2)}%`;
}

function formatDate(iso: unknown) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", { month: "short", day: "2-digit" });
}

function trendClass(v: unknown) {
  const n = Number(v || 0);
  return n > 0.001 ? "up" : n < -0.001 ? "down" : "flat";
}

function formatTrend(v: unknown) {
  const n = Number(v || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n * 100).toFixed(1)}%`;
}

function productConversion(p: AnalyticsProduct) {
  const views = Number(p.views || 0);
  const sold = Number(p.sold || 0);
  return views <= 0 ? 0 : sold / views;
}

const filteredProducts = computed(() => products.value.filter((p) => matches(p.name) || matches(p.category)));
const topSortLabel = computed(() => (topSort.value === "sellerRevenue" ? "Seller Revenue" : "Sold"));

function toggleTopSort() {
  topSort.value = topSort.value === "sellerRevenue" ? "sold" : "sellerRevenue";
}

const topProducts = computed(() => {
  const list = [...filteredProducts.value];
  list.sort((a, b) => Number((b as any)[topSort.value] || 0) - Number((a as any)[topSort.value] || 0));
  return list.slice(0, 8);
});

const lowProducts = computed(() => {
  const list = filteredProducts.value
    .filter((p) => Number(p.views || 0) >= 50)
    .sort((a, b) => productConversion(a) - productConversion(b));
  return list.slice(0, 6);
});

function lowSuggestion(p: AnalyticsProduct) {
  const conv = productConversion(p);
  const views = Number(p.views || 0);
  const sold = Number(p.sold || 0);

  if (views >= 300 && sold <= 3) return "Upgrade main photo + title; add a small promo to convert traffic.";
  if (conv < 0.01) return "Improve keywords + description; highlight benefits + authenticity.";
  if (sold <= 5) return "Add reviews, better packaging info, and clear variants (size/flavor).";
  return "Try bundles or feature it with your best product.";
}

const topCustomers = computed(() => {
  const list = customers.value.filter((c) => matches(c.name) || matches(c.location));
  list.sort((a, b) => Number(b.sellerRevenue || 0) - Number(a.sellerRevenue || 0));
  return list.slice(0, 8);
});

const topLocations = computed(() => {
  const list = locations.value.filter((l) => matches(l.location));
  list.sort((a, b) => Number(b.sellerRevenue || 0) - Number(a.sellerRevenue || 0));
  return list.slice(0, 8);
});

const bestProduct = computed(() => topProducts.value[0] || null);
const bestCustomer = computed(() => topCustomers.value[0] || null);
const bestLocation = computed(() => topLocations.value[0] || null);

const topProductsPreview = computed(() => topProducts.value.slice(0, 3));
const topCustomersPreview = computed(() => topCustomers.value.slice(0, 3));
const topLocationsPreview = computed(() => topLocations.value.slice(0, 3));

const maxProductRevenue = computed(() => Math.max(...topProducts.value.map((p) => Number(p.sellerRevenue || 0)), 1));
const maxCustomerRevenue = computed(() => Math.max(...topCustomers.value.map((c) => Number(c.sellerRevenue || 0)), 1));
const maxLocationRevenue = computed(() => Math.max(...topLocations.value.map((l) => Number(l.sellerRevenue || 0)), 1));

function barWidth(value: unknown, max: number) {
  const v = Number(value || 0);
  const m = Number(max || 1);
  const pct = m <= 0 ? 0 : v / m;
  return `${Math.max(0.08, Math.min(1, pct)) * 100}%`;
}

function donutStyle(pct: number, offsetPct = 0) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  const gap = c - dash;
  const offset = (Math.max(0, Math.min(100, offsetPct)) / 100) * c;
  return {
    strokeDasharray: `${dash} ${gap}`,
    strokeDashoffset: `${-offset}`,
  } as any;
}

function productMeaning(p: AnalyticsProduct) {
  const views = Number(p.views || 0);
  const sold = Number(p.sold || 0);
  const conv = productConversion(p);

  if (views >= 150 && sold <= 2) return "High interest but low buying — improve photo/title and add a promo.";
  if (conv >= 0.08 && sold >= 10) return "Good conversion — keep stock and consider raising visibility.";
  if (views < 30 && sold < 3) return "Low exposure — improve keywords/category and share to drive views.";
  if (conv < 0.02 && views >= 60) return "Traffic exists, conversion is low — fix listing quality and pricing.";
  return "Stable performance — test bundles or variations to grow sales.";
}

function locationMeaning(l: AnalyticsLocation) {
  const orders = Number(l.orders || 0);
  const rev = Number(l.sellerRevenue || 0);

  if (orders >= 20) return "Strong area — focus promos and ensure fast packing for repeat orders.";
  if (rev > 0 && orders < 5) return "Small but valuable — try targeted bundles for this location.";
  return "Low activity — improve discoverability and product photos to increase reach.";
}

const overviewTip = computed(() => {
  const bp = bestProduct.value;
  const lp = lowProducts.value[0];
  if (bp && Number(bp.sellerRevenue || 0) > 0) {
    return `Double down on “${bp.name}”. Keep it in stock and add a bundle (e.g., 2 pcs discount) to lift average order.`;
  }
  if (lp) {
    return `Your product “${lp.name}” gets views but not sales. Improve the main photo and add a small promo to increase conversion.`;
  }
  return "";
});

const recommendations = computed<RecoItem[]>(() => {
  if (!ready.value) return [];

  const items: RecoItem[] = [];
  const bp = bestProduct.value;
  const bl = bestLocation.value;
  const bc = bestCustomer.value;

  const biggestLeak = lowProducts.value[0] || null;
  if (biggestLeak) {
    items.push({
      key: "leak",
      level: "high",
      levelLabel: "High impact",
      title: `Fix conversion for “${biggestLeak.name}”`,
      why: `It has ${formatCompact(biggestLeak.views)} views but only ${formatCompact(biggestLeak.sold)} sold.`,
      metric: `Conv ${formatPercent(productConversion(biggestLeak))}`,
      actions: [
        "Replace main photo (bright, close-up, clean background).",
        "Add clearer title + keywords (what it is + flavor/size).",
        "Test a small promo (₱ off / bundle) for 7 days.",
      ],
    });
  }

  if (bp) {
    items.push({
      key: "winner",
      level: "medium",
      levelLabel: "Growth",
      title: `Scale your winner: “${bp.name}”`,
      why: "This is currently your top revenue driver.",
      metric: formatCurrency(bp.sellerRevenue),
      actions: [
        "Keep stock ready (avoid out-of-stock).",
        "Offer bundle pricing to raise order value.",
        "Pin it as a featured product (best-seller label).",
      ],
    });
  }

  if (bl) {
    items.push({
      key: "location",
      level: "medium",
      levelLabel: "Growth",
      title: `Target your top location: ${bl.location}`,
      why: `${formatCompact(bl.orders)} orders are coming from here.`,
      metric: formatCurrency(bl.sellerRevenue),
      actions: [
        "Run a location-focused promo (bundle/freebie).",
        "Add clear delivery ETA for this area.",
        "Optimize keywords used by buyers in this location.",
      ],
    });
  }

  if (bc) {
    items.push({
      key: "repeat",
      level: "low",
      levelLabel: "Easy win",
      title: `Turn top buyers into repeat customers`,
      why: `${bc.name} already bought ${formatCompact(bc.orders)} times.`,
      metric: formatCurrency(bc.sellerRevenue),
      actions: [
        "Send a thank-you + discount code for next order.",
        "Suggest a bundle of best products.",
        "Add a small freebie for repeat buyers.",
      ],
    });
  }

  return items.slice(0, 6);
});

const overallConversion = computed(() => {
  const v = totalViews.value || 0;
  const s = totals.value.totalSold || 0;
  return v <= 0 ? 0 : s / v;
});

const repeatCustomerRate = computed(() => {
  const list = customers.value || [];
  const count = list.length;
  if (count <= 0) return 0;
  const repeat = list.filter((c) => Number(c.orders || 0) >= 2).length;
  return repeat / count;
});

const revenueConcentration = computed(() => {
  const gross = totals.value.totalSellerRevenue || 0;
  const bp = bestProduct.value;
  const bpr = Number(bp?.sellerRevenue || 0);
  return gross <= 0 ? 0 : bpr / gross;
});

const locationConcentration = computed(() => {
  const gross = totals.value.totalSellerRevenue || 0;
  const bl = bestLocation.value;
  const blr = Number(bl?.sellerRevenue || 0);
  return gross <= 0 ? 0 : blr / gross;
});

// New Statistics for Premium Dashboard
const conversionRate = computed(() => {
  const views = totalViews.value || 0;
  const orders = totals.value.totalOrders || 0;
  return views <= 0 ? 0 : orders / views;
});

const averageOrderValue = computed(() => {
  const orders = totals.value.totalOrders || 0;
  const revenue = totals.value.totalSellerRevenue || 0;
  return orders <= 0 ? 0 : revenue / orders;
});

const ordersGrowthRate = computed(() => {
  const trend = trends.value?.totalSold;
  return trend || 0;
});

const itemsPerOrder = computed(() => {
  const orders = totals.value.totalOrders || 0;
  const sold = totals.value.totalSold || 0;
  return orders <= 0 ? 0 : sold / orders;
});

type CategoryStat = { category: string; sold: number; revenue: number; views: number };

const categoryPerformance = computed<CategoryStat[]>(() => {
  const categoryMap = new Map<string, { sold: number; revenue: number; views: number }>();
  products.value.forEach(p => {
    const cat = p.category || 'Uncategorized';
    const existing = categoryMap.get(cat) || { sold: 0, revenue: 0, views: 0 };
    categoryMap.set(cat, {
      sold: existing.sold + Number(p.sold || 0),
      revenue: existing.revenue + Number(p.sellerRevenue || 0),
      views: existing.views + Number(p.views || 0),
    });
  });
  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
});

const maxCategoryRevenue = computed(() => {
  if (categoryPerformance.value.length === 0) return 1;
  return categoryPerformance.value[0]?.revenue || 1;
});

function levelLabel(level: RecoLevel) {
  if (level === "high") return "High impact";
  if (level === "medium") return "Growth";
  return "Easy win";
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast.value = { show: true, text: "Copied to clipboard" };
  } catch {
    toast.value = { show: true, text: "Copy failed. Please try again." };
  } finally {
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.value.show = false), 1800);
  }
}

function productFunnelPct(n: number, base: number) {
  const b = base <= 0 ? 1 : base;
  return Math.max(0.06, Math.min(1, n / b));
}

const funnel = computed(() => {
  const views = totalViews.value || 0;
  const unique = totalUniqueViews.value || 0;
  const sold = totals.value.totalSold || 0;
  const orders = totals.value.totalOrders || 0;
  const base = Math.max(views, unique, sold, orders, 1);
  return {
    views,
    unique,
    sold,
    orders,
    base,
    wViews: `${productFunnelPct(views, base) * 100}%`,
    wUnique: `${productFunnelPct(unique, base) * 100}%`,
    wSold: `${productFunnelPct(sold, base) * 100}%`,
    wOrders: `${productFunnelPct(orders, base) * 100}%`,
  };
});

const topProductsPreviewFiltered = computed(() => topProductsPreview.value.filter((p) => matches(p.name) || matches(p.category)));
const topCustomersPreviewFiltered = computed(() => topCustomersPreview.value.filter((c) => matches(c.name) || matches(c.location)));
const topLocationsPreviewFiltered = computed(() => topLocationsPreview.value.filter((l) => matches(l.location)));
</script>



<template>
  <div class="analytics">

    <!-- If the seller is not subscribed, render the Subscription management view inline -->
    <div v-if="showSubscriptionBanner" class="subscription-inline">
      <div class="subscription-banner">
        <h2>Your Premium Subscription is Inactive</h2>
        <p>Subscribe to access advanced analytics and insights to grow your business.</p>
        <button class="btn primary" @click="goToSubscription">Manage Subscription</button>
      </div>
      <Subscription />
    </div>

    <div v-if="!showSubscriptionBanner" class="shell">
      <header class="topbar">
        <div class="title">
          <div class="eyebrow">
            <span class="dot" aria-hidden="true"></span>
            <span>Analytics</span>
          </div>
          <h1>Seller Dashboard</h1>
          <p class="sub">
            Delivered orders only •
            <span v-if="periodText">{{ periodText }}</span>
            <span v-else>Choose a range</span>
          </p>
        </div>

        <div class="controls">
          <div class="range" role="tablist" aria-label="Date range">
            <button
              v-for="r in ranges"
              :key="r.key"
              class="chip"
              :class="{ active: analytics.rangeKey === r.key }"
              type="button"
              role="tab"
              :aria-selected="analytics.rangeKey === r.key"
              @click="setRange(r.key)"
            >
              {{ r.label }}
            </button>
            <span class="range-glow" aria-hidden="true"></span>
          </div>

          <div class="search" v-if="activeTab !== 'overview' || searchQuery">
            <div class="searchbox" role="search">
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M10 2a8 8 0 105.293 14.293l4.207 4.207a1 1 0 001.414-1.414l-4.207-4.207A8 8 0 0010 2zm0 2a6 6 0 110 12a6 6 0 010-12z"
                />
              </svg>
              <input v-model.trim="searchQuery" type="text" :placeholder="searchPlaceholder" aria-label="Search analytics" />
              <button v-if="searchQuery" class="clear" type="button" aria-label="Clear search" @click="searchQuery = ''">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59L7.11 5.7a1 1 0 10-1.41 1.42L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.41L13.41 12l4.9-4.89a1 1 0 00-.01-1.4z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <button class="btn primary refresh" type="button" @click="refresh" :disabled="analytics.loading">
            <span class="dot-spin" v-if="analytics.loading"></span>
            <span>{{ analytics.loading ? "Loading" : "Refresh" }}</span>
          </button>
        </div>
      </header>

      <nav v-if="ready" class="subnav" aria-label="Dashboard sections">
        <div class="tabs">
          <button class="tab" type="button" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
            Overview
          </button>

          <button class="tab" type="button" :class="{ active: activeTab === 'recommendations' }" @click="activeTab = 'recommendations'">
            Recommendations
            <span v-if="recommendations.length" class="tab-badge">{{ recommendations.length }}</span>
          </button>

          <button class="tab" type="button" :class="{ active: activeTab === 'products' }" @click="activeTab = 'products'">
            Products
          </button>

          <button class="tab" type="button" :class="{ active: activeTab === 'customers' }" @click="activeTab = 'customers'">
            Customers
          </button>

          <button class="tab" type="button" :class="{ active: activeTab === 'locations' }" @click="activeTab = 'locations'">
            Locations
          </button>
        </div>

        <div class="updated">
          <span class="upd-dot" aria-hidden="true"></span>
          <span>{{ updatedText }}</span>
        </div>
      </nav>

      <div v-if="toast.show" class="toast" role="status" aria-live="polite">
        <div class="toast-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 12l2 2l4-5l1.4 1.4l-5.4 6.6L7.6 13.4L9 12z"/></svg>
        </div>
        <div class="toast-txt">{{ toast.text }}</div>
      </div>

      <div v-if="analytics.error" class="error">
        <div class="error-left">
          <div class="error-badge">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2a10 10 0 100 20a10 10 0 000-20zm1 13h-2v-2h2v2zm0-4h-2V7h2v4z"
              />
            </svg>
            <span>Oops</span>
          </div>
          <div class="error-title">Something went wrong</div>
          <div class="error-msg">{{ analytics.error }}</div>
        </div>
        <button class="btn" type="button" @click="refresh">Try again</button>
      </div>

      <section v-if="showSkeleton" class="skeleton-wrap">
        <div class="kpis">
          <div class="card kpi grad-a"><div class="sk sk-title"></div><div class="sk sk-value"></div><div class="sk sk-sub"></div></div>
          <div class="card kpi grad-b"><div class="sk sk-title"></div><div class="sk sk-value"></div><div class="sk sk-sub"></div></div>
          <div class="card kpi grad-c"><div class="sk sk-title"></div><div class="sk sk-value"></div><div class="sk sk-sub"></div></div>
          <div class="card kpi grad-d"><div class="sk sk-title"></div><div class="sk sk-value"></div><div class="sk sk-sub"></div></div>
        </div>

        <div class="grid">
          <div class="card grad-e pad">
            <div class="sk sk-h2"></div>
            <div class="sk sk-par"></div>
            <div class="sk sk-bar"></div>
            <div class="sk-row">
              <div class="sk sk-box"></div>
              <div class="sk sk-box"></div>
              <div class="sk sk-box"></div>
              <div class="sk sk-box"></div>
            </div>
          </div>

          <div class="columns">
            <div class="col">
              <div class="card grad-f pad">
                <div class="sk sk-h2"></div>
                <div class="sk sk-par"></div>
                <div class="sk-table"><div v-for="i in 6" :key="i" class="sk sk-rowline"></div></div>
              </div>
              <div class="card grad-g pad">
                <div class="sk sk-h2"></div>
                <div class="sk sk-par"></div>
                <div class="sk-table"><div v-for="i in 6" :key="i" class="sk sk-rowline"></div></div>
              </div>
            </div>

            <div class="col">
              <div class="card grad-h pad">
                <div class="sk sk-h2"></div>
                <div class="sk sk-par"></div>
                <div class="sk-table"><div v-for="i in 6" :key="i" class="sk sk-rowline"></div></div>
              </div>

              <div class="card grad-i pad">
                <div class="sk sk-h2"></div>
                <div class="sk sk-par"></div>
                <div class="sk sk-rowline"></div>
                <div class="sk sk-rowline"></div>
                <div class="sk sk-rowline"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="ready" class="page">
        <!-- Premium 6-Card KPI Grid -->
        <section class="kpis-premium">
          <!-- Card 1: Views (Green gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(31, 139, 78, 0.2), rgba(34, 197, 94, 0.1)); border-color: rgba(31, 139, 78, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 19a1 1 0 01-1-1V6a1 1 0 012 0v12h16a1 1 0 010 2H4z"/><path fill="currentColor" d="M8 15a1 1 0 01-.7-1.71l3-3a1 1 0 011.4 0l2 2l4.3-4.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-2-2l-2.3 2.3A1 1 0 018 15z"/></svg>
                </span>
                Views
              </span>
              <span class="kpi-pill" :class="trendClass(trends?.totalViews)">{{ formatTrend(trends?.totalViews) }}</span>
            </div>
            <div class="kpi-value-gradient">{{ formatCompact(totalViews) }}</div>
            <div class="kpi-foot">Total product views</div>
          </div>

          <!-- Card 2: Revenue (Orange gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(251, 191, 36, 0.1)); border-color: rgba(245, 158, 11, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 100 20a10 10 0 000-20zm1 15h-2v-1.2c-1.6-.2-2.8-1.1-3.2-2.6l1.9-.6c.3 1 1.1 1.6 2.3 1.6c1.1 0 1.9-.5 1.9-1.2c0-.6-.4-1-1.6-1.2l-1.2-.2c-1.8-.3-3-1.2-3-3c0-1.6 1.3-2.8 2.9-3.1V5h2v1.1c1.3.2 2.4 1 2.8 2.3l-1.9.7c-.3-.8-.9-1.2-1.9-1.2c-1 0-1.7.5-1.7 1.1c0 .6.5.9 1.5 1.1l1.3.2c2 .3 3.1 1.3 3.1 3.1c0 1.6-1.2 2.9-3 3.2V17z"/></svg>
                </span>
                Revenue
              </span>
              <span class="kpi-pill" :class="trendClass(trends?.totalRevenue)">{{ formatTrend(trends?.totalRevenue) }}</span>
            </div>
            <div class="kpi-value-gradient">{{ formatCurrency(totals.totalSellerRevenue) }}</div>
            <div class="kpi-foot">Your seller earnings</div>
          </div>

          <!-- Card 3: Conversion Rate (Green-Teal gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(31, 139, 78, 0.2), rgba(20, 184, 166, 0.1)); border-color: rgba(20, 184, 166, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                </span>
                Conversion
              </span>
            </div>
            <div class="kpi-value-gradient">{{ formatPercent(conversionRate) }}</div>
            <div class="kpi-foot">Views to orders rate</div>
          </div>

          <!-- Card 4: Orders (Orange gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(217, 119, 6, 0.2), rgba(245, 158, 11, 0.1)); border-color: rgba(217, 119, 6, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 4a1 1 0 011 1v1h8V5a1 1 0 112 0v1h1a2 2 0 012 2v10a3 3 0 01-3 3H6a3 3 0 01-3-3V8a2 2 0 012-2h1V5a1 1 0 011-1zm12 6H5v8a1 1 0 001 1h12a1 1 0 001-1v-8z"/></svg>
                </span>
                Orders
              </span>
              <span class="kpi-pill" :class="trendClass(ordersGrowthRate)">{{ formatTrend(ordersGrowthRate) }}</span>
            </div>
            <div class="kpi-value-gradient">{{ formatCompact(totals.totalOrders) }}</div>
            <div class="kpi-foot">Delivered orders</div>
          </div>

          <!-- Card 5: AOV (Dark Green gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(22, 107, 60, 0.2), rgba(31, 139, 78, 0.1)); border-color: rgba(22, 107, 60, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M17 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-3l1.1-2h7.5c.8 0 1.5-.5 1.8-1.2L21 6H6.2l-.9-2H2v2h2l3.6 7.6L6.2 16c-.1.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H8.4c-.1 0-.2-.1-.2-.2l.2-.8h8.1c.8 0 1.5-.5 1.8-1.2L22 6H6.2l-.9-2H2v2h2l3.6 7.6-.9 1.6c-.1.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H8.4c-.1 0-.2-.1-.2-.2 0 0 0-.1.1-.1l.9-1.7h7.4c.8 0 1.5-.5 1.8-1.3l3.5-6.4c.2-.4 0-.9-.4-1.1-.1-.1-.3-.1-.4-.1H6.2l-.9-2H2v2h2l3.6 7.6-.9 1.6z"/></svg>
                </span>
                AOV
              </span>
            </div>
            <div class="kpi-value-gradient">{{ formatCurrency(averageOrderValue) }}</div>
            <div class="kpi-foot">Average order value</div>
          </div>

          <!-- Card 6: Repeat Rate (Teal gradient) -->
          <div class="card kpi-premium">
            <div class="kpi-head">
              <span class="kpi-label">
                <span class="kpi-ic" aria-hidden="true" style="background: linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(34, 197, 94, 0.1)); border-color: rgba(20, 184, 166, 0.3);">
                  <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                </span>
                Repeat Rate
              </span>
            </div>
            <div class="kpi-value-gradient">{{ formatPercent(repeatCustomerRate) }}</div>
            <div class="kpi-foot">Returning customers</div>
          </div>
        </section>

        <section class="content">
          <section v-if="activeTab === 'overview'" class="grid">
            <div class="columns">
              <div class="col">
                <div class="card grad-e pad">
                  <div class="card-head">
                    <div>
                      <h2>Revenue split</h2>
                      <p class="muted">Seller vs platform (delivered)</p>
                    </div>
                    <div class="pillrate">
                      <span class="tag">Seller {{ formatPercent(rates.seller) }}</span>
                      <span class="tag ghost">Platform {{ formatPercent(rates.platform) }}</span>
                    </div>
                  </div>

                  <div class="rev-grid">
                    <div class="rev-left">
                      <div class="rev-kpis">
                        <div class="mini">
                          <div class="mini-label">Gross</div>
                          <div class="mini-value">{{ formatCurrency(totals.totalGrossRevenue) }}</div>
                        </div>
                        <div class="mini">
                          <div class="mini-label">Orders</div>
                          <div class="mini-value">{{ formatCompact(totals.totalOrders) }}</div>
                        </div>
                        <div class="mini">
                          <div class="mini-label">Seller</div>
                          <div class="mini-value">{{ formatCurrency(totals.totalSellerRevenue) }}</div>
                        </div>
                        <div class="mini">
                          <div class="mini-label">Platform</div>
                          <div class="mini-value">{{ formatCurrency(totals.totalPlatformCommission) }}</div>
                        </div>
                      </div>

                      <div class="stack">
                        <div class="stack-title">Share</div>
                        <div class="stack-track" aria-label="Revenue split bar">
                          <div class="stack-seller" :style="{ width: sellerPct + '%' }"></div>
                          <div class="stack-platform" :style="{ width: platformPct + '%' }"></div>
                        </div>
                        <div class="stack-legend">
                          <span><i class="sw seller"></i>Seller {{ sellerPct.toFixed(0) }}%</span>
                          <span><i class="sw platform"></i>Platform {{ platformPct.toFixed(0) }}%</span>
                        </div>
                      </div>

                      <div class="micro">
                        <span class="micro-title">What this means</span>
                        <span class="micro-text">
                          Your payout comes from <b>delivered orders</b>. Increase gross revenue to increase both seller revenue and platform commission.
                        </span>
                      </div>
                    </div>

                    <div class="rev-right">
                      <div class="donut-title">Seller share</div>
                      <svg class="donut donut-premium" viewBox="0 0 120 120" role="img" aria-label="Seller vs Platform donut chart">
                        <defs>
                          <!-- Seller share: Green gradient -->
                          <linearGradient id="gradientSeller" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#1f8b4e" />
                            <stop offset="50%" stop-color="#22c55e" />
                            <stop offset="100%" stop-color="#10b981" />
                          </linearGradient>
                          <!-- Platform share: Orange gradient -->
                          <linearGradient id="gradientPlatform" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stop-color="#f59e0b" />
                            <stop offset="50%" stop-color="#fbbf24" />
                            <stop offset="100%" stop-color="#d97706" />
                          </linearGradient>
                        </defs>
                        <circle class="donut-bg" cx="60" cy="60" r="44"></circle>
                        <circle class="donut-seller" cx="60" cy="60" r="44" stroke="url(#gradientSeller)" :style="donutStyle(sellerPct)"></circle>
                        <circle class="donut-platform" cx="60" cy="60" r="44" stroke="url(#gradientPlatform)" :style="donutStyle(platformPct, sellerPct)"></circle>
                        <text x="60" y="56" text-anchor="middle" class="donut-big">{{ sellerPct.toFixed(0) }}%</text>
                        <text x="60" y="74" text-anchor="middle" class="donut-small">Seller</text>
                      </svg>
                    </div>
                  </div>
                </div>

                <div class="card grad-j pad">
                  <div class="card-head">
                    <div>
                      <h2>Funnel insight</h2>
                      <p class="muted">Where buyers drop off (views → orders)</p>
                    </div>
                  </div>

                  <div class="funnel-grid">
                    <div class="funnel-metric">
                      <div class="funnel-label">Views</div>
                      <div class="funnel-value">26</div>
                    </div>
                    <div class="funnel-metric">
                      <div class="funnel-label">Unique</div>
                      <div class="funnel-value">8</div>
                    </div>
                    <div class="funnel-metric">
                      <div class="funnel-label">Sold</div>
                      <div class="funnel-value">45</div>
                    </div>
                    <div class="funnel-metric">
                      <div class="funnel-label">Orders</div>
                      <div class="funnel-value">32</div>
                    </div>
                  </div>

                  <div class="insight">
                    <div class="insight-title">Quick read</div>
                    <div class="insight-text">
                      If Views are high but Sold is low, focus on product photos, titles, and a small promo test. If Sold is high, focus on bundles to raise order value.
                    </div>
                  </div>
                </div>

                <div class="card grad-f pad">
                  <div class="card-head">
                    <div>
                      <h2>Quick snapshot</h2>
                      <p class="muted">Top highlights</p>
                    </div>
                    <button class="btn link" type="button" @click="activeTab = 'recommendations'">View All Stats</button>
                  </div>

                  <div class="snapshot">
                    <div class="snap">
                      <div class="snap-label">Best product</div>
                      <div class="snap-title">{{ bestProduct?.name || "—" }}</div>
                      <div class="snap-sub">{{ bestProduct ? formatCurrency(bestProduct.sellerRevenue) : "—" }}</div>
                    </div>
                    <div class="snap">
                      <div class="snap-label">Top customer</div>
                      <div class="snap-title">{{ bestCustomer?.name || "—" }}</div>
                      <div class="snap-sub">{{ bestCustomer ? formatCurrency(bestCustomer.sellerRevenue) : "—" }}</div>
                    </div>
                    <div class="snap">
                      <div class="snap-label">Top location</div>
                      <div class="snap-title">{{ bestLocation?.location || "—" }}</div>
                      <div class="snap-sub">{{ bestLocation ? formatCurrency(bestLocation.sellerRevenue) : "—" }}</div>
                    </div>
                  </div>

                  <div class="tip" v-if="overviewTip">
                    <span class="tip-badge">Tip</span>
                    <span class="tip-text">{{ overviewTip }}</span>
                  </div>
                </div>

                <!-- Category Performance Card -->
                <div class="card grad-e pad">
                  <div class="card-head">
                    <div>
                      <h2>Category Performance</h2>
                      <p class="muted">Revenue by product category</p>
                    </div>
                    <span class="badge">Insight</span>
                  </div>

                  <div class="category-grid">
                    <div v-for="cat in categoryPerformance" :key="cat.category" class="category-row">
                      <div class="category-info">
                        <div class="category-name">{{ cat.category }}</div>
                        <div class="category-stats">
                          <span>{{ formatCompact(cat.sold) }} sold</span>
                          <span class="sep">|</span>
                          <span>{{ formatCompact(cat.views) }} views</span>
                        </div>
                      </div>
                      <div class="category-revenue">{{ formatCurrency(cat.revenue) }}</div>
                      <div class="category-bar">
                        <div class="category-fill" :style="{ width: barWidth(cat.revenue, maxCategoryRevenue) }"></div>
                      </div>
                    </div>
                    <div v-if="categoryPerformance.length === 0" class="empty-box">No category data available</div>
                  </div>
                </div>
              </div>

              <div class="col">
                <div class="card grad-g pad">
                  <div class="card-head">
                    <div>
                      <h2>Top products</h2>
                      <p class="muted">By seller revenue</p>
                    </div>
                    <button class="btn link" type="button" @click="activeTab = 'products'">Open</button>
                  </div>

                  <div class="mini-list">
                    <div v-for="p in topProductsPreviewFiltered" :key="p.id" class="mini-row">
                      <div class="mini-left">
                        <div class="mini-name">
                          <span class="nm">{{ p.name }}</span>
                          <span class="pill">{{ p.category }}</span>
                        </div>
                        <div class="mini-meta">
                          <span class="hint">{{ formatCompact(p.views) }} views</span>
                          <span class="sep">•</span>
                          <span class="hint">{{ formatCompact(p.sold) }} sold</span>
                        </div>
                      </div>
                      <div class="mini-right">{{ formatCurrency(p.sellerRevenue) }}</div>
                    </div>
                    <div v-if="topProductsPreviewFiltered.length === 0" class="empty-box">No products found</div>
                  </div>
                </div>

                <div class="card grad-h pad">
                  <div class="card-head">
                    <div>
                      <h2>Top customers</h2>
                      <p class="muted">By seller revenue</p>
                    </div>
                    <button class="btn link" type="button" @click="activeTab = 'customers'">Open</button>
                  </div>

                  <div class="mini-list">
                    <div v-for="c in topCustomersPreviewFiltered" :key="c.id" class="mini-row">
                      <div class="mini-left">
                        <div class="mini-name">
                          <span class="nm">{{ c.name }}</span>
                          <span class="pill">{{ c.location }}</span>
                        </div>
                        <div class="mini-meta">
                          <span class="hint">{{ formatCompact(c.orders) }} orders</span>
                          <span class="sep">•</span>
                          <span class="hint">last {{ formatDate(c.lastOrderAt) }}</span>
                        </div>
                      </div>
                      <div class="mini-right">{{ formatCurrency(c.sellerRevenue) }}</div>
                    </div>
                    <div v-if="topCustomersPreviewFiltered.length === 0" class="empty-box">No customers found</div>
                  </div>
                </div>

                <div class="card grad-i pad">
                  <div class="card-head">
                    <div>
                      <h2>Locations</h2>
                      <p class="muted">Where revenue comes from</p>
                    </div>
                    <button class="btn link" type="button" @click="activeTab = 'locations'">Open</button>
                  </div>

                  <div class="mini-list">
                    <div v-for="l in topLocationsPreviewFiltered" :key="l.location" class="mini-row">
                      <div class="mini-left">
                        <div class="mini-name">
                          <span class="nm">{{ l.location }}</span>
                        </div>
                        <div class="mini-meta">
                          <span class="hint">{{ formatCompact(l.orders) }} orders</span>
                          <span class="sep">•</span>
                          <span class="hint">gross {{ formatCurrency(l.grossRevenue) }}</span>
                        </div>
                      </div>
                      <div class="mini-right">{{ formatCurrency(l.sellerRevenue) }}</div>
                    </div>
                    <div v-if="topLocationsPreviewFiltered.length === 0" class="empty-box">No locations found</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'recommendations'" class="grid">
            <div class="card grad-e pad">
              <div class="card-head">
                <div>
                  <h2>Recommendations</h2>
                  <p class="muted">Short, actionable next steps based on your data</p>
                </div>
                <button class="btn" type="button" @click="activeTab = 'products'">Open products</button>
              </div>

              <div class="reco-grid">
                <div v-for="r in recommendations" :key="r.key" class="reco">
                  <div class="reco-top">
                    <span class="reco-pill" :class="r.level">{{ r.levelLabel }}</span>
                    <span class="reco-metric" v-if="r.metric">{{ r.metric }}</span>
                  </div>
                  <div class="reco-title">{{ r.title }}</div>
                  <div class="reco-why">{{ r.why }}</div>
                  <ul class="reco-actions">
                    <li v-for="(a, i) in r.actions" :key="i">{{ a }}</li>
                  </ul>
                </div>

                <div v-if="recommendations.length === 0" class="empty-box">
                  No recommendations yet — pick a range and refresh.
                </div>
              </div>

              <div class="micro">
                <span class="micro-title">How to read the table fast</span>
                <span class="micro-text">
                  <b>Conv.</b> = Sold ÷ Views. It can go above 100% if one buyer buys multiple items (or if views tracking differs).
                  Aim for higher conversion on products with high views.
                </span>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'products'" class="grid">
            <div class="columns">
              <div class="col">
                <div class="card grad-f pad">
                  <div class="card-head">
                    <div>
                      <h2>Top Products</h2>
                      <p class="muted">Seller revenue per product</p>
                    </div>
                    <button class="btn" type="button" @click="toggleTopSort">Sort: {{ topSortLabel }}</button>
                  </div>

                  <div class="bars">
                    <div v-for="p in topProducts" :key="p.id" class="bar-row">
                      <div class="bar-info">
                        <div class="bar-name">
                          <span class="nm">{{ p.name }}</span>
                          <span class="pill">{{ p.category }}</span>
                        </div>
                        <div class="bar-meta">
                          <span>{{ formatCompact(p.sold) }} sold</span>
                          <span class="sep">•</span>
                          <span>{{ formatCompact(p.views) }} views</span>
                          <span class="sep">•</span>
                          <span class="strong">{{ formatCurrency(p.sellerRevenue) }}</span>
                        </div>
                      </div>

                      <div class="bar-track" :aria-label="`Revenue bar for ${p.name}`">
                        <div class="bar-fill" :style="{ width: barWidth(p.sellerRevenue, maxProductRevenue) }"></div>
                      </div>
                    </div>

                    <div v-if="topProducts.length === 0" class="empty-box">No products found</div>
                  </div>
                </div>

                <div class="card grad-g pad">
                  <div class="card-head">
                    <div>
                      <h2>Products table</h2>
                      <p class="muted">Delivered performance</p>
                    </div>
                  </div>

                  <div class="table-wrap table-premium">
                    <div class="table-shadow left" aria-hidden="true"></div>
                    <div class="table-shadow right" aria-hidden="true"></div>

                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th class="num">
                            <span class="th">
                              Views
                              <span class="info" title="Total page views of this product in the selected range.">i</span>
                            </span>
                          </th>
                          <th class="num">
                            <span class="th">
                              Sold
                              <span class="info" title="Total delivered items for this product (quantity included).">i</span>
                            </span>
                          </th>
                          <th class="num">
                            <span class="th">
                              Conv.
                              <span class="info" title="Conversion = Sold ÷ Views. Can exceed 100% if one view leads to multiple items sold.">i</span>
                            </span>
                          </th>
                          <th class="num">
                            <span class="th">
                              Seller Rev.
                              <span class="info" title="Your earnings from delivered orders for this product.">i</span>
                            </span>
                          </th>
                          <th class="num">
                            <span class="th">
                              Commission
                              <span class="info" title="Platform commission from delivered orders for this product.">i</span>
                            </span>
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr v-for="p in topProducts" :key="p.id">
                          <td>
                            <div class="row-main">
                              <span class="name">{{ p.name }}</span>
                              <span class="pill">{{ p.category }}</span>
                            </div>
                            <div class="row-sub">
                              <span class="hint">What it means:</span>
                              <span class="hint2">{{ productMeaning(p) }}</span>
                            </div>
                          </td>
                          <td class="num">{{ formatCompact(p.views) }}</td>
                          <td class="num">{{ formatCompact(p.sold) }}</td>
                          <td class="num">{{ formatPercent(productConversion(p)) }}</td>
                          <td class="num">{{ formatCurrency(p.sellerRevenue) }}</td>
                          <td class="num">{{ formatCurrency(p.platformCommission) }}</td>
                        </tr>

                        <tr v-if="topProducts.length === 0">
                          <td colspan="6" class="empty">No products found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="card grad-h pad">
                  <div class="card-head">
                    <div>
                      <h2>Low-performing products</h2>
                      <p class="muted">High views, low sales (quick wins)</p>
                    </div>
                    <span class="badge">Insight</span>
                  </div>

                  <div class="table-wrap table-premium">
                    <div class="table-shadow left" aria-hidden="true"></div>
                    <div class="table-shadow right" aria-hidden="true"></div>

                    <table>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th class="num">Views</th>
                          <th class="num">Sold</th>
                          <th class="num">Conv.</th>
                          <th>Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="p in lowProducts" :key="p.id">
                          <td>
                            <div class="row-main">
                              <span class="name">{{ p.name }}</span>
                              <span class="pill soft">{{ p.category }}</span>
                            </div>
                          </td>
                          <td class="num">{{ formatCompact(p.views) }}</td>
                          <td class="num">{{ formatCompact(p.sold) }}</td>
                          <td class="num">{{ formatPercent(productConversion(p)) }}</td>
                          <td class="hint">{{ lowSuggestion(p) }}</td>
                        </tr>
                        <tr v-if="lowProducts.length === 0">
                          <td colspan="5" class="empty">No low performers in this range</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div class="col">
                <div class="card grad-l pad note">
                  <div class="note-title">Quick tip</div>
                  <div class="note-body">
                    Focus on <b>1–2 winning products</b> and keep them always in stock.
                    It’s the fastest way to raise revenue—then improve conversion on the next best items.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'customers'" class="grid">
            <div class="columns">
              <div class="col">
                <div class="card grad-i pad">
                  <div class="card-head">
                    <div>
                      <h2>Top customers</h2>
                      <p class="muted">Seller revenue per customer</p>
                    </div>
                  </div>

                  <div class="bars small">
                    <div v-for="c in topCustomers" :key="c.id" class="bar-row">
                      <div class="bar-info">
                        <div class="bar-name">
                          <span class="nm">{{ c.name }}</span>
                          <span class="pill">{{ c.location }}</span>
                        </div>
                        <div class="bar-meta">
                          <span>{{ formatCompact(c.orders) }} orders</span>
                          <span class="sep">•</span>
                          <span class="strong">{{ formatCurrency(c.sellerRevenue) }}</span>
                        </div>
                      </div>
                      <div class="bar-track" :aria-label="`Revenue bar for ${c.name}`">
                        <div class="bar-fill alt" :style="{ width: barWidth(c.sellerRevenue, maxCustomerRevenue) }"></div>
                      </div>
                    </div>

                    <div v-if="topCustomers.length === 0" class="empty-box">No customers found</div>
                  </div>
                </div>

                <div class="card grad-j pad">
                  <div class="card-head">
                    <div>
                      <h2>Customers table</h2>
                      <p class="muted">Delivered spend</p>
                    </div>
                  </div>

                  <div class="table-wrap table-premium">
                    <div class="table-shadow left" aria-hidden="true"></div>
                    <div class="table-shadow right" aria-hidden="true"></div>

                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Location</th>
                          <th class="num">Orders</th>
                          <th class="num">Gross</th>
                          <th class="num">Seller Rev.</th>
                          <th class="num">Last</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="c in topCustomers" :key="c.id">
                          <td class="name">{{ c.name }}</td>
                          <td class="hint">{{ c.location }}</td>
                          <td class="num">{{ formatCompact(c.orders) }}</td>
                          <td class="num">{{ formatCurrency(c.grossSpend) }}</td>
                          <td class="num">{{ formatCurrency(c.sellerRevenue) }}</td>
                          <td class="num">{{ formatDate(c.lastOrderAt) }}</td>
                        </tr>
                        <tr v-if="topCustomers.length === 0">
                          <td colspan="6" class="empty">No customers found</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div class="micro">
                    <span class="micro-title">Fast win</span>
                    <span class="micro-text">
                      Message your top customers with a <b>bundle offer</b> (e.g., “Buy 2 get ₱X off”).
                      Repeat buyers are cheaper than finding new ones.
                    </span>
                  </div>
                </div>
              </div>

              <div class="col">
                <div class="card grad-l pad note">
                  <div class="note-title">Customer strategy</div>
                  <div class="note-body">
                    Your top customers already trust you. Encourage repeat orders with bundles, freebies, or a simple “thank you” note in the package.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-else-if="activeTab === 'locations'" class="grid">
            <div class="columns">
              <div class="col">
                <div class="card grad-k pad">
                  <div class="card-head">
                    <div>
                      <h2>Locations</h2>
                      <p class="muted">Seller revenue by location</p>
                    </div>
                  </div>

                  <div class="loc-list">
                    <div v-for="l in topLocations" :key="l.location" class="loc-row">
                      <div class="loc-left">
                        <div class="loc-name">{{ l.location }}</div>
                        <div class="loc-meta">
                          {{ formatCompact(l.orders) }} orders • <span class="strong">{{ formatCurrency(l.sellerRevenue) }}</span>
                          <span class="muted2">• gross {{ formatCurrency(l.grossRevenue) }}</span>
                        </div>
                        <div class="loc-meaning">{{ locationMeaning(l) }}</div>
                      </div>
                      <div class="loc-bar" :aria-label="`Revenue bar for ${l.location}`">
                        <div class="loc-fill" :style="{ width: barWidth(l.sellerRevenue, maxLocationRevenue) }"></div>
                      </div>
                    </div>

                    <div v-if="topLocations.length === 0" class="empty-box">No locations found</div>
                  </div>

                  <div class="locations-foot">
                    <div class="mini">
                      <div class="mini-label">Top location</div>
                      <div class="mini-value">{{ bestLocation?.location || "—" }}</div>
                    </div>
                    <div class="mini">
                      <div class="mini-label">Locations tracked</div>
                      <div class="mini-value">{{ formatCompact(locations.length) }}</div>
                    </div>
                  </div>

                  <div class="micro">
                    <span class="micro-title">What to do</span>
                    <span class="micro-text">
                      Promote more in your top location (faster delivery, bundles). For weak locations, improve photos + keywords to increase reach.
                    </span>
                  </div>
                </div>
              </div>

              <div class="col">
                <div class="card grad-l pad note">
                  <div class="note-title">Location tip</div>
                  <div class="note-body">
                    If one location dominates orders, consider adding a “best-seller” bundle targeted for that area (same-day packing, clear shipping estimate).
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </section>

      <section v-else class="empty-screen">
        <div class="empty-card">
          <div class="empty-ic big" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path fill="currentColor" d="M4 19a1 1 0 01-1-1V6a1 1 0 012 0v12h16a1 1 0 010 2H4z" />
              <path fill="currentColor" d="M8 14a1 1 0 01-.7-1.71l2.2-2.2a1 1 0 011.4 0l1.6 1.6l3.6-3.6a1 1 0 011.4 1.42l-4.3 4.3a1 1 0 01-1.4 0l-1.6-1.6l-1.5 1.5A1 1 0 018 14z" />
            </svg>
          </div>
          <div class="empty-title">Pick a range to start</div>
          <div class="empty-sub">Select 7D / 30D / 90D above, then refresh if needed.</div>
        </div>
      </section>
    </div>
  </div>
</template>


<style scoped>
.analytics {
  --page-pad: clamp(12px, 1.8vw, 20px);
  --gap: clamp(10px, 1.2vw, 14px);
  --card-pad: clamp(12px, 1.2vw, 16px);
  --maxw: 1320px;

  /* Brand Colors - Green + Orange Theme */
  --brand: var(--color-primary, #1f8b4e);
  --brand-light: #22c55e;
  --brand-dark: #166b3c;
  --orange: #f59e0b;
  --orange-light: #fbbf24;
  --orange-dark: #d97706;
  --teal: #14b8a6;

  /* Contrast + Surfaces */
  --bg: var(--app-bg, var(--surface, #0b1324));
  --panel: var(--surface-elevated, color-mix(in srgb, var(--bg) 82%, #ffffff));
  --panel2: color-mix(in srgb, var(--panel) 92%, transparent);

  --txt: var(--text-primary, #eaf0ff);
  --txt2: color-mix(in srgb, var(--txt) 88%, transparent);
  --txt3: color-mix(in srgb, var(--txt) 74%, transparent);

  --bdr: var(--border-primary, color-mix(in srgb, var(--txt) 18%, transparent));
  --bdr2: color-mix(in srgb, var(--bdr) 80%, transparent);
  --ring: color-mix(in srgb, var(--brand) 70%, transparent);

  --brand-soft: color-mix(in srgb, var(--brand) 18%, transparent);
  --brand-softer: color-mix(in srgb, var(--brand) 12%, transparent);
  --orange-soft: color-mix(in srgb, var(--orange) 18%, transparent);

  --g1: color-mix(in srgb, var(--brand) 28%, transparent);
  --g2: color-mix(in srgb, var(--orange) 20%, transparent);

  --panel-gradient-start: color-mix(in srgb, var(--panel) 86%, var(--brand) 10%);
  --panel-gradient-end: color-mix(in srgb, var(--panel) 86%, var(--orange) 10%);

  --shadow: 0 18px 44px color-mix(in srgb, #000 28%, transparent);
  --shadow2: 0 22px 60px color-mix(in srgb, #000 34%, transparent);

  /* Brand Gradients */
  --gradient-primary: linear-gradient(135deg, #1f8b4e 0%, #22c55e 55%, #10b981 100%);
  --gradient-brand: linear-gradient(135deg, #1f8b4e 0%, #f59e0b 100%);
  --gradient-green-orange: linear-gradient(135deg, #1f8b4e 0%, #22c55e 30%, #fbbf24 70%, #f59e0b 100%);
  --gradient-warm: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #22c55e 100%);
  --gradient-accent: linear-gradient(135deg, #1f8b4e 0%, #14b8a6 45%, #f59e0b 100%);

  /* Premium Shadows */
  --shadow-premium: 0 26px 90px rgba(31, 139, 78, 0.18), 0 12px 34px rgba(0, 0, 0, 0.14);
  --shadow-orange: 0 26px 90px rgba(245, 158, 11, 0.18), 0 12px 34px rgba(0, 0, 0, 0.14);

  padding: var(--page-pad);
  color: var(--txt);
  position: relative;
  isolation: isolate;
  min-height: calc(100vh - 1px);
  color-scheme: light dark;
}

.shell {
  max-width: var(--maxw);
  margin: 0 auto;
  width: 100%;
}

.analytics::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background:
    radial-gradient(900px 560px at 18% 10%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 62%),
    radial-gradient(820px 560px at 82% 18%, color-mix(in srgb, var(--orange) 16%, transparent), transparent 64%),
    radial-gradient(900px 740px at 60% 92%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 64%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 76%, transparent), transparent);
  opacity: 0.96;
}

:global([data-theme="light"]) .analytics,
:global(.light) .analytics {
  --bg: var(--app-bg, #f6f8ff);
  --panel: var(--surface-elevated, #ffffff);
  --panel2: color-mix(in srgb, var(--panel) 90%, transparent);

  --txt: var(--text-primary, #0b1220);
  --txt2: color-mix(in srgb, var(--txt) 82%, transparent);
  --txt3: color-mix(in srgb, var(--txt) 68%, transparent);

  --bdr: var(--border-primary, color-mix(in srgb, #0b1220 18%, transparent));
  --bdr2: color-mix(in srgb, var(--bdr) 80%, transparent);
  --ring: color-mix(in srgb, var(--brand) 60%, transparent);

  --shadow: 0 14px 44px color-mix(in srgb, #0b1220 10%, transparent);
  --shadow2: 0 18px 58px color-mix(in srgb, #0b1220 14%, transparent);
}

/* ---------------------------
   Topbar
--------------------------- */
.topbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap);
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: var(--gap);
  position: sticky;
  top: 10px;
  z-index: 10;
  padding: 12px;
  border-radius: calc(var(--radius-lg, 18px) + 2px);
  border: 1px solid transparent;
  background:
    radial-gradient(760px 280px at 14% 0%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 62%) padding-box,
    radial-gradient(720px 340px at 92% 20%, color-mix(in srgb, var(--orange) 14%, transparent), transparent 64%) padding-box,
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel) 78%, transparent)) padding-box,
    linear-gradient(135deg, color-mix(in srgb, var(--bdr) 82%, transparent), color-mix(in srgb, var(--brand) 20%, transparent), color-mix(in srgb, var(--orange) 18%, transparent)) border-box;
  backdrop-filter: blur(12px) saturate(1.2);
  -webkit-backdrop-filter: blur(12px) saturate(1.2);
  box-shadow: var(--shadow);
}

.title { min-width: min(520px, 100%); }

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--bdr2);
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 82%, transparent), color-mix(in srgb, var(--panel) 94%, transparent));
  color: var(--txt2);
  font-size: 0.78rem;
  width: fit-content;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, var(--brand), color-mix(in srgb, var(--brand) 65%, #ffffff));
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand) 18%, transparent);
}

.title h1 {
  margin: 8px 0 0;
  font-size: clamp(1.2rem, 1.8vw, 1.65rem);
  letter-spacing: -0.03em;
}

.sub {
  margin: 0.35rem 0 0;
  color: var(--txt2);
  font-size: 0.92rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  min-width: min(820px, 100%);
}

.range {
  position: relative;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(260px 120px at 22% 50%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 78%, transparent), color-mix(in srgb, var(--panel) 92%, transparent));
  overflow: hidden;
}

.range-glow {
  position: absolute;
  inset: -40px;
  background: radial-gradient(340px 140px at 30% 50%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 70%);
  pointer-events: none;
}

.chip {
  border: 1px solid var(--bdr2);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: color-mix(in srgb, var(--txt) 92%, transparent);
  padding: 0.52rem 0.82rem;
  border-radius: 999px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 220ms ease, background 220ms ease;
  position: relative;
  z-index: 1;
}

.chip:hover { transform: translateY(-1px); box-shadow: var(--shadow2); }

.chip.active {
  border-color: transparent;
  color: var(--btn-primary-text, #fff);
  background: var(--gradient-primary);
  box-shadow: 0 18px 54px color-mix(in srgb, #000 30%, transparent);
}

.search {
  flex: 1 1 320px;
  min-width: 240px;
}

.searchbox {
  width: 100%;
  display: grid;
  grid-template-columns: 18px 1fr 34px;
  gap: 10px;
  align-items: center;
  padding: 0.62rem 0.8rem;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(240px 120px at 14% 40%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 86%, transparent));
}

.searchbox .ic { width: 18px; height: 18px; color: var(--txt2); }

.searchbox input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.92rem;
  color: var(--txt);
}

.searchbox:focus-within {
  border-color: color-mix(in srgb, var(--brand) 70%, transparent);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand) 20%, transparent);
}

.clear {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: var(--txt2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 220ms ease, opacity 200ms ease;
}
.clear svg { width: 18px; height: 18px; }
.clear:hover { transform: translateY(-1px); box-shadow: var(--shadow2); opacity: 1; }

.btn {
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(240px 120px at 14% 40%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 98%, transparent), color-mix(in srgb, var(--panel) 86%, transparent));
  color: color-mix(in srgb, var(--txt) 92%, transparent);
  padding: 0.56rem 0.92rem;
  border-radius: var(--radius-md, 14px);
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 220ms ease, opacity 200ms ease;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.btn:hover { transform: translateY(-2px); box-shadow: var(--shadow2); }
.btn:disabled { cursor: not-allowed; opacity: 0.75; transform: none; box-shadow: none; }

.btn.primary {
  border-color: transparent;
  background: var(--gradient-primary);
  color: var(--btn-primary-text, #fff);
  box-shadow: 0 18px 54px color-mix(in srgb, #000 30%, transparent);
}

.btn.link {
  background: transparent;
  border-color: transparent;
  padding: 0.35rem 0.4rem;
  color: color-mix(in srgb, var(--brand) 92%, var(--txt));
  box-shadow: none;
}
.btn.link:hover { transform: none; box-shadow: none; text-decoration: underline; }

.refresh { min-width: 120px; justify-content: center; }

.dot-spin {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--txt) 20%, transparent);
  border-top-color: var(--txt);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Focus states */
.chip:focus-visible,
.tab:focus-visible,
.btn:focus-visible,
.clear:focus-visible,
.searchbox input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand) 22%, transparent);
  border-color: color-mix(in srgb, var(--brand) 55%, transparent);
}

/* ---------------------------
   Subnav
--------------------------- */
.subnav {
  margin: 10px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-lg, 18px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(260px 120px at 14% 40%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel) 82%, transparent));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 14px 44px color-mix(in srgb, #000 20%, transparent);
}

.tabs {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: nowrap;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar { display: none; }

.tab {
  border: 1px solid var(--bdr2);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: color-mix(in srgb, var(--txt) 90%, transparent);
  padding: 0.48rem 0.72rem;
  border-radius: 999px;
  font-size: 0.9rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform 120ms ease, box-shadow 220ms ease, background 220ms ease;
}

.tab:hover { transform: translateY(-1px); box-shadow: var(--shadow2); }

.tab.active {
  border-color: transparent;
  background: var(--gradient-brand);
  color: #fff;
  box-shadow: 0 18px 54px color-mix(in srgb, #000 30%, transparent);
}

.updated {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--txt2);
  font-size: 0.86rem;
  white-space: nowrap;
}

.upd-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand) 86%, #fff);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--brand) 16%, transparent);
}

/* ---------------------------
   Layout Containers
--------------------------- */
.page { display: grid; gap: var(--gap); }
.content { display: grid; gap: var(--gap); }
.grid { display: grid; gap: var(--gap); position: relative; z-index: 1; }

.columns {
  display: grid;
  grid-template-columns: 1.35fr 1fr;
  gap: var(--gap);
  align-items: start;
  min-width: 0;
}

.col { display: flex; flex-direction: column; gap: var(--gap); min-width: 0; }

/* ---------------------------
   Cards (stronger contrast + gradients)
--------------------------- */
.card {
  border-radius: var(--radius-lg, 18px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(680px 300px at 18% 0%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 62%),
    radial-gradient(680px 320px at 92% 12%, color-mix(in srgb, var(--orange) 14%, transparent), transparent 64%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 98%, transparent), color-mix(in srgb, var(--panel) 86%, transparent));
  transform: translateZ(0);
  transition: transform 240ms ease, box-shadow 240ms ease, border-color 240ms ease;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow2);
  border-color: color-mix(in srgb, var(--brand) 38%, var(--bdr));
}

.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 14px;
  height: 2px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 86%, #fff), transparent);
  opacity: 0.75;
}

.card::after {
  content: "";
  position: absolute;
  inset: -1px;
  pointer-events: none;
  z-index: 0;
  opacity: 0.75;
  background:
    radial-gradient(520px 240px at 18% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 62%),
    radial-gradient(520px 240px at 90% 10%, color-mix(in srgb, var(--orange) 12%, transparent), transparent 64%);
}

.card > * { position: relative; z-index: 1; }
.pad { padding: var(--card-pad); }

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}

.card-head h2 { margin: 0; font-size: 1.05rem; letter-spacing: -0.02em; }

.muted { margin: 0.35rem 0 0; color: var(--txt2); font-size: 0.86rem; }
.muted2 { color: var(--txt3); }
.sep { opacity: 1; color: var(--txt3); }

/* ---------------------------
   KPI Premium Grid
--------------------------- */
.kpis-premium {
  display: grid;
  gap: var(--gap);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0 0 var(--gap);
  position: relative;
  z-index: 1;
}

.kpi-premium {
  padding: var(--card-pad);
  border-radius: 20px;
  border: 1px solid transparent;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 98%, transparent), color-mix(in srgb, var(--panel) 84%, transparent)) padding-box,
    var(--gradient-brand) border-box;
  box-shadow: var(--shadow-premium);
  position: relative;
  overflow: hidden;
  transition: transform 0.28s ease, box-shadow 0.28s ease;
}

.kpi-premium::before {
  content: "";
  position: absolute;
  inset: -60%;
  background: radial-gradient(circle at 30% 20%,
    color-mix(in srgb, #1f8b4e 16%, transparent),
    color-mix(in srgb, #f59e0b 10%, transparent) 50%,
    transparent
  );
  pointer-events: none;
}

.kpi-premium:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 32px 96px rgba(31, 139, 78, 0.22), 0 14px 40px rgba(245, 158, 11, 0.18);
}

.kpi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.kpi-label {
  font-size: 0.92rem;
  color: color-mix(in srgb, var(--txt) 92%, transparent);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.kpi-ic {
  width: 30px;
  height: 30px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: color-mix(in srgb, var(--txt) 92%, transparent);
}
.kpi-ic svg { width: 18px; height: 18px; }

.kpi-value-gradient {
  background: var(--gradient-green-orange);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 950;
  font-size: clamp(1.55rem, 2.6vw, 2.05rem);
  letter-spacing: -0.03em;
  margin-top: 0.55rem;
}

.kpi-foot { margin-top: 0.35rem; font-size: 0.86rem; color: var(--txt2); }

/* ---------------------------
   Revenue Split
--------------------------- */
.pillrate { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.tag {
  font-size: 0.76rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--brand) 22%, var(--bdr));
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 86%, transparent));
  color: color-mix(in srgb, var(--txt) 94%, transparent);
}

.tag.ghost {
  border-color: color-mix(in srgb, var(--txt) 18%, var(--bdr));
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel) 82%, transparent));
  color: var(--txt2);
}

.rev-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: 1.2fr 0.8fr;
  align-items: center;
}

.rev-kpis {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mini {
  padding: 0.82rem;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(240px 120px at 18% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%),
    linear-gradient(135deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 10px 26px color-mix(in srgb, #000 16%, transparent);
}

.mini-label { font-size: 0.84rem; color: var(--txt2); }
.mini-value { margin-top: 0.35rem; font-size: 1.02rem; font-weight: 900; color: color-mix(in srgb, var(--txt) 96%, transparent); }

.stack { margin-top: 12px; }
.stack-title { font-size: 0.84rem; color: var(--txt2); margin-bottom: 8px; }

.stack-track {
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--bdr) 90%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #000 22%, transparent);
  position: relative;
}

.stack-seller {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  background: linear-gradient(90deg, var(--brand), color-mix(in srgb, var(--brand) 62%, #fff));
  animation: grow 700ms ease both;
}

.stack-platform {
  position: absolute;
  inset: 0 0 0 auto;
  height: 100%;
  background: linear-gradient(90deg, var(--orange), color-mix(in srgb, var(--orange) 70%, #fff));
  animation: grow 700ms ease both;
}

@keyframes grow {
  from { transform: scaleX(0.7); transform-origin: left; opacity: 0.7; }
  to { transform: scaleX(1); opacity: 1; }
}

.stack-legend {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--txt2);
}

.sw {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  margin-right: 6px;
  vertical-align: middle;
}
.sw.seller { background: linear-gradient(180deg, var(--brand), color-mix(in srgb, var(--brand) 65%, #fff)); }
.sw.platform { background: linear-gradient(180deg, var(--orange), color-mix(in srgb, var(--orange) 70%, #fff)); }

.micro { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--bdr2); display: grid; gap: 6px; }
.micro-title { font-weight: 950; letter-spacing: -0.01em; color: color-mix(in srgb, var(--txt) 96%, transparent); }
.micro-text { color: var(--txt2); font-size: 0.92rem; line-height: 1.4; }

.rev-right {
  display: grid;
  justify-items: center;
  gap: 10px;
  background:
    radial-gradient(360px 180px at 30% 10%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%),
    radial-gradient(360px 180px at 90% 20%, color-mix(in srgb, var(--orange) 12%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 98%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  border-radius: 16px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  box-shadow: var(--shadow2);
}

.donut-title { font-size: 0.84rem; color: var(--txt2); }

.donut {
  width: 200px;
  max-width: 100%;
  height: auto;
  overflow: visible;
  filter: drop-shadow(0 18px 44px color-mix(in srgb, #000 28%, transparent));
  background: radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, var(--panel) 92%, transparent), transparent);
  border-radius: 999px;
  padding: 12px;
}

.donut-bg { fill: none; stroke: color-mix(in srgb, var(--bdr) 88%, transparent); stroke-width: 18; opacity: 0.98; }

.donut-seller, .donut-platform {
  fill: none;
  stroke-width: 18;
  transform: rotate(-90deg);
  transform-origin: 60px 60px;
  stroke-linecap: round;
  transition: stroke-dasharray 400ms cubic-bezier(0.22,1,0.36,1), stroke-dashoffset 400ms cubic-bezier(0.22,1,0.36,1);
}

.donut-seller { filter: drop-shadow(0 10px 26px rgba(31, 139, 78, 0.35)); }
.donut-platform { filter: drop-shadow(0 10px 26px rgba(245, 158, 11, 0.30)); }

.donut-big { font-size: 18px; font-weight: 950; fill: var(--txt); }
.donut-small { font-size: 10px; fill: var(--txt2); }

/* ---------------------------
   Snapshot + Tip
--------------------------- */
.snapshot { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 4px; }

.snap {
  padding: 0.95rem;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(220px 120px at 18% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 12px 28px color-mix(in srgb, #000 16%, transparent);
}

.snap-label { font-size: 0.82rem; color: var(--txt2); }
.snap-title { margin-top: 6px; font-weight: 950; letter-spacing: -0.01em; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.snap-sub { margin-top: 4px; color: var(--txt2); font-size: 0.9rem; }

.tip {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--brand) 30%, var(--bdr));
  background:
    radial-gradient(280px 160px at 20% 0%, color-mix(in srgb, var(--brand) 16%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
}

.tip-badge {
  font-size: 0.78rem;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--gradient-primary);
  color: #fff;
  white-space: nowrap;
  box-shadow: 0 14px 34px color-mix(in srgb, #000 26%, transparent);
}

.tip-text { color: var(--txt2); line-height: 1.4; font-size: 0.92rem; }

/* ---------------------------
   Mini lists
--------------------------- */
.mini-list { display: grid; gap: 10px; }

.mini-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(220px 120px at 18% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 12px 30px color-mix(in srgb, #000 14%, transparent);
}

.mini-left { min-width: 0; }
.mini-right { font-weight: 950; white-space: nowrap; color: color-mix(in srgb, var(--txt) 98%, transparent); }

.mini-name { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
.mini-meta { margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: var(--txt2); font-size: 0.86rem; }

/* ---------------------------
   Bars
--------------------------- */
.bars { display: grid; gap: 12px; margin-top: 6px; }
.bars.small { gap: 10px; }

.bar-row { display: grid; gap: 8px; }
.bar-info { display: grid; gap: 4px; }

.bar-name { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; min-width: 0; }
.nm { font-weight: 950; letter-spacing: -0.01em; }
.strong { font-weight: 950; }

.bar-meta { font-size: 0.88rem; color: var(--txt2); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.bar-track {
  height: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bdr) 92%, transparent);
  overflow: hidden;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #000 18%, transparent);
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--gradient-primary);
  animation: widen 650ms ease both;
}

.bar-fill.alt { background: linear-gradient(90deg, color-mix(in srgb, var(--brand) 70%, #fff), var(--brand)); }

@keyframes widen {
  from { width: 12%; opacity: 0.7; }
  to { opacity: 1; }
}

/* ---------------------------
   Tables (Premium + higher contrast)
--------------------------- */
.table-wrap {
  position: relative;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  border-radius: var(--radius-md, 14px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background:
    radial-gradient(520px 240px at 12% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 62%),
    radial-gradient(520px 240px at 92% 10%, color-mix(in srgb, var(--orange) 8%, transparent), transparent 64%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 82%, transparent));
  box-shadow: 0 18px 54px color-mix(in srgb, #000 18%, transparent);
}

.table-shadow {
  position: sticky;
  top: 0;
  bottom: 0;
  width: 18px;
  pointer-events: none;
  z-index: 2;
}

.table-shadow.left { left: 0; float: left; background: linear-gradient(90deg, color-mix(in srgb, #000 28%, transparent), transparent); opacity: 0.22; }
.table-shadow.right { right: 0; float: right; background: linear-gradient(270deg, color-mix(in srgb, #000 28%, transparent), transparent); opacity: 0.22; }

table { width: 100%; border-collapse: collapse; font-size: 0.92rem; min-width: 820px; }

thead th {
  text-align: left;
  background:
    radial-gradient(640px 260px at 18% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 62%),
    radial-gradient(640px 260px at 88% 10%, color-mix(in srgb, var(--orange) 10%, transparent), transparent 64%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 98%, transparent), color-mix(in srgb, var(--panel) 86%, transparent));
  color: color-mix(in srgb, var(--txt) 98%, transparent);
  font-weight: 950;
  padding: 0.8rem 0.9rem;
  border-bottom: 1px solid color-mix(in srgb, var(--brand) 30%, var(--bdr));
  position: sticky;
  top: 0;
  z-index: 1;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

tbody td {
  padding: 0.74rem 0.9rem;
  border-bottom: 1px solid color-mix(in srgb, var(--bdr) 90%, transparent);
  vertical-align: middle;
  color: color-mix(in srgb, var(--txt) 94%, transparent);
}

tbody tr:nth-child(2n) td {
  background: linear-gradient(90deg, color-mix(in srgb, var(--panel) 90%, transparent), color-mix(in srgb, var(--brand) 6%, transparent));
}

tbody tr:hover td {
  background: linear-gradient(90deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--orange) 8%, transparent));
}

.num { text-align: right; font-variant-numeric: tabular-nums; }

.row-main { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; min-width: 0; }
.row-sub { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.hint { color: var(--txt2); font-size: 0.86rem; }
.hint2 { color: var(--txt3); font-size: 0.86rem; }
.name { font-weight: 950; }

/* info bubble */
.th { display: inline-flex; gap: 8px; align-items: center; justify-content: flex-end; width: 100%; }
.info {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  color: #fff;
  background: var(--gradient-brand);
  cursor: help;
  box-shadow: 0 10px 24px color-mix(in srgb, #000 24%, transparent);
}

/* ---------------------------
   Category Performance
--------------------------- */
.category-grid {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}

.category-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(260px 140px at 18% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 14px 36px color-mix(in srgb, #000 14%, transparent);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.category-row:hover {
  transform: translateX(4px);
  box-shadow: 0 22px 56px color-mix(in srgb, #000 20%, transparent);
}

.category-name { font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); }

.category-stats {
  margin-top: 4px;
  font-size: 0.86rem;
  color: var(--txt2);
  display: flex;
  gap: 8px;
}

.category-revenue { font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); white-space: nowrap; }

.category-bar {
  grid-column: 1 / -1;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bdr) 90%, transparent);
  overflow: hidden;
}

.category-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--gradient-primary);
  animation: widen 650ms ease both;
}

/* ---------------------------
   Locations
--------------------------- */
.loc-list { display: grid; gap: 10px; margin-top: 8px; }

.loc-row {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 0.75rem;
  align-items: center;
  padding: 0.78rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  border-radius: var(--radius-md, 14px);
  background:
    radial-gradient(260px 140px at 18% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 14px 36px color-mix(in srgb, #000 14%, transparent);
}

.loc-name { font-weight: 950; }
.loc-meta { margin-top: 0.25rem; font-size: 0.88rem; color: var(--txt2); }
.loc-meaning { margin-top: 6px; font-size: 0.87rem; color: color-mix(in srgb, var(--txt) 76%, transparent); line-height: 1.35; }

.loc-bar {
  height: 10px;
  background: color-mix(in srgb, var(--bdr) 92%, transparent);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #000 22%, transparent);
}

.loc-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--gradient-primary);
  animation: widen 650ms ease both;
}

.locations-foot {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 10px;
}

/* ---------------------------
   Recommendations
--------------------------- */
.reco-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 8px;
}

.reco {
  padding: 14px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(360px 220px at 18% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 70%),
    radial-gradient(360px 220px at 92% 16%, color-mix(in srgb, var(--orange) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  color: var(--txt);
  display: grid;
  gap: 10px;
  box-shadow: 0 18px 54px color-mix(in srgb, #000 18%, transparent);
  transition: transform 220ms ease, box-shadow 220ms ease;
}

.reco:hover { transform: translateY(-6px); box-shadow: 0 26px 72px color-mix(in srgb, #000 26%, transparent); }

.reco-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.reco-metric { font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.reco-title { font-weight: 950; letter-spacing: -0.01em; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.reco-why { color: var(--txt2); line-height: 1.5; font-size: 0.96rem; }

.reco-actions {
  margin: 0;
  padding-left: 1.1rem;
  color: color-mix(in srgb, var(--txt) 84%, transparent);
  font-size: 0.92rem;
  line-height: 1.4;
}

/* ---------------------------
   Funnel Insight
--------------------------- */
.funnel-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.funnel-metric {
  padding: 12px;
  border-radius: var(--radius-md, 14px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(220px 120px at 18% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%),
    linear-gradient(135deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: 0 12px 34px color-mix(in srgb, #000 14%, transparent);
  text-align: center;
}

.funnel-label { font-size: 0.86rem; color: var(--txt2); margin-bottom: 4px; }
.funnel-value { font-size: 1.22rem; font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); }

.insight {
  padding: 12px;
  border-radius: var(--radius-md, 14px);
  background:
    radial-gradient(260px 160px at 18% 0%, color-mix(in srgb, var(--orange) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  box-shadow: 0 14px 42px color-mix(in srgb, #000 14%, transparent);
}

.insight-title { font-size: 0.92rem; font-weight: 900; color: color-mix(in srgb, var(--txt) 98%, transparent); margin-bottom: 6px; }
.insight-text { font-size: 0.9rem; color: var(--txt2); line-height: 1.45; }

/* ---------------------------
   Pills + Badges (base)
--------------------------- */
.pill {
  font-size: 0.72rem;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  color: color-mix(in srgb, var(--txt) 94%, transparent);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
}

.pill.soft {}

/* badge used in headers */
.badge {
  font-size: 0.78rem;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: color-mix(in srgb, var(--txt) 94%, transparent);
  white-space: nowrap;
}

.empty { text-align: center; color: var(--txt2); padding: 14px; }

.empty-box {
  text-align: center;
  padding: 14px;
  color: var(--txt2);
  border: 1px dashed var(--bdr2);
  border-radius: var(--radius-md, 14px);
  background:
    radial-gradient(260px 160px at 18% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel) 82%, transparent));
}

/* ---------------------------
   Notes
--------------------------- */
.note {
  border: 1px solid transparent;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent)) padding-box,
    var(--gradient-accent) border-box;
  box-shadow: var(--shadow-premium);
}

.note-title { font-weight: 950; letter-spacing: -0.01em; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.note-body { margin-top: 8px; color: var(--txt2); font-size: 0.94rem; line-height: 1.45; }

/* ---------------------------
   Error
--------------------------- */
.error {
  margin: 12px 0 16px;
  padding: 14px;
  border-radius: var(--radius-lg, 18px);
  border: 1px solid color-mix(in srgb, #ef4444 45%, var(--bdr));
  background:
    radial-gradient(520px 240px at 14% 0%, color-mix(in srgb, #ef4444 14%, transparent), transparent 62%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  box-shadow: 0 18px 54px color-mix(in srgb, #000 20%, transparent);
}

.error-left { min-width: 0; }

.error-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, #ef4444 44%, var(--bdr));
  background: linear-gradient(135deg, rgba(239,68,68,0.22), rgba(185,28,28,0.10));
  width: fit-content;
  color: color-mix(in srgb, var(--txt) 98%, transparent);
}

.error-badge svg { width: 16px; height: 16px; }

.error-title { margin-top: 8px; font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.error-msg { margin-top: 6px; color: var(--txt2); }

/* ---------------------------
   Empty Screen
--------------------------- */
.empty-screen { display: grid; place-items: center; padding: 18px 0 6px; }

.empty-card {
  width: min(520px, 100%);
  padding: 18px;
  border-radius: var(--radius-lg, 18px);
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(360px 220px at 18% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%),
    radial-gradient(360px 220px at 92% 16%, color-mix(in srgb, var(--orange) 10%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  text-align: center;
  box-shadow: var(--shadow);
}

.empty-ic {
  width: 34px;
  height: 34px;
  border-radius: 14px;
  margin: 0 auto 10px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  color: var(--txt2);
  box-shadow: 0 14px 34px color-mix(in srgb, #000 16%, transparent);
}

.empty-ic svg { width: 18px; height: 18px; }
.empty-ic.big { width: 56px; height: 56px; border-radius: 20px; }
.empty-ic.big svg { width: 26px; height: 26px; }

.empty-title { font-weight: 950; color: color-mix(in srgb, var(--txt) 98%, transparent); }
.empty-sub { margin-top: 6px; font-size: 0.9rem; color: var(--txt2); }

/* ---------------------------
   Skeleton
--------------------------- */
.skeleton-wrap { position: relative; z-index: 1; }

.sk {
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--panel) 78%, transparent),
    color-mix(in srgb, var(--panel) 96%, transparent),
    color-mix(in srgb, var(--panel) 78%, transparent)
  );
  background-size: 220% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}

.sk-title { height: 12px; width: 52%; margin-bottom: 12px; }
.sk-value { height: 26px; width: 68%; margin-bottom: 10px; }
.sk-sub { height: 10px; width: 40%; }

.sk-h2 { height: 14px; width: 36%; margin-bottom: 10px; }
.sk-par { height: 10px; width: 58%; margin-bottom: 14px; }
.sk-bar { height: 14px; width: 100%; border-radius: 999px; margin-bottom: 12px; }

.sk-row { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sk-box { height: 64px; width: 100%; }
.sk-table { display: grid; gap: 10px; }
.sk-rowline { height: 12px; width: 100%; }

/* ---------------------------
   Toast
--------------------------- */
.toast {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--bdr) 96%, transparent);
  background:
    radial-gradient(260px 160px at 18% 0%, color-mix(in srgb, var(--brand) 12%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 84%, transparent));
  box-shadow: var(--shadow2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.toast-ic {
  width: 28px;
  height: 28px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  background: var(--gradient-primary);
  color: #fff;
  box-shadow: 0 14px 34px color-mix(in srgb, #000 24%, transparent);
}

.toast-ic svg { width: 18px; height: 18px; }
.toast-txt { color: var(--txt2); font-size: 0.94rem; }

/* ---------------------------
   Gradient presets (used via class)
--------------------------- */
.grad-a { --g1: color-mix(in srgb, var(--brand) 22%, transparent); --g2: color-mix(in srgb, #22c55e 14%, transparent); }
.grad-b { --g1: color-mix(in srgb, var(--brand) 20%, transparent); --g2: color-mix(in srgb, #06b6d4 14%, transparent); }
.grad-c { --g1: color-mix(in srgb, var(--brand) 18%, transparent); --g2: color-mix(in srgb, #f59e0b 14%, transparent); }
.grad-d { --g1: color-mix(in srgb, var(--brand) 22%, transparent); --g2: color-mix(in srgb, #a855f7 14%, transparent); }
.grad-e { --g1: color-mix(in srgb, var(--brand) 18%, transparent); --g2: color-mix(in srgb, #ec4899 14%, transparent); }
.grad-f { --g1: color-mix(in srgb, var(--brand) 18%, transparent); --g2: color-mix(in srgb, #22c55e 12%, transparent); }
.grad-g { --g1: color-mix(in srgb, var(--brand) 16%, transparent); --g2: color-mix(in srgb, #06b6d4 12%, transparent); }
.grad-h { --g1: color-mix(in srgb, var(--brand) 16%, transparent); --g2: color-mix(in srgb, #f97316 12%, transparent); }
.grad-i { --g1: color-mix(in srgb, var(--brand) 16%, transparent); --g2: color-mix(in srgb, #a855f7 12%, transparent); }
.grad-j { --g1: color-mix(in srgb, var(--brand) 14%, transparent); --g2: color-mix(in srgb, #ef4444 12%, transparent); }
.grad-k { --g1: color-mix(in srgb, var(--brand) 18%, transparent); --g2: color-mix(in srgb, #22c55e 14%, transparent); }
.grad-l { --g1: color-mix(in srgb, var(--brand) 14%, transparent); --g2: color-mix(in srgb, #94a3b8 12%, transparent); }

/* ---------------------------
   RESPONSIVE
--------------------------- */
@media (max-width: 1100px) {
  .columns { grid-template-columns: 1fr; }
  .controls { justify-content: stretch; min-width: 100%; }
  .rev-grid { grid-template-columns: 1fr; }
  .snapshot { grid-template-columns: 1fr; }
  .reco-grid { grid-template-columns: 1fr; }
  .kpis-premium { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 520px) {
  .topbar { top: 8px; padding: 10px; }
  .kpis-premium { grid-template-columns: 1fr; }
  .loc-row { grid-template-columns: 1fr; }
  .rev-kpis { grid-template-columns: 1fr; }
  .refresh { width: 100%; }
  .search { min-width: 100%; }
  .range { width: 100%; justify-content: space-between; }
  .chip { flex: 1 1 auto; text-align: center; }
  table { min-width: 760px; }
  .subnav { flex-direction: column; align-items: stretch; }
  .updated { justify-content: flex-end; }
}

/* ---------------------------
   Reduced motion
--------------------------- */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}

/* =========================================================
   BADGE HIGHLIGHT OVERRIDES (requested)
   ========================================================= */
.badge,
.pill,
.reco-pill,
.kpi-pill,
.tab-badge {
  position: relative;
  isolation: isolate;
  font-weight: 950;
  letter-spacing: -0.01em;
  border-color: transparent !important;
  box-shadow:
    0 12px 28px color-mix(in srgb, #000 22%, transparent),
    0 0 0 1px color-mix(in srgb, var(--txt) 10%, transparent) inset;
  backdrop-filter: blur(10px) saturate(1.15);
  -webkit-backdrop-filter: blur(10px) saturate(1.15);
}

.badge::before,
.pill::before,
.reco-pill::before,
.kpi-pill::before,
.tab-badge::before {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, #ffffff 22%, transparent),
    transparent 55%
  );
  opacity: 0.55;
  pointer-events: none;
  z-index: -1;
}

.badge::after,
.pill::after,
.reco-pill::after,
.kpi-pill::after,
.tab-badge::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  background: radial-gradient(
    80% 120% at 50% 0%,
    color-mix(in srgb, var(--brand) 26%, transparent),
    transparent 70%
  );
  filter: blur(10px);
  opacity: 0.8;
  pointer-events: none;
  z-index: -2;
}

.badge,
.pill,
.reco-pill {
  color: #fff !important;
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--brand) 92%, #000),
      color-mix(in srgb, var(--brand) 72%, #fff),
      color-mix(in srgb, var(--orange) 64%, #fff)
    ) !important;
}

.pill,
.reco-pill,
.kpi-pill {
  padding: 0.32rem 0.62rem !important;
  font-size: 0.74rem !important;
}

.tab-badge {
  color: #fff !important;
  background: linear-gradient(135deg, var(--brand), var(--orange)) !important;
  border: none !important;
  box-shadow:
    0 14px 34px color-mix(in srgb, #000 26%, transparent),
    0 0 0 1px color-mix(in srgb, #fff 16%, transparent) inset;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.75rem;
}

.kpi-pill {
  font-size: 0.76rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(135deg, color-mix(in srgb, var(--txt) 20%, transparent), color-mix(in srgb, var(--panel) 92%, transparent));
}

.kpi-pill.up {
  color: #fff !important;
  background: linear-gradient(135deg, #22c55e, #16a34a) !important;
}
.kpi-pill.up::after {
  background: radial-gradient(80% 120% at 50% 0%, color-mix(in srgb, #22c55e 38%, transparent), transparent 70%);
}

.kpi-pill.down {
  color: #fff !important;
  background: linear-gradient(135deg, #ef4444, #b91c1c) !important;
}
.kpi-pill.down::after {
  background: radial-gradient(80% 120% at 50% 0%, color-mix(in srgb, #ef4444 36%, transparent), transparent 70%);
}

.pill.soft {
  color: #fff !important;
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
}
.pill.soft::after {
  background: radial-gradient(80% 120% at 50% 0%, color-mix(in srgb, #f59e0b 40%, transparent), transparent 70%);
}

.reco-pill.high { background: linear-gradient(135deg, #ef4444, #b91c1c) !important; }
.reco-pill.medium { background: linear-gradient(135deg, var(--brand), #22c55e) !important; }
.reco-pill.low {
  background: linear-gradient(135deg, color-mix(in srgb, var(--txt) 28%, transparent), color-mix(in srgb, var(--panel) 92%, transparent)) !important;
  color: var(--txt) !important;
}
.reco-pill.low::after {
  background: radial-gradient(80% 120% at 50% 0%, color-mix(in srgb, var(--txt) 18%, transparent), transparent 70%);
}

.badge:hover,
.pill:hover,
.reco-pill:hover,
.kpi-pill:hover,
.tab-badge:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow:
    0 18px 46px color-mix(in srgb, #000 30%, transparent),
    0 0 0 1px color-mix(in srgb, #fff 16%, transparent) inset;
}

.subscription-banner {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(255,240,230,0.04), rgba(255,248,240,0.02));
  border: 1px solid rgba(255,255,255,0.04);
  margin-bottom: 12px;
}
.subscription-banner .banner-content { display:flex; flex-direction:column; gap:4px }
.subscription-banner .banner-text { color: var(--txt2); }
.subscription-banner .banner-actions { display:flex; gap:8px }

.subscription-inline { padding: 1rem 0; }

</style>
