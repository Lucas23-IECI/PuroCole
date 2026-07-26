# Contrato de eventos operacionales

Última actualización: 26 de julio de 2026.

## Propósito

La línea temporal de PuroCole reúne actividad de distintos módulos sin convertir la tabla común en la fuente funcional de cada dominio. Puntualidad conserva `attendance_registrations` y Alimentación conserva `food_registrations`; `eventos_operacionales` referencia esas entidades y permite reconstruir una historia compartida.

## Sobre persistido

Cada evento contiene:

- estudiante;
- módulo y tipo de evento;
- entidad e identificador de origen;
- versión de la entidad;
- estado: `activo`, `corregido` o `anulado`;
- fecha y hora de ocurrencia;
- fecha de registro;
- origen operacional;
- usuario responsable;
- metadatos mínimos;
- motivo de anulación cuando corresponda;
- clave idempotente única.

La clave sigue el patrón:

```text
<modulo>:<entidad>:<id>:<accion>:v<version>
```

Ejemplos:

```text
punctuality:registration:42:created:v1
punctuality:registration:42:corrected:v2
food:registration:18:voided:v2
```

## Eventos publicados

Puntualidad:

- `punctuality.registration.created`
- `punctuality.registration.corrected`
- `punctuality.registration.voided`
- `punctuality.justification.applied`
- `punctuality.justification.revoked`

Alimentación:

- `food.delivery.registered`
- `food.delivery.voided`

## Garantías

1. La mutación del módulo, su evento y la auditoría se confirman en la misma transacción.
2. `ON CONFLICT` sobre la clave idempotente tolera reintentos sin duplicar la historia.
3. Una corrección o anulación agrega una nueva versión; no borra el evento previo.
4. Los metadatos no copian documentos, contactos ni toda la fila fuente.
5. La línea temporal se ordena por ocurrencia y limita la paginación a 100 eventos por solicitud.
6. Un terminal de Puntualidad no obtiene la ficha administrativa solo por poder registrar ingresos.

## API

La ficha inicial incluye los últimos 30 eventos:

```text
GET /api/students/:id/details
```

La continuación paginada utiliza:

```text
GET /api/students/:id/timeline?limit=30&offset=0
```

Ambas rutas exigen permisos de consulta o gestión de estudiantes.

## Retención pendiente

Antes del piloto, el establecimiento debe aprobar el plazo de conservación de eventos. La implementación no ejecuta eliminación automática mientras esa decisión institucional siga pendiente.
