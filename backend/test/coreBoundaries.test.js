const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const server = read('server.js');
const auth = read('routes', 'auth.js');
const audit = read('routes', 'audit.js');
const studentAdmin = read('routes', 'studentAdmin.js');
const accessAdmin = read('routes', 'accessAdmin.js');
const punctualityCompat = read('routes', 'punctualityCompat.js');
const documents = read('services', 'documentService.js');

test('autenticación y auditoría ya no declaran rutas directamente en server.js', () => {
  assert.doesNotMatch(server, /app\.(get|post)\('\/api\/auth/);
  assert.doesNotMatch(server, /app\.get\('\/api\/audit/);
  assert.match(server, /createAuthRouter/);
  assert.match(server, /createAuditRouter/);
  assert.match(auth, /router\.post\('\/auth\/login'/);
  assert.match(audit, /router\.get\('\/audit'/);
});

test('escrituras escolares y administración de accesos están fuera del servidor principal', () => {
  assert.doesNotMatch(server, /app\.(post|put|delete)\('\/api\/students/);
  assert.doesNotMatch(server, /app\.(get|post|put|patch|delete)\('\/api\/(users|access-profiles|permissions)/);
  assert.match(server, /createStudentAdminRouter/);
  assert.match(server, /createAccessAdminRouter/);
  assert.match(studentAdmin, /router\.post\('\/students\/bulk-sync'/);
  assert.match(studentAdmin, /router\.put\('\/students\/:id'/);
  assert.match(accessAdmin, /router\.post\('\/access-profiles'/);
  assert.match(accessAdmin, /router\.delete\('\/users\/:id'/);
  assert.doesNotMatch(server, /app\.(get|post)\('\/api\/students\/.*(scan|status)|app\.post\('\/api\/asistencia'/);
  assert.match(punctualityCompat, /router\.get\('\/students\/scan\/:barcode'/);
  assert.match(punctualityCompat, /router\.post\('\/asistencia'/);
});

test('el límite documental conserva validación binaria y almacenamiento privado', () => {
  assert.match(documents, /ALLOWED_MIME_TYPES/);
  assert.match(documents, /validSignature/);
  assert.match(documents, /randomUUID/);
  assert.match(documents, /resolveDocumentPath/);
  assert.doesNotMatch(server, /data:application\/pdf|MAX_DOCUMENT_BYTES/);
});
