# Banc de test web local, au plus près de la production :
#   export web (image de la CI) → nginx « web » + API + PostgreSQL de test
#   → proxy « edge » (rôle de Traefik : même origine pour le jeu et /api)
#   → parcours joueur dans Edge headless (tools/e2e/login_flow.js)
#   → lecture à voix haute appelée dans le navigateur (tools/e2e/tts_check.js)
#   → espace parent : connexion d'un adulte, famille, et API parent introuvable sur l'hôte public
#     (tools/e2e/admin_flow.js).
# Prérequis : Docker Desktop, conteneurs aldoria-pg et aldoria-api-test (réseau aldoria-test)
# avec un profil de test (PIN 1234) dans la famille 1. Le parent du banc et les codes de liaison
# des appareils sont créés ici (valeurs de test locales uniquement).
# Usage : powershell -File tools/e2e_web.ps1 [-SkipExport]
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
& { $ErrorActionPreference = "Continue"; docker rm -f aldoria-web-local aldoria-edge aldoria-api-test aldoria-backup-test 2>&1 | Out-Null }
# Service de sauvegarde réel (deploy/backup/sauvegarde.sh) : son état est lu par l'API (Réglages → Sauvegardes).
$bk = Join-Path $env:TEMP "aldoria-e2e-sauvegardes"
Remove-Item -Recurse -Force $bk -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$bk/quotidiennes", "$bk/etat" | Out-Null
docker run -d --name aldoria-backup-test --network aldoria-test -e PGHOST=aldoria-pg -e PGUSER=aldoria -e PGPASSWORD=test `
    -e PGDATABASE=aldoria -e SAUVEGARDE_HEURE=0 -v "${root}/deploy/backup/sauvegarde.sh:/sauvegarde.sh:ro" `
    -v "$bk/quotidiennes:/sauvegardes" -v "$bk/etat:/etat" postgres:16-alpine sh /sauvegarde.sh | Out-Null
# API recréée avec le code courant (la base aldoria-pg et ses profils de test sont conservés).
docker run -d --name aldoria-api-test --network aldoria-test -p 127.0.0.1:8098:8000 `
    -e ALDORIA_DATABASE_URL=postgresql+asyncpg://aldoria:test@aldoria-pg:5432/aldoria `
    -e ALDORIA_ADMIN_KEY=cle-de-test-locale-uniquement-0123456789 -e ALDORIA_ADMIN_URL=http://aldoria-admin.localhost:8097 `
    -e ALDORIA_BACKUP_STATUS_DIR=/etat-sauvegardes -v "$bk/etat:/etat-sauvegardes:ro" `
    aldoria-api:local | Out-Null
Start-Sleep -Seconds 6
# Parent du banc (exploitant, pour l'onglet Exploitation) : créé une fois, garde son mot de passe.
$parentEmail = "parent@test.local"
$parentPassword = "mot-de-passe-du-banc-local"
& { $ErrorActionPreference = "Continue"
    docker exec aldoria-api-test python -m app.cli create-adult --family 1 --email $parentEmail `
        --name "Parent du banc" --password $parentPassword --operator 2>&1 | Out-Null }
# Un code de liaison par navigateur neuf (parcours joueur, lecture à voix haute).
$pairGame = (docker exec aldoria-api-test python -m app.cli pairing-code --family 1 --name "Banc e2e").Trim()
$pairTts = (docker exec aldoria-api-test python -m app.cli pairing-code --family 1 --name "Banc voix").Trim()
docker run -d --name aldoria-web-local --network aldoria-test aldoria-web:local | Out-Null
docker run -d --name aldoria-edge --network aldoria-test -p 127.0.0.1:8097:80 `
    -v "${root}/deploy/local/edge.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.29-alpine | Out-Null

$e2e = Join-Path $root "tools/e2e"
if (-not (Test-Path "$e2e/node_modules")) { Push-Location $e2e; npm install --silent | Out-Null; Pop-Location }
$out = Join-Path $env:TEMP "aldoria-e2e"
New-Item -ItemType Directory -Force $out | Out-Null
node "$e2e/login_flow.js" "http://127.0.0.1:8097/" $out $pairGame
$game = $LASTEXITCODE
node "$e2e/tts_check.js" "http://127.0.0.1:8097/" "http://127.0.0.1:8098" "cle-de-test-locale-uniquement-0123456789" $pairTts $parentEmail $parentPassword
$tts = $LASTEXITCODE
node "$e2e/admin_flow.js" "http://aldoria-admin.localhost:8097/" "http://127.0.0.1:8097/" $out $parentEmail $parentPassword
$admin = $LASTEXITCODE
Write-Host "Captures : $out"
exit [Math]::Max([Math]::Max($game, $admin), $tts)
