import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {GoogleGenAI, Type} from '@google/genai';

function expressApiPlugin() {
  return {
    name: 'express-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/scan-albaran' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const {imageBase64, mimeType} = JSON.parse(body || '{}');

              const apiKey = process.env.GEMINI_API_KEY;
              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({error: 'GEMINI_API_KEY no disponible en el servidor'}));
                return;
              }

              const ai = new GoogleGenAI({
                apiKey: apiKey,
                httpOptions: {
                  headers: {
                    'User-Agent': 'aistudio-build',
                  },
                },
              });

              const cleanBase64 = imageBase64 ? imageBase64.replace(/^data:image\/\w+;base64,/, '') : '';

              const response = await ai.models.generateContent({
                model: 'gemini-3.6-flash',
                contents: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: cleanBase64,
                      },
                    },
                    {
                      text: `Analiza esta fotografía de un albarán de báscula de SAP Business One de una planta de residuos RCD (Residuos de Construcción y Demolición).
Extrae exactamente los siguientes campos estructurados en formato JSON:
- numAlbaran: Número de albarán SAP (p.ej. ALB-2026-08493)
- clientCode: Código de cliente SAP (p.ej. C-00104)
- clientName: Nombre de la empresa cliente o transportista
- wasteTypeCode: Código LER del residuo (p.ej. '17 01 01', '17 01 02', '17 05 04', '17 09 04', '17 02 01')
- wasteTypeName: Denominación comercial del residuo
- quantityTons: Cantidad neta en toneladas (número decimal, p.ej. 14.85)
- date: Fecha YYYY-MM-DD
- time: Hora HH:MM
- licensePlate: Matrícula del camión
- notes: Observaciones relevantes`,
                    },
                  ],
                },
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      numAlbaran: {type: Type.STRING},
                      clientCode: {type: Type.STRING},
                      clientName: {type: Type.STRING},
                      wasteTypeCode: {type: Type.STRING},
                      wasteTypeName: {type: Type.STRING},
                      quantityTons: {type: Type.NUMBER},
                      date: {type: Type.STRING},
                      time: {type: Type.STRING},
                      licensePlate: {type: Type.STRING},
                      notes: {type: Type.STRING},
                    },
                    required: ['numAlbaran', 'clientName', 'wasteTypeCode', 'quantityTons'],
                  },
                },
              });

              const responseText = response.text || '{}';
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(responseText);
            } catch (err: any) {
              console.error('Error procesando albarán con Gemini:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({error: err.message || 'Error en escaneo OCR del albarán'}));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
