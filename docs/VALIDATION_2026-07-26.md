# Validación integral del 26 de julio de 2026

## Resultado

La instalación genérica de PuroCole fue probada desde volúmenes Docker vacíos con datos exclusivamente ficticios.

El resultado funcional es aprobado. La Fase 2 completó sus puertas manuales y la subfase 3.0 cerró los hallazgos técnicos que impedían preparar un piloto.

PuroCole todavía necesita decisiones y aceptación institucional antes de usar datos reales: dominio y certificado confiable, responsables operacionales, retención de datos, capacitación y prueba física en la red del establecimiento. Ya no quedan vulnerabilidades críticas o altas detectadas en las imágenes finales.

## Entorno

- Windows con Docker Desktop 29.6.1.
- Docker Compose 5.2.0.
- PostgreSQL 16 Alpine.
- Node 20 Alpine.
- Datos, correos, RUT y documentos ficticios.
- Configuración institucional ficticia: Colegio Horizonte de Pruebas.
- Validación local efímera, sin despliegue.

## Defectos encontrados y corregidos

### Creación de cuentas iniciales en una base nueva

La migración de eliminación lógica reemplaza la unicidad directa de `usuarios.correo` por un índice único parcial sobre `LOWER(correo)` para cuentas no eliminadas. La inicialización todavía usaba `ON CONFLICT (correo)`, por lo que el primer arranque aplicaba las ocho migraciones, fallaba al crear las cuentas y luego parecía saludable después del reinicio automático.

Se corrigió la inferencia de conflicto para utilizar el índice parcial y se agregó una prueba de regresión. Una instalación posterior desde volumen vacío creó correctamente las cuentas de administrador y terminal.

### Edición de perfiles de acceso

La edición de un perfil devolvía HTTP 500 porque el detalle de auditoría utilizaba una variable inexistente. Se corrigió el nombre de la variable y se agregó una prueba de regresión.

## Pruebas aprobadas

| Capa | Resultado |
| --- | --- |
| Sintaxis backend | Aprobada |
| Pruebas backend | 53 de 53 |
| Lint frontend | Aprobado |
| Build frontend local | Aprobado |
| Build Docker sin caché | Backend y frontend aprobados |
| Auditoría npm de producción backend | 0 vulnerabilidades |
| Dependencias frontend | React Router actualizado a 7.18.1; excepción RSC no alcanzable documentada en `SECURITY_EXCEPTIONS.md` |
| Imágenes finales con Docker Scout | Backend, PostgreSQL, frontend y respaldo: 0 críticas y 0 altas |
| Parseo de scripts PowerShell | 3 de 3 |
| Docker Compose | Configuración válida |
| Arranque desde volúmenes vacíos | 4 de 4 servicios saludables |
| Esquema | Base más migraciones 001 a 011 |
| Cuentas iniciales | Administrador y terminal creados |
| Integración HTTP autenticada | 99 de 99 comprobaciones |
| Lecturas concurrentes | 200 de 200, sin error |
| Reinicio y persistencia | Datos, auditoría y documento conservados |
| Respaldo | Dump, documentos y checksums válidos |
| Restauración aislada | 3 estudiantes, 4 registros y 2 cuentas activas restaurados |
| Integridad relacional | 0 matrículas huérfanas |
| Unicidad | 0 correos activos y 0 registros activos duplicados |
| Auditoría | 0 referencias de usuario ausentes |
| Identidad anterior | 0 coincidencias institucionales |
| Revisión visual autenticada | Administrador, terminal y cambio obligatorio aprobados |
| Responsive | Escritorio y 390 × 844 sin desborde horizontal |
| Consola del navegador | 0 entradas |
| Repositorios fuente | Sin modificaciones |
| Hardening | 4 de 4 servicios con `read_only`, `no-new-privileges` y capacidades reducidas |
| HTTPS | Redirección 308, TLS y cookie `Secure` aprobados con certificado efímero |

El recorrido HTTP cubrió salud, sesiones, cookie HttpOnly y SameSite Strict, cambio de contraseña, invalidación de token, catálogo modular por perfil, permisos efectivos, perfiles configurables, usuarios, desactivación, eliminación lógica, estudiantes, búsqueda, escaneo, registro, duplicado, corrección, anulación, justificación, PDF, historial, reportes, analítica, alertas, auditoría, rutas retiradas, Alimentación, importación PAE idempotente, alertas restringidas, concurrencia de dos clientes y logout.

El recorrido HTTP está en `scripts/pruebas-integracion.js`. La puerta completa está en `scripts/pruebas-aceptacion.ps1`: crea secretos, certificados y datos ficticios en un entorno temporal, levanta un proyecto Compose aislado, verifica hardening, integración, respaldo, restauración y TLS, y elimina sus contenedores, volúmenes y temporales.

## Rendimiento observado

Una ráfaga local de 200 lecturas autenticadas y de salud finalizó en aproximadamente 809 ms, sin respuestas fallidas.

Uso observado después de la prueba:

- Frontend: aproximadamente 8 MiB.
- Backend: aproximadamente 25 MiB.
- PostgreSQL: aproximadamente 45 MiB.
- Respaldo: aproximadamente 2 MiB.

Esto es una comprobación de estabilidad local, no una prueba formal de capacidad ni una estimación de usuarios concurrentes para producción.

## Cierre de los hallazgos técnicos

- Backend: runtime sin gestores de paquetes, Alpine actualizado y 0 críticas/altas.
- PostgreSQL: runtime final sin la capa histórica de `gosu`, arranque y restauración aprobados, 0 críticas/altas.
- Frontend: Nginx no privilegiado y dependencias de planilla reemplazadas; 0 críticas/altas.
- React Router: 7.18.1, última versión publicada. El aviso RSC vigente no es alcanzable por la SPA y quedó documentado con mitigación y condición de reapertura.
- CORS: origen ajeno responde HTTP 403 JSON controlado con `request_id`.
- Contenedores: filesystem raíz de solo lectura, `no-new-privileges`, redes separadas y capacidades mínimas.
- HTTPS: perfil Compose separado, redirección HTTP, TLS 1.2/1.3, HSTS y cookie `Secure`.
- Novedades: visibles solo para perfiles con permisos administrativos o de auditoría.

## Pendientes institucionales antes del piloto

- Instalar un certificado confiable y dar lectura de su clave únicamente al UID 101 del frontend.
- Definir el dominio definitivo y usarlo en `CORS_ORIGIN`.
- Mantener `NODE_ENV=production`, `COOKIE_SECURE=true` y validación estricta.
- Confirmar responsables, retención, respaldo externo y recuperación.
- Ejecutar aceptación humana en los equipos y lector físico del establecimiento.

## Decisión de salida

- Fase 2: aprobada.
- Puntualidad: preservada y utilizable como módulo base.
- Fase 3.0: aprobada.
- Fase 3.1: aprobada.
- Fase 3.2: aprobada; lecturas y escrituras del núcleo, autenticación, sesiones, cuentas, perfiles, permisos y auditoría están separadas.
- Piloto con datos reales: condicionado a las decisiones y aceptación institucionales anteriores.
