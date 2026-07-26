const express = require('express');
const { sanitizeSnapshotRow } = require('../utils/security');

const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeHeaderKey = (value) => {
  return sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const pickRowValue = (row, aliases) => {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeaderKey(alias)));
  for (const [key, value] of Object.entries(row || {})) {
    if (!aliasSet.has(normalizeHeaderKey(key))) continue;
    if (value === undefined || value === null) continue;
    const cleaned = sanitizeText(value);
    if (cleaned !== '') return cleaned;
  }
  return '';
};

const normalizeRutAndDv = (rutInput, dvInput) => {
  let rawRut = sanitizeText(rutInput).toUpperCase().replace(/\./g, '');
  let rawDv = sanitizeText(dvInput).toUpperCase();

  if (!rawRut) return { rut: '', dv: '' };

  if (rawRut.includes('-')) {
    const [rutPart, dvPart] = rawRut.split('-');
    return {
      rut: rutPart.replace(/\D/g, ''),
      dv: (dvPart || '').replace(/[^0-9K]/g, '').slice(0, 1)
    };
  }

  if (rawRut.length > 1) {
    const lastChar = rawRut.slice(-1);
    if (/[0-9K]/.test(lastChar)) {
      return {
        rut: rawRut.slice(0, -1).replace(/\D/g, ''),
        dv: lastChar
      };
    }
  }

  return {
    rut: rawRut.replace(/\D/g, ''),
    dv: rawDv.replace(/[^0-9K]/g, '').slice(0, 1)
  };
};

const normalizeDateInput = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(base.getTime() + value * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  const cleaned = sanitizeText(value);
  if (!cleaned) return null;
  const parts = cleaned.split(/[-/]/);
  if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
    const parsed = new Date(Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const createStudentAdminRouter = ({
  pool,
  verifyToken,
  verifyPermission,
  registrarAudit,
  getClientIp
}) => {
  const router = express.Router();

// BULK SYNC EXCEL IMPORT
router.post('/students/bulk-sync', verifyToken, verifyPermission('students.import'), async (req, res) => {
  const rows = Array.isArray(req.body?.students) ? req.body.students : [];
  if (!rows.length) {
    return res.status(400).json({ message: 'No se recibieron filas para procesar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const summary = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      warnings: [],
      errors: []
    };

    for (let index = 0; index < rows.length; index++) {
      const excelRowNumber = index + 2;
      const rowSavepoint = `students_sync_row_${index}`;
      await client.query(`SAVEPOINT ${rowSavepoint}`);

      try {
        const rawRow = rows[index];

        // 1. PICK VALUES FROM EXCEL COLUMNS
        const uuidErp = pickRowValue(rawRow, ['ID de Usuario (no modificar)', 'id usuario', 'id_usuario', 'uuid_erp']);
        const rutInput = pickRowValue(rawRow, ['RUT', 'run', 'id']);
        const nombresInput = pickRowValue(rawRow, ['Nombres', 'nombre', 'name']);
        const apellidosInput = pickRowValue(rawRow, ['Apellidos', 'apellido', 'lastname']);
        const emailInput = pickRowValue(rawRow, ['Email', 'correo', 'mail']);
        const telefonoInput = pickRowValue(rawRow, ['Teléfono', 'telefono', 'phone']);
        const rolInput = pickRowValue(rawRow, ['Rol', 'rol', 'role']);
        const cursoInput = pickRowValue(rawRow, ['Curso', 'grade']);
        const seccionInput = pickRowValue(rawRow, ['Sección', 'seccion']);
        const generoInput = pickRowValue(rawRow, ['Género', 'genero', 'gender']);
        const nacimientoInput = pickRowValue(rawRow, ['Fecha Nacimiento', 'fecha_nacimiento', 'nacimiento']);
        const userUsername = pickRowValue(rawRow, ['Nombre Usuario', 'nombre_usuario', 'username']);
        const rutApoderado = pickRowValue(rawRow, ['RUT Apoderados', 'apoderado_rut', 'rut_apoderado']);
        const snapshotRow = sanitizeSnapshotRow(rawRow);

        // 2. NORMALIZATIONS
        const { rut, dv } = normalizeRutAndDv(rutInput);
        if (!rut) {
          summary.errors.push({ row: excelRowNumber, message: 'RUT vacío o inválido.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        if (!nombresInput) {
          summary.errors.push({ row: excelRowNumber, message: 'Falta nombre del usuario.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        // Split apellidos into paterno / materno
        const surnameParts = (apellidosInput || '').split(/\s+/).filter(Boolean);
        const paterno = surnameParts.length > 0 ? surnameParts[0] : 'Sin Apellido';
        const materno = surnameParts.length > 1 ? surnameParts.slice(1).join(' ') : '';

        const rol = rolInput || 'Estudiante';
        const email = emailInput || null;
        const telefono = telefonoInput || null;
        const seccion = seccionInput || null;
        const genero = generoInput || null;
        const fechaNacimiento = normalizeDateInput(nacimientoInput);
        const username = userUsername || (nombresInput.charAt(0) + paterno).toLowerCase().replace(/\s+/g, '');
        // Barcode is clean RUT + DV
        const codigoBarra = (rut + (dv || '')).toUpperCase();

        // 3. RESOLVE COURSE
        let courseId = null;
        if (cursoInput) {
          const courseLookup = await client.query('SELECT id_curso FROM curso WHERE LOWER(nombre_curso) = LOWER($1) LIMIT 1', [cursoInput]);
          if (courseLookup.rows.length > 0) {
            courseId = courseLookup.rows[0].id_curso;
          } else {
            const insertedCourse = await client.query(
              'INSERT INTO curso (nombre_curso) VALUES ($1) RETURNING id_curso',
              [cursoInput]
            );
            courseId = insertedCourse.rows[0].id_curso;
          }
        }

        // 4. CHECK EXISTING BY RUT OR UUID
        const studentLookup = await client.query(
          `SELECT a.id_alumno, a.uuid_erp, a.rut,
                  COALESCE(s.raw_payload = $3::jsonb, false) AS sin_cambios
           FROM alumno a
           LEFT JOIN alumno_excel_snapshot s ON s.id_alumno = a.id_alumno
           WHERE a.rut = $1 OR (a.uuid_erp IS NOT NULL AND a.uuid_erp = $2)
           LIMIT 1`,
          [rut, uuidErp, JSON.stringify(snapshotRow)]
        );
        const existing = studentLookup.rows[0] || null;

        let idAlumno;
        if (!existing) {
          // INSERT
          const insRes = await client.query(
            `INSERT INTO alumno (
              uuid_erp, rut, dv, nombres, paterno, materno, email, telefono, rol,
              seccion, genero, fecha_nacimiento, nombre_usuario, rut_apoderado, codigo_barra
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id_alumno`,
            [
              uuidErp || null, rut, dv || null, nombresInput, paterno, materno || null,
              email, telefono, rol, seccion, genero, fechaNacimiento, username, rutApoderado, codigoBarra
            ]
          );
          idAlumno = insRes.rows[0].id_alumno;
          summary.inserted++;
        } else if (!existing.sin_cambios) {
          // UPDATE if different
          idAlumno = existing.id_alumno;

          const updateQuery = `
            UPDATE alumno
            SET uuid_erp = COALESCE($1, uuid_erp),
                dv = $2,
                nombres = $3,
                paterno = $4,
                materno = $5,
                email = COALESCE($6, email),
                telefono = COALESCE($7, telefono),
                rol = $8,
                seccion = COALESCE($9, seccion),
                genero = COALESCE($10, genero),
                fecha_nacimiento = COALESCE($11, fecha_nacimiento),
                nombre_usuario = COALESCE($12, nombre_usuario),
                rut_apoderado = COALESCE($13, rut_apoderado),
                codigo_barra = $14,
                fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id_alumno = $15
          `;
          await client.query(updateQuery, [
            uuidErp || null, dv || null, nombresInput, paterno, materno || null,
            email, telefono, rol, seccion, genero, fechaNacimiento, username, rutApoderado, codigoBarra,
            idAlumno
          ]);
          summary.updated++;
        } else {
          idAlumno = existing.id_alumno;
          summary.unchanged++;
        }

        // 5. UPDATE MATRICULA / CURSO LINK
        if (courseId) {
          const matRes = await client.query('SELECT id_matricula, id_curso FROM matricula WHERE id_alumno = $1 LIMIT 1', [idAlumno]);
          if (matRes.rows.length === 0) {
            await client.query('INSERT INTO matricula (id_alumno, id_curso) VALUES ($1, $2)', [idAlumno, courseId]);
          } else if (matRes.rows[0].id_curso !== courseId) {
            await client.query('UPDATE matricula SET id_curso = $1 WHERE id_matricula = $2', [courseId, matRes.rows[0].id_matricula]);
          }
        }

        // 6. Guardar snapshot saneado. La importación nunca crea ni modifica cuentas de acceso.
        await client.query(
          `INSERT INTO alumno_excel_snapshot (id_alumno, raw_payload, fecha_importacion)
           VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (id_alumno)
           DO UPDATE SET raw_payload = EXCLUDED.raw_payload, fecha_importacion = EXCLUDED.fecha_importacion`,
          [idAlumno, JSON.stringify(snapshotRow)]
        );

        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
      } catch (rowError) {
        await client.query(`ROLLBACK TO SAVEPOINT ${rowSavepoint}`);
        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
        console.error(`[bulk-sync] Row error at row ${excelRowNumber}:`, rowError.message);
        summary.errors.push({ row: excelRowNumber, message: rowError.message });
      }
    }

    await client.query('COMMIT');
    await registrarAudit({
      usuario_id: req.user.id,
      usuario_correo: req.user.correo,
      accion: 'IMPORTACION_ALUMNOS',
      detalle: { total: summary.total, insertados: summary.inserted, actualizados: summary.updated, errores: summary.errors.length },
      ip: getClientIp(req)
    });
    res.json(summary);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ message: 'Error al sincronizar datos del colegio.' });
  } finally {
    client.release();
  }
});

// CREATE STUDENT
router.post('/students', verifyToken, verifyPermission('students.manage'), async (req, res) => {
  const { rut, dv, nombres, paterno, materno, email, telefono, rol, grade } = req.body;
  if (!rut || !nombres || !paterno) {
    return res.status(400).json({ message: 'RUT, nombres y apellido paterno son requeridos.' });
  }
  const cleanRut = rut.replace(/\D/g, '');
  const cleanDv = (dv || '').toUpperCase();
  const codigoBarra = cleanRut + cleanDv;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const duplicate = await client.query('SELECT id_alumno FROM alumno WHERE rut = $1', [cleanRut]);
    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'RUT ya registrado en el sistema.' });
    }

    const ins = await client.query(
      `INSERT INTO alumno (rut, dv, nombres, paterno, materno, email, telefono, rol, codigo_barra)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_alumno`,
      [cleanRut, cleanDv, nombres, paterno, materno || null, email || null, telefono || null, rol || 'Estudiante', codigoBarra]
    );
    const idAlumno = ins.rows[0].id_alumno;

    // Course association
    if (grade) {
      let courseId;
      const courseLookup = await client.query('SELECT id_curso FROM curso WHERE LOWER(nombre_curso) = LOWER($1) LIMIT 1', [grade]);
      if (courseLookup.rows.length > 0) {
        courseId = courseLookup.rows[0].id_curso;
      } else {
        const insertedCourse = await client.query(
          'INSERT INTO curso (nombre_curso) VALUES ($1) ON CONFLICT (nombre_curso) DO UPDATE SET nombre_curso = EXCLUDED.nombre_curso RETURNING id_curso',
          [grade]
        );
        courseId = insertedCourse.rows[0].id_curso;
      }
      await client.query('INSERT INTO matricula (id_alumno, id_curso) VALUES ($1, $2)', [idAlumno, courseId]);
    }

    await client.query('COMMIT');

    await registrarAudit({
      usuario_id: req.user.id,
      usuario_correo: req.user.correo,
      accion: 'CREAR_ALUMNO',
      entidad: 'alumno',
      entidad_id: idAlumno,
      detalle: { nombres, paterno, rut },
      ip: getClientIp(req)
    });

    res.json({ id_alumno: idAlumno, message: 'Miembro creado exitosamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ message: 'El RUT, usuario o código de barra ya se encuentra registrado.' });
    res.status(500).json({ message: 'Error al crear miembro.' });
  } finally {
    client.release();
  }
});

// UPDATE STUDENT
router.put('/students/:id', verifyToken, verifyPermission('students.manage'), async (req, res) => {
  const { id } = req.params;
  const { nombres, paterno, materno, email, telefono, rol, grade } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE alumno
       SET nombres = $1, paterno = $2, materno = $3, email = $4, telefono = $5, rol = $6
       WHERE id_alumno = $7 RETURNING id_alumno`,
      [nombres, paterno, materno || null, email || null, telefono || null, rol, id]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    if (grade) {
      let courseId;
      const courseLookup = await client.query('SELECT id_curso FROM curso WHERE LOWER(nombre_curso) = LOWER($1) LIMIT 1', [grade]);
      if (courseLookup.rows.length > 0) {
        courseId = courseLookup.rows[0].id_curso;
      } else {
        const insertedCourse = await client.query(
          'INSERT INTO curso (nombre_curso) VALUES ($1) ON CONFLICT (nombre_curso) DO UPDATE SET nombre_curso = EXCLUDED.nombre_curso RETURNING id_curso',
          [grade]
        );
        courseId = insertedCourse.rows[0].id_curso;
      }
      await pool.query(
        `INSERT INTO matricula (id_alumno, id_curso) VALUES ($1, $2)
         ON CONFLICT (id_alumno) DO UPDATE SET id_curso = EXCLUDED.id_curso`,
        [id, courseId]
      );
    }

    await registrarAudit({
      usuario_id: req.user.id,
      usuario_correo: req.user.correo,
      accion: 'EDITAR_ALUMNO',
      entidad: 'alumno',
      entidad_id: id,
      detalle: { nombres, paterno },
      ip: getClientIp(req)
    });

    res.json({ message: 'Miembro actualizado exitosamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ message: 'Error al actualizar miembro.' });
  } finally {
    client.release();
  }
});

// DELETE STUDENT
router.delete('/students/:id', verifyToken, verifyPermission('students.manage'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE alumno SET activo = false WHERE id_alumno = $1', [id]);

    await registrarAudit({
      usuario_id: req.user.id,
      usuario_correo: req.user.correo,
      accion: 'DESACTIVAR_ALUMNO',
      entidad: 'alumno',
      entidad_id: id,
      ip: getClientIp(req)
    });

    res.json({ message: 'Miembro desactivado exitosamente.' });
  } catch (err) {
    res.status(500).json({ message: 'Error al desactivar miembro.' });
  }
});

  return router;
};

module.exports = { createStudentAdminRouter };
