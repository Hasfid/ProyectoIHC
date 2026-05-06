/**
 * notifications.tsx — Pantalla de notificaciones del usuario.
 *
 * Muestra notificaciones de seguimiento, sincronización offline,
 * competencias y sistema. Soporta pull-to-refresh y marca como leído.
 *
 * @module app/notifications
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

/** Estructura de una notificación del sistema */
type Notificacion = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'seguidor' | 'sincronizacion' | 'sistema' | 'competencia';
  leido: boolean;
  created_at: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  /** Carga todas las notificaciones del usuario autenticado */
  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** Marca una notificación como leída (actualización optimista en UI) */
  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notificaciones')
        .update({ leido: true })
        .eq('id', id);
      
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, leido: true } : n)
      );
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  /** Retorna el nombre del ícono Ionicons según el tipo de notificación */
  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'seguidor': return 'people';
      case 'sincronizacion': return 'cloud-done';
      case 'competencia': return 'trophy';
      default: return 'notifications';
    }
  };

  /** Retorna el color del ícono según el tipo de notificación */
  const getIconColor = (tipo: string) => {
    switch (tipo) {
      case 'seguidor': return '#2196F3';
      case 'sincronizacion': return '#4CAF50';
      case 'competencia': return '#FFC107';
      default: return '#757575';
    }
  };

  const renderItem = ({ item }: { item: Notificacion }) => (
    <TouchableOpacity 
      style={[styles.notificationItem, !item.leido && styles.unreadItem]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getIconColor(item.tipo) + '20' }]}>
        <Ionicons name={getIcon(item.tipo)} size={24} color={getIconColor(item.tipo)} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !item.leido && styles.unreadText]}>{item.titulo}</Text>
        <Text style={styles.message}>{item.mensaje}</Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>
      {!item.leido && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerTitle: 'Notificaciones',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <Ionicons name="chevron-back" size={28} color="#004d40" />
            </TouchableOpacity>
          ),
          headerShadowVisible: false,
        }} 
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#004d40" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No tienes notificaciones aún.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  unreadItem: {
    backgroundColor: '#f9fbfb',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  message: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  time: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#004d40',
    marginLeft: 8,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
});
