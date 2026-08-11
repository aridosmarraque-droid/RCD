import { GoogleGenAI } from '@google/genai';
import { OCRScanResult } from '../types/rcd';

const ALBARAN_PROMPT = `Analiza minuciosamente esta foto de un albarán, ticket de báscula o documento de entrega de materiales o residuos (RCD/SAP / Áridos Marraque).
Extrae la información REAL visible en la imagen. No inventes datos. Si un campo no figura o no es legible, déjalo como string vacío ("") o 0 para números.

Devuelve un JSON estricto con los siguientes campos:
{
  "numAlbaran": "Número o código de albarán (ej: 2607584)",
  "clientCode": "Código de cliente si aparece (ej: C0086)",
  "clientName": "Nombre completo de la empresa o cliente (ej: ANGEL ARTES SANCHEZ S.L.)",
  "wasteTypeCode": "Código LER o código de material (ej: 17 01 01, 17 01 07)",
  "wasteTypeName": "Descripción del material o residuo (ej: TN DE HORMIGON)",
  "quantityTons": Número decimal exacto con las Toneladas Netas (ej: 19.8). Si figura en kg, divídelo entre 1000. Si no hay, 0,
  "licensePlate": "Matrícula del vehículo/camión (ej: 9523HTN/R3043BCG)",
  "date": "Fecha en formato YYYY-MM-DD (convertir ej. 10/08/26 -> 2026-08-10)",
  "time": "Hora en formato HH:MM (si figura)",
  "notes": "Notas adicionales o transportista"
}`;

/**
 * Perform OCR on an Albarán / SAP Ticket image using server API or client Gemini Vision.
 */
export async function scanAlbaranWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<Partial<OCRScanResult> | null> {
  let detectedMimeType = mimeType || 'image/jpeg';
  if (imageBase64.startsWith('data:')) {
    const header = imageBase64.split(';')[0];
    if (header.includes(':')) {
      detectedMimeType = header.split(':')[1] || detectedMimeType;
    }
  }

  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  // 1. Try server-side API endpoint first (/api/scan-albaran)
  try {
    const response = await fetch('/api/scan-albaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType: detectedMimeType }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data.numAlbaran || data.clientName || data.quantityTons !== undefined)) {
        return data;
      }
    } else {
      console.warn('Server /api/scan-albaran returned status:', response.status);
    }
  } catch (err) {
    console.warn('Network error calling /api/scan-albaran:', err);
  }

  // 2. Fallback to direct client-side Gemini Vision call if client API key is available
  const clientKey =
    (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) ||
    (window as any).GEMINI_API_KEY;

  if (clientKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const res = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: detectedMimeType,
                },
              },
              { text: ALBARAN_PROMPT },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (res.text) {
        let cleanText = res.text.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(cleanText);
        return parsed;
      }
    } catch (clientErr) {
      console.warn('Client-side Gemini Vision OCR error:', clientErr);
    }
  }

  // 3. Default clean initial values if OCR service is unavailable
  return {
    numAlbaran: '',
    clientCode: '',
    clientName: '',
    wasteTypeCode: '17 01 01',
    wasteTypeName: 'Hormigón y Piedra (Escombro Limpio)',
    quantityTons: 0,
    licensePlate: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    notes: 'No se pudo leer automáticamente. Introduzca los datos manualmente.',
  };
}

