const express = require('express');
const { calculateStatusAndSeverity } = require('../utils/punctuality');

const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeRutAndDv = (rutInput, dvInput) => {
  const rawRut = sanitizeText(rutInput).toUpperCase().replace(/\./g, '');
  const rawDv = sanitizeText(dvInput).toUpperCase();
  if (!rawRut) return { rut: '', dv: '' };
  if (rawRut.includes('-')) {
    const [rutPart, dvPart] = rawRut.split('-');
    return {
      rut: rutPart.replace(/\D/g, ''),
      dv: (dvPart || '').replace(/[^0-9K]/g, '').slice(0, 1)
    };
  }
  if (rawRut.length > 1 && /[0-9K]/.test(rawRut.slice(-1))) {
    return {
      rut: rawRut.slice(0, -1).replace(/\D/g, ''),
      dv: rawRut.slice(-1)
    };
  }
  return {
    rut: rawRut.replace(/\D/g, ''),
    dv: rawDv.replace(/[^0-9K]/g, '').slice(0, 1)
  };
};

const createPunctualityCompatRouter = ({
  pool,
  verifyToken,
  verifyPermission,
  verifyAnyPermission,
  insertarAudit,
  getClientIp
}) => {
  const router = express.Router();
  const getInstitutionalClock = async (queryable = pool) => {
    const result = await queryable.query("SELECT TO_CHAR(LOCALTIME, 'HH24:MI:SS') AS hora");
    return result.rows[0].hora;
  };

router.get('/students/scan/:barcode', verifyToken, verifyPermission('punctuality.register'), async (req, res) => {
  const { barcode } = req.params;
  const { tipo_registro } = req.query; // Entrada / Salida
  const cleanBarcode = sanitizeText(barcode).toUpperCase().replace(/\./g, '');

  try {
    // 1. Resolve barcode (RUT, QR, or ERP UUID)
    const query = `
      SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.rol, a.activo as alumno_activo, c.nombre_curso
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE a.rut = $1
         OR a.codigo_barra = $1
         OR LOWER(a.uuid_erp) = LOWER($1)
         OR LOWER(a.nombre_usuario) = LOWER($1)
    `;

    // Try finding by RUT directly or raw barcode
    let result = await pool.query(query, [cleanBarcode]);
    if (result.rows.length === 0) {
      // Try resolving barcode from RUT split (e.g. if barcode is 23704570K, check if rut=23704570 and dv=K)
      const parsed = normalizeRutAndDv(cleanBarcode);
      if (parsed.rut) {
        result = await pool.query(query, [parsed.rut]);
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    const alumno = result.rows[0];

    if (!alumno.alumno_activo) {
      return res.status(403).json({ message: 'Miembro inactivo en el sistema.' });
    }

    // 2. Check check-in limit
    const configRes = await pool.query('SELECT * FROM configuracion_asistencia LIMIT 1');
    const config = configRes.rows[0] || { hora_entrada: '08:00:00', hora_limite_atraso: '08:15:00' };

    const currentTimeStr = await getInstitutionalClock();

    const { status: calculatedStatus, severidad } = calculateStatusAndSeverity(tipo_registro || 'Entrada', currentTimeStr, config);

    // 3. Check if already registered today
    const checkQuery = `
      SELECT id_registro, hora, estado FROM attendance_registrations
      WHERE id_alumno = $1 AND fecha = CURRENT_DATE AND tipo_registro = $2 AND anulado = false
    `;
    const checkRes = await pool.query(checkQuery, [alumno.id_alumno, tipo_registro || 'Entrada']);
    const alreadyRegistered = checkRes.rows.length > 0;
    const registroPrevio = checkRes.rows[0] || null;

    res.json({
      alumno,
      alreadyRegistered,
      registroPrevio,
      restricciones: calculatedStatus === 'Atrasado' ? [`Ingreso Atrasado (${severidad})`] : [],
      statusPropuesto: calculatedStatus,
      severidad
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error al procesar escaneo.' });
  }
});

router.get('/students/:id/status', verifyToken, verifyAnyPermission(['punctuality.register', 'punctuality.view']), async (req, res) => {
  const { id } = req.params;
  const { tipo_registro } = req.query; // Entrada / Salida

  try {
    const query = `
      SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.rol, a.activo as alumno_activo, c.nombre_curso
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE a.id_alumno = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Miembro no encontrado.' });
    }

    const alumno = result.rows[0];

    // Check check-in limit
    const configRes = await pool.query('SELECT * FROM configuracion_asistencia LIMIT 1');
    const config = configRes.rows[0] || { hora_entrada: '08:00:00', hora_limite_atraso: '08:15:00' };

    const currentTimeStr = await getInstitutionalClock();

    const { status: calculatedStatus, severidad } = calculateStatusAndSeverity(tipo_registro || 'Entrada', currentTimeStr, config);

    // Check if already registered today
    const checkQuery = `
      SELECT id_registro, hora, estado FROM attendance_registrations
      WHERE id_alumno = $1 AND fecha = CURRENT_DATE AND tipo_registro = $2 AND anulado = false
    `;
    const checkRes = await pool.query(checkQuery, [alumno.id_alumno, tipo_registro || 'Entrada']);
    const alreadyRegistered = checkRes.rows.length > 0;

    res.json({
      alumno,
      alreadyRegistered,
      restricciones: calculatedStatus === 'Atrasado' ? [`Ingreso Atrasado (${severidad})`] : [],
      statusPropuesto: calculatedStatus,
      severidad
    });
  } catch (err) {
    res.status(500).json({ message: 'Error al obtener estado.' });
  }
});

// ATTENDANCE REGISTRATIONS
// Alias transitorio de ingreso: conserva lectores instalados mientras se migra
// su destino a POST /api/puntualidad/registros. Aplica las mismas reglas.
router.post('/asistencia', verifyToken, verifyPermission('punctuality.register'), async (req, res) => {
  const { id_alumno } = req.body;
  if (!id_alumno) {
    return res.status(400).json({ message: 'ID del alumno es requerido.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const studentRes = await client.query('SELECT id_alumno, activo FROM alumno WHERE id_alumno = $1 FOR SHARE', [id_alumno]);
    if (studentRes.rows.length === 0 || !studentRes.rows[0].activo) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Alumno activo no encontrado.' });
    }
    const configRes = await client.query('SELECT * FROM configuracion_asistencia LIMIT 1');
    const config = configRes.rows[0] || { hora_entrada: '08:00:00', hora_limite_atraso: '08:15:00' };
    const currentTimeStr = await getInstitutionalClock(client);
    const { status, severidad } = calculateStatusAndSeverity('Entrada', currentTimeStr, config);
    const origen = 'lector';
    const insertQuery = `
      INSERT INTO attendance_registrations
        (id_alumno, fecha, hora, estado, tipo_registro, severidad, origen, registrado_por, creado_en)
      VALUES ($1, CURRENT_DATE, LOCALTIME, $2, 'Entrada', $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (id_alumno, fecha, tipo_registro) WHERE anulado = false DO NOTHING
      RETURNING *
    `;
    const result = await client.query(insertQuery, [id_alumno, status, severidad, origen, req.user.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Registro ya realizado hoy.' });
    }
    await insertarAudit(client, {
      usuario_id: req.user.id,
      usuario_correo: req.user.correo,
      accion: 'REGISTRAR_INGRESO',
      entidad: 'registro_puntualidad',
      entidad_id: result.rows[0].id_registro,
      detalle: { id_alumno, estado: status, severidad, origen, endpoint_legacy: true },
      ip: getClientIp(req)
    });
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ message: 'Registro ya realizado hoy.' });
    res.status(500).json({ message: 'Error al registrar el ingreso.' });
  } finally {
    client.release();
  }
});



  return router;
};

module.exports = { createPunctualityCompatRouter };
