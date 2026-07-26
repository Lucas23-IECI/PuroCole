const express = require('express');

const { hashFoodImport, normalizeFoodImportRows } = require('../services/foodImportService');
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
  const canViewAlerts = (req) => Array.isArray(req.user?.permissions)
    && req.user.permissions.some((permission) => ['food.alerts.view', 'food.alerts.manage'].includes(permission));
  const prepareFoodImport = async (rows) => {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 5000) {
      return {
        rows: [],
        errors: [{ row: 0, message: 'La nómina debe contener entre 1 y 5000 filas.' }]
      };
    }
    const normalized = normalizeFoodImportRows(rows);
    if (normalized.validRows.length === 0) return { rows: [], errors: normalized.errors };

    const students = await pool.query(`
      SELECT a.id_alumno, a.rut, a.dv, a.nombres, a.paterno, a.materno,
             COALESCE(c.nombre_curso, 'Sin curso') AS course
      FROM alumno a
      LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
      LEFT JOIN curso c ON c.id_curso = m.id_curso
      WHERE a.activo = true
        AND a.rol = 'Estudiante'
        AND a.rut = ANY($1::text[])
    `, [normalized.validRows.map((row) => row.rut)]);
    const byRut = new Map(students.rows.map((student) => [student.rut, student]));
    const resolved = [];
    const errors = [...normalized.errors];

    for (const row of normalized.validRows) {
      const student = byRut.get(row.rut);
      if (!student || String(student.dv).toUpperCase() !== row.dv) {
        errors.push({
          row: row.row,
          rut: `${row.rut}-${row.dv}`,
          message: 'El RUT no pertenece a un estudiante activo.'
        });
        continue;
      }
      resolved.push({
        ...row,
        studentId: student.id_alumno,
        studentName: [student.nombres, student.paterno, student.materno].filter(Boolean).join(' '),
        course: student.course
      });
    }
    return { rows: resolved, errors };
  };

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

  router.get('/services/current', verifyAnyPermission(['food.view', 'food.register', 'food.manage']), async (_req, res) => {
    try {
      const current = await pool.query(`
        SELECT id_service, code, name,
               TO_CHAR(start_time, 'HH24:MI') AS start_time,
               TO_CHAR(end_time, 'HH24:MI') AS end_time
        FROM food_services
        WHERE active = true AND LOCALTIME BETWEEN start_time AND end_time
        ORDER BY sort_order
        LIMIT 1
      `);
      const next = current.rows[0] ? null : await pool.query(`
        SELECT id_service, code, name,
               TO_CHAR(start_time, 'HH24:MI') AS start_time,
               TO_CHAR(end_time, 'HH24:MI') AS end_time
        FROM food_services
        WHERE active = true AND start_time > LOCALTIME
        ORDER BY start_time
        LIMIT 1
      `);
      res.json({
        current: current.rows[0] || null,
        next: next?.rows?.[0] || null
      });
    } catch (error) {
      console.error('[food/services/current]', error.message);
      res.status(500).json({ message: 'No fue posible determinar el servicio actual.' });
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
               fb.source AS origen_beneficio,
               CASE WHEN $2::boolean AND fda.active = true THEN fda.alert_text ELSE NULL END AS alerta_alimentaria
        FROM alumno a
        LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
        LEFT JOIN curso c ON c.id_curso = m.id_curso
        LEFT JOIN food_beneficiaries fb ON fb.id_alumno = a.id_alumno
        LEFT JOIN food_dietary_alerts fda ON fda.id_alumno = a.id_alumno
        WHERE a.activo = true
          AND a.rol = 'Estudiante'
          AND (
            LOWER(a.nombres || ' ' || a.paterno || ' ' || COALESCE(a.materno, '')) LIKE $1
            OR LOWER(a.rut || '-' || COALESCE(a.dv, '')) LIKE $1
            OR LOWER(COALESCE(a.codigo_barra, '')) LIKE $1
          )
        ORDER BY a.paterno, a.nombres
        LIMIT 15
      `, [`%${term}%`, canViewAlerts(req)]);
      res.json(result.rows);
    } catch (error) {
      console.error('[food/students/search]', error.message);
      res.status(500).json({ message: 'No fue posible buscar estudiantes.' });
    }
  });

  router.get('/students/scan/:barcode', verifyPermission('food.register'), async (req, res) => {
    const barcode = String(req.params.barcode || '').trim();
    if (barcode.length < 3 || barcode.length > 80) {
      return res.status(400).json({ message: 'El código leído no es válido.' });
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
               CASE WHEN $2::boolean AND fda.active = true THEN fda.alert_text ELSE NULL END AS alerta_alimentaria
        FROM alumno a
        LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
        LEFT JOIN curso c ON c.id_curso = m.id_curso
        LEFT JOIN food_beneficiaries fb ON fb.id_alumno = a.id_alumno
        LEFT JOIN food_dietary_alerts fda ON fda.id_alumno = a.id_alumno
        WHERE a.activo = true
          AND a.rol = 'Estudiante'
          AND (
            LOWER(COALESCE(a.codigo_barra, '')) = LOWER($1)
            OR REGEXP_REPLACE(a.rut || COALESCE(a.dv, ''), '[^0-9Kk]', '', 'g')
               = REGEXP_REPLACE($1, '[^0-9Kk]', '', 'g')
          )
        LIMIT 1
      `, [barcode, canViewAlerts(req)]);
      if (!result.rows[0]) return res.status(404).json({ message: 'No se encontró un estudiante activo para ese código.' });
      res.json(result.rows[0]);
    } catch (error) {
      console.error('[food/students/scan]', error.message);
      res.status(500).json({ message: 'No fue posible resolver el código leído.' });
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
    const requestedServiceId = req.body?.serviceId
      ? asBoundedInteger(req.body.serviceId, 1, 2147483647)
      : null;
    const origin = req.body?.origin === 'lector' ? 'lector' : 'manual';
    if (!studentId || (req.body?.serviceId && !requestedServiceId)) {
      return res.status(400).json({ message: 'El estudiante o servicio no es válido.' });
    }

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
        WHERE a.id_alumno = $1
          AND (
            fs.id_service = $2
            OR ($2::int IS NULL AND LOCALTIME BETWEEN fs.start_time AND fs.end_time)
          )
        ORDER BY CASE WHEN fs.id_service = $2 THEN 0 ELSE 1 END, fs.sort_order
        LIMIT 1
        FOR SHARE OF a, fs
      `, [studentId, requestedServiceId]);
      const target = eligibility.rows[0];
      if (!target || !target.activo || !target.service_active) {
        await client.query('ROLLBACK');
        return res.status(requestedServiceId ? 404 : 409).json({
          code: requestedServiceId ? 'SERVICE_NOT_FOUND' : 'NO_ACTIVE_SERVICE',
          message: requestedServiceId
            ? 'Estudiante o servicio no disponible.'
            : 'No existe un servicio de alimentación activo en este horario.'
        });
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
      `, [studentId, target.id_service, origin, req.user.id]);
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
        metadata: { servicio: target.service_name, id_servicio: target.id_service },
        idempotencyKey: `food:registration:${registration.id_registration}:created:v${registration.version}`
      });
      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: 'REGISTRAR_ENTREGA_ALIMENTACION',
        entidad: 'registro_alimentacion',
        entidad_id: registration.id_registration,
        detalle: { id_alumno: studentId, id_servicio: target.id_service, servicio: target.service_name, origen: origin },
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

  router.post('/beneficiaries/import/preview', verifyPermission('food.import'), async (req, res) => {
    try {
      const prepared = await prepareFoodImport(req.body?.rows);
      const contentHash = prepared.rows.length > 0 ? hashFoodImport(prepared.rows) : null;
      res.status(prepared.errors.length > 0 ? 422 : 200).json({
        contentHash,
        total: Array.isArray(req.body?.rows) ? req.body.rows.length : 0,
        valid: prepared.rows.length,
        errors: prepared.errors,
        rows: prepared.rows.slice(0, 100)
      });
    } catch (error) {
      console.error('[food/import/preview]', error.message);
      res.status(500).json({ message: 'No fue posible previsualizar la nómina.' });
    }
  });

  router.post('/beneficiaries/import', verifyPermission('food.import'), async (req, res) => {
    const fileName = String(req.body?.fileName || '').trim().slice(0, 180) || null;
    const deactivateMissing = req.body?.deactivateMissing === true;
    const client = await pool.connect();
    try {
      const prepared = await prepareFoodImport(req.body?.rows);
      if (prepared.errors.length > 0 || prepared.rows.length === 0) {
        return res.status(422).json({
          message: 'La nómina contiene errores y no fue aplicada.',
          errors: prepared.errors,
          valid: prepared.rows.length
        });
      }
      const contentHash = hashFoodImport(prepared.rows);
      const idempotencyKey = String(req.body?.idempotencyKey || contentHash).trim();
      if (idempotencyKey !== contentHash) {
        return res.status(409).json({
          code: 'IMPORT_CHANGED',
          message: 'La nómina cambió después de la previsualización. Vuelva a revisarla.'
        });
      }

      await client.query('BEGIN');
      const previous = await client.query(
        'SELECT * FROM food_import_batches WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (previous.rows[0]) {
        await client.query('ROLLBACK');
        return res.json({
          message: 'Esta nómina ya había sido aplicada; no se repitieron cambios.',
          duplicate: true,
          batch: previous.rows[0]
        });
      }

      for (const row of prepared.rows) {
        await client.query(`
          INSERT INTO food_beneficiaries (
            id_alumno, source, valid_from, valid_until, active, notes, updated_by, updated_at
          )
          VALUES ($1, 'pae', COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (id_alumno) DO UPDATE SET
            source = 'pae',
            valid_from = EXCLUDED.valid_from,
            valid_until = EXCLUDED.valid_until,
            active = EXCLUDED.active,
            notes = EXCLUDED.notes,
            updated_by = EXCLUDED.updated_by,
            updated_at = CURRENT_TIMESTAMP
        `, [row.studentId, row.validFrom, row.validUntil, row.active, row.notes, req.user.id]);
      }

      let rowsDeactivated = 0;
      if (deactivateMissing) {
        const deactivated = await client.query(`
          UPDATE food_beneficiaries
          SET active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
          WHERE source = 'pae'
            AND active = true
            AND NOT (id_alumno = ANY($2::int[]))
        `, [req.user.id, prepared.rows.map((row) => row.studentId)]);
        rowsDeactivated = deactivated.rowCount;
      }

      const summary = {
        activados: prepared.rows.filter((row) => row.active).length,
        desactivados_en_nomina: prepared.rows.filter((row) => !row.active).length,
        desactivados_ausentes: rowsDeactivated,
        desactivar_ausentes: deactivateMissing
      };
      const inserted = await client.query(`
        INSERT INTO food_import_batches (
          idempotency_key, content_hash, file_name, rows_total,
          rows_applied, rows_deactivated, summary, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING *
      `, [
        idempotencyKey,
        contentHash,
        fileName,
        req.body.rows.length,
        prepared.rows.length,
        rowsDeactivated,
        JSON.stringify(summary),
        req.user.id
      ]);
      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: 'IMPORTAR_NOMINA_PAE',
        entidad: 'lote_alimentacion',
        entidad_id: inserted.rows[0].id_batch,
        detalle: { archivo: fileName, filas: prepared.rows.length, ...summary },
        ip: getClientIp(req)
      });
      await client.query('COMMIT');
      res.status(201).json({
        message: `Nómina aplicada: ${prepared.rows.length} estudiantes procesados.`,
        duplicate: false,
        batch: inserted.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') {
        const existing = await pool.query(
          'SELECT * FROM food_import_batches WHERE idempotency_key = $1',
          [String(req.body?.idempotencyKey || '')]
        );
        return res.json({
          message: 'Esta nómina ya había sido aplicada; no se repitieron cambios.',
          duplicate: true,
          batch: existing.rows[0] || null
        });
      }
      console.error('[food/import/apply]', error.message);
      res.status(500).json({ message: 'No fue posible aplicar la nómina.' });
    } finally {
      client.release();
    }
  });

  router.get('/imports', verifyPermission('food.import'), async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT fib.id_batch, fib.content_hash, fib.file_name, fib.rows_total,
               fib.rows_applied, fib.rows_deactivated, fib.summary, fib.created_at,
               u.nombre AS created_by_name
        FROM food_import_batches fib
        LEFT JOIN usuarios u ON u.id = fib.created_by
        ORDER BY fib.created_at DESC
        LIMIT 30
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('[food/imports]', error.message);
      res.status(500).json({ message: 'No fue posible obtener el historial de importaciones.' });
    }
  });

  router.get('/alerts/:studentId', verifyAnyPermission(['food.alerts.view', 'food.alerts.manage']), async (req, res) => {
    const studentId = asBoundedInteger(req.params.studentId, 1, 2147483647);
    if (!studentId) return res.status(400).json({ message: 'El estudiante no es válido.' });
    try {
      const result = await pool.query(`
        SELECT id_alert, id_alumno, alert_text, active, updated_at
        FROM food_dietary_alerts
        WHERE id_alumno = $1
      `, [studentId]);
      res.json({ alert: result.rows[0] || null });
    } catch (error) {
      console.error('[food/alerts/get]', error.message);
      res.status(500).json({ message: 'No fue posible consultar la alerta.' });
    }
  });

  router.put('/alerts/:studentId', verifyPermission('food.alerts.manage'), async (req, res) => {
    const studentId = asBoundedInteger(req.params.studentId, 1, 2147483647);
    const active = req.body?.active !== false;
    const alertText = String(req.body?.alertText || '').trim();
    if (!studentId) return res.status(400).json({ message: 'El estudiante no es válido.' });
    if (active && (alertText.length < 4 || alertText.length > 280)) {
      return res.status(400).json({ message: 'La alerta debe contener entre 4 y 280 caracteres.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const student = await client.query(
        "SELECT id_alumno FROM alumno WHERE id_alumno = $1 AND activo = true AND rol = 'Estudiante'",
        [studentId]
      );
      if (!student.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'No se encontró un estudiante activo.' });
      }
      const updated = await client.query(`
        INSERT INTO food_dietary_alerts (id_alumno, alert_text, active, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (id_alumno) DO UPDATE SET
          alert_text = CASE WHEN EXCLUDED.active THEN EXCLUDED.alert_text ELSE food_dietary_alerts.alert_text END,
          active = EXCLUDED.active,
          updated_by = EXCLUDED.updated_by,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id_alert, id_alumno, alert_text, active, updated_at
      `, [studentId, active ? alertText : 'Alerta desactivada', active, req.user.id]);
      await insertarAudit(client, {
        usuario_id: req.user.id,
        usuario_correo: req.user.correo,
        accion: active ? 'ACTUALIZAR_ALERTA_ALIMENTARIA' : 'DESACTIVAR_ALERTA_ALIMENTARIA',
        entidad: 'alerta_alimentaria',
        entidad_id: updated.rows[0].id_alert,
        detalle: { id_alumno: studentId, activa: active },
        ip: getClientIp(req)
      });
      await client.query('COMMIT');
      res.json({ message: active ? 'Alerta alimentaria actualizada.' : 'Alerta alimentaria desactivada.', alert: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[food/alerts/update]', error.message);
      res.status(500).json({ message: 'No fue posible actualizar la alerta.' });
    } finally {
      client.release();
    }
  });

  router.get('/reports', verifyPermission('food.reports'), async (req, res) => {
    const range = validateDateRange(req.query.from, req.query.to, { maxDays: 366 });
    if (range.error) return res.status(400).json({ message: range.error });
    const serviceId = req.query.serviceId ? asBoundedInteger(req.query.serviceId, 1, 2147483647) : null;
    const courseId = req.query.courseId ? asBoundedInteger(req.query.courseId, 1, 2147483647) : null;
    const studentId = req.query.studentId ? asBoundedInteger(req.query.studentId, 1, 2147483647) : null;
    if ((req.query.serviceId && !serviceId) || (req.query.courseId && !courseId) || (req.query.studentId && !studentId)) {
      return res.status(400).json({ message: 'Uno de los filtros no es válido.' });
    }
    try {
      const [summary, rows] = await Promise.all([
        pool.query(`
          SELECT fs.id_service, fs.name AS service_name,
                 COUNT(*) FILTER (WHERE fr.voided = false)::int AS deliveries,
                 COUNT(DISTINCT fr.id_alumno) FILTER (WHERE fr.voided = false)::int AS students,
                 COUNT(*) FILTER (WHERE fr.voided = true)::int AS voided
          FROM food_registrations fr
          JOIN food_services fs ON fs.id_service = fr.id_service
          LEFT JOIN matricula m ON m.id_alumno = fr.id_alumno
          WHERE fr.service_date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR fr.id_service = $3)
            AND ($4::int IS NULL OR m.id_curso = $4)
            AND ($5::int IS NULL OR fr.id_alumno = $5)
          GROUP BY fs.id_service, fs.name, fs.sort_order
          ORDER BY fs.sort_order
        `, [range.from, range.to, serviceId, courseId, studentId]),
        pool.query(`
          SELECT fr.id_registration, fr.service_date::text,
                 TO_CHAR(fr.delivered_at, 'HH24:MI:SS') AS delivered_time,
                 fr.origin, fr.voided, fr.void_reason,
                 fs.id_service, fs.name AS service_name,
                 a.id_alumno, a.rut, a.dv, a.nombres, a.paterno, a.materno,
                 c.id_curso, COALESCE(c.nombre_curso, 'Sin curso') AS course,
                 u.nombre AS registered_by_name
          FROM food_registrations fr
          JOIN food_services fs ON fs.id_service = fr.id_service
          JOIN alumno a ON a.id_alumno = fr.id_alumno
          LEFT JOIN matricula m ON m.id_alumno = a.id_alumno
          LEFT JOIN curso c ON c.id_curso = m.id_curso
          LEFT JOIN usuarios u ON u.id = fr.registered_by
          WHERE fr.service_date BETWEEN $1 AND $2
            AND ($3::int IS NULL OR fr.id_service = $3)
            AND ($4::int IS NULL OR c.id_curso = $4)
            AND ($5::int IS NULL OR fr.id_alumno = $5)
          ORDER BY fr.service_date DESC, fr.delivered_at DESC
          LIMIT 5000
        `, [range.from, range.to, serviceId, courseId, studentId])
      ]);
      res.json({
        period: range,
        filters: { serviceId, courseId, studentId },
        total: rows.rows.length,
        summary: summary.rows,
        registrations: rows.rows
      });
    } catch (error) {
      console.error('[food/reports]', error.message);
      res.status(500).json({ message: 'No fue posible generar el reporte de alimentación.' });
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
