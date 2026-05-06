/**
 * discover-users.tsx — Pantalla dedicada de descubrimiento de usuarios.
 *
 * Muestra usuarios sugeridos con búsqueda por nombre. Permite follow/unfollow
 * inline con feedback de loading por usuario individual.
 *
 * @module app/discover-users
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { discoverUsers, searchUsers, followUser, unfollowUser, getFollowingIds } from '../lib/follows';

const { width } = Dimensions.get('window');

/** Perfil público para tarjetas de descubrimiento */
type UserProfile = {
  id: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
  descripcion: string | null;
};

export default function DiscoverUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [togglingFollow, setTogglingFollow] = useState<Set<string>>(new Set());

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    setCurrentUserId(session.user.id);
    await loadUsers(session.user.id, '');
  };

  /** Carga usuarios sugeridos o resultados de búsqueda */
  const loadUsers = async (userId: string, query: string) => {
    setLoading(true);
    try {
      const [userList, followIds] = await Promise.all([
        query.trim() ? searchUsers(query.trim(), userId) : discoverUsers(userId),
        getFollowingIds(userId),
      ]);
      setUsers(userList);
      setFollowingIds(followIds);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Búsqueda con debounce implícito (400ms via timeout en useCallback) */
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    if (currentUserId) {
      // Debounce simple: esperamos a que deje de escribir
      const timeout = setTimeout(() => {
        loadUsers(currentUserId, text);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [currentUserId]);

  /** Alterna follow/unfollow con guard de concurrencia por usuario */
  const toggleFollow = async (targetUserId: string) => {
    if (!currentUserId || togglingFollow.has(targetUserId)) return;

    setTogglingFollow(prev => new Set(prev).add(targetUserId));
    const isCurrentlyFollowing = followingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUserId, targetUserId);
        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(targetUserId);
          return next;
        });
      } else {
        await followUser(currentUserId, targetUserId);
        setFollowingIds(prev => new Set(prev).add(targetUserId));
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setTogglingFollow(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  const navigateToProfile = (userId: string) => {
    router.push({ pathname: '/user-profile', params: { userId } });
  };

  const renderUser = ({ item }: { item: UserProfile }) => {
    const isFollowing = followingIds.has(item.id);
    const isToggling = togglingFollow.has(item.id);
    const hasPhoto = item.foto_perfil && !item.foto_perfil.includes('images.unsplash.com');

    return (
      <TouchableOpacity style={styles.userCard} onPress={() => navigateToProfile(item.id)} activeOpacity={0.7}>
        <View style={styles.userInfo}>
          {hasPhoto ? (
            <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#ccc" />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.username} numberOfLines={1}>{item.username || item.nombre}</Text>
            {item.descripcion ? (
              <Text style={styles.description} numberOfLines={1}>{item.descripcion}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={() => toggleFollow(item.id)}
          disabled={isToggling}
          activeOpacity={0.7}
        >
          {isToggling ? (
            <ActivityIndicator size="small" color={isFollowing ? '#555' : '#fff'} />
          ) : (
            <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
              {isFollowing ? 'Siguiendo' : 'Seguir'}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Descubrir Usuarios</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre de usuario..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); if (currentUserId) loadUsers(currentUserId, ''); }}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Lista de usuarios */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>
            {searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios para descubrir'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    height: 46,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  description: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  followButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 95,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#555',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});
