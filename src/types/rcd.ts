export interface WasteType {
  code: string; // e.g., '17 01 01'
  name: string; // e.g., 'Escombro Limpio (Hormigón y Piedra)'
  category: 'Limpio' | 'Sucio' | 'Tierras' | 'Peligroso' | 'Valorizable';
  pricePerTon: number;
  description: string;
  maxCapacityTons?: number; // Plant max storage capacity in tons for this waste type
}

export interface Client {
  id: string;
  code: string; // SAP Client Code, e.g. "C-0104"
  name: string;
  cif: string;
  email: string;
  mobile: string;
  notifyEmail: boolean; // Tick: Enviar descarga por mail
  notifyMobile: boolean; // Tick: Enviar descarga por movil (SMS/WhatsApp)
  address?: string;
  contactPerson?: string;
  totalTonnage?: number;
  totalAlbaranes?: number;
  createdAt: string;
}

export interface Albaran {
  id: string;
  numAlbaran: string; // SAP Delivery Note #, e.g. "ALB-2026-08492"
  clientId: string;
  clientName: string;
  clientCode: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  wasteTypeCode: string; // LER code, e.g. "17 01 01"
  wasteTypeName: string;
  quantityTons: number;
  licensePlate: string; // e.g. "8492-KZX"
  driverName?: string;
  albaranPhotoUrl?: string; // Photo of SAP ticket
  truckPhotoUrl?: string; // Photo of truck before unloading (stamped)
  unloadPhotoUrl?: string; // Photo of unloading (stamped)
  plantZone: string; // Zone in plant, e.g. "Báscula 1 - Fosa Norte"
  gpsCoords?: string;
  certified: boolean; // TRUE = Locked, included in a certificate
  certificateId?: string; // ID of the certificate where included
  certificateNumber?: string;
  createdAt: string;
  notificationsSent?: {
    mobileSent: boolean;
    emailSent: boolean;
    timestamp: string;
  };
}

export interface Certificate {
  id: string;
  certificateNumber: string; // e.g. "CERT-RCD-2026-0089"
  issueDate: string;
  clientId: string;
  clientName: string;
  clientCif: string;
  // Promotor / Tercero destinatario del certificado
  thirdPartyName: string;
  thirdPartyCif: string;
  constructionSiteName: string; // Nombre / Referencia de la obra
  constructionSiteAddress: string;
  albaranIds: string[]; // List of locked albaran IDs
  wasteBreakdown: {
    wasteTypeCode: string;
    wasteTypeName: string;
    totalTons: number;
    albaranesCount: number;
  }[];
  totalTons: number;
  issuerName: string; // Admin / App user
  verificationCode: string;
  status: 'Pendiente de Firma' | 'Emitido' | 'Anulado';
  signatureData?: string; // Base64 signature image or digital seal
  signedAt?: string; // Date string or ISO timestamp when signed
  signerName?: string; // Name of person who signed
  signerNif?: string; // NIF of person who signed
  fnmtCertIssuer?: string; // e.g. "FNMT-RCM / AC Representación"
  fnmtCertSerial?: string; // Serial number of FNMT digital certificate
  fnmtHash?: string; // SHA-256 digital signature hash
  signatureType?: 'fnmt' | 'manual' | 'both';
}

export interface RCDUser {
  id: string;
  name: string; // Nombre y apellidos (trabajador) o Nombre de la empresa (empresa)
  nifCif: string; // NIF / CIF (Usuario para el inicio de sesión)
  code: string; // Código de acceso / PIN / Clave
  userType: 'trabajador' | 'empresa' | 'admin';
  clientCode?: string; // Código de cliente SAP vinculado si es empresa (ej: C-00100)
  createdAt: string;
}

export interface OCRScanResult {
  numAlbaran: string;
  clientCode: string;
  clientName: string;
  wasteTypeCode: string;
  wasteTypeName: string;
  quantityTons: number;
  date: string;
  time: string;
  licensePlate?: string;
  rawConfidence: number;
  notes?: string;
}
