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
 * Client-side OCR fallback when Gemini API is unavailable.
 * Reads Spanish text directly from the image in browser and parses SAP / Áridos Marraque ticket fields using regex.
 */
async function scanWithTesseract(imageBase64: string): Promise<Partial<OCRScanResult> | null> {
  try {
    const tesseractModule = await import('tesseract.js');
    const createWorker = tesseractModule.createWorker;
    if (!createWorker) return null;

    const worker = await createWorker('spa');
    const ret = await worker.recognize(imageBase64);
    await worker.terminate();

    const text = ret.data?.text || '';
    if (!text.trim()) return null;

    const result: Partial<OCRScanResult> = {};

    // 1. Nº Albarán (e.g. 2607584 or 2607565)
    const albMatch = text.match(/(?:Albaran|Albarán|Ticket|Nº\s*Albaran|Nº\s*Albarán|N[ºo]\s*)\s*[:\.]?\s*([0-9]{6,12}|[A-Z0-9\-]{5,15})/i);
    if (albMatch) result.numAlbaran = albMatch[1].trim();

    // 2. Client Code (e.g. C0086 or C0335)
    const codMatch = text.match(/(?:Cód\.\s*Cliente|Cod\.\s*Cliente|Cód\s*Cliente|Cliente\s*Cód)\s*[:\.]?\s*([A-Z0-9]{4,8})/i);
    if (codMatch) result.clientCode = codMatch[1].trim();

    // 3. Client Name (e.g. ANGEL ARTES SANCHEZ S.L. or PREFABRICADOS IBAFERSAN, S.L.)
    const clientMatch = text.match(/(?:ANGEL\s+ARTES[^\n]*|PREFABRICADOS[^\n]*|[A-Z0-9\s,\.]+(?:S\.L\.|S\.A\.|S\.L\.U\.|SL|SA))/i);
    if (clientMatch) result.clientName = clientMatch[0].trim();

    // 4. License Plate / Matrícula (e.g. 9523HTN/R3043BCG or 6509CZZ)
    const plateMatch = text.match(/(?:Matricula|Matrícula|Matric)\s*[:\.]?\s*([0-9]{4}\s*[A-Z]{3}(?:\/[A-Z0-9]{7,8})?|[A-Z0-9\/\-]{6,16})/i);
    if (plateMatch) result.licensePlate = plateMatch[1].replace(/\s+/g, '').toUpperCase();

    // 5. Quantity / Toneladas Netas (e.g. 19,8 or 27.72)
    const qtyMatch = text.match(/(?:Cantidad|Neto|PESO\s*NETO)\s*[:\.]?\s*([0-9]+[\.,][0-9]+)/i) || text.match(/([0-9]+[\.,][0-9]+)\s*(?:TONELADAS|TONS|T\b)/i);
    if (qtyMatch) {
      result.quantityTons = parseFloat(qtyMatch[1].replace(',', '.'));
    }

    // 6. Waste Type / LER Code
    const lerMatch = text.match(/(17\s*01\s*01|17\s*01\s*02|17\s*01\s*07|17\s*05\s*04|17\s*09\s*04|17\s*02\s*01)/i);
    if (lerMatch) {
      result.wasteTypeCode = lerMatch[1].replace(/\s+/g, ' ');
    }

    // 7. Waste Description
    const descMatch = text.match(/(?:TN\s+DE\s+[A-Z0-9\s\(\)\-]{4,40}|HORMIGON|GRAVA|ESCOMBRO)/i);
    if (descMatch) result.wasteTypeName = descMatch[0].trim();

    // 8. Date (e.g. 10/08/26 -> 2026-08-10)
    const dateMatch = text.match(/(?:Fecha)\s*[:\.]?\s*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
    if (dateMatch) {
      const parts = dateMatch[1].split(/[\/\-]/);
      if (parts.length === 3) {
        let d = parts[0].padStart(2, '0');
        let m = parts[1].padStart(2, '0');
        let y = parts[2];
        if (y.length === 2) y = `20${y}`;
        result.date = `${y}-${m}-${d}`;
      }
    }

    return result;
  } catch (err) {
    console.warn('Tesseract OCR fallback error:', err);
    return null;
  }
}

/**
 * Perform OCR on an Albarán / SAP Ticket image using server API, client Gemini Vision, or Tesseract OCR.
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

  // 3. Browser-side Tesseract.js OCR for offline/static deployment
  console.log('Running browser Tesseract.js OCR fallback on ticket image...');
  const tessResult = await scanWithTesseract(imageBase64);
  if (tessResult && (tessResult.numAlbaran || tessResult.clientName || tessResult.quantityTons)) {
    return tessResult;
  }

  // 4. Default clean initial values if no text could be recognized
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
