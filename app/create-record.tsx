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
  const isSavingRef = React.useRef(false);

  const isDark = theme.mode === 'dark';

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
    if (isSavingRef.current) return;
    const loc = coords ?? { lat: 5.0, lng: -63.5 };

    if (!isPointInPolygon({ latitude: loc.lat, longitude: loc.lng }, GUAYANA_POLYGON)) {
      return Alert.alert(
        i18n.t('createRecord.invalidLocationTitle'),
        i18n.t('createRecord.invalidLocationMessage'),
      );
    }

    isSavingRef.current = true;
    setSaving(true);
    try {
      await saveDraft({
        status: fromScanner ? 'pending_upload' : 'pending_ai',
        nombre_tradicional: fromScanner ? params.nombreTradicional! : 'Analyzing species...',
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
      isSavingRef.current = false;
    }
  };

  const goToConfirm = () => setStep('confirm');
  const goToChangePhoto = () => pickMedia('confirm');
  const goToChangeLocation = () => setStep('map');
  const cancelRegistration = () => {
    setMediaUri('');
    setCoords(null);
    setDescription('');
    router.back();
  };

  // ─── PASO 1: Selección de media ──────────────────────────────────────────
  if (step === 'media') {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Hero: área de foto */}
        <TouchableOpacity
          style={s.heroArea}
          onPress={() => pickMedia()}
          activeOpacity={0.9}
        >
          {mediaUri ? (
            <Image source={{ uri: mediaUri }} style={s.heroImage} resizeMode="cover" />
          ) : (
            <View style={[s.heroEmpty, { backgroundColor: isDark ? '#0b1e15' : '#d4ede5' }]}>
              <View style={[s.heroIconCircle, { backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : 'rgba(0,121,107,0.12)' }]}>
                <Ionicons name="camera" size={52} color={theme.primary} />
              </View>
              <Text style={[s.heroMainText, { color: theme.primary }]}>
                {i18n.t('createRecord.selectPhoto')}
              </Text>
              <Text style={[s.heroSubText, { color: theme.subtext }]}>
                {i18n.t('createRecord.selectCaption')}
              </Text>
            </View>
          )}

          {/* Overlay oscuro en la foto */}
          {mediaUri ? (
            <View style={s.heroOverlay} />
          ) : null}

          {/* Header flotante sobre el hero */}
          <View style={s.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={[s.glassBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={s.heroTitle}>{i18n.t('createRecord.title')}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Badge de IA si viene del scanner */}
          {fromScanner && (
            <View style={s.iaBadge}>
              <Ionicons name="scan-outline" size={13} color="#fff" />
              <Text style={s.iaBadgeText}>IA — {Math.round((iaCerteza ?? 0) * 100)}%</Text>
            </View>
          )}

          {/* Ícono de editar si ya hay foto */}
          {mediaUri ? (
            <View style={[s.heroEditBadge, { backgroundColor: isDark ? 'rgba(52,211,153,0.85)' : 'rgba(46,125,50,0.85)' }]}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Card inferior */}
        <View style={[s.bottomCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {mediaUri ? (
            <>
              <Text style={[s.cardHint, { color: theme.subtext }]}>
                {i18n.t('createRecord.selectCaption')}
              </Text>
              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={goToMap}
                disabled={locLoading}
              >
                {locLoading ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <>
                    <Text style={[s.primaryBtnText, { color: theme.primaryText }]}>
                      {i18n.t('createRecord.locateOnMap')}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color={theme.primaryText} />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[s.cardHint, { color: theme.subtext, textAlign: 'center' }]}>
              {i18n.t('createRecord.selectCaption')}
            </Text>
          )}
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

  // ─── PASO 2: Mapa ─────────────────────────────────────────────────────────
  if (step === 'map') {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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

          {/* Pin central */}
          <View style={s.pinOverlay} pointerEvents="none">
            <Ionicons name="location" size={48} color="#e53935" />
            {coords && (
              <Text style={s.coordsLabel}>
                {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
              </Text>
            )}
          </View>

          {/* Mini preview */}
          {mediaUri ? (
            <View style={s.miniPreviewWrap}>
              <Image source={{ uri: mediaUri }} style={s.miniPreview} />
            </View>
          ) : null}
        </View>

        {/* Header flotante */}
        <View style={[s.mapTopBar, {
          backgroundColor: isDark ? 'rgba(8,14,20,0.92)' : 'rgba(255,255,255,0.92)',
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
        }]}>
          <TouchableOpacity
            onPress={cancelRegistration}
            style={[s.mapBackBtn, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.mapTopTitle, { color: theme.text }]}>{i18n.t('createRecord.mapTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Instrucciones */}
        <View style={[s.mapInstructionBar, { backgroundColor: theme.primarySoft }]}>
          <Text style={[s.mapInstructionText, { color: theme.primary }]}>
            {i18n.t('createRecord.chooseLocationInstructions')}
          </Text>
        </View>

        {/* Botón continuar */}
        <View style={[s.mapBottomBar, {
          backgroundColor: isDark ? 'rgba(8,14,20,0.95)' : 'rgba(255,255,255,0.95)',
          borderTopColor: theme.border,
          borderTopWidth: 1,
        }]}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primary }, !coords && s.btnDisabled]}
            onPress={goToConfirm}
            disabled={!coords}
          >
            <Text style={[s.primaryBtnText, { color: theme.primaryText }]}>
              {i18n.t('createRecord.reviewAndConfirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── PASO 3: Confirmación ─────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: foto a pantalla completa */}
          <TouchableOpacity
            onPress={goToChangePhoto}
            activeOpacity={0.9}
            style={s.confirmHeroWrap}
          >
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={s.confirmHeroImage} resizeMode="cover" />
            ) : (
              <View style={[s.confirmHeroImage, { backgroundColor: isDark ? '#0b1e15' : '#d4ede5', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={64} color={theme.primary} />
              </View>
            )}
            <View style={s.heroOverlay} />

            {/* Header flotante sobre el hero */}
            <View style={s.heroHeader}>
              <TouchableOpacity
                onPress={() => setStep('map')}
                style={[s.glassBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' }]}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={s.heroTitle}>{i18n.t('createRecord.reviewTitle')}</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Badge editar foto */}
            <View style={[s.heroEditBadge, { backgroundColor: isDark ? 'rgba(52,211,153,0.85)' : 'rgba(46,125,50,0.85)' }]}>
              <Ionicons name="pencil" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Contenido formulario */}
          <View style={[s.confirmBody, { backgroundColor: theme.background }]}>
            <Text style={[s.confirmHint, { color: theme.subtext }]}>
              {i18n.t('createRecord.reviewHint')}
            </Text>

            {/* Fila de ubicación */}
            <TouchableOpacity
              style={[s.locationRow, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}
              onPress={goToChangeLocation}
              activeOpacity={0.8}
              disabled={saving || saved}
            >
              <Ionicons name="location-outline" size={24} color={theme.primary} />
              <View style={s.locationTextGroup}>
                <Text style={[s.fieldLabel, { color: theme.subtext }]}>
                  {i18n.t('createRecord.locationLabel')}
                </Text>
                {coords ? (
                  <View style={s.coordsHintRow}>
                    <Text style={[s.coordsInline, { color: theme.text }]} selectable>
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </Text>
                    <Text style={[s.locationHintBeside, { color: theme.subtext }]} numberOfLines={2}>
                      · {i18n.t('createRecord.changeLocationHint')}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.locationActionText, { color: theme.primary }]}>
                    {i18n.t('createRecord.changeLocationHint')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.subtext} />
            </TouchableOpacity>

            {/* Descripción */}
            <TextInput
              style={[s.descriptionInput, {
                backgroundColor: theme.inputBackground,
                borderColor: theme.border,
                color: theme.text,
              }]}
              value={description}
              onChangeText={setDescription}
              placeholder={i18n.t('createRecord.descriptionPlaceholder')}
              placeholderTextColor={theme.placeholder}
              multiline
              numberOfLines={4}
              editable={!saving && !saved}
            />

            {/* Botón guardar */}
            <TouchableOpacity
              style={[
                s.primaryBtn,
                { backgroundColor: theme.primary },
                (saving || saved || !coords) && s.btnDisabled,
              ]}
              onPress={confirmAndSave}
              disabled={saving || saved || !coords}
              activeOpacity={0.85}
            >
              {saving || saved ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <Text style={[s.primaryBtnText, { color: theme.primaryText }]}>
                  {i18n.t('createRecord.sendToDraft')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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



const HERO_HEIGHT = isWeb ? Math.min(H * 0.55, 520) : H * 0.48;

const s = StyleSheet.create({
  container: { flex: 1 },

  // ─── HERO ─────────────────────────────────────────────────────────────────
  heroArea: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  heroIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMainText: { fontSize: 20, fontWeight: '700' },
  heroSubText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },

  heroHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isWeb ? 32 : 16,
    paddingTop: Platform.OS === 'ios' ? 56 : (isWeb ? 24 : 18),
    paddingBottom: 12,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  glassBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  iaBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(27,94,32,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  iaBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  heroEditBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── CARD INFERIOR (paso 1) ───────────────────────────────────────────────
  bottomCard: {
    flex: 1,
    paddingHorizontal: isWeb ? 32 : 24,
    paddingTop: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    ...(isWeb && {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  cardHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  // ─── BOTÓN PRIMARIO ────────────────────────────────────────────────────────
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    minHeight: 56,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  primaryBtnText: { fontSize: 17, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  // ─── MAPA ─────────────────────────────────────────────────────────────────
  mapTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: isWeb ? 40 : 12,
    paddingTop: Platform.OS === 'ios' ? 56 : (isWeb ? 24 : 14),
    paddingBottom: 10,
  },
  mapBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  mapTopTitle: { fontSize: 16, fontWeight: '700' },
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
    position: 'absolute',
    right: isWeb ? 56 : 16,
    width: 72, height: 72,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 2, borderColor: '#fff',
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    zIndex: 15,
    ...Platform.select({
      web: { top: 76 },
      ios: { bottom: 88 },
      default: { bottom: 74 },
    }),
  },
  miniPreview: { width: '100%', height: '100%' },
  mapInstructionBar: { paddingHorizontal: 20, paddingVertical: 10 },
  mapInstructionText: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
  mapBottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: isWeb ? 40 : 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },

  // ─── CONFIRM ───────────────────────────────────────────────────────────────
  confirmHeroWrap: {
    width: '100%',
    height: HERO_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  confirmHeroImage: {
    width: '100%',
    height: '100%',
  },
  confirmBody: {
    paddingHorizontal: isWeb ? 32 : 20,
    paddingTop: 20,
    paddingBottom: 12,
    ...(isWeb && {
      maxWidth: 680,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  confirmHint: { fontSize: 14, marginBottom: 18, lineHeight: 20 },
  locationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 16, borderRadius: 16,
    marginBottom: 18,
  },
  locationTextGroup: { flex: 1, minWidth: 0 },
  coordsHintRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4 },
  coordsInline: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] as const },
  locationHintBeside: { fontSize: 13, lineHeight: 18, flex: 1 },
  locationActionText: { fontSize: 13 },
  fieldLabel: { fontSize: 13, marginBottom: 4, fontWeight: '700' },
  descriptionInput: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
  },

  // ─── TOAST ────────────────────────────────────────────────────────────────
  savedToast: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 90,
    alignSelf: 'center',
    backgroundColor: '#1b5e20',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    zIndex: 100,
  },
  savedToastText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
