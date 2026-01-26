import { defineStore } from "pinia";
import axios, { AxiosError, AxiosHeaders, type AxiosInstance } from "axios";
import { Alert } from "../../components/composable/Alert";
import type { Order } from "../../types/order";
import { getAuthHeaders } from "../../types/shared";

export type PaymentMethod = "wallet" | "gcash" | "cod";
export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

interface FetchOptions {
  force?: boolean;
  silent?: boolean;
  noCache?: boolean;
}

interface ShipPayload {
  trackingNumber: string;
  carrier: string;
  shipDate?: string;
  notes?: string;
}

type StatusCounts = Record<string, number>;

type CachedList = {
  orders: Order[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  statusCounts: StatusCounts;
  fetchedAt: number;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const DEFAULT_STATUS_COUNTS: StatusCounts = {
  all: 0,
  pending: 0,
  paid: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
};

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function resolveAuthHeader(): string {
  const headers = getAuthHeaders();
  return headers.Authorization || "";
}

let axiosInstance: AxiosInstance | null = null;

function createAxios(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
  });

  instance.interceptors.request.use((config) => {
    const auth = resolveAuthHeader();
    config.headers = AxiosHeaders.from({
      Accept: "application/json",
      ...(auth ? { Authorization: auth } : {}),
      ...(config.headers || {}),
    });
    return config;
  });

  return instance;
}

export function api(): AxiosInstance {
  if (!axiosInstance) axiosInstance = createAxios();
  return axiosInstance;
}

function normalizeAxiosError(err: unknown): string {
  if (axios.isCancel?.(err)) return "Request cancelled";

  const ax = err as AxiosError<any>;

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

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items : [],
    agreementMessages: Array.isArray((order as any).agreementMessages) ? (order as any).agreementMessages : [],
  } as Order;
}

function mergeStatusCounts(input: any): StatusCounts {
  return {
    ...DEFAULT_STATUS_COUNTS,
    ...(input && typeof input === "object" ? input : {}),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function buildListQueryParams(state: any) {
  const params: Record<string, any> = {
    page: state.page,
    limit: state.pageSize,
    sortDir: state.sortDir,
  };

  if (isNonEmptyString(state.search)) params.search = state.search.trim();
  if (state.activeStatus !== "all") params.status = state.activeStatus;
  if (state.filterPaymentMethod !== "all") params.paymentMethod = state.filterPaymentMethod;
  if (state.filterPaymentStatus !== "all") params.paymentStatus = state.filterPaymentStatus;
  if (isNonEmptyString(state.filterDateFrom)) params.dateFrom = state.filterDateFrom;
  if (isNonEmptyString(state.filterDateTo)) params.dateTo = state.filterDateTo;

  return params;
}

function buildQueryKey(params: Record<string, any>) {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${encodeURIComponent(String(params[k]))}`).join("&");
}

function toCreatedAtTs(o: Order): number {
  const v = (o as any).__createdAtTs;
  if (typeof v === "number") return v;
  const ts = new Date(o.createdAt).getTime();
  (o as any).__createdAtTs = Number.isFinite(ts) ? ts : 0;
  return (o as any).__createdAtTs;
}

function matchesActiveFilter(order: Order, state: any): boolean {
  if (state.activeStatus !== "all" && order.status !== state.activeStatus) return false;
  if (state.filterPaymentMethod !== "all" && (order as any).paymentMethod !== state.filterPaymentMethod) return false;
  if (state.filterPaymentStatus !== "all" && (order as any).paymentStatus !== state.filterPaymentStatus) return false;

  const from = state.filterDateFrom ? new Date(state.filterDateFrom).getTime() : null;
  const to = state.filterDateTo ? new Date(state.filterDateTo).getTime() : null;
  if (from || to) {
    const created = toCreatedAtTs(order);
    if (from && created < from) return false;
    if (to && created > to) return false;
  }

  if (isNonEmptyString(state.search)) {
    const s = state.search.trim().toLowerCase();
    const hay = [
      order._id,
      (order as any).orderNumber,
      (order as any).customerName,
      (order as any).customerEmail,
      (order as any).customerPhone,
      (order as any).trackingNumber,
      (order as any).shippingCarrier,
    ]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase())
      .join(" ");
    if (!hay.includes(s)) return false;
  }

  return true;
}

function bumpCounts(counts: StatusCounts, prev: OrderStatus, next: OrderStatus) {
  const c = mergeStatusCounts(counts);
  if (prev in c) c[prev] = Math.max(0, (c[prev] || 0) - 1);
  if (next in c) c[next] = (c[next] || 0) + 1;
  c.all = Math.max(0, (c.all || 0) + (prev === next ? 0 : 0));
  return c;
}

function safeAbortError(err: unknown): boolean {
  const ax = err as any;
  if (axios.isCancel?.(err)) return true;
  const code = ax?.code;
  if (code === "ERR_CANCELED") return true;
  const name = ax?.name;
  if (name === "CanceledError" || name === "AbortError") return true;
  const msg = String(ax?.message || "");
  if (msg.toLowerCase().includes("canceled") || msg.toLowerCase().includes("aborted")) return true;
  return false;
}

function evictCache(cache: Record<string, CachedList>, maxEntries: number) {
  const keys = Object.keys(cache);
  if (keys.length <= maxEntries) return cache;

  keys.sort((a, b) => (cache[a]?.fetchedAt || 0) - (cache[b]?.fetchedAt || 0));
  const toRemove = keys.length - maxEntries;
  for (let i = 0; i < toRemove; i++) delete cache[keys[i]];
  return cache;
}

export const useOrdersStore = defineStore("vendorOrders", {
  state: () => ({
    orders: [] as Order[],
    loading: false,
    error: null as string | null,

    search: "",
    activeStatus: "all" as "all" | OrderStatus,
    filterPaymentMethod: "all" as "all" | PaymentMethod,
    filterPaymentStatus: "all" as "all" | PaymentStatus,
    filterDateFrom: "",
    filterDateTo: "",
    sortDir: "desc" as "asc" | "desc",
    page: 1,
    pageSize: 12,

    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
    statusCounts: { ...DEFAULT_STATUS_COUNTS } as StatusCounts,

    updatingIds: new Set<string>(),

    staleTimeMs: 5 * 60 * 1000,
    queryCache: {} as Record<string, CachedList>,
    maxCacheEntries: 30,

    inFlight: {} as Record<string, Promise<void>>,
    listAbortController: null as AbortController | null,
    listReqId: 0,

    statusMap: {
      pending: { label: "Pending", color: "#eab308" },
      paid: { label: "Paid", color: "#0d9488" },
      shipped: { label: "Shipped", color: "#2563eb" },
      delivered: { label: "Delivered", color: "#16a34a" },
      cancelled: { label: "Cancelled", color: "#dc2626" },
    } as const,
  }),

  getters: {
    sorted(state): Order[] {
      const list = [...state.orders];
      list.sort((a, b) => {
        const av = toCreatedAtTs(a);
        const bv = toCreatedAtTs(b);
        return state.sortDir === "asc" ? av - bv : bv - av;
      });
      return list;
    },

    pageCount(state): number {
      const fromServer = state.totalPages || 0;
      const fromLocal = Math.ceil(state.total / state.pageSize) || 0;
      return Math.max(1, fromServer || fromLocal || 1);
    },

    statusCountsDisplay(state): StatusCounts {
      return mergeStatusCounts(state.statusCounts);
    },

    paged(state): Order[] {
      return state.orders;
    },

    printablePaged(): Order[] {
      return this.paged.filter((o) => this.canPrint(o));
    },

    hasPrintable(): boolean {
      return this.printablePaged.length > 0;
    },

    isUpdating: (state) => (id: string): boolean => state.updatingIds.has(id),

    canPrint: () => (o: Order): boolean => o.status !== "cancelled",

    allowedStatusTransitions: () => (order: Order): OrderStatus[] => {
      switch (order.status) {
        case "pending":
          return ["paid", "shipped", "delivered", "cancelled"];
        case "paid":
          return ["shipped", "delivered", "cancelled"];
        case "shipped":
          return ["delivered", "cancelled"];
        default:
          return [];
      }
    },
  },

  actions: {
    shouldSkipFetch(queryKey: string, opts: FetchOptions) {
      if (opts.force || opts.noCache) return false;

      const cached = this.queryCache[queryKey];
      if (cached && Date.now() - cached.fetchedAt < this.staleTimeMs) {
        this.orders = cached.orders;
        this.total = cached.total;
        this.totalPages = cached.totalPages;
        this.hasNext = cached.hasNext;
        this.hasPrev = cached.hasPrev;
        this.statusCounts = cached.statusCounts;
        return true;
      }

      return false;
    },

    async ensureOrders(opts: FetchOptions = {}) {
      const params = buildListQueryParams(this);
      const queryKey = buildQueryKey(params);
      if (this.shouldSkipFetch(queryKey, opts)) return;
      return this.fetchOrders(opts);
    },

    async fetchOrders(opts: FetchOptions = {}) {
      const { force = false, silent = false, noCache = false } = opts;

      const params = buildListQueryParams(this);
      const queryKey = buildQueryKey(params);

      if (this.shouldSkipFetch(queryKey, { force, noCache })) return;

      if (!force && !noCache && this.inFlight[queryKey]) {
        return this.inFlight[queryKey];
      }

      if (this.listAbortController) this.listAbortController.abort();
      this.listAbortController = new AbortController();

      const reqId = ++this.listReqId;

      if (!silent) {
        this.loading = true;
        this.error = null;
      }

      const run = async () => {
        try {
          const { data } = await api().get("/order/vendor", {
            params,
            signal: this.listAbortController?.signal,
          });

          if (reqId !== this.listReqId) return;

          if (!data || typeof data !== "object") throw new Error("Invalid response shape");

          if (Array.isArray((data as any).orders) && (data as any).pagination) {
            const payload = data as any;

            const normalized = (payload.orders as Order[]).map(normalizeOrder);
            this.orders = normalized;
            this.total = Number(payload.pagination.total) || 0;
            this.totalPages = Number(payload.pagination.totalPages) || 0;
            this.hasNext = Boolean(payload.pagination.hasNext);
            this.hasPrev = Boolean(payload.pagination.hasPrev);
            this.statusCounts = mergeStatusCounts(payload.statusCounts);
          } else {
            const list = Array.isArray(data) ? (data as Order[]) : [];
            const normalized = list.map(normalizeOrder);
            this.orders = normalized;
            this.total = this.orders.length;
            this.totalPages = 1;
            this.hasNext = false;
            this.hasPrev = false;
            this.statusCounts = { ...DEFAULT_STATUS_COUNTS };
          }

          this.queryCache[queryKey] = {
            orders: [...this.orders],
            total: this.total,
            totalPages: this.totalPages,
            hasNext: this.hasNext,
            hasPrev: this.hasPrev,
            statusCounts: { ...this.statusCounts },
            fetchedAt: Date.now(),
          };

          evictCache(this.queryCache, this.maxCacheEntries);
        } catch (err) {
          if (reqId !== this.listReqId) return;

          if (!safeAbortError(err)) {
            this.error = normalizeAxiosError(err);
          }
        } finally {
          if (reqId === this.listReqId && !silent) this.loading = false;
          if (reqId === this.listReqId) this.listAbortController = null;
          delete this.inFlight[queryKey];
        }
      };

      this.inFlight[queryKey] = run();
      return this.inFlight[queryKey];
    },

    markOrdersStale() {
      this.queryCache = {};
    },

    invalidateAllLists() {
      this.markOrdersStale();
      this.listReqId++;
    },

    async fetchSingleOrder(orderId: string): Promise<Order | null> {
      try {
        const { data } = await api().get<Order>(`/order/${encodeURIComponent(orderId)}`);

        if (data && (data as any)._id) {
          const normalized = normalizeOrder(data);
          const index = this.orders.findIndex((o) => o._id === normalized._id);

          if (index !== -1) this.orders[index] = normalized;
          return index !== -1 ? this.orders[index] : normalized;
        }

        return null;
      } catch (err) {
        console.error(`Failed to fetch order ${orderId}:`, normalizeAxiosError(err));
        return null;
      }
    },

    applyLocalStatusChange(id: string, prevStatus: OrderStatus, nextStatus: OrderStatus) {
      const idx = this.orders.findIndex((o) => o._id === id);
      if (idx === -1) return;

      const order = this.orders[idx];

      order.status = nextStatus;
      if (nextStatus === "paid") (order as any).paymentStatus = "Paid";
      if (nextStatus === "cancelled" && (order as any).paymentStatus === "Paid") (order as any).paymentStatus = "Refunded";

      const shouldKeep = matchesActiveFilter(order, this);

      if (!shouldKeep) {
        this.orders.splice(idx, 1);
        this.total = Math.max(0, this.total - 1);
      }

      this.statusCounts = bumpCounts(this.statusCounts, prevStatus, nextStatus);

      this.invalidateAllLists();
    },

    rollbackLocalOrder(prevSnapshot: Order, originalIndex: number, existedInList: boolean) {
      if (existedInList) {
        const idx = this.orders.findIndex((o) => o._id === prevSnapshot._id);
        if (idx !== -1) {
          this.orders[idx] = prevSnapshot;
        } else {
          const insertAt = clamp(originalIndex, 0, this.orders.length);
          this.orders.splice(insertAt, 0, prevSnapshot);
          this.total += 1;
        }
      } else {
        const idx = this.orders.findIndex((o) => o._id === prevSnapshot._id);
        if (idx !== -1) {
          this.orders.splice(idx, 1);
          this.total = Math.max(0, this.total - 1);
        }
      }
    },

    async updateOrderStatus(id: string, next: OrderStatus) {
      const index = this.orders.findIndex((o) => o._id === id);
      const order = index !== -1 ? this.orders[index] : null;

      if (!order) throw new Error("Order not found");
      if (order.status === next) return;

      const prevStatus = order.status as OrderStatus;
      const existedInList = true;
      const prevSnapshot = { ...(order as any) } as Order;

      this.updatingIds.add(id);

      try {
        this.applyLocalStatusChange(id, prevStatus, next);

        const { data } = await api().patch<Order | Record<string, any>>(
          `/order/${encodeURIComponent(id)}/status`,
          { newStatus: next }
        );

        if ((data as any)?._id) {
          const normalized = normalizeOrder(data as Order);
          const currentIdx = this.orders.findIndex((o) => o._id === normalized._id);

          if (currentIdx !== -1) {
            this.orders[currentIdx] = normalized;
          } else if (matchesActiveFilter(normalized, this)) {
            this.orders.unshift(normalized);
            this.total += 1;
          }
        }

        Alert(`Order updated to ${next}`, "success", "var(--primary-color)");
      } catch (err) {
        this.rollbackLocalOrder(prevSnapshot, index, existedInList);
        this.statusCounts = bumpCounts(this.statusCounts, next, prevStatus);
        this.invalidateAllLists();

        const msg = normalizeAxiosError(err);
        Alert(`Failed to update order: ${msg}`, "error");
        throw new Error(msg);
      } finally {
        this.updatingIds.delete(id);
      }
    },

    async shipOrder(id: string, payload: ShipPayload) {
      const index = this.orders.findIndex((o) => o._id === id);
      const order = index !== -1 ? this.orders[index] : null;

      if (!order) throw new Error("Order not found");
      if (order.status !== "paid") throw new Error("Only paid orders can be shipped");

      const trackingNumber = payload.trackingNumber?.trim();
      const carrier = payload.carrier?.trim();

      if (!trackingNumber) throw new Error("Tracking number is required");
      if (!carrier) throw new Error("Carrier is required");

      const existedInList = true;
      const prevSnapshot = { ...(order as any) } as Order;

      this.updatingIds.add(id);

      try {
        order.trackingNumber = trackingNumber as any;
        (order as any).shippingCarrier = carrier;
        (order as any).shippedAt = payload.shipDate || new Date().toISOString();
        if (payload.notes) (order as any).shippingNotes = payload.notes;

        const prevStatus = order.status as OrderStatus;
        this.applyLocalStatusChange(id, prevStatus, "shipped");

        const { data } = await api().patch<Order | Record<string, any>>(
          `/vendor/orders/${encodeURIComponent(id)}/ship`,
          {
            trackingNumber: (order as any).trackingNumber,
            carrier: (order as any).shippingCarrier,
            shipDate: (order as any).shippedAt,
            notes: (order as any).shippingNotes,
            status: "shipped",
          }
        );

        if ((data as any)?._id) {
          const normalized = normalizeOrder(data as Order);
          const currentIdx = this.orders.findIndex((o) => o._id === normalized._id);

          if (currentIdx !== -1) {
            this.orders[currentIdx] = normalized;
          } else if (matchesActiveFilter(normalized, this)) {
            this.orders.unshift(normalized);
            this.total += 1;
          }
        }

        Alert("Order shipped", "success", "var(--primary-color)");
      } catch (err) {
        this.rollbackLocalOrder(prevSnapshot, index, existedInList);
        this.statusCounts = bumpCounts(this.statusCounts, "shipped", prevSnapshot.status as OrderStatus);
        this.invalidateAllLists();

        const msg = normalizeAxiosError(err);
        Alert(`Failed to ship order: ${msg}`, "error");
        throw new Error(msg);
      } finally {
        this.updatingIds.delete(id);
      }
    },

    async addAgreementMessage(orderId: string, message: string) {
      const content = message.trim();
      if (!content) return;

      const idx = this.orders.findIndex((o) => o._id === orderId);
      const order = idx !== -1 ? this.orders[idx] : null;
      const prev = order ? ({ ...(order as any) } as Order) : null;

      this.updatingIds.add(orderId);
      try {
        if (order) {
          const arr = Array.isArray((order as any).agreementMessages) ? (order as any).agreementMessages : [];
          (order as any).agreementMessages = [...arr, { message: content, createdAt: new Date().toISOString() }];
        }

        await api().post(`/order/${encodeURIComponent(orderId)}/agreement-message`, { message: content });

        this.invalidateAllLists();
      } catch (err) {
        if (prev && idx !== -1) this.orders[idx] = prev;

        const errorMsg = normalizeAxiosError(err);
        Alert(`Failed to send message: ${errorMsg}`, "error");
        throw new Error(errorMsg);
      } finally {
        this.updatingIds.delete(orderId);
      }
    },

    setSearch(v: string) {
      this.search = v;
      this.page = 1;
    },

    setActiveStatus(v: "all" | OrderStatus) {
      this.activeStatus = v;
      this.page = 1;
    },

    setSortDir(d: "asc" | "desc") {
      this.sortDir = d;
      this.page = 1;
      this.invalidateAllLists();
    },

    setFilters(partial: {
      paymentMethod?: "all" | PaymentMethod;
      paymentStatus?: "all" | PaymentStatus;
      dateFrom?: string;
      dateTo?: string;
    }) {
      if (partial.paymentMethod !== undefined) this.filterPaymentMethod = partial.paymentMethod;
      if (partial.paymentStatus !== undefined) this.filterPaymentStatus = partial.paymentStatus;
      if (partial.dateFrom !== undefined) this.filterDateFrom = partial.dateFrom;
      if (partial.dateTo !== undefined) this.filterDateTo = partial.dateTo;

      this.page = 1;
    },

    resetFilters() {
      this.filterPaymentMethod = "all";
      this.filterPaymentStatus = "all";
      this.filterDateFrom = "";
      this.filterDateTo = "";

      this.page = 1;
    },

    setPage(p: number) {
      this.page = clamp(p, 1, this.pageCount);
    },

    nextPage() {
      if (this.page < this.pageCount) this.page += 1;
    },

    prevPage() {
      if (this.page > 1) this.page -= 1;
    },
  },
});
