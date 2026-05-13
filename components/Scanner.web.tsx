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
import { useTheme } from '../lib/theme';
import { i18n } from '../lib/i18n';

export default function Scanner() {
  const router = useRouter();
  const { theme } = useTheme();

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    router.push({
      pathname: '/create-record',
      params: {
        mediaUrl: asset.uri,
        tipoMedia: (asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <View style={styles.idleView}>
        <Text style={[styles.title, { color: theme.text }]}>{i18n.t('scanner.uploadRecord')}</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          {i18n.t('scanner.scanCaption')}
        </Text>
        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: theme.card, borderColor: theme.primary }]}
          onPress={handlePick}
        >
          <Ionicons name="cloud-upload" size={48} color={theme.primary} />
          <Text style={[styles.uploadText, { color: theme.primary }]}>{i18n.t('scanner.chooseGallery')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 24 },

  idleView: { alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 16, textAlign: 'center', maxWidth: 400, marginBottom: 12 },
  uploadBtn: { width: 300, height: 200, borderRadius: 24, justifyContent: 'center', alignItems: 'center', gap: 12, borderStyle: 'dashed', borderWidth: 2 },
  uploadText: { fontWeight: 'bold', fontSize: 18 },
});
