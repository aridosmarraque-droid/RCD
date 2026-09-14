import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Download,
  Filter,
  Check,
  Building2,
  Truck,
  RotateCcw,
  Sparkles,
  Info,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { Albaran, Client } from '../types/rcd';
import { RCDService } from '../services/rcdStorage';
import { SendWhatsAppPhotoModal } from './SendWhatsAppPhotoModal';

interface SapExcelReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  albaranes: Albaran[];
  clients: Client[];
  onRefreshData: () => void;
}

export interface ExcelRowItem {
  rowIndex: number;
  client: string;
  date: string;
  numAlbaran: string;
  licensePlate: string;
  wasteType: string;
  quantity: number;
  raw: any[];
}

export interface MatchResult {
  excelItem: ExcelRowItem;
  plantAlbaran?: Albaran;
  isMatch: boolean;
  status: 'matched_pending' | 'matched_already_checked' | 'not_found' | 'discrepancy';
  discrepancies: string[];
}

export const SapExcelReconcileModal: React.FC<SapExcelReconcileModalProps> = ({
  isOpen,
  onClose,
  albaranes,
  clients,
  onRefreshData,
}) => {
  if (!isOpen) return null;

  // Wizard active step
  const [currentStep, setCurrentStep] = useState<'upload' | 'reconcile' | 'discrepancies'>('upload');

  // Upload state
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Analysis results
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);

  // WhatsApp modal state from inside reconciliation
  const [whatsAppAlbaran, setWhatsAppAlbaran] = useState<Albaran | null>(null);
  const [whatsAppComment, setWhatsAppComment] = useState('');

  // Bulk processing
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Discrepancy list filter
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'not_found' | 'waste_weight'>('all');

  // --- Helpers for Normalizing Data ---
  const normalizePlate = (plate?: string) => {
    if (!plate) return '';
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  const normalizeAlbaranNum = (num?: any) => {
    if (num === undefined || num === null) return '';
    let str = String(num).trim();
    // remove trailing decimals like 2607924.0
    str = str.replace(/\.0$/, '');
    // remove leading # or spaces
    str = str.replace(/^[#\s]+/, '');
    return str.toLowerCase();
  };

  const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel serial date code
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    // Support DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
    if (dmyMatch) {
      let day = dmyMatch[1].padStart(2, '0');
      let month = dmyMatch[2].padStart(2, '0');
      let year = dmyMatch[3];
      if (year.length === 2) year = `20${year}`;
      return `${year}-${month}-${day}`;
    }
    // Support YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/);
    if (ymdMatch) {
      return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    }
    return str;
  };

  const parseQuantity = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // --- Excel File Processing ---
  const processExcelFile = async (file: File) => {
    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Read as raw 2D array of rows
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('El archivo Excel está vacío o no contiene filas con datos.');
      }

      const parsedItems: ExcelRowItem[] = [];
      let currentClientGroup = '';

      // Structure specified by user:
      // Col 1 (index 0): Cliente (agrupación de albaranes por cliente)
      // Col 3 (index 2): Fecha
      // Col 4 (index 3): Número albarán SAP
      // Col 5 (index 4): Matrícula
      // Col 9 (index 8): Tipo de escombro
      // Col 12 (index 11): Cantidad (toneladas)
      for (let r = 0; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        // Skip potential header rows if Col 4 or Col 3 looks like text header
        const col3Str = String(row[2] || '').toLowerCase();
        const col4Str = String(row[3] || '').toLowerCase();
        if (
          r <= 3 &&
          (col4Str.includes('albar') ||
            col4Str.includes('sap') ||
            col3Str.includes('fecha') ||
            col4Str.includes('número') ||
            col4Str.includes('nº'))
        ) {
          continue;
        }

        // Update current client group if Col 1 has a value
        const rawClient = String(row[0] || '').trim();
        if (rawClient && !rawClient.toLowerCase().includes('cliente') && !rawClient.toLowerCase().includes('resumen')) {
          currentClientGroup = rawClient;
        }

        const rawNumAlbaran = row[3];
        const rawDate = row[2];
        const rawPlate = row[4];
        const rawWasteType = row[8];
        const rawQty = row[11];

        const cleanNum = normalizeAlbaranNum(rawNumAlbaran);
        // If there's no albaran number in this row, check if row has enough data to be a valid delivery note
        if (!cleanNum && !rawPlate) continue;

        parsedItems.push({
          rowIndex: r + 1,
          client: currentClientGroup || String(row[0] || '').trim(),
          date: parseExcelDate(rawDate),
          numAlbaran: String(rawNumAlbaran || '').trim(),
          licensePlate: String(rawPlate || '').trim(),
          wasteType: String(rawWasteType || '').trim(),
          quantity: parseQuantity(rawQty),
          raw: row,
        });
      }

      if (parsedItems.length === 0) {
        throw new Error(
          'No se detectaron albaranes válidos en el archivo. Verifique que el archivo incluya las columnas especificadas (Col 1: Cliente, Col 3: Fecha, Col 4: Nº Albarán, Col 5: Matrícula, Col 9: Tipo Escombro, Col 12: Cantidad).'
        );
      }

      // --- Match against plant albaranes ---
      const results: MatchResult[] = parsedItems.map((item) => {
        const cleanExcelNum = normalizeAlbaranNum(item.numAlbaran);
        const cleanExcelPlate = normalizePlate(item.licensePlate);

        // 1. Match by albaran number
        let matched = albaranes.find((a) => normalizeAlbaranNum(a.numAlbaran) === cleanExcelNum);

        // 2. Fallback match by plate + date if not found by number
        if (!matched && cleanExcelPlate && item.date) {
          matched = albaranes.find(
            (a) => normalizePlate(a.licensePlate) === cleanExcelPlate && a.date === item.date
          );
        }

        const discrepancies: string[] = [];

        if (matched) {
          // Check weight difference (> 0.5 t is flagged)
          if (item.quantity > 0 && matched.quantityTons > 0) {
            const diff = Math.abs(matched.quantityTons - item.quantity);
            if (diff >= 0.5) {
              discrepancies.push(
                `Diferencia de peso: Excel declara ${item.quantity.toFixed(2)} t pero en planta pesó ${matched.quantityTons.toFixed(2)} t (dif: ${diff.toFixed(2)} t).`
              );
            }
          }

          // Check waste type discrepancy
          if (item.wasteType) {
            const excelWasteNorm = item.wasteType.toLowerCase();
            const plantWasteNorm = `${matched.wasteTypeCode} ${matched.wasteTypeName}`.toLowerCase();
            const words = excelWasteNorm.split(/\s+/).filter((w) => w.length > 3);
            const matchesSomeWord = words.some((w) => plantWasteNorm.includes(w));
            if (!matchesSomeWord && words.length > 0) {
              discrepancies.push(
                `Diferencia de residuo: Excel indica "${item.wasteType}" vs Planta "${matched.wasteTypeCode} - ${matched.wasteTypeName}".`
              );
            }
          }

          const status: MatchResult['status'] = matched.sapChecked
            ? 'matched_already_checked'
            : discrepancies.length > 0
            ? 'discrepancy'
            : 'matched_pending';

          return {
            excelItem: item,
            plantAlbaran: matched,
            isMatch: true,
            status,
            discrepancies,
          };
        } else {
          return {
            excelItem: item,
            plantAlbaran: undefined,
            isMatch: false,
            status: 'not_found',
            discrepancies: ['Albarán no encontrado en el registro de báscula de la planta.'],
          };
        }
      });

      setMatchResults(results);

      // Focus first pending or matched item for review
      const firstPendingIndex = results.findIndex(
        (r) => r.isMatch && (r.status === 'matched_pending' || r.status === 'discrepancy')
      );
      setActiveReviewIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0);

      // Auto advance to reconcile view
      setCurrentStep('reconcile');
    } catch (err: any) {
      setParseError(err.message || 'Error al procesar el archivo Excel.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  // --- Metrics ---
  const matchedResults = useMemo(() => matchResults.filter((r) => r.isMatch), [matchResults]);
  const matchedPendingResults = useMemo(
    () => matchResults.filter((r) => r.isMatch && !r.plantAlbaran?.sapChecked),
    [matchResults]
  );
  const matchedCheckedResults = useMemo(
    () => matchResults.filter((r) => r.isMatch && r.plantAlbaran?.sapChecked),
    [matchResults]
  );
  const discrepancyResults = useMemo(
    () => matchResults.filter((r) => !r.isMatch || r.discrepancies.length > 0),
    [matchResults]
  );
  const notFoundResults = useMemo(() => matchResults.filter((r) => !r.isMatch), [matchResults]);

  // Current item in review
  const currentReviewItem = matchedResults[activeReviewIndex] || matchedResults[0];

  // --- Actions ---
  // Single Reconcile / Check
  const handleReconcileSingle = async (item: MatchResult) => {
    if (!item.plantAlbaran) return;
    try {
      const updated = await RCDService.toggleSapChecked(
        item.plantAlbaran.id,
        true,
        `Reconciliado con Excel SAP (${item.excelItem.numAlbaran || item.plantAlbaran.numAlbaran})`,
        'Reconciliación Excel',
        item.plantAlbaran
      );

      // Update in local state
      setMatchResults((prev) =>
        prev.map((r) =>
          r.plantAlbaran?.id === item.plantAlbaran?.id
            ? { ...r, plantAlbaran: updated, status: 'matched_already_checked' }
            : r
        )
      );

      onRefreshData();

      // Show temporary badge and advance to next pending
      setStatusNotification(`✓ Albarán Nº ${updated.numAlbaran} punteado con éxito.`);
      setTimeout(() => setStatusNotification(null), 3000);

      if (activeReviewIndex < matchedResults.length - 1) {
        setActiveReviewIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Error al reconciliar el albarán.');
    }
  };

  // Bulk Reconcile All Pending Matches
  const handleBulkReconcileAll = async () => {
    const idsToReconcile = matchedPendingResults
      .map((r) => r.plantAlbaran?.id)
      .filter((id): id is string => Boolean(id));

    if (idsToReconcile.length === 0) {
      alert('No hay albaranes coincidentes pendientes de reconciliar.');
      return;
    }

    setIsProcessingBulk(true);
    try {
      await RCDService.bulkSetSapChecked(
        idsToReconcile,
        true,
        'Punteo masivo verificado con Excel SAP',
        'Reconciliación Excel',
        albaranes
      );

      // Update in local state
      setMatchResults((prev) =>
        prev.map((r) => {
          if (r.plantAlbaran && idsToReconcile.includes(r.plantAlbaran.id)) {
            return {
              ...r,
              status: 'matched_already_checked',
              plantAlbaran: { ...r.plantAlbaran, sapChecked: true },
            };
          }
          return r;
        })
      );

      onRefreshData();
      setStatusNotification(`✓ ${idsToReconcile.length} albaranes han sido reconciliados y punteados en SAP.`);
      setTimeout(() => setStatusNotification(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error en el punteo masivo.');
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Open WhatsApp Modal for Discrepancy
  const handleOpenWhatsApp = (item: MatchResult) => {
    if (!item.plantAlbaran) return;
    const alb = item.plantAlbaran;
    const excel = item.excelItem;

    let defaultComment =
      `⚠️ *DISCREPANCIA EN ALBARÁN SAP Nº ${alb.numAlbaran}*\n` +
      `Cliente: ${alb.clientName}\n` +
      `Matrícula: ${alb.licensePlate} | Fecha: ${alb.date}\n` +
      `• Residuo en Excel SAP: ${excel.wasteType || 'No especificado'}\n` +
      `• Residuo en Planta RCD: ${alb.wasteTypeCode} - ${alb.wasteTypeName}\n`;

    if (item.discrepancies.length > 0) {
      defaultComment += `\n*Incidencias detectadas:*\n` + item.discrepancies.map((d) => `• ${d}`).join('\n') + `\n`;
    }

    defaultComment += `\nAdjuntamos la fotografía de la descarga en foso para su comprobación visual.`;

    setWhatsAppAlbaran(alb);
    setWhatsAppComment(defaultComment);
  };

  // Export Discrepancies to CSV
  const handleExportDiscrepancies = () => {
    if (discrepancyResults.length === 0) {
      alert('No se registraron discrepancias en el archivo.');
      return;
    }

    const headers = [
      'Fila Excel',
      'Estado',
      'Cliente Excel',
      'Fecha Excel',
      'Nº Albarán SAP',
      'Matrícula Excel',
      'Residuo Excel',
      'Toneladas Excel',
      'Existe en Planta',
      'Nº Albarán Planta',
      'Residuo Planta',
      'Toneladas Planta',
      'Detalle de Discrepancia',
    ];

    const rows = discrepancyResults.map((r) => [
      r.excelItem.rowIndex,
      r.status === 'not_found' ? 'NO ENCONTRADO EN PLANTA' : 'DISCREPANCIA RESIDUO/PESO',
      `"${(r.excelItem.client || '').replace(/"/g, '""')}"`,
      `"${r.excelItem.date || ''}"`,
      `"${r.excelItem.numAlbaran || ''}"`,
      `"${r.excelItem.licensePlate || ''}"`,
      `"${(r.excelItem.wasteType || '').replace(/"/g, '""')}"`,
      `"${r.excelItem.quantity.toFixed(2).replace('.', ',')}"`,
      r.plantAlbaran ? 'SÍ' : 'NO',
      `"${r.plantAlbaran?.numAlbaran || ''}"`,
      `"${(r.plantAlbaran?.wasteTypeName || '').replace(/"/g, '""')}"`,
      `"${(r.plantAlbaran?.quantityTons || 0).toFixed(2).replace('.', ',')}"`,
      `"${r.discrepancies.join(' | ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Discrepancias_Punteo_SAP_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto flex flex-col max-h-[92vh]">
          {/* 1. Modal Header & Step Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                  <span>Punteo y Reconciliación Automática con Excel SAP</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Cruce automático de albaranes, verificación visual de fotos de descarga y detección de incidencias
                </p>
              </div>
            </div>

            {/* Step Tabs */}
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 ${
                  currentStep === 'upload'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>1. Cargar Excel</span>
              </button>

              <button
                type="button"
                disabled={matchResults.length === 0}
                onClick={() => setCurrentStep('reconcile')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 disabled:opacity-40 ${
                  currentStep === 'reconcile'
                    ? 'bg-emerald-500 text-slate-950 shadow font-extrabold'
                    : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <span>2. Reconciliación ({matchedResults.length})</span>
              </button>

              <button
                type="button"
                disabled={matchResults.length === 0}
                onClick={() => setCurrentStep('discrepancies')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 disabled:opacity-40 ${
                  currentStep === 'discrepancies'
                    ? 'bg-rose-500 text-slate-950 shadow font-extrabold'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <span>3. Discrepancias ({discrepancyResults.length})</span>
              </button>

              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status notification toast */}
          {statusNotification && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 shrink-0 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusNotification}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: FILE UPLOAD & COLUMN MAPPING GUIDE */}
          {/* ============================================================ */}
          {currentStep === 'upload' && (
            <div className="space-y-4 overflow-y-auto py-2">
              {/* Structure Explanation Banner */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-sky-400">
                  <Info className="w-4 h-4" />
                  <span>Estructura Requerida del Archivo Excel SAP:</span>
                </div>
                <p className="text-xs text-slate-300">
                  El sistema leerá directamente las siguientes columnas del informe exportado de SAP:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 1 (A)</span>
                    <strong className="text-white block text-xs mt-0.5">Cliente</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Agrupación de viajes</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 3 (C)</span>
                    <strong className="text-white block text-xs mt-0.5">Fecha</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">ej: 03/09/2026</span>
                  </div>

                  <div className="bg-slate-900 border border-emerald-500/40 p-2.5 rounded-xl bg-emerald-950/20">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 4 (D)</span>
                    <strong className="text-emerald-300 block text-xs mt-0.5">Nº Albarán SAP</strong>
                    <span className="text-[10px] text-emerald-400/80 block mt-0.5">Clave de coincidencia</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 5 (E)</span>
                    <strong className="text-white block text-xs mt-0.5">Matrícula</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Camión de transporte</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 9 (I)</span>
                    <strong className="text-white block text-xs mt-0.5">Tipo Escombro</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Hormigón, sucio, etc.</span>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">Columna 12 (L)</span>
                    <strong className="text-white block text-xs mt-0.5">Cantidad</strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Toneladas declaradas</span>
                  </div>
                </div>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950 hover:bg-slate-900/60 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3 shadow-inner"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />

                <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Upload className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-white">
                    Haga clic aquí para seleccionar el archivo Excel o arrástrelo
                  </h4>
                  <p className="text-xs text-slate-400">
                    Formatos soportados: <strong className="text-emerald-400">.xlsx, .xls, .csv</strong>
                  </p>
                </div>

                {fileName && (
                  <div className="bg-slate-900 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>{fileName}</span>
                  </div>
                )}

                {isParsing && (
                  <div className="text-xs text-sky-400 flex items-center space-x-2">
                    <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <span>Analizando albaranes y cruzando datos con la báscula de la planta...</span>
                  </div>
                )}
              </div>

              {/* Parsing Error Box */}
              {parseError && (
                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{parseError}</span>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: RECONCILIATION & PHOTO VERIFICATION (COINCIDENCIAS) */}
          {/* ============================================================ */}
          {currentStep === 'reconcile' && (
            <div className="space-y-4 overflow-y-auto py-1 flex-1">
              {/* Summary Metrics Bar */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Leídos de Excel</span>
                  <span className="text-lg font-black text-white">{matchResults.length} albaranes</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Coincidentes en Planta</span>
                  <span className="text-lg font-black text-emerald-400">
                    {matchedResults.length}{' '}
                    <span className="text-xs text-slate-400">({matchedPendingResults.length} pendientes)</span>
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Ya Punteados</span>
                  <span className="text-lg font-black text-sky-400">{matchedCheckedResults.length} albaranes</span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Incidencias / No Hallados</span>
                  <span className="text-lg font-black text-rose-400">{discrepancyResults.length} casos</span>
                </div>
              </div>

              {/* Bulk Reconcile Action Button */}
              {matchedPendingResults.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-emerald-200">
                      Hay <strong>{matchedPendingResults.length}</strong> albaranes coincidentes listos para puntear en SAP.
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessingBulk}
                    onClick={handleBulkReconcileAll}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-3.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 shadow"
                  >
                    <Check className="w-4 h-4" />
                    <span>Reconciliar Todos los Coincidentes ({matchedPendingResults.length})</span>
                  </button>
                </div>
              )}

              {/* Interactive Reviewer Card */}
              {currentReviewItem ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  {/* Navigator Bar */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="bg-slate-800 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                        {activeReviewIndex + 1} de {matchedResults.length}
                      </span>
                      <span className="text-xs text-slate-400">Albarán coincidente en revisión:</span>
                      <strong className="text-emerald-400 font-mono text-sm">
                        {currentReviewItem.plantAlbaran?.numAlbaran || currentReviewItem.excelItem.numAlbaran}
                      </strong>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        disabled={activeReviewIndex === 0}
                        onClick={() => setActiveReviewIndex((prev) => Math.max(0, prev - 1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
                        title="Albarán anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={activeReviewIndex >= matchedResults.length - 1}
                        onClick={() => setActiveReviewIndex((prev) => Math.min(matchedResults.length - 1, prev + 1))}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
                        title="Siguiente albarán"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Visual Layout: Photo on Left, Comparative Summary on Right */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* LEFT (Cols 5): Foto de la Descarga */}
                    <div className="lg:col-span-5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <Camera className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Foto de Descarga en Foso:</span>
                        </span>
                        {currentReviewItem.plantAlbaran?.unloadPhotoUrl ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                            ✓ Foto Registrada
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                            Sin Foto Descarga
                          </span>
                        )}
                      </div>

                      <div className="relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden h-56 sm:h-64 flex items-center justify-center shadow-lg">
                        {currentReviewItem.plantAlbaran?.unloadPhotoUrl ? (
                          <>
                            <img
                              src={currentReviewItem.plantAlbaran.unloadPhotoUrl}
                              alt="Foto de la descarga"
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded border border-slate-700 font-mono">
                              {currentReviewItem.plantAlbaran.licensePlate} • {currentReviewItem.plantAlbaran.date}
                            </div>
                          </>
                        ) : currentReviewItem.plantAlbaran?.truckPhotoUrl ? (
                          <>
                            <img
                              src={currentReviewItem.plantAlbaran.truckPhotoUrl}
                              alt="Foto del camión"
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-sm text-amber-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 font-mono">
                              (Foto del camión)
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-4 text-slate-500">
                            <Camera className="w-8 h-8 mx-auto mb-1 text-slate-600 opacity-50" />
                            <p className="text-xs font-semibold text-slate-400">Sin foto de descarga en báscula</p>
                          </div>
                        )}
                      </div>

                      {/* Discrepancy Alert Box if detected */}
                      {currentReviewItem.discrepancies.length > 0 && (
                        <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 space-y-1">
                          <div className="flex items-center space-x-1.5 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Alerta de Discrepancia:</span>
                          </div>
                          {currentReviewItem.discrepancies.map((d, i) => (
                            <p key={i} className="text-[11px] text-amber-200/90 pl-5">
                              • {d}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* RIGHT (Cols 7): Resumen Comparativo de la Operación */}
                    <div className="lg:col-span-7 space-y-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Resumen Comparativo de la Operación
                        </span>
                        <h4 className="text-sm font-black text-white mt-0.5">
                          SAP Excel vs Registro en Báscula de Planta
                        </h4>
                      </div>

                      {/* Comparison Table */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full">
                          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                            <tr>
                              <th className="py-2 px-3 text-left">Concepto</th>
                              <th className="py-2 px-3 text-left text-sky-400">Informe SAP (Excel)</th>
                              <th className="py-2 px-3 text-left text-emerald-400">Báscula Planta (RCD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Nº Albarán</td>
                              <td className="py-2 px-3 font-mono font-bold text-white">
                                {currentReviewItem.excelItem.numAlbaran}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                                {currentReviewItem.plantAlbaran?.numAlbaran}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Fecha / Hora</td>
                              <td className="py-2 px-3 text-slate-200">
                                {currentReviewItem.excelItem.date || '--'}
                              </td>
                              <td className="py-2 px-3 text-slate-200 font-medium">
                                {currentReviewItem.plantAlbaran?.date} {currentReviewItem.plantAlbaran?.time || ''}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Cliente</td>
                              <td className="py-2 px-3 text-slate-200 font-semibold truncate max-w-[150px]" title={currentReviewItem.excelItem.client}>
                                {currentReviewItem.excelItem.client || 'Sin especificar'}
                              </td>
                              <td className="py-2 px-3 text-emerald-300 font-semibold truncate max-w-[150px]" title={currentReviewItem.plantAlbaran?.clientName}>
                                {currentReviewItem.plantAlbaran?.clientName}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Matrícula</td>
                              <td className="py-2 px-3 font-mono font-bold text-amber-300">
                                {currentReviewItem.excelItem.licensePlate}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-amber-300">
                                {currentReviewItem.plantAlbaran?.licensePlate}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Tipo de Residuo</td>
                              <td className="py-2 px-3 text-slate-200 font-semibold">
                                {currentReviewItem.excelItem.wasteType || '--'}
                              </td>
                              <td className="py-2 px-3 text-emerald-400 font-bold">
                                {currentReviewItem.plantAlbaran?.wasteTypeCode} - {currentReviewItem.plantAlbaran?.wasteTypeName}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Cantidad / Peso</td>
                              <td className="py-2 px-3 font-bold text-white">
                                {currentReviewItem.excelItem.quantity.toFixed(2)} t
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-400">
                                {currentReviewItem.plantAlbaran?.quantityTons.toFixed(2)} t
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 px-3 font-semibold text-slate-400">Estado de Punteo</td>
                              <td className="py-2 px-3 text-slate-400">Albarán en Excel</td>
                              <td className="py-2 px-3">
                                {currentReviewItem.plantAlbaran?.sapChecked ? (
                                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>✓ Punteado en SAP</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-400 font-bold flex items-center space-x-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>⏳ Pendiente de puntear</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Operation Action Buttons (Reconcile or WhatsApp) */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {/* 1. Send WhatsApp button in case of discrepancy between photo and waste type */}
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsApp(currentReviewItem)}
                          className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow"
                          title="Enviar WhatsApp al cliente/comercial con la foto de la descarga por discrepancia de residuo"
                        >
                          <MessageSquare className="w-4 h-4 text-emerald-400" />
                          <span>Enviar WhatsApp con Foto</span>
                        </button>

                        {/* 2. Reconcile / Check button */}
                        <button
                          type="button"
                          onClick={() => handleReconcileSingle(currentReviewItem)}
                          className={`font-black px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow ${
                            currentReviewItem.plantAlbaran?.sapChecked
                              ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {currentReviewItem.plantAlbaran?.sapChecked
                              ? 'Reconciliado (Haga clic para desmarcar)'
                              : 'Reconciliar / Marcar Punteado'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-white">No hay albaranes coincidentes pendientes.</p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: DISCREPANCIES AND NON-MATCHED DELIVERIES SUMMARY */}
          {/* ============================================================ */}
          {currentStep === 'discrepancies' && (
            <div className="space-y-4 overflow-y-auto py-1 flex-1">
              {/* Header & Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Informe de Albaranes con Problemas de Coincidencia</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Albaranes del informe SAP que no figuran en planta o que presentan diferencias de tipo de residuo/peso
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setDiscrepancyFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        discrepancyFilter === 'all'
                          ? 'bg-rose-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Todos ({discrepancyResults.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscrepancyFilter('not_found')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        discrepancyFilter === 'not_found'
                          ? 'bg-rose-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      No encontrados ({notFoundResults.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportDiscrepancies}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center space-x-1.5 shadow"
                    title="Descargar informe de discrepancias en Excel / CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Exportar Incidencias</span>
                  </button>
                </div>
              </div>

              {/* Discrepancy Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-xs text-slate-300">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Fila</th>
                        <th className="py-2.5 px-3 text-left">Estado</th>
                        <th className="py-2.5 px-3 text-left">Nº Albarán SAP</th>
                        <th className="py-2.5 px-3 text-left">Fecha</th>
                        <th className="py-2.5 px-3 text-left">Cliente</th>
                        <th className="py-2.5 px-3 text-left">Matrícula</th>
                        <th className="py-2.5 px-3 text-left">Residuo (Excel vs Planta)</th>
                        <th className="py-2.5 px-3 text-right">Peso (Excel / Planta)</th>
                        <th className="py-2.5 px-3 text-left">Detalle Incidencia</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {discrepancyResults.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-500">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
                            <p className="text-xs font-semibold text-slate-400">
                              ¡Perfecto! No se ha detectado ninguna discrepancia ni albaranes faltantes.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        discrepancyResults
                          .filter((r) => (discrepancyFilter === 'not_found' ? !r.isMatch : true))
                          .map((r, i) => {
                            const isNotFound = !r.isMatch;
                            return (
                              <tr
                                key={i}
                                className={`transition ${
                                  isNotFound ? 'bg-rose-950/20 hover:bg-rose-950/30' : 'bg-amber-950/15 hover:bg-amber-950/25'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                  {r.excelItem.rowIndex}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {isNotFound ? (
                                    <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-500/30">
                                      No en planta
                                    </span>
                                  ) : (
                                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/30">
                                      Discrepancia
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-white">
                                  {r.excelItem.numAlbaran || '--'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">{r.excelItem.date || '--'}</td>
                                <td className="py-2.5 px-3 max-w-[140px] truncate" title={r.excelItem.client}>
                                  {r.excelItem.client || 'Sin cliente'}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                                  {r.excelItem.licensePlate || '--'}
                                </td>
                                <td className="py-2.5 px-3 max-w-[180px]">
                                  <span className="block text-slate-300 truncate" title={r.excelItem.wasteType}>
                                    Ex: {r.excelItem.wasteType || 'Sin dato'}
                                  </span>
                                  {r.plantAlbaran && (
                                    <span className="block text-emerald-400 text-[11px] truncate" title={r.plantAlbaran.wasteTypeName}>
                                      Pl: {r.plantAlbaran.wasteTypeCode} - {r.plantAlbaran.wasteTypeName}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                                  <span className="text-white font-bold">{r.excelItem.quantity.toFixed(2)} t</span>
                                  {r.plantAlbaran && (
                                    <span className="block text-emerald-400 text-[11px]">
                                      Pl: {r.plantAlbaran.quantityTons.toFixed(2)} t
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-[200px]">
                                  {r.discrepancies.join(' • ')}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {r.plantAlbaran && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenWhatsApp(r)}
                                      className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
                                      title="Enviar WhatsApp con foto de descarga"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0 text-xs">
            <div className="text-slate-400 text-[11px]">
              {fileName ? (
                <span>
                  Archivo cargado: <strong className="text-white font-mono">{fileName}</strong>
                </span>
              ) : (
                <span>Cargue un archivo .xlsx de SAP para iniciar la reconciliación</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {currentStep === 'reconcile' && (
                <button
                  type="button"
                  onClick={() => setCurrentStep('discrepancies')}
                  className="bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
                >
                  <span>Ver Discrepancias ({discrepancyResults.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentStep === 'discrepancies' && (
                <button
                  type="button"
                  onClick={() => setCurrentStep('reconcile')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3 py-1.5 rounded-xl transition flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a Reconciliación</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-1.5 rounded-xl transition"
              >
                Finalizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded WhatsApp modal if triggered */}
      {whatsAppAlbaran && (
        <SendWhatsAppPhotoModal
          isOpen={Boolean(whatsAppAlbaran)}
          onClose={() => setWhatsAppAlbaran(null)}
          albaran={whatsAppAlbaran}
          clients={clients}
          initialComment={whatsAppComment}
        />
      )}
    </>
  );
};
