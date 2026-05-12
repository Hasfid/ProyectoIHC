/**
 * @module RecordsScreen
 * Galería global de avistamientos de la comunidad.
 * 
 * Funcionalidades:
 * - Filtros taxonómicos (Todos, Animales, Plantas).
 * - Búsqueda por nombre común o científico.
 * - Enriquecimiento de datos vía "IA" (Mock/Fallback) con mitos y leyendas guayanesas.
 * - Modo "Carpeta Científica" para visualizar detalles técnicos de cada especie.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, Image, TouchableOpacity,
  Modal, ActivityIndicator, ScrollView, Platform, Dimensions, TextInput, Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

type FilterType = 'Todos' | 'Animales' | 'Plantas';

export default function RecordsScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('Todos');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [loadingEnrichedData, setLoadingEnrichedData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSighting, setActiveSighting] = useState<any | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRecord) {
      setLoadingEnrichedData(true);
      getEnrichedData(selectedRecord).then((data) => {
        setEnrichedData(data);
        setLoadingEnrichedData(false);
      });
    } else {
      setEnrichedData(null);
      setLoadingEnrichedData(false);
    }
  }, [selectedRecord]);

  const handleDeleteRecord = async (recordId: string) => {
    Alert.alert(
      "Eliminar Registro",
      "¿Estás seguro de que deseas eliminar este avistamiento? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Eliminar", 
          style: "destructive", 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('registros')
                .delete()
                .eq('id', recordId);
              
              if (error) throw error;
              
              // Actualizar UI
              setRecords(prev => prev.filter(r => r.id !== recordId));
              setSelectedRecord(null);
              setActiveSighting(null);
              Alert.alert("Éxito", "Registro eliminado correctamente.");
            } catch (err: any) {
              Alert.alert("Error", "No se pudo eliminar el registro: " + err.message);
            }
          }
        }
      ]
    );
  };

  // ─── Fetch de Datos ────────────────────────────────────────────────────────
  /** Obtiene todos los registros de la base de datos ordenados por fecha */
  const fetchRecords = async () => {
    setLoading(true);
    try {
      // Fetch Global de todos los registros
      const { data, error } = await supabase
        .from('registros')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recargar los datos cuando la pantalla gana el foco (por ejemplo al volver de crear un registro)
  useFocusEffect(
    useCallback(() => {
      fetchRecords();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setCurrentUserId(session?.user?.id || null);
      });
    }, [])
  );

  // ─── Lógica de Mock y Filtrado ─────────────────────────────────────────────
  
  /** Determina si un espécimen es animal basándose en su alimentación o nombre (heuristic) */
  const isAnimal = (item: any) => {
    const alimentacion = (item.alimentacion || '').toLowerCase();
    if (alimentacion.includes('carnívoro') || alimentacion.includes('herbívoro') || alimentacion.includes('omnívoro')) {
      return true;
    }
    const nombre = (item.nombre_tradicional || '').toLowerCase();
    if (nombre.includes('orquídea') || nombre.includes('flor') || nombre.includes('árbol') || nombre.includes('planta') || nombre.includes('helecho')) {
      return false;
    }
    // Por defecto asume animal para el demo a menos que coincida con una planta
    return true; 
  };

  const filteredRecords = records.filter(item => {
    // Filtro por tipo (Animal/Planta)
    const matchesFilter = filter === 'Todos' || (filter === 'Animales' ? isAnimal(item) : !isAnimal(item));
    if (!matchesFilter) return false;

    // Filtro por búsqueda
    if (searchQuery.trim() === '') return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.nombre_tradicional || '').toLowerCase().includes(query) ||
      (item.nombre_cientifico || '').toLowerCase().includes(query)
    );
  });

  // Agrupar por nombre científico único para mayor precisión taxonómica
  const speciesCategories = Array.from(new Set(filteredRecords.map(r => r.nombre_cientifico || 'Especie No Identificada')))
    .map(sciName => {
      const allForSpecies = filteredRecords.filter(r => (r.nombre_cientifico || 'Especie No Identificada') === sciName);
      return {
        ...allForSpecies[0], // Datos representativos (usamos el primero)
        allSightings: allForSpecies, // Todos los registros de esta especie
        count: allForSpecies.length,
      };
    });

  /** Obtiene datos adicionales (biología, mitos) de la DB o vía Mock/IA */
  const getEnrichedData = async (item: any) => {
    if (item.metadatos_especie?.descripcion_biologica) {
      return {
        descripcion_biologica: item.metadatos_especie.descripcion_biologica,
        curiosidades: item.metadatos_especie.curiosidades || [],
        mitos_y_leyendas_guayanesas: item.metadatos_especie.mitos || 'Protector de la selva.'
      };
    }
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        const nombreLower = (item.nombre_tradicional || '').toLowerCase();
        
        if (nombreLower.includes('jaguar') || nombreLower.includes('tigre') || nombreLower.includes('onza')) {
          resolve({
            descripcion_biologica: 'El jaguar (Panthera onca) es el felino más grande de América y el tercero del mundo. Es un superdepredador endémico que habita principalmente en selvas tropicales densas.',
            curiosidades: [
              'Tiene la mordida más potente de todos los felinos grandes en relación a su tamaño.',
              'A diferencia de otros felinos, son excelentes nadadores y cazan frecuentemente en el agua.',
              'Su patrón de manchas (rosetas) es único en cada individuo, como una huella dactilar.'
            ],
            mitos_y_leyendas_guayanesas: 'En la cultura Pemón, el Jaguar (Kaikuse) es un espíritu guardián. Cuenta la leyenda que los grandes chamanes pueden transformarse en jaguares durante la noche para proteger a su tribu y castigar a quienes cazan por codicia y no por necesidad.',
          });
          return;
        }
        
        if (nombreLower.includes('guacamaya') || nombreLower.includes('loro')) {
          resolve({
            descripcion_biologica: 'Las guacamayas son aves del orden Psittaciformes, caracterizadas por su gran tamaño, plumaje colorido y picos fuertes diseñados para romper semillas duras.',
            curiosidades: [
              'Son monógamas y se emparejan de por vida.',
              'Poseen una inteligencia comparable a la de un niño de 3 a 4 años.',
              'Comen arcilla en las riberas de los ríos para neutralizar toxinas de algunas semillas.'
            ],
            mitos_y_leyendas_guayanesas: 'Para los pueblos caribes, las guacamayas eran mensajeras del sol. Su vuelo traía la luz a la tierra y sus plumas caídas se utilizaban en coronas para otorgar sabiduría y visión a los caciques locales.',
          });
          return;
        }

        if (nombreLower.includes('tonina') || nombreLower.includes('delfín')) {
          resolve({
            descripcion_biologica: 'La tonina o delfín rosado (Inia geoffrensis) es el delfín de río más grande del mundo. Posee un hocico largo y vibrisas sensoriales para detectar presas en aguas turbias.',
            curiosidades: [
              'Nacen de color gris y se vuelven rosados a medida que envejecen.',
              'Sus vértebras cervicales no están fusionadas, lo que les permite mover la cabeza 180 grados.',
              'Se orientan principalmente a través de la ecolocalización en las oscuras aguas del Orinoco.'
            ],
            mitos_y_leyendas_guayanesas: 'Las toninas están profundamente arraigadas en el folklore del Orinoco. El mito narra que son los habitantes de una civilización sumergida. Se dice que en noches de luna llena, se transforman en hermosas mujeres u hombres para seducir a los viajeros solitarios y llevarlos a su mundo submarino.',
          });
          return;
        }

        if (nombreLower.includes('chigüire') || nombreLower.includes('capibara')) {
          resolve({
            descripcion_biologica: 'El chigüire (Hydrochoerus hydrochaeris) es el roedor viviente más grande y pesado del mundo. Es una especie semiacuática altamente social.',
            curiosidades: [
              'Pueden permanecer sumergidos bajo el agua hasta por 5 minutos para esconderse de depredadores.',
              'Sus ojos, nariz y orejas están en la parte superior de la cabeza para ver y respirar mientras nadan.',
              'Tienen una relación simbiótica con muchas aves que se alimentan de sus parásitos.'
            ],
            mitos_y_leyendas_guayanesas: 'En los llanos y sabanas de Guayana, el chigüire es símbolo de abundancia. Una antigua fábula indígena cuenta que el chigüire fue el encargado de enseñar a las demás criaturas cómo nadar y encontrar agua durante la gran sequía.',
          });
          return;
        }
        
        // Fallback genérico
        resolve({
          descripcion_biologica: `El especimen catalogado como ${item.nombre_tradicional || 'esta especie'} posee adaptaciones biológicas fascinantes para sobrevivir en los diversos y complejos ecosistemas del escudo guayanés.`,
          curiosidades: [
            'Su presencia es un indicador biológico de la salud del ecosistema local.',
            'Forma parte de una intrincada red trófica que sostiene la biodiversidad de la región.',
            'Muchos de sus comportamientos y dinámicas poblacionales aún son objeto de estudio por biólogos locales.'
          ],
          mitos_y_leyendas_guayanesas: `A través de las generaciones, las comunidades originarias de la Amazonía y Guayana han observado a ${item.nombre_tradicional || 'esta especie'}, integrándola en su tradición oral como un espíritu protector de la selva y los ríos, enseñando el respeto por el equilibrio natural.`,
        });
      }, 1500); // Simulamos 1.5s de delay para la IA
    });
  };

  // ─── Renderizado ───────────────────────────────────────────────────────────

  const renderFilterChip = (type: FilterType) => {
    const isSelected = filter === type;
    return (
      <TouchableOpacity onPress={() => setFilter(type)}>
        <BlurView 
          intensity={isSelected ? 60 : 30} 
          tint={isSelected ? 'light' : 'dark'}
          style={[styles.chip, isSelected && styles.chipSelected]}
        >
          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
            {type}
          </Text>
        </BlurView>
      </TouchableOpacity>
    );
  };

  const renderRecordItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity 
        onPress={() => {
          setSelectedRecord(item);
          setActiveSighting(item); // Por defecto el primero
        }} 
        onLongPress={() => setPreviewImage(item.media_url)}
        delayLongPress={300}
        style={styles.cardContainer}
      >
        <BlurView intensity={40} tint="dark" style={styles.cardBlur}>
          <Image source={{ uri: item.media_url }} style={styles.cardImage} />
          <View style={styles.cardContent}>
            <View style={styles.speciesHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.nombre_tradicional}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.count} avistamientos</Text>
              </View>
            </View>
            
            {item.nombre_cientifico ? (
              <Text style={styles.cardScientific} numberOfLines={1}>{item.nombre_cientifico}</Text>
            ) : null}

            <View style={styles.cardFooter}>
              {/* Pie de tarjeta simplificado sin etiquetas de estado */}
            </View>
          </View>
        </BlurView>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Decorativo "Crystal-Tech" */}
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Registros</Text>
        <Text style={styles.headerSubtitle}>Tus descubrimientos en la Guayana</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="rgba(164, 255, 68, 0.5)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar especie o nombre..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {renderFilterChip('Todos')}
        {renderFilterChip('Animales')}
        {renderFilterChip('Plantas')}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a4ff44" />
          <Text style={styles.loadingText}>Sincronizando hallazgos...</Text>
        </View>
      ) : filteredRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="leaf-outline" size={64} color="rgba(164, 255, 68, 0.4)" />
          <Text style={styles.emptyText}>No hay descubrimientos aquí aún.</Text>
        </View>
      ) : (
        <FlatList
          data={speciesCategories}
          keyExtractor={(item) => item.nombre_cientifico || item.id.toString()}
          renderItem={renderRecordItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal de Detalle */}
      <Modal
        visible={!!selectedRecord}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecord(null)}
      >
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          {selectedRecord && (
            <View style={styles.folderModal}>
              {/* Botón de retroceso en esquina superior izquierda */}
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => setSelectedRecord(null)}
              >
                <Ionicons name="arrow-back" size={24} color="#a4ff44" />
              </TouchableOpacity>

              {/* Pestaña de Carpeta */}
              <View style={styles.folderTab}>
                <Ionicons name="folder-open" size={20} color="#a4ff44" />
                <Text style={styles.folderTabText}>EXPEDIENTE CIENTÍFICO</Text>
                <TouchableOpacity 
                  style={styles.closeFolderBtn} 
                  onPress={() => setSelectedRecord(null)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={styles.folderContent}>
                <TouchableOpacity 
                  activeOpacity={0.9}
                  onPress={() => setPreviewImage(activeSighting?.media_url || selectedRecord.media_url)}
                  style={styles.modalImageContainer}
                >
                  <Image 
                    source={{ uri: activeSighting?.media_url || selectedRecord.media_url }} 
                    style={styles.modalImage} 
                  />
                  
                  <View style={styles.modalHeaderInfo}>
                    <BlurView intensity={60} tint="dark" style={styles.modalHeaderBlur}>
                      <Text style={styles.modalTitle}>{selectedRecord.nombre_tradicional}</Text>
                      {selectedRecord.nombre_cientifico && (
                         <Text style={styles.modalScientific}>{selectedRecord.nombre_cientifico}</Text>
                      )}
                    </BlurView>

                    {currentUserId === activeSighting?.usuario_id && (
                      <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => handleDeleteRecord(activeSighting.id)}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ff5252" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.modalBody}>
                  {/* Stats Base */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Ionicons name="warning-outline" size={18} color="#a4ff44" />
                      <Text style={styles.statLabel}>Peligrosidad</Text>
                      <Text style={styles.statValue}>{selectedRecord.peligrosidad || 'N/A'}</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Ionicons name="earth-outline" size={18} color="#a4ff44" />
                      <Text style={styles.statLabel}>Endemismo</Text>
                      <Text style={styles.statValue}>{selectedRecord.alimentacion || 'No'}</Text>
                    </View>
                  </View>

                  {/* Datos Enriquecidos IA */}
                  {loadingEnrichedData ? (
                    <View style={styles.cultureSection}>
                      <ActivityIndicator color="#a4ff44" style={{ marginVertical: 40 }} />
                    </View>
                  ) : enrichedData ? (
                    <View style={styles.cultureSection}>
                        <View style={styles.cultureCard}>
                          <View style={styles.cultureHeader}>
                            <Ionicons name="leaf-outline" size={20} color="#00e676" />
                            <Text style={styles.cultureTitle}>Descripción Biológica</Text>
                          </View>
                          <Text style={styles.cultureText}>{enrichedData.descripcion_biologica}</Text>
                        </View>

                        <View style={styles.cultureCard}>
                          <View style={styles.cultureHeader}>
                            <Ionicons name="search-outline" size={20} color="#a4ff44" />
                            <Text style={styles.cultureTitle}>Curiosidades</Text>
                          </View>
                          {enrichedData.curiosidades.map((c: string, i: number) => (
                            <View key={i} style={styles.bulletRow}>
                              <View style={styles.bulletDot} />
                              <Text style={styles.cultureTextBullet}>{c}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.cultureCard}>
                          <View style={styles.cultureHeader}>
                            <Ionicons name="book-outline" size={20} color="#ff9100" />
                            <Text style={styles.cultureTitle}>Mitos y Leyendas</Text>
                          </View>
                          <Text style={styles.cultureText}>{enrichedData.mitos_y_leyendas_guayanesas}</Text>
                        </View>
                    </View>
                  ) : null}

                    {/* Galería de Muestreos (Siempre visible si hay datos) */}
                    <View style={styles.gallerySection}>
                      <Text style={styles.galleryTitle}>Muestreos en la Base de Datos ({selectedRecord.allSightings?.length || 0})</Text>
                      <View style={styles.galleryGrid}>
                        {selectedRecord.allSightings?.map((sighting: any, idx: number) => {
                          const dateStr = sighting.created_at ? new Date(sighting.created_at).toLocaleDateString() : 'Reciente';
                          return (
                            <TouchableOpacity 
                              key={sighting.id || `sight-${idx}`} 
                              style={[
                                styles.galleryItem, 
                                activeSighting?.id === sighting.id && styles.galleryItemActive
                              ]}
                              onPress={() => setActiveSighting(sighting)}
                              onLongPress={() => setPreviewImage(sighting.media_url)}
                              delayLongPress={250}
                            >
                              {sighting.media_url ? (
                                <Image source={{ uri: sighting.media_url }} style={styles.galleryImage} />
                              ) : (
                                <View style={[styles.galleryImage, { backgroundColor: '#333' }]} />
                              )}
                              <View style={styles.sightingOverlay}>
                                <Text style={styles.sightingDate}>{dateStr}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  
                  {(activeSighting?.descripcion || selectedRecord.descripcion) ? (
                    <View style={[styles.cultureCard, {marginTop: 20, marginBottom: 40}]}>
                      <Text style={styles.cultureTitle}>Notas del Avistamiento</Text>
                      <Text style={styles.cultureText}>
                        {activeSighting?.descripcion || selectedRecord.descripcion}
                      </Text>
                      <Text style={styles.sightingDetailDate}>
                        Registrado el: {activeSighting?.created_at ? new Date(activeSighting.created_at).toLocaleString() : 'Fecha no disponible'}
                      </Text>
                    </View>
                  ) : <View style={{height: 40}} />}

                </View>
              </ScrollView>
            </View>
          )}
        </BlurView>
      </Modal>

      {/* Quick Preview Modal (Long Press) */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <TouchableOpacity 
          style={styles.previewOverlay} 
          activeOpacity={1} 
          onPress={() => setPreviewImage(null)}
        >
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.previewCard}
            onPress={() => setPreviewImage(null)}
          >
            <Image source={{ uri: previewImage || '' }} style={styles.previewFullImage} />
            <View style={styles.previewInfo}>
              <Text style={styles.previewHint}>Tocar para cerrar</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#051310',
  },
  bgBlob1: {
    position: 'absolute', top: -100, right: -50, width: 300, height: 300,
    backgroundColor: 'rgba(0, 77, 64, 0.3)', borderRadius: 150, filter: 'blur(50px)',
  },
  bgBlob2: {
    position: 'absolute', bottom: -50, left: -100, width: 250, height: 250,
    backgroundColor: 'rgba(164, 255, 68, 0.1)', borderRadius: 125, filter: 'blur(40px)',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5,
  },
  headerSubtitle: { color: 'rgba(164, 255, 68, 0.7)', fontSize: 14, fontWeight: '500' },
  
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.1)',
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },

  filterRow: { 
    flexDirection: 'row', 
    gap: 10, 
    paddingHorizontal: 20, 
    marginBottom: 20 
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSelected: {
    borderColor: '#a4ff44',
  },
  chipText: {
    color: '#aaa', fontSize: 13, fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  loadingText: {
    color: '#a4ff44', fontSize: 14,
  },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.8, gap: 12,
  },
  emptyText: {
    color: '#888', fontSize: 16, textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20, paddingBottom: 100, gap: 16,
  },
  cardContainer: {
    borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBlur: {
    flexDirection: 'row', padding: 12, gap: 14,
  },
  cardImage: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cardContent: {
    flex: 1, justifyContent: 'center',
  },
  cardTitle: {
    color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 2,
  },
  cardScientific: {
    color: '#80cbc4', fontSize: 13, fontStyle: 'italic', marginBottom: 8,
  },
  cardComment: {
    color: '#e0e0e0', fontSize: 13, fontStyle: 'italic', marginTop: 0, marginBottom: 8,
  },
  speciesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(164, 255, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  countText: {
    color: '#a4ff44', fontSize: 10, fontWeight: 'bold',
  },
  specimenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  specimenText: {
    color: '#888', fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12,
  },
  dateText: {
    color: '#e0e0e0', fontSize: 11, fontWeight: '600',
  },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#a4ff44', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  aiText: {
    color: '#000', fontSize: 10, fontWeight: 'bold',
  },

  // Galería por especie
  gallerySection: { marginTop: 20, paddingHorizontal: 4 },
  galleryTitle: { color: '#a4ff44', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: {
    width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  galleryItemActive: {
    borderColor: '#a4ff44',
    borderWidth: 2,
  },
  galleryImage: { width: '100%', height: '100%' },
  sightingOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 2, alignItems: 'center',
  },
  sightingDate: { color: '#fff', fontSize: 8, fontWeight: 'bold' },
  sightingDetailDate: { color: '#a4ff44', fontSize: 10, marginTop: 8, opacity: 0.8 },

  // Quick Preview Styles
  previewOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  previewCard: {
    width: '90%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.3)',
    shadowColor: '#a4ff44',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  previewFullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'center',
  },
  previewHint: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Modal Styles (Folder style)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  folderModal: {
    backgroundColor: '#051310',
    marginTop: 60,
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.2)',
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.2)',
  },
  folderTab: {
    backgroundColor: '#051310',
    height: 40,
    width: 200,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(164, 255, 68, 0.2)',
    position: 'absolute',
    top: -40,
    left: 0,
  },
  folderTabText: {
    color: '#a4ff44',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeFolderBtn: {
    marginLeft: 'auto',
  },
  folderContent: {
    flex: 1,
  },
  modalImageContainer: {
    width: '100%', height: 300, position: 'relative',
  },
  modalImage: {
    width: '100%', height: '100%', resizeMode: 'cover',
  },
  closeModalBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  modalHeaderInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingRight: 20,
  },
  modalHeaderBlur: {
    flex: 1, padding: 20, paddingTop: 30, paddingBottom: 24,
  },
  deleteBtn: {
    backgroundColor: 'rgba(255,82,82,0.15)',
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,82,82,0.3)',
  },
  modalTitle: {
    color: '#fff', fontSize: 28, fontWeight: 'bold',
  },
  modalScientific: {
    color: '#a4ff44', fontSize: 16, fontStyle: 'italic', marginTop: 4,
  },
  modalBody: {
    padding: 20, paddingTop: 10,
  },
  statsRow: {
    flexDirection: 'row', gap: 12, marginBottom: 24, marginTop: -10,
  },
  statBox: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: '#888', fontSize: 11, textTransform: 'uppercase', marginTop: 6, marginBottom: 2, fontWeight: '600',
  },
  statValue: {
    color: '#fff', fontSize: 14, fontWeight: '500',
  },
  cultureSection: {
    gap: 16,
  },
  cultureCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.15)',
  },
  cultureHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  cultureTitle: {
    color: '#fff', fontSize: 16, fontWeight: 'bold',
  },
  cultureText: {
    color: '#ccc', fontSize: 14, lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a4ff44',
    marginTop: 8,
    marginRight: 10,
  },
  cultureTextBullet: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonTitle: {
    width: '50%',
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginBottom: 16,
  },
  skeletonText: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    marginBottom: 10,
  },
  skeletonTextShort: {
    width: '70%',
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
  },
});
