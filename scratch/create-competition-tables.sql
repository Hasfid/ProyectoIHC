-- ============================================
-- TABLAS DEL SISTEMA DE COMPETENCIA — Ecos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Competencias (los retos en sí)
CREATE TABLE IF NOT EXISTS competencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tema TEXT NOT NULL,
  descripcion TEXT,
  imagen_portada TEXT,
  fecha_fin TIMESTAMPTZ NOT NULL,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Participaciones en un reto (cada usuario sube su registro)
CREATE TABLE IF NOT EXISTS participaciones_reto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia_id UUID NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  descripcion TEXT,
  votos_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Un usuario solo puede participar una vez por competencia
  UNIQUE(competencia_id, usuario_id)
);

-- 3. Votos a participaciones (likes del ranking)
CREATE TABLE IF NOT EXISTS votos_reto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participacion_id UUID NOT NULL REFERENCES participaciones_reto(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Un usuario solo puede votar una vez por participación
  UNIQUE(participacion_id, usuario_id)
);

-- 4. Votos de temática (para elegir el próximo reto)
CREATE TABLE IF NOT EXISTS votos_tematica (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tematica_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Un usuario solo puede votar por una temática a la vez
  UNIQUE(usuario_id)
);

-- ============================================
-- TRIGGER: Actualizar votos_count automáticamente
-- Cuando alguien vota en votos_reto, incrementa el contador
-- ============================================

CREATE OR REPLACE FUNCTION update_votos_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE participaciones_reto
    SET votos_count = votos_count + 1
    WHERE id = NEW.participacion_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE participaciones_reto
    SET votos_count = votos_count - 1
    WHERE id = OLD.participacion_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_voto_reto_change ON votos_reto;
CREATE TRIGGER on_voto_reto_change
  AFTER INSERT OR DELETE ON votos_reto
  FOR EACH ROW
  EXECUTE FUNCTION update_votos_count();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE competencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE participaciones_reto ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos_reto ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos_tematica ENABLE ROW LEVEL SECURITY;

-- Competencias: todos leen, solo admin crea (por ahora permitimos insert para testing)
CREATE POLICY "competencias_select" ON competencias FOR SELECT USING (true);
CREATE POLICY "competencias_insert" ON competencias FOR INSERT WITH CHECK (true);

-- Participaciones: todos leen, cada usuario gestiona las suyas
CREATE POLICY "participaciones_select" ON participaciones_reto FOR SELECT USING (true);
CREATE POLICY "participaciones_insert" ON participaciones_reto FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "participaciones_delete" ON participaciones_reto FOR DELETE USING (auth.uid() = usuario_id);

-- Votos reto: todos leen, cada usuario gestiona los suyos
CREATE POLICY "votos_reto_select" ON votos_reto FOR SELECT USING (true);
CREATE POLICY "votos_reto_insert" ON votos_reto FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "votos_reto_delete" ON votos_reto FOR DELETE USING (auth.uid() = usuario_id);

-- Votos temática: todos leen, cada usuario gestiona los suyos
CREATE POLICY "votos_tematica_select" ON votos_tematica FOR SELECT USING (true);
CREATE POLICY "votos_tematica_insert" ON votos_tematica FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "votos_tematica_delete" ON votos_tematica FOR DELETE USING (auth.uid() = usuario_id);
