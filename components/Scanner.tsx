import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, TextInput, Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { uploadMediaToSupabase } from '../lib/uploadMedia';
import { identifySpecies } from '../lib/identifySpecies';

type Phase = 'scanning' | 'capturing' | 'identifying' | 'preview' | 'uploading' | 'saving';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router    = useRouter();
  const [phase, setPhase] = useState<Phase>('scanning');

  // Nuevos estados para Pre-registro
  const [previewData, setPreviewData] = useState<{ photoUri: string; aiResult: any } | null>(null);
  const [userNote, setUserNote] = useState('');

  // ── Handlers ─────────────────────────────────────────────────────────────
  const processScan = async () => {
    if (!cameraRef.current || phase !== 'scanning') return;

    try {
      setPhase('capturing');
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      if (!photo?.uri || !photo.base64) throw new Error('La cámara no devolvió imagen.');

      setPhase('identifying');
      const aiResult = await identifySpecies(photo.base64);

      setPreviewData({ photoUri: photo.uri, aiResult });
      setPhase('preview');
    } catch (err: any) {
      setPhase('scanning');
      Alert.alert('Error', err?.message ?? 'Inténtalo de nuevo.', [{ text: 'OK' }]);
    }
  };

  const handlePickMedia = async () => {
    if (phase !== 'scanning') return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    try {
      setPhase('identifying');
      
      // Convertir a base64 para la IA
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const aiResult = await identifySpecies(base64);

      setPreviewData({ photoUri: asset.uri, aiResult });
      setPhase('preview');
    } catch (err: any) {
      setPhase('scanning');
      Alert.alert('Error', err?.message ?? 'No se pudo procesar la imagen seleccionada.');
    }
  };

  const confirmAndSave = async () => {
    if (!previewData) return;

    try {
      setPhase('uploading');
      const mediaUrl = await uploadMediaToSupabase(previewData.photoUri, 'image/jpeg');

      setPhase('saving');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Se requiere permiso de ubicación para registrar la especie.');
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const latitud = pos.coords.latitude;
      const longitud = pos.coords.longitude;

      let { data: { session } } = await supabase.auth.getSession();
      let usuario_id = session?.user?.id;
      
      if (!session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) {
          console.warn('Inicio de sesión anónimo falló o está deshabilitado:', anonErr.message);
        } else {
          session = (await supabase.auth.getSession()).data.session;
          usuario_id = session?.user?.id;
        }
      }

      let registro = {
        nombre_tradicional: previewData.aiResult.nombreTradicional,
        nombre_cientifico: previewData.aiResult.nombreCientifico,
        latitud: latitud,
        longitud: longitud,
        media_url: mediaUrl,
        usuario_id: usuario_id,
        tipo_media: 'imagen',
        ia_certeza: previewData.aiResult.iaCerteza,
        descripcion: userNote, // Usamos 'descripcion' como fallback
      };

      let { error } = await supabase.from('registros').insert([registro]);
      if (error) {
        throw new Error(error.message);
      }

      setPhase('scanning');
      setPreviewData(null);
      setUserNote('');
      Alert.alert('¡Éxito!', 'El registro ha sido guardado correctamente.', [
        { text: 'Ver mis hallazgos', onPress: () => router.replace('/(tabs)/records') }
      ]);
    } catch (err: any) {
      setPhase('preview');
      Alert.alert('Error', err?.message ?? 'Inténtalo de nuevo.', [{ text: 'OK' }]);
    }
  };

  // ── Early returns ────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={neonGreen} size="large" />
        <Text style={styles.text}>Cargando permisos...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={neonGreen} />
        <Text style={styles.text}>Se necesita permiso para usar la cámara</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Otorgar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isBusy = phase !== 'scanning';

  const statusLabel =
    phase === 'capturing'   ? 'Capturando...' :
    phase === 'identifying' ? 'IA analizando especie...' :
    phase === 'uploading'   ? 'Subiendo a Supabase...' :
    phase === 'saving'      ? 'Guardando en base de datos...' :
    'Apunta y captura la especie';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Cámara en vivo */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* HUD de Escaneo */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.hudTopLeft}>
          <Text style={styles.hudTitle}>SISTEMA DE ANÁLISIS · GUAYANA BIODIVERSA</Text>
        </View>

        <View style={styles.reticleContainer}>
          <View style={[styles.corner, styles.TL]} />
          <View style={[styles.corner, styles.TR]} />
          <View style={[styles.corner, styles.BL]} />
          <View style={[styles.corner, styles.BR]} />
          <View style={styles.idBox}>
            <Text style={styles.idText}>MODO IDENTIFICACIÓN ACTIVO</Text>
          </View>
        </View>

        <View style={styles.gridH} />
        <View style={styles.gridV} />
      </View>

      {/* Modal / Vista Previa de Pre-registro */}
      {phase === 'preview' && previewData && (
        <View style={styles.previewContainer}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={styles.previewCard}>
            <Image source={{ uri: previewData.photoUri }} style={styles.previewImage} />
            <Text style={styles.previewTitle}>{previewData.aiResult.nombreTradicional}</Text>
            {previewData.aiResult.nombreCientifico && (
              <Text style={styles.previewSubtitle}>{previewData.aiResult.nombreCientifico}</Text>
            )}

            <TextInput
              style={styles.previewInput}
              placeholder="¿Alguna observación especial sobre este encuentro en la Guayana?"
              placeholderTextColor="#888"
              value={userNote}
              onChangeText={setUserNote}
              multiline
            />

            <TouchableOpacity style={styles.confirmBtn} onPress={confirmAndSave}>
              <Text style={styles.confirmBtnText}>Confirmar y Registrar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setPhase('scanning');
                setPreviewData(null);
                setUserNote('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Overlay de carga con la fase actual */}
      {(isBusy && phase !== 'preview') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={neonGreen} />
          <Text style={styles.loadingText}>{statusLabel}</Text>
          {phase === 'identifying' && (
            <Text style={{color: '#aaa', fontSize: 12, marginTop: -8}}>Consultando modelo Gemini Vision...</Text>
          )}
        </View>
      )}

      {/* Botones de acción inferior */}
      <View style={styles.bottomBar}>
        <View style={styles.actionButtonsContainer}>
          {/* Botón Cargar */}
          <TouchableOpacity
            style={[styles.sideBtn, isBusy && styles.captureBtnDisabled]}
            onPress={handlePickMedia}
            disabled={isBusy}
          >
            <Ionicons name="images-outline" size={28} color={neonGreen} />
            <Text style={styles.sideBtnText}>Cargar</Text>
          </TouchableOpacity>

          {/* Botón Capturar (Principal) */}
          <TouchableOpacity
            style={[styles.captureBtn, (isBusy && phase !== 'preview') && styles.captureBtnDisabled]}
            onPress={processScan}
            disabled={isBusy && phase !== 'preview'}
          >
            {(isBusy && phase !== 'preview')
              ? <ActivityIndicator color={neonGreen} size="small" />
              : <Ionicons name="scan-circle" size={48} color={neonGreen} />
            }
          </TouchableOpacity>

          {/* Placeholder o Botón de Ayuda/Ajustes */}
          <View style={styles.sideBtnPlaceholder}>
            <Text style={styles.captureLabel}>TIEMPO REAL</Text>
          </View>
        </View>
        <Text style={styles.statusSubtext}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const neonGreen = '#a4ff44';
const glassBg   = 'rgba(0,0,0,0.48)';

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  text:     { color: '#ccc', fontSize: 16, textAlign: 'center' },
  permissionBtn:     { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: neonGreen, borderRadius: 10 },
  permissionBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#000' },

  hudTopLeft: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 20, borderLeftWidth: 2, borderColor: neonGreen, paddingLeft: 8 },
  hudTitle:   { color: neonGreen, fontSize: 9, fontWeight: 'bold', letterSpacing: 1.2 },

  reticleContainer: { position: 'absolute', top: '28%', left: '12%', width: '76%', height: '40%', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: neonGreen },
  TL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  TR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  BL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  BR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  idBox:   { position: 'absolute', top: -36, backgroundColor: glassBg, borderWidth: 1, borderColor: neonGreen, padding: 6 },
  idText:  { color: '#fff', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.4 },

  gridH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(164,255,68,0.15)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, right: '10%', width: 1, backgroundColor: 'rgba(164,255,68,0.15)' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', gap: 18, zIndex: 10 },
  loadingText:    { color: neonGreen, fontSize: 15, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },

  bottomBar:          { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center', gap: 10, zIndex: 20 },
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 30 },
  sideBtn:            { alignItems: 'center', justifyContent: 'center', width: 80 },
  sideBtnText:        { color: neonGreen, fontSize: 10, fontWeight: 'bold', marginTop: 4, letterSpacing: 0.5 },
  sideBtnPlaceholder: { width: 80, alignItems: 'center' },
  captureBtn:         { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: neonGreen },
  captureBtnDisabled: { opacity: 0.4 },
  captureLabel:       { color: neonGreen, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusSubtext:      { color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 0.5, textAlign: 'center' },

  previewContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
    padding: 20,
  },
  previewCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(164,255,68,0.3)',
    alignItems: 'center',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#a4ff44',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  previewSubtitle: {
    color: '#a4ff44',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewInput: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  confirmBtn: {
    backgroundColor: '#a4ff44',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: '#ccc',
    fontSize: 14,
  },
});
