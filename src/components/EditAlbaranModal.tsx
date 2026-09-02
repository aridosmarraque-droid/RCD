import React, { useState } from 'react';
import {
  FileText,
  X,
  Save,
  AlertCircle,
  Truck,
  Building2,
  Calendar,
  Clock,
  Scale,
  Lock,
  Layers
} from 'lucide-react';
import { Albaran, Client, WasteType } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface EditAlbaranModalProps {
  albaran: Albaran;
  clients: Client[];
  wasteTypes: WasteType[];
  onClose: () => void;
  onSaved: (updated: Albaran) => void;
}

export const EditAlbaranModal: React.FC<EditAlbaranModalProps> = ({
  albaran,
  clients,
  wasteTypes,
  onClose,
  onSaved,
}) => {
  const isLocked = Boolean(albaran.certified);

  const [numAlbaran, setNumAlbaran] = useState(albaran.numAlbaran);
  const [selectedClientId, setSelectedClientId] = useState(albaran.clientId || '');
  const [clientName, setClientName] = useState(albaran.clientName);
  const [clientCode, setClientCode] = useState(albaran.clientCode);
  const [wasteTypeCode, setWasteTypeCode] = useState(albaran.wasteTypeCode);
  const [wasteTypeName, setWasteTypeName] = useState(albaran.wasteTypeName);
  const [quantityTons, setQuantityTons] = useState<number>(albaran.quantityTons);
  const [licensePlate, setLicensePlate] = useState(albaran.licensePlate);
  const [date, setDate] = useState(albaran.date);
  const [time, setTime] = useState(albaran.time || '');
  const [plantZone, setPlantZone] = useState(albaran.plantZone || 'Muelle A - Fosa de Triaje RCD');
  const [driverName, setDriverName] = useState(albaran.driverName || '');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = clients.find((c) => c.id === clientId);
    if (found) {
      setClientName(found.name);
      setClientCode(found.code);
    }
  };

  const handleWasteTypeSelect = (code: string) => {
    setWasteTypeCode(code);
    const found = wasteTypes.find((w) => w.code === code);
    if (found) {
      setWasteTypeName(found.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isLocked) {
      setErrorMsg('Este albarán ya está adjunto al certificado ' + (albaran.certificateNumber || '') + ' y no puede modificarse.');
      return;
    }

    if (!numAlbaran.trim()) {
      setErrorMsg('El número de albarán es obligatorio.');
      return;
    }

    if (!clientName.trim()) {
      setErrorMsg('El nombre de cliente es obligatorio.');
      return;
    }

    if (isNaN(quantityTons) || quantityTons <= 0) {
      setErrorMsg('La cantidad en toneladas debe ser mayor que 0.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await RCDService.updateAlbaran(albaran.id, {
        numAlbaran: numAlbaran.trim().toUpperCase(),
        clientId: selectedClientId || albaran.clientId,
        clientName: clientName.trim(),
        clientCode: clientCode.trim(),
        wasteTypeCode: wasteTypeCode.trim(),
        wasteTypeName: wasteTypeName.trim(),
        quantityTons: Number(quantityTons),
        licensePlate: licensePlate.trim().toUpperCase(),
        date,
        time,
        plantZone,
        driverName: driverName.trim(),
      });

      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error('Error updating albaran:', err);
      setErrorMsg(err.message || 'Error al actualizar el albarán.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="bg-slate-950 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-xl border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white">
                  Editar Albarán Nº {albaran.numAlbaran}
                </h3>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/30">
                  Solo Administrador
                </span>
              </div>
              <p className="text-xs text-slate-400">Modificación oficial de pesaje y datos de entrada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lock Warning if Certified */}
        {isLocked && (
          <div className="bg-rose-950/40 border-b border-rose-500/30 p-4 text-rose-200 text-xs flex items-start space-x-3">
            <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white text-sm">Albarán Bloqueado e Inalterable</div>
              <p className="text-slate-300 mt-0.5 leading-relaxed">
                Este albarán ya fue incluido y cerrado dentro del Certificado Oficial{' '}
                <strong className="text-rose-300 font-mono">{albaran.certificateNumber}</strong>. Por normativa de trazabilidad y seguridad jurídica, los albaranes certificados no pueden ser editados.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Num Albaran */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nº de Albarán *
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={numAlbaran}
                onChange={(e) => setNumAlbaran(e.target.value)}
                placeholder="ej: 2607873"
                className="w-full bg-slate-950 text-white font-mono font-bold text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Matrícula */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Matrícula del Vehículo *
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                placeholder="ej: 1885HGF/R0549BDR"
                className="w-full bg-slate-950 text-amber-400 font-mono font-bold text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Client selector & Client Details */}
            <div className="sm:col-span-2 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cliente / Transportista *</span>
                </label>
                <span className="text-[10px] text-slate-400">Seleccione de la lista o modifique a mano</span>
              </div>

              <select
                disabled={isLocked}
                value={selectedClientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 font-medium text-xs border border-slate-700 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">-- Vincular con cliente registrado --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{c.code}] {c.name} ({c.cif})
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <input
                  type="text"
                  disabled={isLocked}
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  placeholder="Cód. Cliente (ej: C0096)"
                  className="col-span-1 bg-slate-900 text-slate-200 font-mono text-xs border border-slate-700 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="text"
                  disabled={isLocked}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Razón Social del Cliente"
                  className="col-span-2 bg-slate-900 text-white font-bold text-xs sm:text-sm border border-slate-700 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Waste Type */}
            <div className="sm:col-span-2 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Tipo de Residuo RCD (Código LER) *</span>
              </label>
              
              <select
                disabled={isLocked}
                value={wasteTypeCode}
                onChange={(e) => handleWasteTypeSelect(e.target.value)}
                className="w-full bg-slate-900 text-slate-200 font-medium text-xs border border-slate-700 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {wasteTypes.map((wt) => (
                  <option key={wt.code} value={wt.code}>
                    LER {wt.code} - {wt.name}
                  </option>
                ))}
                {wasteTypeCode && !wasteTypes.some((w) => w.code === wasteTypeCode) && (
                  <option value={wasteTypeCode}>
                    LER {wasteTypeCode} - {wasteTypeName}
                  </option>
                )}
              </select>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <input
                  type="text"
                  disabled={isLocked}
                  value={wasteTypeCode}
                  onChange={(e) => setWasteTypeCode(e.target.value)}
                  placeholder="LER (ej: 17 09 04)"
                  className="col-span-1 bg-slate-900 text-slate-200 font-mono text-xs border border-slate-700 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="text"
                  disabled={isLocked}
                  value={wasteTypeName}
                  onChange={(e) => setWasteTypeName(e.target.value)}
                  placeholder="Denominación del Residuo"
                  className="col-span-2 bg-slate-900 text-white font-semibold text-xs border border-slate-700 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            {/* Cantidad Toneladas */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cantidad Neta (Toneladas - t) *</span>
              </label>
              <input
                type="number"
                step="0.01"
                disabled={isLocked}
                value={quantityTons}
                onChange={(e) => setQuantityTons(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full bg-slate-950 text-emerald-400 font-extrabold text-base border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Zona de Planta */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Zona de Planta
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={plantZone}
                onChange={(e) => setPlantZone(e.target.value)}
                placeholder="ej: Muelle A - Fosa de Triaje RCD"
                className="w-full bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Fecha y Hora */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Fecha</span>
              </label>
              <input
                type="date"
                disabled={isLocked}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Hora</span>
              </label>
              <input
                type="time"
                disabled={isLocked}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded-xl px-3 py-2 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-xs transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLocked || isSaving}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios de Albarán'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
