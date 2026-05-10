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
import { supabase } from '../../lib/supabase';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

/** Componente principal de navegación por pestañas */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let channel: any;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const fetchUnread = async () => {
        const { data } = await supabase
          .from('notificaciones')
          .select('id, tipo, mensaje')
          .eq('usuario_id', uid)
          .or('leido.eq.false,leido.is.null');
        
        if (data) {
          // Filtrar notificaciones duplicadas de seguimiento generadas por trigger viejo
          const valid = data.filter(n => !(n.tipo === 'seguidor' && !n.mensaje?.includes('||')));
          setUnreadCount(valid.length);
        }
      };
      
      fetchUnread();

      channel = supabase
        .channel(`unread-notifs-layout-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${uid}` }, () => {
          fetchUnread();
        })
        .subscribe();
        
      const eventListener = DeviceEventEmitter.addListener('NOTIFICATIONS_READ', () => {
        fetchUnread();
      });

      return () => {
        if (channel) supabase.removeChannel(channel);
        eventListener.remove();
      };
    };
    
    const cleanup = init();

    return () => {
      cleanup.then(clean => clean && clean());
    };
  }, []);

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
        swipeEnabled: true,
        lazy: true,
      }}
    >
      <MaterialTopTabs.Screen
        name="index"
        options={{
          title: 'Descubrir',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />,
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
