import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Albaran, Certificate, Client } from '../types/rcd';

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
      rcd_status: cert.status || 'Emitido',
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
      status: row.rcd_status || 'Emitido',
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
        console.warn('Notice inserting rcd_albaranes into Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice inserting rcd_albaranes into Supabase:', err);
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
      const { error } = await supabase.from('rcd_certificates').insert(row);

      if (error) {
        console.warn('Notice inserting rcd_certificates into Supabase:', error.message || error);
      }
    } catch (err) {
      console.warn('Notice inserting rcd_certificates into Supabase:', err);
    }
  }
}
