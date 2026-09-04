import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Albaran, Certificate, Client, RCDUser, WasteType } from '../types/rcd';

const SUPABASE_STORAGE_KEYS = {
  URL: 'rcd_supabase_url',
  ANON_KEY: 'rcd_supabase_anon_key',
};

export class SupabaseService {
  private static clientInstance: SupabaseClient | null = null;

  static sanitizeUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    let url = rawUrl.trim();
    url = url.replace(/\/+$/, '');
    url = url.replace(/\/rest\/v1$/i, '');
    return url.replace(/\/+$/, '');
  }

  static getCredentials(): { url: string; anonKey: string } {
    const savedUrl = localStorage.getItem(SUPABASE_STORAGE_KEYS.URL);
    const savedKey = localStorage.getItem(SUPABASE_STORAGE_KEYS.ANON_KEY);

    const url = this.sanitizeUrl(savedUrl || import.meta.env.VITE_SUPABASE_URL || '');
    const anonKey = savedKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

    return { url, anonKey };
  }

  static saveCredentials(url: string, anonKey: string): void {
    const sanitizedUrl = this.sanitizeUrl(url);
    localStorage.setItem(SUPABASE_STORAGE_KEYS.URL, sanitizedUrl);
    localStorage.setItem(SUPABASE_STORAGE_KEYS.ANON_KEY, anonKey.trim());
    this.clientInstance = null; // reset client to re-initialize
  }

  static isConfigured(): boolean {
    const { url, anonKey } = this.getCredentials();
    return Boolean(url && anonKey && url.startsWith('http'));
  }

  static getClient(): SupabaseClient | null {
    if (!this.isConfigured()) return null;
    if (!this.clientInstance) {
      const { url, anonKey } = this.getCredentials();
      this.clientInstance = createClient(url, anonKey);
    }
    return this.clientInstance;
  }

  // ==========================================
  // MAPPER FUNCTIONS (TS <-> Supabase RCD columns)
  // ==========================================

  private static mapUserToDB(user: RCDUser) {
    return {
      rcd_id: user.id,
      rcd_name: user.name,
      rcd_username_nif_cif: user.nifCif,
      rcd_code: user.code,
      rcd_user_type: user.userType,
      rcd_client_code: user.clientCode || null,
      rcd_created_at: user.createdAt || new Date().toISOString(),
    };
  }

  private static mapDBToUser(row: any): RCDUser {
    return {
      id: row.rcd_id,
      name: row.rcd_name,
      nifCif: row.rcd_username_nif_cif || row.rcd_nif_cif || '',
      code: row.rcd_code,
      userType: row.rcd_user_type || 'trabajador',
      clientCode: row.rcd_client_code || undefined,
      createdAt: row.rcd_created_at || new Date().toISOString(),
    };
  }

  private static mapClientToDB(client: Client) {
    return {
      rcd_id: client.id,
      rcd_code: client.code,
      rcd_name: client.name,
      rcd_cif: client.cif,
      rcd_email: client.email || null,
      rcd_mobile: client.mobile || null,
      rcd_notify_email: client.notifyEmail ?? true,
      rcd_notify_mobile: client.notifyMobile ?? true,
      rcd_address: client.address || null,
      rcd_contact_person: client.contactPerson || null,
      rcd_created_at: client.createdAt || new Date().toISOString(),
    };
  }

  private static mapDBToClient(row: any): Client {
    return {
      id: row.rcd_id,
      code: row.rcd_code,
      name: row.rcd_name,
      cif: row.rcd_cif,
      email: row.rcd_email || '',
      mobile: row.rcd_mobile || '',
      notifyEmail: row.rcd_notify_email ?? true,
      notifyMobile: row.rcd_notify_mobile ?? true,
      address: row.rcd_address || '',
      contactPerson: row.rcd_contact_person || '',
      createdAt: row.rcd_created_at || new Date().toISOString(),
    };
  }

  private static mapAlbaranToDB(alb: Albaran) {
    return {
      rcd_id: alb.id,
      rcd_num_albaran: alb.numAlbaran,
      rcd_client_id: alb.clientId || null,
      rcd_client_name: alb.clientName,
      rcd_client_code: alb.clientCode,
      rcd_date: alb.date,
      rcd_time: alb.time,
      rcd_waste_type_code: alb.wasteTypeCode,
      rcd_waste_type_name: alb.wasteTypeName,
      rcd_quantity_tons: alb.quantityTons,
      rcd_license_plate: alb.licensePlate,
      rcd_driver_name: alb.driverName || null,
      rcd_albaran_photo_url: alb.albaranPhotoUrl || null,
      rcd_truck_photo_url: alb.truckPhotoUrl || null,
      rcd_unload_photo_url: alb.unloadPhotoUrl || null,
      rcd_plant_zone: alb.plantZone || null,
      rcd_gps_coords: alb.gpsCoords || null,
      rcd_certified: alb.certified ?? false,
      rcd_certificate_id: alb.certificateId || null,
      rcd_certificate_number: alb.certificateNumber || null,
      rcd_notifications_sent: alb.notificationsSent || { mobileSent: false, emailSent: false },
      rcd_created_at: alb.createdAt || new Date().toISOString(),
      rcd_sap_checked: alb.sapChecked ?? false,
      rcd_sap_checked_at: alb.sapCheckedAt || null,
      rcd_sap_checked_by: alb.sapCheckedBy || null,
      rcd_sap_notes: alb.sapNotes || null,
    };
  }

  private static mapDBToAlbaran(row: any): Albaran {
    return {
      id: row.rcd_id,
      numAlbaran: row.rcd_num_albaran,
      clientId: row.rcd_client_id || '',
      clientName: row.rcd_client_name,
      clientCode: row.rcd_client_code,
      date: row.rcd_date,
      time: row.rcd_time,
      wasteTypeCode: row.rcd_waste_type_code,
      wasteTypeName: row.rcd_waste_type_name,
      quantityTons: Number(row.rcd_quantity_tons || 0),
      licensePlate: row.rcd_license_plate,
      driverName: row.rcd_driver_name || '',
      albaranPhotoUrl: row.rcd_albaran_photo_url || '',
      truckPhotoUrl: row.rcd_truck_photo_url || '',
      unloadPhotoUrl: row.rcd_unload_photo_url || '',
      plantZone: row.rcd_plant_zone || '',
      gpsCoords: row.rcd_gps_coords || '',
      certified: row.rcd_certified ?? false,
      certificateId: row.rcd_certificate_id || undefined,
      certificateNumber: row.rcd_certificate_number || undefined,
      notificationsSent: row.rcd_notifications_sent || undefined,
      createdAt: row.rcd_created_at || new Date().toISOString(),
      sapChecked: Boolean(row.rcd_sap_checked),
      sapCheckedAt: row.rcd_sap_checked_at || undefined,
      sapCheckedBy: row.rcd_sap_checked_by || undefined,
      sapNotes: row.rcd_sap_notes || undefined,
    };
  }

  private static mapCertificateToDB(cert: Certificate) {
    return {
      rcd_id: cert.id,
      rcd_certificate_number: cert.certificateNumber,
      rcd_issue_date: cert.issueDate,
      rcd_client_id: cert.clientId || null,
      rcd_client_name: cert.clientName,
      rcd_client_cif: cert.clientCif,
      rcd_third_party_name: cert.thirdPartyName || null,
      rcd_third_party_cif: cert.thirdPartyCif || null,
      rcd_construction_site_name: cert.constructionSiteName || null,
      rcd_construction_site_address: cert.constructionSiteAddress || null,
      rcd_albaran_ids: cert.albaranIds || [],
      rcd_waste_breakdown: cert.wasteBreakdown || [],
      rcd_total_tons: cert.totalTons,
      rcd_issuer_name: cert.issuerName || null,
      rcd_verification_code: cert.verificationCode,
      rcd_status: cert.status || 'Pendiente de Firma',
      rcd_signature_data: cert.signatureData || null,
      rcd_signed_at: cert.signedAt || null,
      rcd_signer_name: cert.signerName || null,
      rcd_signer_nif: cert.signerNif || null,
      rcd_fnmt_cert_issuer: cert.fnmtCertIssuer || null,
      rcd_fnmt_cert_serial: cert.fnmtCertSerial || null,
      rcd_fnmt_hash: cert.fnmtHash || null,
      rcd_signature_type: cert.signatureType || 'fnmt',
      rcd_signed_pdf_data: cert.signedPdfData || null,
      rcd_signed_pdf_filename: cert.signedPdfFileName || null,
      rcd_created_at: cert.issueDate ? `${cert.issueDate}T00:00:00.000Z` : new Date().toISOString(),
    };
  }

  private static mapDBToCertificate(row: any): Certificate {
    return {
      id: row.rcd_id,
      certificateNumber: row.rcd_certificate_number,
      issueDate: row.rcd_issue_date,
      clientId: row.rcd_client_id || '',
      clientName: row.rcd_client_name,
      clientCif: row.rcd_client_cif,
      thirdPartyName: row.rcd_third_party_name || '',
      thirdPartyCif: row.rcd_third_party_cif || '',
      constructionSiteName: row.rcd_construction_site_name || '',
      constructionSiteAddress: row.rcd_construction_site_address || '',
      albaranIds: row.rcd_albaran_ids || [],
      wasteBreakdown: row.rcd_waste_breakdown || [],
      totalTons: Number(row.rcd_total_tons || 0),
      issuerName: row.rcd_issuer_name || '',
      verificationCode: row.rcd_verification_code || '',
      status: row.rcd_status || 'Pendiente de Firma',
      signatureData: row.rcd_signature_data || undefined,
      signedAt: row.rcd_signed_at || undefined,
      signerName: row.rcd_signer_name || undefined,
      signerNif: row.rcd_signer_nif || undefined,
      fnmtCertIssuer: row.rcd_fnmt_cert_issuer || undefined,
      fnmtCertSerial: row.rcd_fnmt_cert_serial || undefined,
      fnmtHash: row.rcd_fnmt_hash || undefined,
      signatureType: row.rcd_signature_type || undefined,
      signedPdfData: row.rcd_signed_pdf_data || undefined,
      signedPdfFileName: row.rcd_signed_pdf_filename || undefined,
    };
  }

  // ==========================================
  // SUPABASE API METHODS
  // ==========================================

  static async fetchClients(): Promise<Client[] | null> {
    const supabase = this.getClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('rcd_clients')
        .select('*')
        .order('rcd_created_at', { ascending: false });

      if (error) {
        console.warn('Notice fetching rcd_clients from Supabase:', error.message || error);
        return null;
      }

      return (data || []).map(this.mapDBToClient);
    } catch (err) {
      console.warn('Notice connecting to rcd_clients on Supabase:', err);
      return null;
    }
  }

  static async upsertClient(client: Client): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const row = this.mapClientToDB(client);
      const { error } = await supabase.from('rcd_clients').upsert(row, { onConflict: 'rcd_id' });

      if (error) {
        console.warn('Notice upserting rcd_clients into Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice upserting rcd_clients into Supabase:', err);
    }
  }

  static async fetchAlbaranes(): Promise<Albaran[] | null> {
    const supabase = this.getClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('rcd_albaranes')
        .select('*')
        .order('rcd_created_at', { ascending: false });

      if (error) {
        console.warn('Notice fetching rcd_albaranes from Supabase:', error.message || error);
        return null;
      }

      return (data || []).map(this.mapDBToAlbaran);
    } catch (err) {
      console.warn('Notice connecting to rcd_albaranes on Supabase:', err);
      return null;
    }
  }

  static async insertAlbaran(alb: Albaran): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const row = this.mapAlbaranToDB(alb);
      const { error } = await supabase.from('rcd_albaranes').insert(row);

      if (error) {
        // Fallback if rcd_sap_* columns do not exist in remote Supabase schema
        const errStr = (error.message || '').toLowerCase();
        if (errStr.includes('rcd_sap_') || errStr.includes('column') || errStr.includes('schema')) {
          const fallbackRow = { ...row };
          delete (fallbackRow as any).rcd_sap_checked;
          delete (fallbackRow as any).rcd_sap_checked_at;
          delete (fallbackRow as any).rcd_sap_checked_by;
          delete (fallbackRow as any).rcd_sap_notes;
          await supabase.from('rcd_albaranes').insert(fallbackRow);
        } else {
          console.warn('Notice inserting rcd_albaranes into Supabase:', error.message || error);
        }
      }
    } catch (err) {
      console.warn('Notice inserting rcd_albaranes into Supabase:', err);
    }
  }

  static async upsertAlbaran(alb: Albaran): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const row = this.mapAlbaranToDB(alb);
      const { error } = await supabase.from('rcd_albaranes').upsert(row, { onConflict: 'rcd_id' });

      if (error) {
        // Fallback if rcd_sap_* columns do not exist in remote Supabase schema
        const errStr = (error.message || '').toLowerCase();
        if (errStr.includes('rcd_sap_') || errStr.includes('column') || errStr.includes('schema')) {
          const fallbackRow = { ...row };
          delete (fallbackRow as any).rcd_sap_checked;
          delete (fallbackRow as any).rcd_sap_checked_at;
          delete (fallbackRow as any).rcd_sap_checked_by;
          delete (fallbackRow as any).rcd_sap_notes;
          await supabase.from('rcd_albaranes').upsert(fallbackRow, { onConflict: 'rcd_id' });
        } else {
          console.warn('Notice upserting rcd_albaranes into Supabase:', error.message || error);
        }
      }
    } catch (err) {
      console.warn('Notice upserting rcd_albaranes into Supabase:', err);
    }
  }

  static async deleteAlbaran(id: string): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const { error } = await supabase.from('rcd_albaranes').delete().eq('rcd_id', id);

      if (error) {
        console.warn('Notice deleting rcd_albaranes from Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice deleting rcd_albaranes from Supabase:', err);
    }
  }

  static async updateAlbaranesLockStatus(
    albaranIds: string[],
    certificateId: string,
    certificateNumber: string
  ): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('rcd_albaranes')
        .update({
          rcd_certified: true,
          rcd_certificate_id: certificateId,
          rcd_certificate_number: certificateNumber,
        })
        .in('rcd_id', albaranIds);

      if (error) {
        console.warn('Notice locking rcd_albaranes in Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice locking rcd_albaranes in Supabase:', err);
    }
  }

  static async fetchCertificates(): Promise<Certificate[] | null> {
    const supabase = this.getClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('rcd_certificates')
        .select('*')
        .order('rcd_created_at', { ascending: false });

      if (error) {
        console.warn('Notice fetching rcd_certificates from Supabase:', error.message || error);
        return null;
      }

      return (data || []).map(this.mapDBToCertificate);
    } catch (err) {
      console.warn('Notice connecting to rcd_certificates on Supabase:', err);
      return null;
    }
  }

  static async insertCertificate(cert: Certificate): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const row = this.mapCertificateToDB(cert);
      const { error } = await supabase.from('rcd_certificates').upsert(row, { onConflict: 'rcd_id' });

      if (error) {
        console.warn('Notice upserting rcd_certificates into Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice upserting rcd_certificates into Supabase:', err);
    }
  }

  // ==========================================
  // RCD USERS METHODS
  // ==========================================

  static async fetchUsers(): Promise<RCDUser[] | null> {
    const supabase = this.getClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('rcd_users')
        .select('*')
        .order('rcd_created_at', { ascending: false });

      if (error) {
        console.warn('Notice fetching rcd_users from Supabase:', error.message || error);
        return null;
      }

      return (data || []).map(this.mapDBToUser);
    } catch (err) {
      console.warn('Notice connecting to rcd_users on Supabase:', err);
      return null;
    }
  }

  static async upsertUser(user: RCDUser): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const row = this.mapUserToDB(user);
      const { error } = await supabase.from('rcd_users').upsert(row, { onConflict: 'rcd_id' });

      if (error) {
        console.warn('Notice upserting rcd_users into Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice upserting rcd_users into Supabase:', err);
    }
  }

  static async deleteUser(id: string): Promise<void> {
    const supabase = this.getClient();
    if (!supabase) return;

    try {
      const { error } = await supabase.from('rcd_users').delete().eq('rcd_id', id);

      if (error) {
        console.warn('Notice deleting rcd_users from Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice deleting rcd_users from Supabase:', err);
    }
  }

  // ==========================================
  // WASTE TYPES
  // ==========================================

  private static generateUUID(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private static mapWasteTypeToDB(wt: WasteType, excludeColumns: string[] = ['rcd_description']): Record<string, any> {
    const row: Record<string, any> = {
      id: wt.id || this.generateUUID(),
      rcd_code: wt.code,
      rcd_name: wt.name,
      rcd_category: wt.category || 'Limpio',
      rcd_price_per_ton: wt.pricePerTon ?? 0,
      rcd_max_capacity_tons: wt.maxCapacityTons ?? 5000,
    };

    if (!excludeColumns.includes('rcd_description') && wt.description) {
      row.rcd_description = wt.description;
    }

    for (const col of excludeColumns) {
      delete row[col];
    }

    return row;
  }

  private static mapDBToWasteType(row: any): WasteType {
    return {
      id: row.id || row.rcd_id || undefined,
      code: row.rcd_code || row.code || '',
      name: row.rcd_name || row.name || '',
      category: row.rcd_category || row.category || 'Limpio',
      pricePerTon: Number(row.rcd_price_per_ton ?? row.price_per_ton ?? 0),
      description: row.rcd_description || row.description || undefined,
      maxCapacityTons: Number(row.rcd_max_capacity_tons ?? row.max_capacity_tons ?? 5000),
    };
  }

  static async fetchWasteTypes(): Promise<WasteType[] | null> {
    const supabase = this.getClient();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.from('rcd_waste_types').select('*');

      if (error) {
        console.warn('Notice fetching rcd_waste_types from Supabase:', error.message || error);
        return null;
      }

      return (data || []).map(this.mapDBToWasteType);
    } catch (err) {
      console.warn('Notice connecting to rcd_waste_types on Supabase:', err);
      return null;
    }
  }

  static async upsertWasteTypes(types: WasteType[]): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getClient();
    if (!supabase) return { success: false, error: 'Supabase no está configurado' };

    if (!types || types.length === 0) return { success: true };

    const excluded = new Set<string>(['rcd_description']);

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const rows = types.map((t) => this.mapWasteTypeToDB(t, Array.from(excluded)));
        const { error } = await supabase.from('rcd_waste_types').upsert(rows, { onConflict: 'rcd_code' });

        if (!error) {
          return { success: true };
        }

        const msg = error.message || String(error);
        console.warn(`Intento ${attempt + 1} upserting rcd_waste_types:`, msg);

        // Detect missing column error (e.g. "Could not find the '...' column")
        const missingColMatch = msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "?([^"\s]+)"? of relation/i);
        if (missingColMatch && missingColMatch[1]) {
          const colName = missingColMatch[1];
          excluded.add(colName);
          continue;
        }

        // Try without onConflict if that was the issue or fallback to standard columns
        if (msg.toLowerCase().includes('onconflict') || msg.toLowerCase().includes('conflict')) {
          const { error: errorNoConflict } = await supabase.from('rcd_waste_types').upsert(rows);
          if (!errorNoConflict) {
            return { success: true };
          }
        }

        return { success: false, error: msg };
      } catch (err: any) {
        console.warn('Notice upserting rcd_waste_types into Supabase:', err);
        return { success: false, error: err?.message || String(err) };
      }
    }

    return { success: false, error: 'No se pudo sincronizar el tipo de residuo con Supabase.' };
  }

  static async deleteWasteType(code: string): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getClient();
    if (!supabase) return { success: false, error: 'Supabase no está configurado' };

    try {
      const { error } = await supabase.from('rcd_waste_types').delete().eq('rcd_code', code);

      if (error) {
        console.warn('Notice deleting rcd_waste_types from Supabase:', error.message || error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Notice deleting rcd_waste_types from Supabase:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }
}

