# Privacidad y tratamiento de datos

## Propósito

PuroCole manejará información de estudiantes, apoderados y funcionarios. La privacidad debe formar parte del diseño, no ser una tarea posterior al piloto.

Este documento es una guía de producto y desarrollo. No reemplaza una revisión jurídica ni las políticas aprobadas por cada establecimiento.

## Regla del repositorio

Solo se permiten:

- Datos ficticios.
- Plantillas vacías.
- Ejemplos imposibles de asociar con personas reales.
- Documentos de prueba fabricados para el proyecto.

No se permiten:

- RUT reales.
- Nombres o contactos reales.
- Nóminas y matrículas operacionales.
- Certificados o justificativos reales.
- Datos médicos identificables.
- Fotografías personales no autorizadas.
- Exportaciones y respaldos.
- Credenciales, cookies, tokens o secretos.

## Categorías previstas

### Identificación escolar

- Identificador interno.
- Nombre.
- Curso y matrícula.
- Código de credencial.

### Eventos operacionales

- Ingreso y atraso.
- Servicio de alimentación.
- Retiro futuro.
- Usuario, terminal, fecha y hora.

### Contactos

- Apoderados.
- Personas autorizadas para retiro.
- Datos mínimos de contacto.

### Documentos

- Justificaciones y evidencias.
- Metadatos, autor, fecha y hash.

### Alertas alimentarias

Solo se almacenará lo necesario para impedir una entrega riesgosa o informar al personal autorizado. PuroCole no se convertirá por defecto en ficha clínica.

## Principios

1. Minimización: almacenar solo lo necesario.
2. Finalidad: cada dato debe tener un uso operacional definido.
3. Acceso por función: no todos los usuarios ven todos los módulos.
4. Trazabilidad: registrar accesos y acciones sensibles cuando corresponda.
5. Retención definida: no conservar indefinidamente por comodidad.
6. Corrección controlada: mantener historial sin falsificar el evento original.
7. Exportación restringida: exigir permisos y registrar su generación.
8. Seguridad por defecto: secretos fuera del código y sesiones endurecidas.

## Decisiones pendientes antes del piloto

- Responsable del tratamiento en cada establecimiento.
- Base y finalidad de cada categoría.
- Plazos de retención.
- Procedimiento de rectificación y eliminación.
- Acceso de apoderados.
- Tratamiento de exalumnos.
- Encargados autorizados para documentos y alertas alimentarias.
- Respuesta ante incidentes.
- Proveedores externos y ubicación de los datos.
- Contratos, anexos y revisión jurídica aplicable.

## Lista previa a commit

- Revisar `git status`.
- Revisar nombres y extensiones de archivos nuevos.
- Buscar `.env`, planillas, bases, PDF, imágenes y exportaciones.
- Confirmar que los fixtures son ficticios.
- Revisar que logs y capturas no contengan información personal.
- No publicar hasta resolver cualquier duda sobre procedencia o autorización.
