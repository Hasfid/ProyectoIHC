/**
 * @module ObservatoryScreen
 * Pantalla de comunidad que integra:
 * - Streaming en vivo (Video MP4/HLS).
 * - Feed de publicaciones globales de usuarios.
 * - Interacciones de seguimiento (Follow/Unfollow) integradas en el feed.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
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
import { useTheme } from '../../lib/theme';
import { i18n } from '../../lib/i18n';


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
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
};

export default function ObservatoryScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeCommentPost, setActiveCommentPost] = useState<string | null>(null);
  const activeCommentPostRef = useRef<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
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
      const postIds = postsData.map(post => post.id);

      // Paso 5: Obtener likes y comentarios para el feed
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase.from('post_likes').select('publicacion_id, usuario_id').in('publicacion_id', postIds),
        supabase.from('post_comments').select('publicacion_id').in('publicacion_id', postIds),
      ]);

      const likeCounts = new Map<string, number>();
      const commentCounts = new Map<string, number>();
      const likedByMe = new Set<string>();

      (likesData || []).forEach((like: any) => {
        likeCounts.set(like.publicacion_id, (likeCounts.get(like.publicacion_id) || 0) + 1);
        if (uid && like.usuario_id === uid) likedByMe.add(like.publicacion_id);
      });

      (commentsData || []).forEach((comment: any) => {
        commentCounts.set(comment.publicacion_id, (commentCounts.get(comment.publicacion_id) || 0) + 1);
      });
      
      const combinedPosts = postsData.map(post => ({
        ...post,
        perfiles: profilesMap.get(post.usuario_id) || {
          username: 'Usuario',
          nombre: 'Usuario',
          foto_perfil: null
        },
        likesCount: likeCounts.get(post.id) ?? 0,
        commentsCount: commentCounts.get(post.id) ?? 0,
        likedByMe: likedByMe.has(post.id),
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

      // Realtime granular — likes
      const likesChannel = supabase
        .channel('realtime-post-likes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' }, (payload) => {
          if (!isMounted) return;
          const like = payload.new as any;
          setPosts(prev => prev.map(p =>
            p.id === like.publicacion_id
              ? { ...p, likesCount: p.likesCount + 1, likedByMe: like.usuario_id === currentUserId ? true : p.likedByMe }
              : p
          ));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' }, (payload) => {
          if (!isMounted) return;
          const like = payload.old as any;
          setPosts(prev => prev.map(p =>
            p.id === like.publicacion_id
              ? { ...p, likesCount: Math.max(0, p.likesCount - 1), likedByMe: like.usuario_id === currentUserId ? false : p.likedByMe }
              : p
          ));
        })
        .subscribe();

      // Realtime granular — comments
      const commentsChannel = supabase
        .channel('realtime-post-comments')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, (payload) => {
          if (!isMounted) return;
          const comment = payload.new as any;
          setPosts(prev => prev.map(p =>
            p.id === comment.publicacion_id
              ? { ...p, commentsCount: p.commentsCount + 1 }
              : p
          ));
          // Si la sección de comentarios de ese post está abierta, recargar sus comentarios
          if (activeCommentPostRef.current === comment.publicacion_id) {
            fetchPostComments(comment.publicacion_id);
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_comments' }, (payload) => {
          if (!isMounted) return;
          const comment = payload.old as any;
          setPosts(prev => prev.map(p =>
            p.id === comment.publicacion_id
              ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) }
              : p
          ));
          if (activeCommentPostRef.current === comment.publicacion_id) {
            fetchPostComments(comment.publicacion_id);
          }
        })
        .subscribe();

      // Realtime — nuevas publicaciones
      const postsChannel = supabase
        .channel('realtime-publicaciones')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'publicaciones' }, () => {
          if (isMounted) fetchPosts();
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'publicaciones' }, (payload) => {
          if (!isMounted) return;
          const deleted = payload.old as any;
          setPosts(prev => prev.filter(p => p.id !== deleted.id));
        })
        .subscribe();

      return () => {
        isMounted = false;
        supabase.removeChannel(likesChannel);
        supabase.removeChannel(commentsChannel);
        supabase.removeChannel(postsChannel);
      };
    }, [currentUserId])
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

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('Inicia sesión para dar like');
      return;
    }

    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    try {
      if (post.likedByMe) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('publicacion_id', postId)
          .eq('usuario_id', currentUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').insert({
          publicacion_id: postId,
          usuario_id: currentUserId,
        });
        if (error) throw error;
      }

      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                likedByMe: !item.likedByMe,
                likesCount: item.likesCount + (item.likedByMe ? -1 : 1),
              }
            : item
        )
      );
    } catch (err) {
      console.error('Error toggling like:', err);
      Alert.alert('Error', i18n.t('observatory.likeFailed'));
    }
  };

  const handleSubmitComment = async (postId: string) => {
    const commentText = (commentInputs[postId] || '').trim();
    if (!commentText) {
      Alert.alert(i18n.t('observatory.commentError'));
      return;
    }
    if (!currentUserId) {
      Alert.alert(i18n.t('observatory.loginToComment'));
      return;
    }

    setSubmittingCommentId(postId);
    try {
      const { error } = await supabase.from('post_comments').insert({
        publicacion_id: postId,
        usuario_id: currentUserId,
        comentario: commentText,
      });
      if (error) throw error;

      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      // Actualizar conteo local sin recargar toda la lista
      setPosts((current) =>
        current.map((item) =>
          item.id === postId ? { ...item, commentsCount: (item.commentsCount || 0) + 1 } : item
        )
      );
      // Recargar solo los comentarios de este post
      await fetchPostComments(postId);
    } catch (err) {
      console.error('Error adding comment:', err);
      Alert.alert('Error', i18n.t('observatory.commentFailed'));
    } finally {
      setSubmittingCommentId(null);
    }
  };

  /** Calcula el tiempo transcurrido de forma amigable (es-VE) */
  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return i18n.t('common.justNow');
    if (diffMin < 60) return i18n.t('common.minutesAgo').replace('{{count}}', String(diffMin));
    if (diffHrs < 24) return i18n.t('common.hoursAgo').replace('{{count}}', String(diffHrs));
    if (diffDays < 7) return i18n.t('common.daysAgo').replace('{{count}}', String(diffDays));
    return date.toLocaleDateString(i18n.locale === 'es' ? 'es-VE' : 'en-US', { day: 'numeric', month: 'short' });
  };

  const navigateToProfile = (userId: string) => {
    if (userId === currentUserId) return;
    router.push({ pathname: '/user-profile', params: { userId } });
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
    if (activeCommentPost === postId) {
      setActiveCommentPost(null);
      activeCommentPostRef.current = null;
    } else {
      setActiveCommentPost(postId);
      activeCommentPostRef.current = postId;
      if (!postComments[postId]) fetchPostComments(postId);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.customHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.customHeaderTitle, { color: theme.text }]}>{i18n.t('observatory.title')}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Transmisión en Vivo */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{i18n.t('observatory.liveStream')}</Text>
        <View style={styles.liveCameraFrame}>
          <View style={styles.livePlaceholder}>
            <Text style={styles.livePlaceholderText}>{i18n.t('observatory.disconnected')}</Text>
          </View>

          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{i18n.t('observatory.disconnectedBadge')}</Text>
          </View>
        </View>


        {/* Sección de Comunidad */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitleCommunity, { color: theme.text }]}>{i18n.t('observatory.community')}</Text>
          <TouchableOpacity
            style={styles.createPostBtn}
            onPress={() => setIsCreatingPost(!isCreatingPost)}
          >
            <Text style={styles.createPostBtnText}>
              {isCreatingPost ? i18n.t('observatory.cancel') : i18n.t('observatory.publish')}
            </Text>
          </TouchableOpacity>
        </View>

        {isCreatingPost && (
          <View style={[styles.createPostForm, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <TextInput
              style={[styles.inputTitle, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder={i18n.t('observatory.postTitlePlaceholder')}
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholderTextColor={theme.placeholder}
              editable={!publishing}
            />
            <TextInput
              style={[styles.inputDesc, { color: theme.text, backgroundColor: theme.inputBackground }]}
              placeholder={i18n.t('observatory.postDescPlaceholder')}
              multiline
              numberOfLines={3}
              value={newPostDesc}
              onChangeText={setNewPostDesc}
              placeholderTextColor={theme.placeholder}
              editable={!publishing}
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.primary }, publishing && { opacity: 0.6 }]}
              onPress={handleCreatePost}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={styles.submitBtnText}>{i18n.t('observatory.submitPost')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={56} color={theme.subtext} />
            <Text style={[styles.emptyText, { color: theme.text }]}>{i18n.t('observatory.emptyFeed')}</Text>
            <Text style={[styles.emptySubtext, { color: theme.subtext }]}>{i18n.t('observatory.emptyFeedHint')}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryBtnText}>{i18n.t('observatory.refresh')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {posts.map((post) => {
              const perfil = post.perfiles;
              const hasPhoto = perfil?.foto_perfil && !perfil.foto_perfil.includes('images.unsplash.com');
              const isOwner = post.usuario_id === currentUserId;

              return (
                <View key={post.id} style={[styles.postCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <View style={styles.postHeader}>
                    <TouchableOpacity
                      style={styles.postHeaderLeft}
                      onPress={() => navigateToProfile(post.usuario_id)}
                      activeOpacity={0.7}
                    >
                      {hasPhoto ? (
                        <Image source={{ uri: perfil.foto_perfil! }} style={styles.postAvatar} />
                      ) : (
                        <View style={[styles.postAvatar, styles.avatarPlaceholder, { backgroundColor: theme.inputBackground }]}> 
                          <Ionicons name="person" size={18} color={theme.muted} />
                        </View>
                      )}
                      <View style={styles.postUserInfo}>
                        <Text style={[styles.postUserName, { color: theme.text }]}> 
                          {perfil?.username || perfil?.nombre || 'Usuario'}
                        </Text>
                        <Text style={[styles.postTime, { color: theme.muted }]}>{getTimeAgo(post.created_at)}</Text>
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
                          {followingIds.has(post.usuario_id) ? i18n.t('observatory.followingBtn') : i18n.t('observatory.followBtn')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[styles.postTitle, { color: theme.text }]}>{post.titulo}</Text>
                  <Text style={[styles.postDescription, { color: theme.subtext }]}>{post.descripcion}</Text>

                  <View style={styles.postActionsRow}>
                    <TouchableOpacity
                      style={[styles.iconActionBtn, post.likedByMe ? styles.iconActionBtnActive : null]}
                      onPress={() => handleToggleLike(post.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={18} color={post.likedByMe ? '#ec4899' : theme.text} />
                      <Text style={[styles.iconActionText, { color: theme.text }]}>{post.likesCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => toggleCommentSection(post.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.text} />
                      <Text style={[styles.iconActionText, { color: theme.text }]}>{post.commentsCount}</Text>
                    </TouchableOpacity>
                  </View>

                  {activeCommentPost === post.id && (
                    <View style={[styles.commentBox, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                      {/* Lista de comentarios existentes */}
                      {(postComments[post.id] || []).map((comment: any) => (
                        <View key={comment.id} style={{ flexDirection: 'row', marginBottom: 8, gap: 8 }}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                            {comment.perfil?.foto_perfil && !comment.perfil.foto_perfil.includes('unsplash') ? (
                              <Image source={{ uri: comment.perfil.foto_perfil }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                            ) : (
                              <Ionicons name="person" size={14} color={theme.muted} />
                            )}
                          </View>
                          <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 8, paddingHorizontal: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.text, marginBottom: 2 }}>{comment.perfil?.username || 'Usuario'}</Text>
                            <Text style={{ fontSize: 13, color: theme.subtext, lineHeight: 18 }}>{comment.comentario}</Text>
                            <Text style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>{getTimeAgo(comment.created_at)}</Text>
                          </View>
                        </View>
                      ))}

                      <TextInput
                        style={[styles.commentInput, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
                        placeholder={i18n.t('observatory.writeComment')}
                        placeholderTextColor={theme.placeholder}
                        value={commentInputs[post.id] || ''}
                        onChangeText={(value) => setCommentInputs((prev) => ({ ...prev, [post.id]: value }))}
                        multiline
                        numberOfLines={2}
                      />
                      <TouchableOpacity
                        style={[styles.commentSubmitBtn, { backgroundColor: theme.primary }]}
                        onPress={() => handleSubmitComment(post.id)}
                        disabled={submittingCommentId === post.id}
                      >
                        {submittingCommentId === post.id ? (
                          <ActivityIndicator size="small" color={theme.primaryText} />
                        ) : (
                          <Text style={[styles.commentSubmitText, { color: theme.primaryText }]}>{i18n.t('observatory.sendComment')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
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
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconActionBtnActive: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
  },
  iconActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  commentInput: {
    minHeight: 48,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 14,
    marginBottom: 10,
  },
  commentSubmitBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  commentSubmitText: {
    fontSize: 14,
    fontWeight: '700',
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
