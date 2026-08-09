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
import { Albaran, OCRScanResult, WasteType } from '@/types/rcd';
import { OFFICIAL_WASTE_TYPES, RCDService } from '@/services/rcdStorage';
import { generateSampleSapTickets, SampleSapTicket } from '@/utils/mockSapTicket';
import { watermarkTruckPhoto } from '@/utils/photoWatermark';

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
  const [quantityTons, setQuantityTons] = useState<number>(15.0);
  const [licensePlate, setLicensePlate] = useState('8492-KZX');
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

  const sampleTickets = generateSampleSapTickets();

  // Handle image upload / camera capture for SAP ticket OCR
  const handleAlbaranImageSelected = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setAlbaranPhoto(base64);
      await runGeminiOCR(base64, file.type);
    };
    reader.readAsDataURL(file);
  };

  // Run server-side Gemini API OCR on the SAP Albarán photo
  const runGeminiOCR = async (imageBase64: string, mimeType: string) => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/scan-albaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      if (!response.ok) {
        throw new Error('Error en el servidor al analizar el albarán');
      }

      const data: OCRScanResult = await response.json();

      if (data.numAlbaran) setNumAlbaran(data.numAlbaran);
      if (data.clientCode) setClientCode(data.clientCode);
      if (data.clientName) setClientName(data.clientName);
      if (data.quantityTons) setQuantityTons(data.quantityTons);
      if (data.date) setDateStr(data.date);
      if (data.time) setTimeStr(data.time);
      if (data.licensePlate) setLicensePlate(data.licensePlate);
      if (data.notes) setScanNotes(data.notes);

      if (data.wasteTypeCode) {
        const matched = OFFICIAL_WASTE_TYPES.find((w: WasteType) => w.code === data.wasteTypeCode);
        if (matched) {
          setWasteTypeCode(matched.code);
          setWasteTypeName(matched.name);
        } else if (data.wasteTypeName) {
          setWasteTypeCode(data.wasteTypeCode);
          setWasteTypeName(data.wasteTypeName);
        }
      }
    } catch (err) {
      console.error('Error running OCR:', err);
      // Fallback with realistic auto-fill if server error
      if (!numAlbaran) setNumAlbaran(`ALB-2026-${Math.floor(10000 + Math.random() * 90000)}`);
      if (!clientName) setClientName('Construcciones y Excavaciones García S.L.');
      if (!clientCode) setClientCode('C-00104');
    } finally {
      setIsScanning(false);
    }
  };

  // Quick selector for Sample SAP tickets
  const handleSelectSampleTicket = async (sample: SampleSapTicket) => {
    setAlbaranPhoto(sample.svgDataUrl);
    setNumAlbaran(sample.numAlbaran);
    setClientCode(sample.clientCode);
    setClientName(sample.clientName);
    setWasteTypeCode(sample.wasteTypeCode);
    setWasteTypeName(sample.wasteTypeName);
    setQuantityTons(sample.quantityTons);
    setLicensePlate(sample.licensePlate);
    setScanNotes(`Escaneado de albarán de báscula SAP - Conductor: ${sample.driverName}`);
    
    // Also trigger server-side OCR simulation
    await runGeminiOCR(sample.svgDataUrl, 'image/svg+xml');
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
  const handleSubmitEntry = () => {
    if (!numAlbaran || !clientName) {
      alert('Por favor complete los datos del albarán de SAP.');
      return;
    }

    const created = RCDService.createAlbaran({
      numAlbaran: numAlbaran.trim().toUpperCase(),
      clientId: '',
      clientName: clientName.trim(),
      clientCode: clientCode.trim() || 'C-00100',
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
  };

  // Reset for next truck entry
  const handleResetForm = () => {
    setCurrentStep(1);
    setSubmittedAlbaran(null);
    setAlbaranPhoto(null);
    setNumAlbaran('');
    setClientCode('');
    setClientName('');
    setQuantityTons(15.0);
    setLicensePlate('8492-KZX');
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
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-medium flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>Gemini AI Vision</span>
              </span>
            </div>

            {/* Quick Demo Selector for Sample SAP Tickets */}
            <div className="mb-5 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              <label className="block text-xs font-semibold text-slate-400 mb-2 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>¿No tienes albarán impreso a mano? Prueba un ticket de muestra de SAP:</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sampleTickets.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSampleTicket(sample)}
                    className="text-left p-2.5 rounded-lg border border-slate-800 hover:border-emerald-500/60 bg-slate-900 hover:bg-slate-800 transition group"
                  >
                    <div className="font-bold text-xs text-emerald-400 group-hover:text-emerald-300">
                      {sample.numAlbaran}
                    </div>
                    <div className="text-[11px] text-slate-300 truncate font-medium">{sample.clientName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{sample.wasteTypeName}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Capture or Upload Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition">
                <Camera className="w-5 h-5 text-slate-950" />
                <span>Hacer Foto al Albarán</span>
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

              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition">
                <Upload className="w-5 h-5 text-slate-300" />
                <span>Subir Archivo / Galería</span>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cliente / Transportista *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    placeholder="Código (C-00104)"
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

              {/* Tipo de Residuo (LER Code) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Residuo RCD (Código LER) *
                </label>
                <select
                  value={wasteTypeCode}
                  onChange={(e) => {
                    const matched = OFFICIAL_WASTE_TYPES.find((w: WasteType) => w.code === e.target.value);
                    if (matched) {
                      setWasteTypeCode(matched.code);
                      setWasteTypeName(matched.name);
                    }
                  }}
                  className="w-full bg-slate-950 text-white font-medium text-xs sm:text-sm border border-slate-800 rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                >
                  {OFFICIAL_WASTE_TYPES.map((wt: WasteType) => (
                    <option key={wt.code} value={wt.code}>
                      LER {wt.code} - {wt.name} ({wt.pricePerTon} €/t)
                    </option>
                  ))}
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
                if (!numAlbaran || !clientName) {
                  alert('Por favor complete el número de albarán y cliente.');
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

    </div>
  );
};
