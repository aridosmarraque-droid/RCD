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
  Search,
  Trash2,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  Filter
} from 'lucide-react';
import { Albaran, Certificate, Client, RCDUser, WasteType } from '../types/rcd';
import { ClientsDirectoryView } from './ClientsDirectoryView';
import { UsersManagementView } from './UsersManagementView';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { openPrintableCertificate } from '../utils/certificatePdf';
import { IssueCertificateModal } from './IssueCertificateModal';
import { WasteTypesConfigModal } from './WasteTypesConfigModal';
import { RCDService } from '../services/rcdStorage';

interface AdminPlantViewProps {
  clients: Client[];
  albaranes: Albaran[];
  certificates: Certificate[];
  users: RCDUser[];
  onRefreshData: () => void;
}

type SortField = 'numAlbaran' | 'clientName' | 'date' | 'licensePlate' | 'wasteTypeName' | 'quantityTons';

const MONTHS_LIST = [
  { value: 'all', label: 'Todos los meses' },
  { value: '01', label: '01 - Enero' },
  { value: '02', label: '02 - Febrero' },
  { value: '03', label: '03 - Marzo' },
  { value: '04', label: '04 - Abril' },
  { value: '05', label: '05 - Mayo' },
  { value: '06', label: '06 - Junio' },
  { value: '07', label: '07 - Julio' },
  { value: '08', label: '08 - Agosto' },
  { value: '09', label: '09 - Septiembre' },
  { value: '10', label: '10 - Octubre' },
  { value: '11', label: '11 - Noviembre' },
  { value: '12', label: '12 - Diciembre' },
];

export const AdminPlantView: React.FC<AdminPlantViewProps> = ({
  clients,
  albaranes,
  certificates,
  users,
  onRefreshData,
}) => {
  const [adminTab, setAdminTab] = useState<'analytics' | 'albaranes' | 'clients' | 'certificates' | 'users'>('analytics');
  const [selectedPhotoAlbaran, setSelectedPhotoAlbaran] = useState<Albaran | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting state for Albaranes
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filtering state (Year & Month) for Albaranes list
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Exercise (Año) state for Analytics & Capacity Metrics
  const currentYearStr = new Date().getFullYear().toString();
  const [ejercicioYear, setEjercicioYear] = useState<string>('all');
  
  // State for issuing certificate on behalf of selected client
  const [selectedClientForCert, setSelectedClientForCert] = useState<Client | null>(null);

  // State for Waste Types Configuration Modal
  const [showWasteTypesModal, setShowWasteTypesModal] = useState(false);

  // Waste types list
  const configuredWasteTypes = RCDService.getWasteTypes();

  // Dynamic list of available years in dataset
  const availableYears = Array.from(
    new Set([
      currentYearStr,
      '2027',
      '2026',
      '2025',
      ...albaranes.map((a) => (a.date ? a.date.substring(0, 4) : '')).filter(Boolean),
    ])
  ).sort((a, b) => Number(b) - Number(a));

  // Filtered albaranes and certs for Analytics tab (Ejercicio)
  const analyticsAlbaranes = albaranes.filter((alb) => {
    if (ejercicioYear !== 'all' && alb.date) {
      return alb.date.startsWith(ejercicioYear);
    }
    return true;
  });

  const analyticsCertificates = certificates.filter((cert) => {
    if (ejercicioYear !== 'all' && cert.issueDate) {
      return cert.issueDate.startsWith(ejercicioYear);
    }
    return true;
  });

  // Analytics Metrics
  const totalTons = analyticsAlbaranes.reduce((acc, a) => acc + a.quantityTons, 0);
  const totalCertifiedTons = analyticsCertificates.reduce((acc, c) => acc + c.totalTons, 0);
  const totalUncertifiedTons = totalTons - totalCertifiedTons;

  // Breakdown by waste code for Analytics
  const wasteBreakdownMap: Record<string, { code: string; name: string; tons: number; count: number }> = {};
  analyticsAlbaranes.forEach((alb) => {
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

  const handleDeleteAlbaran = async (alb: Albaran) => {
    if (alb.certified) {
      alert(`El albarán Nº ${alb.numAlbaran} ya tiene un certificado emitido (${alb.certificateNumber}) y NO se puede eliminar.`);
      return;
    }

    if (confirm(`¿Está seguro de eliminar permanentemente el albarán Nº ${alb.numAlbaran}?`)) {
      await RCDService.deleteAlbaran(alb.id);
      onRefreshData();
    }
  };

  // Filter Albaranes by search, year, and month
  const filteredAlbaranes = albaranes.filter((alb) => {
    const matchesSearch =
      alb.numAlbaran.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alb.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alb.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alb.wasteTypeName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedYear !== 'all' && alb.date) {
      if (!alb.date.startsWith(selectedYear)) return false;
    }

    if (selectedMonth !== 'all' && alb.date) {
      const monthPart = alb.date.substring(5, 7);
      if (monthPart !== selectedMonth) return false;
    }

    return true;
  });

  // Sort Albaranes
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAlbaranes = [...filteredAlbaranes].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    if (sortField === 'date') {
      valA = `${a.date} ${a.time || ''}`;
      valB = `${b.date} ${b.time || ''}`;
    }

    if (typeof valA === 'string') {
      const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    } else {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
  });

  const renderSortHeader = (field: SortField, label: string, align: 'left' | 'center' | 'right' = 'left') => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`py-3 px-4 cursor-pointer select-none transition hover:text-white ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        }`}
        title={`Pinche para ordenar por ${label} (${isActive && sortDirection === 'asc' ? 'Descendente' : 'Ascendente'})`}
      >
        <div className={`inline-flex items-center space-x-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 opacity-60 hover:opacity-100" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Admin Title Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="bg-amber-500/20 text-amber-400 font-bold text-xs px-2.5 py-1 rounded-lg border border-amber-500/30">
              Panel Administrador Planta
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white">Gestión Global Planta RCD</h2>
        </div>

        {/* Action Button & Quick Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowWasteTypesModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow-lg shadow-emerald-500/20"
          >
            <Settings className="w-4 h-4" />
            <span>Configurar Tipos de Residuos & Capacidades</span>
          </button>

          <div className="flex items-center space-x-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setAdminTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                adminTab === 'analytics' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Métricas & Capacidades
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
            <button
              onClick={() => setAdminTab('users')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                adminTab === 'users' ? 'bg-emerald-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔐 Usuarios BBDD ({users.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ANALYTICS & METRICS */}
      {adminTab === 'analytics' && (
        <div className="space-y-6">
          {/* Ejercicio / Year Selection Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center space-x-2 text-white text-xs font-bold">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Selección de Ejercicio de Capacidad y Métricas de Planta:</span>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-medium">Ejercicio:</span>
              <select
                value={ejercicioYear}
                onChange={(e) => setEjercicioYear(e.target.value)}
                className="bg-slate-950 text-emerald-400 font-extrabold text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
              >
                <option value="all">Todos los Ejercicios Históricos</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Ejercicio {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

          {/* Waste Capacity and Remaining Capacity per Waste Type */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <span>Residuo Entrado y Capacidad Restante por Tipo de Residuo (LER)</span>
              </h3>
              <button
                onClick={() => setShowWasteTypesModal(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold underline"
              >
                Editar Capacidades
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {configuredWasteTypes.map((wt) => {
                const enteredTons = wasteBreakdownMap[wt.code]?.tons || 0;
                const maxCap = wt.maxCapacityTons || 5000;
                const remainingTons = Math.max(0, maxCap - enteredTons);
                const occupancyPct = Math.min(100, Math.round((enteredTons / maxCap) * 100));

                let barColor = 'bg-emerald-500';
                let textColor = 'text-emerald-400';
                if (occupancyPct > 85) {
                  barColor = 'bg-rose-500';
                  textColor = 'text-rose-400';
                } else if (occupancyPct > 60) {
                  barColor = 'bg-amber-500';
                  textColor = 'text-amber-400';
                }

                return (
                  <div key={wt.code} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        LER {wt.code}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">{wt.category}</span>
                    </div>

                    <div className="text-xs font-bold text-white line-clamp-1">{wt.name}</div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Residuo Entrado:</span>
                        <span className="font-extrabold text-white text-sm">{enteredTons.toFixed(2)} t</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Capacidad Restante:</span>
                        <span className={`font-extrabold text-sm ${textColor}`}>
                          {remainingTons.toFixed(2)} t
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>Ocupación de Planta: {occupancyPct}%</span>
                        <span>Máx: {maxCap} t</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${occupancyPct}%` }} />
                      </div>
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
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por albarán, cliente, matrícula o residuo..."
                className="w-full bg-slate-950 text-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none"
              />
            </div>

            {/* Year & Month Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-medium">Año:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-slate-900 text-white font-bold text-xs border border-slate-700 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="all">Todos los Años</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400 font-medium">Mes:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-900 text-white font-bold text-xs border border-slate-700 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {MONTHS_LIST.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-slate-400 font-medium px-3 py-2 bg-slate-950 rounded-xl border border-slate-800">
                Mostrando <strong className="text-emerald-400 font-bold">{sortedAlbaranes.length}</strong> albaranes
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[11px] border-b border-slate-800">
                  <tr>
                    {renderSortHeader('numAlbaran', 'Albarán SAP')}
                    {renderSortHeader('clientName', 'Cliente / Transportista')}
                    {renderSortHeader('date', 'Fecha / Hora')}
                    {renderSortHeader('licensePlate', 'Matrícula')}
                    {renderSortHeader('wasteTypeName', 'Residuo (LER)')}
                    {renderSortHeader('quantityTons', 'Cantidad (t)', 'right')}
                    <th className="py-3 px-4 text-center">Fotos</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedAlbaranes.map((alb) => (
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
                      <td className="py-3 px-4 text-center">
                        {alb.certified ? (
                          <button
                            disabled
                            title="No se puede eliminar: El albarán tiene un certificado emitido."
                            className="p-1.5 text-slate-600 bg-slate-900 rounded cursor-not-allowed border border-slate-800"
                          >
                            <Trash2 className="w-4 h-4 opacity-40" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteAlbaran(alb)}
                            title="Eliminar Albarán"
                            className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* TAB 5: USERS & SECURITY */}
      {adminTab === 'users' && (
        <UsersManagementView
          users={users}
          clients={clients}
          onUsersChanged={onRefreshData}
        />
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

      {/* Waste Types & Capacity Config Modal */}
      <WasteTypesConfigModal
        isOpen={showWasteTypesModal}
        onClose={() => setShowWasteTypesModal(false)}
        onDataChanged={onRefreshData}
      />

    </div>
  );
};
