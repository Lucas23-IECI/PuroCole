const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateDv,
  hashFoodImport,
  normalizeFoodImportRows
} = require('../services/foodImportService');

test('normaliza una nómina PAE y produce un hash estable', () => {
  const rut = '15987654';
  const rows = [{
    RUT: `${rut}-${calculateDv(rut)}`,
    Estado: 'Activo',
    'Vigente desde': '26/07/2026'
  }];
  const result = normalizeFoodImportRows(rows);

  assert.equal(result.errors.length, 0);
  assert.equal(result.validRows[0].rut, rut);
  assert.equal(result.validRows[0].validFrom, '2026-07-26');
  assert.equal(hashFoodImport(result.validRows), hashFoodImport(result.validRows));
});

test('rechaza RUT repetido, dígito incorrecto y fechas incoherentes', () => {
  const rows = [
    { RUT: '15.987.654-0' },
    { RUT: '15.987.654-3', Desde: '30/07/2026', Hasta: '20/07/2026' },
    { RUT: '15.987.654-3' }
  ];
  const result = normalizeFoodImportRows(rows);

  assert.equal(result.validRows.length, 1);
  assert.equal(result.errors.length, 2);
});
