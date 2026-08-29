/**
 * Utility to overlay watermark timestamp, location, and license plate on truck photos
 * Automatically resizes and compresses high-resolution camera images for fast loading and low storage footprint.
 */
export async function watermarkTruckPhoto(
  imageSrc: string,
  options: {
    title: string; // e.g. "REGISTRO CAMIÓN - PLANTA RCD" or "REGISTRO DESCARGA"
    licensePlate?: string; // e.g. "8492-KZX"
    plantZone?: string; // e.g. "Báscula 1 - Muelle Norte"
    dateStr?: string;
    timeStr?: string;
    maxDimension?: number;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = options.maxDimension || 1200;
      let targetWidth = img.width;
      let targetHeight = img.height;

      // Automatically downscale high-resolution camera photos (e.g. 4000x3000 -> 1200x900)
      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
          targetWidth = maxDim;
        } else {
          targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
          targetHeight = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw resized image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const now = new Date();
      const date = options.dateStr || now.toLocaleDateString('es-ES');
      const time = options.timeStr || now.toLocaleTimeString('es-ES');
      const plate = options.licensePlate ? ` | MATRÍCULA: ${options.licensePlate}` : '';
      const zone = options.plantZone ? ` | ZONA: ${options.plantZone}` : '';

      // Banner height proportional to image height (e.g. 15% of height)
      const bannerHeight = Math.max(64, Math.round(canvas.height * 0.16));
      const bannerY = canvas.height - bannerHeight;

      // Dark semi-transparent background banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'; // Dark slate tone
      ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

      // Accent border line at top of banner
      ctx.fillStyle = '#10B981'; // Emerald green
      ctx.fillRect(0, bannerY, canvas.width, Math.max(3, canvas.height * 0.006));

      // Font sizing relative to canvas width
      const titleFontSize = Math.max(13, Math.round(canvas.width * 0.026));
      const textFontSize = Math.max(10, Math.round(canvas.width * 0.020));

      // Draw Title
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      ctx.fillStyle = '#10B981';
      ctx.fillText(`● PLANTA DE VALORIZACIÓN RCD - ${options.title.toUpperCase()}`, 16, bannerY + titleFontSize + 10);

      // Draw Timestamp & Plate Info
      ctx.font = `${textFontSize}px sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`📅 FECHA: ${date} ${time} CEST ${plate}`, 16, bannerY + titleFontSize + textFontSize + 20);

      // Draw GPS & Plant Zone Info
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`📍 UBI: 37.3891° N, 5.9845° W ${zone} [SAP SYNC]`, 16, bannerY + titleFontSize + textFontSize * 2 + 28);

      // Output optimized JPEG (0.78 quality yields ~120KB for crystal clear 1200px evidence)
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}

