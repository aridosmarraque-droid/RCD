/**
 * Utility to overlay watermark timestamp, location, and license plate on truck photos
 */
export async function watermarkTruckPhoto(
  imageSrc: string,
  options: {
    title: string; // e.g. "REGISTRO CAMIÓN - PLANTA RCD" or "REGISTRO DESCARGA"
    licensePlate?: string; // e.g. "8492-KZX"
    plantZone?: string; // e.g. "Báscula 1 - Muelle Norte"
    dateStr?: string;
    timeStr?: string;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      const now = new Date();
      const date = options.dateStr || now.toLocaleDateString('es-ES');
      const time = options.timeStr || now.toLocaleTimeString('es-ES');
      const plate = options.licensePlate ? ` | MATRÍCULA: ${options.licensePlate}` : '';
      const zone = options.plantZone ? ` | ZONA: ${options.plantZone}` : '';

      // Banner height proportional to image height (e.g. 15% of height)
      const bannerHeight = Math.max(70, Math.round(canvas.height * 0.16));
      const bannerY = canvas.height - bannerHeight;

      // Dark semi-transparent background banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'; // Dark slate tone
      ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

      // Accent border line at top of banner
      ctx.fillStyle = '#10B981'; // Emerald green
      ctx.fillRect(0, bannerY, canvas.width, Math.max(4, canvas.height * 0.006));

      // Font sizing relative to canvas width
      const titleFontSize = Math.max(14, Math.round(canvas.width * 0.028));
      const textFontSize = Math.max(11, Math.round(canvas.width * 0.022));

      // Draw Title
      ctx.font = `bold ${titleFontSize}px sans-serif`;
      ctx.fillStyle = '#10B981';
      ctx.fillText(`● PLANTA RCD ECO-MARRAQUE - ${options.title.toUpperCase()}`, 20, bannerY + titleFontSize + 12);

      // Draw Timestamp & Plate Info
      ctx.font = `${textFontSize}px sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`📅 FECHA: ${date} ${time} CEST ${plate}`, 20, bannerY + titleFontSize + textFontSize + 22);

      // Draw GPS & Plant Zone Info
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(`📍 UBI: 37.3891° N, 5.9845° W ${zone} [SAP SYNC]`, 20, bannerY + titleFontSize + textFontSize * 2 + 30);

      resolve(canvas.toDataURL('image/jpeg', 0.88));
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
}
