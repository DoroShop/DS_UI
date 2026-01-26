<script setup lang="ts">
import {
	ShoppingCartIcon,
	CubeIcon,
	StarIcon,
	EyeIcon,
	PencilSquareIcon,
	TrashIcon,
	XMarkIcon,
	PlusIcon,
	TagIcon,
	SparklesIcon,
	ClockIcon,
} from "@heroicons/vue/24/outline";
import { useRouter } from "vue-router";
import AddProduct from "../AddProduct.vue";
import { useVendorDashboardStore } from "../../../stores/vendor/dashboardStores";

const router = useRouter();
import { computed, reactive, ref, onMounted } from "vue";
import { formatToPHCurrency } from "../../../utils/currencyFormat";
import ImageCropper from "../ImageCropper.vue";
import { confirmAndDeleteVariant } from "../../composable/Alert";
import VendorProductCard from "../VendorProductCard.vue";
import VendorProductView from "../VendorProductView.vue";
import axios from "axios";
import { refreshCartPricing } from "../../../utils/cartSync.js";
import {
	CheckCircleIcon,
	ClockIcon as ClockSolidIcon,
	ExclamationCircleIcon,
} from "@heroicons/vue/24/solid";

const products = computed(() => useVendorDashboardStore().vendorProducts);
const getStore = () => useVendorDashboardStore();

// Tab management
const activeTab = ref('products');

// Product status filter
const productStatusFilter = ref<'all' | 'approved' | 'pending_review' | 'rejected'>('all');

// Promotion state
const promotionProducts = ref([]);
const loadingPromotions = ref(false);
const selectedPromotion = ref(null);
const showPromotionModal = ref(false);
const showEndPromotionModal = ref(false);
const isEndingPromotion = ref(false);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// setTimeout(() => {
//   console.table(products.value[0].imageUrls)
// }, 100)
const isAddProducts = ref(false);
const showModal = ref(false);
const selectedProduct = ref<any>(null);
const showCropper = ref(false);
const cropTargetIndex = ref<number | null>(null);
const cropImageSrc = ref("");

const fixedCategories = [
	"Native Delicacies",
	"Dried Fish & Seafood",
	"Fruits & Produce",
	"Local Snacks",
	"Herbal & Wellness Products",
	"Coffee & Cacao",
	"Honey Products",
	"Handicrafts",
	"Woodcrafts",
	"Woven Products",
	"Souvenir Items",
	"Condiments & Spices",
	"Apparel & Accessories",
];

const isLoading = ref(false);
const isSaving = ref(false);

const form = reactive({
	name: "",
	description: "",
	stock: 0,
	price: 0,
	categories: [] as string[],
	images: [] as string[],
	label: "",
});

const openEdit = (item: any) => {
	selectedProduct.value = item;
	form.name = item.name;
	form.description = item.description;
	form.stock = item.stock;
	form.price = item.price;
	form.categories = Array.isArray(item.categories) ? [...item.categories] : [];
	form.images = Array.isArray(item.imgurl) ? [...item.imgurl] : [item.imgurl];
	form.label = item.label || "";
	showModal.value = true;
};

const closeModal = () => {
	showModal.value = false;
	selectedProduct.value = null;
	resetForm();
};

const isAddingProducts = () => {
	isAddProducts.value = !isAddProducts.value;
};

const resetForm = () => {
	form.name = "";
	form.description = "";
	form.stock = 0;
	form.price = 0;
	form.categories = [];
	form.images = [];
	form.label = "";
};

const handleImageError = (event: Event) => {
	const target = event.target as HTMLImageElement;
	target.src =
		"https://images.pexels.com/photos/1638276/pexels-photo-1638276.jpeg?auto=compress&cs=tinysrgb&w=500";
};

const viewProducts = (productId: string) => {
	router.push(`/product/${productId}`);
};

const deleteProduct = async (productId: string, variantId: string) => {
	const isWantToDelete = await confirmAndDeleteVariant();
	if (isWantToDelete.isConfirmed) {
		try {
			await getStore().deleteProduct(productId, variantId);
		} catch (error) {
			alert(error);
		}
	}
};

const handleFileUpload = async (e: Event) => {
	const input = e.target as HTMLInputElement;
	const files = input.files;
	if (!files || files.length === 0) return;
	isLoading.value = true;
	const isOption = selectedProduct.value.productId !== selectedProduct.value.variantId;

	const formData = new FormData();
	Array.from(files).forEach((file) => {
		formData.append("images", file);
	});

	const endpoint = "http://192.168.1.9:3001/v1/upload";

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			throw new Error(`Upload failed with status ${response.status}`);
		}

		const data = await response.json();

		if (Array.isArray(data.images)) {
			if (isOption) {
				form.images = [data.images[0].url];
				console.log("Option image uploaded:", data.images[0].url);
			} else {
				data.images.forEach((img) => form.images.push(img.url));
			}
		} else {
			throw new Error("Unexpected response format from server");
		}

		isLoading.value = false;
	} catch (error) {
		console.error("Image upload failed:", error);
		alert("Image upload failed. Please try again.");
		isLoading.value = false;
	}

	input.value = ""; // clear input
};

const removeImage = (index: number) => {
	form.images.splice(index, 1);
};

const toggleCategory = (category: string) => {
	const index = form.categories.indexOf(category);

	if (index !== -1) {
		form.categories.splice(index, 1);
	} else {
		if (form.categories.length >= 4) return;
		form.categories.push(category);
	}
};

const openCropper = (index: number) => {
	cropImageSrc.value = form.images[index];
	cropTargetIndex.value = index;
	showCropper.value = true;
};

const applyCroppedImage = (croppedImage: string) => {
	if (cropTargetIndex.value !== null) {
		form.images[cropTargetIndex.value] = croppedImage;
	}
	closeCropper();
};

const closeCropper = () => {
	showCropper.value = false;
	cropTargetIndex.value = null;
	cropImageSrc.value = "";
};

// const saveProduct = async () => {
//   if (!selectedProduct.value) return
//   isSaving.value = true
//   const productId = selectedProduct.value.productId

//   if (selectedProduct.value.productId === selectedProduct.value.variantId) {
//     const updatedNotOptionedProduct = {
//       name: form.name,
//       description: form.description,
//       stock: form.stock,
//       price: form.price,
//       categories: form.categories,
//       imageUrls: form.images,
//     }
//     // await vendorDashboard.updateNotOptionedProduct(productId, updatedNotOptionedProduct)

//   } else if (selectedProduct.value.productId !== selectedProduct.value.variantId) {
//     const updatedOptionedProduct = {
//       label: form.label || "N/A",
//       stock: form.stock,
//       price: form.price,
//       imageUrl: form.images[0]
//     }

//     const updatedNotOptionedProduct = {
//       name: form.name,
//       description: form.description,
//       categories: form.categories,
//     }

//     await vendorDashboard.updateOptionedProduct(productId, selectedProduct.value.variantId, updatedOptionedProduct);
//     await vendorDashboard.updateNotOptionedProduct(productId, updatedNotOptionedProduct)
//   }

//   isSaving.value = false

//   closeModal()
// }

// const products = ref([
//   {
//     _id: '1',
//     vendorId: 'vendor1',
//     name: 'Premium Coffee Beans',
//     description: 'High-quality arabica coffee beans from local farms',
//     price: 25.99,
//     stock: 50,
//     sold: 125,
//     option: [
//       {
//         _id: 'opt1',
//         imageUrl: 'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=300',
//         price: 25.99,
//         label: '250g Bag',
//         isHot: true,
//         stock: 30,
//         sold: 85
//       },
//       {
//         _id: 'opt2',
//         price: 45.99,
//         label: '500g Bag',
//         isHot: false,
//         stock: 20,
//         sold: 40
//       }
//     ],
//     categories: ['beverages', 'coffee'],
//     isOption: false,
//     imageUrls: ['https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=400'],
//     isNew: true,
//     isHot: true,
//     isApproved: true,
//     reviews: [],
//     averageRating: 4.5,
//     numReviews: 89,
//     createdAt: new Date('2024-01-15'),
//     municipality: 'San Francisco'
//   },
//   {
//     _id: '2',
//     vendorId: 'vendor1',
//     name: 'Organic Honey',
//     description: 'Pure organic honey from local beekeepers',
//     price: 18.50,
//     stock: 30,
//     sold: 67,
//     option: [],
//     categories: ['food', 'organic'],
//     isOption: false,
//     imageUrls: ['https://images.pexels.com/photos/1638731/pexels-photo-1638731.jpeg?auto=compress&cs=tinysrgb&w=400'],
//     isNew: false,
//     isHot: false,
//     isApproved: true,
//     reviews: [],
//     averageRating: 4.8,
//     numReviews: 42,
//     createdAt: new Date('2024-02-01'),
//     municipality: 'San Francisco'
//   },
//   {
//     _id: '3',
//     vendorId: 'vendor1',
//     name: 'Handcrafted Soap Set',
//     description: 'Natural handmade soaps with essential oils',
//     price: 32.00,
//     stock: 25,
//     sold: 34,
//     option: [
//       {
//         _id: 'opt3',
//         price: 12.00,
//         label: 'Lavender',
//         isHot: false,
//         stock: 15,
//         sold: 20
//       },
//       {
//         _id: 'opt4',
//         price: 12.00,
//         label: 'Tea Tree',
//         isHot: true,
//         stock: 10,
//         sold: 14
//       }
//     ],
//     categories: ['beauty', 'handmade'],
//     isOption: false,
//     imageUrls: ['https://images.pexels.com/photos/4465831/pexels-photo-4465831.jpeg?auto=compress&cs=tinysrgb&w=400'],
//     isNew: true,
//     isHot: false,
//     isApproved: true,
//     reviews: [],
//     averageRating: 4.2,
//     numReviews: 18,
//     createdAt: new Date('2024-01-28'),
//     municipality: 'San Francisco'
//   }
// ])

const openModal = (product) => {
	selectedProduct.value = product;
};
const addOption = (productId, newOption) => {
	const product = products.value.find((p) => p._id === productId);
	if (product) {
		const option = {
			...newOption,
			_id: Date.now().toString(),
		};
		product.option.push(option);

		// Update selected product if it's the same
		if (selectedProduct.value && selectedProduct.value._id === productId) {
			selectedProduct.value = { ...product };
		}
	}
};

// Tab switching
const switchTab = (tab: string) => {
	activeTab.value = tab;
	if (tab === 'promotions') {
		console.log('Switching to promotions tab, fetching promotions...');
		fetchPromotions();
	}
};

// Promotion management functions
const fetchPromotions = async () => {
	// Use userId instead of _id for vendor identification
	const vendorId = getStore().vendor?.userId || getStore().vendor?._id;
	if (!vendorId) {
		console.log('No vendor ID available for fetching promotions');
		console.log('Vendor data:', getStore().vendor);
		return;
	}
	
	loadingPromotions.value = true;
	try {
		console.log('Fetching promotions for vendor:', vendorId);
		const response = await axios.get(
			`${API_BASE_URL}/products/vendor/${vendorId}/promotions`
		);
		console.log('Promotions API response:', response.data);
		promotionProducts.value = response.data.promotions || [];
		console.log('Promotion products set to:', promotionProducts.value);
	} catch (error) {
		console.error('Failed to fetch promotions:', error);
		if (error.response) {
			console.error('Error response:', error.response.data);
			console.error('Error status:', error.response.status);
		}
		promotionProducts.value = [];
	} finally {
		loadingPromotions.value = false;
	}
};

const viewPromotionDetails = (promotion: any) => {
	selectedPromotion.value = promotion;
	showPromotionModal.value = true;
};

const confirmEndPromotion = (promotion: any) => {
	selectedPromotion.value = promotion;
	showEndPromotionModal.value = true;
};

// Helper function to check if promotion has actual discount (not just free shipping)
const hasActualDiscount = (promotion: any) => {
	const { discountType, discountValue } = promotion.promotion;
	return discountType && discountType !== 'none' && discountValue > 0;
};

const endPromotion = async () => {
	if (!selectedPromotion.value || isEndingPromotion.value) return;
	
	isEndingPromotion.value = true;
	try {
		const promotion = selectedPromotion.value;
		const endpoint = promotion.type === 'product' 
			? `${API_BASE_URL}/products/${promotion.productId}/promotion`
			: `${API_BASE_URL}/products/${promotion.productId}/option/${promotion.optionId}/promotion`;
		
		await axios.delete(endpoint);
		
		console.log(`✅ Promotion deletion API call completed for ${promotion.type} ${promotion.productId}`);
		
		// Refresh promotion list
		await fetchPromotions();
		console.log('✅ Promotions list refreshed');
		
		// Refresh products to update indicators  
		await getStore().fetchVendor();
		console.log('✅ Vendor dashboard refreshed');
		
		// Small delay to ensure backend cache invalidation is complete
		await new Promise(resolve => setTimeout(resolve, 500));
		
		// Notify cart store to refresh pricing for this product
		// This ensures any items in buyer carts get updated pricing
		await refreshCartPricing();
		console.log('✅ Cart pricing refreshed');
		
		console.log(`🎉 Promotion ended successfully for ${promotion.type} ${promotion.productId}`);
		
		showEndPromotionModal.value = false;
		selectedPromotion.value = null;
	} catch (error) {
		console.error('Failed to end promotion:', error);
		alert('Failed to end promotion. Please try again.');
	} finally {
		isEndingPromotion.value = false;
	}
};

const closePromotionModal = () => {
	showPromotionModal.value = false;
	selectedPromotion.value = null;
};

const closeEndPromotionModal = () => {
	showEndPromotionModal.value = false;
	selectedPromotion.value = null;
};

// Manual refresh for debugging
const refreshPromotions = async () => {
	console.log('Manual promotion refresh triggered');
	console.log('Current vendor data:', getStore().vendor);
	console.log('Vendor userId:', getStore().vendor?.userId);
	console.log('Vendor _id:', getStore().vendor?._id);
	console.log('API Base URL:', API_BASE_URL);
	await fetchPromotions();
};

// Computed properties for promotion stats
const promotionStats = computed(() => {
	console.log('Computing promotion stats for:', promotionProducts.value);
	const stats = {
		total: promotionProducts.value.length,
		active: promotionProducts.value.filter(p => {
			const isActive = p.status === 'active';
			console.log(`Promotion ${p.productName} (${p.type}): status = ${p.status}, isActive = ${isActive}`);
			return isActive;
		}).length,
		scheduled: promotionProducts.value.filter(p => p.status === 'scheduled').length,
		productPromotions: promotionProducts.value.filter(p => p.type === 'product').length,
		variantPromotions: promotionProducts.value.filter(p => p.type === 'option').length
	};
	console.log('Promotion stats computed:', stats);
	return stats;
});

const filteredProducts = computed(() => {
	// Filter by status first
	let filtered = products.value;
	if (productStatusFilter.value !== 'all') {
		filtered = filtered.filter(p => p.status === productStatusFilter.value);
	}
	
	// Add promotion indicators to products
	return filtered.map(product => {
		const hasProductPromotion = promotionProducts.value.some(
			p => p.productId === product._id && p.type === 'product' && p.status === 'active'
		);
		const hasVariantPromotions = promotionProducts.value.some(
			p => p.productId === product._id && p.type === 'option' && p.status === 'active'
		);
		
		return {
			...product,
			hasPromotion: hasProductPromotion,
			hasVariantPromotions,
			promotionStatus: hasProductPromotion ? 'active' : 'inactive'
		};
	});
});

// Product counts by status
const productCounts = computed(() => ({
	all: products.value.length,
	approved: products.value.filter(p => p.status === 'approved').length,
	pending_review: products.value.filter(p => p.status === 'pending_review').length,
	rejected: products.value.filter(p => p.status === 'rejected').length,
}));

// Handle promotion updates from VendorProductView
const handlePromotionUpdated = async () => {
	console.log('Promotion updated, refreshing data...');
	try {
		// Refresh vendor data first to get updated products
		await getStore().fetchVendor();
		console.log('Vendor data refreshed');
		
		// Then fetch updated promotions
		await fetchPromotions();
		console.log('Promotions refreshed after update');
	} catch (error) {
		console.error('Error refreshing promotion data:', error);
	}
};

// Initialize promotions on mount
onMounted(async () => {
	console.log('Component mounted, checking vendor data...');
	
	// If vendor is not loaded yet, fetch it first
	if (!getStore().vendor) {
		console.log('No vendor data, fetching vendor first...');
		try {
			await getStore().fetchVendor();
		} catch (error) {
			console.error('Failed to fetch vendor on mount:', error);
			return;
		}
	}
	
	const vendorId = getStore().vendor?.userId || getStore().vendor?._id;
	if (vendorId) {
		console.log('Vendor loaded, fetching promotions on mount...');
		console.log('Using vendor ID:', vendorId);
		await fetchPromotions();
	} else {
		console.warn('No vendor ID available after fetch');
		console.log('Vendor data:', getStore().vendor);
	}
});
</script>

<template>
	<section>
		<div class="container">
			<!-- Header Section -->
			<div class="page-header">
				<div class="header-content">
					<h1 class="page-title">
						<CubeIcon class="title-icon" />
						Product Management
					</h1>
					<p class="page-subtitle">Manage your products, inventory, and promotions</p>
				</div>

				<!-- Navigation Tabs -->
				<div class="tab-navigation">
					<button 
						:class="['tab-btn', { active: activeTab === 'products' }]"
						@click="switchTab('products')"
					>
						<CubeIcon class="tab-icon" />
						Products
						<span class="tab-count">{{ filteredProducts.length }}</span>
					</button>
					<button 
						:class="['tab-btn', { active: activeTab === 'promotions' }]"
						@click="switchTab('promotions')"
					>
						<TagIcon class="tab-icon" />
						Promotions
						<span class="tab-count">{{ promotionStats.active }}</span>
					</button>
				</div>

				<!-- Dynamic Stats based on active tab -->
				<div v-if="activeTab === 'products'" class="header-stats">
					<div class="stat-card">
						<span class="stat-label">Total Products</span>
						<span class="stat-value">{{ filteredProducts.length }}</span>
					</div>
					<div class="stat-card">
						<span class="stat-label">In Stock</span>
						<span class="stat-value">{{ filteredProducts.filter(p => p.stock > 0).length }}</span>
					</div>
					<div class="stat-card promoted">
						<span class="stat-label">With Promotions</span>
						<span class="stat-value">{{ filteredProducts.filter(p => p.hasPromotion || p.hasVariantPromotions).length }}</span>
					</div>
				</div>

				<div v-else-if="activeTab === 'promotions'" class="header-stats">
					<div class="stat-card active">
						<span class="stat-label">Active Promotions</span>
						<span class="stat-value">{{ promotionStats.active }}</span>
					</div>
					<div class="stat-card scheduled">
						<span class="stat-label">Scheduled</span>
						<span class="stat-value">{{ promotionStats.scheduled }}</span>
					</div>
					<div class="stat-card product">
						<span class="stat-label">Product Sales</span>
						<span class="stat-value">{{ promotionStats.productPromotions }}</span>
					</div>
					<div class="stat-card variant">
						<span class="stat-label">Variant Sales</span>
						<span class="stat-value">{{ promotionStats.variantPromotions }}</span>
					</div>
				</div>
			</div>

			<!-- Products Tab Content -->
			<div v-if="activeTab === 'products'" class="tab-content">
				<!-- Product Status Filter -->
				<div class="status-filter-tabs">
					<button 
						:class="['status-filter-btn', { active: productStatusFilter === 'all' }]"
						@click="productStatusFilter = 'all'"
					>
						<CubeIcon class="filter-icon" />
						All Products
						<span class="filter-count">{{ productCounts.all }}</span>
					</button>
					<button 
						:class="['status-filter-btn approved', { active: productStatusFilter === 'approved' }]"
						@click="productStatusFilter = 'approved'"
					>
						<CheckCircleIcon class="filter-icon" />
						Approved
						<span class="filter-count">{{ productCounts.approved }}</span>
					</button>
					<button 
						:class="['status-filter-btn pending', { active: productStatusFilter === 'pending_review' }]"
						@click="productStatusFilter = 'pending_review'"
					>
						<ClockSolidIcon class="filter-icon" />
						Pending Review
						<span class="filter-count">{{ productCounts.pending_review }}</span>
					</button>
					<button 
						:class="['status-filter-btn rejected', { active: productStatusFilter === 'rejected' }]"
						@click="productStatusFilter = 'rejected'"
					>
						<ExclamationCircleIcon class="filter-icon" />
						Rejected
						<span class="filter-count">{{ productCounts.rejected }}</span>
					</button>
				</div>

				<div class="products-grid">
					<VendorProductCard 
						v-for="product in filteredProducts" 
						:key="product?._id" 
						:product="product"
						@view-product="openModal" 
					/>
				</div>
				
				<!-- Empty State -->
				<div v-if="filteredProducts.length === 0" class="empty-state">
					<CubeIcon class="empty-icon" />
					<h3>No products yet</h3>
					<p>Start building your catalog by adding your first product</p>
					<button class="btn-primary" @click="isAddingProducts">
						<PlusIcon class="icon-sm" />
						Add Your First Product
					</button>
				</div>
			</div>

			<!-- Promotions Tab Content -->
			<div v-else-if="activeTab === 'promotions'" class="tab-content">
				<!-- Debug refresh button (temporary for testing) -->
				<div class="promotion-controls" style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center;">
					<button @click="refreshPromotions" class="btn-secondary btn-sm">
						🔄 Refresh Promotions
					</button>
					<span v-if="loadingPromotions" style="color: #64748b; font-size: 0.9rem;">Loading...</span>
					<span v-else style="color: #64748b; font-size: 0.9rem;">
						Found {{ promotionProducts.length }} total promotions 
						({{ promotionStats.active }} active, {{ promotionStats.scheduled }} scheduled)
					</span>
				</div>

				<div v-if="loadingPromotions" class="loading-state">
					<div class="loading-spinner"></div>
					<p>Loading promotions...</p>
				</div>

				<div v-else-if="promotionProducts.length > 0" class="promotions-grid">
					<div 
						v-for="promotion in promotionProducts" 
						:key="`${promotion.productId}-${promotion.optionId || 'main'}`"
						class="promotion-card"
					>
						<!-- Card Header -->
						<div class="card-header">
							<div class="product-info">
								<h3 class="product-name">{{ promotion.productName }}</h3>
								<p v-if="promotion.optionLabel" class="variant-name">{{ promotion.optionLabel }}</p>
							</div>
							<div class="status-info">
								<span :class="['status-badge', promotion.status]">
									{{ promotion.status === 'active' ? 'Live' : 'Scheduled' }}
								</span>
							</div>
						</div>

						<!-- Discount Display -->
						<div v-if="hasActualDiscount(promotion)" class="discount-section">
							<div class="discount-amount">
								{{ promotion.promotion.discountType === 'percentage' 
									? `${promotion.promotion.discountValue}% OFF`
									: `$${promotion.promotion.discountValue} OFF`
								}}
							</div>
						</div>

						<!-- Free Shipping Badge for shipping-only promotions -->
						<div v-if="!hasActualDiscount(promotion) && promotion.promotion.freeShipping" class="shipping-only-badge">
							<span class="shipping-badge">
								✓ Free Shipping
							</span>
						</div>

						<!-- Price Information -->
						<div v-if="hasActualDiscount(promotion)" class="price-section">
							<div class="price-row">
								<span class="price-label">Regular</span>
								<span class="price-regular">${{ promotion.originalPrice.toFixed(2) }}</span>
							</div>
							<div class="price-row">
								<span class="price-label">Sale Price</span>
								<span class="price-sale">${{ promotion.discountedPrice.toFixed(2) }}</span>
							</div>
							<div class="savings-row">
								<span class="savings-text">
									Saves ${{ (promotion.originalPrice - promotion.discountedPrice).toFixed(2) }}
								</span>
							</div>
						</div>

						<!-- Additional Info -->
						<div v-if="promotion.promotion.startDate || promotion.promotion.endDate || promotion.promotion.freeShipping" class="info-section">
							<div v-if="promotion.promotion.startDate" class="info-item">
								<span class="info-label">Starts:</span>
								<span class="info-value">{{ new Date(promotion.promotion.startDate).toLocaleDateString() }}</span>
							</div>
							<div v-if="promotion.promotion.endDate" class="info-item">
								<span class="info-label">Ends:</span>
								<span class="info-value">{{ new Date(promotion.promotion.endDate).toLocaleDateString() }}</span>
							</div>
							<div v-if="promotion.promotion.freeShipping" class="info-item">
								<span class="info-value">✓ Free Shipping</span>
							</div>
							<!-- Show promotion status for debugging -->
							<div class="info-item debug-info" style="font-size: 0.7rem; opacity: 0.7;">
								<span class="info-label">Status:</span>
								<span class="info-value">
									{{ promotion.status }} 
									{{ promotion.promotion.isActive ? '(Active)' : '(Inactive)' }}
								</span>
							</div>
						</div>

						<!-- Actions -->
						<div class="card-actions">
							<button 
								@click="viewPromotionDetails(promotion)" 
								class="btn-outline"
							>
								View Details
							</button>
							<button 
								@click="confirmEndPromotion(promotion)"
								class="btn-text"
								:disabled="promotion.status !== 'active'"
							>
								End Sale
							</button>
						</div>
					</div>
				</div>

				<!-- Promotions Empty State -->
				<div v-else class="empty-state">
					<TagIcon class="empty-icon" />
					<h3>No active promotions</h3>
					<p>Create promotions to boost your sales and attract more customers</p>
					<button class="btn-primary" @click="switchTab('products')">
						<SparklesIcon class="icon-sm" />
						Manage Product Promotions
					</button>
				</div>
			</div>

			<div class="space"></div>

			<!-- Floating Add Button (only show on products tab) -->
			<button 
				v-if="activeTab === 'products'"
				class="add-product-btn" 
				@click="isAddingProducts" 
				aria-label="Add new product"
			>
				<div class="btn-inner">
					<PlusIcon class="add-icon"></PlusIcon>
				</div>
			</button>
		</div>
		<VendorProductView 
			v-if="selectedProduct" 
			:product="selectedProduct" 
			@close="closeModal" 
			@add-option="addOption" 
			@promotionUpdated="handlePromotionUpdated"
		/>

		<!-- Promotion Detail Modal -->
		<div v-if="showPromotionModal" class="modal-backdrop">
			<div class="modal promotion-modal">
				<div class="modal-header">
					<h3>Promotion Details</h3>
					<button @click="closePromotionModal" class="close-btn">
						<XMarkIcon class="w-5 h-5" />
					</button>
				</div>
				<div v-if="selectedPromotion" class="modal-body">
					<div class="promotion-detail-content">
						<div class="product-info">
							<h4>{{ selectedPromotion.productName }}</h4>
							<p v-if="selectedPromotion.optionLabel" class="variant-label">Variant: {{ selectedPromotion.optionLabel }}</p>
							<div class="promotion-badges">
								<span :class="['detail-type-badge', selectedPromotion.type]">
									{{ selectedPromotion.type === 'product' ? 'Product Promotion' : 'Variant Promotion' }}
								</span>
								<span :class="['detail-status-badge', selectedPromotion.status]">
									{{ selectedPromotion.status }}
								</span>
							</div>
						</div>

						<div class="pricing-details">
							<div class="pricing-row">
								<span class="pricing-label">Original Price:</span>
								<span class="pricing-value original">${{ selectedPromotion.originalPrice.toFixed(2) }}</span>
							</div>
							<div class="pricing-row">
								<span class="pricing-label">Promotional Price:</span>
								<span class="pricing-value promo">${{ selectedPromotion.discountedPrice.toFixed(2) }}</span>
							</div>
							<div class="pricing-row savings">
								<span class="pricing-label">Customer Savings:</span>
								<span class="pricing-value save">
									${{ (selectedPromotion.originalPrice - selectedPromotion.discountedPrice).toFixed(2) }}
									({{ Math.round(((selectedPromotion.originalPrice - selectedPromotion.discountedPrice) / selectedPromotion.originalPrice) * 100) }}%)
								</span>
							</div>
						</div>

						<div class="promotion-terms">
							<h5>Promotion Details</h5>
							<div class="term-row">
								<span class="term-label">Discount Type:</span>
								<span class="term-value">{{ selectedPromotion.promotion.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount' }}</span>
							</div>
							<div class="term-row">
								<span class="term-label">Discount Value:</span>
								<span class="term-value">
									{{ selectedPromotion.promotion.discountType === 'percentage' 
										? `${selectedPromotion.promotion.discountValue}%`
										: `$${selectedPromotion.promotion.discountValue}`
									}}
								</span>
							</div>
							<div v-if="selectedPromotion.promotion.startDate" class="term-row">
								<span class="term-label">Start Date:</span>
								<span class="term-value">{{ new Date(selectedPromotion.promotion.startDate).toLocaleDateString() }}</span>
							</div>
							<div v-if="selectedPromotion.promotion.endDate" class="term-row">
								<span class="term-label">End Date:</span>
								<span class="term-value">{{ new Date(selectedPromotion.promotion.endDate).toLocaleDateString() }}</span>
							</div>
							<div v-if="selectedPromotion.promotion.freeShipping" class="term-row">
								<span class="term-label">Free Shipping:</span>
								<span class="term-value highlight">✓ Included</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- End Promotion Confirmation Modal -->
		<div v-if="showEndPromotionModal" class="modal-backdrop">
			<div class="modal confirmation-modal">
				<div class="modal-header">
					<h3>End Promotion</h3>
				</div>
				<div v-if="selectedPromotion" class="modal-body">
					<div class="confirmation-content">
						<div class="warning-icon">⚠️</div>
						<h4>Are you sure you want to end this promotion?</h4>
						<p>This action cannot be undone. The promotional pricing will be removed immediately and customers will see the regular price.</p>
						
						<div class="promotion-summary">
							<div class="summary-header">
								<h5>{{ selectedPromotion.productName }}</h5>
								<p v-if="selectedPromotion.optionLabel">Variant: {{ selectedPromotion.optionLabel }}</p>
							</div>
							<div class="summary-item">
								<span class="label">Current Discount:</span>
								<span class="value">
									{{ selectedPromotion.promotion.discountType === 'percentage' 
										? `${selectedPromotion.promotion.discountValue}% OFF`
										: `$${selectedPromotion.promotion.discountValue} OFF`
									}}
								</span>
							</div>
							<div class="summary-item">
								<span class="label">Sale Price:</span>
								<span class="value">${{ selectedPromotion.discountedPrice.toFixed(2) }}</span>
							</div>
							<div class="summary-item">
								<span class="label">Will Return To:</span>
								<span class="value highlight">${{ selectedPromotion.originalPrice.toFixed(2) }}</span>
							</div>
						</div>
					</div>
					
					<div class="modal-actions">
						<button 
							type="button" 
							@click="closeEndPromotionModal" 
							class="btn-modal btn-cancel"
							:disabled="isEndingPromotion"
						>
							Cancel
						</button>
						<button 
							type="button" 
							@click="endPromotion" 
							class="btn-modal btn-danger"
							:disabled="isEndingPromotion"
						>
							<span v-if="!isEndingPromotion">End Promotion</span>
							<span v-else>Ending...</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</section>
	<div v-if="showCropper" class="modal-backdrop edit-modal">
		<div class="modal">
			<div class="modal-header">
				<h3>Crop Image</h3>
				<button @click="closeCropper" class="close-btn">
					<XMarkIcon class="w-5 h-5" />
				</button>
			</div>
			<div class="modal-body">
				<ImageCropper :image-src="cropImageSrc" @cancel="closeCropper" />
			</div>
		</div>
	</div>
	<Transition name="fade-scale">
		<div v-if="isAddProducts" class="add-product-form">
			<AddProduct></AddProduct>
			<button class="close-form" @click="isAddingProducts">
				<XMarkIcon></XMarkIcon>
			</button>
		</div>
	</Transition>
</template>

<style scoped>
/* ============================================
   MAIN SECTION & ANIMATIONS
   ============================================ */
section {
	display: flex;
	height: 100dvh;
	max-height: 100dvh;
	flex-direction: column;
	width: 100%;
	position: relative;
	background: var(--bg-primary);
	animation: fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(16px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

section .container {
	max-height: 100dvh;
	overflow: auto;
	padding: clamp(1.5rem, 3vw, 2.5rem);
	scroll-behavior: smooth;
}

/* ============================================
   TAB NAVIGATION
   ============================================ */
.tab-navigation {
	display: flex;
	gap: 0.5rem;
	margin: 1.5rem 0;
	padding: 0.25rem;
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-sm);
}

.tab-btn {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.75rem 1.25rem;
	border: none;
	background: transparent;
	border-radius: calc(var(--radius-lg) - 0.25rem);
	font-size: 0.9rem;
	font-weight: 600;
	color: var(--text-secondary);
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
}

.tab-btn:hover {
	color: #1e293b;
	background: var(--surface-variant);
}

.tab-btn.active {
	color: var(--color-primary);
	background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.05));
	box-shadow: 0 1px 3px rgba(34, 197, 94, 0.2);
}

.tab-icon {
	height: 1.25rem;
	width: 1.25rem;
	stroke-width: 2.5;
	color: inherit;
}

.tab-count {
	background: var(--color-primary);
	color: white;
	font-size: 0.75rem;
	font-weight: 700;
	padding: 0.25rem 0.5rem;
	border-radius: var(--radius-sm);
	min-width: 1.5rem;
	height: 1.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.tab-btn.active .tab-count {
	background: var(--color-primary);
	color: white;
}

/* ============================================
   STATUS FILTER TABS
   ============================================ */
.status-filter-tabs {
	display: flex;
	gap: 0.75rem;
	margin-bottom: 1.5rem;
	padding: 0.5rem;
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	overflow-x: auto;
	-webkit-overflow-scrolling: touch;
}

.status-filter-btn {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.625rem 1rem;
	border: 1px solid transparent;
	background: transparent;
	border-radius: var(--radius-md);
	font-size: 0.85rem;
	font-weight: 500;
	color: var(--text-secondary);
	cursor: pointer;
	transition: all 0.2s ease;
	white-space: nowrap;
}

.status-filter-btn:hover {
	background: var(--surface-variant);
	color: var(--text-primary);
}

.status-filter-btn.active {
	background: var(--color-primary);
	color: white;
	border-color: var(--color-primary);
	box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
}

.status-filter-btn.approved:hover {
	background: rgba(34, 197, 94, 0.1);
	color: rgb(34, 197, 94);
}

.status-filter-btn.approved.active {
	background: rgb(34, 197, 94);
	color: white;
}

.status-filter-btn.pending:hover {
	background: rgba(234, 179, 8, 0.1);
	color: rgb(202, 138, 4);
}

.status-filter-btn.pending.active {
	background: rgb(234, 179, 8);
	color: white;
}

.status-filter-btn.rejected:hover {
	background: rgba(239, 68, 68, 0.1);
	color: rgb(239, 68, 68);
}

.status-filter-btn.rejected.active {
	background: rgb(239, 68, 68);
	color: white;
}

.filter-icon {
	width: 1.125rem;
	height: 1.125rem;
}

.filter-count {
	background: var(--surface-variant);
	color: var(--text-secondary);
	font-size: 0.75rem;
	font-weight: 600;
	padding: 0.125rem 0.5rem;
	border-radius: var(--radius-sm);
	min-width: 1.25rem;
	text-align: center;
}

.status-filter-btn.active .filter-count {
	background: rgba(255, 255, 255, 0.2);
	color: white;
}

/* ============================================
   PAGE HEADER
   ============================================ */
.page-header {
	margin-bottom: 2rem;
	animation: slideDown 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideDown {
	from {
		opacity: 0;
		transform: translateY(-20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.header-content {
	margin-bottom: 1.5rem;
}

.page-title {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	font-size: clamp(1.75rem, 4vw, 2.25rem);
	font-weight: 800;
	color: var(--text-primary);
	margin: 0 0 0.5rem 0;
	letter-spacing: -0.02em;
}

.title-icon {
	height: 2rem;
	width: 2rem;
	color: var(--color-primary);
	stroke-width: 2.5;
}

.page-subtitle {
	color: var(--text-secondary);
	font-size: 0.95rem;
	margin: 0;
	font-weight: 500;
}

.header-stats {
	display: flex;
	gap: 1rem;
	flex-wrap: wrap;
}

.stat-card {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 1rem 1.5rem;
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	box-shadow: var(--shadow-sm);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	min-width: 140px;
}

.stat-card:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
	border-color: var(--color-primary);
}

.stat-label {
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #64748b;
	opacity: 1;
}

.stat-card.promoted {
	border-color: #22c55e;
	background: rgba(34, 197, 94, 0.05);
	box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.1);
}

.stat-card.promoted .stat-value {
	color: #22c55e;
	font-weight: 900;
	text-shadow: 0 1px 2px rgba(34, 197, 94, 0.2);
}

.stat-card.active {
	border-color: #22c55e;
	background: rgba(34, 197, 94, 0.05);
	box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.1);
}

.stat-card.active .stat-value {
	color: #22c55e;
	font-weight: 900;
	text-shadow: 0 1px 2px rgba(34, 197, 94, 0.2);
}

.stat-card.scheduled {
	border-color: #f59e0b;
	background: rgba(245, 158, 11, 0.05);
	box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.1);
}

.stat-card.scheduled .stat-value {
	color: #f59e0b;
	font-weight: 900;
	text-shadow: 0 1px 2px rgba(245, 158, 11, 0.2);
}

.stat-card.product {
	border-color: #3b82f6;
	background: rgba(59, 130, 246, 0.05);
	box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
}

.stat-card.product .stat-value {
	color: #3b82f6;
	font-weight: 900;
	text-shadow: 0 1px 2px rgba(59, 130, 246, 0.2);
}

.stat-card.variant {
	border-color: #8b5cf6;
	background: rgba(139, 92, 246, 0.05);
	box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.1);
}

.stat-card.variant .stat-value {
	color: #8b5cf6;
	font-weight: 900;
	text-shadow: 0 1px 2px rgba(139, 92, 246, 0.2);
}

/* ============================================
   TAB CONTENT & GRIDS
   ============================================ */
.tab-content {
	animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.products-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 1.5rem;
	margin-bottom: 2rem;
}

.promotions-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
	gap: 1.5rem;
	margin-bottom: 2rem;
}

/* ============================================
   PROMOTION CARDS - Theme Aligned Design
   ============================================ */
.promotion-card {
	display: flex;
	flex-direction: column;
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	padding: 1.5rem;
	box-shadow: var(--card-shadow);
	transition: all var(--theme-transition-duration) var(--theme-transition-timing);
	position: relative;
	min-height: 240px;
}

.promotion-card:hover {
	transform: translateY(-2px);
	box-shadow: var(--card-shadow-hover);
	border-color: var(--color-primary);
}

.promotion-card::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 3px;
	background: var(--color-primary);
	border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

/* Card Header */
.card-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	margin-bottom: var(--spacing-md);
	padding-bottom: var(--spacing-md);
	border-bottom: 1px solid var(--border-primary);
}

.product-info {
	flex: 1;
}

.product-name {
	font-size: 1.125rem;
	font-weight: 700;
	color: var(--text-primary);
	margin: 0 0 0.25rem 0;
	line-height: 1.4;
}

.variant-name {
	font-size: 0.875rem;
	color: var(--text-secondary);
	margin: 0;
	font-weight: 500;
}

.status-info {
	flex-shrink: 0;
}

.status-badge {
	padding: 0.25rem 0.75rem;
	border-radius: var(--radius-md);
	font-size: 0.75rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.025em;
}

.status-badge.active {
	background: linear-gradient(135deg, #dcfce7, #bbf7d0);
	color: #166534;
	border: 1px solid #86efac;
	box-shadow: 0 1px 3px rgba(22, 101, 52, 0.1);
}

.status-badge.scheduled {
	background: linear-gradient(135deg, #fef3c7, #fde68a);
	color: #92400e;
	border: 1px solid #fcd34d;
	box-shadow: 0 1px 3px rgba(146, 64, 14, 0.1);
}

/* Discount Section */
.discount-section {
	text-align: center;
	margin-bottom: 1.5rem;
	padding: 0.5rem;
}

.discount-amount {
	font-size: 1.75rem;
	font-weight: 900;
	background: linear-gradient(135deg, var(--color-primary) 0%, #059669 100%);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
	letter-spacing: -0.025em;
}

/* Shipping Only Badge */
.shipping-only-badge {
	text-align: center;
	margin-bottom: 1.5rem;
	padding: 1rem;
	background: var(--color-primary);
	border-radius: var(--radius-md);
}

.shipping-badge {
	font-size: 1.25rem;
	font-weight: 700;
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Price Section */
.price-section {
	margin-bottom: 1.5rem;
}

.price-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.5rem;
}

.price-label {
	font-size: 0.875rem;
	color: var(--text-secondary);
	font-weight: 500;
}

.price-regular {
	font-size: 1rem;
	color: var(--text-tertiary);
	font-weight: 600;
	text-decoration: line-through;
}

.price-sale {
	font-size: 1.125rem;
	color: var(--text-primary);
	font-weight: 700;
}

.savings-row {
	text-align: center;
	margin-top: 0.75rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--border-primary);
}

.savings-text {
	font-size: 0.875rem;
	color: var(--color-primary);
	font-weight: 600;
}

/* Info Section */
.info-section {
	margin-bottom: 1.5rem;
	padding: 0.75rem;
	background: var(--bg-secondary);
	border-radius: var(--radius-md);
}

.info-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.5rem;
}

.info-item:last-child {
	margin-bottom: 0;
}

.info-label {
	font-size: 0.8rem;
	color: var(--text-secondary);
	font-weight: 500;
}

.info-value {
	font-size: 0.8rem;
	color: var(--text-primary);
	font-weight: 600;
}

/* Card Actions */
.card-actions {
	display: flex;
	gap: 0.75rem;
	margin-top: auto;
}

.btn-outline {
	flex: 1;
	padding: 0.625rem 1rem;
	border: 1.5px solid var(--color-primary);
	background: var(--surface);
	color: var(--color-primary);
	border-radius: var(--radius-md);
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;
}

.btn-outline::before {
	content: '';
	position: absolute;
	inset: 0;
	background: var(--color-primary);
	opacity: 0;
	transition: opacity 0.2s ease;
	z-index: 0;
}

.btn-outline:hover {
	color: white;
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(var(--color-primary-rgb), 0.3);
}

.btn-outline:hover::before {
	opacity: 1;
}

.btn-outline:active {
	transform: translateY(0);
	box-shadow: 0 2px 6px rgba(var(--color-primary-rgb), 0.2);
}

.btn-outline span {
	position: relative;
	z-index: 1;
}

.btn-text {
	flex: 1;
	padding: 0.625rem 1rem;
	border: 1px solid var(--border-primary);
	background: var(--surface);
	color: #dc2626;
	border-radius: var(--radius-md);
	font-size: 0.875rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;
}

.btn-text::before {
	content: '';
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.05));
	opacity: 0;
	transition: opacity 0.2s ease;
}

.btn-text:hover:not(:disabled) {
	color: #ffffff;
	background: linear-gradient(135deg, #dc2626, #b91c1c);
	border-color: #dc2626;
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
}

.btn-text:hover:not(:disabled)::before {
	opacity: 1;
}

.btn-text:active:not(:disabled) {
	transform: translateY(0);
	box-shadow: 0 2px 6px rgba(220, 38, 38, 0.2);
}

.btn-text:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	color: var(--text-tertiary);
	border-color: var(--border-primary);
	background: var(--bg-secondary);
}

/* Responsive Design */
@media (max-width: 768px) {
	.promotion-card {
		padding: 1.25rem;
		min-height: auto;
	}
	
	.card-actions {
		flex-direction: column;
		gap: 0.75rem;
	}
	
	.discount-amount {
		font-size: 1.5rem;
	}
	
	.shipping-badge {
		font-size: 1.1rem;
	}
	
	.modal {
		margin: 0.5rem;
		max-width: calc(100vw - 1rem);
	}
	
	.modal-header {
		padding: 1.25rem 1.5rem;
	}
	
	.modal-header h3 {
		font-size: 1.25rem;
	}
	
	.modal-body {
		padding: 1.5rem;
	}
	
	.btn-modal {
		min-width: 100px;
		padding: 0.625rem 1.25rem;
		font-size: 0.875rem;
	}
}

/* ============================================
   LOADING & EMPTY STATES
   ============================================ */
.loading-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 4rem 2rem;
	text-align: center;
	color: #374151;
	font-weight: 500;
}

.loading-spinner {
	width: 2rem;
	height: 2rem;
	border: 3px solid var(--border-primary);
	border-top: 3px solid var(--color-primary);
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin-bottom: 1rem;
}

@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

.space {
	width: 100%;
	height: 10rem;
}

.add-product-form {
	position: fixed;
	height: 100dvh;
	width: 100dvw;
	display: flex;
	align-items: center;
	justify-content: center;
	top: 0;
	background-color: var(--modal-overlay);
	backdrop-filter: blur(8px);
	z-index: 10000;
	max-width: 1200px;
	left: 50%;
	transform: translate(-50%);
}

/* ============================================
   MODALS & OVERLAYS
   ============================================ */
.modal-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(8px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	-webkit-backdrop-filter: blur(8px);
}

.modal {
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-xl);
	width: 100%;
	max-width: 640px;
	margin: 1rem;
	box-shadow: 
		0 25px 50px -12px rgba(0, 0, 0, 0.25),
		0 0 0 1px var(--border-primary);
	animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	overflow: hidden;
}

.promotion-modal {
	max-width: 720px;
}

.confirmation-modal {
	max-width: 520px;
}

@keyframes slideUp {
	from {
		opacity: 0;
		transform: translateY(20px) scale(0.95);
	}
	to {
		opacity: 1;
		transform: translateY(0) scale(1);
	}
}

.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 1.75rem 2rem;
	margin-bottom: 0;
	border-bottom: 1px solid var(--border-primary);
	background: var(--bg-secondary);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
}

.modal-header h3 {
	font-size: 1.5rem;
	font-weight: 800;
	color: var(--text-primary);
	margin: 0;
	letter-spacing: -0.02em;
}

.close-btn {
	background: var(--surface);
	border: 1px solid var(--border-primary);
	color: var(--text-secondary);
	cursor: pointer;
	padding: 0.5rem;
	border-radius: var(--radius-md);
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	width: 2.5rem;
	height: 2.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close-btn:hover {
	background: #fee2e2;
	border-color: #dc2626;
	color: #dc2626;
	transform: scale(1.05);
}

.close-btn:active {
	transform: scale(0.95);
}

.modal-body {
	padding: 2rem;
	max-height: calc(90vh - 100px);
	overflow-y: auto;
	overflow-x: hidden;
}

/* Custom scrollbar for modals */
.modal-body::-webkit-scrollbar {
	width: 8px;
}

.modal-body::-webkit-scrollbar-track {
	background: var(--bg-secondary);
	border-radius: var(--radius-sm);
}

.modal-body::-webkit-scrollbar-thumb {
	background: var(--color-primary);
	border-radius: var(--radius-sm);
	transition: background 0.2s ease;
}

.modal-body::-webkit-scrollbar-thumb:hover {
	background: var(--color-primary-hover);
}

/* Promotion Detail Modal Styles */
.promotion-detail-content {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.product-info h4 {
	font-size: 1.2rem;
	font-weight: 700;
	color: var(--text-primary);
	margin: 0 0 0.5rem 0;
}

.variant-label {
	font-size: 0.9rem;
	color: #64748b;
	margin: 0 0 1rem 0;
	font-style: italic;
	font-weight: 500;
}

.promotion-badges {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
}

.detail-type-badge {
	padding: 0.375rem 1rem;
	border-radius: var(--radius-md);
	font-size: 0.8rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.detail-type-badge.product {
	background: linear-gradient(135deg, #dbeafe, #bfdbfe);
	color: #1d4ed8;
	border: 1px solid #93c5fd;
	box-shadow: 0 1px 3px rgba(29, 78, 216, 0.1);
}

.detail-type-badge.option {
	background: linear-gradient(135deg, #e9d5ff, #d8b4fe);
	color: #7c3aed;
	border: 1px solid #c084fc;
	box-shadow: 0 1px 3px rgba(124, 58, 237, 0.1);
}

.detail-status-badge {
	padding: 0.375rem 1rem;
	border-radius: var(--radius-md);
	font-size: 0.8rem;
	font-weight: 600;
	text-transform: uppercase;
}

.detail-status-badge.active {
	background: linear-gradient(135deg, #dcfce7, #bbf7d0);
	color: #166534;
	border: 1px solid #86efac;
	box-shadow: 0 1px 3px rgba(22, 101, 52, 0.1);
}

.detail-status-badge.scheduled {
	background: linear-gradient(135deg, #fef3c7, #fde68a);
	color: #92400e;
	border: 1px solid #fcd34d;
	box-shadow: 0 1px 3px rgba(146, 64, 14, 0.1);
}

.pricing-details {
	background: linear-gradient(135deg, var(--surface-variant) 0%, var(--bg-secondary) 100%);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	padding: 1.5rem;
	box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.pricing-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 1rem;
}

.pricing-row:last-child {
	margin-bottom: 0;
}

.pricing-row.savings {
	border-top: 1px solid var(--border-primary);
	padding-top: 1rem;
	margin-top: 1rem;
}

.pricing-label {
	font-size: 0.95rem;
	color: #64748b;
	font-weight: 600;
}

.pricing-value {
	font-size: 1.1rem;
	font-weight: 700;
}

.pricing-value.original {
	color: var(--text-secondary);
	text-decoration: line-through;
}

.pricing-value.promo {
	color: #22c55e;
	font-size: 1.4rem;
}

.pricing-value.save {
	color: var(--color-primary);
	font-weight: 800;
}

.promotion-terms {
	background: var(--surface);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-lg);
	padding: 1.5rem;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.promotion-terms h5 {
	font-size: 1rem;
	font-weight: 700;
	color: var(--text-primary);
	margin: 0 0 1rem 0;
}

.term-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.75rem;
}

.term-row:last-child {
	margin-bottom: 0;
}

.term-label {
	font-size: 0.9rem;
	color: #64748b;
	font-weight: 600;
}

.term-value {
	font-size: 0.9rem;
	color: #1e293b;
	font-weight: 600;
}

.term-value.highlight {
	color: #22c55e;
}

/* Confirmation Modal Styles */
.confirmation-content {
	text-align: center;
}

.warning-icon {
	font-size: 3rem;
	margin-bottom: 1rem;
}

.confirmation-content h4 {
	font-size: 1.25rem;
	font-weight: 600;
	color: var(--text-primary);
	margin: 0 0 0.75rem 0;
}

.confirmation-content p {
	color: #64748b;
	line-height: 1.6;
	margin: 0 0 1.5rem 0;
	font-weight: 500;
}

.promotion-summary {
	background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
	border: 1px solid #fca5a5;
	border-radius: var(--radius-lg);
	padding: 1.5rem;
	margin-bottom: 1.5rem;
	text-align: left;
	box-shadow: inset 0 1px 3px rgba(220, 38, 38, 0.1);
}

.summary-header {
	margin-bottom: 1rem;
	padding-bottom: 1rem;
	border-bottom: 1px solid var(--border-primary);
}

.summary-header h5 {
	font-size: 1.1rem;
	font-weight: 700;
	color: var(--text-primary);
	margin: 0 0 0.25rem 0;
}

.summary-header p {
	font-size: 0.9rem;
	color: #64748b;
	margin: 0;
	font-style: italic;
	font-weight: 500;
}

.summary-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.75rem;
}

.summary-item:last-child {
	margin-bottom: 0;
	font-weight: 600;
	border-top: 1px solid var(--border-primary);
	padding-top: 0.75rem;
	margin-top: 0.75rem;
}

.summary-item .label {
	color: #64748b;
	font-size: 0.9rem;
	font-weight: 600;
}

.summary-item .value {
	color: #1e293b;
	font-weight: 600;
}

.summary-item .value.highlight {
	color: #dc2626;
	font-weight: 700;
}

.modal-actions {
	display: flex;
	gap: 0.75rem;
	justify-content: flex-end;
	margin-top: 1.5rem;
}

.btn-modal {
	padding: 0.75rem 1.5rem;
	border-radius: var(--radius-md);
	font-weight: 600;
	font-size: 0.9rem;
	cursor: pointer;
	transition: all 0.2s ease;
	border: none;
	min-width: 120px;
}

.btn-modal.btn-cancel {
	background: var(--surface);
	color: var(--text-primary);
	border: 1.5px solid var(--border-primary);
}

.btn-modal.btn-cancel:hover {
	background: var(--bg-secondary);
	border-color: var(--text-primary);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-modal.btn-cancel:active {
	transform: translateY(0);
}

.btn-modal.btn-danger {
	background: linear-gradient(135deg, #ef4444, #dc2626);
	color: white;
}

.btn-modal.btn-danger:hover:not(:disabled) {
	background: linear-gradient(135deg, #dc2626, #b91c1c);
	transform: translateY(-1px);
	box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-modal:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.close-form {
	border-radius: 50rem;
	border: 0;
	color: white;
	z-index: 30000;
	transition: all 150ms;
}

.close-form:hover {
	opacity: 0.8;
}

.add-product-container {
	position: fixed;
	width: 100dvw;
	max-height: 100dvh;
	height: 100dvh;
	background-color: var(--modal-overlay);
	overflow: auto;
	left: 0;
	top: 0;
	display: flex;
	align-items: center;
	backdrop-filter: blur(8px);
	z-index: 10000;
}

/* ============================================
   FLOATING ADD BUTTON
   ============================================ */
.add-product-btn {
	position: fixed;
	height: 3.75rem;
	width: 3.75rem;
	right: clamp(1.5rem, 4vw, 2.5rem);
	bottom: clamp(2rem, 8vh, 6rem);
	padding: 0;
	border-radius: 50%;
	border: none;
	background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8px 24px rgba(31, 139, 78, 0.4), 0 4px 8px rgba(31, 139, 78, 0.2);
	z-index: 1000;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: pointer;
	animation: float 3s ease-in-out infinite;
}

@keyframes float {
	0%, 100% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-8px);
	}
}

.add-product-btn:hover {
	transform: scale(1.15) rotate(90deg);
	box-shadow: 0 12px 32px rgba(31, 139, 78, 0.5), 0 6px 12px rgba(31, 139, 78, 0.3);
	animation: none;
}

.add-product-btn:active {
	transform: scale(1.05) rotate(90deg);
	box-shadow: 0 6px 16px rgba(31, 139, 78, 0.35);
}

.add-product-btn::before {
	content: '';
	position: absolute;
	inset: -4px;
	border-radius: 50%;
	background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover));
	opacity: 0;
	transition: opacity 0.3s ease;
	z-index: -1;
	filter: blur(8px);
}

.add-product-btn:hover::before {
	opacity: 0.5;
}

.btn-inner {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
}

.add-icon {
	width: 1.75rem;
	height: 1.75rem;
	stroke-width: 2.5;
	transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-product-btn:hover .add-icon {
	transform: rotate(90deg);
}

@media (max-width: 768px) {
	.add-product-btn {
		height: 3.25rem;
		width: 3.25rem;
		right: 1.25rem;
		bottom: 5rem;
	}

	.add-icon {
		width: 1.5rem;
		height: 1.5rem;
	}
}

.category-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.category-btn {
	padding: 0.625rem 1rem;
	border: 2px solid var(--border-primary);
	background-color: var(--bg-secondary);
	color: var(--text-primary);
	border-radius: 10px;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	font-weight: 600;
	font-size: 0.875rem;
	letter-spacing: 0.01em;
}

.modal-crop {
	width: 100dvw;
	height: 100dvh;
	position: fixed;
	z-index: 700000;
	background-color: var(--modal-overlay);
	backdrop-filter: blur(12px);
}

.category-btn:hover {
	background-color: var(--surface-hover);
	border-color: #1f8b4e;
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(31, 139, 78, 0.15);
}

.category-btn.active {
	background: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
	color: white;
	border-color: #1f8b4e;
	box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
	transform: translateY(-2px);
}

.desktop-header {
	padding: 1rem 10px;
	color: var(--text-primary);
}

.h-5 {
	height: 1rem;
	aspect-ratio: 1;
}

.category-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	margin-bottom: 0.5rem;
}

.category-item {
	padding: 0.3rem 0.6rem;
	background: var(--bg-secondary);
	color: var(--text-primary);
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-sm);
	cursor: pointer;
	font-size: 0.85rem;
	transition: all 0.2s ease;
	font-weight: 500;
}

.category-item:hover {
	background: var(--surface-hover);
	border-color: var(--color-primary);
}

.category-item.active {
	background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
	color: white;
	border-color: var(--color-primary);
	box-shadow: 0 0 0 2px var(--color-primary-light);
}

.modal-backdrop {
	position: fixed;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	background: var(--modal-overlay);
	overflow: auto;
	backdrop-filter: blur(8px);
	scroll-behavior: smooth !important;
}

.edit-modal {
	background-color: var(--modal-overlay);
	backdrop-filter: blur(8px);
}

.modal {
	background: var(--surface);
	max-height: 80dvh;
	overflow: auto;
	width: 90%;
	max-width: 500px;
	padding: 10px;
	border-radius: var(--radius-xl);
	position: relative;
	border-top: 6px solid var(--color-primary);
	padding-bottom: 0;
	box-shadow: var(--shadow-xl);
	border: 1px solid var(--border-primary);
}

.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px;
}

.form-group label {
	padding: 0px 5px;
	font-weight: 600;
}

.modal-body {
	display: flex;
	flex-direction: column;
	gap: 10px;
	margin-top: 1rem;
	padding: 5px;
}

.modal-body input,
.modal-body textarea {
	width: 100%;
	padding: 10px 12px;
	border: 1px solid var(--input-border);
	background: var(--input-bg);
	color: var(--text-primary);
	border-radius: var(--radius-md);
	transition: all 0.2s ease;
	font-family: inherit;
}

.modal-body input:focus,
.modal-body textarea:focus {
	outline: none;
	border-color: var(--input-border-focus);
	box-shadow: 0 0 0 3px var(--color-primary-light);
}

.image-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-top: 10px;
}

.upload-area {
	display: flex;
	flex-direction: column;
}

.upload-area h1 {
	width: 100%;
	text-align: center;
	padding: 1rem;
}

.upload-area label {
	width: 100%;
	border-radius: 16px;
	padding: 3rem 1rem;
	background-color: var(--bg-secondary);
	border: 3px dashed var(--border-primary);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	cursor: pointer;
	gap: 0.75rem;
}

.upload-area label:hover {
	background: linear-gradient(135deg, rgba(31, 139, 78, 0.05) 0%, rgba(31, 139, 78, 0.02) 100%);
	border-color: #1f8b4e;
	transform: translateY(-2px);
	box-shadow: 0 8px 24px rgba(31, 139, 78, 0.12);
}

.upload-area label:focus {
	outline: 3px solid rgba(31, 139, 78, 0.3);
	outline-offset: 2px;
}

label button {
	height: 3rem;
	aspect-ratio: 1;
	background-color: transparent;
	border: 0;
	color: var(--text-secondary);
}

.upload-area input {
	display: none;
}

.image-item {
	display: flex;
	gap: 0.5rem;
	align-items: center;
}

.image-item img {
	height: 80px !important;
	aspect-ratio: 16/9;
	border-radius: var(--radius-md);
	border: 1px solid var(--border-primary);
	box-shadow: var(--shadow-sm);
	transition: transform 0.2s ease;
}

.image-item img:hover {
	transform: scale(1.05);
}

.image-actions {
	display: flex;
	gap: 5px;
	flex-direction: column;
}

.action-icon-edit {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 4px 5px;
	border: 1px solid var(--border-primary);
	background: var(--bg-secondary);
	color: var(--text-primary);
	border-radius: var(--radius-sm);
	font-size: 12px;
	transition: all 0.2s ease;
	cursor: pointer;
}

.action-icon-edit:hover {
	background: var(--surface-hover);
	border-color: var(--color-primary);
}

.action-delete {
	background: linear-gradient(135deg, var(--color-warning), var(--color-warning-dark));
	color: white;
	border-color: var(--color-warning);
}

.action-delete:hover {
	background: linear-gradient(135deg, var(--color-danger), var(--color-danger-dark));
	border-color: var(--color-danger);
}

.action-icon-edit .w-4 {
	height: 1rem;
}

.add-btn {
	background: var(--bg-secondary);
	padding: 0.3rem 0.5rem;
	border: 1px dashed var(--border-primary);
	border-radius: var(--radius-sm);
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.3rem;
	color: var(--text-primary);
	transition: all 0.2s ease;
}

.add-btn:hover {
	background: var(--surface-hover);
	border-color: var(--color-primary);
	transform: translateY(-1px);
}

.image-list {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.image-item {
	display: flex;
	gap: 0.5rem;
	align-items: center;
}

/* .image-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ccc;
} */

.upload-input {
	padding: 0.5rem 0;
	font-size: 0.9rem;
}

.modal-footer {
	display: flex;
	justify-content: center;
	width: 100%;
	background: var(--surface);
	border-top: 1px solid var(--border-primary);
	position: sticky;
	bottom: 0;
	gap: 1rem;
	margin-top: 1rem;
	padding: 10px 0;
}

.modal-footer button {
	padding: 10px 20px;
	border-radius: var(--radius-md);
	border: 1px solid transparent;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-footer button:active {
	transform: scale(0.97);
}

.modal-footer button.disable-btn {
	background-color: var(--bg-secondary);
	color: var(--text-tertiary);
	cursor: not-allowed;
	opacity: 0.6;
}

.modal-footer button.save-btn {
	background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
	color: white;
	box-shadow: var(--shadow-md);
}

.modal-footer button.save-btn:hover:not(:disabled) {
	box-shadow: var(--shadow-lg);
	transform: translateY(-2px);
}

.modal-footer button.cancel-btn {
	border: 1px solid var(--border-primary);
	background: var(--bg-secondary);
	color: var(--text-primary);
}

.modal-footer button.cancel-btn:hover {
	background: var(--surface-hover);
	border-color: var(--color-danger);
	color: var(--color-danger);
}

.save {
	background: linear-gradient(135deg, #1f8b4e 0%, #26a65b 100%);
	color: white;
	padding: 0.75rem 1.5rem;
	border: none;
	border-radius: 10px;
	cursor: pointer;
	font-weight: 700;
	box-shadow: 0 4px 12px rgba(31, 139, 78, 0.3);
	transition: all 0.3s ease;
}

.save:hover {
	transform: translateY(-2px);
	box-shadow: 0 6px 20px rgba(31, 139, 78, 0.4);
}

.product-list-container {
	width: 100%;
	height: fit-content;
	max-height: 100dvh;
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
	gap: 1.5rem;
	max-height: 100dvh;
	overflow: auto;
	padding: clamp(1rem, 3vw, 2rem);
	padding-bottom: 10rem !important;
}

.product-card {
	border: 1px solid var(--border-primary);
	background: var(--surface);
	height: fit-content;
	border-radius: 16px;
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
	box-shadow: 0 4px 16px rgba(31, 139, 78, 0.08);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;
}

.product-card::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 3px;
	background: linear-gradient(90deg, #1f8b4e 0%, transparent 100%);
	opacity: 0;
	transition: opacity 0.3s ease;
}

.product-card:hover {
	border-color: rgba(31, 139, 78, 0.3);
	transform: translateY(-4px);
	box-shadow: 0 8px 24px rgba(31, 139, 78, 0.15);
}

.product-card:hover::before {
	opacity: 1;
}

.product-details {
	display: flex;
	width: 100%;
	gap: 5px;
}

.product-details .img-container {
	height: 120px;
	aspect-ratio: 4/3;
	border: 1px solid var(--border-primary);
	border-radius: var(--radius-md);
	overflow: hidden;
	background: var(--bg-secondary);
}

.img-container img {
	height: 100%;
	aspect-ratio: 4/2.7;
	border-radius: 10px;
	object-fit: fill;
	background-position: center;
	background-size: cover;
}

.stats {
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	padding: 5px 10px;
	color: var(--text-primary);
	border-radius: var(--radius-md);
	font-size: clamp(12px, 2vw, 1rem);
	justify-content: space-around;
}

.stats span {
	display: flex;
	align-items: center;
	gap: 5px;
	color: var(--text-secondary);
}

.stats .icon {
	height: 1rem;
	aspect-ratio: 1;
	margin-bottom: 3px;
	color: var(--color-primary);
}

.stats h3 {
	margin: 0;
	padding: 0;
	font-size: clamp(0.9rem, 2vw, 1.1rem);
	line-height: 1.2;
	max-width: 22ch;
	word-break: break-word;
	color: var(--text-primary);
	font-weight: 700;
}

.name {
	padding: 10px 8px;
	color: var(--text-primary);
	font-weight: 600;
	border-radius: var(--radius-md);
	font-size: clamp(0.9rem, 2vw, 1rem);
}

.name p {
	max-width: 40ch;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.name .label {
	font-size: 12px;
	color: var(--text-tertiary);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.no-option {
	color: transparent !important;
}

.actions {
	display: flex;
	gap: 1rem;
	padding: 5px 8px;
}

.btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	border: 2px solid var(--border-primary);
	border-radius: 10px;
	background-color: var(--bg-secondary);
	color: var(--text-primary);
	padding: 0.625rem 1rem;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	font-weight: 600;
	font-size: 0.875rem;
}

.btn:hover {
	background: linear-gradient(135deg, rgba(31, 139, 78, 0.1) 0%, rgba(31, 139, 78, 0.05) 100%);
	border-color: #1f8b4e;
	color: #1f8b4e;
	transform: translateY(-2px);
	box-shadow: 0 4px 12px rgba(31, 139, 78, 0.15);
}

.btn span {
	font-size: clamp(12px, 2vw, 14px);
}

.btn .action-icon {
	height: 1.1rem;
	aspect-ratio: 1;
}

.btn:last-child {
	background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
	color: white;
	border-color: #dc2626;
	box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.btn:last-child:hover {
	background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
	box-shadow: 0 6px 20px rgba(220, 38, 38, 0.35);
	border-color: #b91c1c;
}

@media (min-width: 620px) {
	.product-list-container {
		padding-left: 1rem;
		padding-right: 1rem;
	}
}

/* ============================================
   PRODUCTS GRID
   ============================================ */
.products-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	gap: 1.5rem;
	animation: fadeInUp 0.7s cubic-bezier(0.4, 0, 0.2, 1);
	animation-delay: 0.1s;
	animation-fill-mode: backwards;
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

/* ============================================
   EMPTY STATE
   ============================================ */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 4rem 2rem;
	text-align: center;
	gap: 1.5rem;
	min-height: 400px;
}

.empty-icon {
	width: 5rem;
	height: 5rem;
	color: var(--text-secondary);
	stroke-width: 1.5;
	opacity: 0.8;
}

.empty-state h3 {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--text-primary);
	margin: 0;
}

.empty-state p {
	font-size: 1rem;
	color: var(--text-secondary);
	margin: 0;
	max-width: 400px;
}

.btn-primary {
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.875rem 1.75rem;
	background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
	color: white;
	border: none;
	border-radius: var(--radius-lg);
	font-weight: 600;
	font-size: 0.95rem;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	box-shadow: 0 4px 12px rgba(31, 139, 78, 0.25);
}

.btn-primary:hover {
	transform: translateY(-2px);
	box-shadow: 0 8px 20px rgba(31, 139, 78, 0.35);
}

.btn-primary:active {
	transform: translateY(0);
}

.icon-sm {
	width: 1.25rem;
	height: 1.25rem;
	stroke-width: 2.5;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */
@media (max-width: 1200px) {
	.products-grid {
		grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
		gap: 1.25rem;
	}
}

@media (max-width: 768px) {
	section .container {
		padding: 1.25rem;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-title {
		font-size: 1.5rem;
	}

	.title-icon {
		height: 1.5rem;
		width: 1.5rem;
	}

	.header-stats {
		gap: 0.75rem;
	}

	.stat-card {
		padding: 0.75rem 1rem;
		min-width: 120px;
	}

	.stat-value {
		font-size: 1.5rem;
	}

	.products-grid {
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}
}

@media (max-width: 480px) {
	.products-grid {
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	.header-stats {
		width: 100%;
	}

	.stat-card {
		flex: 1;
		min-width: 0;
	}
}

/* ============================================
   ACCESSIBILITY & CONTRAST IMPROVEMENTS  
   ============================================ */

/* Base stat value styling for better contrast */
.stat-value {
	font-size: 2rem;
	font-weight: 800;
	line-height: 1;
	color: var(--text-primary, #1e293b);
	text-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Focus states for accessibility */
.tab-btn:focus-visible {
	outline: 2px solid var(--color-primary);
	outline-offset: 2px;
}

.btn-modal:focus-visible {
	outline: 2px solid var(--color-primary);
	outline-offset: 2px;
}

.btn-secondary:focus-visible {
	outline: 2px solid var(--color-primary);
	outline-offset: 2px;
}

/* Improve icon stroke for better visibility */
.icon-sm,
.btn-icon {
	stroke-width: 2.5;
}

/* Dark theme statistics improvements */
@media (prefers-color-scheme: dark) {
	.stat-label {
		color: #9ca3af;
	}
	
	.stat-value {
		color: #f9fafb;
		text-shadow: 0 1px 3px rgba(0,0,0,0.3);
	}
	
	.stat-card.promoted,
	.stat-card.active {
		background: rgba(34, 197, 94, 0.1);
		border-color: #22c55e;
	}
	
	.stat-card.scheduled {
		background: rgba(245, 158, 11, 0.1);
		border-color: #f59e0b;
	}
	
	.stat-card.product {
		background: rgba(59, 130, 246, 0.1);
		border-color: #3b82f6;
	}
	
	.stat-card.variant {
		background: rgba(139, 92, 246, 0.1);
		border-color: #8b5cf6;
	}
	
	.stat-card.promoted .stat-value,
	.stat-card.active .stat-value {
		color: #4ade80;
	}
	
	.stat-card.scheduled .stat-value {
		color: #fbbf24;
	}
	
	.stat-card.product .stat-value {
		color: #60a5fa;
	}
	
	.stat-card.variant .stat-value {
		color: #a78bfa;
	}
}

</style>
