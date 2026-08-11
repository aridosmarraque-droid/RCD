import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // API Route: OCR Albarán con Gemini Vision
  app.post('/api/scan-albaran', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'No imageBase64 provided' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY no configurada en las variables de entorno del servidor.');
        return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
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
  "numAlbaran": "Número o código del albarán/ticket visible en la imagen",
  "clientCode": "Código de cliente si aparece",
  "clientName": "Nombre completo de la empresa, cliente o pagador tal como está impreso en el papel",
  "wasteTypeCode": "Código LER del residuo si aparece expresamente (ej: 17 01 01, 17 01 02, 17 01 07, 17 05 04, 17 09 04, 17 02 01)",
  "wasteTypeName": "Denominación o descripción del residuo impresa en el papel",
  "quantityTons": Número decimal exacto con las Toneladas Netas (si aparece en kg, conviértelo dividiendo por 1000). Si no hay peso o toneladas, usa 0,
  "licensePlate": "Matrícula del vehículo/camión si figura en la imagen",
  "date": "Fecha en formato YYYY-MM-DD si figura",
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
