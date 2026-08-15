import { Certificate } from '../types/rcd';

/**
 * Downloads the authentic Adobe Acrobat / AutoFirma signed PDF file
 */
export function downloadSignedPdfFile(certificate: Certificate): void {
  if (!certificate.signedPdfData) {
    openPrintableCertificate(certificate);
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
      openPrintableCertificate(certificate);
    }
  } catch (err) {
    console.error('Error downloading signed PDF:', err);
    openPrintableCertificate(certificate);
  }
}

/**
 * Opens or downloads the certificate document:
 * If a real Acrobat-signed PDF exists, downloads it directly.
 * Otherwise, opens the printable official certificate view.
 */
export function openOrDownloadCertificate(certificate: Certificate): void {
  if (certificate.signedPdfData) {
    downloadSignedPdfFile(certificate);
  } else {
    openPrintableCertificate(certificate);
  }
}

/**
 * Generates an official printable Certificate document HTML / Print View
 */
export function openPrintableCertificate(certificate: Certificate): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor permita ventanas emergentes para ver el certificado.');
    return;
  }

  const breakdownRows = certificate.wasteBreakdown
    .map(
      (b) => `
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-weight: bold;">${b.wasteTypeCode}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1;">${b.wasteTypeName}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: center;">${b.albaranesCount}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; text-align: right; font-weight: bold; color: #059669;">${b.totalTons.toFixed(2)} t</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Certificado RCD - ${certificate.certificateNumber}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 40px;
          color: #0F172A;
          background: #FFFFFF;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #059669;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .title {
          font-size: 18px;
          font-weight: bold;
          color: #065F46;
          text-transform: uppercase;
        }
        .subtitle {
          font-size: 12px;
          color: #475569;
          margin-top: 4px;
        }
        .cert-num {
          font-size: 16px;
          font-weight: bold;
          background: #ECFDF5;
          color: #047857;
          padding: 8px 16px;
          border-radius: 6px;
          border: 1px solid #A7F3D0;
        }
        .section-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .section-title {
          font-size: 13px;
          font-weight: bold;
          color: #0F172A;
          text-transform: uppercase;
          margin-bottom: 10px;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 4px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .field-label {
          font-size: 11px;
          color: #64748B;
          text-transform: uppercase;
        }
        .field-value {
          font-size: 13px;
          font-weight: bold;
          color: #0F172A;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
          font-size: 12px;
        }
        th {
          background: #1E293B;
          color: #FFFFFF;
          padding: 10px 12px;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
        }
        .legal-text {
          font-size: 11px;
          line-height: 1.5;
          color: #334155;
          margin: 20px 0;
          padding: 12px;
          background: #F1F5F9;
          border-left: 4px solid #059669;
        }
        .footer {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .stamp-box {
          border: 2px dashed #059669;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
          width: 220px;
          background: #ECFDF5;
        }
        .print-btn {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #059669;
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }
        @media print {
          .print-btn { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

      <div class="header">
        <div>
          <div class="title">PLANTA DE VALORIZACIÓN Y RECICLAJE RCD</div>
          <div class="subtitle">Gestor Autorizado de Residuos RCD-SE/2024-00912 | NIF: B-91029384</div>
          <div class="subtitle">Ctra. Isla Mayor km 4.5, 41080 Sevilla | Email: certificados@plantarcd.es</div>
        </div>
        <div class="cert-num">${certificate.certificateNumber}</div>
      </div>

      <h2 style="text-align: center; font-size: 16px; text-transform: uppercase; margin: 16px 0; color: #065F46;">
        CERTIFICADO DE GESTIÓN Y VALORIZACIÓN DE RESIDUOS DE CONSTRUCCIÓN Y DEMOLICIÓN
      </h2>

      <div class="legal-text">
        <strong>MARCO LEGAL:</strong> Se expide el presente certificado de recepción, tratamiento y valorización de Residuos de Construcción y Demolición (RCD) en cumplimiento del <strong>Real Decreto 105/2008</strong> por el que se regula la producción y gestión de los RCD y de la <strong>Ley 7/2022, de 8 de abril</strong>, de residuos y suelos contaminados para una economía circular.
      </div>

      <div class="grid-2">
        <div class="section-box">
          <div class="section-title">1. CLIENTE / SOLICITANTE</div>
          <div class="field-label">Empresa / Transportista</div>
          <div class="field-value">${certificate.clientName}</div>
          <div style="margin-top: 8px;">
            <span class="field-label">CIF / NIF: </span>
            <span class="field-value">${certificate.clientCif}</span>
          </div>
        </div>

        <div class="section-box" style="border-color: #059669; background: #F0FDF4;">
          <div class="section-title" style="color: #047857; border-color: #A7F3D0;">2. PROMOTOR / TERCERO BENEFICIARIO</div>
          <div class="field-label">Promotor de la Obra</div>
          <div class="field-value" style="color: #065F46; font-size: 14px;">${certificate.thirdPartyName}</div>
          <div style="margin-top: 6px;">
            <span class="field-label">NIF/CIF Promotor: </span>
            <span class="field-value">${certificate.thirdPartyCif}</span>
          </div>
          <div style="margin-top: 6px;">
            <span class="field-label">Obra / Referencia: </span>
            <span class="field-value">${certificate.constructionSiteName}</span>
          </div>
          <div style="margin-top: 4px;">
            <span class="field-label">Ubicación Obra: </span>
            <span class="field-value">${certificate.constructionSiteAddress}</span>
          </div>
        </div>
      </div>

      <div class="section-box">
        <div class="section-title">3. RESUMEN DE RESIDUOS VALORIZADOS EN PLANTA (CÓDIGOS LER)</div>
        <table>
          <thead>
            <tr>
              <th>CÓDIGO LER</th>
              <th>DENOMINACIÓN DEL RESIDUO</th>
              <th style="text-align: center;">Nº ENTRADAS</th>
              <th style="text-align: right;">CANTIDAD TOTAL (t)</th>
            </tr>
          </thead>
          <tbody>
            ${breakdownRows}
          </tbody>
          <tfoot>
            <tr style="background: #ECFDF5; font-size: 14px;">
              <td colspan="3" style="padding: 10px; font-weight: bold; text-align: right;">TOTAL RESIDUOS CERTIFICADOS:</td>
              <td style="padding: 10px; font-weight: bold; text-align: right; color: #047857;">${certificate.totalTons.toFixed(2)} TONELADAS</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="font-size: 10px; color: #64748B; margin-top: 10px; font-style: italic; background: #FFFBEB; padding: 8px; border: 1px solid #FDE68A; border-radius: 4px;">
        ⚠️ <strong>AVISO DE INMUTABILIDAD:</strong> Los albaranes de entrega incluidos en este certificado (Total: ${certificate.albaranIds.length} entregas) han quedado bloqueados electrónicamente en el sistema y no podrán ser asignados a ningún otro certificado de gestión.
      </div>

      <div class="footer">
        <div>
          <div style="font-size: 11px; color: #475569;">Fecha de Emisión: <strong>${certificate.issueDate}</strong></div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">Código de Verificación Electrónica (CSV): <strong>${certificate.verificationCode}</strong></div>
          <div style="margin-top: 16px; font-size: 11px; color: #0F172A;">
            <strong>REPRESENTANTE LEGAL Y FIRMA TÉCNICA:</strong><br/>
            ${certificate.signerName || certificate.issuerName}<br/>
            <span style="color: #64748B; font-size: 10px;">Director Técnico / Apoderado Planta RCD</span>
          </div>
        </div>

        ${
          certificate.status === 'Pendiente de Firma' || !certificate.signedAt
            ? `
          <div class="stamp-box" style="border: 2px dashed #DC2626; background: #FEF2F2; color: #991B1B; width: 300px; padding: 12px; text-align: center;">
            <div style="font-size: 11px; font-weight: bold; color: #DC2626;">⚠️ CERTIFICADO NO VÁLIDO</div>
            <div style="font-size: 10px; font-weight: bold; margin-top: 4px; color: #991B1B; text-transform: uppercase;">
              SIN LA FIRMA DIGITAL DE LA EMPRESA
            </div>
            <div style="font-size: 9px; color: #B91C1C; margin-top: 6px; line-height: 1.3;">
              Documento en trámite. Pendiente de firma y sellado digital por la Dirección Técnica mediante Certificado FNMT-RCM.
            </div>
            <div style="font-size: 8px; color: #64748B; margin-top: 6px;">Ref: ${certificate.verificationCode}</div>
          </div>
        `
            : `
          <div class="stamp-box" style="border: 2px solid #047857; background: #ECFDF5; width: 320px; padding: 10px; text-align: left;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #A7F3D0; padding-bottom: 4px; margin-bottom: 6px;">
              <span style="font-size: 9px; font-weight: bold; color: #047857;">🏛️ FIRMA DIGITAL FNMT-RCM</span>
              <span style="font-size: 8px; font-weight: bold; background: #047857; color: #FFFFFF; padding: 1px 5px; border-radius: 3px;">eIDAS VÁLIDO</span>
            </div>
            ${
              certificate.signatureData
                ? `<img src="${certificate.signatureData}" style="max-height: 52px; width: 100%; object-fit: contain; margin: 4px 0; display: block;" alt="Firma FNMT" />`
                : ''
            }
            <div style="font-size: 8.5px; color: #0F172A; line-height: 1.35; margin-top: 4px;">
              <div><strong>Firmante:</strong> ${certificate.signerName || certificate.issuerName}</div>
              <div><strong>NIF/CIF:</strong> ${certificate.signerNif || 'B-91029384'} | <strong>Emisor:</strong> ${certificate.fnmtCertIssuer || 'AC Representación FNMT-RCM'}</div>
              <div><strong>Serie FNMT:</strong> <span style="font-family: monospace; font-size: 8px;">${certificate.fnmtCertSerial || '3C:8E:29:A1:B4:77:F0:92'}</span></div>
              <div><strong>Fecha y Hora:</strong> ${certificate.signedAt}</div>
              <div style="color: #047857; font-weight: bold; margin-top: 2px;">✓ CSV: <span style="font-family: monospace;">${certificate.verificationCode}</span> | SHA256withRSA</div>
            </div>
          </div>
        `
        }
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
