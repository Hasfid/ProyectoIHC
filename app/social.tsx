/**
 * social.tsx — Hub social con tabs: Seguidores, Seguidos y Descubrir.
 *
 * Usa react-native-tab-view para las pestañas. Soporta visualización
 * del grafo social propio o de otro usuario (via params.userId).
 * Incluye búsqueda con debounce (400ms) en la pestaña Descubrir.
 *
 * @module app/social
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TabView, TabBar } from 'react-native-tab-view';
import { supabase } from '../lib/supabase';
import {
  getFollowers,
  getFollowing,
  discoverUsers,
  searchUsers,
  followUser,
  unfollowUser,
  getFollowingIds,
} from '../lib/follows';
import { i18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

/** Perfil público simplificado para las listas sociales */
type UserProfile = {
  id: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
  descripcion: string | null;
};

export default function SocialScreen() {
  const router = useRouter();
  const layout = useWindowDimensions();
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const targetUserId = params.userId;
  const { theme } = useTheme();

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'followers', title: i18n.t('social.followers') },
    { key: 'following', title: i18n.t('social.following') },
    { key: 'discover', title: i18n.t('social.discover') },
  ]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [togglingFollow, setTogglingFollow] = useState<Set<string>>(new Set());

  // Data
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [discovered, setDiscovered] = useState<UserProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  /** Carga seguidores, seguidos y sugerencias en paralelo */
  const init = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user?.id;
      
      if (!myId) {
        setLoading(false);
        return;
      }

      setCurrentUserId(myId);
      const userId = targetUserId || myId;

      const [followersList, followingList, discoverList, myFollowIds] = await Promise.all([
        getFollowers(userId),
        getFollowing(userId),
        discoverUsers(myId),
        getFollowingIds(myId),
      ]);

      setFollowers(followersList);
      setFollowing(followingList);
      setDiscovered(discoverList);
      setFollowingIds(myFollowIds);
      
      // Ajustar tab inicial si viene por params
      if (params.tab === 'following') setIndex(1);
      if (params.tab === 'discover') setIndex(2);
      
    } catch (err) {
      console.error('Error loading social data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda con debounce en Descubrir
  useEffect(() => {
    if (!currentUserId) return;
    const timeout = setTimeout(async () => {
      try {
        if (searchQuery.trim()) {
          const results = await searchUsers(searchQuery.trim(), currentUserId);
          setDiscovered(results);
        } else {
          const results = await discoverUsers(currentUserId);
          setDiscovered(results);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, currentUserId]);

  /** Alterna follow/unfollow con estado optimista y guard de concurrencia */
  const toggleFollow = async (targetId: string) => {
    if (!currentUserId || togglingFollow.has(targetId)) return;
    setTogglingFollow(prev => new Set(prev).add(targetId));
    const isCurrentlyFollowing = followingIds.has(targetId);
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUserId, targetId);
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      } else {
        await followUser(currentUserId, targetId);
        setFollowingIds(prev => new Set(prev).add(targetId));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setTogglingFollow(prev => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  /** Renderiza una tarjeta de usuario con botón de seguir/siguiendo */
  const renderUser = ({ item }: { item: UserProfile }) => {
    const isMe = item.id === currentUserId;
    const isFollowingUser = followingIds.has(item.id);
    const hasPhoto = item.foto_perfil && !item.foto_perfil.includes('images.unsplash.com');

    return (
      <TouchableOpacity 
        style={[styles.userCard, { backgroundColor: theme.card, borderColor: theme.border }]} 
        onPress={() => !isMe && router.push({ pathname: '/user-profile', params: { userId: item.id } })}
      >
        <View style={styles.userInfo}>
          {hasPhoto ? (
            <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={20} color={theme.muted} />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={[styles.username, { color: theme.text }]}>{item.username || item.nombre}</Text>
            {item.descripcion && <Text style={[styles.description, { color: theme.subtext }]} numberOfLines={1}>{item.descripcion}</Text>}
          </View>
        </View>
        {!isMe && (
          <TouchableOpacity 
            style={[styles.followButton, { backgroundColor: theme.primary }, isFollowingUser && { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.border }]}
            onPress={() => toggleFollow(item.id)}
          >
            <Text style={[styles.followText, { color: theme.primaryText }, isFollowingUser && { color: theme.subtext }]}>
              {isFollowingUser ? i18n.t('social.following') : i18n.t('social.follow')}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderList = (data: UserProfile[], emptyMessage: string) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderUser}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={50} color={theme.muted} />
          <Text style={[styles.emptyText, { color: theme.muted }]}>{emptyMessage}</Text>
        </View>
      )}
    />
  );

  /** Renderiza el contenido de cada pestaña */
  const renderScene = ({ route }: { route: any }) => {
    switch (route.key) {
      case 'followers':
        return renderList(followers, i18n.t('social.noFollowers'));
      case 'following':
        return renderList(following, i18n.t('social.noFollowing'));
      case 'discover':
        return (
          <View style={{ flex: 1 }}>
            <View style={[styles.searchContainer, { backgroundColor: theme.inputBackground }]}>
              <Ionicons name="search" size={20} color={theme.muted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder={i18n.t('social.searchUsers')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={theme.placeholder}
              />
            </View>
            {renderList(discovered, searchQuery ? i18n.t('social.noUsersFound') : i18n.t('social.noUsersDiscover'))}
          </View>
        );
      default:
        return null;
    }
  };

  /** Renderiza la barra de pestañas personalizada */
  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={[styles.indicator, { backgroundColor: theme.primary }]}
      style={[styles.tabBar, { backgroundColor: theme.surface }]}
      labelStyle={styles.tabLabel}
      activeColor={theme.primary}
      inactiveColor={theme.muted}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{i18n.t('social.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
      ) : (
        <TabView
          navigationState={{ index, routes }}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          renderTabBar={renderTabBar}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  listContent: { padding: 16 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  textContainer: { flex: 1 },
  username: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 12, marginTop: 2 },
  followButton: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  followText: { fontWeight: 'bold', fontSize: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, paddingHorizontal: 12, borderRadius: 10, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, fontSize: 16 },
  tabBar: { elevation: 0, shadowOpacity: 0 },
  indicator: { height: 3 },
  tabLabel: { fontWeight: 'bold', fontSize: 12 },
});
