import { Albaran, Certificate, Client, WasteType } from '@/types/rcd';
import { SupabaseService } from './supabaseClient';
import { UltramsgService } from './ultramsgService';

export const OFFICIAL_WASTE_TYPES: WasteType[] = [
  {
    code: '17 01 01',
    name: 'Hormigón y Piedra (Escombro Limpio)',
    category: 'Limpio',
    pricePerTon: 8.5,
    description: 'Bloques de hormigón, mortero, piedra natural sin mezcla de plásticos ni maderas.',
  },
  {
    code: '17 01 02',
    name: 'Ladrillos, Tejas y Cerámica',
    category: 'Limpio',
    pricePerTon: 9.0,
    description: 'Material cerámico de tabiquería, teja roja, gres y azulejos.',
  },
  {
    code: '17 01 07',
    name: 'Mezcla Hormigón y Cerámica (Escombro Seleccionado)',
    category: 'Limpio',
    pricePerTon: 11.0,
    description: 'Mezcla limpia de materiales pétreos y cerámicos sin impropios.',
  },
  {
    code: '17 05 04',
    name: 'Tierras y Piedras de Excavación',
    category: 'Tierras',
    pricePerTon: 6.0,
    description: 'Tierras limpias procedente de desbroces, cimentaciones y vaciados de obras.',
  },
  {
    code: '17 09 04',
    name: 'Residuos Mezclados RCD (Escombro Sucio / Mezcla)',
    category: 'Sucio',
    pricePerTon: 18.5,
    description: 'Mezclas de RCD con resto de yesos, maderas, plásticos o sacos de papel.',
  },
  {
    code: '17 02 01',
    name: 'Madera de Obra y Encofrados',
    category: 'Valorizable',
    pricePerTon: 14.0,
    description: 'Palets, tableros de encofrar, vigas y recortes de madera.',
  },
  {
    code: '17 04 05',
    name: 'Hierro y Acero (Metales RCD)',
    category: 'Valorizable',
    pricePerTon: 0.0,
    description: 'Varillas de ferralla, perfiles de acero, tuberías metálicas.',
  },
];

const STORAGE_KEYS = {
  CLIENTS: 'rcd_app_clients_v3',
  ALBARANES: 'rcd_app_albaranes_v3',
  CERTIFICATES: 'rcd_app_certificates_v3',
};

// DEMO DATA CLEARED AS REQUESTED BY USER
const INITIAL_CLIENTS: Client[] = [];
const INITIAL_ALBARANES: Albaran[] = [];
const INITIAL_CERTIFICATES: Certificate[] = [];

export class RCDService {
  // ===============================================
  // CLIENTS MANAGEMENT
  // ===============================================
  static getClients(): Client[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (!data) {
        return INITIAL_CLIENTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CLIENTS;
    }
  }

  static async loadClientsFromRemote(): Promise<Client[]> {
    if (SupabaseService.isConfigured()) {
      try {
        const remoteClients = await SupabaseService.fetchClients();
        this.saveClientsLocal(remoteClients);
        return remoteClients;
      } catch (err) {
        console.error('Error al cargar clientes de Supabase:', err);
      }
    }
    return this.getClients();
  }

  static saveClientsLocal(clients: Client[]): void {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }

  static async saveClients(clients: Client[]): Promise<void> {
    this.saveClientsLocal(clients);
    if (SupabaseService.isConfigured()) {
      for (const client of clients) {
        try {
          await SupabaseService.upsertClient(client);
        } catch (e) {
          console.error('Failed to sync client to Supabase:', e);
        }
      }
    }
  }

  static getClientById(id: string): Client | undefined {
    return this.getClients().find((c) => c.id === id);
  }

  static async updateClientNotificationSettings(
    id: string,
    notifyEmail: boolean,
    notifyMobile: boolean,
    email?: string,
    mobile?: string
  ): Promise<Client | null> {
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updated: Client = {
      ...clients[index],
      notifyEmail,
      notifyMobile,
      ...(email !== undefined ? { email } : {}),
      ...(mobile !== undefined ? { mobile } : {}),
    };

    clients[index] = updated;
    await this.saveClients(clients);
    return updated;
  }

  static async upsertClientFromScan(clientCode: string, clientName: string): Promise<Client> {
    const clients = this.getClients();
    let existing = clients.find(
      (c) =>
        (clientCode && c.code.toLowerCase() === clientCode.toLowerCase()) ||
        (clientName && c.name.toLowerCase() === clientName.toLowerCase())
    );

    if (existing) {
      return existing;
    }

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      code: clientCode || `C-${Math.floor(1000 + Math.random() * 9000)}`,
      name: clientName || 'Cliente No Identificado',
      cif: 'B-' + Math.floor(10000000 + Math.random() * 90000000),
      email: `contacto@${(clientName || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '')}.es`,
      mobile: '+346' + Math.floor(10000000 + Math.random() * 90000000),
      notifyEmail: true,
      notifyMobile: true,
      createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    await this.saveClients(clients);
    return newClient;
  }

  // ===============================================
  // ALBARANES MANAGEMENT
  // ===============================================
  static getAlbaranes(): Albaran[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALBARANES);
      if (!data) {
        return INITIAL_ALBARANES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ALBARANES;
    }
  }

  static async loadAlbaranesFromRemote(): Promise<Albaran[]> {
    if (SupabaseService.isConfigured()) {
      try {
        const remoteAlbaranes = await SupabaseService.fetchAlbaranes();
        this.saveAlbaranesLocal(remoteAlbaranes);
        return remoteAlbaranes;
      } catch (err) {
        console.error('Error al cargar albaranes de Supabase:', err);
      }
    }
    return this.getAlbaranes();
  }

  static saveAlbaranesLocal(albaranes: Albaran[]): void {
    localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(albaranes));
  }

  static async createAlbaran(
    newAlbaran: Omit<Albaran, 'id' | 'certified' | 'createdAt'>
  ): Promise<Albaran> {
    const albaranes = this.getAlbaranes();

    // Ensure client exists
    const client = await this.upsertClientFromScan(newAlbaran.clientCode, newAlbaran.clientName);

    const created: Albaran = {
      ...newAlbaran,
      id: `alb-${Date.now()}`,
      clientId: client.id,
      certified: false,
      createdAt: new Date().toISOString(),
      notificationsSent: {
        mobileSent: false,
        emailSent: client.notifyEmail,
        timestamp: new Date().toISOString(),
      },
    };

    // Attempt WhatsApp notification via Ultramsg if client has mobile notification enabled
    if (client.notifyMobile && client.mobile && UltramsgService.isConfigured()) {
      const messageText = `🏭 *Planta RCD EcoMarraque*\n\nEstimado cliente *${client.name}*,\n\nSe ha registrado en planta un nuevo albarán de entrega:\n📜 *Nº Albarán:* ${created.numAlbaran}\n📦 *Residuo:* ${created.wasteTypeName} (${created.wasteTypeCode})\n⚖️ *Peso Neto:* ${created.quantityTons} toneladas\n🚚 *Matrícula:* ${created.licensePlate}\n📍 *Zona:* ${created.plantZone}\n📅 *Fecha/Hora:* ${created.date} ${created.time}\n\nGracias por su compromiso con la gestión sostenible de RCD.`;

      const sendResult = await UltramsgService.sendWhatsApp(client.mobile, messageText);
      if (sendResult.success) {
        created.notificationsSent = {
          mobileSent: true,
          emailSent: client.notifyEmail,
          timestamp: new Date().toISOString(),
        };
      }
    }

    albaranes.unshift(created);
    this.saveAlbaranesLocal(albaranes);

    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.insertAlbaran(created);
      } catch (err) {
        console.error('Error al guardar albarán en Supabase:', err);
      }
    }

    return created;
  }

  // ===============================================
  // CERTIFICATES MANAGEMENT
  // ===============================================
  static getCertificates(): Certificate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CERTIFICATES);
      if (!data) {
        return INITIAL_CERTIFICATES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CERTIFICATES;
    }
  }

  static async loadCertificatesFromRemote(): Promise<Certificate[]> {
    if (SupabaseService.isConfigured()) {
      try {
        const remoteCerts = await SupabaseService.fetchCertificates();
        this.saveCertificatesLocal(remoteCerts);
        return remoteCerts;
      } catch (err) {
        console.error('Error al cargar certificados de Supabase:', err);
      }
    }
    return this.getCertificates();
  }

  static saveCertificatesLocal(certs: Certificate[]): void {
    localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(certs));
  }

  /**
   * CRITICAL FEATURE: Issue a Waste Certificate for third party
   * - Locks all included albaranes (certified = true)
   * - Prevents any future certificate from using the same albaranes
   * - Saves to Supabase and sends WhatsApp via Ultramsg if configured
   */
  static async issueCertificate(payload: {
    clientId: string;
    clientName: string;
    clientCif: string;
    thirdPartyName: string;
    thirdPartyCif: string;
    constructionSiteName: string;
    constructionSiteAddress: string;
    selectedAlbaranIds: string[];
    issuerName: string;
  }): Promise<Certificate> {
    const allAlbaranes = this.getAlbaranes();

    // Filter valid, uncertified albaranes
    const albaranesToCertify = allAlbaranes.filter(
      (a) => payload.selectedAlbaranIds.includes(a.id) && !a.certified
    );

    if (albaranesToCertify.length === 0) {
      throw new Error('Los albaranes seleccionados ya han sido certificados previamente o no son válidos.');
    }

    const certId = `cert-${Date.now()}`;
    const certNumber = `CERT-RCD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Build breakdown by waste code
    const breakdownMap: Record<string, { code: string; name: string; tons: number; count: number }> = {};
    let totalTons = 0;

    for (const alb of albaranesToCertify) {
      totalTons += alb.quantityTons;
      if (!breakdownMap[alb.wasteTypeCode]) {
        breakdownMap[alb.wasteTypeCode] = {
          code: alb.wasteTypeCode,
          name: alb.wasteTypeName,
          tons: 0,
          count: 0,
        };
      }
      breakdownMap[alb.wasteTypeCode].tons += alb.quantityTons;
      breakdownMap[alb.wasteTypeCode].count += 1;
    }

    const wasteBreakdown = Object.values(breakdownMap).map((item) => ({
      wasteTypeCode: item.code,
      wasteTypeName: item.name,
      totalTons: Number(item.tons.toFixed(2)),
      albaranesCount: item.count,
    }));

    const newCertificate: Certificate = {
      id: certId,
      certificateNumber: certNumber,
      issueDate: new Date().toISOString().split('T')[0],
      clientId: payload.clientId,
      clientName: payload.clientName,
      clientCif: payload.clientCif,
      thirdPartyName: payload.thirdPartyName,
      thirdPartyCif: payload.thirdPartyCif,
      constructionSiteName: payload.constructionSiteName,
      constructionSiteAddress: payload.constructionSiteAddress,
      albaranIds: albaranesToCertify.map((a) => a.id),
      wasteBreakdown,
      totalTons: Number(totalTons.toFixed(2)),
      issuerName: payload.issuerName || 'Administrador Planta RCD',
      verificationCode: `VERIF-2026-RCD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: 'Emitido',
    };

    // LOCK the albaranes in local state
    const updatedAlbaranes = allAlbaranes.map((alb) => {
      if (payload.selectedAlbaranIds.includes(alb.id)) {
        return {
          ...alb,
          certified: true,
          certificateId: certId,
          certificateNumber: certNumber,
        };
      }
      return alb;
    });

    this.saveAlbaranesLocal(updatedAlbaranes);

    const certificates = this.getCertificates();
    certificates.unshift(newCertificate);
    this.saveCertificatesLocal(certificates);

    // Sync to Supabase
    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.insertCertificate(newCertificate);
        await SupabaseService.updateAlbaranesLockStatus(
          payload.selectedAlbaranIds,
          certId,
          certNumber
        );
      } catch (err) {
        console.error('Error al sincronizar certificado con Supabase:', err);
      }
    }

    // Send WhatsApp via Ultramsg if client has mobile number
    const client = this.getClientById(payload.clientId);
    if (client && client.notifyMobile && client.mobile && UltramsgService.isConfigured()) {
      const msg = `📜 *Planta RCD EcoMarraque*\n\nEstimado cliente *${client.name}*,\n\nSe ha emitido un nuevo *Certificado de Valorización de RCD*:\n\n📑 *Nº Certificado:* ${newCertificate.certificateNumber}\n🏗️ *Obra / Promotor:* ${newCertificate.constructionSiteName}\n⚖️ *Total Certificado:* ${newCertificate.totalTons} toneladas\n🔐 *Código Verificación:* ${newCertificate.verificationCode}\n\nPuede consultar e descargar su certificado desde el Portal del Cliente.`;

      await UltramsgService.sendWhatsApp(client.mobile, msg);
    }

    return newCertificate;
  }

  static clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.ALBARANES);
    localStorage.removeItem(STORAGE_KEYS.CERTIFICATES);
  }
}
