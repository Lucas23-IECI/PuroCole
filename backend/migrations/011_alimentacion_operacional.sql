-- Completa las puertas operacionales de Alimentación sin mezclar datos clínicos
-- ni reutilizar tablas de Puntualidad.
INSERT INTO permisos_sistema (codigo, grupo, etiqueta, descripcion, orden, critico) VALUES
  ('food.import', 'Alimentación', 'Importar nómina PAE', 'Previsualiza y aplica nóminas de beneficiarios con idempotencia.', 172, true),
  ('food.alerts.view', 'Alimentación', 'Consultar alertas alimentarias', 'Muestra alertas operacionales mínimas durante una entrega.', 174, true),
  ('food.alerts.manage', 'Alimentación', 'Administrar alertas alimentarias', 'Crea, actualiza o desactiva alertas alimentarias restringidas.', 176, true)
ON CONFLICT (codigo) DO UPDATE SET
  grupo = EXCLUDED.grupo,
  etiqueta = EXCLUDED.etiqueta,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden,
  critico = EXCLUDED.critico;

INSERT INTO permisos_rol (rol, permiso_codigo)
SELECT 'admin', codigo
FROM permisos_sistema
WHERE codigo IN ('food.import', 'food.alerts.view', 'food.alerts.manage')
ON CONFLICT DO NOTHING;

INSERT INTO permisos_rol (rol, permiso_codigo) VALUES
  ('inspector', 'food.alerts.view'),
  ('direccion', 'food.alerts.view')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS food_import_batches (
  id_batch BIGSERIAL PRIMARY KEY,
  idempotency_key VARCHAR(80) NOT NULL UNIQUE,
  content_hash CHAR(64) NOT NULL,
  file_name VARCHAR(180),
  rows_total INT NOT NULL,
  rows_applied INT NOT NULL,
  rows_deactivated INT NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_food_import_counts CHECK (
    rows_total >= 0 AND rows_applied >= 0 AND rows_deactivated >= 0
    AND rows_applied <= rows_total
  ),
  CONSTRAINT ck_food_import_hash CHECK (content_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_food_import_batches_created
  ON food_import_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS food_dietary_alerts (
  id_alert BIGSERIAL PRIMARY KEY,
  id_alumno INT NOT NULL UNIQUE REFERENCES alumno(id_alumno) ON DELETE RESTRICT,
  alert_text VARCHAR(280) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_food_alert_text CHECK (char_length(trim(alert_text)) BETWEEN 4 AND 280)
);

CREATE INDEX IF NOT EXISTS idx_food_dietary_alerts_active
  ON food_dietary_alerts (id_alumno)
  WHERE active = true;
