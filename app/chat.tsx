import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type Conversation = {
  other_user_id: string;
  last_message: string;
  last_message_time: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
};

export default function ChatListScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionAndChats();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) {
        fetchConversations(currentUserId);
      }
    }, [currentUserId])
  );

  const fetchSessionAndChats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      fetchConversations(session.user.id);
    } else {
      setLoading(false);
    }
  };

  const fetchConversations = async (myId: string) => {
    try {
      // 1. Obtener todos los mensajes donde soy remitente o destinatario
      const { data: messages, error } = await supabase
        .from('mensajes')
        .select('*')
        .or(`remitente_id.eq.${myId},destinatario_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!messages || messages.length === 0) {
        setConversations([]);
        return;
      }

      // 2. Agrupar por el "otro usuario" y quedarnos con el último mensaje
      const convsMap = new Map<string, any>();
      
      messages.forEach(msg => {
        const otherId = msg.remitente_id === myId ? msg.destinatario_id : msg.remitente_id;
        if (!convsMap.has(otherId)) {
          convsMap.set(otherId, {
            other_user_id: otherId,
            last_message: msg.contenido,
            last_message_time: msg.created_at,
          });
        }
      });

      // 3. Obtener perfiles de los otros usuarios
      const otherUserIds = Array.from(convsMap.keys());
      const { data: profiles } = await supabase
        .from('perfiles')
        .select('id, username, nombre, foto_perfil')
        .in('id', otherUserIds);

      const combined = (profiles || []).map(profile => {
        const conv = convsMap.get(profile.id);
        return {
          ...conv,
          username: profile.username,
          nombre: profile.nombre,
          foto_perfil: profile.foto_perfil,
        };
      });

      // Ordenar por tiempo del último mensaje
      combined.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());

      setConversations(combined);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (currentUserId) fetchConversations(currentUserId);
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => router.push({ pathname: '/messages', params: { userId: item.other_user_id } })}
    >
      <View style={styles.avatarContainer}>
        {item.foto_perfil ? (
          <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={24} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.username}>{item.username || item.nombre}</Text>
          <Text style={styles.time}>{getTimeAgo(item.last_message_time)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / 3600000);
    
    if (diffHrs < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: 'Mensajería',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push({ pathname: '/social', params: { tab: 'following' } })}>
              <Ionicons name="create-outline" size={24} color="#004d40" style={{ marginRight: 15 }} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#004d40" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Sin conversaciones</Text>
          <Text style={styles.emptySubtitle}>Inicia un chat con alguien que sigas.</Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push({ pathname: '/social', params: { tab: 'following' } })}
          >
            <Text style={styles.startButtonText}>Empezar a chatear</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.other_user_id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  placeholderAvatar: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInfo: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#111',
  },
  time: {
    fontSize: 12,
    color: '#888',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#004d40',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
