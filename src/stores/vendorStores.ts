import { defineStore } from "pinia";
import axios from "axios";
import { Seller } from "../types/seller";
import { getAuthHeaders } from "../types/shared";
import { Product } from "../types/product";
import { useAuthStore } from "./authStores";
const authStore = useAuthStore()

let userId = authStore.userId;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const headers = getAuthHeaders()

export const useVendorStore = defineStore("vendor", {
  state: () => ({
    vendorData: <Seller>{ followers: [] },
    vendorProducts: [] as Product[],
    limit: 15 as number,
    skip: 0 as number,
    isLoading: false as boolean,
    isFollows: false as boolean,
    followersCount: 0 as number,
  }),
  actions: {
    async fetchSellerInfo(vendorId: string): Promise<void> {

      try {
        const respone = await axios.get(`${API_BASE_URL}/vendor/${vendorId}/details`, {headers})
        this.vendorData = respone?.data?.data || { followers: [] } as Seller;
 
        if (!this.vendorData || this.vendorData.isApproved === false) {
          this.vendorData = { followers: [] } as Seller;
        }
      } catch (error) {
        console.log(error)
        this.vendorData = { followers: [] } as Seller;
      } finally {
      }
    },
    async fetchVendorProducts(vendorId): Promise<void> {
      try {
        this.isLoading = true
        this.vendorProducts = [];
        this.skip = 0; // Reset pagination
        // products/vendor/686554522a63c2c7e35c087a?limit=1
        const response = await axios.get(`${API_BASE_URL}/products/vendor/${vendorId}`, {
          params: {
            limit: this.limit,
            skip: this.skip,
          },
        });

        const data = response.data

        this.vendorProducts = data; // Replace instead of push

        this.isLoading = false
      } catch (error) {
        console.log(error);
        this.isLoading = false

      } finally {
        this.isLoading = false
      }
    },

    async toggleFollow(vendorId) {
      try {

        await axios.post(
          `${API_BASE_URL}/vendor/follow/${vendorId}`, {}, // Empty body
          {
            headers,
          }
        );
        this.isFollows = !this.isFollows
        this.followersCount += this.isFollows ? 1 : -1;

      } catch (error) {
        console.error("Follow toggle error:", error);
      }
    },

    followerCount() {
      const followers = this.vendorData?.followers || [];
      this.followersCount = followers.length;
    },

    isFollowing() {
      const followers = this.vendorData?.followers || [];
      const isFollow = followers.find(item => item._id === userId)
      this.isFollows = Boolean(isFollow)
    }
  },

  getters: {

  }
})