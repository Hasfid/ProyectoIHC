/**
 * identifySpecies.ts — Identificación de especies con Gemini AI.
 *
 * Envía una imagen en base64 a la API de Gemini 2.0 Flash y recibe
 * hasta 3 candidatos de especies con nombre, peligrosidad, endemismo
 * y datos culturales de la Guayana venezolana.
 *
 * @module lib/identifySpecies
 */

// ── Configuración ────────────────────────────────────────────────────────────

const GEMINI_API_KEY = 'AIzaSyCHhNY4HbQtjY54jllPnUKf5gNv2XXVTk8';

const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * Prompt de sistema para Gemini. Instruye al modelo a actuar como
 * biólogo del Escudo Guayanés y devolver JSON estructurado.
 */
const SYSTEM_PROMPT = `Eres un experto biólogo especializado en el Escudo Guayanés (Bolívar, Amazonas y Esequibo). Tu prioridad absoluta es identificar especies autóctonas de esta región.

Analiza la imagen y provee hasta 3 candidatos posibles, priorizando siempre la fauna y flora de la Guayana venezolana.
Responde ÚNICAMENTE con un JSON válido, sin markdown ni etiquetas.

Estructura del JSON:
{
  "candidates": [
    {
      "nombreTradicional": "Nombre regional",
      "nombreCientifico": "Género y especie",
      "peligrosidad": "Baja/Media/Alta",
      "endemismo": "Sí (Guayana) / Sí (Venezuela) / No",
      "iaCerteza": 0.9,
      "descripcionBiologica": "Adaptaciones al entorno guayanés.",
      "curiosidades": ["Dato local 1", "Dato local 2"],
      "mitos": "Leyenda indígena local (Pemón, etc.)"
    }
  ]
}

iaCerteza debe ser un número decimal entre 0 y 1.`;

// ── Tipos ────────────────────────────────────────────────────────────────────

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

// ── Función principal ────────────────────────────────────────────────────────

/**
 * Identifica especies a partir de una imagen codificada en base64.
 *
 * Envía la imagen a Gemini y parsea la respuesta JSON. Maneja
 * rate limiting (429) con un mensaje amigable para el usuario.
 *
 * @param base64Image - Imagen en formato base64 (sin prefijo data:)
 * @returns Objeto con array de candidatos identificados
 * @throws Error con mensaje en español legible si falla la API o el parseo
 *
 * @example
 * ```ts
 * const result = await identifySpecies(base64String);
 * const best = result.candidates[0];
 * console.log(best.nombreTradicional, best.iaCerteza);
 * ```
 */
export async function identifySpecies(
  base64Image: string,
): Promise<IdentificationResult> {
  const payload = {
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        ],
      },
    ],
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        'Hay mucho tráfico en este momento. Esperá unos segundos e intentá de nuevo.',
      );
    }
    throw new Error(
      'El servicio de identificación no está disponible. Intentá más tarde.',
    );
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('No se obtuvo respuesta de la IA.');
  }

  // Limpiar en caso de que Gemini añada ```json ... ```
  const cleanText = textResponse
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleanText) as IdentificationResult;
  } catch {
    console.error('Error parseando respuesta de Gemini:', textResponse);
    throw new Error('Error procesando respuesta de la IA.');
  }
}
