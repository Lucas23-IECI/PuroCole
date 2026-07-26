const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STUDENT_PUBLIC_FIELDS,
  getStudentDetails,
  getStudentOperationalSummary,
  listCourses,
  listStudents,
  searchStudents
} = require('../services/coreQueryService');

const queryableWith = (rows) => {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows };
    }
  };
};

test('el núcleo lista cursos sin alterar el contrato existente', async () => {
  const queryable = queryableWith([{ id_curso: 1, nombre_curso: '1° Básico' }]);
  const rows = await listCourses(queryable);
  assert.deepEqual(rows, [{ id_curso: 1, nombre_curso: '1° Básico' }]);
  assert.match(queryable.calls[0].sql, /ORDER BY nombre_curso ASC/);
});

test('las consultas del núcleo exponen solo campos públicos del estudiante', async () => {
  const queryable = queryableWith([{ id_alumno: 7, nombres: 'Ana' }]);
  await listStudents(queryable);
  assert.match(queryable.calls[0].sql, /nombre_curso as grade/);
  assert.doesNotMatch(STUDENT_PUBLIC_FIELDS, /password|hash|token/i);
});

test('la búsqueda conserva normalización y parametrización', async () => {
  const queryable = queryableWith([]);
  await searchStudents(queryable, '  ANA  ');
  assert.deepEqual(queryable.calls[0].params, ['%ana%']);
  assert.match(queryable.calls[0].sql, /LIMIT 15/);
});

test('el detalle diferencia una ficha ausente sin inventar datos', async () => {
  const emptyQueryable = queryableWith([]);
  assert.equal(await getStudentDetails(emptyQueryable, 999), null);

  const populatedQueryable = queryableWith([{ id_alumno: 9, nombres: 'Bruno' }]);
  assert.deepEqual(await getStudentDetails(populatedQueryable, 9), { id_alumno: 9, nombres: 'Bruno' });
  assert.deepEqual(populatedQueryable.calls[0].params, [9]);
});

test('el resumen operacional se calcula sobre puntualidad y alimentación sin exponer documentos', async () => {
  const queryable = queryableWith([{
    ingresos: 3,
    atrasos: 1,
    entregas_alimentacion: 2,
    beneficiario_alimentacion: true
  }]);
  const summary = await getStudentOperationalSummary(queryable, 9);
  assert.equal(summary.ingresos, 3);
  assert.equal(summary.entregas_alimentacion, 2);
  assert.deepEqual(queryable.calls[0].params, [9]);
  assert.match(queryable.calls[0].sql, /food_registrations/);
  assert.doesNotMatch(queryable.calls[0].sql, /justification_documents/);
});
