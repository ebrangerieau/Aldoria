---
name: livrer
description: Vérifier et mettre en ligne une modification d'Aldoria — tests API, ruff, GUT, build de l'espace parent, test de bout en bout dans le navigateur, sauvegarde avant migration, commit, suivi de la CI qui déploie, contrôle en production.
---

# Livrer une modification

La CI déploie à **chaque push sur `main`** (`.github/workflows`) : ne pousser qu'une fois tout vert, et seulement
quand Eric a demandé la modification.

## 1. Vérifications locales (selon ce qui a changé)

| Changé | Commande (depuis la racine du dépôt) |
| --- | --- |
| API | `uv run --directory api pytest -q` puis `uv run --directory api ruff check .` (et `ruff format` si besoin) |
| Générateur | + `uv run --directory api python ../tools/export_pack_fixture.py` (paquets des tests du jeu) |
| Jeu | `godot --headless --path game --import` si assets ou `class_name` ajoutés, puis `GODOT=<godot> bash tools/gut.sh` (GUT sans `-d`, échoue aussi si un fichier de test n'a pas tourné) |
| Espace parent | `npm --prefix admin run build` ; toute fonction modifiée est décrite dans `admin/src/Guide.tsx` |
| Réseau, interface, polices, espace parent | `powershell -File tools/e2e_web.ps1` (`-SkipExport` si le jeu n'a pas changé) ; regarder les captures dans `%TEMP%\aldoria-e2e` |

`godot` = `D:\developpement\tools\godot\4.7.2\Godot_v4.7.2-stable_win64_console.exe`. Docker Desktop doit tourner
pour l'e2e (conteneur `aldoria-pg`). `godot --check-only` échoue avec les autoloads : ce n'est pas une erreur.
Un fichier de test GUT ignoré (« cannot infer the type ») ou une erreur GUT hors assertion fait échouer `tools/gut.sh`
(et la CI).

## 2. Migration de base (Alembic) : sauvegarde automatique

L'image API applique `alembic upgrade head` au démarrage. La CI (étape « Déploiement sur le VPS ») sauvegarde la base
**avant** la mise en ligne dès qu'un fichier de `api/alembic/versions` a changé depuis le commit en service (ou si ce
commit est inconnu) : `/docker/aldoria/backups/avant-deploiement-<commit>-<date>.sql.gz`, dump vérifié complet (sinon
le déploiement s'arrête), 10 gardés. Le résumé de la CI donne le nom du fichier. Sauvegarde manuelle (avant une
opération à la main sur la base) :

```bash
ssh -i ~/.ssh/aldoria_deploy root@72.60.188.128 'cd /docker/aldoria && \
  docker compose exec -T db sh -c "pg_dump -U \$POSTGRES_USER \$POSTGRES_DB" | gzip > backups/avant-<migration>-$(date -u +%Y%m%dT%H%M%SZ).sql.gz && \
  chmod 600 backups/avant-*.sql.gz && ls -l backups/avant-*.sql.gz | tail -1'
```

Vérifier que le fichier n'est pas vide. Restauration : `docs/exploitation.md`.

## 3. Commit et push

- Message en français : titre court, puis ce qui change pour les enfants ou les parents ; terminer par la ligne
  d'attribution demandée par le système.
- `git add` des fichiers concernés seulement (jamais `.env`, clés, captures).
- `git push`, puis suivre : `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId') --exit-status`.
- Échec : `gh run view --log-failed`, corriger, nouveau commit (pas de `--amend` sur un commit poussé).

## 4. Contrôle en production

- Automatique : la dernière étape de la CI attend que `/api/v1/health` donne `"version": <commit>` et
  `/version.txt` le même commit (5 minutes au plus) ; sinon la CI échoue. Migration appliquée : champ `migration`.
- À la main : `curl --ssl-no-revoke -s https://aldoria.bandtrack.fr/api/v1/health`.
- Erreurs du jeu sur les appareils : espace parent, Exploitation → Erreurs du jeu (version = 7 premiers caractères du commit).
- Contenu : `ssh -i ~/.ssh/aldoria_deploy root@72.60.188.128 'cd /docker/aldoria && docker compose exec -T api python -c "…"'`
  (ex. compter `REGISTRY` d'un préfixe, lister les chapitres en base). Lecture seule.

## Interdits

- Ne jamais afficher, copier ni écrire `ALDORIA_ADMIN_KEY`, le mot de passe Postgres ou le contenu de `.env`.
- Ne jamais utiliser les codes PIN de production (tests : profils locaux du banc, voir `tools/e2e_web.ps1`).
- Ne pas toucher la configuration TinyAuth partagée du VPS ; aucune donnée d'enfant hors du serveur.
- Pas de `--no-verify`, pas de force push.

## Compte rendu à Eric

Ce qui est en ligne, les tests passés (nombres), ce qui a été vérifié en production, et ce qui ne l'a pas été.
