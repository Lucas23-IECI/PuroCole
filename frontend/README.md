# Frontend de PuroCole

Interfaz React para el terminal operativo y el portal de gestión de PuroCole.

## Desarrollo

```powershell
npm ci
npm run dev
```

Por defecto consume `http://localhost:5000/api`. Puede cambiarse con `VITE_API_URL`.

## Configuración institucional

Las variables disponibles están documentadas en `../docs/BRANDING.md`.

Ejemplo local:

```powershell
$env:VITE_INSTITUTION_NAME='Establecimiento de demostración'
$env:VITE_INSTITUTION_RBD='00000-0'
$env:VITE_INSTITUTION_LOCATION='Ciudad de demostración'
npm run dev
```

Si no se declaran, la interfaz utiliza la marca PuroCole y el texto neutral `Establecimiento educativo`.

## Validación

```powershell
npm run lint
npm run build
```

La validación manual debe cubrir login, panel, terminal, cambio de contraseña y viewports reducidos.
