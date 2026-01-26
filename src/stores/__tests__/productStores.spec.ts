import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { setActivePinia, createPinia } from 'pinia'
import { useProductsStore } from '../productStores'

vi.mock('axios')

describe('productStores - fetch edge cases', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
  })

  it('fetchProducts handles null response gracefully', async () => {
    ;(axios.get as any).mockResolvedValue({ data: null })

    const store = useProductsStore()

    await store.fetchProducts()

    expect(store.products).toHaveLength(0)
    expect(store.isFetched).toBe(true)
    expect(store.hasMore).toBe(false)
    expect(store.skip).toBe(store.limit) // skip incremented by limit
  })

  it('fetchProducts handles items with null option without throwing', async () => {
    const payload = [
      { _id: '1', name: 'Item 1', option: null, price: 10 }
    ]
    ;(axios.get as any).mockResolvedValue({ data: payload })

    const store = useProductsStore()

    await store.fetchProducts()

    expect(store.products).toHaveLength(1)
    expect(Array.isArray(store.products[0].option)).toBe(true)
    expect(store.products[0].option).toEqual([])
  })

  it('fetchSearchProducts handles null response gracefully', async () => {
    ;(axios.get as any).mockResolvedValue({ data: null })

    const store = useProductsStore()

    await store.fetchSearchProducts('query', true)

    expect(store.searchResultProducts).toHaveLength(0)
  })
})