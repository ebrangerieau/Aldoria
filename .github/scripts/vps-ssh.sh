#!/usr/bin/env bash
# Accès SSH de la CI au VPS, le temps d'un déploiement.
#
# Le pare-feu Hostinger du VPS (FW-bandtrack) n'ouvre le port 22 qu'à quelques adresses connues.
# « open » ajoute une règle pour l'adresse publique de ce runner, l'applique et attend que le port
# réponde ; « close » retire cette règle. Les deux workflows de déploiement (ci.yml, v2.yml) appellent
# « close » dans une étape `if: always()` : la règle ne survit pas à un échec du déploiement.
#
# Variables : HOSTINGER_API_TOKEN (secret de l'environnement production ; sans lui, rien n'est fait),
# VPS_HOST, VPS_FIREWALL_ID (pare-feu à modifier), GITHUB_ENV (pour transmettre l'id de la règle).
set -euo pipefail

API="${HOSTINGER_API_URL:-https://developers.hostinger.com}/api/vps/v1/firewall/${VPS_FIREWALL_ID:?VPS_FIREWALL_ID manquant}"
summary() { echo "$1" >&2; [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$1" >> "$GITHUB_STEP_SUMMARY"; return 0; }

# Appel de l'API Hostinger : corps de la réponse sur la sortie, échec (avec le message) si le code n'est pas 2xx.
hostinger() {
  local method=$1 path=$2 body=${3:-} out code
  out=$(mktemp)
  local args=(-sS -o "$out" -w '%{http_code}' -X "$method" "${API}${path}"
    -H "Authorization: Bearer ${HOSTINGER_API_TOKEN}" -H 'Accept: application/json')
  if [ -n "$body" ]; then args+=(-H 'Content-Type: application/json' --data "$body"); fi
  code=$(curl "${args[@]}") || code=000
  if [ "${code:0:1}" != "2" ]; then
    echo "::error::API Hostinger, $method $path : HTTP $code $(head -c 300 "$out")" >&2
    [ "$code" = "401" ] && summary "Jeton HOSTINGER_API_TOKEN refusé (expiré ?) : en créer un nouveau dans hPanel, Profil, API."
    rm -f "$out"; return 1
  fi
  cat "$out"; rm -f "$out"
}

port_open() { timeout 5 bash -c "</dev/tcp/${VPS_HOST}/22" 2>/dev/null; }

case "${1:-}" in
  open)
    if [ -z "${HOSTINGER_API_TOKEN:-}" ]; then
      summary "HOSTINGER_API_TOKEN absent : le pare-feu n'est pas ouvert pour ce runner."
      exit 0
    fi
    ip=$(curl -4 -fsS --max-time 10 https://api.ipify.org || curl -4 -fsS --max-time 10 https://checkip.amazonaws.com)
    ip=$(echo "$ip" | tr -d '[:space:]')
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::Adresse du runner illisible : '$ip'" >&2; exit 1; }
    created=$(hostinger POST /rules "{\"protocol\":\"TCP\",\"port\":\"22\",\"source\":\"custom\",\"source_detail\":\"${ip}\"}")
    rule=$(echo "$created" | python3 -c \
      'import json,sys; d=json.load(sys.stdin); print(d.get("id") or (d.get("data") or {}).get("id") or "")' || true)
    [ -n "$rule" ] || { echo "::error::Règle créée sans identifiant : $(echo "$created" | head -c 300)" >&2; exit 1; }
    # Transmis tout de suite : « close » retire la règle même si la suite échoue.
    echo "VPS_SSH_RULE_ID=${rule}" >> "$GITHUB_ENV"
    hostinger POST /sync > /dev/null
    # L'application des règles est asynchrone : attendre que le port réponde (3 minutes au plus).
    for i in $(seq 1 36); do
      if port_open; then
        summary "Port 22 ouvert pour ce runner (${ip}, règle ${rule}) après $(((i - 1) * 5)) s d'attente."
        exit 0
      fi
      sleep 5
    done
    echo "::error::Le port 22 du VPS ne répond toujours pas après l'ouverture du pare-feu (règle ${rule})." >&2
    exit 1
    ;;
  close)
    rule=${VPS_SSH_RULE_ID:-}
    if [ -z "$rule" ] || [ -z "${HOSTINGER_API_TOKEN:-}" ]; then
      exit 0  # rien n'a été ouvert
    fi
    if hostinger DELETE "/rules/${rule}" > /dev/null && hostinger POST /sync > /dev/null; then
      summary "Règle ${rule} retirée du pare-feu."
    else
      summary "La règle ${rule} n'a pas pu être retirée du pare-feu FW-bandtrack : la supprimer dans hPanel (port 22, adresse d'un runner GitHub)."
      exit 1
    fi
    ;;
  *)
    echo "usage : $0 open|close" >&2
    exit 2
    ;;
esac
