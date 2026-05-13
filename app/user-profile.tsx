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
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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
          userRecords.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Ionicons name="leaf-outline" size={48} color={theme.muted} />
              <Text style={[styles.emptyText, { color: theme.muted }]}>{i18n.t('profile.noRecords')}</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {userRecords.map((record) => (
                <View key={record.id} style={styles.gridItem}>
                  <Image source={{ uri: record.media_url || 'https://via.placeholder.com/150' }} style={styles.gridImage} />
                </View>
              ))}
            </View>
          )
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
                  <Text style={[styles.postCardDesc, { color: theme.subtext }]}>{post.descripcion}</Text>
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
  emptyText: { 
    color: '#999', 
    marginTop: 8 
  },
  postsListContainer: { 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  postCard: { 
    backgroundColor: '#f9f9f9', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#eee' 
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
