import { defineStore } from 'pinia'
import axios from 'axios'
import { getAuthHeaders } from '../types/shared'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// ─────────────────────────────────────────────────────────────────────────────
// PSGC Location Store - Cascading Philippine Locations
// ─────────────────────────────────────────────────────────────────────────────
// Data Flow: Region → Province → City/Municipality → Barangay
// Each level is fetched ONLY when the parent is selected
// Child selections are cleared when parent changes
// ─────────────────────────────────────────────────────────────────────────────

interface Region {
  code: string
  name: string
}

interface Province {
  code: string
  name: string
}

interface City {
  code: string
  name: string
  zipCode?: string | null
}

interface Barangay {
  code: string
  name: string
  zipCode?: string | null
}

export const useLocationStore = defineStore('locationStore', {
  state: () => ({
    // Data stores (keyed by parent code for caching)
    regions: [] as Region[],
    provinces: {} as Record<string, Province[]>,      // keyed by regionCode
    cities: {} as Record<string, City[]>,             // keyed by provinceCode
    barangays: {} as Record<string, Barangay[]>,      // keyed by cityCode
    zipCache: {} as Record<string, string>,           // keyed by "cityCode|barangay"

    // Loading states for each level
    loadingRegions: false,
    loadingProvinces: false,
    loadingCities: false,
    loadingBarangays: false,
    loadingZip: false,

    // Error state
    error: null as string | null,
  }),

  getters: {
    isLoading: (state) =>
      state.loadingRegions ||
      state.loadingProvinces ||
      state.loadingCities ||
      state.loadingBarangays ||
      state.loadingZip,
  },

  actions: {
    /**
     * Clear error state
     */
    clearError() {
      this.error = null
    },

    /**
     * Fetch all regions (top level)
     */
    async fetchRegions() {
      if (this.regions.length > 0) {
        console.log('[locationStore] Regions already cached')
        return this.regions
      }

      this.loadingRegions = true
      this.error = null

      try {
        const { data } = await axios.get(`${API_BASE_URL}/locations/regions`, {
          headers: getAuthHeaders(),
          withCredentials: true,
        })
        this.regions = data.data || []
        console.log(`[locationStore] Fetched ${this.regions.length} regions`)
        return this.regions
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to load regions'
        console.error('[locationStore] fetchRegions error:', this.error)
        throw error
      } finally {
        this.loadingRegions = false
      }
    },

    /**
     * Fetch provinces for a specific region
     * Clears cached cities/barangays when region changes
     */
    async fetchProvinces(regionCode: string) {
      if (!regionCode) {
        console.warn('[locationStore] fetchProvinces called without regionCode')
        return []
      }

      // Return cached if available
      if (this.provinces[regionCode]) {
        console.log(`[locationStore] Provinces for ${regionCode} already cached`)
        return this.provinces[regionCode]
      }

      this.loadingProvinces = true
      this.error = null

      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/locations/regions/${regionCode}/provinces`,
          {
            headers: getAuthHeaders(),
            withCredentials: true,
          }
        )
        this.provinces[regionCode] = data.data || []
        console.log(`[locationStore] Fetched ${this.provinces[regionCode].length} provinces for region ${regionCode}`)
        return this.provinces[regionCode]
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to load provinces'
        console.error('[locationStore] fetchProvinces error:', this.error)
        throw error
      } finally {
        this.loadingProvinces = false
      }
    },

    /**
     * Fetch cities/municipalities for a specific province
     */
    async fetchCities(provinceCode: string) {
      if (!provinceCode) {
        console.warn('[locationStore] fetchCities called without provinceCode')
        return []
      }

      // Return cached if available
      if (this.cities[provinceCode]) {
        console.log(`[locationStore] Cities for ${provinceCode} already cached`)
        return this.cities[provinceCode]
      }

      this.loadingCities = true
      this.error = null

      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/locations/provinces/${provinceCode}/cities`,
          {
            headers: getAuthHeaders(),
            withCredentials: true,
          }
        )
        this.cities[provinceCode] = data.data || []
        console.log(`[locationStore] Fetched ${this.cities[provinceCode].length} cities for province ${provinceCode}`)
        return this.cities[provinceCode]
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to load cities/municipalities'
        console.error('[locationStore] fetchCities error:', this.error)
        throw error
      } finally {
        this.loadingCities = false
      }
    },

    /**
     * Fetch barangays for a specific city/municipality
     */
    async fetchBarangays(cityCode: string) {
      if (!cityCode) {
        console.warn('[locationStore] fetchBarangays called without cityCode')
        return []
      }

      // Return cached if available
      if (this.barangays[cityCode]) {
        console.log(`[locationStore] Barangays for ${cityCode} already cached`)
        return this.barangays[cityCode]
      }

      this.loadingBarangays = true
      this.error = null

      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/locations/cities/${cityCode}/barangays`,
          {
            headers: getAuthHeaders(),
            withCredentials: true,
          }
        )
        this.barangays[cityCode] = data.data || []
        console.log(`[locationStore] Fetched ${this.barangays[cityCode].length} barangays for city ${cityCode}`)
        return this.barangays[cityCode]
      } catch (error: any) {
        this.error = error.response?.data?.error || 'Failed to load barangays'
        console.error('[locationStore] fetchBarangays error:', this.error)
        throw error
      } finally {
        this.loadingBarangays = false
      }
    },

    /**
     * Fetch zip code for a specific barangay
     */
    async fetchZipCode(cityCode: string, barangay: string) {
      if (!cityCode || !barangay) {
        console.warn('[locationStore] fetchZipCode called without cityCode or barangay')
        return null
      }

      const cacheKey = `${cityCode}|${barangay}`
      if (this.zipCache[cacheKey]) {
        return this.zipCache[cacheKey]
      }

      this.loadingZip = true
      this.error = null

      try {
        const { data } = await axios.get(`${API_BASE_URL}/locations/zipcodes`, {
          params: { cityCode, barangay },
          headers: getAuthHeaders(),
          withCredentials: true,
        })
        const zip = data.data?.zipCode
        if (zip) {
          this.zipCache[cacheKey] = zip
        }
        return zip
      } catch (error: any) {
        // Don't set error for zip - it's optional
        console.warn('[locationStore] fetchZipCode error:', error.response?.data?.error)
        return null
      } finally {
        this.loadingZip = false
      }
    },

    /**
     * Get provinces for a region (returns cached or empty array)
     */
    getProvinces(regionCode: string): Province[] {
      return this.provinces[regionCode] || []
    },

    /**
     * Get cities for a province (returns cached or empty array)
     */
    getCities(provinceCode: string): City[] {
      return this.cities[provinceCode] || []
    },

    /**
     * Get barangays for a city (returns cached or empty array)
     */
    getBarangays(cityCode: string): Barangay[] {
      return this.barangays[cityCode] || []
    },

    /**
     * Clear all cached data (useful for testing or logout)
     */
    clearCache() {
      this.regions = []
      this.provinces = {}
      this.cities = {}
      this.barangays = {}
      this.zipCache = {}
      this.error = null
    },
  },
})
