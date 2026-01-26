<template>
  <div class="image-upload-container">
    <!-- Upload Area -->
    <div v-if="!selectedFile && !croppedImageUrl" class="upload-area" @click="triggerFileInput">
      <div class="upload-content">
        <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <p class="upload-text">Click to upload image</p>
        <p class="upload-subtext">PNG, JPG, GIF up to 10MB</p>
      </div>
    </div>

    <!-- Current Image Preview -->
    <div v-if="currentImageUrl && !selectedFile && !croppedImageUrl" class="current-image">
      <img :src="currentImageUrl" alt="Current image" class="current-image-preview" />
      <div class="current-image-overlay">
        <button @click="triggerFileInput" class="btn btn-primary">
          Change Image
        </button>
      </div>
    </div>

    <!-- Cropped Image Preview -->
    <div v-if="croppedImageUrl" class="cropped-preview">
      <img :src="croppedImageUrl" alt="Cropped image" class="cropped-image" />
      <div class="cropped-actions">
        <button @click="confirmImage" class="btn btn-primary">
          Use This Image
        </button>
        <button @click="resetCropper" class="btn btn-secondary">
          Crop Again
        </button>
        <button @click="cancelUpload" class="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>

    <!-- Image Cropper -->
    <div v-if="selectedFile && !croppedImageUrl" class="cropper-section">
      <ImageCropper
        :image-src="selectedFileUrl"
        @crop="handleCrop"
        @cancel="cancelCrop"
      />
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      @change="handleFileSelect"
      style="display: none"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ImageCropper from './ImageCropper.vue'

interface Props {
  currentImage?: string
  label?: string
}

interface Emits {
  (e: 'image-selected', imageUrl: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const selectedFileUrl = ref<string>('')
const croppedImageUrl = ref<string>('')
const croppedBlob = ref<Blob | null>(null)

const currentImageUrl = computed(() => props.currentImage)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file) {
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file')
      return
    }
    
    selectedFile.value = file
    selectedFileUrl.value = URL.createObjectURL(file)
    croppedImageUrl.value = ''
    croppedBlob.value = null
  }
}

const handleCrop = (payload: { blob: Blob; url: string }) => {
  croppedImageUrl.value = payload.url
  croppedBlob.value = payload.blob
}

const cancelCrop = () => {
  selectedFile.value = null
  selectedFileUrl.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const resetCropper = () => {
  croppedImageUrl.value = ''
  croppedBlob.value = null
}

const confirmImage = () => {
  if (croppedImageUrl.value) {
    emit('image-selected', croppedImageUrl.value)
  }
}

const cancelUpload = () => {
  selectedFile.value = null
  selectedFileUrl.value = ''
  croppedImageUrl.value = ''
  croppedBlob.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}
</script>

<style scoped>
.image-upload-container {
  width: 100%;
}

.upload-area {
  border: 2px dashed #D1D5DB;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #F9FAFB;
}

.upload-area:hover {
  border-color: #3B82F6;
  background: #F0F9FF;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 3rem;
  height: 3rem;
  color: #6B7280;
}

.upload-text {
  font-weight: 500;
  color: #374151;
  margin: 0;
}

.upload-subtext {
  font-size: 0.875rem;
  color: #6B7280;
  margin: 0;
}

.current-image {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  overflow: hidden;
  max-width: 300px;
  margin: 0 auto;
  margin-top: 10px;
}

.current-image-preview {
  width: 100%;
  aspect-ratio: 4/2.5;
  height: auto;
  display: block;
  border-radius: 10px;
}

.current-image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.current-image:hover .current-image-overlay {
  opacity: 1;
}

.cropped-preview {
  text-align: center;
}

.cropped-image {
  max-width: 300px;
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  margin-bottom: 1rem;
}

.cropped-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.cropper-section {
  margin-top: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #3B82F6;
  color: white;
}

.btn-primary:hover {
  background: #2563EB;
}

.btn-secondary {
  background: #6B7280;
  color: white;
}

.btn-secondary:hover {
  background: #4B5563;
}

@media (max-width: 768px) {
  .cropped-actions {
    flex-direction: column;
  }
  
  .upload-area {
    padding: 1.5rem;
  }
}
</style>