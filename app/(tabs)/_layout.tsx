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
import { i18n, changeLanguage } from '../../lib/i18n';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

import { useRouter } from 'expo-router';
// Import TouchableOpacity just in case it's not
import { TouchableOpacity } from 'react-native';

const WebTopTabBar = ({ state, descriptors, navigation, unreadCount, unreadMessages }: any) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);

  useEffect(() => {
    if (Platform.OS === 'web') {
      AsyncStorage.getItem('theme').then((t) => setIsDarkMode(t === 'dark'));
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (Platform.OS === 'web') {
      document.body.style.backgroundColor = nextDark ? '#000' : '#fff';
      AsyncStorage.setItem('theme', nextDark ? 'dark' : 'light').then(() => {
        window.location.reload();
      });
    } else {
      AsyncStorage.setItem('theme', nextDark ? 'dark' : 'light');
    }
    setMenuOpen(false);
  };

  const toggleLanguage = async () => {
    const newLang = currentLocale === 'es' ? 'en' : 'es';
    await changeLanguage(newLang);
    setCurrentLocale(newLang);
    setMenuOpen(false);
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  const logout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <View style={webStyles.container}>
      {/* IZQUIERDA: LOGO */}
      <View style={webStyles.leftContainer}>
        <Ionicons name="leaf" size={28} color="#2e7d32" />
        <Text style={webStyles.logoText}>Ecos</Text>
      </View>

      {/* CENTRO: PESTAÑAS (Descubrir, Observatorio, Escáner, Registros) */}
      <View style={webStyles.centerContainer}>
        {state.routes.map((route: any, index: number) => {
          if (route.name === 'profile') return null; // El perfil va a la derecha

          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[webStyles.tabItem, isFocused && webStyles.tabItemActive]}
            >
              {options.tabBarIcon && options.tabBarIcon({ color: isFocused ? '#2e7d32' : '#666', focused: isFocused })}
              <Text style={[webStyles.tabLabel, isFocused && webStyles.tabLabelActive]}>
                {options.title || route.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DERECHA: MENSAJERÍA, NOTIFICACIONES Y PERFIL */}
      <View style={webStyles.rightContainer}>
        <TouchableOpacity style={webStyles.iconBtn} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={22} color="#333" />
          {unreadCount > 0 && (
            <View style={webStyles.badge}>
              <Text style={webStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={webStyles.iconBtn} onPress={() => router.push('/chat')}>
          <Ionicons name="chatbubble" size={22} color="#333" />
          {unreadMessages > 0 && (
            <View style={webStyles.badge}>
              <Text style={webStyles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity 
              style={[webStyles.iconBtn, state.index === 4 && webStyles.iconBtnActive, { marginRight: 8 }]} 
              onPress={() => { setMenuOpen(false); navigation.navigate('profile'); }}
            >
              <Ionicons name={state.index === 4 ? "person" : "person-outline"} size={22} color={state.index === 4 ? "#2e7d32" : "#333"} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setMenuOpen(!menuOpen)} 
              style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 10, padding: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1 }}
            >
              <Ionicons name="chevron-down" size={14} color="#333" />
            </TouchableOpacity>
          </View>
          
          {menuOpen && (
            <View style={{
              position: 'absolute',
              top: 45,
              right: 0,
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 5,
              zIndex: 999,
              width: 180,
              borderWidth: 1,
              borderColor: '#eee'
            }}>
              <TouchableOpacity onPress={toggleLanguage} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="language-outline" size={18} color="#333" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14 }}>{currentLocale === 'es' ? 'Cambiar a Inglés' : 'Cambiar a Español'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleTheme} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={18} color="#333" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14 }}>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="log-out-outline" size={18} color="#d32f2f" style={{ marginRight: 10 }} />
                <Text style={{ color: '#d32f2f', fontSize: 14 }}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const webStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    // Sombra sutil estilo Facebook
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 100,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginLeft: 8,
  },
  centerContainer: {
    flexDirection: 'row',
    flex: 2,
    justifyContent: 'center',
    height: '100%',
  },
  tabItem: {
    paddingHorizontal: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    height: '100%',
  },
  tabItemActive: {
    borderBottomColor: '#2e7d32',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    color: '#666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iconBtnActive: {
    backgroundColor: '#e8f5e9',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

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
      tabBarPosition={Platform.OS === 'web' ? 'top' : 'bottom'}
      tabBar={Platform.OS === 'web' ? (props: any) => <WebTopTabBar {...props} unreadCount={unreadCount} unreadMessages={unreadMessages} /> : undefined}
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
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: { fontSize: Platform.OS === 'ios' ? 8 : 7.5, marginTop: 4, textTransform: 'none', fontWeight: '500' },
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
              {unreadCount > 0 && Platform.OS !== 'web' && (
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
