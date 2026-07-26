# Alcance de PuroCole V1

## Nombre de la entrega

PuroCole V1 — Versión Piloto.

La palabra V1 describe la primera versión reutilizable y validable del producto. No implica reconstruir un prototipo mínimo: se aprovechará la base madura existente.

## Objetivo

Entregar una plataforma instalable para operar Puntualidad y Alimentación sobre un núcleo común, con terminal rápido, portal administrativo, trazabilidad y reportes.

## Incluido

### Núcleo escolar

- Configuración del establecimiento.
- Cursos, estudiantes y matrículas vigentes.
- Importación controlada de nóminas.
- Usuarios y perfiles de acceso.
- Permisos por función y módulo.
- Auditoría.
- Documentos adjuntos validados.
- Exportaciones operacionales.
- Ficha operacional del estudiante.
- Línea temporal común.

### Puntualidad

- Registro por código de barras.
- Búsqueda y registro manual.
- Hora exacta de ingreso.
- Clasificación configurable del atraso.
- Corrección o anulación con motivo.
- Justificaciones y documentos.
- Detección de recurrencia.
- Filtros, indicadores y reportes.

### Alimentación

- Desayuno, almuerzo y once.
- Selección automática o configurable por franja horaria.
- Beneficiarios de alimentación.
- Importación de nómina PAE.
- Prevención de doble entrega.
- Retroalimentación visual y sonora.
- Alerta operacional de restricción alimentaria.
- Historial y reportes por fecha, curso, estudiante y servicio.

### Experiencias

- Terminal operativo de escaneo.
- Portal administrativo responsive.
- Estados visibles de carga, error, duplicado y éxito.
- Tema y marca configurables en un nivel acotado.

## Siguiente versión

- Retiros anticipados.
- Personas autorizadas.
- Evidencia de entrega.
- Pase de salida.
- Alertas asociadas al retiro.

## Fuera de alcance de V1

- Notas, currículum y asignaturas.
- Matrícula oficial completa.
- Reemplazo de SIGE.
- Asistencia oficial e inferencia completa de ausencias.
- Finanzas, mensualidades y remuneraciones.
- Inventario.
- Ficha clínica completa.
- Gestión integral de convivencia escolar.
- Aplicación móvil nativa para apoderados.
- Inteligencia artificial.
- Integración oficial con WhatsApp.
- Facturación SaaS.
- Panel multiestablecimiento.
- Sincronización bidireccional entre dos bases completas.
- Talleres y actividades.

## Condiciones de aceptación

PuroCole V1 podrá considerarse lista para piloto cuando:

1. Una instalación nueva pueda configurarse sin editar código institucional.
2. Puntualidad conserve sus capacidades verificadas.
3. Alimentación utilice el mismo estudiante, usuario, permiso y auditoría.
4. El terminal responda claramente a éxito, duplicado y error.
5. Los reportes esenciales funcionen con datos ficticios.
6. No existan referencias obligatorias al establecimiento de origen.
7. Las pruebas, lint, build y configuración Docker estén aprobados.
8. Exista revisión manual autenticada para cada rol.
9. Exista un procedimiento documentado de respaldo y restauración.
10. El establecimiento piloto apruebe responsables, horarios, accesos y retención.

## Control de alcance

Una funcionalidad no incluida debe registrarse primero en `DECISIONS.md`. Si no es necesaria para validar V1, se mueve a una fase posterior.
