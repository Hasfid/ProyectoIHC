import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

export default function Scanner() {
  const router = useRouter();

  const handleUpload = () => {
    router.push('/create-record');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modo Laboratorio (PC)</Text>
      <Text style={styles.subtitle}>Sube la foto desde tu PC para que nuestra IA en la nube analice la especie.</Text>
      
      <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
        <Ionicons name="cloud-upload-outline" size={40} color="#004d40" />
        <Text style={styles.uploadText}>Cargar Registro</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f9fafb' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 40 },
  uploadBtn: { width: 220, height: 160, backgroundColor: '#e0f2f1', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#80cbc4', borderStyle: 'dashed' },
  uploadText: { color: '#004d40', marginTop: 12, fontWeight: '600', fontSize: 16 },
  preview: { width: 300, height: 300, borderRadius: 24, resizeMode: 'cover' }
});
