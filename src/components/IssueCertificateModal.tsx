import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, FileText, Check, X, Building2, MapPin } from 'lucide-react';
import { Albaran, Certificate, Client } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';
import { openPrintableCertificate } from '../utils/certificatePdf';

interface IssueCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  availableAlbaranes: Albaran[];
  onCertificateCreated: (cert: Certificate) => void;
}

export const IssueCertificateModal: React.FC<IssueCertificateModalProps> = ({
  isOpen,
  onClose,
  client,
  availableAlbaranes,
  onCertificateCreated,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [thirdPartyName, setThirdPartyName] = useState('Promociones e Inmuebles del Sur S.A.');
  const [thirdPartyCif, setThirdPartyCif] = useState('A-28901234');
  const [constructionSiteName, setConstructionSiteName] = useState('Residencial Vista Verde - 32 Viviendas');
  const [constructionSiteAddress, setConstructionSiteAddress] = useState('Av. de la Palmera 45, Sevilla');
  const [issuerName, setIssuerName] = useState('Servicios Medioambientales Planta RCD');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Toggle selection of an uncertified albaran
  const toggleSelectAlbaran = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(availableAlbaranes.map((a) => a.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  // Calculate selected metrics
  const selectedAlbaranes = availableAlbaranes.filter((a) => selectedIds.includes(a.id));
  const totalSelectedTons = selectedAlbaranes.reduce((acc, curr) => acc + curr.quantityTons, 0);

  const handleIssue = async () => {
    setErrorMsg('');

    if (selectedIds.length === 0) {
      setErrorMsg('Debe seleccionar al menos un albarán disponible para incluir en el certificado.');
      return;
    }

    if (!thirdPartyName || !thirdPartyCif || !constructionSiteName) {
      setErrorMsg('Por favor complete los datos del Promotor / Tercero beneficiario y la obra.');
      return;
    }

    try {
      const createdCert = await RCDService.issueCertificate({
        clientId: client.id,
        clientName: client.name,
        clientCif: client.cif,
        thirdPartyName: thirdPartyName.trim(),
        thirdPartyCif: thirdPartyCif.trim().toUpperCase(),
        constructionSiteName: constructionSiteName.trim(),
        constructionSiteAddress: constructionSiteAddress.trim(),
        selectedAlbaranIds: selectedIds,
        issuerName: issuerName.trim(),
      });

      onCertificateCreated(createdCert);
      
      // Auto open printable PDF document
      openPrintableCertificate(createdCert);
      
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir el certificado.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Emisión de Certificado RCD a Nombre de Terceros</h3>
              <p className="text-xs text-slate-400">
                Gestión para Promotores, Constructoras o Particulares
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-200">
          
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Promotor / Destinatario final */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center space-x-2 border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>1. Datos del Promotor / Tercero Beneficiario</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre / Razón Social del Promotor *
                </label>
                <input
                  type="text"
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  placeholder="ej. Promociones Inmobiliarias S.A."
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NIF / CIF del Promotor *
                </label>
                <input
                  type="text"
                  value={thirdPartyCif}
                  onChange={(e) => setThirdPartyCif(e.target.value.toUpperCase())}
                  placeholder="ej. A-28901234"
                  className="w-full bg-slate-900 text-white font-mono text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre / Denominación de la Obra *
                </label>
                <input
                  type="text"
                  value={constructionSiteName}
                  onChange={(e) => setConstructionSiteName(e.target.value)}
                  placeholder="ej. Rehabilitación Edificio C/ Sierpes 12"
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dirección de la Obra
                </label>
                <input
                  type="text"
                  value={constructionSiteAddress}
                  onChange={(e) => setConstructionSiteAddress(e.target.value)}
                  placeholder="ej. Av. de la Constitución 12, Sevilla"
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Albaranes Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>2. Seleccionar Albaranes Disponibles para el Certificado</span>
              </h4>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={selectAll}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] underline"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-slate-400 hover:text-white text-[11px] underline"
                >
                  Desmarcar
                </button>
              </div>
            </div>

            {/* Immutability Warning Banner */}
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-200 flex items-start space-x-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-300">Aviso de Regla Inmutable:</strong> Los albaranes que incluya en este certificado quedarán marcados como <span className="text-emerald-400 font-bold">Certificado</span> y no podrán volver a incluirse en ningún otro certificado.
              </div>
            </div>

            {/* Albaranes Selection List */}
            {availableAlbaranes.length === 0 ? (
              <div className="bg-slate-950 p-6 text-center rounded-xl border border-slate-800 text-slate-400 text-xs">
                No hay albaranes disponibles sin certificar para este cliente. Todos los albaranes existentes ya están certificados.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-950 max-h-56 overflow-y-auto">
                {availableAlbaranes.map((alb) => {
                  const isChecked = selectedIds.includes(alb.id);
                  return (
                    <div
                      key={alb.id}
                      onClick={() => toggleSelectAlbaran(alb.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition ${
                        isChecked ? 'bg-emerald-950/30' : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="font-mono font-bold text-xs text-emerald-400">{alb.numAlbaran}</div>
                          <div className="text-[11px] text-slate-300">
                            LER {alb.wasteTypeCode} - {alb.wasteTypeName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Matrícula: {alb.licensePlate} | Fecha: {alb.date}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-extrabold text-sm text-white">
                        {alb.quantityTons.toFixed(2)} t
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection Total Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block">Albaranes Seleccionados:</span>
              <span className="font-bold text-white text-sm">{selectedIds.length} entregas</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Tonelaje Total RCD a Certificar:</span>
              <span className="font-extrabold text-emerald-400 text-lg">{totalSelectedTons.toFixed(2)} Toneladas (t)</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-xs sm:text-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleIssue}
            disabled={selectedIds.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 text-xs sm:text-sm transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Emitir Certificado e Imprimir PDF</span>
          </button>
        </div>

      </div>
    </div>
  );
};
