
export type Point = { latitude: number; longitude: number };

/**
 * Verifica si un punto está dentro de un polígono usando el algoritmo de Ray Casting.
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

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

export const GUAYANA_POLYGON: Point[] = [
  { latitude: 8.5, longitude: -60.0 }, 
  { latitude: 8.0, longitude: -63.0 },
  { latitude: 7.5, longitude: -65.0 },
  { latitude: 6.0, longitude: -68.0 }, 
  { latitude: 1.0, longitude: -67.0 }, 
  { latitude: 1.0, longitude: -64.0 }, 
  { latitude: 4.0, longitude: -61.0 }, 
  { latitude: 7.0, longitude: -60.0 }
];
