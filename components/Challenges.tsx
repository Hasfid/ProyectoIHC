/**
 * Challenges.tsx — Sistema de competencias y retos de biodiversidad.
 *
 * Dos modos de operación:
 * - **Sin competencia activa**: muestra selector de temáticas con votación
 *   persistente (tabla `votos_tematica`) y expiración a 48h.
 * - **Con competencia activa**: muestra ranking de participaciones con
 *   sistema de likes, validación temática por IA, y gestión de participación.
 *
 * @module components/Challenges
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { identifySpecies } from '../lib/identifySpecies';
import { uploadMediaToSupabase } from '../lib/uploadMedia';

// ── Datos estáticos ──────────────────────────────────────────────────────────

/** Temáticas predefinidas para votación (símbolos naturales e icónicos) */
const PREDEFINED_THEMES = [
  { id: '1', animal: 'Guacamaya', icono: '🦜' },
  { id: '2', animal: 'Orquídea', icono: '🌸' },
  { id: '3', animal: 'Mono Araguato', icono: '🐒' },
  { id: '4', animal: 'Colibrí', icono: '🐦' },
  { id: '5', animal: 'Araguaney', icono: '🌳' },
];

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Competencia activa de biodiversidad */
type Competencia = {
  id: string;
  titulo: string;
  tema: string;
  descripcion: string;
  imagen_portada: string;
  fecha_fin: string;
  activa: boolean;
};

/** Participación en un reto con datos de perfil y ranking */
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
  rank?: number;
};

interface ChallengesProps {
  onClose: () => void;
}

/**
 * Pantalla de retos de biodiversidad.
 *
 * Gestiona el ciclo de vida completo: votación de temáticas →
 * creación de competencia → participación → ranking con likes.
 */
export default function Challenges({ onClose }: ChallengesProps) {
  const [activeComp, setActiveComp] = useState<Competencia | null>(null);
  const [participantes, setParticipantes] = useState<Participacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasVotedTheme, setHasVotedTheme] = useState<string | null>(null);
  const [themeVotes, setThemeVotes] = useState<Record<string, number>>({
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
  });
  
  useEffect(() => {
    fetchSessionAndActiveComp();
    fetchThemeVotes();
  }, []);

  /**
   * Carga votos globales de temáticas y limpia votos expirados (>48h).
   * También detecta si el usuario actual ya votó.
   */
  const fetchThemeVotes = async () => {
    try {
      // 1. Autolimpieza de votos expirados (más de 48h)
      const hace48Horas = new Date();
      hace48Horas.setHours(hace48Horas.getHours() - 48);

      // Los usuarios limpian sus propios votos expirados al entrar (o el sistema lo hace vía cron)
      if (currentUserId) {
        await supabase
          .from('votos_tematica')
          .delete()
          .eq('usuario_id', currentUserId)
          .lt('created_at', hace48Horas.toISOString());
      }

      // 2. Obtener votos globales
      const { data, error } = await supabase
        .from('votos_tematica')
        .select('tematica_id');
      
      if (error) throw error;

      const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
      data?.forEach(v => {
        if (counts[v.tematica_id] !== undefined) {
          counts[v.tematica_id]++;
        }
      });
      setThemeVotes(counts);

      // Si el usuario ya votó, marcarlo
      if (currentUserId) {
        const { data: myVote } = await supabase
          .from('votos_tematica')
          .select('tematica_id')
          .eq('usuario_id', currentUserId)
          .single();
        if (myVote) setHasVotedTheme(myVote.tematica_id);
      }
    } catch (err) {
      console.error('Error fetching theme votes:', err);
    }
  };

  const [myParticipation, setMyParticipation] = useState<Participacion | null>(null);
  const [showParticipationForm, setShowParticipationForm] = useState(false);
  const [userRecords, setUserRecords] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVotedInCompetition, setHasVotedInCompetition] = useState(false);

  /** Obtiene la sesión del usuario y carga la competencia activa */
  const fetchSessionAndActiveComp = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setCurrentUserId(session?.user?.id || null);
    fetchActiveCompetition();
  };

  /** Busca la competencia activa más reciente en Supabase */
  const fetchActiveCompetition = async () => {
    setLoading(true);
    try {
      // Buscamos si hay alguna competencia activa
      const { data, error } = await supabase
        .from('competencias')
        .select('*')
        .eq('activa', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const comp = data[0];
        setActiveComp(comp);
        fetchParticipantes(comp.id);
      } else {
        setActiveComp(null);
      }
    } catch (err) {
      console.error('Error fetching competition:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Carga participantes con ranking y estado de voto del usuario actual */
  const fetchParticipantes = async (compId: string) => {
    try {
      const { data, error } = await supabase
        .from('participaciones_reto')
        .select(`
          *,
          profiles:usuario_id (username, nombre, foto_perfil)
        `)
        .eq('competencia_id', compId)
        .order('votos_count', { ascending: false });

      if (error) throw error;

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

        setHasVotedInCompetition(participaciones.some(p => p.hasVoted));
      }

      // Lógica de Ranking con Empates
      let currentRank = 1;
      let lastVotes = -1;
      const rankedParticipants = participaciones.map((p, index) => {
        if (p.votos_count !== lastVotes) {
          currentRank = index + 1;
          lastVotes = p.votos_count;
        }
        return { ...p, rank: currentRank };
      });

      // Identificar mi participación
      const mine = rankedParticipants.find(p => p.usuario_id === currentUserId);
      setMyParticipation(mine || null);

      setParticipantes(rankedParticipants);

      // Si la competencia ya expiró, la finalizamos
      if (activeComp && new Date() >= new Date(activeComp.fecha_fin)) {
        handleEndCompetition(activeComp.id, rankedParticipants);
      }
    } catch (err) {
      console.error('Error fetching participantes:', err);
    }
  };

  /** Finaliza la competencia, resuelve empates aleatoriamente y cierra el evento */
  const handleEndCompetition = async (compId: string, currentParticipants: Participacion[]) => {
    if (currentParticipants.length === 0) {
      // Nadie participó, simplemente cerramos
      await supabase.from('competencias').update({ activa: false }).eq('id', compId);
      setActiveComp(null);
      return;
    }

    // Buscar el puntaje máximo
    const maxVotes = currentParticipants[0].votos_count;
    const topParticipants = currentParticipants.filter(p => p.votos_count === maxVotes);

    if (topParticipants.length > 1) {
      // HAY UN EMPATE
      // Seleccionar un ganador aleatorio
      const winner = topParticipants[Math.floor(Math.random() * topParticipants.length)];
      
      try {
        // Otorgar un voto fantasma (del sistema) para desempatar
        const { error: insertError } = await supabase.from('votos_reto').insert({
          participacion_id: winner.id,
          usuario_id: '00000000-0000-0000-0000-000000000000', // Un ID UUID nulo para representar al sistema
        });
        
        if (insertError) {
          // Si el constraint de UUID nos bloquea, actualizamos el contador manualmente a la fuerza
          await supabase
            .from('participaciones_reto')
            .update({ votos_count: winner.votos_count + 1 })
            .eq('id', winner.id);
        }

        Alert.alert('¡Empate Resuelto!', `Había un empate entre ${topParticipants.length} participantes con ${maxVotes} likes. ¡El desempate automático (voto aleatorio) ha elegido a ${winner.profiles.username} como ganador definitivo!`);
        
        // Recargar para reflejar el voto extra antes de cerrar
        const { data: updatedData } = await supabase
          .from('participaciones_reto')
          .select(`*, profiles:usuario_id (username, nombre, foto_perfil)`)
          .eq('competencia_id', compId)
          .order('votos_count', { ascending: false });
          
        if (updatedData) {
          setParticipantes(updatedData.map((p, i) => ({ ...p, rank: i === 0 ? 1 : 2 })));
        }
      } catch (e) {
        console.error('Error resolviendo empate:', e);
      }
    } else {
      Alert.alert('¡Competencia Finalizada!', `El ganador indiscutible es ${topParticipants[0].profiles.username} con ${maxVotes} likes. 🏆`);
    }

    // Cerramos la competencia
    await supabase.from('competencias').update({ activa: false }).eq('id', compId);
    setActiveComp(null);
    setThemeVotes({'1': 0, '2': 0, '3': 0, '4': 0, '5': 0});
  };

  /** Filtra registros del usuario que coincidan con la temática activa */
  const fetchUserRecords = async () => {
    if (!currentUserId || !activeComp) return;
    try {
      const { data, error } = await supabase
        .from('registros')
        .select('*')
        .eq('usuario_id', currentUserId);
      
      if (error) throw error;
      // Filtrar por temática (aproximado por nombre)
      const filtered = (data || []).filter(r => 
        r.nombre_tradicional?.toLowerCase().includes(activeComp.tema.toLowerCase().split(' ')[0])
      );
      setUserRecords(filtered);
    } catch (err) {
      console.error('Error fetching user records:', err);
    }
  };

  /** Envía una participación al reto con validación temática por keywords */
  const submitParticipation = async (record: any) => {
    if (!currentUserId || !activeComp) return;
    
    // VALIDACIÓN DE TEMÁTICA
    const temaLower = activeComp.tema.toLowerCase();
    const nombreLower = (record.nombre_tradicional || '').toLowerCase();
    
    // Definimos palabras clave por temática para una validación más flexible
    const keywordsMap: Record<string, string[]> = {
      'guacamaya': ['guacamaya', 'ara', 'loro', 'psittacidae'],
      'orquídea': ['orquídea', 'flor', 'orchid', 'catleya'],
      'mono araguato': ['mono', 'araguato', 'alouatta', 'primate'],
      'colibrí': ['colibrí', 'picaflor', 'trochilidae', 'zunzún'],
      'araguaney': ['araguaney', 'handroanthus', 'árbol', 'tabebuia']
    };

    // Buscamos si el nombre del registro contiene alguna palabra clave del tema actual
    const currentKeywords = keywordsMap[temaLower] || [temaLower];
    const isMatch = currentKeywords.some(kw => nombreLower.includes(kw));

    if (!isMatch) {
      Alert.alert(
        'Temática incorrecta',
        `Este registro (${record.nombre_tradicional}) no coincide con el reto actual de ${activeComp.tema}. Por favor, selecciona un registro que corresponda a la temática.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('participaciones_reto')
        .insert({
          competencia_id: activeComp.id,
          usuario_id: currentUserId,
          media_url: record.media_url,
          descripcion: `Registro de ${record.nombre_tradicional} para el reto.`
        });

      if (error) throw error;

      Alert.alert('¡Éxito!', 'Ya estás participando en el reto.');
      setShowParticipationForm(false);
      fetchParticipantes(activeComp.id);
    } catch (err) {
      console.error('Error submitting participation:', err);
      Alert.alert('Error', 'No se pudo subir tu participación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Permite al usuario subir una foto nueva para el reto, que es evaluada por la IA al instante */
  const handleUploadNewPhoto = async () => {
    if (!currentUserId || !activeComp) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita acceso a la galería.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Error', 'No se pudo leer la imagen.');
        return;
      }

      setIsSubmitting(true);
      Alert.alert('Analizando...', 'La IA está verificando si tu foto cumple con la temática del reto.');

      // 1. Identificar especie
      const aiResult = await identifySpecies(asset.base64);
      const topCandidate = aiResult.candidates[0];

      // 2. Validar temática
      const temaLower = activeComp.tema.toLowerCase();
      const nombreLower = (topCandidate.nombreTradicional || '').toLowerCase();
      
      const keywordsMap: Record<string, string[]> = {
        'guacamaya': ['guacamaya', 'ara', 'loro', 'psittacidae'],
        'orquídea': ['orquídea', 'flor', 'orchid', 'catleya'],
        'mono araguato': ['mono', 'araguato', 'alouatta', 'primate'],
        'colibrí': ['colibrí', 'picaflor', 'trochilidae', 'zunzún'],
        'araguaney': ['araguaney', 'handroanthus', 'árbol', 'tabebuia']
      };
      
      const currentKeywords = keywordsMap[temaLower] || [temaLower];
      const isMatch = currentKeywords.some(kw => nombreLower.includes(kw));

      if (!isMatch) {
        Alert.alert(
          'Validación fallida',
          `La IA detectó "${topCandidate.nombreTradicional}", pero el reto es de "${activeComp.tema}". ¡Sigue buscando!`
        );
        setIsSubmitting(false);
        return;
      }

      // 3. Subir imagen a Storage
      const mediaUrl = await uploadMediaToSupabase(asset.uri, 'image/jpeg');

      // 4. Crear registro en la BD (para que le quede en el perfil)
      const { data: newRecord, error: recordError } = await supabase
        .from('registros')
        .insert({
          usuario_id: currentUserId,
          media_url: mediaUrl,
          media_type: 'image',
          latitud: 0, // No GPS needed for challenge direct uploads
          longitud: 0,
          nombre_tradicional: topCandidate.nombreTradicional,
          nombre_cientifico: topCandidate.nombreCientifico,
          metadatos_especie: {
            peligrosidad: topCandidate.peligrosidad,
            endemismo: topCandidate.endemismo,
            certeza_ia: topCandidate.iaCerteza,
            descripcion_biologica: topCandidate.descripcionBiologica,
            curiosidades: topCandidate.curiosidades,
            mitos: topCandidate.mitos,
            all_candidates: aiResult.candidates
          }
        })
        .select()
        .single();

      if (recordError || !newRecord) {
        throw new Error('No se pudo guardar el registro.');
      }

      // 5. Inscribir automáticamente en el reto
      await submitParticipation(newRecord);

    } catch (err: any) {
      console.error('Error in handleUploadNewPhoto:', err);
      Alert.alert('Error', err.message || 'Ocurrió un error inesperado al procesar la foto.');
      setIsSubmitting(false);
    }
  };

  const removeParticipation = async () => {
    if (!myParticipation || !activeComp) return;

    Alert.alert(
      '¿Eliminar participación?',
      'Si eliminas tu foto actual para subir una mejor, PERDERÁS todos los likes que hayas acumulado. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sí, eliminar todo', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('participaciones_reto')
                .delete()
                .eq('id', myParticipation.id);
              
              if (error) throw error;
              fetchParticipantes(activeComp.id);
            } catch (err) {
              console.error('Error removing participation:', err);
            }
          }
        }
      ]
    );
  };

  /** Registra un like en una participación (constraint unique previene duplicados) */
  const handleVote = async (participacionId: string) => {
    if (!currentUserId) {
      Alert.alert('Acceso restringido', 'Debes iniciar sesión para votar.');
      return;
    }

    if (hasVotedInCompetition) {
      Alert.alert('Voto único', 'Ya utilizaste tu único voto en este reto.');
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
          Alert.alert('Ya votaste', 'Solo puedes dar un like por registro.');
        } else {
          throw error;
        }
        return;
      }

      if (activeComp) fetchParticipantes(activeComp.id);
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const [votingDeadline, setVotingDeadline] = useState<Date | null>(null);

  /** Crea una nueva competencia con la temática ganadora (duración: 7 días) */
  const startCompetition = async (themeName: string) => {
    try {
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + 7);

      const { data, error } = await supabase
        .from('competencias')
        .insert({
          titulo: `Gran Reto: ${themeName}`,
          tema: themeName,
          descripcion: `¡La comunidad ha elegido tras el periodo de espera! Sube tus mejores registros de ${themeName}.`,
          imagen_portada: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=80&w=2059&auto=format&fit=crop',
          fecha_fin: fechaFin.toISOString(),
          activa: true
        })
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        Alert.alert("¡Reto Iniciado!", `El periodo de inscripción terminó. ¡A competir con ${themeName}!`);
        setActiveComp(data[0]);
        setVotingDeadline(null);
      }
    } catch (err) {
      console.error('Error starting competition:', err);
    }
  };

  /** Alterna el voto del usuario en una temática (toggle: votar/quitar voto) */
  const handleVoteTheme = async (id: string) => {
    if (!currentUserId) {
      Alert.alert('Acceso restringido', 'Debes iniciar sesión para votar por una temática.');
      return;
    }

    try {
      if (hasVotedTheme === id) {
        // Quitar voto
        const { error } = await supabase
          .from('votos_tematica')
          .delete()
          .eq('usuario_id', currentUserId);
        if (error) throw error;
        setHasVotedTheme(null);
      } 
      else {
        // Votar o cambiar voto (Upsert: delete then insert)
        await supabase.from('votos_tematica').delete().eq('usuario_id', currentUserId);
        
        const { error } = await supabase
          .from('votos_tematica')
          .insert({
            usuario_id: currentUserId,
            tematica_id: id
          });
        if (error) throw error;
        setHasVotedTheme(id);
      }
      
      // Refrescar conteo global
      fetchThemeVotes();

    } catch (err) {
      console.error('Error handling theme vote:', err);
    }
  };

  /** Verifica si el deadline de votación expiró y lanza competencia o resetea */
  useEffect(() => {
    if (votingDeadline && new Date() >= votingDeadline) {
      const winnerId = Object.keys(themeVotes).find(id => themeVotes[id] >= 2);
      if (winnerId) {
        const theme = PREDEFINED_THEMES.find(t => t.id === winnerId);
        if (theme) startCompetition(theme.animal);
      } else {
        // Reinicio si no hay quórum
        setThemeVotes({'1': 0, '2': 0, '3': 0, '4': 0, '5': 0});
        setHasVotedTheme(null);
        setVotingDeadline(null);
        Alert.alert("Proceso Reiniciado", "No se mantuvo el quórum mínimo. Los votos se han reseteado.");
      }
    }
  }, [votingDeadline]);

  /** Renderiza una tarjeta de participante en el ranking */
  const renderRankingItem = ({ item }: { item: Participacion }) => (
    <View style={styles.rankCard}>
      <View style={styles.rankBadgeContainer}>
        <Text style={[styles.rankNumber, item.rank === 1 && styles.rankOne]}>
          {item.rank === 1 ? '🏆' : `#${item.rank}`}
        </Text>
      </View>
      
      <Image source={{ uri: item.media_url }} style={styles.rankImage} />
      
      <View style={styles.rankInfo}>
        <View style={styles.rankHeader}>
          <Image source={{ uri: item.profiles.foto_perfil || 'https://via.placeholder.com/150' }} style={styles.rankAvatar} />
          <Text style={styles.rankUser}>{item.profiles.username}</Text>
        </View>
        
        <View style={styles.voteRow}>
          <Text style={styles.votosLabel}>{item.votos_count} likes</Text>
          {item.usuario_id !== currentUserId && (
            <TouchableOpacity 
              style={[styles.likeBtn, item.hasVoted && styles.likeBtnActive]}
              onPress={() => handleVote(item.id)}
              disabled={item.hasVoted || (hasVotedInCompetition && !item.hasVoted)}
            >
              <Ionicons name={item.hasVoted ? "heart" : "heart-outline"} size={20} color={item.hasVoted ? "#fff" : (hasVotedInCompetition ? "#555" : "#a4ff44")} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.modalHeaderTitle}>Reto de Biodiversidad</Text>
        <View style={{width: 44}} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#a4ff44" style={{marginTop: 50}} />
      ) : activeComp ? (
        <ScrollView style={styles.content}>
          <BlurView intensity={20} tint="dark" style={styles.activeBanner}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={styles.activeTag}>COMPETENCIA ACTIVA</Text>
                <Text style={styles.activeTitle}>{activeComp.titulo}</Text>
                <Text style={styles.activeTema}>Temática: {activeComp.tema}</Text>
              </View>
              {/* Botón de DEV para inicializar/forzar fin (ya que pidieron "inicialices" el desempate manual si hace falta) */}
              <TouchableOpacity 
                style={{ backgroundColor: 'rgba(255,82,82,0.2)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ff5252' }}
                onPress={() => handleEndCompetition(activeComp.id, participantes)}
              >
                <Text style={{ color: '#ff5252', fontSize: 10, fontWeight: 'bold' }}>FORZAR FIN</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          <Text style={styles.sectionTitle}>Ranking General</Text>
          
          {/* Botón de Participación */}
          <View style={styles.participationContainer}>
            {myParticipation ? (
              <TouchableOpacity style={styles.manageBtn} onPress={removeParticipation}>
                <Ionicons name="trash-outline" size={20} color="#ff5252" />
                <Text style={styles.manageBtnText}>Eliminar mi participación (Reset votos)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.participateBtn} 
                onPress={() => {
                  fetchUserRecords();
                  setShowParticipationForm(true);
                }}
              >
                <Ionicons name="trophy" size={20} color="#000" />
                <Text style={styles.participateBtnText}>¡Participar en este reto!</Text>
              </TouchableOpacity>
            )}
          </View>

          {showParticipationForm && !myParticipation && (
            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Participa en: {activeComp.tema}</Text>
              
              <TouchableOpacity 
                style={styles.uploadNewBtn} 
                onPress={handleUploadNewPhoto}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color="#000" />
                    <Text style={styles.uploadNewBtnText}>Subir foto nueva para el reto</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.formSubtitle}>O elige uno de tus registros previos verificados:</Text>

              {userRecords.length === 0 ? (
                <Text style={styles.noRecordsText}>No tienes registros previos de esta temática.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recordPicker}>
                  {userRecords.map(r => (
                    <TouchableOpacity 
                      key={r.id} 
                      style={styles.recordOption}
                      onPress={() => submitParticipation(r)}
                      disabled={isSubmitting}
                    >
                      <Image source={{ uri: r.media_url }} style={styles.recordImage} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity onPress={() => setShowParticipationForm(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {participantes.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Ionicons name="images-outline" size={60} color="#333" />
              <Text style={styles.emptyText}>Nadie ha participado aún. ¡Sé el primero!</Text>
            </View>
          ) : (
            <View style={{paddingBottom: 40}}>
              {participantes.map((p) => (
                <View key={p.id}>{renderRankingItem({ item: p })}</View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.themeSelection}>
          <Text style={styles.themeTitle}>Elige la próxima temática</Text>
          <Text style={styles.themeSubtitle}>Vota por el animal que quieres que sea el centro del próximo reto regional.</Text>
          
          {votingDeadline && (
            <View style={styles.enrollmentBadge}>
              <Ionicons name="time" size={18} color="#000" />
              <Text style={styles.enrollmentText}>
                FASE DE INSCRIPCIÓN: El reto inicia en {Math.round((votingDeadline.getTime() - new Date().getTime()) / (1000 * 60 * 60))}h
              </Text>
            </View>
          )}

          <View style={styles.themeList}>
            {PREDEFINED_THEMES.map((t) => (
              <TouchableOpacity 
                key={t.id} 
                style={[
                  styles.themeItem, 
                  hasVotedTheme === t.id && styles.themeItemActive,
                ]}
                onPress={() => handleVoteTheme(t.id)}
              >
                <Text style={styles.themeIcon}>{t.icono}</Text>
                <Text style={styles.themeName}>{t.animal}</Text>
                <View style={styles.themeVoteBadge}>
                  <Text style={styles.themeVoteText}>{themeVotes[t.id]}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#051310' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(164, 255, 68, 0.1)',
  },
  closeBtn: { padding: 8 },
  modalHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1 },
  activeBanner: {
    margin: 20, padding: 20, borderRadius: 20,
    backgroundColor: 'rgba(164, 255, 68, 0.05)',
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.2)',
  },
  activeTag: { color: '#a4ff44', fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8 },
  activeTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  activeTema: { color: '#ccc', fontSize: 16, marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginHorizontal: 20, marginVertical: 16 },
  rankCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 20, marginBottom: 12, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  rankBadgeContainer: {
    width: 50, alignItems: 'center', justifyContent: 'center',
  },
  rankNumber: { color: '#888', fontSize: 16, fontWeight: 'bold' },
  rankOne: { fontSize: 24 },
  rankImage: { width: 80, height: 80, borderRadius: 8, marginVertical: 10 },
  rankInfo: { flex: 1, padding: 12 },
  rankHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rankAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  rankUser: { color: '#fff', fontSize: 14, fontWeight: '600' },
  voteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  votosLabel: { color: '#a4ff44', fontSize: 14, fontWeight: 'bold' },
  likeBtn: {
    backgroundColor: 'rgba(164, 255, 68, 0.1)', padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.3)',
  },
  likeBtnActive: { backgroundColor: '#a4ff44', borderColor: '#a4ff44' },
  themeSelection: { flex: 1, padding: 20, justifyContent: 'center' },
  themeTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center' },
  themeSubtitle: { color: '#888', fontSize: 16, textAlign: 'center', marginTop: 10, marginBottom: 30 },
  enrollmentBadge: {
    backgroundColor: '#a4ff44', flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, marginBottom: 20, gap: 8,
    justifyContent: 'center',
  },
  enrollmentText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  themeList: { gap: 12 },
  themeItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  themeItemActive: {
    borderColor: '#a4ff44',
    backgroundColor: 'rgba(164, 255, 68, 0.1)',
  },
  themeIcon: { fontSize: 24, marginRight: 16 },
  themeName: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  themeVoteBadge: {
    backgroundColor: 'rgba(164, 255, 68, 0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  themeVoteText: { color: '#a4ff44', fontWeight: 'bold' },
  emptyCenter: { alignItems: 'center', padding: 60 },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 16, fontSize: 16 },
  participationContainer: { paddingHorizontal: 20, marginBottom: 10 },
  participateBtn: {
    backgroundColor: '#a4ff44', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 16, borderRadius: 16, gap: 10,
  },
  participateBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ff5252', gap: 8,
  },
  manageBtnText: { color: '#ff5252', fontWeight: 'bold' },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)', margin: 20, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.2)',
  },
  formTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  formSubtitle: { color: '#ccc', fontSize: 14, marginTop: 15, marginBottom: 10, textAlign: 'center' },
  uploadNewBtn: { 
    backgroundColor: '#a4ff44', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8,
  },
  uploadNewBtnText: { color: '#000', fontWeight: 'bold', fontSize: 15 },
  recordPicker: { flexDirection: 'row', marginBottom: 15 },
  recordOption: { marginRight: 12 },
  recordImage: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  noRecordsText: { color: '#888', textAlign: 'center', marginBottom: 15 },
  cancelBtn: { alignSelf: 'center', padding: 10 },
  cancelBtnText: { color: '#888' },
});
