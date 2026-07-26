const express = require('express');

const { publishOperationalEvent } = require('../services/operationalEventService');
const { asBoundedInteger, validateDateRange, validateReason } = require('../utils/validation');

const createFoodRouter = ({
  pool,
  verifyToken,
  verifyPermission,
  verifyAnyPermission,
  insertarAudit,
  getClientIp
}) => {
  const router = express.Router();
  router.use(verifyToken);

  router.get('/services', verifyAnyPermission(['food.view', 'food.register', 'food.manage', 'food.reports']), async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT id_service, code, name,
               TO_CHAR(start_time, 'HH24:MI') AS start_time,
               TO_CHAR(end_time, 'HH24:MI') AS end_time,
               active, sort_order,
               (LOCALTIME BETWEEN start_time AND end_time) AS current_window
        FROM food_services
        WHERE active = true
        ORDER BY sort_order, name
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('[food/services]', error.message);
      res.status(500).json({ message: 'No fue posible obtener los servicios de alimentación.' });
    }
  });

  router.get('/students/search', verifyAnyPermission(['food.register', 'food.manage']), async (req, res) => {
    const term = String(req.query.q || '').trim().toLowerCase();
    if (term.length < 2 || term.length > 80) {
      return res.status(400).json({ message: 'La búsqueda debe contener entre 2 y 80 caracteres.' });
    }
    try {
      const result = await pool.query(`
        SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv,
               COALESCE(c.nombre_curso, 'Sin curso') AS curso,
               a.codigo_barra,
               COALESCE((
                 fb.active = true
                 AND fb.valid_from <= CURRENT_DATE
                 AND (fb.valid_until IS NULL OR fb.valid_until >= CURRENT_DATE)
               ), false) AS beneficiario,
               fb.source AS origen_beneficio
        FROM alumno a
        LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
        LEFT JOIN curso c ON c.id_curso = m.id_curso
        LEFT JOIN food_beneficiaries fb ON fb.id_alumno = a.id_alumno
        WHERE a.activo = true
          AND a.rol = 'Estudiante'
          AND (
            LOWER(a.nombres || ' ' || a.paterno || ' ' || COALESCE(a.materno, '')) LIKE $1
            OR LOWER(a.rut || '-' || COALESCE(a.dv, '')) LIKE $1
            OR LOWER(COALESCE(a.codigo_barra, '')) LIKE $1
          )
        ORDER BY a.paterno, a.nombres
        LIMIT 15
      `, [`%${term}%`]);
      res.json(result.rows);
    } catch (error) {
      console.error('[food/students/search]', error.message);
      res.status(500).json({ message: 'No fue posible buscar estudiantes.' });
    }
  });

  router.put('/beneficiaries/:studentId', verifyPermission('food.manage'), async (req, res) => {
    const studentId = asBoundedInteger(req.params.studentId, 1, 2147483647);
    const active = req.body?.active !== false;
    if (!studentId) return res.status(400).json({ message: 'El estudiante no es válido.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = await client.query(
        "SELECT id_alumno, activo, rol FROM alumno WHERE id_alumno = $1 FOR SHARE",
        [studentId]
      );
      if (!student.rows[0] || !student.rows[0].activo || student.rows[0].rol !== 'Estudiante') {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'No se encontró un estudiante activo.' });
      }

      const result = await client.query(`
        INSERT INTO food_beneficiaries (
          id_alumno, source, valid_from, valid_until, active, updated_by, updated_at
        )
        VALUES ($1, 'manual', CURRENT_DATE, NULL, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id_alumno) DO UPDATE SET
          active = EXCLUDED.active,
          source = 'manual',
          valid_from = CASE WHEN EXCLUDED.active THEN CURRENT_DATE ELSE food_beneficiaries.valid_from END,
          valid_until = NULL,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [studentId, active, req.user.id]);

      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: active ? 'ACTIVAR_BENEFICIARIO_ALIMENTACION' : 'DESACTIVAR_BENEFICIARIO_ALIMENTACION',
        entidad: 'beneficiario_alimentacion',
        entidad_id: result.rows[0].id_beneficiary,
        detalle: { id_alumno: studentId, activo: active, origen: 'manual' },
        ip: getClientIp(req)
      });
      await client.query('COMMIT');
      res.json({ message: active ? 'Beneficiario habilitado.' : 'Beneficiario deshabilitado.', beneficiary: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[food/beneficiaries:update]', error.message);
      res.status(500).json({ message: 'No fue posible actualizar el beneficio.' });
    } finally {
      client.release();
    }
  });

  router.get('/today', verifyAnyPermission(['food.view', 'food.register', 'food.manage']), async (req, res) => {
    const serviceId = req.query.serviceId
      ? asBoundedInteger(req.query.serviceId, 1, 2147483647)
      : null;
    if (req.query.serviceId && !serviceId) return res.status(400).json({ message: 'El servicio no es válido.' });

    try {
      const [summary, registrations] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE fr.voided = false)::int AS entregas,
            COUNT(DISTINCT fr.id_alumno) FILTER (WHERE fr.voided = false)::int AS estudiantes,
            (
              SELECT COUNT(*)::int
              FROM food_beneficiaries fb
              JOIN alumno a ON a.id_alumno = fb.id_alumno
              WHERE fb.active = true AND a.activo = true
                AND fb.valid_from <= CURRENT_DATE
                AND (fb.valid_until IS NULL OR fb.valid_until >= CURRENT_DATE)
            ) AS beneficiarios_activos
          FROM food_registrations fr
          WHERE fr.service_date = CURRENT_DATE
            AND ($1::int IS NULL OR fr.id_service = $1)
        `, [serviceId]),
        pool.query(`
          SELECT fr.id_registration, fr.service_date,
                 TO_CHAR(fr.delivered_at, 'HH24:MI:SS') AS delivered_time,
                 fr.origin, fr.version,
                 fs.id_service, fs.name AS service_name,
                 a.id_alumno, a.nombres, a.paterno, a.materno,
                 a.rut, a.dv, COALESCE(c.nombre_curso, 'Sin curso') AS course,
                 u.nombre AS registered_by_name
          FROM food_registrations fr
          JOIN food_services fs ON fs.id_service = fr.id_service
          JOIN alumno a ON a.id_alumno = fr.id_alumno
          LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
          LEFT JOIN curso c ON c.id_curso = m.id_curso
          LEFT JOIN usuarios u ON u.id = fr.registered_by
          WHERE fr.service_date = CURRENT_DATE
            AND fr.voided = false
            AND ($1::int IS NULL OR fr.id_service = $1)
          ORDER BY fr.delivered_at DESC, fr.id_registration DESC
          LIMIT 50
        `, [serviceId])
      ]);
      res.json({ summary: summary.rows[0], registrations: registrations.rows });
    } catch (error) {
      console.error('[food/today]', error.message);
      res.status(500).json({ message: 'No fue posible obtener la jornada de alimentación.' });
    }
  });

  router.post('/registrations', verifyPermission('food.register'), async (req, res) => {
    const studentId = asBoundedInteger(req.body?.studentId, 1, 2147483647);
    const serviceId = asBoundedInteger(req.body?.serviceId, 1, 2147483647);
    const origin = req.body?.origin === 'lector' ? 'lector' : 'manual';
    if (!studentId || !serviceId) return res.status(400).json({ message: 'Estudiante y servicio son obligatorios.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eligibility = await client.query(`
        SELECT a.id_alumno, a.activo,
               fs.id_service, fs.name AS service_name, fs.active AS service_active,
               COALESCE((
                 fb.active = true
                 AND fb.valid_from <= CURRENT_DATE
                 AND (fb.valid_until IS NULL OR fb.valid_until >= CURRENT_DATE)
               ), false) AS beneficiary_active
        FROM alumno a
        CROSS JOIN food_services fs
        LEFT JOIN food_beneficiaries fb ON fb.id_alumno = a.id_alumno
        WHERE a.id_alumno = $1 AND fs.id_service = $2
        FOR SHARE OF a, fs
      `, [studentId, serviceId]);
      const target = eligibility.rows[0];
      if (!target || !target.activo || !target.service_active) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Estudiante o servicio no disponible.' });
      }
      if (!target.beneficiary_active) {
        await client.query('ROLLBACK');
        return res.status(409).json({ code: 'NOT_BENEFICIARY', message: 'El estudiante no figura como beneficiario activo.' });
      }

      const inserted = await client.query(`
        INSERT INTO food_registrations (
          id_alumno, id_service, service_date, delivered_at, origin, registered_by
        )
        VALUES ($1, $2, CURRENT_DATE, CURRENT_TIMESTAMP, $3, $4)
        ON CONFLICT (id_alumno, id_service, service_date) WHERE voided = false DO NOTHING
        RETURNING *
      `, [studentId, serviceId, origin, req.user.id]);
      if (inserted.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ code: 'DUPLICATE_DELIVERY', message: 'Esta entrega ya fue registrada hoy.' });
      }
      const registration = inserted.rows[0];

      await publishOperationalEvent(client, {
        studentId,
        module: 'food',
        eventType: 'food.delivery.registered',
        sourceEntity: 'food_registration',
        sourceId: registration.id_registration,
        sourceVersion: registration.version,
        occurredAt: registration.delivered_at,
        origin,
        actorUserId: req.user.id,
        metadata: { servicio: target.service_name, id_servicio: serviceId },
        idempotencyKey: `food:registration:${registration.id_registration}:created:v${registration.version}`
      });
      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: 'REGISTRAR_ENTREGA_ALIMENTACION',
        entidad: 'registro_alimentacion',
        entidad_id: registration.id_registration,
        detalle: { id_alumno: studentId, id_servicio: serviceId, servicio: target.service_name, origen: origin },
        ip: getClientIp(req)
      });
      await client.query('COMMIT');
      res.status(201).json({ message: `${target.service_name} registrado correctamente.`, registration });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[food/registrations:create]', error.message);
      if (error.code === '23505') return res.status(409).json({ code: 'DUPLICATE_DELIVERY', message: 'Esta entrega ya fue registrada hoy.' });
      res.status(500).json({ message: 'No fue posible registrar la entrega.' });
    } finally {
      client.release();
    }
  });

  router.patch('/registrations/:id/void', verifyPermission('food.manage'), async (req, res) => {
    const registrationId = asBoundedInteger(req.params.id, 1, 9223372036854775807);
    const reason = validateReason(req.body?.reason);
    if (!registrationId) return res.status(400).json({ message: 'El registro no es válido.' });
    if (reason.error) return res.status(400).json({ message: reason.error });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(`
        UPDATE food_registrations
        SET voided = true, void_reason = $1, voided_by = $2,
            voided_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id_registration = $3 AND voided = false
        RETURNING *
      `, [reason.value, req.user.id, registrationId]);
      if (updated.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'No se encontró una entrega activa.' });
      }
      const registration = updated.rows[0];
      await publishOperationalEvent(client, {
        studentId: registration.id_alumno,
        module: 'food',
        eventType: 'food.delivery.voided',
        sourceEntity: 'food_registration',
        sourceId: registration.id_registration,
        sourceVersion: registration.version,
        state: 'anulado',
        occurredAt: registration.voided_at,
        origin: 'portal',
        actorUserId: req.user.id,
        metadata: { motivo: reason.value, id_servicio: registration.id_service },
        voidReason: reason.value,
        idempotencyKey: `food:registration:${registration.id_registration}:voided:v${registration.version}`
      });
      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: 'ANULAR_ENTREGA_ALIMENTACION',
        entidad: 'registro_alimentacion',
        entidad_id: registration.id_registration,
        detalle: { id_alumno: registration.id_alumno, motivo: reason.value },
        ip: getClientIp(req)
      });
      await client.query('COMMIT');
      res.json({ message: 'Entrega anulada con trazabilidad.' });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[food/registrations:void]', error.message);
      res.status(500).json({ message: 'No fue posible anular la entrega.' });
    } finally {
      client.release();
    }
  });

  router.get('/history', verifyPermission('food.reports'), async (req, res) => {
    const range = validateDateRange(req.query.from, req.query.to, { maxDays: 366 });
    if (range.error) return res.status(400).json({ message: range.error });
    try {
      const result = await pool.query(`
        SELECT fr.id_registration, fr.service_date::text, fr.delivered_at,
               fr.origin, fr.voided, fr.void_reason,
               fs.name AS service_name,
               a.id_alumno, a.rut, a.dv, a.nombres, a.paterno, a.materno,
               COALESCE(c.nombre_curso, 'Sin curso') AS course
        FROM food_registrations fr
        JOIN food_services fs ON fs.id_service = fr.id_service
        JOIN alumno a ON a.id_alumno = fr.id_alumno
        LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
        LEFT JOIN curso c ON c.id_curso = m.id_curso
        WHERE fr.service_date BETWEEN $1 AND $2
        ORDER BY fr.service_date DESC, fr.delivered_at DESC
        LIMIT 5000
      `, [range.from, range.to]);
      res.json({ period: range, total: result.rows.length, registrations: result.rows });
    } catch (error) {
      console.error('[food/history]', error.message);
      res.status(500).json({ message: 'No fue posible obtener el historial de alimentación.' });
    }
  });

  return router;
};

module.exports = { createFoodRouter };
