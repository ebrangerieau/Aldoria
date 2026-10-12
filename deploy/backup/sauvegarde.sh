#!/bin/sh
# Service « backup » : sauvegarde quotidienne de la base (pg_dump compressé).
# - une sauvegarde par jour, dès SAUVEGARDE_HEURE (UTC) ; rattrapée au démarrage si elle manque ;
# - un échec est retenté toutes les 10 minutes ;
# - on garde les SAUVEGARDE_NOMBRE plus récentes (par nombre et non par date : si les
#   sauvegardes s'arrêtent, les anciennes ne disparaissent pas) ;
# - l'état (dernière réussite, dernier échec) est écrit dans /etat/sauvegarde.json, lu par
#   l'espace parent ; chaque essai est journalisé en une ligne JSON (docker logs).
# Connexion : variables PGHOST, PGUSER, PGPASSWORD, PGDATABASE.
set -u
set -o pipefail

DIR=/sauvegardes
ETAT=/etat/sauvegarde.json
HEURE=${SAUVEGARDE_HEURE:-3}
NOMBRE=${SAUVEGARDE_NOMBRE:-14}
umask 077

maintenant() { date -u +%Y-%m-%dT%H:%M:%SZ; }

journal() { # niveau, message, champs JSON supplémentaires
	printf '{"time":"%s","level":"%s","event":"sauvegarde","message":"%s"%s}\n' "$(maintenant)" "$1" "$2" "${3:-}"
}

ecrire_etat() { # erreur ("" si réussite)
	local derniere copies reussite texte
	derniere=$(ls -1t "$DIR"/aldoria-*.sql.gz 2>/dev/null | head -n 1)
	copies=$(ls -1 "$DIR"/aldoria-*.sql.gz 2>/dev/null | wc -l)
	if [ -n "$derniere" ]; then
		reussite=$(printf '{"fichier":"%s","octets":%s,"date":"%s"}' "$(basename "$derniere")" \
			"$(wc -c <"$derniere")" "$(date -u -r "$derniere" +%Y-%m-%dT%H:%M:%SZ)")
	else
		reussite=null
	fi
	if [ -n "$1" ]; then texte="\"$1\""; else texte=null; fi
	printf '{"essai":"%s","derniere_reussite":%s,"copies":%s,"erreur":%s}\n' \
		"$(maintenant)" "$reussite" "$copies" "$texte" >"$ETAT.tmp"
	chmod 644 "$ETAT.tmp"
	mv "$ETAT.tmp" "$ETAT"
}

sauvegarder() {
	local fichier partiel erreur
	fichier="$DIR/aldoria-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
	partiel="$fichier.partiel"
	if pg_dump --clean --if-exists --no-owner 2>/tmp/erreur | gzip -9 >"$partiel" \
		&& gunzip -c "$partiel" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
		mv "$partiel" "$fichier"
		ls -1t "$DIR"/aldoria-*.sql.gz | tail -n +"$((NOMBRE + 1))" | xargs -r rm -f
		ecrire_etat ""
		journal info "sauvegarde terminée" ",\"fichier\":\"$(basename "$fichier")\",\"octets\":$(wc -c <"$fichier")"
	else
		rm -f "$partiel"
		# Message d'erreur sur une ligne, sans guillemets ni barres obliques inverses (JSON).
		erreur=$(head -n 1 /tmp/erreur | tr -d '"\\' | cut -c 1-200)
		[ -n "$erreur" ] || erreur="sauvegarde incomplète"
		ecrire_etat "$erreur"
		journal error "échec de la sauvegarde" ",\"erreur\":\"$erreur\""
	fi
}

mkdir -p "$DIR" "$(dirname "$ETAT")"
rm -f "$DIR"/*.partiel
journal info "service démarré" ",\"heure_utc\":$HEURE,\"nombre\":$NOMBRE"
while true; do
	heure=$(date -u +%H)
	if [ "${heure#0}" -ge "$HEURE" ] && ! ls "$DIR"/aldoria-"$(date -u +%Y%m%d)"T*.sql.gz >/dev/null 2>&1; then
		sauvegarder
	fi
	sleep 600
done
