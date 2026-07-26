const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getVisibleModuleCatalog,
  validateModuleCatalog
} = require('../modules/catalog');

test('el catálogo usa identificadores, dominios y rutas consistentes', () => {
  assert.equal(validateModuleCatalog(), true);
});

test('terminal solo recibe su experiencia operacional', () => {
  const catalog = getVisibleModuleCatalog(['punctuality.register']);
  assert.deepEqual(catalog.experiences.map(({ id }) => id), ['punctuality-terminal']);
  assert.deepEqual(catalog.domains.map(({ id }) => id), ['punctuality']);
});

test('administración ve integraciones reservadas sin rutas ficticias', () => {
  const catalog = getVisibleModuleCatalog(['users.manage', 'settings.manage']);
  const reserved = catalog.domains.filter(({ status }) => status === 'reserved');
  assert.deepEqual(reserved.map(({ id }) => id), ['food', 'visits']);
  assert.equal(catalog.experiences.some(({ domain_id }) => domain_id === 'food' || domain_id === 'visits'), false);
});
