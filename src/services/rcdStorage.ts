import { Albaran, Certificate, Client, RCDUser, WasteType } from '../types/rcd';
import { SupabaseService } from './supabaseClient';
import { UltramsgService } from './ultramsgService';
import { EmailService } from './emailService';
import { compressImage } from '../utils/imageCompressor';

export const OFFICIAL_WASTE_TYPES: WasteType[] = [];

const STORAGE_KEYS = {
  CLIENTS: 'rcd_app_clients_v4',
  ALBARANES: 'rcd_app_albaranes_v4',
  CERTIFICATES: 'rcd_app_certificates_v4',
  WASTE_TYPES: 'rcd_app_waste_types_v5',
  USERS: 'rcd_app_users_v4',
  CURRENT_USER: 'rcd_app_current_user_v4',
};

// Purge any legacy demo or older cache versions from localStorage
try {
  const legacyKeys = [
    'rcd_app_waste_types_v4',
    'rcd_app_waste_types_v3',
    'rcd_app_waste_types_v2',
    'rcd_app_waste_types_v1',
    'rcd_app_albaranes_v1',
    'rcd_app_albaranes_v2',
    'rcd_app_albaranes_v3',
    'rcd_app_clients_v1',
    'rcd_app_clients_v2',
    'rcd_app_clients_v3',
    'rcd_app_certificates_v1',
    'rcd_app_certificates_v2',
    'rcd_app_certificates_v3',
    'rcd_albaranes_demo',
  ];
  for (const k of legacyKeys) {
    localStorage.removeItem(k);
  }
} catch {
  // ignore in non-browser environments
}

// INITIAL DATA IS EMPTY - DATA MUST COME FROM SUPABASE OR BE CREATED IN APP
const INITIAL_CLIENTS: Client[] = [];
const INITIAL_ALBARANES: Albaran[] = [];
const INITIAL_CERTIFICATES: Certificate[] = [];

const INITIAL_USERS: RCDUser[] = [
  {
    id: 'user-admin-01',
    name: 'Dirección / Administración Planta',
    nifCif: 'ADMIN',
    code: '1234',
    userType: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-worker-01',
    name: 'Carlos Gómez (Báscula)',
    nifCif: '12345678A',
    code: 'OPER123',
    userType: 'trabajador',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-empresa-01',
    name: 'Construcciones Marraque S.L.',
    nifCif: 'B98765432',
    code: 'C-00100',
    userType: 'empresa',
    clientCode: 'C-00100',
    createdAt: new Date().toISOString(),
  },
];

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
        if (remoteClients !== null && Array.isArray(remoteClients)) {
          this.saveClientsLocal(remoteClients);
          return remoteClients;
        }
      } catch (err) {
        console.warn('Notice loading clients from Supabase:', err);
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
          console.warn('Notice syncing client to Supabase:', e);
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

  static isClientRegistered(clientName: string, clientCode?: string): boolean {
    if (!clientName) return false;
    let cleanName = clientName.trim().replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
    let cleanCode = (clientCode || '').trim().replace(/^\[|\]$/g, '');

    const clients = this.getClients();
    return clients.some(
      (c) =>
        (cleanCode && c.code.toLowerCase() === cleanCode.toLowerCase()) ||
        (cleanName && c.name.toLowerCase() === cleanName.toLowerCase())
    );
  }

  static async upsertClientFromScan(clientCode: string, clientName: string): Promise<Client> {
    const clients = this.getClients();

    let cleanName = (clientName || '').trim().replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
    let cleanCode = (clientCode || '').trim().replace(/^\[|\]$/g, '');

    let existing = clients.find(
      (c) =>
        (cleanCode && c.code.toLowerCase() === cleanCode.toLowerCase()) ||
        (cleanName && c.name.toLowerCase() === cleanName.toLowerCase())
    );

    if (existing) {
      return existing;
    }

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      code: cleanCode || `C-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanName || 'Cliente No Identificado',
      cif: 'B-' + Math.floor(10000000 + Math.random() * 90000000),
      email: `contacto@${(cleanName || 'cliente').toLowerCase().replace(/[^a-z0-9]/g, '')}.es`,
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
        if (remoteAlbaranes !== null && Array.isArray(remoteAlbaranes)) {
          // Strictly mirror Supabase database: if Supabase has 0 albaranes, local becomes 0 albaranes
          this.saveAlbaranesLocal(remoteAlbaranes);
          return remoteAlbaranes;
        }
      } catch (err) {
        console.warn('Notice loading albaranes from Supabase:', err);
      }
    }
    return this.getAlbaranes();
  }

  static saveAlbaranesLocal(albaranes: Albaran[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(albaranes));
    } catch (quotaErr) {
      console.warn('LocalStorage QuotaExceededError while saving albaranes. Pruning base64 photos from older entries:', quotaErr);
      // Prune base64 photos for older entries (keep full photos for the newest 3) to fit in localStorage limit
      const pruned = albaranes.map((alb, index) => {
        if (index > 2) {
          return {
            ...alb,
            albaranPhotoUrl: alb.albaranPhotoUrl ? (alb.albaranPhotoUrl.length > 500 ? '[Foto Guardada]' : alb.albaranPhotoUrl) : undefined,
            truckPhotoUrl: alb.truckPhotoUrl ? (alb.truckPhotoUrl.length > 500 ? '[Foto Guardada]' : alb.truckPhotoUrl) : undefined,
            unloadPhotoUrl: alb.unloadPhotoUrl ? (alb.unloadPhotoUrl.length > 500 ? '[Foto Guardada]' : alb.unloadPhotoUrl) : undefined,
          };
        }
        return alb;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(pruned));
      } catch (e2) {
        console.error('Critical failure saving albaranes to localStorage:', e2);
      }
    }
  }

  static isAlbaranNumDuplicate(numAlbaran: string): boolean {
    if (!numAlbaran || !numAlbaran.trim()) return false;
    const clean = numAlbaran.trim().toLowerCase();
    const albaranes = this.getAlbaranes();
    return albaranes.some((a) => a.numAlbaran.trim().toLowerCase() === clean);
  }

  static async createAlbaran(
    newAlbaran: Omit<Albaran, 'id' | 'certified' | 'createdAt'>
  ): Promise<Albaran> {
    if (this.isAlbaranNumDuplicate(newAlbaran.numAlbaran)) {
      throw new Error('Pongase en contacto con la oficina, albaran SAP ya registrado.');
    }

    // Ensure photos are safely compressed (under 300KB) if raw camera strings were passed
    let albaranPhotoUrl = newAlbaran.albaranPhotoUrl;
    let truckPhotoUrl = newAlbaran.truckPhotoUrl;
    let unloadPhotoUrl = newAlbaran.unloadPhotoUrl;

    if (albaranPhotoUrl && albaranPhotoUrl.length > 500_000) {
      try {
        albaranPhotoUrl = await compressImage(albaranPhotoUrl, { maxDimension: 1200, quality: 0.78 });
      } catch (e) {
        console.warn('Fallback albaran photo compression:', e);
      }
    }

    if (truckPhotoUrl && truckPhotoUrl.length > 500_000) {
      try {
        truckPhotoUrl = await compressImage(truckPhotoUrl, { maxDimension: 1200, quality: 0.78 });
      } catch (e) {
        console.warn('Fallback truck photo compression:', e);
      }
    }

    if (unloadPhotoUrl && unloadPhotoUrl.length > 500_000) {
      try {
        unloadPhotoUrl = await compressImage(unloadPhotoUrl, { maxDimension: 1200, quality: 0.78 });
      } catch (e) {
        console.warn('Fallback unload photo compression:', e);
      }
    }

    const albaranes = this.getAlbaranes();

    // Ensure client exists
    const client = await this.upsertClientFromScan(newAlbaran.clientCode, newAlbaran.clientName);

    const created: Albaran = {
      ...newAlbaran,
      albaranPhotoUrl,
      truckPhotoUrl,
      unloadPhotoUrl,
      id: `alb-${Date.now()}`,
      clientId: client.id,
      certified: false,
      createdAt: new Date().toISOString(),
      notificationsSent: {
        mobileSent: false,
        emailSent: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Save immediately to local storage so operator gets instant confirmation
    albaranes.unshift(created);
    this.saveAlbaranesLocal(albaranes);

    // Run Supabase sync and WhatsApp/Email notifications in a resilient non-blocking manner
    (async () => {
      let mobileSent = false;
      let emailSent = false;

      // 1. WhatsApp notification via Ultramsg if client has mobile notification enabled
      if (client.notifyMobile && client.mobile && UltramsgService.isConfigured()) {
        try {
          const messageText = `🏭 *Planta de Residuos RCD*\n\nEstimado cliente *${client.name}*,\n\nSe ha registrado en planta un nuevo albarán de entrega:\n📜 *Nº Albarán:* ${created.numAlbaran}\n📦 *Residuo:* ${created.wasteTypeName} (${created.wasteTypeCode})\n⚖️ *Peso Neto:* ${created.quantityTons} toneladas\n🚚 *Matrícula:* ${created.licensePlate}\n📍 *Zona:* ${created.plantZone}\n📅 *Fecha/Hora:* ${created.date} ${created.time}\n\nGracias por su compromiso con la gestión sostenible de RCD.`;

          const sendResult = await Promise.race([
            UltramsgService.sendWhatsApp(client.mobile, messageText),
            new Promise<{ success: boolean; error: string }>((resolve) =>
              setTimeout(() => resolve({ success: false, error: 'Timeout de red Ultramsg' }), 6000)
            ),
          ]);
          if (sendResult.success) {
            mobileSent = true;
          }
        } catch (e) {
          console.warn('Notice sending WhatsApp:', e);
        }
      }

      // 2. Email notification via EmailService if client has notifyEmail enabled and an email address
      if (client.notifyEmail && client.email) {
        try {
          const emailResult = await Promise.race([
            EmailService.sendAlbaranEmail(client.email, client.name, created),
            new Promise<{ success: boolean; error: string }>((resolve) =>
              setTimeout(() => resolve({ success: false, error: 'Timeout de red Email' }), 6000)
            ),
          ]);
          if (emailResult.success) {
            emailSent = true;
          }
        } catch (e) {
          console.warn('Notice sending Email:', e);
        }
      }

      created.notificationsSent = {
        mobileSent,
        emailSent,
        timestamp: new Date().toISOString(),
      };

      // 3. Sync to Supabase
      if (SupabaseService.isConfigured()) {
        try {
          await Promise.race([
            SupabaseService.insertAlbaran(created),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout de sincronización con Supabase (6s)')), 6000)
            ),
          ]);
        } catch (err) {
          console.warn('Notice saving albaran to Supabase:', err);
        }
      }
    })();

    return created;
  }

  static async deleteAlbaran(id: string): Promise<void> {
    const albaranes = this.getAlbaranes().filter((a) => a.id !== id);
    this.saveAlbaranesLocal(albaranes);

    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.deleteAlbaran(id);
      } catch (err) {
        console.warn('Notice deleting albaran from Supabase:', err);
      }
    }
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
        if (remoteCerts !== null && Array.isArray(remoteCerts)) {
          this.saveCertificatesLocal(remoteCerts);
          return remoteCerts;
        }
      } catch (err) {
        console.warn('Notice loading certificates from Supabase:', err);
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
      status: 'Pendiente de Firma',
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
        console.warn('Notice syncing certificate with Supabase:', err);
      }
    }

    // Send WhatsApp & Email notifications according to client preferences
    const client = this.getClientById(payload.clientId);
    if (client) {
      if (client.notifyMobile && client.mobile && UltramsgService.isConfigured()) {
        const msg = `📜 *Planta de Residuos RCD*\n\nEstimado cliente *${client.name}*,\n\nSe ha emitido un nuevo *Certificado de Valorización de RCD*:\n\n📑 *Nº Certificado:* ${newCertificate.certificateNumber}\n🏗️ *Obra / Promotor:* ${newCertificate.constructionSiteName}\n⚖️ *Total Certificado:* ${newCertificate.totalTons} toneladas\n🔐 *Código Verificación:* ${newCertificate.verificationCode}\n\nPuede consultar e descargar su certificado desde el Portal del Cliente.`;

        await UltramsgService.sendWhatsApp(client.mobile, msg);
      }

      if (client.notifyEmail && client.email) {
        const certSubject = `[Planta RCD] Solicitud de Certificado Registrada Nº ${newCertificate.certificateNumber}`;
        const certText = `Estimado cliente ${client.name},\n\nSe ha registrado su solicitud de Certificado de Valorización de RCD:\n\n• Nº Certificado: ${newCertificate.certificateNumber}\n• Obra / Promotor: ${newCertificate.constructionSiteName}\n• Total Certificado: ${newCertificate.totalTons} Toneladas\n• Código Verificación: ${newCertificate.verificationCode}\n\nEl certificado estará disponible firmado digitalmente en breve. Se ha notificado al responsable de la empresa.`;
        
        await EmailService.sendEmail({
          to: client.email,
          subject: certSubject,
          textBody: certText,
          htmlBody: `<div style="font-family:sans-serif; background:#0f172a; color:#f8fafc; padding:20px; border-radius:12px;"><h2>📜 Planta de Residuos RCD</h2><p>Estimado cliente <strong>${client.name}</strong>,</p><p>Se ha registrado la solicitud del Certificado de Valorización de RCD:</p><ul><li><strong>Nº Certificado:</strong> ${newCertificate.certificateNumber}</li><li><strong>Obra / Promotor:</strong> ${newCertificate.constructionSiteName}</li><li><strong>Total Certificado:</strong> ${newCertificate.totalTons} Toneladas</li><li><strong>Estado:</strong> ⏳ Pendiente de Firma Digital</li></ul><p style="color:#f59e0b;">El certificado estará disponible con firma digital en breve. Se ha avisado al responsable de planta.</p></div>`,
        });
      }
    }

    // Notify manager for pending signature
    await EmailService.sendPendingSignatureEmail({
      certificateNumber: newCertificate.certificateNumber,
      clientName: newCertificate.clientName,
      thirdPartyName: newCertificate.thirdPartyName,
      constructionSiteName: newCertificate.constructionSiteName,
      totalTons: newCertificate.totalTons,
      issueDate: newCertificate.issueDate,
    });

    return newCertificate;
  }

  static async signCertificate(
    certId: string,
    signatureData: string,
    signerName: string,
    signerNif: string,
    fnmtDetails?: {
      fnmtCertIssuer?: string;
      fnmtCertSerial?: string;
      fnmtHash?: string;
      signatureType?: 'fnmt' | 'manual' | 'both' | 'acrobat_pades';
      signedPdfData?: string;
      signedPdfFileName?: string;
    }
  ): Promise<Certificate> {
    const certs = this.getCertificates();
    const certIndex = certs.findIndex((c) => c.id === certId);
    if (certIndex === -1) {
      throw new Error('Certificado no encontrado');
    }

    const now = new Date();
    const signedDateStr = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} (UTC+1)`;

    const updatedCert: Certificate = {
      ...certs[certIndex],
      status: 'Emitido',
      signatureData,
      signerName: signerName.trim() || 'Director Técnico Planta RCD',
      signerNif: signerNif.trim() || 'B-91029384',
      signedAt: signedDateStr,
      fnmtCertIssuer: fnmtDetails?.fnmtCertIssuer || 'FNMT-RCM / AC Representación',
      fnmtCertSerial: fnmtDetails?.fnmtCertSerial || '4B:A1:88:C2:9F:D5:E0:18',
      fnmtHash: fnmtDetails?.fnmtHash,
      signatureType: fnmtDetails?.signatureType || (fnmtDetails?.signedPdfData ? 'acrobat_pades' : 'fnmt'),
      signedPdfData: fnmtDetails?.signedPdfData,
      signedPdfFileName: fnmtDetails?.signedPdfFileName,
    };

    certs[certIndex] = updatedCert;
    this.saveCertificatesLocal(certs);

    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.insertCertificate(updatedCert);
      } catch (err) {
        console.warn('Notice updating signed certificate in Supabase:', err);
      }
    }

    // Send notification email to client that the certificate is signed and available
    const client = this.getClientById(updatedCert.clientId);
    const clientEmail = client?.email || `${updatedCert.clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}@empresa.es`;
    
    await EmailService.sendSignedCertificateEmail(clientEmail, {
      certificateNumber: updatedCert.certificateNumber,
      clientName: updatedCert.clientName,
      thirdPartyName: updatedCert.thirdPartyName,
      totalTons: updatedCert.totalTons,
      signedAt: updatedCert.signedAt,
      signerName: updatedCert.signerName,
    });

    return updatedCert;
  }

  static async uploadSignedPdfCertificate(
    certId: string,
    signedPdfData: string,
    signedPdfFileName: string,
    signerName?: string,
    signerNif?: string
  ): Promise<Certificate> {
    return this.signCertificate(
      certId,
      '',
      signerName || 'Dirección Técnica / Apoderado (Firma Digital FNMT Acrobat)',
      signerNif || 'B-91029384',
      {
        fnmtCertIssuer: 'Fábrica Nacional de Moneda y Timbre (FNMT-RCM) - Documento PAdES',
        fnmtCertSerial: 'Firma Acrobat / AutoFirma',
        signatureType: 'acrobat_pades',
        signedPdfData,
        signedPdfFileName,
      }
    );
  }

  // ===============================================
  // WASTE TYPES MANAGEMENT
  // ===============================================
  static async loadWasteTypesFromRemote(): Promise<WasteType[]> {
    if (SupabaseService.isConfigured()) {
      try {
        const remote = await SupabaseService.fetchWasteTypes();
        if (remote !== null && Array.isArray(remote)) {
          this.saveWasteTypesLocal(remote);
          return remote;
        }
      } catch (err) {
        console.warn('Notice loading waste types from Supabase:', err);
      }
    }
    return this.getWasteTypes();
  }

  static getWasteTypes(): WasteType[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.WASTE_TYPES);
      if (!data) {
        return [];
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed;
    } catch {
      return [];
    }
  }

  static saveWasteTypesLocal(types: WasteType[]): void {
    localStorage.setItem(STORAGE_KEYS.WASTE_TYPES, JSON.stringify(types));
  }

  static saveWasteTypes(types: WasteType[]): void {
    this.saveWasteTypesLocal(types);
    SupabaseService.upsertWasteTypes(types);
  }

  static addOrUpdateWasteType(wasteType: WasteType): void {
    const current = this.getWasteTypes();
    const idx = current.findIndex((w) => w.code.trim() === wasteType.code.trim());
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...wasteType };
    } else {
      current.push(wasteType);
    }
    this.saveWasteTypes(current);
  }

  static deleteWasteType(code: string): void {
    const filtered = this.getWasteTypes().filter((w) => w.code.trim() !== code.trim());
    this.saveWasteTypesLocal(filtered);
    SupabaseService.deleteWasteType(code);
  }

  static clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.CLIENTS);
    localStorage.removeItem(STORAGE_KEYS.ALBARANES);
    localStorage.removeItem(STORAGE_KEYS.CERTIFICATES);
    localStorage.removeItem(STORAGE_KEYS.WASTE_TYPES);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }

  // ===============================================
  // USER ACCOUNTS & SECURITY MANAGEMENT
  // ===============================================

  static getUsers(): RCDUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!data) {
        this.saveUsersLocal(INITIAL_USERS);
        return INITIAL_USERS;
      }
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        this.saveUsersLocal(INITIAL_USERS);
        return INITIAL_USERS;
      }
      return parsed;
    } catch {
      return INITIAL_USERS;
    }
  }

  static saveUsersLocal(users: RCDUser[]): void {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  static async loadUsersFromRemote(): Promise<RCDUser[]> {
    if (SupabaseService.isConfigured()) {
      try {
        const remoteUsers = await SupabaseService.fetchUsers();
        if (remoteUsers && remoteUsers.length > 0) {
          this.saveUsersLocal(remoteUsers);
          return remoteUsers;
        } else if (remoteUsers && remoteUsers.length === 0) {
          // Push initial seed users to Supabase if empty
          for (const u of INITIAL_USERS) {
            await SupabaseService.upsertUser(u);
          }
          this.saveUsersLocal(INITIAL_USERS);
          return INITIAL_USERS;
        }
      } catch (err) {
        console.warn('Notice loading users from remote Supabase:', err);
      }
    }
    return this.getUsers();
  }

  static async upsertUser(user: RCDUser): Promise<void> {
    const current = this.getUsers();
    const idx = current.findIndex((u) => u.id === user.id || u.nifCif.toUpperCase() === user.nifCif.toUpperCase());

    if (idx >= 0) {
      current[idx] = { ...current[idx], ...user };
    } else {
      current.push(user);
    }

    this.saveUsersLocal(current);

    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.upsertUser(user);
      } catch (err) {
        console.warn('Notice syncing user upsert to Supabase:', err);
      }
    }
  }

  static async deleteUser(id: string): Promise<void> {
    const current = this.getUsers().filter((u) => u.id !== id);
    this.saveUsersLocal(current);

    if (SupabaseService.isConfigured()) {
      try {
        await SupabaseService.deleteUser(id);
      } catch (err) {
        console.warn('Notice syncing user deletion to Supabase:', err);
      }
    }
  }

  static getCurrentUser(): RCDUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: RCDUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  static logout(): void {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
}

