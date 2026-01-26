import { ref, Ref } from 'vue';

export interface UploadedImage {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  temporary?: boolean;
  localId?: string; // Track local reference before upload
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  fileName: string;
}

export interface ImageUploadOptions {
  apiBaseUrl: string;
  sessionId?: string;
  temporary?: boolean;
  onProgress?: (progress: UploadProgress) => void;
  onError?: (error: Error, fileName: string) => void;
  onSuccess?: (image: UploadedImage, fileName: string) => void;
}

export function useImageUpload(options: ImageUploadOptions) {
  const uploadedImages: Ref<UploadedImage[]> = ref([]);
  const isUploading = ref(false);
  const uploadProgress: Ref<UploadProgress[]> = ref([]);
  const errors: Ref<Array<{ fileName: string; error: string }>> = ref([]);

  /**
   * Generate a unique session ID for tracking temporary uploads
   */
  const generateSessionId = (): string => {
    return options.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const sessionId = ref(generateSessionId());

  /**
   * Upload a single image blob to the server
   * @param blob - Image blob to upload
   * @param fileName - Original file name
   * @param temporary - Whether to mark as temporary (default: true)
   */
  const uploadImage = async (
    blob: Blob,
    fileName: string,
    temporary: boolean = true
  ): Promise<UploadedImage> => {
    const formData = new FormData();
    formData.append('images', blob, fileName);

    const endpoint = temporary ? '/upload/temp' : '/upload/permanent';
    const url = `${options.apiBaseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'x-session-id': sessionId.value,
        },
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      const uploadedImage: UploadedImage = data.images?.[0];

      if (!uploadedImage || !uploadedImage.url) {
        throw new Error('Invalid response from server');
      }

      // Add to tracked images
      uploadedImages.value.push(uploadedImage);

      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(uploadedImage, fileName);
      }

      return uploadedImage;
    } catch (error: any) {
      const errorMessage = error.name === 'TimeoutError' 
        ? 'Upload timed out. Please check your connection and try again.'
        : error.message || 'Upload failed';

      errors.value.push({ fileName, error: errorMessage });

      // Call error callback
      if (options.onError) {
        options.onError(new Error(errorMessage), fileName);
      }

      throw new Error(errorMessage);
    }
  };

  /**
   * Upload multiple images
   * @param blobs - Array of { blob, fileName } objects
   * @param temporary - Whether to mark as temporary
   */
  const uploadMultiple = async (
    blobs: Array<{ blob: Blob; fileName: string }>,
    temporary: boolean = true
  ): Promise<UploadedImage[]> => {
    isUploading.value = true;
    errors.value = [];
    uploadProgress.value = [];

    const results: UploadedImage[] = [];

    try {
      // Upload images sequentially to avoid overwhelming the server
      for (let i = 0; i < blobs.length; i++) {
        const { blob, fileName } = blobs[i];

        try {
          // Update progress
          uploadProgress.value[i] = {
            loaded: 0,
            total: blob.size,
            percentage: 0,
            fileName,
          };

          const uploadedImage = await uploadImage(blob, fileName, temporary);
          results.push(uploadedImage);

          // Mark as complete
          uploadProgress.value[i] = {
            loaded: blob.size,
            total: blob.size,
            percentage: 100,
            fileName,
          };
        } catch (error: any) {
          console.error(`Failed to upload ${fileName}:`, error);
          // Continue with other uploads even if one fails
        }
      }

      return results;
    } finally {
      isUploading.value = false;
    }
  };

  /**
   * Delete an image from Cloudinary
   * @param publicId - Cloudinary public_id
   */
  const deleteImage = async (publicId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${options.apiBaseUrl}/upload/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || 'Failed to delete image');
      }

      // Remove from tracked images
      const index = uploadedImages.value.findIndex(img => img.public_id === publicId);
      if (index !== -1) {
        uploadedImages.value.splice(index, 1);
      }

      return true;
    } catch (error: any) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  };

  /**
   * Delete multiple images from Cloudinary
   * @param publicIds - Array of Cloudinary public_ids
   */
  const deleteBatch = async (publicIds: string[]): Promise<{ successful: number; failed: number }> => {
    if (publicIds.length === 0) {
      return { successful: 0, failed: 0 };
    }

    try {
      const response = await fetch(`${options.apiBaseUrl}/upload/delete-batch`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Batch delete failed' }));
        throw new Error(errorData.error || 'Failed to delete images');
      }

      const data = await response.json();

      // Remove from tracked images
      publicIds.forEach(publicId => {
        const index = uploadedImages.value.findIndex(img => img.public_id === publicId);
        if (index !== -1) {
          uploadedImages.value.splice(index, 1);
        }
      });

      return {
        successful: data.successful || 0,
        failed: data.failed || 0,
      };
    } catch (error: any) {
      console.error('Failed to delete images:', error);
      throw error;
    }
  };

  /**
   * Mark temporary images as permanent (after successful product creation)
   * @param publicIds - Array of Cloudinary public_ids
   */
  const confirmImages = async (publicIds: string[]): Promise<boolean> => {
    if (publicIds.length === 0) {
      return true;
    }

    try {
      const response = await fetch(`${options.apiBaseUrl}/upload/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Confirm failed' }));
        throw new Error(errorData.error || 'Failed to confirm images');
      }

      // Update tracked images to mark as permanent
      publicIds.forEach(publicId => {
        const image = uploadedImages.value.find(img => img.public_id === publicId);
        if (image) {
          image.temporary = false;
        }
      });

      return true;
    } catch (error: any) {
      console.error('Failed to confirm images:', error);
      throw error;
    }
  };

  /**
   * Cleanup all tracked temporary images (e.g., on form cancel)
   */
  const cleanupTempImages = async (): Promise<void> => {
    const tempImages = uploadedImages.value.filter(img => img.temporary);
    if (tempImages.length === 0) {
      return;
    }

    const publicIds = tempImages.map(img => img.public_id);
    await deleteBatch(publicIds);
  };

  /**
   * Reset the upload state
   */
  const reset = () => {
    uploadedImages.value = [];
    uploadProgress.value = [];
    errors.value = [];
    sessionId.value = generateSessionId();
  };

  return {
    // State
    uploadedImages,
    isUploading,
    uploadProgress,
    errors,
    sessionId,

    // Methods
    uploadImage,
    uploadMultiple,
    deleteImage,
    deleteBatch,
    confirmImages,
    cleanupTempImages,
    reset,
  };
}
