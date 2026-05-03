import React, { useState } from 'react';
import { 
  StyleSheet, View, Text, ScrollView, TouchableOpacity, 
  TextInput, Image, KeyboardAvoidingView, Platform, Dimensions, Modal
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import Map from '../components/Map';

// Base de datos simulada de especies en Venezuela
const MOCK_SPECIES_DB = [
  { id: '1', tradicional: 'Jaguar', cientifico: 'Panthera onca', endemico: 'No', peligroso: 'Sí', habitat: 'Selva tropical', similitud: '98%' },
  { id: '2', tradicional: 'Cunaguaro', cientifico: 'Leopardus pardalis', endemico: 'No', peligroso: 'Precaución', habitat: 'Bosque', similitud: '65%' },
  { id: '3', tradicional: 'Guacamaya Azul y Amarillo', cientifico: 'Ara ararauna', endemico: 'No', peligroso: 'No', habitat: 'Selva / Ciudad', similitud: '99%' },
  { id: '4', tradicional: 'Orquídea Flor de Mayo', cientifico: 'Cattleya mossiae', endemico: 'Sí', peligroso: 'No', habitat: 'Montaña húmeda', similitud: '95%' }
];

export default function CreateRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Si viene del escáner, los parámetros vendrán pre-llenados
  const isFromScanner = params.autoFill === 'true';

  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSpecies, setSelectedSpecies] = useState<any>(
    isFromScanner ? MOCK_SPECIES_DB.find(s => s.id === params.speciesId) : null
  );
  
  const [description, setDescription] = useState('');
  const [locationSelected, setLocationSelected] = useState(false);
  const [mapModalVisible, setMapModalVisible] = useState(false);

  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Foto y Video
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setMediaUris([...mediaUris, ...result.assets.map(a => a.uri)]);
      // Si suben foto, simulamos que la IA encontró especies similares
      if (!isFromScanner) {
        setTimeout(() => setShowSuggestions(true), 1000);
      }
    }
  };

  const handleSelectSpecies = (species: any) => {
    setSelectedSpecies(species);
    setShowSuggestions(false);
  };

  const handlePublish = () => {
    if (!selectedSpecies) return alert('Debes seleccionar la especie.');
    if (!locationSelected) return alert('Debes marcar la ubicación en el mapa.');
    alert('Registro publicado exitosamente en el mapa.');
    router.push('/discover');
  };

  const confirmLocation = () => {
    setLocationSelected(true);
    setMapModalVisible(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen 
        options={{
          headerTitle: 'Nuevo Registro',
          headerStyle: { backgroundColor: '#f9fafb' },
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
              <Ionicons name="close" size={28} color="#111" />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>Material Audiovisual</Text>
        <Text style={styles.sectionSubtitle}>Podés subir fotos, videos o audios.</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
          {mediaUris.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={styles.mediaPreview} />
          ))}
          <TouchableOpacity style={styles.addMediaBtn} onPress={handlePickMedia}>
            <Ionicons name="cloud-upload-outline" size={32} color="#004d40" />
            <Text style={styles.addMediaText}>Cargar</Text>
          </TouchableOpacity>
        </ScrollView>

        {showSuggestions && !selectedSpecies && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>¡Especies similares encontradas por IA!</Text>
            {MOCK_SPECIES_DB.map((sp) => (
              <TouchableOpacity key={sp.id} style={styles.suggestionCard} onPress={() => handleSelectSpecies(sp)}>
                <View>
                  <Text style={styles.suggestionName}>{sp.tradicional}</Text>
                  <Text style={styles.suggestionScience}>{sp.cientifico}</Text>
                </View>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>{sp.similitud}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.formContainer}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nombre Tradicional</Text>
            <TextInput style={styles.inputDisabled} value={selectedSpecies?.tradicional || ''} editable={false} placeholder="Detectando por IA..." />
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nombre Científico</Text>
            <TextInput style={styles.inputDisabled} value={selectedSpecies?.cientifico || ''} editable={false} placeholder="Detectando por IA..." />
          </View>
          <View style={styles.fieldGroup}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>¿Endémico?</Text>
              <TextInput style={styles.inputDisabled} value={selectedSpecies?.endemico || ''} editable={false} placeholder="..." />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>¿Peligroso?</Text>
              <TextInput style={styles.inputDisabled} value={selectedSpecies?.peligroso || ''} editable={false} placeholder="..." />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Hábitat General</Text>
            <TextInput style={styles.inputDisabled} value={selectedSpecies?.habitat || ''} editable={false} placeholder="Detectando por IA..." />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ubicación del Avistamiento *</Text>
        <TouchableOpacity 
          style={[styles.mapPickerBtn, locationSelected && styles.mapPickerBtnSelected]} 
          onPress={() => setMapModalVisible(true)}
        >
          <Ionicons name="map-outline" size={24} color={locationSelected ? "#fff" : "#004d40"} />
          <Text style={[styles.mapPickerText, locationSelected && { color: '#fff' }]}>
            {locationSelected ? 'Ubicación Registrada (Toca para ver)' : 'Abrir Mapa y Seleccionar'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Descripción (Opcional)</Text>
        <TextInput
          style={styles.inputDescription}
          placeholder="Escribí notas sobre el comportamiento, clima o contexto..."
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity style={styles.publishBtn} onPress={handlePublish}>
          <Text style={styles.publishBtnText}>Publicar Registro</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Modal del Mapa Interactivo */}
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
            {/* Elemento visual para simular la selección en el centro */}
            <View style={styles.mapTargetContainer} pointerEvents="none">
              <Ionicons name="location" size={48} color="#e53935" />
              <Text style={styles.mapTargetText}>Movelo al punto exacto</Text>
            </View>
          </View>

          <View style={styles.mapFooter}>
            <TouchableOpacity style={styles.confirmMapBtn} onPress={confirmLocation}>
              <Text style={styles.confirmMapBtnText}>Confirmar Ubicación Aquí</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginTop: 24, marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#666', marginBottom: 12 },
  mediaScroll: { flexDirection: 'row', marginBottom: 16 },
  mediaPreview: { width: 100, height: 100, borderRadius: 12, marginRight: 12 },
  addMediaBtn: { 
    width: 100, height: 100, borderRadius: 12, backgroundColor: '#e0f2f1', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#80cbc4', borderStyle: 'dashed' 
  },
  addMediaText: { color: '#004d40', fontWeight: 'bold', marginTop: 8 },
  suggestionsContainer: { backgroundColor: '#e8f5e9', padding: 16, borderRadius: 16, marginTop: 16 },
  suggestionsTitle: { color: '#2e7d32', fontWeight: 'bold', marginBottom: 12 },
  suggestionCard: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
  },
  suggestionName: { fontWeight: 'bold', color: '#111' },
  suggestionScience: { fontStyle: 'italic', color: '#666', fontSize: 12 },
  matchBadge: { backgroundColor: '#c8e6c9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchText: { color: '#2e7d32', fontWeight: 'bold', fontSize: 12 },
  formContainer: { marginTop: 16, backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#eee' },
  fieldRow: { marginBottom: 12 },
  fieldGroup: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  fieldHalf: { width: '48%' },
  fieldLabel: { fontSize: 12, fontWeight: 'bold', color: '#555', marginBottom: 4, textTransform: 'uppercase' },
  inputDisabled: { backgroundColor: '#f5f5f5', color: '#333', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0', fontWeight: '500' },
  mapPickerBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 16, backgroundColor: '#e0f2f1', borderRadius: 12, gap: 8, marginTop: 8
  },
  mapPickerBtnSelected: { backgroundColor: '#2e7d32' },
  mapPickerText: { color: '#004d40', fontWeight: 'bold', fontSize: 16 },
  inputDescription: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 16, height: 100, fontSize: 16, marginTop: 8 },
  publishBtn: { backgroundColor: '#004d40', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 32 },
  publishBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  // Estilos del Mapa Modal
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#fff', zIndex: 10 },
  closeMapBtn: { padding: 4 },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  mapTargetContainer: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -24 }, { translateY: -48 }], alignItems: 'center' },
  mapTargetText: { backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 12, fontWeight: 'bold', marginTop: 4, overflow: 'hidden' },
  mapFooter: { position: 'absolute', bottom: 40, left: 20, right: 20 },
  confirmMapBtn: { backgroundColor: '#e53935', paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  confirmMapBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
