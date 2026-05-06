/**
 * Scanner.web.tsx — Escáner de biodiversidad para la versión web (PC).
 *
 * Flujo sincrónico (a diferencia del mobile que es offline-first):
 * 1. El usuario selecciona una imagen desde su PC
 * 2. Se identifica la especie con Gemini AI
 * 3. Se muestra un selector de candidatos con confianza (%)
 * 4. Al confirmar, se sube el media y se navega al formulario de registro
 *
 * @module components/Scanner.web
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { uploadMediaToSupabase } from '../lib/uploadMedia';
import { identifySpecies } from '../lib/identifySpecies';

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Fases del flujo del scanner web */
type Phase = 'idle' | 'identifying' | 'preview' | 'uploading';

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Scanner web para identificación de especies desde PC.
 *
 * A diferencia del scanner mobile (offline-first con drafts), este
 * componente ejecuta todo el flujo de forma sincrónica: seleccionar
 * imagen → identificar con IA → subir a Supabase → navegar al formulario.
 */
export default function Scanner() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [aiCandidates, setAiCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  /**
   * Abre el picker de imágenes y ejecuta la identificación con IA.
   * Lee la imagen como base64 vía FileReader (API web nativa).
   */
  const handlePick = async () => {
    if (phase !== 'idle' && phase !== 'preview') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPreviewUri(asset.uri);

    try {
      setPhase('identifying');

      // Convertir a base64 usando FileReader (API web)
      const resp = await fetch(asset.uri);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const aiResult = await identifySpecies(base64);
      const candidates = aiResult.candidates || [];
      setAiCandidates(candidates);
      if (candidates.length > 0) setSelectedCandidate(candidates[0]);

      setPhase('preview');
    } catch (err: any) {
      setPhase('idle');
      Alert.alert('Error', 'No se pudo identificar la especie.');
    }
  };

  /**
   * Confirma la selección: sube el media a Supabase y navega
   * al formulario de creación de registro con los datos pre-llenados.
   */
  const handleConfirm = async () => {
    if (!previewUri || !selectedCandidate) return;

    try {
      setPhase('uploading');
      const mimeType = previewUri.includes('video') || previewUri.includes('.mp4')
        ? 'video/mp4'
        : 'image/jpeg';
      const mediaUrl = await uploadMediaToSupabase(previewUri, mimeType);

      router.push({
        pathname: '/create-record',
        params: {
          mediaUrl,
          tipoMedia: mimeType.startsWith('video') ? 'video' : 'imagen',
          nombreTradicional: selectedCandidate.nombreTradicional,
          nombreCientifico: selectedCandidate.nombreCientifico,
          peligrosidad: selectedCandidate.peligrosidad,
          alimentacion: selectedCandidate.alimentacion,
          iaCerteza: selectedCandidate.iaCerteza.toString(),
        },
      });
    } catch (err: any) {
      Alert.alert('Error', 'Error al procesar el registro.');
      setPhase('preview');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name="desktop-outline" size={13} color="#004d40" />
        <Text style={styles.badgeText}>CENTRO DE ANÁLISIS · WEB</Text>
      </View>

      {phase === 'idle' && (
        <View style={styles.idleView}>
          <Text style={styles.title}>Cargar Registro</Text>
          <Text style={styles.subtitle}>
            Sube una foto o video para que la IA identifique la especie en la Guayana.
          </Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={handlePick}>
            <Ionicons name="cloud-upload" size={48} color="#004d40" />
            <Text style={styles.uploadText}>Seleccionar Archivo</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'identifying' && (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color="#004d40" />
          <Text style={styles.loadingText}>La IA está analizando tu archivo...</Text>
        </View>
      )}

      {phase === 'preview' && previewUri && (
        <View style={styles.previewView}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} />

          <Text style={styles.candidatesTitle}>Resultados del Análisis IA:</Text>
          <View style={styles.candidatesList}>
            {aiCandidates.map((cand, idx) => {
              const isSelected = selectedCandidate?.nombreTradicional === cand.nombreTradicional;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.candidateCard, isSelected && styles.candidateCardActive]}
                  onPress={() => setSelectedCandidate(cand)}
                >
                  <Text style={[styles.candidatePercent, isSelected && styles.candidatePercentActive]}>
                    {Math.round(cand.iaCerteza * 100)}%
                  </Text>
                  <Text style={[styles.candidateName, isSelected && styles.candidateNameActive]}>
                    {cand.nombreTradicional}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPhase('idle')}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirmar y Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === 'uploading' && (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color="#004d40" />
          <Text style={styles.loadingText}>Subiendo a la nube y preparando formulario...</Text>
        </View>
      )}
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9fafb', padding: 20, justifyContent: 'center', alignItems: 'center' },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e0f2f1', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 24 },
  badgeText:  { color: '#004d40', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

  idleView:   { alignItems: 'center', gap: 16 },
  title:      { fontSize: 28, fontWeight: 'bold', color: '#111' },
  subtitle:   { fontSize: 16, color: '#666', textAlign: 'center', maxWidth: 400, marginBottom: 12 },
  uploadBtn:  { width: 300, height: 200, backgroundColor: '#fff', borderRadius: 24, justifyContent: 'center', alignItems: 'center', gap: 12, borderColor: '#004d40', borderStyle: 'dashed', borderWidth: 2 },
  uploadText: { color: '#004d40', fontWeight: 'bold', fontSize: 18 },

  loadingView: { alignItems: 'center', gap: 16 },
  loadingText: { color: '#004d40', fontWeight: '600', fontSize: 16 },

  previewView:     { width: '100%', maxWidth: 500, alignItems: 'center' },
  previewImage:    { width: '100%', height: 300, borderRadius: 20, marginBottom: 20 },
  candidatesTitle: { fontSize: 14, fontWeight: 'bold', color: '#555', alignSelf: 'flex-start', marginBottom: 12 },
  candidatesList:  { flexDirection: 'row', gap: 12, marginBottom: 24, width: '100%' },

  candidateCard:          { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  candidateCardActive:    { borderColor: '#004d40', backgroundColor: '#e0f2f1' },
  candidatePercent:       { fontSize: 10, color: '#666', fontWeight: 'bold' },
  candidatePercentActive: { color: '#004d40' },
  candidateName:          { fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  candidateNameActive:    { color: '#004d40' },

  actionRow:   { flexDirection: 'row', gap: 16, width: '100%' },
  cancelBtn:   { flex: 1, padding: 16, alignItems: 'center' },
  cancelText:  { color: '#666', fontWeight: '600' },
  confirmBtn:  { flex: 2, backgroundColor: '#004d40', padding: 16, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
