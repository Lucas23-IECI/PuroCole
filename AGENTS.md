# Instrucciones de trabajo para PuroCole

Estas instrucciones aplican a todo el repositorio.

## Inicio obligatorio

Antes de modificar archivos:

1. Leer `PROJECT_CONTEXT.md`.
2. Leer `docs/DECISIONS.md`, `docs/SCOPE_V1.md` y `docs/ROADMAP.md`.
3. Revisar `git status --short --branch`.
4. Identificar la fase activa y preservar cambios existentes.

## Objetivo

Transformar la base funcional del sistema de puntualidad en una plataforma escolar modular. No reconstruir desde cero ni incorporar funcionalidades ajenas al alcance sin registrarlas como decisión.

## Reglas de privacidad

- Usar exclusivamente datos ficticios en desarrollo y pruebas.
- No copiar ni versionar RUT, nombres, correos, teléfonos, documentos, respaldos o planillas operacionales reales.
- No versionar `.env`, secretos, claves, certificados privados ni credenciales.
- Las plantillas deben ser claramente ficticias y no permitir inferir datos de una persona real.
- Antes de preparar un commit, auditar archivos nuevos y extensiones de datos.

## Git y repositorios de origen

- Trabajar únicamente en el repositorio independiente `PuroCole`.
- Los repositorios de Puntualidad y Alimentación son fuentes de consulta; no modificarlos salvo autorización explícita.
- No copiar carpetas `.git`, `node_modules`, `dist`, `build`, respaldos ni datos locales.
- No hacer commit, push, merge, publicación o despliegue sin autorización explícita.
- Evitar operaciones Git amplias desde `ProyectosInteresantes`; comprobar siempre `git rev-parse --show-toplevel`.

## Estrategia de transformación

1. Conservar una línea base ejecutable.
2. Generalizar identidad y configuración institucional.
3. Mantener funcional Puntualidad.
4. Construir el núcleo compartido.
5. Integrar Alimentación por dominio y flujo, no copiando una segunda autenticación o aplicación completa.
6. Agregar la línea temporal unificada.
7. Validar en piloto antes de convertirlo en SaaS multiestablecimiento.

## Límites técnicos

- Mantener una sola fuente de estudiantes y matrículas.
- Mantener una sola autenticación, autorización y auditoría.
- Separar módulos por responsabilidad.
- No reescribir componentes estables sin evidencia de que la adaptación es insuficiente.
- No introducir una sincronización bidireccional local/nube durante la primera versión.
- No tratar los datos alimentarios como una ficha clínica completa.

## Validación mínima

Para cambios en backend:

```powershell
Set-Location backend
npm run check
npm test
```

Para cambios en frontend:

```powershell
Set-Location frontend
npm run lint
npm run build
```

Para infraestructura:

```powershell
docker compose config --quiet
```

Para una instalación Docker efímera con datos ficticios:

```powershell
node scripts\pruebas-integracion.js
```

El arnés requiere una instalación nueva y un `.env` local seguro. No debe ejecutarse contra una instalación operacional.

Registrar resultados relevantes en `docs/BASELINE.md` o en el documento de la fase correspondiente. Una compilación verde no sustituye la validación funcional y visual.

## Documentación viva

- Cambiar el alcance solo en `docs/SCOPE_V1.md`.
- Registrar decisiones duraderas en `docs/DECISIONS.md`.
- Actualizar `docs/REUSE_MAP.md` cuando se adopte, adapte o descarte una pieza heredada.
- Actualizar `PROJECT_CONTEXT.md` cuando cambie la fase o el estado real del producto.
