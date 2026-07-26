-- Contrato transversal e idempotente para la línea temporal operacional.
CREATE TABLE IF NOT EXISTS eventos_operacionales (
  id_evento BIGSERIAL PRIMARY KEY,
  id_alumno INT NOT NULL REFERENCES alumno(id_alumno) ON DELETE RESTRICT,
  modulo VARCHAR(50) NOT NULL,
  tipo_evento VARCHAR(100) NOT NULL,
  entidad_origen VARCHAR(80) NOT NULL,
  entidad_id VARCHAR(120) NOT NULL,
  version_origen INT NOT NULL DEFAULT 1,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo',
  ocurrido_en TIMESTAMPTZ NOT NULL,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origen VARCHAR(30) NOT NULL DEFAULT 'sistema',
  usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  metadatos JSONB NOT NULL DEFAULT '{}'::jsonb,
  motivo_anulacion VARCHAR(280),
  clave_idempotencia VARCHAR(180) NOT NULL UNIQUE,
  CONSTRAINT ck_eventos_operacionales_modulo
    CHECK (modulo ~ '^[a-z][a-z0-9_-]{1,49}$'),
  CONSTRAINT ck_eventos_operacionales_estado
    CHECK (estado IN ('activo', 'corregido', 'anulado')),
  CONSTRAINT ck_eventos_operacionales_version
    CHECK (version_origen >= 1)
);

CREATE INDEX IF NOT EXISTS idx_eventos_operacionales_alumno_fecha
  ON eventos_operacionales (id_alumno, ocurrido_en DESC, id_evento DESC);

CREATE INDEX IF NOT EXISTS idx_eventos_operacionales_modulo_tipo
  ON eventos_operacionales (modulo, tipo_evento, ocurrido_en DESC);

-- Toda instalación existente obtiene una línea base sin duplicar eventos al reintentar.
INSERT INTO eventos_operacionales (
  id_alumno,
  modulo,
  tipo_evento,
  entidad_origen,
  entidad_id,
  version_origen,
  estado,
  ocurrido_en,
  registrado_en,
  origen,
  usuario_id,
  metadatos,
  clave_idempotencia
)
SELECT
  r.id_alumno,
  'punctuality',
  'punctuality.registration.created',
  'attendance_registration',
  r.id_registro::text,
  1,
  CASE WHEN r.anulado THEN 'anulado' ELSE 'activo' END,
  (r.fecha + r.hora) AT TIME ZONE current_setting('TIMEZONE'),
  COALESCE(r.creado_en, CURRENT_TIMESTAMP),
  COALESCE(r.origen, 'migracion'),
  r.registrado_por,
  jsonb_build_object(
    'estado', r.estado,
    'severidad', r.severidad,
    'justificado', r.justificado
  ),
  'punctuality:registration:' || r.id_registro || ':created:v1'
FROM attendance_registrations r
ON CONFLICT (clave_idempotencia) DO NOTHING;
