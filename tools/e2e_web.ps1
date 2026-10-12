# Banc de test web local, au plus près de la production :
#   export web (image de la CI) → nginx « web » + API + PostgreSQL de test
#   → proxy « edge » (rôle de Traefik : même origine pour le jeu et /api)
#   → parcours joueur dans Edge headless (tools/e2e/login_flow.js)
#   → lecture à voix haute appelée dans le navigateur (tools/e2e/tts_check.js)
#   → espace parent, et refus d'un Remote-User forgé sur l'hôte public (tools/e2e/admin_flow.js).
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
& { $ErrorActionPreference = "Continue"; docker rm -f aldoria-web-local aldoria-edge aldoria-api-test 2>&1 | Out-Null }
# API recréée avec le code courant (la base aldoria-pg et ses profils de test sont conservés).
docker run -d --name aldoria-api-test --network aldoria-test -p 127.0.0.1:8098:8000 `
    -e ALDORIA_DATABASE_URL=postgresql+asyncpg://aldoria:test@aldoria-pg:5432/aldoria `
    -e ALDORIA_ADMIN_KEY=cle-de-test-locale-uniquement-0123456789 -e ALDORIA_ADMIN_USERS=parent@test.local `
    aldoria-api:local | Out-Null
Start-Sleep -Seconds 6
docker run -d --name aldoria-web-local --network aldoria-test aldoria-web:local | Out-Null
docker run -d --name aldoria-edge --network aldoria-test -p 127.0.0.1:8097:80 `
    -v "${root}/deploy/local/edge.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.29-alpine | Out-Null

$e2e = Join-Path $root "tools/e2e"
if (-not (Test-Path "$e2e/node_modules")) { Push-Location $e2e; npm install --silent | Out-Null; Pop-Location }
$out = Join-Path $env:TEMP "aldoria-e2e"
New-Item -ItemType Directory -Force $out | Out-Null
node "$e2e/login_flow.js" "http://127.0.0.1:8097/" $out
$game = $LASTEXITCODE
node "$e2e/tts_check.js" "http://127.0.0.1:8097/" "http://127.0.0.1:8098" "cle-de-test-locale-uniquement-0123456789"
$tts = $LASTEXITCODE
node "$e2e/admin_flow.js" "http://aldoria-admin.localhost:8097/" "http://127.0.0.1:8097/" $out
$admin = $LASTEXITCODE
Write-Host "Captures : $out"
exit [Math]::Max([Math]::Max($game, $admin), $tts)
