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
 * Polígono aproximado de la Guayana venezolana.
 *
 * Cubre de forma simplificada los estados Bolívar, Amazonas y
 * Delta Amacuro. Los vértices están ordenados en sentido horario.
 */
export const GUAYANA_POLYGON: Point[] = [
  { latitude: 8.5, longitude: -60.0 },
  { latitude: 8.0, longitude: -63.0 },
  { latitude: 7.5, longitude: -65.0 },
  { latitude: 6.0, longitude: -68.0 },
  { latitude: 1.0, longitude: -67.0 },
  { latitude: 1.0, longitude: -64.0 },
  { latitude: 4.0, longitude: -61.0 },
  { latitude: 7.0, longitude: -60.0 },
];
