import { defineStore } from "pinia";
import axios from "axios";
import type { Product } from "../types/product";
import type { FeatureSeller } from "../types/seller";
import { getAuthHeaders } from "../types/shared";
import { Toast } from "../components/composable/Toast.js";
import { refreshCartPricing } from "../utils/cartSync.js";
import { calculateFinalPrice } from "../utils/priceCalculator";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

let scrollHandler: (() => void) | null = null;

const isAllValue = (v: unknown) => !v || String(v).trim().toLowerCase() === "all";

const normalizeQueryValue = (v: unknown) =>
  String(v ?? "")
    .replaceAll("&amp;", "&")
    .trim();

const buildFeaturedSubscribedUrl = (
  baseUrl: string,
  municipality: unknown,
  category: unknown,
) => {
  const params = new URLSearchParams();

  const m = normalizeQueryValue(municipality);
  if (m && !isAllValue(m)) params.append("municipalities", m);

  const c = normalizeQueryValue(category);
  if (c && !isAllValue(c)) params.append("categories", c);

  const qs = params.toString();
  return qs
    ? `${baseUrl}/products/featured-subscribed?${qs}`
    : `${baseUrl}/products/featured-subscribed`;
};

const filterInStockOptions = (items: Product[]) => {
  for (const item of items) {
    if (Array.isArray((item as any)?.option)) {
      (item as any).option = (item as any).option.filter((opt: any) => (opt?.stock ?? 0) > 0);
    }
  }
  return items;
};

export const useProductsStore = defineStore("products", {
  state: () => ({
    featuredProducts: [] as Product[],
    productById: {} as Product,
    products: [] as Product[],
    searchResultProducts: [] as Product[],
    relatedProducts: [] as Product[],
    featuredSeller: [] as FeatureSeller[],
    category: [] as string[],
    productId: "" as string | null,
    trendingProducts: [] as any[],
    suggestions: [] as any[],
    query: "" as string,
    error: null as string | null,

    selectedCategory: "all" as string,
    seletedMunicipality: "all" as string,

    skip: 0,
    limit: 15,
    hasMore: true,
    isLoading: false,
    isFetched: false,
    vendorIsFetched: false,

    homeScrollPosition: 0,
    isRestoringScroll: false,
  }),

  getters: {
    combinedProducts(state): Product[] {
      return [...state.featuredProducts, ...state.products];
    },
    totalProductsCount(state): number {
      return state.featuredProducts.length + state.products.length;
    },
  },

  actions: {
    _headers() {
      return getAuthHeaders();
    },

    async _loadFeaturedSubscribed(fallback?: Product[]) {
      try {
        const url = buildFeaturedSubscribedUrl(
          API_BASE_URL,
          this.seletedMunicipality,
          this.selectedCategory,
        );
        const res = await axios.get(url);
        this.featuredProducts = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        this.featuredProducts = fallback ? fallback.slice(0, 8) : [];
      }
    },

    _resetPaging() {
      this.products = [];
      this.featuredProducts = [];
      this.skip = 0;
      this.hasMore = true;
      this.isFetched = false;
    },

    async fetchSearchProducts(query: string, reset: boolean): Promise<void> {
      if (this.isLoading || !this.hasMore) return;

      if (reset) {
        this.searchResultProducts = [];
        this.skip = 0;
        this.hasMore = true;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_BASE_URL}/products/search`, {
          params: { limit: this.limit, skip: this.skip, q: query },
        });

        let fetched: Product[] = Array.isArray(response.data) ? response.data : [];
        fetched = filterInStockOptions(fetched);

        if (fetched.length < this.limit) this.hasMore = false;
        this.searchResultProducts.push(...fetched);
        this.skip += this.limit;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch products.";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchProducts(refresh = false): Promise<void> {
      if (this.isLoading || !this.hasMore) return;
      if (!refresh && this.isFetched && this.skip === 0) return;

      if (refresh) this._resetPaging();

      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_BASE_URL}/products`, {
          params: { limit: this.limit, skip: this.skip },
        });

        let fetched: Product[] = Array.isArray(response.data) ? response.data : [];
        fetched = filterInStockOptions(fetched);

        if (this.skip === 0) {
          await this._loadFeaturedSubscribed(fetched);
        }

        if (fetched.length < this.limit) this.hasMore = false;

        this.products.push(...fetched);
        this.skip += this.limit;
        this.isFetched = true;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch products.";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchFeaturedVendor(): Promise<void> {
      if (this.vendorIsFetched) return;

      try {
        const response = await axios.get(`${API_BASE_URL}/vendor/featured-subscribed`);
        const data = Array.isArray(response.data) ? response.data : [];
        this.featuredSeller = [];
        this.featuredSeller.push(...data);
        this.vendorIsFetched = true;
      } catch (error) {}
    },

    async fetchProductsByCategory(category: string, filter: string, reset = false): Promise<void> {
      if (this.isLoading || !this.hasMore) return;

      if (reset) {
        this._resetPaging();
        this.selectedCategory = category || "all";
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_BASE_URL}/products/category`, {
          params: { limit: this.limit, skip: this.skip, category: this.selectedCategory },
        });

        let fetched: Product[] = Array.isArray(response.data) ? response.data : [];
        fetched = filterInStockOptions(fetched);
        fetched = this.applyClientFilter(fetched, filter);

        if (this.skip === 0) await this._loadFeaturedSubscribed(fetched);

        if (fetched.length < this.limit) this.hasMore = false;

        this.products.push(...fetched);
        this.skip += this.limit;
        this.isFetched = true;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch products by category.";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchProductsByMunicipality(municipality: string, reset = false): Promise<void> {
      if (this.isLoading || !this.hasMore) return;

      if (reset) {
        this._resetPaging();
        this.seletedMunicipality = municipality || "all";
      }

      this.isLoading = true;
      this.error = null;

      try {
        const params: any = { limit: this.limit, skip: this.skip };

        if (!isAllValue(this.selectedCategory)) {
          params.category = this.selectedCategory;
        }

        const response = await axios.get(`${API_BASE_URL}/products/municipality/${municipality}`, {
          params,
        });

        let fetched: Product[] = Array.isArray(response.data) ? response.data : [];
        fetched = filterInStockOptions(fetched);
        fetched = this.applyClientFilter(fetched, "");

        if (this.skip === 0) await this._loadFeaturedSubscribed(fetched);

        if (fetched.length < this.limit) this.hasMore = false;

        this.products.push(...fetched);
        this.skip += this.limit;
        this.isFetched = true;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch products by municipality.";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchProductsById(productId: string): Promise<void> {
      if (this.isLoading) return;

      this.isLoading = true;
      this.error = null;
      this.productById = {} as Product;

      try {
        const response = await axios.get(`${API_BASE_URL}/products/${productId}`, {
          headers: this._headers(),
        });

        const fetched: Product = response.data;
        this.productById = fetched;
        this.productId = (fetched as any)?._id;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch product.";
      } finally {
        this.isLoading = false;
      }
    },

    async fetchRelatedProducts(productId: string): Promise<void> {
      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_BASE_URL}/products/${productId}/related`, {
          headers: this._headers(),
        });

        const fetched: Product[] = Array.isArray(response.data) ? response.data : [];
        this.relatedProducts = fetched;
      } catch (err: any) {
        this.error = err?.response?.data?.message || "Failed to fetch related products.";
      } finally {
        this.isLoading = false;
      }
    },

    async addToCart(optionId: string, productId: string, quantity = 1): Promise<void> {
      try {
        await axios.post(
          `${API_BASE_URL}/cart/add`,
          { item: { productId, optionId, quantity } },
          { headers: this._headers() },
        );

        await refreshCartPricing();
        Toast("Product added to cart!", "success", 2000);
      } catch (err: any) {
        let errorMessage = "Failed to add product to cart";

        if (err?.response?.data?.error?.message) errorMessage = err.response.data.error.message;
        else if (err?.response?.data?.message) errorMessage = err.response.data.message;
        else if (typeof err?.response?.data?.error === "string") errorMessage = err.response.data.error;
        else if (err?.message) errorMessage = err.message;

        if (
          typeof errorMessage === "string" &&
          (errorMessage.toLowerCase().includes("out of stock") ||
            errorMessage.toLowerCase().includes("0 items available"))
        ) {
          errorMessage = "Sorry, this item is out of stock";
        }

        Toast(errorMessage, "error", 3000);
      }
    },

    filterProducts(filter: string): void {
      const filteredFeatured = this.applyClientFilter(this.featuredProducts, filter);
      const filteredProducts = this.applyClientFilter(this.products, filter);
      this.featuredProducts = [...filteredFeatured.slice(0, 8)];
      this.products = [...filteredProducts];
    },

    filterByMunicilipality(municipality: string): void {
      this.hasMore = true;

      if (isAllValue(municipality)) {
        this.seletedMunicipality = "all";
        this._resetPaging();
        this.fetchProducts(true);
        return;
      }

      this.seletedMunicipality = municipality;
      this.fetchProductsByMunicipality(municipality, true);
    },

    categoriesInProducts() {
      const categorySet = new Set<string>();
      categorySet.add("all");

      for (const product of this.products) {
        for (const cat of (product as any)?.categories || []) {
          categorySet.add(cat);
        }
      }

      this.category = Array.from(categorySet).sort();
    },

    filterByCategory(category: string): void {
      this.hasMore = true;

      if (isAllValue(category)) {
        this.selectedCategory = "all";

        if (isAllValue(this.seletedMunicipality)) {
          this._resetPaging();
          this.fetchProducts(true);
          return;
        }

        this.fetchProductsByMunicipality(this.seletedMunicipality, true);
        return;
      }

      this.selectedCategory = category;

      if (isAllValue(this.seletedMunicipality)) {
        this.fetchProductsByCategory(this.selectedCategory, "", true);
        return;
      }

      this.fetchProductsByMunicipality(this.seletedMunicipality, true);
    },

    applyClientFilter(products: Product[], filter: string = ""): Product[] {
      switch (filter) {
        case "Price: Low to High":
          return products
            .slice()
            .sort(
              (a: any, b: any) =>
                calculateFinalPrice(a.price ?? 0, a.promotion) -
                calculateFinalPrice(b.price ?? 0, b.promotion)
            );
        case "Price: High to Low":
          return products
            .slice()
            .sort(
              (a: any, b: any) =>
                calculateFinalPrice(b.price ?? 0, b.promotion) -
                calculateFinalPrice(a.price ?? 0, a.promotion)
            );
        case "Most Sold":
          return products.slice().sort((a: any, b: any) => (b.sold ?? 0) - (a.sold ?? 0));
        case "Best Rating":
          return products
            .slice()
            .sort((a: any, b: any) => (b.averageRating || 0) - (a.averageRating || 0));
        default:
          return products;
      }
    },

    initializeInfiniteScroll(container: HTMLElement): void {
      const throttle = (fn: () => void, delay: number) => {
        let lastCall = 0;
        return () => {
          const now = Date.now();
          if (now - lastCall >= delay) {
            lastCall = now;
            fn();
          }
        };
      };

      scrollHandler = throttle(() => {
        const scrollPosition = container.scrollTop + container.clientHeight;
        const threshold = container.scrollHeight - 300;

        if (scrollPosition < threshold) return;

        const muniAll = isAllValue(this.seletedMunicipality);
        const catAll = isAllValue(this.selectedCategory);

        if (muniAll && !catAll) {
          this.fetchProductsByCategory(this.selectedCategory, "", false);
          return;
        }

        if (!muniAll) {
          this.fetchProductsByMunicipality(this.seletedMunicipality, false);
          return;
        }

        this.fetchProducts(false);
      }, 80);

      container.addEventListener("scroll", scrollHandler);
    },

    cleanupInfiniteScroll(container: HTMLElement): void {
      if (scrollHandler) {
        container.removeEventListener("scroll", scrollHandler);
        scrollHandler = null;
      }
    },

    async searchProducts(query: string) {
      if (!query?.trim()) {
        this.suggestions = [];
        return;
      }

      this.isLoading = true;

      try {
        const response = await axios.get(`${API_BASE_URL}/products/search`, {
          params: { q: query, limit: 15 },
        });

        const data = Array.isArray(response.data) ? response.data : [];

        this.suggestions = data.map((product: any) => ({
          id: product.id || product._id,
          name: product.name || product.title,
          price: product.price,
          imageUrl:
            product.imageUrls?.[0] ||
            product.imageUrl ||
            "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400",
          category: product.categories?.[0] || product.category,
          rating: product.averageRating || product.rating,
        }));
      } catch (error) {
        this.suggestions = [];
      } finally {
        this.isLoading = false;
      }
    },

    async fetchTrendingProducts(limit: number = 10) {
      try {
        const response = await axios.get(`${API_BASE_URL}/products`, {
          params: { limit, skip: 0 },
        });

        const data = Array.isArray(response.data) ? response.data : [];

        this.trendingProducts = data.map((product: any) => ({
          id: product.id || product._id,
          name: product.name || product.title,
          price: product.price,
          imageUrl:
            product.imageUrls?.[0] ||
            product.imageUrl ||
            "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400",
          category: product.categories?.[0] || product.category,
          rating: product.averageRating || product.rating,
        }));

        return this.trendingProducts;
      } catch (error) {
        this.trendingProducts = [];
        return [];
      }
    },
  },
});
