import { supabase } from './supabase';

// Seguir a un usuario
export const followUser = async (followerId: string, followedId: string) => {
  const { error } = await supabase
    .from('seguidores')
    .insert({ seguidor_id: followerId, seguido_id: followedId });

  if (error) throw error;
};

// Dejar de seguir a un usuario
export const unfollowUser = async (followerId: string, followedId: string) => {
  const { error } = await supabase
    .from('seguidores')
    .delete()
    .eq('seguidor_id', followerId)
    .eq('seguido_id', followedId);

  if (error) throw error;
};

// Verificar si ya sigo a alguien
export const checkIsFollowing = async (followerId: string, followedId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('seguidores')
    .select('id')
    .eq('seguidor_id', followerId)
    .eq('seguido_id', followedId)
    .single();

  return !!data;
};

// Obtener lista de seguidores (quiénes me siguen) con datos de perfil
export const getFollowers = async (userId: string) => {
  // Paso 1: obtener IDs de quienes me siguen
  const { data: followRows, error } = await supabase
    .from('seguidores')
    .select('seguidor_id, created_at')
    .eq('seguido_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!followRows || followRows.length === 0) return [];

  // Paso 2: obtener perfiles de esos IDs
  const ids = followRows.map((r: any) => r.seguidor_id);
  const { data: profiles, error: profileError } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .in('id', ids);

  if (profileError) throw profileError;

  // Combinar datos
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  return followRows
    .map((row: any) => ({
      ...profileMap.get(row.seguidor_id),
      followed_at: row.created_at,
    }))
    .filter((item: any) => item.id); // filtrar si el perfil no existe
};

// Obtener lista de seguidos (a quiénes sigo) con datos de perfil
export const getFollowing = async (userId: string) => {
  // Paso 1: obtener IDs de a quienes sigo
  const { data: followRows, error } = await supabase
    .from('seguidores')
    .select('seguido_id, created_at')
    .eq('seguidor_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!followRows || followRows.length === 0) return [];

  // Paso 2: obtener perfiles de esos IDs
  const ids = followRows.map((r: any) => r.seguido_id);
  const { data: profiles, error: profileError } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .in('id', ids);

  if (profileError) throw profileError;

  // Combinar datos
  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  return followRows
    .map((row: any) => ({
      ...profileMap.get(row.seguido_id),
      followed_at: row.created_at,
    }))
    .filter((item: any) => item.id);
};

// Buscar usuarios por username (excluye al usuario actual)
export const searchUsers = async (query: string, currentUserId: string) => {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .neq('id', currentUserId)
    .ilike('username', `%${query}%`)
    .limit(20);

  if (error) throw error;
  return data || [];
};

// Descubrir usuarios usando lógica de grafos (amigos de amigos)
export const discoverUsers = async (currentUserId: string) => {
  const { data, error } = await supabase
    .rpc('descubrir_usuarios', { usuario_id: currentUserId, limite: 30 });

  if (error) throw error;
  return data || [];
};

// Verificar estado de follow para múltiples usuarios a la vez
export const getFollowingIds = async (currentUserId: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('seguidores')
    .select('seguido_id')
    .eq('seguidor_id', currentUserId);

  if (error) throw error;
  return new Set((data || []).map((row: any) => row.seguido_id));
};
