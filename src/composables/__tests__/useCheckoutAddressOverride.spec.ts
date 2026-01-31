import { describe, it, expect, beforeEach } from 'vitest';
import { useCheckoutAddressOverride } from '../useCheckoutAddressOverride';
import type { Address } from '../../types/order';

beforeEach(() => {
  localStorage.clear();
});

describe('useCheckoutAddressOverride', () => {
  it('returns null when no override exists', () => {
    const { get } = useCheckoutAddressOverride();
    expect(get()).toBeNull();
  });

  it('persists and reads an address', () => {
    const { set, get } = useCheckoutAddressOverride();
    const a: Address = { street: '123 Main', barangay: 'Central', city: 'Metro', province: 'Province', zipCode: '1000' };
    set(a);
    const out = get();
    expect(out).toEqual(a);
  });

  it('honors ttl and expires', async () => {
    const { set, get } = useCheckoutAddressOverride();
    const a: Address = { street: 'ttl', barangay: 'b', city: 'c', province: 'p', zipCode: 'z' };
    set(a, 10); // 10ms
    expect(get()).toEqual(a);
    await new Promise((r) => setTimeout(r, 20));
    expect(get()).toBeNull();
  });
});
