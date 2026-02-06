<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from "vue";
import { useProductsStore } from "../stores/productStores";
import axios from "axios";
const productStore = useProductsStore()
import {
    ChevronDownIcon,
    MapPinIcon,
    TagIcon,
    AdjustmentsHorizontalIcon,
    XMarkIcon,
    FunnelIcon,
} from "@heroicons/vue/24/outline";
import { CategorySelectedEvent } from "../types/product";
import { useTheme } from "../composables/useTheme";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const emits = defineEmits(['scrollTop'])
const { isDark } = useTheme();
const openDropdown = ref<string | null>(null);
const selectedMunicipality = ref("All Locations");
const selectedProduct = ref("All Categories");
const selectedFilter = ref("Sort By");

// Loading state
const isLoadingCategories = ref(true);

// Active filters count
const activeFiltersCount = computed(() => {
    let count = 0;
    if (selectedMunicipality.value !== "All Locations") count++;
    if (selectedProduct.value !== "All Categories") count++;
    return count;
});

const hanldecScroll = () => {
    emits('scrollTop')
}



const municipalities = ref<string[]>(["All"]);
const isLoadingMunicipalities = ref(true);

const fetchMunicipalities = async () => {
    isLoadingMunicipalities.value = true;
    try {
        const response = await axios.get(`${API_BASE_URL}/public/product-municipalities`);
        if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
            const names = response.data.data.map((m: any) => m.name).filter(Boolean);
            municipalities.value = ["All", ...names.sort()];
        } else {
            municipalities.value = ["All"];
        }
    } catch (error) {
        console.log('Could not fetch product municipalities:', error);
        municipalities.value = ["All"];
    } finally {
        isLoadingMunicipalities.value = false;
    }
};

// Default categories - empty by default, populated from admin
const defaultProducts: string[] = [];

// Dynamic products/categories from API
const products = ref<string[]>(["All"]);

// Fetch categories from API
const fetchCategories = async () => {
    isLoadingCategories.value = true;
    try {
        // Prefer product-based categories (derived from approved products)
        const response = await axios.get(`${API_BASE_URL}/public/product-categories`);
        if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
            const categoryNames = response.data.data.map((c: any) => c.name).filter(Boolean);
            products.value = ["All", ...categoryNames.sort()];
        } else {
            // fallback to admin-managed categories endpoint
            const fallback = await axios.get(`${API_BASE_URL}/public/categories`);
            if (fallback.data.success && Array.isArray(fallback.data.data) && fallback.data.data.length > 0) {
                const categoryNames = fallback.data.data
                    .filter((cat: any) => cat.isActive !== false)
                    .map((cat: any) => cat.name);
                products.value = ["All", ...categoryNames.sort()];
            } else {
                products.value = ["All"];
            }
        }
    } catch (error) {
        console.log('Could not fetch categories:', error);
        // On error, show only "All"
        products.value = ["All"];
    } finally {
        isLoadingCategories.value = false;
    }
};

const filters = [
    "Price: Low to High",
    "Price: High to Low",
    "Most Sold",
    "Best Rating",
    "Newest First",
];

const toggleDropdown = (dropdown: string | null) => {
    openDropdown.value = openDropdown.value === dropdown ? null : dropdown;
};

const selectMunicipality = (city: string) => {
    selectedMunicipality.value = city === "All" ? "All Locations" : city;
    handleCategorySelected({ type: "municipality", value: city });
    openDropdown.value = null;
    hanldecScroll()
};

const selectProduct = (product: string) => {
    selectedProduct.value = product === "All" ? "All Categories" : product;
    handleCategorySelected({ type: "product", value: product });
    openDropdown.value = null;
    hanldecScroll()
};

const selectFilter = (filter: string) => {
    selectedFilter.value = filter;
    handleCategorySelected({ type: "filter", value: filter });
    openDropdown.value = null;
    hanldecScroll()
};

// Clear all filters
const clearAllFilters = async () => {
    // Reset UI state
    selectedMunicipality.value = "All Locations";
    selectedProduct.value = "All Categories";
    selectedFilter.value = "Sort By";
    
    // Clear store filter values directly BEFORE making any API calls
    productStore.selectedCategory = '';
    productStore.seletedMunicipality = '';
    productStore.isFetched = false;
    productStore.products = [];
    productStore.featuredProducts = [];
    productStore.skip = 0;
    productStore.hasMore = true;
    
    // Fetch all products without any filters
    productStore.fetchProducts();
    
    hanldecScroll();
};

const handleCategorySelected = async (payload: CategorySelectedEvent) => {
    productStore.isFetched = false
    if (payload.type === "product")
        productStore.filterByCategory(payload.value);
    if (payload.type === "filter")
        productStore.filterProducts(selectedFilter.value)
    if (payload.type === "municipality")
        productStore.filterByMunicilipality(payload.value === "All Locations" ? "All" : payload.value)
};


const dropdownContainer = ref<HTMLDivElement | null>(null);

const handleClickOutside = (event: MouseEvent) => {
    if (dropdownContainer.value && !dropdownContainer.value.contains(event.target as Node)) {
        openDropdown.value = null;
    }
};

onMounted(async () => {
    document.addEventListener("click", handleClickOutside);
    // Fetch categories and municipalities from API
    await Promise.all([fetchCategories(), fetchMunicipalities()]);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", handleClickOutside);
});
</script>


<template>
    <section ref="dropdownContainer" class="category-filter-section">
        <div class="filter-container">
            <!-- Filter Header with active count -->
            <div class="filter-header">
                <!-- <div class="filter-title">
                    <FunnelIcon class="filter-title-icon" />
                    <span>Filters</span>
                    <span v-if="activeFiltersCount > 0" class="active-count">{{ activeFiltersCount }}</span>
                </div> -->

            </div>

            <div class="filters-row">
                <!-- Municipality Filter -->
                <div class="dropdown">
                    <button class="dropdown-btn" :class="{ active: selectedMunicipality !== 'All Locations' }"
                        @click="toggleDropdown('municipality')">
                        <MapPinIcon class="icon" />
                        <span class="dropdown-text">{{ selectedMunicipality }}</span>
                        <ChevronDownIcon class="icon-chevron"
                            :class="{ 'rotate-180': openDropdown === 'municipality' }" />
                    </button>
                    <Transition name="dropdown">
                        <ul v-if="openDropdown === 'municipality'" class="dropdown-menu">
                            <li v-if="isLoadingMunicipalities" class="loading">Loading...</li>
                            <li v-else v-for="city in municipalities" :key="city" @click="selectMunicipality(city)"
                                :class="{ selected: city === selectedMunicipality || (city === 'All' && selectedMunicipality === 'All Locations') }">
                                <MapPinIcon class="menu-icon" />
                                {{ city === 'All' ? 'All Locations' : city }}
                            </li>
                        </ul>
                    </Transition>
                </div>

                <!-- Category Filter -->
                <div class="dropdown">
                    <button class="dropdown-btn" :class="{ active: selectedProduct !== 'All Categories' }"
                        @click="toggleDropdown('product')">
                        <TagIcon class="icon" />
                        <span class="dropdown-text">{{ selectedProduct }}</span>
                        <ChevronDownIcon class="icon-chevron" :class="{ 'rotate-180': openDropdown === 'product' }" />
                    </button>
                    <Transition name="dropdown">
                        <ul v-if="openDropdown === 'product'" class="dropdown-menu">
                            <li v-for="product in products" :key="product" @click="selectProduct(product)"
                                :class="{ selected: product === selectedProduct || (product === 'All' && selectedProduct === 'All Categories') }">
                                <TagIcon class="menu-icon" />
                                {{ product === 'All' ? 'All Categories' : product }}
                            </li>
                        </ul>
                    </Transition>
                </div>

                <!-- Sort Filter -->
                <div class="dropdown sort-dropdown">
                    <button class="dropdown-btn" :class="{ active: selectedFilter !== 'Sort By' }"
                        @click="toggleDropdown('filter')">
                        <AdjustmentsHorizontalIcon class="icon" />
                        <span class="dropdown-text">{{ selectedFilter }}</span>
                        <ChevronDownIcon class="icon-chevron" :class="{ 'rotate-180': openDropdown === 'filter' }" />
                    </button>
                    <Transition name="dropdown">
                        <ul v-if="openDropdown === 'filter'" class="dropdown-menu">
                            <li v-for="filter in filters" :key="filter" @click="selectFilter(filter)"
                                :class="{ selected: filter === selectedFilter }">
                                <AdjustmentsHorizontalIcon class="menu-icon" />
                                {{ filter }}
                            </li>
                        </ul>
                    </Transition>
                </div>
            </div>

            <!-- Active Filter Tags -->
            <div v-if="activeFiltersCount > 0" class="active-filters">
                <div v-if="selectedMunicipality !== 'All Locations'" class="filter-tag">
                    <MapPinIcon class="tag-icon" />
                    <span>{{ selectedMunicipality }}</span>
                      <button class="remove-tag" @click="selectMunicipality('All')">
                        <XMarkIcon class="remove-icon" />
                    </button>
                </div>
                <div v-if="selectedProduct !== 'All Categories'" class="filter-tag">
                    <TagIcon class="tag-icon" />
                    <span>{{ selectedProduct }}</span>
                    <button class="remove-tag" @click="selectProduct('All')">
                        <XMarkIcon class="remove-icon" />
                    </button>
                </div>
                <button v-if="activeFiltersCount > 0" class="filter-tag" @click="clearAllFilters">
                    <span>Clear All</span>
                </button>

            </div>
        </div>
    </section>
</template>

<style scoped>
.category-filter-section {
    width: 100%;
    background-color: var(--bg-primary);
    z-index: 66;
    transition: background-color var(--transition-fast);
    border-bottom: 1px solid var(--border-color);
    margin-top: -1rem;
}

.filter-container {
    animation: fadeIn 0.17s ease-out;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 1200px;
    margin: 0 auto;
    padding: 12px 16px;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Filter Header */
.filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.filter-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.95rem;
}

.filter-title-icon {
    width: 18px;
    height: 18px;
    color: var(--primary-color);
}

.active-count {
    background: var(--primary-color);
    color: white;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 600;
}

/* .clear-all-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--transition-fast);
}

.clear-all-btn:hover {
    background: var(--surface-hover);
    color: var(--secondary-color);
    border-color: var(--secondary-color);
} */

.clear-icon {
    width: 14px;
    height: 14px;
}

/* Filters Row */
.filters-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
}

.dropdown {
    position: relative;
    flex: 1 1 auto;
    min-width: 100px;
    max-width: 220px;
}

.sort-dropdown {
    margin-left: auto;
}

.dropdown-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    background-color: var(--surface);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 10px 14px;
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: 0.9rem;
    font-weight: 500;
}

.dropdown-btn:hover {
    border-color: var(--primary-color);
    box-shadow: 0 2px 8px rgba(31, 139, 78, 0.1);
}

.dropdown-btn.active {
    border-color: var(--primary-color);
    background: linear-gradient(135deg, rgba(31, 139, 78, 0.05), rgba(31, 139, 78, 0.02));
}

.dropdown-text {
    flex-grow: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;
    font-size: clamp(10px, 1.5vw, 14px);
}

.icon {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: var(--primary-color);
}

.icon-chevron {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    margin-left: auto;
    transition: transform 0.3s ease;
    color: var(--text-secondary);
}

.rotate-180 {
    transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    background-color: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 100;
    list-style: none;
    padding: 8px;
    max-height: 320px;
    overflow: auto;
    scrollbar-width: thin;
    min-width: fit-content;
}

.dropdown-menu li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px 12px;
    cursor: pointer;
    transition: all var(--transition-fast);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: clamp(12px, 1.5vw, 14px);
}

.dropdown-menu li:hover {
    background-color: var(--surface-hover);
    color: var(--primary-color);
}

.loading {
    padding: 10px 12px;
    color: var(--text-secondary);
}

.dropdown-menu li.selected {
    background: linear-gradient(135deg, rgba(31, 139, 78, 0.1), rgba(31, 139, 78, 0.05));
    color: var(--primary-color);
    font-weight: 600;
}

.menu-icon {
    width: 16px;
    height: 16px;
    opacity: 0.7;
}

.dropdown-menu li.selected .menu-icon,
.dropdown-menu li:hover .menu-icon {
    opacity: 1;
}

/* Dropdown Animation */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

/* Active Filter Tags */
.active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.25rem;
}

.filter-tag {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 6px 10px;
    background: linear-gradient(135deg, rgba(31, 139, 78, 0.1), rgba(31, 139, 78, 0.05));
    border: 1px solid rgba(31, 139, 78, 0.2);
    border-radius: 20px;
    font-size: clamp(10px, 1.5vw, 12px);
    color: var(--primary-color);
    font-weight: 500;
}

.tag-icon {
    width: 14px;
    height: 14px;
}

.remove-tag {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 50%;
    transition: all var(--transition-fast);
    color:white;
}

.remove-tag:hover {
    background: rgba(31, 139, 78, 0.2);
}

.remove-icon {
    width: 12px;
    height: 12px;
}

/* Responsive Styles */
@media (max-width: 768px) {
    .filter-container {
        padding: 10px 12px;
    }

    .filter-header {
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .dropdown {
        min-width: 140px;
    }

    .dropdown-btn {
        padding: 8px 12px;
        font-size: 0.85rem;
    }
}

@media (max-width: 540px) {
    .dropdown {
        position: relative;
        flex: 1 1 auto;
        min-width: 80px;
        max-width: 110px;
    }

    .sort-dropdown {
        margin-left: auto;
    }

    .dropdown-btn {
        padding: 5px 7px;
    }
}
</style>
