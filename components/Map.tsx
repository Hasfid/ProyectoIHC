/**
 * Map.tsx — Mapa satelital inmersivo para mobile (iOS/Android).
 *
 * Características:
 * - Vista satelital real (mapType="satellite")
 * - Animación de vuelo automática al cargar (animateToRegion)
 * - Marcadores circulares con imagen del avistamiento y borde blanco + glow verde
 * - Tarjeta flotante glassmorphism estilo HUD
 * - Polígono Guayana con borde neón esmeralda
 * - Límites de zoom para evitar cuadros grises
 *
 * @module components/Map
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, TouchableOpacity, Platform } from 'react-native';
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

/** Región inicial: vista general del país */
const INITIAL_REGION = {
  latitude: 4.5,
  longitude: -64.0,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

/** Región destino del flyTo: Estado Bolívar, ~zoom 14 */
const TARGET_REGION = {
  latitude: 5.8,
  longitude: -61.3,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

/** Duración de la animación de vuelo en ms */
const FLY_DURATION = 4000;

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
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Cargar registros de Supabase
    (async () => {
      try {
        const { data, error } = await supabase.from('registros').select('*');
        const validRecords = (data || []).filter(r => r.latitud != null && r.longitud != null);
        setRecords(offsetOverlappingRecords(validRecords));
      } catch (err) {
        console.error('Error fetching map records:', err);
      }
    })();

    // Animación de vuelo automática al cargar
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion(TARGET_REGION, FLY_DURATION);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleMarkerPress = (record: any) => {
    setSelected(record);
  };

  const closeCard = () => setSelected(null);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={{ width: SCREEN_W, height: SCREEN_H }}
        initialRegion={INITIAL_REGION}
        mapType="satellite"
        maxZoomLevel={18}
        minZoomLevel={3}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={closeCard}
      >
        {/* ── Máscara: oscurece el mundo excepto la Guayana ── */}
        <Polygon
          coordinates={WORLD_REGION}
          holes={[GUAYANA_REGION.slice().reverse()]}
          fillColor="rgba(0, 0, 0, 0.55)"
          strokeColor="rgba(0, 0, 0, 0)"
        />

        {/* ── Contorno neón esmeralda de la Guayana ── */}
        <Polygon
          coordinates={GUAYANA_REGION}
          fillColor="transparent"
          strokeColor="#34d399"
          strokeWidth={1.5}
          lineDashPattern={[6, 4]}
        />

        {/* ── Marcadores circulares con imagen ── */}
        {records.map((record) => {
          const lat = record._renderLat;
          const lng = record._renderLng;
          if (lat == null || lng == null) return null;

          return (
            <Marker
              key={record.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handleMarkerPress(record)}
            >
              <View style={s.pin}>
                {/* Anillo de glow verde */}
                <View style={s.pinGlow}>
                  {/* Círculo blanco con imagen */}
                  <View style={s.pinCircle}>
                    {record.media_url ? (
                      <Image
                        source={{ uri: record.media_url }}
                        style={s.pinImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="leaf" size={22} color="#34d399" />
                    )}
                  </View>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ── Tarjeta flotante glassmorphism HUD ── */}
      {selected && (
        <View style={s.cardWrapper} pointerEvents="box-none">
          <View style={s.card}>
            {/* Botón cerrar */}
            <TouchableOpacity style={s.cardClose} onPress={closeCard}>
              <Ionicons name="close" size={16} color="#34d399" />
            </TouchableOpacity>

            {/* Nombre */}
            <Text style={s.cardTitle} numberOfLines={1}>
              {(selected.nombre_tradicional || '—').toUpperCase()}
            </Text>
            {selected.nombre_cientifico ? (
              <Text style={s.cardSciName} numberOfLines={1}>
                {'> '}{selected.nombre_cientifico}
              </Text>
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
              <View style={[s.cardImageWrap, { backgroundColor: '#0a1a0e', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={40} color="#34d399" />
              </View>
            )}

            {/* Descripción */}
            {selected.descripcion ? (
              <Text style={s.cardDesc} numberOfLines={3}>{selected.descripcion}</Text>
            ) : null}

            {/* Meta: coordenadas + fecha */}
            <View style={s.cardMetaRow}>
              <View style={s.cardMetaBadge}>
                <Text style={s.cardMetaText}>
                  [{parseFloat(selected.latitud).toFixed(4)}, {parseFloat(selected.longitud).toFixed(4)}]
                </Text>
              </View>
              {selected.created_at ? (
                <View style={s.cardMetaBadge}>
                  <Text style={s.cardMetaText}>T · {formatDate(selected.created_at)}</Text>
                </View>
              ) : null}
            </View>

            {/* Tags */}
            {(selected.alimentacion || selected.habitat) ? (
              <View style={s.cardTagsRow}>
                {selected.alimentacion ? (
                  <View style={[s.cardTag, { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', borderWidth: 1 }]}>
                    <Text style={[s.cardTagText, { color: '#34d399' }]}>🍃 {selected.alimentacion}</Text>
                  </View>
                ) : null}
                {selected.habitat ? (
                  <View style={[s.cardTag, { backgroundColor: 'rgba(96,165,250,0.1)', borderColor: 'rgba(96,165,250,0.3)', borderWidth: 1 }]}>
                    <Text style={[s.cardTagText, { color: '#60a5fa' }]}>🏔️ {selected.habitat}</Text>
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
  // ── Marcador circular con imagen ──
  pin: {
    alignItems: 'center',
    width: 64,
    height: 64,
  },
  pinGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra exterior glow verde
    ...Platform.select({
      ios: {
        shadowColor: '#34d399',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  pinCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: '#000',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    // Sombra del propio círculo
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pinImage: {
    width: '100%',
    height: '100%',
  },

  // ── Tarjeta flotante HUD ──
  cardWrapper: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  card: {
    width: CARD_W,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    padding: 14,
    // Sombra profunda
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.7,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  cardClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
    paddingRight: 30,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  cardSciName: {
    color: '#34d399',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardImageWrap: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.2)',
  },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.5)',
  },
  cardBadgeText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  cardDesc: {
    color: '#9ca3af',
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 10,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  cardMetaBadge: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  cardMetaText: {
    color: '#6ee7b7',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  cardTagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(52,211,153,0.12)',
  },
  cardTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
