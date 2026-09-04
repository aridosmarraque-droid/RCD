import { GoogleGenAI } from '@google/genai';

const ALBARAN_PROMPT = `Analiza minuciosamente esta foto de un albarán, ticket de báscula o documento de entrega de materiales o residuos (RCD/SAP / Áridos Marraque).
Extrae ÚNICAMENTE la información REAL visible en la imagen. NO inventes ni supongas ningún dato. Si un dato no figura o no es legible, déjalo como string vacío ("") o 0 para números.

Devuelve la información en formato JSON estricto con los siguientes campos:
{
  "numAlbaran": "Número o código del albarán/ticket visible en la imagen (ej: 2607584)",
  "clientCode": "Código de cliente SAP si aparece en el documento (ej: C0048, C0086)",
  "clientName": "Razón social del cliente LIMPIA, sin incluir el código de cliente SAP entre corchetes o paréntesis (ej: 'ANGEL ARTES SANCHEZ S.L.' en lugar de '[C0048] ANGEL ARTES SANCHEZ S.L.')",
  "wasteTypeCode": "Código LER del residuo si aparece expresamente (ej: 17 01 01, 17 01 02, 17 01 07, 17 05 04, 17 09 04, 17 02 01)",
  "wasteTypeName": "Denominación o descripción del residuo impresa en el papel (ej: TN DE HORMIGON)",
  "quantityTons": Número decimal exacto con las Toneladas Netas (ej: 19.8). Si aparece en kg, conviértelo dividiendo por 1000. Si no hay peso o toneladas, usa 0,
  "licensePlate": "Matrícula del vehículo/camión si figura en la imagen (ej: 9523HTN/R3043BCG)",
  "date": "Fecha en formato YYYY-MM-DD si figura (ej: 2026-08-10)",
  "time": "Hora en formato HH:MM si figura",
  "notes": "Cualquier texto adicional o nota relevante presente en el documento"
}`;

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // ignore
      }
    }

    const { imageBase64, mimeType } = body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 provided in request body' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is missing on Vercel serverless function.');
      return res.status(500).json({
        error: 'Falta la variable de entorno GEMINI_API_KEY en el servidor de Vercel. Configúrala en Vercel > Settings > Environment Variables.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

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

    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;
    let rawResponseText = '';

    for (const modelName of modelsToTry) {
      try {
        const generatePromise = ai.models.generateContent({
          model: modelName,
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
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de OCR con ${modelName}`)), 15000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response && response.text) {
          rawResponseText = response.text;
          break;
        }
      } catch (mErr: any) {
        lastError = mErr;
        const errMsg = mErr?.message || String(mErr);
        console.warn(`[Vercel] Error con ${modelName}:`, errMsg);

        if (
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('UNAUTHENTICATED') ||
          errMsg.includes('leaked') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('403') ||
          errMsg.includes('401')
        ) {
          return res.status(403).json({
            error: 'AVISA A LA OFICINA: La clave API de Gemini está deshabilitada, revocada o es inválida en Vercel (API_KEY_INVALID). Actualiza GEMINI_API_KEY en Vercel > Settings > Environment Variables.',
            isApiKeyError: true,
            detail: errMsg,
          });
        }
      }
    }

    if (rawResponseText) {
      let cleanText = rawResponseText.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }
      const parsed = JSON.parse(cleanText);
      return res.status(200).json(parsed);
    } else {
      return res.status(500).json({ error: lastError?.message || 'Sin respuesta de Gemini Vision' });
    }
  } catch (err: any) {
    console.error('Error in Vercel api/scan-albaran:', err);
    const errMsg = err?.message || String(err);
    if (
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('UNAUTHENTICATED') ||
      errMsg.includes('leaked') ||
      errMsg.includes('401') ||
      errMsg.includes('403')
    ) {
      return res.status(403).json({
        error: 'AVISA A LA OFICINA: La clave API de Gemini está deshabilitada, revocada o es inválida en Vercel (API_KEY_INVALID). Actualiza GEMINI_API_KEY en Vercel > Settings > Environment Variables.',
        isApiKeyError: true,
      });
    }
    return res.status(500).json({ error: errMsg || 'Error procesando el albarán con Gemini' });
  }
}
