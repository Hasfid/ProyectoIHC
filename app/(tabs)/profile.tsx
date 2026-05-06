import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  FlatList,
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
  const [userRecords, setUserRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState<'Todos' | 'Animales' | 'Plantas'>('Todos');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [loadingEnrichedData, setLoadingEnrichedData] = useState(false);

  const getEnrichedData = async (item: any) => {
    // 1. Intentar extraer de los metadatos guardados en el registro (DB)
    if (item.metadatos_especie?.descripcion_biologica) {
      return {
        descripcion_biologica: item.metadatos_especie.descripcion_biologica,
        curiosidades: item.metadatos_especie.curiosidades || [],
        mitos: item.metadatos_especie.mitos || 'Protector de la selva.'
      };
    }

    // 2. Fallback Mock si no hay en DB (para registros antiguos)
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        const nombreLower = (item.nombre_tradicional || '').toLowerCase();
        if (nombreLower.includes('jaguar') || nombreLower.includes('tigre')) {
          resolve({
            descripcion_biologica: 'El jaguar (Panthera onca) es el felino más grande de América...',
            curiosidades: ['Mordida potente', 'Excelente nadador', 'Manchas únicas'],
            mitos: 'Espíritu guardián Kaikuse para los Pemón.'
          });
        } else {
          resolve({
            descripcion_biologica: 'Especimen del escudo guayanés con adaptaciones únicas.',
            curiosidades: ['Indicador biológico', 'Red trófica compleja'],
            mitos: 'Protector de la selva en la tradición oral.'
          });
        }
      }, 500);
    });
  };

  useEffect(() => {
    if (selectedRecord) {
      setLoadingEnrichedData(true);
      getEnrichedData(selectedRecord).then((data) => {
        setEnrichedData(data);
        setLoadingEnrichedData(false);
      });
    } else {
      setEnrichedData(null);
    }
  }, [selectedRecord]);


  useEffect(() => {
    fetchSessionAndProfile();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
        fetchStats(session.user.id);
        fetchUserRecords(session.user.id);
        fetchUserPosts(session.user.id);
      } else {
        setProfile(null);
        setStats({ followers: 0, following: 0, records: 0 });
        setUserRecords([]);
        setUserPosts([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Refrescar registros al volver a la pantalla
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchStats(session.user.id);
        fetchUserRecords(session.user.id);
        fetchUserPosts(session.user.id);
      }
    }, [session])
  );

  const fetchSessionAndProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
      await fetchStats(session.user.id);
      await fetchUserRecords(session.user.id);
      await fetchUserPosts(session.user.id);
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
    // Contar seguidores
    const { count: followersCount } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguido_id', userId);

    // Contar seguidos
    const { count: followingCount } = await supabase
      .from('seguidores')
      .select('*', { count: 'exact', head: true })
      .eq('seguidor_id', userId);

    // Contar registros
    const { count: recordsCount } = await supabase
      .from('registros')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', userId);

    setStats({
      followers: followersCount || 0,
      following: followingCount || 0,
      records: recordsCount || 0,
    });
  };

  const fetchUserRecords = async (userId: string) => {
    const { data, error } = await supabase
      .from('registros')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUserRecords(data);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    const { data, error } = await supabase
      .from('publicaciones')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }); // Tie-breaker

    if (!error && data) {
      setUserPosts(data);
    }
  };

  const isAnimal = (item: any) => {
    const alimentacion = (item.alimentacion || '').toLowerCase();
    if (alimentacion.includes('carnívoro') || alimentacion.includes('herbívoro') || alimentacion.includes('omnívoro')) {
      return true;
    }
    const nombre = (item.nombre_tradicional || '').toLowerCase();
    const nombreC = (item.nombre_cientifico || '').toLowerCase();
    if (nombre.includes('orquídea') || nombre.includes('flor') || nombre.includes('árbol') || nombre.includes('planta') || nombre.includes('helecho') || nombreC.includes('sp.')) {
      return false;
    }
    return true; 
  };

  const filteredRecords = userRecords.filter(item => {
    if (filter === 'Todos') return true;
    const isAnim = isAnimal(item);
    if (filter === 'Animales') return isAnim;
    if (filter === 'Plantas') return !isAnim;
    return true;
  });

  // --- Funciones de Registros ---
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editRecordDesc, setEditRecordDesc] = useState('');

  const handleDeleteRecord = (recordId: string) => {
    console.log('handleDeleteRecord called for ID:', recordId);
    Alert.alert(
      'Eliminar registro',
      '¿Estás seguro de que quieres eliminar este registro permanentemente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to delete from Supabase for ID:', recordId);
              // Usamos count: 'exact' para ver si realmente se borró algo
              const { error, count } = await supabase
                .from('registros')
                .delete({ count: 'exact' })
                .eq('id', recordId);
              
              if (error) {
                console.error('Supabase delete error:', error);
                throw error;
              }

              console.log('Rows affected:', count);

              if (count === 0) {
                Alert.alert(
                  'Atención', 
                  'El registro no se borró de la base de datos. Esto suele pasar por falta de permisos (RLS) o porque el registro ya no existe.'
                );
                return;
              }

              console.log('Delete success!');
              setSelectedRecord(null);
              
              if (session?.user?.id) {
                await fetchUserRecords(session.user.id);
                await fetchStats(session.user.id);
              }
              Alert.alert('Éxito', 'El registro ha sido eliminado correctamente.');
            } catch (err: any) {
              console.error('Detailed delete error:', err);
              Alert.alert('Error', 'No se pudo eliminar: ' + (err.message || 'Error desconocido'));
            }
          },
        },
      ]
    );
  };

  const handleSaveRecordEdit = async () => {
    if (!editingRecord) return;
    try {
      const { error } = await supabase
        .from('registros')
        .update({ 
          descripcion: editRecordDesc.trim() 
        })
        .eq('id', editingRecord.id);
      if (error) throw error;

      // Actualizar el registro seleccionado y la lista
      const updated = { 
        ...selectedRecord, 
        descripcion: editRecordDesc.trim() 
      };
      setSelectedRecord(updated);
      setEditingRecord(null);
      if (session?.user?.id) {
        await fetchUserRecords(session.user.id);
      }
    } catch (err) {
      console.error('Error updating record:', err);
      Alert.alert('Error', 'No se pudo actualizar la descripción.');
    }
  };

  // --- Funciones de Comunidad ---
  const handleDeletePost = (postId: string) => {
    Alert.alert(
      'Eliminar publicación',
      '¿Estás seguro de que quieres eliminar esta publicación?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('publicaciones')
                .delete()
                .eq('id', postId);
              if (error) throw error;
              if (session?.user?.id) {
                await fetchUserPosts(session.user.id);
              }
            } catch (err) {
              console.error('Error deleting post:', err);
              Alert.alert('Error', 'No se pudo eliminar la publicación.');
            }
          },
        },
      ]
    );
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
        const { data: existingUser, error: checkError } = await supabase
          .from('perfiles')
          .select('id')
          .eq('username', editUsername.toLowerCase().trim())
          .maybeSingle();

        if (existingUser && existingUser.id !== session?.user.id) {
          setUsernameError('Ese nombre de usuario ya está en uso');
          setSaving(false);
          return;
        }
      }

      let finalPhotoUrl = profile?.foto_perfil;
      if (editPhoto && editPhoto !== profile?.foto_perfil) {
        try {
          finalPhotoUrl = await uploadMediaToSupabase(editPhoto, 'image/jpeg');
        } catch (uploadErr) {
          console.error('Error uploading photo:', uploadErr);
          // Continuar sin cambiar la foto
        }
      }

      const updateData: any = {
        username: editUsername.toLowerCase().trim(),
        nombre: editUsername,
        descripcion: editDescription,
      };
      if (finalPhotoUrl) {
        updateData.foto_perfil = finalPhotoUrl;
      }

      const { error } = await supabase
        .from('perfiles')
        .update(updateData)
        .eq('id', session?.user.id);

      if (error) throw error;

      setProfile({
        ...profile,
        ...updateData,
        foto_perfil: finalPhotoUrl || profile?.foto_perfil,
      });

      setIsEditing(false);
    } catch (err: any) {
      console.error('Save profile error:', err);
      Alert.alert('Error', 'No se pudo actualizar el perfil: ' + (err?.message || JSON.stringify(err)));
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
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={28} color="#111" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#111" />
          </TouchableOpacity>
        </View>
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
              <Text style={styles.statLabel}>Mi Expedición</Text>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/social', params: { userId: session?.user?.id, tab: 'followers' } })}>
              <Text style={styles.statNumber}>{stats.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/social', params: { userId: session?.user?.id, tab: 'following' } })}>
              <Text style={styles.statNumber}>{stats.following}</Text>
              <Text style={styles.statLabel}>Seguidos</Text>
            </TouchableOpacity>
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
          <TouchableOpacity style={styles.editButton} onPress={() => router.push({ pathname: '/social', params: { tab: 'discover' } })}>
            <Text style={styles.editButtonText}>Descubrir personas</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.activeTab]} 
            onPress={() => setActiveTab('records')}
          >
            <Ionicons name="grid-outline" size={24} color={activeTab === 'records' ? '#111' : '#888'} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'community' && styles.activeTab]} 
            onPress={() => setActiveTab('community')}
          >
            <Ionicons name="megaphone-outline" size={24} color={activeTab === 'community' ? '#111' : '#888'} />
          </TouchableOpacity>
        </View>

        {activeTab === 'records' && (
          <View style={styles.filterRow}>
            {['Todos', 'Animales', 'Plantas'].map((f: any) => (
              <TouchableOpacity 
                key={f} 
                onPress={() => setFilter(f)}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'records' && (
          filteredRecords.length === 0 ? (
            <View style={[styles.gridContainer, { justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
              <Ionicons name="leaf-outline" size={48} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 8 }}>Sin registros en esta categoría</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredRecords.map((record) => (
                <TouchableOpacity
                  key={record.id}
                  style={styles.gridItem}
                  onPress={() => setSelectedRecord(record)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: record.media_url }} style={styles.gridImage} />
                </TouchableOpacity>
              ))}
            </View>
          )
        )}

        {activeTab === 'community' && (
          userPosts.length === 0 ? (
            <View style={[styles.gridContainer, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
              <Ionicons name="megaphone-outline" size={48} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 8 }}>Sin publicaciones en la comunidad</Text>
            </View>
          ) : (
            <View style={styles.postsListContainer}>
              {userPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postCardHeader}>
                    <Text style={styles.postCardTitle}>{post.titulo}</Text>
                    <TouchableOpacity onPress={() => handleDeletePost(post.id)}>
                      <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.postCardDesc}>{post.descripcion}</Text>
                  <Text style={styles.postCardDate}>
                    {new Date(post.created_at).toLocaleDateString('es-VE')}
                  </Text>
                </View>
              ))}
            </View>
          )
        )}


        {/* Modal de detalle del registro */}
        <Modal
          visible={!!selectedRecord}
          animationType="slide"
          transparent={true}
          onRequestClose={() => { setSelectedRecord(null); setEditingRecord(null); }}
        >
          <View style={styles.recordModalOverlay}>
            {selectedRecord && (
              <View style={styles.recordModalContent}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Image source={{ uri: selectedRecord.media_url }} style={styles.recordModalImage} />
                  <TouchableOpacity
                    style={styles.recordModalClose}
                    onPress={() => { setSelectedRecord(null); setEditingRecord(null); }}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.recordModalBody}>
                    {/* Descripción editable únicamente */}
                    {editingRecord?.id === selectedRecord.id ? (
                      <View style={{ marginVertical: 8 }}>
                        <Text style={styles.label}>Editar Descripción</Text>
                        <TextInput
                          style={[styles.editRecordInput, { height: 100 }]}
                          value={editRecordDesc}
                          onChangeText={setEditRecordDesc}
                          multiline
                          numberOfLines={4}
                          placeholder="Escribe una descripción..."
                          placeholderTextColor="#999"
                        />
                        
                        <View style={styles.editRecordActions}>
                          <TouchableOpacity
                            style={styles.editRecordCancelBtn}
                            onPress={() => setEditingRecord(null)}
                          >
                            <Text style={styles.editRecordCancelText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.editRecordSaveBtn}
                            onPress={handleSaveRecordEdit}
                          >
                            <Text style={styles.editRecordSaveText}>Guardar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.recordModalTitle}>{selectedRecord.nombre_tradicional}</Text>
                        {selectedRecord.nombre_cientifico ? (
                          <Text style={styles.recordModalScientific}>{selectedRecord.nombre_cientifico}</Text>
                        ) : null}
                        <Text style={styles.recordModalDesc}>
                          {selectedRecord.descripcion || 'Sin descripción'}
                        </Text>

                        {/* Enriquecimiento IA */}
                        {loadingEnrichedData ? (
                          <ActivityIndicator color="#2e7d32" style={{ marginVertical: 20 }} />
                        ) : enrichedData ? (
                          <View style={styles.enrichedSection}>
                            <View style={styles.enrichedCard}>
                              <Text style={styles.enrichedTitle}>Información Biológica</Text>
                              <Text style={styles.enrichedText}>{enrichedData.descripcion_biologica}</Text>
                            </View>
                            <View style={styles.enrichedCard}>
                              <Text style={styles.enrichedTitle}>Mitos y Leyendas</Text>
                              <Text style={styles.enrichedText}>{enrichedData.mitos}</Text>
                            </View>
                          </View>
                        ) : null}

                        {/* Botones de acción (Solo en modo vista) */}
                        <View style={styles.recordActionButtons}>
                          <TouchableOpacity
                            style={styles.recordEditBtn}
                            onPress={() => {
                              setEditingRecord(selectedRecord);
                              setEditRecordDesc(selectedRecord.descripcion || '');
                            }}
                          >
                            <Ionicons name="pencil" size={16} color="#fff" />
                            <Text style={styles.recordEditBtnText}>Editar nota</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.recordDeleteBtn}
                            onPress={() => handleDeleteRecord(selectedRecord.id)}
                          >
                            <Ionicons name="trash" size={16} color="#fff" />
                            <Text style={styles.recordDeleteBtnText}>Eliminar</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </Modal>

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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
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
  gridItem: {
    width: (width - 4) / 3,
    height: (width - 4) / 3,
    padding: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },

  // Record Detail Modal
  recordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
  },
  recordModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  recordModalImage: {
    width: '100%',
    height: 350,
    resizeMode: 'cover',
  },
  recordModalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordModalBody: {
    padding: 20,
  },
  recordModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  recordModalScientific: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#2e7d32',
    marginBottom: 12,
  },
  recordModalDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 16,
  },
  recordModalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recordMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recordMetaText: {
    fontSize: 13,
    color: '#444',
  },
  recordActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  recordEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 10,
  },
  recordEditBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  recordDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#d32f2f',
    paddingVertical: 12,
    borderRadius: 10,
  },
  recordDeleteBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  editRecordInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },
  editRecordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  editRecordCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  editRecordCancelText: {
    color: '#555',
    fontWeight: '600',
  },
  editRecordSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2e7d32',
  },
  editRecordSaveText: {
    color: '#fff',
    fontWeight: '600',
  },
  postsListContainer: {
    padding: 20,
    gap: 16,
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  postCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  postCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    flex: 1,
    marginRight: 10,
  },
  postCardDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  postCardDate: {
    fontSize: 12,
    color: '#999',
  },
  
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
  textArea: { height: 100, textAlignVertical: 'top' },
  
  // Enriched Styles
  enrichedSection: { marginTop: 10, gap: 12 },
  enrichedCard:    { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  enrichedTitle:   { fontSize: 15, fontWeight: 'bold', color: '#2e7d32', marginBottom: 6 },
  enrichedText:    { fontSize: 13, color: '#555', lineHeight: 20 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12, marginTop: 10 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f5', borderWeight: 1, borderColor: '#eee', borderWidth: 1 },
  filterChipActive: { backgroundColor: '#e0f2f1', borderColor: '#004d40' },
  filterText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#004d40' },
});
