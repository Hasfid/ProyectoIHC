/**
 * uploadMedia.ts — Subida de archivos multimedia a Supabase Storage.
 *
 * Abstrae las diferencias de red entre Web y Mobile:
 * - **Web**: usa `fetch().blob()` (API estándar del navegador).
 * - **Mobile**: usa `expo-file-system` para leer el archivo local como
 *   base64, ya que `fetch(file://...)` falla en Android/iOS.
 *
 * Los archivos se suben al bucket público `multimedia_especies`.
 *
 * @module lib/uploadMedia
 */

import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Nombre del bucket de Supabase Storage donde se guardan las imágenes */
const STORAGE_BUCKET = 'multimedia_especies';

/** Prefijo de ruta dentro del bucket */
const UPLOAD_PREFIX = 'public';

// ── Función principal ────────────────────────────────────────────────────────

/**
 * Sube un archivo multimedia al bucket público y devuelve su URL.
 *
 * Genera un nombre de archivo único usando timestamp para evitar
 * colisiones. El flujo es:
 * 1. Leer el archivo (vía blob en web, base64 en mobile)
 * 2. Subir al bucket de Supabase Storage
 * 3. Retornar la URL pública del archivo
 *
 * @param localUri - URI local del archivo (puede ser `file://` o blob URL)
 * @param mimeType - Tipo MIME del archivo (default: `image/jpeg`)
 * @returns URL pública del archivo subido
 * @throws Error si la subida falla
 *
 * @example
 * ```ts
 * const url = await uploadMediaToSupabase(photoUri);
 * // → "https://...supabase.co/storage/v1/object/public/multimedia_especies/public/registro_abc123.jpg"
 * ```
 */
export async function uploadMediaToSupabase(
  localUri: string,
  mimeType: string = 'image/jpeg',
): Promise<string> {
  const extension = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
  const filePath = `${UPLOAD_PREFIX}/registro_${Date.now()}.${extension}`;

  let fileData: Blob | ArrayBuffer;

  if (Platform.OS === 'web') {
    // Web: fetch().blob() es la API estándar del navegador
    const response = await fetch(localUri);
    fileData = await response.blob();
  } else {
    // Mobile: leer como base64 y decodificar a ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });
    fileData = decode(base64);
  }

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, fileData, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error al subir: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  return data.publicUrl;
}
