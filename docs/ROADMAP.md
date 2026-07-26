# Roadmap de PuroCole

## Fase 0 — Fundación documental

Estado: completada localmente el 25 de julio de 2026.

Entregables:

- Repositorio independiente.
- README de producto.
- Contexto canónico.
- Instrucciones de trabajo.
- Definición de producto.
- Alcance V1.
- Mapa de módulos.
- Mapa de reutilización.
- Privacidad, decisiones y piloto.

Salida:

- Los documentos no se contradicen.
- Queda clara la diferencia entre estado actual, hipótesis y alcance futuro.

## Fase 1 — Copia y línea base

Estado: validación automática completada el 25 de julio de 2026.

Entregables:

- Copia rastreada del sistema de puntualidad.
- Exclusión de secretos y datos operacionales.
- Dependencias reproducibles.
- Pruebas, lint, build y Compose verificados.
- Inventario de referencias institucionales.

Salida:

- La copia mantiene el comportamiento técnico conocido antes de generalizar.
- Permanecen pendientes el smoke test autenticado y la revisión visual.

## Fase 2 — Generalización institucional

Estado: completada y validada integralmente el 26 de julio de 2026.

Entregables:

- Marca PuroCole.
- Configuración de establecimiento, RBD, logo y colores.
- Cuentas iniciales configurables.
- Textos y ayudas neutrales.
- Instalación genérica.
- Retiro de recursos y subproyectos institucionales fuera de alcance.

Salida:

- Una instalación nueva no requiere editar código con el nombre de un colegio.
- No existen referencias ni recursos del establecimiento de origen.
- El recorrido autenticado, el respaldo y la restauración están aprobados con datos ficticios.

## Fase 3 — Núcleo modular

Estado: en ejecución; 3.0, 3.1, 3.3, 3.4 y la aceptación automatizada de 3.5 están completadas. La extracción incremental 3.2 continúa.

Plan detallado: `PHASE_3_PLAN.md`.

Entregables:

- Límites del núcleo.
- Navegación modular.
- Permisos por módulo.
- Ficha operacional.
- Contrato de eventos para línea temporal.
- Cierre de dependencias, imágenes y endurecimiento detectado por la validación integral.
- Contrato reservado para integrar posteriormente Control de visitas y retiros desde su implementación fuente generalizada.

Salida:

- Puntualidad funciona como módulo sin perder capacidades.

## Fase 4 — Alimentación

Estado: en ejecución; núcleo operacional completado y validado el 26 de julio de 2026.

Entregables:

- Beneficiarios. Completado en flujo manual e importación PAE.
- Importación PAE. Completada con previsualización, errores por fila e idempotencia.
- Servicios de alimentación. Completado.
- Prevención de duplicados. Completado.
- Alertas alimentarias mínimas. Completadas con permisos restringidos y auditoría.
- Terminal y reportes. Flujo de lector, selección por franja, filtros y exportación completados; prueba física pendiente.
- Integración con la línea temporal. Completado.

Salida:

- Alimentación utiliza el mismo estudiante, sesión, permiso y auditoría.

## Fase 5 — Preparación y primer piloto

Entregables:

- Instalación repetible.
- Datos ficticios de demostración.
- Capacitación y soporte.
- Métricas instrumentadas.
- Aprobaciones operacionales y de privacidad.

Salida:

- Piloto de 60 días completado y evaluado.

## Fase 6 — Retiros y segundo establecimiento

Entregables:

- Personas autorizadas.
- Registro y evidencia de retiro.
- Pase de salida.
- Segundo piloto.

Salida:

- El mismo núcleo funciona en un establecimiento diferente sin una bifurcación de código.

## Fase 7 — Producto SaaS

Condición previa:

- Dos establecimientos validados y un modelo comercial comprobado.

Entregables posibles:

- Multiestablecimiento.
- Panel del sostenedor.
- Suscripciones.
- Administración central.
- Actualizaciones remotas.
- Terminal instalable con tolerancia a cortes breves.
- Monitoreo y respaldos administrados.

Esta fase no autoriza sincronización compleja ni facturación antes de definir arquitectura, soporte y obligaciones.
