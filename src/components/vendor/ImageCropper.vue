<template>
  <div class="cropper-container">
    <div class="cropper-wrapper">
      <img ref="imageRef" :src="imageSrc" alt="Crop image" />
    </div>

    <div class="aspect-ratio-controls">
      <label>Aspect Ratio:</label>
      <div class="ratio-buttons">
        <button @click="setAspectRatio(4 / 3)" :class="{ active: currentAspectRatio === 4 / 3 }" class="ratio-btn">
          4:3 (Landscape)
        </button>
        <button @click="setAspectRatio(16 / 9)" :class="{ active: currentAspectRatio === 16 / 9 }" class="ratio-btn">
          16:9 (Wide)
        </button>
      </div>
    </div>

    <div class="cropper-controls">
      <button @click="rotateLeft" class="control-btn">
        <ArrowPathIcon class="w-4 h-4" />
        Rotate Left
      </button>
      <button @click="rotateRight" class="control-btn">
        <ArrowPathIcon class="w-4 h-4 rotate-180" />
        Rotate Right
      </button>
      <button @click="reset" class="control-btn">
        <ArrowPathRoundedSquareIcon class="w-4 h-4" />
        Reset
      </button>
    </div>

    <div class="cropper-actions">
      <button @click="cancel" class="cancel-btn">Cancel</button>
      <button @click="cropImage" class="crop-btn">
        <span v-if="!isCropping">
          Crop & Apply
        </span>
        <span v-if="isCropping">
          <span class="spinner"></span>
          Cropping...
        </span>

      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.min.css'
import { ArrowPathIcon, ArrowPathRoundedSquareIcon } from '@heroicons/vue/24/outline'

interface Props {
  imageSrc: string
  format?: 'image/jpeg' | 'image/png' // allow override
}

interface CropPayload {
  blob: Blob
  url: string
  width: number
  height: number
  format: string
}

interface Emits {
  (e: 'crop', payload: CropPayload): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const imageRef = ref<HTMLImageElement>()
const isCropping = ref(false)
let cropper: Cropper | null = null
const currentAspectRatio = ref(4 / 3)

onMounted(() => {
  if (imageRef.value) {
    cropper = new Cropper(imageRef.value, {
      aspectRatio: currentAspectRatio.value,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      guides: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      background: false,
      responsive: true,
      checkOrientation: false
    })
  }
})

onUnmounted(() => {
  cropper?.destroy()
})

function setAspectRatio(ratio: number) {
  currentAspectRatio.value = ratio
  cropper?.setAspectRatio(ratio)
}

function rotateLeft() {
  cropper?.rotate(-90)
}
function rotateRight() {
  cropper?.rotate(90)
}
function reset() {
  cropper?.reset()
}

// Helper: canvas → Blob
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
      type,
      quality
    )
  })
}

async function cropImage() {
  if (!cropper || isCropping.value) return
  isCropping.value = true
  await nextTick()
  await new Promise(requestAnimationFrame)

  try {
    const format = props.format || 'image/jpeg' // ✅ default to JPEG
    const quality = format === 'image/jpeg' ? 0.95 : undefined

    const canvas = cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    })

    if (!canvas) throw new Error('Failed to get cropped canvas')

    const blob = await canvasToBlob(canvas, format, quality)
    const url = URL.createObjectURL(blob)

    emit('crop', {
      blob,
      url,
      width: canvas.width,
      height: canvas.height,
      format
    })
  } catch (err) {
    console.error(err)
  } finally {
    isCropping.value = false
  }
}

function cancel() {
  emit('cancel')
}
</script>


<style scoped>
.cropper-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  max-height: 60vh;
}


.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}


.cropper-wrapper {
  width: 100%;


  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.cropper-wrapper img {
  max-width: 100%;
  height: fit-content;
}

.aspect-ratio-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}

.aspect-ratio-controls label {
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.ratio-buttons {
  display: flex;
  gap: 0.5rem;
}

.ratio-btn {
  padding: 0.5rem 1rem;
  /* background: #f3f4f6; */
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.ratio-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.ratio-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.cropper-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: .5rem 0.75rem;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #e5e7eb;
  border-color: #9ca3af;
}

.w-4 {
  height: 1rem;
  aspect-ratio: 1;
}

.cropper-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

.cancel-btn {
  padding: 0.5rem 1.5rem;
  background: #f9fafb;
  border: 1px solid #d1d5db;
  color: black;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f3f4f6;
}

.crop-btn {
  padding: 0.5rem 1.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.crop-btn:hover {
  background: #065f32;
}

.rotate-180 {
  transform: rotate(180deg);
}
</style>