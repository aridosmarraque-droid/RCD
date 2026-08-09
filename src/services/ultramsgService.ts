// Servicio para envío de WhatsApp a través de Ultramsg API

const ULTRAMSG_KEYS = {
  INSTANCE_ID: 'rcd_ultramsg_instance_id',
  TOKEN: 'rcd_ultramsg_token',
};

export interface UltramsgConfig {
  instanceId: string;
  token: string;
}

export class UltramsgService {
  static getConfig(): UltramsgConfig {
    const savedInstance = localStorage.getItem(ULTRAMSG_KEYS.INSTANCE_ID);
    const savedToken = localStorage.getItem(ULTRAMSG_KEYS.TOKEN);

    const instanceId = savedInstance || import.meta.env.VITE_ULTRAMSG_INSTANCE_ID || '';
    const token = savedToken || import.meta.env.VITE_ULTRAMSG_TOKEN || '';

    return { instanceId, token };
  }

  static saveConfig(instanceId: string, token: string): void {
    localStorage.setItem(ULTRAMSG_KEYS.INSTANCE_ID, instanceId.trim());
    localStorage.setItem(ULTRAMSG_KEYS.TOKEN, token.trim());
  }

  static isConfigured(): boolean {
    const { instanceId, token } = this.getConfig();
    return Boolean(instanceId && token);
  }

  static formatPhoneNumber(phone: string): string {
    // Clean and ensure Spanish international prefix +34 if missing
    let clean = phone.replace(/[^0-9+]/g, '');
    if (!clean.startsWith('+') && !clean.startsWith('34')) {
      if (clean.length === 9) {
        clean = `34${clean}`;
      }
    }
    if (clean.startsWith('+')) {
      clean = clean.substring(1);
    }
    return clean;
  }

  static async sendWhatsApp(toPhone: string, bodyText: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { instanceId, token } = this.getConfig();

    if (!instanceId || !token) {
      console.warn('Ultramsg no está configurado (falta Instance ID o Token).');
      return { success: false, error: 'Ultramsg no configurado en ajustes' };
    }

    const formattedTo = this.formatPhoneNumber(toPhone);
    if (!formattedTo || formattedTo.length < 9) {
      return { success: false, error: 'Número de teléfono no válido' };
    }

    try {
      const url = `https://api.ultramsg.com/${encodeURIComponent(instanceId)}/messages/chat`;
      const params = new URLSearchParams();
      params.append('token', token);
      params.append('to', formattedTo);
      params.append('body', bodyText);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();

      if (data.sent === 'true' || data.sent === true || data.id) {
        return { success: true, messageId: data.id || data.message };
      } else {
        return { success: false, error: data.error || data.message || JSON.stringify(data) };
      }
    } catch (err: any) {
      console.error('Error enviando WhatsApp vía Ultramsg:', err);
      return { success: false, error: err?.message || 'Error de red al conectar con Ultramsg' };
    }
  }
}
