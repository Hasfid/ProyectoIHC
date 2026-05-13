/**
 * Scanner.web.tsx — Escáner de biodiversidad para la versión web (PC).
 *
 * Flujo simplificado:
 * 1. El usuario selecciona una imagen desde su PC
 * 2. Navega a create-record para ubicar en mapa y confirmar
 *
 * @module components/Scanner.web
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Scanner() {
  const router = useRouter();

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    // Navegar al flujo de carga (que abrirá el mapa y luego guardará)
    router.push({
      pathname: '/create-record',
      params: {
        mediaUrl: asset.uri,
        tipoMedia: (asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen',
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="desktop-outline" size={13} color="#004d40" />
      </View>

      <View style={styles.idleView}>
        <Text style={styles.title}>Cargar Registro</Text>
        <Text style={styles.subtitle}>
          Sube una foto para identificar y registrar una especie de la Guayana Venezolana.
        </Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={handlePick}>
          <Ionicons name="cloud-upload" size={48} color="#004d40" />
          <Text style={styles.uploadText}>Seleccionar Archivo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 20, justifyContent: 'center', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2f1', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 24 },
  badgeText: { color: '#004d40', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

  idleView: { alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', maxWidth: 400, marginBottom: 12 },
  uploadBtn: { width: 300, height: 200, backgroundColor: '#fff', borderRadius: 24, justifyContent: 'center', alignItems: 'center', gap: 12, borderColor: '#004d40', borderStyle: 'dashed', borderWidth: 2 },
  uploadText: { color: '#004d40', fontWeight: 'bold', fontSize: 18 },
});
