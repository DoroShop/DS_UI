// stores/userStore.ts
import { defineStore } from 'pinia'
import axios from 'axios'
import type { User } from '../types/user'
import { getAuthHeaders } from '../types/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useUserStore = defineStore('users', {
  state: () => ({
    userData: null as User | null,
    isLoading: false,
    error: null as string | null,
    isFetched: false,
  }),

  actions: {
    async fetchUser(force = false) {
      if (this.isFetched && !force) return

      this.isLoading = true
      this.error = null
      try {
        // Get fresh headers on each call to ensure token is available
        const headers = getAuthHeaders()
        const res = await axios.get(`${API_BASE_URL}/user/me`, { headers })
        this.userData = res.data
        this.isFetched = true
      } catch (err: any) {
        this.error = err.response?.data?.message || err.message
      } finally {
        this.isLoading = false
      }
    },

    async updateUser(data) {
      this.isLoading = true
      this.error = null

      try {
        // Get fresh headers on each call
        const headers = getAuthHeaders()
        const response = await axios.put(`${API_BASE_URL}/user/me`, data, {
          headers
        })
        this.userData = response.data
      } catch (err: any) {
        this.error = err.response?.data?.message || err.message
      } finally {
        this.isLoading = false
      }
    },



    clearUser() {
      this.userData = null;
      this.error = null;
      this.isFetched = false;
    }
  },

  getters: {
    isAuthenticated: (state) => !!state.userData,
    userName: (state) => state.userData?.name || '',
    walletBalance: (state) => state.userData?.wallet || 0,
    // Alias for backward compatibility with components using 'user'
    user: (state) => state.userData
  }
});