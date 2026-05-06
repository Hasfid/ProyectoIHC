/**
 * supabase.ts — Cliente Supabase para la plataforma Ecos.
 *
 * Configura el cliente con un adaptador de almacenamiento seguro para SSR
 * que evita errores cuando `window` no existe (p.ej. durante prerenderizado
 * en Expo Web). En contextos con DOM disponible, delega a AsyncStorage.
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://lurpzudnafegijlteoym.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xrr8bYspSYSFmkH2V3IG3A_NJ4QAF7y';

// ── Adaptador SSR-safe ───────────────────────────────────────────────────────

/**
 * Adaptador de storage compatible con SSR.
 *
 * En entornos web sin `window` (prerenderizado de Node), devuelve valores
 * vacíos para evitar el crash de AsyncStorage. En el resto de plataformas
 * (mobile y web con DOM), delega normalmente a AsyncStorage.
 */
const SSRStorageAdapter = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve(null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

// ── Exportación ──────────────────────────────────────────────────────────────

/** Instancia singleton del cliente Supabase configurada para Ecos */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SSRStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
