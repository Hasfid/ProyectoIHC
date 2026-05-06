import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadMediaToSupabase } from '../../lib/uploadMedia';

const { width } = Dimensions.get('window');

type Tab = 'records' | 'community';

export default function ProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estados de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({ followers: 0, following: 0, records: 0 });

  useEffect(() => {
    fetchSessionAndProfile();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchStats(session.user.id);
      } else {
        setProfile(null);
        setStats({ followers: 0, following: 0, records: 0 });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchSessionAndProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
      await fetchStats(session.user.id);
    }
    setLoading(false);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      // Si el perfil no existe (ej: usuario anónimo), crear uno por defecto en memoria
      setProfile({
        id: userId,
        username: session?.user?.user_metadata?.username || 'Usuario Anónimo',
        nombre: session?.user?.user_metadata?.nombre || 'Usuario Anónimo',
        descripcion: 'Explorador de Guayana',
        foto_perfil: null
      });
    } else {
      setProfile(data);
    }
  };

  const fetchStats = async (userId: string) => {
    // Contar seguidores (cuántos siguen a este usuario)
    const { count: followersCount } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguido_id', userId);

    // Contar seguidos (a cuántos sigue este usuario)
    const { count: followingCount } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguidor_id', userId);

    setStats(prev => ({
      ...prev,
      followers: followersCount || 0,
      following: followingCount || 0
    }));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // --- Funciones de Edición ---
  const openEditModal = () => {
    setEditUsername(profile?.username || profile?.nombre || '');
    setEditDescription(profile?.descripcion || '');
    setEditPhoto(profile?.foto_perfil || null);
    setUsernameError('');
    setIsEditing(true);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setEditPhoto(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    if (!editUsername) {
      setUsernameError('El nombre de usuario no puede estar vacío');
      return;
    }

    setSaving(true);
    setUsernameError('');

    try {
      const currentUsername = profile?.username || profile?.nombre;
      if (editUsername.toLowerCase().trim() !== currentUsername?.toLowerCase().trim()) {
        const { data: existingUser } = await supabase
          .from('perfiles')
          .select('id')
          .eq('username', editUsername.toLowerCase().trim())
          .single();

        if (existingUser && existingUser.id !== session?.user.id) {
          setUsernameError('Ese nombre de usuario ya está en uso');
          setSaving(false);
          return;
        }
      }

      let finalPhotoUrl = profile?.foto_perfil;
      if (editPhoto && editPhoto !== profile?.foto_perfil) {
        finalPhotoUrl = await uploadMediaToSupabase(editPhoto, 'image/jpeg');
      }

      const { error } = await supabase
        .from('perfiles')
        .upsert({
          id: session?.user.id,
          username: editUsername.toLowerCase().trim(),
          nombre: editUsername, 
          descripcion: editDescription,
          foto_perfil: finalPhotoUrl
        });

      if (error) throw error;

      setProfile({
        ...profile,
        username: editUsername.toLowerCase().trim(),
        nombre: editUsername,
        descripcion: editDescription,
        foto_perfil: finalPhotoUrl
      });

      setIsEditing(false);
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  const isDefaultUnsplash = profile.foto_perfil?.includes('images.unsplash.com');
  const hasPhoto = profile.foto_perfil && !isDefaultUnsplash;

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <Text style={styles.customHeaderTitle}>Perfil</Text>
        <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={28} color="#111" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          {hasPhoto ? (
            <Image source={{ uri: profile.foto_perfil }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
              <Ionicons name="person" size={50} color="#ccc" />
            </View>
          )}
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.records}</Text>
              <Text style={styles.statLabel}>Registros</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.following}</Text>
              <Text style={styles.statLabel}>Seguidos</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.fullName}>{profile.username || profile.nombre}</Text>
          <Text style={styles.description}>{profile.descripcion || 'Sin descripción.'}</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.activeTab]} 
            onPress={() => setActiveTab('records')}
          >
            <Ionicons name="grid-outline" size={24} color={activeTab === 'records' ? '#111' : '#888'} />
          </TouchableOpacity>
        </View>

        {activeTab === 'records' && (
          <View style={[styles.gridContainer, { justifyContent: 'center', padding: 20 }]}>
             <Text style={{color: '#999'}}>Aún no hay fotos.</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* MODAL DE EDICIÓN */}
      <Modal visible={isEditing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsEditing(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditing(false)} disabled={saving}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar Perfil</Text>
            <TouchableOpacity onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#2e7d32" /> : <Text style={styles.modalSaveText}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Editar foto */}
            <View style={styles.editPhotoContainer}>
              {editPhoto && !editPhoto.includes('images.unsplash.com') ? (
                <Image source={{ uri: editPhoto }} style={styles.editProfileImage} />
              ) : (
                <View style={[styles.editProfileImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
                  <Ionicons name="person" size={50} color="#ccc" />
                </View>
              )}
              <TouchableOpacity onPress={pickImage} style={styles.changePhotoButton}>
                <Text style={styles.changePhotoText}>Cambiar foto</Text>
              </TouchableOpacity>
            </View>

            {/* Editar Username */}
            <Text style={styles.label}>Nombre de usuario</Text>
            <TextInput
              style={[styles.input, usernameError ? styles.inputError : null]}
              value={editUsername}
              onChangeText={setEditUsername}
              autoCapitalize="none"
              editable={!saving}
            />
            {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}

            {/* Editar Descripción */}
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              numberOfLines={4}
              placeholder="Cuéntanos sobre ti..."
              editable={!saving}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  customHeader: {
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10,
    backgroundColor: 'transparent', position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  customHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  scrollContent: { paddingTop: 100 },
  menuButton: { padding: 8 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  profileImage: { width: 86, height: 86, borderRadius: 43, borderWidth: 1, borderColor: '#eaeaea' },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 16 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 13, color: '#444', marginTop: 2 },
  infoContainer: { paddingHorizontal: 20, marginBottom: 16 },
  fullName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4 },
  description: { fontSize: 14, color: '#333', lineHeight: 20 },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 20 },
  editButton: { flex: 1, backgroundColor: '#f2f2f2', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  editButtonText: { fontSize: 14, fontWeight: '600', color: '#111' },
  tabsContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eaeaea' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#111' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#eaeaea'
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalCancelText: { fontSize: 16, color: '#555' },
  modalSaveText: { fontSize: 16, color: '#2e7d32', fontWeight: 'bold' },
  modalBody: { padding: 20 },
  editPhotoContainer: { alignItems: 'center', marginBottom: 30 },
  editProfileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  changePhotoButton: { padding: 8 },
  changePhotoText: { color: '#2e7d32', fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 16, backgroundColor: '#fafafa', marginBottom: 20
  },
  inputError: { borderColor: '#d32f2f' },
  errorText: { color: '#d32f2f', fontSize: 12, marginTop: -15, marginBottom: 20, marginLeft: 5 },
  textArea: { height: 100, textAlignVertical: 'top' }
});
