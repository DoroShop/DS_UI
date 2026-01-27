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
const AdminAnnouncements = () =>
  import("../views/admin/AdminAnnouncements.vue");
const AdminRefunds = () => import("../views/admin/AdminRefunds.vue");
const AdminAuditLogs = () => import("../views/admin/AdminAuditLogs.vue");
const AdminWithdrawals = () => import("../views/admin/AdminWithdrawals.vue");
const AdminSettings = () => import("../views/admin/AdminSettings.vue");
const AdminSubscriptions = () =>
  import("../views/admin/AdminSubscriptions.vue");

const routes = [
  { path: "/", redirect: "/products" },
  { path: "/products", component: Home },

  {
    path: "/signup",
    component: AuthPage,
    meta: { public: true, authPage: true,  hideMobileNav: true },
  },
  {
    path: "/login",
    component: AuthPage,
    meta: { public: true, authPage: true, hideMobileNav: true },
  },

  // User
  { path: "/user/me", component: Profile, meta: { requiresAuth: true } },
  {
    path: "/messages",
    component: CustomerMessages,
    meta: { requiresAuth: true },
  },
  {
    path: "/message/:chatId",
    component: ChatView,
    meta: { requiresAuth: true },
  },
  { path: "/cart", component: Cart, meta: { requiresAuth: true } },
  { path: "/orders", component: Orders, meta: { requiresAuth: true } },
  {
    path: "/products/search",
    component: Search,
    meta: { requiresAuth: true, hideMobileNav: true },
  },
  {
    path: "/search/result",
    component: ProductSearchResult,
    meta: { requiresAuth: true, hideMobileNav: true },
  },
  {
    path: "/product/:id",
    component: ViewProduct,
    meta: { requiresAuth: true, hideMobileNav: true },
  },
  {
    path: "/view/vendor/:id",
    component: ViewSeller,
    meta: { requiresAuth: true, hideMobileNav: true },
  },

  {
    path: "/shops/nearby",
    name: "NearbyShops",
    component: NearbyShops,
    meta: { requiresAuth: true, hideMobileNav: true },
  },

  // Vendor
  {
    path: "/vendor/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true, hideMobileNav: true },
  },
  {
    path: "/vendor/commissions",
    name: "VendorCommissions",
    component: VendorCommissions,
    meta: { requiresAuth: true, hideMobileNav: true },
  },

  // Notifications
  {
    path: "/notifications",
    name: "Notifications",
    component: Notifications,
    meta: { requiresAuth: true },
  },

  // Admin
  {
    path: "/admin",
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true, hideMobileNav: true },
    children: [
      { path: "", component: AdminDashboard },
      { path: "dashboard", component: AdminDashboard },
      { path: "users", component: AdminUsers },
      { path: "products", component: AdminProducts },
      {
        path: "products/pending",
        component: AdminProducts,
        props: { initialStatus: "pending_review" },
      },
      { path: "sellers", component: AdminSellers },
      {
        path: "sellers/applications",
        component: AdminSellers,
        props: { showApplications: true },
      },
      { path: "orders", component: AdminOrders },
      { path: "commission", component: AdminCommission },
      { path: "cod-commissions", component: AdminCODCommissions },
      { path: "pending-sellers", component: AdminPendingSellers },
      { path: "categories", component: AdminCategories },
      { path: "municipalities", component: AdminMunicipalities },
      { path: "banners", component: AdminBanners },
      { path: "announcements", component: AdminAnnouncements },
      { path: "refunds", component: AdminRefunds },
      {
        path: "withdrawals/history",
        name: "AdminWithdrawalsHistory",
        component: AdminWithdrawals,
        props: { initialTab: "history" },
      },
      { path: "withdrawals", component: AdminWithdrawals },
      { path: "subscriptions", component: AdminSubscriptions },
      { path: "audit-logs", component: AdminAuditLogs },
      { path: "settings", component: AdminSettings },
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

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore();

  if (!auth.authChecked) {
    await auth.fetchSession();
  }

  if (to.meta.authPage && auth.isAuthenticated) {
    return next("/");
  }

  if (to.meta.public || !to.meta.requiresAuth) {
    return next();
  }

  if (!auth.isAuthenticated) {
    return next("/signup");
  }

  if (to.path.startsWith("/vendor") && auth.user?.role !== "vendor") {
    return next("/");
  }

  if (to.meta.requiresAdmin && auth.user?.role !== "admin") {
    return next("/");
  }

  next();
});

export default router;
