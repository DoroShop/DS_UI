import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { setActivePinia, createPinia } from 'pinia';
import { useCartStore } from '../cartStores';

vi.mock('axios');
const mockedAxios = axios as unknown as any;
mockedAxios.get = mockedAxios.get || vi.fn();
mockedAxios.put = mockedAxios.put || vi.fn();

beforeEach(() => {
  setActivePinia(createPinia());
  mockedAxios.get.mockReset();
  mockedAxios.put.mockReset();
});

afterEach(() => {
  try { vi.useRealTimers(); } catch (e) {}
});

describe('cartStore fetchCart', () => {
  it('handles direct cart payload shape', async () => {
    // /cart returns cart object directly
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.endsWith('/cart')) {
        return Promise.resolve({ data: { items: [{ productId: 'p1', optionId: null, quantity: 2 }] } });
      }
      if (url.includes('/products/')) {
        return Promise.resolve({ data: { _id: 'p1', name: 'Product 1', vendorId: 'v1', price: 100, option: [], imageUrls: ['img1'] } });
      }
      if (url.includes('/vendor/')) {
        return Promise.resolve({ data: { data: { storeName: 'Vendor 1' } } });
      }
      return Promise.resolve({ data: {} });
    });

    const store = useCartStore();
    await store.fetchCart();

    expect(store.cartData.shops.length).toBeGreaterThan(0);
    expect(store.cartData.shops[0].items.length).toBe(1);
    expect(store.cartData.shops[0].items[0].productId).toBe('p1');
  });

  it('handles wrapped cart payload shape', async () => {
    // /cart returns { data: { items: [...] } }
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.endsWith('/cart')) {
        return Promise.resolve({ data: { data: { items: [{ productId: 'p2', optionId: null, quantity: 1 }] } } });
      }
      if (url.includes('/products/')) {
        return Promise.resolve({ data: { _id: 'p2', name: 'Product 2', vendorId: 'v2', price: 50, option: [], imageUrls: ['img2'] } });
      }
      if (url.includes('/vendor/')) {
        return Promise.resolve({ data: { data: { storeName: 'Vendor 2' } } });
      }
      return Promise.resolve({ data: {} });
    });

    const store = useCartStore();
    await store.fetchCart();

    expect(store.cartData.shops.length).toBeGreaterThan(0);
    expect(store.cartData.shops[0].items.length).toBe(1);
    expect(store.cartData.shops[0].items[0].productId).toBe('p2');
  });

  it('reverts to server max when update is rejected due to validation', async () => {
    const store = useCartStore();
    // seed a cart item
    store.cartData.shops = [{ shopId: 's1', items: [{ productId: 'p3', optionId: 'opt3', quantity: 25, stock: 100 }] }];

    mockedAxios.put.mockRejectedValue({
      response: {
        data: {
          error: 'Cart validation failed: items.0.quantity: Path `quantity` (75) is more than maximum allowed value (50).'
        },
        status: 500
      }
    });

    // send delta of +50 which would result in attempted 75
    await store.updateCartItemQuantity('p3', 'opt3', 50);

    const item = store.cartData.shops[0].items[0];
    expect(item.quantity).toBe(50);
  });

  it('aggregates deltas and sends a single delta after debounce', async () => {
    const store = useCartStore();
    store.cartData.shops = [{ shopId: 's1', items: [{ productId: 'p4', optionId: 'opt4', quantity: 1, stock: 100 }] }];

    mockedAxios.put.mockResolvedValue({ data: {} });

    vi.useFakeTimers();

    // simulate two quick increments
    store.handleIncrement('p4', 'opt4', 's1');
    store.handleIncrement('p4', 'opt4', 's1');

    // advance timers to trigger debounce
    vi.advanceTimersByTime(350);

    // wait a tick
    await Promise.resolve();

    expect(mockedAxios.put).toHaveBeenCalledTimes(1);
    const payload = mockedAxios.put.mock.calls[0][1];
    expect(payload.item.quantity).toBe(2);

    vi.useRealTimers();
  });

  it('updateCartItemQuantity sends sanitized payload', async () => {
    const store = useCartStore();
    store.cartData = { shops: [{ shopId: 's1', items: [{ productId: 'p5', optionId: 'o5', quantity: 1, stock: 100, itemId: 'p5-o5' }] }] };
    mockedAxios.put.mockResolvedValue({ data: {} });

    await store.updateCartItemQuantity('p5', 'o5', 3);

    expect(mockedAxios.put).toHaveBeenCalled();
    const payload = mockedAxios.put.mock.calls[0][1];
    expect(payload).toEqual({ item: { productId: 'p5', optionId: 'o5', quantity: 3 } });
  });

  it('deleteItem sends sanitized data in delete request', async () => {
    const store = useCartStore();
    mockedAxios.delete = vi.fn().mockResolvedValue({ status: 200 });

    const result = await store.deleteItem('s1', 'p5-o5', 'p5', 'o5');

    expect(mockedAxios.delete).toHaveBeenCalled();
    const callOpts = mockedAxios.delete.mock.calls[0][1];
    expect(callOpts).toHaveProperty('data');
    expect(callOpts.data).toEqual({ productId: 'p5', optionId: 'o5' });
    expect(result.success).toBe(true);
  });

});
