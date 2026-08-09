import { Albaran, Certificate, Client, WasteType } from '../types/rcd';

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
  CLIENTS: 'rcd_app_clients_v2',
  ALBARANES: 'rcd_app_albaranes_v2',
  CERTIFICATES: 'rcd_app_certificates_v2',
};

// Seed default clients if empty
const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-01',
    code: 'C-00104',
    name: 'Construcciones y Excavaciones García S.L.',
    cif: 'B-91823746',
    email: 'obras@garciaconstrucciones.com',
    mobile: '+34 612 345 678',
    notifyEmail: true,
    notifyMobile: true,
    address: 'Pol. Ind. Carretera de Amarilla, Parc. 14, Sevilla',
    contactPerson: 'Carlos García Ruiz',
    createdAt: '2026-01-15T09:00:00.000Z',
  },
  {
    id: 'cli-02',
    code: 'C-00218',
    name: 'Transportes y Derribos Marraque Hnos.',
    cif: 'B-41982301',
    email: 'logistica@marraquederribos.es',
    mobile: '+34 689 901 234',
    notifyEmail: true,
    notifyMobile: false,
    address: 'Av. de la Innovación 8, Dos Hermanas',
    contactPerson: 'Manuel Marraque',
    createdAt: '2026-02-01T10:30:00.000Z',
  },
  {
    id: 'cli-03',
    code: 'C-00350',
    name: 'Promociones del Sur Inmobiliaria S.A.',
    cif: 'A-28901234',
    email: 'administracion@promosurinmobiliaria.com',
    mobile: '+34 654 321 098',
    notifyEmail: true,
    notifyMobile: true,
    address: 'C/ Sierpes 45, Planta 2, Sevilla',
    contactPerson: 'Elena Benítez',
    createdAt: '2026-03-10T12:00:00.000Z',
  },
  {
    id: 'cli-04',
    code: 'C-00412',
    name: 'Obras y Reformas Triana C.B.',
    cif: 'E-91029384',
    email: 'info@reformastriana.es',
    mobile: '+34 677 889 900',
    notifyEmail: false,
    notifyMobile: true,
    address: 'C/ San Jacinto 112, Sevilla',
    contactPerson: 'Joaquín Morales',
    createdAt: '2026-04-05T08:15:00.000Z',
  },
];

// Seed default sample albaranes with photographic traceability
const INITIAL_ALBARANES: Albaran[] = [
  {
    id: 'alb-1001',
    numAlbaran: 'ALB-2026-08490',
    clientId: 'cli-01',
    clientName: 'Construcciones y Excavaciones García S.L.',
    clientCode: 'C-00104',
    date: '2026-08-05',
    time: '08:45',
    wasteTypeCode: '17 01 01',
    wasteTypeName: 'Hormigón y Piedra (Escombro Limpio)',
    quantityTons: 14.85,
    licensePlate: '8492-KZX',
    driverName: 'Antonio Delgado',
    plantZone: 'Báscula 1 - Muelle Norte',
    gpsCoords: '37.3891° N, 5.9845° W',
    certified: false,
    createdAt: '2026-08-05T08:45:00.000Z',
    notificationsSent: {
      mobileSent: true,
      emailSent: true,
      timestamp: '2026-08-05T08:46:12.000Z',
    },
  },
  {
    id: 'alb-1002',
    numAlbaran: 'ALB-2026-08491',
    clientId: 'cli-01',
    clientName: 'Construcciones y Excavaciones García S.L.',
    clientCode: 'C-00104',
    date: '2026-08-05',
    time: '10:30',
    wasteTypeCode: '17 05 04',
    wasteTypeName: 'Tierras y Piedras de Excavación',
    quantityTons: 22.40,
    licensePlate: '8492-KZX',
    driverName: 'Antonio Delgado',
    plantZone: 'Báscula 2 - Sector Tierras',
    gpsCoords: '37.3892° N, 5.9847° W',
    certified: false,
    createdAt: '2026-08-05T10:30:00.000Z',
    notificationsSent: {
      mobileSent: true,
      emailSent: true,
      timestamp: '2026-08-05T10:31:05.000Z',
    },
  },
  {
    id: 'alb-1003',
    numAlbaran: 'ALB-2026-08492',
    clientId: 'cli-02',
    clientName: 'Transportes y Derribos Marraque Hnos.',
    clientCode: 'C-00218',
    date: '2026-08-05',
    time: '11:15',
    wasteTypeCode: '17 09 04',
    wasteTypeName: 'Residuos Mezclados RCD (Escombro Sucio / Mezcla)',
    quantityTons: 11.20,
    licensePlate: '4102-LPT',
    driverName: 'Marcos Marraque',
    plantZone: 'Fosa de Triaje A-1',
    gpsCoords: '37.3890° N, 5.9842° W',
    certified: false,
    createdAt: '2026-08-05T11:15:00.000Z',
    notificationsSent: {
      mobileSent: false,
      emailSent: true,
      timestamp: '2026-08-05T11:16:00.000Z',
    },
  },
  {
    id: 'alb-1004',
    numAlbaran: 'ALB-2026-08480',
    clientId: 'cli-01',
    clientName: 'Construcciones y Excavaciones García S.L.',
    clientCode: 'C-00104',
    date: '2026-08-01',
    time: '09:20',
    wasteTypeCode: '17 01 01',
    wasteTypeName: 'Hormigón y Piedra (Escombro Limpio)',
    quantityTons: 16.50,
    licensePlate: '9012-GHT',
    driverName: 'Francisco López',
    plantZone: 'Báscula 1',
    certified: true,
    certificateId: 'cert-2026-0012',
    certificateNumber: 'CERT-RCD-2026-0012',
    createdAt: '2026-08-01T09:20:00.000Z',
  },
  {
    id: 'alb-1005',
    numAlbaran: 'ALB-2026-08481',
    clientId: 'cli-01',
    clientName: 'Construcciones y Excavaciones García S.L.',
    clientCode: 'C-00104',
    date: '2026-08-01',
    time: '14:10',
    wasteTypeCode: '17 01 02',
    wasteTypeName: 'Ladrillos, Tejas y Cerámica',
    quantityTons: 9.80,
    licensePlate: '9012-GHT',
    driverName: 'Francisco López',
    plantZone: 'Báscula 1',
    certified: true,
    certificateId: 'cert-2026-0012',
    certificateNumber: 'CERT-RCD-2026-0012',
    createdAt: '2026-08-01T14:10:00.000Z',
  },
];

const INITIAL_CERTIFICATES: Certificate[] = [
  {
    id: 'cert-2026-0012',
    certificateNumber: 'CERT-RCD-2026-0012',
    issueDate: '2026-08-02',
    clientId: 'cli-01',
    clientName: 'Construcciones y Excavaciones García S.L.',
    clientCif: 'B-91823746',
    thirdPartyName: 'Ayuntamiento de Sevilla - Gerencia de Urbanismo',
    thirdPartyCif: 'P-4109100J',
    constructionSiteName: 'Rehabilitación Integral Edificio Av. Constitución 12',
    constructionSiteAddress: 'Av. de la Constitución 12, Sevilla',
    albaranIds: ['alb-1004', 'alb-1005'],
    wasteBreakdown: [
      {
        wasteTypeCode: '17 01 01',
        wasteTypeName: 'Hormigón y Piedra (Escombro Limpio)',
        totalTons: 16.50,
        albaranesCount: 1,
      },
      {
        wasteTypeCode: '17 01 02',
        wasteTypeName: 'Ladrillos, Tejas y Cerámica',
        totalTons: 9.80,
        albaranesCount: 1,
      },
    ],
    totalTons: 26.30,
    issuerName: 'Responsable Medioambiental Planta RCD EcoMarraque',
    verificationCode: 'VERIF-2026-RCD-9812A',
    status: 'Emitido',
  },
];

// Helper functions for localStorage persistence
export class RCDService {
  static getClients(): Client[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
        return INITIAL_CLIENTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CLIENTS;
    }
  }

  static saveClients(clients: Client[]): void {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
  }

  static getClientById(id: string): Client | undefined {
    return this.getClients().find((c) => c.id === id);
  }

  static updateClientNotificationSettings(
    id: string,
    notifyEmail: boolean,
    notifyMobile: boolean,
    email?: string,
    mobile?: string
  ): Client | null {
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === id);
    if (index === -1) return null;

    clients[index] = {
      ...clients[index],
      notifyEmail,
      notifyMobile,
      ...(email ? { email } : {}),
      ...(mobile ? { mobile } : {}),
    };
    this.saveClients(clients);
    return clients[index];
  }

  static upsertClientFromScan(clientCode: string, clientName: string): Client {
    const clients = this.getClients();
    let existing = clients.find(
      (c) => c.code.toLowerCase() === clientCode.toLowerCase() || c.name.toLowerCase() === clientName.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    const newClient: Client = {
      id: `cli-${Date.now()}`,
      code: clientCode || `C-${Math.floor(1000 + Math.random() * 9000)}`,
      name: clientName,
      cif: 'B-' + Math.floor(10000000 + Math.random() * 90000000),
      email: `contacto@${clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.es`,
      mobile: '+34 6' + Math.floor(10000000 + Math.random() * 90000000),
      notifyEmail: true,
      notifyMobile: true,
      createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    this.saveClients(clients);
    return newClient;
  }

  static getAlbaranes(): Albaran[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALBARANES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(INITIAL_ALBARANES));
        return INITIAL_ALBARANES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_ALBARANES;
    }
  }

  static saveAlbaranes(albaranes: Albaran[]): void {
    localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(albaranes));
  }

  static createAlbaran(newAlbaran: Omit<Albaran, 'id' | 'certified' | 'createdAt'>): Albaran {
    const albaranes = this.getAlbaranes();

    // Ensure client exists or is updated
    const client = this.upsertClientFromScan(newAlbaran.clientCode, newAlbaran.clientName);

    const created: Albaran = {
      ...newAlbaran,
      id: `alb-${Date.now()}`,
      clientId: client.id,
      certified: false,
      createdAt: new Date().toISOString(),
      notificationsSent: {
        mobileSent: client.notifyMobile,
        emailSent: client.notifyEmail,
        timestamp: new Date().toISOString(),
      },
    };

    albaranes.unshift(created);
    this.saveAlbaranes(albaranes);
    return created;
  }

  static getCertificates(): Certificate[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CERTIFICATES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(INITIAL_CERTIFICATES));
        return INITIAL_CERTIFICATES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CERTIFICATES;
    }
  }

  static saveCertificates(certs: Certificate[]): void {
    localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(certs));
  }

  /**
   * CRITICAL FEATURE: Issue a Waste Certificate for third party
   * - Locks all included albaranes (certified = true)
   * - Prevents any future certificate from using the same albaranes
   */
  static issueCertificate(payload: {
    clientId: string;
    clientName: string;
    clientCif: string;
    thirdPartyName: string;
    thirdPartyCif: string;
    constructionSiteName: string;
    constructionSiteAddress: string;
    selectedAlbaranIds: string[];
    issuerName: string;
  }): Certificate {
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

    // LOCK the albaranes so they CANNOT be re-certified
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

    this.saveAlbaranes(updatedAlbaranes);

    const certificates = this.getCertificates();
    certificates.unshift(newCertificate);
    this.saveCertificates(certificates);

    return newCertificate;
  }

  static resetToDefaultData(): void {
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(INITIAL_CLIENTS));
    localStorage.setItem(STORAGE_KEYS.ALBARANES, JSON.stringify(INITIAL_ALBARANES));
    localStorage.setItem(STORAGE_KEYS.CERTIFICATES, JSON.stringify(INITIAL_CERTIFICATES));
  }
}
