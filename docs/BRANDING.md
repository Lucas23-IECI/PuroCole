# Marca y configuración institucional

## Principio

PuroCole mantiene una identidad de producto común y permite configurar la identificación básica de cada establecimiento sin editar código.

## Marca de producto

- Nombre: PuroCole.
- Descriptor: Operaciones escolares.
- Marca predeterminada: `frontend/public/brand/purocole-mark.svg`.
- La interfaz no incorpora fotografías, escudos ni textos de establecimientos reales.

## Configuración mediante entorno

| Variable | Función | Valor predeterminado |
| --- | --- | --- |
| `INSTITUTION_NAME` | Nombre completo | `Establecimiento educativo` |
| `INSTITUTION_SHORT_NAME` | Nombre corto opcional | vacío |
| `INSTITUTION_RBD` | RBD sin prefijo | vacío |
| `INSTITUTION_LOCATION` | Ciudad, comuna o sede | vacío |
| `INSTITUTION_LOGO_URL` | Recurso público del logo | `/brand/purocole-mark.svg` |
| `BRAND_PRIMARY` | Color primario hexadecimal sin `#` | `28618c` |
| `BRAND_ACCENT` | Color de acento hexadecimal sin `#` | `d8a447` |

Vite integra estas variables durante el build de Docker. Cambiarlas requiere volver a construir el frontend, pero no modificar su código.

## Límites

- No copiar logos ni fotografías sin autorización y procedencia verificable.
- No incorporar direcciones, lemas o enlaces específicos como valores predeterminados.
- La personalización no debe romper contraste, estados de error ni legibilidad.
- PuroCole debe seguir siendo reconocible aunque el establecimiento utilice su propio logo.
- Una red de establecimientos y múltiples marcas quedan fuera de V1.

## Verificación

Antes de aceptar una configuración:

1. Construir el frontend con las variables elegidas.
2. Revisar login, panel principal, terminal y cambio de contraseña.
3. Comprobar escritorio y viewport reducido.
4. Confirmar que logo, nombre, RBD y ubicación no desbordan.
5. Verificar que no quedan recursos del establecimiento usado como origen.
