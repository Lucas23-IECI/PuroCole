[CmdletBinding()]
param(
  [switch]$ForzarConfiguracion,
  [switch]$OmitirFirewall,
  [string]$NombreEstablecimiento = 'Establecimiento educativo',
  [string]$NombreCorto = '',
  [string]$Rbd = '',
  [string]$Ubicacion = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot '.env'
$CredentialsFile = Join-Path $ProjectRoot 'credenciales-iniciales.txt'

function New-HexSecret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Get-LanAddress {
  $candidate = Get-NetIPConfiguration |
    Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway } |
    ForEach-Object { $_.IPv4Address.IPAddress } |
    Where-Object { $_ -and $_ -notlike '169.254.*' } |
    Select-Object -First 1
  if (-not $candidate) { throw 'No se encontro una direccion IPv4 activa con puerta de enlace.' }
  return $candidate
}

Set-Location $ProjectRoot
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop no esta instalado o docker.exe no esta disponible en PATH.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop esta instalado, pero su motor no esta iniciado.' }

$lanAddress = Get-LanAddress
$initialPassword = $null
if ((Test-Path $EnvironmentFile) -and -not $ForzarConfiguracion) {
  Write-Host 'Se conserva el archivo .env existente.'
} else {
  $databasePassword = New-HexSecret 24
  $jwtSecret = New-HexSecret 48
  $initialPassword = "Puro-$(New-HexSecret 10)-A9"
  @(
    'DB_USER=purocole_app'
    "DB_PASSWORD=$databasePassword"
    'DB_NAME=purocole'
    'DB_HOST=localhost'
    'DB_PORT=5432'
    'PORT=5000'
    "JWT_SECRET=$jwtSecret"
    "CORS_ORIGIN=http://localhost,http://127.0.0.1,http://$lanAddress"
    "DEFAULT_USER_PASSWORD=$initialPassword"
    'DEFAULT_ADMIN_EMAIL=admin@purocole.local'
    'DEFAULT_TERMINAL_EMAIL=terminal@purocole.local'
    "INSTITUTION_NAME=$NombreEstablecimiento"
    "INSTITUTION_SHORT_NAME=$NombreCorto"
    "INSTITUTION_RBD=$Rbd"
    "INSTITUTION_LOCATION=$Ubicacion"
    'INSTITUTION_LOGO_URL=/brand/purocole-mark.svg'
    'BRAND_PRIMARY=28618c'
    'BRAND_ACCENT=d8a447'
    'NODE_ENV=production'
    'COOKIE_SECURE=false'
    'APP_TIMEZONE=America/Santiago'
    'DB_POOL_MAX=10'
    'UPLOADS_DIR=/app/uploads'
    'STRICT_ENV_VALIDATION=true'
    'BACKUP_RETENTION_DAYS=30'
    'BACKUP_MIRROR_DIR='
  ) | Set-Content -LiteralPath $EnvironmentFile -Encoding ASCII

  @(
    'CREDENCIALES INICIALES DE PUROCOLE'
    'Cambiar estas claves despues del primer acceso y guardar este archivo fuera del PC servidor.'
    ''
    'Administrador: admin@purocole.local'
    'Terminal: terminal@purocole.local'
    "Clave inicial: $initialPassword"
    ''
    "Acceso local: http://localhost"
    "Acceso desde la red escolar: http://$lanAddress"
  ) | Set-Content -LiteralPath $CredentialsFile -Encoding ASCII
}

if (-not $OmitirFirewall) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
  if ($isAdmin) {
    if (-not (Get-NetFirewallRule -DisplayName 'PuroCole (HTTP 80)' -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName 'PuroCole (HTTP 80)' -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private | Out-Null
    }
  } else {
    Write-Warning 'PowerShell no tiene permisos de administrador. Ejecute una vez como administrador para habilitar el puerto 80 en el firewall.'
  }
}

docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose no pudo iniciar el sistema.' }

$deadline = (Get-Date).AddMinutes(3)
$ready = $false
do {
  Start-Sleep -Seconds 3
  try {
    $web = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1/healthz' -TimeoutSec 5
    $api = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1/api/health/ready' -TimeoutSec 5
    $ready = $web.StatusCode -eq 200 -and $api.StatusCode -eq 200
  } catch { $ready = $false }
} until ($ready -or (Get-Date) -ge $deadline)

if (-not $ready) {
  docker compose ps
  throw 'Los servicios no quedaron saludables dentro de tres minutos.'
}

Write-Host ''
Write-Host 'Sistema instalado y saludable.' -ForegroundColor Green
Write-Host 'En este PC: http://localhost'
Write-Host "En la red escolar: http://$lanAddress"
if ($initialPassword) { Write-Host "Credenciales guardadas en: $CredentialsFile" }
