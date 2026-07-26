const VALID_STATES = new Set(['activo', 'corregido', 'anulado']);
const MODULE_PATTERN = /^[a-z][a-z0-9_-]{1,49}$/;

const normalizeOperationalEvent = (event) => {
  const normalized = {
    studentId: Number.parseInt(event?.studentId, 10),
    module: String(event?.module || '').trim().toLowerCase(),
    eventType: String(event?.eventType || '').trim(),
    sourceEntity: String(event?.sourceEntity || '').trim(),
    sourceId: String(event?.sourceId || '').trim(),
    sourceVersion: Number.parseInt(event?.sourceVersion || 1, 10),
    state: String(event?.state || 'activo').trim().toLowerCase(),
    occurredAt: event?.occurredAt || new Date(),
    origin: String(event?.origin || 'sistema').trim().toLowerCase(),
    actorUserId: event?.actorUserId || null,
    metadata: event?.metadata && typeof event.metadata === 'object' ? event.metadata : {},
    voidReason: event?.voidReason ? String(event.voidReason).trim() : null,
    idempotencyKey: String(event?.idempotencyKey || '').trim()
  };

  if (!Number.isInteger(normalized.studentId) || normalized.studentId < 1) {
    throw new TypeError('El evento requiere un estudiante válido.');
  }
  if (!MODULE_PATTERN.test(normalized.module)) throw new TypeError('El módulo del evento no es válido.');
  if (!normalized.eventType || normalized.eventType.length > 100) throw new TypeError('El tipo de evento no es válido.');
  if (!normalized.sourceEntity || normalized.sourceEntity.length > 80) throw new TypeError('La entidad de origen no es válida.');
  if (!normalized.sourceId || normalized.sourceId.length > 120) throw new TypeError('El identificador de origen no es válido.');
  if (!Number.isInteger(normalized.sourceVersion) || normalized.sourceVersion < 1) throw new TypeError('La versión del evento no es válida.');
  if (!VALID_STATES.has(normalized.state)) throw new TypeError('El estado del evento no es válido.');
  if (!normalized.idempotencyKey || normalized.idempotencyKey.length > 180) throw new TypeError('La clave idempotente no es válida.');
  return normalized;
};

const publishOperationalEvent = async (queryable, event) => {
  const value = normalizeOperationalEvent(event);
  const result = await queryable.query(`
    INSERT INTO eventos_operacionales (
      id_alumno, modulo, tipo_evento, entidad_origen, entidad_id,
      version_origen, estado, ocurrido_en, origen, usuario_id,
      metadatos, motivo_anulacion, clave_idempotencia
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
    ON CONFLICT (clave_idempotencia) DO NOTHING
    RETURNING *
  `, [
    value.studentId,
    value.module,
    value.eventType,
    value.sourceEntity,
    value.sourceId,
    value.sourceVersion,
    value.state,
    value.occurredAt,
    value.origin,
    value.actorUserId,
    JSON.stringify(value.metadata),
    value.voidReason,
    value.idempotencyKey
  ]);
  return result.rows[0] || null;
};

const listStudentTimeline = async (queryable, studentId, { limit = 30, offset = 0 } = {}) => {
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 30, 1), 100);
  const safeOffset = Math.max(Number.parseInt(offset, 10) || 0, 0);
  const result = await queryable.query(`
    SELECT e.id_evento, e.modulo, e.tipo_evento, e.entidad_origen, e.entidad_id,
           e.version_origen, e.estado, e.ocurrido_en, e.registrado_en, e.origen,
           e.metadatos, e.motivo_anulacion,
           u.nombre AS registrado_por_nombre
    FROM eventos_operacionales e
    LEFT JOIN usuarios u ON u.id = e.usuario_id
    WHERE e.id_alumno = $1
    ORDER BY e.ocurrido_en DESC, e.id_evento DESC
    LIMIT $2 OFFSET $3
  `, [studentId, safeLimit, safeOffset]);
  return result.rows;
};

module.exports = {
  listStudentTimeline,
  normalizeOperationalEvent,
  publishOperationalEvent
};
