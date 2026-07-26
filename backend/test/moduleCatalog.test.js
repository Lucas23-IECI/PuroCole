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

test('administración ve Alimentación activa y mantiene Visitas como integración reservada', () => {
  const catalog = getVisibleModuleCatalog(['users.manage', 'settings.manage']);
  const reserved = catalog.domains.filter(({ status }) => status === 'reserved');
  assert.deepEqual(reserved.map(({ id }) => id), ['visits']);
  assert.equal(catalog.experiences.some(({ domain_id }) => domain_id === 'visits'), false);
});

test('un perfil de Alimentación recibe solo su experiencia habilitada', () => {
  const catalog = getVisibleModuleCatalog(['food.register']);
  assert.deepEqual(catalog.experiences.map(({ id }) => id), ['food-operations']);
  assert.deepEqual(catalog.domains.map(({ id }) => id), ['food']);
});
