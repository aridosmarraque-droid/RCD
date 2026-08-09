/**
 * Generates realistic SAP Business One Báscula Delivery Ticket SVG/Canvas Images
 * for quick testing and OCR demonstration.
 */

export interface SampleSapTicket {
  id: string;
  numAlbaran: string;
  clientCode: string;
  clientName: string;
  wasteTypeCode: string;
  wasteTypeName: string;
  quantityTons: number;
  licensePlate: string;
  driverName: string;
  svgDataUrl: string;
}

export function generateSampleSapTickets(): SampleSapTicket[] {
  const samples = [
    {
      id: 'sample-1',
      numAlbaran: 'ALB-2026-08493',
      clientCode: 'C-00104',
      clientName: 'Construcciones y Excavaciones García S.L.',
      wasteTypeCode: '17 01 01',
      wasteTypeName: 'Hormigón y Piedra (Escombro Limpio)',
      quantityTons: 15.30,
      licensePlate: '8492-KZX',
      driverName: 'Antonio Delgado',
    },
    {
      id: 'sample-2',
      numAlbaran: 'ALB-2026-08494',
      clientCode: 'C-00218',
      clientName: 'Transportes y Derribos Marraque Hnos.',
      wasteTypeCode: '17 09 04',
      wasteTypeName: 'Residuos Mezclados RCD (Escombro Sucio / Mezcla)',
      quantityTons: 12.80,
      licensePlate: '4102-LPT',
      driverName: 'Marcos Marraque',
    },
    {
      id: 'sample-3',
      numAlbaran: 'ALB-2026-08495',
      clientCode: 'C-00350',
      clientName: 'Promociones del Sur Inmobiliaria S.A.',
      wasteTypeCode: '17 05 04',
      wasteTypeName: 'Tierras y Piedras de Excavación',
      quantityTons: 24.10,
      licensePlate: '9012-GHT',
      driverName: 'Joaquín Morales',
    },
  ];

  return samples.map((sample) => {
    const today = new Date().toISOString().split('T')[0];
    const time = '11:20';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="550" height="750" viewBox="0 0 550 750" style="background:#F8FAFC; font-family:'Courier New', monospace;">
      <!-- Ticket Paper -->
      <rect x="25" y="25" width="500" height="700" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" rx="4"/>
      
      <!-- SAP Header -->
      <rect x="40" y="40" width="470" height="70" fill="#1E293B" rx="4"/>
      <text x="60" y="70" fill="#38BDF8" font-size="18" font-weight="bold">SAP Business One - báscula</text>
      <text x="60" y="92" fill="#E2E8F0" font-size="13">PLANTA RCD ECO-MARRAQUE S.L. | CIF: B-91029384</text>
      <text x="380" y="70" fill="#F59E0B" font-size="14" font-weight="bold">ENTRADA</text>

      <!-- Albaran Barcode Section -->
      <text x="50" y="145" fill="#0F172A" font-size="16" font-weight="bold">ALBARÁN DE VENTA Nº: ${sample.numAlbaran}</text>
      <text x="50" y="168" fill="#64748B" font-size="12">FECHA: ${today}  |  HORA: ${time}  |  BÁSCULA: BASC-01</text>
      
      <line x1="50" y1="180" x2="500" y2="180" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="4"/>

      <!-- Client Details -->
      <text x="50" y="210" fill="#334155" font-size="13" font-weight="bold">DATOS DEL CLIENTE / TRANSPORTISTA:</text>
      <text x="50" y="235" fill="#0F172A" font-size="14">CÓDIGO CLIENTE: ${sample.clientCode}</text>
      <text x="50" y="258" fill="#0F172A" font-size="14" font-weight="bold">RAZÓN SOCIAL: ${sample.clientName}</text>

      <line x1="50" y1="280" x2="500" y2="280" stroke="#E2E8F0" stroke-width="1"/>

      <!-- Vehicle details -->
      <text x="50" y="310" fill="#334155" font-size="13" font-weight="bold">DATOS DEL VEHÍCULO Y CONDUCTOR:</text>
      <text x="50" y="335" fill="#0F172A" font-size="14">MATRÍCULA CAMIÓN: ${sample.licensePlate}</text>
      <text x="50" y="358" fill="#0F172A" font-size="14">CONDUCTOR: ${sample.driverName}</text>

      <line x1="50" y1="380" x2="500" y2="380" stroke="#E2E8F0" stroke-width="1"/>

      <!-- Waste details -->
      <text x="50" y="410" fill="#334155" font-size="13" font-weight="bold">DETALLE DE RESIDUO DE CONSTRUCCIÓN Y DEMOLICIÓN (RCD):</text>
      
      <rect x="50" y="425" width="450" height="85" fill="#F1F5F9" stroke="#E2E8F0" rx="4"/>
      <text x="65" y="450" fill="#0F172A" font-size="14" font-weight="bold">CÓDIGO LER: ${sample.wasteTypeCode}</text>
      <text x="65" y="475" fill="#0F172A" font-size="13">${sample.wasteTypeName}</text>
      <text x="65" y="498" fill="#059669" font-size="15" font-weight="bold">CANTIDAD NETA: ${sample.quantityTons.toFixed(2)} TONELADAS (t)</text>

      <!-- Weighing Details -->
      <text x="50" y="540" fill="#64748B" font-size="12">PESADA BRUTO: ${(sample.quantityTons + 14.2).toFixed(2)} t  |  TARA: 14.20 t  |  NETO: ${sample.quantityTons.toFixed(2)} t</text>
      <text x="50" y="560" fill="#64748B" font-size="12">DESTINO PLANTA: Muelle A - Triaje y Clasificación RCD</text>

      <line x1="50" y1="580" x2="500" y2="580" stroke="#0F172A" stroke-width="2"/>

      <!-- Footer / Signatures -->
      <text x="50" y="610" fill="#475569" font-size="11">Firma Operador Báscula: _________________</text>
      <text x="300" y="610" fill="#475569" font-size="11">Firma Conductor: _________________</text>

      <rect x="50" y="635" width="450" height="40" fill="#ECFDF5" stroke="#A7F3D0" rx="4"/>
      <text x="65" y="660" fill="#047857" font-size="11" font-weight="bold">✓ REGISTRADO EN SAP BUSINESS ONE - PLANTA VALORIZACIÓN RCD</text>
    </svg>`;

    const encodedSvg = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

    return {
      ...sample,
      svgDataUrl: encodedSvg,
    };
  });
}
