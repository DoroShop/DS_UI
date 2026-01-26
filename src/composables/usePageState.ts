import { ref, onActivated, onDeactivated, onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'

interface PageState {
  scrollPosition: number
  timestamp: number
  data?: any
  pagination?: {
    page: number
    hasMore: boolean
    skip?: number
  }
}

// In-memory cache for faster restoration (survives route changes but not page refresh)
const pageStateCache = new Map<string, PageState>()

// Session storage key prefix
const STORAGE_PREFIX = 'dshop_page_state_'

/**
 * Comprehensive page state restoration composable
 * Saves scroll position, data, and pagination state when leaving a page
 * Restores everything in the correct order before paint
 * 
 * Usage:
 * ```ts
 * const scrollContainer = ref<HTMLElement | null>(null)
 * const { isRestoring, saveState, restoreState } = usePageState('home', scrollContainer, {
 *   getData: () => ({ products: store.products }),
 *   setData: (data) => { store.products = data.products },
 *   getPagination: () => ({ page: 1, hasMore: true }),
 *   setPagination: (p) => { store.page = p.page }
 * })
 * ```
 */
export function usePageState(
  pageKey: string,
  containerRef: Ref<HTMLElement | null>,
  options?: {
    getData?: () => any
    setData?: (data: any) => void
    getPagination?: () => { page: number; hasMore: boolean; skip?: number }
    setPagination?: (pagination: { page: number; hasMore: boolean; skip?: number }) => void
    onBeforeRestore?: () => void
    onAfterRestore?: () => void
  }
) {
  const isRestoring = ref(false)
  const hasRestoredOnce = ref(false)
  
  const cacheKey = `${STORAGE_PREFIX}${pageKey}`
  
  // Get state from memory cache first, then sessionStorage
  const getStoredState = (): PageState | null => {
    // Try memory cache first (faster)
    if (pageStateCache.has(pageKey)) {
      return pageStateCache.get(pageKey)!
    }
    
    // Fall back to sessionStorage
    try {
      const stored = sessionStorage.getItem(cacheKey)
      if (stored) {
        const state = JSON.parse(stored) as PageState
        // Check if state is not too old (5 minutes max)
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          // Also populate memory cache
          pageStateCache.set(pageKey, state)
          return state
        }
      }
    } catch (e) {
      console.warn('[PageState] Failed to read from sessionStorage:', e)
    }
    return null
  }
  
  // Save state to both memory and sessionStorage
  const saveState = () => {
    if (!containerRef.value) return
    
    const state: PageState = {
      scrollPosition: containerRef.value.scrollTop,
      timestamp: Date.now()
    }
    
    // Save data if getter provided
    if (options?.getData) {
      state.data = options.getData()
    }
    
    // Save pagination if getter provided
    if (options?.getPagination) {
      state.pagination = options.getPagination()
    }
    
    // Save to memory cache
    pageStateCache.set(pageKey, state)
    
    // Save to sessionStorage
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(state))
    } catch (e) {
      console.warn('[PageState] Failed to save to sessionStorage:', e)
    }
  }
  
  // Restore state in correct order: data -> pagination -> scroll
  const restoreState = async (): Promise<boolean> => {
    const state = getStoredState()
    if (!state || state.scrollPosition === 0) return false
    
    isRestoring.value = true
    
    try {
      // 1. Call onBeforeRestore callback
      options?.onBeforeRestore?.()
      
      // 2. Restore data first (ensures DOM has correct content height)
      if (state.data && options?.setData) {
        options.setData(state.data)
      }
      
      // 3. Restore pagination state
      if (state.pagination && options?.setPagination) {
        options.setPagination(state.pagination)
      }
      
      // 4. Wait for DOM to update with restored data
      await nextTick()
      
      // 5. Restore scroll position using a Promise to ensure paint completes
      return new Promise((resolve) => {
        // Use setTimeout with 0 to allow browser to paint first
        // This ensures the layout is fully rendered before we set scroll
        setTimeout(() => {
          if (containerRef.value) {
            // Disable smooth scrolling temporarily
            const originalBehavior = containerRef.value.style.scrollBehavior
            containerRef.value.style.scrollBehavior = 'auto'
            
            // Set scroll position immediately
            containerRef.value.scrollTop = state.scrollPosition
            console.log(`[PageState] ${pageKey} - Scroll restored to ${state.scrollPosition}`)
            
            // Restore original scroll behavior after setting scroll
            requestAnimationFrame(() => {
              if (containerRef.value) {
                containerRef.value.style.scrollBehavior = originalBehavior
              }
              isRestoring.value = false
              hasRestoredOnce.value = true
              options?.onAfterRestore?.()
              resolve(true)
            })
          } else {
            console.warn(`[PageState] ${pageKey} - Container ref is null`)
            isRestoring.value = false
            resolve(false)
          }
        }, 0)
      })
    } catch (e) {
      console.error('[PageState] Failed to restore state:', e)
      isRestoring.value = false
      return false
    }
  }
  
  // Clear saved state
  const clearState = () => {
    pageStateCache.delete(pageKey)
    try {
      sessionStorage.removeItem(cacheKey)
    } catch (e) {
      // Ignore
    }
  }
  
  // Track scroll position continuously
  let scrollTracker: (() => void) | null = null
  
  const startTracking = () => {
    if (containerRef.value && !scrollTracker) {
      scrollTracker = () => {
        if (containerRef.value) {
          // Update in-memory cache frequently
          const existing = pageStateCache.get(pageKey) || { scrollPosition: 0, timestamp: Date.now() }
          existing.scrollPosition = containerRef.value.scrollTop
          existing.timestamp = Date.now()
          pageStateCache.set(pageKey, existing)
        }
      }
      containerRef.value.addEventListener('scroll', scrollTracker, { passive: true })
    }
  }
  
  const stopTracking = () => {
    if (containerRef.value && scrollTracker) {
      containerRef.value.removeEventListener('scroll', scrollTracker)
      scrollTracker = null
    }
  }
  
  // Lifecycle hooks for keep-alive components
  onDeactivated(() => {
    saveState()
    stopTracking()
    console.log(`[PageState] ${pageKey} - onDeactivated (saved)`)
  })
  
  onActivated(async () => {
    console.log(`[PageState] ${pageKey} - onActivated (restoring)`)
    startTracking()
    
    // Only restore if we have a saved state
    const state = getStoredState()
    if (state && state.scrollPosition > 0) {
      console.log(`[PageState] ${pageKey} - Restoring scroll to ${state.scrollPosition}`)
      await restoreState()
    } else {
      console.log(`[PageState] ${pageKey} - No saved state, scrollPosition=${state?.scrollPosition}`)
    }
  })
  
  // Lifecycle hooks for non-keep-alive components
  onMounted(() => {
    startTracking()
  })
  
  onBeforeUnmount(() => {
    saveState()
    stopTracking()
  })
  
  return {
    isRestoring,
    hasRestoredOnce,
    saveState,
    restoreState,
    clearState,
    getStoredState
  }
}

// Utility to check if there's saved state for a page (useful for conditional data fetching)
export function hasPageState(pageKey: string): boolean {
  const cacheKey = `${STORAGE_PREFIX}${pageKey}`
  
  if (pageStateCache.has(pageKey)) {
    return true
  }
  
  try {
    const stored = sessionStorage.getItem(cacheKey)
    if (stored) {
      const state = JSON.parse(stored) as PageState
      return Date.now() - state.timestamp < 5 * 60 * 1000
    }
  } catch {
    // Ignore
  }
  
  return false
}

// Utility to clear all page states (useful on logout)
export function clearAllPageStates() {
  pageStateCache.clear()
  
  try {
    const keys = Object.keys(sessionStorage)
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        sessionStorage.removeItem(key)
      }
    })
  } catch {
    // Ignore
  }
}
