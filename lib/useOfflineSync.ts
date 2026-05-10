/**
 * useOfflineSync.ts — Hook de sincronización automática en segundo plano.
 *
 * Detecta conectividad via `expo-network` y ejecuta el pipeline de
 * sincronización ({@link syncDrafts}) automáticamente cuando hay
 * borradores pendientes. Solo activo en mobile (iOS/Android).
 *
 * Triggers de sincronización:
 * - Al montar el hook (inicio de la app)
 * - Cada 30 segundos (polling)
 * - Cuando la app vuelve al foreground (AppState → 'active')
 *
 * @module lib/useOfflineSync
 */

import { useEffect, useRef } from 'react';
import { Platform, Alert, AppState, DeviceEventEmitter } from 'react-native';
import * as Network from 'expo-network';
import { syncDrafts, getDraftCount, DRAFTS_UPDATED_EVENT } from './drafts';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Intervalo de polling para reintentar sincronización (ms) */
const SYNC_INTERVAL_MS = 30_000;

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook que ejecuta sincronización offline-first en segundo plano.
 *
 * Debe montarse una sola vez en un componente raíz (p.ej. el layout
 * principal de tabs). No retorna nada — opera por side effects.
 *
 * @example
 * ```tsx
 * export default function TabLayout() {
 *   useOfflineSync();
 *   return <Tabs>...</Tabs>;
 * }
 * ```
 */
export function useOfflineSync(): void {
  const isSyncing = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    /** Intenta sincronizar si hay drafts y conexión disponible. */
    const attemptSync = async () => {
      if (isSyncing.current) return;

      const count = await getDraftCount();
      if (count === 0) return;

      try {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) return;
      } catch {
        return; // No se pudo verificar red — mejor no intentar
      }

      isSyncing.current = true;
      try {
        const result = await syncDrafts();
        // Sincronización silenciosa en segundo plano
      } catch (err) {
        console.error('Error en sincronización automática:', err);
      } finally {
        isSyncing.current = false;
      }
    };

    // Intentar al montar
    attemptSync();

    // Polling periódico
    const interval = setInterval(attemptSync, SYNC_INTERVAL_MS);

    // Reintentar cuando la app vuelve al foreground
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') attemptSync();
    });

    // Reintentar cuando se agrega/modifica un borrador
    const draftSubscription = DeviceEventEmitter.addListener(DRAFTS_UPDATED_EVENT, () => {
      attemptSync();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
      draftSubscription.remove();
    };
  }, []);
}
