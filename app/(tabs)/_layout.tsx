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

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOTIFICATION_UPDATED_EVENT } from '../../lib/drafts';
import { changeLanguage, i18n, LANGUAGE_CHANGED_EVENT } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

const WebTopTabBar = ({ state, descriptors, navigation, unreadCount, unreadMessages }: any) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 768;
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(i18n.locale);
  const { theme, toggleTheme } = useTheme();

  const toggleLanguage = async () => {
    const newLang = currentLocale === 'es' ? 'en' : 'es';
    await changeLanguage(newLang);
    setCurrentLocale(newLang);
    setMenuOpen(false);
    if (Platform.OS === 'web') {
      window.location.reload();
    }
  };

  const toggleThemeAction = () => {
    toggleTheme();
    setMenuOpen(false);
  };

  const logout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <View style={[webStyles.container, { backgroundColor: theme.surface, borderBottomColor: theme.border }, isSmallScreen && { paddingHorizontal: 8 }]}>
      {/* IZQUIERDA: LOGO */}
      <View style={webStyles.leftContainer}>
        <Image
          source={require('../../assets/logo-ecos.png')}
          style={webStyles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* CENTRO: PESTAÑAS (Descubrir, Observatorio, Escáner, Registros) */}
      <View style={webStyles.centerContainer}>
        {state.routes.map((route: any, index: number) => {
          if (route.name === 'profile' || route.name === 'scanner') return null;

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
              style={[
                webStyles.tabItem,
                isFocused && webStyles.tabItemActive,
                isSmallScreen && { paddingHorizontal: 12 }
              ]}
            >
              {options.tabBarIcon && options.tabBarIcon({ color: isFocused ? theme.primary : theme.muted, focused: isFocused })}
              {!isSmallScreen && (
                <Text style={[webStyles.tabLabel, { color: isFocused ? theme.primary : theme.muted }, isFocused && webStyles.tabLabelActive]}>
                  {options.title || route.name}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* DERECHA: MENSAJERÍA, NOTIFICACIONES Y PERFIL */}
      <View style={[webStyles.rightContainer, isSmallScreen && { gap: 4, flex: 1.5 }]}>
        <TouchableOpacity
          style={[
            webStyles.iconBtn,
            { backgroundColor: theme.mode === 'dark' ? '#111924' : '#f0f2f5', borderColor: theme.border },
            isSmallScreen && { width: 32, height: 32 },
          ]}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications" size={isSmallScreen ? 18 : 22} color={theme.text} />
          {unreadCount > 0 && (
            <View style={[webStyles.badge, isSmallScreen && { top: -2, right: -2 }]}>
              <Text style={webStyles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            webStyles.iconBtn,
            { backgroundColor: theme.mode === 'dark' ? '#111924' : '#f0f2f5', borderColor: theme.border },
            isSmallScreen && { width: 32, height: 32 },
          ]}
          onPress={() => router.push('/chat')}
        >
          <Ionicons name="chatbubble" size={isSmallScreen ? 18 : 22} color={theme.text} />
          {unreadMessages > 0 && (
            <View style={[webStyles.badge, isSmallScreen && { top: -2, right: -2 }]}>
              <Text style={webStyles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              style={[
                webStyles.iconBtn,
                state.index === 4 && webStyles.iconBtnActive,
                { marginRight: 8, backgroundColor: theme.surface, borderColor: theme.border },
                isSmallScreen && { width: 32, height: 32 }
              ]}
              onPress={() => { setMenuOpen(false); navigation.navigate('profile'); }}
            >
              <Ionicons name={state.index === 4 ? "person" : "person-outline"} size={isSmallScreen ? 18 : 22} color={state.index === 4 ? theme.primary : theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuOpen(!menuOpen)}
              style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: theme.surface, borderRadius: 10, padding: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1 }}
            >
              <Ionicons name="chevron-down" size={14} color={theme.text} />
            </TouchableOpacity>
          </View>

          {menuOpen && (
            <View style={{
              position: 'absolute',
              top: 45,
              right: 0,
              backgroundColor: theme.surface,
              borderRadius: 8,
              padding: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 5,
              zIndex: 999,
              width: 180,
              borderWidth: 1,
              borderColor: theme.border,
            }}>
              <TouchableOpacity onPress={toggleLanguage} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="language-outline" size={18} color={theme.text} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14, color: theme.text }}>{currentLocale === 'es' ? i18n.t('profile.changeToEn') : i18n.t('profile.changeToEs')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleThemeAction} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={theme.mode === 'dark' ? "sunny-outline" : "moon-outline"} size={18} color={theme.text} style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 14, color: theme.text }}>{theme.mode === 'dark' ? i18n.t('profile.changeToLight') : i18n.t('profile.changeToDark')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={logout} style={{ padding: 12, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="log-out-outline" size={18} color="#d32f2f" style={{ marginRight: 10 }} />
                <Text style={{ color: '#d32f2f', fontSize: 14 }}>{i18n.t('profile.logout')}</Text>
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
  logoImage: {
    width: 120,
    height: 50,
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
  const { theme } = useTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [, setLangTick] = useState(0);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(LANGUAGE_CHANGED_EVENT, () => {
      setLangTick(t => t + 1);
    });
    return () => sub.remove();
  }, []);

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
            fetchUnreadMessages(uid);
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

      const notifCreatedListener = DeviceEventEmitter.addListener(NOTIFICATION_UPDATED_EVENT, () => {
        fetchUnread();
      });

      const msgChannel = supabase
        .channel(`unread-msgs-layout-${uid}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, () => {
          fetchUnreadMessages(uid);
        })
        .subscribe();

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
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.subtext,
        tabBarIndicatorStyle: { backgroundColor: theme.primary, top: 0, height: 3 },
        tabBarStyle: {
          backgroundColor: theme.surface,
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
          title: i18n.t('tabs.discover'),
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
          title: i18n.t('tabs.observatory'),
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "earth" : "earth-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="scanner"
        options={{
          title: i18n.t('tabs.scanner'),
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "scan-circle" : "scan-circle-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="records"
        options={{
          title: i18n.t('tabs.records'),
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => <Ionicons name={focused ? "library" : "library-outline"} size={24} color={color} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="profile"
        options={{
          title: i18n.t('tabs.profile'),
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