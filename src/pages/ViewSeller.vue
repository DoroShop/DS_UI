<script setup lang="ts">
	import {
		ref,
		computed,
		onMounted,
		onUnmounted,
		onActivated,
		onDeactivated,
		watch,
	} from "vue";

	// Define component name for keep-alive
	defineOptions({
		name: "ViewSeller",
	});
	import {
		MapPinIcon,
		ChatBubbleLeftEllipsisIcon,
		StarIcon,
		PlusIcon,
		ShoppingBagIcon,
		UserIcon,
		ChevronDownIcon,
		ArrowLeftIcon,
		HeartIcon,
		BuildingStorefrontIcon,
		CheckBadgeIcon,
		CalendarDaysIcon,
		ShareIcon,
		PhoneIcon,
		EnvelopeIcon,
		EllipsisVerticalIcon,
		CheckIcon,
		XMarkIcon,
		TruckIcon,
		ShieldCheckIcon,
		ClockIcon,
		CurrencyDollarIcon,
		ChartBarIcon,
		FireIcon,
		SparklesIcon,
		AdjustmentsHorizontalIcon,
	} from "@heroicons/vue/24/outline";
	import {
		StarIcon as StarSolidIcon,
		HeartIcon as HeartSolidIcon,
		CheckBadgeIcon as CheckBadgeSolidIcon,
	} from "@heroicons/vue/24/solid";

	import { useRoute, useRouter } from "vue-router";
	import type { Seller } from "../types/seller";
	import ProductCard from "../components/ProductCard.vue";
	import Loading from "../components/Loading.vue";
	import ChatModal from "../components/ChatModal.vue";
	import { useVendorStore } from "../stores/vendorStores";
	import { useReviewStore } from "../stores/reviewStore";
	import { Alert } from "../components/composable/Alert";
	import { useTheme } from "../composables/useTheme";
	import { calculateFinalPrice } from "../utils/priceCalculator";

	const vendorStore = useVendorStore();
	const reviewStore = useReviewStore();
	const route = useRoute();
	const router = useRouter();
	const { isDark } = useTheme();

	// Scroll position tracking for keep-alive
	let savedScrollPosition = 0;
	let loadedVendorId = ""; // Track which vendor is currently loaded

	// Component state
	const seller = computed<Seller>(() => vendorStore.vendorData);
	const vendorId = computed(() => String(route.params.id));

	// UI state
	const loading = ref(false);
	const followLoading = ref(false);
	const currentSort = ref("newest");
	const currentCategory = ref("all");
	const isDropdownOpen = ref(false);
	const isCategoryDropdownOpen = ref(false);
	const showShareModal = ref(false);
	const showContactModal = ref(false);
	const showChatModal = ref(false);
	const activeTab = ref<"products" | "reviews" | "about">("products");
	const dropdownRef = ref<HTMLElement>();
	const categoryDropdownRef = ref<HTMLElement>();
	const contactDropdownRef = ref<HTMLElement>();

	// Fallback data
	const fallbackImage =
		"https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg?auto=compress&cs=tinysrgb&w=400";

	const sortOptions = [
		{ value: "newest", label: "Newest First", icon: SparklesIcon },
		{
			value: "price-low",
			label: "Price: Low to High",
			icon: CurrencyDollarIcon,
		},
		{
			value: "price-high",
			label: "Price: High to Low",
			icon: CurrencyDollarIcon,
		},
		{ value: "most-sold", label: "Best Sellers", icon: FireIcon },
		{ value: "rating", label: "Top Rated", icon: StarIcon },
		{ value: "name-az", label: "Name: A-Z", icon: AdjustmentsHorizontalIcon },
	];

	// Get unique categories from products
	const productCategories = computed(() => {
		const categories = new Set<string>();
		vendorStore.vendorProducts.forEach((product) => {
			if (product.category) {
				categories.add(product.category);
			}
		});
		return ["all", ...Array.from(categories)];
	});

	// Computed properties
	const isFollowing = computed(() => vendorStore.isFollows);
	const followersCount = computed(() => vendorStore.followersCount || 0);
	const currentUrl = computed(() =>
		typeof window !== "undefined" ? window.location.href : ""
	);

	// Calculate seller rating from reviews or use fallback
	const calculatedRating = computed(() => {
		if (seller.value?.rating) return seller.value.rating / seller.value.numRatings;
		return 0;

	});

	// Response rate simulation
	const responseRate = computed(() => {
		return seller.value?.responseRate || 95;
	});

	const responseTime = computed(() => {
		return seller.value?.responseTime || "Within 1 hour";
	});

	// Total orders/sales - use accurate data from backend
	const totalSales = computed(() => {
		return seller.value?.totalSales || seller.value?.totalOrders || 0;
	});

	// Total reviews from vendor data
	const totalReviews = computed(() => {
		return seller.value?.totalReviews || seller.value?.numRatings || 0;
	});

	// Approved products count
	const approvedProductsCount = computed(() => {
		return (
			seller.value?.approvedProducts || vendorStore.vendorProducts?.length || 0
		);
	});

	const sortedProducts = computed(() => {
		let products = [...vendorStore.vendorProducts];

		// Filter by category first
		if (currentCategory.value !== "all") {
			products = products.filter((p) => p.category === currentCategory.value);
		}

		// Then sort
		switch (currentSort.value) {
			case "price-low":
				return products.sort(
					(a, b) =>
						calculateFinalPrice(a.price, a.promotion) -
						calculateFinalPrice(b.price, b.promotion)
				);
			case "price-high":
				return products.sort(
					(a, b) =>
						calculateFinalPrice(b.price, b.promotion) -
						calculateFinalPrice(a.price, a.promotion)
				);
			case "name-az":
				return products.sort((a, b) => a.name.localeCompare(b.name));
			case "most-sold":
				return products.sort((a, b) => (b.sold || 0) - (a.sold || 0));
			case "rating":
				return products.sort(
					(a, b) => (b.averageRating || 0) - (a.averageRating || 0)
				);
			case "newest":
			default:
				return products.sort(
					(a, b) =>
						new Date(b.createdAt || "").getTime() -
						new Date(a.createdAt || "").getTime()
				);
		}
	});

	// Computed labels and icons
	const currentSortLabel = computed(() => {
		const option = sortOptions.find((opt) => opt.value === currentSort.value);
		return option?.label || "Sort by";
	});

	const currentSortIcon = computed(() => {
		const option = sortOptions.find((opt) => opt.value === currentSort.value);
		return option?.icon || ChevronDownIcon;
	});

	const currentCategoryLabel = computed(() => {
		if (currentCategory.value === "all") return "All Categories";
		return currentCategory.value;
	});

	// Format join date
	const formattedJoinDate = computed(() => {
		if (!seller.value?.createdAt) return "Recently joined";
		const date = new Date(seller.value.createdAt);
		return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
	});

	// Navigation methods
	const goBack = () => {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push("/products");
		}
	};

	// Tab switching
	const switchTab = (tab: "products" | "reviews" | "about") => {
		activeTab.value = tab;
	};

	// Follow functionality
	const toggleFollow = async () => {
		if (followLoading.value) return;

		followLoading.value = true;
		try {
			await vendorStore.toggleFollow(vendorId.value);
			const message = isFollowing.value
				? `You are now following ${seller.value?.storeName || "this seller"}!`
				: `You unfollowed ${seller.value?.storeName || "this seller"}`;

			Alert(message, "success", "#1f8b4e");
		} catch (error) {
			console.error("Failed to toggle follow:", error);
			Alert(
				"Failed to update follow status. Please try again.",
				"error",
				"#ef4444"
			);
		} finally {
			followLoading.value = false;
		}
	};

	// Message functionality
	const handleMessage = () => {
		if (!seller.value?.storeName) {
			Alert(
				"Unable to start conversation. Please try again later.",
				"error",
				"#ef4444"
			);
			return;
		}

		showChatModal.value = true;
	};

	const closeChatModal = () => {
		showChatModal.value = false;
	};

	const expandChat = () => {
		showChatModal.value = false;
		router.push("/messages");
	};

	// Share functionality
	const handleShare = async () => {
		const shareUrl = window.location.href;
		const shareText = `Check out ${
			seller.value?.storeName || "this amazing seller"
		} on DoroShop!`;

		if (navigator.share) {
			try {
				await navigator.share({
					title: seller.value?.storeName || "DoroShop Seller",
					text: shareText,
					url: shareUrl,
				});
				Alert("Thanks for sharing!", "success", "#1f8b4e");
			} catch (error: any) {
				if (error.name !== "AbortError") {
					copyToClipboard(shareUrl);
				}
			}
		} else {
			copyToClipboard(shareUrl);
		}
	};

	const copyToClipboard = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			Alert("Link copied to clipboard!", "success", "#1f8b4e");
		} catch (error) {
			showShareModal.value = true;
		}
	};

	// Contact methods
	const handleCall = () => {
		const phoneNumber = seller.value?.phone || "+63 912 345 6789";
		window.location.href = `tel:${phoneNumber}`;
		showContactModal.value = false;
		Alert("Calling seller...", "info", "#1f8b4e");
	};

	const handleEmail = () => {
		const email =
			seller.value?.email ||
			`contact@${
				seller.value?.storeName?.toLowerCase().replace(/\s+/g, "") || "seller"
			}.com`;
		window.location.href = `mailto:${email}`;
		showContactModal.value = false;
		Alert("Opening email client...", "info", "#1f8b4e");
	};

	// Sorting functionality
	const toggleDropdown = () => {
		isDropdownOpen.value = !isDropdownOpen.value;
		isCategoryDropdownOpen.value = false;
	};

	const toggleCategoryDropdown = () => {
		isCategoryDropdownOpen.value = !isCategoryDropdownOpen.value;
		isDropdownOpen.value = false;
	};

	const selectSort = (sortOption: string) => {
		if (currentSort.value === sortOption) {
			isDropdownOpen.value = false;
			return;
		}

		loading.value = true;
		currentSort.value = sortOption;
		isDropdownOpen.value = false;

		setTimeout(() => {
			loading.value = false;
			Alert(`Products sorted by ${currentSortLabel.value}`, "info", "#1f8b4e");
		}, 300);
	};

	const selectCategory = (category: string) => {
		if (currentCategory.value === category) {
			isCategoryDropdownOpen.value = false;
			return;
		}

		loading.value = true;
		currentCategory.value = category;
		isCategoryDropdownOpen.value = false;

		setTimeout(() => {
			loading.value = false;
			const label = category === "all" ? "all categories" : category;
			Alert(`Showing ${label}`, "info", "#1f8b4e");
		}, 300);
	};

	// Event handlers
	const handleClickOutside = (event: MouseEvent) => {
		const target = event.target as Node;

		if (dropdownRef.value && !dropdownRef.value.contains(target)) {
			isDropdownOpen.value = false;
		}

		if (
			categoryDropdownRef.value &&
			!categoryDropdownRef.value.contains(target)
		) {
			isCategoryDropdownOpen.value = false;
		}

		if (
			contactDropdownRef.value &&
			!contactDropdownRef.value.contains(target)
		) {
			showContactModal.value = false;
		}
	};

	const handleSellerImageError = (event: Event) => {
		const target = event.target as HTMLImageElement;
		target.src = fallbackImage;
	};

	// Star rating helper
	const getStarType = (index: number, rating: number) => {
		if (index <= Math.floor(rating)) return "full";
		if (index - 0.5 <= rating) return "half";
		return "empty";
	};

	// Format numbers
	const formatNumber = (num: number): string => {
		if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
		if (num >= 1000) return (num / 1000).toFixed(1) + "K";
		return num.toString();
	};

	const closeModals = () => {
		showShareModal.value = false;
		showContactModal.value = false;
	};

	// Load vendor data with in-flight deduplication
	function createDeferred() {
		let resolve: any, reject: any;
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	}

	const pendingVendorLoads = new Map<string, Promise<void>>();

	const loadVendorData = async (id: string) => {
		// Fast path: already loaded and valid
		if (loadedVendorId === id && seller.value?._id === id) {
			return;
		}

		// If a load for this vendor is already in-flight, wait for it
		if (pendingVendorLoads.has(id)) {
			try {
				await pendingVendorLoads.get(id);
			} catch (err) {
				console.error('ViewSeller: previous load failed for', id, err);
				return; // caller can choose to retry later
			}

			return;
		}

		const deferred = createDeferred();
		pendingVendorLoads.set(id, deferred.promise);

		loading.value = true;
		let loadError: any = null;
		try {
			// Clear previous vendor data first
			vendorStore.vendorProducts = [];
			vendorStore.vendorData = {};
			await vendorStore.fetchSellerInfo(id);

			await vendorStore.fetchVendorProducts(id);
			await vendorStore.isFollowing();
			await vendorStore.followerCount();
			loadedVendorId = id;
		} catch (err: any) {
			loadError = err;
			const status = err?.status || err?.response?.status;
			const message = err?.message || 'Failed to load vendor.';
			console.error('Failed to load vendor:', err);

			if (status === 404) {
				router.replace({ name: 'NotFound', query: { source: 'seller', id } });
				return;
			}

			throw err;
		} finally {
			loading.value = false;
			if (loadError) {
				try { deferred.reject(loadError); } catch(e) { /* ignore */ }
				pendingVendorLoads.delete(id);
			} else {
				try { deferred.resolve(); } catch(e) { /* ignore */ }
				pendingVendorLoads.delete(id);
			}
		}
	};

	onMounted(async () => {
		await loadVendorData(vendorId.value);
		document.addEventListener("click", handleClickOutside);
	});

	onUnmounted(() => {
		vendorStore.vendorProducts = [];
		document.removeEventListener("click", handleClickOutside);
	});

	// 🔄 Keep-alive lifecycle hooks
	onActivated(async () => {
		// Check if we need to load a different vendor
		if (vendorId.value !== loadedVendorId) {
			savedScrollPosition = 0; // Reset scroll for new vendor
			await loadVendorData(vendorId.value);
		} else if (savedScrollPosition > 0) {
			// Same vendor, restore scroll position
			setTimeout(() => {
				window.scrollTo(0, savedScrollPosition);
			}, 0);
		}
	});

	onDeactivated(() => {
		// Save scroll position when component is deactivated
		savedScrollPosition = window.scrollY;
	});
</script>

<template>
	<div class="seller-shop-page" :class="{ 'dark-mode': isDark }">
		<!-- Chat Modal -->
		<ChatModal
			:isOpen="showChatModal"
			:vendorId="vendorId"
			:vendorName="seller?.storeName || 'Seller'"
			:vendorImage="seller?.imageUrl"
			@close="closeChatModal"
			@expand="expandChat"
		/>

		<!-- Hero Section with Seller Profile -->
		<div class="hero-section">
			<div class="hero-background">
				<div class="pattern-overlay"></div>
				<div class="gradient-overlay"></div>
			</div>

			<div class="container">
				<!-- Back Button -->
				<button class="back-button" @click="goBack" aria-label="Go back">
					<ArrowLeftIcon class="back-icon" />
					<span>Back</span>
				</button>

				<!-- Profile Card -->
				<div class="profile-card">
					<div class="profile-left">
						<div class="profile-avatar">
							<img
								:src="seller?.imageUrl || fallbackImage"
								:alt="seller?.storeName || 'Store'"
								@error="handleSellerImageError"
								class="avatar-image"
							/>

							<div class="online-indicator" v-if="seller?.isOnline"></div>
						</div>
					</div>

					<div class="profile-center">
						<div class="store-header">
							<div class="profile-avatar-sm">
								<img
									:src="seller?.imageUrl || fallbackImage"
									:alt="seller?.storeName || 'Store'"
									@error="handleSellerImageError"
									class="avatar-image"
								/>
								<div class="online-indicator" v-if="seller?.isOnline"></div>
							</div>
							<div class="store-info-sm">
								<div class="store-name-row">
									<h1 class="store-name">
										{{ seller?.storeName || "DoroShop Store" }}
									</h1>
									<span
										class="verified-text"
										v-if="seller?.isVerified !== false"
									>
										<CheckBadgeSolidIcon class="mini-badge" />
									</span>
								</div>

								<div class="store-meta">
									<div class="meta-item location">
										<MapPinIcon class="meta-icon" />
										<span
											>{{ seller?.address?.city || "Philippines" }}
											{{ seller?.address?.province || "N/A" }}</span
										>
									</div>
									<div class="meta-item join-date">
										<CalendarDaysIcon class="meta-icon" />
										<span>{{ formattedJoinDate }}</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Quick Stats Row -->
						<div class="quick-stats">
							<div class="quick-stat">
								<StarSolidIcon class="stat-icon gold" />
								<span class="stat-value">{{
									calculatedRating.toFixed(1)
								}}</span>
									<span class="stat-label">Ratings</span>
							</div>

							<div class="quick-stat">
								<ShoppingBagIcon class="stat-icon green" />
								<span class="stat-value">{{
									vendorStore.vendorProducts?.length || 0
								}}</span>
								<span class="stat-label">Products</span>
							</div>

							<div class="quick-stat">
								<UserIcon class="stat-icon purple" />
								<span class="stat-value">{{
									formatNumber(followersCount)
								}}</span>
								<span class="stat-label">Followers</span>
							</div>

							<!-- <div class="quick-stat">
								<TruckIcon class="stat-icon blue" />
								<span class="stat-value">{{ formatNumber(totalSales) }}</span>
								<span class="stat-label">Sales</span>
							</div> -->
						</div>

						<!-- Store Description -->
						<p class="store-description" v-if="seller?.description">
							{{ seller.description }}
						</p>
						<p class="store-description" v-else>
							Welcome to our store! We offer quality products with excellent
							customer service.
						</p>
						<div class="action-buttons">
							<button
								class="action-btn follow-btn"
								:class="{ following: isFollowing, loading: followLoading }"
								@click="toggleFollow"
								:disabled="followLoading"
							>
								<div v-if="followLoading" class="loading-spinner"></div>
								<HeartSolidIcon
									v-else-if="isFollowing"
									class="btn-icon filled"
								/>
								<HeartIcon v-else class="btn-icon" />
								<span>{{
									followLoading ? "" : isFollowing ? "Following" : "Follow"
								}}</span>
							</button>

							<button class="action-btn message-btn" @click="handleMessage">
								<ChatBubbleLeftEllipsisIcon class="btn-icon" />
								<span>Message</span>
							</button>

							<button
								class="action-btn share-btn"
								@click="handleShare"
								aria-label="Share"
							>
								<ShareIcon class="btn-icon" />
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Stats Cards Section -->
		<!-- <div class="stats-section">
			<div class="container">
				<div class="stats-grid">
					<div class="stat-card rating-card">
						<div class="stat-card-icon">
							<StarSolidIcon class="icon" />
						</div>
						<div class="stat-card-content">
							<span class="stat-card-number">{{ calculatedRating.toFixed(1) }}</span>
							<span class="stat-card-label">Rating</span>
							<div class="rating-stars">
								<template v-for="n in 5" :key="n">
									<StarSolidIcon 
										class="star" 
										:class="{ 
											filled: getStarType(n, calculatedRating) === 'full',
											half: getStarType(n, calculatedRating) === 'half'
										}" 
									/>
								</template>
							</div>
						</div>
					</div>

					<div class="stat-card products-card">
						<div class="stat-card-icon">
							<ShoppingBagIcon class="icon" />
						</div>
						<div class="stat-card-content">
							<span class="stat-card-number">{{ approvedProductsCount }}</span>
							<span class="stat-card-label">Products</span>
							<span class="stat-card-subtext">Active listings</span>
						</div>
					</div>

					<div class="stat-card followers-card">
						<div class="stat-card-icon">
							<UserIcon class="icon" />
						</div>
						<div class="stat-card-content">
							<span class="stat-card-number">{{ formatNumber(followersCount) }}</span>
							<span class="stat-card-label">Followers</span>
							<span class="stat-card-subtext">{{ isFollowing ? 'Including you!' : 'Join them!' }}</span>
						</div>
					</div>

					<div class="stat-card sales-card">
						<div class="stat-card-icon">
							<TruckIcon class="icon" />
						</div>
						<div class="stat-card-content">
							<span class="stat-card-number">{{ formatNumber(totalSales) }}</span>
							<span class="stat-card-label">Total Sales</span>
							<span class="stat-card-subtext">Successfully completed</span>
						</div>
					</div>
				</div>
			</div>
		</div> -->

		<!-- Tab Navigation -->
		<div class="tab-navigation">
			<div class="container">
				<div class="tabs">
					<button
						class="tab-btn"
						:class="{ active: activeTab === 'products' }"
						@click="switchTab('products')"
					>
						<ShoppingBagIcon class="tab-icon" />
						<span>Products</span>
						<span class="tab-count">{{
							vendorStore.vendorProducts?.length || 0
						}}</span>
					</button>
					<!-- <button
						class="tab-btn"
						:class="{ active: activeTab === 'reviews' }"
						@click="switchTab('reviews')"
					>
						<StarIcon class="tab-icon" />
						<span>Reviews</span>
						<span class="tab-count">{{ totalReviews }}</span>
					</button> -->
					<button
						class="tab-btn"
						:class="{ active: activeTab === 'about' }"
						@click="switchTab('about')"
					>
						<BuildingStorefrontIcon class="tab-icon" />
						<span>About</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Products Tab Content -->
		<div v-if="activeTab === 'products'" class="products-section">
			<div class="container">
				<div class="section-header">
					<div class="section-title">
						<h2>Store Products</h2>
						<p class="section-subtitle">
							Discover {{ sortedProducts.length }} amazing products from this
							seller
						</p>
					</div>

					<!-- Filter & Sort Controls -->
					<!-- <div class="controls-row">

						<div
							class="filter-dropdown"
							ref="categoryDropdownRef"
							v-if="productCategories.length > 2"
						>
							<button
								class="filter-btn"
								@click="toggleCategoryDropdown"
								:class="{
									active: isCategoryDropdownOpen || currentCategory !== 'all',
								}"
							>
								<AdjustmentsHorizontalIcon class="filter-icon" />
								<span>{{ currentCategoryLabel }}</span>
								<ChevronDownIcon
									class="chevron"
									:class="{ rotated: isCategoryDropdownOpen }"
								/>
							</button>

							<transition name="dropdown">
								<div v-if="isCategoryDropdownOpen" class="dropdown-menu">
									<button
										v-for="category in productCategories"
										:key="category"
										class="dropdown-item"
										:class="{ active: currentCategory === category }"
										@click="selectCategory(category)"
									>
										<span>{{
											category === "all" ? "All Categories" : category
										}}</span>
										<CheckIcon
											v-if="currentCategory === category"
											class="check-icon"
										/>
									</button>
								</div>
							</transition>
						</div>
						<div class="sort-dropdown" ref="dropdownRef">
							<button
								class="sort-btn"
								@click="toggleDropdown"
								:class="{ active: isDropdownOpen }"
							>
								<component :is="currentSortIcon" class="sort-icon" />
								<span>{{ currentSortLabel }}</span>
								<ChevronDownIcon
									class="chevron"
									:class="{ rotated: isDropdownOpen }"
								/>
							</button>

							<transition name="dropdown">
								<div v-if="isDropdownOpen" class="dropdown-menu">
									<button
										v-for="option in sortOptions"
										:key="option.value"
										class="dropdown-item"
										:class="{ active: currentSort === option.value }"
										@click="selectSort(option.value)"
									>
										<component :is="option.icon" class="dropdown-icon" />
										<span>{{ option.label }}</span>
										<CheckIcon
											v-if="currentSort === option.value"
											class="check-icon"
										/>
									</button>
								</div>
							</transition>
						</div>

				
						<div class="products-count-badge">
							{{ sortedProducts.length }}
							{{ sortedProducts.length === 1 ? "product" : "products" }}
						</div>
					</div> -->
				</div>

				<!-- Product Grid -->
				<div v-if="loading" class="loading-section">
					<Loading />
					<p class="loading-text">Loading products...</p>
				</div>
				<div v-else-if="sortedProducts.length > 0" class="product-grid">
					<ProductCard typesOfProductList="VendorProducts" />
				</div>
				<div v-else-if="!vendorStore.isLoading" class="empty-state">
					<div class="empty-icon-wrapper">
						<ShoppingBagIcon class="empty-icon" />
					</div>
					<h3>No Products Found</h3>
					<p v-if="currentCategory !== 'all'">
						No products in this category. Try selecting a different category.
					</p>
					<p v-else>
						This seller hasn't added any products yet. Check back later!
					</p>
					<button class="contact-seller-btn" @click="handleMessage">
						<ChatBubbleLeftEllipsisIcon class="btn-icon" />
						Contact Seller
					</button>
				</div>
			</div>
		</div>

		<!-- Reviews Tab Content -->
		<!-- <div v-if="activeTab === 'reviews'" class="reviews-section">
			<div class="container">
				<div class="reviews-header">
					<h2>Customer Reviews</h2>
					<div class="overall-rating">
						<span class="rating-number">{{ calculatedRating.toFixed(1) }}</span>
						<div class="rating-stars">
							<StarSolidIcon
								v-for="n in 5"
								:key="n"
								class="star"
								:class="{ filled: n <= Math.round(calculatedRating) }"
							/>
						</div>
						<span class="review-count"
							>Based on {{ totalReviews }} reviews</span
						>
					</div>
				</div>

				<div class="reviews-placeholder">
					<div class="placeholder-icon">
						<StarIcon class="icon" />
					</div>
					<h3>Reviews Coming Soon</h3>
					<p>Customer reviews will be displayed here once available.</p>
				</div>
			</div>
		</div> -->

		<!-- About Tab Content -->
		<div v-if="activeTab === 'about'" class="about-section">
			<div class="container">
				<div class="about-grid">
					<div class="about-card store-info">
						<h3>
							<BuildingStorefrontIcon class="card-icon" />
							About the Store
						</h3>
						<p class="store-bio">
							{{
								seller?.description ||
								"Welcome to our store! We are committed to providing quality products and excellent customer service. Shop with confidence and enjoy your shopping experience with us."
							}}
						</p>

						<div class="info-items">
							<div class="info-item">
								<MapPinIcon class="info-icon" />
								<div class="info-content">
									<span class="info-label">Location</span>
									<span class="info-value">
										{{ seller?.address?.city || "Philippines" }},
										{{ seller?.address?.province || "Metro Manila" }}
									</span>
								</div>
							</div>
							<div class="info-item">
								<CalendarDaysIcon class="info-icon" />
								<div class="info-content">
									<span class="info-label">Member Since</span>
									<span class="info-value">{{ formattedJoinDate }}</span>
								</div>
							</div>
						</div>
					</div>

					<div class="about-card performance">
						<h3>
							<ChartBarIcon class="card-icon" />
							Seller Performance
						</h3>
						<div class="performance-items">
							<div class="performance-item">
								<div class="performance-header">
									<span class="performance-label">Response Rate</span>
									<span class="performance-value">{{ responseRate }}%</span>
								</div>
								<div class="progress-bar">
									<div
										class="progress-fill"
										:style="{ width: responseRate + '%' }"
									></div>
								</div>
							</div>
							<div class="performance-item">
								<div class="performance-header">
									<span class="performance-label">Order Completion</span>
									<span class="performance-value">98%</span>
								</div>
								<div class="progress-bar">
									<div class="progress-fill" style="width: 98%"></div>
								</div>
							</div>
							<div class="performance-item">
								<div class="performance-header">
									<span class="performance-label">Customer Satisfaction</span>
									<span class="performance-value"
										>{{ Math.round(calculatedRating * 20) }}%</span
									>
								</div>
								<div class="progress-bar">
									<div
										class="progress-fill"
										:style="{ width: calculatedRating * 20 + '%' }"
									></div>
								</div>
							</div>
						</div>
					</div>

					<div class="about-card guarantees">
						<h3>
							<ShieldCheckIcon class="card-icon" />
							Our Guarantees
						</h3>
						<div class="guarantee-items">
							<div class="guarantee-item">
								<ShieldCheckIcon class="guarantee-icon" />
								<span>100% Authentic Products</span>
							</div>
							<div class="guarantee-item">
								<TruckIcon class="guarantee-icon" />
								<span>Fast & Reliable Shipping</span>
							</div>
							<div class="guarantee-item">
								<ClockIcon class="guarantee-icon" />
								<span>Quick Response Time</span>
							</div>
							<div class="guarantee-item">
								<StarIcon class="guarantee-icon" />
								<span>Quality Assurance</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Share Modal -->
		<transition name="modal">
			<div v-if="showShareModal" class="modal-overlay" @click="closeModals">
				<div class="modal-content" @click.stop>
					<div class="modal-header">
						<h3>Share this Seller</h3>
						<button
							@click="closeModals"
							class="close-btn"
							aria-label="Close modal"
						>
							<XMarkIcon class="close-icon" />
						</button>
					</div>
					<div class="modal-body">
						<p>
							Copy this link to share {{ seller?.storeName || "this seller" }}
						</p>
						<div class="link-container">
							<input :value="currentUrl" readonly class="link-input" />
							<button @click="copyToClipboard(currentUrl)" class="copy-btn">
								Copy
							</button>
						</div>
					</div>
				</div>
			</div>
		</transition>
	</div>
</template>

<style scoped>
	.seller-shop-page {
		min-height: 100vh;
		background: var(--bg-primary);
		font-family: "Inter", system-ui, -apple-system, sans-serif;
		transition: background-color 0.3s ease;
	}

	.container {
		max-width: 1280px;
		margin: 0 auto;
		padding: 0 20px;
	}

	/* ============================================
   HERO SECTION
   ============================================ */
	.hero-section {
		position: relative;
		background: linear-gradient(135deg, #1f8b4e 0%, #166534 50%, #15803d 100%);
		padding: 24px 0 48px;
		overflow: hidden;
	}

	.hero-background {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.pattern-overlay {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(
				circle at 20% 80%,
				rgba(255, 102, 0, 0.15) 0%,
				transparent 50%
			),
			radial-gradient(
				circle at 80% 20%,
				rgba(255, 255, 255, 0.1) 0%,
				transparent 40%
			);
	}

	.gradient-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(0, 0, 0, 0.1) 100%
		);
	}

	/* Back Button */
	.back-button {
		position: relative;
		z-index: 5;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 18px;
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		color: white;
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 24px;
		backdrop-filter: blur(10px);
	}

	.back-button:hover {
		background: rgba(255, 255, 255, 0.25);
		transform: translateX(-4px);
	}

	.back-icon {
		width: 18px;
		height: 18px;
	}

	/* ============================================
   PROFILE CARD
   ============================================ */
	.profile-card {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 32px;
		align-items: start;
		color: white;
	}

	/* Profile Avatar */
	.profile-left {
		flex-shrink: 0;
	}

	.profile-avatar {
		position: relative;
		width: 120px;
		height: 120px;
	}

	.avatar-image {
		width: 100%;
		min-width: 70px;
		aspect-ratio: 1;
		border-radius: 24px;
		object-fit: cover;
		border: 4px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
	}

	.verified-badge {
		position: absolute;
		bottom: -4px;
		right: -4px;
		background: white;
		border-radius: 50%;
		padding: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.verified-icon {
		width: 24px;
		height: 24px;
		color: #1f8b4e;
	}

	.online-indicator {
		position: absolute;
		top: 4px;
		right: 4px;
		width: 16px;
		height: 16px;
		background: #22c55e;
		border: 3px solid white;
		border-radius: 50%;
		animation: pulse-online 2s infinite;
	}

	@keyframes pulse-online {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
		}
	}

	/* Profile Center Content */
	.profile-center {
		min-width: 0;
	}

	.store-header {
		margin-bottom: 16px;
	}

	.store-name-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.store-name {
		font-size: clamp(20px, 1vw, 32px);
		font-weight: 800;
		margin: 0;
		line-height: 1.2;
		letter-spacing: -0.5px;
	}

	.verified-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 20px;
		aspect-ratio: 1;

		background: rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
	}

	.mini-badge {
		width: 14px;
		height: 14px;
	}

	.store-meta {
		display: flex;
		flex-direction: column;
		flex-wrap: wrap;
		gap: 16px;
	}

	.meta-item {
		font-size: clamp(10px, 1vw, 14px);
		opacity: 0.9;
		display: flex;
		gap: 5px;
	}

	.meta-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	/* Quick Stats Row */
.quick-stats {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
	padding: 16px 20px;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 16px;
	backdrop-filter: blur(10px);
	margin-bottom: 16px;
	gap: 5px;

}


.quick-stat {
	display: flex;
	align-items: center;
	
	gap: 8px;
	width: 100%;
	position: relative;
}

/* Vertical divider (desktop) */
/* .quick-stat:not(:last-child)::after {
	content: "";
	position: absolute;
	right: -8px;
	top: 10%;
	height: 80%;
	width: 1px;
	background: rgba(255, 255, 255, 0.2);
} */

	.quick-stat .stat-icon {
		width: 18px;
		height: 18px;
	}

	.quick-stat .stat-icon.gold {
		color: #fbbf24;
	}
	.quick-stat .stat-icon.green {
		color: #86efac;
	}
	.quick-stat .stat-icon.purple {
		color: #c4b5fd;
	}
	.quick-stat .stat-icon.blue {
		color: #93c5fd;
	}

	.quick-stat .stat-value {
		font-weight: 700;
		font-size: clamp(10px, 1.3vw, 16px);
	}

	.quick-stat .stat-label {
		font-size: clamp(9px, 1.3vw, 14px);
		opacity: 0.8;
		margin-top: 1px;
	}

	

	.store-description {
		font-size: 15px;
		line-height: 1.6;
		margin: 0;
		opacity: 0.9;
		max-width: 600px;
	}

	.action-buttons {
		display: flex;
		gap: 10px;
		margin-top: 10px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 20px;
		border: none;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn .btn-icon {
		width: 18px;
		height: 18px;
	}

	.follow-btn {
		background: white;
		color: #1f8b4e;
		min-width: 120px;
	}

	.follow-btn:hover {
		background: #f0fdf4;
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
	}

	.follow-btn.following {
		background: rgba(255, 102, 0, 0.1);
		color: #ff6600;
		border: 2px solid #ff6600;
	}

	.follow-btn.following .btn-icon.filled {
		color: #ff6600;
	}

	.follow-btn.following:hover {
		background: rgba(239, 68, 68, 0.1);
		border-color: #ef4444;
		color: #ef4444;
	}

	.message-btn {
		background: rgba(255, 255, 255, 0.15);
		color: white;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.message-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.5);
		transform: translateY(-2px);
	}

	.share-btn {
		background: rgba(255, 255, 255, 0.15);
		color: white;
		border: 2px solid rgba(255, 255, 255, 0.3);
		padding: 12px;
		width: 46px;
	}

	.share-btn:hover {
		background: rgba(255, 255, 255, 0.25);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.loading-spinner {
		width: 18px;
		height: 18px;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Seller Badges */
	.seller-badges {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.badge {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		backdrop-filter: blur(10px);
	}

	.badge-icon {
		width: 20px;
		height: 20px;
		color: #ff6600;
	}

	.badge-content {
		display: flex;
		flex-direction: column;
	}

	.badge-label {
		font-size: 11px;
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.badge-value {
		font-size: 14px;
		font-weight: 600;
	}

	/* ============================================
   STATS SECTION
   ============================================ */
	.stats-section {
		margin-top: -24px;
		position: relative;
		z-index: 3;
		padding-bottom: 32px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}

	.stat-card {
		background: var(--surface);
		border-radius: 20px;
		padding: 24px;
		display: flex;
		align-items: center;
		gap: 16px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
		border: 1px solid var(--border-color);
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.stat-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
	}

	.stat-card-icon {
		width: 56px;
		height: 56px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.stat-card-icon .icon {
		width: 28px;
		height: 28px;
		color: white;
	}

	.rating-card .stat-card-icon {
		background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
	}

	.products-card .stat-card-icon {
		background: linear-gradient(135deg, #1f8b4e 0%, #16a34a 100%);
	}

	.followers-card .stat-card-icon {
		background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
	}

	.sales-card .stat-card-icon {
		background: linear-gradient(135deg, #ff6600 0%, #ea580c 100%);
	}

	.stat-card-content {
		display: flex;
		flex-direction: column;
	}

	.stat-card-number {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.2;
	}

	.stat-card-label {
		font-size: 14px;
		color: var(--text-secondary);
		font-weight: 500;
		margin-top: 2px;
	}

	.stat-card-subtext {
		font-size: 12px;
		color: var(--text-secondary);
		opacity: 0.7;
		margin-top: 4px;
	}

	.rating-stars {
		display: flex;
		gap: 2px;
		margin-top: 6px;
	}

	.rating-stars .star {
		width: 14px;
		height: 14px;
		color: var(--border-color);
	}

	.rating-stars .star.filled {
		color: #fbbf24;
	}

	/* ============================================
   TAB NAVIGATION
   ============================================ */
	.tab-navigation {
		background: var(--surface);
		border-bottom: 1px solid var(--border-color);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.tabs {
		display: flex;
		gap: 8px;
	}

	.tab-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 16px 24px;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		color: var(--text-secondary);
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab-btn:hover {
		color: var(--text-primary);
		background: var(--bg-secondary);
	}

	.tab-btn.active {
		color: #1f8b4e;
		border-bottom-color: #1f8b4e;
	}

	.tab-icon {
		width: 20px;
		height: 20px;
	}

	.tab-count {
		padding: 2px 8px;
		background: var(--bg-secondary);
		border-radius: 12px;
		font-size: 12px;
		font-weight: 700;
	}

	.tab-btn.active .tab-count {
		background: rgba(31, 139, 78, 0.1);
		color: #1f8b4e;
	}

	/* ============================================
   PRODUCTS SECTION
   ============================================ */
	.products-section {
		padding: 40px 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 32px;
		gap: 24px;
		flex-wrap: wrap;
	}

	.section-title h2 {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.section-subtitle {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Controls Row */
	.controls-row {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.filter-dropdown,
	.sort-dropdown {
		position: relative;
	}

	.filter-btn,
	.sort-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: var(--surface);
		border: 2px solid var(--border-color);
		border-radius: 12px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary);
		transition: all 0.2s ease;
		min-width: 160px;
	}

	.filter-icon,
	.sort-icon {
		width: 18px;
		height: 18px;
		color: #1f8b4e;
	}

	.filter-btn:hover,
	.sort-btn:hover {
		border-color: #1f8b4e;
		background: var(--surface-hover);
	}

	.filter-btn.active,
	.sort-btn.active {
		border-color: #1f8b4e;
		background: rgba(31, 139, 78, 0.05);
	}

	.chevron {
		width: 16px;
		height: 16px;
		margin-left: auto;
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		min-width: 200px;
		background: var(--surface);
		border: 2px solid var(--border-color);
		border-radius: 14px;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
		z-index: 100;
		overflow: hidden;
	}

	.dropdown-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: none;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 14px;
		color: var(--text-primary);
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.dropdown-item:hover {
		background: var(--bg-secondary);
		color: #1f8b4e;
	}

	.dropdown-item.active {
		background: #1f8b4e;
		color: white;
	}

	.dropdown-icon {
		width: 18px;
		height: 18px;
	}

	.check-icon {
		width: 18px;
		height: 18px;
		margin-left: auto;
	}

	.products-count-badge {
		padding: 8px 14px;
		background: var(--bg-secondary);
		border-radius: 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	/* Dropdown Transitions */
	.dropdown-enter-active,
	.dropdown-leave-active {
		transition: all 0.2s ease;
	}

	.dropdown-enter-from,
	.dropdown-leave-to {
		opacity: 0;
		transform: translateY(-10px);
	}

	/* Product Grid */
	.product-grid {
		min-height: 400px;
	}

	.loading-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80px 20px;
	}

	.loading-text {
		margin-top: 16px;
		color: var(--text-secondary);
		font-size: 15px;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 80px 20px;
	}

	.empty-icon-wrapper {
		width: 100px;
		height: 100px;
		margin: 0 auto 24px;
		background: linear-gradient(
			135deg,
			rgba(31, 139, 78, 0.1) 0%,
			rgba(255, 102, 0, 0.1) 100%
		);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		color: #1f8b4e;
	}

	.empty-state h3 {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 12px 0;
	}

	.empty-state p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0 0 24px 0;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	.contact-seller-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 14px 28px;
		background: #1f8b4e;
		color: white;
		border: none;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.contact-seller-btn:hover {
		background: #166534;
		transform: translateY(-2px);
		box-shadow: 0 8px 20px rgba(31, 139, 78, 0.3);
	}

	.contact-seller-btn .btn-icon {
		width: 20px;
		height: 20px;
	}

	/* ============================================
   REVIEWS SECTION
   ============================================ */
	.reviews-section {
		padding: 40px 0;
	}

	.reviews-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 32px;
		flex-wrap: wrap;
		gap: 20px;
	}

	.reviews-header h2 {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}

	.overall-rating {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 24px;
		background: var(--surface);
		border-radius: 16px;
		border: 1px solid var(--border-color);
	}

	.rating-number {
		font-size: 36px;
		font-weight: 800;
		color: var(--text-primary);
	}

	.review-count {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.reviews-placeholder {
		text-align: center;
		padding: 80px 20px;
		background: var(--surface);
		border-radius: 20px;
		border: 2px dashed var(--border-color);
	}

	.placeholder-icon {
		width: 80px;
		height: 80px;
		margin: 0 auto 24px;
		background: var(--bg-secondary);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.placeholder-icon .icon {
		width: 40px;
		height: 40px;
		color: var(--text-secondary);
	}

	.reviews-placeholder h3 {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 12px 0;
	}

	.reviews-placeholder p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	/* ============================================
   ABOUT SECTION
   ============================================ */
	.about-section {
		padding: 40px 0;
	}

	.about-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 24px;
	}

	.about-card {
		background: var(--surface);
		border-radius: 20px;
		padding: 28px;
		border: 1px solid var(--border-color);
	}

	.about-card h3 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 20px 0;
	}

	.card-icon {
		width: 24px;
		height: 24px;
		color: #1f8b4e;
	}

	.store-bio {
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
		margin: 0 0 24px 0;
	}

	.info-items {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.info-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.info-icon {
		width: 20px;
		height: 20px;
		color: #1f8b4e;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.info-content {
		display: flex;
		flex-direction: column;
	}

	.info-label {
		font-size: 12px;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 2px;
	}

	.info-value {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-primary);
	}

	/* Performance Items */
	.performance-items {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.performance-item {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.performance-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.performance-label {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.performance-value {
		font-size: 16px;
		font-weight: 700;
		color: #1f8b4e;
	}

	.progress-bar {
		height: 8px;
		background: var(--bg-secondary);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #1f8b4e 0%, #16a34a 100%);
		border-radius: 4px;
		transition: width 0.5s ease;
	}

	/* Guarantee Items */
	.guarantee-items {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.guarantee-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		background: var(--bg-secondary);
		border-radius: 12px;
	}

	.guarantee-icon {
		width: 20px;
		height: 20px;
		color: #1f8b4e;
		flex-shrink: 0;
	}

	.guarantee-item span {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-primary);
	}

	/* ============================================
   MODAL STYLES
   ============================================ */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--surface);
		border-radius: 20px;
		width: 100%;
		max-width: 450px;
		overflow: hidden;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	.close-btn {
		padding: 8px;
		background: var(--bg-secondary);
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-btn:hover {
		background: var(--bg-tertiary);
	}

	.close-icon {
		width: 20px;
		height: 20px;
		color: var(--text-secondary);
	}

	.modal-body {
		padding: 24px;
	}

	.modal-body p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0 0 16px 0;
	}

	.link-container {
		display: flex;
		gap: 8px;
	}

	.link-input {
		flex: 1;
		padding: 12px 16px;
		border: 2px solid var(--border-color);
		border-radius: 10px;
		font-size: 14px;
		color: var(--text-primary);
		background: var(--bg-secondary);
	}

	.copy-btn {
		padding: 12px 20px;
		background: #1f8b4e;
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.copy-btn:hover {
		background: #166534;
	}

	/* Modal Transitions */
	.modal-enter-active,
	.modal-leave-active {
		transition: all 0.3s ease;
	}

	.modal-enter-from,
	.modal-leave-to {
		opacity: 0;
	}

	.modal-enter-from .modal-content,
	.modal-leave-to .modal-content {
		transform: scale(0.9);
	}

	.profile-avatar-sm {
		display: none;
	}

	/* ============================================
   RESPONSIVE DESIGN
   ============================================ */
	@media (max-width: 1024px) {
		.profile-card {
			grid-template-columns: auto 1fr;
		}

		.seller-badges {
			flex-direction: row;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
	}

	@media (max-width: 480px) {
		.container {
			padding: 0 16px;
		}

		.back-button {
			font-size: 10px;
			padding: 5px 7px;
			gap: 2px;
			border-radius: 7px;
			margin-bottom: 12px;
		}

		.back-icon {
			height: 12px;
			aspect-ratio: 1;
		}

		.hero-section {
			padding: 16px 0 40px;
		}

		.profile-card {
			grid-template-columns: 1fr;
			text-align: center;
			gap: 0px;
		}

		.profile-left {
			margin: 0 auto;
		}

		.profile-avatar {
			width: 100px;
			height: 100px;
		}
		.store-name-row {
			justify-content: center;
		}

		.quick-stats {
			justify-content: space-around;
			gap: 0px;
		}

		.avatar-image {
			width: 70px;
			height: 70px;
		}

		.meta-icon {
			width: 12px;
			height: 12px;
		}

		.store-header {
			display: flex;
			gap: 10px;
		}

		.store-info-sm {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
		}

		.store-name-row,
		.store-meta {
			display: flex;
			justify-content: flex-start;
			gap: 5px;
		}

		/* .verified-text{
			display: none;
		} */

		.quick-stat {
			gap: 3px;
		}

		.profile-avatar-sm {
			display: flex;
		}

		.profile-left {
			display: none;
		}


		.quick-stat .review {
		display: none;
		}

		.quick-stat .stat-icon {
			width: 12px;
			aspect-ratio: 1;
		}

		.stat-divider {
			display: none;
		}

		.store-description {
			margin-left: auto;
			margin-right: auto;
		}

		.action-buttons {
			width: 100%;
			justify-content: center;
		}

		.seller-badges {
			flex-direction: column;
			width: 100%;
		}

		.badge {
			justify-content: center;
		}

		.stats-grid {
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}

		.stat-card {
			padding: 16px;
			flex-direction: column;
			text-align: center;
		}

		.stat-card-icon {
			width: 48px;
			height: 48px;
		}

		.stat-card-icon .icon {
			width: 24px;
			height: 24px;
		}

		.stat-card-number {
			font-size: 24px;
		}

		.tabs {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
		}

		.tabs::-webkit-scrollbar {
			display: none;
		}

		.tab-btn {
			padding: 14px 16px;
			white-space: nowrap;
		}

		.tab-btn span {
			display: none;
		}

		.tab-count {
			display: none;
		}

		.section-header {
			flex-direction: column;
			align-items: stretch;
		}

		.section-title {
			text-align: center;
		}

		.section-title h2 {
			font-size: 24px;
		}

		.controls-row {
			justify-content: center;
		}

		.filter-btn,
		.sort-btn {
			min-width: auto;
			flex: 1;
		}

		.about-grid {
			grid-template-columns: 1fr;
		}

		.guarantee-items {
			grid-template-columns: 1fr;
		}
	}

	/* ============================================
   ACCESSIBILITY & PREFERENCES
   ============================================ */
	.back-button:focus-visible,
	.action-btn:focus-visible,
	.tab-btn:focus-visible,
	.filter-btn:focus-visible,
	.sort-btn:focus-visible {
		outline: 3px solid #1f8b4e;
		outline-offset: 2px;
	}

	@media (prefers-contrast: high) {
		.stat-card,
		.about-card {
			border-width: 2px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			animation-duration: 0.01ms !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
