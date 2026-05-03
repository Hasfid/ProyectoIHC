import React from 'react';
import { StyleSheet, View, Image, Dimensions } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';

const guayanaRegion = [
  { latitude: 8.5, longitude: -60.0 }, 
  { latitude: 8.0, longitude: -63.0 },
  { latitude: 7.5, longitude: -65.0 },
  { latitude: 6.0, longitude: -68.0 }, 
  { latitude: 1.0, longitude: -67.0 }, 
  { latitude: 1.0, longitude: -64.0 }, 
  { latitude: 4.0, longitude: -61.0 }, 
  { latitude: 7.0, longitude: -60.0 }
];

const worldRegion = [
  { latitude: 90, longitude: -180 },
  { latitude: -90, longitude: -180 },
  { latitude: -90, longitude: 180 },
  { latitude: 90, longitude: 180 }
];

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

export default function Map() {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude: 5.0,
        longitude: -63.5,
        latitudeDelta: 10.0,
        longitudeDelta: 10.0,
      }}
    >
      <Polygon
        coordinates={worldRegion}
        holes={[guayanaRegion]}
        fillColor="rgba(0, 0, 0, 0.7)"
        strokeColor="rgba(0, 0, 0, 0)"
      />
      
      <Polygon
        coordinates={guayanaRegion}
        fillColor="transparent"
        strokeColor="#00e676"
        strokeWidth={2}
      />

      {markersData.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={marker.coordinate}
          title={marker.name}
        >
          <View style={styles.markerContainer}>
            <Image source={{ uri: marker.image }} style={styles.markerImage} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  markerContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: '#e0e0e0',
  },
  markerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
