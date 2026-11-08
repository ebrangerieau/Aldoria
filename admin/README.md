# Espace parent de la v1 : gelé

Depuis l'étape 0.8 de la v2 (novembre 2026), l'espace parent servi sur `aldoria-admin.bandtrack.fr` est celui de
**`v2/admin`**, dans l'image du service `web2` (`v2/deploy/web.Dockerfile`). Ce dossier n'est plus construit ni déployé :
ne rien y modifier. Toute évolution se fait dans `v2/admin`, avec son guide (`v2/admin/src/Guide.tsx`) et son parcours dans le
navigateur (`v2/tools/e2e_admin.sh`). Il sera retiré du dépôt avec le jeu v1 (phase 4 du plan de la v2).
