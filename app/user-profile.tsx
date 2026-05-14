/**
 * user-profile.tsx — Perfil público de otro usuario.
 *
 * Muestra foto, bio, stats (registros, seguidores, seguidos),
 * botón de follow/unfollow y acceso a mensajería directa.
 *
 * @module app/user-profile
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { checkIsFollowing, followUser, unfollowUser } from '../lib/follows';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { i18n } from '../lib/i18n';
import { notifyPostLike, notifyPostComment } from '../lib/notifications';

const { width } = Dimensions.get('window');

/**
 * Componente principal para visualizar el perfil de otro usuario.
 * 
 * Este componente es de solo lectura en cuanto a los datos del otro usuario,
 * pero permite interactuar mediante acciones sociales (seguir/dejar de seguir)
 * y navegación a la mensajería directa o al explorador de seguidores.
 * También integra las pestañas de actividad (registros biológicos y posts).
 */
export default function UserProfileScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  
  // Asegurarse de que userId sea un string simple (en web a veces llega como array)
  const actualUserId = Array.isArray(userId) ? userId[0] : userId;
  
  /** Información pública del perfil visitado */
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  /** Indica si el usuario actual sigue al usuario de este perfil */
  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  /** Contadores de actividad y red social del usuario visitado */
  const [stats, setStats] = useState({ followers: 0, following: 0, records: 0 });
  
  /** Lista de registros biológicos (fotos) subidos por el usuario visitado */
  const [userRecords, setUserRecords] = useState<any[]>([]);
  
  /** Lista de publicaciones creadas en la comunidad por el usuario visitado */
  const [userPosts, setUserPosts] = useState<any[]>([]);
  
  /** Pestaña activa en la sección de contenido inferior */
  const [activeTab, setActiveTab] = useState<'records' | 'community'>('records');

  // --- Record detail states ---
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [loadingEnrichedData, setLoadingEnrichedData] = useState(false);
  const [filter, setFilter] = useState<'Todos' | 'Animales' | 'Plantas'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordDesc, setExpandedRecordDesc] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  const isAnimal = (item: any) => {
    const alimentacion = (item.alimentacion || '').toLowerCase();
    if (alimentacion.includes('carnívoro') || alimentacion.includes('herbívoro') || alimentacion.includes('omnívoro')) return true;
    const nombre = (item.nombre_tradicional || '').toLowerCase();
    const nombreC = (item.nombre_cientifico || '').toLowerCase();
    if (nombre.includes('orquídea') || nombre.includes('flor') || nombre.includes('árbol') || nombre.includes('planta') || nombre.includes('helecho') || nombreC.includes('sp.')) return false;
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

  const getEnrichedData = async (item: any) => {
    if (item.metadatos_especie?.descripcion_biologica) {
      return {
        descripcion_biologica: item.metadatos_especie.descripcion_biologica,
        mitos: item.metadatos_especie.mitos || '',
      };
    }
    return null;
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

  // --- Like / Comment state ---
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (actualUserId) {
      loadProfile();

      // Suscripción en tiempo real a los seguidores para actualizar contadores instantáneamente
      const channel = supabase
        .channel(`user-profile-stats-${actualUserId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'seguidores' }, () => {
          // Recargar stats de seguidores silenciosamente
          Promise.all([
            supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', actualUserId),
            supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', actualUserId),
          ]).then(([followersRes, followingRes]) => {
            setStats(prev => ({
              ...prev,
              followers: followersRes.count || 0,
              following: followingRes.count || 0,
            }));
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [actualUserId]);

  /** Carga perfil, stats, registros, publicaciones y estado de follow */
  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user?.id;
      setCurrentUserId(myId || null);

      // Datos del perfil
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', actualUserId)
        .single();

      if (data && !error) setProfile(data);

      // Registros y Publicaciones
      const [recordsRes, postsRes] = await Promise.all([
        supabase.from('registros').select('*').eq('usuario_id', actualUserId).order('created_at', { ascending: false }),
        supabase.from('publicaciones').select('*').eq('usuario_id', actualUserId).order('created_at', { ascending: false })
      ]);

      const recordsData = recordsRes.data || [];
      const postsData = postsRes.data || [];
      setUserRecords(recordsData);

      // Enriquecer publicaciones con likes y comentarios
      if (postsData.length > 0) {
        const postIds = postsData.map(p => p.id);
        const [{ data: likesData }, { data: commentsData }] = await Promise.all([
          supabase.from('post_likes').select('publicacion_id, usuario_id').in('publicacion_id', postIds),
          supabase.from('post_comments').select('publicacion_id').in('publicacion_id', postIds),
        ]);
        const likeCounts = new Map<string, number>();
        const commentCounts = new Map<string, number>();
        const likedByMe = new Set<string>();
        (likesData || []).forEach((like: any) => {
          likeCounts.set(like.publicacion_id, (likeCounts.get(like.publicacion_id) || 0) + 1);
          if (myId && like.usuario_id === myId) likedByMe.add(like.publicacion_id);
        });
        (commentsData || []).forEach((c: any) => {
          commentCounts.set(c.publicacion_id, (commentCounts.get(c.publicacion_id) || 0) + 1);
        });
        setUserPosts(postsData.map(post => ({
          ...post,
          likesCount: likeCounts.get(post.id) ?? 0,
          commentsCount: commentCounts.get(post.id) ?? 0,
          likedByMe: likedByMe.has(post.id),
        })));
      } else {
        setUserPosts([]);
      }

      // Stats
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', actualUserId),
        supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', actualUserId),
      ]);

      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        records: recordsData.length,
      });

      // ¿Lo sigo?
      if (myId && actualUserId) {
        const following = await checkIsFollowing(myId, actualUserId);
        setIsFollowing(following);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Alterna follow/unfollow con actualización optimista del contador */
  const toggleFollow = async () => {
    if (!currentUserId || !actualUserId || togglingFollow) return;

    setTogglingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUserId, actualUserId);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
      } else {
        await followUser(currentUserId, actualUserId);
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setTogglingFollow(false);
    }
  };

  /** Navega al hub social del usuario con la tab indicada */
  const navigateToFollowers = (type: 'followers' | 'following') => {
    router.push({ pathname: '/social', params: { userId: actualUserId!, tab: type } });
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId) { Alert.alert('Inicia sesión para dar like'); return; }
    const post = userPosts.find(p => p.id === postId);
    if (!post) return;
    try {
      if (post.likedByMe) {
        await supabase.from('post_likes').delete().eq('publicacion_id', postId).eq('usuario_id', currentUserId);
      } else {
        await supabase.from('post_likes').insert({ publicacion_id: postId, usuario_id: currentUserId });
        notifyPostLike(postId, currentUserId);
      }
      setUserPosts(current => current.map(item => item.id === postId
        ? { ...item, likedByMe: !item.likedByMe, likesCount: item.likesCount + (item.likedByMe ? -1 : 1) }
        : item
      ));
    } catch (err) { console.error('Like error:', err); }
  };

  const handleSubmitComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text || !currentUserId) return;
    setSubmittingComment(postId);
    try {
      const { error } = await supabase.from('post_comments').insert({ publicacion_id: postId, usuario_id: currentUserId, comentario: text });
      if (error) throw error;
      notifyPostComment(postId, currentUserId);
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setUserPosts(current => current.map(item => item.id === postId ? { ...item, commentsCount: (item.commentsCount || 0) + 1 } : item));
      fetchPostComments(postId);
    } catch (err) { console.error('Comment error:', err); Alert.alert('Error', 'No se pudo enviar.'); }
    finally { setSubmittingComment(null); }
  };

  const fetchPostComments = async (postId: string) => {
    const { data } = await supabase.from('post_comments').select('*').eq('publicacion_id', postId).order('created_at', { ascending: true });
    if (data) {
      const authorIds = [...new Set(data.map(c => c.usuario_id))];
      const { data: profiles } = await supabase.from('perfiles').select('id, username, nombre, foto_perfil').in('id', authorIds);
      const pMap = new Map((profiles || []).map(p => [p.id, p]));
      setPostComments(prev => ({ ...prev, [postId]: data.map(c => ({ ...c, perfil: pMap.get(c.usuario_id) || { username: 'Usuario' } })) }));
    }
  };

  const toggleCommentSection = (postId: string) => {
    if (activeCommentPost === postId) { setActiveCommentPost(null); }
    else { setActiveCommentPost(postId); if (!postComments[postId]) fetchPostComments(postId); }
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date(); const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000); const diffHrs = Math.floor(diffMs / 3600000); const diffDays = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Justo ahora'; if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs}h`; if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}> 
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}> 
        <Ionicons name="person-outline" size={60} color={theme.muted} />
        <Text style={{ color: theme.muted, marginTop: 12 }}>Usuario no encontrado</Text>
      </View>
    );
  }

  const isDefaultUnsplash = profile.foto_perfil?.includes('images.unsplash.com');
  const hasPhoto = profile.foto_perfil && !isDefaultUnsplash;
  const isOwnProfile = currentUserId === actualUserId;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{profile.username || profile.nombre}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Foto + Stats */}
        <View style={styles.profileHeader}>
          {hasPhoto ? (
            <Image source={{ uri: profile.foto_perfil }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="person" size={50} color={theme.muted} />
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{stats.records}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>{i18n.t('profile.records')}</Text>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={() => navigateToFollowers('followers')}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{stats.followers}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>{i18n.t('profile.followers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigateToFollowers('following')}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{stats.following}</Text>
              <Text style={[styles.statLabel, { color: theme.subtext }]}>{i18n.t('profile.following')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={[styles.fullName, { color: theme.text }]}>{profile.username || profile.nombre}</Text>
          <Text style={[styles.description, { color: theme.subtext }]}>{profile.descripcion || 'Sin descripción.'}</Text>
        </View>

        {/* Botón Follow / Unfollow (solo si no es mi perfil) */}
        {!isOwnProfile && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary }, isFollowing && { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.border }]}
              onPress={toggleFollow}
              disabled={togglingFollow}
              activeOpacity={0.7}
            >
              {togglingFollow ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.subtext : theme.primaryText} />
              ) : (
                <Text style={[styles.actionButtonText, { color: theme.primaryText }, isFollowing && { color: theme.subtext }]}>
                  {isFollowing ? i18n.t('social.unfollow') : i18n.t('social.follow')}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/messages', params: { userId: actualUserId } })}
            >
              <Text style={[styles.messageButtonText, { color: theme.text }]}>{i18n.t('messages.title')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabsContainer, { borderTopColor: theme.border }]}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'records' && [styles.activeTab, { borderBottomColor: theme.primary }]]} 
            onPress={() => setActiveTab('records')}
          >
            <Ionicons name="grid-outline" size={24} color={activeTab === 'records' ? theme.primary : theme.muted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'community' && [styles.activeTab, { borderBottomColor: theme.primary }]]} 
            onPress={() => setActiveTab('community')}
          >
            <Ionicons name="megaphone-outline" size={24} color={activeTab === 'community' ? theme.primary : theme.muted} />
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'records' && (
          <>
            {/* Search + Filter */}
            <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
              <View style={[styles.searchBar, { backgroundColor: theme.inputBackground, borderColor: theme.border, borderWidth: 1 }]}>
                <Ionicons name="search" size={20} color={theme.muted} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder={i18n.t('profile.searchRecords')}
                  placeholderTextColor={theme.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={theme.muted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.filterRow}>
              {[{ key: 'Todos', label: i18n.t('common.all') }, { key: 'Animales', label: i18n.t('common.animals') }, { key: 'Plantas', label: i18n.t('common.plants') }].map((f: any) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[
                    styles.filterChip,
                    { backgroundColor: theme.inputBackground, borderColor: theme.border },
                    filter === f.key && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                >
                  <Text style={[styles.filterText, { color: filter === f.key ? theme.background : theme.text }, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredRecords.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="leaf-outline" size={48} color={theme.muted} />
                <Text style={[styles.emptyText, { color: theme.muted }]}>{i18n.t('profile.noRecords')}</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {filteredRecords.map((record) => {
                  const cols = Platform.OS === 'web' && screenWidth > 768 ? Math.min(Math.floor(screenWidth / 200), 5) : 3;
                  const itemSize = Platform.OS === 'web' && screenWidth > 768 ? screenWidth / cols : width / 3;
                  return (
                    <TouchableOpacity
                      key={record.id}
                      style={[styles.gridItem, { width: itemSize, height: itemSize }]}
                      onPress={() => { setSelectedRecord(record); setExpandedRecordDesc(false); }}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: record.media_url || 'https://via.placeholder.com/150' }} style={styles.gridImage} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {activeTab === 'community' && (
          userPosts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="megaphone-outline" size={48} color={theme.muted} />
              <Text style={[styles.emptyText, { color: theme.muted }]}>{i18n.t('profile.noPosts')}</Text>
            </View>
          ) : (
            <View style={styles.postsListContainer}>
              {userPosts.map((post) => (
                <View key={post.id} style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.postCardHeader}>
                    <Text style={[styles.postCardTitle, { color: theme.text }]}>{post.titulo}</Text>
                  </View>
                  {post.descripcion ? (
                    <Text style={[styles.postCardDesc, { color: theme.subtext }]}>{post.descripcion}</Text>
                  ) : null}
                  <Text style={[styles.postCardDate, { color: theme.muted }]}>
                    {new Date(post.created_at).toLocaleDateString('es-VE')}
                  </Text>

                  <View style={[styles.postActionsRow, { borderTopColor: theme.border }]}>
                    <TouchableOpacity
                      style={[styles.postActionBtn, post.likedByMe && styles.postActionBtnActive]}
                      onPress={() => handleToggleLike(post.id)}
                    >
                      <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={18} color={post.likedByMe ? '#ec4899' : theme.muted} />
                      <Text style={[styles.postActionText, { color: theme.muted }, post.likedByMe && { color: '#ec4899' }]}>{post.likesCount || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postActionBtn} onPress={() => toggleCommentSection(post.id)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.muted} />
                      <Text style={[styles.postActionText, { color: theme.muted }]}>{post.commentsCount || 0}</Text>
                    </TouchableOpacity>
                  </View>

                  {activeCommentPost === post.id && (
                    <View style={[styles.commentSection, { borderTopColor: theme.border }]}>
                      {(postComments[post.id] || []).map((comment: any) => (
                        <View key={comment.id} style={styles.commentItem}>
                          <View style={[styles.commentAvatar, { backgroundColor: theme.inputBackground }]}>
                            {comment.perfil?.foto_perfil && !comment.perfil.foto_perfil.includes('unsplash') ? (
                              <Image source={{ uri: comment.perfil.foto_perfil }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                            ) : (
                              <Ionicons name="person" size={14} color={theme.muted} />
                            )}
                          </View>
                          <View style={[styles.commentContent, { backgroundColor: theme.inputBackground }]}>
                            <Text style={[styles.commentAuthor, { color: theme.text }]}>{comment.perfil?.username || 'Usuario'}</Text>
                            <Text style={[styles.commentText, { color: theme.subtext }]}>{comment.comentario}</Text>
                            <Text style={[styles.commentTime, { color: theme.muted }]}>{getTimeAgo(comment.created_at)}</Text>
                          </View>
                        </View>
                      ))}
                      <View style={styles.commentInputRow}>
                        <TextInput
                          style={[styles.commentInputField, { borderColor: theme.border, color: theme.text, backgroundColor: theme.card }]}
                          placeholder={i18n.t('observatory.writeComment')}
                          placeholderTextColor={theme.placeholder}
                          value={commentInputs[post.id] || ''}
                          onChangeText={(v) => setCommentInputs(prev => ({ ...prev, [post.id]: v }))}
                          multiline
                        />
                        <TouchableOpacity style={[styles.commentSendBtn, { backgroundColor: theme.mode === 'dark' ? 'rgba(52,211,153,0.15)' : '#e8f5e9' }]} onPress={() => handleSubmitComment(post.id)} disabled={submittingComment === post.id}>
                          {submittingComment === post.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="send" size={18} color={theme.primary} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de detalle del registro (idéntico a profile.tsx, sin editar/eliminar) */}
      <Modal
        visible={!!selectedRecord}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setSelectedRecord(null); setExpandedRecordDesc(false); }}
      >
        <View style={styles.recordModalOverlay}>
          {selectedRecord && (
            <View style={[styles.recordModalContent, { backgroundColor: theme.card }]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedRecord.media_url }} style={styles.recordModalImage} />
                <TouchableOpacity
                  style={styles.recordModalClose}
                  onPress={() => { setSelectedRecord(null); setExpandedRecordDesc(false); }}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.recordModalBody}>
                  <Text style={[styles.recordModalTitle, { color: theme.text }]}>{selectedRecord.nombre_tradicional}</Text>
                  {selectedRecord.nombre_cientifico ? (
                    <Text style={[styles.recordModalScientific, { color: theme.primary }]}>{selectedRecord.nombre_cientifico}</Text>
                  ) : null}

                  {/* Descripción - solo si existe */}
                  {selectedRecord.descripcion ? (
                    <TouchableOpacity onPress={() => setExpandedRecordDesc(!expandedRecordDesc)} activeOpacity={0.8}>
                      <Text style={[styles.recordModalDesc, { color: theme.subtext }]} numberOfLines={expandedRecordDesc ? undefined : 2}>
                        {selectedRecord.descripcion}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Enriquecimiento IA - solo si hay datos reales */}
                  {loadingEnrichedData ? (
                    <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
                  ) : enrichedData ? (
                    <View style={{ marginTop: 10, gap: 12 }}>
                      {enrichedData.descripcion_biologica ? (
                        <View style={[styles.enrichedCard, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                          <Text style={[styles.enrichedTitle, { color: theme.primary }]}>Información Biológica</Text>
                          <Text style={[styles.enrichedText, { color: theme.subtext }]}>{enrichedData.descripcion_biologica}</Text>
                        </View>
                      ) : null}
                      {enrichedData.mitos ? (
                        <View style={[styles.enrichedCard, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                          <Text style={[styles.enrichedTitle, { color: '#ff9100' }]}>Mitos y Leyendas</Text>
                          <Text style={[styles.enrichedText, { color: theme.subtext }]}>{enrichedData.mitos}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingTop: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  profileImage: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  profileImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  statLabel: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },
  infoContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  fullName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#2e7d32',
  },
  unfollowButton: {
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  unfollowButtonText: {
    color: '#555',
  },
  messageButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  tabsContainer: { 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderTopColor: '#eee', 
    marginTop: 10 
  },
  tab: { 
    flex: 1, 
    paddingVertical: 15, 
    alignItems: 'center' 
  },
  activeTab: { 
    borderBottomWidth: 2, 
    borderBottomColor: '#111' 
  },
  gridContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap' 
  },
  gridItem: { 
    width: width / 3, 
    height: width / 3, 
    padding: 1 
  },
  gridImage: { 
    width: '100%', 
    height: '100%',
    backgroundColor: '#f0f0f0'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    fontWeight: 'bold',
  },
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
    height: undefined,
    minHeight: 250,
    maxHeight: 450,
    aspectRatio: 1,
    resizeMode: 'contain',
    backgroundColor: '#000',
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
  enrichedCard: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
  },
  enrichedTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  enrichedText: {
    fontSize: 13,
    lineHeight: 20,
  },
  metaTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  emptyText: { 
    color: '#999', 
    marginTop: 8 
  },
  postsListContainer: { 
    paddingHorizontal: 16, 
    paddingTop: 16,
    ...(Platform.OS === 'web' ? { maxWidth: 600, alignSelf: 'center' as const, width: '100%' as any } : {}),
  },
  postCard: { 
    backgroundColor: '#f9f9f9', 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
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
    marginBottom: 8 
  },
  postCardTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#111' 
  },
  postCardDesc: { 
    fontSize: 14, 
    color: '#333', 
    lineHeight: 20 
  },
  postCardDate: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 8 
  },
  postActionsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  postActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10,
  },
  postActionBtnActive: { backgroundColor: 'rgba(236, 72, 153, 0.08)' },
  postActionText: { fontSize: 14, fontWeight: '600', color: '#555' },
  commentSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  commentItem: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  commentContent: { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 12, padding: 8, paddingHorizontal: 12 },
  commentAuthor: { fontSize: 12, fontWeight: 'bold', color: '#111', marginBottom: 2 },
  commentText: { fontSize: 13, color: '#333', lineHeight: 18 },
  commentTime: { fontSize: 10, color: '#999', marginTop: 4 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  commentInputField: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 13, color: '#111', backgroundColor: '#fafafa', maxHeight: 80 },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
});
