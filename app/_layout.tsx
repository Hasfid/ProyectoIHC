/**
 * _layout.tsx — Root layout con auth guard y sincronización offline.
 *
 * Responsabilidades:
 * - Escucha cambios de autenticación y redirige automáticamente
 *   (login/register ↔ tabs) según el estado de la sesión.
 * - Inicializa el hook de sincronización offline ({@link useOfflineSync}).
 * - Define el stack de navegación con transiciones por pantalla.
 *
 * @module app/_layout
 */

import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useOfflineSync } from "../lib/useOfflineSync";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  // Sincronizar borradores offline cuando vuelva la conexión (solo mobile)
  useOfflineSync();

  useEffect(() => {
    // Escuchar el estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!segments.length) return; // Esperar a que el router esté montado
      const isNavigatingToAuth = segments[0] === 'login' || segments[0] === 'register';

      if (!session && !isNavigatingToAuth) {
        router.replace('/login');
      } else if (session && isNavigatingToAuth) {
        router.replace('/(tabs)');
      }
    });

    // Verificación inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      const isNavigatingToAuth = segments[0] === 'login' || segments[0] === 'register';
      if (!session && !isNavigatingToAuth && segments.length > 0) {
        router.replace('/login');
      } else if (session && isNavigatingToAuth) {
        router.replace('/(tabs)');
      }
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, [segments]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="create-record" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="notifications" options={{ presentation: 'card', headerShown: true }} />
      <Stack.Screen name="social" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="user-profile" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
