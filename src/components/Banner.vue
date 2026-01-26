<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '../composables/useTheme';
import axios from 'axios';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  UserGroupIcon,
  BuildingStorefrontIcon,
} from '@heroicons/vue/24/outline';

const router = useRouter();
const { isDark } = useTheme();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Banner {
  id: number | string;
  headline: string;
  highlight: string;
  afterHighlight: string;
  description: string;
  cta: string;
  ctaLink: string;
  imageUrl: string;
  imageAlt: string;
  gradient: string;
  // API fields
  _id?: string;
  title?: string;
  subtitle?: string;
  link?: string;
  image?: string;
  buttonText?: string;
  // Background customization fields
  backgroundType?: 'gradient' | 'image' | 'glassmorphism';
  backgroundImageUrl?: string;
  hasButton?: boolean;
  // Background only mode - shows full background with no content
  backgroundOnly?: boolean;
}

interface PlatformStats {
  users: number;
  products: number;
  orders: number;
  sellers: number;
}

// Default banners - used as fallback
const defaultBanners: Banner[] = [
  {
    id: 1,
    headline: 'Get ',
    highlight: 'FREE DELIVERY',
    afterHighlight: ' on orders over ₱200',
    description: 'Enjoy the freshest pasalubong and local delicacies delivered right to your doorstep. Experience the joy of hassle-free shopping with DoroShop.',
    cta: 'Shop Now',
    ctaLink: '/products',
    imageUrl: new URL('../assets/fruit.png', import.meta.url).href,
    imageAlt: 'Fresh fruits and local products',
    gradient: 'linear-gradient(135deg, #cfee7a 0%, #f8cf2a 50%, #ffa726 100%)'
  },
  {
    id: 2,
    headline: 'Discover ',
    highlight: 'MINDORO\'S FINEST',
    afterHighlight: ' local products',
    description: 'From native delicacies to handcrafted souvenirs, explore the best of Oriental Mindoro\'s treasures.',
    cta: 'Explore Now',
    ctaLink: '/products',
    imageUrl: new URL('../assets/fruit.png', import.meta.url).href,
    imageAlt: 'Local Mindoro products',
    gradient: 'linear-gradient(135deg, #a8e063 0%, #56ab2f 50%, #1f8b4e 100%)'
  },
  {
    id: 3,
    headline: 'Support ',
    highlight: 'LOCAL SELLERS',
    afterHighlight: ' & communities',
    description: 'Every purchase helps local artisans and farmers thrive. Shop local, make a difference.',
    cta: 'Browse Sellers',
    ctaLink: '/products',
    imageUrl: new URL('../assets/fruit.png', import.meta.url).href,
    imageAlt: 'Local community sellers',
    gradient: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 50%, #ff6600 100%)'
  }
];

// Banners - populated from API or defaults
const banners = ref<Banner[]>(defaultBanners);
const isLoadingBanners = ref(true);

// Platform statistics
const platformStats = ref<PlatformStats | null>(null);
const isLoadingStats = ref(true);

// Fetch banners from API
const fetchBanners = async () => {
  isLoadingBanners.value = true;
  try {
    const response = await axios.get(`${API_BASE_URL}/public/banners`);
    if (response.data.success && response.data.data?.length > 0) {
      // Transform API banners to component format
      banners.value = response.data.data.map((b: any, idx: number) => ({
        id: b._id || idx + 1,
        headline: b.title || '',
        highlight: '',
        afterHighlight: '',
        description: b.subtitle || '',
        cta: b.buttonText || 'Shop Now',
        ctaLink: b.linkUrl || b.link || '/products',
        // Use productImageUrl for the decorative product image
        imageUrl: b.productImageUrl || (b.backgroundOnly ? '' : b.imageUrl) || defaultBanners[idx % defaultBanners.length].imageUrl,
        imageAlt: b.title || 'Banner image',
        // Background: use gradient or image based on backgroundType
        backgroundType: b.backgroundType || 'gradient',
        gradient: b.backgroundType === 'image' ? 'none' : (b.gradientColor || defaultBanners[idx % defaultBanners.length].gradient),
        backgroundImageUrl: b.backgroundType === 'image' ? b.imageUrl : null,
        // Button settings
        hasButton: b.hasButton !== false, // Default true
        buttonText: b.buttonText || 'Shop Now',
        // Background only mode
        backgroundOnly: b.backgroundOnly === true,
        // Keep raw API fields for flexibility
        ...b
      }));
    }
  } catch (error) {
    console.log('Using default banners:', error);
    banners.value = defaultBanners;
  } finally {
    isLoadingBanners.value = false;
  }
};

// Fetch platform statistics
const fetchPlatformStats = async () => {
  isLoadingStats.value = true;
  try {
    const response = await axios.get(`${API_BASE_URL}/public/stats`);
    if (response.data.success) {
      platformStats.value = response.data.data;
    }
  } catch (error) {
    console.log('Could not fetch platform stats:', error);
  } finally {
    isLoadingStats.value = false;
  }
};

// Format numbers for display
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const currentIndex = ref(0);
const isAutoPlaying = ref(true);
const isPaused = ref(false);
const transitionDirection = ref<'next' | 'prev'>('next');
let autoPlayInterval: number | null = null;

// Current banner computed
const currentBanner = computed(() => banners.value[currentIndex.value] || banners.value[0]);

// Navigate to next slide
const nextSlide = () => {
  transitionDirection.value = 'next';
  currentIndex.value = (currentIndex.value + 1) % banners.value.length;
  resetAutoPlay();
};

// Navigate to previous slide
const prevSlide = () => {
  transitionDirection.value = 'prev';
  currentIndex.value = currentIndex.value === 0 
    ? banners.value.length - 1 
    : currentIndex.value - 1;
  resetAutoPlay();
};

// Go to specific slide
const goToSlide = (index: number) => {
  if (index === currentIndex.value) return;
  transitionDirection.value = index > currentIndex.value ? 'next' : 'prev';
  currentIndex.value = index;
  resetAutoPlay();
};

// Start auto-play
const startAutoPlay = () => {
  if (autoPlayInterval) clearInterval(autoPlayInterval);
  autoPlayInterval = setInterval(() => {
    if (!isPaused.value && isAutoPlaying.value) {
      nextSlide();
    }
  }, 5000);
};

// Reset auto-play timer
const resetAutoPlay = () => {
  if (autoPlayInterval) clearInterval(autoPlayInterval);
  startAutoPlay();
};

// Pause on hover
const handleMouseEnter = () => {
  isPaused.value = true;
};

const handleMouseLeave = () => {
  isPaused.value = false;
};

// Handle CTA click
const handleCtaClick = () => {
  if (currentBanner.value.ctaLink) {
    router.push(currentBanner.value.ctaLink);
  }
};

// Touch swipe support
let touchStartX = 0;
let touchEndX = 0;

const handleTouchStart = (e: TouchEvent) => {
  touchStartX = e.changedTouches[0].screenX;
};

const handleTouchEnd = (e: TouchEvent) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
};

const handleSwipe = () => {
  const swipeThreshold = 50;
  const diff = touchStartX - touchEndX;
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      nextSlide();
    } else {
      prevSlide();
    }
  }
};

// Keyboard navigation
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowLeft') prevSlide();
  if (e.key === 'ArrowRight') nextSlide();
};

onMounted(async () => {
  // Fetch data in parallel
  await Promise.all([
    fetchBanners(),
    fetchPlatformStats()
  ]);
  
  startAutoPlay();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  if (autoPlayInterval) clearInterval(autoPlayInterval);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <main class="banner-wrapper">
    <section 
      class="banner-carousel"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <!-- Banner Slides Container -->
      <div class="slides-container">
        <div 
          v-for="(banner, index) in banners" 
          :key="banner.id"
          :class="['banner-slide', { 
            active: index === currentIndex,
            'slide-next': transitionDirection === 'next',
            'slide-prev': transitionDirection === 'prev',
            'glassmorphism': banner.backgroundType === 'glassmorphism',
            'background-only': banner.backgroundOnly
          }]"
          :style="{ 
            background: banner.backgroundType === 'image' && banner.backgroundImageUrl 
              ? `url(${banner.backgroundImageUrl}) center/cover no-repeat` 
              : banner.gradient 
          }"
        >
          <!-- Glassmorphism overlay (not shown in background-only mode) -->
          <div v-if="banner.backgroundType === 'glassmorphism' && !banner.backgroundOnly" class="glass-overlay"></div>
          
          <!-- Content (hidden when backgroundOnly is true) -->
          <div v-if="!banner.backgroundOnly" class="banner-content">
            <div class="content-wrapper">
              <h1 class="banner-headline">
                {{ banner.headline }}
                <span class="highlight">{{ banner.highlight }}</span>
                {{ banner.afterHighlight }}
              </h1>
              <p class="banner-description">
                {{ banner.description }}
              </p>
              <button v-if="banner.hasButton !== false" class="banner-cta" @click="handleCtaClick">
                {{ banner.buttonText || banner.cta }}
                <svg class="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            
            <div class="banner-image-container">
              <img 
                :src="banner.imageUrl" 
                :alt="banner.imageAlt"
                class="banner-image"
                loading="lazy"
              />
            </div>
          </div>
          
          <!-- Clickable link area for background-only banners -->
          <a 
            v-if="banner.backgroundOnly && banner.ctaLink" 
            :href="banner.ctaLink"
            class="background-only-link"
            aria-label="Banner link"
          ></a>
        </div>
      </div>

      <!-- Navigation Arrows -->
      <button 
        v-if="banners.length > 1"
        class="nav-arrow nav-prev" 
        @click="prevSlide"
        aria-label="Previous banner"
      >
        <ChevronLeftIcon class="arrow-icon" />
      </button>
      
      <button 
        v-if="banners.length > 1"
        class="nav-arrow nav-next" 
        @click="nextSlide"
        aria-label="Next banner"
      >
        <ChevronRightIcon class="arrow-icon" />
      </button>

      <!-- Indicators -->
      <div v-if="banners.length > 1" class="indicators">
        <button 
          v-for="(banner, index) in banners"
          :key="`indicator-${banner.id}`"
          :class="['indicator', { active: index === currentIndex }]"
          @click="goToSlide(index)"
          :aria-label="`Go to slide ${index + 1}`"
        >
          <span class="indicator-progress" v-if="index === currentIndex && !isPaused"></span>
        </button>
      </div>
      
      <!-- Platform Statistics - Inside Banner -->
      <div v-if="platformStats" class="banner-stats">
        <div class="stat-item">
          <UserGroupIcon class="stat-icon" />
          <div class="stat-info">
            <span class="stat-value">{{ formatNumber(platformStats.users) }}</span>
            <span class="stat-label">Users</span>
          </div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <BuildingStorefrontIcon class="stat-icon" />
          <div class="stat-info">
            <span class="stat-value">{{ formatNumber(platformStats.sellers) }}</span>
            <span class="stat-label">Sellers</span>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.banner-wrapper {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 5.5rem;
  padding: 0 10px;
  margin-bottom: 0.3rem;
}

.banner-carousel {
  position: relative;
  width: 100%;
  max-width: 100%;
  aspect-ratio: 16 / 5;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Banner Stats - Inside Banner */
.banner-stats {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.banner-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.banner-stats .stat-icon {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.banner-stats .stat-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.banner-stats .stat-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #1f2937;
}

.banner-stats .stat-label {
  font-size: 0.65rem;
  color: #6b7280;
  font-weight: 500;
}

.banner-stats .stat-divider {
  width: 1px;
  height: 24px;
  background: #e5e7eb;
}

/* Slides Container */
.slides-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.banner-slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transform: translateX(100%);
  transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.banner-slide.active {
  position: relative;
  opacity: 1;
  transform: translateX(0);
  z-index: 2;
}

.banner-slide:not(.active).slide-prev {
  transform: translateX(-100%);
}

/* Background Only Mode */
.banner-slide.background-only {
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
}

.background-only-link {
  position: absolute;
  inset: 0;
  z-index: 5;
  cursor: pointer;
}

/* Glassmorphism Effect */
.banner-slide.glassmorphism {
  position: relative;
}

.glass-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 0;
}

.banner-slide.glassmorphism .banner-content {
  position: relative;
  z-index: 1;
}

.banner-slide:not(.active).slide-next {
  transform: translateX(100%);
}

/* Banner Content Layout */
.banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2.5rem 2rem;
  min-height: 280px;
  gap: 2rem;
}

.content-wrapper {
  flex: 1;
  max-width: 60%;
  animation: fadeInUp 0.6s ease-out 0.2s both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Typography */
.banner-headline {
  font-size: clamp(1.5rem, 4vw, 2.75rem);
  font-weight: 800;
  color: #1f2937;
  line-height: 1.2;
  margin: 0 0 1rem;
  text-shadow: 0 2px 4px rgba(255, 255, 255, 0.2);
}

.highlight {
  color: var(--secondary-color);
  position: relative;
  display: inline-block;
}

.highlight::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: var(--secondary-color);
  border-radius: 2px;
  transform: scaleX(0);
  transform-origin: left;
  animation: underline 0.6s ease-out 0.4s forwards;
}

@keyframes underline {
  to {
    transform: scaleX(1);
  }
}

.banner-description {
  font-size: clamp(0.9rem, 2vw, 1.1rem);
  color: #374151;
  line-height: 1.6;
  margin: 0 0 1.5rem;
  max-width: 90%;
}

/* CTA Button */
.banner-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.75rem;
  background: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 50px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(255, 102, 0, 0.3);
}

.banner-cta:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 8px 24px rgba(255, 102, 0, 0.4);
  background: #e55a00;
}

.banner-cta:active {
  transform: translateY(-1px);
}

.cta-arrow {
  width: 20px;
  height: 20px;
  transition: transform 0.3s ease;
}

.banner-cta:hover .cta-arrow {
  transform: translateX(4px);
}

/* Banner Image */
.banner-image-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  max-width: 40%;
}

.banner-image {
  width: 100%;
  max-width: 320px;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.15));
  animation: floatImage 4s ease-in-out infinite;
  transform-origin: center;
}

@keyframes floatImage {
  0%, 100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-10px) rotate(2deg);
  }
}

/* Navigation Arrows */
.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  opacity: 0;
}

.banner-carousel:hover .nav-arrow {
  opacity: 1;
}

.nav-prev {
  left: 1rem;
}

.nav-next {
  right: 1rem;
}

.nav-arrow:hover {
  background: #fff;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.arrow-icon {
  width: 24px;
  height: 24px;
  color: #1f2937;
}

/* Indicators */
.indicators {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  z-index: 10;
}

.indicator {
  width: 32px;
  height: 4px;
  background: rgba(255, 255, 255, 0.4);
  border: none;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.indicator:hover {
  background: rgba(255, 255, 255, 0.6);
}

.indicator.active {
  width: 48px;
  background: rgba(255, 255, 255, 0.5);
}

.indicator-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--secondary-color);
  border-radius: 2px;
  animation: progress 5s linear forwards;
}

@keyframes progress {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* Responsive Design */
@media (max-width: 1200px) {
  .banner-wrapper {
    padding: 0;
    margin-top: 4.5rem;
  }
  
  .banner-carousel {
    border-radius: 0 0 1rem 1rem;
  }
}

@media (max-width: 840px) {
    .banner-carousel {
  
  aspect-ratio: 16 / 5;

}
  .banner-wrapper {
    margin-top: 4rem;
  }
  
  .banner-content {
    padding: 2rem 1.5rem;
    min-height: 240px;
  }
  
  .banner-description {
    display: none;
  }
  
  .content-wrapper {
    max-width: 55%;
  }
  
  .banner-image-container {
    max-width: 45%;
  }
  
  .banner-image {
    max-width: 200px;
  }
  
  .nav-arrow {
    width: 36px;
    height: 36px;
    opacity: 1;
  }
  
  .arrow-icon {
    width: 20px;
    height: 20px;
  }

  .banner-stats {
    bottom: 0.75rem;
    right: 0.75rem;
    padding: 0.4rem 0.75rem;
    gap: 0.5rem;
  }

  .banner-stats .stat-icon {
    width: 18px;
    height: 18px;
  }

  .banner-stats .stat-value {
    font-size: 0.9rem;
  }
}

@media (max-width: 640px) {
  .banner-content {
    padding: 1.5rem 1rem;
    min-height: 200px;
  }
  
  .content-wrapper {
    max-width: 60%;
  }
  
  .banner-image-container {
    max-width: 40%;
    position: absolute;
    right: -1rem;
    bottom: -1rem;
    opacity: 0.9;
  }
  
  .banner-image {
    max-width: 160px;
    animation: none;
    transform: rotate(-15deg);
  }
  
  .banner-cta {
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
  }
  
  .nav-arrow {
    width: 32px;
    height: 32px;
  }
  
  .nav-prev {
    left: 0.5rem;
  }
  
  .nav-next {
    right: 0.5rem;
  }
  
  .indicators {
    bottom: 0.75rem;
  }
  
  .indicator {
    width: 24px;
  }
  
  .indicator.active {
    width: 36px;
  }

  .banner-stats {
    bottom: 2.5rem;
    right: 0.5rem;
    padding: 0.35rem 0.6rem;
    gap: 0.4rem;
  }

  .banner-stats .stat-icon {
    width: 16px;
    height: 16px;
  }

  .banner-stats .stat-value {
    font-size: 0.8rem;
  }

  .banner-stats .stat-label {
    font-size: 0.55rem;
  }

  .banner-stats .stat-divider {
    height: 16px;
  }
}

@media (max-width: 480px) {
  .slides-container {
    min-height: 180px;
  }
  
  .banner-content {
    min-height: 180px;
    padding: 1.25rem 0.75rem;
  }
  
  .banner-headline {
    font-size: 1.25rem;
  }
  
  .banner-image {
    max-width: 130px;
  }

  .banner-stats {
    bottom: 2.25rem;
    right: 0.5rem;
    padding: 0.3rem 0.5rem;
    gap: 0.35rem;
  }

  .banner-stats .stat-icon {
    width: 14px;
    height: 14px;
  }

  .banner-stats .stat-value {
    font-size: 0.75rem;
  }

  .banner-stats .stat-label {
    font-size: 0.5rem;
  }

  .banner-stats .stat-divider {
    height: 14px;
  }
}
</style>
