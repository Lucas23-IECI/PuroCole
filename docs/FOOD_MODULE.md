# Módulo Alimentación

Última actualización: 26 de julio de 2026.

## Estado

El núcleo operacional está implementado y validado. Alimentación ya utiliza el mismo estudiante, sesión, permiso, auditoría y contrato de eventos que Puntualidad.

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

El administrador recibe los cuatro. Inspectoría recibe consulta y registro. Secretaría y Dirección reciben consulta y reportes. Un terminal dedicado a Puntualidad no recibe accesos de Alimentación.

## API inicial

```text
GET    /api/food/services
GET    /api/food/students/search?q=
PUT    /api/food/beneficiaries/:studentId
GET    /api/food/today?serviceId=
POST   /api/food/registrations
PATCH  /api/food/registrations/:id/void
GET    /api/food/history?from=&to=
```

## Siguiente bloque

1. Importador PAE con previsualización, errores por fila y ejecución idempotente.
2. Selección automática de servicio por franja, conservando cambio manual explícito.
3. Modo terminal con foco de lector, respuesta visual y sonora.
4. Alerta operacional mínima, estructurada y restringida; sin texto clínico libre.
5. Reportes por fecha, curso, estudiante y servicio.
6. Aceptación con lector físico y dos equipos en la red interna.

No se debe comenzar la integración de Visitas y Retiros hasta cerrar estas puertas o recibir la implementación externa generalizada acordada.
