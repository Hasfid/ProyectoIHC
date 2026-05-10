/**
 * Map.tsx — Mapa nativo de biodiversidad para mobile (iOS/Android).
 *
 * En Android (Expo Go), el Callout nativo renderiza como bitmap estático,
 * por lo que usamos una tarjeta flotante posicionada sobre el mapa.
 * Los marcadores usan íconos de categoría en vez de fotos remotas
 * para evitar problemas de renderizado en Expo Go.
 *
 * @module components/Map
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, TouchableOpacity, ScrollView, Platform } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── Geometría ────────────────────────────────────────────────────────────────

import { GUAYANA_POLYGON } from '../lib/geofence';

const GUAYANA_REGION = GUAYANA_POLYGON;

const WORLD_REGION = [
  { latitude: 90, longitude: -180 },
  { latitude: -90, longitude: -180 },
  { latitude: -90, longitude: 180 },
  { latitude: 90, longitude: 180 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const getCategoryInfo = (item: any) => {
  const n = (item.nombre_tradicional || '').toLowerCase();
  if (n.includes('jaguar') || n.includes('tigre') || n.includes('chigüire') || n.includes('capibara') || n.includes('mono') || n.includes('oso') || n.includes('tonina') || n.includes('delfín'))
    return { icon: 'paw' as const, color: '#ff9100', label: '🐾 Mamífero' };
  if (n.includes('guacamaya') || n.includes('loro') || n.includes('ave') || n.includes('águila') || n.includes('tucán'))
    return { icon: 'paw' as const, color: '#00b0ff', label: '🐦 Ave' };
  if (n.includes('rana') || n.includes('sapo') || n.includes('serpiente') || n.includes('iguana') || n.includes('caimán'))
    return { icon: 'bug-outline' as const, color: '#ff5252', label: '🦎 Reptil/Anfibio' };
  if (n.includes('orquídea') || n.includes('flor') || n.includes('árbol') || n.includes('planta') || n.includes('helecho'))
    return { icon: 'leaf' as const, color: '#00e676', label: '🌿 Flora' };
  return { icon: 'leaf' as const, color: '#00e676', label: '🌿 Especie' };
};

const formatDate = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

/**
 * Desplaza ligeramente los pines que comparten exactamente la misma coordenada
 * para que no queden 100% ocultos uno detrás de otro.
 */
const offsetOverlappingRecords = (records: any[]) => {
  const seen: Record<string, number> = {};
  return records.map(record => {
    let lat = parseFloat(record.latitud);
    let lng = parseFloat(record.longitud);
    if (isNaN(lat) || isNaN(lng)) return record;
    
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen[key] !== undefined) {
      seen[key]++;
      // ~20-30 metros de separación por cada registro repetido en patrón espiral
      const offset = seen[key] * 0.0002; 
      const angle = seen[key] * (Math.PI / 3); // 60 grados
      lat += Math.cos(angle) * offset;
      lng += Math.sin(angle) * offset;
    } else {
      seen[key] = 0;
    }
    
    return { ...record, _renderLat: lat, _renderLng: lng };
  });
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function Map({ onRegionChangeComplete }: { onRegionChangeComplete?: (region: any) => void }) {
  const [records, setRecords] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('registros').select('*');
        const validRecords = (data || []).filter(r => r.latitud != null && r.longitud != null);
        setRecords(offsetOverlappingRecords(validRecords));
      } catch (err) {
        console.error('Error fetching map records:', err);
      }
    })();
  }, []);

  const handleMarkerPress = (record: any) => {
    setSelected(record);
  };

  const closeCard = () => setSelected(null);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={{ width: SCREEN_W, height: SCREEN_H }}
        initialRegion={{ latitude: 4.5, longitude: -64.0, latitudeDelta: 40, longitudeDelta: 40 }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={closeCard}
      >
        <Polygon
          coordinates={WORLD_REGION}
          holes={[GUAYANA_REGION.slice().reverse()]}
          fillColor="rgba(0, 0, 0, 0.7)"
          strokeColor="rgba(0, 0, 0, 0)"
        />
        <Polygon
          coordinates={GUAYANA_REGION}
          fillColor="transparent"
          strokeColor="#00e676"
          strokeWidth={2}
        />

        {records.map((record) => {
          const lat = record._renderLat;
          const lng = record._renderLng;
          if (lat == null || lng == null) return null;
          const cat = getCategoryInfo(record);

          return (
            <Marker
              key={record.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handleMarkerPress(record)}
            >
              <View style={s.pin}>
                <View style={[s.pinCircle, { borderColor: cat.color }]}>
                  <Ionicons name={cat.icon} size={18} color={cat.color} />
                </View>
                <View style={[s.pinArrow, { borderTopColor: cat.color }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Tarjeta flotante (reemplaza Callout nativo) ── */}
      {selected && (
        <View style={s.cardWrapper} pointerEvents="box-none">
          <View style={s.card}>
            {/* Botón cerrar */}
            <TouchableOpacity style={s.cardClose} onPress={closeCard}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Nombre */}
            <Text style={s.cardTitle} numberOfLines={1}>{selected.nombre_tradicional}</Text>
            {selected.nombre_cientifico ? (
              <Text style={s.cardSciName} numberOfLines={1}>{selected.nombre_cientifico}</Text>
            ) : null}

            {/* Imagen / Media */}
            {selected.media_url ? (
              <View style={s.cardImageWrap}>
                <Image source={{ uri: selected.media_url }} style={s.cardImage} resizeMode="cover" />
                <View style={s.cardBadge}>
                  <Text style={s.cardBadgeText}>{getCategoryInfo(selected).label}</Text>
                </View>
              </View>
            ) : (
              <View style={[s.cardImageWrap, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={40} color="#555" />
              </View>
            )}

            {/* Descripción */}
            {selected.descripcion ? (
              <Text style={s.cardDesc} numberOfLines={3}>{selected.descripcion}</Text>
            ) : null}

            {/* Meta: coordenadas + fecha */}
            <View style={s.cardMetaRow}>
              <View style={s.cardMetaBadge}>
                <Text style={s.cardMetaText}>📍 {parseFloat(selected.latitud).toFixed(2)}, {parseFloat(selected.longitud).toFixed(2)}</Text>
              </View>
              {selected.created_at ? (
                <View style={s.cardMetaBadge}>
                  <Text style={s.cardMetaText}>📅 {formatDate(selected.created_at)}</Text>
                </View>
              ) : null}
            </View>

            {/* Tags */}
            {(selected.alimentacion || selected.habitat) ? (
              <View style={s.cardTagsRow}>
                {selected.alimentacion ? (
                  <View style={[s.cardTag, { backgroundColor: 'rgba(164,255,68,0.12)' }]}>
                    <Text style={[s.cardTagText, { color: '#a4ff44' }]}>🍃 {selected.alimentacion}</Text>
                  </View>
                ) : null}
                {selected.habitat ? (
                  <View style={[s.cardTag, { backgroundColor: 'rgba(0,176,255,0.12)' }]}>
                    <Text style={[s.cardTagText, { color: '#00b0ff' }]}>🏔️ {selected.habitat}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const CARD_W = Math.min(SCREEN_W - 40, 320);

const s = StyleSheet.create({
  // Pin del marcador
  pin: { alignItems: 'center', width: 44, height: 56 },
  pinCircle: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 3, backgroundColor: '#111',
    justifyContent: 'center', alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
  },
  pinArrow: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    backgroundColor: 'transparent', marginTop: -2,
  },

  // Tarjeta flotante
  cardWrapper: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    backgroundColor: 'rgba(10, 20, 16, 0.95)',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.3)',
    padding: 14,
    elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  cardClose: {
    position: 'absolute', top: 10, right: 10, zIndex: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardTitle: {
    color: '#fff', fontSize: 18, fontWeight: 'bold',
    marginBottom: 2, paddingRight: 30,
  },
  cardSciName: {
    color: '#a4ff44', fontSize: 12, fontStyle: 'italic', marginBottom: 10,
  },
  cardImageWrap: {
    width: '100%', height: 140, borderRadius: 12,
    overflow: 'hidden', marginBottom: 10, position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  cardBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  cardDesc: {
    color: '#aaa', fontSize: 12, lineHeight: 18, marginBottom: 10,
  },
  cardMetaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  cardMetaBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  cardMetaText: { color: '#888', fontSize: 10 },
  cardTagsRow: {
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cardTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cardTagText: { fontSize: 10, fontWeight: 'bold' },
});
