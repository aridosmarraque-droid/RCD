import { OCRScanResult } from '../types/rcd';

const ALBARAN_PROMPT = `Actúa como un sistema experto de OCR y visión artificial de máxima precisión especializado en los albaranes de entrega y pesaje de la empresa "ÁRIDOS MARRAQUE S.L." (y plantas de valorización de RCD / canteras de áridos).

Todos los albaranes siguen una estructura visual estándar idéntica dividida en las siguientes zonas:

1. ENCABEZADO SUPERIOR:
   - "ARIDOS MARRAQUE S.L." (B04117818, Avda. Federico Garcia Lorca s/n 04260 Rioja).
   - Puede figurar la palabra "Original" en la esquina superior derecha.

2. BLOQUE SUPERIOR IZQUIERDO (Bajo el título "Albaran de Entrega"):
   - "Fecha : DD/MM/YY" o "DD/MM/YYYY" (ejemplo: "Fecha : 02/09/26" significa 02 de Septiembre de 2026 -> convertir a formato ISO "2026-09-02").
   - "Nº Albaran : XXXXXXX" -> Número de 7 dígitos (ej: "2607873", "2607584").
   - "Cód. Cliente : CXXXX" -> Letra C seguida de 4 dígitos (ej: "C0096", "C0048", "C0012", "C0100").

3. BLOQUE SUPERIOR DERECHO (Datos del Cliente / Empresa):
   - Primera línea en negrita: Razón social del Cliente (ej: "MATERIALES DE CONSTRUCCION NEGI", "ANGEL ARTES SANCHEZ S.L.").
   - Líneas intermedias: Dirección de la empresa (ej: "C/RAMON Y CAJAL, Nº6 \n 04250 PECHINA \n ALMERIA").
   - Última línea: "ID fiscal : ESBXXXXXXXX" o "BXXXXXXXX" (ej: "ESB04435194", "B04221487").

4. TABLA CENTRAL DE MATERIAL / PESAJE:
   - Cabeceras de columnas: | Núm | Descripción | Bruto | Tara | Cantidad |
   - Fila de datos del residuo:
     • "Núm": Código interno (ej: "GRVA2", "HORM1", "ESCO1", "RCD01").
     • "Descripción": Nombre del residuo con su código LER entre paréntesis.
       Ejemplo: "TN DE ESCOMBRO SUCIO (LER 17 09 04)" o "TN DE HORMIGON (LER 17 01 01)" o "TIERRAS Y PIEDRAS (LER 17 05 04)".
       -> Extrae el Código LER exacto de dentro del paréntesis: "17 09 04", "17 01 01", "17 01 02", "17 01 07", "17 05 04", "17 02 01", etc.
       -> Extrae la denominación limpia: "TN DE ESCOMBRO SUCIO" (o el texto que figure antes de LER).
     • "Bruto": Peso bruto en toneladas (ej: 37,62).
     • "Tara": Peso tara del camión en toneladas (ej: 13,6).
     • "Cantidad": PESO NETO / TONELADAS NETAS (ej: "24,02" -> 24.02). En estos albaranes la columna "Cantidad" es SIEMPRE el peso neto en toneladas.

5. BLOQUE "Datos Transporte" (Debajo de la tabla):
   - "Matricula : XXXX-XXX / RXXXX-XXX" (ej: "1885HGF/R0549BDR", "1885HGF", "9523HTN"). Puede ser tractora y remolque separados por barra.
   - "Transportista : [CIF] [NOMBRE EMPRESA O CONDUCTOR]" (ej: "B04221487 ANGEL ARTES SANCHEZ S.L.").
   - "Tara camion : 13,600 TONELADAS".

6. BLOQUE "Datos Destino":
   - Población u obra (ej: "PECHINA", "ALMERIA", "RIOJA").

Extrae la información con absoluta fidelidad y devuélvela ÚNICAMENTE en este formato JSON estricto:
{
  "numAlbaran": "Número de 7 dígitos del albarán (ej: 2607873)",
  "clientCode": "Código de cliente (ej: C0096)",
  "clientName": "Razón social del cliente (ej: MATERIALES DE CONSTRUCCION NEGI)",
  "clientCif": "ID fiscal / NIF / CIF del cliente si figura (ej: ESB04435194)",
  "wasteTypeCode": "Código LER con espacios (ej: 17 09 04, 17 01 01, 17 01 07, 17 05 04)",
  "wasteTypeName": "Nombre o descripción del residuo impreso (ej: TN DE ESCOMBRO SUCIO)",
  "quantityTons": 24.02,
  "licensePlate": "Matrícula completa del vehículo (ej: 1885HGF/R0549BDR)",
  "date": "2026-09-02",
  "time": "HH:MM si figura, o string vacío",
  "notes": "Transportista o destino si figura (ej: Destino: PECHINA | Transportista: ANGEL ARTES SANCHEZ S.L.)"
}`;

/**
 * Cleans and standardizes extracted client data, weights, dates, and LER codes.
 */
export function cleanExtractedOCRData(raw: any): Partial<OCRScanResult> {
  if (!raw) return {};
  const result: any = { ...raw };

  // 1. Limpiar y separar código SAP de cliente y nombre
  let name = (result.clientName || '').trim();
  let code = (result.clientCode || '').trim();

  const match = name.match(/^(?:\[([A-Z0-9\-]{3,10})\]|\(([A-Z0-9\-]{3,10})\)|([A-Z][0-9]{3,6})\s*[\-:]?)\s*(.*)/i);
  if (match) {
    const extractedCode = (match[1] || match[2] || match[3] || '').trim();
    const restName = (match[4] || '').trim();

    if (extractedCode && (!code || code === 'C-00100' || code.includes('['))) {
      code = extractedCode.toUpperCase();
    }
    if (restName && restName.length >= 2) {
      name = restName;
    }
  }

  name = name.replace(/^\[[A-Z0-9\-]+\]\s*/i, '').replace(/^[\-:\.]\s*/, '').trim();
  if (code) {
    code = code.replace(/^\[|\]$/g, '').trim().toUpperCase();
  }

  result.clientName = name;
  result.clientCode = code;

  // 2. Limpieza de peso en Toneladas (quantityTons)
  let rawQty = result.quantityTons;
  if (typeof rawQty === 'string') {
    // Reemplazar comas decimales europeas: "24,02" -> 24.02
    const cleanStr = (rawQty as string).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    rawQty = parseFloat(cleanStr);
  }
  let qtyNum = Number(rawQty);
  if (isNaN(qtyNum) || qtyNum <= 0) {
    // Si no viene cantidad pero viene bruto y tara, calcular: Bruto - Tara
    const bruto = parseFloat(String(result.bruto || result.gross || '').replace(',', '.'));
    const tara = parseFloat(String(result.tara || result.tare || '').replace(',', '.'));
    if (!isNaN(bruto) && !isNaN(tara) && bruto > tara) {
      qtyNum = parseFloat((bruto - tara).toFixed(2));
    } else {
      qtyNum = 0;
    }
  }
  // Si vino en kilogramos (> 200), convertir a toneladas
  if (qtyNum > 200) {
    qtyNum = parseFloat((qtyNum / 1000).toFixed(2));
  }
  result.quantityTons = parseFloat(qtyNum.toFixed(2));

  // 3. Extracción de Código LER si estaba dentro del nombre de residuo
  let wasteCode = (result.wasteTypeCode || '').trim();
  let wasteName = (result.wasteTypeName || '').trim();

  const lerRegex = /(?:LER\s*)?([0-9]{2}\s*[0-9]{2}\s*[0-9]{2})/i;
  const lerMatch = (wasteCode + ' ' + wasteName).match(lerRegex);
  if (lerMatch) {
    const rawLerDigits = lerMatch[1].replace(/\s+/g, '');
    if (rawLerDigits.length === 6) {
      wasteCode = `${rawLerDigits.slice(0, 2)} ${rawLerDigits.slice(2, 4)} ${rawLerDigits.slice(4, 6)}`;
    }
  }

  // Si wasteTypeCode es 170904 -> 17 09 04
  if (wasteCode.replace(/\s/g, '').length === 6 && !wasteCode.includes(' ')) {
    const d = wasteCode.replace(/\s/g, '');
    wasteCode = `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)}`;
  }

  result.wasteTypeCode = wasteCode;
  result.wasteTypeName = wasteName.replace(/\(LER\s*[0-9\s]+\)/gi, '').trim();

  // 4. Normalizar Fecha (ej: 02/09/26 o 02/09/2026 -> 2026-09-02)
  if (result.date) {
    let dateStr = String(result.date).trim();
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) {
          year = parseInt(year, 10) > 50 ? `19${year}` : `20${year}`;
        }
        dateStr = `${year}-${month}-${day}`;
      }
    }
    result.date = dateStr;
  }

  // 5. Matrícula en mayúsculas sin espacios innecesarios
  if (result.licensePlate) {
    result.licensePlate = String(result.licensePlate).toUpperCase().replace(/\s*[\/\-]\s*/g, '/').trim();
  }

  return result;
}

/**
 * Resizes a base64 image on an HTML Canvas so its maximum dimension is 1800px.
 * Preserves high definition and sharpness for small numbers/letters on industrial scale tickets.
 */
async function resizeImageForOCR(dataUrl: string, maxDim = 1800): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim) {
        return resolve(dataUrl);
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      // Encode as JPEG at 0.90 quality for crisp OCR legibility
      const resized = canvas.toDataURL('image/jpeg', 0.90);
      resolve(resized);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Perform OCR on an Albarán / SAP Ticket image using server API (/api/scan-albaran).
 * Uses high-accuracy multimodal Gemini vision models on the server.
 */
export async function scanAlbaranWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  externalSignal?: AbortSignal
): Promise<Partial<OCRScanResult> | null> {
  let serverErrorMsg = '';

  // 0. Pre-compress image to max 1800px (quality 0.90) to ensure high OCR precision
  let preparedBase64 = imageBase64;
  try {
    preparedBase64 = await resizeImageForOCR(imageBase64, 1800);
  } catch (e) {
    console.warn('Image resize warning:', e);
  }

  let detectedMimeType = mimeType || 'image/jpeg';
  if (preparedBase64.startsWith('data:')) {
    const header = preparedBase64.split(';')[0];
    if (header.includes(':')) {
      detectedMimeType = header.split(':')[1] || detectedMimeType;
    }
  }

  // 1. Call server-side API endpoint (/api/scan-albaran)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    // Link external signal if provided
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort());
    }

    const response = await fetch('/api/scan-albaran', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: preparedBase64, mimeType: detectedMimeType }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && (data.numAlbaran || data.clientName || data.quantityTons !== undefined || data.wasteTypeCode)) {
        return cleanExtractedOCRData(data);
      }
    } else {
      const errJson = await response.json().catch(() => ({}));
      serverErrorMsg = errJson.error || `Error ${response.status} en servidor /api/scan-albaran`;
      console.warn('Server /api/scan-albaran error:', serverErrorMsg);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      serverErrorMsg = 'Tiempo máximo de reconocimiento superado o detenido por el usuario.';
    } else {
      serverErrorMsg = err.message || 'Error de conexión con el servicio OCR';
    }
    console.warn('OCR fetch warning:', serverErrorMsg);
  }

  // Return initial fallback values with explicit guidance notes so the operator can fill manually
  return {
    numAlbaran: '',
    clientCode: '',
    clientName: '',
    wasteTypeCode: '',
    wasteTypeName: '',
    quantityTons: 0,
    licensePlate: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    notes: serverErrorMsg
      ? `Aviso: ${serverErrorMsg}`
      : 'No se pudieron detectar automáticamente los datos. Por favor, complete los campos a mano.',
  };
}

/**
 * Checks if the Gemini API Key is currently valid and working.
 */
export async function checkGeminiApiStatus(): Promise<{
  configured: boolean;
  valid: boolean;
  isLeakedOrRevoked?: boolean;
  message: string;
}> {
  try {
    const res = await fetch('/api/gemini-status');
    if (res.ok) {
      return await res.json();
    }
    return {
      configured: false,
      valid: false,
      message: `Error al comprobar estado del servidor (${res.status})`,
    };
  } catch (err: any) {
    return {
      configured: false,
      valid: false,
      message: err.message || 'Sin conexión con el servicio de IA',
    };
  }
}
