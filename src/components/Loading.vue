<template>
  <div class="skeleton-card">
    <div class="skeleton-image shimmer"></div>
    <div class="skeleton-content">
      <div class="skeleton-line title shimmer"></div>
      <div class="skeleton-line subtitle shimmer"></div>
      <div class="skeleton-footer">
        <div class="skeleton-line rating shimmer"></div>
        <div class="skeleton-line price shimmer"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  background: var(--surface, #ffffff);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #e0e0e0);
  box-shadow: var(--card-shadow, 0 2px 4px rgba(0, 0, 0, 0.05));
  transition: all var(--transition-fast, 0.2s ease);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.skeleton-image {
  width: 100%;
  aspect-ratio: 1;
  background: var(--skeleton-base, #e5e7eb);
  position: relative;
  overflow: hidden;
}

.skeleton-content {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--surface, #ffffff);
}

.skeleton-line {
  height: 12px;
  border-radius: 6px;
  background: var(--skeleton-base, #e5e7eb);
  position: relative;
  overflow: hidden;
}

.skeleton-line.title {
  width: 75%;
  height: 14px;
}

.skeleton-line.subtitle {
  width: 60%;
  height: 12px;
}

.skeleton-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.25rem;
  gap: 0.5rem;
}

.skeleton-line.rating {
  width: 45%;
  height: 12px;
}

.skeleton-line.price {
  width: 35%;
  height: 14px;
}

/* Smooth shimmer effect */
.shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--skeleton-shimmer, rgba(255, 255, 255, 0.6)) 50%,
    transparent 100%
  );
  animation: shimmer 1.8s infinite;
  transform: translateX(-100%);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .skeleton-content {
    padding: 0.5rem;
    gap: 0.4rem;
  }
  
  .skeleton-line.title {
    height: 12px;
  }
  
  .skeleton-line.subtitle {
    height: 10px;
  }
}
</style>
