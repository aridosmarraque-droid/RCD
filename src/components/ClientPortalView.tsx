import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Truck,
  Eye,
  Lock,
  CheckCircle2,
  Calendar,
  Building2,
  Printer,
  Download,
  Filter,
  PlusCircle,
  AlertCircle
} from 'lucide-react';
import { Albaran, Certificate, Client } from '@/types/rcd';
import { PhotoLightboxModal } from '@/components/PhotoLightboxModal';
import { IssueCertificateModal } from '@/components/IssueCertificateModal';
import { openPrintableCertificate } from '@/utils/certificatePdf';

interface ClientPortalViewProps {
  client: Client;
  albaranes: Albaran[];
  certificates: Certificate[];
  onRefreshData: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  client,
  albaranes,
  certificates,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'albaranes' | 'certificates'>('albaranes');
  const [filterCertified, setFilterCertified] = useState<'all' | 'uncertified' | 'certified'>('all');
  const [selectedPhotoAlbaran, setSelectedPhotoAlbaran] = useState<Albaran | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

  // Client specific albaranes & certs
  const clientAlbaranes = albaranes.filter(
    (a) => a.clientId === client.id || a.clientCode.toLowerCase() === client.code.toLowerCase()
  );

  const availableUncertified = clientAlbaranes.filter((a) => !a.certified);
  const certifiedAlbaranes = clientAlbaranes.filter((a) => a.certified);

  const clientCertificates = certificates.filter((c) => c.clientId === client.id);

  // Filtered list
  const displayedAlbaranes = clientAlbaranes.filter((a) => {
    if (filterCertified === 'uncertified') return !a.certified;
    if (filterCertified === 'certified') return a.certified;
    return true;
  });

  const totalTonnage = clientAlbaranes.reduce((sum, a) => sum + a.quantityTons, 0);
  const availableTonnage = availableUncertified.reduce((sum, a) => sum + a.quantityTons, 0);

  return (
    <div className="space-y-6">
      
      {/* Client Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="bg-sky-500/20 text-sky-400 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border border-sky-500/30">
              {client.code}
            </span>
            <h2 className="text-xl font-extrabold text-white">{client.name}</h2>
          </div>
          <p className="text-xs text-slate-400">
            NIF/CIF: <strong className="text-slate-300 font-mono">{client.cif}</strong> | Email: {client.email} | Móvil: {client.mobile}
          </p>
        </div>

        {/* Action: Emit Third Party Certificate */}
        <button
          onClick={() => setIsIssueModalOpen(true)}
          disabled={availableUncertified.length === 0}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-sm shrink-0"
        >
          <ShieldCheck className="w-5 h-5" />
          <span>Emitir Certificado a Nombre de Terceros</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 block mb-1">Tonelaje Total Recibido:</span>
          <div className="text-2xl font-extrabold text-white">{totalTonnage.toFixed(2)} t</div>
          <span className="text-[10px] text-slate-500">{clientAlbaranes.length} Entradas en báscula</span>
        </div>

        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-lg bg-emerald-950/20">
          <span className="text-xs text-emerald-400 font-medium block mb-1">Disponible para Certificados:</span>
          <div className="text-2xl font-extrabold text-emerald-400">{availableTonnage.toFixed(2)} t</div>
          <span className="text-[10px] text-emerald-300/70">{availableUncertified.length} albaranes libres</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 block mb-1">Tonelaje Certificado:</span>
          <div className="text-2xl font-extrabold text-slate-300">{(totalTonnage - availableTonnage).toFixed(2)} t</div>
          <span className="text-[10px] text-slate-500">{certifiedAlbaranes.length} albaranes bloqueados</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <span className="text-xs text-slate-400 block mb-1">Certificados Emitidos:</span>
          <div className="text-2xl font-extrabold text-sky-400">{clientCertificates.length}</div>
          <span className="text-[10px] text-slate-500">Documentos oficiales RCD</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('albaranes')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition ${
            activeTab === 'albaranes'
              ? 'bg-slate-800 text-white border border-slate-700 shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Historial de Albaranes ({clientAlbaranes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center space-x-2 transition ${
            activeTab === 'certificates'
              ? 'bg-slate-800 text-white border border-slate-700 shadow'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Certificados Emitidos ({clientCertificates.length})</span>
        </button>
      </div>

      {/* TAB 1: ALBARANES TABLE */}
      {activeTab === 'albaranes' && (
        <div className="space-y-4">
          
          {/* Sub-filters for Albaranes */}
          <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-slate-400 font-medium">Filtrar estado:</span>
              <button
                onClick={() => setFilterCertified('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  filterCertified === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({clientAlbaranes.length})
              </button>
              <button
                onClick={() => setFilterCertified('uncertified')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  filterCertified === 'uncertified' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                🟢 Disponibles ({availableUncertified.length})
              </button>
              <button
                onClick={() => setFilterCertified('certified')}
                className={`px-2.5 py-1 rounded-lg font-bold text-xs transition ${
                  filterCertified === 'certified' ? 'bg-slate-800 text-slate-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                🔒 Certificados ({certifiedAlbaranes.length})
              </button>
            </div>
          </div>

          {/* Albaranes Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Nº Albarán SAP</th>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Matrícula</th>
                    <th className="py-3 px-4">Residuo (Código LER)</th>
                    <th className="py-3 px-4 text-right">Cantidad (t)</th>
                    <th className="py-3 px-4 text-center">Fotos</th>
                    <th className="py-3 px-4 text-center">Estado Certificado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedAlbaranes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No hay albaranes registrados que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    displayedAlbaranes.map((alb) => (
                      <tr key={alb.id} className="hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {alb.numAlbaran}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {alb.date} <span className="text-slate-500 text-[10px]">{alb.time}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                          {alb.licensePlate}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-white block">{alb.wasteTypeCode}</span>
                          <span className="text-[10px] text-slate-400">{alb.wasteTypeName}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-white text-sm">
                          {alb.quantityTons.toFixed(2)} t
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedPhotoAlbaran(alb)}
                            className="inline-flex items-center space-x-1 text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1 rounded-lg border border-sky-500/20 font-semibold transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Fotos</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {alb.certified ? (
                            <span className="inline-flex items-center space-x-1 text-slate-300 bg-slate-800 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-700" title={`Certificado: ${alb.certificateNumber}`}>
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>INCLUIDO ({alb.certificateNumber})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>DISPONIBLE</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ISSUED CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {clientCertificates.length === 0 ? (
              <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
                No se ha emitido ningún certificado de residuos para este cliente todavía.
              </div>
            ) : (
              clientCertificates.map((cert) => (
                <div key={cert.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <span className="font-mono font-bold text-sky-400 text-sm block">{cert.certificateNumber}</span>
                      <span className="text-[11px] text-slate-400">Fecha de Emisión: {cert.issueDate}</span>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                      OFICIAL RCD
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Promotor / Beneficiario Tercero:</span>
                      <div className="font-bold text-white text-sm">{cert.thirdPartyName}</div>
                      <div className="text-slate-400">NIF/CIF: {cert.thirdPartyCif}</div>
                      <div className="text-slate-400">Obra: <strong className="text-slate-200">{cert.constructionSiteName}</strong></div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Residuos Incluidos:</span>
                        <span className="font-bold text-white text-xs">{cert.albaranIds.length} Entradas en báscula</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Total Certificado:</span>
                        <span className="font-extrabold text-emerald-400 text-base">{cert.totalTons.toFixed(2)} t</span>
                      </div>
                    </div>
                  </div>

                  {/* Print PDF Button */}
                  <button
                    onClick={() => openPrintableCertificate(cert)}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 text-xs transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Ver / Imprimir Documento Certificado PDF</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <PhotoLightboxModal
        albaran={selectedPhotoAlbaran}
        onClose={() => setSelectedPhotoAlbaran(null)}
      />

      {/* Third Party Certificate Modal */}
      <IssueCertificateModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        client={client}
        availableAlbaranes={availableUncertified}
        onCertificateCreated={() => onRefreshData()}
      />

    </div>
  );
};
