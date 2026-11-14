---
name: verifier
description: Vérifier une modification de la v2 d'Aldoria avant de la pousser (tests de l'API, du client, types, build, parcours dans le navigateur sous la CSP, captures) et savoir lire un échec. À utiliser avant chaque commit qui touche v2/.
---

# Vérifier une modification de la v2

Dans l'ordre, depuis la racine du dépôt :

1. `npm --prefix v2/client run typecheck` puis `npm --prefix v2/client test` (Vitest, dont les 81 vecteurs de réponses
   partagés avec l'API).
2. Si l'API, `content/` ou les générateurs ont changé : `uv run --directory v2/api ruff check .` puis
   `uv run --directory v2/api pytest -q`. Une migration nouvelle : jamais destructrice pour la v1 tant qu'elle est en service.
3. `npm --prefix v2/client run build`, `npm --prefix v2/client run preview` en arrière-plan, puis
   `npm --prefix v2/client run e2e`. Le parcours échoue sur toute erreur de la page, toute violation de la CSP et tout 404 :
   lire le message (une violation nomme la directive), corriger la cause, jamais la CSP.
   Hors du poste, si le Chromium de `playwright-core` n'est pas installé : `CHROMIUM_PATH=/chemin/vers/chromium`.
   Si le moteur, le rendu ou `vite.config.ts` ont changé : aussi `npm --prefix v2/client run e2e:webgpu` (WebGPU et repli sur
   WebGL 2). Il dit « WebGPU INDISPONIBLE » et ignore sa partie WebGPU si le navigateur n'a pas d'adaptateur : ce vert ne prouve
   rien en WebGPU, le dire dans le compte rendu.
4. Si le monde ou l'interface ont changé : skill `captures`.
5. Espace parent modifié : `npm --prefix v2/admin run build`, et le guide (`v2/admin/src/Guide.tsx`) à jour.
6. Mettre à jour `v2/IMPLEMENTATION_PLAN.md` (fait / reste), `v2/docs/perf-log.md` si les chiffres de rendu ont bougé, et
   `v2/docs/decisions.md` si un choix a été fait.

La CI (`.github/workflows/v2.yml`) rejoue 1 à 3 sur chaque push qui touche `v2/`. Elle ne publie rien pour l'instant
(étape 0.6 du plan).
