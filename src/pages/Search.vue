<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { MagnifyingGlassIcon, XMarkIcon, ArrowLeftIcon } from "@heroicons/vue/24/outline";
import { useProductsStore } from "../stores/productStores";
import { debounce } from "../utils/debounce";
import { useTheme } from "../composables/useTheme";

const router = useRouter();
const productStore = useProductsStore();
const { isDark } = useTheme();

// Reactive state
const searchQuery = ref("");
const currentSearchQuery = ref("");
const suggestions = computed(() => productStore.suggestions);
const trendingProducts = computed(() => productStore.trendingProducts);
const searchResults = ref([]);
const isSearching = ref(false);
const isFocused = ref(false);
const selectedIndex = ref(-1);
const searchInput = ref(null);
const showSearchResults = ref(false);

// Shop suggestions filtered client-side from cached featured vendors
const shopSuggestions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return [];
  return productStore.featuredSeller.filter((shop) =>
    shop.storeName?.toLowerCase().includes(q)
  );
});

const selectShop = (shop) => {
  router.push(`/view/vendor/${shop.userId}`);
};

// Load trending products when component mounts
const loadTrendingProducts = async () => {
  try {
    await productStore.fetchTrendingProducts(10);
  } catch (error) {
    console.error("Failed to load trending products:", error);
  }
};

// Debounced search function
const debouncedSearch = debounce(productStore.searchProducts, 300);

// Event handlers
const handleFocus = () => {
  showSearchResults.value = false;
  searchResults.value = [];
  currentSearchQuery.value = "";

  isFocused.value = true;
  loadTrendingProducts();
  if (!searchQuery.value) {
    productStore.suggestions = [];
  }
};

const handleBlur = () => {
  // Delay hiding dropdown to allow for clicks
  setTimeout(() => {
    isFocused.value = false;
    selectedIndex.value = -1;
  }, 200);
};

const handleKeydown = async (event) => {
  if (event.key === "Escape") {
    if (showSearchResults.value) {
      clearSearchResults();
    } else {
      searchInput.value?.blur();
    }
    return;
  }
  const currentSuggestions = searchQuery.value
    ? suggestions.value
    : trendingProducts.value;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        currentSuggestions.length - 1
      );
      break;
    case "ArrowUp":
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      break;
    case "Enter":
      event.preventDefault();
      if (selectedIndex.value >= 0 && currentSuggestions[selectedIndex.value]) {

        selectProduct(currentSuggestions[selectedIndex.value]);
      } else if (searchQuery.value.trim()) {
        router.push(`/search/result?q=${searchQuery.value.trim()}`);
      }
      break;
  }
};

const selectProduct = (product) => {
  router.push(`/product/${product.id}`);
};

const clearSearch = () => {
  searchQuery.value = "";
  suggestions.value = [];
  selectedIndex.value = -1;

  if (showSearchResults.value) {
    showSearchResults.value = false;
    searchResults.value = [];
    currentSearchQuery.value = "";
  }

  if (isFocused.value) {
    loadTrendingProducts();
  }

  searchInput.value?.focus();
};

const clearSearchResults = () => {
  showSearchResults.value = false;
  searchResults.value = [];
  currentSearchQuery.value = "";
  searchQuery.value = "";
  searchInput.value?.focus();
};

const goBack = () => {
  if (showSearchResults.value) {
    clearSearchResults();
  } else {
    router.back();
  }
};

const handleImageError = (event) => {
  event.target.src =
    "https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400";
};

const formatPrice = (price) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// Watchers
watch(searchQuery, (newQuery) => {
  if (!newQuery.trim()) {
    if (isFocused.value) {
      loadTrendingProducts();
    }
    return;
  }
  if (!showSearchResults.value) {
    debouncedSearch(newQuery);
  }
});

// Lifecycle
onMounted(() => {
  // Focus search input on mount
  searchInput.value?.focus();
  loadTrendingProducts();
  // Pre-load featured vendors for shop search (cached, only fetches once)
  productStore.fetchFeaturedVendor();
});

onUnmounted(() => {
  debouncedSearch.cancel?.();
});
</script>

<template>
  <section class="search-page">
    <div class="search-container">
      <!-- Header with grouped back button and search bar -->
      <div class="search-header">
        <div class="search-wrapper">
          <div class="header-group">
            <div class="search-input-container">
              <button @click="goBack" class="back-button" type="button">
                <ArrowLeftIcon class="icon" />
              </button>
              <!-- <div class="search-icon">
                <MagnifyingGlassIcon class="icon" />
              </div> -->

              <input ref="searchInput" v-model="searchQuery" type="text" placeholder="Search for products..."
                class="search-input" @focus="handleFocus" @blur="handleBlur" @keydown="handleKeydown" />

              <button v-if="searchQuery" @click="clearSearch" class="clear-button" type="button">
                <XMarkIcon class="icon" />
              </button>
            </div>
          </div>

          <!-- Loading indicator -->
          <div v-if="productStore.isLoading" class="loading-indicator">
            <div class="spinner"></div>
          </div>

          <!-- Suggestions dropdown -->
          <div v-if="suggestions.length > 0 || trendingProducts.length > 0 || shopSuggestions.length > 0" class="suggestions-dropdown"
            @mousedown.prevent>
            <!-- Search suggestions -->
            <div v-if="searchQuery && suggestions.length > 0" class="suggestions-section">
              <div class="section-header">
                <h4>Search Results</h4>
              </div>
              <div v-for="(product, index) in suggestions" :key="`search-${product.id}`"
                :class="['suggestion-item', { active: selectedIndex === index }]" @click="selectProduct(product)"
                @mouseenter="selectedIndex = index">
                <div class="product-image">
                  <img :src="product.imageUrl ||
                    'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'
                    " :alt="product.name" @error="handleImageError" />
                </div>
                <div class="product-info">
                  <h4 class="product-name">{{ product.name }}</h4>
                  <p class="product-price">${{ formatPrice(product.price) }}</p>
                  <p v-if="product.category" class="product-category">
                    {{ product.category }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Trending products when focused but no search query -->
            <div v-if="!searchQuery && trendingProducts.length > 0" class="suggestions-section">
              <div class="section-header">
                <h4>Trending Products</h4>
              </div>
              <div v-for="(product, index) in trendingProducts" :key="`trending-${product.id}`"
                :class="['suggestion-item', { active: selectedIndex === index }]" @click="selectProduct(product)"
                @mouseenter="selectedIndex = index">
                <div class="product-image">
                  <img :src="product.imageUrl ||
                    'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'
                    " :alt="product.name" @error="handleImageError" />
                </div>
                <div class="product-info">
                  <h4 class="product-name">{{ product.name }}</h4>
                  <p class="product-price">${{ formatPrice(product.price) }}</p>
                  <p v-if="product.category" class="product-category">
                    {{ product.category }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Shop suggestions when searching -->
            <div v-if="searchQuery && shopSuggestions.length > 0" class="suggestions-section">
              <div class="section-header">
                <h4>Shops</h4>
              </div>
              <div v-for="shop in shopSuggestions" :key="`shop-${shop.userId}`"
                class="suggestion-item shop-suggestion-item" @click="selectShop(shop)">
                <div class="product-image shop-avatar">
                  <img :src="shop.imageUrl ||
                    'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'
                    " :alt="shop.storeName" @error="handleImageError" />
                </div>
                <div class="product-info">
                  <h4 class="product-name">{{ shop.storeName }}</h4>
                  <p v-if="shop.totalProducts" class="product-category">
                    {{ shop.totalProducts }} products
                  </p>
                  <div v-if="shop.rating" class="shop-rating">
                    <span class="rating-star">★</span>
                    <span class="rating-value">{{ shop.rating.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- No results message for search -->
            <div v-if="searchQuery && !productStore.isLoading && suggestions.length === 0 && shopSuggestions.length === 0" class="no-results">
              <p>No products found for "{{ searchQuery }}"</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Popular searches when input is empty and not focused -->
      <!-- <div v-if="!searchQuery && !isFocused && !showSearchResults" class="search-suggestions">
        <h3>Popular Searches</h3>
        <div class="popular-tags">
          <button v-for="tag in popularSearches" :key="tag" @click="performSearch(tag)" class="tag-button">
            {{ tag }}
          </button>
        </div>
      </div> -->

      <!-- Search Results Container -->
      <div v-if="showSearchResults" class="search-results-container">
        <div class="results-header">
          <h2>Search Results for "{{ currentSearchQuery }}"</h2>
          <p class="results-count">{{ searchResults.length }} products found</p>
        </div>

        <!-- Loading state for search results -->
        <div v-if="isSearching" class="results-loading">
          <div class="spinner"></div>
          <p>Searching products...</p>
        </div>

        <!-- Search results grid -->
        <div v-else-if="searchResults.length > 0" class="results-grid">
          <div v-for="product in searchResults" :key="product.id" class="result-item" @click="selectProduct(product)">
            <div class="result-image">
              <img :src="product.imageUrl ||
                'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'
                " :alt="product.name" @error="handleImageError" />
            </div>
            <div class="result-info">
              <h3 class="result-name">{{ product.name }}</h3>
              <p class="result-price">${{ formatPrice(product.price) }}</p>
              <p v-if="product.category" class="result-category">
                {{ product.category }}
              </p>
              <div v-if="product.rating" class="result-rating">
                <span class="rating-stars">★★★★☆</span>
                <span class="rating-text">({{ product.rating }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- No search results -->
        <div v-else class="no-search-results">
          <div class="no-results-icon">
            <MagnifyingGlassIcon class="icon" />
          </div>
          <h3>No products found</h3>
          <p>Try adjusting your search terms or browse our categories</p>
          <button @click="clearSearchResults" class="browse-button">
            Browse All Products
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.search-page {
  max-height: 100dvh;
  padding: 1rem;
  height: 100dvh;
  background: var(--bg-primary);
  transition: background-color var(--transition-fast);
}

.header-group {
  display: flex;
  padding: 10px 0;
  width: 100%;
}

.search-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  height: 100dvh;
  padding: 0px 1rem;
}

.search-header {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-wrapper {
  position: relative;
  width: 100%;
  height: fit-content;
}

.search-input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 8px 32px var(--shadow-color);
  border: 2px solid var(--primary-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  background: var(--surface);
}

.search-input-container:focus-within {
  border-color: #094a25;
  box-shadow: 0 12px 40px rgba(9, 74, 37, 0.2);
  transform: translateY(-2px);
}

.back-button {
  background: none;
  border: none;
  padding: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  color: var(--text-secondary);
  border-right: 1px solid var(--border-color);
}

.back-button:hover {
  background: var(--surface-hover);
  color: var(--primary-color);
}

.back-button .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.search-icon {
  padding: 1.25rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.search-icon .icon {
  width: 1.5rem;
  height: 1.5rem;
}

.search-input {
  flex: 1;
  padding: 1.25rem 1rem;
  border: none;
  outline: none;
  font-size: 1.1rem;
  color: var(--text-primary);
  background: transparent;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.search-input::placeholder {
  color: var(--text-secondary);
  font-weight: 400;
}

.clear-button {
  padding: 1.25rem;
  position: absolute;
  right: 0px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
  border-left: 1px solid var(--border-color);
}

.clear-button:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.clear-button .icon {
  width: 1.25rem;
  height: 1.25rem;
}

.loading-indicator {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  padding: 1rem;
  background: var(--surface);
  border-radius: 0 0 16px 16px;
  box-shadow: 0 8px 32px var(--shadow-color);
  display: flex;
  justify-content: center;
  z-index: 1000;
  border-top: 1px solid var(--border-color);
  transition: all var(--transition-fast);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #094a25;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.suggestions-dropdown {
  position: relative;
  left: 0;
  right: 0;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 22px 40px var(--shadow-color);
  max-height: 90dvh;
  overflow-y: auto;
  z-index: 1000;
  border-top: 1px solid var(--border-color);
  height: fit-content;
  background: var(--surface);
  transition: all var(--transition-fast);
}

.suggestions-section {
  padding: 0.5rem 0;
}

.section-header {
  padding: 1rem 1.5rem 0.5rem;
  border-bottom: 1px solid var(--border-color);
  transition: border-color var(--transition-fast);
}

.section-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: color var(--transition-fast);
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid var(--border-color);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: var(--surface-hover);
  transform: translateX(4px);
}

.product-image {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  margin-right: 1rem;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--transition-fast);
}

.product-price {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ff6600;
  margin: 0 0 0.25rem 0;
}

.product-category {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.no-results {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
  background: var(--surface);
  border-radius: 0 0 16px 16px;
  transition: all var(--transition-fast);
}

.search-suggestions {
  background: var(--surface);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px var(--shadow-color);
  margin-bottom: 2rem;
  transition: all var(--transition-fast);
}

.search-suggestions h3 {
  margin: 0 0 1.5rem 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.popular-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag-button {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border: none;
  border-radius: 25px;
  color: #374151;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tag-button:hover {
  background: linear-gradient(135deg, #094a25 0%, #0a5a2e 100%);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(9, 74, 37, 0.3);
}

/* Search Results Container */
.search-results-container {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 32px rgba(9, 74, 37, 0.12);
  margin-top: 1rem;
}

.results-header {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f3f4f6;
}

.results-header h2 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1.75rem;
  font-weight: 700;
}

.results-count {
  margin: 0;
  color: #6b7280;
  font-size: 1rem;
  font-weight: 500;
}

.results-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
}

.results-loading p {
  color: #6b7280;
  font-size: 1.1rem;
  margin: 0;
  font-weight: 500;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
}

.result-item {
  background: linear-gradient(135deg, #f8fffe 0%, #f0f9f4 100%);
  border-radius: 16px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  box-shadow: 0 4px 16px rgba(9, 74, 37, 0.08);
}

.result-item:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(9, 74, 37, 0.2);
  border-color: #094a25;
}

.result-image {
  width: 100%;
  height: 220px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.result-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.result-item:hover .result-image img {
  transform: scale(1.05);
}

.result-info {
  text-align: left;
}

.result-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
}

.result-price {
  font-size: 1.375rem;
  font-weight: 700;
  color: #ff6600;
  margin: 0 0 0.5rem 0;
}

.result-category {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 0.75rem 0;
  font-weight: 500;
}

.result-rating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rating-stars {
  color: #fbbf24;
  font-size: 1rem;
}

.rating-text {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.no-search-results {
  text-align: center;
  padding: 4rem 2rem;
}

.no-results-icon {
  margin-bottom: 1.5rem;
}

.no-results-icon .icon {
  width: 4rem;
  height: 4rem;
  color: #d1d5db;
  margin: 0 auto;
}

.no-search-results h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 600;
}

.no-search-results p {
  margin: 0 0 2rem 0;
  color: #6b7280;
  font-size: 1.1rem;
}

.browse-button {
  background: linear-gradient(135deg, #094a25 0%, #0a5a2e 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 16px rgba(9, 74, 37, 0.3);
}

.browse-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(9, 74, 37, 0.4);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .search-page {
    padding: 0.1rem 8px;
  }

  .search-container {
    padding: 0px;
  }

  .search-header {
    margin-bottom: 1.5rem;
  }

  .search-input-container {
    border-radius: 12px;
  }

  .back-button,
  .search-icon,
  .clear-button {
    padding: 1rem;
  }

  .back-button .icon,
  .search-icon .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .search-input {
    font-size: 1rem;
    padding: 1rem 0.75rem;
  }

  .suggestion-item {
    padding: 0.75rem 1rem;
  }

  .product-image {
    width: 50px;
    height: 50px;
    margin-right: 0.75rem;
  }

  .product-name {
    font-size: 0.9rem;
  }

  .product-price {
    font-size: 1rem;
  }

  .search-suggestions {
    padding: 1.5rem;
  }

  .popular-tags {
    gap: 0.5rem;
  }

  .tag-button {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }

  .search-results-container {
    padding: 1.5rem;
  }

  .results-header h2 {
    font-size: 1.5rem;
  }

  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .result-item {
    padding: 1.25rem;
  }

  .result-image {
    height: 180px;
  }

  .result-name {
    font-size: 1rem;
  }

  .result-price {
    font-size: 1.25rem;
  }
}

@media (max-width: 480px) {

  .back-button,
  .search-icon,
  .clear-button {
    padding: 0.75rem;
  }

  .search-input {
    font-size: 0.95rem;
    padding: 0.75rem 0.5rem;
  }

  .suggestion-item {
    padding: 0.5rem 0.75rem;
  }

  .product-image {
    width: 45px;
    height: 45px;
    margin-right: 0.5rem;
  }

  .product-name {
    font-size: 0.85rem;
  }

  .product-price {
    font-size: 0.95rem;
  }

  .results-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .result-image {
    height: 200px;
  }

  .no-search-results {
    padding: 3rem 1rem;
  }

  .no-results-icon .icon {
    width: 3rem;
    height: 3rem;
  }
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.suggestion-item:focus,
.result-item:focus {
  outline: 2px solid #094a25;
  outline-offset: -2px;
}

/* Smooth scrolling for dropdown */
.suggestions-dropdown {
  scroll-behavior: smooth;
}

/* Enhanced hover effects */
.search-input-container:hover {
  box-shadow: 0 10px 36px rgba(9, 74, 37, 0.15);
}

/* Loading animation improvements */
.spinner {
  background: conic-gradient(from 0deg, transparent, #094a25);
  border: none;
  border-radius: 50%;
  mask: radial-gradient(farthest-side,
      transparent calc(100% - 2px),
      black calc(100% - 2px));
}

/* Shop suggestion styles */
.shop-avatar img {
  border-radius: 50%;
  object-fit: cover;
}

.shop-rating {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.shop-rating .rating-star {
  color: #f59e0b;
}

.shop-rating .rating-value {
  font-weight: 500;
}
</style>
