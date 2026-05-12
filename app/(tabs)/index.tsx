/**
 * @module DiscoverScreen
 * Pantalla principal de "Descubrir".
 * Muestra el mapa interactivo de avistamientos y un acceso rápido al chat.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Map from '../../components/Map';
import WeatherWidget from '../../components/WeatherWidget';
import { supabase } from '../../lib/supabase';

export default function DiscoverScreen() {
  const router = useRouter();
  const [unreadMessages, setUnreadMessages] = useState(0);

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

  return (
    <View style={styles.container}>

      <Map />

      <WeatherWidget />

      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('/chat')}>
          <BlurView intensity={90} tint="light" style={styles.blurContainer}>
            <Ionicons name="chatbubbles" size={28} color="#004d40" style={styles.icon} />
          </BlurView>
        </TouchableOpacity>
        {unreadMessages > 0 && (
          <View style={styles.chatBadge}>
            <Text style={styles.chatBadgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
          </View>
        )}
      </View>
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
    borderRadius: 30,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
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
});
