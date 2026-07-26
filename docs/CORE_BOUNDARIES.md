# Límites del núcleo

Última actualización: 26 de julio de 2026.

## Contratos activos

| Responsabilidad | Propietario | Límite |
|---|---|---|
| Sesión y catálogo visible | `routes/auth.js` | Cookie, token, cambio de contraseña y módulos visibles |
| Lecturas de estudiantes | `routes/core.js` + `services/coreQueryService.js` | Cursos, lista, búsqueda, ficha y línea temporal |
| Auditoría consultable | `routes/audit.js` | Filtros, paginación y relación con cuentas |
| Documento privado | `services/documentService.js` | Firma binaria, tamaño, nombre, hash, ruta y borrado |
| Eventos operacionales | `services/operationalEventService.js` | Sobre idempotente y línea temporal |
| Puntualidad | `routes/punctuality.js` | Configuración, ingresos, correcciones, justificaciones y reportes |
| Alimentación | `routes/food.js` | Beneficiarios, entregas, PAE, alertas y reportes |

## Contrato documental congelado

- Solo PDF, PNG y JPG con firma binaria coherente.
- Máximo 8 MB.
- Nombre original saneado; nombre almacenado aleatorio.
- Archivos fuera del directorio público del frontend.
- Descarga autenticada con `Cache-Control: no-store`.
- Ninguna ruta recibe una ruta de filesystem aportada por el cliente.
- Una fila de documento se elimina únicamente si ya no tiene referencias.
- Auditoría y mutación funcional se mantienen en la misma operación controlada.

## Dependencias prohibidas

- Alimentación no puede consultar ni modificar `attendance_registrations`.
- Puntualidad no puede guardar alertas o beneficios alimentarios.
- Un módulo no emite tokens ni define cookies.
- Las rutas no duplican validación binaria de documentos.
- Visitas y retiros no se incorpora hasta recibir una fuente externa generalizada.

## Extracción pendiente

La API sigue estable, pero `server.js` aún contiene escrituras de estudiantes, importación de matrícula y administración de cuentas/perfiles. Esas unidades deben moverse una por una y conservar la batería HTTP sin cambiar expectativas funcionales.
