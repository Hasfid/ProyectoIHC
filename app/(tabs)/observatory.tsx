import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
      user: {
        name: 'Carlos Mendoza',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100&h=100'
      }
    },
    {
      id: '2',
      title: 'Alerta: Conato de incendio',
      description: 'Por favor evitar la ruta este, hay un pequeño reporte de humo que los guardabosques ya están revisando.',
      time: 'Hace 5 horas',
      user: {
        name: 'Guardabosques Oficial',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100'
      }
    },
    {
      id: '3',
      title: 'Nueva especie de orquídea',
      description: 'El equipo de botánica acaba de catalogar una nueva orquídea en las zonas húmedas del sur.',
      time: 'Hace 1 día',
      user: {
        name: 'Ana Botánica',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100&h=100'
      }
    }
  ]);

  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostDesc, setNewPostDesc] = useState('');

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostDesc.trim()) return;
    
    const newPost = {
      id: Date.now().toString(),
      title: newPostTitle,
      description: newPostDesc,
      time: 'Justo ahora',
      user: {
        name: 'Tu Perfil',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100&h=100'
      }
    };

    setPosts([newPost, ...posts]);
    setIsCreatingPost(false);
    setNewPostTitle('');
    setNewPostDesc('');
  };

  return (
    <View style={styles.container}>
      {/* Custom Header para Top Tabs */}
      <View style={styles.customHeader}>
        <Text style={styles.customHeaderTitle}>Observatorio</Text>
      </View>
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
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleCommunity}>Comunidad</Text>
          <TouchableOpacity 
            style={styles.createPostBtn}
            onPress={() => setIsCreatingPost(!isCreatingPost)}
          >
            <Text style={styles.createPostBtnText}>
              {isCreatingPost ? 'Cancelar' : 'Crear publicación'}
            </Text>
          </TouchableOpacity>
        </View>

        {isCreatingPost && (
          <View style={styles.createPostForm}>
            <TextInput
              style={styles.inputTitle}
              placeholder="Título de la publicación..."
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.inputDesc}
              placeholder="Escribe los detalles aquí..."
              multiline
              numberOfLines={3}
              value={newPostDesc}
              onChangeText={setNewPostDesc}
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreatePost}>
              <Text style={styles.submitBtnText}>Publicar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.postsContainer}>
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <Image source={{ uri: post.user.avatar }} style={styles.postAvatar} />
                <View style={styles.postUserInfo}>
                  <Text style={styles.postUserName}>{post.user.name}</Text>
                  <Text style={styles.postTime}>{post.time}</Text>
                </View>
                <TouchableOpacity style={styles.followBtn}>
                  <Text style={styles.followBtnText}>Seguir</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.postTitle}>{post.title}</Text>
              <Text style={styles.postDescription}>{post.description}</Text>
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
  customHeader: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  customHeaderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
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
  sectionTitleCommunity: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  createPostBtn: {
    backgroundColor: '#004d40',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  createPostBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  createPostForm: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 8,
    marginBottom: 12,
  },
  inputDesc: {
    fontSize: 15,
    color: '#333',
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#004d40',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#eaeaea',
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  followBtn: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#004d40',
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
  }
});
