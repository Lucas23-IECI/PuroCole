const express = require('express');

const { isIsoDate, validateDateRange } = require('../utils/validation');

const createAuditRouter = ({ pool, verifyToken, verifyPermission }) => {
  const router = express.Router();

  router.get('/audit', verifyToken, verifyPermission('audit.view'), async (req, res) => {
    const { accion, usuario_correo, cuenta_id, relacion = 'todas', desde, hasta, page = '1', limit = '20' } = req.query;

    if ((desde && !isIsoDate(desde)) || (hasta && !isIsoDate(hasta))) {
      return res.status(400).json({ message: 'Las fechas de auditoría no son válidas.' });
    }
    if (desde && hasta) {
      const dateRange = validateDateRange(desde, hasta, { maxDays: 3650 });
      if (dateRange.error) return res.status(400).json({ message: dateRange.error });
    }
    if (!['todas', 'realizada', 'sobre_cuenta'].includes(relacion)) {
      return res.status(400).json({ message: 'El tipo de actividad solicitado no es válido.' });
    }
    if (!cuenta_id && relacion !== 'todas') {
      return res.status(400).json({ message: 'El filtro de relación requiere una cuenta seleccionada.' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    const conditions = [];
    const params = [];
    let index = 1;
    let subject = null;
    let accountParamIndex = null;

    if (cuenta_id) {
      const accountId = parseInt(cuenta_id, 10);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        return res.status(400).json({ message: 'La cuenta indicada no es válida.' });
      }
      const subjectRes = await pool.query(`
        SELECT u.id, u.correo, u.nombre, u.cargo, u.rol, u.activo, u.eliminado_en,
               p.nombre AS profile_name
        FROM usuarios u
        LEFT JOIN perfiles_acceso p ON p.codigo = u.rol
        WHERE u.id = $1
      `, [accountId]);
      if (!subjectRes.rows.length) return res.status(404).json({ message: 'La cuenta indicada no existe.' });
      subject = subjectRes.rows[0];
      accountParamIndex = index;
      if (relacion === 'realizada') {
        conditions.push(`a.usuario_id = $${index}`);
      } else if (relacion === 'sobre_cuenta') {
        conditions.push(`(a.entidad = 'usuario' AND a.entidad_id = $${index} AND a.usuario_id IS DISTINCT FROM $${index})`);
      } else {
        conditions.push(`(a.usuario_id = $${index} OR (a.entidad = 'usuario' AND a.entidad_id = $${index}))`);
      }
      params.push(accountId);
      index += 1;
    }

    if (accion) { conditions.push(`a.accion = $${index++}`); params.push(accion.trim()); }
    if (usuario_correo) { conditions.push(`a.usuario_correo ILIKE $${index++}`); params.push(`%${usuario_correo.trim()}%`); }
    if (desde) { conditions.push(`a.fecha >= $${index++}`); params.push(desde); }
    if (hasta) { conditions.push(`a.fecha < ($${index++}::date + interval '1 day')`); params.push(hasta); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const countRes = await pool.query(`SELECT COUNT(*) FROM audit_log a ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);
      const relationshipSelection = accountParamIndex
        ? `CASE WHEN a.usuario_id = $${accountParamIndex} THEN 'realizada' ELSE 'sobre_cuenta' END`
        : 'NULL::text';
      const dataRes = await pool.query(
        `SELECT a.id, a.usuario_id, a.usuario_correo, u.nombre AS usuario_nombre,
                a.accion, a.entidad, a.entidad_id, a.detalle, a.ip, a.fecha,
                ${relationshipSelection} AS relacion_cuenta
         FROM audit_log a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         ${whereClause}
         ORDER BY a.fecha DESC
         LIMIT $${index++} OFFSET $${index++}`,
        [...params, limitNum, offset]
      );
      res.json({ total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, rows: dataRes.rows, subject });
    } catch (error) {
      console.error('[audit/list]', error.message);
      res.status(500).json({ message: 'Error al obtener auditoría.' });
    }
  });

  return router;
};

module.exports = { createAuditRouter };
