const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../middleware/auth');
const { getVisibleModuleCatalog } = require('../modules/catalog');
const { attachPermissionProfile } = require('../utils/permissions');
const { normalizeEmail, validatePassword } = require('../utils/security');

const cookieOptions = {
  httpOnly: true,
  secure: String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true',
  sameSite: 'strict',
  path: '/'
};

const toPublicUser = (user) => ({
  id: user.id,
  correo: user.correo,
  rol: user.rol,
  profile_name: user.profile_name || user.rol,
  nombre: user.nombre,
  cargo: user.cargo || null,
  debe_cambiar_password: Boolean(user.debe_cambiar_password),
  permissions: Array.isArray(user.permissions) ? user.permissions : [],
  recommended_permissions: Array.isArray(user.recommended_permissions) ? user.recommended_permissions : []
});

const setSessionCookie = (res, user) => {
  const token = jwt.sign(
    {
      id: user.id,
      correo: user.correo,
      rol: user.rol,
      nombre: user.nombre,
      token_version: user.token_version
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.cookie('token', token, {
    ...cookieOptions,
    maxAge: 12 * 60 * 60 * 1000
  });
};

const createAuthRouter = ({
  pool,
  loginLimiter,
  verifyToken,
  insertarAudit,
  registrarAudit,
  getClientIp
}) => {
  const router = express.Router();

  router.post('/auth/login', loginLimiter, async (req, res) => {
    const { correo, password } = req.body;
    if (!correo || !password) {
      return res.status(400).json({ message: 'Correo y contraseña son requeridos.' });
    }

    try {
      const normalizedEmail = normalizeEmail(correo);
      const userRes = await pool.query(
        'SELECT * FROM usuarios WHERE LOWER(correo) = $1 AND eliminado_en IS NULL LIMIT 1',
        [normalizedEmail]
      );

      if (userRes.rows.length === 0) {
        await registrarAudit({
          usuario_correo: normalizedEmail.slice(0, 150),
          accion: 'LOGIN_FALLIDO',
          detalle: { motivo: 'credenciales_invalidas' },
          ip: getClientIp(req)
        });
        return res.status(401).json({ message: 'Credenciales inválidas.' });
      }

      const user = userRes.rows[0];
      if (!user.activo) {
        await registrarAudit({
          usuario_id: user.id,
          usuario_correo: user.correo,
          accion: 'LOGIN_FALLIDO',
          detalle: { motivo: 'cuenta_desactivada' },
          ip: getClientIp(req)
        });
        return res.status(401).json({ message: 'Credenciales inválidas.' });
      }

      if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
        return res.status(423).json({ message: 'Cuenta bloqueada temporalmente. Intente más tarde.' });
      }

      const validPass = await bcrypt.compare(password, user.password_hash);
      if (!validPass) {
        await pool.query(`
          UPDATE usuarios
          SET bloqueado_hasta = CASE
                WHEN intentos_fallidos + 1 >= 5 THEN CURRENT_TIMESTAMP + interval '15 minutes'
                ELSE NULL
              END,
              intentos_fallidos = CASE
                WHEN intentos_fallidos + 1 >= 5 THEN 0
                ELSE intentos_fallidos + 1
              END
          WHERE id = $1
        `, [user.id]);
        await registrarAudit({
          usuario_id: user.id,
          usuario_correo: user.correo,
          accion: 'LOGIN_FALLIDO',
          detalle: { motivo: 'credenciales_invalidas' },
          ip: getClientIp(req)
        });
        return res.status(401).json({ message: 'Credenciales inválidas.' });
      }

      const updatedUser = await pool.query(
        `UPDATE usuarios
         SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, correo, rol, nombre, cargo, token_version, debe_cambiar_password`,
        [user.id]
      );
      const sessionUser = await attachPermissionProfile(pool, updatedUser.rows[0]);
      setSessionCookie(res, sessionUser);

      await registrarAudit({
        usuario_id: sessionUser.id,
        usuario_correo: sessionUser.correo,
        accion: 'LOGIN_EXITOSO',
        ip: getClientIp(req)
      });

      res.json({ user: toPublicUser(sessionUser) });
    } catch (error) {
      console.error('[auth/login]', error.message);
      res.status(500).json({ message: 'Error en el servidor.' });
    }
  });

  router.get('/auth/me', verifyToken, (req, res) => {
    res.json({ user: toPublicUser(req.user) });
  });

  router.get('/modules', verifyToken, (req, res) => {
    res.json(getVisibleModuleCatalog(req.user.permissions));
  });

  router.post('/auth/change-password', verifyToken, async (req, res) => {
    const { current_password: currentPassword, new_password: newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'La contraseña actual y la nueva son obligatorias.' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query('SELECT * FROM usuarios WHERE id = $1 FOR UPDATE', [req.user.id]);
      if (userRes.rows.length === 0 || !userRes.rows[0].activo) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Usuario no encontrado.' });
      }

      const user = userRes.rows[0];
      const currentIsValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!currentIsValid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'La contraseña actual no es correcta.' });
      }
      if (await bcrypt.compare(newPassword, user.password_hash)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'La nueva contraseña debe ser distinta de la actual.' });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      const updated = await client.query(`
        UPDATE usuarios
        SET password_hash = $1,
            debe_cambiar_password = false,
            password_actualizado_en = CURRENT_TIMESTAMP,
            token_version = token_version + 1,
            intentos_fallidos = 0,
            bloqueado_hasta = NULL
        WHERE id = $2
        RETURNING id, correo, rol, nombre, token_version, debe_cambiar_password
      `, [hash, user.id]);

      await insertarAudit(client, {
        usuario_id: user.id,
        usuario_correo: user.correo,
        accion: 'CAMBIAR_PASSWORD_PROPIA',
        entidad: 'usuario',
        entidad_id: user.id,
        ip: getClientIp(req)
      });
      await client.query('COMMIT');

      const sessionUser = await attachPermissionProfile(client, updated.rows[0]);
      setSessionCookie(res, sessionUser);
      res.json({ message: 'Contraseña actualizada.', user: toPublicUser(sessionUser) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[auth/change-password]', error.message);
      res.status(500).json({ message: 'No fue posible actualizar la contraseña.' });
    } finally {
      client.release();
    }
  });

  router.post('/auth/logout', async (req, res) => {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        await registrarAudit({
          usuario_id: decoded.id,
          usuario_correo: decoded.correo,
          accion: 'LOGOUT',
          entidad: 'usuario',
          entidad_id: decoded.id,
          ip: getClientIp(req)
        });
      } catch {
        // La cookie se limpia aunque la sesión haya vencido.
      }
    }
    res.clearCookie('token', cookieOptions);
    res.json({ message: 'Sesión cerrada exitosamente.' });
  });

  return router;
};

module.exports = {
  createAuthRouter,
  cookieOptions,
  setSessionCookie,
  toPublicUser
};
