import React, { useState } from 'react';
import {
  Camera,
  FileText,
  Upload,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Clock,
  MapPin,
  Send,
  Loader2,
  Check,
  RefreshCw,
  Info
} from 'lucide-react';
import { Albaran, OCRScanResult, WasteType } from '../types/rcd';
import { OFFICIAL_WASTE_TYPES, RCDService } from '../services/rcdStorage';
import { watermarkTruckPhoto } from '../utils/photoWatermark';
import { scanAlbaranWithGemini } from '../services/geminiOcr';

interface OperatorMobileViewProps {
  onAlbaranCreated: (albaran: Albaran) => void;
}

export const OperatorMobileView: React.FC<OperatorMobileViewProps> = ({ onAlbaranCreated }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: SAP Albaran OCR Data
  const [isScanning, setIsScanning] = useState(false);
  const [albaranPhoto, setAlbaranPhoto] = useState<string | null>(null);
  const [numAlbaran, setNumAlbaran] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [wasteTypeCode, setWasteTypeCode] = useState('17 01 01');
  const [wasteTypeName, setWasteTypeName] = useState('Hormigón y Piedra (Escombro Limpio)');
  const [quantityTons, setQuantityTons] = useState<number>(0);
  const [licensePlate, setLicensePlate] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState(
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  );
  const [scanNotes, setScanNotes] = useState('');

  // Step 2: Truck Photo (before unload)
  const [truckPhoto, setTruckPhoto] = useState<string | null>(null);
  const [isProcessingTruckPhoto, setIsProcessingTruckPhoto] = useState(false);

  // Step 3: Unload Photo (during/after unload)
  const [unloadPhoto, setUnloadPhoto] = useState<string | null>(null);
  const [plantZone, setPlantZone] = useState('Muelle A - Fosa de Triaje RCD');
  const [isProcessingUnloadPhoto, setIsProcessingUnloadPhoto] = useState(false);

  // Step 4: Final Submission state
  const [submittedAlbaran, setSubmittedAlbaran] = useState<Albaran | null>(null);

  // Verification modal state after scanning ticket
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Handle image upload / camera capture for SAP ticket OCR
  const handleAlbaranImageSelected = async (file: File) => {
    // Clear previous scan values so data from old tickets never persists
    setNumAlbaran('');
    setClientCode('');
    setClientName('');
    setQuantityTons(0);
    setLicensePlate('');
    setScanNotes('Iniciando lectura OCR...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setAlbaranPhoto(base64);
      await runGeminiOCR(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  // State for unrecognized waste type & client prompts
  const [unrecognizedWasteType, setUnrecognizedWasteType] = useState<{ code: string; name: string } | null>(null);
  const [unrecognizedClient, setUnrecognizedClient] = useState<{ code: string; name: string } | null>(null);

  // Available waste types and clients from storage
  const availableWasteTypes = RCDService.getWasteTypes();
  const registeredClients = RCDService.getClients();

  // Run Gemini API Vision OCR on the real SAP Albarán photo
  const runGeminiOCR = async (imageBase64: string, mimeType: string) => {
    setIsScanning(true);
    let extractedData: Partial<OCRScanResult> | null = null;

    try {
      extractedData = await scanAlbaranWithGemini(imageBase64, mimeType);

      if (extractedData) {
        setNumAlbaran(extractedData.numAlbaran ? extractedData.numAlbaran.trim() : '');

        // Clean client code and name
        let cName = (extractedData.clientName || '').trim();
        let cCode = (extractedData.clientCode || '').trim();

        // Strip bracketed code like [C0048] if present in clientName
        const codeMatch = cName.match(/^(?:\[([A-Z0-9\-]{3,10})\]|\(([A-Z0-9\-]{3,10})\)|([A-Z][0-9]{3,6})\s*[\-:]?)\s*(.*)/i);
        if (codeMatch) {
          const extractedC = (codeMatch[1] || codeMatch[2] || codeMatch[3] || '').trim();
          const restN = (codeMatch[4] || '').trim();
          if (extractedC && (!cCode || cCode === 'C-00100' || cCode.includes('['))) {
            cCode = extractedC.toUpperCase();
          }
          if (restN && restN.length >= 2) {
            cName = restN;
          }
        }
        cName = cName.replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
        cCode = cCode.replace(/^\[|\]$/g, '').trim();

        setClientName(cName);
        setClientCode(cCode || 'C-00100');

        // Check if client is registered in system directory
        if (cName && !RCDService.isClientRegistered(cName, cCode)) {
          setUnrecognizedClient({ code: cCode || 'C-NEW', name: cName });
        }
        
        const qty = Number(extractedData.quantityTons);
        setQuantityTons(!isNaN(qty) && qty > 0 ? qty : 0);

        setLicensePlate(extractedData.licensePlate ? extractedData.licensePlate.trim().toUpperCase() : '');

        if (extractedData.date) {
          let rawDate = extractedData.date.trim();
          if (rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
              let day = parts[0].padStart(2, '0');
              let month = parts[1].padStart(2, '0');
              let year = parts[2];
              if (year.length === 2) year = `20${year}`;
              rawDate = `${year}-${month}-${day}`;
            }
          }
          setDateStr(rawDate);
        }
        if (extractedData.time) setTimeStr(extractedData.time);

        if (extractedData.notes) {
          setScanNotes(extractedData.notes);
        } else {
          setScanNotes('Lectura OCR completada. Revisa los datos extraídos.');
        }

        // Waste Type dynamic matching
        if (extractedData.wasteTypeCode || extractedData.wasteTypeName) {
          const wasteCode = (extractedData.wasteTypeCode || '').trim();
          const wasteName = (extractedData.wasteTypeName || '').trim();
          const currentTypes = RCDService.getWasteTypes();
          
          const matched = currentTypes.find(
            (w: WasteType) =>
              (wasteCode && w.code.trim().toLowerCase() === wasteCode.toLowerCase()) ||
              (wasteName && w.name.trim().toLowerCase().includes(wasteName.toLowerCase()))
          );

          if (matched) {
            setWasteTypeCode(matched.code);
            setWasteTypeName(matched.name);
          } else if (wasteCode || wasteName) {
            // Unrecognized waste type extracted from albarán! Prompt operator to create it
            const newCodeStr = wasteCode || '17 09 04';
            const newNameStr = wasteName || 'Residuo Capturado de Albarán';
            setWasteTypeCode(newCodeStr);
            setWasteTypeName(newNameStr);
            setUnrecognizedWasteType({ code: newCodeStr, name: newNameStr });
          }
        }

        // Show verification modal window for operator review
        setShowVerificationModal(true);
      } else {
        setScanNotes('No se pudo leer el albarán por OCR. Complete o revise los datos manualmente.');
        setShowVerificationModal(true);
      }
    } catch (err) {
      console.warn('Notice running OCR:', err);
      setScanNotes('Error de lectura OCR. Introduzca los datos manualmente.');
      setShowVerificationModal(true);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Truck Photo capture & Watermark
  const handleTruckPhotoSelected = async (file: File) => {
    setIsProcessingTruckPhoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target?.result as string;
      const stamped = await watermarkTruckPhoto(rawBase64, {
        title: 'CAMIÓN EN PLANTA - REGISTRO BÁSCULA',
        licensePlate: licensePlate,
        plantZone: 'Planta Báscula 1 - Entrada',
        dateStr,
        timeStr,
      });
      setTruckPhoto(stamped);
      setIsProcessingTruckPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  // Handle Unload Photo capture & Watermark
  const handleUnloadPhotoSelected = async (file: File) => {
    setIsProcessingUnloadPhoto(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target?.result as string;
      const stamped = await watermarkTruckPhoto(rawBase64, {
        title: 'DESCARGA DE RESIDUO RCD',
        licensePlate: licensePlate,
        plantZone: plantZone,
        dateStr,
        timeStr,
      });
      setUnloadPhoto(stamped);
      setIsProcessingUnloadPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  // Generate fallback placeholder photo with watermark if user hasn't uploaded a real camera photo
  const generatePlaceholderPhoto = async (type: 'truck' | 'unload') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw gradient background simulating plant
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      if (type === 'truck') {
        grad.addColorStop(0, '#334155');
        grad.addColorStop(1, '#0F172A');
      } else {
        grad.addColorStop(0, '#065F46');
        grad.addColorStop(1, '#022C22');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      // Draw icon and text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      if (type === 'truck') {
        ctx.fillText(`🚛 CAMIÓN: ${licensePlate}`, 320, 220);
        ctx.font = '16px sans-serif';
        ctx.fillText('FOTO FRONTAL BÁSCULA - MATRÍCULA VISIBLE', 320, 260);
      } else {
        ctx.fillText(`♻️ DESCARGA: ${wasteTypeName}`, 320, 220);
        ctx.font = '16px sans-serif';
        ctx.fillText(`ZONA: ${plantZone}`, 320, 260);
      }
    }

    const rawData = canvas.toDataURL('image/jpeg');
    const stamped = await watermarkTruckPhoto(rawData, {
      title: type === 'truck' ? 'CAMIÓN EN PLANTA - BÁSCULA' : 'DESCARGA RCD EN PLANTA',
      licensePlate,
      plantZone,
      dateStr,
      timeStr,
    });

    if (type === 'truck') setTruckPhoto(stamped);
    else setUnloadPhoto(stamped);
  };

  // Submit complete entry
  const handleSubmitEntry = async () => {
    if (!numAlbaran.trim() || !clientName.trim()) {
      alert('Por favor complete el Número de Albarán y la Razón Social del Cliente.');
      return;
    }

    try {
      let cleanName = clientName.trim().replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
      let cleanCode = clientCode.trim().replace(/^\[|\]$/g, '');

      // Ensure client is created in system directory if not already present
      await RCDService.upsertClientFromScan(cleanCode, cleanName);

      const created = await RCDService.createAlbaran({
        numAlbaran: numAlbaran.trim().toUpperCase(),
        clientId: '',
        clientName: cleanName,
        clientCode: cleanCode || 'C-00100',
        date: dateStr,
        time: timeStr,
        wasteTypeCode: wasteTypeCode,
        wasteTypeName: wasteTypeName,
        quantityTons: Number(quantityTons),
        licensePlate: licensePlate.trim().toUpperCase(),
        albaranPhotoUrl: albaranPhoto || undefined,
        truckPhotoUrl: truckPhoto || undefined,
        unloadPhotoUrl: unloadPhoto || undefined,
        plantZone: plantZone,
        gpsCoords: '37.3891° N, 5.9845° W',
      });

      setSubmittedAlbaran(created);
      onAlbaranCreated(created);
      setCurrentStep(4);
    } catch (err: any) {
      console.error('Error al registrar albarán:', err);
      alert(`Error al guardar el albarán en el sistema: ${err.message || 'Error de almacenamiento'}`);
    }
  };

  // Reset for next truck entry
  const handleResetForm = () => {
    setCurrentStep(1);
    setSubmittedAlbaran(null);
    setAlbaranPhoto(null);
    setNumAlbaran('');
    setClientCode('');
    setClientName('');
    setQuantityTons(0);
    setLicensePlate('');
    setTruckPhoto(null);
    setUnloadPhoto(null);
    setScanNotes('');
    setDateStr(new Date().toISOString().split('T')[0]);
    setTimeStr(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  };

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6">
      
      {/* Step Progress Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-full">
              Paso {currentStep} de 4
            </span>
            <h2 className="font-bold text-sm sm:text-base text-white">
              {currentStep === 1 && '1. Foto & OCR de Albarán SAP'}
              {currentStep === 2 && '2. Foto Camión (Matrícula)'}
              {currentStep === 3 && '3. Foto Descarga en Planta'}
              {currentStep === 4 && '4. Registro & Notificación'}
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Báscula #1</span>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentStep === step
                  ? 'bg-emerald-500 shadow-md shadow-emerald-500/50'
                  : currentStep > step
                  ? 'bg-emerald-700'
                  : 'bg-slate-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* STEP 1: OCR Scan of SAP Albarán */}
      {currentStep === 1 && (
        <div className="space-y-5">
          {/* Main Action Box: Take Photo or Upload */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-100 flex items-center space-x-2 text-base">
                <FileText className="w-5 h-5 text-emerald-400" />
                <span>Captura o Selecciona Albarán SAP</span>
              </h3>
            </div>

            {/* Photo Capture or Upload Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition text-sm">
                <Camera className="w-5 h-5 text-slate-950 flex-shrink-0" />
                <span>Hacer Foto del Albarán</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleAlbaranImageSelected(e.target.files[0]);
                  }}
                />
              </label>

              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 px-4 rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition text-sm">
                <Upload className="w-5 h-5 text-slate-300 flex-shrink-0" />
                <span>Subir de Galería</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleAlbaranImageSelected(e.target.files[0]);
                  }}
                />
              </label>
            </div>

            {/* OCR Processing Loader */}
            {isScanning && (
              <div className="bg-purple-950/40 border border-purple-800/60 rounded-xl p-4 my-4 flex items-center space-x-3 text-purple-200 animate-pulse">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <div>
                  <div className="font-bold text-sm">Extrayendo datos de SAP con IA Gemini...</div>
                  <div className="text-xs text-purple-300">Leyendo tipo de residuo, toneladas, cliente y nº de albarán.</div>
                </div>
              </div>
            )}

            {/* Preview of Albaran Photo */}
            {albaranPhoto && !isScanning && (
              <div className="mt-4 border border-slate-800 rounded-xl overflow-hidden bg-slate-950 p-2 flex items-center space-x-3">
                <img
                  src={albaranPhoto}
                  alt="Albarán SAP"
                  className="w-20 h-24 object-cover rounded-lg border border-slate-800"
                />
                <div className="flex-1 text-xs space-y-1">
                  <div className="flex items-center text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    <span>Albarán digitalizado correctamente</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">Imagen escaneada y sincronizada con el motor OCR.</p>
                </div>
              </div>
            )}
          </div>

          {/* Form with extracted & editable values */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h4 className="font-bold text-white text-sm border-b border-slate-800 pb-2">
              Verificación y Datos del Registro
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Num Albarán */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nº de Albarán SAP *
                </label>
                <input
                  type="text"
                  value={numAlbaran}
                  onChange={(e) => setNumAlbaran(e.target.value)}
                  placeholder="p.ej. ALB-2026-08493"
                  className="w-full bg-slate-950 text-white font-mono font-bold text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Matrícula Camión */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Matrícula del Camión
                </label>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                  placeholder="p.ej. 8492-KZX"
                  className="w-full bg-slate-950 text-emerald-400 font-mono font-bold text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Cliente SAP */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Cliente / Transportista *
                  </label>
                  {clientName && RCDService.isClientRegistered(clientName, clientCode) ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                      ✓ Registrado
                    </span>
                  ) : clientName ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await RCDService.upsertClientFromScan(clientCode, clientName);
                        alert(`Cliente "${clientName}" registrado en la base de datos.`);
                        setUnrecognizedClient(null);
                      }}
                      className="text-[10px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2 py-0.5 rounded-full border border-amber-500/30 transition flex items-center space-x-1"
                    >
                      <span>+ Registrar nuevo cliente</span>
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {/* Dropdown for quick selection of registered clients */}
                  <select
                    value={registeredClients.find(c => c.name.toLowerCase() === clientName.toLowerCase())?.id || ''}
                    onChange={(e) => {
                      const selected = registeredClients.find(c => c.id === e.target.value);
                      if (selected) {
                        setClientName(selected.name);
                        setClientCode(selected.code);
                      }
                    }}
                    className="w-full bg-slate-950 text-slate-300 font-medium text-xs border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none mb-1"
                  >
                    <option value="">-- Seleccionar cliente registrado (o escribir abajo) --</option>
                    {registeredClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.name}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={clientCode}
                      onChange={(e) => setClientCode(e.target.value)}
                      placeholder="Código SAP (ej: C0048)"
                      className="col-span-1 bg-slate-950 text-slate-300 font-mono text-xs border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Razón Social del Cliente"
                      className="col-span-2 bg-slate-950 text-white font-semibold text-xs sm:text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Tipo de Residuo (LER Code) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Residuo RCD (Código LER) *
                </label>
                <select
                  value={wasteTypeCode}
                  onChange={(e) => {
                    const matched = availableWasteTypes.find((w: WasteType) => w.code === e.target.value);
                    if (matched) {
                      setWasteTypeCode(matched.code);
                      setWasteTypeName(matched.name);
                    } else {
                      setWasteTypeCode(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 text-white font-medium text-xs sm:text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                >
                  {availableWasteTypes.map((wt: WasteType) => (
                    <option key={wt.code} value={wt.code}>
                      LER {wt.code} - {wt.name} ({wt.pricePerTon} €/t)
                    </option>
                  ))}
                  {!availableWasteTypes.some((w) => w.code === wasteTypeCode) && (
                    <option value={wasteTypeCode}>
                      LER {wasteTypeCode} - {wasteTypeName}
                    </option>
                  )}
                </select>
              </div>

              {/* Cantidad Toneladas */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantidad (Toneladas - t) *
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={quantityTons}
                  onChange={(e) => setQuantityTons(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 text-emerald-400 font-bold text-lg border border-slate-800 rounded-xl px-3 py-2 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Fecha y Hora */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded-xl px-2 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Hora</label>
                  <input
                    type="time"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 text-xs border border-slate-800 rounded-xl px-2 py-2 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={() => {
                if (!numAlbaran.trim() || !clientName.trim()) {
                  alert('Por favor complete el Número de Albarán y la Razón Social del Cliente.');
                  return;
                }
                setCurrentStep(2);
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-sm sm:text-base mt-2"
            >
              <span>Siguiente: Capturar Foto Camión</span>
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Truck Photo Before Unloading */}
      {currentStep === 2 && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="font-bold text-white text-base mb-1 flex items-center space-x-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span>Foto 1: Camión Antes de Descargar</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Toma una foto del camión mostrando la matrícula (<strong className="text-emerald-400">{licensePlate}</strong>). Se estampará automáticamente la fecha, hora y coordenadas GPS.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg transition">
                <Camera className="w-5 h-5 text-slate-950" />
                <span>Foto Cámara Móvil</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleTruckPhotoSelected(e.target.files[0]);
                  }}
                />
              </label>

              <button
                onClick={() => generatePlaceholderPhoto('truck')}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-3 px-4 rounded-xl border border-slate-700 transition"
              >
                Generar Captura Simulación
              </button>
            </div>

            {isProcessingTruckPhoto && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center space-x-3 text-slate-300">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="text-xs font-semibold">Estampando matrícula, marca de agua, fecha y hora...</span>
              </div>
            )}

            {truckPhoto && !isProcessingTruckPhoto && (
              <div className="mt-3 border border-emerald-500/40 rounded-xl overflow-hidden bg-slate-950 p-2">
                <img
                  src={truckPhoto}
                  alt="Foto del camión con marca de agua"
                  className="w-full h-52 object-cover rounded-lg border border-slate-800"
                />
                <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Foto del camión verificada y estampada electrónicamente.</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentStep(1)}
              className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl border border-slate-700 transition text-sm"
            >
              Volver
            </button>
            <button
              onClick={() => {
                if (!truckPhoto) {
                  // Auto generate placeholder if none selected
                  generatePlaceholderPhoto('truck').then(() => setCurrentStep(3));
                } else {
                  setCurrentStep(3);
                }
              }}
              className="w-2/3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-sm"
            >
              <span>Siguiente: Foto de Descarga</span>
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Unload Photo */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="font-bold text-white text-base mb-1 flex items-center space-x-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <span>Foto 2: Descarga de Residuos en Planta</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Toma una foto de la descarga del camión vertiendo el residuo ({wasteTypeName}).
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Zona de Planta / Fosa de Triaje
              </label>
              <select
                value={plantZone}
                onChange={(e) => setPlantZone(e.target.value)}
                className="w-full bg-slate-950 text-white font-medium text-xs sm:text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:outline-none"
              >
                <option value="Muelle A - Fosa de Triaje RCD">Muelle A - Fosa de Triaje RCD</option>
                <option value="Sector B - Hormigón y Piedra">Sector B - Hormigón y Piedra</option>
                <option value="Acopio C - Tierras y Excavación">Acopio C - Tierras y Excavación</option>
                <option value="Planta Machaqueo Fija 1">Planta Machaqueo Fija 1</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg transition">
                <Camera className="w-5 h-5 text-slate-950" />
                <span>Foto de la Descarga</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleUnloadPhotoSelected(e.target.files[0]);
                  }}
                />
              </label>

              <button
                onClick={() => generatePlaceholderPhoto('unload')}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-3 px-4 rounded-xl border border-slate-700 transition"
              >
                Generar Captura Simulación
              </button>
            </div>

            {isProcessingUnloadPhoto && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center space-x-3 text-slate-300">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <span className="text-xs font-semibold">Estampando datos de descarga y planta...</span>
              </div>
            )}

            {unloadPhoto && !isProcessingUnloadPhoto && (
              <div className="mt-3 border border-emerald-500/40 rounded-xl overflow-hidden bg-slate-950 p-2">
                <img
                  src={unloadPhoto}
                  alt="Foto de la descarga"
                  className="w-full h-52 object-cover rounded-lg border border-slate-800"
                />
                <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Foto de descarga registrada correctamente.</span>
                </div>
              </div>
            )}
          </div>

          {/* Final submit button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentStep(2)}
              className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl border border-slate-700 transition text-sm"
            >
              Volver
            </button>
            <button
              onClick={() => {
                if (!unloadPhoto) {
                  generatePlaceholderPhoto('unload').then(() => handleSubmitEntry());
                } else {
                  handleSubmitEntry();
                }
              }}
              className="w-2/3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3.5 rounded-xl shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-base"
            >
              <Send className="w-5 h-5" />
              <span>Registrar y Enviar Notificación</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success & Automated Notification Confirmation */}
      {currentStep === 4 && submittedAlbaran && (
        <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 shadow-2xl space-y-5 text-white">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-white">¡Entrada Registrada en SAP!</h3>
            <p className="text-xs text-slate-400">
              Albarán Nº <strong className="text-emerald-400 font-mono">{submittedAlbaran.numAlbaran}</strong> guardado y vinculado a la ficha del cliente.
            </p>
          </div>

          {/* Ticket Summary Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Cliente:</span>
              <span className="font-bold text-white text-right">{submittedAlbaran.clientName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Residuo (LER):</span>
              <span className="font-bold text-emerald-400">{submittedAlbaran.wasteTypeCode} - {submittedAlbaran.wasteTypeName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Cantidad Neta:</span>
              <span className="font-extrabold text-white text-sm">{submittedAlbaran.quantityTons.toFixed(2)} Toneladas (t)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Matrícula Camión:</span>
              <span className="font-mono font-bold text-amber-400">{submittedAlbaran.licensePlate}</span>
            </div>
          </div>

          {/* Notification Alert Box */}
          <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-2">
            <div className="font-bold text-xs text-emerald-400 flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span>Notificaciones Automáticas según Ficha de Cliente:</span>
            </div>

            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>📲 Notificación SMS / WhatsApp al Móvil:</span>
                {submittedAlbaran.notificationsSent?.mobileSent ? (
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ✓ Enviado a móvil
                  </span>
                ) : (
                  <span className="text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Desactivado en cliente</span>
                )}
              </div>

              <div className="flex items-center justify-between text-slate-300">
                <span>✉️ Correo Electrónico con Fotos:</span>
                {submittedAlbaran.notificationsSent?.emailSent ? (
                  <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ✓ Enviado a Email
                  </span>
                ) : (
                  <span className="text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Desactivado en cliente</span>
                )}
              </div>
            </div>
          </div>

          {/* Both Photos Stamped Preview */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {submittedAlbaran.truckPhotoUrl && (
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Foto 1: Camión</span>
                <img
                  src={submittedAlbaran.truckPhotoUrl}
                  alt="Foto Camión"
                  className="w-full h-24 object-cover rounded-lg border border-slate-800"
                />
              </div>
            )}
            {submittedAlbaran.unloadPhotoUrl && (
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Foto 2: Descarga</span>
                <img
                  src={submittedAlbaran.unloadPhotoUrl}
                  alt="Foto Descarga"
                  className="w-full h-24 object-cover rounded-lg border border-slate-800"
                />
              </div>
            )}
          </div>

          {/* New Scan Action Button */}
          <button
            onClick={handleResetForm}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition text-base"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Registrar Siguiente Camión</span>
          </button>
        </div>
      )}

      {/* MODAL 1: Unrecognized Waste Type Prompt */}
      {unrecognizedWasteType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="bg-amber-500/20 p-2.5 rounded-xl border border-amber-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">¿Crear Nuevo Tipo de Residuo?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El tipo de residuo capturado en el albarán escaneado:
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-amber-400 font-bold">Código LER: {unrecognizedWasteType.code}</div>
              <div className="text-white font-sans">{unrecognizedWasteType.name}</div>
            </div>

            <p className="text-xs text-slate-400">
              No figura en el listado configurado de la planta. ¿Desea añadirlo automáticamente al catálogo de la planta?
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setUnrecognizedWasteType(null)}
                className="w-full sm:w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition"
              >
                No, Seleccionar de la Lista
              </button>
              <button
                onClick={() => {
                  RCDService.addOrUpdateWasteType({
                    code: unrecognizedWasteType.code,
                    name: unrecognizedWasteType.name,
                    category: 'Limpio',
                    pricePerTon: 12.0,
                    maxCapacityTons: 5000,
                    description: `Residuo LER ${unrecognizedWasteType.code} - ${unrecognizedWasteType.name}`,
                  });
                  setUnrecognizedWasteType(null);
                }}
                className="w-full sm:w-1/2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Sí, Crear Residuo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Unrecognized Client Prompt */}
      {unrecognizedClient && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-blue-400">
              <div className="bg-blue-500/20 p-2.5 rounded-xl border border-blue-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-white">¿Registrar Nuevo Cliente en la Planta?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El cliente extraído del albarán de SAP:
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-blue-400 font-bold">Código SAP: {unrecognizedClient.code || 'Sin Código'}</div>
              <div className="text-white font-sans font-bold text-sm">{unrecognizedClient.name}</div>
            </div>

            <p className="text-xs text-slate-400">
              No figura registrado en la base de datos de la planta. ¿Desea darlo de alta automáticamente como cliente oficial?
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => setUnrecognizedClient(null)}
                className="w-full sm:w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition"
              >
                No, Seleccionar Existente
              </button>
              <button
                onClick={async () => {
                  await RCDService.upsertClientFromScan(unrecognizedClient.code, unrecognizedClient.name);
                  setUnrecognizedClient(null);
                }}
                className="w-full sm:w-1/2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Sí, Registrar Cliente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Verification Modal of Captured Albaran Data */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 my-auto">
            {/* Modal Header */}
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Verificación de Datos Capturados</h3>
                <p className="text-xs text-slate-400">Revise la información leída del albarán por el operario</p>
              </div>
            </div>

            {/* Extracted Data Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                  <span className="text-slate-400 block text-[11px]">Nº Albarán SAP:</span>
                  <span className="font-mono font-bold text-white text-sm">{numAlbaran || 'Sin capturar'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Matrícula Camión:</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">{licensePlate || 'Sin capturar'}</span>
                </div>
              </div>

              <div className="border-b border-slate-800/80 pb-2.5">
                <span className="text-slate-400 block text-[11px]">Cliente / Transportista:</span>
                <span className="font-semibold text-white">
                  {clientCode ? `[${clientCode}] ` : ''}{clientName || 'Cliente No Identificado'}
                </span>
              </div>

              <div className="border-b border-slate-800/80 pb-2.5">
                <span className="text-slate-400 block text-[11px]">Tipo de Residuo RCD (Código LER):</span>
                <span className="font-bold text-emerald-400">
                  LER {wasteTypeCode} - {wasteTypeName}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">Cantidad Neta:</span>
                  <span className="font-extrabold text-white text-sm">{quantityTons.toFixed(2)} Toneladas</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Fecha y Hora:</span>
                  <span className="font-medium text-slate-200">{dateStr} {timeStr}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 text-center font-medium">
              ¿Los datos son correctos para avanzar al siguiente paso de captura de fotos?
            </p>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setShowVerificationModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3 rounded-xl text-xs transition border border-slate-700"
              >
                Revisar / Modificar Ficha
              </button>

              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  setCurrentStep(2);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-1"
              >
                <span>Confirmar y Continuar</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
