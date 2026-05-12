/**
 * @module TabLayout
 * Configuración de la navegación por pestañas (Tabs) ubicada en la parte inferior.
 * Utiliza un `MaterialTopTabNavigator` posicionado abajo para permitir swipe entre pantallas.
 * 
 * Pestañas:
 * - Descubrir (index): Mapa interactivo.
 * - Observatorio: Feed social y streaming en vivo.
 * - Escáner: Identificación de especies por cámara.
 * - Registros: Historial de avistamientos.
 * - Perfil: Gestión de usuario y borradores offline.
 */

import React, { useState, useEffect } from 'react';
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { NOTIFICATION_UPDATED_EVENT } from '../../lib/drafts';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

/** Componente principal de navegación por pestañas */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let channel: any;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const fetchUnread = async () => {
        try {
          const { data, error } = await supabase
            .from('notificaciones')
            .select('id, tipo, mensaje')
            .eq('usuario_id', uid)
            .or('leido.eq.false,leido.is.null');
          
          if (error) {
            console.error('Error fetching unread (layout):', error.message);
            return;
          }

          if (data) {
            // Fetch unread messages count
            fetchUnreadMessages(uid);
            // Filtrar notificaciones duplicadas de seguimiento generadas por trigger viejo
            const valid = data.filter(n => !(n.tipo === 'seguidor' && !n.mensaje?.includes('||')));
            setUnreadCount(valid.length);
          }
        } catch (err) {
          console.error('fetchUnread exception (layout):', err);
        }
      };
      
      fetchUnread();

      channel = supabase
        .channel(`unread-notifs-layout-${uid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${uid}` }, () => {
          fetchUnread();
        })
        .subscribe();
        
      const eventListener = DeviceEventEmitter.addListener('NOTIFICATIONS_READ', () => {
        fetchUnread();
      });

      // Escuchar cuando se crea una notificación desde el sync de drafts
      const notifCreatedListener = DeviceEventEmitter.addListener(NOTIFICATION_UPDATED_EVENT, () => {
        fetchUnread();
      });

      // Suscripción Realtime para mensajes
      const msgChannel = supabase
        .channel(`unread-msgs-layout-${uid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, () => {
          fetchUnreadMessages(uid);
        })
        .subscribe();

      // Polling cada 10s como fallback por si Realtime no conecta
      const pollInterval = setInterval(() => {
        fetchUnread();
        fetchUnreadMessages(uid);
      }, 10_000);

      return () => {
        if (channel) supabase.removeChannel(channel);
        supabase.removeChannel(msgChannel);
        eventListener.remove();
        notifCreatedListener.remove();
        clearInterval(pollInterval);
      };
    };
    
    const cleanup = init();

    return () => {
      cleanup.then(clean => clean && clean());
    };
  }, []);

  /** Calcula la cantidad total de mensajes no leídos en todas las conversaciones */
  const fetchUnreadMessages = async (uid: string) => {
    try {
      const { data: messages, error } = await supabase
        .from('mensajes')
        .select('id, remitente_id, destinatario_id, created_at')
        .eq('destinatario_id', uid)
        .order('created_at', { ascending: false });

      if (error || !messages) return;

      const lastReadRaw = await AsyncStorage.getItem(`last_read_${uid}`);
      const lastRead = lastReadRaw ? JSON.parse(lastReadRaw) : {};

      let total = 0;
      messages.forEach(msg => {
        const senderId = msg.remitente_id;
        const lastReadTime = lastRead[senderId];
        if (!lastReadTime || new Date(msg.created_at) > new Date(lastReadTime)) {
          total++;
        }
      });

      setUnreadMessages(total);
    } catch (err) {
      console.error('fetchUnreadMessages exception (layout):', err);
    }
  };

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        tabBarActiveTintColor: '#004d40',
        tabBarInactiveTintColor: '#888',
        tabBarIndicatorStyle: { backgroundColor: '#004d40', top: 0, height: 3 },
        tabBarStyle: {
          backgroundColor: '#fff',
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 15,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 75 + insets.bottom : 80,
        },
        tabBarShowIcon: true,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, marginTop: 4, textTransform: 'none', fontWeight: '500' },
        swipeEnabled: Platform.OS !== 'web',
        lazy: true,
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Descubrir',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <View>
              <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
              {unreadMessages > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#1565c0', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <MaterialTopTabs.Screen
        name="observatory"
        options={{
          title: 'Observatorio',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "earth" : "earth-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="scanner"
        options={{
          title: 'Escáner',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "scan-circle" : "scan-circle-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="records"
        options={{
          title: 'Registros',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "library" : "library-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <View>
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
              {unreadCount > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -6, backgroundColor: '#e53935', borderRadius: 10, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
    </MaterialTopTabs>
  );
}
