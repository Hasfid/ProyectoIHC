/**
 * @module DiscoverScreen
 * Pantalla principal de "Descubrir".
 * Muestra el mapa interactivo de avistamientos y un acceso rápido al chat.
 * En web, integra el escáner como panel inferior del mapa.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import Map from '../../components/Map';
import WeatherWidget from '../../components/WeatherWidget';
import { i18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';

const getCategoryInfo = (item: any) => {
  const n = (item.nombre_tradicional || '').toLowerCase();
  if (n.includes('jaguar') || n.includes('tigre') || n.includes('chigüire') || n.includes('capibara') || n.includes('mono') || n.includes('oso') || n.includes('tonina') || n.includes('delfín'))
    return { icon: 'paw' as const, color: '#ff9100', label: '🐾 Mamífero' };
  if (n.includes('guacamaya') || n.includes('loro') || n.includes('ave') || n.includes('águila') || n.includes('tucán'))
    return { icon: 'paw' as const, color: '#00b0ff', label: '🐦 Ave' };
  if (n.includes('rana') || n.includes('sapo') || n.includes('serpiente') || n.includes('iguana') || n.includes('caimán'))
    return { icon: 'bug-outline' as const, color: '#ff5252', label: '🦎 Reptil/Anfibio' };
  if (n.includes('orquídea') || n.includes('flor') || n.includes('árbol') || n.includes('planta') || n.includes('helecho'))
    return { icon: 'leaf' as const, color: '#00e676', label: '🌿 Flora' };
  return { icon: 'leaf' as const, color: '#00e676', label: '🌿 Especie' };
};

const formatDate = (d: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const { theme } = useTheme();

  /** Abre el selector de imagen y navega a crear registro (web scanner) */
  const handleWebScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setScannerOpen(false);
    router.push({
      pathname: '/create-record',
      params: {
        mediaUrl: asset.uri,
        tipoMedia: (asset.mimeType ?? 'image/jpeg').startsWith('video') ? 'video' : 'imagen',
      },
    });
  };

  const handleMarkerSelect = (record: any | null) => {
    setSelectedRecord(record);
    // Close help menu when a pin is selected to avoid overlapping panels
    if (record) setHelpMenuOpen(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      <Map onMarkerSelect={handleMarkerSelect} />

      <WeatherWidget />

      {/* Menú Hamburguesa de ayuda - Web: esquina superior derecha */}
      {Platform.OS === 'web' && (
        <View style={styles.webHelpContainer}>
          <TouchableOpacity style={[styles.helpButtonWeb, { backgroundColor: theme.overlay }]} onPress={() => { setHelpMenuOpen(!helpMenuOpen); if (!helpMenuOpen) setSelectedRecord(null); }}>
            <Ionicons name={helpMenuOpen ? "close" : "help-circle"} size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Panel lateral derecho de ayuda */}
      {Platform.OS === 'web' && helpMenuOpen && !selectedRecord && (
        <View style={[styles.sideRibbonMenu, { backgroundColor: theme.surface, borderLeftColor: theme.border }]}>
          <View style={{ height: 40, justifyContent: 'center', marginBottom: 20 }}>
            <Text style={[styles.hamburgerTitle, { color: theme.text, marginBottom: 0 }]}>{i18n.t('help.title')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            
            <View style={styles.hamburgerItem}>
              <Ionicons name="leaf" size={20} color={theme.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('help.whatIsEcos')}</Text>
                <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{i18n.t('help.whatIsEcosDesc')}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.text, marginTop: 10, marginBottom: 12 }}>{i18n.t('help.screens')}</Text>

            {[
              { icon: 'compass-outline', titleKey: 'help.discoverTitle', descKey: 'help.discoverDesc' },
              { icon: 'scan-outline', titleKey: 'help.scannerTitle', descKey: 'help.scannerDesc' },
              { icon: 'videocam-outline', titleKey: 'help.observatoryTitle', descKey: 'help.observatoryDesc' },
              { icon: 'albums-outline', titleKey: 'help.recordsTitle', descKey: 'help.recordsDesc' },
              { icon: 'person-outline', titleKey: 'help.profileTitle', descKey: 'help.profileDesc' },
            ].map((s) => (
              <View key={s.titleKey} style={styles.hamburgerItem}>
                <Ionicons name={s.icon as any} size={20} color={theme.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t(s.titleKey)}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{i18n.t(s.descKey)}</Text>
                </View>
              </View>
            ))}

            <View style={[styles.hamburgerItem, { marginTop: 16 }]}>
              <Ionicons name="heart-outline" size={20} color={theme.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('help.mission')}</Text>
                <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{i18n.t('help.missionDesc')}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Panel lateral derecho de información del registro seleccionado */}
      {Platform.OS === 'web' && selectedRecord && (
        <View style={[styles.sideRibbonMenu, { backgroundColor: theme.surface, borderLeftColor: theme.border, zIndex: 1001 }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={[styles.hamburgerTitle, { color: theme.text, marginBottom: 0, flex: 1 }]} numberOfLines={1}>
              {(selectedRecord.nombre_tradicional || i18n.t('discover.speciesDefault')).toUpperCase()}
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedRecord(null)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '18', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="close" size={18} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Nombre científico */}
            {selectedRecord.nombre_cientifico ? (
              <Text style={{ fontSize: 13, fontStyle: 'italic', color: theme.primary, marginBottom: 12 }}>
                {selectedRecord.nombre_cientifico}
              </Text>
            ) : null}

            {/* Imagen */}
            {selectedRecord.media_url ? (
              <View style={styles.recordImageWrap}>
                <Image source={{ uri: selectedRecord.media_url }} style={styles.recordImage} resizeMode="cover" />
                <View style={styles.recordCategoryBadge}>
                  <Text style={styles.recordCategoryText}>{getCategoryInfo(selectedRecord).label}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.recordImageWrap, { backgroundColor: theme.primary + '12', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={48} color={theme.primary} />
                <Text style={{ fontSize: 12, color: theme.subtext, marginTop: 8 }}>{i18n.t('discover.noImage')}</Text>
              </View>
            )}

            {/* Stats Row */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <View style={[styles.recordStatBox, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Ionicons name="warning-outline" size={16} color={theme.primary} />
                <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '600', marginTop: 4 }}>{i18n.t('discover.dangerLevel')}</Text>
                <Text style={{ fontSize: 12, color: theme.text, fontWeight: '500' }}>{selectedRecord.peligrosidad || i18n.t('discover.notAvailable')}</Text>
              </View>
              <View style={[styles.recordStatBox, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <Ionicons name="earth-outline" size={16} color={theme.primary} />
                <Text style={{ fontSize: 10, color: theme.muted, fontWeight: '600', marginTop: 4 }}>{i18n.t('discover.feeding')}</Text>
                <Text style={{ fontSize: 12, color: theme.text, fontWeight: '500' }}>{selectedRecord.alimentacion || i18n.t('discover.notAvailable')}</Text>
              </View>
            </View>

            {/* Notas del avistamiento */}
            {selectedRecord.descripcion ? (
              <View style={styles.hamburgerItem}>
                <Ionicons name="document-text-outline" size={18} color={theme.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.sightingNotes')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{selectedRecord.descripcion}</Text>
                </View>
              </View>
            ) : null}

            {/* Coordenadas */}
            <View style={styles.hamburgerItem}>
              <Ionicons name="location-outline" size={18} color={theme.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.location')}</Text>
                <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>
                  Lat: {parseFloat(selectedRecord.latitud).toFixed(4)}  ·  Lng: {parseFloat(selectedRecord.longitud).toFixed(4)}
                </Text>
              </View>
            </View>

            {/* Fecha */}
            {selectedRecord.created_at ? (
              <View style={styles.hamburgerItem}>
                <Ionicons name="calendar-outline" size={18} color={theme.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.registrationDate')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{formatDate(selectedRecord.created_at)}</Text>
                </View>
              </View>
            ) : null}

            {/* Hábitat */}
            {selectedRecord.habitat ? (
              <View style={styles.hamburgerItem}>
                <Ionicons name="earth-outline" size={18} color={theme.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.habitat')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{selectedRecord.habitat}</Text>
                </View>
              </View>
            ) : null}

            {/* Nivel de riesgo */}
            {selectedRecord.nivel_riesgo ? (
              <View style={styles.hamburgerItem}>
                <Ionicons name="warning-outline" size={18} color="#ff9100" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.riskLevel')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{selectedRecord.nivel_riesgo}</Text>
                </View>
              </View>
            ) : null}

            {/* Datos enriquecidos IA — Descripción biológica */}
            {selectedRecord.metadatos_especie?.descripcion_biologica ? (
              <View style={[styles.hamburgerItem, { marginTop: 4 }]}>
                <Ionicons name="leaf-outline" size={18} color="#00e676" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.bioDescription')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{selectedRecord.metadatos_especie.descripcion_biologica}</Text>
                </View>
              </View>
            ) : null}

            {/* Datos enriquecidos IA — Curiosidades */}
            {selectedRecord.metadatos_especie?.curiosidades?.length > 0 ? (
              <View style={[styles.hamburgerItem, { marginTop: 4 }]}>
                <Ionicons name="search-outline" size={18} color={theme.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.curiosities')}</Text>
                  {selectedRecord.metadatos_especie.curiosidades.map((c: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', marginTop: 4 }}>
                      <Text style={{ color: theme.primary, marginRight: 6 }}>•</Text>
                      <Text style={[styles.hamburgerItemDesc, { color: theme.subtext, flex: 1 }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Datos enriquecidos IA — Mitos y leyendas */}
            {selectedRecord.metadatos_especie?.mitos ? (
              <View style={[styles.hamburgerItem, { marginTop: 4 }]}>
                <Ionicons name="book-outline" size={18} color="#ff9100" style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.hamburgerItemTitle, { color: theme.text }]}>{i18n.t('discover.mythsAndLegends')}</Text>
                  <Text style={[styles.hamburgerItemDesc, { color: theme.subtext }]}>{selectedRecord.metadatos_especie.mitos}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* Web: Botón de carga de registro integrado en el mapa */}
      {Platform.OS === 'web' && (
        <View style={styles.scannerButtonContainer}>
          {!scannerOpen ? (
            <TouchableOpacity
              style={[styles.scannerButton, { backgroundColor: theme.primary }]}
              onPress={() => setScannerOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={theme.primaryText} />
              <Text style={[styles.scannerButtonText, { color: theme.primaryText }]}>
                {i18n.t('scanner.uploadRecord')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.scannerPanel, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.scannerPanelCaption, { color: theme.subtext }]}>
                {i18n.t('scanner.scanCaption')}
              </Text>
              <TouchableOpacity
                style={[styles.scannerUploadBtn, { backgroundColor: theme.primary }]}
                onPress={handleWebScan}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload" size={20} color={theme.primaryText} />
                <Text style={[styles.scannerUploadText, { color: theme.primaryText }]}>
                  {i18n.t('scanner.chooseGallery')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setScannerOpen(false)}>
                <Text style={[styles.scannerCancelText, { color: theme.muted }]}>
                  {i18n.t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {Platform.OS !== 'web' && (
        <View style={styles.floatingButtonContainer}>
          {/* Botón de ayuda */}
          <TouchableOpacity style={styles.helpButton} onPress={() => router.push('/help')}>
            <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.blurContainer, { backgroundColor: theme.overlay }]}>
              <Ionicons name="help-circle" size={28} color={theme.primary} />
            </BlurView>
          </TouchableOpacity>
          {/* Botón de escáner (principal) */}
          <TouchableOpacity style={styles.floatingButton} onPress={() => router.push('/(tabs)/scanner')}>
            <BlurView intensity={90} tint={theme.mode === 'dark' ? 'dark' : 'light'} style={[styles.blurContainer, { backgroundColor: theme.overlay }]}>
              <Ionicons name="scan" size={28} color={theme.primary} />
            </BlurView>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backButton: {
    marginLeft: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonBlur: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    alignItems: 'center',
  },
  floatingButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  icon: {
    transform: [{ rotate: '-15deg' }, { translateX: -2 }, { translateY: 2 }],
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  webHelpContainer: {
    position: 'absolute',
    top: 36,
    right: 56,
    zIndex: 1000,
    alignItems: 'flex-end',
  },
  helpButtonWeb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sideRibbonMenu: {
    position: 'absolute',
    top: 20,
    right: 40,
    bottom: 20,
    width: 320,
    borderLeftWidth: 1,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    padding: 20,
    paddingTop: 16, // Alineado con el contenedor del botón (top: 36 - 20 = 16)
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  hamburgerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  hamburgerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  hamburgerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  hamburgerItemDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  helpButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 12,
  },
  // Scanner web styles
  scannerButtonContainer: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  scannerButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  scannerPanel: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 340,
  },
  scannerPanelCaption: {
    fontSize: 13,
    textAlign: 'center',
  },
  scannerUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  scannerUploadText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scannerCancelText: {
    fontSize: 13,
    marginTop: 2,
  },
  // Record info side panel styles
  recordImageWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  recordImage: {
    width: '100%',
    height: '100%',
  },
  recordCategoryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recordCategoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  recordStatBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
});
