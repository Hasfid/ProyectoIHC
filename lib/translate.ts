/**
 * translate.ts — Servicio de traducción con Google Cloud Translation API.
 *
 * Delega la traducción a la Edge Function segura de Supabase para
 * proteger la API Key de Google Cloud.
 *
 * @module lib/translate
 */

import { supabase } from './supabase';

/**
 * Traduce un texto usando la Edge Function de Supabase.
 *
 * @param text - El texto a traducir.
 * @param targetLanguage - El código del idioma destino (ej. 'es', 'en', 'pt').
 * @returns El texto traducido.
 */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('translate-text', {
    body: { text, targetLanguage },
  });

  if (error) {
    console.error('Error invocando Edge Function de traducción:', error.message);
    throw new Error('El servicio de traducción no está disponible en este momento.');
  }

  if (data?.error) {
    console.error('Error en Edge Function de traducción:', data.error, data.details);
    throw new Error('Ocurrió un error al intentar traducir el texto.');
  }

  if (!data || !data.translatedText) {
    throw new Error('No se obtuvo una traducción válida.');
  }

  return data.translatedText;
}
