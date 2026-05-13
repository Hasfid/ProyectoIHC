/**
 * @module ProfileScreen
 * Pantalla central de gestión del usuario.
 * 
 * Secciones:
 * - Cabecera Dinámica: Foto, estadísticas (registros, seguidores, seguidos) y edición.
 * - Mis Registros: Sistema Dual (Publicados en nube / Pendientes en local).
 * - Comunidad: Historial de publicaciones del usuario.
 * 
 * Gestión Offline:
 * - Los borradores pendientes se cargan desde AsyncStorage (`lib/drafts.ts`).
 * - Sincronización automática vía `lib/useOfflineSync.ts`.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  DeviceEventEmitter,
  Platform,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadMediaToSupabase } from '../../lib/uploadMedia';
import { getDrafts, deleteDraft, syncDrafts, updateDraft, DraftRecord, DRAFTS_UPDATED_EVENT, NOTIFICATION_UPDATED_EVENT } from '../../lib/drafts';
import { i18n, changeLanguage } from '../../lib/i18n';

const { width } = Dimensions.get('window');

type Tab = 'records' | 'community';
type RecordSubTab = 'published' | 'pending';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('records');
  const [recordSubTab, setRecordSubTab] = useState<RecordSubTab>('published');
  const [offlineDrafts, setOfflineDrafts] = useState<DraftRecord[]>([]);
  const [selectingDraft, setSelectingDraft] = useState<DraftRecord | null>(null);
  const [previewDraftImage, setPreviewDraftImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Si viene de Scanner con tab=pending, abrir esa sub-pestaña
  useEffect(() => {
    if (params.tab === 'pending') {
      setActiveTab('records');
      setRecordSubTab('pending');
    }
  }, [params.tab]);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);
  const [candidateCounts, setCandidateCounts] = useState<Record<string, number>>({});
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme').then((t) => {
      if (t === 'dark') setIsDarkMode(true);
    });
  }, []);

  useEffect(() => {
    const metadatos = selectingDraft?.metadatos_especie as any;
    if (metadatos?.all_candidates) {
      const fetchCounts = async () => {
        const counts: Record<string, number> = {};
        for (const cand of metadatos.all_candidates) {
          try {
            const { count } = await supabase
              .from('registros')
              .select('*', { count: 'exact', head: true })
              .ilike('nombre_cientifico', `%${cand.nombreCientifico}%`);
            counts[cand.nombreCientifico] = count || 0;
          } catch {
            counts[cand.nombreCientifico] = 0;
          }
        }
        setCandidateCounts(counts);
      };
      fetchCounts();
    } else {
      setCandidateCounts({});
    }
  }, [selectingDraft]);

  useEffect(() => {
    let channel: any;
    const init = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;
      const uid = currentSession.user.id;

      const fetchUnread = async () => {
        try {
          const { data, error } = await supabase
            .from('notificaciones')
            .select('id, tipo, mensaje')
            .eq('usuario_id', uid)
            .or('leido.eq.false,leido.is.null');
          
          if (error) {
            console.error('Error fetching unread (profile):', error.message);
            return;
          }

          if (data) {
            const valid = data.filter(n => !(n.tipo === 'seguidor' && !n.mensaje?.includes('||')));
            setUnreadCount(valid.length);
          }
        } catch (err) {
          console.error('fetchUnread exception (profile):', err);
        }
      };
      
      fetchUnread();

      channel = supabase
        .channel(`unread-notifs-profile-${uid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${uid}` }, () => {
          fetchUnread();
        })
        .subscribe();
        
      const eventListener = DeviceEventEmitter.addListener('NOTIFICATIONS_READ', () => {
        fetchUnread();
      });

      // Escuchar cuando se crea una notificación desde el sync de drafts
      const notifCreatedListener = DeviceEventEmitter.addListener(NOTIFICATION_UPDATED_EVENT, () => {
        fetchUnread();
      });

      // Polling cada 10s como fallback por si Realtime no conecta
      const pollInterval = setInterval(fetchUnread, 10_000);

      return () => {
        if (channel) supabase.removeChannel(channel);
        eventListener.remove();
        notifCreatedListener.remove();
        clearInterval(pollInterval);
      };
    };
    
    const cleanup = init();

    return () => {
      cleanup.then(clean => clean && clean());
    };
  }, []);

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
  const [searchQuery, setSearchQuery] = useState('');
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
    
    // Suscribirse a cambios en borradores (sync automático, borrado, etc)
    const draftSub = DeviceEventEmitter.addListener(DRAFTS_UPDATED_EVENT, () => {
      loadOfflineDrafts();
      if (session?.user?.id) {
        fetchStats(session.user.id);
        fetchUserRecords(session.user.id);
      }
    });
    
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

    return () => {
      subscription.unsubscribe();
      draftSub.remove();
    };
  }, []);

  // Suscripción en tiempo real a los seguidores
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`profile-stats-${session.user.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seguidores' }, () => {
        fetchStats(session.user.id);
      })
      .subscribe((status, err) => {
        if (err) console.error('Error profile-stats-channel:', err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Refrescar registros al volver a la pantalla
  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchStats(session.user.id);
        fetchUserRecords(session.user.id);
        fetchUserPosts(session.user.id);
      }
      // Cargar borradores offline (solo mobile)
      loadOfflineDrafts();
    }, [session])
  );

  /** Carga los borradores guardados localmente en AsyncStorage */
  const loadOfflineDrafts = async () => {
    const drafts = await getDrafts();
    setOfflineDrafts(drafts);
  };

  const hasDraftsToConfirm = offlineDrafts.some(d => d.status === 'pending_selection');

  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  const confirmDeleteDraft = async () => {
    if (deletingDraftId) {
      await deleteDraft(deletingDraftId);
      setDeletingDraftId(null);
    }
  };

  const handleDeleteDraft = (draftId: string) => {
    setDeletingDraftId(draftId);
  };

  const [retryingId, setRetryingId] = useState<string | null>(null);

  /** Reintenta la sincronización manual de un borrador específico */
  const handleRetryDraft = async (draftId: string) => {
    setRetryingId(draftId);
    try {
      const result = await syncDrafts();
      await loadOfflineDrafts();
      if (result.uploaded > 0 || result.identified > 0) {
        Alert.alert('📡 Sincronizado', `${result.uploaded} subido(s), ${result.identified} identificado(s).`);
      } else if (result.failed > 0) {
        Alert.alert('Sin conexión', 'No se pudo sincronizar. Verificá tu conexión a internet.');
      }
    } catch {
      Alert.alert('Error', 'No se pudo reintentar la sincronización.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleSelectCandidate = async (candidate: any) => {
    if (!selectingDraft || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateDraft(selectingDraft.id, {
        status: 'pending_upload',
        nombre_tradicional: candidate.nombreTradicional,
        nombre_cientifico: candidate.nombreCientifico,
        peligrosidad: candidate.peligrosidad,
        endemismo: candidate.endemismo,
        ia_certeza: candidate.iaCerteza,
        metadatos_especie: {
          ...selectingDraft.metadatos_especie,
          origen: 'scanner-offline-user-selected',
          descripcion_biologica: candidate.descripcionBiologica,
          curiosidades: candidate.curiosidades,
          mitos: candidate.mitos,
          all_candidates: (selectingDraft.metadatos_especie as any)?.all_candidates,
        }
      });
      setSelectingDraft(null);
      // Intentar sync automático
      syncDrafts();
      Alert.alert('Especie confirmada', 'El registro está listo para subir.');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar la selección.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Inicializa la sesión y dispara la carga de perfil, stats y registros */
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

  /** Obtiene contadores de seguidores, seguidos y registros desde Supabase */
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
    const matchesSearch = (item.nombre_tradicional || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.nombre_cientifico || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
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

  /** Sube nueva foto (si aplica) y actualiza metadatos en la tabla `perfiles` */
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
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000000' : '#ffffff' }]}>
      <View style={[styles.customHeader, { backgroundColor: isDarkMode ? '#000000' : '#ffffff' }]}>
        <Text style={[styles.customHeaderTitle, isDarkMode && { color: '#ffffff' }]}>{i18n.t('profile.title')}</Text>
        {Platform.OS !== 'web' && (
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.menuButton} onPress={() => router.push('/notifications')}>
              <View>
                <Ionicons name="notifications-outline" size={28} color={isDarkMode ? "#ffffff" : "#111"} />
                {unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: -4, backgroundColor: '#e53935', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                    <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuButton} onPress={() => setSettingsVisible(true)}>
              <Ionicons name="menu-outline" size={32} color={isDarkMode ? "#ffffff" : "#111"} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity onPress={openEditModal} activeOpacity={0.8}>
              {hasPhoto ? (
                <Image source={{ uri: profile.foto_perfil }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
                  <Ionicons name="person" size={50} color="#ccc" />
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.records}</Text>
              <Text style={styles.statLabel}>{i18n.t('profile.records')}</Text>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/social', params: { userId: session?.user?.id, tab: 'followers' } })}>
              <Text style={styles.statNumber}>{stats.followers}</Text>
              <Text style={styles.statLabel}>{i18n.t('profile.followers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push({ pathname: '/social', params: { userId: session?.user?.id, tab: 'following' } })}>
              <Text style={styles.statNumber}>{stats.following}</Text>
              <Text style={styles.statLabel}>{i18n.t('profile.following')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.fullName}>{profile.username || profile.nombre}</Text>
          <Text style={styles.description}>{profile.descripcion || 'Sin descripción.'}</Text>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>{i18n.t('profile.editProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editButton} onPress={() => router.push({ pathname: '/social', params: { tab: 'discover' } })}>
            <Text style={styles.editButtonText}>{i18n.t('social.discover')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && styles.activeTab]} 
            onPress={() => setActiveTab('records')}
          >
            <Ionicons name="grid-outline" size={24} color={activeTab === 'records' ? '#111' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'records' && styles.activeTabText]}>{i18n.t('profile.tabRecords')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'community' && styles.activeTab]} 
            onPress={() => setActiveTab('community')}
          >
            <Ionicons name="megaphone-outline" size={24} color={activeTab === 'community' ? '#111' : '#888'} />
            <Text style={[styles.tabText, activeTab === 'community' && styles.activeTabText]}>{i18n.t('profile.tabCommunity')}</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'records' && (
          <>
            <View style={styles.subTabRow}>
              <TouchableOpacity
                style={[styles.subTab, recordSubTab === 'published' && styles.subTabActive]}
                onPress={() => setRecordSubTab('published')}
              >
                <Ionicons name="cloud-done-outline" size={16} color={recordSubTab === 'published' ? '#004d40' : '#888'} />
                <Text style={[styles.subTabText, recordSubTab === 'published' && styles.subTabTextActive]}>
                  {i18n.t('profile.published')} ({stats.records})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.subTab, 
                  recordSubTab === 'pending' && styles.subTabActive,
                  (recordSubTab !== 'pending' && hasDraftsToConfirm) && styles.subTabAttention
                ]}
                onPress={() => { setRecordSubTab('pending'); loadOfflineDrafts(); }}
              >
                <Ionicons 
                  name={hasDraftsToConfirm ? "alert-circle" : "time-outline"} 
                  size={16} 
                  color={recordSubTab === 'pending' ? '#e65100' : (hasDraftsToConfirm ? '#ef6c00' : '#888')} 
                />
                <Text style={[
                  styles.subTabText, 
                  recordSubTab === 'pending' && styles.subTabTextActivePending,
                  (recordSubTab !== 'pending' && hasDraftsToConfirm) && { color: '#ef6c00' }
                ]}>
                  {i18n.t('profile.pending')} ({offlineDrafts.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Sub-tab: Publicados ── */}
            {recordSubTab === 'published' && (
              <>
                <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
                  <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#999" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={i18n.t('profile.searchRecords')}
                      placeholderTextColor="#999"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.filterRow}>
                  {[{ key: 'Todos', label: i18n.t('common.all') }, { key: 'Animales', label: i18n.t('common.animals') }, { key: 'Plantas', label: i18n.t('common.plants') }].map((f: any) => (
                    <TouchableOpacity 
                      key={f.key} 
                      onPress={() => setFilter(f.key)}
                      style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filteredRecords.length === 0 ? (
                  <View style={[styles.gridContainer, { justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
                    <Ionicons name="leaf-outline" size={48} color="#ccc" />
                    <Text style={{ color: '#999', marginTop: 8 }}>{i18n.t('profile.noRecords')}</Text>
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
                )}
              </>
            )}

            {/* ── Sub-tab: Pendientes (offline drafts) ── */}
            {recordSubTab === 'pending' && (
              <View style={{ paddingHorizontal: 20, marginTop: 10 }}>

                {offlineDrafts.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 40 }}>
                    <Ionicons name="checkmark-circle-outline" size={48} color="#ccc" />
                    <Text style={{ color: '#999', marginTop: 8 }}>{i18n.t('profile.noPending')}</Text>
                  </View>
                ) : (
                  offlineDrafts.map((draft) => (
                    <TouchableOpacity 
                      key={draft.id} 
                      style={styles.draftCard}
                      onPress={() => setPreviewDraftImage(draft.media_uri)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: draft.media_uri }} style={styles.draftImage} />
                      <View style={styles.draftInfo}>
                        <Text style={styles.draftName} numberOfLines={1}>
                          {draft.nombre_tradicional}
                        </Text>
                        <View style={[
                          styles.draftStatusBadge,
                          draft.status === 'pending_ai' ? styles.draftStatusAI : 
                          draft.status === 'pending_selection' ? { backgroundColor: '#fff3e0' } :
                          draft.status === 'rejected' ? { backgroundColor: '#ffebee' } : styles.draftStatusUpload
                        ]}>
                          <Ionicons
                            name={draft.status === 'pending_ai' ? 'sparkles-outline' : draft.status === 'pending_selection' ? 'help-circle-outline' : draft.status === 'rejected' ? 'close-circle-outline' : 'cloud-upload-outline'}
                            size={12}
                            color={draft.status === 'pending_ai' ? '#e65100' : draft.status === 'pending_selection' ? '#ef6c00' : draft.status === 'rejected' ? '#d32f2f' : '#1565c0'}
                          />
                          <Text style={[
                            styles.draftStatusText,
                            { color: draft.status === 'pending_ai' ? '#e65100' : draft.status === 'pending_selection' ? '#ef6c00' : draft.status === 'rejected' ? '#d32f2f' : '#1565c0' }
                          ]}>
                            {draft.status === 'pending_ai' ? 'Esperando IA' : draft.status === 'pending_selection' ? 'Falta confirmar' : draft.status === 'rejected' ? 'Rechazado' : 'Esperando subida'}
                          </Text>
                        </View>
                        <Text style={styles.draftDate}>
                          {new Date(draft.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {draft.status === 'rejected' && draft.last_error ? (
                          <Text style={{ fontSize: 11, color: '#d32f2f', marginTop: 4, fontWeight: 'bold' }} numberOfLines={3}>
                            {draft.last_error}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.draftActions}>
                        {draft.status === 'pending_selection' ? (
                          <TouchableOpacity
                            style={[styles.draftRetryBtn, { backgroundColor: '#ef6c00', width: 'auto', paddingHorizontal: 12 }]}
                            onPress={() => setSelectingDraft(draft)}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>CONFIRMAR</Text>
                          </TouchableOpacity>
                        ) : draft.status !== 'rejected' && (
                          <TouchableOpacity
                            style={styles.draftRetryBtn}
                            onPress={() => handleRetryDraft(draft.id)}
                            disabled={retryingId === draft.id}
                          >
                            {retryingId === draft.id
                              ? <ActivityIndicator size={16} color="#2e7d32" />
                              : <Ionicons name="refresh-outline" size={20} color="#2e7d32" />
                            }
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.draftDeleteBtn}
                          onPress={() => handleDeleteDraft(draft.id)}
                        >
                          <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </>
        )}

        {activeTab === 'community' && (
          userPosts.length === 0 ? (
            <View style={[styles.gridContainer, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
              <Ionicons name="megaphone-outline" size={48} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 8 }}>{i18n.t('profile.noPosts')}</Text>
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

      {/* MODAL DE CONFIGURACIÓN / IDIOMA */}
      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setSettingsVisible(false)}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>{i18n.t('profile.settings')}</Text>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }} 
              onPress={async () => {
                const newLang = currentLocale === 'es' ? 'en' : 'es';
                await changeLanguage(newLang);
                setCurrentLocale(newLang);
              }}
            >
              <Ionicons name="language-outline" size={24} color="#111" style={{ marginRight: 15 }} />
              <Text style={{ fontSize: 16 }}>
                {currentLocale === 'es' ? i18n.t('profile.changeToEn') : i18n.t('profile.changeToEs')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }} 
              onPress={() => {
                const isDark = isDarkMode;
                setIsDarkMode(!isDark);
                // Also toggle body bg if web
                if (Platform.OS === 'web') {
                  document.body.style.backgroundColor = !isDark ? '#000' : '#fff';
                }
                AsyncStorage.setItem('theme', !isDark ? 'dark' : 'light');
              }}
            >
              <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={24} color="#111" style={{ marginRight: 15 }} />
              <Text style={{ fontSize: 16 }}>
                {isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15 }} 
              onPress={() => {
                setSettingsVisible(false);
                handleLogout();
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#d32f2f" style={{ marginRight: 15 }} />
              <Text style={{ fontSize: 16, color: '#d32f2f' }}>{i18n.t('profile.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

        {/* Modal de Selección de Especie */}
        {selectingDraft && (
          <Modal visible transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: Dimensions.get('window').height * 0.85 }}>
                <View style={{ padding: 20, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Selecciona la Especie</Text>
                  <TouchableOpacity onPress={() => setSelectingDraft(null)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                  <Image source={{ uri: selectingDraft.media_uri }} style={{ width: '100%', height: 200, borderRadius: 16, marginBottom: 20 }} />
                  <Text style={{ fontSize: 16, color: '#666', marginBottom: 12 }}>¿Cuál de estos identificaste?</Text>
                  
                  {((selectingDraft.metadatos_especie as any)?.all_candidates || []).map((cand: any, idx: number) => (
                    <TouchableOpacity 
                      key={idx}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        backgroundColor: '#f8faf9', 
                        padding: 16, 
                        borderRadius: 16, 
                        marginBottom: 12, 
                        borderWidth: 1, 
                        borderColor: '#e0e0e0',
                        opacity: isSubmitting ? 0.5 : 1
                      }}
                      onPress={() => handleSelectCandidate(cand)}
                      disabled={isSubmitting}
                    >
                      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                        <Ionicons name="paw" size={24} color="#2e7d32" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111' }}>{cand.nombreTradicional}</Text>
                        <Text style={{ fontSize: 14, color: '#666', fontStyle: 'italic' }}>{cand.nombreCientifico}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 }}>
                          <Text style={{ fontSize: 12, color: '#2e7d32' }}>Certeza: {Math.round((cand.iaCerteza || 0) * 100)}%</Text>
                          {candidateCounts[cand.nombreCientifico] !== undefined && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                              <Ionicons name="eye-outline" size={12} color="#2e7d32" style={{ marginRight: 4 }} />
                              <Text style={{ fontSize: 11, color: '#2e7d32', fontWeight: 'bold' }}>
                                {candidateCounts[cand.nombreCientifico]} {candidateCounts[cand.nombreCientifico] === 1 ? 'registro' : 'registros'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ccc" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* Modal de Vista Previa del Borrador */}
        <Modal
          visible={!!previewDraftImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewDraftImage(null)}
        >
          <TouchableOpacity 
            style={styles.draftPreviewOverlay} 
            activeOpacity={1} 
            onPress={() => setPreviewDraftImage(null)}
          >
            <View style={styles.draftPreviewCard}>
              <Image 
                source={{ uri: previewDraftImage || '' }} 
                style={styles.draftPreviewImage} 
              />
              <View style={styles.draftPreviewHintContainer}>
                <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.draftPreviewHint}>Tocar para cerrar</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal de Confirmación de Borrado */}
        <DeleteConfirmationModal 
          visible={!!deletingDraftId}
          onClose={() => setDeletingDraftId(null)}
          onConfirm={confirmDeleteDraft}
        />

    </View>
  );
}

// ── Modales adicionales ──────────────────────────────────────────────────

function DeleteConfirmationModal({ 
  visible, 
  onClose, 
  onConfirm 
}: { 
  visible: boolean, 
  onClose: () => void, 
  onConfirm: () => void 
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 320, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffebee', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Ionicons name="trash-outline" size={32} color="#d32f2f" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#111' }}>Eliminar pendiente</Text>
          <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
            ¿Estás seguro que deseas eliminar este registro pendiente? No se subirá a la nube.
          </Text>
          <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center' }}
              onPress={onClose}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#666' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#d32f2f', alignItems: 'center' }}
              onPress={onConfirm}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  customHeader: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 20, paddingBottom: 10,
    backgroundColor: '#ffffff', position: 'absolute', top: 0, left: 0, right: 0,
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
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5',
    paddingHorizontal: 12, borderRadius: 12, height: 42, gap: 8,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: '#111',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'transparent', flexDirection: 'row', gap: 6 },
  activeTab: { borderBottomColor: '#111' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  activeTabText: { color: '#111' },
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
  filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f5f5f5', borderColor: '#eee', borderWidth: 1 },
  filterChipActive: { backgroundColor: '#e0f2f1', borderColor: '#004d40' },
  filterText: { fontSize: 12, color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#004d40' },

  // Sub-tabs (Publicados / Pendientes)
  subTabRow: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 12, gap: 8,
  },
  subTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f5f5f5',
    borderWidth: 1, borderColor: '#eee',
  },
  subTabActive: { backgroundColor: '#e0f2f1', borderColor: '#004d40' },
  subTabAttention: { backgroundColor: '#fff3e0', borderColor: '#ffb74d' },
  subTabText: { fontSize: 13, fontWeight: '600', color: '#888' },
  subTabTextActive: { color: '#004d40' },
  subTabTextActivePending: { color: '#e65100' },

  // Draft cards (pendientes offline)
  draftCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  draftImage: {
    width: 56, height: 56, borderRadius: 10, backgroundColor: '#f0f0f0',
  },
  draftInfo: {
    flex: 1, marginLeft: 12, gap: 3,
  },
  draftName: {
    fontSize: 15, fontWeight: '600', color: '#111',
  },
  draftStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  draftStatusAI: { backgroundColor: '#fff3e0' },
  draftStatusUpload: { backgroundColor: '#e3f2fd' },
  draftStatusText: {
    fontSize: 11, fontWeight: '600',
  },
  draftError: {
    fontSize: 11, color: '#d32f2f',
  },
  draftDate: {
    fontSize: 11, color: '#999',
  },
  draftDeleteBtn: {
    padding: 8,
  },
  draftActions: {
    alignItems: 'center', gap: 4, marginLeft: 4,
  },
  draftRetryBtn: {
    padding: 8,
  },

  // Draft preview modal
  draftPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  draftPreviewCard: {
    width: '80%',
    aspectRatio: 1, // Proporción cuadrada para que sea más equilibrado
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  draftPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  draftPreviewHintContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  draftPreviewHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

