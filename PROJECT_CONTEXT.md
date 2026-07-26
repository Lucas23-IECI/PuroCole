# Contexto del proyecto PuroCole

Última actualización: 26 de julio de 2026.

## Propósito de este archivo

Este es el punto de entrada canónico para retomar el proyecto sin depender de conversaciones anteriores. Describe qué producto se está construyendo, de dónde proviene la línea base y qué límites deben respetarse.

## Visión

PuroCole será la capa operativa de la jornada escolar. Centralizará eventos presenciales de los estudiantes con una sola identidad, permisos consistentes, evidencia y reportes.

Frase de producto:

> PuroCole centraliza los momentos operativos de la jornada escolar —ingresos, atrasos, alimentación y retiros— con una sola credencial, trazabilidad y reportes, sin reemplazar el ERP académico del establecimiento.

## Problema

Los colegios suelen contar con un ERP académico, pero continúan resolviendo atrasos, alimentación, retiros y otras operaciones mediante papel, Excel o aplicaciones aisladas. Eso duplica estudiantes, usuarios, permisos y reportes, y dificulta reconstruir qué ocurrió con una persona durante el día.

## Posicionamiento

PuroCole no es:

- Un sistema de notas o currículum.
- Una plataforma financiera.
- Un reemplazo inicial de SIGE o del ERP institucional.
- Una ficha clínica.

PuroCole sí es:

- Una plataforma modular de operaciones escolares.
- Un terminal rápido para registrar eventos.
- Un portal de gestión y seguimiento.
- Una ficha operacional unificada por estudiante.

## Estado del repositorio

- Ruta local: `C:\Users\lucas\Downloads\ProyectosInteresantes\PuroCole`.
- Remoto: `https://github.com/Lucas23-IECI/PuroCole`.
- Repositorio local independiente del directorio padre.
- La línea base de puntualidad fue copiada desde el commit `e47cdcef5916d2d628b9bd06a05341b7e95808c2`.
- La importación utilizó exclusivamente los 140 archivos rastreados por Git.
- No se copiaron `.git`, `.env`, respaldos, planillas operacionales, dependencias ni artefactos de compilación.
- Los repositorios de origen no fueron modificados.
- La validación automática posterior a la copia está aprobada y registrada en `docs/BASELINE.md`.
- No se ha realizado commit ni push de la importación.

## Sistemas de origen

### Base principal: puntualidad

La línea base se importó desde el repositorio externo del sistema de Puntualidad en el commit indicado en `docs/BASELINE.md`. La ruta del repositorio fuente no forma parte de la configuración ni de la identidad de PuroCole.

Se reutiliza como base porque ya contiene:

- Escaneo y registro manual.
- Estudiantes, matrículas y cursos.
- Clasificación de atrasos.
- Justificaciones y documentos.
- Correcciones auditadas.
- Usuarios, roles y perfiles configurables.
- Reportes, importaciones y exportaciones.
- Migraciones, respaldos y Docker.
- Diseño responsive y ayudas de uso.
- Pruebas automatizadas.

### Fuente funcional: alimentación

Ruta:

`C:\Users\lucas\Downloads\ProyectosInteresantes\ColegioSanAgustinComedores`

No se copiará como una segunda aplicación completa. Más adelante se trasladarán selectivamente:

- Eventos de desayuno, almuerzo y once.
- Beneficiarios e importaciones PAE.
- Prevención de doble entrega.
- Flujo rápido de escaneo.
- Señales sonoras y visuales.
- Alertas de restricciones alimentarias.
- Historial y reportes de entregas.

## Principios de trabajo

1. Preservar primero la línea base funcional.
2. Cambiar una responsabilidad a la vez y volver a verificar.
3. Reutilizar antes de reescribir.
4. Mantener una sola identidad de estudiante, autenticación y auditoría.
5. Separar terminal operativo y portal de gestión.
6. No introducir multiempresa, pagos o sincronización compleja antes de validar el piloto.
7. No almacenar ni publicar datos personales reales en desarrollo.
8. Registrar las decisiones relevantes en `docs/DECISIONS.md`.

## Estado de fases

- **Fase 0:** completada localmente; documentación, contexto y límites creados.
- **Fase 1:** completada en su validación automática; copia controlada, integridad, pruebas, build y Compose aprobados.
- **Puertas manuales de Fases 1 y 2:** completadas el 26 de julio de 2026 con Docker, datos ficticios, recorrido autenticado, respaldo y restauración.
- **Fase 2:** completada y validada integralmente.
- **Hallazgos previos a piloto:** dependencias e imágenes, endurecimiento de contenedores y respuesta CORS, registrados en `docs/VALIDATION_2026-07-26.md`.
- **Siguiente fase:** núcleo modular, comenzando por la subfase 3.0 de cierre técnico definida en `docs/PHASE_3_PLAN.md`.

Alimentación todavía no está integrada y la arquitectura funcional heredada no se ha rediseñado.

## Generalización institucional

La Fase 2 reemplaza la identidad heredada por:

- Marca PuroCole neutral.
- Nombre, nombre corto, RBD, ubicación, logo y colores configurables.
- Cuentas iniciales genéricas y configurables.
- Documentación e instalación reutilizables.
- Fondos visuales generados con CSS, sin fotografías institucionales.

El subproyecto independiente de cuestionarios y los recursos visuales del establecimiento de origen fueron retirados porque no pertenecen a PuroCole V1.

## Cómo retomar el trabajo

1. Leer este archivo.
2. Leer `AGENTS.md`.
3. Revisar `docs/DECISIONS.md` y `docs/ROADMAP.md`.
4. Ejecutar `git status --short --branch`.
5. Confirmar la fase activa.
6. No asumir que los repositorios de origen siguen en el mismo commit; verificar antes de reutilizar cambios nuevos.
7. Ejecutar las validaciones proporcionales al cambio.

## Próximo resultado esperado

Cerrar la subfase 3.0 y construir el núcleo modular según `docs/PHASE_3_PLAN.md`. Alimentación todavía no debe integrarse.
