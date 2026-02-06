import { ref } from "vue";
import type { Address } from "../types/order";

// Extended shipping info for personalized checkout
interface PersonalizedShippingInfo {
  name?: string;
  phone?: string;
  address: Address;
}

const KEY = "checkoutAddressOverride";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for better UX

type Stored = {
  shippingInfo: PersonalizedShippingInfo;
  ts: number;
  ttl?: number;
};

export function useCheckoutAddressOverride() {
  const last = ref<Stored | null>(null);

  function _readRaw(): Stored | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Stored;
      if (!parsed || typeof parsed.ts !== "number") return null;
      return parsed;
    } catch (e) {
      console.warn("Failed to parse checkout override from localStorage", e);
      return null;
    }
  }

  function get(): PersonalizedShippingInfo | null {
    const s = _readRaw();
    if (!s) return null;
    const ttl = typeof s.ttl === "number" ? s.ttl : DEFAULT_TTL_MS;
    if (Date.now() - s.ts > ttl) {
      clear();
      return null;
    }
    last.value = s;
    return s.shippingInfo;
  }

  function set(shippingInfo: PersonalizedShippingInfo, ttl?: number) {
    const s: Stored = { shippingInfo, ts: Date.now(), ttl };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      last.value = s;
    } catch (e) {
      console.error("Failed to write shipping info to localStorage", e);
    }
  }

  // Legacy method for backward compatibility - returns just the address
  function getAddress(): Address | null {
    const info = get();
    return info?.address || null;
  }

  // Legacy method for backward compatibility - sets just the address
  function setAddress(address: Address, ttl?: number) {
    const existing = get();
    const shippingInfo: PersonalizedShippingInfo = {
      name: existing?.name,
      phone: existing?.phone,
      address
    };
    set(shippingInfo, ttl);
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      last.value = null;
    } catch (e) {
      console.error("Failed to clear checkout override from localStorage", e);
    }
  }

  return { get, set, getAddress, setAddress, clear } as const;
}
