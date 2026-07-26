# Módulo Alimentación

Última actualización: 26 de julio de 2026.

## Estado

El flujo operacional previo a la prueba física está implementado y validado. Alimentación utiliza el mismo estudiante, sesión, permiso, auditoría y contrato de eventos que Puntualidad.

Incluido actualmente:

- catálogo de desayuno, almuerzo y once;
- ventanas horarias configuradas en base de datos;
- beneficiarios con vigencia y origen;
- búsqueda por nombre, RUT o código de barras;
- registro manual o por lector;
- prevención transaccional de doble entrega por estudiante, servicio y fecha;
- anulación con motivo e historial;
- resumen y últimas entregas del día;
- historial API por período;
- permisos separados para consulta, registro, administración y reportes;
- eventos en la ficha operacional;
- interfaz responsive para escritorio y móvil.
- importación PAE con previsualización, errores por fila y hash idempotente;
- historial auditable de lotes sin conservar una segunda copia de la planilla;
- selección automática del servicio vigente con cambio manual explícito;
- endpoint dedicado a lectores de credencial;
- alertas operacionales mínimas, restringidas y auditadas;
- reportes filtrables por período, servicio, curso y estudiante;
- exportación Excel desde el portal;
- prueba automatizada de dos clientes concurrentes sobre la misma entrega.

## Límites deliberados

- Una credencial identifica a la persona, pero no crea automáticamente un beneficio.
- No se almacena ficha clínica ni una descripción médica libre.
- Una entrega anulada permanece en auditoría y línea temporal.
- El módulo no modifica `attendance_registrations` ni los indicadores de Puntualidad.
- Visitas y Retiros no comparte tablas ni estados con Alimentación.

## Permisos

- `food.view`
- `food.register`
- `food.manage`
- `food.reports`
- `food.import`
- `food.alerts.view`
- `food.alerts.manage`

El administrador recibe los cuatro. Inspectoría recibe consulta y registro. Secretaría y Dirección reciben consulta y reportes. Un terminal dedicado a Puntualidad no recibe accesos de Alimentación.

## API inicial

```text
GET    /api/food/services
GET    /api/food/services/current
GET    /api/food/students/search?q=
GET    /api/food/students/scan/:barcode
PUT    /api/food/beneficiaries/:studentId
POST   /api/food/beneficiaries/import/preview
POST   /api/food/beneficiaries/import
GET    /api/food/imports
GET    /api/food/alerts/:studentId
PUT    /api/food/alerts/:studentId
GET    /api/food/today?serviceId=
POST   /api/food/registrations
PATCH  /api/food/registrations/:id/void
GET    /api/food/reports?from=&to=&serviceId=&courseId=&studentId=
GET    /api/food/history?from=&to=
```

## Puerta restante antes de Visitas y retiros

1. Probar distintos carnets y el lector USB real.
2. Operar desde dos computadores reales conectados a la red interna.
3. Confirmar señal sonora, distancia de lectura y recuperación ante pérdida de red.
4. Registrar la aceptación humana; la concurrencia de dos clientes ya está automatizada.

No se debe comenzar la integración de Visitas y Retiros hasta cerrar esta prueba física o recibir la implementación externa generalizada acordada para revisión aislada.
