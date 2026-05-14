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
    ActivityIndicator, Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Map from '../components/Map';
import { saveDraft } from '../lib/drafts';
import { GUAYANA_POLYGON, isPointInPolygon } from '../lib/geofence';
import { i18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

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
  const { theme } = useTheme();

  const fromScanner = !!params.nombreTradicional;
  const iaCerteza = params.iaCerteza ? parseFloat(params.iaCerteza) : undefined;


  const [step, setStep] = useState<Step>(params.mediaUrl ? 'map' : 'media');
  const [mediaUri, setMediaUri] = useState(params.mediaUrl ?? '');
  const [tipoMedia, setTipoMedia] = useState(params.tipoMedia ?? 'imagen');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [description, setDescription] = useState('');


  const pickMedia = async (nextStep: Step = 'map') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const mime = (asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen';
    
    let persistentUri = asset.uri;
    // En Web los blob: URLs se destruyen al recargar. Leemos el blob a base64 inmediatamente para persistencia.
    if (isWeb && persistentUri.startsWith('blob:')) {
      try {
        const resp = await fetch(persistentUri);
        const blob = await resp.blob();
        persistentUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Error convirtiendo blob a data URI', e);
      }
    }

    setMediaUri(persistentUri);
    setTipoMedia(mime);
    if (nextStep === 'map') {
      goToMap();
    } else {
      setStep(nextStep);
    }
  };


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


  const confirmAndSave = async () => {
    const loc = coords ?? { lat: 5.0, lng: -63.5 };

    if (!isPointInPolygon({ latitude: loc.lat, longitude: loc.lng }, GUAYANA_POLYGON)) {
      return Alert.alert(
        i18n.t('createRecord.invalidLocationTitle'),
        i18n.t('createRecord.invalidLocationMessage'),
      );
    }

    setSaving(true);
    try {
      await saveDraft({
        status: fromScanner ? 'pending_upload' : 'pending_ai',
        nombre_tradicional: fromScanner ? params.nombreTradicional! : i18n.t('scanner.analyzingSpecies'),
        nombre_cientifico: '',
        peligrosidad: '',
        alimentacion: '',
        endemismo: '',
        descripcion: description,
        media_uri: mediaUri,
        tipo_media: tipoMedia,
        latitud: loc.lat,
        longitud: loc.lng,
        ia_certeza: fromScanner ? iaCerteza : undefined,
      });
      setSaved(true);
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro.');
      setSaving(false);
    }
  };



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
          <Text style={s.headerTitle}>{i18n.t('createRecord.title')}</Text>
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

          <TouchableOpacity 
            style={[s.mediaPicker, mediaUri && { borderWidth: 0, backgroundColor: 'transparent' }]} 
            onPress={() => pickMedia()} 
            activeOpacity={0.7}
          >
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={s.mediaPreview} />
            ) : (
              <View style={s.mediaEmpty}>
                <View style={s.mediaIconCircle}>
                  <Ionicons name="camera" size={40} color="#00796b" />
                </View>
                <Text style={s.mediaMainText}>{i18n.t('createRecord.selectPhoto')}</Text>
                <Text style={s.mediaSubText}>{i18n.t('createRecord.selectCaption')}</Text>
              </View>
            )}
          </TouchableOpacity>

          {mediaUri ? (
            <TouchableOpacity style={s.nextBtn} onPress={goToMap} disabled={locLoading}>
              {locLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={s.nextBtnText}>{i18n.t('createRecord.locateOnMap')}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
        {saved && (
          <View style={s.savedToast}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={s.savedToastText}>{i18n.t('scanner.savedToDraft')}</Text>
          </View>
        )}
      </View>
    );
  }

  const goToConfirm = () => setStep('confirm');

  const goToChangePhoto = () => pickMedia('confirm');
  const goToChangeLocation = () => setStep('map');
  const cancelRegistration = () => {
    setMediaUri('');
    setCoords(null);
    setDescription('');
    router.back();
  };

  // PASO 2: Mapa para ubicar
  if (step === 'map') {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        {/* Mapa fullscreen */}
        <View style={{ flex: 1 }}>
          <Map
            registrationLayout={isWeb}
            initialRegion={coords ? { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.045, longitudeDelta: 0.045 } : undefined}
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
        <View style={[s.mapTopBar, { backgroundColor: theme.surface }]}> 
          <TouchableOpacity onPress={cancelRegistration} style={[s.mapBackBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.mapTopTitle, { color: theme.text }]}>{i18n.t('createRecord.mapTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Texto de instrucciones */}
        <View style={[s.mapInstructionBar, { backgroundColor: theme.card }]}> 
          <Text style={[s.mapInstructionText, { color: theme.subtext }]}>{i18n.t('createRecord.chooseLocationInstructions')}</Text>
        </View>

        {/* Botón continuar a revisión */}
        <View style={[s.mapBottomBar, { backgroundColor: theme.surface }]}> 
          <TouchableOpacity
            style={[s.confirmBtn, !coords && s.confirmBtnDisabled]}
            onPress={goToConfirm}
            disabled={!coords}
          >
            <Text style={s.confirmBtnText}>{i18n.t('createRecord.reviewAndConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // PASO 3: Revisión antes de enviar a draft
  if (step === 'confirm') {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}> 
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

        <View style={[s.confirmHeader, { backgroundColor: theme.surface }]}> 
          <TouchableOpacity onPress={() => setStep('map')} style={[s.mapBackBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}> 
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.mapTopTitle, { color: theme.text }]}>{i18n.t('createRecord.reviewTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={[s.confirmScroll, { backgroundColor: theme.background }]}
          contentContainerStyle={s.confirmScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mediaUri ? (
            <TouchableOpacity onPress={goToChangePhoto} style={s.photoWrapper} activeOpacity={0.8}>
              <Image source={{ uri: mediaUri }} style={s.confirmImage} />
              <View style={s.photoEditBadge}>
                <Ionicons name="pencil" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          ) : null}

          <Text style={[s.confirmHint, { color: theme.subtext }]}>{i18n.t('createRecord.reviewHint')}</Text>

          <TouchableOpacity
            style={[s.locationRow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
            onPress={goToChangeLocation}
            activeOpacity={0.8}
            disabled={saving || saved}
          >
            <Ionicons name="location-outline" size={24} color={theme.primary} />
            <View style={s.locationTextGroup}>
              <Text style={[s.fieldLabel, { color: theme.subtext }]}>{i18n.t('createRecord.locationLabel')}</Text>
              {coords ? (
                <View style={s.coordsHintRow}>
                  <Text style={[s.coordsInline, { color: theme.text }]} selectable>
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </Text>
                  <View style={s.locationHintWrap}>
                    <Text style={[s.locationHintBeside, { color: theme.subtext }]} numberOfLines={3}>
                      · {i18n.t('createRecord.changeLocationHint')}
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[s.locationActionText, { color: theme.primary }]}>{i18n.t('createRecord.changeLocationHint')}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
          </TouchableOpacity>

          <TextInput
            style={[s.descriptionInput, { backgroundColor: theme.inputBackground, borderColor: theme.border, color: theme.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder={i18n.t('createRecord.descriptionPlaceholder')}
            placeholderTextColor={theme.placeholder}
            multiline
            numberOfLines={3}
            editable={!saving && !saved}
          />

          <TouchableOpacity
            style={[
              s.saveDraftBtn,
              (saving || saved || !coords) && s.saveDraftBtnDisabled,
            ]}
            onPress={confirmAndSave}
            disabled={saving || saved || !coords}
            activeOpacity={0.85}
          >
            {saving || saved ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveDraftBtnText} numberOfLines={1}>
                {i18n.t('createRecord.sendToDraft')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>

        {saved && (
          <View style={s.savedToast}>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={s.savedToastText}>{i18n.t('scanner.savedToDraft')}</Text>
          </View>
        )}
      </View>
    );
  }

  return null;
}



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
    width: isWeb ? Math.min(W * 0.65, 640) : W - 48,
    height: isWeb ? Math.min(H * 0.6, 520) : H * 0.45,
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
    paddingHorizontal: isWeb ? 40 : 12,
    paddingTop: Platform.OS === 'ios' ? 56 : (isWeb ? 32 : 12),
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

  /** Miniatura: web (registro) arriba a la derecha alineada con la búsqueda; nativo abajo a la derecha */
  miniPreviewWrap: {
    position: 'absolute',
    right: isWeb ? 56 : 16,
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 15,
    ...Platform.select({
      web: { top: 76 },
      ios: { bottom: 88 },
      default: { bottom: 74 },
    }),
  },
  miniPreview: { width: '100%', height: '100%' },

  mapBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: isWeb ? 40 : 20,
    paddingTop: 20,
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
  confirmBtnDisabled: { opacity: 0.5 },
  saveDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#2e7d32',
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 58,
    marginTop: 4,
    elevation: 3,
    shadowColor: '#2e7d32',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  saveDraftBtnDisabled: { opacity: 0.55 },
  saveDraftBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
  },
  mapInstructionBar: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#e8f5e9' },
  mapInstructionText: { color: '#2e7d32', fontSize: 14, textAlign: 'center' },
  confirmHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: '#f8faf9',
  },
  confirmScroll: { flex: 1 },
  confirmScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    flexGrow: 1,
  },
  confirmImage: {
    width: '100%',
    height: isWeb ? 400 : 240,
    borderRadius: 20,
    marginBottom: 16,
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  confirmHint: { color: '#555', fontSize: 14, marginBottom: 18, lineHeight: 20 },
  photoWrapper: { position: 'relative', marginBottom: 16 },
  photoEditBadge: {
    position: 'absolute', top: 12, right: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderRadius: 16, backgroundColor: '#e8f5e9',
    marginBottom: 18,
  },
  locationTextGroup: { flex: 1, minWidth: 0 },
  coordsHintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 6,
  },
  coordsInline: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as const,
  },
  locationHintWrap: {
    flex: 1,
    flexBasis: 140,
    minWidth: 0,
  },
  locationHintBeside: {
    fontSize: 13,
    lineHeight: 18,
  },
  locationActionText: { color: '#2e7d32', fontSize: 13 },
  fieldLabel: { color: '#777', fontSize: 13, marginBottom: 4, fontWeight: '700' },
  descriptionInput: {
    minHeight: 100,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    padding: 14,
    textAlignVertical: 'top',
    marginBottom: 18,
    backgroundColor: '#fff',
    color: '#222',
  },

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
