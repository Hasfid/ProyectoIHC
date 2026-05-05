import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  TextInput, Image, KeyboardAvoidingView, Platform, Modal,
  ActivityIndicator, Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Map from '../components/Map';
import { supabase } from '../lib/supabase';
import { uploadMediaToSupabase } from '../lib/uploadMedia';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type RegistroInsert = {
  usuario_id?:        string;
  nombre_tradicional: string;
  nombre_cientifico:  string;
  peligrosidad:       string;
  alimentacion:       string;
  descripcion:        string;
  media_url:          string;
  tipo_media:         string;
  latitud:            number;
  longitud:           number;
  ia_certeza?:        number;
  metadatos_especie?: object;
};

export default function CreateRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mediaUrl?:          string;
    tipoMedia?:         string;
    nombreTradicional?: string;
    nombreCientifico?:  string;
    iaCerteza?:         string;
    peligrosidad?:      string;
    alimentacion?:      string;
  }>();

  // ─── Valores iniciales desde el escáner (si vienen) ──────────────────────
  const mediaUrl          = params.mediaUrl          ?? '';
  const tipoMedia         = params.tipoMedia         ?? 'imagen';
  const iaCertezaNum      = params.iaCerteza ? parseFloat(params.iaCerteza) : undefined;
  const fromScanner       = !!params.nombreTradicional;

  // ─── Estado del formulario ────────────────────────────────────────────────
  const [currentMediaUrl, setCurrentMediaUrl]   = useState(mediaUrl);
  const [currentTipoMedia, setCurrentTipoMedia] = useState(tipoMedia);
  const [uploadingMedia, setUploadingMedia]     = useState(false);

  const [nombreTradicional, setNombreTradicional] = useState(params.nombreTradicional ?? '');
  const [nombreCientifico,  setNombreCientifico]  = useState(params.nombreCientifico  ?? '');
  const [peligrosidad,      setPeligrosidad]      = useState(params.peligrosidad      ?? '');
  const [alimentacion,      setAlimentacion]      = useState(params.alimentacion      ?? '');
  const [descripcion,       setDescripcion]       = useState('');

  // Búsqueda de especie desde registros existentes
  const [speciesSearch,   setSpeciesSearch]   = useState('');
  const [speciesResults,  setSpeciesResults]  = useState<any[]>([]);
  const [loadingSpecies,  setLoadingSpecies]  = useState(false);
  const [showSearch,      setShowSearch]      = useState(false);
  const [searchDebounce,  setSearchDebounce]  = useState<ReturnType<typeof setTimeout> | null>(null);

  // Ubicación
  const [coords,          setCoords]          = useState<{ lat: number; lng: number } | null>(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [locLoading,      setLocLoading]      = useState(false);

  const [publishing, setPublishing] = useState(false);

  // ─── Buscar especies en registros anteriores ──────────────────────────────
  const handleSearchChange = (text: string) => {
    setSpeciesSearch(text);
    if (searchDebounce) clearTimeout(searchDebounce);
    if (!text.trim()) { setSpeciesResults([]); return; }

    const t = setTimeout(async () => {
      setLoadingSpecies(true);
      try {
        const { data } = await supabase
          .from('registros')
          .select('nombre_tradicional, nombre_cientifico, peligrosidad, alimentacion')
          .ilike('nombre_tradicional', `%${text}%`)
          .order('nombre_tradicional')
          .limit(10);

        // Deduplicar por nombre_tradicional
        const unique = (data ?? []).filter(
          (v, i, a) => a.findIndex(x => x.nombre_tradicional === v.nombre_tradicional) === i,
        );
        setSpeciesResults(unique);
      } catch {
        setSpeciesResults([]);
      } finally {
        setLoadingSpecies(false);
      }
    }, 300);
    setSearchDebounce(t);
  };

  const selectSpeciesFromSearch = (sp: any) => {
    setNombreTradicional(sp.nombre_tradicional ?? '');
    setNombreCientifico(sp.nombre_cientifico   ?? '');
    setPeligrosidad(sp.peligrosidad            ?? '');
    setAlimentacion(sp.alimentacion            ?? '');
    setShowSearch(false);
    setSpeciesSearch('');
    setSpeciesResults([]);
  };

  // ─── Cargar media adicional ───────────────────────────────────────────────
  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    setUploadingMedia(true);
    try {
      const url = await uploadMediaToSupabase(asset.uri, mimeType);
      setCurrentMediaUrl(url);
      setCurrentTipoMedia(mimeType.startsWith('video') ? 'video' : 'imagen');
    } catch (err: any) {
      Alert.alert('Error al subir', err?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // ─── Abrir mapa y obtener GPS ─────────────────────────────────────────────
  const handleOpenMap = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      // Si falla la geolocalización, centrar en la región Guayana
      setCoords({ lat: 5.0, lng: -63.5 });
    } finally {
      setLocLoading(false);
      setMapModalVisible(true);
    }
  };

  const confirmLocation = () => {
    if (!coords) setCoords({ lat: 5.0, lng: -63.5 }); // fallback Guayana
    setMapModalVisible(false);
  };

  // ─── Publicar en Supabase ─────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!nombreTradicional.trim()) return Alert.alert('Falta especie', 'Ingresá el nombre de la especie.');
    if (!coords)                   return Alert.alert('Falta ubicación', 'Confirmá la ubicación en el mapa.');
    if (!currentMediaUrl)          return Alert.alert('Falta imagen',   'Adjuntá al menos una foto o video.');

    setPublishing(true);
    try {
      // 1. Obtener sesión — si no hay, iniciar sesión anónima
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr) {
          console.warn('Inicio de sesión anónimo falló o está deshabilitado:', anonErr.message);
        } else {
          session = (await supabase.auth.getSession()).data.session;
        }
      }

      // 2. Construir el payload con los nombres exactos de columna de `registros`
      const registro: RegistroInsert = {
        usuario_id:         session?.user.id,
        nombre_tradicional: nombreTradicional.trim(),
        nombre_cientifico:  nombreCientifico.trim(),
        peligrosidad:       peligrosidad.trim(),
        alimentacion:       alimentacion.trim(),
        descripcion:        descripcion.trim(),
        media_url:          currentMediaUrl,
        tipo_media:         currentTipoMedia,
        latitud:            coords.lat,
        longitud:           coords.lng,
        ia_certeza:         iaCertezaNum,
        metadatos_especie:  { origen: fromScanner ? 'scanner' : 'manual' },
      };

      // 3. Insertar en Supabase
      const { error } = await supabase.from('registros').insert([registro]);
      if (error) throw new Error(error.message);

      Alert.alert(
        '¡Registrado! 🎉',
        `"${nombreTradicional}" fue guardado en la base de datos de la Guayana.`,
        [{ text: 'Ver mapa', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (err: any) {
      Alert.alert('Error al publicar', err?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setPublishing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerTitle: 'Nuevo Registro',
          headerStyle: { backgroundColor: '#f9fafb' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="close" size={28} color="#111" />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Badge de origen ── */}
        {fromScanner && (
          <View style={styles.scannerBadge}>
            <Ionicons name="scan-outline" size={14} color="#fff" />
            <Text style={styles.scannerBadgeText}>
              Detectado por IA — Certeza {Math.round((iaCertezaNum ?? 0) * 100)}%
            </Text>
          </View>
        )}

        {/* ── Sección multimedia ── */}
        <Text style={styles.sectionTitle}>Imagen / Video *</Text>
        <View style={styles.mediaRow}>
          {currentMediaUrl ? (
            <Image source={{ uri: currentMediaUrl }} style={styles.mediaPreview} />
          ) : null}
          <TouchableOpacity
            style={[styles.addMediaBtn, uploadingMedia && { opacity: 0.5 }]}
            onPress={handlePickMedia}
            disabled={uploadingMedia}
          >
            {uploadingMedia
              ? <ActivityIndicator color="#004d40" />
              : <Ionicons name="cloud-upload-outline" size={30} color="#004d40" />
            }
            <Text style={styles.addMediaText}>
              {uploadingMedia ? 'Subiendo...' : currentMediaUrl ? 'Cambiar' : 'Cargar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Selección/búsqueda de especie ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Especie *</Text>
          <TouchableOpacity onPress={() => setShowSearch(s => !s)}>
            <Text style={styles.searchToggle}>
              {showSearch ? 'Cerrar búsqueda' : 'Buscar en BD'}
            </Text>
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={styles.searchPanel}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search-outline" size={16} color="#666" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Nombre tradicional..."
                placeholderTextColor="#aaa"
                value={speciesSearch}
                onChangeText={handleSearchChange}
                autoFocus
              />
              {loadingSpecies && <ActivityIndicator size="small" color="#004d40" />}
            </View>
            {speciesResults.map((sp, i) => (
              <TouchableOpacity key={i} style={styles.suggestionCard} onPress={() => selectSpeciesFromSearch(sp)}>
                <Text style={styles.suggestionName}>{sp.nombre_tradicional}</Text>
                <Text style={styles.suggestionScience}>{sp.nombre_cientifico}</Text>
              </TouchableOpacity>
            ))}
            {!loadingSpecies && speciesSearch.length > 0 && speciesResults.length === 0 && (
              <Text style={styles.noResults}>Sin resultados — completá los campos abajo</Text>
            )}
          </View>
        )}

        {/* ── Formulario editable ── */}
        <View style={styles.formContainer}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nombre Tradicional *</Text>
            <TextInput
              style={styles.input}
              value={nombreTradicional}
              onChangeText={setNombreTradicional}
              placeholder="Ej: Jaguar"
              placeholderTextColor="#aaa"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nombre Científico</Text>
            <TextInput
              style={styles.input}
              value={nombreCientifico}
              onChangeText={setNombreCientifico}
              placeholder="Ej: Panthera onca"
              placeholderTextColor="#aaa"
            />
          </View>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Peligrosidad</Text>
              <TextInput
                style={styles.input}
                value={peligrosidad}
                onChangeText={setPeligrosidad}
                placeholder="Alta / Media / Baja"
                placeholderTextColor="#aaa"
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Alimentación</Text>
              <TextInput
                style={styles.input}
                value={alimentacion}
                onChangeText={setAlimentacion}
                placeholder="Carnívoro..."
                placeholderTextColor="#aaa"
              />
            </View>
          </View>
        </View>

        {/* ── Ubicación ── */}
        <Text style={styles.sectionTitle}>Ubicación del Avistamiento *</Text>
        <TouchableOpacity
          style={[styles.mapBtn, coords && styles.mapBtnSelected]}
          onPress={handleOpenMap}
          disabled={locLoading}
        >
          {locLoading
            ? <ActivityIndicator color={coords ? '#fff' : '#004d40'} />
            : <Ionicons name="map-outline" size={24} color={coords ? '#fff' : '#004d40'} />
          }
          <Text style={[styles.mapBtnText, coords && { color: '#fff' }]}>
            {coords
              ? `Lat ${coords.lat.toFixed(4)}, Lng ${coords.lng.toFixed(4)} ✓`
              : 'Abrir Mapa y Confirmar Posición'}
          </Text>
        </TouchableOpacity>

        {/* ── Descripción ── */}
        <Text style={styles.sectionTitle}>Descripción (Opcional)</Text>
        <TextInput
          style={styles.inputDescription}
          placeholder="Comportamiento, clima, contexto..."
          placeholderTextColor="#aaa"
          multiline
          textAlignVertical="top"
          value={descripcion}
          onChangeText={setDescripcion}
        />

        {/* ── Botón Publicar ── */}
        <TouchableOpacity
          style={[styles.publishBtn, publishing && { opacity: 0.6 }]}
          onPress={handlePublish}
          disabled={publishing}
        >
          {publishing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.publishBtnText}>Publicar en Supabase</Text>
          }
        </TouchableOpacity>

      </ScrollView>

      {/* ── Modal del Mapa ── */}
      <Modal visible={mapModalVisible} animationType="slide" transparent={false}>
        <View style={{ flex: 1 }}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setMapModalVisible(false)} style={styles.closeMapBtn}>
              <Ionicons name="close" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Ubicá el Avistamiento</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Map />
            <View style={styles.mapPinContainer} pointerEvents="none">
              <Ionicons name="location" size={48} color="#e53935" />
              {coords && (
                <Text style={styles.mapCoordsText}>
                  {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.mapFooter}>
            <TouchableOpacity style={styles.confirmMapBtn} onPress={confirmLocation}>
              <Text style={styles.confirmMapBtnText}>Confirmar Ubicación</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 20, paddingBottom: 80 },

  // Badge escáner
  scannerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1b5e20', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8,
  },
  scannerBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 4 },
  sectionTitle:  { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 24, marginBottom: 4 },
  searchToggle:  { color: '#004d40', fontWeight: '600', fontSize: 14 },

  // Media
  mediaRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  mediaPreview:{ width: 100, height: 100, borderRadius: 12, resizeMode: 'cover' },
  addMediaBtn: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#e0f2f1', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#80cbc4', borderStyle: 'dashed' },
  addMediaText:{ color: '#004d40', fontWeight: 'bold', marginTop: 6, fontSize: 12 },

  // Búsqueda
  searchPanel:    { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8, overflow: 'hidden' },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchInput:    { flex: 1, fontSize: 15, color: '#111' },
  suggestionCard: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  suggestionName: { fontWeight: 'bold', color: '#111' },
  suggestionScience: { fontStyle: 'italic', color: '#666', fontSize: 12, marginTop: 2 },
  noResults:      { textAlign: 'center', color: '#aaa', padding: 16, fontSize: 13 },

  // Formulario
  formContainer: { marginTop: 8, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#eee' },
  fieldRow:      { marginBottom: 12 },
  fieldGroup:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fieldHalf:     { width: '48%' },
  fieldLabel:    { fontSize: 11, fontWeight: 'bold', color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:         { backgroundColor: '#fafafa', color: '#111', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', fontSize: 15 },
  inputDescription: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, height: 100, fontSize: 15, marginTop: 8 },

  // Mapa
  mapBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#e0f2f1', borderRadius: 12, gap: 8, marginTop: 8 },
  mapBtnSelected: { backgroundColor: '#2e7d32' },
  mapBtnText:     { color: '#004d40', fontWeight: 'bold', fontSize: 15, flex: 1 },

  // Publicar
  publishBtn:     { backgroundColor: '#004d40', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 32, minHeight: 58, justifyContent: 'center' },
  publishBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Modal mapa
  mapHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', zIndex: 10 },
  closeMapBtn:  { padding: 4 },
  mapTitle:     { fontSize: 18, fontWeight: 'bold', color: '#111' },
  mapPinContainer: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -24 }, { translateY: -48 }], alignItems: 'center' },
  mapCoordsText:   { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 11, fontWeight: 'bold', marginTop: 4, overflow: 'hidden' },
  mapFooter:       { position: 'absolute', bottom: 40, left: 20, right: 20 },
  confirmMapBtn:   { backgroundColor: '#e53935', paddingVertical: 16, borderRadius: 16, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  confirmMapBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
