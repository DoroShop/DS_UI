import { render } from '@testing-library/vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import MobileNav from '../MobileNav.vue'
import Home from '../../pages/Home.vue'
import NearbyShops from '../../pages/NearbyShops.vue'
import { describe, it, expect } from 'vitest'

describe('MobileNav', () => {
  it('does not render when current route meta.hideMobileNav is true', async () => {
    const routes = [
      { path: '/products', component: Home },
      { path: '/shops/nearby', component: NearbyShops, meta: { hideMobileNav: true } },
    ]

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/shops/nearby')
    await router.isReady()

    const { container } = render(MobileNav, {
      global: { plugins: [router] },
    })

    expect(container.querySelector('.mobile-nav')).toBeNull()
  })

  it('renders on normal routes', async () => {
    const routes = [
      { path: '/products', component: Home },
      { path: '/shops/nearby', component: NearbyShops, meta: { hideMobileNav: true } },
    ]

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/products')
    await router.isReady()

    const { container } = render(MobileNav, {
      global: { plugins: [router] },
    })

    expect(container.querySelector('.mobile-nav')).not.toBeNull()
  })

  it('hides nav on product, seller and search pages', async () => {
    const Dummy = { template: '<div />' }
    const routes = [
      { path: '/product/:id', component: Dummy, meta: { hideMobileNav: true } },
      { path: '/view/vendor/:id', component: Dummy, meta: { hideMobileNav: true } },
      { path: '/products/search', component: Dummy, meta: { hideMobileNav: true } },
      { path: '/search/result', component: Dummy, meta: { hideMobileNav: true } },
    ]

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/product/123')
    await router.isReady()

    const { container, rerender } = render(MobileNav, {
      global: { plugins: [router] },
    })

    expect(container.querySelector('.mobile-nav')).toBeNull()

    // Navigate to seller
    await router.push('/view/vendor/abc')
    await router.isReady()
    await rerender()
    expect(container.querySelector('.mobile-nav')).toBeNull()

    // Navigate to search
    await router.push('/products/search')
    await router.isReady()
    await rerender()
    expect(container.querySelector('.mobile-nav')).toBeNull()

    await router.push('/search/result')
    await router.isReady()
    await rerender()
    expect(container.querySelector('.mobile-nav')).toBeNull()
  })
})
