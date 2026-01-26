import { defineStore } from "pinia";
import axios from "axios";
import { getAuthHeaders } from "../types/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface SellerApplication {
  shopName?: string;
  shopAddress?: string;
  governmentIdUrl?: string;
  address: {
    region: string;
    province: string;
    municipality: string;
    barangay: string;
    zipCode: string;
    street?: string;
    additionalInfo?: string;
  };
  birTinUrl?: string;
  dtiOrSecUrl?: string;
  shopProfileUrl?: string;
  shopLocation?: {
    type: string;
    coordinates: [number, number];
  };
  fdaCertificateUrl?: string | null;
  status: "not_applied" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface SellerApplicationForm {
  shopName: string;
  region: string;
  province: string;
  municipality: string;
  address: string;
  barangay: string;
  zipCode: string;
  street?: string;
  additionalInfo?: string;
  shopAddress?: string;
  governmentId: File | null;
  birTin: File | null;
  dtiOrSec: File | null;
  fdaCertificate?: File | null;
  shopProfile?: File | null;
}

export const useSellerApplicationStore = defineStore("sellerApplication", {
  state: () => ({
    application: null as SellerApplication | null,
    loading: false,
    error: null as string | null,
    submitSuccess: false,
  }),

  getters: {
    canApply: (state) => {
      if (!state.application) return true;
      return (
        state.application?.status === "not_applied" ||
        state.application?.status === "rejected"
      );
    },

    isPending: (state) => {
      return state.application?.status === "pending";
    },

    isApproved: (state) => {
      return state.application?.status === "approved";
    },

    isRejected: (state) => {
      return state.application?.status === "rejected";
    },

    statusText: (state) => {
      const status = state.application?.status;
      switch (status) {
        case "not_applied":
          return "Not Applied";
        case "pending":
          return "Under Review";
        case "approved":
          return "Approved";
        case "rejected":
          return "Rejected";
        default:
          return "Not Applied";
      }
    },
  },

  actions: {
    async fetchApplicationStatus() {
      this.loading = true;
      this.error = null;

      try {
        const response = await axios.get(`${API_BASE_URL}/api/seller/status`, {
          headers: getAuthHeaders(),
        });

        if (response.data.success) {
          this.application = response.data.application || {
            status: "not_applied",
          };
        } else {
          // If not successful but no error, set default state
          this.application = { status: "not_applied" };
        }
      } catch (error: any) {
        // Handle specific error cases
        if (error.response?.status === 401) {
          this.error = "Please log in to view your seller application status";
        } else if (error.response?.status === 404) {
          // User not found or no application - set default state
          this.application = { status: "not_applied" };
        } else {
          this.error =
            error.response?.data?.error || "Failed to fetch application status";
        }
        console.error("Failed to fetch application status:", error);
      } finally {
        this.loading = false;
      }
    },

    async submitApplication(applicationData: any) {
      try {
        const formData = new FormData();

        // Append text fields - send NAMES for display, codes for reference
        formData.append("shopName", applicationData.shopName);

        // Send location names (for display) - use names if available, fallback to codes
        formData.append(
          "region",
          applicationData.regionName || applicationData.region,
        );
        formData.append(
          "province",
          applicationData.provinceName || applicationData.province,
        );
        formData.append(
          "municipality",
          applicationData.municipalityName || applicationData.municipality,
        );
        formData.append(
          "barangay",
          applicationData.barangayName || applicationData.barangay,
        );
        formData.append("zipCode", applicationData.zipCode);

        // Also send codes for reference
        formData.append("regionCode", applicationData.region);
        formData.append("provinceCode", applicationData.province);
        formData.append("municipalityCode", applicationData.municipality);
        formData.append(
          "barangayCode",
          applicationData.barangay || applicationData.barangayName,
        );

        if (applicationData.street)
          formData.append("street", applicationData.street);
        if (applicationData.additionalInfo)
          formData.append("additionalInfo", applicationData.additionalInfo);

        // Build formatted address using NAMES (not codes)
        const formattedAddress = [
          applicationData.street,
          applicationData.barangayName || applicationData.barangay,
          applicationData.municipalityName || applicationData.municipality,
          applicationData.provinceName || applicationData.province,
          applicationData.regionName || applicationData.region,
          applicationData.zipCode,
        ]
          .filter(Boolean)
          .join(", ");
        formData.append("shopAddress", formattedAddress);

        // Append shop location coordinates (optional)
        if (
          applicationData.shopLatitude !== null &&
          applicationData.shopLongitude !== null
        ) {
          formData.append(
            "shopLatitude",
            applicationData.shopLatitude.toString(),
          );
          formData.append(
            "shopLongitude",
            applicationData.shopLongitude.toString(),
          );
        }

        // Append files
        if (applicationData.shopProfile) {
          formData.append("shopProfile", applicationData.shopProfile);
        }
        if (applicationData.governmentId) {
          formData.append("governmentId", applicationData.governmentId);
        }
        if (applicationData.birTin) {
          formData.append("birTin", applicationData.birTin);
        }
        if (applicationData.dtiOrSec) {
          formData.append("dtiOrSec", applicationData.dtiOrSec);
        }
        if (applicationData.fdaCertificate) {
          formData.append("fdaCertificate", applicationData.fdaCertificate);
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/seller/apply`,
          formData,
          {
            timeout: 60000, // Increase timeout to 60s for file uploads
            withCredentials: true,
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "multipart/form-data",
            },
          },
        );
        if (response.data) {
          this.application = response.data.application || this.application;
          this.submitSuccess = true;
        }
        return response.data;
      } catch (error: any) {
        if (error.code === "ECONNABORTED") {
          console.error("Request timed out. Please check server or try again.");
          throw new Error("Request timed out. Please try again later.");
        }
        this.error =
          error.response?.data?.error || "Failed to submit application";
        throw error;
      }
    },

    async cancelApplication() {
      this.loading = true;
      this.error = null;

      try {
        const response = await axios.delete(
          `${API_BASE_URL}/api/seller/cancel`,
          {
            withCredentials: true,
            headers: getAuthHeaders(),
          },
        );

        if (response.data.success) {
          this.application = response.data.application;
          return { success: true, message: response.data.message };
        }
      } catch (error: any) {
        this.error =
          error.response?.data?.error || "Failed to cancel application";
        console.error("Failed to cancel application:", error);
        throw new Error(this.error);
      } finally {
        this.loading = false;
      }
    },

    clearError() {
      this.error = null;
    },

    clearSuccess() {
      this.submitSuccess = false;
    },

    resetStore() {
      this.application = null;
      this.loading = false;
      this.error = null;
      this.submitSuccess = false;
    },
  },
});
