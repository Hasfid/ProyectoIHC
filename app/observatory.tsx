import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ObservatoryScreen() {
  const router = useRouter();

  // Datos simulados de la comunidad
  const [posts, setPosts] = useState([
    {
      id: '1',
      title: 'Avistamiento de Jaguar',
      description: 'Se avistó un jaguar cruzando el sendero principal cerca del río en la zona norte del parque esta mañana.',
      time: 'Hace 2 horas',
    },
    {
      id: '2',
      title: 'Alerta: Conato de incendio',
      description: 'Por favor evitar la ruta este, hay un pequeño reporte de humo que los guardabosques ya están revisando.',
      time: 'Hace 5 horas',
    },
    {
      id: '3',
      title: 'Nueva especie de orquídea',
      description: 'El equipo de botánica acaba de catalogar una nueva orquídea en las zonas húmedas del sur.',
      time: 'Hace 1 día',
    }
  ]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: 'Observatorio',
          headerTitleStyle: { color: '#111', fontWeight: 'bold' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color="#111" />
            </TouchableOpacity>
          )
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Sección de Transmisión en Vivo */}
        <Text style={styles.sectionTitle}>Transmisión en Vivo</Text>
        <View style={styles.liveCameraFrame}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?auto=format&fit=crop&q=80&w=800&h=400' }}
            style={styles.liveCameraImage}
          />
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        </View>

        {/* Sección de Comunidad */}
        <Text style={styles.sectionTitle}>Comunidad</Text>
        <View style={styles.postsContainer}>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postDescription}>{post.description}</Text>
              <Text style={styles.postTime}>{post.time}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} /> {/* Espacio para que el scroll termine limpio */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingTop: 100, // Espacio para el header transparente
    paddingHorizontal: 20,
  },
  backButton: {
    marginLeft: 16,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
    marginTop: 8,
  },
  liveCameraFrame: {
    width: '100%',
    height: 220,
    backgroundColor: '#3e2723', // Color madera oscura
    borderRadius: 16,
    borderWidth: 6,
    borderColor: '#6d4c41', // Estética madera minimalista
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 32,
  },
  liveCameraImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff5252',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  postsContainer: {
    gap: 16,
  },
  postCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaeaea',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  postDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  postTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  }
});
