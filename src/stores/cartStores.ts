import { defineStore } from "pinia";
import pLimit from 'p-limit';
const limit = pLimit(10);
import axios from "axios";
import { CartState } from "../types/cart";
import { getAuthHeaders } from "../types/shared";
import { isPromotionValid, calculateFinalPrice, hasActualDiscount } from "../utils/priceCalculator";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const MAX_CART_QUANTITY = 50; // Keep in sync with backend max quantity validation

export const useCartStore = defineStore("cart", {
  state: (): CartState => ({
    cartData: {
      shops: [],
    },
    Count: 0,
    selectedItems: [],
    pendingUpdates: {},
    debounceTimers: {},
    isFetched: false,
    selectedItemData: []
  }),


  getters: {
    isAllSelected(state) {
      const allItemIds = state.cartData.shops.flatMap(
        (shop) => shop.items?.map((item) => item.itemId) || []
      );
      return (
        allItemIds.length > 0 &&
        allItemIds.every((id) => state.selectedItems.includes(id))
      );
    },

    selectedItemsCount: (state) => state.selectedItems.length,

    itemsSubtotal(state) {
      let total = 0;
      state.cartData.shops.forEach((shop) => {
        shop.items?.forEach((item) => {
          if (state.selectedItems.includes(item.itemId)) {
            total += (item.price || 0) * (item.quantity || 0);
          }
        });
      });
      return total;
    },

    selectedShippingTotal(state) {
      // Calculate shipping for selected items only
      // For now, return 0 as shipping is calculated at checkout
      return 0;
    },

    total() {
      return this.itemsSubtotal + this.selectedShippingTotal;
    },

    countItem(state) {
      return state.cartData.shops.reduce((count, shop) => {
        return count + (shop.items?.length || 0);
      }, 0);
    }

  },
  actions: {
    itemCount() {
      const count = this.cartData.shops.reduce((count, shop) => {
        return count + (shop.items?.length || 0);
      }, 0);

      this.Count = count;
      console.log(this.Count)
    },
    parseItemId(itemId) {
      const [productId, optionId] = itemId.split("-");
      return { productId, optionId };
    },

    // Client-side sanitizers to avoid sending unexpected payloads (instance methods)
    sanitizeId(val: any) {
      if (val === undefined || val === null) return undefined;
      return String(val);
    },

    sanitizeItemForServer(item: any) {
      return {
        productId: String(item.productId),
        optionId: item.optionId ? String(item.optionId) : undefined,
        quantity: Math.max(1, Math.min(MAX_CART_QUANTITY, Number(item.quantity) || 1)),
      };
    },

    sanitizeDeltaForServer(productId: any, optionId: any, delta: number) {
      return {
        productId: String(productId),
        optionId: optionId ? String(optionId) : undefined,
        quantity: Number(delta),
      };
    },

    // Fetch cart - always refresh to get current promotion status
    async fetchCart() {
      // Always fetch fresh data to ensure promotion prices are current
      try {
        const cartRes = await axios.get(`${API_BASE_URL}/cart`, {
          headers: getAuthHeaders()
        });

        const response = cartRes.data;
        // Support both response shapes:
        // - Server returns the cart object directly: { items: [...] }
        // - Server wraps cart in `data`: { data: { items: [...] } }
        const cart = response && (Array.isArray(response.items) ? response : (response.data && Array.isArray(response.data.items) ? response.data : null));

        if (!cart || !Array.isArray(cart.items)) {
          console.warn("Unexpected cart payload shape:", response);
          // Ensure UI shows an empty cart but avoid further failures
          this.cartData.shops = [];
          this.isFetched = true;
          return;
        }

        const shopsMap = new Map();

        const vendorFetchMap = new Map<string, Promise<any>>();
        const fetchPromises = cart.items.map(cartItem => limit(async () => {
          try {
            // Add cache-busting parameter to ensure fresh data
            const cacheBuster = new Date().getTime();
            const productRes = await axios.get(`${API_BASE_URL}/products/${cartItem.productId}?_cb=${cacheBuster}`, { headers: getAuthHeaders()});
            const product = productRes.data;

            const vendorId = typeof product.vendorId === "object"
              ? product.vendorId._id
              : product.vendorId;

      
            let vendorPromise = vendorFetchMap.get(vendorId);
            if (!vendorPromise) {
              vendorPromise = axios
                .get(`${API_BASE_URL}/vendor/${vendorId}/details`, { headers: getAuthHeaders() })
                .then(res => res.data.data);
              vendorFetchMap.set(vendorId, vendorPromise);
              console.log("Fetching vendor:", vendorId);
            } else {
              console.log("Skipping duplicate fetch for vendor:", vendorId);
            }

            const vendor = await vendorPromise;

            const selectedOption = product.option?.find(
              (opt) => opt._id === cartItem.optionId
            );

            const shopId = vendorId;


            if (!shopsMap.has(shopId)) {
              shopsMap.set(shopId, {
                shopId,
                shopName: vendor?.storeName || "Shop",
                items: [],
                date: new Date()
              });
            }

            const originalPrice = selectedOption?.price || product.price;
            const promotion = selectedOption?.promotion || product?.promotion;
            const stock = selectedOption?.stock ?? product.stock ?? 0;
            
            // Debug: Check if we're getting stale promotion data
            if (promotion?.freeShipping && !promotion?.isActive) {
              console.warn(`⚠️  Product ${product.name} has freeShipping=true but isActive=false - this should be fixed in backend`);
            }
            
            // Double-check promotion validity with real-time validation
            // This ensures that recently ended promotions don't still show as active
            const validPromotion = isPromotionValid(promotion) ? promotion : null;
            
            // Always calculate current price based on real-time promotion status
            const currentPrice = calculateFinalPrice(originalPrice, validPromotion);
            const isCurrentlyDiscounted = hasActualDiscount(validPromotion);

            const item = {
              itemId: `${product._id}-${selectedOption?._id || 'default'}`,
              vendorId: product.vendorId,
              productId: product?._id,
              optionId: selectedOption?._id || product?._id,
              name: product?.name,
              price: currentPrice,
              originalPrice: originalPrice,
              quantity: cartItem.quantity,
              stock: stock, // Add stock for UI validation
              imgUrl: selectedOption?.imageUrl || product?.imageUrls[0],
              label: selectedOption?.label || "",
              promotion: validPromotion, // Use validated promotion
              hasDiscount: isCurrentlyDiscounted,
              // Add promotion status for debugging
              promotionStatus: {
                isValid: isPromotionValid(validPromotion),
                isActive: validPromotion?.isActive || false,
                hasExpired: validPromotion?.endDate ? new Date(validPromotion.endDate) < new Date() : false,
                hasStarted: validPromotion?.startDate ? new Date(validPromotion.startDate) <= new Date() : true
              }
            };

            console.log(product.name)

            shopsMap.get(shopId).items.unshift(item);

          } catch (err) {
            console.error(`Failed to process cart item ${cartItem.productId}:`, err);
          }
        }));

        await Promise.all(fetchPromises);

        this.cartData.shops = Array.from(shopsMap.values());
        this.isFetched = true
      } catch (error) {
        console.error("Failed to fetch cart:", error);
        // Ensure we mark fetch as completed to avoid leaving UI in loading state
        this.cartData.shops = [];
        this.isFetched = true;
      }
    },

    toggleSelectAll() {
      if (this.isAllSelected) {
        this.selectedItems = [];
      } else {
        const allItemIds = this.cartData.shops.flatMap(
          (shop) => shop.items?.map((item) => item.itemId) || []
        );
        this.selectedItems = [...allItemIds];

      }
    },

    isShopSelected(shopId) {
      const shop = this.cartData.shops.find((s) => s.shopId === shopId);
      if (!shop?.items?.length) return false;
      return shop.items.every((item) =>
        this.selectedItems.includes(item.itemId)
      );
    },

    toggleShopSelection(shopId) {
      const shop = this.cartData.shops.find((s) => s.shopId === shopId);
      if (!shop?.items?.length) return;

      const shopItemIds = shop.items.map((item) => item.itemId);
      const allSelected = shopItemIds.every((id) =>
        this.selectedItems.includes(id)
      );

      if (allSelected) {
        this.selectedItems = this.selectedItems.filter(
          (id) => !shopItemIds.includes(id)
        );
      } else {
        const newSelections = shopItemIds.filter(
          (id) => !this.selectedItems.includes(id)
        );
        this.selectedItems = [...this.selectedItems, ...newSelections];
      }
    },

    toggleItemSelection(itemId) {
      const index = this.selectedItems.indexOf(itemId);
      if (index > -1) {
        this.selectedItems.splice(index, 1);
      } else {
        this.selectedItems.push(itemId);
      }
    },

    isItemSelected(itemId) {
      return this.selectedItems.includes(itemId);
    },

    async deleteItem(shopId: string, itemId: string, productId: string, optionId: string) {
      try {
        const payload = { productId: this.sanitizeId(productId), optionId: this.sanitizeId(optionId) };
        const deleteItem = await axios.delete(`${API_BASE_URL}/cart/remove`, {
          data: payload,
          headers: getAuthHeaders(true)
        });

        if (deleteItem.status !== 200) {
          return { success: false, message: "Failed to delete item!" };
        }

        const shop = this.cartData.shops.find((s) => s.shopId === shopId);

        if (shop) {
          shop.items = shop.items?.filter((item) => item.itemId !== itemId) || [];
          this.selectedItems = this.selectedItems.filter((id) => id !== itemId);

          if (shop.items.length === 0) {
            this.cartData.shops = this.cartData.shops.filter(
              (s) => s.shopId !== shopId
            );
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Error deleting item:", error);
        return { success: false, message: "Error occurred while deleting item." };
      }
    },

    deleteSelected() {
      if (this.selectedItems.length === 0) return;

      this.cartData.shops.forEach((shop) => {
        shop.items =
          shop.items?.filter(
            (item) => !this.selectedItems.includes(item.itemId)
          ) || [];
      });
      this.cartData.shops = this.cartData.shops.filter(
        (shop) => shop.items?.length > 0
      );
      this.selectedItems = [];
    },

    updateLocalItem(shopId, itemId, quantity) {
      const shop = this.cartData.shops.find((s) => s.shopId === shopId);
      if (shop) {
        const item = shop.items?.find((i) => i.optionId === itemId);

        if (item) {
          const newQuantity = (item.quantity || 0) + quantity;
          const allowedMax = Math.min(item.stock ?? Infinity, MAX_CART_QUANTITY); // enforce server max and stock
          
          if (newQuantity > allowedMax) {
            return { success: false, message: `Only ${allowedMax} items available in stock` };
          }
          if (newQuantity < 1) {
            return { success: false, message: "Minimum quantity is 1" };
          }
          item.quantity = newQuantity;
          return { success: true };
        }
      }
      return { success: false, message: "Item not found" };
    },

    handleIncrement(productId, optionId, shopId) {
      this.handleQuantityChange(productId, optionId, shopId, +1);
    },

    handleDecrement(productId, optionId, shopId) {
      this.handleQuantityChange(productId, optionId, shopId, -1);
    },

    handleQuantityChange(productId, optionId, shopId, quantityChange) {
      const itemKey = `${shopId}-${optionId}`;

      // Update local quantity immediately
      const result = this.updateLocalItem(shopId, optionId, quantityChange);
      if (!result.success) {
        console.warn(result.message);
        // Optionally show user-friendly error message
        return;
      }

      // Get the new quantity after update
      const shop = this.cartData.shops.find((s) => s.shopId === shopId);
      const item = shop?.items?.find((i) => i.optionId === optionId);
      const newQuantity = item?.quantity || 0;

      // Clear existing timer
      if (this.debounceTimers[itemKey]) {
        clearTimeout(this.debounceTimers[itemKey]);
      }

      // Aggregate pending delta for this item and debounce the server update
      this.pendingUpdates[itemKey] = (this.pendingUpdates[itemKey] || 0) + quantityChange;

      // Set new debounce timer
      if (this.debounceTimers[itemKey]) {
        clearTimeout(this.debounceTimers[itemKey]);
      }
      this.debounceTimers[itemKey] = setTimeout(async () => {
        const delta = this.pendingUpdates[itemKey] || 0;
        delete this.pendingUpdates[itemKey];
        if (delta === 0) return;
        await this.updateCartItemQuantity(productId, optionId, delta, shopId);
      }, 300);
    },

    async updateCartItemQuantity(productId, optionId, delta) {
      // Treat `delta` as change (can be positive or negative)
      if (!delta || delta === 0) return;

      let itemRef = null;
      for (const shop of this.cartData.shops) {
        itemRef = shop.items?.find((i) => i.productId === productId && i.optionId === optionId) || itemRef;
        if (itemRef) break;
      }

      const previousQuantity = itemRef?.quantity ?? null;
      const newQuantity = (itemRef?.quantity || 0) + delta;
      const allowedMax = Math.min(itemRef?.stock ?? Infinity, MAX_CART_QUANTITY);

      // If newQuantity would be less than 1, revert and skip server call
      if (newQuantity < 1) {
        if (itemRef && previousQuantity !== null) {
          itemRef.quantity = previousQuantity;
        }
        console.warn('Attempted to set quantity below 1; action ignored');
        return;
      }

      // Compute the actual delta we'll send after clamping to allowed max
      let sendDelta = delta;
      if (newQuantity > allowedMax) {
        sendDelta = allowedMax - (previousQuantity ?? 0);
        if (itemRef) itemRef.quantity = allowedMax;
        console.warn(`Requested delta ${delta} exceeds allowed max; clamped to delta ${sendDelta}`);
      }

      if (sendDelta === 0) return; // Nothing to send after clamping

      try {
        const payload = { item: this.sanitizeDeltaForServer(productId, optionId, sendDelta) };
        await axios.put(
          `${API_BASE_URL}/cart/update`,
          payload,
          {
            headers: getAuthHeaders(true),
          }
        );
        console.log(`Cart updated on server: item ${optionId} delta ${sendDelta}`);
      } catch (error) {
        console.error("Failed to update cart item quantity:", error);
        // If server indicates a max allowed value, parse and apply it; otherwise revert to previous
        const serverMessage = error?.response?.data?.error || error?.message || '';
        const match = serverMessage.match(/maximum allowed value\s*\((\d+)\)/i);
        if (match) {
          const serverMax = parseInt(match[1], 10);
          if (itemRef) {
            itemRef.quantity = Math.min(previousQuantity + delta, serverMax);
            console.warn(`Adjusted item quantity to server max ${serverMax}`);
          }
        } else if (itemRef && previousQuantity !== null) {
          itemRef.quantity = previousQuantity;
        }
      }
    },

    getSelectedItem() {
      this.selectedItemData = []
      this.selectedItems.forEach((selectedItem) => {
        const item = this.cartData.shops.flatMap(
          (shop) => shop.items?.find((item) => item.itemId === selectedItem) || []
        );

        this.selectedItemData.push(...item)
     
      });
    },

    // Remove item from cart via API
    async clearCart() {
      if (this.isAllSelected) {
        this.deleteSelected();
        try {
          await axios.delete(`${API_BASE_URL}/cart/clear`, {
            headers: getAuthHeaders(true)
          });
        } catch (error) {
          console.error("Failed to remove cart item:", error);
        }
      }
    },

    // Force refresh cart to get updated promotion prices
    async refreshCartPricing() {
      console.log('🔄 Force refreshing cart pricing...');
      
      // Fetch fresh data without clearing existing data (prevents glitch)
      // Keep old data visible while fetching to avoid count flickering to 0
      try {
        await this.fetchCart();
        // Only reset selections after successful fetch to avoid UI glitches
        this.selectedItems = [];
        this.selectedItemData = [];
      } catch (error) {
        console.error('❌ Error refreshing cart pricing:', error);
      }
      
      console.log('✅ Cart pricing refreshed with current promotion status');
    },
  },
});
