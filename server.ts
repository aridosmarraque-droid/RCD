import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const ALBARAN_PROMPT = `Analiza minuciosamente esta foto de un albarán, ticket de báscula o documento de entrega de materiales o residuos (RCD/SAP / Áridos Marraque).
Extrae ÚNICAMENTE la información REAL visible en la imagen. NO inventes ni supongas ningún dato. Si un dato no figura o no es legible, déjalo como string vacío ("") o 0 para números.

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
}`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // API Route: OCR Albarán con Gemini Vision
  app.post('/api/scan-albaran', async (req, res) => {
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
        console.warn('GEMINI_API_KEY no configurada en las variables de entorno del servidor.');
        return res.status(500).json({
          error: 'Falta la variable de entorno GEMINI_API_KEY en el servidor.'
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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

      if (response.text) {
        try {
          let cleanText = response.text.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          const parsed = JSON.parse(cleanText);
          return res.json(parsed);
        } catch (pErr) {
          console.error('JSON parse error from Gemini:', pErr);
          return res.json({ notes: response.text });
        }
      } else {
        return res.status(500).json({ error: 'Sin respuesta de Gemini Vision' });
      }
    } catch (err: any) {
      console.error('Error in /api/scan-albaran:', err);
      return res.status(500).json({ error: err.message || 'Error procesando el albarán' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
