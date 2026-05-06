/**
 * create-record.tsx — Formulario de creación de registros de biodiversidad.
 *
 * Dos flujos de entrada:
 * - **Desde scanner**: llega con datos pre-llenados (nombre, certeza IA, media)
 * - **Manual**: el usuario selecciona imagen, la IA identifica, y completa el form
 *
 * Funcionalidades:
 * - Identificación de especie con Gemini AI (selección de candidatos)
 * - Búsqueda de especies en registros existentes (autocompletado)
 * - Selección de ubicación via mapa modal con validación de geofence
 * - Guardado como borrador local o publicación offline-first
 *
 * @module app/create-record
 */

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
import { isPointInPolygon, GUAYANA_POLYGON } from '../lib/geofence';
import { saveDraft } from '../lib/drafts';
import { identifySpecies } from '../lib/identifySpecies';
import * as FileSystem from 'expo-file-system/legacy';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Estructura de inserción para la tabla `registros` */
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
    endemismo?:         string;
    descripcionBiologica?: string;
    curiosidades?:      string;
    mitos?:             string;
    userNote?:          string;
  }>();

  // ─── Valores iniciales desde el escáner (si vienen) ──────────────────────
  const mediaUrl          = params.mediaUrl          ?? '';
  const tipoMedia         = params.tipoMedia         ?? 'imagen';
  const iaCertezaNum      = params.iaCerteza ? parseFloat(params.iaCerteza) : undefined;
  const fromScanner       = !!params.nombreTradicional;

  // ─── Estado del formulario ────────────────────────────────────────────────
  const [currentMediaUrl, setCurrentMediaUrl]   = useState(mediaUrl);
  const [currentTipoMedia, setCurrentTipoMedia] = useState(tipoMedia);
  const [localMediaUri, setLocalMediaUri]       = useState<string | null>(mediaUrl || null);
  const [uploadingMedia, setUploadingMedia]     = useState(false);

  const [nombreTradicional, setNombreTradicional] = useState(params.nombreTradicional ?? '');
  const [nombreCientifico,  setNombreCientifico]  = useState(params.nombreCientifico  ?? '');
  const [peligrosidad,      setPeligrosidad]      = useState(params.peligrosidad      ?? '');
  const [endemismo,         setEndemismo]         = useState(params.endemismo         ?? '');
  const [descripcion,       setDescripcion]       = useState(params.userNote          ?? '');

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
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [iaCerteza, setIaCerteza] = useState(iaCertezaNum);

  // ── Búsqueda de especies en registros anteriores ───────────────────────────

  /** Busca especies en la BD con debounce de 300ms */
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

  /** Rellena el formulario con la especie seleccionada de la búsqueda */
  const selectSpeciesFromSearch = (sp: any) => {
    setNombreTradicional(sp.nombre_tradicional ?? '');
    setNombreCientifico(sp.nombre_cientifico   ?? '');
    setPeligrosidad(sp.peligrosidad            ?? '');
    setEndemismo(sp.alimentacion               ?? '');
    setShowSearch(false);
    setSpeciesSearch('');
    setSpeciesResults([]);
  };

  // ─── Cargar media adicional ───────────────────────────────────────────────
  /** Abre el picker de imágenes y dispara análisis de IA automático */
  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset    = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    
    setLocalMediaUri(asset.uri);
    setCurrentMediaUrl(asset.uri);
    setCurrentTipoMedia(mimeType.startsWith('video') ? 'video' : 'imagen');

    // Disparar análisis automático
    setTimeout(() => handleAnalyzeIA(asset.uri), 500);
  };

  const [selectedFullInfo, setSelectedFullInfo] = useState<any>(
    params.descripcionBiologica ? {
      descripcion_biologica: params.descripcionBiologica,
      curiosidades: params.curiosidades ? JSON.parse(params.curiosidades) : [],
      mitos: params.mitos
    } : null
  );

  // ─── Analizar con IA ──────────────────────────────────────────────────────
  /** Convierte imagen a base64 (web o native) y llama a Gemini */
  const handleAnalyzeIA = async (overrideUri?: string) => {
    const uriToAnalyze = overrideUri || localMediaUri;
    if (!uriToAnalyze) return;
    
    setIsIdentifying(true);
    setAiCandidates([]);
    try {
      let base64 = '';
      
      if (Platform.OS === 'web') {
        const resp = await fetch(uriToAnalyze);
        const blob = await resp.blob();
        base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(uriToAnalyze, { encoding: 'base64' });
      }

      const result = await identifySpecies(base64);
      const candidates = result.candidates || [];
      setAiCandidates(candidates);

      if (candidates.length > 0) {
        // Seleccionar el primero por defecto (el más probable)
        selectCandidate(candidates[0]);
      }
    } catch (err: any) {
      console.error('IA Error:', err);
      Alert.alert('Error IA', 'No se pudo identificar la especie automáticamente.');
    } finally {
      setIsIdentifying(false);
    }
  };

  /** Aplica los datos del candidato seleccionado al formulario */
  const selectCandidate = (cand: any) => {
    setNombreTradicional(cand.nombreTradicional);
    setNombreCientifico(cand.nombreCientifico);
    setPeligrosidad(cand.peligrosidad);
    setEndemismo(cand.endemismo);
    setIaCerteza(cand.iaCerteza);
    setSelectedFullInfo({
      descripcion_biologica: cand.descripcionBiologica,
      curiosidades: cand.curiosidades,
      mitos: cand.mitos
    });
  };

  const [aiCandidates, setAiCandidates] = useState<any[]>([]);

  // ─── Abrir mapa y obtener GPS ─────────────────────────────────────────────
  /** Solicita permisos GPS, obtiene coordenadas y abre el modal del mapa */
  const handleOpenMap = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      // Si falla la geolocalización, centrar en la región Guayana (un poco más al sur)
      setCoords({ lat: 4.5, lng: -63.5 });
    } finally {
      setLocLoading(false);
      setMapModalVisible(true);
    }
  };

  const confirmLocation = () => {
    if (!coords) setCoords({ lat: 5.0, lng: -63.5 }); // fallback Guayana
    setMapModalVisible(false);
  };

  /** Guarda como borrador local con status `pending_ai` */
  const handleSaveAsDraft = async () => {
    if (!nombreTradicional.trim()) return Alert.alert('Falta especie', 'Ingresá el nombre para el borrador.');
    if (!coords)                   return Alert.alert('Falta ubicación', 'Confirmá la ubicación en el mapa.');
    if (!currentMediaUrl)          return Alert.alert('Falta imagen',   'Adjuntá al menos una foto o video.');

    const draftId = await saveDraft({
      status: 'pending_ai',
      nombre_tradicional: nombreTradicional.trim(),
      nombre_cientifico: nombreCientifico.trim(),
      peligrosidad: peligrosidad.trim(),
      alimentacion: '',
      endemismo: endemismo.trim(),
      descripcion: descripcion.trim(),
      media_uri: currentMediaUrl,
      tipo_media: currentTipoMedia,
      latitud: coords.lat,
      longitud: coords.lng,
    });

    if (draftId) {
      Alert.alert(
        'Borrador Guardado 💾',
        'El registro se guardó localmente. Se identificará y subirá automáticamente en segundo plano.',
        [{ text: 'Entendido', onPress: () => router.replace('/(tabs)') }]
      );
    }
  };

  // ─── Publicar — Offline First ─────────────────────────────────────────────
  /** Valida geofence, guarda como `pending_upload` para sync en background */
  const handlePublish = async () => {
    if (!nombreTradicional.trim()) return Alert.alert('Falta especie', 'Ingresá el nombre de la especie.');
    if (!coords)                   return Alert.alert('Falta ubicación', 'Confirmá la ubicación en el mapa.');
    if (!currentMediaUrl)          return Alert.alert('Falta imagen',   'Adjuntá al menos una foto o video.');

    // Validar Geofencing (Región Guayana)
    const isInsideGuayana = isPointInPolygon(
      { latitude: coords.lat, longitude: coords.lng },
      GUAYANA_POLYGON
    );

    if (!isInsideGuayana) {
      return Alert.alert(
        'Ubicación inválida',
        'La ubicación seleccionada no pertenece a una región de la guayana venezolana.'
      );
    }

    setPublishing(true);
    try {
      // Guardar localmente como pending_upload (la IA ya corrió en este flujo)
      const draftId = await saveDraft({
        status: 'pending_upload',
        nombre_tradicional: nombreTradicional.trim(),
        nombre_cientifico: nombreCientifico.trim(),
        peligrosidad: peligrosidad.trim(),
        alimentacion: '',
        endemismo: endemismo.trim(),
        descripcion: descripcion.trim(),
        media_uri: currentMediaUrl,
        tipo_media: currentTipoMedia,
        latitud: coords.lat,
        longitud: coords.lng,
        ia_certeza: iaCerteza,
        metadatos_especie: {
          origen: fromScanner ? 'scanner' : 'manual',
          ...(selectedFullInfo || {})
        },
      });

      if (draftId) {
        Alert.alert(
          '¡Guardado! 📡',
          `"${nombreTradicional}" se guardó localmente y se subirá en segundo plano cuando haya conexión.`,
          [{ text: 'Entendido', onPress: () => router.replace('/(tabs)') }],
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Inténtalo de nuevo.');
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
          headerTitle: 'Cargar Registro',
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
              {currentMediaUrl ? 'Cambiar' : 'Cargar'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Lista de Candidatos IA ── */}
        {(isIdentifying || aiCandidates.length > 0) && (
          <View style={styles.candidatesSection}>
            <Text style={styles.candidatesTitle}>
              {isIdentifying ? 'Analizando especie...' : 'Seleccione el resultado más preciso:'}
            </Text>
            {isIdentifying && <ActivityIndicator color="#004d40" style={{ marginVertical: 10 }} />}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidatesScroll}>
              {aiCandidates.map((cand, idx) => {
                const isSelected = nombreTradicional === cand.nombreTradicional;
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.candidateCard, isSelected && styles.candidateCardActive]}
                    onPress={() => selectCandidate(cand)}
                  >
                    <Text style={[styles.candidatePercent, isSelected && styles.candidatePercentActive]}>
                      {Math.round(cand.iaCerteza * 100)}%
                    </Text>
                    <Text style={[styles.candidateName, isSelected && styles.candidateNameActive]} numberOfLines={1}>
                      {cand.nombreTradicional}
                    </Text>
                    <Text style={styles.candidateScientific} numberOfLines={1}>
                      {cand.nombreCientifico}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
              style={[styles.input, { backgroundColor: '#f0f0f0' }]}
              value={nombreTradicional}
              onChangeText={setNombreTradicional}
              placeholder="Detectado por IA..."
              placeholderTextColor="#aaa"
              editable={false}
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nombre Científico</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#f0f0f0' }]}
              value={nombreCientifico}
              onChangeText={setNombreCientifico}
              placeholder="Detectado por IA..."
              placeholderTextColor="#aaa"
              editable={false}
            />
          </View>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Peligrosidad</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                value={peligrosidad}
                onChangeText={setPeligrosidad}
                placeholder="---"
                placeholderTextColor="#aaa"
                editable={false}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Endemismo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#f0f0f0' }]}
                value={endemismo}
                onChangeText={setEndemismo}
                placeholder="---"
                placeholderTextColor="#aaa"
                editable={false}
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

        {/* ── Botones de Acción ── */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.draftBtn, publishing && { opacity: 0.6 }]}
            onPress={handleSaveAsDraft}
            disabled={publishing}
          >
            <Ionicons name="save-outline" size={20} color="#004d40" />
            <Text style={styles.draftBtnText}>Borrador</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.publishBtn, { flex: 1 }, publishing && { opacity: 0.6 }]}
            onPress={handlePublish}
            disabled={publishing}
          >
            {publishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.publishBtnText}>Publicar</Text>
            }
          </TouchableOpacity>
        </View>

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
  
  // IA Candidates
  candidatesSection: { marginTop: 16, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#eee' },
  candidatesTitle: { fontSize: 13, fontWeight: 'bold', color: '#555', marginBottom: 12, textTransform: 'uppercase' },
  candidatesScroll: { gap: 12 },
  candidateCard: { width: 140, padding: 12, borderRadius: 12, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e0e0e0' },
  candidateCardActive: { backgroundColor: '#e0f2f1', borderColor: '#004d40' },
  candidatePercent: { fontSize: 10, fontWeight: 'bold', color: '#666', marginBottom: 4 },
  candidatePercentActive: { color: '#004d40' },
  candidateName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  candidateNameActive: { color: '#004d40' },
  candidateScientific: { fontSize: 11, fontStyle: 'italic', color: '#888' },
  iaAnalyzeBtn: {
    flex: 1,
    height: 100,
    backgroundColor: '#004d40',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  iaAnalyzeText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

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
  actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  draftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#004d40',
    backgroundColor: '#fff',
    gap: 8,
  },
  draftBtnText: { color: '#004d40', fontSize: 16, fontWeight: 'bold' },
  publishBtn: { backgroundColor: '#004d40', padding: 18, borderRadius: 16, alignItems: 'center', minHeight: 58, justifyContent: 'center' },
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
