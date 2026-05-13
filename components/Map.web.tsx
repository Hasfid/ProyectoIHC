/**
 * Map.web.tsx — Mapa satelital inmersivo para la versión web de Ecos.
 *
 * Características:
 * - Capa satelital Esri World Imagery (selva real de la Guayana)
 * - Animación flyTo al cargar: zoom desde vista general hasta coordenadas focales
 * - Marcadores circulares con borde blanco y sombra estilo Tailwind (divIcon)
 * - Polígono delimitador de la Guayana con borde neón y relleno transparente
 * - Popups glassmorphism estilo HUD
 * - Toda la lógica de datos se mantiene intacta (Supabase → registros)
 *
 * @module components/Map.web
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

// ── Geometría ────────────────────────────────────────────────────────────────

import { GUAYANA_POLYGON as GF_POLYGON } from '../lib/geofence';

/** Polígono de la Guayana venezolana transformado para Leaflet [lat, lng] */
const GUAYANA_POLYGON: [number, number][] = GF_POLYGON.map(p => [p.latitude, p.longitude]);

/** Polígono que cubre todo el mundo (máscara de oscurecimiento) */
const WORLD_BOUNDS: [number, number][] = [
  [90, -180],
  [-90, -180],
  [-90, 180],
  [90, 180],
];

/** Zoom de inicio (vista general del mapa) */
const MAP_ZOOM_START = 5;

/** Centro geográfico inicial (vista general) */
const MAP_CENTER_START: [number, number] = [5.0, -63.5];

/** Coordenadas de destino del flyTo de entrada */
const FLY_TO_TARGET: [number, number] = [5.8, -61.3];

/** Zoom de destino del flyTo de entrada */
const FLY_TO_ZOOM = 14;

/** Duración de la animación flyTo en segundos */
const FLY_TO_DURATION = 4;

// ── Inyección de CSS ─────────────────────────────────────────────────────────

const LEAFLET_CSS_ID = 'leaflet-css';

if (typeof document !== 'undefined' && !document.getElementById(LEAFLET_CSS_ID)) {
  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.textContent = `
    /* ── Base Leaflet ── */
    .leaflet-container {
      width: 100% !important;
      height: 100% !important;
      background: #000 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .leaflet-tile-pane img { max-width: none !important; }
    .custom-pin-icon { background: none !important; border: none !important; }

    /* ── Controles: estilo HUD flotante ── */
    .leaflet-control-zoom {
      border: none !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      backdrop-filter: blur(8px);
    }
    .leaflet-control-zoom a {
      background: rgba(0,0,0,0.5) !important;
      color: #fff !important;
      border: 1px solid rgba(52,211,153,0.3) !important;
      font-size: 18px !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      backdrop-filter: blur(8px);
    }
    .leaflet-control-zoom a:hover {
      background: rgba(52,211,153,0.25) !important;
      color: #34d399 !important;
    }
    .leaflet-control-attribution {
      background: rgba(0,0,0,0.5) !important;
      color: rgba(255,255,255,0.5) !important;
      backdrop-filter: blur(8px);
      border-radius: 6px 0 0 0 !important;
      font-size: 9px !important;
      padding: 2px 6px !important;
    }
    .leaflet-control-attribution a { color: rgba(52,211,153,0.8) !important; }

    /* ── Marcadores: hover y transición ── */
    .eco-pin-wrapper {
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;
    }
    .eco-pin-wrapper:hover {
      transform: scale(1.12) translateY(-4px);
    }

    /* ── Popup: glassmorphism HUD ── */
    .ecos-popup .leaflet-popup-content-wrapper {
      background: rgba(5, 10, 8, 0.85) !important;
      backdrop-filter: blur(16px) !important;
      -webkit-backdrop-filter: blur(16px) !important;
      border: 1px solid rgba(52, 211, 153, 0.35) !important;
      border-radius: 12px !important;
      padding: 0 !important;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(52,211,153,0.1) !important;
      overflow: hidden !important;
      min-width: 240px !important;
    }
    .ecos-popup .leaflet-popup-content {
      margin: 0 !important;
      width: 240px !important;
    }
    .ecos-popup .leaflet-popup-tip-container { display: none !important; }
    .ecos-popup .leaflet-popup-close-button {
      color: #34d399 !important;
      font-size: 18px !important;
      top: 10px !important;
      right: 10px !important;
      z-index: 10 !important;
      background: rgba(0,0,0,0.6) !important;
      border-radius: 50% !important;
      width: 24px !important;
      height: 24px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      line-height: 24px !important;
      padding: 0 !important;
      border: 1px solid rgba(52,211,153,0.3) !important;
    }
    .ecos-popup .leaflet-popup-close-button:hover {
      background: rgba(52,211,153,0.3) !important;
      color: #fff !important;
    }
    .leaflet-popup {
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve una etiqueta de categoría en mayúsculas */
const getCategoryLabel = (item: any): string => {
  const n = (item.nombre_tradicional || '').toLowerCase();
  if (n.includes('jaguar') || n.includes('tigre') || n.includes('mono') || n.includes('chigüire')) return '🐾 MAMÍFERO';
  if (n.includes('guacamaya') || n.includes('ave') || n.includes('loro') || n.includes('tucán')) return '🐦 AVE';
  if (n.includes('rana') || n.includes('sapo') || n.includes('serpiente') || n.includes('iguana')) return '🦎 REPTIL';
  if (n.includes('orquídea') || n.includes('flor') || n.includes('planta') || n.includes('árbol')) return '🌿 FLORA';
  return '🌿 ESPECIE';
};

/** Formatea fecha ISO a legible */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return ''; }
};

/**
 * Desplaza pines que comparten exactamente la misma coordenada en espiral,
 * para que ninguno quede completamente oculto detrás de otro.
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
      const offset = seen[key] * 0.0002;
      const angle = seen[key] * (Math.PI / 3);
      lat += Math.cos(angle) * offset;
      lng += Math.sin(angle) * offset;
    } else {
      seen[key] = 0;
    }
    return { ...record, _renderLat: lat, _renderLng: lng };
  });
};

// ── Componente ───────────────────────────────────────────────────────────────

export default function MapWeb({ onRegionChangeComplete }: { onRegionChangeComplete?: (region: any) => void }) {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [cssReady, setCssReady] = useState(false);

  useEffect(() => {
    // Esperar a que el CSS de Leaflet esté cargado para evitar FOUC
    const checkCss = () => {
      const link = document.getElementById(LEAFLET_CSS_ID) as HTMLLinkElement;
      if (link?.sheet) {
        setCssReady(true);
      } else {
        setTimeout(checkCss, 100);
      }
    };
    checkCss();

    // Carga asíncrona de react-leaflet + leaflet
    Promise.all([
      import('react-leaflet'),
      import('leaflet'),
    ]).then(([reactLeaflet, L]) => {
      const { MapContainer, TileLayer, Marker, Popup, Polygon, ZoomControl, useMap, useMapEvents } = reactLeaflet;
      setMapComponents({
        MapContainer, TileLayer, Marker, Popup, Polygon, ZoomControl,
        useMap, useMapEvents,
        L: L.default || L,
      });
    }).catch(err => console.error('Error loading Leaflet:', err));

    fetchRecords();
  }, []);

  /** Trae todos los registros con coordenadas válidas desde Supabase */
  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase.from('registros').select('*');
      if (error) throw error;
      const validRecords = (data || []).filter(r => r.latitud != null && r.longitud != null);
      setRecords(offsetOverlappingRecords(validRecords));
    } catch (err) {
      console.error('Error fetching map records (web):', err);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!MapComponents || !cssReady) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingOverlay}>
          {/* Pantalla de carga minimalista */}
        </View>
      </View>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, Polygon, ZoomControl, useMap, useMapEvents, L } = MapComponents;

  // ── Sub-componentes internos ───────────────────────────────────────────────

  /** Animación de entrada: flyTo desde zoom general hasta el punto focal */
  const IntroFlyTo = () => {
    const map = useMap();
    useEffect(() => {
      // Pequeño delay para que el mapa termine de montarse
      const timer = setTimeout(() => {
        map.flyTo(FLY_TO_TARGET, FLY_TO_ZOOM, {
          animate: true,
          duration: FLY_TO_DURATION,
        });
      }, 800);
      return () => clearTimeout(timer);
    }, [map]);
    return null;
  };

  /** Listener de movimiento para el callback externo */
  const MapEventsComponent = () => {
    useMapEvents({
      moveend: (e: any) => {
        if (onRegionChangeComplete) {
          const center = e.target.getCenter();
          onRegionChangeComplete({ latitude: center.lat, longitude: center.lng });
        }
      },
    });
    return null;
  };

  /**
   * Crea un L.divIcon inmersivo con clases de Tailwind:
   * - Círculo rounded-full con borde blanco grueso (border-4 border-white)
   * - Sombra pronunciada (shadow-2xl) para resaltar sobre la selva
   * - Imagen de la especie dentro del círculo
   * - Etiqueta del nombre debajo con efecto cristal
   */
  const createCustomIcon = (imageUrl: string, name: string) => {
    const displayName = (name || 'Especie').toUpperCase();
    const fallbackBg = !imageUrl ? 'background:#1a2e1a;' : '';

    return L.divIcon({
      className: 'custom-pin-icon',
      html: `
        <div class="eco-pin-wrapper" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        ">
          <!-- Círculo principal -->
          <div style="
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: 4px solid white;
            overflow: hidden;
            ${fallbackBg}
            background-color: ${!imageUrl ? '#1a2e1a' : '#000'};
            box-shadow:
              0 20px 60px rgba(0,0,0,0.7),
              0 0 0 2px rgba(52,211,153,0.4),
              0 0 20px rgba(52,211,153,0.2);
          ">
            ${imageUrl
              ? `<img
                  src="${imageUrl}"
                  style="width:100%;height:100%;object-fit:cover;display:block;"
                  onerror="this.parentElement.style.background='#1a2e1a'"
                />`
              : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🌿</div>`
            }
          </div>

          <!-- Etiqueta glassmorphism -->
          <div style="
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.2);
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 9px;
            font-weight: 700;
            color: white;
            letter-spacing: 1.5px;
            font-family: ui-monospace, monospace;
            white-space: nowrap;
            max-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          ">
            ${displayName}
          </div>
        </div>
      `,
      iconSize: [64, 100],
      iconAnchor: [32, 50],
      popupAnchor: [0, -54],
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      <MapContainer
        center={MAP_CENTER_START}
        zoom={MAP_ZOOM_START}
        maxZoom={18}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />

        {/* Animación de entrada flyTo */}
        <IntroFlyTo />

        {/* Listener de eventos */}
        <MapEventsComponent />

        {/* ── Capa Satelital Esri World Imagery ── */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          maxNativeZoom={18}
          maxZoom={18}
        />

        {/* ── Máscara: oscurece el resto del mundo ── */}
        <Polygon
          positions={[WORLD_BOUNDS, GUAYANA_POLYGON]}
          pathOptions={{
            fillColor: '#000000',
            fillOpacity: 0.55,
            stroke: false,
          }}
        />

        {/* ── Contorno neón de la Guayana ── */}
        <Polygon
          positions={GUAYANA_POLYGON}
          pathOptions={{
            fillColor: 'transparent',
            fillOpacity: 0,
            color: '#34d399',      /* emerald-400 */
            weight: 1.5,
            opacity: 0.8,
            dashArray: '6, 4',    /* línea punteada sutil */
          }}
        />

        {/* ── Marcadores de registros (datos de Supabase) ── */}
        {records.map((record: any) => {
          const lat = record._renderLat;
          const lng = record._renderLng;
          if (lat == null || lng == null) return null;

          return (
            <Marker
              key={record.id}
              position={[lat, lng]}
              icon={createCustomIcon(record.media_url, record.nombre_tradicional)}
            >
              <Popup className="ecos-popup" maxWidth={260} minWidth={240}>
                <div style={{ margin: 0, padding: 0 }}>

                  {/* ── Imagen de cabecera ── */}
                  <div style={{ width: '100%', height: 145, overflow: 'hidden', position: 'relative' }}>
                    {record.media_url ? (
                      <img
                        src={record.media_url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#0a1a0e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                        🌿
                      </div>
                    )}
                    {/* Badge de categoría */}
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8,
                      background: 'rgba(0,0,0,0.75)',
                      backdropFilter: 'blur(8px)',
                      padding: '3px 10px',
                      borderRadius: 4,
                      border: '1px solid rgba(52,211,153,0.5)',
                      fontSize: 9,
                      color: '#34d399',
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, monospace',
                      letterSpacing: '1.5px',
                    }}>
                      {getCategoryLabel(record)}
                    </div>
                  </div>

                  {/* ── Contenido HUD ── */}
                  <div style={{ padding: '14px 16px 16px' }}>

                    {/* Nombre */}
                    <div style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      marginBottom: 2,
                      fontFamily: 'ui-monospace, monospace',
                      letterSpacing: '0.5px',
                    }}>
                      {(record.nombre_tradicional || '—').toUpperCase()}
                    </div>

                    {/* Nombre científico */}
                    {record.nombre_cientifico && (
                      <div style={{
                        color: '#34d399',
                        fontSize: 11,
                        fontStyle: 'italic',
                        marginBottom: 10,
                        fontFamily: 'ui-monospace, monospace',
                      }}>
                        &gt; {record.nombre_cientifico}
                      </div>
                    )}

                    {/* Descripción */}
                    {record.descripcion && (
                      <div style={{
                        color: '#9ca3af',
                        fontSize: 11,
                        lineHeight: '1.55',
                        marginBottom: 10,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontFamily: 'ui-sans-serif, system-ui',
                      }}>
                        {record.descripcion}
                      </div>
                    )}

                    {/* Coordenadas + Fecha */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <div style={metaBadgeStyle}>
                        [{lat.toFixed(4)}, {lng.toFixed(4)}]
                      </div>
                      {record.created_at && (
                        <div style={metaBadgeStyle}>
                          T · {formatDate(record.created_at)}
                        </div>
                      )}
                    </div>

                    {/* Etiquetas hábitat / alimentación */}
                    {(record.alimentacion || record.habitat) && (
                      <div style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid rgba(52,211,153,0.12)',
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                      }}>
                        {record.alimentacion && (
                          <span style={tagStyle('#34d399', 'rgba(52,211,153,0.1)')}>
                            🍃 {record.alimentacion}
                          </span>
                        )}
                        {record.habitat && (
                          <span style={tagStyle('#60a5fa', 'rgba(96,165,250,0.1)')}>
                            🏔️ {record.habitat}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </View>
  );
}

// ── Estilos inline reutilizables (popup JSX web) ─────────────────────────────

const metaBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'rgba(52,211,153,0.08)',
  border: '1px solid rgba(52,211,153,0.25)',
  padding: '3px 7px',
  borderRadius: 4,
  fontSize: 9,
  color: '#6ee7b7',
  fontFamily: 'ui-monospace, monospace',
  letterSpacing: '0.5px',
};

const tagStyle = (color: string, bg: string): React.CSSProperties => ({
  background: bg,
  color,
  padding: '3px 8px',
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
  border: `1px solid ${color}33`,
});

// ── Estilos React Native ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
});
