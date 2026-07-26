const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');
const envFile = process.env.PUROCOLE_ENV_FILE || path.join(projectRoot, '.env');
const env = Object.fromEntries(
  fs.readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
);

const base = process.env.PUROCOLE_TEST_URL || 'http://127.0.0.1/api';
const initialPassword = env.DEFAULT_USER_PASSWORD;
const adminEmail = env.DEFAULT_ADMIN_EMAIL;
const terminalEmail = env.DEFAULT_TERMINAL_EMAIL;
const adminNextPassword = `${initialPassword}A7!`;
const terminalNextPassword = `${initialPassword}T7!`;
const operatorNextPassword = `${initialPassword}O7!`;
let passed = 0;

const pass = (name) => {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')} ${name}`);
};

const cookieFrom = (response) => {
  const raw = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
  return raw.split(';')[0];
};

const request = async (urlPath, { method = 'GET', cookie = '', body, headers = {} } = {}) => {
  const options = { method, headers: { ...headers } };
  if (cookie) options.headers.Cookie = cookie;
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${base}${urlPath}`, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data, text };
};

const expectStatus = (result, expected, name) => {
  assert.equal(result.response.status, expected, `${name}: ${result.response.status} ${result.text}`);
  pass(name);
};

const todayInSantiago = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago'
}).format(new Date());

const run = async () => {
  let result = await request('/health/live');
  expectStatus(result, 200, 'health live');
  assert.equal(result.data.status, 'OK');

  result = await request('/health/ready');
  expectStatus(result, 200, 'health ready con base de datos');
  assert.equal(result.data.database, 'ready');
  assert.match(result.response.headers.get('content-security-policy') || '', /default-src/);
  assert.match(result.response.headers.get('x-content-type-options') || '', /nosniff/);
  pass('cabeceras Helmet en API');

  result = await request('/auth/me');
  expectStatus(result, 401, 'sesión obligatoria');
  result = await request('/students', { headers: { Origin: 'https://origen-no-autorizado.test' } });
  assert.equal(result.response.status, 403);
  assert.equal(result.data?.message, 'Origen no autorizado.');
  assert.equal(result.response.headers.get('access-control-allow-origin'), null);
  pass('CORS rechaza origen ajeno con 403 controlado');
  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: 'nadie@purocole.test', password: 'NoExiste_2026!' }
  });
  expectStatus(result, 401, 'login inválido no revela cuenta');

  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: adminEmail, password: initialPassword }
  });
  expectStatus(result, 200, 'login administrador inicial');
  const adminOldCookie = cookieFrom(result.response);
  assert.ok(adminOldCookie.startsWith('token='));
  const rawSetCookie = result.response.headers.get('set-cookie') || '';
  assert.match(rawSetCookie, /HttpOnly/i);
  assert.match(rawSetCookie, /SameSite=Strict/i);
  if (String(env.COOKIE_SECURE).toLowerCase() === 'true') {
    assert.match(rawSetCookie, /Secure/i);
  }
  pass('cookie HttpOnly y SameSite estricto');
  assert.equal(result.data.user.debe_cambiar_password, true);
  assert.ok(result.data.user.permissions.includes('users.manage'));
  pass('perfil administrador y cambio obligatorio');

  result = await request('/auth/change-password', {
    method: 'POST',
    cookie: adminOldCookie,
    body: { current_password: initialPassword, new_password: 'corta' }
  });
  expectStatus(result, 400, 'rechaza clave nueva débil');
  result = await request('/auth/change-password', {
    method: 'POST',
    cookie: adminOldCookie,
    body: { current_password: 'Incorrecta_2026!', new_password: adminNextPassword }
  });
  expectStatus(result, 400, 'rechaza clave actual incorrecta');
  result = await request('/auth/change-password', {
    method: 'POST',
    cookie: adminOldCookie,
    body: { current_password: initialPassword, new_password: adminNextPassword }
  });
  expectStatus(result, 200, 'cambia clave administrador');
  const adminCookie = cookieFrom(result.response);
  assert.equal(result.data.user.debe_cambiar_password, false);
  result = await request('/auth/me', { cookie: adminOldCookie });
  expectStatus(result, 401, 'invalida token anterior al cambio de clave');
  result = await request('/auth/me', { cookie: adminCookie });
  expectStatus(result, 200, 'mantiene sesión nueva administrador');
  result = await request('/modules', { cookie: adminCookie });
  expectStatus(result, 200, 'catálogo modular para administración');
  assert.ok(result.data.domains.some(({ id, status }) => id === 'core' && status === 'active'));
  assert.ok(result.data.domains.some(({ id, status }) => id === 'food' && status === 'reserved'));
  assert.ok(result.data.domains.some(({ id, status }) => id === 'visits' && status === 'reserved'));
  assert.equal(result.data.experiences.some(({ domain_id: domainId }) => domainId === 'visits'), false);
  pass('integraciones futuras no exponen rutas operativas');

  result = await request('/courses', { cookie: adminCookie });
  expectStatus(result, 200, 'lista cursos base');
  assert.ok(Array.isArray(result.data) && result.data.length >= 14);
  pass('cursos base cargados');
  result = await request('/permissions/catalog', { cookie: adminCookie });
  expectStatus(result, 200, 'catálogo permisos y perfiles');
  assert.ok(result.data.permissions.length >= 10 && result.data.templates.length >= 5);
  result = await request('/puntualidad/config', { cookie: adminCookie });
  expectStatus(result, 200, 'lee configuración puntualidad');

  const config = {
    nombre_jornada: 'Jornada de Pruebas',
    hora_entrada: '08:00:00',
    hora_limite_atraso: '08:15:00',
    minutos_atraso_grave: 20,
    umbral_alerta: 3,
    umbral_critico: 5
  };
  result = await request('/puntualidad/config', {
    method: 'PUT',
    cookie: adminCookie,
    body: { ...config, hora_entrada: '25:00' }
  });
  expectStatus(result, 400, 'rechaza configuración horaria inválida');
  result = await request('/puntualidad/config', {
    method: 'PUT',
    cookie: adminCookie,
    body: config
  });
  expectStatus(result, 200, 'actualiza configuración puntualidad');

  result = await request('/access-profiles', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name: 'Operador de Pruebas',
      description: 'Perfil ficticio de validación',
      permissions: ['punctuality.register', 'punctuality.view']
    }
  });
  expectStatus(result, 201, 'crea perfil de acceso configurable');
  const profileCode = result.data.profile.value;
  result = await request(`/access-profiles/${profileCode}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: {
      name: 'Operador QA',
      description: 'Perfil ficticio actualizado',
      permissions: ['punctuality.register']
    }
  });
  expectStatus(result, 200, 'edita perfil configurable');

  result = await request('/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      correo: 'operador.pruebas@purocole.test',
      password: initialPassword,
      rol: profileCode,
      nombre: 'Operador Ficticio',
      cargo: 'Portería QA'
    }
  });
  expectStatus(result, 201, 'crea cuenta con perfil personalizado');
  const operatorId = result.data.user.id;
  result = await request('/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      correo: 'operador.pruebas@purocole.test',
      password: initialPassword,
      rol: profileCode,
      nombre: 'Duplicado Ficticio',
      cargo: 'Portería QA'
    }
  });
  expectStatus(result, 409, 'rechaza correo de cuenta duplicado');

  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: 'operador.pruebas@purocole.test', password: initialPassword }
  });
  expectStatus(result, 200, 'login operador personalizado');
  const operatorOldCookie = cookieFrom(result.response);
  assert.deepEqual(result.data.user.permissions, ['punctuality.register']);
  pass('permisos efectivos personalizados');
  result = await request('/users', { cookie: operatorOldCookie });
  expectStatus(result, 403, 'operador no administra usuarios');
  result = await request('/auth/change-password', {
    method: 'POST',
    cookie: operatorOldCookie,
    body: { current_password: initialPassword, new_password: operatorNextPassword }
  });
  expectStatus(result, 200, 'operador cambia clave obligatoria');
  const operatorCookie = cookieFrom(result.response);
  result = await request(`/users/${operatorId}/status`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { activo: false }
  });
  expectStatus(result, 200, 'administrador desactiva cuenta');
  result = await request('/auth/me', { cookie: operatorCookie });
  expectStatus(result, 401, 'sesión desactivada queda rechazada');
  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: 'operador.pruebas@purocole.test', password: operatorNextPassword }
  });
  expectStatus(result, 401, 'cuenta desactivada no inicia sesión');
  result = await request(`/users/${operatorId}/status`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { activo: true }
  });
  expectStatus(result, 200, 'administrador reactiva cuenta');

  const students = [
    {
      rut: '11111111',
      dv: '1',
      nombres: 'Ana',
      paterno: 'Prueba',
      materno: 'Uno',
      email: 'ana@ficticio.test',
      telefono: '900000001',
      rol: 'Estudiante',
      grade: '1° Básico'
    },
    {
      rut: '22222222',
      dv: '2',
      nombres: 'Bruno',
      paterno: 'Ensayo',
      materno: 'Dos',
      email: 'bruno@ficticio.test',
      telefono: '900000002',
      rol: 'Estudiante',
      grade: '2° Básico'
    },
    {
      rut: '33333333',
      dv: '3',
      nombres: 'Carla',
      paterno: 'Simulada',
      materno: 'Tres',
      email: 'carla@ficticio.test',
      telefono: '900000003',
      rol: 'Estudiante',
      grade: '3° Básico'
    }
  ];
  const studentIds = [];
  for (const student of students) {
    result = await request('/students', { method: 'POST', cookie: adminCookie, body: student });
    expectStatus(result, 200, `crea estudiante ficticio ${student.nombres}`);
    studentIds.push(result.data.id_alumno);
  }
  result = await request('/students', { method: 'POST', cookie: adminCookie, body: students[0] });
  expectStatus(result, 409, 'rechaza estudiante duplicado');
  result = await request('/students', { cookie: adminCookie });
  expectStatus(result, 200, 'lista estudiantes');
  assert.equal(result.data.length, 3);
  result = await request(`/students/${studentIds[0]}/details`, { cookie: adminCookie });
  expectStatus(result, 200, 'detalle estudiante');
  assert.equal(result.data.alumno.grade, '1° Básico');
  result = await request('/students/search?q=Ana', { cookie: adminCookie });
  expectStatus(result, 200, 'búsqueda estudiante');
  assert.equal(result.data[0].id_alumno, studentIds[0]);

  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: terminalEmail, password: initialPassword }
  });
  expectStatus(result, 200, 'login terminal inicial');
  const terminalOldCookie = cookieFrom(result.response);
  assert.ok(result.data.user.permissions.includes('punctuality.register'));
  assert.ok(!result.data.user.permissions.includes('users.manage'));
  pass('permisos terminal limitados');
  result = await request('/auth/change-password', {
    method: 'POST',
    cookie: terminalOldCookie,
    body: { current_password: initialPassword, new_password: terminalNextPassword }
  });
  expectStatus(result, 200, 'terminal cambia clave obligatoria');
  const terminalCookie = cookieFrom(result.response);
  result = await request('/modules', { cookie: terminalCookie });
  expectStatus(result, 200, 'catálogo modular para terminal');
  assert.deepEqual(result.data.domains.map(({ id }) => id), ['punctuality']);
  assert.deepEqual(result.data.experiences.map(({ id }) => id), ['punctuality-terminal']);
  pass('terminal recibe solo su experiencia operacional');
  result = await request('/users', { cookie: terminalCookie });
  expectStatus(result, 403, 'terminal no ve usuarios');
  result = await request('/audit', { cookie: terminalCookie });
  expectStatus(result, 403, 'terminal no ve auditoría');
  result = await request('/students', { method: 'POST', cookie: terminalCookie, body: students[0] });
  expectStatus(result, 403, 'terminal no crea estudiantes');
  result = await request('/students/scan/111111111?tipo_registro=Entrada', { cookie: terminalCookie });
  expectStatus(result, 200, 'terminal resuelve código de barras');
  assert.equal(result.data.alumno.id_alumno, studentIds[0]);
  result = await request(`/students/${studentIds[0]}/status?tipo_registro=Entrada`, {
    cookie: terminalCookie
  });
  expectStatus(result, 200, 'terminal consulta estado individual');
  assert.equal(result.data.alreadyRegistered, false);

  result = await request('/puntualidad/registros', {
    method: 'POST',
    cookie: terminalCookie,
    body: { id_alumno: studentIds[0], origen: 'lector' }
  });
  expectStatus(result, 201, 'terminal registra ingreso');
  const firstRegistrationId = result.data.id_registro;
  result = await request('/puntualidad/registros', {
    method: 'POST',
    cookie: terminalCookie,
    body: { id_alumno: studentIds[0], origen: 'lector' }
  });
  expectStatus(result, 409, 'previene doble ingreso');
  result = await request('/puntualidad/hoy', { cookie: terminalCookie });
  expectStatus(result, 200, 'terminal ve ingresos de hoy');
  assert.equal(result.data.length, 1);
  result = await request('/puntualidad/resumen-hoy', { cookie: terminalCookie });
  expectStatus(result, 200, 'terminal ve resumen de hoy');
  assert.equal(result.data.ingresos_registrados, 1);

  result = await request(`/puntualidad/registros/${firstRegistrationId}/corregir`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: {
      fecha: todayInSantiago(),
      hora: '23:00:00',
      motivo: 'Ajuste controlado para prueba integral'
    }
  });
  expectStatus(result, 200, 'corrige registro con trazabilidad');
  assert.equal(result.data.registro.estado, 'Atrasado');
  result = await request(`/puntualidad/registros/${firstRegistrationId}/justificar`, {
    method: 'POST',
    cookie: adminCookie,
    body: { tipo: 'institucional', comentario: 'Justificación ficticia de prueba' }
  });
  expectStatus(result, 200, 'justifica atraso sin documento');
  result = await request(`/puntualidad/registros/${firstRegistrationId}/historial`, {
    cookie: adminCookie
  });
  expectStatus(result, 200, 'consulta historial de cambios');
  assert.equal(result.data.length, 2);
  result = await request(`/puntualidad/registros/${firstRegistrationId}/revocar-justificacion`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { motivo: 'Revocación ficticia para validar trazabilidad' }
  });
  expectStatus(result, 200, 'revoca justificación');

  const pdf = fs.readFileSync(
    path.join(projectRoot, 'backend', 'test', 'fixtures', 'certificado-prueba.pdf')
  ).toString('base64');
  result = await request(`/puntualidad/registros/${firstRegistrationId}/justificar`, {
    method: 'POST',
    cookie: adminCookie,
    body: {
      tipo: 'medica',
      comentario: 'Certificado ficticio para prueba integral',
      fileName: 'certificado-prueba.pdf',
      fileData: `data:application/pdf;base64,${pdf}`
    }
  });
  expectStatus(result, 200, 'justifica atraso con PDF validado');
  result = await request(`/puntualidad/registros/${firstRegistrationId}/documento`, {
    cookie: adminCookie
  });
  expectStatus(result, 200, 'descarga documento vigente');
  assert.match(result.response.headers.get('content-type') || '', /pdf/);
  assert.equal(result.response.headers.get('cache-control'), 'private, no-store, max-age=0');
  pass('documento protegido sin caché pública');

  result = await request('/puntualidad/registros', {
    method: 'POST',
    cookie: terminalCookie,
    body: { id_alumno: studentIds[1], origen: 'manual' }
  });
  expectStatus(result, 201, 'registra segundo ingreso');
  const secondRegistrationId = result.data.id_registro;
  result = await request(`/puntualidad/registros/${secondRegistrationId}/anular`, {
    method: 'PATCH',
    cookie: adminCookie,
    body: { motivo: 'Anulación controlada por prueba integral' }
  });
  expectStatus(result, 200, 'anula sin borrar historial');
  result = await request('/puntualidad/registros', {
    method: 'POST',
    cookie: terminalCookie,
    body: { id_alumno: studentIds[1], origen: 'manual' }
  });
  expectStatus(result, 201, 'permite nuevo ingreso tras anulación');
  result = await request('/asistencia', {
    method: 'POST',
    cookie: terminalCookie,
    body: { id_alumno: studentIds[2] }
  });
  expectStatus(result, 200, 'alias heredado registra ingreso');
  result = await request('/asistencia/history', { cookie: adminCookie });
  expectStatus(result, 410, 'ruta retirada responde 410 autenticado');

  const today = todayInSantiago();
  result = await request(`/puntualidad/analitica?desde=${today}&hasta=${today}`, {
    cookie: adminCookie
  });
  expectStatus(result, 200, 'analítica por periodo');
  assert.equal(result.data.resumen.ingresos, 3);
  result = await request(`/puntualidad/reporte?desde=${today}&hasta=${today}`, {
    cookie: adminCookie
  });
  expectStatus(result, 200, 'reporte de atrasos');
  assert.ok(Array.isArray(result.data.registros));
  result = await request('/puntualidad/alertas?dias=30', { cookie: adminCookie });
  expectStatus(result, 200, 'alertas de recurrencia');
  result = await request('/audit?limit=100', { cookie: adminCookie });
  expectStatus(result, 200, 'auditoría del sistema');
  assert.ok(result.data.total >= 20);
  assert.ok(result.data.rows.some((row) => row.accion === 'REGISTRAR_INGRESO'));
  pass('auditoría contiene operaciones');

  result = await request(`/users/${operatorId}`, {
    method: 'DELETE',
    cookie: adminCookie,
    body: { motivo: 'Cuenta ficticia eliminada al cerrar pruebas' }
  });
  expectStatus(result, 200, 'elimina lógicamente cuenta preservando auditoría');
  result = await request('/auth/login', {
    method: 'POST',
    body: { correo: 'operador.pruebas@purocole.test', password: operatorNextPassword }
  });
  expectStatus(result, 401, 'cuenta eliminada no inicia sesión');
  result = await request('/users', { cookie: adminCookie });
  expectStatus(result, 200, 'lista excluye cuenta eliminada');
  assert.ok(!result.data.some((user) => user.id === operatorId));
  result = await request(`/audit?cuenta_id=${operatorId}&limit=100`, { cookie: adminCookie });
  expectStatus(result, 200, 'auditoría conserva actividad de cuenta eliminada');
  assert.ok(result.data.total >= 1);

  result = await request('/auth/logout', { method: 'POST', cookie: terminalCookie });
  expectStatus(result, 200, 'logout terminal');
  assert.match(result.response.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);
  pass('logout expira cookie');
  console.log(`API_INTEGRATION_OK total=${passed}`);
};

run().catch((error) => {
  console.error('API_INTEGRATION_FAILED', error.stack || error);
  process.exitCode = 1;
});
