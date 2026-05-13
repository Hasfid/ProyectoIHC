/**
 * @module ScannerScreen
 * Vista de pestaña que envuelve el componente de cámara/escáner.
 * En web, redirige al mapa donde el scanner está integrado.
 */

import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Scanner from '../../components/Scanner';
import { useTheme } from '../../lib/theme';

export default function ScannerScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  // En web, redirigir al mapa donde el scanner está integrado
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') {
        router.replace('/(tabs)');
      }
    }, [])
  );

  if (Platform.OS === 'web') {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.mode === 'dark' ? theme.background : '#000' }]}>
      <Scanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
