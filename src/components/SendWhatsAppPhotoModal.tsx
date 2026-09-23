import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  ExternalLink,
  Phone,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Check,
  Truck,
  FileText
} from 'lucide-react';
import { Albaran, Client } from '../types/rcd';
import { UltramsgService } from '../services/ultramsgService';
import { RCDService } from '../services/rcdStorage';

interface SendWhatsAppPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  albaran: Albaran | null;
  clients: Client[];
  initialComment?: string;
  onSentSuccess?: () => void;
}

export const SendWhatsAppPhotoModal: React.FC<SendWhatsAppPhotoModalProps> = ({
  isOpen,
  onClose,
  albaran,
  clients,
  initialComment = '',
  onSentSuccess,
}) => {
  if (!isOpen || !albaran) return null;

  // Selected photo to send (defaults to unload photo)
  const [selectedPhotoType, setSelectedPhotoType] = useState<'unload' | 'truck' | 'albaran'>('unload');
  
  // Phone number state
  const [toPhone, setToPhone] = useState('');
  
  // Comment / message state
  const [comment, setComment] = useState('');
  
  // Status and UI state
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedPhoto, setCopiedPhoto] = useState(false);

  // Initialize recipient phone and default text whenever the modal opens or albaran changes
  useEffect(() => {
    if (!albaran) return;

    // 1. Look for matching client phone
    const client = clients.find(
      (c) => c.id === albaran.clientId || c.name.toLowerCase() === albaran.clientName.toLowerCase()
    );
    const clientPhone = client?.mobile || '';
    setToPhone(clientPhone);

    // 2. Determine best photo and ensure photos exist
    if (albaran.unloadPhotoUrl) {
      setSelectedPhotoType('unload');
    } else if (albaran.truckPhotoUrl) {
      setSelectedPhotoType('truck');
    } else if (albaran.albaranPhotoUrl) {
      setSelectedPhotoType('albaran');
    } else {
      // Si no tiene fotos cargadas en memoria, intentar cargarlas bajo demanda
      RCDService.ensureAlbaranPhotos(albaran).then((updated) => {
        if (updated.unloadPhotoUrl) {
          setSelectedPhotoType('unload');
        } else if (updated.truckPhotoUrl) {
          setSelectedPhotoType('truck');
        } else if (updated.albaranPhotoUrl) {
          setSelectedPhotoType('albaran');
        }
      });
    }

    // 3. Set default text
    if (initialComment) {
      setComment(initialComment);
    } else {
      setComment(
        `Hola, le contactamos desde Planta RCD EcoMarraque en relación al Albarán Nº ${albaran.numAlbaran}.\n` +
        `Matrícula: ${albaran.licensePlate} | Fecha: ${albaran.date} ${albaran.time || ''}\n` +
        `Residuo declarado: ${albaran.wasteTypeName} (${albaran.quantityTons.toFixed(2)} t).\n\n` +
        `Adjuntamos la fotografía de la descarga en foso para su verificación.`
      );
    }

    setStatusMessage(null);
    setCopiedPhoto(false);
  }, [albaran, clients, initialComment]);

  const activePhotoUrl =
    selectedPhotoType === 'unload'
      ? albaran.unloadPhotoUrl
      : selectedPhotoType === 'truck'
      ? albaran.truckPhotoUrl
      : albaran.albaranPhotoUrl;

  const isUltramsgConfigured = UltramsgService.isConfigured();

  // Quick message templates
  const applyTemplate = (type: 'discrepancy' | 'impurities' | 'ok') => {
    if (!albaran) return;
    if (type === 'discrepancy') {
      setComment(
        `⚠️ *AVISO DE DISCREPANCIA EN DESCARGA - PLANTA RCD*\n` +
        `Albarán SAP: ${albaran.numAlbaran} | Matrícula: ${albaran.licensePlate}\n` +
        `Cliente: ${albaran.clientName}\n` +
        `Residuo declarado en albarán: ${albaran.wasteTypeName} (${albaran.wasteTypeCode})\n\n` +
        `*Incidencia detectada:* En la fotografía de la descarga adjunta se observa un residuo que no corresponde con el LER declarado. Por favor, revisen la clasificación.`
      );
    } else if (type === 'impurities') {
      setComment(
        `🚫 *AVISO DE RESIDUOS IMPROPIOS / NO ADMISIBLES*\n` +
        `Albarán: ${albaran.numAlbaran} | Matrícula: ${albaran.licensePlate} (${albaran.date})\n` +
        `Cliente: ${albaran.clientName}\n\n` +
        `Se ha detectado presencia de impropios (plásticos, maderas, voluminosos o material no autorizado) durante la descarga del camión. Adjuntamos imagen gráfica de comprobación.`
      );
    } else if (type === 'ok') {
      setComment(
        `✓ *JUSTIFICANTE DE DESCARGA RCD*\n` +
        `Albarán Nº: ${albaran.numAlbaran} | Fecha: ${albaran.date} ${albaran.time || ''}\n` +
        `Matrícula: ${albaran.licensePlate} | Peso Neto: ${albaran.quantityTons.toFixed(2)} t\n` +
        `Residuo: ${albaran.wasteTypeName}\n\n` +
        `Se adjunta fotografía de la descarga en las instalaciones de Planta RCD EcoMarraque.`
      );
    }
  };

  // 1. Send via Ultramsg API
  const handleSendViaApi = async () => {
    if (!toPhone.trim()) {
      setStatusMessage({ type: 'error', text: 'Indique un número de teléfono de destino.' });
      return;
    }

    if (!activePhotoUrl) {
      setStatusMessage({ type: 'error', text: 'No hay ninguna fotografía disponible para enviar.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const res = await UltramsgService.sendWhatsAppImage(
        toPhone.trim(),
        activePhotoUrl,
        comment.trim()
      );

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `✓ Fotografía y mensaje enviados con éxito al ${toPhone} vía WhatsApp.`,
        });
        if (onSentSuccess) onSentSuccess();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'No se pudo enviar el WhatsApp. Verifique la configuración de Ultramsg.',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Error inesperado al enviar el WhatsApp.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // 2. Open WhatsApp Web / App
  const handleOpenWhatsAppWeb = () => {
    if (!toPhone.trim()) {
      setStatusMessage({ type: 'error', text: 'Indique un número de teléfono de destino.' });
      return;
    }

    const url = UltramsgService.getWhatsAppWebUrl(toPhone.trim(), comment.trim());
    window.open(url, '_blank');
  };

  // 3. Copy image to clipboard
  const handleCopyImage = async () => {
    if (!activePhotoUrl) return;
    try {
      // If it's a data url or blob url, fetch and copy
      const response = await fetch(activePhotoUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedPhoto(true);
      setTimeout(() => setCopiedPhoto(false), 3000);
    } catch {
      // Fallback: create temporary download link
      const link = document.createElement('a');
      link.href = activePhotoUrl;
      link.download = `Descarga_${albaran.numAlbaran}_${albaran.licensePlate}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setCopiedPhoto(true);
      setTimeout(() => setCopiedPhoto(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                <span>Enviar Foto de Descarga por WhatsApp</span>
              </h3>
              <p className="text-xs text-slate-400">
                Albarán <span className="text-emerald-400 font-mono font-bold">{albaran.numAlbaran}</span> •{' '}
                {albaran.clientName} ({albaran.licensePlate})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Operation Context Pill */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Nº Albarán SAP</span>
            <span className="font-mono font-bold text-white text-xs">{albaran.numAlbaran}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Fecha / Hora</span>
            <span className="text-slate-200 text-xs">{albaran.date} {albaran.time || ''}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Matrícula</span>
            <span className="font-mono font-bold text-amber-400 text-xs">{albaran.licensePlate}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Residuo LER</span>
            <span className="text-emerald-400 font-bold truncate block text-xs" title={albaran.wasteTypeName}>
              {albaran.wasteTypeCode} - {albaran.quantityTons.toFixed(2)} t
            </span>
          </div>
        </div>

        {/* Photo Selection Tabs & Visual Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fotografía a Enviar:</span>
            </span>

            {/* Photo selector buttons */}
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedPhotoType('unload')}
                className={`px-2 py-1 rounded font-bold transition flex items-center space-x-1 ${
                  selectedPhotoType === 'unload'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Descarga</span>
                {albaran.unloadPhotoUrl && <Check className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhotoType('truck')}
                className={`px-2 py-1 rounded font-bold transition flex items-center space-x-1 ${
                  selectedPhotoType === 'truck'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Camión</span>
                {albaran.truckPhotoUrl && <Check className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhotoType('albaran')}
                className={`px-2 py-1 rounded font-bold transition flex items-center space-x-1 ${
                  selectedPhotoType === 'albaran'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Albarán</span>
                {albaran.albaranPhotoUrl && <Check className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Image Display Frame */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden h-44 sm:h-52 flex items-center justify-center">
            {activePhotoUrl ? (
              <>
                <img
                  src={activePhotoUrl}
                  alt="Fotografía de la descarga"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 right-2 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    className="bg-slate-900/80 hover:bg-slate-800 text-white p-1.5 rounded-lg border border-slate-700 text-xs backdrop-blur-sm transition flex items-center space-x-1 shadow"
                    title="Copiar imagen al portapapeles o descargar"
                  >
                    {copiedPhoto ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-300">¡Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span className="text-[10px]">Copiar Foto</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700">
                  Foto {selectedPhotoType === 'unload' ? 'de Descarga en Foso' : selectedPhotoType === 'truck' ? 'del Camión' : 'del Albarán'}
                </div>
              </>
            ) : (
              <div className="text-center p-4 text-slate-500">
                <AlertTriangle className="w-8 h-8 text-amber-500/60 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-400">
                  No hay foto de {selectedPhotoType === 'unload' ? 'descarga' : selectedPhotoType === 'truck' ? 'camión' : 'albarán'} registrada en este viaje.
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Seleccione otra de las pestañas superiores si dispone de foto de camión o albarán.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recipient Phone Input */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Número de Teléfono / WhatsApp de Destino:</span>
            </span>
            <span className="text-[11px] text-slate-500 font-normal">
              Formato: +34 600 000 000 ó 600000000
            </span>
          </label>
          <div className="relative">
            <input
              type="tel"
              value={toPhone}
              onChange={(e) => setToPhone(e.target.value)}
              placeholder="ej: 612345678 o +34 612 345 678"
              className="w-full bg-slate-950 text-white text-xs pl-3 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Comment / Observation Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Comentario u Observación a adjuntar con la foto:
            </label>
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-500">Plantillas rápidas:</span>
              <button
                type="button"
                onClick={() => applyTemplate('discrepancy')}
                className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 transition"
              >
                Discrepancia
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('impurities')}
                className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 transition"
              >
                Impropios
              </button>
              <button
                type="button"
                onClick={() => applyTemplate('ok')}
                className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 transition"
              >
                Estándar
              </button>
            </div>
          </div>

          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escriba aquí el comentario o aclaración que acompañará a la fotografía..."
            className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isUltramsgConfigured ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>
              {isUltramsgConfigured
                ? 'API Ultramsg conectada (envío automático directo)'
                : 'API Ultramsg no configurada (se usará WhatsApp Web)'}
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2 rounded-xl text-xs transition"
            >
              Cerrar
            </button>

            {/* Direct WhatsApp Web Button */}
            <button
              type="button"
              onClick={handleOpenWhatsAppWeb}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow"
              title="Abrir chat en WhatsApp Web con el texto preconfigurado"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir WhatsApp Web</span>
            </button>

            {/* Ultramsg Send Image API Button */}
            {isUltramsgConfigured && (
              <button
                type="button"
                disabled={isSending || !toPhone.trim() || !activePhotoUrl}
                onClick={handleSendViaApi}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSending ? 'Enviando...' : 'Enviar Foto por API'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
