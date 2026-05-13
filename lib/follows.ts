/**
 * follows.ts — Sistema de seguidores para la red social de Ecos.
 *
 * CRUD completo sobre la tabla `seguidores` de Supabase, más
 * descubrimiento de usuarios mediante la función RPC
 * `descubrir_usuarios` (lógica de grafos: amigos de amigos).
 *
 * @module lib/follows
 */

import { supabase } from './supabase';
import { i18n } from './i18n';

/** Perfil público de un usuario (proyección mínima) */
interface UserProfile {
  id: string;
  username: string;
  nombre: string;
  foto_perfil: string | null;
  descripcion: string | null;
}

/** Perfil con fecha de follow */
export interface FollowProfile extends UserProfile {
  followed_at: string;
}

/**
 * Registra un follow entre dos usuarios.
 * @throws PostgrestError si la relación ya existe
 */
export const followUser = async (followerId: string, followedId: string): Promise<void> => {
  const { error } = await supabase
    .from('seguidores')
    .insert({ seguidor_id: followerId, seguido_id: followedId });
  if (error) throw error;

  // Obtener perfil del seguidor para la notificación
  const { data: profile } = await supabase
    .from('perfiles')
    .select('username, nombre')
    .eq('id', followerId)
    .single();

  if (profile) {
    const displayName = profile.username || profile.nombre || i18n.t('follows.aUser');
    await supabase.from('notificaciones').insert({
      usuario_id: followedId,
      titulo: i18n.t('follows.newFollower'),
      mensaje: `${followerId}||${displayName} ${i18n.t('follows.startedFollowing')}`,
      tipo: 'seguidor',
      leido: false,
    });
  }
};

/** Elimina la relación de follow entre dos usuarios. */
export const unfollowUser = async (followerId: string, followedId: string): Promise<void> => {
  const { error } = await supabase
    .from('seguidores')
    .delete()
    .eq('seguidor_id', followerId)
    .eq('seguido_id', followedId);
  if (error) throw error;

  // Eliminar la notificación pendiente para que el icono de notificaciones se actualice
  await supabase
    .from('notificaciones')
    .delete()
    .eq('usuario_id', followedId)
    .eq('tipo', 'seguidor')
    .like('mensaje', `${followerId}||%`);
};

/** Verifica si `followerId` sigue a `followedId`. */
export const checkIsFollowing = async (followerId: string, followedId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('seguidores')
    .select('id')
    .eq('seguidor_id', followerId)
    .eq('seguido_id', followedId)
    .maybeSingle();
  return !!data;
};

/**
 * Obtiene la lista de seguidores con datos de perfil.
 * Join manual en dos pasos: IDs de `seguidores` → perfiles de `perfiles`.
 */
export const getFollowers = async (userId: string): Promise<FollowProfile[]> => {
  const { data: followRows, error } = await supabase
    .from('seguidores')
    .select('seguidor_id, created_at')
    .eq('seguido_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!followRows || followRows.length === 0) return [];

  const ids = followRows.map((r: any) => r.seguidor_id);
  const { data: profiles, error: profileError } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .in('id', ids);
  if (profileError) throw profileError;

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  return followRows
    .map((row: any) => ({ ...profileMap.get(row.seguidor_id), followed_at: row.created_at }))
    .filter((item: any) => item.id) as FollowProfile[];
};

/**
 * Obtiene la lista de usuarios seguidos con datos de perfil.
 * Misma estrategia de join manual que {@link getFollowers}.
 */
export const getFollowing = async (userId: string): Promise<FollowProfile[]> => {
  const { data: followRows, error } = await supabase
    .from('seguidores')
    .select('seguido_id, created_at')
    .eq('seguidor_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!followRows || followRows.length === 0) return [];

  const ids = followRows.map((r: any) => r.seguido_id);
  const { data: profiles, error: profileError } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .in('id', ids);
  if (profileError) throw profileError;

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
  return followRows
    .map((row: any) => ({ ...profileMap.get(row.seguido_id), followed_at: row.created_at }))
    .filter((item: any) => item.id) as FollowProfile[];
};

/** Busca usuarios por username (parcial, case-insensitive). Excluye al usuario actual. */
export const searchUsers = async (query: string, currentUserId: string): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, username, nombre, foto_perfil, descripcion')
    .neq('id', currentUserId)
    .ilike('username', `%${query}%`)
    .limit(20);
  if (error) throw error;
  return (data || []) as UserProfile[];
};

/** Descubre usuarios sugeridos via RPC `descubrir_usuarios` (amigos de amigos). */
export const discoverUsers = async (currentUserId: string): Promise<UserProfile[]> => {
  let users: UserProfile[] = [];
  try {
    const { data, error } = await supabase.rpc('descubrir_usuarios', {
      usuario_id: currentUserId,
      limite: 30,
    });
    if (!error && data && data.length > 0) {
      users = data as UserProfile[];
    }
  } catch (err) {
    console.error('Error en RPC descubrir_usuarios:', err);
  }

  // Fallback: Si el usuario no tiene conexiones (grafo vacío) o la RPC falla
  if (users.length === 0) {
    try {
      const followingIds = await getFollowingIds(currentUserId);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('perfiles')
        .select('id, username, nombre, foto_perfil, descripcion')
        .neq('id', currentUserId)
        .limit(50);

      if (!fallbackError && fallbackData) {
        users = (fallbackData as UserProfile[])
          .filter(p => !followingIds.has(p.id))
          .slice(0, 30);
      }
    } catch (err) {
      console.error('Error en fallback de discoverUsers:', err);
    }
  }

  return users;
};

/** Obtiene el Set de IDs de usuarios seguidos (para verificar follow en lotes). */
export const getFollowingIds = async (currentUserId: string): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from('seguidores')
    .select('seguido_id')
    .eq('seguidor_id', currentUserId);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.seguido_id));
};
