#!/bin/sh
# Copie des sauvegardes hors du VPS, à la maison : commande forcée de la clé SSH
# « aldoria_copie » (authorized_keys de root : command="sh /docker/aldoria/backup/copie-maison.sh",restrict).
# Cette clé ne peut rien faire d'autre que :
#   liste                  → noms des sauvegardes quotidiennes, une par ligne
#   envoyer <nom>          → contenu de la sauvegarde
#   confirmer <nom> <sha>  → vérifie l'empreinte SHA-256 reçue et note la copie
#                            (lue par l'espace parent : « copie à la maison »)
set -eu
set -f # pas d'expansion de motifs dans la commande reçue

DIR=/docker/aldoria/backups/quotidiennes
ETAT=/docker/aldoria/backups/etat/copie.json

# shellcheck disable=SC2086 # découpage voulu : commande et arguments
set -- ${SSH_ORIGINAL_COMMAND:-}
commande=${1:-}

nom_valide() {
	case "$1" in
	aldoria-[0-9]*T[0-9]*Z.sql.gz) ;;
	*) echo "nom refusé" >&2; exit 2 ;;
	esac
	case "$1" in */* | *..*) echo "nom refusé" >&2; exit 2 ;; esac
	[ -f "$DIR/$1" ] || { echo "sauvegarde introuvable" >&2; exit 3; }
}

case "$commande" in
liste)
	ls -1 "$DIR" | grep -E '^aldoria-[0-9]{8}T[0-9]{6}Z\.sql\.gz$' || true
	;;
envoyer)
	[ $# -eq 2 ] || { echo "usage : envoyer <nom>" >&2; exit 2; }
	nom_valide "$2"
	cat "$DIR/$2"
	;;
confirmer)
	[ $# -eq 3 ] || { echo "usage : confirmer <nom> <sha256>" >&2; exit 2; }
	nom_valide "$2"
	attendu=$(sha256sum "$DIR/$2" | cut -d ' ' -f 1)
	[ "$attendu" = "$3" ] || { echo "empreinte différente : copie abîmée" >&2; exit 4; }
	mkdir -p "$(dirname "$ETAT")"
	printf '{"date":"%s","fichier":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$2" >"$ETAT.tmp"
	chmod 644 "$ETAT.tmp"
	mv "$ETAT.tmp" "$ETAT"
	echo ok
	;;
*)
	echo "commandes : liste, envoyer <nom>, confirmer <nom> <sha256>" >&2
	exit 2
	;;
esac
