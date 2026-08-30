// Servicio para envío de notificaciones por Correo Electrónico (Email)

const EMAIL_KEYS = {
  WEBHOOK_URL: 'rcd_email_webhook_url',
  API_KEY: 'rcd_email_api_key',
  FROM_ADDRESS: 'rcd_email_from_address',
  SIGNER_ADDRESS: 'rcd_email_signer_address',
};

export interface EmailConfig {
  webhookUrl: string;
  apiKey: string;
  fromAddress: string;
  signerAddress: string;
}

export class EmailService {
  static getConfig(): EmailConfig {
    const webhookUrl = localStorage.getItem(EMAIL_KEYS.WEBHOOK_URL) || (import.meta as any).env?.VITE_EMAIL_WEBHOOK_URL || '';
    const apiKey = localStorage.getItem(EMAIL_KEYS.API_KEY) || (import.meta as any).env?.VITE_EMAIL_API_KEY || '';
    const fromAddress = localStorage.getItem(EMAIL_KEYS.FROM_ADDRESS) || 'notificaciones@plantarcd.es';
    const signerAddress = localStorage.getItem(EMAIL_KEYS.SIGNER_ADDRESS) || 'direccion@plantarcd.es';

    return { webhookUrl, apiKey, fromAddress, signerAddress };
  }

  static saveConfig(webhookUrl: string, apiKey: string, fromAddress: string, signerAddress?: string): void {
    localStorage.setItem(EMAIL_KEYS.WEBHOOK_URL, webhookUrl.trim());
    localStorage.setItem(EMAIL_KEYS.API_KEY, apiKey.trim());
    localStorage.setItem(EMAIL_KEYS.FROM_ADDRESS, fromAddress.trim() || 'notificaciones@plantarcd.es');
    if (signerAddress !== undefined) {
      localStorage.setItem(EMAIL_KEYS.SIGNER_ADDRESS, signerAddress.trim() || 'direccion@plantarcd.es');
    }
  }

  static isConfigured(): boolean {
    const { webhookUrl, apiKey } = this.getConfig();
    return Boolean(webhookUrl || apiKey);
  }

  static async sendEmail(options: {
    to: string;
    subject: string;
    htmlBody: string;
    textBody: string;
  }): Promise<{ success: boolean; error?: string; message?: string }> {
    const { webhookUrl, apiKey, fromAddress } = this.getConfig();

    if (!options.to || !options.to.includes('@')) {
      return { success: false, error: 'Dirección de correo electrónico no válida' };
    }

    if (!this.isConfigured()) {
      return { success: false, error: 'Servicio de correo no configurado. Introduzca una API Key de Resend (re_...) o una URL de Webhook en Ajustes.' };
    }

    // Intento 1: Llamar al endpoint backend proxy /api/send-email si existe (Express en dev o prod)
    try {
      const serverResponse = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: options.to,
          from: fromAddress,
          subject: options.subject,
          html: options.htmlBody,
          text: options.textBody,
          webhookUrl,
          apiKey,
        }),
      });

      if (serverResponse.ok) {
        const data = await serverResponse.json();
        return { success: true, message: data.message || 'Correo enviado correctamente a través del servidor.' };
      } else if (serverResponse.status !== 404) {
        const errData = await serverResponse.json().catch(() => ({ error: 'Error del servidor' }));
        console.warn('Respuesta de error en /api/send-email:', errData);
      }
    } catch {
      // El backend proxy no está disponible en despliegues estáticos (ej: Vercel SPA) - procedemos al intento directo
    }

    // Intento 2: Envío directo a la API de Resend (si la API Key empieza por 're_' o webhook apunta a resend)
    const isResend = (apiKey && apiKey.startsWith('re_')) || (webhookUrl && webhookUrl.includes('resend.com'));
    if (isResend) {
      try {
        const resendEndpoint = 'https://api.resend.com/emails';
        // Para pruebas en cuentas gratuitas de Resend sin dominio propio verificado, usar onboarding@resend.dev
        const effectiveFrom = fromAddress.includes('@') ? fromAddress : 'onboarding@resend.dev';

        const resendResponse = await fetch(resendEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: effectiveFrom.includes('<') ? effectiveFrom : `Planta RCD <${effectiveFrom}>`,
            to: [options.to],
            subject: options.subject,
            html: options.htmlBody,
            text: options.textBody,
          }),
        });

        const resendData = await resendResponse.json().catch(() => ({}));
        if (resendResponse.ok) {
          return { success: true, message: `Correo enviado exitosamente con Resend (ID: ${resendData.id || 'OK'})` };
        } else {
          const errMsg = resendData.message || resendData.error || `Error ${resendResponse.status} en Resend API`;
          return { success: false, error: `Resend: ${errMsg}` };
        }
      } catch (err: any) {
        console.warn('Error en llamada directa a Resend API:', err);
        return { success: false, error: `Error de conexión con Resend: ${err.message}` };
      }
    }

    // Intento 3: Envío directo a Webhook genérico (Zapier, Make, n8n, Supabase Edge Functions, Formspree, etc.)
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: options.to,
            email: options.to,
            recipient: options.to,
            from: fromAddress,
            subject: options.subject,
            html: options.htmlBody,
            text: options.textBody,
            message: options.textBody,
            timestamp: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          return { success: true, message: 'Notificación enviada exitosamente al Webhook.' };
        } else {
          const textErr = await response.text().catch(() => '');
          return { success: false, error: `El Webhook respondió con código ${response.status}: ${textErr}` };
        }
      } catch (err: any) {
        console.warn('Aviso enviando correo vía webhook:', err);
        return { success: false, error: `Error de red al conectar con el Webhook: ${err.message}` };
      }
    }

    return { success: false, error: 'No se pudo enviar el correo: configure una API Key válida de Resend o un Webhook en Ajustes.' };
  }

  static async sendAlbaranEmail(
    toEmail: string,
    clientName: string,
    albaran: {
      numAlbaran: string;
      wasteTypeName: string;
      wasteTypeCode: string;
      quantityTons: number;
      licensePlate: string;
      plantZone?: string;
      date: string;
      time: string;
      driverName?: string;
      truckPhotoUrl?: string;
      unloadPhotoUrl?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `[Planta RCD] Notificación de Albarán Nº ${albaran.numAlbaran}`;

    const textBody = `
PLANTA DE RESIDUOS RCD
----------------------------------------
Estimado cliente ${clientName},

Se ha registrado en planta un nuevo albarán de entrega de residuos:

• Nº Albarán: ${albaran.numAlbaran}
• Residuo: ${albaran.wasteTypeName} (${albaran.wasteTypeCode})
• Peso Neto: ${albaran.quantityTons} toneladas
• Matrícula: ${albaran.licensePlate}
• Transportista: ${albaran.driverName || 'No especificado'}
• Zona de Planta: ${albaran.plantZone || 'Zona A'}
• Fecha y Hora: ${albaran.date} a las ${albaran.time}

Puede acceder a su Portal de Clientes para revisar el albarán y descargar sus certificados de valorización.

Atentamente,
Planta de Residuos RCD
Gestión Sostenible conforme a Ley 7/2022 y RD 105/2008
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
    .card { background-color: #1e293b; border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #334155; }
    .header { font-size: 20px; font-weight: bold; color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 14px; }
    .label { color: #94a3b8; }
    .value { font-weight: bold; color: #ffffff; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">🏗️ Planta de Residuos RCD</div>
    <p>Estimado cliente <strong>${clientName}</strong>,</p>
    <p>Se ha registrado un nuevo albarán de entrega en la planta:</p>
    
    <div class="row"><span class="label">Nº Albarán</span><span class="value">${albaran.numAlbaran}</span></div>
    <div class="row"><span class="label">Residuo</span><span class="value">${albaran.wasteTypeName} (${albaran.wasteTypeCode})</span></div>
    <div class="row"><span class="label">Peso Neto</span><span class="value">${albaran.quantityTons} Toneladas</span></div>
    <div class="row"><span class="label">Matrícula</span><span class="value">${albaran.licensePlate}</span></div>
    <div class="row"><span class="label">Zona Planta</span><span class="value">${albaran.plantZone || 'Zona A'}</span></div>
    <div class="row"><span class="label">Fecha / Hora</span><span class="value">${albaran.date} ${albaran.time}</span></div>

    <p style="margin-top:20px; font-size:13px; color:#cbd5e1;">Información del certificado disponible en el Portal del Cliente.</p>
    <div class="footer">Planta de Residuos RCD — Conforme a Ley 7/2022 y RD 105/2008</div>
  </div>
</body>
</html>
`;

    return this.sendEmail({
      to: toEmail,
      subject,
      textBody,
      htmlBody,
    });
  }

  static async sendPendingSignatureEmail(cert: {
    certificateNumber: string;
    clientName: string;
    thirdPartyName: string;
    constructionSiteName: string;
    totalTons: number;
    issueDate: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { signerAddress } = this.getConfig();
    const subject = `⚠️ [Planta RCD] Solicitud de Firma Digital: Certificado ${cert.certificateNumber}`;

    const textBody = `
PLANTA DE RESIDUOS RCD - AVISO AL RESPONSABLE DE FIRMA
--------------------------------------------------
Se ha emitido una nueva solicitud de Certificado de Valorización RCD que requiere su Firma Digital:

• Nº Certificado: ${cert.certificateNumber}
• Cliente Solicitante: ${cert.clientName}
• Promotor / Beneficiario: ${cert.thirdPartyName}
• Obra: ${cert.constructionSiteName}
• Toneladas Certificadas: ${cert.totalTons.toFixed(2)} t
• Fecha de Emisión: ${cert.issueDate}

Por favor, acceda a la Aplicación en el Panel de Administración para revisar y firmar digitalmente el certificado.
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .card { background-color: #1e293b; border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #f59e0b; }
    .header { font-size: 20px; font-weight: bold; color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 14px; }
    .label { color: #94a3b8; }
    .value { font-weight: bold; color: #ffffff; }
    .btn { display: inline-block; background-color: #f59e0b; color: #0f172a; font-weight: bold; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">✍️ Firma Digital Pendiente - Certificado RCD</div>
    <p>Estimado Responsable de Firma,</p>
    <p>Se ha generado una solicitud de certificado de gestión de residuos RCD que requiere su firma digital autorizada:</p>

    <div class="row"><span class="label">Nº Certificado</span><span class="value">${cert.certificateNumber}</span></div>
    <div class="row"><span class="label">Cliente</span><span class="value">${cert.clientName}</span></div>
    <div class="row"><span class="label">Promotor / Obra</span><span class="value">${cert.thirdPartyName} - ${cert.constructionSiteName}</span></div>
    <div class="row"><span class="label">Toneladas RCD</span><span class="value">${cert.totalTons.toFixed(2)} Toneladas</span></div>
    <div class="row"><span class="label">Fecha</span><span class="value">${cert.issueDate}</span></div>

    <p style="margin-top:20px; font-size:13px; color:#fcd34d;">
      Por favor, acceda al Panel de Administración de la Planta RCD para estampillar la firma digital autorizada.
    </p>
  </div>
</body>
</html>
`;

    return this.sendEmail({
      to: signerAddress,
      subject,
      textBody,
      htmlBody,
    });
  }

  static async sendSignedCertificateEmail(
    toEmail: string,
    cert: {
      certificateNumber: string;
      clientName: string;
      thirdPartyName: string;
      totalTons: number;
      signedAt?: string;
      signerName?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const subject = `✅ [Planta RCD] Certificado ${cert.certificateNumber} Firmado Digitalmente`;

    const textBody = `
PLANTA DE RESIDUOS RCD
--------------------------------------------------
Estimado cliente ${cert.clientName},

Nos complace informarle que su Certificado de Valorización y Gestión de Residuos RCD ha sido FIRMADO DIGITALMENTE por la empresa y se encuentra listo y plenamente válido:

• Nº Certificado: ${cert.certificateNumber}
• Promotor / Obra: ${cert.thirdPartyName}
• Total Valorizado: ${cert.totalTons.toFixed(2)} toneladas
• Firmante Autorizado: ${cert.signerName || 'Director Técnico Planta RCD'}
• Fecha de Firma: ${cert.signedAt || new Date().toLocaleDateString('es-ES')}

Ya puede acceder a su Portal de Cliente para consultar y descargar el certificado oficial en formato impreso / PDF.
`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
    .card { background-color: #1e293b; border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #10b981; }
    .header { font-size: 20px; font-weight: bold; color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; font-size: 14px; }
    .label { color: #94a3b8; }
    .value { font-weight: bold; color: #ffffff; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">✅ Certificado RCD Firmado Digitalmente</div>
    <p>Estimado cliente <strong>${cert.clientName}</strong>,</p>
    <p>Su Certificado de Valorización de Residuos RCD ha sido validado y <strong>firmado digitalmente</strong> por la dirección técnica de la planta:</p>

    <div class="row"><span class="label">Nº Certificado</span><span class="value">${cert.certificateNumber}</span></div>
    <div class="row"><span class="label">Promotor / Tercero</span><span class="value">${cert.thirdPartyName}</span></div>
    <div class="row"><span class="label">Total Residuos</span><span class="value">${cert.totalTons.toFixed(2)} Toneladas</span></div>
    <div class="row"><span class="label">Firmado Por</span><span class="value">${cert.signerName || 'Dirección Técnica RCD'}</span></div>
    <div class="row"><span class="label">Estado</span><span class="value" style="color:#10b981;">✓ Firmado y Válido</span></div>

    <p style="margin-top:20px; font-size:13px; color:#cbd5e1;">
      El documento oficial ya está disponible para su descarga en el Portal de Cliente.
    </p>
  </div>
</body>
</html>
`;

    return this.sendEmail({
      to: toEmail,
      subject,
      textBody,
      htmlBody,
    });
  }
}
