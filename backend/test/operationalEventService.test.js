const test = require('node:test');
const assert = require('node:assert/strict');

const {
  listStudentTimeline,
  normalizeOperationalEvent,
  publishOperationalEvent
} = require('../services/operationalEventService');

const queryableWith = (rows = []) => {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows };
    }
  };
};

test('normaliza el sobre común y rechaza eventos sin clave idempotente', () => {
  const event = normalizeOperationalEvent({
    studentId: 7,
    module: 'Food',
    eventType: 'food.delivery.registered',
    sourceEntity: 'food_registration',
    sourceId: 12,
    idempotencyKey: 'food:registration:12:created:v1'
  });
  assert.equal(event.module, 'food');
  assert.equal(event.sourceVersion, 1);
  assert.throws(() => normalizeOperationalEvent({
    studentId: 7,
    module: 'food',
    eventType: 'food.delivery.registered',
    sourceEntity: 'food_registration',
    sourceId: 12
  }), /idempotente/);
});

test('publica con ON CONFLICT para tolerar reintentos sin duplicar eventos', async () => {
  const queryable = queryableWith([{ id_evento: 4 }]);
  const inserted = await publishOperationalEvent(queryable, {
    studentId: 7,
    module: 'food',
    eventType: 'food.delivery.registered',
    sourceEntity: 'food_registration',
    sourceId: 12,
    actorUserId: 2,
    metadata: { servicio: 'Almuerzo' },
    idempotencyKey: 'food:registration:12:created:v1'
  });
  assert.deepEqual(inserted, { id_evento: 4 });
  assert.match(queryable.calls[0].sql, /ON CONFLICT \(clave_idempotencia\) DO NOTHING/);
  assert.equal(queryable.calls[0].params.at(-1), 'food:registration:12:created:v1');
});

test('la línea temporal limita paginación y siempre ordena por ocurrencia', async () => {
  const queryable = queryableWith([]);
  await listStudentTimeline(queryable, 9, { limit: 999, offset: -8 });
  assert.deepEqual(queryable.calls[0].params, [9, 100, 0]);
  assert.match(queryable.calls[0].sql, /ORDER BY e\.ocurrido_en DESC/);
});
