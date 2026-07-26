# Línea base técnica

## Objetivo

Demostrar que PuroCole parte desde una copia funcional y conocida del sistema de puntualidad. Esta referencia permite distinguir fallos heredados de fallos introducidos durante la generalización.

## Repositorio objetivo

- Ruta: `C:\Users\lucas\Downloads\ProyectosInteresantes\PuroCole`
- Remoto: `https://github.com/Lucas23-IECI/PuroCole`
- Rama: `main`
- Commit remoto inicial antes de la importación: `78038926c507eb0c2c521073349113bc2f5ecb5c`

## Fuente

- Origen: repositorio externo del sistema de Puntualidad
- Rama revisada: `main`
- Commit copiado: `e47cdcef5916d2d628b9bd06a05341b7e95808c2`
- Estado de la fuente al copiar: limpio y alineado con `origin/main`
- Archivos rastreados copiados: 140

## Método de importación

Se copiaron exclusivamente los archivos devueltos por `git ls-files` en la fuente. No se copió su historial Git ni archivos locales ignorados.

Exclusiones confirmadas por diseño:

- `.git`
- `.env`
- `node_modules`
- `dist`
- `build`
- respaldos
- planillas operacionales
- bases locales
- importaciones y exportaciones reales

## Elementos institucionales heredados

La línea base conservó temporalmente recursos y referencias institucionales para verificar equivalencia. La Fase 2 los retiró o convirtió en configuración genérica.

## Verificaciones

| Comprobación | Resultado | Observación |
| --- | --- | --- |
| Repositorio local independiente | Aprobado | La raíz Git es la carpeta PuroCole |
| Fuente limpia | Aprobado | `main` alineada con `origin/main` |
| Copia limitada a archivos rastreados | Aprobado | 140 archivos |
| Integridad frente al origen | Aprobado | Solo `README.md` y `.gitignore` difieren intencionalmente |
| Ausencia de datos locales ignorados | Aprobado | No se copiaron archivos operacionales |
| Fixture PDF ficticio | Aprobado | Se conserva porque forma parte de las pruebas versionadas |
| Backend `npm run check` | Aprobado | Sin errores de sintaxis |
| Backend `npm test` | Aprobado | 29 de 29 pruebas |
| Frontend `npm run lint` | Aprobado | Sin errores |
| Frontend `npm run build` | Aprobado | Build de Vite generado correctamente |
| Subproyecto heredado de cuestionarios | Retirado en Fase 2 | Sus 7 pruebas estaban aprobadas antes del retiro |
| Docker Compose | Aprobado | Configuración validada usando temporalmente `.env.example` |
| Smoke test autenticado | Pendiente | Requiere entorno en ejecución |
| Revisión visual | Pendiente | Requiere entorno en ejecución |

El `.env` temporal utilizado para validar Compose fue eliminado al terminar. Las carpetas `node_modules` y `frontend/dist` generadas por las comprobaciones permanecen ignoradas por Git.

## Regla de salida

La validación automática de la Fase 1 está terminada. El smoke test y la revisión visual permanecen como puertas manuales antes de considerar la experiencia heredada completamente aceptada.
