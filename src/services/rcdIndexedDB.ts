import { Albaran, Certificate } from '../types/rcd';

const DB_NAME = 'rcd_plant_db';
const DB_VERSION = 2;
const STORE_ALBARANES = 'albaranes';
const STORE_CERTIFICATES = 'certificates';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ALBARANES)) {
        db.createObjectStore(STORE_ALBARANES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CERTIFICATES)) {
        db.createObjectStore(STORE_CERTIFICATES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda todos los albaranes de forma asíncrona en IndexedDB sin límite de 5MB
 */
export async function saveAlbaranesToIndexedDB(albaranes: Albaran[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALBARANES, 'readwrite');
      const store = tx.objectStore(STORE_ALBARANES);

      // Limpiar y resincronizar
      store.clear();
      for (const alb of albaranes) {
        store.put(alb);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    // Si falla IndexedDB en algún navegador restringido (modo incógnito estricto), se ignora silenciosamente
    console.warn('Notice guardando albaranes en IndexedDB:', err);
  }
}

/**
 * Recupera los albaranes almacenados en IndexedDB
 */
export async function loadAlbaranesFromIndexedDB(): Promise<Albaran[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ALBARANES, 'readonly');
      const store = tx.objectStore(STORE_ALBARANES);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as Albaran[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Guarda todos los certificados de forma asíncrona en IndexedDB sin límite de 5MB
 * (incluyendo firmas digitales y documentos PDF PAdES pesados)
 */
export async function saveCertificatesToIndexedDB(certificates: Certificate[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CERTIFICATES, 'readwrite');
      const store = tx.objectStore(STORE_CERTIFICATES);

      store.clear();
      for (const cert of certificates) {
        store.put(cert);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Notice guardando certificados en IndexedDB:', err);
  }
}

/**
 * Recupera los certificados almacenados en IndexedDB
 */
export async function loadCertificatesFromIndexedDB(): Promise<Certificate[] | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CERTIFICATES, 'readonly');
      const store = tx.objectStore(STORE_CERTIFICATES);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result as Certificate[]);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return null;
  }
}
