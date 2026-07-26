const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const server = read('server.js');
const auth = read('routes', 'auth.js');
const audit = read('routes', 'audit.js');
const documents = read('services', 'documentService.js');

test('autenticación y auditoría ya no declaran rutas directamente en server.js', () => {
  assert.doesNotMatch(server, /app\.(get|post)\('\/api\/auth/);
  assert.doesNotMatch(server, /app\.get\('\/api\/audit/);
  assert.match(server, /createAuthRouter/);
  assert.match(server, /createAuditRouter/);
  assert.match(auth, /router\.post\('\/auth\/login'/);
  assert.match(audit, /router\.get\('\/audit'/);
});

test('el límite documental conserva validación binaria y almacenamiento privado', () => {
  assert.match(documents, /ALLOWED_MIME_TYPES/);
  assert.match(documents, /validSignature/);
  assert.match(documents, /randomUUID/);
  assert.match(documents, /resolveDocumentPath/);
  assert.doesNotMatch(server, /data:application\/pdf|MAX_DOCUMENT_BYTES/);
});
