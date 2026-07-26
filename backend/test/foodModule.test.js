const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.join(__dirname, '..', 'routes', 'food.js'), 'utf8');
const migrationSource = fs.readFileSync(path.join(__dirname, '..', 'migrations', '010_modulo_alimentacion.sql'), 'utf8');
const operationsMigrationSource = fs.readFileSync(path.join(__dirname, '..', 'migrations', '011_alimentacion_operacional.sql'), 'utf8');

test('Alimentación exige permisos por capacidad y no depende de un rol rígido', () => {
  assert.match(routeSource, /verifyPermission\('food\.register'\)/);
  assert.match(routeSource, /verifyPermission\('food\.manage'\)/);
  assert.doesNotMatch(routeSource, /req\.user\.rol\s*===/);
});

test('la entrega usa transacción, prevención de duplicados, evento y auditoría', () => {
  assert.match(routeSource, /BEGIN/);
  assert.match(routeSource, /ON CONFLICT \(id_alumno, id_service, service_date\).*DO NOTHING/s);
  assert.match(routeSource, /publishOperationalEvent/);
  assert.match(routeSource, /REGISTRAR_ENTREGA_ALIMENTACION/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS uq_food_registration_active/);
});

test('Visitas y retiros no se mezclan con el esquema de Alimentación', () => {
  assert.doesNotMatch(routeSource, /visitantes|retiros_alumno|visits\./i);
  assert.doesNotMatch(migrationSource, /visitantes|retiros_alumno|visits\./i);
});

test('la nómina PAE es previsualizable, idempotente y auditada', () => {
  assert.match(routeSource, /beneficiaries\/import\/preview/);
  assert.match(routeSource, /idempotencyKey !== contentHash/);
  assert.match(routeSource, /IMPORTAR_NOMINA_PAE/);
  assert.match(operationsMigrationSource, /idempotency_key VARCHAR\(80\) NOT NULL UNIQUE/);
});

test('alertas, lector y reportes conservan permisos independientes', () => {
  assert.match(routeSource, /students\/scan\/:barcode.*food\.register/s);
  assert.match(routeSource, /alerts\/:studentId.*food\.alerts\.manage/s);
  assert.match(routeSource, /reports.*food\.reports/s);
  assert.match(operationsMigrationSource, /food\.alerts\.view/);
  assert.doesNotMatch(operationsMigrationSource, /diagnostico|medicamento|ficha_clinica/i);
});
