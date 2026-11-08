#!/usr/bin/env bash
# Parcours de l'espace parent dans le navigateur, contre l'image servie en production (web2) :
# PostgreSQL jetable, API construite depuis v2/api, service de sauvegarde réel, image web2
# (v2/deploy/web.Dockerfile : nginx et build de v2/admin), proxy « edge » qui joue Traefik
# (v2/deploy/local/edge.conf), puis v2/admin/e2e/admin_flow.js : connexion d'un adulte, tableau de bord,
# programme, questions, réglages, famille, exploitation, guide, et API parent introuvable sur l'hôte public.
#
# Usage (depuis n'importe où ; Docker démarré) : bash v2/tools/e2e_admin.sh [dossier des captures]
# Navigateur : Edge du poste, ou Chromium de Playwright avec E2E_BROWSER=chromium (CI). E2E_KEEP=1 garde
# les conteneurs à la fin (espace parent sur http://aldoria-admin.localhost:8197/). Valeurs de test uniquement.
set -euo pipefail
export MSYS_NO_PATHCONV=1  # Git Bash (Windows) : ne pas réécrire les chemins des conteneurs
v2=$(cd "$(dirname "$0")/.." && pwd)
cd "$v2"
out=${1:-${TMPDIR:-/tmp}/aldoria2-e2e-admin}
mkdir -p "$out"
p=aldoria2-e2e
port=8197
key=cle-de-test-locale-uniquement-0123456789
email=parent@test.local
password=mot-de-passe-du-banc-local

nettoyer() {
  docker rm -f $p-edge $p-web $p-api $p-backup $p-pg >/dev/null 2>&1 || true
  docker volume rm $p-etat $p-dumps >/dev/null 2>&1 || true
  docker network rm $p >/dev/null 2>&1 || true
}
nettoyer  # reste d'un passage précédent
[ "${E2E_KEEP:-0}" = "1" ] || trap nettoyer EXIT

echo "Images (API, web2)…"
docker build -q -f deploy/api.Dockerfile -t $p-api:local . >/dev/null
docker build -q -f deploy/web.Dockerfile --build-arg GIT_SHA=e2e -t $p-web:local . >/dev/null

docker network create $p >/dev/null
docker volume create $p-etat >/dev/null
docker volume create $p-dumps >/dev/null
docker run -d --name $p-pg --network $p -e POSTGRES_USER=aldoria -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=aldoria postgres:16-alpine >/dev/null
until docker exec $p-pg pg_isready -U aldoria -d aldoria >/dev/null 2>&1; do sleep 1; done

docker run -d --name $p-api --network $p \
  -e ALDORIA_DATABASE_URL=postgresql+asyncpg://aldoria:test@$p-pg:5432/aldoria \
  -e ALDORIA_ADMIN_KEY=$key -e ALDORIA_ADMIN_URL=http://aldoria-admin.localhost:$port \
  -e ALDORIA_BACKUP_STATUS_DIR=/etat-sauvegardes -v $p-etat:/etat-sauvegardes:ro $p-api:local >/dev/null
api_ok() {
  docker exec $p-api python -c \
    'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/api/v1/health", timeout=3)' >/dev/null 2>&1
}
for _ in $(seq 1 60); do api_ok && break; sleep 2; done
api_ok || { docker logs $p-api 2>&1 | tail -30; echo "L'API ne répond pas." >&2; exit 1; }

# Service de sauvegarde réel (deploy/backup/sauvegarde.sh) : sa première sauvegarde est affichée dans
# Exploitation → Sauvegardes. Fichiers copiés dans les conteneurs (pas de montage : même script sous Windows).
docker create --name $p-backup --network $p -e PGHOST=$p-pg -e PGUSER=aldoria -e PGPASSWORD=test \
  -e PGDATABASE=aldoria -e SAUVEGARDE_HEURE=0 -v $p-dumps:/sauvegardes -v $p-etat:/etat \
  postgres:16-alpine sh /sauvegarde.sh >/dev/null
docker cp deploy/backup/sauvegarde.sh $p-backup:/sauvegarde.sh
docker start $p-backup >/dev/null

cli() { docker exec $p-api python -m app.cli "$@"; }
cli create-family --name "Famille du banc"
cli create --family 1 --name Jules --level 6e --pin 1234
cli create --family 1 --name Tom --level 2nde --pin 9876
cli create-adult --family 1 --email $email --name "Parent du banc" --password $password --operator

docker run -d --name $p-web --network $p $p-web:local >/dev/null
docker create --name $p-edge --network $p -p 127.0.0.1:$port:80 nginx:1.29-alpine >/dev/null
docker cp deploy/local/edge.conf $p-edge:/etc/nginx/conf.d/default.conf
docker start $p-edge >/dev/null
for _ in $(seq 1 30); do
  [ "$(curl -s "http://127.0.0.1:$port/api/v1/health" | grep -c '"status":"ok"')" = "1" ] && break
  sleep 1
done

cd admin/e2e
npm ci --no-audit --no-fund --silent
if [ "${E2E_BROWSER:-}" = "chromium" ]; then
  node node_modules/playwright-core/cli.js install --with-deps chromium >/dev/null
fi
status=0
node admin_flow.js "http://aldoria-admin.localhost:$port/" "http://127.0.0.1:$port/" "$out" $email $password || status=1
if [ $status -ne 0 ]; then
  docker logs $p-api 2>&1 | tail -40
fi
echo "Captures : $out"
exit $status
