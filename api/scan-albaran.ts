import { GoogleGenAI } from '@google/genai';

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
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'No imageBase64 provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable missing' });
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

    const response = await ai.models.generateContent({
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
            {
              text: `Analiza minuciosamente esta foto de un albarán o ticket de báscula de residuos (RCD/SAP).
Extrae ÚNICAMENTE la información REAL visible en la imagen. NO inventes ni supongas ningún dato. Si un dato no figura o no es legible en el albarán, déjalo como string vacío ("") o 0 para números.

Devuelve la información en formato JSON estricto con los siguientes campos:
{
  "numAlbaran": "Número o código del albarán/ticket visible en la imagen (ej: 2607584)",
  "clientCode": "Código de cliente si aparece (ej: C0086)",
  "clientName": "Nombre completo de la empresa, cliente o pagador tal como está impreso en el papel (ej: ANGEL ARTES SANCHEZ S.L.)",
  "wasteTypeCode": "Código LER del residuo si aparece expresamente (ej: 17 01 01, 17 01 02, 17 01 07, 17 05 04, 17 09 04, 17 02 01)",
  "wasteTypeName": "Denominación o descripción del residuo impresa en el papel (ej: TN DE HORMIGON)",
  "quantityTons": Número decimal exacto con las Toneladas Netas (ej: 19.8). Si aparece en kg, conviértelo dividiendo por 1000. Si no hay peso o toneladas, usa 0,
  "licensePlate": "Matrícula del vehículo/camión si figura en la imagen (ej: 9523HTN/R3043BCG)",
  "date": "Fecha en formato YYYY-MM-DD si figura (ej: 2026-08-10)",
  "time": "Hora en formato HH:MM si figura",
  "notes": "Cualquier texto adicional o nota relevante presente en el documento"
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
      let cleanText = response.text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      const parsed = JSON.parse(cleanText);
      return res.status(200).json(parsed);
    } else {
      return res.status(500).json({ error: 'Sin respuesta de Gemini Vision' });
    }
  } catch (err: any) {
    console.error('Error in Vercel api/scan-albaran:', err);
    return res.status(500).json({ error: err.message || 'Error procesando el albarán' });
  }
}
