import { GoogleGenAI } from '@google/genai';
import { OCRScanResult } from '../types/rcd';

/**
 * Perform OCR on an Albarán / SAP Ticket image using Gemini Vision API directly.
 */
export async function scanAlbaranWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<Partial<OCRScanResult> | null> {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');

  if (!apiKey) {
    console.log('No Gemini API key found, using OCR extraction fallback.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Remove data URL scheme prefix if present
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            {
              text: `Analiza esta imagen de un albarán o ticket de báscula de planta de reciclaje de residuos RCD.
Extrae la información clave del albarán y responde EXCLUSIVAMENTE con un JSON con el siguiente formato:
{
  "numAlbaran": "Número de albarán o ticket (ej: ALB-2026-09412)",
  "clientCode": "Código de cliente (ej: C-00104)",
  "clientName": "Nombre de la empresa o cliente (ej: CONSTRUCCIONES MARRAQUE S.L.)",
  "wasteTypeCode": "Código LER del residuo si aparece (ej: 17 01 01, 17 01 02, 17 01 07, 17 05 04, 17 09 04)",
  "wasteTypeName": "Denominación del residuo",
  "quantityTons": 14.85,
  "licensePlate": "Matrícula del vehículo o camión (ej: 8492-KZX)",
  "date": "Fecha en formato YYYY-MM-DD",
  "time": "Hora en formato HH:MM",
  "notes": "Observaciones o detalles relevantes"
}`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      return parsed;
    }
  } catch (err) {
    console.warn('Gemini OCR API warning:', err);
  }
  return null;
}
