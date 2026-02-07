import { defineStore } from "pinia";
import axios, { AxiosError } from "axios";
import { Alert } from "../../components/composable/Alert";
import type { Vendor } from "../../types/vendor/vendor";
import { getAuthHeaders } from "../../types/shared";
import type { Product, ProductOption } from "../../types/product";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const getHeaders = () => getAuthHeaders();

type SortDirection = "asc" | "desc";

function createIdempotencyKey() {
  const c = globalThis.crypto as Crypto | undefined;

  if (c?.randomUUID) return c.randomUUID();

  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const hex = Array.from(bytes, toHex).join("");

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface NewOptionInput {
  _id?: string;
  imageUrl?: string;
  price: number;
  label?: string | null;
  stock?: number;
  sold?: number;
  isHot?: boolean;
}

export interface FinancialSummary {
  totalGrossRevenue: number;
  totalCommissionPaid: number;
  totalCommissionPending: number;
  totalNetEarnings: number;
  codPendingCommission: number;
  digitalPaymentCommission: number;
  commissionRate: number;
  totalOrders: number;
  netEarningsReleased?: number;
  pendingAdminRelease?: number;
  netEarningsExpected?: number;
}

export interface MonthlyBreakdown {
  [month: string]: {
    grossRevenue: number;
    commissionPaid: number;
    commissionPending: number;
    netEarnings: number;
    orderCount: number;
  };
}

export interface RecentOrder {
  orderId: string;
  orderNumber: string;
  date: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  grossAmount: number;
  commissionAmount: number;
  commissionStatus: string;
  netEarnings: number;
  buyerName: string;
}

export interface PendingCODCommission {
  orderId: string;
  orderNumber: string;
  deliveredDate: string;
  grossAmount: number;
  commissionDue: number;
  buyerName: string;
  buyerPhone: string;
}

interface State {
  vendor: Vendor | null;
  vendorProducts: Partial<Product>[];
  loading: boolean;
  error: string | null;

  financialSummary: FinancialSummary | null;
  monthlyBreakdown: MonthlyBreakdown | null;
  recentOrders: RecentOrder[];
    // Pagination metadata for recentOrders
  recentOrdersPage?: number | null;
  recentOrdersLimit?: number | null;
  recentOrdersTotal?: number | null;
  pendingCODCommissions: PendingCODCommission[];
  financialsLoading: boolean;

  withdrawals: any[];

  financialsLastFetched: number | null;
  isFinancialsFetched: boolean;
  pendingCODLastFetched: number | null;
  isPendingCODFetched: boolean;

  walletBalance: number;

  _financialsPromise: Promise<any> | null;
  _pendingCODPromise: Promise<any> | null;
}

function capitalizeFirst(str?: string | null): string | null {
  if (!str) return null;
  const t = str.trim();
  if (!t) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function normalizeNewOption(input: NewOptionInput): Required<NewOptionInput> {
  return {
    _id: input._id || "",
    imageUrl: input.imageUrl?.trim() || "",
    price: Number(input.price),
    label: capitalizeFirst(input.label ?? null),
    stock: input.stock != null ? Number(input.stock) : 0,
    sold: input.sold != null ? Number(input.sold) : 0,
    isHot: !!input.isHot,
  };
}

function extractTimestamp(doc: any): number {
  if (!doc || typeof doc !== "object") return 0;
  if (doc.createdAt) {
    const t = Date.parse(doc.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  if (doc.updatedAt) {
    const t = Date.parse(doc.updatedAt);
    if (!Number.isNaN(t)) return t;
  }
  if (doc._id && typeof doc._id === "string" && doc._id.length >= 8) {
    const seconds = parseInt(doc._id.substring(0, 8), 16);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return 0;
}

function sortByDate<T>(items: T[], dir: SortDirection = "desc"): T[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...items].sort((a: any, b: any) => (extractTimestamp(a) - extractTimestamp(b)) * mult);
}

function recomputeAggregates(product: Product) {
  if (Array.isArray(product.option) && product.option.length > 0) {
    product.stock = product.option.reduce((s, o) => s + (o.stock || 0), 0);
    product.sold = product.option.reduce((s, o) => s + (o.sold || 0), 0);
    product.isOption = true;
  } else {
    product.isOption = false;
  }
}

function isDataUrl(v?: string) {
  return !!v && /^data:image\/[a-zA-Z]+;base64,/.test(v);
}

function dataURItoBlob(dataURI: string): Blob {
  const [meta, base64] = dataURI.split(",");
  const mime = meta.split(":")[1].split(";")[0];
  const binary = atob(base64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function uploadImageDataUrl(dataUrl: string, productId: string, optionId?: string) {
  const fd = new FormData();
  fd.append("images", dataURItoBlob(dataUrl), "option-image.png");
  if (productId) fd.append("productId", productId);
  if (optionId) fd.append("optionId", optionId);

  const requestHeaders = getHeaders();
  const { data } = await axios.post(`${API_BASE_URL}/upload`, fd, {
    headers: {
      Authorization: requestHeaders.Authorization,
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
}

function extractUploadedUrl(resp: any): string | null {
  return (
    resp?.secureUrl ||
    resp?.secure_url ||
    resp?.url ||
    resp?.imageUrl ||
    resp?.imageURL ||
    resp?.images?.[0]?.secureUrl ||
    resp?.images?.[0]?.secure_url ||
    resp?.images?.[0]?.url ||
    null
  );
}

export const useVendorDashboardStore = defineStore("vendor-dashboard", {
  state: (): State => ({
    vendor: null,
    vendorProducts: [],
    loading: false,
    error: null,

    financialSummary: null,
    monthlyBreakdown: null,
    recentOrders: [],
    // Pagination metadata for recentOrders
    recentOrdersPage: 1,
    recentOrdersLimit: 12,
    recentOrdersTotal: 0,
    pendingCODCommissions: [],
    financialsLoading: false,

    withdrawals: [],

    financialsLastFetched: null,
    isFinancialsFetched: false,
    pendingCODLastFetched: null,
    isPendingCODFetched: false,

    walletBalance: 0,

    _financialsPromise: null,
    _pendingCODPromise: null,
  }),

  getters: {
    isApproved: (state) => state.vendor?.isApproved ?? false,
    vendorName: (state) => state.vendor?.storeName ?? "",
    revenueThisMonth: (state) => state.vendor?.currentMonthlyRevenue ?? 0,
    revenueComparison: (state) => state.vendor?.monthlyRevenueComparison ?? [],

    totalGrossRevenue: (state) => state.financialSummary?.totalGrossRevenue ?? 0,
    totalNetEarnings: (state) => state.financialSummary?.totalNetEarnings ?? 0,
    totalCommissionPaid: (state) => state.financialSummary?.totalCommissionPaid ?? 0,
    totalCommissionPending: (state) => state.financialSummary?.totalCommissionPending ?? 0,
    codPendingCommission: (state) => state.financialSummary?.codPendingCommission ?? 0,
    commissionRate: (state) => state.financialSummary?.commissionRate ?? 7,
  },

  actions: {
    normalizeProduct(raw: any): Product {
      const imageUrls: string[] = Array.isArray(raw.imageUrls)
        ? raw.imageUrls
        : Array.isArray(raw.imgurl)
          ? raw.imgurl
          : raw.imgurl
            ? [raw.imgurl]
            : [];

      const categories: string[] = Array.isArray(raw.categories)
        ? raw.categories.map((c: any) => (typeof c === "string" ? c.trim() : "")).filter(Boolean)
        : [];

      const options: ProductOption[] = Array.isArray(raw.option)
        ? sortByDate(
            raw.option.map((o: any) => ({
              _id: String(o._id || ""),
              imageUrl: o.imageUrl ? String(o.imageUrl) : "",
              price: Number(o.price ?? 0),
              label: o.label != null ? String(o.label) : "",
              isHot: !!o.isHot,
              stock: Number(o.stock ?? 0),
              sold: Number(o.sold ?? 0),
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              promotion: o.promotion,
              hasPromotion: o.hasPromotion,
              promotionStatus: o.promotionStatus,
            })),
            "desc",
          )
        : [];

      const product: Product | any = {
        _id: String(raw._id || ""),
        vendorId: raw.vendorId ? String(raw.vendorId) : undefined,
        name: raw.name ? String(raw.name) : "",
        description: raw.description ? String(raw.description) : "",
        price: Number(raw.price ?? 0),
        stock: Number(raw.stock ?? 0),
        sold: Number(raw.sold ?? 0),
        option: options,
        categories,
        isOption: !!raw.isOption,
        imageUrls,
        isNew: !!raw.isNew,
        isHot: !!raw.isHot,
        isApproved: !!raw.isApproved,
        status: raw.status || "pending_review",
        rejectionReason: raw.rejectionReason || undefined,
        rejectedAt: raw.rejectedAt || undefined,
        averageRating: Number(raw.averageRating ?? 0),
        numReviews: Number(raw.numReviews ?? 0),
        municipality: raw.municipality ? String(raw.municipality) : "",
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        promotion: raw.promotion || undefined,
        hasPromotion: raw.hasPromotion,
        promotionStatus: raw.promotionStatus,
        // J&T Shipping Profile
        weightKg: raw.weightKg ?? null,
        lengthCm: raw.lengthCm ?? null,
        widthCm: raw.widthCm ?? null,
        heightCm: raw.heightCm ?? null,
        shippingDiscountType: raw.shippingDiscountType || 'NONE',
        shippingDiscountValue: Number(raw.shippingDiscountValue ?? 0),
      };

      recomputeAggregates(product);
      return product;
    },

    async syncProductDerivedFields(productId: string, persist = true) {
      const prod = this.vendorProducts.find((p) => p._id === productId) as any;
      if (!prod) return;
      recomputeAggregates(prod);
      if (!persist) return;
      try {
        await axios.put(
          `${API_BASE_URL}/products/${productId}`,
          { stock: prod.stock, sold: prod.sold },
          { headers: getHeaders() },
        );
      } catch (e) {
        console.warn("[syncProductDerivedFields] Persist failed", e);
      }
    },

    async fetchVendor(sortDir: SortDirection = "desc") {
      if (this.loading) return;
      this.loading = true;
      this.error = null;

      try {
        const requestHeaders = getHeaders();
        const { data: vendorData } = await axios.get(`${API_BASE_URL}/vendor`, { headers: requestHeaders });
        this.vendor = vendorData;

      this.walletBalance = vendorData?.wallet || 0;

        if (!vendorData?.userId) {
          this.vendorProducts = [];
          return;
        }

        void this.fetchVendorProducts(vendorData.userId, sortDir);
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Vendor fetch error:", e);
        this.error = e.response?.data?.message || "Failed to load vendor";
      } finally {
        this.loading = false;
      }
    },

    async fetchVendorProducts(userId: string, sortDir: SortDirection = "desc") {
      try {
        const requestHeaders = getHeaders();
        const { data: rawProducts } = await axios.get(`${API_BASE_URL}/products/vendor/${userId}/own`, {
          headers: requestHeaders,
          timeout: 10000,
        });

        const normalized: Product[] = rawProducts.map((p: any) => this.normalizeProduct(p));
        this.vendorProducts = sortByDate(normalized, sortDir);
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Vendor products fetch error:", e);
      }
    },

    async updateBaseProduct(productId: string, updated: Partial<Product>) {
      try {
        const requestHeaders = getHeaders();
        await axios.put(`${API_BASE_URL}/products/${productId}`, updated, { headers: requestHeaders });
        await this.refreshSingleProduct(productId);
        Alert("Product successfully updated!", "success", "var(--primary-color)");
      } catch (error: any) {
        Alert(`Product update failed! ${error?.response?.status || ""}`, "error", "var(--secondary-color)");
        console.error(error);
      }
    },

    async uploadProducts(data: any) {
      try {
        data.imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls : [];
        if (Array.isArray(data.option) && data.option.length > 0) {
          data.imageUrls = [];
          data.stock = 0;
          data.sold = 0;
          data.option.forEach((opt: any) => {
            if (opt.imageUrl) data.imageUrls.push(opt.imageUrl);
            data.stock += opt.stock || 0;
            data.sold += opt.sold || 0;
          });
        }

        const requestHeaders = getHeaders();
        await axios.post(`${API_BASE_URL}/products`, data, { headers: requestHeaders });
        await this.fetchVendor();
      } catch (error) {
        console.error(error);
      }
    },

    async deleteProduct(productId: string, variantId: string) {
      try {
        const deletingVariant = !!variantId;

        if (deletingVariant) {
          const isTemp = typeof variantId === "string" && variantId.startsWith("temp-");
          const isObjectId = typeof variantId === "string" && /^[a-fA-F0-9]{24}$/.test(variantId);

          if (!isObjectId && !isTemp) {
            Alert("Invalid variant ID", "error", "var(--secondary-color)");
            return;
          }

          if (isTemp) {
            const idx = this.vendorProducts.findIndex((p: any) => p._id === productId);
            if (idx > -1) {
              const prod: any = this.vendorProducts[idx];
              prod.option = prod.option.filter((o: any) => o._id !== variantId);
              await this.syncProductDerivedFields(productId, true);
              await this.refreshSingleProduct(productId);
            }
            Alert("Variant removed locally.", "success", "var(--primary-color)");
            return;
          }

          try {
            const requestHeaders = getHeaders();
            await axios.delete(`${API_BASE_URL}/products/${productId}/options/${variantId}`, { headers: requestHeaders });

            const idx = this.vendorProducts.findIndex((p: any) => p._id === productId);
            if (idx > -1) {
              const prod: any = this.vendorProducts[idx];
              prod.option = prod.option.filter((o: any) => o._id !== variantId);
              await this.syncProductDerivedFields(productId, true);
            }

            await this.refreshSingleProduct(productId);
            Alert("Variant deleted successfully!", "success", "var(--primary-color)");
            return;
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Variant deletion failed";
            Alert(`Variant delete failed: ${msg}`, "error", "var(--secondary-color)");
            console.error("Variant delete error:", msg);
            return;
          }
        }

        try {
          const requestHeaders = getHeaders();
          await axios.delete(`${API_BASE_URL}/products/${productId}`, { headers: requestHeaders });
          this.vendorProducts = this.vendorProducts.filter((p: any) => p._id !== productId);
          Alert("Product Successfully Deleted!", "success", "var(--primary-color)");
        } catch (err: any) {
          Alert(`Product Delete Failed: ${err?.response?.data?.message || err?.message}`, "error", "var(--secondary-color)");
          console.error("Product delete error:", err?.response?.data || err?.message);
        }
      } catch (error) {
        Alert("Product Delete Failed!", "error", "var(--secondary-color)");
        console.error(error);
      }
    },

    async updateOptionedProduct(productId: string, variantId: string, updated: Partial<ProductOption>) {
      try {
        if (updated.label != null) updated.label = capitalizeFirst(updated.label) as any;

        if (updated.imageUrl && isDataUrl(updated.imageUrl)) {
          try {
            const resp = await uploadImageDataUrl(updated.imageUrl, productId, variantId);
            const finalUrl = extractUploadedUrl(resp);
            if (!finalUrl) {
              Alert("Image upload failed (no URL).", "error", "var(--secondary-color)");
              return;
            }
            updated.imageUrl = finalUrl;
          } catch (uploadErr: any) {
            Alert("Image upload failed. Update aborted.", "error", "var(--secondary-color)");
            console.error("Image upload failed:", uploadErr);
            return;
          }
        }

        const productIdx = this.vendorProducts.findIndex((product: any) => product._id === productId);
        const requestHeaders = getHeaders();

        if (productIdx > -1) {
          const prod: any = this.vendorProducts[productIdx];
          const optIdx = prod.option.findIndex((o: any) => o._id === variantId);
          if (optIdx > -1) {
            prod.option[optIdx] = { ...prod.option[optIdx], ...updated, updatedAt: new Date().toISOString() };
            await this.syncProductDerivedFields(productId, false);
          }
        }

        await axios.patch(`${API_BASE_URL}/products/${productId}/options/${variantId}`, updated, { headers: requestHeaders });
        await this.syncProductDerivedFields(productId, true);
        await this.refreshSingleProduct(productId);

        Alert("Product option updated!", "success", "var(--primary-color)");
      } catch (error: any) {
        Alert(`Product option update failed! ${error?.response?.status || ""}`, "error", "var(--secondary-color)");
        console.error(error);
        await this.refreshSingleProduct(productId);
      }
    },

    async addOption(productId: string, newOption: NewOptionInput) {
      const product: any = this.vendorProducts.find((p: any) => p._id === productId);
      if (!product) throw new Error("Product not found in store.");

      if (newOption.imageUrl && isDataUrl(newOption.imageUrl)) {
        try {
          const resp = await uploadImageDataUrl(newOption.imageUrl, productId);
          const finalUrl = extractUploadedUrl(resp);
          if (!finalUrl) {
            Alert("Option image upload failed (no URL).", "error", "var(--secondary-color)");
            return;
          }
          newOption.imageUrl = finalUrl;
        } catch (e) {
          Alert("Option image upload failed.", "error", "var(--secondary-color)");
          throw e;
        }
      }

      const payload = normalizeNewOption({ ...newOption, _id: "", sold: newOption.sold ?? 0, isHot: newOption.isHot ?? false });

      const snapshot = [...product.option];
      product.option.push({
        _id: `temp-${Date.now()}`,
        imageUrl: payload.imageUrl,
        price: payload.price,
        label: payload.label,
        isHot: payload.isHot,
        stock: payload.stock,
        sold: payload.sold,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      await this.syncProductDerivedFields(productId, false);

      try {
        const requestHeaders = getHeaders();
        const { data } = await axios.post(`${API_BASE_URL}/products/${productId}/options`, payload, { headers: requestHeaders });

        await this.syncProductDerivedFields(productId, true);

        if (data?.product) {
          const idx = this.vendorProducts.findIndex((p: any) => p._id === productId);
          if (idx > -1) this.vendorProducts[idx] = this.normalizeProduct(data.product);
        } else {
          await this.refreshSingleProduct(productId);
        }

        Alert("Option added successfully!", "success", "var(--primary-color)");
      } catch (err: any) {
        product.option = snapshot;
        await this.syncProductDerivedFields(productId, false);
        Alert("Failed to add option. Please try again!", "error", "var(--secondary-color)");
        console.error("addOption failed:", err);
        throw new Error(err.response?.data?.message || "Failed to add option");
      }
    },

    async refreshSingleProduct(productId: string) {
      try {
        const requestHeaders = getHeaders();
        const { data } = await axios.get(`${API_BASE_URL}/products/${productId}`, { headers: requestHeaders });
        const normalized = this.normalizeProduct(data);
        const idx = this.vendorProducts.findIndex((p: any) => p._id === productId);
        if (idx > -1) {
          this.vendorProducts[idx] = normalized;
        } else {
          this.vendorProducts.push(normalized);
          this.vendorProducts = sortByDate(this.vendorProducts as any, "desc") as any;
        }
      } catch (e) {
        console.warn("Failed to refresh product", e);
      }
    },

    async adjustProductStock(productId: any, optionId: any, delta: any) {
      try {
        const requestHeaders = getHeaders();

        if (optionId == null) {
          const res = await axios.patch(`${API_BASE_URL}/products/${productId}/stock`, { delta }, { headers: requestHeaders });
          return res.data;
        }

        const res = await axios.patch(`${API_BASE_URL}/products/${productId}/${optionId}/stock`, { delta }, { headers: requestHeaders });
        return res.data;
      } catch (error: any) {
        const message = error.response?.data?.message || error.message || "Failed to adjust stock";
        console.error("Error adjusting product stock:", error.response?.data || error.message);
        Alert(`Unable to adjust stock: ${message}`, "error", "var(--secondary-color)");
        return null;
      }
    },

    resortProducts(order: SortDirection = "desc") {
      this.vendorProducts = sortByDate(this.vendorProducts as any, order) as any;
      this.vendorProducts.forEach((p: any) => {
        p.option = sortByDate(p.option, order);
      });
    },

    clearVendor() {
      this.vendor = null;
      this.vendorProducts = [];
      this.financialSummary = null;
      this.monthlyBreakdown = null;
      this.recentOrders = [];
      this.pendingCODCommissions = [];
      this.withdrawals = [];

      this.financialsLastFetched = null;
      this.isFinancialsFetched = false;
      this.pendingCODLastFetched = null;
      this.isPendingCODFetched = false;

      this._financialsPromise = null;
      this._pendingCODPromise = null;
    },

    async fetchVendorFinancials({ force = false, ttlMs = 1000 * 60 * 5, page = 1, limit = 12 }: { force?: boolean; ttlMs?: number; page?: number; limit?: number } = {}) {
      const last = this.financialsLastFetched ?? 0;
      const fresh = !!last && Date.now() - last < ttlMs;

      // If asking for the first page, we can use cached summary/data when fresh
      if (page === 1) {
        if (!force && this.isFinancialsFetched && this.financialSummary && fresh) {
          // Also ensure cached pagination settings match
          if (this.recentOrdersPage === 1 && this.recentOrdersLimit === limit) {
            return { skipped: true, summary: this.financialSummary };
          }
        }

        if (!force && this._financialsPromise) return this._financialsPromise;
      }

      this.financialsLoading = true;

      const params: any = {};
      if (page) params.page = page;
      if (limit) params.limit = limit;

      const p = (async () => {
        try {
          const requestHeaders = getHeaders();
          const { data } = await axios.get(`${API_BASE_URL}/vendor/financials`, { headers: requestHeaders, params });

          if (data?.success) {
            this.financialSummary = {
              netEarningsReleased: 0,
              pendingAdminRelease: 0,
              netEarningsExpected: 0,
              ...data.summary,
            } as FinancialSummary;

            this.monthlyBreakdown = data.monthlyBreakdown;

            // Support paginated recentOrders shape from server
            const ro = data.recentOrders;
            if (ro && typeof ro === "object" && Array.isArray(ro.data)) {
              this.recentOrders = ro.data;
              this.recentOrdersPage = ro.page || page;
              this.recentOrdersLimit = ro.limit || limit;
              this.recentOrdersTotal = ro.total || (ro.data || []).length;
            } else {
              // Backwards-compatible: server returned an array
              this.recentOrders = data.recentOrders || [];
              this.recentOrdersPage = 1;
              this.recentOrdersLimit = limit;
              this.recentOrdersTotal = (data.recentOrders || []).length;
            }

            this.financialsLastFetched = Date.now();
            this.isFinancialsFetched = true;
          }

          return data;
        } catch (err) {
          const e = err as AxiosError<any>;
          console.error("Failed to fetch vendor financials:", e.response?.data?.error || e.message);
          return null;
        } finally {
          this.financialsLoading = false;
          this._financialsPromise = null;
        }
      })();

      // Store promise only for page 1 to avoid collisions
      if (page === 1) this._financialsPromise = p;
      return p;
    },

    async fetchPendingCODCommissions({ force = false, ttlMs = 1000 * 60 * 2 }: { force?: boolean; ttlMs?: number } = {}) {
      const last = this.pendingCODLastFetched ?? 0;
      const fresh = !!last && Date.now() - last < ttlMs;

      if (!force && this.isPendingCODFetched && fresh) {
        return { skipped: true, orders: this.pendingCODCommissions };
      }

      if (!force && this._pendingCODPromise) return this._pendingCODPromise;

      const p = (async () => {
        try {
          const requestHeaders = getHeaders();
          const { data } = await axios.get(`${API_BASE_URL}/vendor/pending-commissions`, { headers: requestHeaders });

          if (data?.success) {
            this.pendingCODCommissions = data.orders || [];
            this.pendingCODLastFetched = Date.now();
            this.isPendingCODFetched = true;
          }

          return data;
        } catch (err) {
          const e = err as AxiosError<any>;
          console.error("Failed to fetch pending COD commissions:", e.response?.data?.error || e.message);
          return null;
        } finally {
          this._pendingCODPromise = null;
        }
      })();

      this._pendingCODPromise = p;
      return p;
    },

    async fetchWithdrawals(limit = 50) {
      try {
        const requestHeaders = getHeaders();
        const { data } = await axios.get(`${API_BASE_URL}/payments/my-payments?type=withdraw&limit=${limit}`, {
          headers: requestHeaders,
        });

        this.withdrawals = data || data.data || [];
        return this.withdrawals;
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Failed to fetch withdrawals:", e.response?.data?.error || e.message);
        return [];
      }
    },

    async withdraw({
      amount,
      payoutMethod,
      bankAccount,
    }: {
      amount: number;
      payoutMethod?: string;
      bankAccount?: any;
    }) {
      try {
        if (!amount || Number(amount) <= 0) throw new Error("Invalid amount");

        const amountCentavos = Math.round(Number(amount) * 100);

        const method = String(payoutMethod || "gcash").trim().toLowerCase();
        const allowed = ["gcash", "paymaya"];
        if (!allowed.includes(method)) throw new Error("Withdrawal is only available via GCash or PayMaya");

        const acctNo = String(bankAccount?.accountNumber || "").trim();
        const acctName = String(bankAccount?.accountName || "").trim();

        if (!acctNo || !acctName) throw new Error("Mobile number and account name are required");

        const phMobileRegex = /^(?:\+63|63|0)9\d{9}$/;
        if (!phMobileRegex.test(acctNo.replace(/\s+/g, ""))) throw new Error("Invalid PH mobile number (use 09XXXXXXXXX)");

        const requestHeaders = getHeaders();
        const idempotencyKey = createIdempotencyKey();

        const payload = {
          amount: amountCentavos,
          payoutMethod: method,
          bankAccount: {
            accountNumber: acctNo,
            accountName: acctName,
            bankName: method === "gcash" ? "GCash" : "PayMaya",
          },
          idempotencyKey,
        };

        const { data } = await axios.post(`${API_BASE_URL}/payments/withdraw`, payload, {
          headers: { ...requestHeaders, "Idempotency-Key": idempotencyKey },
        });

        void this.fetchWithdrawals();
        void this.fetchVendor();

        return data;
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Withdrawal failed:", e.response?.data?.error || e.message);
        throw err;
      }
    },

    createIdempotencyKey(prefix = "cashin") {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `${prefix}-${crypto.randomUUID()}`;
      }
      const rand = Math.random().toString(36).slice(2);
      const time = Date.now().toString(36);
      return `${prefix}-${time}-${rand}`;
    },

    async cashIn({ amount, paymentMethod }: { amount: number; paymentMethod?: string }) {
      try {
        if (amount === undefined || Number(amount) < 0) throw new Error("Invalid amount");

        const amountCentavos = Math.round(Number(amount) * 100);
        const headers = getHeaders();
        const idempotencyKey = this.createIdempotencyKey("cashin");

        const payload: any = { amount: amountCentavos, idempotencyKey };
        if (paymentMethod) payload.paymentMethod = paymentMethod;

        const { data } = await axios.post(`${API_BASE_URL}/payments/cash-in`, payload, {
          headers: { ...headers, "Idempotency-Key": idempotencyKey },
        });

        return data;
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Cash-in failed:", e.response?.data?.error || e.message);
        throw err;
      }
    },

    async cancelWithdrawal(paymentId: string, reason = "") {
      try {
        const requestHeaders = getHeaders();
        const { data } = await axios.post(
          `${API_BASE_URL}/payments/${paymentId}/cancel-withdrawal`,
          { reason },
          { headers: requestHeaders },
        );

        void this.fetchWithdrawals();
        void this.fetchVendor();

        return data;
      } catch (err) {
        const e = err as AxiosError<any>;
        console.error("Failed to cancel withdrawal:", e.response?.data?.error || e.message);
        throw err;
      }
    },

    async updateVendor(updates: any) {
      try {
        const requestHeaders = getHeaders();
        const { data } = await axios.put(`${API_BASE_URL}/vendor`, updates, { headers: requestHeaders });
        this.vendor = data;
        Alert("Vendor profile updated successfully!", "success", "var(--primary-color)");
      } catch (err: any) {
        Alert(`Vendor update failed: ${err?.response?.data?.message || err?.message}`, "error", "var(--secondary-color)");
        console.error("Vendor update error:", err);
        throw err;
      }
    },

    // ─── Pinned Products (Subscription Benefit) ─────────────────
    async getPinnedProducts() {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/vendor/pinned-products`, { headers: getHeaders() });
        return data?.data || [];
      } catch (err: any) {
        console.error("Get pinned products error:", err);
        return [];
      }
    },

    async pinProduct(productId: string) {
      try {
        const { data } = await axios.post(
          `${API_BASE_URL}/vendor/pin-product`,
          { productId },
          { headers: getHeaders() },
        );
        Alert("Product pinned to Featured!", "success", "var(--primary-color)");
        return data;
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Failed to pin product";
        Alert(msg, "error", "var(--secondary-color)");
        throw err;
      }
    },

    async unpinProduct(productId: string) {
      try {
        const { data } = await axios.delete(`${API_BASE_URL}/vendor/pin-product/${productId}`, {
          headers: getHeaders(),
        });
        Alert("Product unpinned from Featured.", "success", "var(--primary-color)");
        return data;
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || "Failed to unpin product";
        Alert(msg, "error", "var(--secondary-color)");
        throw err;
      }
    },

    async updateShopLocation(latitude: number, longitude: number) {
      try {
        const { data } = await axios.patch(
          `${API_BASE_URL}/api/shops/location`,
          { latitude, longitude },
          { headers: getHeaders() },
        );
        Alert("Shop location updated!", "success", "var(--primary-color)");
        // Refresh vendor data to get the updated location
        await this.fetchVendor();
        return data;
      } catch (err: any) {
        Alert(`Location update failed: ${err?.response?.data?.error || err?.message}`, "error", "var(--secondary-color)");
        throw err;
      }
    },

    async removeShopLocation() {
      try {
        const { data } = await axios.delete(`${API_BASE_URL}/api/shops/location`, { headers: getHeaders() });
        Alert("Shop location removed.", "success", "var(--primary-color)");
        await this.fetchVendor();
        return data;
      } catch (err: any) {
        Alert(`Failed to remove location: ${err?.response?.data?.error || err?.message}`, "error", "var(--secondary-color)");
        throw err;
      }
    },
  },
});
