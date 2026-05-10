/**
 * create-record.tsx — Flujo rápido de registro de avistamiento.
 *
 * Paso 1: Seleccionar foto/video
 * Paso 2: Marcar ubicación en el mapa
 * Paso 3: Confirmar → va a pendiente (offline-first)
 *
 * Funciona igual en web y app. Sin formularios largos.
 *
 * @module app/create-record
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image,
  Modal, Platform, StyleSheet,
  Text, TouchableOpacity, View,
  Dimensions, StatusBar,
} from 'react-native';
import Map from '../components/Map';
import { saveDraft } from '../lib/drafts';
import { GUAYANA_POLYGON, isPointInPolygon } from '../lib/geofence';

const { width: W, height: H } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

/** Pasos del flujo */
type Step = 'media' | 'map' | 'confirm';

export default function CreateRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mediaUrl?: string;
    tipoMedia?: string;
    nombreTradicional?: string;
    iaCerteza?: string;
  }>();

  const fromScanner = !!params.nombreTradicional;
  const iaCerteza = params.iaCerteza ? parseFloat(params.iaCerteza) : undefined;

  // ── Estado ────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(params.mediaUrl ? 'map' : 'media');
  const [mediaUri, setMediaUri] = useState(params.mediaUrl ?? '');
  const [tipoMedia, setTipoMedia] = useState(params.tipoMedia ?? 'imagen');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  // ── Paso 1: Seleccionar media ─────────────────────────────────────────────
  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setMediaUri(asset.uri);
    setTipoMedia((asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen');
    // Avanzar al mapa automáticamente
    goToMap();
  };

  // ── Paso 2: Abrir mapa ────────────────────────────────────────────────────
  const goToMap = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      setCoords({ lat: 4.5, lng: -63.5 });
    } finally {
      setLocLoading(false);
      setStep('map');
    }
  };

  // ── Paso 3: Confirmar ubicación → guardar ─────────────────────────────────
  const confirmAndSave = async () => {
    const loc = coords ?? { lat: 5.0, lng: -63.5 };

    if (!isPointInPolygon({ latitude: loc.lat, longitude: loc.lng }, GUAYANA_POLYGON)) {
      return Alert.alert('Ubicación inválida', 'Debe estar dentro de la Guayana Venezolana.');
    }

    setSaving(true);
    try {
      await saveDraft({
        status: fromScanner ? 'pending_upload' : 'pending_ai',
        nombre_tradicional: fromScanner ? params.nombreTradicional! : 'Analizando especie...',
        nombre_cientifico: '',
        peligrosidad: '',
        alimentacion: '',
        endemismo: '',
        descripcion: '',
        media_uri: mediaUri,
        tipo_media: tipoMedia,
        latitud: loc.lat,
        longitud: loc.lng,
        ia_certeza: fromScanner ? iaCerteza : undefined,
      });
      setSaved(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 1500);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro.');
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // PASO 1: Selección de media
  if (step === 'media') {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nuevo Registro</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Contenido */}
        <View style={s.centerContent}>
          {fromScanner && (
            <View style={s.scannerBadge}>
              <Ionicons name="scan-outline" size={14} color="#fff" />
              <Text style={s.scannerText}>IA — {Math.round((iaCerteza ?? 0) * 100)}%</Text>
            </View>
          )}

          <TouchableOpacity style={s.mediaPicker} onPress={pickMedia} activeOpacity={0.7}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={s.mediaPreview} />
            ) : (
              <View style={s.mediaEmpty}>
                <View style={s.mediaIconCircle}>
                  <Ionicons name="camera" size={40} color="#00796b" />
                </View>
                <Text style={s.mediaMainText}>Seleccionar foto</Text>
                <Text style={s.mediaSubText}>Tocá para elegir la imagen del avistamiento</Text>
              </View>
            )}
          </TouchableOpacity>

          {mediaUri ? (
            <TouchableOpacity style={s.nextBtn} onPress={goToMap} disabled={locLoading}>
              {locLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.nextBtnText}>Ubicar en el mapa</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  // PASO 2: Mapa para ubicar
  if (step === 'map') {
    return (
      <View style={s.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" />

        {/* Mapa fullscreen */}
        <View style={{ flex: 1 }}>
          <Map
            onRegionChangeComplete={(region: any) => {
              if (region?.latitude && region?.longitude) {
                setCoords({ lat: region.latitude, lng: region.longitude });
              }
            }}
          />

          {/* Pin central fijo */}
          <View style={s.pinOverlay} pointerEvents="none">
            <Ionicons name="location" size={48} color="#e53935" />
            {coords && (
              <Text style={s.coordsLabel}>
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </Text>
            )}
          </View>

          {/* Mini preview de la foto seleccionada */}
          {mediaUri ? (
            <View style={s.miniPreviewWrap}>
              <Image source={{ uri: mediaUri }} style={s.miniPreview} />
            </View>
          ) : null}
        </View>

        {/* Header flotante */}
        <View style={s.mapTopBar}>
          <TouchableOpacity onPress={() => setStep('media')} style={s.mapBackBtn}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={s.mapTopTitle}>Ubicá el avistamiento</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Botón confirmar */}
        <View style={s.mapBottomBar}>
          <TouchableOpacity
            style={[s.confirmBtn, (saving || saved) && { opacity: 0.6 }]}
            onPress={confirmAndSave}
            disabled={saving || saved}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={s.confirmBtnText}>Confirmar y guardar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Toast Guardado */}
        {saved && (
          <View style={s.savedToast}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={s.savedToastText}>Guardado en borradores</Text>
          </View>
        )}
      </View>
    );
  }

  return null;
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf9' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#f8faf9',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#222' },

  // Contenido central
  centerContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 24,
  },

  scannerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1b5e20', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, marginBottom: 20,
  },
  scannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // Selector de media
  mediaPicker: {
    width: isWeb ? Math.min(W * 0.5, 400) : W - 48,
    height: isWeb ? Math.min(H * 0.45, 360) : H * 0.4,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#e0f2f1',
    borderWidth: 2, borderColor: '#80cbc4', borderStyle: 'dashed',
  },
  mediaEmpty: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  mediaIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,121,107,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  mediaMainText: { fontSize: 18, fontWeight: '700', color: '#00796b' },
  mediaSubText: { fontSize: 13, color: '#888', textAlign: 'center' },
  mediaPreview: { width: '100%', height: '100%', resizeMode: 'cover' },

  // Botón siguiente
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#00796b',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 14, marginTop: 24,
    elevation: 3,
    shadowColor: '#00796b', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Mapa
  mapTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
    paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center',
  },
  mapTopTitle: { fontSize: 16, fontWeight: '700', color: '#222' },

  pinOverlay: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginTop: -48, marginLeft: -24,
    alignItems: 'center', zIndex: 10,
  },
  coordsLabel: {
    backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, fontSize: 11, fontWeight: 'bold', marginTop: 4,
  },

  miniPreviewWrap: {
    position: 'absolute', top: Platform.OS === 'ios' ? 110 : 70, right: 16,
    width: 64, height: 64, borderRadius: 14,
    overflow: 'hidden', borderWidth: 2, borderColor: '#fff',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  miniPreview: { width: '100%', height: '100%' },

  mapBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#2e7d32',
    padding: 16, borderRadius: 14,
    elevation: 3,
    shadowColor: '#2e7d32', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  confirmBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  savedToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    alignSelf: 'center',
    backgroundColor: '#1b5e20',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    zIndex: 100,
  },
  savedToastText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
