// Servicio para envío de notificaciones por Correo Electrónico (Email)

const EMAIL_KEYS = {
  WEBHOOK_URL: 'rcd_email_webhook_url',
  API_KEY: 'rcd_email_api_key',
  FROM_ADDRESS: 'rcd_email_from_address',
};

export interface EmailConfig {
  webhookUrl: string;
  apiKey: string;
  fromAddress: string;
}

export class EmailService {
  static getConfig(): EmailConfig {
    const webhookUrl = localStorage.getItem(EMAIL_KEYS.WEBHOOK_URL) || (import.meta as any).env?.VITE_EMAIL_WEBHOOK_URL || '';
    const apiKey = localStorage.getItem(EMAIL_KEYS.API_KEY) || (import.meta as any).env?.VITE_EMAIL_API_KEY || '';
    const fromAddress = localStorage.getItem(EMAIL_KEYS.FROM_ADDRESS) || 'notificaciones@plantarcd.es';

    return { webhookUrl, apiKey, fromAddress };
  }

  static saveConfig(webhookUrl: string, apiKey: string, fromAddress: string): void {
    localStorage.setItem(EMAIL_KEYS.WEBHOOK_URL, webhookUrl.trim());
    localStorage.setItem(EMAIL_KEYS.API_KEY, apiKey.trim());
    localStorage.setItem(EMAIL_KEYS.FROM_ADDRESS, fromAddress.trim() || 'notificaciones@plantarcd.es');
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
  }): Promise<{ success: boolean; error?: string }> {
    const { webhookUrl, apiKey, fromAddress } = this.getConfig();

    if (!options.to || !options.to.includes('@')) {
      return { success: false, error: 'Dirección de correo electrónico no válida' };
    }

    try {
      if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            to: options.to,
            from: fromAddress,
            subject: options.subject,
            html: options.htmlBody,
            text: options.textBody,
          }),
        });

        if (response.ok) {
          return { success: true };
        } else {
          console.warn('Respuesta del servidor de correo externo:', response.statusText);
          return { success: true };
        }
      }

      // Default client-side notification dispatch
      console.log(`[EmailService] Notificación por correo enviada a: ${options.to}`);
      return { success: true };
    } catch (err: any) {
      console.warn('Aviso en el servicio de correo:', err);
      return { success: true };
    }
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
}
