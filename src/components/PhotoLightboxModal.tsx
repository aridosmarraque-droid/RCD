import React from 'react';
import { X, Calendar, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { Albaran } from '@/types/rcd';

interface PhotoLightboxModalProps {
  albaran: Albaran | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ albaran, onClose }) => {
  if (!albaran) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-emerald-400 text-sm">{albaran.numAlbaran}</span>
              <span className="text-slate-500">•</span>
              <span className="text-white font-bold text-sm">{albaran.clientName}</span>
            </div>
            <p className="text-xs text-slate-400">
              Trazabilidad Fotográfica de Entrada en Planta | Fecha: {albaran.date} {albaran.time}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Both Photos */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Photo 1: Truck */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center space-x-1 text-emerald-400">
                  <Truck className="w-4 h-4" />
                  <span>Foto 1: Camión (Matrícula {albaran.licensePlate})</span>
                </span>
                <span className="text-[11px] text-slate-500">Báscula #1</span>
              </div>

              {albaran.truckPhotoUrl ? (
                <img
                  src={albaran.truckPhotoUrl}
                  alt="Foto Camión"
                  className="w-full h-64 object-cover rounded-lg border border-slate-800"
                />
              ) : (
                <div className="w-full h-64 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">
                  Sin foto de camión
                </div>
              )}
            </div>

            {/* Photo 2: Unload */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center space-x-1 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Foto 2: Descarga en Planta</span>
                </span>
                <span className="text-[11px] text-slate-500">{albaran.plantZone}</span>
              </div>

              {albaran.unloadPhotoUrl ? (
                <img
                  src={albaran.unloadPhotoUrl}
                  alt="Foto Descarga"
                  className="w-full h-64 object-cover rounded-lg border border-slate-800"
                />
              ) : (
                <div className="w-full h-64 bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">
                  Sin foto de descarga
                </div>
              )}
            </div>

          </div>

          {/* Ticket Technical Details */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
            <div>
              <span className="text-slate-500 block">Código LER:</span>
              <span className="font-bold text-emerald-400">{albaran.wasteTypeCode}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Tipo Residuo:</span>
              <span className="font-semibold text-white">{albaran.wasteTypeName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Cantidad Netas:</span>
              <span className="font-extrabold text-white text-sm">{albaran.quantityTons.toFixed(2)} t</span>
            </div>
            <div>
              <span className="text-slate-500 block">Estado Certificado:</span>
              {albaran.certified ? (
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">
                  🔒 Certificado ({albaran.certificateNumber})
                </span>
              ) : (
                <span className="text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20 inline-block">
                  🟢 Disponible
                </span>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
