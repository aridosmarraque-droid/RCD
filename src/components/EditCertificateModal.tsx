import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  AlertTriangle,
  Check,
  X,
  Building2,
  MapPin,
  Trash2,
  Save,
  Search,
  PlusCircle,
  MinusCircle,
  ShieldCheck,
  Printer,
  RotateCcw
} from 'lucide-react';
import { Albaran, Certificate } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';
import { openPrintableCertificate } from '../utils/certificatePdf';

interface EditCertificateModalProps {
  isOpen: boolean;
  certificate: Certificate | null;
  allAlbaranes: Albaran[];
  onClose: () => void;
  onCertificateUpdated: (updatedCert: Certificate) => void;
  onCertificateDeleted?: (certId: string) => void;
}

export const EditCertificateModal: React.FC<EditCertificateModalProps> = ({
  isOpen,
  certificate,
  allAlbaranes,
  onClose,
  onCertificateUpdated,
  onCertificateDeleted,
}) => {
  if (!isOpen || !certificate) return null;

  // Form states for Promotor & Obra
  const [thirdPartyName, setThirdPartyName] = useState(certificate.thirdPartyName || '');
  const [thirdPartyCif, setThirdPartyCif] = useState(certificate.thirdPartyCif || '');
  const [constructionSiteName, setConstructionSiteName] = useState(certificate.constructionSiteName || '');
  const [constructionSiteAddress, setConstructionSiteAddress] = useState(certificate.constructionSiteAddress || '');
  const [issuerName, setIssuerName] = useState(certificate.issuerName || '');

  // Albaranes selection
  const originalIds = useMemo(() => {
    if (!certificate) return [];
    const certAlbaranIds = certificate.albaranIds || [];
    const matchedIds = allAlbaranes
      .filter(
        (a) =>
          certAlbaranIds.includes(a.id) ||
          certAlbaranIds.includes(a.numAlbaran) ||
          a.certificateId === certificate.id ||
          a.certificateNumber === certificate.certificateNumber
      )
      .map((a) => a.id);
    return Array.from(new Set([...certAlbaranIds, ...matchedIds]));
  }, [certificate, allAlbaranes]);

  const [selectedIds, setSelectedIds] = useState<string[]>(originalIds);

  // Search and filter for albaranes list
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'included' | 'available'>('all');

  // Status & error handling
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset local state when certificate changes
  useEffect(() => {
    if (certificate) {
      setThirdPartyName(certificate.thirdPartyName || '');
      setThirdPartyCif(certificate.thirdPartyCif || '');
      setConstructionSiteName(certificate.constructionSiteName || '');
      setConstructionSiteAddress(certificate.constructionSiteAddress || '');
      setIssuerName(certificate.issuerName || '');

      const certAlbaranIds = certificate.albaranIds || [];
      const matched = allAlbaranes
        .filter(
          (a) =>
            certAlbaranIds.includes(a.id) ||
            certAlbaranIds.includes(a.numAlbaran) ||
            a.certificateId === certificate.id ||
            a.certificateNumber === certificate.certificateNumber
        )
        .map((a) => a.id);

      setSelectedIds(matched.length > 0 ? Array.from(new Set(matched)) : certAlbaranIds);
      setErrorMsg('');
      setConfirmDelete(false);
    }
  }, [certificate, allAlbaranes]);

  // Candidates for this certificate:
  // Albaranes that belong to the SAME client AND (are currently in this cert OR not certified)
  const clientCandidateAlbaranes = useMemo(() => {
    return allAlbaranes.filter((alb) => {
      // Must belong to the same client
      const belongsToClient =
        alb.clientId === certificate.clientId ||
        (alb.clientCode && certificate.clientId && alb.clientCode.toLowerCase() === certificate.clientId.toLowerCase()) ||
        alb.clientName.trim().toLowerCase() === certificate.clientName.trim().toLowerCase();

      if (!belongsToClient) return false;

      // Either already in this certificate, or uncertified, or assigned to this cert ID
      const isAlreadyInThisCert =
        originalIds.includes(alb.id) ||
        originalIds.includes(alb.numAlbaran) ||
        alb.certificateId === certificate.id ||
        alb.certificateNumber === certificate.certificateNumber;
      const isAvailable = !alb.certified;

      return isAlreadyInThisCert || isAvailable;
    });
  }, [allAlbaranes, certificate, originalIds]);

  // Filtered albaranes according to search and tab
  const displayedAlbaranes = useMemo(() => {
    return clientCandidateAlbaranes.filter((alb) => {
      const isSelected = selectedIds.includes(alb.id) || selectedIds.includes(alb.numAlbaran);

      if (filterType === 'included' && !isSelected) return false;
      if (filterType === 'available' && isSelected) return false;

      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      return (
        alb.numAlbaran.toLowerCase().includes(q) ||
        (alb.licensePlate && alb.licensePlate.toLowerCase().includes(q)) ||
        alb.wasteTypeCode.toLowerCase().includes(q) ||
        alb.wasteTypeName.toLowerCase().includes(q) ||
        alb.date.includes(q)
      );
    });
  }, [clientCandidateAlbaranes, selectedIds, filterType, searchTerm]);

  // Dynamic calculations
  const selectedAlbaranObjects = useMemo(() => {
    return allAlbaranes.filter((a) => selectedIds.includes(a.id) || selectedIds.includes(a.numAlbaran));
  }, [allAlbaranes, selectedIds]);

  const totalCalculatedTons = useMemo(() => {
    return selectedAlbaranObjects.reduce((acc, curr) => acc + curr.quantityTons, 0);
  }, [selectedAlbaranObjects]);

  // Breakdown preview
  const previewBreakdown = useMemo(() => {
    const map: Record<string, { code: string; name: string; tons: number; count: number }> = {};
    for (const alb of selectedAlbaranObjects) {
      if (!map[alb.wasteTypeCode]) {
        map[alb.wasteTypeCode] = {
          code: alb.wasteTypeCode,
          name: alb.wasteTypeName,
          tons: 0,
          count: 0,
        };
      }
      map[alb.wasteTypeCode].tons += alb.quantityTons;
      map[alb.wasteTypeCode].count += 1;
    }
    return Object.values(map);
  }, [selectedAlbaranObjects]);

  // Differences vs original
  const addedCount = selectedIds.filter((id) => !originalIds.includes(id)).length;
  const removedCount = originalIds.filter((id) => !selectedIds.includes(id)).length;

  const toggleAlbaran = (alb: Albaran) => {
    const isSelected = selectedIds.includes(alb.id) || selectedIds.includes(alb.numAlbaran);
    if (isSelected) {
      setSelectedIds(selectedIds.filter((item) => item !== alb.id && item !== alb.numAlbaran));
    } else {
      setSelectedIds([...selectedIds, alb.id]);
    }
  };

  const handleSelectAll = () => {
    const allCandidateIds = clientCandidateAlbaranes.map((a) => a.id);
    setSelectedIds(Array.from(new Set([...selectedIds, ...allCandidateIds])));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleResetToOriginal = () => {
    setSelectedIds(originalIds);
  };

  const handleSave = async (andPrint: boolean = false) => {
    setErrorMsg('');

    if (selectedIds.length === 0) {
      setErrorMsg('El certificado debe incluir al menos un albarán de entrega de residuos.');
      return;
    }

    if (!thirdPartyName.trim()) {
      setErrorMsg('Debe indicar el Nombre / Razón Social del Promotor o Destinatario.');
      return;
    }

    if (!thirdPartyCif.trim()) {
      setErrorMsg('Debe indicar el NIF / CIF del Promotor.');
      return;
    }

    if (!constructionSiteName.trim()) {
      setErrorMsg('Debe indicar la denominación o referencia de la Obra.');
      return;
    }

    try {
      setIsSaving(true);
      const updated = await RCDService.updateCertificate(certificate.id, {
        thirdPartyName: thirdPartyName.trim(),
        thirdPartyCif: thirdPartyCif.trim().toUpperCase(),
        constructionSiteName: constructionSiteName.trim(),
        constructionSiteAddress: constructionSiteAddress.trim(),
        selectedAlbaranIds: selectedIds,
        issuerName: issuerName.trim(),
      });

      onCertificateUpdated(updated);

      if (andPrint) {
        openPrintableCertificate(updated, {
          forSignature: updated.status === 'Pendiente de Firma' || !updated.signedAt,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar las modificaciones del certificado.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSaving(true);
      await RCDService.deleteCertificate(certificate.id);
      if (onCertificateDeleted) {
        onCertificateDeleted(certificate.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el certificado.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-500/20 text-amber-400 p-2.5 rounded-xl border border-amber-500/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Modificar Certificado de Valorización RCD</h3>
                <span className="font-mono font-bold text-xs bg-sky-500/20 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-md">
                  {certificate.certificateNumber}
                </span>
                {certificate.status === 'Pendiente de Firma' || !certificate.signedAt ? (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                    ⏳ Pendiente de Firma
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    ✓ Firmado Digitalmente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cliente: <strong className="text-slate-200">{certificate.clientName}</strong> ({certificate.clientCif})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-slate-200 flex-1">
          
          {errorMsg && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded-xl text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Promotor / Beneficiario & Obra */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-emerald-400 text-xs uppercase tracking-wider flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>1. Datos del Promotor / Tercero Beneficiario y Obra</span>
              </h4>
              <span className="text-[11px] text-slate-400">Modifique los campos erróneos</span>
            </div>

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
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
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
                  className="w-full bg-slate-900 text-white font-mono text-xs border border-slate-800 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
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
                  placeholder="ej. Residencial Vista Verde - 32 Viviendas"
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dirección o Término Municipal de la Obra
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={constructionSiteAddress}
                    onChange={(e) => setConstructionSiteAddress(e.target.value)}
                    placeholder="ej. Avda. Federico García Lorca, Almería"
                    className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg pl-8 pr-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                  />
                  <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Emisor / Responsable Técnico de Planta RCD
                </label>
                <input
                  type="text"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="ej. Áridos Marraque S.L. - Dirección Técnica"
                  className="w-full bg-slate-900 text-white text-xs border border-slate-800 rounded-lg px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Albaranes Management */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <span>2. Albaranes de Residuos Incluidos (Quitar o Añadir)</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Marque o desmarque las entregas en báscula para incluirlas o excluirlas de este certificado.
                </p>
              </div>

              {/* Quick Action buttons */}
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold underline"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-slate-400 hover:text-white text-[11px] underline"
                >
                  Desmarcar
                </button>
                <span className="text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleResetToOriginal}
                  className="text-amber-400 hover:text-amber-300 text-[11px] font-medium flex items-center space-x-1"
                  title="Restablecer selección a como estaba al abrir"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            {/* Sub-filters & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    filterType === 'all'
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({clientCandidateAlbaranes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('included')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                    filterType === 'included'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Incluidos</span>
                  <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded-full text-[10px]">
                    {selectedIds.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('available')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                    filterType === 'available'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>Disponibles para Añadir</span>
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full text-[10px]">
                    {clientCandidateAlbaranes.filter((a) => !selectedIds.includes(a.id) && !selectedIds.includes(a.numAlbaran)).length}
                  </span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar albarán, matrícula o LER..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 text-white text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Albaranes List */}
            {displayedAlbaranes.length === 0 ? (
              <div className="bg-slate-900/60 p-6 text-center rounded-xl border border-slate-800 text-slate-400 text-xs">
                No hay albaranes que coincidan con los filtros seleccionados para este cliente.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800 bg-slate-900 max-h-52 overflow-y-auto">
                {displayedAlbaranes.map((alb) => {
                  const isChecked = selectedIds.includes(alb.id) || selectedIds.includes(alb.numAlbaran);
                  const wasOriginallyInCert =
                    originalIds.includes(alb.id) ||
                    originalIds.includes(alb.numAlbaran) ||
                    alb.certificateId === certificate.id ||
                    alb.certificateNumber === certificate.certificateNumber;
                  const isNewlyAdded = isChecked && !wasOriginallyInCert;
                  const isMarkedForRemoval = !isChecked && wasOriginallyInCert;

                  return (
                    <div
                      key={alb.id}
                      onClick={() => toggleAlbaran(alb)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition select-none ${
                        isChecked
                          ? isNewlyAdded
                            ? 'bg-amber-950/25 hover:bg-amber-950/35'
                            : 'bg-emerald-950/30 hover:bg-emerald-950/40'
                          : isMarkedForRemoval
                          ? 'bg-rose-950/20 hover:bg-rose-950/30 opacity-75'
                          : 'hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-xs text-white">
                              {alb.numAlbaran}
                            </span>
                            {isNewlyAdded && (
                              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded flex items-center space-x-0.5">
                                <PlusCircle className="w-2.5 h-2.5" />
                                <span>Añadido nuevo</span>
                              </span>
                            )}
                            {isMarkedForRemoval && (
                              <span className="text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.2 rounded flex items-center space-x-0.5">
                                <MinusCircle className="w-2.5 h-2.5" />
                                <span>Marcado para quitar</span>
                              </span>
                            )}
                            {wasOriginallyInCert && isChecked && (
                              <span className="text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                                Ya en certificado
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            LER <strong className="text-emerald-400">{alb.wasteTypeCode}</strong> - {alb.wasteTypeName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Fecha: {alb.date} {alb.time ? `• ${alb.time}` : ''} | Matrícula: {alb.licensePlate || 'N/A'}
                            {alb.origin && <span className="text-emerald-400 font-medium ml-1.5">• 📍 {alb.origin}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-sm text-white">
                          {alb.quantityTons.toFixed(2)} t
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isChecked ? 'Incluido' : 'Excluido'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Dynamic Live Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">Albaranes Seleccionados:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white text-base">
                    {selectedIds.length} entregas en báscula
                  </span>
                  {(addedCount > 0 || removedCount > 0) && (
                    <span className="text-[11px] text-slate-400">
                      ({addedCount > 0 && <span className="text-amber-400">+{addedCount} añadidos </span>}
                      {removedCount > 0 && <span className="text-rose-400">-{removedCount} quitados</span>})
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Tonelaje Total RCD Recalculado:</span>
                <span className="font-extrabold text-emerald-400 text-xl">
                  {totalCalculatedTons.toFixed(2)} Toneladas (t)
                </span>
              </div>
            </div>

            {/* Waste LER preview tags */}
            {previewBreakdown.length > 0 && (
              <div className="border-t border-slate-800/80 pt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Desglose LER:</span>
                {previewBreakdown.map((item) => (
                  <span
                    key={item.code}
                    className="bg-slate-900 border border-slate-800 text-[11px] px-2 py-0.5 rounded text-slate-300"
                  >
                    <strong className="text-emerald-400">{item.code}</strong>: {item.tons.toFixed(2)} t ({item.count})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Warning if certificate was already signed */}
          {certificate.signedAt && (addedCount > 0 || removedCount > 0) && (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-300 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Aviso de Firma Digital:</strong> Este certificado ya contaba con firma digital. Al modificar los albaranes incluidos o los datos de la obra/promotor, el documento cambiará y pasará al estado <strong>"Pendiente de Firma"</strong> para que pueda volver a ser firmado con validez jurídica oficial sobre los datos corregidos.
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          
          {/* Delete Certificate Option */}
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 p-2 rounded-xl text-xs flex items-center space-x-1.5 transition"
                title="Eliminar certificado y liberar todos sus albaranes"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Anular / Eliminar Certificado</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-rose-950/80 border border-rose-800 p-2 rounded-xl text-xs">
                <span className="text-rose-200">¿Seguro? Se liberarán todos sus albaranes:</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-1 rounded text-xs transition"
                >
                  Sí, Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-slate-400 hover:text-white px-1.5 py-1 text-xs"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-xs sm:text-sm transition"
            >
              Cancelar
            </button>
            
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving || selectedIds.length === 0}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold px-4 py-2.5 rounded-xl border border-slate-700 flex items-center space-x-2 text-xs sm:text-sm transition shadow"
              title="Guardar y abrir inmediatamente el documento PDF actualizado"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Guardar y Ver PDF</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving || selectedIds.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 text-xs sm:text-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Modificaciones'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
