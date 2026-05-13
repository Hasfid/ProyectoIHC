/**
 * WeatherWidget.tsx — Widget compacto de clima para el mapa.
 *
 * Usa la ubicación del dispositivo para mostrar clima local.
 * Chip minimalista: ícono + temp actual. Al tocar se expande
 * mostrando pronóstico de las próximas 4 horas (cada 1h).
 *
 * @module components/WeatherWidget
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import * as Location from 'expo-location';
import { fetchWeather, WeatherData } from '../lib/weather';

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [expanded, setExpanded] = useState(Platform.OS === 'web');
  const [loading, setLoading] = useState(true);
  const anim = useRef(new Animated.Value(Platform.OS === 'web' ? 1 : 0)).current;

  useEffect(() => {
    loadWeather();
    const interval = setInterval(loadWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadWeather = async () => {
    try {
      let lat = 8.3146; // Ciudad Guayana fallback
      let lon = -62.7118;
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        } catch (e) {
          console.warn('Could not get precise location, using fallback');
        }
      }
      
      const result = await fetchWeather(lat, lon);
      setData(result);
    } catch (err) {
      console.warn('WeatherWidget error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.chip}><Text style={s.miniText}>🌡️ ...</Text></View>
      </View>
    );
  }

  if (!data) return null;

  const { current, hourly, alert } = data;

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={s.chip}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.85}
      >
        {/* Fila compacta */}
        <View style={s.row}>
          <Text style={s.icon}>{current.icon}</Text>
          <Text style={s.temp}>{current.temperature}°</Text>
          <Text style={s.label} numberOfLines={1}>{current.label}</Text>
        </View>

        {/* Expandido: detalle + pronóstico */}
        <Animated.View style={{
          maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
          opacity: anim,
          overflow: 'hidden',
        }}>
          {/* Meta */}
          <View style={s.metaRow}>
            <Text style={s.meta}>💧 {current.humidity}%</Text>
            <Text style={s.meta}>💨 {current.windSpeed} km/h</Text>
          </View>

          {/* Alerta */}
          {alert && (
            <View style={s.alertRow}>
              <Text style={s.alertText}>{alert.icon} {alert.body}</Text>
            </View>
          )}

          {/* Pronóstico horario */}
          <View style={s.divider} />
          <View style={s.forecastRow}>
            {hourly.map((h, i) => (
              <View key={i} style={s.forecastItem}>
                <Text style={s.fTime}>{h.time}</Text>
                <Text style={s.fIcon}>{h.icon}</Text>
                <Text style={s.fTemp}>{h.temperature}°</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 40 : 40,
    left: Platform.OS === 'web' ? 16 : 12,
    zIndex: 20,
  },
  chip: {
    backgroundColor: 'rgba(10, 15, 12, 0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 200,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 20 },
  temp: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  label: { color: '#aaa', fontSize: 11, flex: 1 },

  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  meta: { color: '#777', fontSize: 10 },

  alertRow: {
    marginTop: 6,
    backgroundColor: 'rgba(255,152,0,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  alertText: { color: '#ffb74d', fontSize: 10, lineHeight: 14 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 8,
  },

  forecastRow: { flexDirection: 'row', justifyContent: 'space-between' },
  forecastItem: { alignItems: 'center', gap: 2 },
  fTime: { color: '#666', fontSize: 9 },
  fIcon: { fontSize: 16 },
  fTemp: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  miniText: { color: '#666', fontSize: 12 },
});
