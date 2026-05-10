/**
 * Scanner.tsx — Escáner de biodiversidad offline-first para mobile.
 *
 * Flujo de captura rápida:
 * 1. Captura foto con la cámara o selecciona desde galería
 * 2. Copia el archivo a almacenamiento persistente
 * 3. Guarda un borrador local con status `pending_ai`
 * 4. Muestra feedback visual y retorna al modo escaneo
 *
 * La identificación con IA y la subida a Supabase ocurren en segundo
 * plano via {@link useOfflineSync}. El usuario nunca espera por red.
 *
 * @module components/Scanner
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { saveDraft, getPendingCount, DRAFTS_UPDATED_EVENT } from '../lib/drafts';
import { DeviceEventEmitter } from 'react-native';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Fases de la UI del scanner */
type Phase = 'scanning' | 'capturing' | 'saving' | 'saved';

// ── Constantes de diseño ─────────────────────────────────────────────────────

const NEON_GREEN = '#a4ff44';
const GLASS_BG = 'rgba(0,0,0,0.48)';

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Scanner mobile con captura rápida y almacenamiento offline-first.
 *
 * Renderiza la cámara en vivo con un HUD estilo sci-fi. Las capturas
 * se guardan localmente como borradores para procesamiento asíncrono.
 */
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [pendingCount, setPendingCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /** Actualiza el contador de borradores pendientes */
  const refreshPendingCount = async () => {
    const counts = await getPendingCount();
    setPendingCount(counts.ai + counts.upload);
  };

  useEffect(() => {
    refreshPendingCount();
    const sub = DeviceEventEmitter.addListener(DRAFTS_UPDATED_EVENT, refreshPendingCount);
    return () => sub.remove();
  }, []);

  /** Muestra animación de confirmación tras guardar un borrador */
  const showSavedFeedback = () => {
    setPhase('saved');
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setPhase('scanning');
      refreshPendingCount();
    });
  };

  // ── Obtener ubicación actual ──────────────────────────────────────────────

  /**
   * Solicita permisos de ubicación y retorna las coordenadas.
   * Si falla, devuelve el centro geográfico de la Guayana como fallback.
   */
  const getLocation = async (): Promise<{ lat: number; lng: number }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {}
    return { lat: 5.0, lng: -63.5 };
  };

  // ── Capturar foto → guardar local ─────────────────────────────────────────

  /**
   * Captura una foto con la cámara, la persiste en el filesystem,
   * obtiene la ubicación y guarda un borrador local.
   */
  const processScan = async () => {
    if (!cameraRef.current || phase !== 'scanning') return;

    try {
      setPhase('capturing');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        shutterSound: false,
      });
      if (!photo?.uri) throw new Error('La cámara no devolvió imagen.');

      setPhase('saving');

      // Copiar a almacenamiento persistente (el cache se borra)
      const fileName = `ecos_${Date.now()}.jpg`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: photo.uri, to: permanentUri });

      const location = await getLocation();

      await saveDraft({
        status: 'pending_ai',
        nombre_tradicional: 'Captura pendiente',
        nombre_cientifico: '',
        peligrosidad: '',
        alimentacion: '',
        endemismo: '',
        descripcion: '',
        media_uri: permanentUri,
        tipo_media: 'imagen',
        latitud: location.lat,
        longitud: location.lng,
      });

      showSavedFeedback();
    } catch (err: any) {
      setPhase('scanning');
      Alert.alert('Error', err?.message ?? 'Inténtalo de nuevo.', [{ text: 'OK' }]);
    }
  };

  // ── Cargar desde galería → guardar local ──────────────────────────────────

  /** Abre la galería, selecciona una imagen y la guarda como borrador. */
  const handlePickMedia = async () => {
    if (phase !== 'scanning') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    try {
      setPhase('saving');

      const fileName = `ecos_${Date.now()}.jpg`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });

      const location = await getLocation();

      await saveDraft({
        status: 'pending_ai',
        nombre_tradicional: 'Captura pendiente',
        nombre_cientifico: '',
        peligrosidad: '',
        alimentacion: '',
        endemismo: '',
        descripcion: '',
        media_uri: permanentUri,
        tipo_media: 'imagen',
        latitud: location.lat,
        longitud: location.lng,
      });

      showSavedFeedback();
    } catch (err: any) {
      setPhase('scanning');
      Alert.alert('Error', err?.message ?? 'No se pudo guardar.', [{ text: 'OK' }]);
    }
  };

  // ── Early returns (permisos) ──────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={NEON_GREEN} size="large" />
        <Text style={styles.text}>Cargando permisos...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={NEON_GREEN} />
        <Text style={styles.text}>Se necesita permiso para usar la cámara</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Otorgar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isBusy = phase !== 'scanning';

  const statusLabel =
    phase === 'capturing' ? 'Capturando...' :
    phase === 'saving'    ? 'Guardando localmente...' :
    'Apunta y captura — se procesa en segundo plano';

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
            <Text style={styles.idText}>MODO CAPTURA RÁPIDA</Text>
          </View>
        </View>

        <View style={styles.gridH} />
        <View style={styles.gridV} />
      </View>

      {/* Badge de pendientes */}
      {pendingCount > 0 && (
        <TouchableOpacity
          style={styles.pendingBadge}
          onPress={() => router.push({ pathname: '/(tabs)/profile', params: { tab: 'pending' } })}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={14} color="#000" />
          <Text style={styles.pendingText}>{pendingCount} pendiente(s)</Text>
        </TouchableOpacity>
      )}

      {/* Feedback de "Guardado ✓" */}
      {phase === 'saved' && (
        <Animated.View style={[styles.savedOverlay, { opacity: fadeAnim }]}>
          <View style={styles.savedCard}>
            <Ionicons name="checkmark-circle" size={64} color={NEON_GREEN} />
            <Text style={styles.savedTitle}>¡Guardado!</Text>
            <Text style={styles.savedSubtext}>Se identificará y subirá en segundo plano</Text>
          </View>
        </Animated.View>
      )}

      {/* Overlay de carga */}
      {(phase === 'capturing' || phase === 'saving') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={NEON_GREEN} />
          <Text style={styles.loadingText}>{statusLabel}</Text>
        </View>
      )}

      {/* Botones de acción */}
      <View style={styles.bottomBar}>
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.sideBtn, isBusy && styles.captureBtnDisabled]}
            onPress={handlePickMedia}
            disabled={isBusy}
          >
            <Ionicons name="images-outline" size={28} color={NEON_GREEN} />
            <Text style={styles.sideBtnText}>Cargar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.captureBtn, isBusy && styles.captureBtnDisabled]}
            onPress={processScan}
            disabled={isBusy}
          >
            {isBusy
              ? <ActivityIndicator color={NEON_GREEN} size="small" />
              : <Ionicons name="scan-circle" size={48} color={NEON_GREEN} />
            }
          </TouchableOpacity>

          <View style={styles.sideBtnPlaceholder}>
            <Text style={styles.captureLabel}>OFFLINE</Text>
            <Text style={styles.captureLabel}>FIRST</Text>
          </View>
        </View>
        <Text style={styles.statusSubtext}>{statusLabel}</Text>
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered:          { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  text:              { color: '#ccc', fontSize: 16, textAlign: 'center' },
  permissionBtn:     { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: NEON_GREEN, borderRadius: 10 },
  permissionBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  container:         { flex: 1, backgroundColor: '#000' },

  hudTopLeft: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, left: 20, borderLeftWidth: 2, borderColor: NEON_GREEN, paddingLeft: 8 },
  hudTitle:   { color: NEON_GREEN, fontSize: 9, fontWeight: 'bold', letterSpacing: 1.2 },

  reticleContainer: { position: 'absolute', top: '28%', left: '12%', width: '76%', height: '40%', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: NEON_GREEN },
  TL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  TR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  BL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  BR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  idBox:  { position: 'absolute', top: -36, backgroundColor: GLASS_BG, borderWidth: 1, borderColor: NEON_GREEN, padding: 6 },
  idText: { color: '#fff', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.4 },

  gridH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(164,255,68,0.15)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, right: '10%', width: 1, backgroundColor: 'rgba(164,255,68,0.15)' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', gap: 18, zIndex: 10 },
  loadingText:    { color: NEON_GREEN, fontSize: 15, fontWeight: '700', letterSpacing: 1, textAlign: 'center' },

  savedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  savedCard: {
    alignItems: 'center', backgroundColor: 'rgba(10,25,16,0.95)',
    padding: 40, borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(164,255,68,0.3)', gap: 8,
  },
  savedTitle:   { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  savedSubtext: { color: '#aaa', fontSize: 14, textAlign: 'center', maxWidth: 220 },

  pendingBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: NEON_GREEN, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, zIndex: 5,
  },
  pendingText: { color: '#000', fontSize: 11, fontWeight: 'bold' },

  bottomBar:              { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center', gap: 10, zIndex: 20 },
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 30 },
  sideBtn:                { alignItems: 'center', justifyContent: 'center', width: 80 },
  sideBtnText:            { color: NEON_GREEN, fontSize: 10, fontWeight: 'bold', marginTop: 4, letterSpacing: 0.5 },
  sideBtnPlaceholder:     { width: 80, alignItems: 'center' },
  captureBtn:             { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: NEON_GREEN },
  captureBtnDisabled:     { opacity: 0.4 },
  captureLabel:           { color: NEON_GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusSubtext:          { color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 0.5, textAlign: 'center' },
});
