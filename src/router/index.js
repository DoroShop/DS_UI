// router/index.js
import { createRouter, createWebHistory } from "vue-router";
import { nextTick } from "vue";
import { useAuthStore } from "../stores/authStores";

// Eager import
import ChatView from "../pages/ChatView.vue";

// Lazy imports
const Home = () => import("../pages/Home.vue");
const Cart = () => import("../pages/Cart.vue");
const Search = () => import("../pages/Search.vue");
const ProductSearchResult = () => import("../pages/ProductSearchResult.vue");
const ViewProduct = () => import("../pages/ViewProduct.vue");
const ViewSeller = () => import("../pages/ViewSeller.vue");
const NearbyShops = () => import("../pages/NearbyShops.vue");
const Profile = () => import("../pages/Profile.vue");
const CustomerMessages = () => import("../pages/CustomerMessages.vue");
const Orders = () => import("../pages/Orders.vue");
const AuthPage = () => import("../pages/Auth.vue");
const Dashboard = () => import("../pages/vendor/Dashboard.vue");

// Vendor
const VendorCommissions = () => import("../pages/vendor/VendorCommissions.vue");

// Notifications
const Notifications = () => import("../pages/Notifications.vue");

// Admin
const AdminLayout = () => import("../components/admin/AdminLayout.vue");
const AdminDashboard = () => import("../views/admin/AdminDashboard.vue");
const AdminUsers = () => import("../views/admin/AdminUsers.vue");
const AdminProducts = () => import("../views/admin/AdminProducts.vue");
const AdminSellers = () => import("../views/admin/AdminSellers.vue");
const AdminOrders = () => import("../views/admin/AdminOrders.vue");
const AdminCommission = () => import("../views/admin/AdminCommission.vue");
const AdminCODCommissions = () => import("../pages/admin/AdminCommissions.vue");
const AdminPendingSellers = () =>
  import("../pages/admin/AdminPendingSellers.vue");
const AdminCategories = () => import("../views/admin/AdminCategories.vue");
const AdminMunicipalities = () =>
  import("../views/admin/AdminMunicipalities.vue");
const AdminBanners = () => import("../views/admin/AdminBanners.vue");
const ProductBannerAdmin = () => import("../views/admin/ProductBannerAdmin.vue");
const AdminAnnouncements = () =>
  import("../views/admin/AdminAnnouncements.vue");
const AdminRefunds = () => import("../views/admin/AdminRefunds.vue");
const AdminAuditLogs = () => import("../views/admin/AdminAuditLogs.vue");
const AdminWithdrawals = () => import("../views/admin/AdminWithdrawals.vue");
const AdminSettings = () => import("../views/admin/AdminSettings.vue");
const AdminSubscriptions = () =>
  import("../views/admin/AdminSubscriptions.vue");

const routes = [
  { 
    path: "/", 
    name: "Root",
    redirect: () => {
      // This redirect will be handled by the beforeEach guard
      // for role-based redirection
      return "/products";
    }
  },
  { 
    path: "/products", 
    name: "Products",
    component: Home 
  },

  {
    path: "/signup",
    name: "Signup",
    component: AuthPage,
    meta: { public: true, authPage: true, hideMobileNav: true },
  },
  {
    path: "/login",
    name: "Login",
    component: AuthPage,
    meta: { public: true, authPage: true, hideMobileNav: true },
  },

  // User Routes
  { 
    path: "/user/me", 
    name: "Profile",
    component: Profile, 
    meta: { requiresAuth: true } 
  },
  {
    path: "/messages",
    name: "Messages",
    component: CustomerMessages,
    meta: { hideMobileNav: true },
  },
  {
    path: "/message/:chatId",
    name: "ChatView",
    component: ChatView,
    // meta: { requiresAuth: true },
  },
  { 
    path: "/cart", 
    name: "Cart",
    component: Cart, 
    // meta: { requiresAuth: true } 
  },
  { 
    path: "/orders", 
    name: "Orders",
    component: Orders, 
    // meta: { requiresAuth: true } 
  },
  {
    path: "/products/search",
    name: "Search",
    component: Search,
    meta: {hideMobileNav: true },
  },
  {
    path: "/search/result",
    name: "SearchResult",
    component: ProductSearchResult,
    // meta: { requiresAuth: true, hideMobileNav: true },
  },
  {
    path: "/product/:id",
    name: "ViewProduct",
    component: ViewProduct,
    meta: {  hideMobileNav: true },
  },
  {
    path: "/view/vendor/:id",
    name: "ViewVendor",
    component: ViewSeller,
    meta: {hideMobileNav: true },
  },
  {
    path: "/shops/nearby",
    name: "NearbyShops",
    component: NearbyShops,
    meta: {hideMobileNav: true },
  },

  // Vendor Routes
  {
    path: "/vendor/dashboard",
    name: "VendorDashboard",
    component: Dashboard,
    meta: { requiresAuth: true, requiresVendor: true, hideMobileNav: true },
  },
  {
    path: "/vendor/commissions",
    name: "VendorCommissions",
    component: VendorCommissions,
    meta: { requiresAuth: true, requiresVendor: true, hideMobileNav: true },
  },

  // Notifications
  {
    path: "/notifications",
    name: "Notifications",
    component: Notifications,
    meta: { requiresAuth: true },
  },

  // Admin Routes
  {
    path: "/admin",
    name: "Admin",
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true, hideMobileNav: true },
    children: [
      { 
        path: "", 
        name: "AdminDashboard",
        component: AdminDashboard 
      },
      { 
        path: "dashboard", 
        redirect: { name: "AdminDashboard" }
      },
      { 
        path: "users", 
        name: "AdminUsers",
        component: AdminUsers 
      },
      { 
        path: "products", 
        name: "AdminProducts",
        component: AdminProducts 
      },
      {
        path: "products/pending",
        name: "AdminProductsPending",
        component: AdminProducts,
        props: { initialStatus: "pending_review" },
      },
      { 
        path: "sellers", 
        name: "AdminSellers",
        component: AdminSellers 
      },
      {
        path: "sellers/applications",
        name: "AdminSellersApplications",
        component: AdminSellers,
        props: { showApplications: true },
      },
      { 
        path: "orders", 
        name: "AdminOrders",
        component: AdminOrders 
      },
      { 
        path: "commission", 
        name: "AdminCommission",
        component: AdminCommission 
      },
      { 
        path: "cod-commissions", 
        name: "AdminCODCommissions",
        component: AdminCODCommissions 
      },
      { 
        path: "pending-sellers", 
        name: "AdminPendingSellers",
        component: AdminPendingSellers 
      },
      { 
        path: "categories", 
        name: "AdminCategories",
        component: AdminCategories 
      },
      { 
        path: "municipalities", 
        name: "AdminMunicipalities",
        component: AdminMunicipalities 
      },
      { 
        path: "banners", 
        name: "AdminBanners",
        component: AdminBanners 
      },
      { 
        path: "product-banners", 
        name: "ProductBannerAdmin",
        component: ProductBannerAdmin 
      },
      { 
        path: "announcements", 
        name: "AdminAnnouncements",
        component: AdminAnnouncements 
      },
      { 
        path: "refunds", 
        name: "AdminRefunds",
        component: AdminRefunds 
      },
      {
        path: "withdrawals/history",
        name: "AdminWithdrawalsHistory",
        component: AdminWithdrawals,
        props: { initialTab: "history" },
      },
      { 
        path: "withdrawals", 
        name: "AdminWithdrawals",
        component: AdminWithdrawals 
      },
      { 
        path: "subscriptions", 
        name: "AdminSubscriptions",
        component: AdminSubscriptions 
      },
      { 
        path: "audit-logs", 
        name: "AdminAuditLogs",
        component: AdminAuditLogs 
      },
      { 
        path: "settings", 
        name: "AdminSettings",
        component: AdminSettings 
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(async (resolve) => {
      await nextTick();

      requestAnimationFrame(() => {
        if (savedPosition) {
          resolve({
            left: savedPosition.left,
            top: savedPosition.top,
            behavior: "smooth",
          });
        } else {
          resolve({ top: 0, behavior: "smooth" });
        }
      });
    });
  },
});

/**
 * Get role-based redirect path
 * @param {Object} user - User object with role property
 * @returns {string} Redirect path
 */
const getRoleBasedPath = (user) => {
  if (!user?.role) return "/products";
  
  switch (user.role) {
    case "admin":
      return "/admin";
    case "vendor":
      return "/vendor/dashboard";
    case "customer":
    default:
      return "/products";
  }
};

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  console.log("🔄 Navigation:", {
    from: from.path,
    to: to.path,
    authenticated: auth.isAuthenticated,
    role: auth.user?.role,
    authChecked: auth.authChecked
  });

  // Wait for auth check to complete
  if (!auth.authChecked) {
    console.log("⏳ Checking authentication...");
    await auth.fetchSession();
  }

  // Handle authenticated users accessing auth pages (login/signup)
  if (to.meta.authPage && auth.isAuthenticated) {
    const redirectPath = getRoleBasedPath(auth.user);
    console.log("✅ Authenticated user on auth page, redirecting to:", redirectPath);
    return next(redirectPath);
  }

  // Handle root path "/" - redirect based on role
  if (to.path === "/" && auth.isAuthenticated) {
    const redirectPath = getRoleBasedPath(auth.user);
    console.log("🏠 Root path redirect for authenticated user:", redirectPath);
    return next(redirectPath);
  }

  // Allow public routes
  if (to.meta.public || !to.meta.requiresAuth) {
    console.log("🌐 Public route, allowing access");
    return next();
  }

  // Require authentication for protected routes
  if (!auth.isAuthenticated) {
    console.log("🔒 Protected route requires authentication, redirecting to login");
    return next("/login");
  }

  // Protect vendor routes
  if (to.meta.requiresVendor) {
    if (auth.user?.role !== "vendor") {
      const redirectPath = getRoleBasedPath(auth.user);
      console.log("⛔ Vendor route access denied, redirecting to:", redirectPath);
      return next(redirectPath);
    }
    console.log("✅ Vendor access granted");
  }

  // Protect admin routes
  if (to.meta.requiresAdmin) {
    if (auth.user?.role !== "admin") {
      const redirectPath = getRoleBasedPath(auth.user);
      console.log("⛔ Admin route access denied, redirecting to:", redirectPath);
      return next(redirectPath);
    }
    console.log("✅ Admin access granted");
  }

  // Legacy protection - catch any vendor paths without proper meta
  if (to.path.startsWith("/vendor") && !to.meta.requiresVendor) {
    if (auth.user?.role !== "vendor") {
      const redirectPath = getRoleBasedPath(auth.user);
      console.log("⚠️ Legacy vendor path protection, redirecting to:", redirectPath);
      return next(redirectPath);
    }
  }

  // Allow navigation
  console.log("✅ Navigation allowed");
  next();
});

// Optional: Add navigation error handler
router.onError((error) => {
  console.error("❌ Router error:", error);
});

export default router;