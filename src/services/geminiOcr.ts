import { GoogleGenAI } from '@google/genai';
import { OCRScanResult } from '../types/rcd';

const ALBARAN_PROMPT = `Analiza minuciosamente esta foto de un albarán, ticket de báscula o documento de entrega de materiales o residuos (RCD/SAP / Áridos Marraque).
Extrae la información REAL visible en la imagen. No inventes datos. Si un campo no figura o no es legible, déjalo como string vacío ("") o 0 para números.

Devuelve un JSON estricto con los siguientes campos:
{
  "numAlbaran": "Número o código de albarán (ej: 2607584)",
  "clientCode": "Código de cliente SAP si aparece de forma independiente o entre corchetes/paréntesis (ej: C0048, C0086)",
  "clientName": "Razón social del cliente LIMPIA, sin incluir el código de cliente SAP entre corchetes o paréntesis (ej: 'ANGEL ARTES SANCHEZ S.L.' en lugar de '[C0048] ANGEL ARTES SANCHEZ S.L.')",
  "wasteTypeCode": "Código LER o código de material (ej: 17 01 01, 17 01 07)",
  "wasteTypeName": "Descripción del material o residuo (ej: TN DE HORMIGON)",
  "quantityTons": Número decimal exacto con las Toneladas Netas (ej: 19.8). Si figura en kg, divídelo entre 1000. Si no hay, 0,
  "licensePlate": "Matrícula del vehículo/camión (ej: 9523HTN/R3043BCG)",
  "date": "Fecha en formato YYYY-MM-DD (convertir ej. 10/08/26 -> 2026-08-10)",
  "time": "Hora en formato HH:MM (si figura)",
  "notes": "Notas adicionales o transportista"
}`;

/**
 * Cleans extracted client data by separating SAP code like [C0048] from client name.
 */
export function cleanExtractedOCRData(raw: Partial<OCRScanResult>): Partial<OCRScanResult> {
  if (!raw) return raw;
  const result = { ...raw };

  let name = (result.clientName || '').trim();
  let code = (result.clientCode || '').trim();

  // Pattern matching leading brackets like "[C0048] ANGEL ARTES SANCHEZ S.L." or "C0048 ANGEL ARTES..." or "(C0048) ..."
  const match = name.match(/^(?:\[([A-Z0-9\-]{3,10})\]|\(([A-Z0-9\-]{3,10})\)|([A-Z][0-9]{3,6})\s*[\-:]?)\s*(.*)/i);
  if (match) {
    const extractedCode = (match[1] || match[2] || match[3] || '').trim();
    const restName = (match[4] || '').trim();

    if (extractedCode && (!code || code === 'C-00100' || code.includes('['))) {
      code = extractedCode.toUpperCase();
    }
    if (restName && restName.length >= 2) {
      name = restName;
    }
  }

  // Remove any remaining leading/trailing brackets or dashes
  name = name.replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
  if (code) {
    code = code.replace(/^\[|\]$/g, '').trim();
  }

  result.clientName = name;
  result.clientCode = code;

  return result;
}

/**
 * Resizes a base64 image on an HTML Canvas so its maximum dimension is 1200px.
 * This reduces 10MB camera uploads down to ~150KB-300KB, preventing Vercel payload limit (4.5MB)
 * and 500 errors, while keeping text sharp and readable for OCR.
 */
async function resizeImageForOCR(dataUrl: string, maxDim = 1200): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim) {
        return resolve(dataUrl);
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.drawImage(img, 0, 0, width, height);
      // Encode as JPEG at 0.85 quality
      const resized = canvas.toDataURL('image/jpeg', 0.85);
      resolve(resized);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Perform OCR on an Albarán / SAP Ticket image using server API or client Gemini Vision.
 * Implements a strict 10-second timeout to prevent the interface from hanging indefinitely.
 */
export async function scanAlbaranWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  externalSignal?: AbortSignal
): Promise<Partial<OCRScanResult> | null> {
  let serverErrorMsg = '';

  // 0. Pre-compress image to max 1200px to ensure base64 string fits payload limits and OCR is fast
  let preparedBase64 = imageBase64;
  try {
    preparedBase64 = await resizeImageForOCR(imageBase64, 1200);
  } catch (e) {
    console.warn('Image resize warning:', e);
  }

  let detectedMimeType = mimeType || 'image/jpeg';
  if (preparedBase64.startsWith('data:')) {
    const header = preparedBase64.split(';')[0];
    if (header.includes(':')) {
      detectedMimeType = header.split(':')[1] || detectedMimeType;
    }
  }

  const base64Data = preparedBase64.includes(',')
    ? preparedBase64.split(',')[1]
    : preparedBase64;

  // 1. Try server-side API endpoint first (/api/scan-albaran) with strict 10-second timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Link external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch('/api/scan-albaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: preparedBase64, mimeType: detectedMimeType }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && (data.numAlbaran || data.clientName || data.quantityTons !== undefined)) {
        return cleanExtractedOCRData(data);
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      serverErrorMsg = errJson.error || `Error ${response.status} en servidor /api/scan-albaran`;
      console.warn('Server /api/scan-albaran error:', serverErrorMsg);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      serverErrorMsg = 'Tiempo máximo de reconocimiento (10s) superado.';
    } else {
      serverErrorMsg = err.message || 'Error de conexión con el servicio OCR';
    }
    console.warn('OCR fetch warning:', serverErrorMsg);
  }

  // 2. Fallback to direct client-side Gemini Vision call if client API key is available
  const clientKey =
    (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) ||
    (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) ||
    (window as any).GEMINI_API_KEY;

  if (clientKey && !externalSignal?.aborted) {
    try {
      const ai = new GoogleGenAI({ apiKey: clientKey });
      const clientCallPromise = ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: {
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
        config: {
          responseMimeType: 'application/json',
        },
      });

      const clientTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout cliente (6s)')), 6000)
      );

      const res: any = await Promise.race([clientCallPromise, clientTimeout]);

      if (res && res.text) {
        let cleanText = res.text.trim();
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        const parsed = JSON.parse(cleanText);
        return cleanExtractedOCRData(parsed);
      }
    } catch (clientErr: any) {
      console.warn('Client-side Gemini Vision OCR error:', clientErr);
    }
  }

  // 3. Return initial fallback values with explicit guidance notes so the operator can fill manually
  return {
    numAlbaran: '',
    clientCode: '',
    clientName: '',
    wasteTypeCode: '',
    wasteTypeName: '',
    quantityTons: 0,
    licensePlate: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    notes: serverErrorMsg
      ? `Aviso: ${serverErrorMsg} Por favor, complete los datos manualmente.`
      : 'No se pudieron detectar todos los datos del albarán. Por favor, introduzca los campos restantes a mano.',
  };
}
