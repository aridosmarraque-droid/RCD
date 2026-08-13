import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, X, Check, FileSignature, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import { Certificate } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

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
  const [signerName, setSignerName] = useState('Manuel Marraque - Director Técnico');
  const [signerNif, setSignerNif] = useState('B-91029384');
  const [useOfficialStamp, setUseOfficialStamp] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isOpen]);

  if (!isOpen || !certificate) return null;

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
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const generateOfficialStampDataUrl = (): string => {
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 300;
    stampCanvas.height = 100;
    const ctx = stampCanvas.getContext('2d');
    if (!ctx) return '';

    // Draw Stamp Frame
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 300, 100);

    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 288, 88);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLANTA DE VALORIZACIÓN Y RECICLAJE RCD', 150, 26);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('FIRMA Y SELLO DIGITAL AUTORIZADO', 150, 44);

    ctx.fillStyle = '#047857';
    ctx.font = 'italic 10px sans-serif';
    ctx.fillText(`${signerName}`, 150, 62);

    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.fillText(`NIF: ${signerNif} | Ref: ${certificate.verificationCode}`, 150, 80);

    return stampCanvas.toDataURL('image/png');
  };

  const handleSign = async () => {
    setErrorMsg('');
    setIsSigning(true);

    try {
      let signatureData = '';
      if (useOfficialStamp) {
        signatureData = generateOfficialStampDataUrl();
      } else if (hasDrawn.current && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL('image/png');
      } else {
        signatureData = generateOfficialStampDataUrl();
      }

      const updatedCert = await RCDService.signCertificate(
        certificate.id,
        signatureData,
        signerName,
        signerNif
      );

      setIsSigning(false);
      onSignedSuccess(updatedCert);
      onClose();
    } catch (err: any) {
      setIsSigning(false);
      setErrorMsg(err.message || 'Error al firmar digitalmente el certificado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Firma Digital de Certificado RCD</h3>
              <p className="text-xs text-slate-400">
                Aprobación oficial del certificado solicitado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-slate-200">
          
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Certificate Summary Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-emerald-400">{certificate.certificateNumber}</span>
              <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium">
                ⏳ Pendiente de Firma Digital
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-slate-400 block text-[11px]">Cliente:</span>
                <strong className="text-white">{certificate.clientName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Obra / Promotor:</span>
                <strong className="text-white">{certificate.thirdPartyName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Residuos Certificados:</span>
                <strong className="text-emerald-400">{certificate.totalTons.toFixed(2)} Toneladas</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Código Verificación:</span>
                <strong className="text-slate-300 font-mono text-[11px]">{certificate.verificationCode}</strong>
              </div>
            </div>
          </div>

          {/* Signer Details Form */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-300 tracking-wider">
              Datos del Responsable de Firma Autorizado
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nombre y Cargo del Firmante *
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  NIF / CIF de la Empresa *
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

          {/* Signature Mode Selector */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Modalidad de Firma y Sello</span>
              </label>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUseOfficialStamp(true)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    useOfficialStamp
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Sello Oficial Automático
                </button>
                <button
                  type="button"
                  onClick={() => setUseOfficialStamp(false)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    !useOfficialStamp
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Dibujar Firma Manual
                </button>
              </div>
            </div>

            {useOfficialStamp ? (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 text-center space-y-2">
                <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sello y Firma Digital de la Planta de Residuos RCD</span>
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Se generará una firma digital inmutable estampillada con el código CSV de verificación electrónica <code className="text-emerald-400 font-mono">{certificate.verificationCode}</code> y la fecha y hora de la firma.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-400">Dibuje su firma con el ratón o pantalla táctil:</span>
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
                  height={120}
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

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSigning}
            onClick={handleSign}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSigning ? 'Procesando Firma...' : 'Firmar Digitalmente y Notificar al Cliente'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};


