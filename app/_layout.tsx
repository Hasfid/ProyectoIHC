import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { View, ActivityIndicator } from "react-native";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Escuchar el estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const inAuthGroup = segments[0] === '(tabs)';
      const isNavigatingToAuth = segments[0] === 'login' || segments[0] === 'register';

      if (!session && inAuthGroup) {
        // No hay sesión y trata de entrar a la app -> Login
        router.replace('/login');
      } else if (session && isNavigatingToAuth) {
        // Hay sesión y trata de entrar al login -> App
        router.replace('/(tabs)');
      }
    });

    // Verificación inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      const inAuthGroup = segments[0] === '(tabs)';
      if (!session && inAuthGroup) {
        router.replace('/login');
      } else if (session && !inAuthGroup) {
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
    </Stack>
  );
}
