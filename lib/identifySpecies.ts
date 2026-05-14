/**
 * identifySpecies.ts — Identificación de especies directa a Gemini.
 *
 * Envía una imagen en base64 directamente a la API de Gemini desde el cliente,
 * inyectando el catálogo de especies de Guayana en el prompt para evitar
 * el uso de transferencias de la Edge Function de Supabase.
 *
 * @module lib/identifySpecies
 */

import { SPECIES_LIST } from './speciesList';

const GEMINI_API_KEY = 'AIzaSyAOYBZRskY8hIC1WiBPo9hswxICHZsQKbM';

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
 * llamando directamente a la API de Gemini.
 *
 * @param base64Image - Imagen en formato base64 (sin prefijo data:)
 * @returns Objeto con array de candidatos identificados
 * @throws Error con mensaje en español legible si falla la red
 */
export async function identifySpecies(
  base64Image: string,
): Promise<IdentificationResult> {
  const speciesNames = SPECIES_LIST.map(s => `${s.nombre_comun} (${s.nombre_cientifico})`).join(', ');

  const prompt = `Actúa como un biólogo experto en la biodiversidad de la región Guayana en Venezuela. 
Analiza la imagen adjunta e identifica si hay un animal o planta.

IMPORTANTE: Revisa si la especie se encuentra en esta lista oficial del catálogo:
[${speciesNames}]

Genera entre 3 y 5 posibles candidatos de especies que podrían corresponder a la imagen, ordenados de mayor a menor probabilidad.
Si la especie está en la lista, utiliza EXACTAMENTE el nombre común y científico de la lista.
Si NO está en la lista, pero puedes identificarla de todas formas, proporciona la información correspondiente.
Si no es un animal ni una planta, o no puedes identificar nada de forma razonable, devuelve un arreglo de candidates vacío.

Devuelve la respuesta ESTRICTAMENTE en formato JSON usando la siguiente estructura exacta:
{
  "candidates": [
    {
      "nombreTradicional": "Nombre común",
      "nombreCientifico": "Nombre científico",
      "peligrosidad": "Baja" | "Media" | "Alta",
      "endemismo": "Información sobre su alimentación o si es endémica",
      "iaCerteza": 95,
      "descripcionBiologica": "Breve descripción biológica y hábitat",
      "curiosidades": ["Dato 1", "Dato 2"],
      "mitos": "Algún mito o leyenda local (o 'Ninguno conocido')"
    }
  ]
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.2
    }
  };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Hay mucho tráfico en este momento. Esperá unos segundos e intentá de nuevo.');
      }
      throw new Error(`Error de red: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const textResp = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResp) {
       throw new Error('Respuesta inválida de la IA');
    }

    const result = JSON.parse(textResp) as IdentificationResult;
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('La IA no detectó una especie válida. Asegúrate de que la imagen contenga fauna o flora.');
    }

    return result;
  } catch (err: any) {
    console.error('Error procesando IA:', err);
    throw new Error(err.message || 'Error desconocido al procesar con la IA');
  }
}
