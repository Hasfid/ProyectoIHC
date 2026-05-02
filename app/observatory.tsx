import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export default function ObservatoryScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);

  // Datos reales de la comunidad (vienen de Supabase)
  const [posts, setPosts] = useState<any[]>([]);

  const fetchPinesDelMapa = async () => {
    try {
      // Coordenadas amplias simulando que el usuario está viendo el mapa de Venezuela
      const { data, error } = await supabase.rpc('get_registros_mapa', {
        min_lat: 0.0,   // Sur
        min_lng: -74.0, // Oeste
        max_lat: 13.0,  // Norte
        max_lng: -58.0  // Este
      });

      if (error) throw error;

      if (data) {
        // Mapeamos lo que devuelve la API a la estructura que usa tu UI
        const posteosReales = data.map((item: any) => ({
          id: item.id,
          title: item.nombre_tradicional,
          description: item.descripcion,
          time: 'Capturado en zona', // Lo ideal es sacar la fecha de la BD luego
        }));
        setPosts(posteosReales);
      }
    } catch (error) {
      console.error("Error trayendo datos del mapa:", error);
    }
  };

  // Ejecutamos la búsqueda apenas el usuario entra a la pantalla
  useEffect(() => {
    fetchPinesDelMapa();
  }, []);

  const handleAttachEvidence = async () => {
    try {
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaStatus !== 'granted') {
        alert('Se necesitan permisos para acceder a la galería.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);

        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== 'granted') {
          alert('Se necesitan permisos de ubicación para registrar el avistamiento.');
          return;
        }
        
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    } catch (error) {
      console.error('Error con hardware:', error);
      alert('Hubo un error al adjuntar evidencia.');
    }
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newDescription.trim() || !imageUri || !location) {
      alert("Completá todos los campos, adjuntá la evidencia y asegurate de tener señal GPS.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Tenés que estar autenticado para registrar una especie.");

      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('multimedia_especies')
        .upload(fileName, arrayBuffer, {
          contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('multimedia_especies')
        .getPublicUrl(uploadData.path);

      const { error: dbError } = await supabase
        .from('registros')
        .insert({
          usuario_id: user.id,
          nombre_tradicional: newTitle,
          descripcion: newDescription,
          media_url: publicUrl,
          tipo_media: 'imagen',
          latitud: location.coords.latitude,
          longitud: location.coords.longitude,
        });

      if (dbError) throw dbError;

      const newPost = {
        id: Date.now().toString(),
        title: newTitle,
        description: newDescription,
        time: 'Justo ahora',
      };
      setPosts([newPost, ...posts]);

      setNewTitle('');
      setNewDescription('');
      setImageUri(null);
      setLocation(null);
      setModalVisible(false);
      
    } catch (error: any) {
      console.error('Error en handlePost:', error);
      alert(error.message || 'Hubo un error al publicar. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerTransparent: true,
          headerTitle: 'Observatorio',
          headerTitleStyle: { color: '#111', fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Sección de Transmisión en Vivo */}
        <Text style={styles.sectionTitle}>Transmisión en Vivo</Text>
        <View style={styles.liveCameraFrame}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=800&h=400' }} 
            style={styles.liveCameraImage} 
          />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        </View>

        {/* Sección de Comunidad */}
        <Text style={styles.sectionTitle}>Comunidad</Text>
        <View style={styles.postsContainer}>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postDescription}>{post.description}</Text>
              <Text style={styles.postTime}>{post.time}</Text>
            </View>
          ))}
        </View>
        
        <View style={{ height: 80 }} /> {/* Espacio para que el scroll pase el botón flotante */}
      </ScrollView>

      {/* Botón Flotante */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => setModalVisible(true)}>
          <BlurView intensity={80} tint="light" style={styles.blurContainer}>
            <Ionicons name="add" size={32} color="#004d40" />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Modal para nueva noticia */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalBackground} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crear Publicación</Text>
            
            <TextInput
              style={styles.inputTitle}
              placeholder="Título de la noticia"
              placeholderTextColor="#888"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            
            <TextInput
              style={styles.inputDescription}
              placeholder="Descripción..."
              placeholderTextColor="#888"
              multiline
              textAlignVertical="top"
              value={newDescription}
              onChangeText={setNewDescription}
            />
            
            <TouchableOpacity style={styles.imageUploadBtn} onPress={handleAttachEvidence}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={32} color="#004d40" />
                  <Text style={styles.imageUploadText}>Adjuntar Evidencia</Text>
                </>
              )}
            </TouchableOpacity>
            
            {location && (
              <View style={styles.gpsIndicator}>
                <Ionicons name="location" size={16} color="#2e7d32" />
                <Text style={styles.locationText}>
                  Coordenadas capturadas: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
                </Text>
              </View>
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handlePost} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#2e7d32" />
                ) : (
                  <Text style={styles.submitButtonText}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingTop: 100, // Espacio para el header transparente
    paddingHorizontal: 20,
  },
  backButton: {
    marginLeft: 16,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    marginTop: 8,
  },
  liveCameraFrame: {
    width: '100%',
    height: 220,
    backgroundColor: '#3e2723', // Color madera oscura
    borderRadius: 16,
    borderWidth: 6,
    borderColor: '#6d4c41', // Estética madera minimalista
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 32,
  },
  liveCameraImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff5252',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  postsContainer: {
    gap: 16,
  },
  postCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  postTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.4)', // Estética Cristal
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputTitle: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
    marginBottom: 16,
  },
  inputDescription: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111',
    height: 120,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ffebee',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 16,
  },
  imageUploadBtn: {
    height: 140,
    backgroundColor: '#e0f2f1',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#80cbc4',
    borderStyle: 'dashed',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageUploadText: {
    color: '#004d40',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 8,
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5e9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
  },
});
