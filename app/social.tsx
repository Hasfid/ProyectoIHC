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

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'followers', title: 'Seguidores' },
    { key: 'following', title: 'Seguidos' },
    { key: 'discover', title: 'Descubrir' },
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
        style={styles.userCard} 
        onPress={() => !isMe && router.push({ pathname: '/user-profile', params: { userId: item.id } })}
      >
        <View style={styles.userInfo}>
          {hasPhoto ? (
            <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={20} color="#ccc" />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.username}>{item.username || item.nombre}</Text>
            {item.descripcion && <Text style={styles.description} numberOfLines={1}>{item.descripcion}</Text>}
          </View>
        </View>
        {!isMe && (
          <TouchableOpacity 
            style={[styles.followButton, isFollowingUser && styles.followingButton]}
            onPress={() => toggleFollow(item.id)}
          >
            <Text style={[styles.followText, isFollowingUser && styles.followingText]}>
              {isFollowingUser ? 'Siguiendo' : 'Seguir'}
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
          <Ionicons name="people-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      )}
    />
  );

  /** Renderiza el contenido de cada pestaña */
  const renderScene = ({ route }: { route: any }) => {
    switch (route.key) {
      case 'followers':
        return renderList(followers, 'Aún no tiene seguidores');
      case 'following':
        return renderList(following, 'Aún no sigue a nadie');
      case 'discover':
        return (
          <View style={{ flex: 1 }}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar aventureros..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
            </View>
            {renderList(discovered, searchQuery ? 'No se encontraron resultados' : 'Descubre nuevos usuarios')}
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
      indicatorStyle={styles.indicator}
      style={styles.tabBar}
      labelStyle={styles.tabLabel}
      activeColor="#2e7d32"
      inactiveColor="#999"
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 50 }} />
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  listContent: { padding: 16 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, backgroundColor: '#f9f9f9', padding: 12, borderRadius: 12,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  textContainer: { flex: 1 },
  username: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 12, color: '#666', marginTop: 2 },
  followButton: {
    backgroundColor: '#2e7d32', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  followingButton: { backgroundColor: '#eee' },
  followText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  followingText: { color: '#666' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0',
    margin: 16, paddingHorizontal: 12, borderRadius: 10, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, color: '#000' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 12, fontSize: 16 },
  tabBar: { backgroundColor: '#fff' },
  indicator: { backgroundColor: '#2e7d32' },
  tabLabel: { color: '#000', fontWeight: 'bold', fontSize: 12 },
});
