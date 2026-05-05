import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

/**
 * Sube un archivo multimedia al bucket público 'multimedia_especies'.
 * Maneja las diferencias de red entre Web (donde fetch.blob funciona perfecto)
 * y Móvil (donde requiere FileSystem para evitar Network Request Failed).
 */
export async function uploadMediaToSupabase(
  localUri: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const extension = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
  const filePath = `public/registro_${Date.now()}.${extension}`;
  
  let fileData: any;

  if (Platform.OS === 'web') {
    // 1a. En la web (PC), fetch().blob() es la API estándar del navegador y funciona perfecto
    const response = await fetch(localUri);
    fileData = await response.blob();
  } else {
    // 1b. En Móvil (Android/iOS), fetch(file://...) falla. Usamos FileSystem + Buffer nativo
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });
    fileData = decode(base64);
  }

  // 2. Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('multimedia_especies')
    .upload(filePath, fileData, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Error al subir: ${uploadError.message}`);
  }

  // 3. Obtener URL pública
  const { data } = supabase.storage
    .from('multimedia_especies')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

