import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const [detectedSpecies, setDetectedSpecies] = useState<any>(null);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Cargando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.text}>Necesitamos tu permiso para usar la cámara</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Otorgar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSimulateDetection = () => {
    // Simulamos que al apuntar y hacer foco (tocar la pantalla), la IA detecta la especie
    setDetectedSpecies({ id: '1', name: 'Jaguar', science: 'Panthera onca', match: '98%' });
  };

  const handleCreateRecord = () => {
    if (detectedSpecies) {
      router.push({ pathname: '/create-record', params: { autoFill: 'true', speciesId: detectedSpecies.id } });
    } else {
      router.push('/create-record'); // Carga manual si aún no detectó
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFill} 
        facing="back" 
        ref={cameraRef}
      />
      
      {/* Capa invisible para simular el auto-foco y detección al tocar la pantalla */}
      <TouchableWithoutFeedback onPress={handleSimulateDetection}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      
      {detectedSpecies && (
        <View style={styles.topOverlay}>
          <Text style={styles.aiDetectedText}>Especie Detectada: {detectedSpecies.name}</Text>
          <Text style={styles.aiScienceText}>{detectedSpecies.science} - {detectedSpecies.match} similitud</Text>
        </View>
      )}

      <View style={styles.bottomOverlay}>
        <TouchableOpacity style={styles.captureBtn} onPress={handleCreateRecord}>
          <Ionicons name="scan-circle" size={64} color="#00e676" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  text: { color: '#fff', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#000' },
  topOverlay: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4caf50',
    alignItems: 'center'
  },
  aiDetectedText: { color: '#4caf50', fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  aiScienceText: { color: '#fff', fontSize: 14, fontStyle: 'italic' },
  bottomOverlay: { 
    position: 'absolute', 
    bottom: 50, 
    left: 0,
    right: 0,
    alignItems: 'center', 
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  permissionButton: { marginTop: 20, padding: 10, backgroundColor: '#4caf50', borderRadius: 8 },
  permissionButtonText: { color: '#fff', fontWeight: 'bold' }
});
