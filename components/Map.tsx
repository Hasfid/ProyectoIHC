import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Image, Dimensions, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import MapView, { Marker, Polygon, Callout } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

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

export default function Map() {
  const [records, setRecords] = useState<any[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [enrichedData, setEnrichedData] = useState<any>(null);
  const [loadingEnrichedData, setLoadingEnrichedData] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase.from('registros').select('*');
      if (error) throw error;
      const validRecords = (data || []).filter(r => r.latitud != null && r.longitud != null);
      setRecords(validRecords);
    } catch (err) {
      console.error('Error fetching map records:', err);
    }
  };

  useEffect(() => {
    if (selectedRecord) {
      setLoadingEnrichedData(true);
      setEnrichedData(null);
      getEnrichedData(selectedRecord.nombre_tradicional).then((data) => {
        setEnrichedData(data);
        setLoadingEnrichedData(false);
      });
    } else {
      setEnrichedData(null);
      setLoadingEnrichedData(false);
    }
  }, [selectedRecord]);

  const getCategoryIcon = (item: any) => {
    const nombre = (item.nombre_tradicional || '').toLowerCase();
    const alimentacion = (item.alimentacion || '').toLowerCase();

    if (nombre.includes('jaguar') || nombre.includes('tigre') || nombre.includes('tonina') || nombre.includes('delfín') || nombre.includes('chigüire') || nombre.includes('capibara') || nombre.includes('mono') || nombre.includes('oso')) {
      return { name: 'paw', color: '#ff9100' };
    }
    if (nombre.includes('guacamaya') || nombre.includes('loro') || nombre.includes('ave') || nombre.includes('águila') || nombre.includes('tucán')) {
      return { name: 'bird', color: '#00b0ff' };
    }
    if (nombre.includes('rana') || nombre.includes('sapo') || nombre.includes('serpiente') || nombre.includes('iguana') || nombre.includes('caimán')) {
      return { name: 'snake', color: '#ff5252' };
    }
    if (nombre.includes('mariposa') || nombre.includes('araña') || nombre.includes('escarabajo') || nombre.includes('hormiga')) {
      return { name: 'bug', color: '#e040fb' };
    }
    if (nombre.includes('orquídea') || nombre.includes('flor') || nombre.includes('árbol') || nombre.includes('planta') || nombre.includes('helecho')) {
      return { name: 'leaf', color: '#00e676' };
    }
    if (alimentacion.includes('carnívoro') || alimentacion.includes('herbívoro')) {
      return { name: 'paw', color: '#ff9100' }; 
    }
    return { name: 'leaf', color: '#00e676' }; 
  };

  const getEnrichedData = async (nombre: string) => {
    return new Promise<any>((resolve) => {
      setTimeout(() => {
        const nombreLower = (nombre || '').toLowerCase();
        
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
        
        resolve({
          descripcion_biologica: `El especimen catalogado como ${nombre || 'esta especie'} posee adaptaciones biológicas fascinantes para sobrevivir en los diversos y complejos ecosistemas del escudo guayanés.`,
          curiosidades: [
            'Su presencia es un indicador biológico de la salud del ecosistema local.',
            'Forma parte de una intrincada red trófica que sostiene la biodiversidad de la región.',
            'Muchos de sus comportamientos y dinámicas poblacionales aún son objeto de estudio por biólogos locales.'
          ],
          mitos_y_leyendas_guayanesas: `A través de las generaciones, las comunidades originarias de la Amazonía y Guayana han observado a ${nombre || 'esta especie'}, integrándola en su tradición oral como un espíritu protector de la selva y los ríos, enseñando el respeto por el equilibrio natural.`,
        });
      }, 1000); 
    });
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 4.8,
          longitude: -64.0,
          latitudeDelta: 45.0,
          longitudeDelta: 45.0,
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

        {records.map((marker) => {
          const iconConfig = getCategoryIcon(marker);
          const lat = parseFloat(marker.latitud);
          const lng = parseFloat(marker.longitud);

          // Si por alguna razón lat o lng no son números válidos, no renderizamos el pin
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onCalloutPress={() => setSelectedRecord(marker)}
            >
              <View style={[styles.markerContainer, { borderColor: iconConfig.color }]}>
                <MaterialCommunityIcons name={iconConfig.name as any} size={20} color={iconConfig.color} />
              </View>
              
              <Callout tooltip>
                <View style={styles.calloutCard}>
                  <Image source={{ uri: marker.media_url }} style={styles.calloutImage} />
                  <View style={styles.calloutContent}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>{marker.nombre_tradicional}</Text>
                    <View style={styles.calloutBtn}>
                      <Text style={styles.calloutBtnText}>Ver detalles</Text>
                    </View>
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Modal de Detalle (Glassmorphism Crystal-Tech) */}
      <Modal
        visible={!!selectedRecord}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedRecord(null)}
      >
        <BlurView intensity={90} tint="dark" style={styles.modalOverlay}>
          {selectedRecord && (
            <View style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.modalImageContainer}>
                  <Image source={{ uri: selectedRecord.media_url }} style={styles.modalImage} />
                  <TouchableOpacity 
                    style={styles.closeModalBtn} 
                    onPress={() => setSelectedRecord(null)}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  
                  <View style={styles.modalHeaderInfo}>
                    <BlurView intensity={60} tint="dark" style={styles.modalHeaderBlur}>
                      <Text style={styles.modalTitle}>{selectedRecord.nombre_tradicional}</Text>
                      {selectedRecord.nombre_cientifico && (
                         <Text style={styles.modalScientific}>{selectedRecord.nombre_cientifico}</Text>
                      )}
                    </BlurView>
                  </View>
                </View>

                <View style={styles.modalBody}>
                  {selectedRecord.descripcion ? (
                    <Text style={styles.userComment}>
                      <Text style={{fontWeight: 'bold'}}>Mi nota: </Text>
                      {selectedRecord.descripcion}
                    </Text>
                  ) : null}

                  {loadingEnrichedData ? (
                    <View style={styles.cultureSection}>
                      {[1, 2].map((key) => (
                        <View key={key} style={styles.skeletonCard}>
                          <View style={styles.skeletonTitle} />
                          <View style={styles.skeletonText} />
                          <View style={styles.skeletonText} />
                          <View style={styles.skeletonTextShort} />
                        </View>
                      ))}
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
                  <View style={{height: 40}} />
                </View>
              </ScrollView>
            </View>
          )}
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutCard: {
    width: 200,
    backgroundColor: 'rgba(10, 25, 20, 0.95)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#a4ff44',
    flexDirection: 'row',
    alignItems: 'center',
  },
  calloutImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#333',
    marginRight: 10,
  },
  calloutContent: {
    flex: 1,
    justifyContent: 'center',
  },
  calloutTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  calloutBtn: {
    backgroundColor: 'rgba(164, 255, 68, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(164, 255, 68, 0.5)',
  },
  calloutBtnText: {
    color: '#a4ff44',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // Modal Styles (Replicados de records.tsx)
  modalOverlay: { flex: 1 },
  modalContent: { flex: 1, backgroundColor: 'transparent' },
  modalImageContainer: { width: '100%', height: 350, position: 'relative' },
  modalImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  closeModalBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  modalHeaderInfo: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalHeaderBlur: { padding: 20, paddingTop: 30, paddingBottom: 24 },
  modalTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  modalScientific: { color: '#a4ff44', fontSize: 16, fontStyle: 'italic', marginTop: 4 },
  modalBody: { padding: 20, paddingTop: 10 },
  userComment: { color: '#e0e0e0', fontSize: 14, fontStyle: 'italic', marginBottom: 20, paddingHorizontal: 4 },
  cultureSection: { gap: 16 },
  cultureCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(164, 255, 68, 0.15)',
  },
  cultureHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cultureTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cultureText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', marginBottom: 10, paddingRight: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a4ff44', marginTop: 8, marginRight: 10 },
  cultureTextBullet: { color: '#ccc', fontSize: 14, lineHeight: 22, flex: 1 },
  skeletonCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonTitle: { width: '50%', height: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, marginBottom: 16 },
  skeletonText: { width: '100%', height: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 10 },
  skeletonTextShort: { width: '70%', height: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
});
