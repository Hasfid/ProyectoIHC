import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { uploadMediaToSupabase } from '../lib/uploadMedia';

type Phase = 'idle' | 'uploading';

export default function Scanner() {
  const router = useRouter();
  const [phase, setPhase]         = useState<Phase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handlePick = async () => {
    if (phase === 'uploading') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const tipoMedia = mimeType.startsWith('video') ? 'video' : 'foto';

    setPreviewUri(asset.uri);

    try {
      setPhase('uploading');
      const mediaUrl = await uploadMediaToSupabase(asset.uri, mimeType);

      // Navegar a create-record con la URL real (sin especie pre-llenada — modo manual)
      router.push({
        pathname: '/create-record',
        params: { mediaUrl, tipoMedia },
      });
    } catch (err: any) {
      Alert.alert('Error al subir', err?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setPhase('idle');
      setPreviewUri(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="flask-outline" size={13} color="#004d40" />
        <Text style={styles.badgeText}>MODO LABORATORIO · PC</Text>
      </View>

      <Text style={styles.title}>Registrar especie manualmente</Text>
      <Text style={styles.subtitle}>
        Sube una foto o video — la imagen se guarda en Supabase Storage{'\n'}y lleva al formulario de registro.
      </Text>

      {previewUri && (
        <Image source={{ uri: previewUri }} style={styles.preview} />
      )}

      <TouchableOpacity
        style={[styles.uploadBtn, phase === 'uploading' && styles.uploadBtnBusy]}
        onPress={handlePick}
        disabled={phase === 'uploading'}
        activeOpacity={0.75}
      >
        {phase === 'uploading' ? (
          <>
            <ActivityIndicator color="#004d40" size="large" />
            <Text style={styles.uploadText}>Subiendo a Supabase...</Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={42} color="#004d40" />
            <Text style={styles.uploadText}>{previewUri ? 'Cambiar archivo' : 'Seleccionar archivo'}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>Formatos: JPG · PNG · WEBP · MP4</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f9fafb', gap: 12 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2f1', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 8 },
  badgeText: { color: '#004d40', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  title:     { fontSize: 22, fontWeight: '700', color: '#111', textAlign: 'center' },
  subtitle:  { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22 },
  preview:   { width: 220, height: 220, borderRadius: 18, resizeMode: 'cover', marginVertical: 8, borderWidth: 2, borderColor: '#80cbc4' },
  uploadBtn: { width: 240, height: 170, backgroundColor: '#e0f2f1', borderRadius: 20, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: '#80cbc4', borderStyle: 'dashed' },
  uploadBtnBusy: { opacity: 0.65 },
  uploadText:    { color: '#004d40', fontWeight: '600', fontSize: 15 },
  hint:          { fontSize: 12, color: '#aaa', marginTop: 4 },
});
