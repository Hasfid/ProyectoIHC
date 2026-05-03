import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const markersData = [
  {
    id: '1',
    coordinate: { latitude: 5.5, longitude: -64.5 },
    image: 'https://images.unsplash.com/photo-1602491673966-2ce95fb7ab62?auto=format&fit=crop&q=80&w=200&h=200', 
    name: 'Jaguar'
  },
  {
    id: '2',
    coordinate: { latitude: 7.0, longitude: -62.0 },
    image: 'https://images.unsplash.com/photo-1552728089-57105261ab60?auto=format&fit=crop&q=80&w=200&h=200', 
    name: 'Guacamaya'
  },
  {
    id: '3',
    coordinate: { latitude: 4.5, longitude: -66.0 },
    image: 'https://images.unsplash.com/photo-1549471013-3364d7320600?auto=format&fit=crop&q=80&w=200&h=200', 
    name: 'Rana Dardo'
  }
];

const guayanaRegion = [
  [8.5, -60.0], 
  [8.0, -63.0],
  [7.5, -65.0],
  [6.0, -68.0], 
  [1.0, -67.0], 
  [1.0, -64.0], 
  [4.0, -61.0], 
  [7.0, -60.0]
];

const worldRegion = [
  [90, -180],
  [-90, -180],
  [-90, 180],
  [90, 180]
];

export default function MapWeb() {
  const [MapComponents, setMapComponents] = useState<any>(null);

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    Promise.all([
      import('react-leaflet'),
      import('leaflet')
    ]).then(([reactLeaflet, L]) => {
      // Import leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const { MapContainer, TileLayer, Marker, Popup, Polygon } = reactLeaflet;
      setMapComponents({ MapContainer, TileLayer, Marker, Popup, Polygon, L });
    });
  }, []);

  if (!MapComponents) {
    return <View style={styles.container} />;
  }

  const { MapContainer, TileLayer, Marker, Popup, Polygon, L } = MapComponents;

  const createIcon = (imageUrl: string) => {
    return L.divIcon({
      className: 'custom-icon',
      html: `<div style="width: 44px; height: 44px; border-radius: 22px; border: 2px solid white; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.3); background-color: #e0e0e0;"><img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  };

  return (
    <View style={styles.container}>
      <MapContainer 
        center={[5.0, -63.5]} 
        zoom={6} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Capa oscura que tapa todo el mundo EXCEPTO la guayana */}
        <Polygon 
          positions={[worldRegion, guayanaRegion]} 
          pathOptions={{ fillColor: 'black', fillOpacity: 0.7, stroke: false }} 
        />
        
        {/* Borde verde para la región de Guayana */}
        <Polygon 
          positions={guayanaRegion} 
          pathOptions={{ fillColor: 'transparent', color: '#00e676', weight: 2 }} 
        />

        {markersData.map((marker: any) => (
          <Marker 
            key={marker.id} 
            position={[marker.coordinate.latitude, marker.coordinate.longitude]}
            icon={createIcon(marker.image)}
          >
            <Popup>{marker.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  }
});
