import { useAuthStore } from "../stores/authStores";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function getAuthHeaders(includeCSRF = false): { Authorization: string; 'x-csrf-token'?: string } {
	const authStore = useAuthStore();
	const headers: { Authorization: string; 'x-csrf-token'?: string } = {
		Authorization: `Bearer ${authStore.token}`,
	};
	if (includeCSRF && authStore.csrfToken) {
		headers['x-csrf-token'] = authStore.csrfToken;
	}
	return headers;
}
