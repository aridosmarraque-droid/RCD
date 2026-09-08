import { Albaran } from '../types/rcd';

const DB_NAME = 'rcd_plant_db';
const DB_VERSION = 1;
const STORE_ALBARANES = 'albaranes';

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
    console.warn('Notice guardando en IndexedDB:', err);
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
