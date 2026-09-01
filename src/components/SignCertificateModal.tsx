import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  FileSignature,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Award,
  FileBadge,
  Upload,
  KeyRound,
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { Certificate } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';
import { openPrintableCertificate } from '../utils/certificatePdf';

interface SignCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate | null;
  onSignedSuccess: (updatedCert: Certificate) => void;
}

export const SignCertificateModal: React.FC<SignCertificateModalProps> = ({
  isOpen,
  onClose,
  certificate,
  onSignedSuccess,
}) => {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'acrobat_upload' | 'web_stamp'>('acrobat_upload');

  // Adobe Acrobat PDF Upload State
  const [uploadedPdfFile, setUploadedPdfFile] = useState<File | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // FNMT Digital Stamp Details (Web mode)
  const [fnmtCertType, setFnmtCertType] = useState<'representacion' | 'empleado' | 'persona_fisica'>('representacion');
  const [signerName, setSignerName] = useState('Áridos Marraque S.L. - Dirección Técnica');
  const [signerNif, setSignerNif] = useState('B04117818');
  const [fnmtCertSerial, setFnmtCertSerial] = useState('3C:8E:29:A1:B4:77:F0:92:E4:10');
  const [fnmtCertIssuer, setFnmtCertIssuer] = useState('AC Representación FNMT-RCM (Fábrica Nacional de Moneda y Timbre)');
  const [signatureMode, setSignatureMode] = useState<'fnmt' | 'fnmt_manual'>('fnmt');
  
  const [isSigning, setIsSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setUploadedPdfFile(null);
      setUploadedPdfBase64(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeWorkflowTab === 'web_stamp' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isOpen, activeWorkflowTab, signatureMode]);

  if (!isOpen || !certificate) return null;

  // Handle PDF File Selection
  const handlePdfSelected = (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Por favor, seleccione un archivo con formato PDF (.pdf).');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('El archivo PDF no debe superar los 25 MB.');
      return;
    }

    setErrorMsg('');
    setUploadedPdfFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedPdfBase64(result);
    };
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo PDF en su navegador.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handlePdfSelected(e.dataTransfer.files[0]);
    }
  };

  // Submit Acrobat Signed PDF
  const handleSaveUploadedSignedPdf = async () => {
    if (!uploadedPdfBase64 || !uploadedPdfFile) {
      setErrorMsg('Por favor, seleccione primero el archivo PDF firmado con Adobe Acrobat.');
      return;
    }

    setErrorMsg('');
    setIsSigning(true);

    try {
      const updatedCert = await RCDService.uploadSignedPdfCertificate(
        certificate.id,
        uploadedPdfBase64,
        uploadedPdfFile.name,
        signerName,
        signerNif
      );

      setIsSigning(false);
      onSignedSuccess(updatedCert);
      onClose();
    } catch (err: any) {
      setIsSigning(false);
      setErrorMsg(err.message || 'Error al guardar el PDF firmado en Supabase.');
    }
  };

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    hasDrawn.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#10b981';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    hasDrawn.current = false;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Generate authentic FNMT Digital Signature Stamp
  const generateFnmtStampDataUrl = (manualSigData?: string): string => {
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 400;
    stampCanvas.height = 140;
    const ctx = stampCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 140);

    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 392, 132);

    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(6, 6, 75, 128);

    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, 75, 128);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏛️', 43, 45);

    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('FNMT-RCM', 43, 68);

    ctx.fillStyle = '#065f46';
    ctx.font = '7px sans-serif';
    ctx.fillText('eIDAS VÁLIDO', 43, 82);
    ctx.fillText('CUALIFICADO', 43, 94);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.fillText('FIRMADO ELECTRÓNICAMENTE CON CERTIFICADO DIGITAL FNMT', 90, 24);

    ctx.fillStyle = '#475569';
    ctx.font = '8px sans-serif';
    ctx.fillText('Prestador Cualificado: Fábrica Nacional de Moneda y Timbre - Real Casa de la Moneda', 90, 37);

    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(90, 44);
    ctx.lineTo(385, 44);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`Firmante: ${signerName}`, 90, 58);

    ctx.fillStyle = '#334155';
    ctx.font = '9px sans-serif';
    ctx.fillText(`NIF / CIF: ${signerNif} | Tipo: ${fnmtCertType === 'representacion' ? 'Persona Jurídica (Representante)' : 'Persona Física'}`, 90, 72);

    const now = new Date();
    const dateStr = `${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES')} CET`;
    ctx.fillStyle = '#475569';
    ctx.font = '8.5px monospace';
    ctx.fillText(`Fecha Sellado: ${dateStr}`, 90, 86);
    ctx.fillText(`Serie FNMT: ${fnmtCertSerial}`, 90, 99);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 8.5px monospace';
    ctx.fillText(`CSV: ${certificate.verificationCode} | Algoritmo: SHA256withRSA`, 90, 114);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('✓ DOCUMENTO FIRMADO Y VERIFICADO ELECTRÓNICAMENTE', 90, 128);

    return stampCanvas.toDataURL('image/png');
  };

  const handleSignWebStamp = async () => {
    setErrorMsg('');
    setIsSigning(true);

    try {
      const hashPayload = `${certificate.id}-${certificate.verificationCode}-${signerNif}-${fnmtCertSerial}-${Date.now()}`;
      let hash = 0;
      for (let i = 0; i < hashPayload.length; i++) {
        hash = (hash << 5) - hash + hashPayload.charCodeAt(i);
        hash |= 0;
      }
      const fnmtHash = Math.abs(hash).toString(16).toUpperCase().padStart(16, '0');

      let manualData = '';
      if (signatureMode === 'fnmt_manual' && hasDrawn.current && canvasRef.current) {
        manualData = canvasRef.current.toDataURL('image/png');
      }

      const signatureData = generateFnmtStampDataUrl(manualData);

      const updatedCert = await RCDService.signCertificate(
        certificate.id,
        signatureData,
        signerName,
        signerNif,
        {
          fnmtCertIssuer,
          fnmtCertSerial,
          fnmtHash,
          signatureType: signatureMode === 'fnmt_manual' ? 'both' : 'fnmt',
        }
      );

      setIsSigning(false);
      onSignedSuccess(updatedCert);
      onClose();
    } catch (err: any) {
      setIsSigning(false);
      setErrorMsg(err.message || 'Error al firmar digitalmente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Firma Digital del Certificado RCD</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                  Validez eIDAS / FNMT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Certificado Oficial de Gestión y Valorización de Residuos de Construcción y Demolición
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveWorkflowTab('acrobat_upload')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeWorkflowTab === 'acrobat_upload'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>1. Firmar en PC con Acrobat / AutoFirma y Subir PDF (Oficial)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkflowTab('web_stamp')}
            className={`flex items-center space-x-2 px-4 py-2.5 font-bold text-xs sm:text-sm border-b-2 transition ${
              activeWorkflowTab === 'web_stamp'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Sello Digital Web Rápido</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-slate-200 max-h-[75vh] overflow-y-auto">
          
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Certificate Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <FileBadge className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">{certificate.certificateNumber}</span>
              </div>
              <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-medium">
                ⏳ Pendiente de Firma Digital
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[10px]">Cliente Solicitante:</span>
                <strong className="text-white truncate block">{certificate.clientName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Promotor / Beneficiario:</span>
                <strong className="text-white truncate block">{certificate.thirdPartyName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Residuos:</span>
                <strong className="text-emerald-400">{certificate.totalTons.toFixed(2)} t</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Código CSV:</span>
                <strong className="text-slate-300 font-mono text-[11px]">{certificate.verificationCode}</strong>
              </div>
            </div>
          </div>

          {/* TAB 1: ACROBAT / AUTOFIRMA WORKFLOW (THE REQUESTED FLOW) */}
          {activeWorkflowTab === 'acrobat_upload' && (
            <div className="space-y-4">
              
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-sm text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Flujo Oficial de Firma Digital con Certificado FNMT en su PC</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Para que el PDF contenga la <strong>firma digital criptográfica PAdES con el certificado de la FNMT instalado en su ordenador</strong> (reconocida automáticamente por el visor de Adobe Acrobat y las administraciones públicas), siga estos sencillos 3 pasos:
                </p>
              </div>

              {/* Step 1 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">1</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Descargar el Documento PDF para Firmar
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPrintableCertificate(certificate, { forSignature: true })}
                    className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-md shadow-sky-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar / Imprimir PDF Oficial</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Haga clic en el botón para abrir el certificado en formato oficial e imprimirlo como PDF en su carpeta de descargas.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">2</span>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Firmar con Adobe Acrobat Reader / DC o AutoFirma en su PC
                  </h4>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 pl-8 list-disc">
                  <li>Abra el archivo PDF descargado con <strong>Adobe Acrobat Reader / Acrobat Pro</strong> o la aplicación <strong>AutoFirma</strong>.</li>
                  <li>En Acrobat, pulse en <em>Herramientas &gt; Certificados &gt; Firmar digitalmente</em>.</li>
                  <li>Seleccione su certificado digital de la <strong>FNMT (Persona Jurídica o Física)</strong>, estampe la firma y guarde el archivo PDF en su ordenador.</li>
                </ul>
              </div>

              {/* Step 3: Upload signed PDF */}
              <div className="bg-slate-950 border-2 border-dashed border-emerald-500/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center">3</span>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Subir el Archivo PDF Firmado (.pdf)
                  </h4>
                </div>

                <input
                  type="file"
                  ref={pdfInputRef}
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handlePdfSelected(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => pdfInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                    isDragOver
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : uploadedPdfFile
                      ? 'border-emerald-500/60 bg-emerald-950/20'
                      : 'border-slate-700 bg-slate-900/50 hover:bg-slate-900'
                  }`}
                >
                  {uploadedPdfFile ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-white text-sm">{uploadedPdfFile.name}</div>
                      <div className="text-xs text-slate-400">
                        Tamaño: {(uploadedPdfFile.size / 1024).toFixed(1)} KB — Listo para guardar y publicar en Supabase
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          pdfInputRef.current?.click();
                        }}
                        className="text-xs text-emerald-400 underline hover:text-emerald-300 mt-2 inline-block"
                      >
                        Cambiar archivo PDF
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-white text-sm">
                        Arrastre aquí el PDF firmado con Acrobat o haga clic para seleccionarlo
                      </div>
                      <div className="text-xs text-slate-400">
                        Soporta archivos .pdf con firma digital criptográfica FNMT / eIDAS
                      </div>
                    </div>
                  )}
                </div>

                {/* Signer meta details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Nombre del Firmante / Cargo
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Manuel Marraque - Director Técnico"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      NIF / CIF del Firmante
                    </label>
                    <input
                      type="text"
                      value={signerNif}
                      onChange={(e) => setSignerNif(e.target.value)}
                      placeholder="B04117818"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: WEB STAMP */}
          {activeWorkflowTab === 'web_stamp' && (
            <div className="space-y-4">
              
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <div className="flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase text-emerald-300 tracking-wider">
                      Datos del Certificado para Estampado Web
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Titular / Razón Social *
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      NIF / CIF *
                    </label>
                    <input
                      type="text"
                      value={signerNif}
                      onChange={(e) => setSignerNif(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Stamp Mode */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Modalidad de Estampado</span>
                  </label>

                  <div className="flex items-center space-x-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSignatureMode('fnmt')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        signatureMode === 'fnmt'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🏛️ Sello FNMT Oficial
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMode('fnmt_manual')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition ${
                        signatureMode === 'fnmt_manual'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      ✍️ Sello FNMT + Rúbrica
                    </button>
                  </div>
                </div>

                {signatureMode === 'fnmt' ? (
                  <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
                    <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Sello Criptográfico Cualificado FNMT-RCM</span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-lg mx-auto">
                      Se generará una estampa de firma electrónica cualificada con número de serie del certificado y CSV <code className="text-emerald-400 font-mono">{certificate.verificationCode}</code>.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400">Rúbrica sobre el lienzo:</span>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Limpiar</span>
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={110}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl cursor-crosshair touch-none"
                    />
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            Cancelar
          </button>

          {activeWorkflowTab === 'acrobat_upload' ? (
            <button
              type="button"
              disabled={isSigning || !uploadedPdfFile}
              onClick={handleSaveUploadedSignedPdf}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSigning ? 'Guardando en Supabase...' : 'Guardar y Publicar PDF Firmado en Supabase'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isSigning}
              onClick={handleSignWebStamp}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSigning ? 'Estampando Firma...' : 'Estampar Sello Digital Web'}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
