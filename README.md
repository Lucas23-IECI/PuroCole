# PuroCole

PuroCole es una plataforma de operaciones escolares para registrar y consultar lo que ocurre físicamente con cada estudiante durante la jornada: ingresos, atrasos, alimentación y, en etapas posteriores, retiros y actividades.

No busca reemplazar al ERP académico, SIGE ni los sistemas de notas, matrícula o finanzas. Su función es complementar esas plataformas con una operación rápida en terreno, una ficha compartida del estudiante, trazabilidad y reportes.

## Estado actual

El proyecto está en una etapa de transformación controlada:

- Se tomó como línea base el sistema de puntualidad existente.
- La línea base conserva su funcionalidad y sus pruebas.
- La identidad institucional heredada fue retirada.
- Nombre, RBD, ubicación, logo y colores se configuran sin editar el frontend.
- El módulo de alimentación aún no se ha integrado.
- No se deben utilizar datos personales reales durante el desarrollo.

Esta versión ya es una base genérica de Puntualidad, pero todavía no corresponde a PuroCole V1 porque falta el núcleo modular y Alimentación.

## Primera versión objetivo

PuroCole V1 se organizará alrededor de:

1. **Núcleo escolar:** establecimiento, cursos, matrículas, estudiantes, usuarios, permisos, documentos, auditoría e importaciones.
2. **Puntualidad:** registro de ingresos, clasificación de atrasos, justificaciones, correcciones, recurrencia y reportes.
3. **Alimentación:** desayuno, almuerzo y once, beneficiarios PAE, prevención de duplicados, alertas alimentarias y reportes.
4. **Línea temporal:** consulta unificada de los eventos operacionales del estudiante.

Retiros seguros será el siguiente módulo después de validar esta primera versión.

## Dos formas de uso

- **Terminal operativo:** experiencia rápida de escaneo para inspectoría, portería o comedor.
- **Portal de gestión:** estudiantes, documentos, reportes, configuración, permisos y auditoría.

## Documentación

- [Contexto general](PROJECT_CONTEXT.md)
- [Definición del producto](docs/PRODUCT_BRIEF.md)
- [Alcance de PuroCole V1](docs/SCOPE_V1.md)
- [Mapa de módulos](docs/MODULE_MAP.md)
- [Mapa de reutilización](docs/REUSE_MAP.md)
- [Marca y configuración](docs/BRANDING.md)
- [Resultado de la Fase 2](docs/PHASE_2_GENERALIZATION.md)
- [Validación integral del 26 de julio de 2026](docs/VALIDATION_2026-07-26.md)
- [Plan detallado de la Fase 3](docs/PHASE_3_PLAN.md)
- [HTTPS para piloto](docs/HTTPS_PILOTO.md)
- [Línea base importada](docs/BASELINE.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisiones](docs/DECISIONS.md)
- [Privacidad y datos](docs/DATA_PRIVACY.md)
- [Plan de piloto](docs/PILOT_PLAN.md)

## Tecnologías de la línea base

- React y Vite.
- Node.js y Express.
- PostgreSQL.
- Docker Compose y Nginx.
- Pruebas automatizadas de backend y frontend.

Las decisiones técnicas futuras deben justificarse en `docs/DECISIONS.md`; no se reescribirá el sistema sin una razón comprobable.

## Regla de privacidad

El repositorio solo puede contener datos ficticios y plantillas seguras. No se deben versionar RUT, nombres, teléfonos, correos, documentos, planillas, respaldos, contraseñas ni archivos operacionales de establecimientos reales.
