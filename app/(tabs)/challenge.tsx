import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

type Competencia = {
  id: string;
  titulo: string;
  tema: string;
  descripcion: string;
  imagen_portada: string;
  fecha_fin: string;
  activa: boolean;
};

type Participacion = {
  id: string;
  usuario_id: string;
  media_url: string;
  descripcion: string;
  votos_count: number;
  profiles: {
    username: string;
    nombre: string;
    foto_perfil: string;
  };
  hasVoted?: boolean;
};

export default function ChallengeScreen() {
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [selectedComp, setSelectedComp] = useState<Competencia | null>(null);
  const [participantes, setParticipantes] = useState<Participacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessionAndCompetencias();
  }, []);

  const fetchSessionAndCompetencias = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
    fetchCompetencias();
  };

  const fetchCompetencias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('competencias')
        .select('*')
        .eq('activa', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompetencias(data || []);
    } catch (err) {
      console.error('Error fetching competencias:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipantes = async (compId: string) => {
    setLoadingDetails(true);
    try {
      // 1. Obtener participaciones con perfiles
      const { data, error } = await supabase
        .from('participaciones_reto')
        .select(`
          *,
          profiles:usuario_id (username, nombre, foto_perfil)
        `)
        .eq('competencia_id', compId)
        .order('votos_count', { ascending: false });

      if (error) throw error;

      // 2. Si el usuario está logueado, ver qué votos ha dado
      let participaciones = data || [];
      if (currentUserId) {
        const { data: myVotes } = await supabase
          .from('votos_reto')
          .select('participacion_id')
          .eq('usuario_id', currentUserId);
        
        const votedIds = new Set(myVotes?.map(v => v.participacion_id));
        participaciones = participaciones.map(p => ({
          ...p,
          hasVoted: votedIds.has(p.id)
        }));
      }

      setParticipantes(participaciones);
    } catch (err) {
      console.error('Error fetching participantes:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleVote = async (participacionId: string) => {
    if (!currentUserId) {
      Alert.alert('Acceso restringido', 'Debes iniciar sesión para votar.');
      return;
    }

    try {
      const { error } = await supabase
        .from('votos_reto')
        .insert({
          participacion_id: participacionId,
          usuario_id: currentUserId
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Voto duplicado', 'Ya has votado por esta participación.');
        } else {
          throw error;
        }
        return;
      }

      // Actualizar UI localmente
      setParticipantes(prev => prev.map(p => 
        p.id === participacionId 
          ? { ...p, votos_count: p.votos_count + 1, hasVoted: true } 
          : p
      ));
    } catch (err) {
      console.error('Error voting:', err);
      Alert.alert('Error', 'No se pudo registrar tu voto.');
    }
  };

  const renderCompItem = ({ item }: { item: Competencia }) => (
    <TouchableOpacity 
      style={styles.compCard} 
      onPress={() => {
        setSelectedComp(item);
        fetchParticipantes(item.id);
      }}
    >
      <Image source={{ uri: item.imagen_portada }} style={styles.compImage} />
      <BlurView intensity={80} tint="dark" style={styles.compOverlay}>
        <View style={styles.compHeader}>
          <Text style={styles.compTag}>RETO ACTIVO</Text>
          <Text style={styles.compTitle}>{item.titulo}</Text>
        </View>
        <Text style={styles.compTema} numberOfLines={1}>Tema: {item.tema}</Text>
        <View style={styles.compFooter}>
          <Ionicons name="time-outline" size={14} color="#a4ff44" />
          <Text style={styles.compTime}>Finaliza: {new Date(item.fecha_fin).toLocaleDateString()}</Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );

  const renderParticipante = ({ item, index }: { item: Participacion, index: number }) => (
    <View style={styles.participantCard}>
      <Image source={{ uri: item.media_url }} style={styles.participantImage} />
      <View style={styles.participantInfo}>
        <View style={styles.participantHeader}>
          <Image 
            source={{ uri: item.profiles.foto_perfil || 'https://via.placeholder.com/150' }} 
            style={styles.participantAvatar} 
          />
          <Text style={styles.participantUser}>{item.profiles.username || item.profiles.nombre}</Text>
          {index === 0 && <Ionicons name="trophy" size={20} color="#FFD700" style={{marginLeft: 5}} />}
        </View>
        <Text style={styles.participantDesc} numberOfLines={2}>{item.descripcion}</Text>
        <View style={styles.voteRow}>
          <View style={styles.votosBadge}>
            <Text style={styles.votosCount}>{item.votos_count}</Text>
            <Text style={styles.votosLabel}>votos</Text>
          </View>
          <TouchableOpacity 
            style={[styles.voteButton, item.hasVoted && styles.voteButtonActive]}
            onPress={() => handleVote(item.id)}
            disabled={item.hasVoted}
          >
            <Ionicons 
              name={item.hasVoted ? "heart" : "heart-outline"} 
              size={18} 
              color={item.hasVoted ? "#fff" : "#a4ff44"} 
            />
            <Text style={[styles.voteButtonText, item.hasVoted && styles.voteButtonTextActive]}>
              {item.hasVoted ? 'Votado' : 'Votar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.bgBlob} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Competencias</Text>
        <Text style={styles.headerSubtitle}>Participá y votá en los retos regionales</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#a4ff44" />
        </View>
      ) : competencias.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="trophy-outline" size={80} color="#333" />
          <Text style={styles.emptyText}>No hay competencias activas en este momento.</Text>
        </View>
      ) : (
        <FlatList
          data={competencias}
          keyExtractor={item => item.id}
          renderItem={renderCompItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de Detalle de Competencia */}
      <Modal
        visible={!!selectedComp}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedComp(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedComp(null)} style={styles.closeBtn}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>{selectedComp?.titulo}</Text>
              <View style={{width: 40}} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalInfo}>
                <Text style={styles.modalTema}>Tema: {selectedComp?.tema}</Text>
                <Text style={styles.modalDesc}>{selectedComp?.descripcion}</Text>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Participantes</Text>
              </View>

              {loadingDetails ? (
                <ActivityIndicator size="large" color="#a4ff44" style={{marginTop: 50}} />
              ) : participantes.length === 0 ? (
                <View style={styles.emptyParticipants}>
                  <Ionicons name="people-outline" size={50} color="#555" />
                  <Text style={styles.emptyText}>Sé el primero en participar en este reto.</Text>
                  <TouchableOpacity style={styles.joinButton}>
                    <Text style={styles.joinButtonText}>Participar ahora</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={participantes}
                  keyExtractor={item => item.id}
                  renderItem={renderParticipante}
                  scrollEnabled={false} // Usamos el ScrollView del padre
                  contentContainerStyle={{paddingBottom: 40}}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#051310',
  },
  bgBlob: {
    position: 'absolute', top: -100, left: -50, width: 300, height: 300,
    backgroundColor: 'rgba(164, 255, 68, 0.05)', borderRadius: 150, filter: 'blur(60px)',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#a4ff44',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  compCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#111',
  },
  compImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  compOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  compTag: {
    color: '#a4ff44',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  compTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  compTema: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 4,
  },
  compFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  compTime: {
    color: '#888',
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#051310',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2a26',
  },
  closeBtn: {
    padding: 8,
  },
  modalHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  modalInfo: {
    padding: 20,
  },
  modalTema: {
    color: '#a4ff44',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#1a2a26',
    marginVertical: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  participantCard: {
    flexDirection: 'row',
    backgroundColor: '#0a1a16',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a2a26',
  },
  participantImage: {
    width: 120,
    height: '100%',
    resizeMode: 'cover',
  },
  participantInfo: {
    flex: 1,
    padding: 12,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  participantAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  participantUser: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  participantDesc: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 12,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  votosBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  votosCount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  votosLabel: {
    color: '#888',
    fontSize: 12,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(164, 255, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.3)',
    gap: 6,
  },
  voteButtonActive: {
    backgroundColor: '#a4ff44',
    borderColor: '#a4ff44',
  },
  voteButtonText: {
    color: '#a4ff44',
    fontSize: 12,
    fontWeight: 'bold',
  },
  voteButtonTextActive: {
    color: '#000',
  },
  emptyParticipants: {
    alignItems: 'center',
    padding: 40,
  },
  joinButton: {
    backgroundColor: '#a4ff44',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  joinButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
