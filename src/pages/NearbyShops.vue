<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../composables/useTheme";
import {
  MapPinIcon,
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  StarIcon,
  MapIcon,
  ListBulletIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  UserGroupIcon,
} from "@heroicons/vue/24/outline";
import { MapPinIcon as MapPinSolidIcon } from "@heroicons/vue/24/solid";

type ShopAddress = { city?: string; province?: string; barangay?: string; street?: string };
type Shop = {
  _id: string;
  storeName?: string;
  description?: string;
  imageUrl?: string;
  rating?: number;
  followersCount?: number;
  address?: ShopAddress;
  location?: { coordinates: [number, number] };
  distance?: number;
  isFeatured?: boolean;
};

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const router = useRouter();
const { isDark } = useTheme();

const MINDORO_CENTER: [number, number] = [13.05, 121.2];
const MINDORO_ZOOM = 9;
const FIXED_NEARBY_RADIUS_METERS = 50_000;

const shops = ref<Shop[]>([]);
const isLoading = ref(false);
const error = ref("");
const searchQuery = ref("");

const userLocation = ref<{ lat: number; lng: number } | null>(null);
const userAccuracy = ref<number | null>(null);
const isGettingLocation = ref(false);
const locationError = ref("");
const locationEnabled = ref(false);

const mapContainer = ref<HTMLDivElement | null>(null);
const map = ref<L.Map | null>(null);

const markersLayer = ref<L.LayerGroup | null>(null);
const markerById = ref(new Map<string, L.Marker>());

const userMarker = ref<L.Marker | null>(null);
const userAccuracyCircle = ref<L.Circle | null>(null);

const routeLine = ref<L.Polyline | null>(null);
const routeLoading = ref(false);
const routeError = ref("");
const routeInfo = ref<{ distance: number; duration: number } | null>(null);

const trackedShopId = ref<string | null>(null);
const lastRoutedFrom = ref<{ lat: number; lng: number } | null>(null);
const lastRoutedShopId = ref<string | null>(null);

const routeIntervalId = ref<number | null>(null);
let routeAbort: AbortController | null = null;

const viewMode = ref<"map" | "list">("map");
const selectedShop = ref<Shop | null>(null);

const geoWatchId = ref<number | null>(null);
const liveTracking = ref(false);

const themeClass = computed(() => (isDark.value ? "is-dark" : "is-light"));

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const addDistanceToShops = () => {
  if (!userLocation.value) return;
  const { lat: uLat, lng: uLng } = userLocation.value;
  shops.value = shops.value.map((s) => {
    const coords = s.location?.coordinates;
    if (!coords) return s;
    const [lng, lat] = coords;
    const d = calculateDistance(uLat, uLng, lat, lng);
    return { ...s, distance: Math.round(d) };
  });
};

const filteredShops = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return shops.value;

  return shops.value.filter((shop) => {
    const name = (shop.storeName || "").toLowerCase();
    const city = (shop.address?.city || "").toLowerCase();
    const prov = (shop.address?.province || "").toLowerCase();
    return name.includes(q) || city.includes(q) || prov.includes(q);
  });
});

const sortedShops = computed(() => {
  const list = [...filteredShops.value];
  // Featured sellers first, then sort by distance
  list.sort((a, b) => {
    const aFeat = a.isFeatured ? 0 : 1;
    const bFeat = b.isFeatured ? 0 : 1;
    if (aFeat !== bFeat) return aFeat - bFeat;
    return (a.distance ?? 9e15) - (b.distance ?? 9e15);
  });
  return list;
});

const formatDistance = (meters?: number) => {
  if (meters === undefined || meters === null) return "";
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

const formatDuration = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return `${h}h ${r}m`;
};

const getPrimaryColor = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--primary-color").trim();
  return v || "#2563eb";
};

const clearRouteOnly = () => {
  routeError.value = "";
  routeInfo.value = null;
  lastRoutedFrom.value = null;
  lastRoutedShopId.value = null;

  if (routeAbort) {
    routeAbort.abort();
    routeAbort = null;
  }

  if (routeLine.value && map.value) {
    map.value.removeLayer(routeLine.value);
  }
  routeLine.value = null;
};

const stopRouteTracking = () => {
  trackedShopId.value = null;
  if (routeIntervalId.value) {
    window.clearInterval(routeIntervalId.value);
    routeIntervalId.value = null;
  }
  clearRouteOnly();
};

const addUserMarker = () => {
  if (!map.value || !userLocation.value) return;

  if (userMarker.value) {
    map.value.removeLayer(userMarker.value);
    userMarker.value = null;
  }
  if (userAccuracyCircle.value) {
    map.value.removeLayer(userAccuracyCircle.value);
    userAccuracyCircle.value = null;
  }

  const userIcon = L.divIcon({
    className: "user-location-icon",
    html: `
      <div class="u-pin" aria-hidden="true">
        <span class="u-pulse"></span>
        <span class="u-dot"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
    icon: userIcon,
    zIndexOffset: 9999,
  }).addTo(map.value);

  userMarker.value.bindPopup("Your location");

  if (typeof userAccuracy.value === "number" && Number.isFinite(userAccuracy.value)) {
    userAccuracyCircle.value = L.circle([userLocation.value.lat, userLocation.value.lng], {
      radius: Math.max(10, Math.min(2000, userAccuracy.value)),
      color: getPrimaryColor(),
      weight: 1,
      opacity: 0.35,
      fillColor: getPrimaryColor(),
      fillOpacity: 0.08,
    }).addTo(map.value);
  }
};

const setSelectedMarkerVisual = (shopId: string | null) => {
  markerById.value.forEach((m) => {
    const el = m.getElement();
    const pin = el?.querySelector(".pin") as HTMLElement | null;
    if (pin) pin.classList.remove("is-selected");
  });

  if (!shopId) return;

  const m = markerById.value.get(shopId);
  const el = m?.getElement();
  const pin = el?.querySelector(".pin") as HTMLElement | null;
  if (pin) pin.classList.add("is-selected");
};

const updateMapMarkers = () => {
  if (!map.value || !markersLayer.value) return;

  markersLayer.value.clearLayers();
  markerById.value = new Map();

  const primary = getPrimaryColor();
  const useLightMarkers = shops.value.length > 350;

  for (const shop of shops.value) {
    const coords = shop.location?.coordinates;
    if (!coords) continue;

    const [lng, lat] = coords;

    if (useLightMarkers) {
      const cm = L.circleMarker([lat, lng], {
        radius: 7,
        color: primary,
        weight: 2,
        fillColor: primary,
        fillOpacity: 0.25,
      }).addTo(markersLayer.value!);

      cm.on("click", () => selectShop(shop));
      continue;
    }

    const name = shop.storeName || "Shop";
    const isFeat = shop.isFeatured;
    const ringColor = isFeat ? '#f59e0b' : primary;
    const html = `
      <div class="pin-wrap${isFeat ? ' is-featured' : ''}" data-shop="${shop._id}">
        <div class="pin">
          ${isFeat ? '<span class="feat-star">★</span>' : ''}
          <div class="avatar" style="--ring:${ringColor}">
            ${shop.imageUrl
        ? `<img src="${shop.imageUrl}" alt="${name}" />`
        : `<div class="fallback" aria-hidden="true"></div>`
      }
          </div>
          <div class="tip" style="--ring:${ringColor}"></div>
        </div>
        <div class="label">${isFeat ? '⭐ ' : ''}${name}</div>
      </div>
    `;

    const icon = L.divIcon({
      className: "shop-marker-wrap",
      html,
      iconSize: [56, 74],
      iconAnchor: [28, 64],
      popupAnchor: [0, -62],
    });

    const marker = L.marker([lat, lng], { icon, riseOnHover: true, keyboard: false });
    marker.on("click", () => selectShop(shop));
    marker.addTo(markersLayer.value!);
    markerById.value.set(shop._id, marker);
  }

  if (selectedShop.value?._id) setSelectedMarkerVisual(selectedShop.value._id);
};

const selectShop = (shop: Shop) => {
  selectedShop.value = shop;
  setSelectedMarkerVisual(shop._id);

  if (map.value && shop.location?.coordinates) {
    const [lng, lat] = shop.location.coordinates;
    map.value.setView([lat, lng], 15, { animate: true });
  }
};

const goToShop = (shop: Shop) => router.push(`/view/vendor/${shop._id}`);

const shouldUpdateRoute = () => {
  if (!userLocation.value) return false;
  if (!lastRoutedFrom.value) return true;
  const moved = calculateDistance(
    lastRoutedFrom.value.lat,
    lastRoutedFrom.value.lng,
    userLocation.value.lat,
    userLocation.value.lng
  );
  return moved >= 40;
};

const openDirections = async (shop: Shop, opts?: { silent?: boolean; keepViewport?: boolean }) => {
  if (!shop?.location?.coordinates) return;

  if (!userLocation.value) {
    if (!opts?.silent) locationError.value = "Enable location to get directions.";
    enableLocation(true);
    return;
  }

  const sameTarget = lastRoutedShopId.value === shop._id;
  if (sameTarget && trackedShopId.value === shop._id && !shouldUpdateRoute()) return;

  routeError.value = "";
  routeLoading.value = true;

  if (routeAbort) routeAbort.abort();
  routeAbort = new AbortController();

  try {
    const [lng, lat] = shop.location.coordinates;
    const start = `${userLocation.value.lng},${userLocation.value.lat}`;
    const end = `${lng},${lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`;

    const res = await fetch(url, { signal: routeAbort.signal });
    const data = await res.json();

    if (!data || data.code !== "Ok" || !data.routes?.length) throw new Error("No route found");

    const r = data.routes[0];
    const coords = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]) as [number, number][];
    routeInfo.value = { distance: r.distance, duration: r.duration };
    lastRoutedFrom.value = { ...userLocation.value };
    lastRoutedShopId.value = shop._id;

    if (routeLine.value && map.value) map.value.removeLayer(routeLine.value);

    routeLine.value = L.polyline(coords, {
      color: getPrimaryColor(),
      weight: 5,
      opacity: 0.92,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map.value!);

    if (!opts?.keepViewport) {
      const bounds = routeLine.value.getBounds();
      map.value?.fitBounds(bounds, { padding: [56, 56], animate: true });
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return;
    routeError.value = err?.message || "Failed to fetch route";
  } finally {
    routeLoading.value = false;
  }
};

const startRouteTracking = async (shop: Shop) => {
  if (!shop?.location?.coordinates) return;

  stopRouteTracking();
  trackedShopId.value = shop._id;

  await openDirections(shop);

  if (routeIntervalId.value) window.clearInterval(routeIntervalId.value);
  routeIntervalId.value = window.setInterval(() => {
    if (trackedShopId.value !== shop._id) return;
    openDirections(shop, { silent: true, keepViewport: true });
  }, 45000);
};

const startLiveTracking = () => {
  if (!navigator.geolocation || geoWatchId.value !== null) return;

  liveTracking.value = true;
  geoWatchId.value = navigator.geolocation.watchPosition(
    (pos) => {
      userLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      userAccuracy.value = pos.coords.accuracy ?? null;
      locationEnabled.value = true;

      addUserMarker();
      addDistanceToShops();

      if (trackedShopId.value && selectedShop.value?._id === trackedShopId.value) {
        openDirections(selectedShop.value, { silent: true, keepViewport: true });
      }
    },
    (e) => {
      liveTracking.value = false;
      geoWatchId.value = null;
      locationError.value = e.message || "Live tracking failed.";
    },
    { enableHighAccuracy: false, maximumAge: 1200, timeout: 20000 }
  );
};

const stopLiveTracking = () => {
  liveTracking.value = false;
  if (geoWatchId.value !== null) {
    navigator.geolocation.clearWatch(geoWatchId.value);
    geoWatchId.value = null;
  }
};

const enableLocation = (alsoLive = false) => {
  if (!navigator.geolocation) {
    locationError.value = "Geolocation is not supported by your browser.";
    return;
  }

  isGettingLocation.value = true;
  locationError.value = "";

  const tryGet = (highAccuracy: boolean, retried = false) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userAccuracy.value = pos.coords.accuracy ?? null;
        locationEnabled.value = true;
        isGettingLocation.value = false;

        if (map.value) map.value.setView([userLocation.value.lat, userLocation.value.lng], 13, { animate: true });

        addUserMarker();
        addDistanceToShops();
        fetchNearbyShops();

        if (alsoLive) startLiveTracking();
      },
      (e) => {
        if (highAccuracy && !retried && e.code === e.TIMEOUT) return tryGet(false, true);
        isGettingLocation.value = false;
        switch (e.code) {
          case e.PERMISSION_DENIED:
            locationError.value = "Location denied. Enable it in browser settings.";
            break;
          case e.POSITION_UNAVAILABLE:
            locationError.value = "Location unavailable. Try again.";
            break;
          case e.TIMEOUT:
            locationError.value = "Location timed out. Try again.";
            break;
          default:
            locationError.value = "Unable to get your location.";
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 20000 : 35000, maximumAge: 10000 }
    );
  };

  tryGet(true);
};

const disableLocation = () => {
  stopLiveTracking();
  stopRouteTracking();

  userLocation.value = null;
  userAccuracy.value = null;
  locationEnabled.value = false;

  if (userMarker.value && map.value) {
    map.value.removeLayer(userMarker.value);
    userMarker.value = null;
  }
  if (userAccuracyCircle.value && map.value) {
    map.value.removeLayer(userAccuracyCircle.value);
    userAccuracyCircle.value = null;
  }

  if (map.value) map.value.setView(MINDORO_CENTER, MINDORO_ZOOM, { animate: true });
  fetchShopsWithLocation();
};

const fetchShopsWithLocation = async () => {
  isLoading.value = true;
  error.value = "";

  try {
    const res = await axios.get(`${API_BASE_URL}/api/shops/with-location`);
    if (!res.data?.success) throw new Error("Failed to fetch shops");

    shops.value = (res.data.shops || []) as Shop[];
    if (userLocation.value) addDistanceToShops();

    requestAnimationFrame(() => updateMapMarkers());
  } catch (err: any) {
    error.value = err?.response?.data?.error || err?.message || "Failed to fetch shops";
  } finally {
    isLoading.value = false;
  }
};

const fetchNearbyShops = async () => {
  if (!userLocation.value) return;

  isLoading.value = true;
  error.value = "";

  try {
    const res = await axios.get(`${API_BASE_URL}/api/shops/nearby`, {
      params: {
        lat: userLocation.value.lat,
        lng: userLocation.value.lng,
        maxDistance: FIXED_NEARBY_RADIUS_METERS,
        limit: 120,
      },
    });

    if (!res.data?.success) throw new Error("Failed to fetch nearby shops");
    shops.value = (res.data.shops || []) as Shop[];

    if (shops.value.some((s) => s.distance === undefined)) addDistanceToShops();
    requestAnimationFrame(() => updateMapMarkers());
  } catch (err: any) {
    error.value = err?.response?.data?.error || err?.message || "Failed to fetch nearby shops";
  } finally {
    isLoading.value = false;
  }
};

const initMap = async () => {
  await nextTick();
  if (!mapContainer.value || map.value) return;

  map.value = L.map(mapContainer.value, {
    center: MINDORO_CENTER,
    zoom: MINDORO_ZOOM,
    zoomControl: true,
    preferCanvas: true,
    inertia: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
    updateWhenZooming: false,
    updateWhenIdle: true,
    keepBuffer: 4,
  }).addTo(map.value);

  markersLayer.value = L.layerGroup().addTo(map.value);
  requestAnimationFrame(() => updateMapMarkers());
};

watch(
  () => viewMode.value,
  async (v) => {
    if (v !== "map") return;
    await nextTick();
    window.setTimeout(() => map.value?.invalidateSize({ animate: false }), 80);
    if (selectedShop.value?._id) setSelectedMarkerVisual(selectedShop.value._id);
  }
);

onMounted(async () => {
  await fetchShopsWithLocation();
  await initMap();
});

onUnmounted(() => {
  stopLiveTracking();
  stopRouteTracking();
  if (map.value) {
    map.value.remove();
    map.value = null;
  }
});
</script>

<template>
  <section class="tracker" :class="themeClass">
    <header class="top">
      <div class="container">
        <div class="row">
          <button class="back-button" @click="router.back()" aria-label="Go back">
            <ChevronLeftIcon class="i" />
          </button>

          <div class="title">
            <h1>Nearby Shops</h1>
            <p>Discover stores around you</p>
          </div>


        </div>

        <div class="subbar">

          <div class="view">

            <button class="seg" :class="{ active: viewMode === 'map' }" @click="viewMode = 'map'">
              <MapIcon class="i" /> Map
            </button>
            <button class="seg" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
              <ListBulletIcon class="i" /> List
            </button>
          
              <button class="btn" :class="{ primary: !locationEnabled, success: locationEnabled }"
                @click="locationEnabled ? disableLocation() : enableLocation(false)" :disabled="isGettingLocation">
                <MapPinIcon v-if="!locationEnabled" class="i" />
                <MapPinSolidIcon v-else class="i" />
                <span>{{ isGettingLocation ? "Locating..." : locationEnabled ? "Location On" : "Enable" }}</span>
              </button>

              <button v-if="locationEnabled" class="btn ghost" :class="{ on: liveTracking }"
                @click="liveTracking ? stopLiveTracking() : startLiveTracking()">
                <span class="dot" :class="{ live: liveTracking }"></span>
                <span>{{ liveTracking ? "Live" : "Static" }}</span>
              </button>

              <!-- <button class="icon-btn" :disabled="isLoading"
                @click="locationEnabled ? fetchNearbyShops() : fetchShopsWithLocation()" aria-label="Refresh">
                <ArrowPathIcon class="i" :class="{ spin: isLoading }" />
              </button> -->
      
          </div>



          <div v-if="viewMode === 'list'" class="search">
            <MagnifyingGlassIcon class="i" />
            <input v-model.trim="searchQuery" type="text" placeholder="Search name, city, province..." />
            <button v-if="searchQuery" class="clear" @click="searchQuery = ''" aria-label="Clear">
              <XMarkIcon class="i" />
            </button>
          </div>
        </div>

        <div v-if="locationError" class="banner error" role="alert">
          <ExclamationTriangleIcon class="i" />
          <span class="t">{{ locationError }}</span>
          <button class="x" @click="locationError = ''" aria-label="Dismiss">
            <XMarkIcon class="i" />
          </button>
        </div>
      </div>
    </header>

    <main class="content">
      <div class="container">
        <div v-if="isLoading && shops.length === 0" class="state">
          <div class="loader"></div>
          <p>Loading shops...</p>
        </div>

        <div v-else-if="error && shops.length === 0" class="state">
          <ExclamationTriangleIcon class="big" />
          <h3>Something went wrong</h3>
          <p>{{ error }}</p>
          <button class="btn primary" @click="fetchShopsWithLocation()">Try Again</button>
        </div>

        <div v-else-if="!isLoading && shops.length === 0" class="state">
          <BuildingStorefrontIcon class="big" />
          <h3>No shops found</h3>
          <p v-if="locationEnabled">No shops near your location.</p>
          <p v-else>No shops have registered their location yet.</p>
        </div>

        <template v-else>
          <div v-show="viewMode === 'map'" class="map-shell">
            <div ref="mapContainer" class="map" aria-label="Map showing seller shops"></div>

            <div v-if="selectedShop" class="panel" role="dialog" aria-label="Selected shop">
              <button class="panel-x" @click="
                selectedShop = null;
              setSelectedMarkerVisual(null);
              stopRouteTracking();
              " aria-label="Close">
                <XMarkIcon class="i" />
              </button>

              <div class="panel-main">
                <div class="thumb">
                  <img v-if="selectedShop.imageUrl" :src="selectedShop.imageUrl" :alt="selectedShop.storeName" />
                  <div v-else class="thumb-fallback">
                    <BuildingStorefrontIcon class="i" />
                  </div>
                </div>

                <div class="info">
                  <div v-if="selectedShop.isFeatured" class="featured-badge">
                    <span class="featured-badge__star">★</span> Featured Seller
                  </div>
                  <h3 class="name">{{ selectedShop.storeName || "Shop" }}</h3>

                  <div class="meta">
                    <span v-if="selectedShop.distance !== undefined" class="chip">
                      <MapPinIcon class="i" /> {{ formatDistance(selectedShop.distance) }}
                    </span>
                    <span v-if="(selectedShop.rating || 0) > 0" class="chip">
                      <StarIcon class="i" /> {{ (selectedShop.rating || 0).toFixed(1) }}
                    </span>
                    <span class="chip">
                      <UserGroupIcon class="i" /> {{ selectedShop.followersCount || 0 }}
                    </span>
                  </div>

                  <div class="actions2">
                    <button class="btn ghost" :disabled="routeLoading"
                      @click="trackedShopId === selectedShop._id ? stopRouteTracking() : startRouteTracking(selectedShop)">
                      <span v-if="routeLoading" class="mini-loader" aria-hidden="true"></span>
                      <span v-else>{{ trackedShopId === selectedShop._id ? "Stop Tracking" : "Track" }}</span>
                    </button>

                    <button class="btn primary" @click="goToShop(selectedShop)">Visit</button>
                  </div>

                  <div v-if="routeInfo && trackedShopId === selectedShop._id" class="route">
                    <span>ETA {{ formatDuration(routeInfo.duration) }}</span>
                    <span class="sep">•</span>
                    <span>{{ formatDistance(routeInfo.distance) }}</span>
                    <span v-if="liveTracking" class="sep">•</span>
                    <span v-if="liveTracking">Live</span>
                  </div>

                  <p v-if="routeError" class="route-err">{{ routeError }}</p>
                </div>
              </div>
            </div>
          </div>

          <div v-show="viewMode === 'list'" class="list">
            <div class="list-head">
              <div class="count">
                <span class="n">{{ sortedShops.length }}</span>
                <span class="s">shop{{ sortedShops.length !== 1 ? "s" : "" }}</span>
                <span v-if="locationEnabled" class="hint">sorted by distance</span>
              </div>
            </div>

            <div class="grid">
              <button v-for="shop in sortedShops" :key="shop._id" class="card" :class="{ 'card--featured': shop.isFeatured }" @click="
                selectShop(shop);
              viewMode = 'map';
              " type="button">
                <div class="card-media">
                  <img v-if="shop.imageUrl" :src="shop.imageUrl" :alt="shop.storeName" />
                  <div v-else class="media-fallback">
                    <BuildingStorefrontIcon class="i" />
                  </div>
                  <span v-if="shop.distance !== undefined" class="badge">{{ formatDistance(shop.distance) }}</span>
                  <span v-if="shop.isFeatured" class="badge badge--featured">★ Featured</span>
                </div>

                <div class="card-body">
                  <h3>{{ shop.storeName || "Shop" }}</h3>
                  <p class="addr" v-if="shop.address">
                    {{ [shop.address.city, shop.address.province].filter(Boolean).join(", ") || "Location not specified"
                    }}
                  </p>

                  <div class="row2">
                    <span v-if="(shop.rating || 0) > 0" class="mini">
                      <StarIcon class="i" /> {{ (shop.rating || 0).toFixed(1) }}
                    </span>
                    <span class="mini">
                      <UserGroupIcon class="i" /> {{ shop.followersCount || 0 }}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </template>
      </div>
    </main>
  </section>
</template>

<style scoped>
.tracker {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text-primary);
}

.container {
  max-width: 1120px;
  margin: 0 auto;
}

.top {
  position: sticky;
  top: 0;
  z-index: 2000;
  padding: 12px;
  background: color-mix(in oklab, var(--surface) 92%, transparent);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
}

.row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.title {
  min-width: 0;
  flex: 1;
}

.title h1 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.title p {
  margin: 2px 0 0;
  font-size: 0.88rem;
  color: var(--text-secondary);
  font-weight: 650;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.subbar {
  margin-top: 10px;
  display: grid;
  gap: 10px;
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
  border-radius: 12px;
}

.back-button:hover {
  background: var(--surface-hover);
  color: var(--primary-color);
}

.back-button .i {
  width: 1.25rem;
  height: 1.25rem;
}

.i {
  width: 18px;
  height: 18px;
}

.btn {
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg);
  color: var(--text-primary);
  font-weight: 900;
  cursor: pointer;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn.primary {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.btn.success {
  border-color: rgba(34, 197, 94, 0.55);
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.btn.ghost {
  background: var(--surface);
}

.btn.ghost.on {
  border-color: var(--primary-color);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.8);
}

.dot.live {
  background: #22c55e;
  box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.14);
}

.view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.seg {
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg);
  color: var(--text-primary);
  font-weight: 900;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.seg.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.search {
  position: relative;
}

.search .i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
}

.search input {
  width: 100%;
  height: 46px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg);
  color: var(--text-primary);
  font-weight: 700;
  padding: 0 44px 0 42px;
  outline: none;
}

.search input:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}

.clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.banner {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--bg);
}

.banner.error {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.banner .t {
  flex: 1;
  font-weight: 800;
  font-size: 0.9rem;
}

.banner .x {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
  color: inherit;
}

.content {
  padding: 12px;
}

.state {
  min-height: 60dvh;
  border: 1px solid var(--border-color);
  background: var(--surface);
  border-radius: 18px;
  display: grid;
  place-items: center;
  gap: 10px;
  text-align: center;
  padding: 20px;
}

.state p {
  margin: 0;
  color: var(--text-secondary);
  font-weight: 650;
}

.state h3 {
  margin: 0;
  font-weight: 950;
}

.big {
  width: 64px;
  height: 64px;
  color: var(--text-secondary);
}

.loader {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 4px solid rgba(148, 163, 184, 0.35);
  border-top-color: var(--primary-color);
  animation: spin 1s linear infinite;
}

.mini-loader {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.map-shell {
  border: 1px solid var(--border-color);
  background: var(--surface);
  border-radius: 18px;
  overflow: hidden;
  min-height: 72dvh;
  position: relative;
}

.map {
  width: 100%;
  height: 72dvh;
  z-index: 1;
}

.panel {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 5000;
  pointer-events: auto;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
  padding: 12px;
}

.is-dark .panel {
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.86));
}

.panel-x {
  position: absolute;
  right: 10px;
  top: 10px;
  width: 36px;
  height: 36px;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--bg);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--surfacex);
}

.panel-main {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 12px;
}

.thumb {
  width: 84px;
  height: 84px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background: var(--bg);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.info {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 950;
  letter-spacing: -0.02em;
}

.meta {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg);
  color: var(--text-secondary);
  font-weight: 900;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 0.82rem;
}

.chip .i {
  width: 16px;
  height: 16px;
}

.actions2 {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.route {
  margin-top: 10px;
  color: var(--text-secondary);
  font-weight: 900;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.88rem;
}

.sep {
  opacity: 0.7;
}

.route-err {
  margin: 8px 0 0;
  color: #dc2626;
  font-weight: 800;
  font-size: 0.88rem;
}

/* List */
.list {
  border: 1px solid var(--border-color);
  background: var(--surface);
  border-radius: 18px;
  overflow: hidden;
}

.list-head {
  padding: 12px;
  border-bottom: 1px solid var(--border-color);
}

.count {
  display: flex;
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
}

.count .n {
  font-weight: 1000;
  font-size: 1.1rem;
}

.count .s {
  font-weight: 900;
  color: var(--text-secondary);
}

.count .hint {
  font-weight: 900;
  color: var(--primary-color);
  font-size: 0.85rem;
}

.grid {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.card {
  border: 1px solid var(--border-color);
  border-radius: 16px;
  overflow: hidden;
  background: var(--bg);
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklab, var(--primary-color) 40%, var(--border-color));
}

.card-media {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--surface);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
}

.badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.78);
  color: white;
  font-weight: 900;
  font-size: 0.8rem;
}

.card-body {
  padding: 12px;
}

.card-body h3 {
  margin: 0;
  font-weight: 950;
  font-size: 0.95rem;
  line-height: 1.2;
}

.addr {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-weight: 650;
  font-size: 0.85rem;
}

.row2 {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mini {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  color: var(--text-secondary);
  font-weight: 900;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 0.78rem;
}

.mini .i {
  width: 16px;
  height: 16px;
}

@media (min-width: 768px) {
  .subbar {
    grid-template-columns: 1fr 1.2fr;
    align-items: center;
  }

  .grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 12px;
  }

  .panel {
    left: 16px;
    right: auto;
    width: 520px;
    bottom: max(16px, env(safe-area-inset-bottom));
  }

  .map,
  .map-shell {
    height: 78dvh;
    min-height: 78dvh;
  }
}

@media (prefers-reduced-motion: reduce) {

  .icon-btn,
  .btn,
  .card {
    transition: none !important;
  }

  .loader,
  .mini-loader,
  .spin {
    animation: none !important;
  }
}

/* Leaflet */
:deep(.leaflet-container) {
  z-index: 1;
}

:deep(.leaflet-pane) {
  z-index: 200;
}

:deep(.leaflet-top),
:deep(.leaflet-bottom) {
  z-index: 800;
}

:deep(.leaflet-control) {
  z-index: 900;
}

:deep(.leaflet-popup) {
  z-index: 1200;
}

/* Hide global mobile navigation on small screens for this page */
@media (max-width: 840px) {
  :deep(.mobile-nav) {
    display: none !important;
  }
}

:deep(.leaflet-control-zoom a) {
  border-radius: 12px !important;
  border: 1px solid var(--border-color) !important;
  background: var(--surface) !important;
  color: var(--text-primary) !important;
}

/* USER marker */
:deep(.user-location-icon) {
  background: transparent;
  border: none;
}

:deep(.u-pin) {
  width: 24px;
  height: 24px;
  position: relative;
}

:deep(.u-pulse) {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.25);
  animation: pulse 1.8s ease-out infinite;
}

:deep(.u-dot) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--primary-color);
  border: 2px solid white;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
}

@keyframes pulse {
  0% {
    transform: scale(0.6);
    opacity: 0.45;
  }

  100% {
    transform: scale(2.1);
    opacity: 0;
  }
}

/* SHOP markers */
:deep(.shop-marker-wrap) {
  background: transparent !important;
  border: none !important;
}

:deep(.shop-marker-wrap.leaflet-marker-icon) {
  will-change: transform;
}

:deep(.pin-wrap) {
  width: 56px;
  height: 74px;
  position: relative;
  display: grid;
  place-items: center;
}

:deep(.pin) {
  position: absolute;
  left: 50%;
  top: 4px;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  gap: 4px;
}

:deep(.avatar) {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 3px solid var(--ring, var(--primary-color));
  background: #fff;
  overflow: hidden;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
  display: grid;
  place-items: center;
}

:deep(.avatar img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

:deep(.fallback) {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: var(--ring, var(--primary-color));
  opacity: 0.85;
}

:deep(.tip) {
  width: 12px;
  height: 12px;
  background: #fff;
  border-left: 3px solid var(--ring, var(--primary-color));
  border-bottom: 3px solid var(--ring, var(--primary-color));
  transform: rotate(-45deg);
  margin-top: -2px;
}

:deep(.label) {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 950;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: opacity 0.15s ease;
}

:deep(.shop-marker-wrap:hover .label) {
  opacity: 1;
}

:deep(.pin.is-selected .avatar) {
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.34);
  outline: 4px solid rgba(37, 99, 235, 0.18);
  outline-offset: 2px;
}

/* ─── Featured Seller Styles ─────────────────────────────────── */

/* Featured badge in panel */
.featured-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #78350f;
  font-weight: 800;
  font-size: 0.72rem;
  letter-spacing: .02em;
  margin-bottom: 4px;
}
.featured-badge__star { font-size: .8rem; }

/* Featured card highlight */
.card--featured {
  border-color: rgba(245, 158, 11, .35) !important;
  background: linear-gradient(180deg, rgba(245, 158, 11, .04), var(--bg)) !important;
}
.card--featured:hover {
  border-color: rgba(245, 158, 11, .55) !important;
  box-shadow: 0 8px 28px rgba(245, 158, 11, .12);
}

.badge--featured {
  top: auto;
  bottom: 10px;
  left: 10px;
  right: auto;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #78350f;
  font-size: .72rem;
}

/* Featured marker star */
:deep(.feat-star) {
  position: absolute;
  top: -6px;
  right: -4px;
  z-index: 10;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 10px;
  color: #78350f;
  box-shadow: 0 2px 8px rgba(245,158,11,.4);
  border: 2px solid white;
}

:deep(.is-featured .avatar) {
  box-shadow: 0 0 0 3px rgba(245,158,11,.25), 0 14px 34px rgba(0,0,0,.28);
}

:deep(.is-featured .label) {
  opacity: 1;
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #78350f;
  border-color: rgba(245,158,11,.35);
}
</style>
