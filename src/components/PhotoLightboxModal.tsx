import React, { useState, useRef } from 'react';
import {
  X,
  Calendar,
  Truck,
  CheckCircle2,
  FileText,
  Upload,
  Camera,
  RefreshCw,
  Trash2,
  ZoomIn,
  AlertCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Albaran } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';
import { compressImage } from '../utils/imageCompressor';
import { watermarkTruckPhoto } from '../utils/photoWatermark';

interface PhotoLightboxModalProps {
  albaran: Albaran | null;
  onClose: () => void;
  onAlbaranUpdated?: (updated: Albaran) => void;
  isAdmin?: boolean;
}

type PhotoType = 'albaran' | 'truck' | 'unload';

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  albaran: initialAlbaran,
  onClose,
  onAlbaranUpdated,
  isAdmin = true,
}) => {
  if (!initialAlbaran) return null;

  const [currentAlbaran, setCurrentAlbaran] = useState<Albaran>(initialAlbaran);
  const [processingType, setProcessingType] = useState<PhotoType | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ url: string; title: string } | null>(null);

  // Hidden file inputs for each photo slot
  const albaranInputRef = useRef<HTMLInputElement | null>(null);
  const truckInputRef = useRef<HTMLInputElement | null>(null);
  const unloadInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingType(photoType);
    setStatusMessage(null);

    try {
      // 1. Optimizar y comprimir la imagen inmediatamente a 1200px max y calidad 0.78
      // Reduce fotos pesadas de móviles (3-10MB) a ~100-150KB sin perder legibilidad ni nitidez
      const compressedDataUrl = await compressImage(file, {
        maxDimension: 1200,
        quality: 0.78,
      });

      let finalPhotoUrl = compressedDataUrl;

      // 2. Para foto de camión o de descarga, estampar la marca de agua reglamentaria si no la trae
      if (photoType === 'truck') {
        try {
          finalPhotoUrl = await watermarkTruckPhoto(compressedDataUrl, {
            title: 'REGISTRO CAMIÓN - PLANTA RCD',
            licensePlate: currentAlbaran.licensePlate,
            plantZone: currentAlbaran.plantZone || 'Báscula #1',
            dateStr: currentAlbaran.date,
            timeStr: currentAlbaran.time,
          });
        } catch (wErr) {
          console.warn('Fallback sin marca de agua:', wErr);
        }
      } else if (photoType === 'unload') {
        try {
          finalPhotoUrl = await watermarkTruckPhoto(compressedDataUrl, {
            title: 'DESCARGA EN PLANTA RCD',
            licensePlate: currentAlbaran.licensePlate,
            plantZone: currentAlbaran.plantZone || 'Fosa de Triaje',
            dateStr: currentAlbaran.date,
            timeStr: currentAlbaran.time,
          });
        } catch (wErr) {
          console.warn('Fallback sin marca de agua:', wErr);
        }
      }

      // 3. Guardar en el almacenamiento del sistema
      const updates: Partial<Albaran> = {};
      if (photoType === 'albaran') updates.albaranPhotoUrl = finalPhotoUrl;
      if (photoType === 'truck') updates.truckPhotoUrl = finalPhotoUrl;
      if (photoType === 'unload') updates.unloadPhotoUrl = finalPhotoUrl;

      const updated = await RCDService.updateAlbaranPhotos(currentAlbaran.id, updates);
      setCurrentAlbaran(updated);
      if (onAlbaranUpdated) {
        onAlbaranUpdated(updated);
      }

      const approxSizeKb = Math.round((finalPhotoUrl.length * 0.75) / 1024);
      setStatusMessage({
        type: 'success',
        text: `Foto ${photoType === 'albaran' ? 'del albarán SAP' : photoType === 'truck' ? 'del camión' : 'de la descarga'} guardada con éxito (Optimizada a ~${approxSizeKb} KB).`,
      });
    } catch (err: any) {
      console.error('Error al procesar foto:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al procesar y comprimir la imagen.',
      });
    } finally {
      setProcessingType(null);
      // Reset input value so same file can be chosen again if needed
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoType: PhotoType) => {
    const label = photoType === 'albaran' ? 'del albarán SAP' : photoType === 'truck' ? 'del camión' : 'de la descarga';
    if (!window.confirm(`¿Seguro que deseas eliminar la foto ${label}? Podrás subir una nueva cuando lo requieras.`)) {
      return;
    }

    setProcessingType(photoType);
    try {
      const updates: Partial<Albaran> = {};
      if (photoType === 'albaran') updates.albaranPhotoUrl = '';
      if (photoType === 'truck') updates.truckPhotoUrl = '';
      if (photoType === 'unload') updates.unloadPhotoUrl = '';

      const updated = await RCDService.updateAlbaranPhotos(currentAlbaran.id, updates);
      setCurrentAlbaran(updated);
      if (onAlbaranUpdated) {
        onAlbaranUpdated(updated);
      }

      setStatusMessage({
        type: 'success',
        text: `Foto ${label} eliminada. Ahora puedes subir una nueva captura.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al eliminar la foto.',
      });
    } finally {
      setProcessingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Hidden File Inputs */}
      <input
        ref={albaranInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e, 'albaran')}
      />
      <input
        ref={truckInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e, 'truck')}
      />
      <input
        ref={unloadInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e, 'unload')}
      />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-black text-emerald-400 text-base">
                  Albarán Nº {currentAlbaran.numAlbaran}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-white font-bold text-sm truncate max-w-[200px] sm:max-w-md">
                  {currentAlbaran.clientName}
                </span>
                {isAdmin && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30 ml-2 hidden sm:inline-block">
                    Gestión Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Evidencia fotográfica en planta | {currentAlbaran.date} {currentAlbaran.time} | Matrícula: <strong className="text-amber-300 font-mono">{currentAlbaran.licensePlate}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
            title="Cerrar visor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`px-5 py-2.5 text-xs flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-bold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Body with 3 Photo Cards */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* PHOTO 1: ALBARÁN PAPEL SAP */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4" />
                    <span>1. Albarán SAP en Papel</span>
                  </span>
                  {currentAlbaran.albaranPhotoUrl ? (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Capturado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Pendiente
                    </span>
                  )}
                </div>

                {currentAlbaran.albaranPhotoUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-[4/3]">
                    <img
                      src={currentAlbaran.albaranPhotoUrl}
                      alt="Albarán SAP Papel"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2 p-2">
                      <button
                        onClick={() =>
                          setZoomedPhoto({
                            url: currentAlbaran.albaranPhotoUrl!,
                            title: `Albarán SAP Papel - Nº ${currentAlbaran.numAlbaran}`,
                          })
                        }
                        className="bg-slate-900/90 text-white p-2 rounded-lg hover:bg-emerald-600 transition flex items-center space-x-1 text-xs font-bold"
                      >
                        <ZoomIn className="w-4 h-4" />
                        <span>Ampliar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 aspect-[4/3] flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-400">
                      No se capturó foto del albarán de papel en báscula
                    </span>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={processingType === 'albaran'}
                    onClick={() => albaranInputRef.current?.click()}
                    className="flex-1 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {processingType === 'albaran' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{currentAlbaran.albaranPhotoUrl ? 'Sustituir' : '+ Añadir Foto'}</span>
                  </button>
                  {currentAlbaran.albaranPhotoUrl && (
                    <button
                      type="button"
                      disabled={processingType === 'albaran'}
                      onClick={() => handleDeletePhoto('albaran')}
                      title="Eliminar foto de albarán"
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PHOTO 2: CAMIÓN EN BÁSCULA */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                    <Truck className="w-4 h-4" />
                    <span>2. Camión en Báscula</span>
                  </span>
                  {currentAlbaran.truckPhotoUrl ? (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Capturado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Pendiente
                    </span>
                  )}
                </div>

                {currentAlbaran.truckPhotoUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-[4/3]">
                    <img
                      src={currentAlbaran.truckPhotoUrl}
                      alt="Foto Camión"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2 p-2">
                      <button
                        onClick={() =>
                          setZoomedPhoto({
                            url: currentAlbaran.truckPhotoUrl!,
                            title: `Camión - Matrícula ${currentAlbaran.licensePlate}`,
                          })
                        }
                        className="bg-slate-900/90 text-white p-2 rounded-lg hover:bg-emerald-600 transition flex items-center space-x-1 text-xs font-bold"
                      >
                        <ZoomIn className="w-4 h-4" />
                        <span>Ampliar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 aspect-[4/3] flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <Truck className="w-8 h-8 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-400">
                      Foto no capturada en báscula
                    </span>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={processingType === 'truck'}
                    onClick={() => truckInputRef.current?.click()}
                    className="flex-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {processingType === 'truck' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{currentAlbaran.truckPhotoUrl ? 'Sustituir' : '+ Añadir Foto'}</span>
                  </button>
                  {currentAlbaran.truckPhotoUrl && (
                    <button
                      type="button"
                      disabled={processingType === 'truck'}
                      onClick={() => handleDeletePhoto('truck')}
                      title="Eliminar foto de camión"
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PHOTO 3: DESCARGA EN PLANTA */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>3. Descarga en Planta</span>
                  </span>
                  {currentAlbaran.unloadPhotoUrl ? (
                    <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Capturado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                      Pendiente
                    </span>
                  )}
                </div>

                {currentAlbaran.unloadPhotoUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-[4/3]">
                    <img
                      src={currentAlbaran.unloadPhotoUrl}
                      alt="Foto Descarga"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2 p-2">
                      <button
                        onClick={() =>
                          setZoomedPhoto({
                            url: currentAlbaran.unloadPhotoUrl!,
                            title: `Descarga en ${currentAlbaran.plantZone || 'Planta RCD'}`,
                          })
                        }
                        className="bg-slate-900/90 text-white p-2 rounded-lg hover:bg-emerald-600 transition flex items-center space-x-1 text-xs font-bold"
                      >
                        <ZoomIn className="w-4 h-4" />
                        <span>Ampliar</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 aspect-[4/3] flex flex-col items-center justify-center p-4 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-400">
                      Foto no capturada en el momento de la descarga
                    </span>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={processingType === 'unload'}
                    onClick={() => unloadInputRef.current?.click()}
                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {processingType === 'unload' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{currentAlbaran.unloadPhotoUrl ? 'Sustituir' : '+ Añadir Foto'}</span>
                  </button>
                  {currentAlbaran.unloadPhotoUrl && (
                    <button
                      type="button"
                      disabled={processingType === 'unload'}
                      onClick={() => handleDeletePhoto('unload')}
                      title="Eliminar foto de descarga"
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Ticket Technical Details Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
            <div>
              <span className="text-slate-500 block text-[11px]">Código LER:</span>
              <span className="font-mono font-bold text-emerald-400">{currentAlbaran.wasteTypeCode}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Residuo RCD:</span>
              <span className="font-semibold text-white truncate block">{currentAlbaran.wasteTypeName}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Peso Neto (Toneladas):</span>
              <span className="font-extrabold text-white text-sm">{currentAlbaran.quantityTons.toFixed(2)} t</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Zona de Planta:</span>
              <span className="font-medium text-slate-300 truncate block">{currentAlbaran.plantZone || 'Fosa General'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Compresión inteligente activa (~120KB por imagen para ahorro de memoria)</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Fullscreen Zoom Lightbox */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <div className="w-full max-w-4xl flex items-center justify-between text-white text-sm font-bold mb-3">
            <span>{zoomedPhoto.title}</span>
            <button
              onClick={() => setZoomedPhoto(null)}
              className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={zoomedPhoto.url}
            alt={zoomedPhoto.title}
            className="max-h-[85vh] max-w-full object-contain rounded-xl border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
