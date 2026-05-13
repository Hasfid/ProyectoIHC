/**
 * @module DiscoverScreen
 * Pantalla principal de "Descubrir".
 * Muestra el mapa interactivo de avistamientos y un acceso rápido al chat.
 * En web, integra el escáner como panel inferior del mapa.
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Map from '../../components/Map';
import WeatherWidget from '../../components/WeatherWidget';
import { i18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';

export default function DiscoverScreen() {
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fetchUnreadMessages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;

      const { data: messages, error } = await supabase
        .from('mensajes')
        .select('id, remitente_id, created_at')
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
      console.error('fetchUnreadMessages (discover):', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUnreadMessages();
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(fetchUnreadMessages, 10_000);
    return () => clearInterval(interval);
  }, []);

  const { theme } = useTheme();

  /** Abre el selector de imagen y navega a crear registro (web scanner) */
  const handleWebScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setScannerOpen(false);
    router.push({
      pathname: '/create-record',
      params: {
        mediaUrl: asset.uri,
        tipoMedia: (asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen',
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <Map />

      <WeatherWidget />

      {/* Botón de ayuda - Web: esquina superior derecha */}
      {Platform.OS === 'web' && (
        <TouchableOpacity style={[styles.helpButtonWeb, { backgroundColor: theme.overlay }]} onPress={() => router.push('/help')}>
          <Ionicons name="help-circle" size={24} color={theme.primary} />
        </TouchableOpacity>
      )}

      {/* Web: Botón de carga de registro integrado en el mapa */}
      {Platform.OS === 'web' && (
        <View style={styles.scannerButtonContainer}>
          {!scannerOpen ? (
            <TouchableOpacity
              style={[styles.scannerButton, { backgroundColor: theme.primary }]}
              onPress={() => setScannerOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={theme.primaryText} />
              <Text style={[styles.scannerButtonText, { color: theme.primaryText }]}>
                {i18n.t('scanner.uploadRecord')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.scannerPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.scannerPanelCaption, { color: theme.subtext }]}>
                {i18n.t('scanner.scanCaption')}
              </Text>
              <TouchableOpacity
                style={[styles.scannerUploadBtn, { backgroundColor: theme.primary }]}
                onPress={handleWebScan}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload" size={20} color={theme.primaryText} />
                <Text style={[styles.scannerUploadText, { color: theme.primaryText }]}>
                  {i18n.t('scanner.chooseGallery')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setScannerOpen(false)}>
                <Text style={[styles.scannerCancelText, { color: theme.muted }]}>
                  {i18n.t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {Platform.OS !== 'web' && (
        <View style={styles.floatingButtonContainer}>
          {/* Botón de ayuda arriba del chat */}
          <TouchableOpacity style={styles.helpButton} onPress={() => router.push('/help')}>
            <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.blurContainer, { backgroundColor: theme.overlay }]}>
              <Ionicons name="help-circle" size={28} color={theme.primary} />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('/chat')}>
            <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.blurContainer, { backgroundColor: theme.overlay }]}>
              <Ionicons name="chatbubbles" size={28} color={theme.primary} style={styles.icon} />
            </BlurView>
          </TouchableOpacity>
          {unreadMessages > 0 && (
            <View style={[styles.chatBadge, { borderColor: theme.background }]}>
              <Text style={styles.chatBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
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
  backButton: {
    marginLeft: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    alignItems: 'center',
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  icon: {
    transform: [{ rotate: '-15deg' }, { translateX: -2 }, { translateY: 2 }],
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  helpButtonWeb: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
  helpButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 12,
  },
  // Scanner web styles
  scannerButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  scannerButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scannerPanel: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 340,
  },
  scannerPanelCaption: {
    fontSize: 13,
    textAlign: 'center',
  },
  scannerUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  scannerUploadText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scannerCancelText: {
    fontSize: 13,
    marginTop: 2,
  },
});
