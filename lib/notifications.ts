/**
 * notifications.ts — Funciones centralizadas para crear notificaciones
 * de interacciones sociales (likes, comentarios).
 *
 * Agrupa likes de una misma publicación en una sola notificación
 * con el conteo total actualizado. Usa i18n para textos traducibles.
 *
 * @module lib/notifications
 */

import { supabase } from './supabase';
import { i18n } from './i18n';

/**
 * Crea o actualiza una notificación de "me gusta" para el dueño del post.
 * Si ya existe una notificación de like para ese post, actualiza el conteo.
 * No crea notificación si el usuario se da like a sí mismo.
 */
export async function notifyPostLike(postId: string, likerUserId: string) {
  try {
    // Obtener la publicación para saber quién es el dueño
    const { data: post } = await supabase
      .from('publicaciones')
      .select('usuario_id, titulo')
      .eq('id', postId)
      .single();

    if (!post || post.usuario_id === likerUserId) return; // No notificar al propio usuario

    // Obtener el username del que dio like
    const { data: likerProfile } = await supabase
      .from('perfiles')
      .select('username, nombre')
      .eq('id', likerUserId)
      .single();

    const likerName = likerProfile?.username || likerProfile?.nombre || i18n.t('notifications.someone');

    // Contar cuántos likes tiene ahora el post
    const { count: totalLikes } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('publicacion_id', postId);

    // Buscar si ya existe una notificación de like para este post
    const { data: existing } = await supabase
      .from('notificaciones')
      .select('id')
      .eq('usuario_id', post.usuario_id)
      .eq('tipo', 'like')
      .like('mensaje', `%||POST:${postId}||%`)
      .limit(1);

    const postTitle = post.titulo?.substring(0, 30) || i18n.t('notifications.yourPost');
    const likesNum = totalLikes || 1;

    let titulo: string;
    let mensaje: string;

    if (likesNum === 1) {
      titulo = `❤️ ${i18n.t('notifications.newLike')}`;
      mensaje = `||POST:${postId}||${likerName} ${i18n.t('notifications.likedYourPost')} "${postTitle}"`;
    } else {
      titulo = `❤️ ${i18n.t('notifications.likesCount').replace('{{count}}', String(likesNum))}`;
      mensaje = `||POST:${postId}||${likesNum} ${i18n.t('notifications.peopleLikedPost')} "${postTitle}"`;
    }

    if (existing && existing.length > 0) {
      await supabase.from('notificaciones').update({
        titulo,
        mensaje,
        leido: false,
        created_at: new Date().toISOString(),
      }).eq('id', existing[0].id);
    } else {
      await supabase.from('notificaciones').insert({
        usuario_id: post.usuario_id,
        titulo,
        mensaje,
        tipo: 'like',
        leido: false,
      });
    }
  } catch (err) {
    console.error('Error creating like notification:', err);
  }
}

/**
 * Crea una notificación de comentario para el dueño del post.
 * Agrupa múltiples comentarios en una sola notificación mostrando el conteo.
 * No crea notificación si el usuario comenta en su propio post.
 */
export async function notifyPostComment(postId: string, commenterUserId: string) {
  try {
    // Obtener la publicación
    const { data: post } = await supabase
      .from('publicaciones')
      .select('usuario_id, titulo')
      .eq('id', postId)
      .single();

    if (!post || post.usuario_id === commenterUserId) return;

    // Obtener el username del que comentó
    const { data: commenterProfile } = await supabase
      .from('perfiles')
      .select('username, nombre')
      .eq('id', commenterUserId)
      .single();

    const commenterName = commenterProfile?.username || commenterProfile?.nombre || i18n.t('notifications.someone');

    // Contar cuántos comentarios tiene el post
    const { count: totalComments } = await supabase
      .from('post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('publicacion_id', postId);

    // Buscar si ya existe una notificación de comentario para este post
    const { data: existing } = await supabase
      .from('notificaciones')
      .select('id')
      .eq('usuario_id', post.usuario_id)
      .eq('tipo', 'comentario')
      .like('mensaje', `%||POST:${postId}||%`)
      .limit(1);

    const postTitle = post.titulo?.substring(0, 30) || i18n.t('notifications.yourPost');
    const commentsNum = totalComments || 1;

    let titulo: string;
    let mensaje: string;

    if (commentsNum === 1) {
      titulo = `💬 ${i18n.t('notifications.newComment')}`;
      mensaje = `||POST:${postId}||${commenterName} ${i18n.t('notifications.commentedOnPost')} "${postTitle}"`;
    } else {
      titulo = `💬 ${i18n.t('notifications.commentsCount').replace('{{count}}', String(commentsNum))}`;
      mensaje = `||POST:${postId}||${commentsNum} ${i18n.t('notifications.commentsOnPost')} "${postTitle}"`;
    }

    if (existing && existing.length > 0) {
      await supabase.from('notificaciones').update({
        titulo,
        mensaje,
        leido: false,
        created_at: new Date().toISOString(),
      }).eq('id', existing[0].id);
    } else {
      await supabase.from('notificaciones').insert({
        usuario_id: post.usuario_id,
        titulo,
        mensaje,
        tipo: 'comentario',
        leido: false,
      });
    }
  } catch (err) {
    console.error('Error creating comment notification:', err);
  }
}
