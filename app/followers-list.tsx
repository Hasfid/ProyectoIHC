/**
 * followers-list.tsx — Lista genérica de seguidores o seguidos.
 *
 * Recibe `userId` y `type` ('followers' | 'following') por params.
 * Muestra la lista con botón de follow/unfollow inline.
 *
 * @module app/followers-list
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getFollowers, getFollowing, followUser, unfollowUser, getFollowingIds } from '../lib/follows';

/** Usuario en una lista de seguidores/seguidos */
type FollowUser = {
  id: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
  descripcion: string | null;
  followed_at: string;
};

export default function FollowersListScreen() {
  const router = useRouter();
  const { userId, type } = useLocalSearchParams<{ userId: string; type: 'followers' | 'following' }>();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [togglingFollow, setTogglingFollow] = useState<Set<string>>(new Set());

  const title = type === 'followers' ? 'Seguidores' : 'Seguidos';

  useEffect(() => {
    if (userId && type) loadData();
  }, [userId, type]);

  /** Carga la lista de usuarios y los IDs que el usuario actual sigue */
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const myId = session?.user?.id;
      setCurrentUserId(myId || null);

      const [userList, myFollowingIds] = await Promise.all([
        type === 'followers' ? getFollowers(userId!) : getFollowing(userId!),
        myId ? getFollowingIds(myId) : Promise.resolve(new Set<string>()),
      ]);

      setUsers(userList);
      setFollowingIds(myFollowingIds);
    } catch (err) {
      console.error('Error loading followers:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Alterna follow/unfollow con guard de concurrencia */
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

  /** Navega al perfil público (excepto si es el propio usuario) */
  const navigateToProfile = (id: string) => {
    if (id === currentUserId) return; // No navegar a mi propio perfil público
    router.push({ pathname: '/user-profile', params: { userId: id } });
  };

  const renderUser = ({ item }: { item: FollowUser }) => {
    const isFollowing = followingIds.has(item.id);
    const isToggling = togglingFollow.has(item.id);
    const isMe = item.id === currentUserId;
    const hasPhoto = item.foto_perfil && !item.foto_perfil.includes('images.unsplash.com');

    return (
      <TouchableOpacity style={styles.userCard} onPress={() => navigateToProfile(item.id)} activeOpacity={0.7}>
        <View style={styles.userInfo}>
          {hasPhoto ? (
            <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={22} color="#ccc" />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.username} numberOfLines={1}>{item.username || item.nombre}</Text>
            {item.descripcion ? (
              <Text style={styles.description} numberOfLines={1}>{item.descripcion}</Text>
            ) : null}
          </View>
        </View>

        {!isMe && (
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
        )}
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
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={60} color="#ddd" />
          <Text style={styles.emptyText}>
            {type === 'followers' ? 'Aún no tiene seguidores' : 'Aún no sigue a nadie'}
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
