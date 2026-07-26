# Mapa de módulos

## Principio

Los módulos comparten identidad, datos maestros, autorización y auditoría. No son aplicaciones independientes pegadas bajo un mismo menú.

## Núcleo compartido

El núcleo contiene:

- Establecimiento y configuración.
- Período académico.
- Cursos.
- Estudiantes.
- Matrículas.
- Apoderados y personas autorizadas cuando corresponda.
- Credenciales.
- Usuarios.
- Perfiles y permisos.
- Documentos.
- Auditoría.
- Importaciones y exportaciones.
- Línea temporal de eventos.

El núcleo no se comercializa necesariamente como módulo aislado; habilita los módulos operacionales.

## Modelo conceptual de evento

Los eventos deben poder responder:

- ¿Qué ocurrió?
- ¿A qué estudiante?
- ¿Cuándo?
- ¿Dónde?
- ¿Quién lo registró?
- ¿Desde qué terminal?
- ¿Cuál fue el resultado?
- ¿Fue corregido o anulado?
- ¿Existe documento o evidencia?

Campos conceptuales:

```text
Evento operacional
├── tipo
├── estudiante
├── fecha y hora
├── establecimiento o sede
├── usuario y terminal
├── estado
├── metadata específica del módulo
└── historial de correcciones
```

No implica que todos los módulos deban almacenarse inmediatamente en una única tabla. La unificación inicial puede realizarse mediante un contrato de consulta común.

## Módulo Puntualidad

Depende de:

- Estudiantes y matrículas.
- Credenciales.
- Usuarios y permisos.
- Documentos.
- Auditoría.

Produce:

- Ingresos.
- Atrasos clasificados.
- Justificaciones.
- Correcciones.
- Indicadores y alertas de recurrencia.

## Módulo Alimentación

Estado actual: núcleo operacional activo. Importación PAE, terminal dedicado y reportes finales continúan en desarrollo.

Depende de:

- Estudiantes y matrículas.
- Credenciales.
- Beneficiarios.
- Usuarios y permisos.
- Alertas alimentarias mínimas.
- Auditoría.

Produce:

- Entregas por servicio.
- Duplicados prevenidos.
- Diferencias entre beneficiarios y entregas.
- Historial y reportes.

Contrato y estado detallado: `FOOD_MODULE.md`.

## Módulo Retiros

Planificado para la siguiente versión.

Dependerá de:

- Estudiantes.
- Apoderados y personas autorizadas.
- Usuarios y permisos.
- Evidencias.
- Auditoría.

Producirá:

- Solicitudes y autorizaciones.
- Hora y responsable del retiro.
- Rechazos por falta de autorización.
- Pase o confirmación de salida.

## Módulos futuros

- Talleres y actividades.
- Alertas y comunicaciones.
- Panel del sostenedor.

No se deben activar en el roadmap de desarrollo antes de validar V1.

## Modos de interfaz

### Terminal operativo

- Acción principal única.
- Controles grandes.
- Lectura por escáner.
- Respuesta en uno o dos segundos.
- Sonido, color, símbolo y texto redundantes.
- Historial inmediato de los últimos registros.
- Recuperación comprensible ante errores.

### Portal de gestión

- Navegación por módulos.
- Búsqueda y filtros.
- Ficha del estudiante.
- Reportes y exportaciones.
- Usuarios y permisos.
- Configuración.
- Auditoría.

Ambos modos comparten sesión y autorización, pero tienen prioridades de interacción diferentes.
