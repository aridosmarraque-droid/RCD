import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const ALBARAN_PROMPT = `Actúa como un sistema experto de OCR y visión artificial de máxima precisión especializado en los albaranes de entrega y pesaje de la empresa "ÁRIDOS MARRAQUE S.L." (y plantas de valorización de RCD / canteras de áridos).

Todos los albaranes siguen una estructura visual estándar idéntica dividida en las siguientes zonas:

1. ENCABEZADO SUPERIOR:
   - "ARIDOS MARRAQUE S.L." (B04117818, Avda. Federico Garcia Lorca s/n 04260 Rioja).
   - Puede figurar la palabra "Original" en la esquina superior derecha.

2. BLOQUE SUPERIOR IZQUIERDO (Bajo el título "Albaran de Entrega"):
   - "Fecha : DD/MM/YY" o "DD/MM/YYYY" (ejemplo: "Fecha : 02/09/26" significa 02 de Septiembre de 2026 -> convertir a formato ISO "2026-09-02").
   - "Nº Albaran : XXXXXXX" -> Número de 7 dígitos (ej: "2607873", "2607584").
   - "Cód. Cliente : CXXXX" -> Letra C seguida de 4 dígitos (ej: "C0096", "C0048", "C0012", "C0100").

3. BLOQUE SUPERIOR DERECHO (Datos del Cliente / Empresa):
   - Primera línea en negrita: Razón social del Cliente (ej: "MATERIALES DE CONSTRUCCION NEGI", "ANGEL ARTES SANCHEZ S.L.").
   - Líneas intermedias: Dirección de la empresa (ej: "C/RAMON Y CAJAL, Nº6 \n 04250 PECHINA \n ALMERIA").
   - Última línea: "ID fiscal : ESBXXXXXXXX" o "BXXXXXXXX" (ej: "ESB04435194", "B04221487").

4. TABLA CENTRAL DE MATERIAL / PESAJE:
   - Cabeceras de columnas: | Núm | Descripción | Bruto | Tara | Cantidad |
   - Fila de datos del residuo:
     • "Núm": Código interno (ej: "GRVA2", "HORM1", "ESCO1", "RCD01").
     • "Descripción": Nombre del residuo con su código LER entre paréntesis.
       Ejemplo: "TN DE ESCOMBRO SUCIO (LER 17 09 04)" o "TN DE HORMIGON (LER 17 01 01)" o "TIERRAS Y PIEDRAS (LER 17 05 04)".
       -> Extrae el Código LER exacto de dentro del paréntesis: "17 09 04", "17 01 01", "17 01 02", "17 01 07", "17 05 04", "17 02 01", etc.
       -> Extrae la denominación limpia: "TN DE ESCOMBRO SUCIO" (o el texto que figure antes de LER).
     • "Bruto": Peso bruto en toneladas (ej: 37,62).
     • "Tara": Peso tara del camión en toneladas (ej: 13,6).
     • "Cantidad": PESO NETO / TONELADAS NETAS (ej: "24,02" -> 24.02). En estos albaranes la columna "Cantidad" es SIEMPRE el peso neto en toneladas.

5. BLOQUE "Datos Transporte" (Debajo de la tabla):
   - "Matricula : XXXX-XXX / RXXXX-XXX" (ej: "1885HGF/R0549BDR", "1885HGF", "9523HTN"). Puede ser tractora y remolque separados por barra.
   - "Transportista : [CIF] [NOMBRE EMPRESA O CONDUCTOR]" (ej: "B04221487 ANGEL ARTES SANCHEZ S.L.").
   - "Tara camion : 13,600 TONELADAS".

6. BLOQUE "Datos Destino":
   - Población u obra (ej: "PECHINA", "ALMERIA", "RIOJA").

Extrae la información con absoluta fidelidad y devuélvela ÚNICAMENTE en este formato JSON estricto:
{
  "numAlbaran": "Número de 7 dígitos del albarán (ej: 2607873)",
  "clientCode": "Código de cliente (ej: C0096)",
  "clientName": "Razón social del cliente (ej: MATERIALES DE CONSTRUCCION NEGI)",
  "clientCif": "ID fiscal / NIF / CIF del cliente si figura (ej: ESB04435194)",
  "wasteTypeCode": "Código LER con espacios (ej: 17 09 04, 17 01 01, 17 01 07, 17 05 04)",
  "wasteTypeName": "Nombre o descripción del residuo impreso (ej: TN DE ESCOMBRO SUCIO)",
  "quantityTons": 24.02,
  "licensePlate": "Matrícula completa del vehículo (ej: 1885HGF/R0549BDR)",
  "date": "2026-09-02",
  "time": "HH:MM si figura, o string vacío",
  "notes": "Transportista o destino si figura (ej: Destino: PECHINA | Transportista: ANGEL ARTES SANCHEZ S.L.)"
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

      // Modelos estándar de Gemini Vision
      const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
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
            setTimeout(() => reject(new Error(`Timeout de OCR con ${modelName} (15s)`)), 15000)
          );

          const response = await Promise.race([generatePromise, timeoutPromise]);
          if (response && response.text) {
            rawResponseText = response.text;
            break; // Exito con este modelo
          }
        } catch (mErr: any) {
          const errMsg = mErr?.message || String(mErr);
          console.warn(`Intento de OCR con ${modelName} no completado:`, errMsg);
          lastError = mErr;

          // Si el error es de autenticación o API Key revocada/filtrada, fallar rápido sin esperar a probar otros modelos
          if (
            errMsg.includes('leaked') ||
            errMsg.includes('API key') ||
            errMsg.includes('PERMISSION_DENIED') ||
            errMsg.includes('API_KEY_INVALID') ||
            errMsg.includes('403') ||
            errMsg.includes('401')
          ) {
            return res.status(403).json({
              error: 'La Clave API de Gemini actual fue reportada como revocada o no válida ("leaked"). Por favor, genera o actualiza una nueva clave GEMINI_API_KEY en el menú de Ajustes (Settings > Secrets) de Google AI Studio.',
              isApiKeyError: true,
              detail: errMsg,
            });
          }
        }
      }

      if (rawResponseText) {
        try {
          let cleanText = rawResponseText.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            cleanText = jsonMatch[0];
          }
          const parsed = JSON.parse(cleanText);
          return res.json(parsed);
        } catch (pErr) {
          console.error('JSON parse error from Gemini:', pErr);
          return res.json({ notes: rawResponseText });
        }
      } else {
        return res.status(500).json({ error: lastError?.message || 'Sin respuesta de los modelos Gemini Vision' });
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
