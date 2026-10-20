#!/usr/bin/env bash
# Banc de test web en CI (Linux), même parcours que tools/e2e_web.ps1 sur le poste, mais sur une base
# neuve : PostgreSQL jetable, famille de test (Jules 6e, PIN 1234 ; Tom 2nde, PIN 9876), parent du banc,
# API et nginx construits depuis le dépôt, proxy « edge » (rôle de Traefik), puis les trois parcours dans
# Chromium (WebGL logiciel, attentes multipliées par E2E_SLOW). Valeurs de test uniquement.
# Prérequis : export web post-traité dans build/web. Usage : bash tools/e2e_ci.sh <dossier captures>
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
out=${1:-/tmp/aldoria-e2e}
mkdir -p "$out"
key=cle-de-test-locale-uniquement-0123456789
email=parent@test.local
password=mot-de-passe-du-banc-local

docker network create aldoria-test >/dev/null
docker run -d --name aldoria-pg --network aldoria-test -e POSTGRES_USER=aldoria -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=aldoria postgres:16-alpine >/dev/null
docker build -q -f deploy/web.Dockerfile -t aldoria-web:local . >/dev/null
docker build -q -f deploy/api.Dockerfile -t aldoria-api:local . >/dev/null
until docker exec aldoria-pg pg_isready -U aldoria -d aldoria >/dev/null 2>&1; do sleep 1; done

# Service de sauvegarde réel : son état est lu par l'API (Exploitation → Sauvegardes).
bk=$(mktemp -d)
mkdir -p "$bk/quotidiennes" "$bk/etat"
chmod 777 "$bk/quotidiennes" "$bk/etat"
docker run -d --name aldoria-backup-test --network aldoria-test -e PGHOST=aldoria-pg -e PGUSER=aldoria \
  -e PGPASSWORD=test -e PGDATABASE=aldoria -e SAUVEGARDE_HEURE=0 \
  -v "$root/deploy/backup/sauvegarde.sh:/sauvegarde.sh:ro" -v "$bk/quotidiennes:/sauvegardes" \
  -v "$bk/etat:/etat" postgres:16-alpine sh /sauvegarde.sh >/dev/null
docker run -d --name aldoria-api-test --network aldoria-test -p 127.0.0.1:8098:8000 \
  -e ALDORIA_DATABASE_URL=postgresql+asyncpg://aldoria:test@aldoria-pg:5432/aldoria \
  -e ALDORIA_ADMIN_KEY=$key -e ALDORIA_ADMIN_URL=http://aldoria-admin.localhost:8097 \
  -e ALDORIA_BACKUP_STATUS_DIR=/etat-sauvegardes -v "$bk/etat:/etat-sauvegardes:ro" aldoria-api:local >/dev/null
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:8098/api/v1/health >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1:8098/api/v1/health && echo

cli() { docker exec aldoria-api-test python -m app.cli "$@"; }
cli create-family --name "Famille du banc"
cli create --family 1 --name Jules --level 6e --pin 1234
cli create --family 1 --name Tom --level 2nde --pin 9876
cli create-adult --family 1 --email $email --name "Parent du banc" --password $password --operator
pair_game=$(cli pairing-code --family 1 --name "Banc e2e" | tr -d '\r\n')
pair_tts=$(cli pairing-code --family 1 --name "Banc voix" | tr -d '\r\n')

docker run -d --name aldoria-web-local --network aldoria-test aldoria-web:local >/dev/null
docker run -d --name aldoria-edge --network aldoria-test -p 127.0.0.1:8097:80 \
  -v "$root/deploy/local/edge.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.29-alpine >/dev/null
sleep 3

cd tools/e2e
npm ci --no-audit --no-fund --silent
node node_modules/playwright-core/cli.js install --with-deps chromium >/dev/null
export E2E_BROWSER=chromium E2E_SLOW=${E2E_SLOW:-3} E2E_OUT="$out"
status=0
node login_flow.js "http://127.0.0.1:8097/" "$out" "$pair_game" || status=1
node tts_check.js "http://127.0.0.1:8097/" "http://127.0.0.1:8098" $key "$pair_tts" $email $password || status=1
node admin_flow.js "http://aldoria-admin.localhost:8097/" "http://127.0.0.1:8097/" "$out" $email $password || status=1
if [ $status -ne 0 ]; then
  docker logs aldoria-api-test 2>&1 | tail -40
fi
exit $status
