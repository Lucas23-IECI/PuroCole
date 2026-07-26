-- Núcleo del módulo Alimentación sobre estudiantes, sesiones, permisos y auditoría comunes.
INSERT INTO permisos_sistema (codigo, grupo, etiqueta, descripcion, orden, critico) VALUES
  ('food.view', 'Alimentación', 'Consultar alimentación', 'Consulta servicios, entregas del día e indicadores operacionales.', 140, false),
  ('food.register', 'Alimentación', 'Registrar entregas', 'Registra una entrega de alimentación y bloquea duplicados por servicio y fecha.', 150, false),
  ('food.manage', 'Alimentación', 'Administrar beneficiarios', 'Activa beneficiarios y anula entregas con trazabilidad.', 160, true),
  ('food.reports', 'Alimentación', 'Generar reportes', 'Consulta y exporta el historial operacional de alimentación.', 170, false)
ON CONFLICT (codigo) DO UPDATE SET
  grupo = EXCLUDED.grupo,
  etiqueta = EXCLUDED.etiqueta,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden,
  critico = EXCLUDED.critico;

INSERT INTO permisos_rol (rol, permiso_codigo)
SELECT 'admin', codigo
FROM permisos_sistema
WHERE codigo LIKE 'food.%'
ON CONFLICT DO NOTHING;

INSERT INTO permisos_rol (rol, permiso_codigo) VALUES
  ('inspector', 'food.view'),
  ('inspector', 'food.register'),
  ('secretaria', 'food.view'),
  ('secretaria', 'food.reports'),
  ('direccion', 'food.view'),
  ('direccion', 'food.reports')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS food_services (
  id_service SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT ck_food_service_code CHECK (code ~ '^[a-z][a-z0-9_-]{1,39}$'),
  CONSTRAINT ck_food_service_window CHECK (start_time < end_time)
);

INSERT INTO food_services (code, name, start_time, end_time, sort_order) VALUES
  ('breakfast', 'Desayuno', '07:00', '10:30', 10),
  ('lunch', 'Almuerzo', '11:30', '15:30', 20),
  ('snack', 'Once', '15:30', '18:30', 30)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS food_beneficiaries (
  id_beneficiary BIGSERIAL PRIMARY KEY,
  id_alumno INT NOT NULL UNIQUE REFERENCES alumno(id_alumno) ON DELETE RESTRICT,
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  notes VARCHAR(280),
  updated_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_food_beneficiary_source CHECK (source IN ('manual', 'pae', 'importacion')),
  CONSTRAINT ck_food_beneficiary_dates CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS food_registrations (
  id_registration BIGSERIAL PRIMARY KEY,
  id_alumno INT NOT NULL REFERENCES alumno(id_alumno) ON DELETE RESTRICT,
  id_service INT NOT NULL REFERENCES food_services(id_service) ON DELETE RESTRICT,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origin VARCHAR(30) NOT NULL DEFAULT 'manual',
  registered_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason VARCHAR(280),
  voided_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  CONSTRAINT ck_food_registration_origin CHECK (origin IN ('manual', 'lector', 'importacion')),
  CONSTRAINT ck_food_registration_void CHECK (
    (voided = false AND void_reason IS NULL AND voided_at IS NULL)
    OR
    (voided = true AND void_reason IS NOT NULL AND voided_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_food_registration_active
  ON food_registrations (id_alumno, id_service, service_date)
  WHERE voided = false;

CREATE INDEX IF NOT EXISTS idx_food_registration_day
  ON food_registrations (service_date DESC, id_service, delivered_at DESC)
  WHERE voided = false;
