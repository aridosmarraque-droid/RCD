import { OCRScanResult } from '../types/rcd';

/**
 * Perform OCR on an Albarán / SAP Ticket image using server-side Gemini Vision.
 */
export async function scanAlbaranWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<Partial<OCRScanResult> | null> {
  try {
    const response = await fetch('/api/scan-albaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.warn('Server OCR response error:', response.status, errJson);
    }
  } catch (err) {
    console.warn('Network error calling /api/scan-albaran:', err);
  }
  return null;
}
