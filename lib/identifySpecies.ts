const GEMINI_API_KEY = 'AIzaSyCHhNY4HbQtjY54jllPnUKf5gNv2XXVTk8';

export async function identifySpecies(base64Image: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Eres un experto biólogo de la región de Guayana, Venezuela. Identifica la especie animal o vegetal en la imagen. Responde ÚNICAMENTE con un JSON válido, sin formato markdown ni etiquetas. El JSON debe tener exactamente esta estructura:
{
  "nombreTradicional": "Nombre común",
  "nombreCientifico": "Nombre científico",
  "peligrosidad": "Alta / Media / Baja / Nula",
  "alimentacion": "Carnívoro / Herbívoro / Omnívoro / etc o N/A para plantas",
  "iaCerteza": 0.95
}
Si no puedes identificarlo con certeza, da tu mejor estimación. iaCerteza debe ser un número decimal entre 0 y 1.`
          },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: base64Image
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Error en IA: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("No se obtuvo respuesta de la IA.");
  }

  try {
    // Limpiar en caso de que Gemini añada ```json ... ```
    const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanText);
    return result;
  } catch (e) {
    console.error("Error parseando respuesta de Gemini:", textResponse);
    throw new Error("Error procesando respuesta de la IA.");
  }
}
