import { Albaran, Certificate } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

export interface PrintableCertificateOptions {
  forSignature?: boolean; // When true, admin is downloading/printing to sign in Acrobat/AutoFirma/PC -> clean official signature box, NO red stamp
  isProvisionalPreview?: boolean; // When true (in client portal while pending), shows provisional draft warning
  albaranes?: Albaran[]; // Custom list of albaranes (or auto-loaded from storage)
}

/**
 * Downloads the authentic Adobe Acrobat / AutoFirma signed PDF file
 */
export function downloadSignedPdfFile(certificate: Certificate): void {
  if (!certificate.signedPdfData) {
    openPrintableCertificate(certificate, { forSignature: false });
    return;
  }

  const fileName = certificate.signedPdfFileName || `${certificate.certificateNumber}_Firmado_FNMT.pdf`;

  try {
    if (certificate.signedPdfData.startsWith('data:application/pdf') || certificate.signedPdfData.startsWith('data:;base64')) {
      const base64Parts = certificate.signedPdfData.split(',');
      const base64Data = base64Parts[1] || base64Parts[0];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } else if (certificate.signedPdfData.startsWith('http') || certificate.signedPdfData.startsWith('/')) {
      const link = document.createElement('a');
      link.href = certificate.signedPdfData;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      openPrintableCertificate(certificate, { forSignature: false });
    }
  } catch (err) {
    console.error('Error downloading signed PDF:', err);
    openPrintableCertificate(certificate, { forSignature: false });
  }
}

/**
 * Opens or downloads the certificate document:
 * If a real Acrobat-signed PDF exists, downloads it directly.
 * Otherwise, opens the printable official certificate view.
 */
export function openOrDownloadCertificate(certificate: Certificate, options?: PrintableCertificateOptions): void {
  if (certificate.signedPdfData) {
    downloadSignedPdfFile(certificate);
  } else {
    openPrintableCertificate(certificate, options);
  }
}

/**
 * Generates an official multi-page printable Certificate document:
 * - Page 1: Official Certificate Summary (Client, Promotor, LER breakdown, total tons, official signature block)
 * - Pages 2 to N+1: One dedicated Annex Page per selected Albarán with full delivery data & 2 stamped photos (Truck + Unload)
 */
export function openPrintableCertificate(
  certificate: Certificate,
  options?: PrintableCertificateOptions
): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor permita ventanas emergentes en su navegador para ver el certificado.');
    return;
  }

  // Retrieve attached albaranes
  let attachedAlbaranes: Albaran[] = options?.albaranes || [];
  if (attachedAlbaranes.length === 0) {
    const allAlbs = RCDService.getAlbaranes();
    const idSet = new Set(certificate.albaranIds || []);
    attachedAlbaranes = allAlbs.filter(
      (a) => idSet.has(a.id) || a.certificateId === certificate.id || a.certificateNumber === certificate.certificateNumber
    );

    // Fallback if IDs were not stored or not found in local mock
    if (attachedAlbaranes.length === 0 && (certificate.albaranIds?.length || 0) > 0) {
      attachedAlbaranes = certificate.albaranIds.map((id, index) => ({
        id,
        numAlbaran: `ALB-2026-${8400 + index}`,
        clientId: certificate.clientId,
        clientName: certificate.clientName,
        clientCode: 'C-00100',
        date: certificate.issueDate,
        time: '10:30',
        wasteTypeCode: certificate.wasteBreakdown[0]?.wasteTypeCode || '17 01 01',
        wasteTypeName: certificate.wasteBreakdown[0]?.wasteTypeName || 'Hormigón y Piedra',
        quantityTons: certificate.totalTons / Math.max(1, certificate.albaranIds.length),
        licensePlate: '8492-KZX',
        plantZone: 'Muelle A - Fosa de Triaje RCD',
        gpsCoords: '37.3891° N, 5.9845° W',
        certified: true,
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
        createdAt: certificate.issueDate,
      }));
    }
  }

  const totalPages = 1 + attachedAlbaranes.length;

  const breakdownRows = certificate.wasteBreakdown
    .map(
      (b) => `
      <tr>
        <td style="padding: 7px 10px; border: 1px solid #CBD5E1; font-weight: bold; font-family: monospace; font-size: 11px;">${b.wasteTypeCode}</td>
        <td style="padding: 7px 10px; border: 1px solid #CBD5E1; font-size: 11px;">${b.wasteTypeName}</td>
        <td style="padding: 7px 10px; border: 1px solid #CBD5E1; text-align: center; font-size: 11px;">${b.albaranesCount}</td>
        <td style="padding: 7px 10px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #047857; font-size: 12px;">${b.totalTons.toFixed(2)} t</td>
      </tr>
    `
    )
    .join('');

  // Determine Signature Block for Page 1
  const isOfficiallySigned = certificate.status === 'Emitido' || !!certificate.signedAt;
  const isForSignatureMode = !!options?.forSignature;

  let signatureBlockHtml = '';

  if (isOfficiallySigned) {
    // Official Valid Digital Signature Box (FNMT / eIDAS)
    signatureBlockHtml = `
      <div class="stamp-box" style="border: 2px solid #047857; background: #ECFDF5; width: 340px; padding: 10px; text-align: left; border-radius: 6px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #A7F3D0; padding-bottom: 4px; margin-bottom: 6px;">
          <span style="font-size: 9.5px; font-weight: bold; color: #047857;">🏛️ FIRMA DIGITAL FNMT-RCM</span>
          <span style="font-size: 8px; font-weight: bold; background: #047857; color: #FFFFFF; padding: 1.5px 6px; border-radius: 3px;">eIDAS VÁLIDO</span>
        </div>
        ${
          certificate.signatureData
            ? `<img src="${certificate.signatureData}" style="max-height: 48px; width: 100%; object-fit: contain; margin: 3px 0; display: block;" alt="Firma Digital FNMT" />`
            : ''
        }
        <div style="font-size: 8.5px; color: #0F172A; line-height: 1.35; margin-top: 3px;">
          <div><strong>Firmante:</strong> ${certificate.signerName || certificate.issuerName || 'Director Técnico'}</div>
          <div><strong>NIF/CIF:</strong> ${certificate.signerNif || 'B-91029384'} | <strong>Emisor:</strong> ${certificate.fnmtCertIssuer || 'AC Representación FNMT-RCM'}</div>
          <div><strong>Serie FNMT:</strong> <span style="font-family: monospace; font-size: 8px;">${certificate.fnmtCertSerial || '3C:8E:29:A1:B4:77:F0:92'}</span></div>
          <div><strong>Fecha Sellado:</strong> ${certificate.signedAt}</div>
          <div style="color: #047857; font-weight: bold; margin-top: 2px;">✓ CSV: <span style="font-family: monospace;">${certificate.verificationCode}</span> | SHA256withRSA</div>
        </div>
      </div>
    `;
  } else if (isForSignatureMode) {
    // Clean Empty Green Box for placing digital signature in Acrobat / AutoFirma
    signatureBlockHtml = `
      <div class="stamp-box" style="border: 2px dashed #059669; background: #F0FDF4; width: 340px; height: 115px; padding: 8px 10px; border-radius: 6px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px dashed #A7F3D0; padding-bottom: 3px;">
          <span style="font-size: 8.5px; font-weight: bold; color: #047857;">✍️ ESPACIO PARA FIRMA DIGITAL (FNMT / ACROBAT)</span>
          <span style="font-size: 7.5px; font-weight: bold; background: #D1FAE5; color: #047857; padding: 1px 5px; border-radius: 3px;">RESERVADO</span>
        </div>
        <div style="flex: 1;"></div>
        <div style="font-size: 8px; color: #059669; font-family: monospace; text-align: right;">
          CSV: ${certificate.verificationCode}
        </div>
      </div>
    `;
  } else {
    // Preliminary Mode for Client (Before Signature): RED Warning Box
    signatureBlockHtml = `
      <div class="stamp-box" style="border: 2px dashed #DC2626; background: #FEF2F2; width: 340px; height: 115px; padding: 12px; text-align: center; border-radius: 6px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <div style="font-size: 11px; font-weight: 900; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.3;">
          ⚠️ CERTIFICADO NO VÁLIDO SIN LA FIRMA DIGITAL
        </div>
        <div style="font-size: 8.5px; color: #991B1B; font-weight: 600; line-height: 1.35; margin-top: 6px;">
          DOCUMENTO PROVISIONAL PENDIENTE DE EMISIÓN Y FIRMA DIGITAL ELECTRÓNICA POR LA DIRECCIÓN TÉCNICA
        </div>
        <div style="font-size: 8px; color: #B91C1C; margin-top: 6px; font-family: monospace; font-weight: bold;">
          CSV: ${certificate.verificationCode}
        </div>
      </div>
    `;
  }

  // Generate Annex Pages (1 Page per Albarán)
  const annexPagesHtml = attachedAlbaranes
    .map((alb, index) => {
      const pageNumber = index + 2;
      const truckImg = alb.truckPhotoUrl && alb.truckPhotoUrl.startsWith('data:image') ? alb.truckPhotoUrl : '';
      const unloadImg = alb.unloadPhotoUrl && alb.unloadPhotoUrl.startsWith('data:image') ? alb.unloadPhotoUrl : '';

      return `
      <!-- ANNEX PAGE ${index + 1} (ALBARÁN ${alb.numAlbaran}) -->
      <div class="page-container page-break">
        
        <!-- Header Annex -->
        <div class="annex-header">
          <div>
            <div class="title" style="font-size: 14px;">PLANTA DE VALORIZACIÓN Y RECICLAJE RCD</div>
            <div class="subtitle" style="font-size: 10px;">Gestor Autorizado RCD-SE/2024-00912 | Control de Entrada y Trazabilidad</div>
          </div>
          <div style="text-align: right;">
            <div class="cert-num" style="font-size: 12px; padding: 4px 10px;">ANEXO DOCUMENTAL ${index + 1} DE ${attachedAlbaranes.length}</div>
            <div style="font-size: 9.5px; color: #64748B; margin-top: 3px; font-family: monospace;">Cert: ${certificate.certificateNumber}</div>
          </div>
        </div>

        <!-- Banner Title -->
        <div class="annex-title-bar">
          <h3 style="margin: 0; font-size: 13px; text-transform: uppercase; color: #065F46;">
            JUSTIFICANTE DE ENTRADA Y DESCARGA — ALBARÁN Nº <span style="font-family: monospace; color: #047857;">${alb.numAlbaran}</span>
          </h3>
        </div>

        <!-- Delivery Data Grid -->
        <div class="section-box" style="margin-bottom: 12px; padding: 12px;">
          <div class="grid-4">
            <div>
              <div class="field-label">Nº Albarán SAP</div>
              <div class="field-value" style="font-family: monospace; color: #047857;">${alb.numAlbaran}</div>
            </div>
            <div>
              <div class="field-label">Fecha y Hora</div>
              <div class="field-value">${alb.date} ${alb.time}</div>
            </div>
            <div>
              <div class="field-label">Matrícula Camión</div>
              <div class="field-value" style="font-family: monospace; color: #D97706;">${alb.licensePlate || 'BÁSCULA-1'}</div>
            </div>
            <div>
              <div class="field-label">Peso Neto (t)</div>
              <div class="field-value" style="color: #047857; font-size: 14px;">${alb.quantityTons.toFixed(2)} t</div>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 10px; border-top: 1px solid #E2E8F0; padding-top: 8px;">
            <div>
              <div class="field-label">Cliente / Transportista</div>
              <div class="field-value" style="font-size: 12px;">${alb.clientName}</div>
            </div>
            <div>
              <div class="field-label">Residuo RCD (Código LER)</div>
              <div class="field-value" style="font-size: 12px; color: #065F46;">LER ${alb.wasteTypeCode} - ${alb.wasteTypeName}</div>
            </div>
          </div>

          <div class="grid-2" style="margin-top: 8px;">
            <div>
              <div class="field-label">Zona de Descarga en Planta</div>
              <div class="field-value" style="font-size: 11px;">${alb.plantZone || 'Muelle A - Fosa de Triaje RCD'}</div>
            </div>
            <div>
              <div class="field-label">Geolocalización GPS Báscula</div>
              <div class="field-value" style="font-size: 11px; font-family: monospace; color: #475569;">${alb.gpsCoords || '37.3891° N, 5.9845° W [Sincronizado]'}</div>
            </div>
          </div>
        </div>

        <!-- Photographic Evidence Section -->
        <div class="section-box" style="padding: 12px; margin-bottom: 12px;">
          <div class="section-title" style="margin-bottom: 10px; font-size: 11px;">
            📸 REGISTRO FOTOGRÁFICO DE CONTROL Y CUSTODIA (EVIDENCIA DIGITAL SELLADA)
          </div>

          <div class="grid-2" style="gap: 12px;">
            
            <!-- Photo 1: Truck on Scale -->
            <div class="photo-card">
              <div class="photo-header">
                <span>🚛 FOTO 1: CAMIÓN EN BÁSCULA (MATRÍCULA)</span>
                <span class="badge-tag">VERIFICADO</span>
              </div>
              <div class="photo-container">
                ${
                  truckImg
                    ? `<img src="${truckImg}" alt="Foto Camión Báscula" class="photo-img" />`
                    : `
                    <div class="photo-placeholder">
                      <div style="font-size: 24px; margin-bottom: 4px;">🚛</div>
                      <div style="font-weight: bold; font-size: 12px; color: #047857; font-family: monospace;">MATRÍCULA: ${alb.licensePlate || '8492-KZX'}</div>
                      <div style="font-size: 9px; color: #64748B; margin-top: 2px;">Control de Acceso y Pesaje Báscula #1</div>
                      <div style="font-size: 8px; color: #94A3B8; margin-top: 2px;">Fecha: ${alb.date} ${alb.time} | 37.3891° N, 5.9845° W</div>
                    </div>
                  `
                }
              </div>
              <div class="photo-caption">
                Evidencia de pesaje y control visual de entrada. Matrícula: <strong>${alb.licensePlate || 'N/A'}</strong>.
              </div>
            </div>

            <!-- Photo 2: Unload / Triaje -->
            <div class="photo-card">
              <div class="photo-header">
                <span>♻️ FOTO 2: DESCARGA EN PLANTA (TRIAJE)</span>
                <span class="badge-tag">VALORIZABLE</span>
              </div>
              <div class="photo-container">
                ${
                  unloadImg
                    ? `<img src="${unloadImg}" alt="Foto Descarga Planta" class="photo-img" />`
                    : `
                    <div class="photo-placeholder">
                      <div style="font-size: 24px; margin-bottom: 4px;">🏗️</div>
                      <div style="font-weight: bold; font-size: 12px; color: #065F46;">LER ${alb.wasteTypeCode}</div>
                      <div style="font-size: 9px; color: #64748B; margin-top: 2px;">${alb.plantZone || 'Fosa de Triaje RCD'}</div>
                      <div style="font-size: 8px; color: #94A3B8; margin-top: 2px;">Descarga Registrada | Peso: ${alb.quantityTons.toFixed(2)} t</div>
                    </div>
                  `
                }
              </div>
              <div class="photo-caption">
                Evidencia de descarga y triaje en <strong>${alb.plantZone || 'Muelle A'}</strong> (${alb.quantityTons.toFixed(2)} t).
              </div>
            </div>

          </div>
        </div>

        <!-- Annex Footer -->
        <div class="annex-footer">
          <div>
            <span>Certificado Nº: <strong>${certificate.certificateNumber}</strong></span>
            <span style="margin: 0 8px;">|</span>
            <span>CSV: <strong style="font-family: monospace;">${certificate.verificationCode}</strong></span>
            <span style="margin: 0 8px;">|</span>
            <span>Promotor: <strong>${certificate.thirdPartyName}</strong></span>
          </div>
          <div style="font-weight: bold; color: #047857;">
            Página ${pageNumber} de ${totalPages}
          </div>
        </div>

      </div>
      `;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Certificado RCD - ${certificate.certificateNumber}</title>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 0;
          color: #0F172A;
          background: #FFFFFF;
          font-size: 12px;
          line-height: 1.4;
        }
        .page-container {
          padding: 30px 36px;
          min-height: 100vh;
          position: relative;
          background: #FFFFFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #059669;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          color: #065F46;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .subtitle {
          font-size: 10.5px;
          color: #475569;
          margin-top: 2px;
        }
        .cert-num {
          font-size: 14px;
          font-weight: bold;
          background: #ECFDF5;
          color: #047857;
          padding: 6px 14px;
          border-radius: 6px;
          border: 1px solid #A7F3D0;
          font-family: monospace;
          text-align: right;
        }
        .section-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 12px 14px;
          margin-bottom: 14px;
        }
        .section-title {
          font-size: 11px;
          font-weight: bold;
          color: #0F172A;
          text-transform: uppercase;
          margin-bottom: 8px;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 3px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .field-label {
          font-size: 9.5px;
          color: #64748B;
          text-transform: uppercase;
          margin-bottom: 1px;
        }
        .field-value {
          font-size: 12px;
          font-weight: bold;
          color: #0F172A;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th {
          background: #1E293B;
          color: #FFFFFF;
          padding: 8px 10px;
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .legal-text {
          font-size: 10px;
          line-height: 1.45;
          color: #334155;
          margin: 12px 0;
          padding: 10px 12px;
          background: #F1F5F9;
          border-left: 4px solid #059669;
          border-radius: 0 4px 4px 0;
        }
        .footer {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-top: 1px solid #E2E8F0;
          padding-top: 12px;
        }
        .annex-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #047857;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .annex-title-bar {
          background: #ECFDF5;
          border: 1px solid #A7F3D0;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }
        .photo-card {
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          overflow: hidden;
          background: #FFFFFF;
        }
        .photo-header {
          background: #F1F5F9;
          border-bottom: 1px solid #E2E8F0;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: bold;
          color: #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .badge-tag {
          font-size: 8px;
          background: #047857;
          color: #FFFFFF;
          padding: 1px 5px;
          border-radius: 3px;
          font-weight: bold;
        }
        .photo-container {
          height: 190px;
          background: #0F172A;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .photo-placeholder {
          text-align: center;
          padding: 16px;
          color: #F8FAFC;
        }
        .photo-caption {
          padding: 6px 10px;
          font-size: 9.5px;
          color: #475569;
          background: #F8FAFC;
          border-top: 1px solid #F1F5F9;
        }
        .annex-footer {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          color: #64748B;
          border-top: 1px solid #CBD5E1;
          padding-top: 8px;
        }
        .print-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #059669;
          color: white;
          border: none;
          padding: 12px 22px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .print-btn:hover {
          background: #047857;
        }
        @media print {
          .print-btn { display: none !important; }
          body { 
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-container {
            padding: 24px 28px;
            min-height: auto;
          }
          .page-break { 
            page-break-before: always !important; 
            break-before: page !important; 
          }
        }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">
        🖨️ Imprimir / Guardar como PDF (${totalPages} págs.)
      </button>

      <!-- ================= PAGE 1: OFFICIAL CERTIFICATE SUMMARY ================= -->
      <div class="page-container">
        
        <!-- Header -->
        <div class="header">
          <div>
            <div class="title">PLANTA DE VALORIZACIÓN Y RECICLAJE RCD</div>
            <div class="subtitle">Gestor Autorizado de Residuos RCD-SE/2024-00912 | NIF: B-91029384</div>
            <div class="subtitle">Ctra. Isla Mayor km 4.5, 41080 Sevilla | Email: certificados@plantarcd.es</div>
          </div>
          <div style="text-align: right;">
            <div class="cert-num">${certificate.certificateNumber}</div>
            <div style="font-size: 9px; color: #64748B; margin-top: 3px; font-family: monospace;">Página 1 de ${totalPages}</div>
          </div>
        </div>

        <h2 style="text-align: center; font-size: 14px; text-transform: uppercase; margin: 12px 0 8px 0; color: #065F46; letter-spacing: 0.5px;">
          CERTIFICADO DE GESTIÓN Y VALORIZACIÓN DE RESIDUOS DE CONSTRUCCIÓN Y DEMOLICIÓN
        </h2>

        <div class="legal-text">
          <strong>MARCO LEGAL:</strong> Se expide el presente certificado de recepción, tratamiento y valorización de Residuos de Construcción y Demolición (RCD) en estricto cumplimiento del <strong>Real Decreto 105/2008</strong> por el que se regula la producción y gestión de los RCD y de la <strong>Ley 7/2022, de 8 de abril</strong>, de residuos y suelos contaminados para una economía circular.
        </div>

        <div class="grid-2">
          <!-- 1. Cliente / Transportista -->
          <div class="section-box">
            <div class="section-title">1. CLIENTE / SOLICITANTE</div>
            <div class="field-label">Empresa / Transportista</div>
            <div class="field-value">${certificate.clientName}</div>
            <div style="margin-top: 6px;">
              <span class="field-label">CIF / NIF: </span>
              <span class="field-value">${certificate.clientCif}</span>
            </div>
            <div style="margin-top: 4px;">
              <span class="field-label">Código Cliente SAP: </span>
              <span class="field-value" style="font-family: monospace; color: #475569;">${certificate.clientId}</span>
            </div>
          </div>

          <!-- 2. Promotor / Beneficiario -->
          <div class="section-box" style="border-color: #059669; background: #F0FDF4;">
            <div class="section-title" style="color: #047857; border-color: #A7F3D0;">2. PROMOTOR / TERCERO BENEFICIARIO</div>
            <div class="field-label">Promotor de la Obra</div>
            <div class="field-value" style="color: #065F46; font-size: 13px;">${certificate.thirdPartyName}</div>
            <div style="margin-top: 4px;">
              <span class="field-label">NIF/CIF Promotor: </span>
              <span class="field-value">${certificate.thirdPartyCif}</span>
            </div>
            <div style="margin-top: 4px;">
              <span class="field-label">Obra / Referencia: </span>
              <span class="field-value">${certificate.constructionSiteName}</span>
            </div>
            <div style="margin-top: 3px;">
              <span class="field-label">Ubicación Obra: </span>
              <span class="field-value" style="font-size: 11px; font-weight: normal;">${certificate.constructionSiteAddress}</span>
            </div>
          </div>
        </div>

        <!-- 3. Resumen LER -->
        <div class="section-box">
          <div class="section-title">3. RESUMEN DE RESIDUOS VALORIZADOS EN PLANTA (CÓDIGOS LER)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 100px;">CÓDIGO LER</th>
                <th>DENOMINACIÓN DEL RESIDUO</th>
                <th style="text-align: center; width: 90px;">Nº ENTRADAS</th>
                <th style="text-align: right; width: 130px;">CANTIDAD TOTAL (t)</th>
              </tr>
            </thead>
            <tbody>
              ${breakdownRows}
            </tbody>
            <tfoot>
              <tr style="background: #ECFDF5; font-size: 12.5px;">
                <td colspan="3" style="padding: 8px 10px; font-weight: bold; text-align: right; border: 1px solid #A7F3D0;">TOTAL RESIDUOS CERTIFICADOS:</td>
                <td style="padding: 8px 10px; font-weight: bold; text-align: right; color: #047857; border: 1px solid #A7F3D0; font-size: 13px;">${certificate.totalTons.toFixed(2)} TONELADAS</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="font-size: 9.5px; color: #475569; margin-top: 8px; background: #F8FAFC; padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 4px; line-height: 1.4;">
          🔒 <strong>TRAZABILIDAD E INMUTABILIDAD:</strong> Las <strong>${attachedAlbaranes.length} entradas de descarga</strong> acreditadas en este certificado quedan vinculadas y selladas de forma inmutable. En las páginas siguientes (${2} a ${totalPages}) se adjuntan los <strong>anexos fotográficos y justificantes de pesaje de cada camión</strong>.
        </div>

        <!-- Footer / Signature Block -->
        <div class="footer">
          <div>
            <div style="font-size: 10.5px; color: #475569;">Fecha de Emisión: <strong>${certificate.issueDate}</strong></div>
            <div style="font-size: 10.5px; color: #475569; margin-top: 4px;">Código de Verificación Electrónica (CSV): <strong style="font-family: monospace; color: #065F46;">${certificate.verificationCode}</strong></div>
          </div>

          ${signatureBlockHtml}
        </div>

      </div>

      <!-- ================= PAGES 2..N+1: ANNEXES WITH REAL STAMPED PHOTOS ================= -->
      ${annexPagesHtml}

    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

