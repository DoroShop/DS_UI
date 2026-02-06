<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import axios from 'axios'

const props = defineProps({
  placement: {
    type: String,
    default: 'hero'
  },
  autoplayInterval: {
    type: Number,
    default: 5000 // 5 seconds
  }
})

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

const banners = ref([])
const currentSlide = ref(0)
const isLoading = ref(true)
const error = ref(null)
const isPaused = ref(false)
const sliderContainer = ref(null)

let autoplayTimer = null
let prefersReducedMotion = false

// Check for reduced motion preference
onMounted(() => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion = mediaQuery.matches
  
  mediaQuery.addEventListener('change', (e) => {
    prefersReducedMotion = e.matches
    if (prefersReducedMotion && autoplayTimer) {
      clearInterval(autoplayTimer)
      autoplayTimer = null
    } else if (!prefersReducedMotion) {
      startAutoplay()
    }
  })
  
  fetchBanners()
  
  // Add visibility change listener to pause when tab is hidden
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
  }
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

const activeBanners = computed(() => {
  return banners.value.filter(banner => banner.isActive)
})

const currentBanner = computed(() => {
  return activeBanners.value[currentSlide.value] || null
})

const fetchBanners = async () => {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/public/banners`, {
      params: { placement: props.placement }
    })
    
    if (data.success) {
      banners.value = data.data || []
      if (activeBanners.value.length > 0) {
        startAutoplay()
      }
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
    console.error('Failed to fetch banners:', err)
  } finally {
    isLoading.value = false
  }
}

const nextSlide = () => {
  if (activeBanners.value.length <= 1) return
  currentSlide.value = (currentSlide.value + 1) % activeBanners.value.length
}

const prevSlide = () => {
  if (activeBanners.value.length <= 1) return
  currentSlide.value = currentSlide.value === 0 
    ? activeBanners.value.length - 1 
    : currentSlide.value - 1
}

const goToSlide = (index) => {
  if (index >= 0 && index < activeBanners.value.length) {
    currentSlide.value = index
  }
}

const startAutoplay = () => {
  if (prefersReducedMotion || activeBanners.value.length <= 1) return
  
  if (autoplayTimer) {
    clearInterval(autoplayTimer)
  }
  
  autoplayTimer = setInterval(() => {
    if (!isPaused.value && !document.hidden) {
      nextSlide()
    }
  }, props.autoplayInterval)
}

const pauseAutoplay = () => {
  isPaused.value = true
}

const resumeAutoplay = () => {
  isPaused.value = false
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    isPaused.value = true
  } else {
    isPaused.value = false
  }
}

const getBannerImage = (banner, size = 'default') => {
  // Use lightweight 1280x720 as default, 1920x1080 for large screens
  return banner.imageUrl || ''
}

const getBannerSrcSet = (banner) => {
  // Generate responsive srcset for optimal loading
  if (banner.imageUrl) {
    // Transform Cloudinary URL for different sizes
    const baseUrl = banner.imageUrl
    const lightweight = baseUrl.replace('/upload/', '/upload/w_1280,h_720,c_fill,g_center,f_webp,q_auto:good/')
    const highRes = baseUrl.replace('/upload/', '/upload/w_1920,h_1080,c_fill,g_center,f_webp,q_auto:good/')
    return `${lightweight} 1280w, ${highRes} 1920w`
  }
  return null
}

const handleBannerClick = (banner) => {
  // Handle different link types in existing banner system
  if (banner.linkType === 'external' && banner.externalLink) {
    window.open(banner.externalLink, '_blank', 'noopener,noreferrer')
  } else if (banner.linkType === 'internal' && banner.internalLink) {
    window.location.href = banner.internalLink
  } else if (banner.linkType === 'category' && banner.categoryLink) {
    window.location.href = `/products?category=${banner.categoryLink}`
  }
  // If linkType is 'none', do nothing
}

const handleKeyDown = (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prevSlide()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextSlide()
  } else if (event.key >= '1' && event.key <= '9') {
    const slideIndex = parseInt(event.key) - 1
    if (slideIndex < activeBanners.value.length) {
      event.preventDefault()
      goToSlide(slideIndex)
    }
  }
}

// Start autoplay when banners are loaded
watch(activeBanners, (newBanners) => {
  if (newBanners.length > 0) {
    currentSlide.value = 0
    startAutoplay()
  }
})

// Cleanup timer when component is unmounted or banners change
watch(() => activeBanners.value.length, (newLength) => {
  if (newLength <= 1 && autoplayTimer) {
    clearInterval(autoplayTimer)
    autoplayTimer = null
  }
})
</script>

<template>
  <div 
    v-if="!isLoading && !error && activeBanners.length > 0" 
    class="banner-slider"
    @mouseenter="pauseAutoplay"
    @mouseleave="resumeAutoplay" 
    @keydown="handleKeyDown"
    tabindex="0"
    ref="sliderContainer"
  >
    <!-- Slider Container -->
    <div class="slider-wrapper">
      <!-- Slides -->
      <div class="slides-container">
        <div
          v-for="(banner, index) in activeBanners"
          :key="`banner-${banner._id}-${index}`"
          :class="['slide', { active: index === currentSlide }]"
        >
          <div 
            class="banner-content"
            :class="{ clickable: banner.linkType && banner.linkType !== 'none' }"
            @click="handleBannerClick(banner)"
          >
            <img
              :src="getBannerImage(banner, 'default')"
              :srcset="getBannerSrcSet(banner)"
              :alt="banner.title || 'Banner image'"
              :loading="index === 0 ? 'eager' : 'lazy'"
              :fetchpriority="index === 0 ? 'high' : 'low'"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 1200px, 1920px"
              class="banner-image"
            />
            
            <!-- Optional overlay for better text visibility -->
            <div v-if="banner.title || banner.subtitle" class="banner-overlay">
              <h3 v-if="banner.title" class="banner-title">{{ banner.title }}</h3>
              <p v-if="banner.subtitle" class="banner-subtitle">{{ banner.subtitle }}</p>
              <button 
                v-if="banner.hasButton && banner.buttonText" 
                class="banner-button"
                @click.stop="handleBannerClick(banner)"
              >
                {{ banner.buttonText }}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Navigation Arrows (only show if more than 1 banner) -->
      <div v-if="activeBanners.length > 1" class="slider-arrows">
        <button 
          @click="prevSlide"
          class="slider-arrow slider-arrow-prev"
          aria-label="Previous banner"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="arrow-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button 
          @click="nextSlide"
          class="slider-arrow slider-arrow-next"
          aria-label="Next banner"
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="arrow-icon">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <!-- Dots Indicator (only show if more than 1 banner) -->
      <div v-if="activeBanners.length > 1" class="slider-dots">
        <button
          v-for="(banner, index) in activeBanners"
          :key="`dot-${banner._id}-${index}`"
          @click="goToSlide(index)"
          :class="['slider-dot', { active: index === currentSlide }]"
          :aria-label="`Go to banner ${index + 1}`"
          type="button"
        />
      </div>
    </div>
  </div>
  
  <!-- Loading State -->
  <div v-if="isLoading" class="banner-loading">
    <div class="banner-skeleton"></div>
  </div>
  
  <!-- Error State (silent failure) -->
  <div v-if="error" class="banner-error" style="display: none;">
    <!-- Silent failure - don't show error to users -->
  </div>
</template>

<style scoped>
.banner-slider {
  margin-top: 4.8rem;
  width: 100%;
  position: relative;
  background: var(--background-secondary, #f8f9fa);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  /* Force exact 16:9 aspect ratio */
  aspect-ratio: 16/9;
  /* Add margin for content spacing */
  margin-bottom: 2rem;
}

.slider-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  /* Ensure exact 16:9 ratio is maintained */
  aspect-ratio: 16/9;
  overflow: hidden;
}

.slides-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.slide.active {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.banner-content {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.banner-content.clickable {
  cursor: pointer;
}

.banner-image {
  width: 100%;
  height: 100%;
  /* Ensure image fills the exact 16:9 container */
  object-fit: cover;
  object-position: center;
  transition: transform 0.3s ease;
  /* Ensure no distortion - maintain aspect ratio while filling container */
  display: block;
}

.banner-content.clickable:hover .banner-image {
  transform: scale(1.02);
}

.banner-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  pointer-events: none;
}

.banner-title {
  color: white;
  font-size: clamp(18px, 3vw, 28px);
  font-weight: 700;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.banner-subtitle {
  color: white;
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 400;
  margin: 0 0 16px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  opacity: 0.9;
}

.banner-button {
  background: var(--primary-color, #6366f1);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.banner-button:hover {
  background: var(--primary-dark, #4f46e5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* Slider Arrows */
.slider-arrows {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  justify-content: space-between;
  padding: 0 20px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.banner-slider:hover .slider-arrows {
  opacity: 1;
}

.slider-arrow {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.slider-arrow:hover {
  background: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.slider-arrow:focus {
  outline: 2px solid var(--primary-color, #6366f1);
  outline-offset: 2px;
}

.arrow-icon {
  width: 20px;
  height: 20px;
  color: black;
}

/* Slider Dots */
.slider-dots {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 20px;
  backdrop-filter: blur(8px);
}

.slider-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider-dot.active {
  background: white;
  transform: scale(1.25);
}

.slider-dot:hover {
  background: rgba(255, 255, 255, 0.8);
}

.slider-dot:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}

/* Loading State */
.banner-loading {
  width: 100%;
  /* Exact 16:9 aspect ratio for loading state */
  aspect-ratio: 16/9;
  border-radius: 12px;
  overflow: hidden;
  /* Fallback for browsers without aspect-ratio support */
  position: relative;
}

/* Fallback for browsers without aspect-ratio support */
@supports not (aspect-ratio: 16/9) {
  .banner-slider::before {
    content: '';
    display: block;
    /* 56.25% = 9/16 * 100% for exact 16:9 ratio */
  }
  
  .slider-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .banner-loading::before {
    content: '';
    display: block;
    /* 56.25% = 9/16 * 100% for 16:9 ratio */
    padding-top: 56.25%;
  }
  
  .banner-skeleton {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}

.banner-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--background-secondary, #f0f0f0) 25%,
    var(--background-tertiary, #e0e0e0) 50%,
    var(--background-secondary, #f0f0f0) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Accessibility - Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .slide {
    transition: opacity 0.2s ease;
    transform: none;
  }
  
  .slide:not(.active) {
    opacity: 0;
  }
  
  .banner-image {
    transition: none;
  }
  
  .banner-content.clickable:hover .banner-image {
    transform: none;
  }
  
  .banner-skeleton {
    animation: none;
    background: var(--background-secondary, #f0f0f0);
  }
}

/* Mobile Responsiveness - Full width, no side spacing */
@media (max-width: 768px) {
  .banner-slider {
    border-radius: 0;
    /* Full width on mobile - no side margins */
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    width: 100vw;
    /* Ensure 16:9 ratio is preserved on mobile */
    aspect-ratio: 16/9;
    /* Maintain spacing from header */
    margin-top: 3.5rem;
    margin-bottom:0;
  }
  
  .slider-arrows {
    padding: 0 12px;
  }
  
  .slider-arrow {
    width: 36px;
    height: 36px;
  }
  
  .arrow-icon {
    width: 16px;
    height: 16px;
  }
  
  .banner-overlay {
    padding: 0;
  }
  
  .slider-dots {
    bottom: 12px;
    gap: 6px;
    padding: 6px 12px;
  }
  
  .slider-dot {
    width: 6px;
    height: 6px;
  }
}

@media (max-width: 480px) {
  .banner-slider {
    border-radius: 0;
    /* Full width on small mobile - no side margins */
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    width: 100vw;
    /* Ensure 16:9 ratio is preserved on small mobile */
    aspect-ratio: 16/9;
    /* Maintain spacing from header */
    margin-bottom: 0;
  }
  
  .slider-arrows {
    padding: 0 8px;
  }
  
  .slider-arrow {
    width: 32px;
    height: 32px;
  }
  
  .arrow-icon {
    width: 14px;
    height: 14px;
  }
}

/* Focus management for keyboard navigation */
.banner-slider:focus {
  outline: 2px solid var(--primary-color, #6366f1);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .slider-arrow {
    background: white;
    border: 2px solid black;
  }
  
  .slider-dot {
    border: 1px solid white;
  }
  
  .banner-overlay {
    background: rgba(0, 0, 0, 0.9);
  }
}
</style>