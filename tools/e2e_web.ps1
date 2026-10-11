# Banc de test web local, au plus près de la production :
#   export web (image de la CI) → nginx « web » + API + PostgreSQL de test
#   → proxy « edge » (rôle de Traefik : même origine pour le jeu et /api)
#   → parcours joueur dans Edge headless (tools/e2e/login_flow.js).
# Prérequis : Docker Desktop, conteneurs aldoria-pg et aldoria-api-test (réseau aldoria-test)
# avec un profil de test (PIN 1234). Usage : powershell -File tools/e2e_web.ps1 [-SkipExport]
param([switch]$SkipExport)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SkipExport) {
    Remove-Item -Recurse -Force build/web -ErrorAction SilentlyContinue
    docker run --rm -v "${root}:/src" -w /src barichello/godot-ci:4.7.2 sh -c `
        'mkdir -p build/web && godot --headless --path game --import >/dev/null 2>&1; godot --headless --path game --export-release Web ../build/web/index.html >/dev/null 2>&1; ls build/web/index.wasm'
    python tools/postprocess_web.py build/web | Select-Object -Last 1
}

docker build -q -f deploy/web.Dockerfile -t aldoria-web:local . | Out-Null
docker build -q -f deploy/api.Dockerfile -t aldoria-api:local . | Out-Null
# Conteneurs d'un passage précédent (absents la première fois : pas une erreur).
& { $ErrorActionPreference = "Continue"; docker rm -f aldoria-web-local aldoria-edge 2>&1 | Out-Null }
docker run -d --name aldoria-web-local --network aldoria-test aldoria-web:local | Out-Null
docker run -d --name aldoria-edge --network aldoria-test -p 127.0.0.1:8097:80 `
    -v "${root}/deploy/local/edge.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.29-alpine | Out-Null

$e2e = Join-Path $root "tools/e2e"
if (-not (Test-Path "$e2e/node_modules")) { Push-Location $e2e; npm install --silent | Out-Null; Pop-Location }
$out = Join-Path $env:TEMP "aldoria-e2e"
New-Item -ItemType Directory -Force $out | Out-Null
node "$e2e/login_flow.js" "http://127.0.0.1:8097/" $out
Write-Host "Captures : $out"
exit $LASTEXITCODE
