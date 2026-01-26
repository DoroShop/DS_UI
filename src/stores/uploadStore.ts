import { defineStore } from 'pinia'
import { UploadResult, UploadResponse } from '../types/upload';
// Types

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const useUploadStore = defineStore('upload', {
  state: () => ({
    isUploading: false,
    uploadResults: [] as UploadResult[],
    uploadEndpoint: `${API_BASE_URL}/upload`,
    imageUrl: ''
  }),

  getters: {
    hasResults: (state) => state.uploadResults.length > 0,
    hasSuccessfulUploads: (state) => state.uploadResults.some(result => result.success),
    hasFailedUploads: (state) => state.uploadResults.some(result => !result.success),
  },

  actions: {
    setUploadEndpoint(endpoint: string) {
      this.uploadEndpoint = endpoint
    },

    clearResults() {
      this.uploadResults = []
    },

    async uploadImageBlob(blob: Blob, filename?: string): Promise<UploadResult> {
      if (!blob) throw new Error('No image blob provided')

      const formData = new FormData()
      const finalFilename = filename || `cropped-image-${Date.now()}.png`
      formData.append('images', blob, finalFilename)

      try {
        const response = await fetch(this.uploadEndpoint, {
          method: 'POST',
          body: formData,
        })

        const text = await response.text()

        let data: UploadResponse = {}
        try {
          data = JSON.parse(text)
        } catch (err) {
          console.error('Upload response was not valid JSON:', text)
          return {
            success: false,
            error: 'Invalid server response: not valid JSON',
          }
        }

        if (response.ok) {
          if (data.images?.length) {
            return { success: true, url: data.images[0].url }
          } else if (data.url) {
            return { success: true, url: data.url }
          } else {
            return { success: false, error: 'Upload successful but no URL returned' }
          }
        } else {
          return {
            success: false,
            error: data.error || `HTTP ${response.status}: ${response.statusText}`,
          }
        }
      } catch (error) {
        console.error('Upload error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Network error occurred',
        }
      }
    },

    async uploadMultipleBlobs(blobs: Blob[], filenames?: string[]): Promise<UploadResult[]> {
      if (!blobs.length) throw new Error('No image blobs provided')

      const formData = new FormData()
      blobs.forEach((blob, index) => {
        const name = filenames?.[index] || `cropped-image-${Date.now()}-${index}.png`
        formData.append('images', blob, name)
      })

      try {
        const response = await fetch(this.uploadEndpoint, {
          method: 'POST',
          body: formData,
        })

        const text = await response.text()

        let data: UploadResponse = {}
        try {
          data = JSON.parse(text)
        } catch (err) {
          console.error('Upload response was not valid JSON:', text)
          return [{
            success: false,
            error: 'Invalid server response: not valid JSON',
          }]
        }

        if (response.ok) {
          if (data.images?.length) {
            return data.images.map(img => ({
              success: true,
              url: img.url,
            }))
          } else if (data.url) {
            return [{
              success: true,
              url: data.url,
            }]
          } else {
            return [{
              success: false,
              error: 'Upload successful but no URL returned',
            }]
          }
        } else {
          return [{
            success: false,
            error: data.error || `HTTP ${response.status}: ${response.statusText}`,
          }]
        }
      } catch (error) {
        console.error('Upload error:', error)
        return [{
          success: false,
          error: error instanceof Error ? error.message : 'Network error occurred',
        }]
      }
    },

    async uploadCroppedImage(blob: Blob, filename?: string) {
      this.isUploading = true
      this.uploadResults = []

      try {
        const result = await this.uploadImageBlob(blob, filename)
        this.uploadResults = [result]
        this.imageUrl = result.url || ''
      } catch (error) {
        this.uploadResults = [{
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        }]
      } finally {
        this.isUploading = false
      }
    },

    async uploadMultipleCroppedImages(blobs: Blob[], filenames?: string[]) {
      this.isUploading = true
      this.uploadResults = []

      try {
        const results = await this.uploadMultipleBlobs(blobs, filenames)
        this.uploadResults = results
      } catch (error) {
        this.uploadResults = [{
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed',
        }]
      } finally {
        this.isUploading = false
      }
    },

    async copyToClipboard(text: string): Promise<boolean> {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch (err) {
        console.error('Failed to copy: ', err)
        try {
          const textArea = document.createElement('textarea')
          textArea.value = text
          textArea.style.position = 'fixed'
          textArea.style.opacity = '0'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
          return true
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError)
          return false
        }
      }
    }
  }
})
