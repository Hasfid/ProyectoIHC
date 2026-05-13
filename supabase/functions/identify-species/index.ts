import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de CORS para llamadas desde el navegador o la app
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Image } = await req.json();

    if (!base64Image) {
      return new Response(JSON.stringify({ error: 'base64Image is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Configurar Supabase Client dentro de la Edge Function
    // Estas variables existen automáticamente en el entorno de Supabase Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 2. Traer el catálogo de especies de la BD (Implementación del Nivel 2)
    // Nota: Asumimos que vas a crear una tabla 'especies_guayana'.
    // Si la tabla no existe aún, esto devolverá error pero no romperá el código,
    // usará el texto por defecto.
    const { data: especies, error: dbError } = await supabase
      .from('especies_guayana')
      .select('nombre_comun, nombre_cientifico')
      .limit(100); // Límite por precaución de tokens

    let catalogoContext = "";
    if (!dbError && especies && especies.length > 0) {
      const lista = especies.map(e => `${e.nombre_comun} (${e.nombre_cientifico})`).join(', ');
      catalogoContext = `\n\nCATÁLOGO OFICIAL DE LA GUAYANA VENEZOLANA:\nLa base de datos actual contiene las siguientes especies registradas: [${lista}].\nSi la imagen coincide con alguna de estas o se asemeja demasiado, DEBES darle prioridad máxima a estas especies.`;
    }

    // 3. Prompt ultra-estricto MEJORADO (Nivel 1 + Nivel 2 Inyectado)
    const SYSTEM_PROMPT = `Eres un biologo con muchisimos años de experiencia y especializado con la biodiversidad de la region de la guayana venezolana.

Regla 1: SI LA IMAGEN NO CONTIENE UN ANIMAL O UNA PLANTA CLARAMENTE VISIBLE (por ejemplo: solo hay humanos, paisajes vacíos, muebles, carros, texto, u objetos inanimados), ESTÁS OBLIGADO A RESPONDER EXACTAMENTE CON: {"candidates": []}.
REGLA 2: JAMÁS identifiques a un humano como "Homo sapiens" ni inventes especies si no hay fauna o flora. Simplemente devuelve {"candidates": []}.
REGLA 3: FILTRO GEOGRÁFICO ESTRICTO: BAJO NINGUNA CIRCUNSTANCIA debes aceptar especies que no habiten de forma nativa, endémica o invasora en VENEZUELA. Si la imagen muestra una especie (ej: León africano, Pingüino emperador) que definitivamente NO existe en territorio venezolano (ni en cautiverio ni silvestre), ESTÁS OBLIGADO A RESPONDER EXACTAMENTE CON: {"candidates": []}. ¡Esto es un filtro de seguridad crítico!
REGLA 4: Si la foto es demasiado borrosa pero SE NOTA que es un animal/planta venezolano, responde con certeza baja (iaCerteza < 0.4) y avisa en la "descripcionBiologica".${catalogoContext}
REGLA 5: NO ALUCINES NI INVENTES INFORMACIÓN. En los campos de descripción, curiosidades y mitos, si no tienes datos precisos, verídicos y científicamente o culturalmente comprobables sobre la especie en la Guayana, es OBLIGATORIO dejarlos vacíos. Es preferible no tener información que tener información falsa.

REGLA 6: DEBES DEVOLVER UN ARRAY CON HASTA 5 OPCIONES ORDENADAS POR PROBABILIDAD. Si estás 100% seguro de una, devuelve 1. Ante la duda, dame 2 o 3 opciones para que el humano decida.

Estructura del JSON obligatorio:
{
  "candidates": [
    {
      "nombreTradicional": "Nombre regional guayanés (ej: Sapito Minero)",
      "nombreCientifico": "Género y especie",
      "peligrosidad": "Baja/Media/Alta",
      "endemismo": "Sí (Guayana) / Sí (Venezuela) / No",
      "iaCerteza": 0.9,
      "descripcionBiologica": "Describe brevemente a la especie con datos reales. Si usaste el Catálogo Oficial, menciónalo aquí.",
      "curiosidades": ["Dato REAL 1", "Dato REAL 2. Si no tienes datos 100% seguros, devuelve []"],
      "mitos": "Mito o leyenda local comprobable (Pemón, Yanomami, etc.). Si no existe ninguna documentada, devuelve string vacío ''."
    }
  ]
}`;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY en variables de entorno de Supabase.");
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],

    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Error:", errText);
      return new Response(JSON.stringify({ error: 'Error interno de Gemini', details: errText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('Gemini devolvió una respuesta vacía');
    }

    // Limpiar el JSON en caso de que Gemini devuelva bloques de markdown (```json)
    const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
