/**
 * geofence.ts — Verificación geográfica para la Guayana venezolana.
 *
 * Provee un algoritmo de Ray Casting para determinar si una coordenada
 * GPS está dentro del polígono aproximado de la Guayana (Bolívar,
 * Amazonas y Delta Amacuro). Usado por el scanner para restringir
 * la captura de registros al área de estudio.
 *
 * @module lib/geofence
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Coordenada GPS con latitud y longitud en grados decimales */
export type Point = { latitude: number; longitude: number };

// ── Algoritmo ────────────────────────────────────────────────────────────────

/**
 * Determina si un punto está dentro de un polígono cerrado.
 *
 * Implementa el algoritmo de **Ray Casting**: traza un rayo horizontal
 * desde el punto hacia la derecha y cuenta cuántas aristas del polígono
 * cruza. Si el número de intersecciones es impar, el punto está adentro.
 *
 * @param point   - Coordenada a evaluar
 * @param polygon - Vértices del polígono (no necesita cerrar, se cierra implícitamente)
 * @returns `true` si el punto está dentro del polígono
 *
 * @example
 * ```ts
 * const dentro = isPointInPolygon(
 *   { latitude: 5.0, longitude: -63.5 },
 *   GUAYANA_POLYGON
 * );
 * ```
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  const x = point.longitude;
  const y = point.latitude;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// ── Datos ────────────────────────────────────────────────────────────────────

/**
 * Polígono ultra-preciso de la Guayana Venezolana.
 *
 * Incluye los estados: Bolívar, Amazonas, Delta Amacuro,
 * y la Guayana Esequiba. Trazado siguiendo los límites geográficos
 * naturales (Río Orinoco, Río Esequibo, Sierra de Pacaraima y Parima).
 * 
 * Orden de los vértices: Sentido horario comenzando desde la costa del Esequibo.
 */
// --- Polígonos Individuales por Estado ---

export const DELTA_AMACURO_POLYGON: Point[] = [
  { latitude: 10.0000, longitude: -62.2000 },
  { latitude: 9.9000, longitude: -61.8000 },
  { latitude: 9.9500, longitude: -61.4000 },
  { latitude: 9.8000, longitude: -60.8000 },
  { latitude: 9.6000, longitude: -60.4000 },
  { latitude: 9.4800, longitude: -59.9800 }, // Punta Playa
  { latitude: 8.9000, longitude: -60.1000 },
  { latitude: 8.5000, longitude: -60.4000 }, // Trifinio Delta-Bolívar-Esequibo
  { latitude: 8.4000, longitude: -61.0000 },
  { latitude: 8.4000, longitude: -61.5000 },
  { latitude: 8.5000, longitude: -62.0000 }, // Barrancas
  { latitude: 8.6500, longitude: -62.3000 },
  { latitude: 9.0000, longitude: -62.3000 },
  { latitude: 9.5000, longitude: -62.2500 },
];

export const ESEQUIBO_POLYGON: Point[] = [
  { latitude: 9.4800, longitude: -59.9800 },
  { latitude: 8.8000, longitude: -59.9000 },
  { latitude: 8.2500, longitude: -59.7500 },
  { latitude: 7.7500, longitude: -58.8000 },
  { latitude: 7.4000, longitude: -58.5000 },
  { latitude: 7.0000, longitude: -58.3500 },
  { latitude: 6.6000, longitude: -58.5000 },
  { latitude: 6.1000, longitude: -58.6000 },
  { latitude: 5.5000, longitude: -58.6500 },
  { latitude: 5.1000, longitude: -58.8000 },
  { latitude: 4.7500, longitude: -58.9000 },
  { latitude: 4.3000, longitude: -58.6000 },
  { latitude: 3.9000, longitude: -58.3500 },
  { latitude: 3.4000, longitude: -58.3000 },
  { latitude: 2.8000, longitude: -58.3000 },
  { latitude: 2.3000, longitude: -58.2000 },
  { latitude: 1.8500, longitude: -58.0500 },
  { latitude: 1.4000, longitude: -58.5000 },
  { latitude: 1.5000, longitude: -59.0000 },
  { latitude: 1.6500, longitude: -59.3000 },
  { latitude: 1.8000, longitude: -59.6000 },
  { latitude: 2.0000, longitude: -59.9000 },
  { latitude: 2.2000, longitude: -60.2000 },
  { latitude: 2.5000, longitude: -60.4000 },
  { latitude: 2.9000, longitude: -60.6000 },
  { latitude: 3.4000, longitude: -60.4000 },
  { latitude: 3.8000, longitude: -60.3000 },
  { latitude: 4.1000, longitude: -60.5000 },
  { latitude: 4.5000, longitude: -60.7000 },
  { latitude: 5.2000, longitude: -60.6500 }, // Monte Roraima
  { latitude: 5.8000, longitude: -60.9000 },
  { latitude: 6.5000, longitude: -61.2000 },
  { latitude: 7.0000, longitude: -61.1000 },
  { latitude: 7.5000, longitude: -60.8000 },
  { latitude: 8.0000, longitude: -60.5000 },
  { latitude: 8.5000, longitude: -60.4000 },
  { latitude: 8.9000, longitude: -60.1000 },
];

export const AMAZONAS_POLYGON: Point[] = [
  // --- Límite Oeste (Orinoco - Atabapo - Guainía/Negro / Frontera con Colombia) ---
  { latitude: 6.1800, longitude: -67.4800 }, // Cerca de Puerto Ayacucho (Norte)
  { latitude: 5.8100, longitude: -67.6200 },
  { latitude: 5.4800, longitude: -67.7200 },
  { latitude: 5.1700, longitude: -67.8200 },
  { latitude: 4.7600, longitude: -67.8600 },
  { latitude: 4.4400, longitude: -67.8000 },
  { latitude: 4.0400, longitude: -67.7000 }, // San Fernando de Atabapo
  { latitude: 3.8200, longitude: -67.7900 },
  { latitude: 3.4700, longitude: -67.8900 },
  { latitude: 3.1200, longitude: -67.8200 },
  { latitude: 2.7800, longitude: -67.6800 },
  { latitude: 2.4900, longitude: -67.7300 },
  { latitude: 2.1500, longitude: -67.8100 },
  { latitude: 1.8800, longitude: -67.5400 },
  { latitude: 1.7000, longitude: -67.1100 },
  { latitude: 1.5000, longitude: -67.0000 },
  { latitude: 1.2200, longitude: -66.8600 }, // Piedra del Cocuy (Trifinio VE-CO-BR)

  // --- Límite Sur y Sureste (Sierras Imerí, Tapirapecó, Neblina / Frontera con Brasil) ---
  { latitude: 0.9600, longitude: -66.5200 },
  { latitude: 0.6600, longitude: -65.9800 }, // Pico da Neblina (Punto más al sur)
  { latitude: 0.8800, longitude: -65.6100 },
  { latitude: 1.1500, longitude: -65.3400 },
  
  // --- Límite Este (Sierra Parima / Frontera con Brasil) ---
  { latitude: 1.5200, longitude: -64.9600 },
  { latitude: 1.8500, longitude: -64.6500 },
  { latitude: 2.2200, longitude: -64.3300 },
  { latitude: 2.6500, longitude: -64.1200 },
  { latitude: 3.0500, longitude: -64.3000 },
  { latitude: 3.4800, longitude: -64.0800 },
  { latitude: 3.7400, longitude: -63.7800 }, // Trifinio Interno Amazonas-Bolívar-Brasil

  // --- Límite Norte/Noreste (Frontera interna con Estado Bolívar) ---
  { latitude: 4.0500, longitude: -64.1000 },
  { latitude: 4.3500, longitude: -64.4500 },
  { latitude: 4.6800, longitude: -64.8200 },
  { latitude: 5.0500, longitude: -65.1800 },
  { latitude: 5.3200, longitude: -65.5500 },
  { latitude: 5.5500, longitude: -65.9200 },
  { latitude: 5.7800, longitude: -66.3000 },
  { latitude: 5.9500, longitude: -66.6800 },
  { latitude: 6.1200, longitude: -67.0500 },
  { latitude: 6.1800, longitude: -67.3500 },
];

export const BOLIVAR_POLYGON: Point[] = [
  { latitude: 6.2000, longitude: -67.5000 }, // Puerto Ayacucho
  { latitude: 6.5000, longitude: -67.3000 },
  { latitude: 6.9000, longitude: -67.1000 },
  { latitude: 7.3000, longitude: -66.7000 },
  { latitude: 7.6000, longitude: -66.3000 },
  { latitude: 7.8000, longitude: -65.9000 },
  { latitude: 7.9000, longitude: -65.5000 },
  { latitude: 8.1000, longitude: -65.1000 },
  { latitude: 8.2000, longitude: -64.8000 },
  { latitude: 8.3000, longitude: -64.2000 },
  { latitude: 8.3500, longitude: -63.5500 },
  { latitude: 8.4000, longitude: -63.1000 },
  { latitude: 8.5500, longitude: -62.6500 },
  { latitude: 8.6500, longitude: -62.3000 },
  { latitude: 8.7000, longitude: -62.0000 },
  { latitude: 8.5000, longitude: -62.0000 }, // Empieza borde con Delta Amacuro
  { latitude: 8.4000, longitude: -61.5000 },
  { latitude: 8.4000, longitude: -61.0000 },
  { latitude: 8.5000, longitude: -60.4000 }, // Empieza borde con Esequibo
  { latitude: 8.0000, longitude: -60.5000 },
  { latitude: 7.5000, longitude: -60.8000 },
  { latitude: 7.0000, longitude: -61.1000 },
  { latitude: 6.5000, longitude: -61.2000 },
  { latitude: 5.8000, longitude: -60.9000 },
  { latitude: 5.2000, longitude: -60.6500 }, // Monte Roraima (Borde con Brasil)
  { latitude: 4.8000, longitude: -61.1000 },
  { latitude: 4.4000, longitude: -61.5000 },
  { latitude: 4.1000, longitude: -62.0000 },
  { latitude: 3.9000, longitude: -62.5000 },
  { latitude: 3.7000, longitude: -63.0000 },
  { latitude: 3.6000, longitude: -63.5000 },
  { latitude: 3.2000, longitude: -63.6000 },
  { latitude: 2.8000, longitude: -63.8000 },
  { latitude: 2.4000, longitude: -64.1000 }, // Empieza borde con Amazonas
  { latitude: 3.0000, longitude: -64.5000 },
  { latitude: 3.5000, longitude: -64.2000 },
  { latitude: 4.0000, longitude: -64.0000 },
  { latitude: 4.5000, longitude: -64.0000 },
  { latitude: 5.0000, longitude: -64.5000 },
  { latitude: 5.5000, longitude: -65.5000 },
  { latitude: 6.0000, longitude: -66.5000 },
];

export const GUAYANA_POLYGON: Point[] = [
  // --- Costa Atlántica (Delta Amacuro y Guayana Esequiba) ---
  { latitude: 10.0000, longitude: -62.2000 }, // Pedernales / Inicio Delta
  { latitude: 9.9000, longitude: -61.8000 },
  { latitude: 9.9500, longitude: -61.4000 },
  { latitude: 9.8000, longitude: -60.8000 },
  { latitude: 9.6000, longitude: -60.4000 },
  { latitude: 9.4800, longitude: -59.9800 }, // Punta Playa
  { latitude: 8.8000, longitude: -59.9000 },
  { latitude: 8.2500, longitude: -59.7500 },
  { latitude: 7.7500, longitude: -58.8000 },
  { latitude: 7.4000, longitude: -58.5000 },
  { latitude: 7.0000, longitude: -58.3500 }, // Desembocadura del Esequibo

  // --- Límite Este (Río Esequibo) ---
  { latitude: 6.6000, longitude: -58.5000 },
  { latitude: 6.1000, longitude: -58.6000 },
  { latitude: 5.5000, longitude: -58.6500 },
  { latitude: 5.1000, longitude: -58.8000 },
  { latitude: 4.7500, longitude: -58.9000 },
  { latitude: 4.3000, longitude: -58.6000 },
  { latitude: 3.9000, longitude: -58.3500 },
  { latitude: 3.4000, longitude: -58.3000 },
  { latitude: 2.8000, longitude: -58.3000 },
  { latitude: 2.3000, longitude: -58.2000 },
  { latitude: 1.8500, longitude: -58.0500 },
  { latitude: 1.4000, longitude: -58.5000 }, // Extremo Sur Esequibo

  // --- Límite Sur (Frontera con Brasil - Sierras de Acarí y Pacaraima) ---
  { latitude: 1.5000, longitude: -59.0000 },
  { latitude: 1.6500, longitude: -59.3000 },
  { latitude: 1.8000, longitude: -59.6000 },
  { latitude: 2.0000, longitude: -59.9000 },
  { latitude: 2.2000, longitude: -60.2000 },
  { latitude: 2.5000, longitude: -60.4000 },
  { latitude: 2.9000, longitude: -60.6000 },
  { latitude: 3.4000, longitude: -60.4000 },
  { latitude: 3.8000, longitude: -60.3000 },
  { latitude: 4.1000, longitude: -60.5000 },
  { latitude: 4.5000, longitude: -60.7000 },
  { latitude: 5.2000, longitude: -60.6500 }, // Monte Roraima
  { latitude: 4.8000, longitude: -61.1000 },
  { latitude: 4.4000, longitude: -61.5000 },
  { latitude: 4.1000, longitude: -62.0000 },
  { latitude: 3.9000, longitude: -62.5000 },
  { latitude: 3.7000, longitude: -63.0000 },
  { latitude: 3.6000, longitude: -63.5000 },
  { latitude: 3.2000, longitude: -63.6000 },
  { latitude: 2.8000, longitude: -63.8000 },
  { latitude: 2.4000, longitude: -64.1000 },
  { latitude: 2.0000, longitude: -64.5000 },
  { latitude: 1.6000, longitude: -64.9000 },
  { latitude: 1.2000, longitude: -65.3000 }, // Sierra de Parima
  { latitude: 0.9000, longitude: -65.6000 },
  { latitude: 0.6600, longitude: -65.9800 }, // Pico da Neblina

  // --- Límite Oeste (Frontera con Colombia - Ríos Negro, Atabapo, Orinoco) ---
  { latitude: 0.9000, longitude: -66.5000 },
  { latitude: 1.2000, longitude: -66.9000 },
  { latitude: 1.5000, longitude: -67.0000 },
  { latitude: 1.7000, longitude: -67.1000 },
  { latitude: 1.9000, longitude: -67.5000 },
  { latitude: 2.1000, longitude: -67.8000 },
  { latitude: 2.5000, longitude: -67.7500 },
  { latitude: 2.8000, longitude: -67.7000 },
  { latitude: 3.1000, longitude: -67.8000 },
  { latitude: 3.5000, longitude: -67.9000 },
  { latitude: 3.8000, longitude: -67.8000 },
  { latitude: 4.0000, longitude: -67.7000 }, // San Fernando de Atabapo
  { latitude: 4.4000, longitude: -67.8000 },
  { latitude: 4.8000, longitude: -67.8500 },
  { latitude: 5.1000, longitude: -67.8000 },
  { latitude: 5.5000, longitude: -67.7000 },
  { latitude: 5.8000, longitude: -67.6000 },
  { latitude: 6.2000, longitude: -67.5000 }, // Puerto Ayacucho

  // --- Límite Norte (Río Orinoco - Bolívar/Amazonas vs Resto de Vzla) ---
  { latitude: 6.5000, longitude: -67.3000 },
  { latitude: 6.9000, longitude: -67.1000 }, // Caicara del Orinoco
  { latitude: 7.3000, longitude: -66.7000 },
  { latitude: 7.6000, longitude: -66.3000 },
  { latitude: 7.8000, longitude: -65.9000 },
  { latitude: 7.9000, longitude: -65.5000 },
  { latitude: 8.1000, longitude: -65.1000 },
  { latitude: 8.2000, longitude: -64.8000 }, // Mapire
  { latitude: 8.3000, longitude: -64.2000 },
  { latitude: 8.3500, longitude: -63.5500 }, // Ciudad Bolívar
  { latitude: 8.4000, longitude: -63.1000 },
  { latitude: 8.5500, longitude: -62.6500 }, // Ciudad Guayana (Alta Vista, San Félix)
  { latitude: 8.6500, longitude: -62.3000 },
  { latitude: 8.7000, longitude: -62.0000 }, // Barrancas del Orinoco
  
  // --- Retorno hacia el Delta ---
  { latitude: 8.6000, longitude: -61.5000 },
  { latitude: 8.7000, longitude: -61.1000 }, // Tucupita
  { latitude: 9.0000, longitude: -61.0000 },
  { latitude: 9.4000, longitude: -61.0000 },
  { latitude: 9.7000, longitude: -61.5000 },
  { latitude: 9.9000, longitude: -61.8000 },
];

// ── Identificación ───────────────────────────────────────────────────────────

/**
 * Devuelve el nombre del estado al que pertenece una coordenada.
 * Retorna null si está fuera de la Gran Guayana.
 */
export function getGuayanaState(point: Point): 'Bolívar' | 'Amazonas' | 'Delta Amacuro' | 'Guayana Esequiba' | null {
  if (isPointInPolygon(point, BOLIVAR_POLYGON)) return 'Bolívar';
  if (isPointInPolygon(point, AMAZONAS_POLYGON)) return 'Amazonas';
  if (isPointInPolygon(point, DELTA_AMACURO_POLYGON)) return 'Delta Amacuro';
  if (isPointInPolygon(point, ESEQUIBO_POLYGON)) return 'Guayana Esequiba';
  return null;
}
