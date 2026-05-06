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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

type UserProfile = {
  id: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
  descripcion: string | null;
};

type TabKey = 'followers' | 'following' | 'discover';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'followers', label: 'Seguidores' },
  { key: 'following', label: 'Seguidos' },
  { key: 'discover', label: 'Descubrir' },
];

export default function SocialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const targetUserId = params.userId;

  const initialTabIndex = TABS.findIndex(t => t.key === params.tab) ?? 2;
  const [activeTab, setActiveTab] = useState(initialTabIndex >= 0 ? initialTabIndex : 2);


  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [togglingFollow, setTogglingFollow] = useState<Set<string>>(new Set());

  // Data per tab
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [discovered, setDiscovered] = useState<UserProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const myId = session?.user?.id;
    if (!myId) return;

    setCurrentUserId(myId);
    const userId = targetUserId || myId;

    try {
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
    } catch (err) {
      console.error('Error loading social data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda en Descubrir
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

  const navigateToProfile = (userId: string) => {
    if (userId === currentUserId) return;
    router.push({ pathname: '/user-profile', params: { userId } });
  };

  const onTabPress = (index: number) => {
    setActiveTab(index);
  };

  const renderUser = ({ item }: { item: UserProfile }) => {
    const isFollowingUser = followingIds.has(item.id);
    const isToggling = togglingFollow.has(item.id);
    const isMe = item.id === currentUserId;
    const hasPhoto = item.foto_perfil && !item.foto_perfil.includes('images.unsplash.com');

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => navigateToProfile(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.userInfo}>
          {hasPhoto ? (
            <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#ccc" />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text style={styles.username} numberOfLines={1}>
              {item.username || item.nombre}
            </Text>
            {item.descripcion ? (
              <Text style={styles.description} numberOfLines={1}>
                {item.descripcion}
              </Text>
            ) : null}
          </View>
        </View>

        {!isMe && (
          <TouchableOpacity
            style={[styles.followButton, isFollowingUser && styles.followingButton]}
            onPress={() => toggleFollow(item.id)}
            disabled={isToggling}
            activeOpacity={0.7}
          >
            {isToggling ? (
              <ActivityIndicator size="small" color={isFollowingUser ? '#555' : '#fff'} />
            ) : (
              <Text style={[styles.followButtonText, isFollowingUser && styles.followingButtonText]}>
                {isFollowingUser ? 'Siguiendo' : 'Seguir'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color="#ddd" />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );

  const renderList = (data: UserProfile[], emptyMessage: string) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderUser}
      contentContainerStyle={[styles.listContent, data.length === 0 && { flex: 1 }]}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={() => renderEmptyState(emptyMessage)}
    />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === index && styles.activeTab]}
            onPress={() => onTabPress(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === index && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 0 && renderList(followers, 'Aún no tiene seguidores')}
          {activeTab === 1 && renderList(following, 'Aún no sigue a nadie')}
          {activeTab === 2 && (
            <>
              {/* Barra de búsqueda */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre de usuario..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              {renderList(
                discovered,
                searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios para descubrir'
              )}
            </>
          )}
        </View>
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#111',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#111',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});
