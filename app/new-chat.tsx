import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getFollowers, getFollowing, searchUsers } from '../lib/follows';

export default function NewChatScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Lista inicial (seguidores + seguidos)
  const [defaultUsers, setDefaultUsers] = useState<any[]>([]);
  // Resultados a mostrar en la lista
  const [displayUsers, setDisplayUsers] = useState<any[]>([]);
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadInitialUsers();
  }, []);

  // Efecto para búsqueda global con debounce
  useEffect(() => {
    if (!currentUserId) return;
    
    if (!search.trim()) {
      setDisplayUsers(defaultUsers);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const results = await searchUsers(search.trim(), currentUserId);
        setDisplayUsers(results);
      } catch (err) {
        console.error('Error buscando usuarios globales:', err);
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeout);
  }, [search, currentUserId, defaultUsers]);

  const loadInitialUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const myId = session.user.id;
      setCurrentUserId(myId);
      try {
        // Cargar seguidores y seguidos en paralelo
        const [followersList, followingList] = await Promise.all([
          getFollowers(myId),
          getFollowing(myId)
        ]);
        
        // Unir y eliminar duplicados (gente que sigo y me sigue)
        const combinedMap = new Map();
        followersList.forEach(u => combinedMap.set(u.id, u));
        followingList.forEach(u => combinedMap.set(u.id, u));
        
        const combinedArray = Array.from(combinedMap.values());
        setDefaultUsers(combinedArray);
        setDisplayUsers(combinedArray);
      } catch (err) {
        console.error('Error cargando lista inicial:', err);
      }
    }
    setLoading(false);
  };

  const renderItem = ({ item }: { item: any }) => {
    const hasPhoto = item.foto_perfil && !item.foto_perfil.includes('images.unsplash.com');
    return (
      <TouchableOpacity 
        style={styles.userItem} 
        onPress={() => {
          // Reemplazamos esta pantalla por la del chat con este usuario
          router.replace({ pathname: '/messages', params: { userId: item.id } });
        }}
      >
        {hasPhoto ? (
          <Image source={{ uri: item.foto_perfil! }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={24} color="#ccc" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username || item.nombre}</Text>
          {item.descripcion && (
            <Text style={styles.description} numberOfLines={1}>{item.descripcion}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: 'Iniciar Chat',
          headerBackTitle: 'Atrás'
        }}
      />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar usuarios..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#888"
          autoCapitalize="none"
        />
        {searching ? (
          <ActivityIndicator size="small" color="#004d40" style={{ marginLeft: 8 }} />
        ) : search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#888" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#004d40" />
        </View>
      ) : displayUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>
            {search.length > 0 ? 'No se encontraron usuarios.' : 'Aún no sigues a nadie para chatear.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7f8',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  placeholderAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
});
