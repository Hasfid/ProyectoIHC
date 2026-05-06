/**
 * messages.tsx — Chat 1-a-1 con mensajería en tiempo real.
 *
 * Funcionalidades:
 * - Suscripción Realtime a Supabase (INSERT/UPDATE/DELETE)
 * - Edición y eliminación de mensajes propios (long press)
 * - Bloqueo/desbloqueo de usuarios via AsyncStorage
 * - Eliminación local de conversación (sin borrar del servidor)
 *
 * @module app/messages
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/** Estructura de un mensaje individual */
type Message = {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  contenido: string;
  created_at: string;
};

export default function MessagesScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchSessionAndData();
    
    // Suscripción en tiempo real
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            if (
              (newMsg.remitente_id === currentUserId && newMsg.destinatario_id === userId) ||
              (newMsg.remitente_id === userId && newMsg.destinatario_id === currentUserId)
            ) {
              setMessages((prev) => [newMsg, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages((prev) => prev.filter(m => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, userId]);

  const fetchSessionAndData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      fetchRecipientProfile();
      fetchMessages(session.user.id);
      checkIfBlocked(session.user.id);
    }
  };

  /** Verifica si el destinatario está en la lista local de bloqueados */
  const checkIfBlocked = async (myId: string) => {
    const blockedRaw = await AsyncStorage.getItem(`blocked_users_${myId}`);
    const blockedUsers = blockedRaw ? JSON.parse(blockedRaw) : [];
    setIsBlocked(blockedUsers.includes(userId));
  };

  const fetchRecipientProfile = async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setRecipientProfile(data);
  };

  /** Carga mensajes de la conversación ordenados cronológicamente (desc) */
  const fetchMessages = async (myId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .or(`and(remitente_id.eq.${myId},destinatario_id.eq.${userId}),and(remitente_id.eq.${userId},destinatario_id.eq.${myId})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Envía un mensaje nuevo o actualiza uno existente (modo edición) */
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return;

    // Verificar si el usuario está bloqueado localmente
    const blockedRaw = await AsyncStorage.getItem(`blocked_users_${currentUserId}`);
    const blockedUsers = blockedRaw ? JSON.parse(blockedRaw) : [];
    if (blockedUsers.includes(userId)) {
      Alert.alert('Usuario bloqueado', 'No puedes enviar mensajes a un usuario que has bloqueado.');
      return;
    }

    setSending(true);
    try {
      if (editingMessage) {
        const { error } = await supabase
          .from('mensajes')
          .update({ contenido: newMessage.trim() })
          .eq('id', editingMessage.id);
        if (error) throw error;
        setEditingMessage(null);
      } else {
        const { error } = await supabase.from('mensajes').insert({
          remitente_id: currentUserId,
          destinatario_id: userId,
          contenido: newMessage.trim(),
        });
        if (error) throw error;
      }
      setNewMessage('');
    } catch (err) {
      console.error('Error handling message action:', err);
    } finally {
      setSending(false);
    }
  };

  const showOptionsMenu = () => {
    Alert.alert(
      'Opciones de chat',
      '¿Qué deseas hacer?',
      [
        { 
          text: 'Eliminar conversación', 
          style: 'destructive',
          onPress: handleDeleteChat 
        },
        { 
          text: 'Bloquear usuario', 
          style: 'destructive',
          onPress: handleBlockUser 
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  /** Oculta la conversación localmente y regresa a la bandeja */
  const handleDeleteChat = async () => {
    if (!currentUserId) return;
    try {
      const storageKey = `hidden_chats_${currentUserId}`;
      const hiddenChatsRaw = await AsyncStorage.getItem(storageKey);
      const hiddenChats = hiddenChatsRaw ? JSON.parse(hiddenChatsRaw) : {};
      
      hiddenChats[userId] = new Date().toISOString();
      await AsyncStorage.setItem(storageKey, JSON.stringify(hiddenChats));
      
      router.back();
    } catch (err) {
      console.error('Error hiding chat:', err);
    }
  };

  const handleUnblockUser = async () => {
    if (!currentUserId) return;
    try {
      const storageKey = `blocked_users_${currentUserId}`;
      const blockedRaw = await AsyncStorage.getItem(storageKey);
      let blockedUsers = blockedRaw ? JSON.parse(blockedRaw) : [];
      
      blockedUsers = blockedUsers.filter((id: string) => id !== userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(blockedUsers));
      
      setIsBlocked(false);
      Alert.alert('Éxito', 'Usuario desbloqueado correctamente.');
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  };

  /** Agrega al usuario a la lista local de bloqueados */
  const handleBlockUser = async () => {
    if (!currentUserId) return;
    try {
      const storageKey = `blocked_users_${currentUserId}`;
      const blockedRaw = await AsyncStorage.getItem(storageKey);
      const blockedUsers = blockedRaw ? JSON.parse(blockedRaw) : [];
      
      if (!blockedUsers.includes(userId)) {
        blockedUsers.push(userId);
        await AsyncStorage.setItem(storageKey, JSON.stringify(blockedUsers));
        setIsBlocked(true);
        Alert.alert('Éxito', 'Usuario bloqueado correctamente.');
        router.back();
      }
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  /** Muestra menú de opciones (editar/eliminar) en long press de mensaje propio */
  const handleLongPress = (item: Message) => {
    if (item.remitente_id !== currentUserId) return;

    const options = ['Editar', 'Eliminar', 'Cancelar'];
    Alert.alert(
      'Opciones de mensaje',
      '¿Qué deseas hacer con este mensaje?',
      [
        { 
          text: 'Editar', 
          onPress: () => {
            setEditingMessage(item);
            setNewMessage(item.contenido);
          } 
        },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: () => handleDeleteMessage(item.id) 
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('mensajes')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.remitente_id === currentUserId;
    return (
      <TouchableOpacity 
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={[styles.messageBubble, isMine ? styles.myMessage : styles.theirMessage]}
      >
        <Text style={[styles.messageText, isMine ? styles.myMessageText : styles.theirMessageText]}>
          {item.contenido}
        </Text>
        <View style={styles.messageFooter}>
          <Text style={[styles.messageTime, isMine ? styles.myMessageTime : styles.theirMessageTime]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerTitle: recipientProfile ? (recipientProfile.username || recipientProfile.nombre) : 'Chat',
          headerBackTitle: 'Atrás',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {recipientProfile?.foto_perfil && (
                <Image source={{ uri: recipientProfile.foto_perfil }} style={styles.headerAvatar} />
              )}
              <TouchableOpacity onPress={showOptionsMenu}>
                <Ionicons name="ellipsis-vertical" size={24} color="#004d40" style={{ marginRight: 10 }} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#004d40" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted // Empieza desde abajo
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled, editingMessage && { backgroundColor: '#2e7d32' }]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name={editingMessage ? "checkmark" : "send"} size={20} color="#fff" />
          )}
        </TouchableOpacity>
        {editingMessage && (
          <TouchableOpacity 
            style={styles.cancelEditBtn} 
            onPress={() => { setEditingMessage(null); setNewMessage(''); }}
          >
            <Ionicons name="close-circle" size={24} color="#888" />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  listContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#004d40',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#111',
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelEditBtn: {
    marginLeft: 8,
    paddingBottom: 10,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  theirMessageTime: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f2f3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#004d40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
