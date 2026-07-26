[CmdletBinding()]
param(
  [int]$HttpPort = 18080,
  [int]$HttpsPort = 18443,
  [switch]$ConservarEntornoSiFalla
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $ProjectRoot 'docker-compose.yml'
$TlsComposeFile = Join-Path $ProjectRoot 'docker-compose.tls.yml'
$RunId = "{0}-{1}" -f (Get-Date -Format 'yyyyMMddHHmmss'), $PID
$ProjectName = "purocoleqa$($PID)"
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "purocole-acceptance-$RunId"
$BackupDir = Join-Path $TempRoot 'backups'
$CertDir = Join-Path $TempRoot 'certs'
$EnvironmentFile = Join-Path $TempRoot 'acceptance.env'
$Succeeded = $false

function New-HexSecret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose falló: $($Arguments -join ' ')"
  }
}

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) {
    throw "$Message Esperado: '$Expected'. Obtenido: '$Actual'."
  }
}

function Assert-ContainerHardening([string]$Service) {
  $containerId = (& docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile ps -q $Service).Trim()
  if (-not $containerId) { throw "No se encontró el contenedor $Service." }
  $inspection = (& docker inspect $containerId | ConvertFrom-Json)[0]
  Assert-Equal $inspection.HostConfig.ReadonlyRootfs $true "$Service debe usar filesystem de solo lectura."
  if ($inspection.HostConfig.CapDrop -notcontains 'ALL') { throw "$Service no elimina todas las capacidades por defecto." }
  if ($inspection.HostConfig.SecurityOpt -notcontains 'no-new-privileges:true') {
    throw "$Service no tiene no-new-privileges."
  }
}

New-Item -ItemType Directory -Path $BackupDir, $CertDir -Force | Out-Null
$TempRootResolved = (Resolve-Path -LiteralPath $TempRoot).Path
$SystemTempResolved = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path
if (-not $TempRootResolved.StartsWith($SystemTempResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'El directorio efímero quedó fuera del directorio temporal esperado.'
}

$databasePassword = New-HexSecret 24
$jwtSecret = New-HexSecret 48
$initialPassword = "Qa-$(New-HexSecret 10)-A9!"
$environmentPathForDocker = $EnvironmentFile.Replace('\', '/')
$backupPathForDocker = $BackupDir.Replace('\', '/')
$certPathForDocker = $CertDir.Replace('\', '/')

@(
  'DB_USER=purocole_qa'
  "DB_PASSWORD=$databasePassword"
  'DB_NAME=purocole_qa'
  'DB_HOST=localhost'
  'DB_PORT=5432'
  'PORT=5000'
  "JWT_SECRET=$jwtSecret"
  "CORS_ORIGIN=https://127.0.0.1:$HttpsPort"
  "DEFAULT_USER_PASSWORD=$initialPassword"
  'DEFAULT_ADMIN_EMAIL=admin.qa@purocole.test'
  'DEFAULT_TERMINAL_EMAIL=terminal.qa@purocole.test'
  'INSTITUTION_NAME=Colegio Ficticio de Pruebas'
  'INSTITUTION_SHORT_NAME=CFP'
  'INSTITUTION_RBD=00000-0'
  'INSTITUTION_LOCATION=Comuna de Pruebas'
  'INSTITUTION_LOGO_URL=/brand/purocole-mark.svg'
  'BRAND_PRIMARY=28618c'
  'BRAND_ACCENT=d8a447'
  'NODE_ENV=production'
  'COOKIE_SECURE=true'
  'APP_TIMEZONE=America/Santiago'
  'DB_POOL_MAX=10'
  'UPLOADS_DIR=/app/uploads'
  'STRICT_ENV_VALIDATION=true'
  'BACKUP_RETENTION_DAYS=30'
  'BACKUP_MIRROR_DIR='
  "HTTP_PORT=$HttpPort"
  "HTTPS_PORT=$HttpsPort"
  "APP_ENV_FILE=$environmentPathForDocker"
  "BACKUP_HOST_DIR=$backupPathForDocker"
  "TLS_CERT_DIR=$certPathForDocker"
) | Set-Content -LiteralPath $EnvironmentFile -Encoding ASCII

try {
  Write-Host '1/8 Validando configuración Compose...' -ForegroundColor Cyan
  Invoke-Compose config --quiet

  Write-Host '2/8 Construyendo e iniciando una instalación efímera...' -ForegroundColor Cyan
  Invoke-Compose up -d --build --wait --wait-timeout 300

  Write-Host '3/8 Verificando endurecimiento de contenedores...' -ForegroundColor Cyan
  foreach ($service in @('postgres', 'backend', 'frontend', 'backup')) {
    Assert-ContainerHardening $service
  }

  Write-Host '4/8 Ejecutando integración HTTP/API completa...' -ForegroundColor Cyan
  $previousTestUrl = $env:PUROCOLE_TEST_URL
  $previousEnvFile = $env:PUROCOLE_ENV_FILE
  try {
    $env:PUROCOLE_TEST_URL = "http://127.0.0.1:$HttpPort/api"
    $env:PUROCOLE_ENV_FILE = $EnvironmentFile
    & node (Join-Path $ProjectRoot 'scripts\pruebas-integracion.js')
    if ($LASTEXITCODE -ne 0) { throw 'Falló la batería de integración.' }
  } finally {
    $env:PUROCOLE_TEST_URL = $previousTestUrl
    $env:PUROCOLE_ENV_FILE = $previousEnvFile
  }

  Write-Host '5/8 Verificando respaldo, manifiesto y restauración aislada...' -ForegroundColor Cyan
  Invoke-Compose exec -T backup sh /backup.sh
  $statusPath = Join-Path $BackupDir 'last-success.env'
  if (-not (Test-Path -LiteralPath $statusPath)) { throw 'No se generó last-success.env.' }
  $status = @{}
  Get-Content -LiteralPath $statusPath | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) { $status[$parts[0]] = $parts[1] }
  }
  foreach ($key in @('database', 'documents', 'manifest')) {
    if (-not $status[$key]) { throw "El estado del respaldo no contiene $key." }
    if (-not (Test-Path -LiteralPath (Join-Path $BackupDir $status[$key]))) {
      throw "Falta el artefacto de respaldo $($status[$key])."
    }
  }
  $manifestLines = Get-Content -LiteralPath (Join-Path $BackupDir $status.manifest)
  foreach ($artifact in @($status.database, $status.documents)) {
    $expectedHash = (($manifestLines | Where-Object { $_ -match "\s\*?$([regex]::Escape($artifact))$" }) -split '\s+')[0]
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $BackupDir $artifact)).Hash.ToLowerInvariant()
    Assert-Equal $actualHash $expectedHash.ToLowerInvariant() "Hash inválido para $artifact."
  }
  Invoke-Compose -Arguments @('exec', '-T', 'postgres', 'createdb', '-U', 'purocole_qa', '-O', 'purocole_qa', 'purocole_restore_qa')
  Invoke-Compose -Arguments @(
    'run', '--rm', '--no-deps', '--entrypoint', 'sh',
    '-e', 'CONFIRM_RESTORE=SI_RESTAURAR',
    '-e', 'DB_NAME=purocole_restore_qa',
    '-e', 'UPLOADS_DIR=/tmp/restored',
    'backup', '/restore.sh',
    "/backups/$($status.database)",
    "/backups/$($status.documents)",
    "/backups/$($status.manifest)"
  )
  $sourceCount = (& docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile exec -T postgres psql -U purocole_qa -d purocole_qa -Atc 'SELECT COUNT(*) FROM alumno;').Trim()
  $restoredCount = (& docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile exec -T postgres psql -U purocole_qa -d purocole_restore_qa -Atc 'SELECT COUNT(*) FROM alumno;').Trim()
  Assert-Equal $restoredCount $sourceCount 'La restauración aislada no conserva la cantidad de alumnos.'

  Write-Host '6/8 Generando certificado efímero para validar TLS...' -ForegroundColor Cyan
  & docker run --rm -v "${certPathForDocker}:/certs" alpine:3.22 sh -c "apk add --no-cache openssl >/dev/null && openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj '/CN=127.0.0.1' -keyout /certs/purocole.key -out /certs/purocole.crt >/dev/null 2>&1 && chmod 0644 /certs/purocole.key /certs/purocole.crt"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el certificado efímero de prueba.' }
  & docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile -f $TlsComposeFile up -d --wait --wait-timeout 180 frontend
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el perfil TLS.' }

  Write-Host '7/8 Verificando redirección HTTPS, TLS y cookie Secure...' -ForegroundColor Cyan
  $redirectCode = (& curl.exe -s -o NUL -w '%{http_code}' "http://127.0.0.1:$HttpPort/").Trim()
  Assert-Equal $redirectCode '308' 'HTTP no redirige a HTTPS.'
  $tlsHealth = (& curl.exe -k -s -o NUL -w '%{http_code}' "https://127.0.0.1:$HttpsPort/healthz").Trim()
  Assert-Equal $tlsHealth '200' 'El healthcheck HTTPS no respondió correctamente.'
  $loginPayloadPath = Join-Path $TempRoot 'login-payload.json'
  @{ correo = 'admin.qa@purocole.test'; password = "${initialPassword}A7!" } |
    ConvertTo-Json -Compress |
    Set-Content -LiteralPath $loginPayloadPath -Encoding ASCII
  $tlsHeaders = & curl.exe -k -s -D - -o NUL -H 'Content-Type: application/json' --data-binary "@$loginPayloadPath" "https://127.0.0.1:$HttpsPort/api/auth/login"
  if (($tlsHeaders -join "`n") -notmatch '(?im)^set-cookie:.*;\s*Secure(?:;|$)') {
    throw 'La autenticación HTTPS no emitió una cookie Secure.'
  }

  Write-Host '8/8 Aceptación técnica completada.' -ForegroundColor Green
  $Succeeded = $true
} finally {
  if (-not $Succeeded) {
    Write-Warning 'La aceptación falló. Se muestran estados y logs finales.'
    & docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile ps
    & docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile logs --tail 120
  }

  if ($Succeeded -or -not $ConservarEntornoSiFalla) {
    & docker compose --project-name $ProjectName --env-file $EnvironmentFile -f $ComposeFile -f $TlsComposeFile down -v --remove-orphans
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Docker Compose no pudo limpiar por completo el entorno efímero.' }
    if (Test-Path -LiteralPath $TempRootResolved) {
      $resolvedBeforeDelete = (Resolve-Path -LiteralPath $TempRootResolved).Path
      if ($resolvedBeforeDelete.StartsWith($SystemTempResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedBeforeDelete -Recurse -Force
      } else {
        Write-Warning 'No se eliminó el temporal porque su ruta dejó de ser segura.'
      }
    }
  } else {
    Write-Warning "Entorno conservado para diagnóstico: $ProjectName"
    Write-Warning "Temporales: $TempRootResolved"
  }
}
