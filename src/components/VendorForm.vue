<template>
  <div v-if="false" class="modal-overlay" @click.self="closeModal">
    <div class="modal-container">
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="modal-title-section">
          <h2 class="modal-title">Apply as a Vendor</h2>
          <p class="modal-subtitle">Join our marketplace and start selling your products</p>
        </div>
        <button class="close-button" type="button" @click="closeModal">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Modal Content -->
      <div class="modal-content">
        <form @submit.prevent="handleSubmit" class="vendor-form">
          <!-- Store Information Section -->
          <div class="form-section">
            <div class="section-header">
              <svg class="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
              <h3 class="section-title">Store Information</h3>
            </div>
            
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Store Name *</label>
                <input 
                  v-model="form.storeName" 
                  class="form-input"
                  placeholder="Enter your store name"
                  required 
                />
              </div>

              <div class="form-group form-group-full">
                <label class="form-label">Store Description</label>
                <textarea 
                  v-model="form.description" 
                  class="form-textarea"
                  placeholder="Describe your store and the products you'll be selling..."
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Document Upload Section -->
          <div class="form-section">
            <div class="section-header">
              <svg class="section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <h3 class="section-title">Required Documents</h3>
            </div>
            
            <div class="requirements-card">
              <h4 class="requirements-title">Please upload the following documents:</h4>
              <ul class="requirements-list">
                <li class="requirement-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Valid Government-issued ID
                </li>
                <li class="requirement-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Business Permit / DTI Certificate
                </li>
                <li class="requirement-item">
                  <svg class="check-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  FDA Certificate (if selling food or medicine)
                </li>
              </ul>
            </div>

            <div
              class="file-dropzone"
              :class="{ 'dropzone-hover': isDragOver }"
              @click="triggerFileInput"
              @dragover.prevent="isDragOver = true"
              @dragleave.prevent="isDragOver = false"
              @drop.prevent="handleDrop"
            >
              <div class="dropzone-content">
                <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p class="upload-title">Click or drag files here to upload</p>
                <p class="upload-subtitle">Accepted formats: JPG, PNG • Max size: 5MB each</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg"
                ref="fileInput"
                @change="handleFileUpload"
                class="hidden-input"
              />
            </div>

            <!-- File Previews -->
            <div class="file-previews" v-if="previews.length">
              <div
                v-for="(item, i) in previews"
                :key="item.url"
                class="file-preview"
              >
                <img :src="item.url" :alt="item.name" class="preview-image" />
                <div class="preview-overlay">
                  <span class="file-name">{{ item.name }}</span>
                  <button class="remove-button" type="button" @click.stop="removeFile(i)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button type="button" class="button-secondary" @click="closeModal">
          Cancel
        </button>
        <button 
          type="submit" 
          class="button-primary" 
          :disabled="isUploading"
          @click="handleSubmit"
        >
          <svg v-if="isUploading" class="loading-spinner" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isUploading ? 'Submitting Application...' : 'Submit Application' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'

const emits = defineEmits(['close', 'create'])

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const fileInput = ref(null)
const isUploading = ref(false)
const isDragOver = ref(false)

const form = reactive({
  storeName: '',
  description: '',
  documents: []
})

const previews = ref([])

function triggerFileInput() {
  fileInput.value?.click()
}

function handleDrop(e) {
  isDragOver.value = false
  const dropped = Array.from(e.dataTransfer.files)
  processFiles(dropped)
}

function handleFileUpload(e) {
  const files = Array.from(e.target.files)
  processFiles(files)
  e.target.value = ''
}

function processFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 5 * 1024 * 1024) {
      alert(`${file.name} is too large (max 5MB).`)
      continue
    }
    if (form.documents.find(f => f.name === file.name)) continue

    const url = URL.createObjectURL(file)
    previews.value.push({ url, name: file.name })
    form.documents.push(file)
  }
}

function removeFile(index) {
  URL.revokeObjectURL(previews.value[index].url)
  previews.value.splice(index, 1)
  form.documents.splice(index, 1)
}

async function uploadToCloudinary(file) {
  const formData = new FormData()
  formData.append('images', file)

  try {

    const res = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data.images
  } catch (err) {
    throw new Error(`Failed to upload ${file.name}`)
  }
}

async function handleSubmit() {
  if (!form.storeName.trim()) {
    alert('Store name is required.')
    return
  }
  if (!form.documents.length) {
    alert('At least one document is required.')
    return
  }

  try {
    isUploading.value = true

    const uploadedUrls = await Promise.all(
      form.documents.map(uploadToCloudinary)
    )

    console.log(uploadedUrls)
   uploadedUrls.flatMap(item => {
    console.log(item[0].url)
   })

    // const vendorData = {
    //   storeName: form.storeName,
    //   description: form.description,
    //   documents: uploadedUrls
    // }

    // emits('create', vendorData)
    closeModal()
  } catch (error) {
    alert(error.message || 'Upload failed.')
  } finally {
    isUploading.value = false
  }
}

function cleanupPreviews() {
  previews.value.forEach(p => URL.revokeObjectURL(p.url))
  previews.value = []
}

function closeModal() {
  cleanupPreviews()
  form.storeName = ''
  form.description = ''
  form.documents = []
  emits('close')
}

onBeforeUnmount(() => cleanupPreviews())
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000000;
  padding: 16px;
  animation: fadeIn 0.3s ease;
}

.modal-container {
  background: white;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideUp 0.3s ease;
  display: flex;
  flex-direction: column;
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 0;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #10b981 0%, #8b5cf6 100%);
  color: white;
}

.modal-title-section {
  flex: 1;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 4px 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.modal-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin: 0 0 16px 0;
  font-weight: 400;
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  color: white;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.close-button svg {
  width: 20px;
  height: 20px;
}

/* Modal Content */
.modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.vendor-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Form Sections */
.form-section {
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.section-icon {
  width: 24px;
  height: 24px;
  color: #10b981;
  flex-shrink: 0;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.form-group-full {
  grid-column: 1 / -1;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.form-input,
.form-textarea {
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  transition: all 0.2s ease;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: white;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* Requirements Card */
.requirements-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #e5e7eb;
  margin-bottom: 20px;
}

.requirements-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 16px 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.requirements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.requirement-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #4b5563;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.check-icon {
  width: 20px;
  height: 20px;
  color: #10b981;
  flex-shrink: 0;
}

/* File Dropzone */
.file-dropzone {
  border: 2px dashed #d1d5db;
  border-radius: 16px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  position: relative;
}

.file-dropzone:hover,
.dropzone-hover {
  border-color: #10b981;
  background: #f0fdf4;
  transform: scale(1.02);
}

.dropzone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: #6b7280;
  margin-bottom: 8px;
}

.upload-title {
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.upload-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.hidden-input {
  display: none;
}

/* File Previews */
.file-previews {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.file-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
  background: white;
  transition: all 0.2s ease;
}

.file-preview:hover {
  border-color: #10b981;
  transform: scale(1.05);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-name {
  font-size: 12px;
  color: white;
  font-weight: 500;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-button {
  background: #ef4444;
  border: none;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.remove-button:hover {
  background: #dc2626;
  transform: scale(1.1);
}

/* Modal Footer */
.modal-footer {
  padding: 20px 24px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.button-primary,
.button-secondary {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.button-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.button-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.button-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-secondary {
  background: #6b7280;
  color: white;
}

.button-secondary:hover {
  background: #4b5563;
  transform: translateY(-2px);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

/* Utility Classes */
.w-4 { width: 16px; }
.h-4 { height: 16px; }
.w-6 { width: 24px; }
.h-6 { height: 24px; }

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-container {
    max-width: 100%;
    margin: 16px;
    max-height: calc(100vh - 32px);
  }

  .modal-header {
    padding: 20px 20px 0;
  }

  .modal-content {
    padding: 20px;
  }

  .vendor-form {
    gap: 24px;
  }

  .form-section {
    padding: 20px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .file-previews {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }

  .modal-footer {
    padding: 16px 20px;
    flex-direction: column-reverse;
  }

  .button-primary,
  .button-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>
