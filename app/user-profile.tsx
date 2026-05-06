/**
 * user-profile.tsx — Perfil público de otro usuario.
 *
 * Muestra foto, bio, stats (registros, seguidores, seguidos),
 * botón de follow/unfollow y acceso a mensajería directa.
 *
 * @module app/user-profile
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { followUser, unfollowUser, checkIsFollowing } from '../lib/follows';

const { width } = Dimensions.get('window');

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, records: 0 });

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  /** Carga perfil, stats y estado de follow */
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
        .eq('id', userId)
        .single();

      if (data && !error) setProfile(data);

      // Stats
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguido_id', userId),
        supabase.from('seguidores').select('*', { count: 'exact', head: true }).eq('seguidor_id', userId),
      ]);

      setStats({
        followers: followersRes.count || 0,
        following: followingRes.count || 0,
        records: 0,
      });

      // ¿Lo sigo?
      if (myId && userId) {
        const following = await checkIsFollowing(myId, userId);
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
    if (!currentUserId || !userId || togglingFollow) return;

    setTogglingFollow(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUserId, userId);
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
      } else {
        await followUser(currentUserId, userId);
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
    router.push({ pathname: '/social', params: { userId: userId!, tab: type } });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="person-outline" size={60} color="#ddd" />
        <Text style={{ color: '#999', marginTop: 12 }}>Usuario no encontrado</Text>
      </View>
    );
  }

  const isDefaultUnsplash = profile.foto_perfil?.includes('images.unsplash.com');
  const hasPhoto = profile.foto_perfil && !isDefaultUnsplash;
  const isOwnProfile = currentUserId === userId;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{profile.username || profile.nombre}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Foto + Stats */}
        <View style={styles.profileHeader}>
          {hasPhoto ? (
            <Image source={{ uri: profile.foto_perfil }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Ionicons name="person" size={50} color="#ccc" />
            </View>
          )}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.records}</Text>
              <Text style={styles.statLabel}>Registros</Text>
            </View>
            <TouchableOpacity style={styles.statItem} onPress={() => navigateToFollowers('followers')}>
              <Text style={styles.statNumber}>{stats.followers}</Text>
              <Text style={styles.statLabel}>Seguidores</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigateToFollowers('following')}>
              <Text style={styles.statNumber}>{stats.following}</Text>
              <Text style={styles.statLabel}>Seguidos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.fullName}>{profile.username || profile.nombre}</Text>
          <Text style={styles.description}>{profile.descripcion || 'Sin descripción.'}</Text>
        </View>

        {/* Botón Follow / Unfollow (solo si no es mi perfil) */}
        {!isOwnProfile && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, isFollowing ? styles.unfollowButton : styles.followButton]}
              onPress={toggleFollow}
              disabled={togglingFollow}
              activeOpacity={0.7}
            >
              {togglingFollow ? (
                <ActivityIndicator size="small" color={isFollowing ? '#555' : '#fff'} />
              ) : (
                <Text style={[styles.actionButtonText, isFollowing && styles.unfollowButtonText]}>
                  {isFollowing ? 'Dejar de seguir' : 'Seguir'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.messageButton]}
              onPress={() => router.push({ pathname: '/messages', params: { userId } })}
            >
              <Text style={styles.messageButtonText}>Mensaje</Text>
            </TouchableOpacity>
          </View>
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
});
