# Plan de Fase 3 — Núcleo modular

## Objetivo

Convertir la aplicación genérica de Puntualidad en un producto modular sin reescribir sus flujos estables.

Al terminar la fase, estudiantes, matrículas, usuarios, permisos, auditoría y documentos pertenecerán al núcleo; Puntualidad será un módulo consumidor; existirá una ficha operacional y una línea temporal capaces de recibir Alimentación en la Fase 4.

## Lo que no se hará en esta fase

- No copiar la aplicación de Alimentación completa.
- No implementar servicios de desayuno, almuerzo u once.
- No crear multiestablecimiento, facturación SaaS ni panel de sostenedor.
- No reemplazar las tablas estables de Puntualidad por una reescritura general.
- No introducir datos reales.

## Orden de ejecución

### 3.0 — Cerrar las puertas técnicas

Resultado esperado: una base verde y defendible antes de mover responsabilidades.

Estado: completada y validada localmente el 26 de julio de 2026.

1. Actualizar React Router y volver a ejecutar lint, build, navegación y la batería HTTP.
2. Actualizar o reducir las imágenes de Node y PostgreSQL hasta eliminar vulnerabilidades críticas o documentar técnicamente cualquier excepción no alcanzable.
3. Añadir `no-new-privileges`, capacidades mínimas y filesystem de solo lectura donde sea compatible.
4. Convertir el rechazo CORS en una respuesta 4xx controlada.
5. Evitar cabeceras de seguridad duplicadas entre Nginx y Helmet.
6. Mostrar novedades según los permisos del perfil.
7. Incorporar `scripts/pruebas-integracion.js` a una puerta automatizada de instalación efímera.
8. Mantener una prueba de restauración aislada como puerta operacional.

Criterio de salida:

- 0 vulnerabilidades críticas sin evaluación.
- Tests, lint, build, Compose, Docker, integración y restauración aprobados.
- Cero HTTP 500 en los casos negativos esperados.

Resultado verificado:

- 0 críticas y 0 altas en dependencias frontend y en las imágenes finales.
- 78 de 78 comprobaciones HTTP aprobadas tras incorporar el catálogo modular.
- cuatro servicios endurecidos y saludables.
- respaldo, checksums y restauración aislada aprobados.
- redirección HTTPS, TLS y cookie `Secure` aprobados.

### 3.1 — Definir y publicar el catálogo modular

Resultado esperado: frontend y backend comparten la misma idea de módulo.

Estado: completada y validada localmente el 26 de julio de 2026.

Módulos iniciales:

- `core`: estudiantes, matrículas, cursos, documentos y ficha.
- `punctuality`: ingresos, atrasos, justificaciones, correcciones y reportes.
- `administration`: usuarios, perfiles, permisos y configuración.
- `audit`: consulta de trazabilidad.
- `food`: reservado e inactivo hasta Fase 4.
- `visits`: contrato reservado para integrar posteriormente Control de visitas y retiros desde una implementación fuente ya generalizada.

Trabajo:

1. Crear un catálogo con identificador, nombre, estado, rutas, permisos y experiencias habilitadas.
2. Derivar la navegación del catálogo y de permisos efectivos; eliminar tarjetas y rutas duplicadas codificadas a mano.
3. Mantener los permisos existentes con prefijo de dominio.
4. Definir contratos de habilitación sin crear todavía multiestablecimiento ni feature flags remotos.
5. Probar que un perfil ve exactamente sus módulos y que una ruta directa conserva la misma autorización.

Criterio de salida:

- Añadir un módulo al catálogo no exige modificar varias navegaciones independientes.
- La terminal y el portal conservan experiencias separadas.

Resultado verificado:

- El backend entrega un catálogo único filtrado por permisos efectivos.
- El portal deriva sus accesos y agrupaciones desde ese contrato.
- Un administrador ve siete experiencias activas y las dos integraciones reservadas.
- Un terminal recibe únicamente su experiencia operacional de Puntualidad.
- Alimentación y Visitas/retiros no exponen rutas ficticias ni aparentan estar habilitadas.
- 34 de 34 pruebas backend, lint, build y 78 de 78 comprobaciones HTTP aprobadas.
- Revisión visual de escritorio y 390 × 844 aprobada sin desborde horizontal ni errores de consola.

### 3.2 — Extraer el núcleo sin romper la API

Resultado esperado: `server.js` deja de concentrar responsabilidades, pero las rutas públicas permanecen compatibles.

Orden de extracción:

1. Autenticación y sesión.
2. Estudiantes, matrículas y cursos.
3. Usuarios, perfiles y permisos.
4. Auditoría.
5. Documentos.
6. Puntualidad.

Para cada bloque:

- mover una responsabilidad a `routes`, `services` y utilidades acotadas;
- conservar paths, códigos HTTP y payloads actuales;
- agregar pruebas antes de continuar al siguiente bloque;
- evitar una capa genérica de repositorios si no elimina duplicación comprobada;
- mantener transacciones completas para mutación y auditoría.

Criterio de salida:

- Las pruebas de integración siguen aprobadas sin adaptar expectativas funcionales.
- Puntualidad puede identificarse y probarse como módulo.

### 3.3 — Contrato de eventos operacionales

Resultado esperado: todos los módulos pueden aportar eventos a una línea temporal común.

Sobre de evento propuesto:

- identificador;
- estudiante;
- módulo;
- tipo de evento;
- fecha y hora institucional;
- estado y versión;
- origen: lector, manual, importación o sistema;
- usuario responsable;
- referencia a la entidad fuente;
- metadatos operacionales mínimos;
- anulación o corrección sin eliminación física.

Decisión de preservación:

- `attendance_registrations` continúa siendo la fuente funcional de Puntualidad.
- El evento común referencia la entidad de origen; no duplica documentos ni toda la fila del módulo.
- Una clave idempotente impide publicar dos veces la misma versión de un evento.
- Registro del módulo, evento y auditoría se confirman en la misma transacción.

Primera implementación:

1. Migración del contrato.
2. Publicación para nuevo ingreso, corrección, justificación, revocación y anulación.
3. Backfill idempotente de datos ficticios o de instalaciones existentes.
4. Endpoint paginado y filtrable por estudiante.
5. Pruebas de orden cronológico, idempotencia, corrección y permisos.

Criterio de salida:

- La historia de Puntualidad se reconstruye desde una línea temporal sin alterar sus reportes actuales.

### 3.4 — Ficha operacional del estudiante

Resultado esperado: un solo lugar para consultar identidad y actividad operativa.

Secciones:

- identificación operacional;
- matrícula y curso vigente;
- estado activo;
- resumen de Puntualidad;
- línea temporal;
- documentos accesibles según permiso;
- espacio reservado, no visible todavía, para Alimentación.

Reglas:

- no crear ficha clínica;
- no exponer campos sensibles a un terminal que solo registra;
- paginar la línea temporal;
- mantener descargas privadas y sin caché pública;
- registrar consultas o descargas sensibles si se decide en `DECISIONS.md`.

Criterio de salida:

- Administrador, inspectoría y terminal reciben vistas distintas por permiso.
- La ficha no necesita consultar una segunda base.

### 3.5 — Aceptación y congelamiento de contratos

Resultado esperado: Fase 4 puede integrar Alimentación sobre una base estable.

Pruebas obligatorias:

1. Backend check y tests.
2. Frontend lint y build.
3. Auditorías npm.
4. Docker Scout.
5. Compose desde volúmenes vacíos.
6. Pruebas HTTP completas por rol.
7. Reinicio y persistencia.
8. Respaldo y restauración aislada.
9. Revisión visual de escritorio y móvil.
10. Cero identidad institucional de origen.
11. Revisión manual de la ficha y línea temporal.

Documentos a cerrar:

- contrato de módulo;
- contrato de evento;
- matriz de permisos;
- procedimiento de respaldo/restauración;
- decisión de retención de eventos y documentos;
- handoff para Fase 4.

## Secuencia recomendada de trabajo

No conviene abrir todos los frentes a la vez. La secuencia es:

1. Fase 3.0 completa.
2. Catálogo modular vertical, backend y frontend.
3. Una extracción acotada del núcleo.
4. Evento de ingreso de Puntualidad de punta a punta.
5. Resto de eventos de Puntualidad.
6. Ficha operacional.
7. Aceptación completa.

Cada bloque debe terminar verde y usable antes de iniciar el siguiente.

## Definición de terminado

La Fase 3 estará terminada cuando:

- Puntualidad conserve todo lo validado el 26 de julio de 2026.
- La navegación y autorización dependan de un catálogo modular coherente.
- El núcleo escolar no dependa de componentes de Puntualidad.
- Cada mutación relevante produzca auditoría y evento operacional idempotente.
- La ficha muestre una línea temporal real con permisos.
- Una instalación nueva, su respaldo y su restauración sean repetibles.
- No existan vulnerabilidades críticas sin resolución o excepción aprobada.
- Alimentación pueda comenzar sin copiar usuarios, estudiantes, autenticación ni auditoría.
