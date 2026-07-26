# Mapa de reutilización

## Estrategia

PuroCole no comienza desde cero. Se conserva como línea base el sistema de puntualidad y se generaliza de forma incremental. Alimentación se utilizará como fuente de dominio y experiencia operacional, no como una segunda aplicación completa.

## Línea base de Puntualidad

Origen: repositorio externo del sistema de Puntualidad, preservado sin modificaciones.

Commit importado:

`e47cdcef5916d2d628b9bd06a05341b7e95808c2`

### Conservar

| Área | Elementos |
| --- | --- |
| Backend | Express, PostgreSQL, migraciones, validación, seguridad y servicios |
| Puntualidad | Escaneo, registro manual, clasificación, recurrencia y reportes |
| Documentos | Validación por contenido, límites, hash y autorización |
| Seguridad | Sesión, roles, perfiles configurables, permisos y auditoría |
| Operación | Docker, health checks, respaldo y restauración |
| Frontend | React, diseño responsive, accesibilidad, tours y notificaciones |
| Calidad | Pruebas, lint, build y workflow de calidad |

### Adaptar

| Elemento heredado | Transformación |
| --- | --- |
| Nombre y dominio heredados | Configuración de establecimiento |
| RBD, escudo, fotografías y colores | Marca configurable y recursos neutrales |
| Cuentas iniciales institucionales | Proceso de alta seguro y configurable |
| Horarios y criterios de atraso | Configuración por establecimiento |
| Textos y ayudas | Lenguaje genérico de PuroCole |
| Esquema centrado en puntualidad | Núcleo compartido y límites de módulo |
| Panel principal | Navegación modular |
| Ficha actual | Línea temporal operacional |

### Revisar o retirar

| Elemento | Motivo |
| --- | --- |
| Fotografías institucionales | No forman parte de la marca genérica |
| Documentación específica del establecimiento | Convertida en guía reutilizable |
| Scripts con nombres o dominios fijos | Generalizados en la Fase 2 |
| Subproyecto de cuestionarios | Retirado por estar fuera de PuroCole V1 |
| Compatibilidad heredada innecesaria | Solo retirar después de comprobar que no afecta datos válidos |

Los elementos heredados específicos se retiraron o generalizaron en la Fase 2.

## Fuente de Alimentación

Origen:

`C:\Users\lucas\Downloads\ProyectosInteresantes\ColegioSanAgustinComedores`

Referencia revisada:

`62351f52174e9f787a0789af7b2457aa3a275ef1`

### Trasladar selectivamente

- Modelo y flujo de beneficiarios.
- Importación PAE.
- Desayuno, almuerzo y once.
- Detección de doble entrega.
- Experiencia de escaneo.
- Retroalimentación sonora.
- Alertas de restricción alimentaria.
- Historial y reportes.

### No copiar como bloque

- Autenticación propia.
- Tabla duplicada de usuarios.
- Administración duplicada de estudiantes.
- Navegación completa.
- Estilos institucionales.
- Configuración Docker completa.
- Código de prueba o búsqueda específico de personas.
- Logos y recursos del colegio.

Cada función de Alimentación debe integrarse al núcleo de PuroCole y recibir pruebas nuevas.

## Exclusiones obligatorias

Nunca importar:

- Carpetas `.git`.
- `.env` o secretos.
- `node_modules`.
- `dist`, `build` o cobertura.
- Respaldos.
- Bases locales.
- RUT, planillas, carnets, documentos o exportaciones reales.
- Logos o fotografías que no deban formar parte del nuevo producto.

## Método de decisión

Cada pieza revisada se clasificará:

- **Conservar:** funciona y sirve sin cambio conceptual.
- **Adaptar:** se reutiliza cambiando acoplamientos o identidad.
- **Retirar:** no pertenece al producto o supone un riesgo.
- **Diferir:** aporta valor, pero no es necesaria para V1.

La clasificación debe actualizarse en este documento antes de retirar áreas completas.
