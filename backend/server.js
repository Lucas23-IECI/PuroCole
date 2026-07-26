const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const { randomUUID } = require('crypto');
const { rateLimit } = require('express-rate-limit');
require('dotenv').config();

const { verifyToken, verifyPermission, verifyAnyPermission } = require('./middleware/auth');
const { runMigrations } = require('./migrations');
const {
  normalizeEmail,
  validateEmail,
  validatePassword
} = require('./utils/security');
const { createCoreRouter } = require('./routes/core');
const { createPunctualityRouter } = require('./routes/punctuality');
const { createPunctualityCompatRouter } = require('./routes/punctualityCompat');
const { createFoodRouter } = require('./routes/food');
const { createAuthRouter } = require('./routes/auth');
const { createAuditRouter } = require('./routes/audit');
const { createStudentAdminRouter } = require('./routes/studentAdmin');
const { createAccessAdminRouter } = require('./routes/accessAdmin');

const app = express();
app.set('trust proxy', 1);

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,100}$/;

app.use((req, res, next) => {
  const suppliedRequestId = String(req.get('x-request-id') || '');
  const requestId = REQUEST_ID_PATTERN.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    if (req.path === '/api/health' || req.path.startsWith('/api/health/')) return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(JSON.stringify({
      event: 'http_request',
      request_id: requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      user_id: req.user?.id || null
    }));
  });

  next();
});

// CORS CONFIGURATION
const rawOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
let allowedOrigins = rawOrigin.split(',').map(o => o.trim());
const fallbackOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];
if (process.env.NODE_ENV !== 'production') {
  fallbackOrigins.forEach(origin => {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
  });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.error(`[CORS REJECTED] Origin: ${origin}`);
    const error = new Error('Origen no autorizado.');
    error.code = 'CORS_ORIGIN_REJECTED';
    error.status = 403;
    callback(error);
  },
  credentials: true
}));

app.use((error, req, res, next) => {
  if (error?.code === 'CORS_ORIGIN_REJECTED') {
    return res.status(403).json({
      message: 'Origen no autorizado.',
      request_id: req.requestId
    });
  }
  return next(error);
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path.startsWith('/health/'),
  message: { message: 'Se alcanzó el límite temporal de solicitudes. Intente nuevamente en unos minutos.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Demasiados intentos de acceso. Intente nuevamente en 15 minutos.' }
});

app.use('/api', apiLimiter);

const PORT = process.env.PORT || 5000;
const getDefaultUserPassword = () => {
  const password = process.env.DEFAULT_USER_PASSWORD;
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(`DEFAULT_USER_PASSWORD no cumple la política: ${passwordError}`);
  return password;
};

// AUDIT HELPER
const insertarAudit = async (queryable, { usuario_id, usuario_correo, accion, entidad, entidad_id, detalle, ip }) => {
  await queryable.query(
    `INSERT INTO audit_log (usuario_id, usuario_correo, accion, entidad, entidad_id, detalle, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuario_id, usuario_correo, accion, entidad, entidad_id, detalle ? JSON.stringify(detalle) : null, ip]
  );
};

const registrarAudit = async (event) => {
  try {
    await insertarAudit(pool, event);
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
};

const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
};

app.use('/api/puntualidad', createPunctualityRouter({
  pool,
  verifyToken,
  verifyPermission,
  verifyAnyPermission,
  insertarAudit,
  getClientIp
}));

const bootstrapBaseSchema = async () => {
  const tableExists = await pool.query("SELECT to_regclass('alumno') AS exists");
  if (tableExists.rows[0]?.exists) return false;

  const initSqlPath = path.join(__dirname, 'init.sql');
  const initSql = fs.readFileSync(initSqlPath, 'utf8');

  console.log('No se detectó el esquema base. Aplicando init.sql...');
  await pool.query(initSql);
  console.log('Esquema base creado correctamente.');
  return true;
};

// OPERATIONAL HEALTH
app.get('/api/health/live', (req, res) => {
  res.json({
    status: 'OK',
    service: 'purocole-api',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

const readinessHandler = async (req, res) => {
  try {
    const database = await pool.query(`
      SELECT
        current_database() AS name,
        to_regclass('public.schema_migrations') IS NOT NULL AS migrations_ready
    `);
    const ready = Boolean(database.rows[0]?.migrations_ready);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'OK' : 'ERROR',
      service: 'purocole-api',
      database: ready ? 'ready' : 'migrations_unavailable',
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: 'ERROR',
      service: 'purocole-api',
      database: 'unavailable',
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/api/health/ready', readinessHandler);
app.get('/api/health', readinessHandler);

app.use('/api', createAuthRouter({
  pool,
  loginLimiter,
  verifyToken,
  insertarAudit,
  registrarAudit,
  getClientIp
}));

app.use('/api', createCoreRouter({
  pool,
  verifyToken,
  verifyAnyPermission
}));

app.use('/api/food', createFoodRouter({
  pool,
  verifyToken,
  verifyPermission,
  verifyAnyPermission,
  insertarAudit,
  getClientIp
}));

// SUPERFICIE HEREDADA DE ASISTENCIA
//
// El producto vigente controla ingresos y atrasos. Estos endpoints se
// permanecen bloqueados para que instalaciones antiguas reciban una respuesta
// inequívoca. La implementación heredada ya no forma parte del servidor activo.
const legacyAttendanceGone = (req, res) => res.status(410).json({
  code: 'MODULO_ASISTENCIA_DESCONTINUADO',
  message: 'Esta función fue retirada. Utiliza el módulo institucional de puntualidad y atrasos.',
  replacement: '/api/puntualidad'
});

app.all([
  '/api/attendance/config',
  '/api/asistencia/today',
  '/api/asistencia/today-stats',
  '/api/asistencia/range-stats',
  '/api/asistencia/inasistencias',
  '/api/asistencia/history',
  '/api/admin/reportes/asistencia',
  '/api/asistencia/justificar-nueva',
  '/api/asistencia/registrar-ausencia',
  '/api/asistencia/justificaciones',
  '/api/asistencia/alertas-tempranas'
], verifyToken, legacyAttendanceGone);

app.all('/api/asistencia/:id/justificar', verifyToken, legacyAttendanceGone);
app.all('/api/asistencia/justificacion/:id', verifyToken, legacyAttendanceGone);
app.all('/api/asistencia/download/:id', verifyToken, legacyAttendanceGone);
app.put('/api/asistencia/:id', verifyToken, legacyAttendanceGone);
app.delete('/api/asistencia/:id', verifyToken, legacyAttendanceGone);

app.use('/api', createPunctualityCompatRouter({
  pool,
  verifyToken,
  verifyPermission,
  verifyAnyPermission,
  insertarAudit,
  getClientIp
}));

app.use('/api', createStudentAdminRouter({
  pool,
  verifyToken,
  verifyPermission,
  registrarAudit,
  getClientIp
}));
app.use('/api', createAccessAdminRouter({
  pool,
  verifyToken,
  verifyPermission,
  insertarAudit,
  getClientIp
}));

app.use('/api', createAuditRouter({
  pool,
  verifyToken,
  verifyPermission
}));

const ensureBaseData = async (isNewSchema) => {
  await pool.query(`
    INSERT INTO configuracion_asistencia (hora_entrada, hora_limite_atraso)
    SELECT '08:00:00', '08:15:00'
    WHERE NOT EXISTS (SELECT 1 FROM configuracion_asistencia)
  `);

  const baseCourses = [
    'Pre-Kinder', 'Kinder', '1° Básico', '2° Básico', '3° Básico', '4° Básico',
    '5° Básico', '6° Básico', '7° Básico', '8° Básico',
    '1° Medio', '2° Medio', '3° Medio', '4° Medio'
  ];
  for (const course of baseCourses) {
    await pool.query(
      'INSERT INTO curso (nombre_curso) VALUES ($1) ON CONFLICT (nombre_curso) DO NOTHING',
      [course]
    );
  }

  if (!isNewSchema) return;
  const hash = await bcrypt.hash(getDefaultUserPassword(), 12);
  const terminalEmail = normalizeEmail(process.env.DEFAULT_TERMINAL_EMAIL || 'terminal@purocole.local');
  const adminEmail = normalizeEmail(process.env.DEFAULT_ADMIN_EMAIL || 'admin@purocole.local');
  const invalidInitialEmail = validateEmail(terminalEmail) || validateEmail(adminEmail);
  if (invalidInitialEmail) {
    throw new Error(`Configuración de cuentas iniciales inválida: ${invalidInitialEmail}`);
  }
  await pool.query(
    `INSERT INTO usuarios (correo, password_hash, rol, nombre, debe_cambiar_password)
     VALUES ($1, $2, 'lector', 'Terminal de Puntualidad', true)
     ON CONFLICT (LOWER(correo)) WHERE eliminado_en IS NULL DO NOTHING`,
    [terminalEmail, hash]
  );
  await pool.query(
    `INSERT INTO usuarios (correo, password_hash, rol, nombre, debe_cambiar_password)
     VALUES ($1, $2, 'admin', 'Administrador General', true)
     ON CONFLICT (LOWER(correo)) WHERE eliminado_en IS NULL DO NOTHING`,
    [adminEmail, hash]
  );
};

const startServer = async () => {
  const isNewSchema = await bootstrapBaseSchema();
  await runMigrations(pool);
  await ensureBaseData(isNewSchema);

  return app.listen(PORT, () => {
    console.log(`Servidor listo en el puerto ${PORT}`);
  });
};

const registerShutdownHandlers = (server, options = {}) => {
  const databasePool = options.databasePool || pool;
  const logger = options.logger || console;
  const processReference = options.processReference || process;
  const timeoutMs = options.timeoutMs || 10000;
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`[OPERACION] ${signal}: cerrando conexiones de forma segura.`);

    const forcedExit = setTimeout(() => {
      logger.error('[OPERACION] El cierre seguro excedio el tiempo maximo.');
      processReference.exit(1);
    }, timeoutMs);
    forcedExit.unref?.();

    server.close(async (serverError) => {
      try {
        await databasePool.end();
      } catch (databaseError) {
        logger.error(`[OPERACION] Error cerrando PostgreSQL: ${databaseError.message}`);
        processReference.exitCode = 1;
      } finally {
        clearTimeout(forcedExit);
      }

      if (serverError) {
        logger.error(`[OPERACION] Error cerrando HTTP: ${serverError.message}`);
        processReference.exitCode = 1;
      } else {
        logger.info('[OPERACION] Servicio detenido correctamente.');
      }
    });
  };

  processReference.once('SIGTERM', () => shutdown('SIGTERM'));
  processReference.once('SIGINT', () => shutdown('SIGINT'));
  return shutdown;
};

if (require.main === module) {
  startServer()
    .then((server) => registerShutdownHandlers(server))
    .catch((error) => {
      console.error('No fue posible iniciar el servidor:', error.message);
      process.exit(1);
    });
}

module.exports = {
  app,
  bootstrapBaseSchema,
  ensureBaseData,
  readinessHandler,
  registerShutdownHandlers,
  startServer
};
