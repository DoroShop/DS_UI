import { ref, onActivated, onDeactivated, nextTick, type Ref } from 'vue'

/**
 * Composable to save and restore scroll position for keep-alive components
 * 
 * Usage:
 * ```ts
 * const scrollContainer = ref<HTMLElement | null>(null)
 * useScrollRestore(scrollContainer)
 * ```
 */
export function useScrollRestore(containerRef: Ref<HTMLElement | null>) {
  const savedScrollPosition = ref(0)

  // Save scroll position when navigating away
  onDeactivated(() => {
    if (containerRef.value) {
      savedScrollPosition.value = containerRef.value.scrollTop
      console.log('[ScrollRestore] Saved position:', savedScrollPosition.value)
    }
  })

  // Restore scroll position when coming back
  onActivated(() => {
    if (savedScrollPosition.value > 0) {
      // Use multiple timing strategies to ensure scroll restoration works
      const restoreScroll = () => {
        if (containerRef.value) {
          containerRef.value.scrollTop = savedScrollPosition.value
          console.log('[ScrollRestore] Restored position:', savedScrollPosition.value, 'Actual:', containerRef.value.scrollTop)
        }
      }
      
      // Try immediately
      restoreScroll()
      
      // Try after nextTick (DOM update cycle)
      nextTick(() => {
        restoreScroll()
      })
      
      // Try after animation frame (render cycle)
      requestAnimationFrame(() => {
        restoreScroll()
      })
      
      // Try after a small delay (for any async rendering)
      setTimeout(() => {
        restoreScroll()
      }, 50)
    }
  })

  // Manual methods for custom control
  const savePosition = () => {
    if (containerRef.value) {
      savedScrollPosition.value = containerRef.value.scrollTop
    }
  }

  const restorePosition = async () => {
    if (containerRef.value && savedScrollPosition.value > 0) {
      await nextTick()
      containerRef.value.scrollTop = savedScrollPosition.value
    }
  }

  const resetPosition = () => {
    savedScrollPosition.value = 0
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
  }

  return {
    savedScrollPosition,
    savePosition,
    restorePosition,
    resetPosition
  }
}
