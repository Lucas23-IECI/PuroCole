# HTTPS para un piloto de PuroCole

## Requisitos

- Un nombre DNS definitivo para el servidor.
- Un certificado y una clave privada emitidos por una autoridad confiable para los equipos del establecimiento.
- Permiso de lectura de la clave para el UID 101 que ejecuta Nginx, sin hacerla pública para otros usuarios.
- Puertos 80 y 443 disponibles.

No se deben guardar certificados, claves privadas ni secretos en Git. El directorio `certs/` está ignorado.

## Archivos locales

Ubicar fuera del control de versiones:

```text
certs/
  purocole.crt
  purocole.key
```

En Linux, una opción es asignar la clave al UID 101 y modo `0400`. En Windows con Docker Desktop se debe conceder lectura al usuario que comparte el archivo con el contenedor y comprobar el arranque; no se debe ampliar el permiso más de lo necesario.

## Variables obligatorias

En el `.env` local:

```dotenv
NODE_ENV=production
STRICT_ENV_VALIDATION=true
CORS_ORIGIN=https://colegio.ejemplo.cl
COOKIE_SECURE=true
HTTP_PORT=80
HTTPS_PORT=443
TLS_CERT_DIR=./certs
```

`colegio.ejemplo.cl` es solo un ejemplo y debe reemplazarse por el dominio real.

## Inicio

```powershell
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.tls.yml ps
```

Resultado esperado:

- `http://dominio/` redirige con 308 a HTTPS.
- `https://dominio/healthz` responde `ok`.
- `https://dominio/api/health/ready` responde estado listo.
- La cookie de sesión incluye `Secure`, `HttpOnly` y `SameSite=Strict`.

Si Nginx indica que no puede leer `purocole.key`, se debe corregir la ACL o propiedad del archivo. No se debe ejecutar el frontend como root para ocultar el problema.

## Puerta previa

La validación local repetible usa un certificado efímero y datos ficticios:

```powershell
.\scripts\pruebas-aceptacion.ps1
```

Esa prueba no reemplaza la validación del certificado real, DNS, firewall, lector físico ni acceso desde un segundo computador.
