/**
 * Custom toast notification utility
 * Shows non-blocking notifications at the top-right corner
 */

export const Toast = (message, type = "success", duration = 3000) => {
	// Use the global toast function mounted by ToastNotification component
	if (typeof window !== 'undefined' && window.__showToast) {
		window.__showToast({
			message,
			type,
			duration
		});
	} else {
		console.warn('Toast system not initialized');
	}
};

