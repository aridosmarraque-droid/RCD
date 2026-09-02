import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const ALBARAN_PROMPT = `Actúa como un sistema experto de visión artificial y OCR de alta precisión especializado en albaranes de pesaje en báscula, tickets de entrega y documentos de plantas de reciclaje RCD y canteras de áridos (SAP, Áridos Marraque, Holcim, Heidelberg, Cemex, etc.).

Examina minuciosamente toda la foto del albarán o ticket (encabezado, campos de cliente, tabla de pesajes bruto/tara/neto, códigos LER, matrícula, número de albarán, fecha y hora).

Extrae ÚNICAMENTE la información REAL visible en la imagen. NO inventes ningún dato. Si un dato no figura o no es legible, déjalo como string vacío ("") o 0 para números.

Devuelve la información en formato JSON estricto con los siguientes campos:
{
  "numAlbaran": "Número o código del albarán/ticket visible (ej: 2607584, ALB-2026-08493, 2026/0129). Busca 'Nº Albarán', 'Albarán:', 'Nº Ticket', 'Ticket:', 'Nº:', 'Doc:', etc.",
  "clientCode": "Código de cliente SAP si aparece en el documento (ej: C0048, C0086, C-00100, 4801)",
  "clientName": "Razón social del cliente LIMPIA, sin incluir el código de cliente SAP entre corchetes o paréntesis (ej: 'ANGEL ARTES SANCHEZ S.L.' en lugar de '[C0048] ANGEL ARTES SANCHEZ S.L.')",
  "wasteTypeCode": "Código LER del residuo (ej: 17 01 01, 17 01 02, 17 01 07, 17 05 04, 17 09 04, 17 02 01, 17 03 02). Si figura sin espacios como 170101, sepáralo como '17 01 01'",
  "wasteTypeName": "Denominación o descripción del residuo o material impresa en el papel (ej: TN DE HORMIGON, Hormigón Limpio, RCD Mezcla, Tierras y piedras)",
  "quantityTons": Número decimal exacto con las Toneladas Netas (ej: 19.84). IMPORTANTE: Si el peso neto aparece en kilogramos (ej: '19.840 kg', '24560 KG'), DIVÍDELO entre 1000 para obtener toneladas (19.84, 24.56). Si no hay peso, usa 0,
  "licensePlate": "Matrícula del vehículo/camión si figura en la imagen (ej: 9523HTN, 8492-KZX, 9523HTN/R3043BCG)",
  "date": "Fecha en formato YYYY-MM-DD si figura (ej: 2026-08-10, convertir 10/08/2026 -> 2026-08-10)",
  "time": "Hora en formato HH:MM si figura (ej: 10:35)",
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

      const generatePromise = ai.models.generateContent({
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

      // 25-second timeout limit to allow multimodal vision model full inference
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo límite de reconocimiento OCR superado (25s)')), 25000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);

      if (response.text) {
        try {
          let cleanText = response.text.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          // Also look for JSON object boundaries if surrounding text exists
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanText = jsonMatch[0];
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

      const targetApiKey = (apiKey || process.env.EMAIL_API_KEY || process.env.RESEND_API_KEY || process.env.BREVO_API_KEY || process.env.SENDGRID_API_KEY || '').trim();
      let targetWebhook = (webhookUrl || process.env.EMAIL_WEBHOOK_URL || process.env.WEBHOOK_URL || '').trim();
      const fromAddress = (from || process.env.EMAIL_FROM_ADDRESS || 'administracion@marraque.es').trim();

      console.log('\n==================================================');
      console.log(`📧 [Servidor /api/send-email] Petición de envío de correo`);
      console.log(`• Destinatario: ${to}`);
      console.log(`• Remitente:    ${fromAddress}`);
      console.log(`• Asunto:       ${subject}`);
      console.log(`• Webhook:      ${targetWebhook || '(No especificado)'}`);
      console.log(`• API Key:      ${targetApiKey ? `${targetApiKey.slice(0, 6)}... (${targetApiKey.length} caracteres)` : '(No configurada)'}`);

      // 1. Detectar Proveedor
      let providerName = 'Desconocido';
      let requestUrl = '';
      let requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      let requestPayload: any = null;

      const isResend = targetApiKey.startsWith('re_') || targetWebhook.includes('resend.com');
      const isBrevo = targetApiKey.startsWith('xkeysib-') || targetWebhook.includes('brevo.com') || targetWebhook.includes('sendinblue.com');
      const isSendGrid = targetApiKey.startsWith('SG.') || targetWebhook.includes('sendgrid.com');

      if (isResend) {
        providerName = 'Resend (resend.com)';
        requestUrl = targetWebhook && targetWebhook.startsWith('http') ? targetWebhook : 'https://api.resend.com/emails';
        requestHeaders['Authorization'] = `Bearer ${targetApiKey}`;
        
        // En Resend: si el remitente no es un dominio verificado o es una cuenta de prueba, se puede usar onboarding@resend.dev
        const effectiveFrom = fromAddress.includes('@') ? fromAddress : 'onboarding@resend.dev';
        requestPayload = {
          from: effectiveFrom.includes('<') ? effectiveFrom : `Áridos Marraque <${effectiveFrom}>`,
          to: Array.isArray(to) ? to : [to],
          subject: subject || 'Notificación Planta RCD',
          html: html || '',
          text: text || '',
        };
      } else if (isBrevo) {
        providerName = 'Brevo / Sendinblue (api.brevo.com)';
        requestUrl = targetWebhook && targetWebhook.startsWith('http') ? targetWebhook : 'https://api.brevo.com/v3/smtp/email';
        requestHeaders['api-key'] = targetApiKey;
        requestPayload = {
          sender: {
            name: 'Áridos Marraque - Planta RCD',
            email: fromAddress,
          },
          to: [
            {
              email: to,
              name: to.split('@')[0],
            },
          ],
          subject: subject || 'Notificación Planta RCD',
          htmlContent: html || `<pre>${text}</pre>`,
          textContent: text || '',
        };
      } else if (isSendGrid) {
        providerName = 'SendGrid (api.sendgrid.com)';
        requestUrl = targetWebhook && targetWebhook.startsWith('http') ? targetWebhook : 'https://api.sendgrid.com/v3/mail/send';
        requestHeaders['Authorization'] = `Bearer ${targetApiKey}`;
        requestPayload = {
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromAddress, name: 'Áridos Marraque - Planta RCD' },
          subject: subject || 'Notificación Planta RCD',
          content: [
            {
              type: 'text/html',
              value: html || text || 'Notificación Planta RCD',
            },
          ],
        };
      } else if (targetWebhook && targetWebhook.startsWith('http')) {
        providerName = 'Webhook Personalizado / Make / Zapier / n8n / Apps Script';
        requestUrl = targetWebhook;
        if (targetApiKey) {
          requestHeaders['Authorization'] = `Bearer ${targetApiKey}`;
          requestHeaders['api-key'] = targetApiKey;
          requestHeaders['x-api-key'] = targetApiKey;
        }
        requestPayload = {
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

      // Si NO hay ningún proveedor o webhook configurado
      if (!requestUrl) {
        console.warn('⚠️ [Servidor /api/send-email] No hay API Key ni Webhook configurado.');
        console.log('==================================================\n');
        return res.status(400).json({
          success: false,
          isConfigured: false,
          error: 'No hay ningún servicio de correo configurado. Por favor, introduzca una Clave API (Resend "re_...", Brevo "xkeysib-...", SendGrid "SG....") o una URL de Webhook en la pestaña "Correo" de Ajustes.',
          diagnostic: {
            to,
            from: fromAddress,
            hasWebhook: Boolean(targetWebhook),
            hasApiKey: Boolean(targetApiKey),
          },
        });
      }

      console.log(`• Proveedor detectado: ${providerName}`);
      console.log(`• URL Endpoint:       ${requestUrl}`);

      // Enviar la petición HTTP al proveedor externo
      const fetchResponse = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestPayload),
      });

      const responseText = await fetchResponse.text();
      console.log(`• Código de respuesta HTTP: ${fetchResponse.status} ${fetchResponse.statusText}`);
      console.log(`• Respuesta del proveedor:  ${responseText.slice(0, 500)}`);
      console.log('==================================================\n');

      let parsedResponseBody: any = null;
      try {
        parsedResponseBody = JSON.parse(responseText);
      } catch {
        parsedResponseBody = responseText;
      }

      if (fetchResponse.ok) {
        return res.json({
          success: true,
          provider: providerName,
          status: fetchResponse.status,
          message: `Correo enviado exitosamente a través de ${providerName}.`,
          responseBody: parsedResponseBody,
        });
      } else {
        let helpfulTip = '';
        if (isResend && (responseText.includes('domain') || responseText.includes('verified') || fetchResponse.status === 403)) {
          helpfulTip = ' [Aviso Resend: Si aún no ha verificado el dominio marraque.es en resend.com, el remitente debe ser onboarding@resend.dev y el destinatario debe ser el email registrado en su cuenta de Resend].';
        } else if (isBrevo && (fetchResponse.status === 401 || fetchResponse.status === 403)) {
          helpfulTip = ' [Aviso Brevo: Compruebe que la API Key (xkeysib-...) es válida y que el email remitente está autorizado en su panel de Brevo].';
        }

        return res.status(fetchResponse.status || 500).json({
          success: false,
          provider: providerName,
          status: fetchResponse.status,
          error: `Error de ${providerName} (${fetchResponse.status}): ${responseText}${helpfulTip}`,
          rawResponse: parsedResponseBody,
        });
      }
    } catch (err: any) {
      console.error('❌ [Servidor /api/send-email] Error fatal de conexión:', err);
      return res.status(500).json({
        success: false,
        error: `Error de conexión al enviar correo: ${err.message || 'Error de red en el servidor'}`,
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
