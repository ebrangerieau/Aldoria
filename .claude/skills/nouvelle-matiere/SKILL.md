---
name: nouvelle-matiere
description: Ajouter une matière (ou compléter une matière vide) pour une classe d'Aldoria — programme officiel vérifié, seed, générateurs, lecture à voix haute, région de la carte, donjons, tests et documentation. À utiliser quand Eric demande « l'anglais de Tom », « les sciences de Jules », etc.
---

# Ajouter une matière à une classe

Modèles à relire avant d'écrire : le français de seconde (commit `662dadf`) et l'histoire-géographie de 6e
(commit `c4cbe59`) — `git show --stat <sha>` liste tous les fichiers à toucher.

## 1. Programme officiel (avant tout code)

- Chercher le programme **en vigueur cette année scolaire pour cette classe** (WebSearch : BO, Eduscol, sites
  académiques). Piège : un nouveau programme publié ne s'applique souvent qu'à la rentrée suivante (histoire-géo
  6e : BO n° 22 du 28 mai 2026, applicable en 6e en 2027).
- Points incertains (sources contradictoires) : les signaler à Eric, notion marquée `a_valider` dans le seed.
- Proposer à Eric le découpage chapitres / notions avant d'écrire les générateurs s'il y a un doute.

## 2. Seed `content/seed/<classe>/<matiere>.json`

- Format : `{"level", "subject": {"code", "label"}, "source", "chapters": [{"code", "title", "notions": [{"code", "label"}]}]}`.
- Codes stables `<classe>.<matiere>.<chapitre>.<notion>` ; `source` cite le texte officiel et sa date d'application.
- Chargé en production par `python -m app.cli seed` (lancé par l'image API à chaque démarrage, idempotent).
- Jamais de liste de classes ou de matières en dur ailleurs (`engine/levels.py` lit les seeds).

## 3. Générateurs `api/app/engine/generators/<matiere>_<classe>.py`

- Matière « à exemples » : `faits.py` (`Fact(level, prompt, answer, explanation, wrong=(), accepted=())`,
  `Notion(code, title, hint, facts, pool=(), writable=False)`, `register_notions(level, subject, notions)`).
  Niveaux 1 à 3 par exemple, intrus propres ou tirés du vocabulaire de la notion (`pool`), terme à écrire à la
  difficulté 5 si `writable` (seulement si la réponse s'écrit sans ambiguïté).
- Ce qui se calcule (siècles, ordres, conversions…) : un générateur dédié, des questions illimitées et justes.
- Une énigme par donjon : un générateur au format `drag_order` ou visuel (voir `6e.histoire_geo.frise`).
- Rédaction : énoncés courts, une idée par phrase ; un trou s'écrit « … » ; citations d'auteurs du domaine public,
  exactes et sourcées, sinon un exemple écrit pour le jeu (jamais d'auteur sous droits, même « à la manière de »).
- Langues vivantes : texte étranger entre “ ”, mots français cités entre « » (`speech.prompt_parts`).
- Importer le module dans `generators/__init__.py` (liste alphabétique).
- `engine/ai_author.py` : une entrée `ADVICE["<matiere>"]` (formats conseillés à l'IA).
- Fenêtre `focus_chapters` (`routers/play.py`, `max_length`) : vérifier qu'elle couvre le plus gros donjon.

## 4. Lecture à voix haute `api/app/engine/speech.py`

- Tout symbole, abréviation ou notation nouvelle (chiffres romains, « av. J.-C. », unités, formules) est traduit en
  mots. `tests/test_accessibility.py` passe sur toutes les questions générées : y ajouter les cas nouveaux.

## 5. Tests API `api/tests/test_<matiere>.py`

- Couverture : chaque notion du seed a un générateur (`REGISTRY[code].notion`).
- Unicité de la bonne réponse, intrus distincts, réponse écrite acceptée sans article, texte lu sans symbole.
- Générateurs calculés : cas pièges explicites (`pytest.mark.parametrize`).
- `tests/test_dungeon.py` : nombre de donjons (`assert len(dungeons) == N`).

## 6. Jeu : région et donjons

- `game/worlds/shared/world_map_def.gd` : entrée `REGIONS["<matiere>"]` (`title`, `slots` dans l'ordre des
  donjons, `label`, `fog`) ; retirer le lieu de `SECRETS` s'il y était. Cases libres : vérifier sur une capture
  `--places=1` (skill `captures`).
- Donjons : suivre le skill `nouveau-donjon` (au moins un par région ; deux s'il y a deux grands blocs).
- `docs/histoire.md` : région, Effaceur(s), ton ; noms **provisoires** à relire avec les enfants.

## 7. Tests du jeu à mettre à jour (échouent sinon)

- `tests/integration/test_world_map.gd` : statut des nouveaux lieux, total « Pages de la Chronique : x / N ».
- `tests/integration/test_daily_flow.gd` : « Pages retrouvées : x / N ».
- `tests/unit/test_daily_challenge.gd` : liste `DungeonDef.subjects(...)`.
- `tests/integration/test_question_flow.gd` : seuils qui comptent des questions d'une matière dans un paquet partagé.
- Paquets de test : `uv run --directory api python ../tools/export_pack_fixture.py`.

## 8. Documentation

- `IMPLEMENTATION_PLAN.md` : entrée datée (✅) avec programme, générateurs, région, ce qui reste à faire.
- `CLAUDE.md` : seulement une règle nouvelle et durable (ex. écriture des dates en histoire-géo).
- `admin/src/Guide.tsx` : liste des régions par matière.

## 9. Livrer

Skill `livrer`. Vérifier en production : chapitres en base, nombre de générateurs de la matière.

## Compte rendu à Eric (en français)

Programme retenu et sources (liens), notions et générateurs, région et donjons (énigmes, boss), tests, points à
relire avec l'enfant (noms, exemples, correspondance avec la classe), échéance d'un futur programme. Proposer la
suite de l'alternance Jules / Tom sans la commencer.
