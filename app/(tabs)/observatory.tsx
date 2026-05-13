/**
 * @module ObservatoryScreen
 * Pantalla de comunidad que integra:
 * - Streaming en vivo (Video MP4/HLS).
 * - Feed de publicaciones globales de usuarios.
 * - Interacciones de seguimiento (Follow/Unfollow) integradas en el feed.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { followUser, getFollowingIds, unfollowUser } from '../../lib/follows';
import { supabase } from '../../lib/supabase';


// ─── CONFIGURACIÓN DE VIDEO / STREAM ────────────────────────────────
// VIDEO ACTUAL: URL directa a MP4 en Supabase Storage
const LIVE_VIDEO_URL = 'https://aygdawwqjpbemzonevqg.supabase.co/storage/v1/object/public/Video/RegionGuayana%20(2).mp4';
//
// PARA STREAM EN VIVO (expansión futura):
// 1. Reemplazá LIVE_VIDEO_URL con la URL HLS del stream:
//    const LIVE_VIDEO_URL = 'https://tu-servidor.com/live/stream.m3u8';
// 2. expo-av y <video> soportan HLS nativamente, no hay que cambiar más nada.
// ────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  titulo: string;
  descripcion: string;
  created_at: string;
  usuario_id: string;
  perfiles: {
    username: string;
    nombre: string;
    foto_perfil: string | null;
  };
};

export default function ObservatoryScreen() {
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostDesc, setNewPostDesc] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());


  console.log('Observatory Screen Render - Posts:', posts.length);

  /** Obtiene las publicaciones más recientes combinadas con los perfiles de autor */
  const fetchPosts = async () => {
    try {
      console.log('fetchPosts started...');
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      setCurrentUserId(uid);

      // Paso 1: Buscar las publicaciones
      const { data: postsData, error: postsError } = await supabase
        .from('publicaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }); // Tie-breaker

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return { posts: [], uid };
      }

      // Paso 2: Obtener los IDs únicos de los autores
      const authorIds = [...new Set(postsData.map(p => p.usuario_id))];

      // Paso 3: Buscar los perfiles de esos autores
      const { data: profilesData, error: profilesError } = await supabase
        .from('perfiles')
        .select('id, username, nombre, foto_perfil')
        .in('id', authorIds);

      // Paso 4: Combinar los datos
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));
      
      const combinedPosts = postsData.map(post => ({
        ...post,
        perfiles: profilesMap.get(post.usuario_id) || {
          username: 'Usuario',
          nombre: 'Usuario',
          foto_perfil: null
        }
      }));

      console.log('fetchPosts combined success, count:', combinedPosts.length);
      setPosts(combinedPosts as Post[]);
      return { posts: combinedPosts, uid };

    } catch (err: any) {
      console.error('Error fetching posts:', err);
      Alert.alert('Error', 'No se pudieron cargar las publicaciones: ' + (err?.message || ''));
      return { posts: [], uid: null };
    }
  };

  const fetchFollowingIds = async (uid: string | null) => {
    const userIdToUse = uid || currentUserId;
    if (!userIdToUse) return;
    try {
      console.log('fetchFollowingIds for:', userIdToUse);
      const ids = await getFollowingIds(userIdToUse);
      setFollowingIds(ids);
    } catch (err) {
      console.error('Error fetching following ids:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setLoading(true);
      fetchPosts().then(({ uid }) => {
        if (isMounted) fetchFollowingIds(uid);
      }).finally(() => {
        if (isMounted) setLoading(false);
      });
      return () => { isMounted = false; };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const { uid } = await fetchPosts();
    await fetchFollowingIds(uid);
    setRefreshing(false);
  };

  /** Alterna el estado de seguimiento de un usuario desde el feed */
  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUserId) return;
    try {
      const isFollowing = followingIds.has(targetUserId);
      if (isFollowing) {
        await unfollowUser(currentUserId, targetUserId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      } else {
        await followUser(currentUserId, targetUserId);
        setFollowingIds((prev) => new Set(prev).add(targetUserId));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  /** Crea una nueva publicación de texto en la comunidad */
  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostDesc.trim()) {
      Alert.alert('Error', 'Completa el título y la descripción.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Error', 'Debes iniciar sesión para publicar.');
      return;
    }

    setPublishing(true);
    try {
      const { error } = await supabase.from('publicaciones').insert({
        usuario_id: currentUserId,
        titulo: newPostTitle.trim(),
        descripcion: newPostDesc.trim(),
      });

      if (error) throw error;

      setIsCreatingPost(false);
      setNewPostTitle('');
      setNewPostDesc('');
      await fetchPosts();
    } catch (err) {
      console.error('Error creating post:', err);
      Alert.alert('Error', 'No se pudo crear la publicación.');
    } finally {
      setPublishing(false);
    }
  };

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
              await fetchPosts();
            } catch (err) {
              console.error('Error deleting post:', err);
            }
          },
        },
      ]
    );
  };

  /** Calcula el tiempo transcurrido de forma amigable (es-VE) */
  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Justo ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
  };

  const navigateToProfile = (userId: string) => {
    if (userId === currentUserId) return;
    router.push({ pathname: '/user-profile', params: { userId } });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.customHeader, { backgroundColor: '#f9fafb' }]}>
        <Text style={styles.customHeaderTitle}>Observatorio</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2e7d32" />
        }
      >
        {/* Transmisión en Vivo */}
        <Text style={styles.sectionTitle}>Transmisión en Vivo</Text>
        <View style={styles.liveCameraFrame}>
          <View style={styles.livePlaceholder}>
            <Text style={styles.livePlaceholderText}>Transmisión desconectada</Text>
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>DESCONECTADO</Text>
          </View>
        </View>


        {/* Sección de Comunidad */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleCommunity}>Comunidad</Text>
          <TouchableOpacity
            style={styles.createPostBtn}
            onPress={() => setIsCreatingPost(!isCreatingPost)}
          >
            <Text style={styles.createPostBtnText}>
              {isCreatingPost ? 'Cancelar' : '+ Publicar'}
            </Text>
          </TouchableOpacity>
        </View>

        {isCreatingPost && (
          <View style={styles.createPostForm}>
            <TextInput
              style={styles.inputTitle}
              placeholder="Título de la publicación..."
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholderTextColor="#999"
              editable={!publishing}
            />
            <TextInput
              style={styles.inputDesc}
              placeholder="Escribe los detalles aquí..."
              multiline
              numberOfLines={3}
              value={newPostDesc}
              onChangeText={setNewPostDesc}
              placeholderTextColor="#999"
              editable={!publishing}
            />
            <TouchableOpacity
              style={[styles.submitBtn, publishing && { opacity: 0.6 }]}
              onPress={handleCreatePost}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={56} color="#ccc" />
            <Text style={styles.emptyText}>No hay publicaciones aún.</Text>
            <Text style={styles.emptySubtext}>¡Sé el primero en compartir algo!</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryBtnText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {posts.map((post) => {
              const perfil = post.perfiles;
              const hasPhoto = perfil?.foto_perfil && !perfil.foto_perfil.includes('images.unsplash.com');
              const isOwner = post.usuario_id === currentUserId;

              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <TouchableOpacity
                      style={styles.postHeaderLeft}
                      onPress={() => navigateToProfile(post.usuario_id)}
                      activeOpacity={0.7}
                    >
                      {hasPhoto ? (
                        <Image source={{ uri: perfil.foto_perfil! }} style={styles.postAvatar} />
                      ) : (
                        <View style={[styles.postAvatar, styles.avatarPlaceholder]}>
                          <Ionicons name="person" size={18} color="#ccc" />
                        </View>
                      )}
                      <View style={styles.postUserInfo}>
                        <Text style={styles.postUserName}>
                          {perfil?.username || perfil?.nombre || 'Usuario'}
                        </Text>
                        <Text style={styles.postTime}>{getTimeAgo(post.created_at)}</Text>
                      </View>
                    </TouchableOpacity>
                    {isOwner ? (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDeletePost(post.id)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#d32f2f" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.followBtn,
                          followingIds.has(post.usuario_id) && styles.followingBtn,
                        ]}
                        onPress={() => handleToggleFollow(post.usuario_id)}
                      >
                        <Text style={[
                          styles.followBtnText,
                          followingIds.has(post.usuario_id) && styles.followingBtnText,
                        ]}>
                          {followingIds.has(post.usuario_id) ? 'Siguiendo' : 'Seguir'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.postTitle}>{post.titulo}</Text>
                  <Text style={styles.postDescription}>{post.descripcion}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  customHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  customHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },

  scrollContent: {
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    marginTop: 20,
  },
  liveCameraFrame: {
    width: '100%',
    height: Platform.OS === 'web' ? 400 : 220,
    backgroundColor: '#3e2723',
    borderRadius: 16,
    borderWidth: 6,
    borderColor: '#6d4c41',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 32,
  },
  livePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  livePlaceholderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
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
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sectionTitleCommunity: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  createPostBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createPostBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createPostForm: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    marginBottom: 12,
  },
  inputDesc: {
    fontSize: 15,
    color: '#333',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
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
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#eaeaea',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  postTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteBtn: {
    padding: 8,
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
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#2e7d32',
  },
  followingBtn: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  followBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  followingBtnText: {
    color: '#2e7d32',
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#2e7d32',
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
