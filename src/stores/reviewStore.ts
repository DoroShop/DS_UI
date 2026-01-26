import { defineStore } from 'pinia';
import axios from 'axios';
import type {
  Review,
  ReviewableProduct,
  CreateReviewData,
  UpdateReviewData,
  ReviewStats,
  ReviewsResponse
} from '../types/review';
import { getAuthHeaders } from '../types/shared';
import { Alert } from '../components/composable/Alert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const headers = getAuthHeaders()
export const useReviewStore = defineStore('review', {
  state: () => ({
    productReviews: [] as Review[],
    myReviews: [] as Review[],
    reviewableProducts: [] as ReviewableProduct[],
    reviewStats: null as ReviewStats | null,
    isLoading: false,
    error: null as string | null,
    currentPage: 1,
    totalPages: 1,
    hasMore: false,
  }),

  getters: {
    getReviewByProduct: (state) => (productId: string) => {
      return state.productReviews.filter(
        (review) => 
          typeof review.productId === 'string' 
            ? review.productId === productId 
            : review.productId._id === productId
      );
    },
    
    averageRating: (state) => {
      return state.reviewStats?.averageRating || 0;
    },
    
    totalReviews: (state) => {
      return state.reviewStats?.totalReviews || 0;
    },
  },

  actions: {
    // Get reviewable products (delivered orders not yet reviewed)
    async fetchReviewableProducts() {
      this.isLoading = true;
      this.error = null;
      
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `${API_BASE_URL}/reviews/reviewable-products`,
          { headers }
        );
        
        if (response.data.success) {
          this.reviewableProducts = response.data.data;
          console.log('✅ [REVIEW] Reviewable products fetched:', this.reviewableProducts.length);
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch reviewable products';
        console.error('❌ [REVIEW] Error fetching reviewable products:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
      } finally {
        this.isLoading = false;
      }
    },

    // Create a new review
    async createReview(reviewData: CreateReviewData) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const headers = getAuthHeaders();
        const response = await axios.post(
          `${API_BASE_URL}/reviews`,
          reviewData,
          { headers }
        );
        
        if (response.data.success) {
          const newReview = response.data.data;
          this.myReviews.unshift(newReview);
          
          // Remove from reviewable products
          this.reviewableProducts = this.reviewableProducts.filter(
            (p) => !(p.productId === reviewData.productId && p.orderId === reviewData.orderId)
          );
          
          console.log('✅ [REVIEW] Review created successfully:', newReview._id);
          Alert('Review submitted successfully!', 'success', 'var(--primary-color)');
          return newReview;
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to create review';
        console.error('❌ [REVIEW] Error creating review:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    // Get product reviews (public, no auth required)
    async fetchProductReviews(productId: string, page = 1, sortBy = 'createdAt') {
      this.isLoading = true;
      this.error = null;
      
      try {
        const response = await axios.get(
          `${API_BASE_URL}/reviews/product/${productId}`,
          {
            headers,
            params: { page, limit: 10, sortBy }
          }
        );
        
        if (response.data.success) {
          const data: ReviewsResponse = response.data.data;
          
          if (page === 1) {
            this.productReviews = data.reviews;
          } else {
            this.productReviews.push(...data.reviews);
          }
          
          this.currentPage = data.page;
          this.totalPages = data.totalPages;
          this.hasMore = data.hasMore;
          
          console.log('✅ [REVIEW] Product reviews fetched:', data.reviews.length);
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch reviews';
        console.error('❌ [REVIEW] Error fetching product reviews:', err);
      } finally {
        this.isLoading = false;
      }
    },

    // Get review statistics for a product
    async fetchReviewStats(productId: string) {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/reviews/product/${productId}/stats`, {headers}
        );
        
        if (response.data.success) {
          this.reviewStats = response.data.data;
          console.log('✅ [REVIEW] Stats fetched:', this.reviewStats);
        }
      } catch (err: any) {
        console.error('❌ [REVIEW] Error fetching stats:', err);
      }
    },

    // Get my reviews
    async fetchMyReviews(page = 1) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `${API_BASE_URL}/reviews/my-reviews`,
          {
            headers,
            params: { page, limit: 10 }
          }
        );
        
        if (response.data.success) {
          const data: ReviewsResponse = response.data.data;
          
          if (page === 1) {
            this.myReviews = data.reviews;
          } else {
            this.myReviews.push(...data.reviews);
          }
          
          this.currentPage = data.page;
          this.totalPages = data.totalPages;
          this.hasMore = data.hasMore;
          
          console.log('✅ [REVIEW] My reviews fetched:', data.reviews.length);
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to fetch your reviews';
        console.error('❌ [REVIEW] Error fetching my reviews:', err);
      } finally {
        this.isLoading = false;
      }
    },

    // Update a review
    async updateReview(reviewId: string, updateData: UpdateReviewData) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const headers = getAuthHeaders();
        const response = await axios.put(
          `${API_BASE_URL}/reviews/${reviewId}`,
          updateData,
          { headers }
        );
        
        if (response.data.success) {
          const updatedReview = response.data.data;
          
          // Update in myReviews
          const index = this.myReviews.findIndex((r) => r._id === reviewId);
          if (index !== -1) {
            this.myReviews[index] = { ...this.myReviews[index], ...updatedReview };
          }
          
          console.log('✅ [REVIEW] Review updated successfully:', reviewId);
          Alert('Review updated successfully!', 'success', 'var(--primary-color)');
          return updatedReview;
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to update review';
        console.error('❌ [REVIEW] Error updating review:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    // Delete a review
    async deleteReview(reviewId: string) {
      this.isLoading = true;
      this.error = null;
      
      try {
        const headers = getAuthHeaders();
        const response = await axios.delete(
          `${API_BASE_URL}/reviews/${reviewId}`,
          { headers }
        );
        
        if (response.data.success) {
          this.myReviews = this.myReviews.filter((r) => r._id !== reviewId);
          this.productReviews = this.productReviews.filter((r) => r._id !== reviewId);
          
          console.log('✅ [REVIEW] Review deleted successfully:', reviewId);
          Alert('Review deleted successfully!', 'success', 'var(--primary-color)');
        }
      } catch (err: any) {
        this.error = err?.response?.data?.message || 'Failed to delete review';
        console.error('❌ [REVIEW] Error deleting review:', err);
        Alert(this.error, 'error', 'var(--secondary-color)');
        throw err;
      } finally {
        this.isLoading = false;
      }
    },

    // Mark review as helpful
    async toggleHelpful(reviewId: string) {
      try {
        const headers = getAuthHeaders();
        const response = await axios.post(
          `${API_BASE_URL}/reviews/${reviewId}/helpful`,
          {},
          { headers }
        );
        
        if (response.data.success) {
          const { helpfulCount, isMarkedHelpful } = response.data.data;
          
          // Update in productReviews
          const review = this.productReviews.find((r) => r._id === reviewId);
          if (review) {
            review.helpfulCount = helpfulCount;
          }
          
          console.log('✅ [REVIEW] Helpful toggled:', { reviewId, isMarkedHelpful });
        }
      } catch (err: any) {
        console.error('❌ [REVIEW] Error toggling helpful:', err);
        Alert('Please login to mark reviews as helpful', 'warning', 'var(--secondary-color)');
      }
    },

    // Clear product reviews (when switching products)
    clearProductReviews() {
      this.productReviews = [];
      this.reviewStats = null;
      this.currentPage = 1;
      this.totalPages = 1;
      this.hasMore = false;
    },
  },
});
