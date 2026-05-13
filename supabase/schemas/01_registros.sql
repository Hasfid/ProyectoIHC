-- 1. Borramos la tabla anterior si existe para evitar conflictos
DROP TABLE IF EXISTS registros;

-- 2. Creamos la nueva tabla optimizada
CREATE TABLE IF NOT EXISTS registros (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  usuario_id uuid NOT NULL REFERENCES auth.users,
  nombre_tradicional text NOT NULL,
  nombre_cientifico text,
  peligrosidad text,
  alimentacion text,
  descripcion text,
  media_url text NOT NULL,
  tipo_media text NOT NULL CHECK (tipo_media IN ('imagen', 'video', 'audio')),
  latitud double precision NOT NULL,
  longitud double precision NOT NULL,
  coordenadas geography(Point,4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitud, latitud), 4326)::geography
  ) STORED
);

-- 3. Activamos la seguridad de la tabla
ALTER TABLE registros ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acceso
CREATE POLICY "Los registros son públicos"
  ON registros FOR SELECT USING (true);

CREATE POLICY "Usuarios autenticados pueden crear registros"
  ON registros FOR INSERT WITH CHECK (auth.uid() = usuario_id);
