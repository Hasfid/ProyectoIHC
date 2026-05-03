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

  const renderHUD = () => {
    if (!detectedSpecies) {
      return (
        <View style={styles.scanningState} pointerEvents="none">
          <Ionicons name="scan-outline" size={80} color="rgba(164, 255, 68, 0.5)" />
          <Text style={styles.scanningText}>Toca la pantalla para enfocar y escanear</Text>
        </View>
      );
    }
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Title Bar - Top Left */}
        <View style={styles.hudTopLeft}>
          <Text style={styles.hudTitle}>SISTEMA DE ANÁLISIS DE BIO-ESPÉCIES DE CAMPO - REGISTRO DE GUAYANA</Text>
        </View>

        {/* Center Reticle */}
        <View style={styles.reticleContainer}>
          <View style={[styles.reticleCorner, styles.reticleTL]} />
          <View style={[styles.reticleCorner, styles.reticleTR]} />
          <View style={[styles.reticleCorner, styles.reticleBL]} />
          <View style={[styles.reticleCorner, styles.reticleBR]} />

          {/* AI ID Box */}
          <View style={styles.hudIdBox}>
            <Text style={styles.hudIdText}>IDENTIFICACIÓN IA: ESCARABAJO FLORÍCOLA REY (Mecynorrhina torquata) (97.8%)</Text>
          </View>

          {/* Status Box */}
          <View style={styles.hudStatusBox}>
            <Text style={styles.hudLabel}>ESTADO:</Text>
            <Text style={styles.hudValue}>ENDÉMICO (SELVA TROPICAL GUAYANESA) | VULNERABLE</Text>
          </View>
          
          {/* Map Label */}
          <View style={styles.hudMapBox}>
            <Text style={styles.hudLabel}>RANGO DE HÁBITAT (SIG)</Text>
          </View>
        </View>

        {/* Bottom Left Summary */}
        <View style={styles.hudBottomLeft}>
          <Text style={styles.hudTitle}>'RESUMEN DE REGISTRO'</Text>
          <Text style={styles.hudSub}>ANÁLISIS DE ESPECIE</Text>
        </View>

        {/* Bottom Right Micro-data */}
        <View style={styles.hudBottomRight}>
          <Text style={styles.hudLabel}>MICRO-DATOS:</Text>
          <Text style={styles.hudValue}>ELEVACIÓN 420m | HUMEDAD 78%</Text>
        </View>

        {/* Peripheral Grid lines */}
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineVertical} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFill} 
        facing="back" 
        ref={cameraRef}
      />
      
      {/* Capa para simular el auto-foco y detección al tocar la pantalla */}
      <TouchableWithoutFeedback onPress={handleSimulateDetection}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>
      
      {renderHUD()}

      <View style={styles.bottomOverlay}>
        <TouchableOpacity style={styles.captureBtn} onPress={handleCreateRecord}>
          <Ionicons name="scan-outline" size={40} color="#a4ff44" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const neonGreen = '#a4ff44';
const darkTrans = 'rgba(0, 0, 0, 0.4)';

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  text: { color: '#fff', fontSize: 16 },
  container: { flex: 1, backgroundColor: '#000' },
  hudTopLeft: {
    position: 'absolute',
    top: 40,
    left: 20,
    borderLeftWidth: 2,
    borderColor: neonGreen,
    paddingLeft: 8,
  },
  hudTitle: { color: neonGreen, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  hudSub: { color: '#fff', fontSize: 10, marginTop: 2 },
  
  reticleContainer: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    width: '70%',
    height: '40%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: neonGreen,
  },
  reticleTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  reticleTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  reticleBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  reticleBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  
  hudIdBox: {
    position: 'absolute',
    top: -40,
    backgroundColor: darkTrans,
    borderWidth: 1,
    borderColor: neonGreen,
    padding: 6,
  },
  hudIdText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  
  hudStatusBox: {
    position: 'absolute',
    top: 20,
    right: -80,
    backgroundColor: darkTrans,
    borderWidth: 1,
    borderColor: neonGreen,
    padding: 6,
    width: 140,
  },
  hudMapBox: {
    position: 'absolute',
    bottom: 40,
    right: -60,
  },
  hudLabel: { color: neonGreen, fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  hudValue: { color: '#fff', fontSize: 9 },

  hudBottomLeft: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    borderLeftWidth: 2,
    borderColor: neonGreen,
    paddingLeft: 8,
  },
  hudBottomRight: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: darkTrans,
    borderWidth: 1,
    borderColor: neonGreen,
    padding: 6,
    width: 150,
  },
  
  gridLineHorizontal: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(164, 255, 68, 0.2)',
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '10%',
    width: 1,
    backgroundColor: 'rgba(164, 255, 68, 0.2)',
  },

  scanningState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    color: neonGreen,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  bottomOverlay: { 
    position: 'absolute', 
    bottom: 40, 
    left: 0,
    right: 0,
    alignItems: 'center', 
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: neonGreen,
  },
  permissionButton: { marginTop: 20, padding: 10, backgroundColor: neonGreen, borderRadius: 8 },
  permissionButtonText: { color: '#000', fontWeight: 'bold' }
});
