// src/stores/vendor/analyticsStore.ts
import { defineStore } from "pinia";
import axios, { AxiosError, AxiosHeaders, type AxiosInstance } from "axios";
import { getAuthHeaders } from "../../types/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export type RangeKey = "7d" | "30d" | "90d" | "custom";

export type AnalyticsProduct = {
  _id?: string;
  id: string;
  name: string;
  category: string;
  views: number;
  uniqueViews: number;
  sold: number;
  grossRevenue: number;
  platformCommission: number;
  sellerRevenue: number;
};

export type AnalyticsCustomer = {
  _id?: string;
  id: string;
  name: string;
  location: string;
  orders: number;
  lastOrderAt: string;
  grossSpend: number;
  platformCommission: number;
  sellerRevenue: number;
};

export type AnalyticsLocation = {
  _id?: string;
  location: string;
  orders: number;
  grossRevenue: number;
  platformCommission: number;
  sellerRevenue: number;
};

export type AnalyticsTotals = {
  totalProducts?: number;
  totalCustomers?: number;
  totalLocations?: number;
  totalOrders?: number;
  totalSold?: number;
  totalGrossRevenue?: number;
  totalPlatformCommission?: number;
  totalSellerRevenue?: number;
};

export type AnalyticsBlock = {
  products: AnalyticsProduct[];
  customers: AnalyticsCustomer[];
  locations: AnalyticsLocation[];
  totals: AnalyticsTotals;
  rates: { platform: number; seller: number };
};

export type SellerAnalyticsResponse = {
  success: boolean;
  period: { rangeKey: RangeKey | string; startDate: string; endDate: string };
  current: AnalyticsBlock;
  previous: AnalyticsBlock;
  trends: { totalRevenue: number; totalSold: number; totalViews: number; totalUniqueViews: number };
};

type CacheEntry = { data: SellerAnalyticsResponse; fetchedAt: number };

function authHeader(): string {
  const h = getAuthHeaders();
  return h.Authorization || "";
}

let axiosInstance: AxiosInstance | null = null;

function api(): AxiosInstance {
  if (axiosInstance) return axiosInstance;

  const instance = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

  instance.interceptors.request.use((config) => {
    const auth = authHeader();
    config.headers = AxiosHeaders.from({
      Accept: "application/json",
      ...(auth ? { Authorization: auth } : {}),
      ...(config.headers || {}),
    });
    return config;
  });

  axiosInstance = instance;
  return instance;
}

function normalizeError(err: unknown): string {
  const ax = err as AxiosError<any>;
  if ((ax as any)?.code === "ERR_CANCELED") return "Request cancelled";

  if (ax.response) {
    const status = ax.response.status;
    const data = ax.response.data as any;

    if (status === 401) return "Unauthorized. Please login again.";
    if (status === 403) return "Forbidden. You don’t have access.";
    if (status === 429) return "Too many requests. Please try again shortly.";

    return data?.message || data?.error || `HTTP ${status} ${ax.response.statusText || ""}`.trim();
  }

  if (ax.request) return "Network error or no response";
  return (ax as any)?.message || "Unknown error";
}

function buildKey(rangeKey: RangeKey, startDate: string, endDate: string) {
  return `${rangeKey}|${startDate || ""}|${endDate || ""}`;
}

export const useAnalyticsStore = defineStore("sellerAnalytics", {
  state: () => ({
    data: null as SellerAnalyticsResponse | null,
    loading: false,
    error: null as string | null,

    rangeKey: "30d" as RangeKey,
    startDate: "" as string,
    endDate: "" as string,

    staleTimeMs: 2 * 60 * 1000,
    cache: {} as Record<string, CacheEntry>,

    abort: null as AbortController | null,
    reqId: 0,
  }),

  getters: {
    current(state): AnalyticsBlock | null {
      return state.data?.current || null;
    },
    previous(state): AnalyticsBlock | null {
      return state.data?.previous || null;
    },
    period(state) {
      return state.data?.period || null;
    },
    trends(state) {
      return state.data?.trends || null;
    },
  },

  actions: {
    setRange(key: RangeKey) {
      this.rangeKey = key;
      if (key !== "custom") {
        this.startDate = "";
        this.endDate = "";
      }
    },

    setCustomRange(startISO: string, endISO: string) {
      this.rangeKey = "custom";
      this.startDate = startISO;
      this.endDate = endISO;
    },

    clearCache() {
      this.cache = {};
    },

    async ensureAnalytics(opts: { force?: boolean; silent?: boolean; noCache?: boolean } = {}) {
      const key = buildKey(this.rangeKey, this.startDate, this.endDate);

      if (!opts.force && !opts.noCache) {
        const cached = this.cache[key];
        if (cached && Date.now() - cached.fetchedAt < this.staleTimeMs) {
          this.data = cached.data;
          this.error = null;
          return;
        }
      }

      return this.fetchAnalytics(opts);
    },

    async fetchAnalytics(opts: { force?: boolean; silent?: boolean; noCache?: boolean } = {}) {
      const { silent = false } = opts;
      const key = buildKey(this.rangeKey, this.startDate, this.endDate);

      if (this.abort) this.abort.abort();
      this.abort = new AbortController();
      const myReq = ++this.reqId;

      if (!silent) {
        this.loading = true;
        this.error = null;
      }

      try {
        const params: Record<string, any> = { rangeKey: this.rangeKey };
        if (this.rangeKey === "custom") {
          if (this.startDate) params.startDate = this.startDate;
          if (this.endDate) params.endDate = this.endDate;
        }
        if (opts.noCache) params.noCache = true;

        const { data } = await api().get<SellerAnalyticsResponse>("plan/vendor/analytics/", {
          params,
          signal: this.abort.signal,
        });

        if (myReq !== this.reqId) return;

        if (!data || typeof data !== "object") throw new Error("Invalid response");
        if (!(data as any).success) throw new Error((data as any)?.error || "Failed to load analytics");

        this.data = data;
        this.cache[key] = { data, fetchedAt: Date.now() };
      } catch (err) {
        if (myReq !== this.reqId) return;
        this.error = normalizeError(err);
      } finally {
        if (myReq === this.reqId && !silent) this.loading = false;
        if (myReq === this.reqId) this.abort = null;
      }
    },
  },
});
