import React, { useState } from 'react';
import {
  BarChart3,
  Users,
  FileText,
  ShieldCheck,
  Building2,
  Printer,
  Eye,
  Lock,
  CheckCircle2,
  Factory,
  RefreshCw,
  Search
} from 'lucide-react';
import { Albaran, Certificate, Client } from '../types/rcd';
import { ClientsDirectoryView } from './ClientsDirectoryView';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { openPrintableCertificate } from '../utils/certificatePdf';
import { IssueCertificateModal } from './IssueCertificateModal';

interface AdminPlantViewProps {
  clients: Client[];
  albaranes: Albaran[];
  certificates: Certificate[];
  onRefreshData: () => void;
}

export const AdminPlantView: React.FC<AdminPlantViewProps> = ({
  clients,
  albaranes,
  certificates,
  onRefreshData,
}) => {
  const [adminTab, setAdminTab] = useState<'analytics' | 'albaranes' | 'clients' | 'certificates'>('analytics');
  const [selectedPhotoAlbaran, setSelectedPhotoAlbaran] = useState<Albaran | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for issuing certificate on behalf of selected client
  const [selectedClientForCert, setSelectedClientForCert] = useState<Client | null>(null);

  // Global Metrics
  const totalTons = albaranes.reduce((acc, a) => acc + a.quantityTons, 0);
  const totalCertifiedTons = certificates.reduce((acc, c) => acc + c.totalTons, 0);
  const totalUncertifiedTons = totalTons - totalCertifiedTons;

  // Breakdown by waste code
  const wasteBreakdownMap: Record<string, { code: string; name: string; tons: number; count: number }> = {};
  albaranes.forEach((alb) => {
    if (!wasteBreakdownMap[alb.wasteTypeCode]) {
      wasteBreakdownMap[alb.wasteTypeCode] = {
        code: alb.wasteTypeCode,
        name: alb.wasteTypeName,
        tons: 0,
        count: 0,
      };
    }
    wasteBreakdownMap[alb.wasteTypeCode].tons += alb.quantityTons;
    wasteBreakdownMap[alb.wasteTypeCode].count += 1;
  });

  const wasteBreakdownList = Object.values(wasteBreakdownMap);

  const filteredAlbaranes = albaranes.filter(
    (a) =>
      a.numAlbaran.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.wasteTypeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Admin Title Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="bg-amber-500/20 text-amber-400 font-bold text-xs px-2.5 py-1 rounded-lg border border-amber-500/30">
              Panel Administrador Planta
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-xs">SAP Business One Live Bridge</span>
          </div>
          <h2 className="text-xl font-extrabold text-white">Gestión Global Planta RCD EcoMarraque</h2>
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            onClick={() => setAdminTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              adminTab === 'analytics' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Resumen & Métricas
          </button>
          <button
            onClick={() => setAdminTab('albaranes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              adminTab === 'albaranes' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📄 Todos los Albaranes ({albaranes.length})
          </button>
          <button
            onClick={() => setAdminTab('clients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              adminTab === 'clients' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            👥 Fichas de Clientes ({clients.length})
          </button>
          <button
            onClick={() => setAdminTab('certificates')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              adminTab === 'certificates' ? 'bg-purple-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            📜 Certificados ({certificates.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ANALYTICS & METRICS */}
      {adminTab === 'analytics' && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Tonelaje Total Recibido:</span>
              <div className="text-2xl font-extrabold text-white">{totalTons.toFixed(2)} t</div>
              <span className="text-[10px] text-emerald-400 font-semibold">{albaranes.length} camiones registrados</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Tonelaje Certificado:</span>
              <div className="text-2xl font-extrabold text-emerald-400">{totalCertifiedTons.toFixed(2)} t</div>
              <span className="text-[10px] text-slate-400">{certificates.length} certificados emitidos</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Pendiente de Certificar:</span>
              <div className="text-2xl font-extrabold text-amber-400">{totalUncertifiedTons.toFixed(2)} t</div>
              <span className="text-[10px] text-slate-400">Disponible en báscula</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <span className="text-xs text-slate-400 block mb-1">Clientes Activos:</span>
              <div className="text-2xl font-extrabold text-sky-400">{clients.length}</div>
              <span className="text-[10px] text-slate-400">Notificaciones configuradas</span>
            </div>
          </div>

          {/* Waste Code Breakdown Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-white text-base flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>Desglose de Residuos Entrados en Planta (Códigos LER)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {wasteBreakdownList.map((wb) => {
                const pct = totalTons > 0 ? ((wb.tons / totalTons) * 100).toFixed(1) : '0';
                return (
                  <div key={wb.code} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        LER {wb.code}
                      </span>
                      <span className="text-xs font-extrabold text-white">{wb.tons.toFixed(2)} t</span>
                    </div>

                    <div className="text-xs font-semibold text-slate-200 truncate">{wb.name}</div>

                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                      <span>{wb.count} entregas</span>
                      <span>{pct}% del total en planta</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL ALBARANES */}
      {adminTab === 'albaranes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por albarán, cliente, matrícula o residuo..."
                className="w-full bg-slate-950 text-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline-block">
              Mostrando {filteredAlbaranes.length} albaranes de SAP
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Albarán SAP</th>
                    <th className="py-3 px-4">Cliente / Transportista</th>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Matrícula</th>
                    <th className="py-3 px-4">Residuo (LER)</th>
                    <th className="py-3 px-4 text-right">Cantidad (t)</th>
                    <th className="py-3 px-4 text-center">Fotos</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAlbaranes.map((alb) => (
                    <tr key={alb.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">{alb.numAlbaran}</td>
                      <td className="py-3 px-4 font-bold text-white">{alb.clientName}</td>
                      <td className="py-3 px-4 text-slate-300">{alb.date} <span className="text-[10px] text-slate-500">{alb.time}</span></td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{alb.licensePlate}</td>
                      <td className="py-3 px-4">{alb.wasteTypeCode} - {alb.wasteTypeName}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-white">{alb.quantityTons.toFixed(2)} t</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedPhotoAlbaran(alb)}
                          className="text-sky-400 bg-sky-500/10 px-2 py-1 rounded border border-sky-500/20 font-semibold hover:bg-sky-500/20 transition"
                        >
                          Ver Fotos
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {alb.certified ? (
                          <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-700">
                            🔒 {alb.certificateNumber}
                          </span>
                        ) : (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/20">
                            🟢 LIBRE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLIENTS DIRECTORY */}
      {adminTab === 'clients' && (
        <ClientsDirectoryView clients={clients} onClientsUpdated={onRefreshData} />
      )}

      {/* TAB 4: CERTIFICATES MANAGEMENT */}
      {adminTab === 'certificates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono font-bold text-sky-400 text-sm">{cert.certificateNumber}</span>
                  <span className="text-slate-400 text-xs">Fecha: {cert.issueDate}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Promotor Beneficiario:</span>
                  <div className="font-bold text-white text-sm">{cert.thirdPartyName}</div>
                  <div className="text-slate-400">CIF: {cert.thirdPartyCif} | Obra: {cert.constructionSiteName}</div>
                  <div className="text-emerald-400 font-bold pt-1">
                    Total Certificado: {cert.totalTons.toFixed(2)} Toneladas ({cert.albaranIds.length} albaranes)
                  </div>
                </div>

                <button
                  onClick={() => openPrintableCertificate(cert)}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl text-xs shadow flex items-center justify-center space-x-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir / Ver Certificado PDF</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <PhotoLightboxModal
        albaran={selectedPhotoAlbaran}
        onClose={() => setSelectedPhotoAlbaran(null)}
      />

      {/* Modal if selected client for cert */}
      {selectedClientForCert && (
        <IssueCertificateModal
          isOpen={!!selectedClientForCert}
          onClose={() => setSelectedClientForCert(null)}
          client={selectedClientForCert}
          availableAlbaranes={albaranes.filter((a) => (a.clientId === selectedClientForCert.id || a.clientCode === selectedClientForCert.code) && !a.certified)}
          onCertificateCreated={() => {
            onRefreshData();
            setSelectedClientForCert(null);
          }}
        />
      )}

    </div>
  );
};
