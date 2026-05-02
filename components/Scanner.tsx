import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

export default function Scanner() {
  const device = useCameraDevice('back');
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Necesitamos permisos de cámara para el Lente Inteligente.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Iniciando sensores ópticos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        // frameProcessor={...} <- Acá engancharemos el modelo TFLite de Edge AI
      />
      <View style={styles.overlay}>
        <Text style={styles.aiText}>[ IA ACTIVADA ] Analizando fauna en tiempo real...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  text: { color: '#fff', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { 
    position: 'absolute', 
    bottom: 50, 
    alignSelf: 'center', 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingVertical: 12, 
    paddingHorizontal: 24, 
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#4caf50'
  },
  aiText: { color: '#4caf50', fontWeight: 'bold', letterSpacing: 1 }
});
