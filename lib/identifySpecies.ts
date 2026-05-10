/**
 * identifySpecies.ts — Identificación de especies vía Supabase Edge Functions.
 *
 * Envía una imagen en base64 a la Edge Function segura, la cual se comunica
 * con Gemini para devolver los candidatos identificados. Las API Keys
 * están protegidas en el backend.
 *
 * @module lib/identifySpecies
 */

import { supabase } from './supabase';

/** Candidato de especie retornado por la IA */
export interface SpeciesCandidate {
  nombreTradicional: string;
  nombreCientifico: string;
  peligrosidad: 'Baja' | 'Media' | 'Alta';
  endemismo: string;
  iaCerteza: number;
  descripcionBiologica: string;
  curiosidades: string[];
  mitos: string;
}

/** Respuesta completa de la identificación */
export interface IdentificationResult {
  candidates: SpeciesCandidate[];
}

/**
 * Identifica especies a partir de una imagen codificada en base64
 * delegando la carga y la seguridad a la Edge Function de Supabase.
 *
 * @param base64Image - Imagen en formato base64 (sin prefijo data:)
 * @returns Objeto con array de candidatos identificados
 * @throws Error con mensaje en español legible si falla la red o el backend
 */
export async function identifySpecies(
  base64Image: string,
): Promise<IdentificationResult> {
  const { data, error } = await supabase.functions.invoke('identify-species', {
    body: { base64Image },
  });

  if (error) {
    console.error('Error invocando Edge Function:', error.message);
    throw new Error('El servicio de identificación no está disponible en este momento.');
  }

  if (data?.error) {
    console.error('Error reportado por la Edge Function:', data.error, data.details);
    if (data.details?.includes('429')) {
      throw new Error('Hay mucho tráfico en este momento. Esperá unos segundos e intentá de nuevo.');
    }
    throw new Error('Ocurrió un error al procesar la imagen con la Inteligencia Artificial.');
  }

  if (!data || !data.candidates || data.candidates.length === 0) {
    throw new Error('La IA no detectó una especie válida. Asegúrate de que la imagen contenga fauna o flora que habite en Venezuela (nativa, endémica o invasora).');
  }

  return data as IdentificationResult;
}
