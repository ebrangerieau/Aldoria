class_name SphinxIsland
extends RefCounted
## Île du Sphinx (jeux de logique, sans questions de leçon) : passages pour la barque et paliers
## des énigmes de blocs. Une activité où l'enfant répond à au moins `PASS_ANSWERS` questions
## (donjon, défi du jour, village, Lice) rapporte un passage (`Session.end`), `MAX_PASSES` au plus
## en réserve ; une traversée en coûte un et propose `VISIT_PUZZLES` énigmes. Trois énigmes
## résolues sans l'aide du Sphinx font monter d'un palier (SphinxLevels.TIERS). État dans la
## partie : `SaveManager.sphinx()`.

const SCENE := "res://scenes/sphinx/sphinx.tscn"
const PASS_ANSWERS := 6
const MAX_PASSES := 3
const VISIT_PUZZLES := 3
const TIER_UP := 3
const TITLE := "L'Île du Sphinx"
## Seuil sur la carte (Maître Ysaline présente l'île).
const THRESHOLD := "Au large, sur une île de sable, un vieux Sphinx garde un temple plein d'énigmes de pierre. Là-bas, pas de leçon à réviser : il faut réfléchir, essayer, se tromper et recommencer. La barque t'y conduit si tu as un passage."
const HOW_TO_EARN := "Un passage par activité où tu réponds à au moins %d questions : donjon, défi du jour, village ou Lice." % PASS_ANSWERS


## Palier de départ : la seconde commence un cran plus haut que la 6e.
static func start_tier(level: String) -> int:
	return 1 if level in ["6e", "5e"] else 2


static func tier_count() -> int:
	return SphinxLevels.TIERS.size()


## Niveau `index` du palier `tier` (1 à tier_count) ; l'indice tourne quand le palier est épuisé.
static func level(tier: int, index: int) -> Dictionary:
	var levels: Array = SphinxLevels.TIERS[clampi(tier, 1, tier_count()) - 1]
	return levels[posmod(index, levels.size())]


static func passes_text(passes: int) -> String:
	if passes <= 0:
		return "Aucun passage"
	return "%d passage%s" % [passes, "s" if passes > 1 else ""]
