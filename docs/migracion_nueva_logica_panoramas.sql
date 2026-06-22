-- Migracion manual: nueva logica de panoramas (rama feat/nueva-logica-panoramas)
-- Aplicar sobre la base 'grupofrontera'.
-- Alternativa recomendada: bunx drizzle-kit push  (sincroniza desde src/lib/schema.ts)

-- Columnas nuevas en activities (formulario admin de panoramas)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS price integer;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS cupos_por_dia integer;

-- Flags de gestion (pestana Administrar panoramas)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_tendencia boolean DEFAULT false;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS disponible boolean DEFAULT true;

-- Tabla de horarios (una fecha puede tener varias franjas)
CREATE TABLE IF NOT EXISTS activity_schedules (
    id text PRIMARY KEY,
    activity_id varchar(50) NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    fecha text NOT NULL,
    hora_inicio text,
    hora_fin text
);

-- Reservas: fecha y horario elegidos por el usuario (para contar cupos por fecha)
ALTER TABLE user_reservations ADD COLUMN IF NOT EXISTS reserved_date text;
ALTER TABLE user_reservations ADD COLUMN IF NOT EXISTS reserved_time text;
