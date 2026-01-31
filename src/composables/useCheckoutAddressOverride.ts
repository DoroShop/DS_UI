import { ref } from "vue";
import type { Address } from "../types/order";

const KEY = "checkoutAddressOverride";
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

type Stored = {
  address: Address;
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

  function get(): Address | null {
    const s = _readRaw();
    if (!s) return null;
    const ttl = typeof s.ttl === "number" ? s.ttl : DEFAULT_TTL_MS;
    if (Date.now() - s.ts > ttl) {
      clear();
      return null;
    }
    last.value = s;
    return s.address;
  }

  function set(address: Address, ttl?: number) {
    const s: Stored = { address, ts: Date.now(), ttl };
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      last.value = s;
    } catch (e) {
      console.error("Failed to write checkout override to localStorage", e);
    }
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      last.value = null;
    } catch (e) {
      console.error("Failed to clear checkout override from localStorage", e);
    }
  }

  return { get, set, clear } as const;
}
