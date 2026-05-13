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
  Modal,
  Pressable,
  Keyboard
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { i18n } from '../lib/i18n';

/** Estructura de un mensaje individual */
type Message = {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  contenido: string;
  created_at: string;
  is_edited?: boolean;
};

export default function MessagesScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recipientProfile, setRecipientProfile] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [chatOptionsVisible, setChatOptionsVisible] = useState(false);
  const [messageOptionsVisible, setMessageOptionsVisible] = useState<Message | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Carga inicial
  useEffect(() => {
    fetchSessionAndData();
  }, []);

  // Suscripción a Realtime
  useEffect(() => {
    if (!currentUserId || !userId) return;

    const channelName = `chat_${currentUserId}_${userId}`;
    const channel = supabase
      .channel(channelName)
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
              setMessages((prev) => {
                if (prev.find(m => m.id === newMsg.id)) return prev;
                return [newMsg, ...prev];
              });
              markChatAsRead(currentUserId);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg, is_edited: true } : m));
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
      unhideChatLocally(session.user.id);
      markChatAsRead(session.user.id);
    }
  };

  /** Marca el chat como leído guardando el timestamp actual */
  const markChatAsRead = async (myId: string) => {
    try {
      const storageKey = `last_read_${myId}`;
      const lastReadRaw = await AsyncStorage.getItem(storageKey);
      const lastRead = lastReadRaw ? JSON.parse(lastReadRaw) : {};
      lastRead[userId] = new Date().toISOString();
      await AsyncStorage.setItem(storageKey, JSON.stringify(lastRead));
    } catch (err) {
      console.error('Error marking chat as read:', err);
    }
  };

  /** Desoculta el chat si había sido cerrado previamente */
  const unhideChatLocally = async (myId: string) => {
    try {
      const storageKey = `hidden_chats_${myId}`;
      const hiddenChatsRaw = await AsyncStorage.getItem(storageKey);
      if (hiddenChatsRaw) {
        const hiddenChats = JSON.parse(hiddenChatsRaw);
        if (hiddenChats[userId]) {
          delete hiddenChats[userId];
          await AsyncStorage.setItem(storageKey, JSON.stringify(hiddenChats));
        }
      }
    } catch (err) {
      console.error('Error unhiding chat:', err);
    }
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

    setSending(true);
    try {
      const trimmedMessage = newMessage.trim();
      if (editingMessage) {
        // Optimistic UI for editing
        setMessages((prev) => 
          prev.map((m) => m.id === editingMessage.id ? { ...m, contenido: trimmedMessage, is_edited: true } : m)
        );

        const { data, error } = await supabase
          .from('mensajes')
          .update({ contenido: trimmedMessage, is_edited: true })
          .eq('id', editingMessage.id)
          .select();
          
        if (error || !data || data.length === 0) {
          // Revert optimistic update on error
          setMessages((prev) => 
            prev.map((m) => m.id === editingMessage.id ? { ...m, contenido: editingMessage.contenido, is_edited: false } : m)
          );
          if (!error) {
             Alert.alert('Error de Permisos (RLS)', 'Necesitas habilitar las políticas de UPDATE en la tabla "mensajes" en Supabase.');
          } else {
             throw error;
          }
        }
        setEditingMessage(null);
      } else {
        const { data, error } = await supabase.from('mensajes').insert({
          remitente_id: currentUserId,
          destinatario_id: userId,
          contenido: trimmedMessage,
        }).select().single();
        if (error) throw error;

        // Mostrar inmediatamente en la UI por si Realtime demora o no está activado
        setMessages((prev) => {
          if (prev.find((m) => m.id === data.id)) return prev;
          return [data, ...prev];
        });
      }
      setNewMessage('');
    } catch (err) {
      console.error('Error handling message action:', err);
    } finally {
      setSending(false);
    }
  };

  const showOptionsMenu = () => {
    setChatOptionsVisible(true);
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

  /** Muestra menú de opciones (editar/eliminar) en long press de mensaje propio */
  const handleLongPress = (item: Message) => {
    if (item.remitente_id !== currentUserId) return;
    setMessageOptionsVisible(item);
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Guardar estado previo para revertir si falla
    const previousMessages = [...messages];
    
    // Optimistic UI for deleting
    setMessages((prev) => prev.filter((m) => m.id !== messageId));

    try {
      const { data, error } = await supabase
        .from('mensajes')
        .delete()
        .eq('id', messageId)
        .select();

      if (error || !data || data.length === 0) {
        // Revertir
        setMessages(previousMessages);
        if (!error) {
          Alert.alert('Error de Permisos (RLS)', 'Necesitas habilitar las políticas de DELETE en la tabla "mensajes" en Supabase.');
        } else {
          throw error;
        }
      }
    } catch (err) {
      setMessages(previousMessages); // Revertir
      console.error('Error deleting message:', err);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.remitente_id === currentUserId;
    return (
      <TouchableOpacity 
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
        style={[styles.messageBubble, isMine ? styles.myMessage : [styles.theirMessage, { backgroundColor: theme.card, borderColor: theme.border }]]}
      >
        <Text style={[styles.messageText, isMine ? styles.myMessageText : { color: theme.text }]}>
          {item.contenido}
        </Text>
        <View style={styles.messageFooter}>
          {item.is_edited && (
            <Text style={[styles.messageTime, isMine ? styles.myMessageTime : { color: theme.muted }, { marginRight: 4, fontStyle: 'italic' }]}>
              {i18n.t('messages.edited')}
            </Text>
          )}
          <Text style={[styles.messageTime, isMine ? styles.myMessageTime : { color: theme.muted }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const headerHeight = useHeaderHeight();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 90}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerLeft: () => Platform.OS === 'web' ? (
            <TouchableOpacity 
              onPress={() => router.canGoBack() ? router.back() : router.replace('/chat')} 
              style={{ padding: 8, marginRight: 8, flexDirection: 'row', alignItems: 'center' }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </TouchableOpacity>
          ) : undefined,
          headerTitle: () => (
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center' }}
              onPress={() => router.push({ pathname: '/user-profile', params: { userId } })}
            >
              {recipientProfile?.foto_perfil ? (
                <Image source={{ uri: recipientProfile.foto_perfil }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.inputBackground, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <Ionicons name="person" size={16} color={theme.muted} />
                </View>
              )}
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }}>
                {recipientProfile ? (recipientProfile.username || recipientProfile.nombre) : 'Cargando...'}
              </Text>
            </TouchableOpacity>
          ),
          headerBackTitle: i18n.t('common.back'),
          headerRight: () => (
            <TouchableOpacity onPress={showOptionsMenu} style={{ padding: 8 }}>
              <Ionicons name="ellipsis-vertical" size={24} color={theme.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
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

      <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
          placeholder={i18n.t('messages.typeMessage')}
          placeholderTextColor={theme.placeholder}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web') {
              if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }
          }}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: theme.primary }, !newMessage.trim() && styles.sendButtonDisabled, editingMessage && { backgroundColor: '#2e7d32' }]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.primaryText} />
          ) : (
            <Ionicons name={editingMessage ? "checkmark" : "send"} size={20} color={theme.primaryText} />
          )}
        </TouchableOpacity>
        {editingMessage && (
          <TouchableOpacity 
            style={styles.cancelEditBtn} 
            onPress={() => { setEditingMessage(null); setNewMessage(''); }}
          >
            <Ionicons name="close-circle" size={24} color={theme.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal Opciones de Chat */}
      <Modal visible={chatOptionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setChatOptionsVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{i18n.t('messages.chatOptions')}</Text>
            <TouchableOpacity style={[styles.modalButton, { borderBottomColor: theme.border }]} onPress={() => { setChatOptionsVisible(false); handleDeleteChat(); }}>
              <Text style={styles.modalButtonDestructive}>{i18n.t('messages.closeChat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { borderBottomColor: theme.border }]} onPress={() => setChatOptionsVisible(false)}>
              <Text style={[styles.modalButtonCancel, { color: theme.muted }]}>{i18n.t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal Opciones de Mensaje */}
      <Modal visible={!!messageOptionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMessageOptionsVisible(null)}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{i18n.t('messages.messageOptions')}</Text>
            <TouchableOpacity style={[styles.modalButton, { borderBottomColor: theme.border }]} onPress={() => { 
              if (messageOptionsVisible) {
                setEditingMessage(messageOptionsVisible);
                setNewMessage(messageOptionsVisible.contenido);
              }
              setMessageOptionsVisible(null);
            }}>
              <Text style={styles.modalButtonText}>{i18n.t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { borderBottomColor: theme.border }]} onPress={() => {
              if (messageOptionsVisible) handleDeleteMessage(messageOptionsVisible.id);
              setMessageOptionsVisible(null);
            }}>
              <Text style={styles.modalButtonDestructive}>{i18n.t('common.delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, { borderBottomColor: theme.border }]} onPress={() => setMessageOptionsVisible(null)}>
              <Text style={[styles.modalButtonCancel, { color: theme.muted }]}>{i18n.t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  modalButton: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalButtonDestructive: {
    fontSize: 16,
    color: '#FF3B30',
  },
  modalButtonCancel: {
    fontSize: 16,
    color: '#888',
    fontWeight: 'bold',
  },
});
