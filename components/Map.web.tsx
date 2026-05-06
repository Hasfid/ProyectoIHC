/**
 * Map.web.tsx — Mapa interactivo Leaflet para la versión web de Ecos.
 *
 * Renderiza un mapa con:
 * - Polígono delimitando la región de la Guayana venezolana
 * - Oscurecimiento del resto del mundo
 * - Chinchetas personalizadas con foto del registro y borde por categoría
 * - Popups glassmorphism con imagen, metadatos y etiquetas
 *
 * Carga Leaflet de forma asíncrona (react-leaflet + leaflet) para evitar
 * problemas de SSR. El CSS se inyecta globalmente antes del primer render.
 *
 * @module components/Map.web
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

// ── Geometría ────────────────────────────────────────────────────────────────

/** Polígono aproximado de la Guayana venezolana */
const GUAYANA_POLYGON: [number, number][] = [
  [8.5, -60.0],
  [8.0, -63.0],
  [7.5, -65.0],
  [6.0, -68.0],
  [1.0, -67.0],
  [1.0, -64.0],
  [4.0, -61.0],
  [7.0, -60.0],
];

/** Polígono que cubre todo el mundo (para el efecto de oscurecimiento) */
const WORLD_BOUNDS: [number, number][] = [
  [90, -180],
  [-90, -180],
  [-90, 180],
  [90, 180],
];

/** Centro geográfico inicial del mapa [lat, lng] */
const MAP_CENTER: [number, number] = [5.0, -63.5];

/** Nivel de zoom inicial */
const MAP_ZOOM = 6;

// ── Inyección de CSS ─────────────────────────────────────────────────────────

const LEAFLET_CSS_ID = 'leaflet-css';

if (typeof document !== 'undefined' && !document.getElementById(LEAFLET_CSS_ID)) {
  // CSS base de Leaflet
  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  // Estilos custom (popups glassmorphism, pins, animaciones)
  const style = document.createElement('style');
  style.textContent = `
    .leaflet-container { width: 100% !important; height: 100% !important; }
    .leaflet-tile-pane img { max-width: none !important; }
    .custom-pin-icon { background: none !important; border: none !important; }

    /* Popup glassmorphism */
    .ecos-popup .leaflet-popup-content-wrapper {
      background: rgba(10, 20, 16, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(164, 255, 68, 0.25);
      border-radius: 16px;
      padding: 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(164,255,68,0.08);
      overflow: hidden;
      min-width: 240px;
    }
    .ecos-popup .leaflet-popup-content {
      margin: 0 !important;
      width: 240px !important;
    }
    .ecos-popup .leaflet-popup-tip {
      background: rgba(10, 20, 16, 0.95);
      border: 1px solid rgba(164, 255, 68, 0.25);
      border-top: none;
      border-left: none;
      box-shadow: none;
    }
    .ecos-popup .leaflet-popup-close-button {
      color: #fff !important;
      font-size: 20px !important;
      top: 8px !important;
      right: 8px !important;
      z-index: 10;
      background: rgba(0,0,0,0.4);
      border-radius: 50%;
      width: 26px !important;
      height: 26px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 26px !important;
      padding: 0 !important;
    }
    .ecos-popup .leaflet-popup-close-button:hover {
      color: #a4ff44 !important;
    }

    /* Animación de entrada */
    .leaflet-popup {
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    /* Hover en pins */
    .eco-pin {
      transition: transform 0.2s ease;
      cursor: pointer;
    }
    .eco-pin:hover {
      transform: scale(1.15) translateY(-3px);
    }
  `;
  document.head.appendChild(style);
}

// ── Helpers de categorización ────────────────────────────────────────────────

/** Devuelve un color de borde según la categoría inferida del nombre */
const getCategoryColor = (item: any): string => {
  const nombre = (item.nombre_tradicional || '').toLowerCase();
  if (nombre.includes('jaguar') || nombre.includes('tigre') || nombre.includes('chigüire')) return '#ff9100';
  if (nombre.includes('guacamaya') || nombre.includes('ave') || nombre.includes('loro')) return '#00b0ff';
  if (nombre.includes('rana') || nombre.includes('sapo') || nombre.includes('serpiente')) return '#ff5252';
  return '#00e676';
};

/** Devuelve una etiqueta emoji + categoría para el badge del popup */
const getCategoryLabel = (item: any): string => {
  const nombre = (item.nombre_tradicional || '').toLowerCase();
  if (nombre.includes('jaguar') || nombre.includes('tigre') || nombre.includes('chigüire') || nombre.includes('mono')) return '🐾 Mamífero';
  if (nombre.includes('guacamaya') || nombre.includes('ave') || nombre.includes('loro') || nombre.includes('tucán')) return '🐦 Ave';
  if (nombre.includes('rana') || nombre.includes('sapo') || nombre.includes('serpiente') || nombre.includes('iguana')) return '🦎 Reptil/Anfibio';
  if (nombre.includes('orquídea') || nombre.includes('flor') || nombre.includes('planta') || nombre.includes('árbol')) return '🌿 Flora';
  return '🌿 Especie';
};

/** Formatea una fecha ISO a formato legible (ej: "6 may 2026") */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('es-VE', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return '';
  }
};

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Mapa web con Leaflet para visualizar registros de biodiversidad.
 *
 * Carga las dependencias de Leaflet de forma asíncrona y espera a que
 * el CSS esté disponible antes de renderizar para evitar FOUC.
 */
export default function MapWeb() {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [cssReady, setCssReady] = useState(false);

  useEffect(() => {
    // Esperar a que el CSS de Leaflet esté cargado
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
      const { MapContainer, TileLayer, Marker, Popup, Polygon } = reactLeaflet;
      setMapComponents({ MapContainer, TileLayer, Marker, Popup, Polygon, L: L.default || L });
    }).catch(err => {
      console.error('Error loading Leaflet:', err);
    });

    fetchRecords();
  }, []);

  /** Trae todos los registros con coordenadas válidas desde Supabase */
  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase.from('registros').select('*');
      if (error) throw error;
      setRecords((data || []).filter(r => r.latitud != null && r.longitud != null));
    } catch (err) {
      console.error('Error fetching map records (web):', err);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (!MapComponents || !cssReady) {
    return <View style={styles.container} />;
  }

  const { MapContainer, TileLayer, Marker, Popup, Polygon, L } = MapComponents;

  /** Crea un DivIcon de Leaflet con foto circular y flecha de color */
  const createCustomIcon = (imageUrl: string, color: string) => {
    return L.divIcon({
      className: 'custom-pin-icon',
      html: `
        <div class="eco-pin" style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
          <div style="width:50px;height:50px;border-radius:25px;border:3px solid ${color};background:#111;overflow:hidden;box-shadow:0 0 10px ${color}44;">
            <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />
          </div>
          <div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:14px solid ${color};margin-top:-3px;"></div>
        </div>
      `,
      iconSize: [50, 61],
      iconAnchor: [25, 61],
      popupAnchor: [0, -65],
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* Oscurece todo excepto la Guayana */}
        <Polygon
          positions={[WORLD_BOUNDS, GUAYANA_POLYGON]}
          pathOptions={{ fillColor: 'black', fillOpacity: 0.7, stroke: false }}
        />

        {/* Borde de la región Guayana */}
        <Polygon
          positions={GUAYANA_POLYGON}
          pathOptions={{ fillColor: 'transparent', color: '#00e676', weight: 2 }}
        />

        {/* Pins de registros */}
        {records.map((record: any) => {
          const lat = parseFloat(record.latitud);
          const lng = parseFloat(record.longitud);
          if (isNaN(lat) || isNaN(lng)) return null;

          const color = getCategoryColor(record);

          return (
            <Marker
              key={record.id}
              position={[lat, lng]}
              icon={createCustomIcon(record.media_url, color)}
            >
              <Popup className="ecos-popup" maxWidth={260} minWidth={240}>
                <div style={{ margin: 0, padding: 0 }}>
                  {/* Imagen principal */}
                  <div style={{ width: '100%', height: 150, overflow: 'hidden', position: 'relative' }}>
                    <img
                      src={record.media_url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8,
                      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, color: '#fff', fontWeight: 600,
                    }}>
                      {getCategoryLabel(record)}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div style={{ padding: '14px 16px 16px' }}>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 2, lineHeight: '1.3' }}>
                      {record.nombre_tradicional}
                    </div>

                    {record.nombre_cientifico && (
                      <div style={{ color: '#a4ff44', fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>
                        {record.nombre_cientifico}
                      </div>
                    )}

                    {record.descripcion && (
                      <div style={{
                        color: '#aaa', fontSize: 12, lineHeight: '1.5', marginBottom: 10,
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {record.descripcion}
                      </div>
                    )}

                    {/* Coordenadas + Fecha */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={metaBadgeStyle}>
                        📍 {lat.toFixed(2)}, {lng.toFixed(2)}
                      </div>
                      {record.created_at && (
                        <div style={metaBadgeStyle}>
                          📅 {formatDate(record.created_at)}
                        </div>
                      )}
                    </div>

                    {/* Etiquetas de alimentación / hábitat */}
                    {(record.alimentacion || record.habitat) && (
                      <div style={{
                        marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', gap: 6, flexWrap: 'wrap',
                      }}>
                        {record.alimentacion && (
                          <span style={tagStyle('#a4ff44', 'rgba(164,255,68,0.12)')}>
                            🍃 {record.alimentacion}
                          </span>
                        )}
                        {record.habitat && (
                          <span style={tagStyle('#00b0ff', 'rgba(0,176,255,0.12)')}>
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

// ── Estilos inline reutilizables para el popup (JSX web) ─────────────────────

const metaBadgeStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'rgba(255,255,255,0.06)',
  padding: '4px 8px', borderRadius: 8,
  fontSize: 11, color: '#888',
};

const tagStyle = (color: string, bg: string): React.CSSProperties => ({
  background: bg, color, padding: '3px 8px',
  borderRadius: 6, fontSize: 10, fontWeight: 600,
});

// ── Estilos React Native ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
