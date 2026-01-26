<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { StarIcon, XMarkIcon, PhotoIcon } from '@heroicons/vue/24/solid';
import { useReviewStore } from '../stores/reviewStore';
import type { ReviewableProduct } from '../types/review';

const props = defineProps<{
  isOpen: boolean;
  product?: ReviewableProduct;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted'): void;
}>();

const reviewStore = useReviewStore();

// Form state
const rating = ref(5);
const comment = ref('');
const images = ref<string[]>([]);
const imageInput = ref<HTMLInputElement | null>(null);
const isSubmitting = ref(false);

// Computed
const isFormValid = computed(() => {
  return rating.value >= 1 && rating.value <= 5 && comment.value.trim().length > 0;
});

// Methods
const selectRating = (star: number) => {
  rating.value = star;
};

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (!files) return;
  
  // For now, we'll just store placeholder URLs
  // In production, you'd upload these to your server/cloud storage
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && images.value.length < 5) {
        images.value.push(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  });
};

const removeImage = (index: number) => {
  images.value.splice(index, 1);
};

const handleSubmit = async () => {
  if (!isFormValid.value || !props.product) return;
  
  isSubmitting.value = true;
  
  try {
    const reviewData = {
      productId: props.product.productId,
      orderId: props.product.orderId,
      rating: rating.value,
      comment: comment.value.trim(),
      images: images.value.length > 0 ? images.value : undefined,
    };
    
    console.log('📤 Submitting review data:', reviewData);
    
    await reviewStore.createReview(reviewData);
    
    emit('submitted');
    closeModal();
  } catch (error) {
    console.error('Error submitting review:', error);
  } finally {
    isSubmitting.value = false;
  }
};

const closeModal = () => {
  // Reset form
  rating.value = 5;
  comment.value = '';
  images.value = [];
  emit('close');
};

// Watch for modal open/close to reset form
watch(() => props.isOpen, (newVal) => {
  if (!newVal) {
    // Reset on close
    rating.value = 5;
    comment.value = '';
    images.value = [];
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <h2>Write a Review</h2>
            <button class="close-btn" @click="closeModal" :disabled="isSubmitting">
              <XMarkIcon class="icon" />
            </button>
          </div>

          <!-- Product Info -->
          <div v-if="product" class="product-info">
            <img 
              :src="product.productImage" 
              :alt="product.productName"
              class="product-image"
              @error="(e) => (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/90946/pexels-photo-90946.jpeg?auto=compress&cs=tinysrgb&w=400'"
            />
            <div class="product-details">
              <h3>{{ product.productName }}</h3>
              <p class="product-price">₱{{ product.price.toLocaleString() }}</p>
            </div>
          </div>

          <!-- Rating -->
          <div class="form-section">
            <label class="form-label">Your Rating *</label>
            <div class="rating-input">
              <button
                v-for="star in 5"
                :key="star"
                type="button"
                class="star-btn"
                :class="{ active: star <= rating }"
                @click="selectRating(star)"
                :disabled="isSubmitting"
              >
                <StarIcon class="star-icon" />
              </button>
              <span class="rating-text">{{ rating }} out of 5 stars</span>
            </div>
          </div>

          <!-- Comment -->
          <div class="form-section">
            <label class="form-label" for="comment">Your Review *</label>
            <textarea
              id="comment"
              v-model="comment"
              class="comment-textarea"
              placeholder="Share your experience with this product... What did you like? What could be improved?"
              rows="5"
              maxlength="1000"
              :disabled="isSubmitting"
            ></textarea>
            <div class="char-count">{{ comment.length }}/1000 characters</div>
          </div>

          <!-- Images -->
          <div class="form-section">
            <label class="form-label">Add Photos (Optional)</label>
            <div class="images-section">
              <div class="image-previews" v-if="images.length > 0">
                <div v-for="(image, index) in images" :key="index" class="image-preview">
                  <img :src="image" alt="Review image" />
                  <button
                    type="button"
                    class="remove-image-btn"
                    @click="removeImage(index)"
                    :disabled="isSubmitting"
                  >
                    <XMarkIcon class="icon" />
                  </button>
                </div>
              </div>
              
              <button
                v-if="images.length < 5"
                type="button"
                class="upload-btn"
                @click="imageInput?.click()"
                :disabled="isSubmitting"
              >
                <PhotoIcon class="icon" />
                <span>Add Photo ({{ images.length }}/5)</span>
              </button>
              
              <input
                ref="imageInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden-input"
                @change="handleImageUpload"
                :disabled="isSubmitting"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-actions">
            <button
              class="btn btn-cancel"
              @click="closeModal"
              :disabled="isSubmitting"
            >
              Cancel
            </button>
            <button
              class="btn btn-submit"
              @click="handleSubmit"
              :disabled="!isFormValid || isSubmitting"
            >
              {{ isSubmitting ? 'Submitting...' : 'Submit Review' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
  overflow-y: auto;
}

.modal-container {
  background: var(--surface);
  border-radius: 16px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  transition: all var(--transition-fast);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 10;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.close-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
}

.close-btn .icon {
  width: 24px;
  height: 24px;
  color: var(--text-secondary);
}

.product-info {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.product-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.product-details {
  flex: 1;
}

.product-details h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.product-price {
  color: var(--secondary-color);
  font-weight: 700;
  font-size: 1.1rem;
  margin: 0;
}

.form-section {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.form-section:last-of-type {
  border-bottom: none;
}

.form-label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95rem;
}

.rating-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  transition: transform 0.2s;
}

.star-btn:hover:not(:disabled) {
  transform: scale(1.15);
}

.star-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.star-icon {
  width: 32px;
  height: 32px;
  color: var(--border-color);
  transition: color 0.2s;
}

.star-btn.active .star-icon,
.star-btn:hover .star-icon {
  color: #fbbf24;
}

.rating-text {
  margin-left: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.comment-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
  min-height: 120px;
  background: var(--background-alt);
  color: var(--text-primary);
  transition: border-color 0.2s;
}

.comment-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
}

.comment-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.char-count {
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
}

.images-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.image-previews {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.75rem;
}

.image-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid var(--border-color);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  padding: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.remove-image-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.9);
}

.remove-image-btn .icon {
  width: 16px;
  height: 16px;
  color: white;
}

.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover:not(:disabled) {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: var(--background-alt);
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-btn .icon {
  width: 24px;
  height: 24px;
}

.hidden-input {
  display: none;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  position: sticky;
  bottom: 0;
}

.btn {
  flex: 1;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--background-alt);
}

.btn-submit {
  background: var(--primary-color);
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #0a5a2e;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(9, 74, 37, 0.3);
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.9) translateY(-20px);
}

/* Responsive */
@media (max-width: 640px) {
  .modal-container {
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-actions {
    flex-direction: column-reverse;
  }
  
  .star-icon {
    width: 28px;
    height: 28px;
  }
}
</style>
