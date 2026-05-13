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

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

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

const GUAYANA_CENTER: [number, number] = [6.2, -63.5];

const GUAYANA_VIEWBOX = [
  Math.min(...GF_POLYGON.map(p => p.longitude)),
  Math.max(...GF_POLYGON.map(p => p.latitude)),
  Math.max(...GF_POLYGON.map(p => p.longitude)),
  Math.min(...GF_POLYGON.map(p => p.latitude)),
] as [number, number, number, number];

/** Zoom de inicio (vista general del mapa) */
const MAP_ZOOM_START = 5;

/** Centro geográfico inicial (vista general) */
const MAP_CENTER_START: [number, number] = [5.0, -63.5];

/** Coordenadas de destino del flyTo de entrada */
const FLY_TO_TARGET: [number, number] = [5.8, -61.3];

/** Zoom de destino del flyTo de entrada */
const FLY_TO_ZOOM = 16;

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

    .leaflet-bottom.leaflet-right {
      top: auto !important;
      bottom: 16px !important;
      right: 16px !important;
      left: auto !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
    }

    .leaflet-bottom.leaflet-right .leaflet-control-zoom {
      margin: 0 !important;
    }

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

    /* ── Search bar ── */
    .ecos-search-container {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      z-index: 1000;
      max-width: 420px;
      width: min(420px, calc(100% - 32px));
      margin: 0 auto;
      box-sizing: border-box;
    }
    .ecos-search-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 14px;
      height: 46px;
      border-radius: 14px;
      border: 1px solid var(--search-border, rgba(52,211,153,0.3));
      background: var(--search-background, rgba(5,10,8,0.85));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      transition: border-color 0.2s ease;
    }
    .ecos-search-bar:focus-within {
      border-color: rgba(52,211,153,0.6);
    }
    .ecos-search-bar input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      color: var(--search-text, #fff);
      font-size: 14px;
      font-family: ui-sans-serif, system-ui;
      font-weight: 500;
    }
    .ecos-search-bar input::placeholder {
      color: var(--search-placeholder, rgba(255,255,255,0.4));
    }
    .ecos-search-bar .search-icon {
      color: #34d399;
      font-size: 18px;
      flex-shrink: 0;
    }
    .ecos-search-bar .clear-btn {
      background: none;
      border: none;
      color: var(--search-placeholder, rgba(255,255,255,0.4));
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      display: flex;
      align-items: center;
    }
    .ecos-search-bar .clear-btn:hover {
      color: #34d399;
    }
    .ecos-search-results {
      margin-top: 6px;
      border-radius: 14px;
      border: 1px solid var(--search-result-border, rgba(52,211,153,0.2));
      background: var(--search-result-background, rgba(5,10,8,0.92));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      overflow: hidden;
    }
    .ecos-search-result-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.15s ease;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      color: var(--search-text, #e2e8f0);
    }
    .ecos-search-result-item:last-child {
      border-bottom: none;
    }
    .ecos-search-result-item:hover {
      background: rgba(52,211,153,0.1);
    }
    .ecos-search-result-item .result-icon {
      color: #34d399;
      font-size: 16px;
      flex-shrink: 0;
    }
    .ecos-search-result-item .result-text {
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.4;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
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
  const [showGuayanaLabel, setShowGuayanaLabel] = useState(true);
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);

      const [west, north, east, south] = GUAYANA_VIEWBOX;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '5');
      url.searchParams.set('countrycodes', 've');
      url.searchParams.set('viewbox', `${west},${north},${east},${south}`);
      url.searchParams.set('q', text.trim());

      try {
        const res = await fetch(url.toString(), {
          headers: { 'Accept-Language': 'es' },
        });
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Nominatim search error:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const handleSubmitSearch = async () => {
    if (searchQuery.trim().length < 2) return;

    if (searchResults.length > 0) {
      handleSelectResult(searchResults[0]);
      return;
    }

    // Si no hay resultados, hacer búsqueda rápida
    setSearching(true);
    try {
      const [west, north, east, south] = GUAYANA_VIEWBOX;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 've');
      url.searchParams.set('viewbox', `${west},${north},${east},${south}`);
      url.searchParams.set('q', searchQuery.trim());

      const res = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'es' },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        handleSelectResult(data[0]);
      }
    } catch (err) {
      console.error('Nominatim search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.latitud ?? result.lat);
    const lon = parseFloat(result.longitud ?? result.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    setFlyTarget({ lat, lng: lon });
    setSearchQuery(result.nombre_tradicional || result.display_name || '');
    setSearchResults([]);
  };

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

  const { MapContainer, TileLayer, Marker, Popup, Polygon, useMap, useMapEvents, L } = MapComponents;

  // ── Sub-componentes internos ───────────────────────────────────────────────

  /** Listener de movimiento para el callback externo */
  const MapEventsComponent = () => {
    const map = useMapEvents({
      moveend: (e: any) => {
        if (onRegionChangeComplete) {
          const center = e.target.getCenter();
          onRegionChangeComplete({ latitude: center.lat, longitude: center.lng });
        }
      },
      zoomend: () => {
        const zoom = map.getZoom();
        setShowGuayanaLabel(zoom <= 8.5);
      },
    });

    useEffect(() => {
      if (map) {
        setShowGuayanaLabel(map.getZoom() <= 8.5);
      }
    }, [map]);

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
        doubleClickZoom={true}
        touchZoom={true}
        boxZoom={true}
        keyboard={true}
        zoomControl={true}
      >

        {/* Listener de eventos */}
        <MapEventsComponent />

        {/* ── Capa satelital similar a hybrid de la app ── */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          maxNativeZoom={18}
          maxZoom={18}
        />

        {/* ── Capas de etiquetas para caminos y nombres ── */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={18}
          maxZoom={18}
          pane="overlayPane"
        />

        {/* ── Máscara: oscurece el exterior de la Guayana y mantiene el interior claro ── */}
        <Polygon
          positions={[WORLD_BOUNDS, GUAYANA_POLYGON]}
          pathOptions={{
            fillColor: '#000000',
            fillOpacity: 0.55,
            stroke: false,
            fillRule: 'evenOdd',
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

        {/* ── Etiqueta flotante que desaparece al acercarse */}
        {showGuayanaLabel && (
          <Marker
            position={GUAYANA_CENTER}
            icon={L.divIcon({
              className: 'guayana-label-icon',
              html: `
                <div style="
                  color: rgba(255,255,255,0.95);
                  font-weight: 700;
                  font-size: 14px;
                  letter-spacing: 0.4px;
                  text-transform: uppercase;
                  text-align: center;
                  white-space: nowrap;
                  text-shadow: 0 0 12px rgba(0,0,0,0.35);
                  transform: rotate(-10deg);
                ">
                  REGIÓN GUAYANA
                </div>
              `,
              iconSize: [220, 24],
              iconAnchor: [110, 12],
            })}
          />
        )}

        {/* ── FlyTo desde busqueda ── */}
        {flyTarget && <FlyToSearch target={flyTarget} useMap={useMap} onDone={() => setFlyTarget(null)} />}

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

      {/* ── Barra de busqueda de ubicacion ── */}
      <div
        className="ecos-search-container"
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 'auto',
          zIndex: 1000,
          maxWidth: 420,
          width: 'min(420px, calc(100% - 32px))',
          pointerEvents: 'auto',
          '--search-background': 'rgba(5,10,8,0.85)',
          '--search-border': 'rgba(52,211,153,0.3)',
          '--search-text': '#ffffff',
          '--search-placeholder': 'rgba(255,255,255,0.55)',
          '--search-result-background': 'rgba(5,10,8,0.92)',
          '--search-result-border': 'rgba(52,211,153,0.2)',
        } as React.CSSProperties}
      >
        <div className="ecos-search-bar">
          <Ionicons name="search" size={18} color="#34d399" style={{ marginRight: 8 }} />
          <input
            type="text"
            placeholder="Search location..."
            value={searchQuery}
            onChange={(e: any) => handleSearch(e.target.value)}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') {
                handleSubmitSearch();
              }
            }}
          />
          {searching && (
            <span style={{ color: '#34d399', fontSize: 12, animation: 'pulse 1s infinite' }}>...</span>
          )}
          {searchQuery.length > 0 && !searching && (
            <button className="clear-btn" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
              &#x2715;
            </button>
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="ecos-search-results">
            {searchResults.map((result: any, idx: number) => (
              <div
                key={idx}
                className="ecos-search-result-item"
                onClick={() => handleSelectResult(result)}
              >
                <Ionicons name="location-outline" size={16} color="#34d399" />
                <span className="result-text">{result.display_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </View>
  );
}

/** Sub-componente para volar a la ubicacion buscada */
function FlyToSearch({ target, useMap, onDone }: { target: { lat: number; lng: number }; useMap: any; onDone: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (target && map) {
      map.flyTo([target.lat, target.lng], FLY_TO_ZOOM, { animate: true, duration: 2 });
      onDone();
    }
  }, [target, map]);
  return null;
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
