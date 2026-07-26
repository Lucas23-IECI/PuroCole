# Registro de decisiones

Este archivo registra decisiones de producto y arquitectura que deben sobrevivir a las conversaciones. Las decisiones pueden ser aceptadas, provisionales o reemplazadas.

## DEC-001 — Categoría del producto

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: PuroCole es una plataforma de operaciones escolares, no un ERP académico general.
- Consecuencia: notas, currículum, finanzas y reemplazo de SIGE quedan fuera de V1.

## DEC-002 — Reutilizar Puntualidad como línea base

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: copiar la base funcional completa y generalizarla incrementalmente.
- Motivo: ya resuelve seguridad, estudiantes, puntualidad, documentos, permisos, auditoría, reportes y operación.
- Consecuencia: no se hará una reescritura desde cero.

## DEC-003 — Integrar Alimentación selectivamente

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: trasladar dominio y flujos de Alimentación sobre el núcleo de PuroCole.
- Consecuencia: no se copiarán como segunda implementación la autenticación, usuarios, navegación o infraestructura.

## DEC-004 — Un repositorio independiente

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: trabajar en `PuroCole` como raíz Git independiente.
- Consecuencia: ninguna operación Git debe ejecutarse accidentalmente sobre el repositorio padre `ProyectosInteresantes`.

## DEC-005 — Datos ficticios en desarrollo

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: no versionar ni usar como fixture información operacional real.
- Consecuencia: cualquier dato de demostración debe ser explícitamente ficticio.

## DEC-006 — Dos modos de interfaz

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: separar terminal operativo y portal de gestión.
- Consecuencia: ambos comparten núcleo, pero no se fuerza la misma densidad ni interacción.

## DEC-007 — Módulos iniciales

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: V1 incluye Núcleo, Puntualidad y Alimentación; Retiros es la siguiente extensión.

## DEC-008 — SaaS después de validar reutilización

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: no construir multiempresa, facturación o panel de sostenedor antes de validar el producto en dos establecimientos.

## DEC-009 — Retirar el subproyecto de cuestionarios

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: retirar el subproyecto después de verificar la línea base.
- Motivo: es una solución institucional independiente y no pertenece al alcance acordado de PuroCole V1.
- Consecuencia: CI, Dependabot, documentación y dependencias dejan de incluirlo.

## DEC-011 — Identidad configurable sin código específico

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: mantener una marca PuroCole común y configurar nombre, RBD, ubicación, logo y colores mediante entorno.
- Consecuencia: una instalación nueva no requiere editar componentes ni hojas de estilo.

## DEC-012 — No conservar recursos del establecimiento de origen

- Fecha: 25 de julio de 2026.
- Estado: aceptada.
- Decisión: retirar fotografías, escudos, direcciones, lemas, dominios y cuentas específicas de la línea base.
- Consecuencia: cualquier recurso futuro debe tener procedencia y autorización verificables.

## DEC-010 — Estrategia inicial de despliegue

- Fecha: 25 de julio de 2026.
- Estado: provisional.
- Decisión: mantener inicialmente una instalación Docker por establecimiento.
- Consecuencia: la evolución a arquitectura SaaS se decidirá con evidencia de los pilotos.

## Cómo agregar una decisión

Registrar:

- Fecha.
- Estado.
- Decisión.
- Motivo.
- Consecuencias.
- Decisión anterior reemplazada, cuando corresponda.
