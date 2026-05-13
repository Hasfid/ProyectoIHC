/**
 * drafts.ts — Sistema de borradores offline para registros de biodiversidad.
 *
 * Persiste capturas en AsyncStorage mientras el dispositivo está sin
 * conexión. El ciclo de vida de un draft es:
 *
 *   pending_ai → (Gemini identifica) → pending_upload → (Supabase sube) → eliminado
 *
 * Si la IA falla por rate limit (429), el draft permanece en `pending_ai`
 * para reintentar automáticamente. Si falla por otro motivo, se marca
 * con `last_error` pero no cambia de estado.
 *
 * @module lib/drafts
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { uploadMediaToSupabase } from './uploadMedia';
import { identifySpecies } from './identifySpecies';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, DeviceEventEmitter } from 'react-native';

/** Evento emitido cuando cambia la lista de borradores (creación, borrado, sync) */
export const DRAFTS_UPDATED_EVENT = 'ecos_drafts_updated';

/** Evento emitido cuando se crea una notificación (registro subido, etc.) */
export const NOTIFICATION_UPDATED_EVENT = 'ecos_notification_updated';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Clave de AsyncStorage donde se guardan los borradores */
const DRAFTS_KEY = 'ecos_offline_drafts';

/** Pausa entre llamadas a Gemini para evitar HTTP 429 (ms) */
const AI_THROTTLE_MS = 2000;

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Estados posibles de un borrador en el pipeline offline */
export type DraftStatus = 'pending_ai' | 'pending_selection' | 'pending_upload' | 'failed' | 'rejected';

/** Estructura completa de un borrador persistido localmente */
export type DraftRecord = {
  id: string;
  status: DraftStatus;
  nombre_tradicional: string;
  nombre_cientifico: string;
  peligrosidad: string;
  alimentacion: string;
  endemismo: string;
  descripcion: string;
  media_uri: string;
  tipo_media: string;
  latitud: number;
  longitud: number;
  ia_certeza?: number;
  metadatos_especie?: object;
  created_at: string;
  last_error?: string;
};

// ── CRUD local ───────────────────────────────────────────────────────────────

/**
 * Guarda un nuevo borrador en almacenamiento local.
 * @returns ID del draft creado, o `null` si falla
 */
export const saveDraft = async (
  draft: Omit<DraftRecord, 'id' | 'created_at'>,
): Promise<string | null> => {
  try {
    const existing = await getDrafts();
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newDraft: DraftRecord = { ...draft, id, created_at: new Date().toISOString() };
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify([newDraft, ...existing]));
    DeviceEventEmitter.emit(DRAFTS_UPDATED_EVENT);
    return id;
  } catch (error) {
    console.error('Error saving draft:', error);
    return null;
  }
};

/** Lee todos los borradores almacenados localmente. */
export const getDrafts = async (): Promise<DraftRecord[]> => {
  try {
    const json = await AsyncStorage.getItem(DRAFTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error('Error getting drafts:', error);
    return [];
  }
};

/** Retorna la cantidad total de borradores. */
export const getDraftCount = async (): Promise<number> => {
  return (await getDrafts()).length;
};

/** Retorna conteo de drafts pendientes por fase. */
export const getPendingCount = async (): Promise<{ ai: number; upload: number }> => {
  const drafts = await getDrafts();
  return {
    ai: drafts.filter(d => d.status === 'pending_ai').length,
    upload: drafts.filter(d => d.status === 'pending_upload').length,
  };
};

/** Elimina un borrador por ID. */
export const deleteDraft = async (id: string): Promise<void> => {
  try {
    const drafts = await getDrafts();
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.filter(d => d.id !== id)));
    DeviceEventEmitter.emit(DRAFTS_UPDATED_EVENT);
  } catch (error) {
    console.error('Error deleting draft:', error);
  }
};

/** Actualiza campos parciales de un borrador existente. */
export const updateDraft = async (id: string, updates: Partial<DraftRecord>): Promise<void> => {
  try {
    const drafts = await getDrafts();
    const updated = drafts.map(d => (d.id === id ? { ...d, ...updates } : d));
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
    DeviceEventEmitter.emit(DRAFTS_UPDATED_EVENT);
  } catch (error) {
    console.error('Error updating draft:', error);
  }
};

// ── Fase 1: Identificación con IA ───────────────────────────────────────────

/**
 * Intenta identificar la especie de un draft usando Gemini.
 *
 * Lee la imagen local como base64 (distinto flujo en web vs mobile),
 * llama a {@link identifySpecies}, y si obtiene candidatos actualiza
 * el draft a `pending_upload` con los datos de la IA.
 *
 * @returns `true` si la identificación fue exitosa (o se saltó sin candidatos)
 */
const identifyDraft = async (draft: DraftRecord): Promise<boolean> => {
  try {
    let base64 = '';

    if (Platform.OS === 'web') {
      const resp = await fetch(draft.media_uri);
      const blob = await resp.blob();
      base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
    } else {
      base64 = await FileSystem.readAsStringAsync(draft.media_uri, { encoding: 'base64' });
    }

    const result = await identifySpecies(base64);
    const best = result.candidates?.[0];

    if (best) {
      await updateDraft(draft.id, {
        status: 'pending_selection',
        nombre_tradicional: best.nombreTradicional || draft.nombre_tradicional,
        nombre_cientifico: best.nombreCientifico || '',
        peligrosidad: best.peligrosidad || '',
        endemismo: best.endemismo || '',
        ia_certeza: best.iaCerteza,
        metadatos_especie: {
          origen: 'scanner-offline',
          descripcion_biologica: best.descripcionBiologica,
          curiosidades: best.curiosidades,
          mitos: best.mitos,
          all_candidates: result.candidates,
        },
        last_error: undefined,
      });
      return true;
    }

    // IA no devolvió candidatos (solo humanos o nada) — rechazar registro
    await updateDraft(draft.id, {
      status: 'rejected',
      nombre_tradicional: 'Sin especie detectada',
      last_error: 'Parece que no hay animales ni plantas aquí.',
    });
    
    return true;
  } catch (err: any) {
    console.error(`AI identification failed for "${draft.id}":`, err);

    const errorMsg = err?.message || '';

    if (errorMsg.includes('nativa, endémica o invasora')) {
      // Failed geographical filter — reject immediately
      await updateDraft(draft.id, {
        status: 'rejected',
        nombre_tradicional: 'Especie no válida',
        last_error: 'La especie detectada no habita en Venezuela.',
        metadatos_especie: { rejected_reason: 'geo_filter', all_candidates: [] },
      });
      return true;
    }

    // Rate limit → no marcar como failed, reintentar después
    if (errorMsg.includes('tráfico')) {
      await updateDraft(draft.id, { last_error: 'Rate limit — reintentando' });
      return false;
    }

    await updateDraft(draft.id, { last_error: errorMsg });
    return false;
  }
};

// ── Fase 2: Subir a Supabase ────────────────────────────────────────────────

/**
 * Sube un draft identificado a Supabase (media + registro + notificación).
 *
 * Flujo:
 * 1. Si la URI es local, sube el media al bucket
 * 2. Inserta el registro en la tabla `registros`
 * 3. Elimina el draft local
 * 4. Crea una notificación de sincronización
 *
 * @returns `true` si todo el flujo fue exitoso
 */
const uploadDraft = async (draft: DraftRecord, userId: string): Promise<boolean> => {
  try {
    let mediaUrl = draft.media_uri;
    if (!draft.media_uri.startsWith('http')) {
      const mimeType = draft.tipo_media === 'video' ? 'video/mp4' : 'image/jpeg';
      mediaUrl = await uploadMediaToSupabase(draft.media_uri, mimeType);
    }

    const { error } = await supabase.from('registros').insert({
      usuario_id: userId,
      nombre_tradicional: draft.nombre_tradicional,
      nombre_cientifico: draft.nombre_cientifico,
      peligrosidad: draft.peligrosidad,
      alimentacion: draft.endemismo,
      descripcion: draft.descripcion,
      media_url: mediaUrl,
      tipo_media: draft.tipo_media,
      latitud: draft.latitud,
      longitud: draft.longitud,
      ia_certeza: draft.ia_certeza,
      metadatos_especie: draft.metadatos_especie || { sync: 'offline' },
    });

    if (error) throw error;

    await deleteDraft(draft.id);

    const { error: notifError } = await supabase.from('notificaciones').insert({
      usuario_id: userId,
      titulo: '📡 Registro sincronizado',
      mensaje: `"${draft.nombre_tradicional}" se acaba de subir.`,
      tipo: 'sincronizacion',
      leido: false,
    });

    if (notifError) {
      console.error('Error creando notificación:', notifError.message);
    }

    // Notificar a los badges para que se actualicen inmediatamente
    DeviceEventEmitter.emit(NOTIFICATION_UPDATED_EVENT);

    return true;
  } catch (err: any) {
    console.error(`Upload failed for "${draft.id}":`, err);
    await updateDraft(draft.id, { last_error: err?.message });
    return false;
  }
};

// ── Sincronización completa ─────────────────────────────────────────────────

/**
 * Ejecuta el pipeline completo de sincronización offline.
 *
 * Llamada por {@link useOfflineSync} cuando detecta conexión.
 * Procesa primero la fase de IA y luego la de subida, con throttling
 * entre llamadas para evitar rate limiting.
 *
 * @param onProgress - Callback opcional para reportar progreso al UI
 * @returns Conteo de drafts identificados, subidos y fallidos
 */
export const syncDrafts = async (
  onProgress?: (msg: string) => void,
): Promise<{ identified: number; uploaded: number; failed: number }> => {
  const drafts = await getDrafts();
  if (drafts.length === 0) return { identified: 0, uploaded: 0, failed: 0 };

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  if (!userId) {
    console.warn('syncDrafts: No hay sesión activa.');
    return { identified: 0, uploaded: 0, failed: drafts.length };
  }

  let identified = 0;
  let uploaded = 0;
  let failed = 0;

  // Fase 1: Identificar con IA los que están pendientes
  const pendingAi = drafts.filter(d => d.status === 'pending_ai');
  for (const draft of pendingAi) {
    onProgress?.(`Identificando "${draft.nombre_tradicional || 'captura'}"...`);
    const ok = await identifyDraft(draft);
    if (ok) identified++;
    else failed++;
    if (pendingAi.length > 1) await new Promise(r => setTimeout(r, AI_THROTTLE_MS));
  }

  // Fase 2: Subir los que están listos (re-leer para captar cambios de estado)
  const freshDrafts = await getDrafts();
  const pendingUpload = freshDrafts.filter(d => d.status === 'pending_upload');
  for (const draft of pendingUpload) {
    onProgress?.(`Subiendo "${draft.nombre_tradicional}"...`);
    const ok = await uploadDraft(draft, userId);
    if (ok) uploaded++;
    else failed++;
  }

  return { identified, uploaded, failed };
};
