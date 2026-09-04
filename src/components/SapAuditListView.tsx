import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Download,
  Printer,
  FileText,
  Check,
  Calendar,
  Building2,
  Truck,
  Camera,
  AlertCircle,
  ExternalLink,
  Edit3,
  RotateCcw,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Albaran, Client } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';

interface SapAuditListViewProps {
  albaranes: Albaran[];
  clients: Client[];
  onRefreshData: () => void;
  onOpenPhotoManager: (albaran: Albaran) => void;
  onEditAlbaran: (albaran: Albaran) => void;
}

type SortField = 'numAlbaran' | 'date' | 'clientName' | 'licensePlate' | 'quantityTons' | 'sapChecked';

export const SapAuditListView: React.FC<SapAuditListViewProps> = ({
  albaranes,
  clients,
  onRefreshData,
  onOpenPhotoManager,
  onEditAlbaran,
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked'>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Notes Modal State
  const [noteEditingAlbaran, setNoteEditingAlbaran] = useState<Albaran | null>(null);
  const [tempNote, setTempNote] = useState('');

  // Date Filtering Logic
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const filteredAlbaranes = useMemo(() => {
    return albaranes.filter((alb) => {
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesQuery =
          alb.numAlbaran.toLowerCase().includes(query) ||
          alb.clientName.toLowerCase().includes(query) ||
          (alb.clientCode && alb.clientCode.toLowerCase().includes(query)) ||
          alb.licensePlate.toLowerCase().includes(query) ||
          alb.wasteTypeCode.toLowerCase().includes(query) ||
          alb.wasteTypeName.toLowerCase().includes(query) ||
          (alb.driverName && alb.driverName.toLowerCase().includes(query)) ||
          (alb.sapNotes && alb.sapNotes.toLowerCase().includes(query));

        if (!matchesQuery) return false;
      }

      // Status filter
      if (statusFilter === 'pending' && alb.sapChecked) return false;
      if (statusFilter === 'checked' && !alb.sapChecked) return false;

      // Client filter
      if (selectedClientId !== 'all') {
        if (alb.clientId !== selectedClientId && alb.clientCode !== selectedClientId) {
          return false;
        }
      }

      // Date Range filter
      if (dateRange === 'today') {
        if (alb.date !== todayStr) return false;
      } else if (dateRange === 'week') {
        if (alb.date < sevenDaysAgo) return false;
      } else if (dateRange === 'month') {
        if (alb.date < firstDayOfMonth) return false;
      } else if (dateRange === 'custom') {
        if (startDate && alb.date < startDate) return false;
        if (endDate && alb.date > endDate) return false;
      }

      return true;
    });
  }, [albaranes, searchTerm, statusFilter, selectedClientId, dateRange, startDate, endDate, todayStr, sevenDaysAgo, firstDayOfMonth]);

  // Sorted list
  const sortedAlbaranes = useMemo(() => {
    return [...filteredAlbaranes].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'date') {
        valA = `${a.date} ${a.time || ''}`;
        valB = `${b.date} ${b.time || ''}`;
      } else if (sortField === 'sapChecked') {
        valA = a.sapChecked ? 1 : 0;
        valB = b.sapChecked ? 1 : 0;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB, 'es', { sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      } else {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
    });
  }, [filteredAlbaranes, sortField, sortDirection]);

  // Summary Metrics
  const totalCount = filteredAlbaranes.length;
  const checkedCount = filteredAlbaranes.filter((a) => a.sapChecked).length;
  const pendingCount = totalCount - checkedCount;
  const totalTons = filteredAlbaranes.reduce((sum, a) => sum + (a.quantityTons || 0), 0);
  const checkedTons = filteredAlbaranes.filter((a) => a.sapChecked).reduce((sum, a) => sum + (a.quantityTons || 0), 0);
  const pendingTons = totalTons - checkedTons;
  const percentChecked = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 100;

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'date' ? 'desc' : 'asc');
    }
  };

  // Single Toggle SAP Checked
  const handleToggleCheck = async (alb: Albaran) => {
    try {
      await RCDService.toggleSapChecked(alb.id, !alb.sapChecked, alb.sapNotes);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar punteo SAP.');
    }
  };

  // Bulk Set SAP Checked
  const handleBulkSetChecked = async (checked: boolean) => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await RCDService.bulkSetSapChecked(selectedIds, checked);
      setSelectedIds([]);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al actualizar viajes en lote.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Select/Deselect All Visible
  const handleToggleSelectAll = () => {
    if (selectedIds.length === sortedAlbaranes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedAlbaranes.map((a) => a.id));
    }
  };

  // Save Note Modal
  const handleOpenNoteModal = (alb: Albaran) => {
    setNoteEditingAlbaran(alb);
    setTempNote(alb.sapNotes || '');
  };

  const handleSaveNote = async () => {
    if (!noteEditingAlbaran) return;
    try {
      await RCDService.toggleSapChecked(
        noteEditingAlbaran.id,
        noteEditingAlbaran.sapChecked,
        tempNote.trim() || undefined
      );
      setNoteEditingAlbaran(null);
      onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar observación SAP.');
    }
  };

  // Export to Excel / CSV compatible format
  const handleExportCSV = () => {
    if (sortedAlbaranes.length === 0) {
      alert('No hay viajes en la vista actual para exportar.');
      return;
    }

    const headers = [
      'Nº Albarán SAP',
      'Fecha',
      'Hora',
      'Cód. Cliente SAP',
      'Nombre Cliente',
      'Matrícula Camión',
      'Conductor',
      'Cód. LER',
      'Denominación Residuo',
      'Toneladas Netas (t)',
      'Zona de Planta',
      'Certificado RCD',
      'Punteado en SAP',
      'Fecha Punteo SAP',
      'Punteado Por',
      'Observaciones / Asiento SAP',
      'Tiene Foto Albarán',
      'Tiene Foto Camión',
      'Tiene Foto Descarga',
    ];

    const rows = sortedAlbaranes.map((a) => [
      `"${a.numAlbaran}"`,
      `"${a.date}"`,
      `"${a.time || ''}"`,
      `"${a.clientCode || ''}"`,
      `"${(a.clientName || '').replace(/"/g, '""')}"`,
      `"${a.licensePlate}"`,
      `"${(a.driverName || '').replace(/"/g, '""')}"`,
      `"${a.wasteTypeCode}"`,
      `"${(a.wasteTypeName || '').replace(/"/g, '""')}"`,
      `"${a.quantityTons.toFixed(2).replace('.', ',')}"`,
      `"${(a.plantZone || '').replace(/"/g, '""')}"`,
      `"${a.certified ? a.certificateNumber || 'Certificado' : 'No'}"`,
      `"${a.sapChecked ? 'SÍ' : 'NO'}"`,
      `"${a.sapCheckedAt || ''}"`,
      `"${a.sapCheckedBy || ''}"`,
      `"${(a.sapNotes || '').replace(/"/g, '""')}"`,
      `"${a.albaranPhotoUrl ? 'SÍ' : 'NO'}"`,
      `"${a.truckPhotoUrl ? 'SÍ' : 'NO'}"`,
      `"${a.unloadPhotoUrl ? 'SÍ' : 'NO'}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Punteo_Albaranes_SAP_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Printable Sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header and Metric Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="bg-sky-500/20 text-sky-400 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-sky-500/30 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Auditoría & Conciliación SAP</span>
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">Punteo de Albaranes de Viajes Registrados</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Listado de Viajes para Punteo de Albaranes SAP
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cruce sistemático de pesajes y viajes en planta con el sistema SAP. Puntee los albaranes físicos para verificar que ninguno queda sin registrar.
            </p>
          </div>

          {/* Action buttons: Export CSV & Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow"
              title="Descargar listado en archivo Excel / CSV con todos los campos"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar Excel / CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition shadow"
              title="Imprimir hoja de punteo con casillas de verificación"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Imprimir Listado</span>
            </button>
          </div>
        </div>

        {/* KPI Cards & Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">Total Viajes Filtrados</span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-black text-white">{totalCount}</span>
              <span className="text-xs text-slate-400">({totalTons.toFixed(1)} t)</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Punteados en SAP</span>
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-black text-emerald-400">{checkedCount}</span>
              <span className="text-xs text-emerald-300/80">({checkedTons.toFixed(1)} t)</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-amber-400 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes de Puntear</span>
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-xl font-black text-amber-400">{pendingCount}</span>
              <span className="text-xs text-amber-300/80">({pendingTons.toFixed(1)} t)</span>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-400 block">Grado de Conciliación</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-xl font-black text-white">{percentChecked}%</span>
              <span className="text-xs text-slate-400">revisado</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentChecked}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Text Search */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar Nº SAP, matrícula, cliente..."
              className="w-full bg-slate-950 text-white text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Status Tab Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({albaranes.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              ⏳ Pendientes ({albaranes.filter((a) => !a.sapChecked).length})
            </button>
            <button
              onClick={() => setStatusFilter('checked')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition text-center ${
                statusFilter === 'checked'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              ✅ Punteados ({albaranes.filter((a) => a.sapChecked).length})
            </button>
          </div>

          {/* Client Filter */}
          <div>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-950 text-white text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="all">🏢 Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code || 'S/C'})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center space-x-1">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full bg-slate-950 text-white text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="all">📅 Todas las fechas</option>
              <option value="today">📅 Solo Hoy</option>
              <option value="week">📅 Últimos 7 días</option>
              <option value="month">📅 Este Mes en curso</option>
              <option value="custom">📅 Rango personalizado...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateRange === 'custom' && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-3 text-xs">
            <span className="text-slate-400">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-800"
            />
            <span className="text-slate-400">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-800"
            />
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="bg-sky-950/60 border border-sky-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-sky-200 font-bold">
              {selectedIds.length} viaje(s) seleccionado(s)
            </span>
            <div className="flex items-center space-x-2">
              <button
                disabled={isProcessing}
                onClick={() => handleBulkSetChecked(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg transition flex items-center space-x-1 shadow"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Marcar Punteados en SAP</span>
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleBulkSetChecked(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <span>Desmarcar Punteo</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                {/* Select Checkbox */}
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    title="Seleccionar / Deseleccionar todos los visibles"
                    className="text-slate-400 hover:text-white"
                  >
                    {selectedIds.length > 0 && selectedIds.length === sortedAlbaranes.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>

                {/* SAP Check Status Column */}
                <th
                  onClick={() => handleSort('sapChecked')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-center w-36"
                >
                  <div className="inline-flex items-center space-x-1">
                    <span>Punteo SAP</span>
                    {sortField === 'sapChecked' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Delivery Note Number */}
                <th
                  onClick={() => handleSort('numAlbaran')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-left"
                >
                  <div className="inline-flex items-center space-x-1">
                    <span>Nº Albarán SAP</span>
                    {sortField === 'numAlbaran' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Date & Time */}
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-left"
                >
                  <div className="inline-flex items-center space-x-1">
                    <span>Fecha / Hora</span>
                    {sortField === 'date' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Client */}
                <th
                  onClick={() => handleSort('clientName')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-left"
                >
                  <div className="inline-flex items-center space-x-1">
                    <span>Cliente (Cód. SAP)</span>
                    {sortField === 'clientName' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Vehicle Plate */}
                <th
                  onClick={() => handleSort('licensePlate')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-left"
                >
                  <div className="inline-flex items-center space-x-1">
                    <span>Matrícula</span>
                    {sortField === 'licensePlate' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Waste Type & LER */}
                <th className="py-3 px-4 text-left">Residuo LER</th>

                {/* Tons */}
                <th
                  onClick={() => handleSort('quantityTons')}
                  className="py-3 px-4 cursor-pointer select-none hover:text-white text-right"
                >
                  <div className="inline-flex items-center space-x-1 justify-end">
                    <span>Peso Neto</span>
                    {sortField === 'quantityTons' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-600" />
                    )}
                  </div>
                </th>

                {/* Photos status */}
                <th className="py-3 px-4 text-center">Fotos (3/3)</th>

                {/* Notes & Actions */}
                <th className="py-3 px-4 text-center">Observaciones SAP / Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {sortedAlbaranes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-slate-600 opacity-50" />
                    <p className="text-sm font-semibold">No se encontraron viajes con los filtros seleccionados.</p>
                    <p className="text-xs text-slate-600 mt-1">Pruebe a cambiar el rango de fechas o los términos de búsqueda.</p>
                  </td>
                </tr>
              ) : (
                sortedAlbaranes.map((alb) => {
                  const isSelected = selectedIds.includes(alb.id);
                  const hasPhoto1 = Boolean(alb.albaranPhotoUrl);
                  const hasPhoto2 = Boolean(alb.truckPhotoUrl);
                  const hasPhoto3 = Boolean(alb.unloadPhotoUrl);
                  const photoCount = [hasPhoto1, hasPhoto2, hasPhoto3].filter(Boolean).length;

                  return (
                    <tr
                      key={alb.id}
                      className={`transition ${
                        alb.sapChecked
                          ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                          : isSelected
                          ? 'bg-sky-950/30 hover:bg-sky-950/40'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Selection Box */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIds((prev) =>
                              prev.includes(alb.id) ? prev.filter((id) => id !== alb.id) : [...prev, alb.id]
                            );
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* 1-Click SAP Punteo Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleCheck(alb)}
                          className={`w-full py-1.5 px-2.5 rounded-xl font-extrabold text-xs transition flex items-center justify-center space-x-1.5 shadow-sm border ${
                            alb.sapChecked
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-slate-800/80 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                          title={alb.sapChecked ? `Punteado el ${alb.sapCheckedAt || ''} por ${alb.sapCheckedBy || 'Admin'}. Haga clic para desmarcar.` : 'Haga clic para puntear como registrado en SAP'}
                        >
                          {alb.sapChecked ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate">✓ Punteado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Puntear</span>
                            </>
                          )}
                        </button>
                        {alb.sapChecked && alb.sapCheckedAt && (
                          <span className="block text-[9px] text-emerald-400/80 mt-0.5 font-mono">
                            {alb.sapCheckedAt}
                          </span>
                        )}
                      </td>

                      {/* Delivery Note Number */}
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        <span className="text-emerald-400 text-sm">{alb.numAlbaran}</span>
                        {alb.certified && (
                          <span className="block text-[10px] text-sky-400 font-sans font-semibold">
                            🔒 Certificado ({alb.certificateNumber || ''})
                          </span>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-white block">{alb.date}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{alb.time || '--:--'}</span>
                      </td>

                      {/* Client */}
                      <td className="py-3 px-4 max-w-[180px]">
                        <span className="font-bold text-slate-200 block truncate" title={alb.clientName}>
                          {alb.clientName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          SAP: {alb.clientCode || 'Sin código'}
                        </span>
                      </td>

                      {/* License Plate */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-black text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
                          {alb.licensePlate}
                        </span>
                        {alb.driverName && (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[120px]" title={alb.driverName}>
                            {alb.driverName}
                          </span>
                        )}
                      </td>

                      {/* Waste LER */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <span className="font-mono font-bold text-emerald-400 block">{alb.wasteTypeCode}</span>
                        <span className="text-[11px] text-slate-300 block truncate" title={alb.wasteTypeName}>
                          {alb.wasteTypeName}
                        </span>
                      </td>

                      {/* Quantity Tons */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="font-black text-white text-sm">{alb.quantityTons.toFixed(2)}</span>
                        <span className="text-slate-400 text-xs ml-1">t</span>
                      </td>

                      {/* Photos Status & Quick Open */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onOpenPhotoManager(alb)}
                          className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold border transition ${
                            photoCount === 3
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-950/80'
                              : photoCount > 0
                              ? 'bg-amber-950/40 text-amber-300 border-amber-500/30 hover:bg-amber-950/80'
                              : 'bg-rose-950/40 text-rose-300 border-rose-500/30 hover:bg-rose-950/80'
                          }`}
                          title={`Fotos: ${photoCount}/3 (Albarán, Camión, Descarga). Pinche para ver o añadir fotos faltantes.`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{photoCount}/3</span>
                        </button>
                      </td>

                      {/* Notes & Row Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenNoteModal(alb)}
                            className={`p-1.5 rounded-lg border transition ${
                              alb.sapNotes
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                            title={alb.sapNotes ? `Nota SAP: ${alb.sapNotes}` : 'Añadir nota u observación SAP'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onEditAlbaran(alb)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-700 transition"
                            title="Editar datos de albarán"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {alb.sapNotes && (
                          <span
                            className="block text-[10px] text-sky-300/90 truncate max-w-[150px] mx-auto mt-1 italic"
                            title={alb.sapNotes}
                          >
                            "{alb.sapNotes}"
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>
            Mostrando <strong>{sortedAlbaranes.length}</strong> de <strong>{albaranes.length}</strong> viajes registrados en la planta
          </span>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-400 font-bold">
              ✓ Punteados: {checkedCount} ({checkedTons.toFixed(2)} t)
            </span>
            <span className="text-amber-400 font-bold">
              ⏳ Pendientes: {pendingCount} ({pendingTons.toFixed(2)} t)
            </span>
          </div>
        </div>
      </div>

      {/* 4. Modal for Editing SAP Note */}
      {noteEditingAlbaran && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-sky-400" />
                <span>Observaciones SAP - Albarán {noteEditingAlbaran.numAlbaran}</span>
              </h4>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Nº Asiento contable, pedido o anotación de verificación SAP:
              </label>
              <textarea
                rows={3}
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                placeholder="ej: Verificado con albarán SAP #89421 - Asiento contable 4410 - Facturado en remesa marzo"
                className="w-full bg-slate-950 text-white text-xs border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setNoteEditingAlbaran(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold px-4 py-1.5 rounded-xl text-xs transition shadow"
              >
                Guardar Observación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
