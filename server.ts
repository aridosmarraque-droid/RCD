import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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

  // API Route: Envío de Correo Electrónico / Webhook (sin restricciones de CORS de navegador)
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, from, subject, html, text, webhookUrl, apiKey } = req.body || {};

      if (!to) {
        return res.status(400).json({ error: 'El campo "to" (destinatario) es obligatorio.' });
      }

      const targetApiKey = apiKey || process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY;
      let targetWebhook = webhookUrl || process.env.EMAIL_WEBHOOK_URL || process.env.WEBHOOK_URL;
      
      // Auto-configure Resend endpoint if API Key is a Resend key
      if (!targetWebhook && targetApiKey && targetApiKey.startsWith('re_')) {
        targetWebhook = 'https://api.resend.com/emails';
      }

      const fromAddress = from || process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';

      console.log(`[Email Webhook] Intentando enviar correo a: ${to} | Asunto: ${subject}`);

      if (targetWebhook) {
        console.log(`[Email Webhook] Enviando petición a: ${targetWebhook}`);
        
        let payload: any;
        // Si es la API oficial de Resend (resend.com)
        if (targetWebhook.includes('resend.com') || (targetApiKey && targetApiKey.startsWith('re_'))) {
          const effectiveFrom = fromAddress.includes('@') ? fromAddress : 'onboarding@resend.dev';
          payload = {
            from: effectiveFrom.includes('<') ? effectiveFrom : `Planta RCD <${effectiveFrom}>`,
            to: Array.isArray(to) ? to : [to],
            subject: subject || 'Notificación Planta RCD',
            html: html || '',
            text: text || '',
          };
        } else {
          // Formato estándar para Zapier, Make, n8n, Supabase Edge Functions, Webhook propio
          payload = {
            to,
            email: to,
            recipient: to,
            from: fromAddress,
            subject: subject || 'Notificación Planta RCD',
            html: html || '',
            text: text || '',
            message: text || '',
            content: html || text || '',
            timestamp: new Date().toISOString(),
          };
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Planta-RCD-EcoMarraque/1.0',
        };

        if (targetApiKey) {
          headers['Authorization'] = `Bearer ${targetApiKey}`;
          headers['api-key'] = targetApiKey;
        }

        const webhookResponse = await fetch(targetWebhook, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const responseText = await webhookResponse.text();
        console.log(`[Email Webhook] Respuesta webhook status: ${webhookResponse.status} ${webhookResponse.statusText}`);

        if (webhookResponse.ok) {
          return res.json({
            success: true,
            status: webhookResponse.status,
            message: 'Correo enviado con éxito.',
            responseBody: responseText,
          });
        } else {
          console.warn(`[Email Webhook] Advertencia del webhook (${webhookResponse.status}):`, responseText);
          return res.status(webhookResponse.status || 500).json({
            success: false,
            status: webhookResponse.status,
            error: `El servidor de correo/Webhook devolvió error ${webhookResponse.status}: ${responseText}`,
          });
        }
      }

      // Si no hay webhook configurado en el backend
      console.log(`[Email Webhook] Aviso: No hay Webhook configurado. Notificación simulada para ${to}`);
      return res.json({
        success: true,
        mock: true,
        message: `Correo simulado correctamente para ${to}. Configure un Webhook o API Key en la pantalla de Configuración para entrega real.`,
      });
    } catch (err: any) {
      console.error('[Email Webhook] Error enviando correo:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Error inesperado en el servidor al enviar correo.',
      });
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
