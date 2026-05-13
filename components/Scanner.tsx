/**
 * Scanner.tsx — Escáner de biodiversidad offline-first para mobile.
 *
 * Flujo de captura:
 * 1. Captura foto con la cámara o selecciona desde galería
 * 2. Muestra preview con opciones: "Tomar otra" o "Subir"
 * 3. Si sube: copia al almacenamiento, guarda borrador, muestra confirmación
 * 4. La identificación con IA y subida ocurren en segundo plano
 *
 * @module components/Scanner
 */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Animated,
    DeviceEventEmitter,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { DRAFTS_UPDATED_EVENT, getPendingCount, saveDraft } from '../lib/drafts';
import { useTheme } from '../lib/theme';
import { i18n } from '../lib/i18n';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Fases de la UI del scanner */
type Phase = 'scanning' | 'capturing' | 'preview' | 'saving' | 'saved';

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Scanner mobile con captura rápida y almacenamiento offline-first.
 *
 * Renderiza la cámara en vivo con un HUD. Las capturas se muestran
 * como preview antes de guardar como borradores locales.
 */
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [pendingCount, setPendingCount] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
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
      Animated.delay(1500),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setPhase('scanning');
      setPreviewUri(null);
      refreshPendingCount();
    });
  };

  // ── Obtener ubicación actual ──────────────────────────────────────────────

  const getLocation = async (): Promise<{ lat: number; lng: number }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        return { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch { }
    return { lat: 5.0, lng: -63.5 };
  };

  // ── Capturar foto → mostrar preview ───────────────────────────────────────

  const handleCapture = async () => {
    if (!cameraRef.current || phase !== 'scanning') return;

    try {
      setPhase('capturing');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        shutterSound: false,
      });
      if (!photo?.uri) throw new Error(i18n.t('common.error'));

      setPreviewUri(photo.uri);
      setPhase('preview');
    } catch (err: any) {
      setPhase('scanning');
      Alert.alert('Error', err?.message ?? i18n.t('common.error'), [{ text: 'OK' }]);
    }
  };

  // ── Confirmar y guardar borrador ──────────────────────────────────────────

  const handleConfirmUpload = async () => {
    if (!previewUri) return;

    try {
      setPhase('saving');

      const fileName = `ecos_${Date.now()}.jpg`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.copyAsync({ from: previewUri, to: permanentUri });

      const location = await getLocation();

      await saveDraft({
        status: 'pending_ai',
        nombre_tradicional: i18n.t('scanner.pendingCapture'),
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
      setPhase('preview');
      Alert.alert('Error', err?.message ?? i18n.t('common.error'), [{ text: 'OK' }]);
    }
  };

  // ── Retomar (descartar preview) ───────────────────────────────────────────

  const handleRetake = () => {
    setPreviewUri(null);
    setPhase('scanning');
  };

  // ── Cargar desde galería → navegar a crear registro ───────────────────────

  const handlePickMedia = async () => {
    if (phase !== 'scanning') return;

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

  // ── Early returns (permisos) ──────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={[styles.text, { color: theme.text }]}>{i18n.t('scanner.loadingPermissions')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="camera-outline" size={64} color={theme.primary} />
        <Text style={[styles.text, { color: theme.text }]}>{i18n.t('scanner.cameraPermission')}</Text>
        <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
          <Text style={[styles.permissionBtnText, { color: theme.primaryText }]}>{i18n.t('scanner.grantPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const isBusy = phase === 'capturing' || phase === 'saving';

  const statusLabel =
    phase === 'capturing' ? i18n.t('scanner.capturing') :
      phase === 'saving' ? i18n.t('scanner.savingLocal') :
        i18n.t('scanner.scanHint');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Cámara en vivo (oculta durante preview) */}
      {phase !== 'preview' && phase !== 'saved' && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      )}

      {/* Preview de foto capturada */}
      {phase === 'preview' && previewUri && (
        <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}

      {/* Marco de captura (solo en modo scanning) */}
      {phase === 'scanning' && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.reticleContainer}>
            <View style={[styles.corner, styles.TL]} />
            <View style={[styles.corner, styles.TR]} />
            <View style={[styles.corner, styles.BL]} />
            <View style={[styles.corner, styles.BR]} />
          </View>
        </View>
      )}

      {/* Badge de pendientes */}
      {pendingCount > 0 && phase === 'scanning' && (
        <TouchableOpacity
          style={[styles.pendingBadge, { backgroundColor: theme.primary }]}
          onPress={() => router.push({ pathname: '/(tabs)/profile', params: { tab: 'pending' } })}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
          <Text style={styles.pendingText}>{i18n.t('scanner.pendingBadge').replace('{{count}}', String(pendingCount))}</Text>
        </TouchableOpacity>
      )}

      {/* Feedback de "Subido a borrador ✓" */}
      {phase === 'saved' && (
        <Animated.View style={[styles.savedOverlay, { opacity: fadeAnim }]}>
          <View style={[styles.savedCard, { backgroundColor: theme.card }]}>
            <Ionicons name="checkmark-circle" size={64} color={theme.primary} />
            <Text style={[styles.savedTitle, { color: theme.text }]}>{i18n.t('scanner.savedToDraft')}</Text>
            <Text style={[styles.savedSubtext, { color: theme.subtext }]}>{i18n.t('scanner.savedToDraftSubtext')}</Text>
          </View>
        </Animated.View>
      )}

      {/* Overlay de carga (capturing/saving) */}
      {(phase === 'capturing' || phase === 'saving') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>{statusLabel}</Text>
        </View>
      )}

      {/* Botones de preview: Retomar / Subir */}
      {phase === 'preview' && (
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.previewBtn} onPress={handleRetake}>
            <Ionicons name="camera-reverse-outline" size={28} color="#c8deff" />
            <Text style={styles.previewBtnText}>{i18n.t('scanner.retake')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.previewBtnPrimary, { backgroundColor: theme.primary }]} onPress={handleConfirmUpload}>
            <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
            <Text style={styles.previewBtnPrimaryText}>{i18n.t('scanner.uploadPhoto')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botones de acción (solo en modo scanning) */}
      {phase === 'scanning' && (
        <View style={styles.bottomBar}>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.sideBtn, isBusy && styles.captureBtnDisabled]}
              onPress={handlePickMedia}
              disabled={isBusy}
            >
              <Ionicons name="images-outline" size={26} color="#c8deff" />
              <Text style={styles.sideBtnText}>{i18n.t('scanner.uploadRecord')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: theme.primary }, isBusy && styles.captureBtnDisabled]}
              onPress={handleCapture}
              disabled={isBusy}
            >
              {isBusy
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="scan-circle" size={48} color="#c8deff" />
              }
            </TouchableOpacity>

            <View style={styles.sideBtnPlaceholder} />
          </View>
          <Text style={styles.bottomCaption}>{i18n.t('scanner.scanCaption')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  text: { color: '#333', fontSize: 16, textAlign: 'center' },
  permissionBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: '#2e7d32', borderRadius: 10 },
  permissionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#000' },

  reticleContainer: { position: 'absolute', top: '28%', left: '12%', width: '76%', height: '40%', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#c8deff' },
  TL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  TR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  BL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  BR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', gap: 18, zIndex: 10 },
  loadingText: { color: '#c8deff', fontSize: 15, fontWeight: '600', textAlign: 'center' },

  savedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  savedCard: {
    alignItems: 'center', backgroundColor: '#fff',
    padding: 40, borderRadius: 24, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  savedTitle: { color: '#111', fontSize: 28, fontWeight: 'bold' },
  savedSubtext: { color: '#666', fontSize: 14, textAlign: 'center', maxWidth: 220 },

  pendingBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 40, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, zIndex: 5,
  },
  pendingText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // ── Preview actions ────────────────────────────────────────────────────────
  previewActions: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 24,
    paddingHorizontal: 40, zIndex: 20,
  },
  previewBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(200,222,255,0.3)',
  },
  previewBtnText: { color: '#c8deff', fontSize: 14, fontWeight: '600' },
  previewBtnPrimary: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 16, borderRadius: 16,
  },
  previewBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: { position: 'absolute', bottom: 44, left: 0, right: 0, alignItems: 'center', gap: 10, zIndex: 20 },
  actionButtonsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', width: '100%', paddingHorizontal: 30 },
  sideBtn: { alignItems: 'center', justifyContent: 'center', width: 80 },
  sideBtnText: { color: '#c8deff', fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  sideBtnPlaceholder: { width: 80, alignItems: 'center' },
  captureBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#2e7d32', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#c8deff' },
  captureBtnDisabled: { opacity: 0.4 },
  bottomCaption: { color: 'rgba(180,210,255,0.7)', fontSize: 13, textAlign: 'center', marginTop: 4 },
  statusSubtext: { color: 'rgba(255,255,255,0.65)', fontSize: 11, letterSpacing: 0.5, textAlign: 'center' },
});
