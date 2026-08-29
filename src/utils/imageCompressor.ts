/**
 * Utility for client-side image compression and resizing.
 * Optimizes high-resolution smartphone camera photos (10MB+) down to lightweight (~150KB)
 * while preserving high crispness and readability for OCR and plant evidence.
 */

export interface CompressionOptions {
  maxDimension?: number; // Maximum width or height in pixels (default: 1200)
  quality?: number; // JPEG compression quality from 0.1 to 1.0 (default: 0.78)
  mimeType?: string; // Target mime type (default: 'image/jpeg')
}

/**
 * Compresses an image file (from <input type="file">) or base64 data URL.
 * Returns an optimized Base64 string ready for storage, OCR, or cloud sync.
 */
export async function compressImage(
  source: File | Blob | string,
  options: CompressionOptions = {}
): Promise<string> {
  const maxDim = options.maxDimension || 1200;
  const quality = options.quality !== undefined ? options.quality : 0.78;
  const mimeType = options.mimeType || 'image/jpeg';

  return new Promise((resolve, reject) => {
    // 1. Get source as Data URL if it's a File/Blob
    if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawDataUrl = e.target?.result as string;
        processDataUrl(rawDataUrl);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    } else if (typeof source === 'string') {
      processDataUrl(source);
    } else {
      reject(new Error('Formato de imagen no compatible'));
    }

    function processDataUrl(dataUrl: string) {
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        return resolve(dataUrl);
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate scaled dimensions while preserving aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = Math.round(maxDim);
          }
        }

        // Draw onto HTML5 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(dataUrl);
        }

        // Enable high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed Data URL
        try {
          const compressed = canvas.toDataURL(mimeType, quality);
          resolve(compressed);
        } catch (e) {
          console.warn('Fallback to original dataUrl due to canvas error:', e);
          resolve(dataUrl);
        }
      };

      img.onerror = (err) => {
        console.warn('Error loading image for compression, using original:', err);
        resolve(dataUrl);
      };

      img.src = dataUrl;
    }
  });
}

/**
 * Returns approximate size in KB of a base64 string
 */
export function getBase64SizeKB(base64: string): number {
  if (!base64) return 0;
  const stringLength = base64.length - (base64.indexOf(',') + 1);
  const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383;
  return Math.round(sizeInBytes / 1024);
}
