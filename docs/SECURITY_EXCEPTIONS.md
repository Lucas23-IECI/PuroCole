# Excepciones técnicas de seguridad

Última revisión: 26 de julio de 2026.

## React Router 7.18.1 — GHSA-qwww-vcr4-c8h2

Estado: dependencia actualizada a la última versión publicada y excepción temporal documentada.

`npm audit` informa dos hallazgos altos al contar `react-router-dom` y su dependencia `react-router`. El aviso afecta la ejecución de acciones en modo React Server Components antes de responder una validación CSRF.

La ruta vulnerable no es alcanzable en PuroCole:

- el frontend se compila como una SPA estática con Vite;
- la aplicación usa `BrowserRouter`, `Routes` y navegación del cliente;
- no existe servidor React, endpoint RSC, `createRequestHandler`, loaders, actions ni formularios ejecutados por React Router en el backend;
- Nginx solo publica archivos estáticos y reenvía `/api` al backend Express, cuya autenticación y protección CSRF son independientes.

Mitigación:

1. Mantener deshabilitado cualquier modo RSC o data router del lado servidor.
2. No incorporar loaders/actions sin reabrir esta evaluación.
3. Revisar el aviso en cada actualización de dependencias.
4. Sustituir 7.18.1 por la primera versión corregida y repetir lint, build, navegación e integración.

No se fuerza la versión 7.11.0 propuesta por `npm audit fix --force`: esa versión reintroduce múltiples avisos altos aplicables a ramas anteriores. Entre las versiones publicadas al momento de esta revisión, 7.18.1 reduce el alcance a una capacidad que PuroCole no utiliza.
