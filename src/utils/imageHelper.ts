export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(resizedFile);
        }
      }, 'image/jpeg', 0.8);
    };
    
    img.src = URL.createObjectURL(file);
  });
}

export function validateImageFile(file: File): boolean {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return false;
  }
  
  // Check file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return false;
  }
  
  return true;
}

export function getOptimalCropSize(imageWidth: number, imageHeight: number, aspectRatio: number): CropArea {
  let cropWidth: number;
  let cropHeight: number;
  
  if (imageWidth / imageHeight > aspectRatio) {
    // Image is wider, constrain by height
    cropHeight = imageHeight;
    cropWidth = cropHeight * aspectRatio;
  } else {
    // Image is taller, constrain by width
    cropWidth = imageWidth;
    cropHeight = cropWidth / aspectRatio;
  }
  
  return {
    x: (imageWidth - cropWidth) / 2,
    y: (imageHeight - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight
  };
}