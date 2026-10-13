class_name Inventory
extends RefCounted
## Objets du sac (souhait des enfants : des récompenses utiles à certains moments).
## Aucun ne fait sauter une question : ils aident à répondre ou à encaisser.
## - plume, parchemin : dans une question (QuestionPanel), sauf au défi du jour ;
## - bouclier, potion : en combat, par le bouton « Sac » (Encounter), sans perdre son tour.
## Gagnés : coffre d'un donjon (2), énigme résolue (1), coffre de la semaine (2), quête du
## village (1), toutes les 3 vagues de l'arène (1). Rangés dans la partie (SaveManager).

const MAX := 5  # par objet : on les utilise plutôt que de les entasser

const ITEMS := {
	"plume": {"name": "Plume du sage", "short": "Plume", "help": "Retire deux mauvaises propositions d'un QCM."},
	"parchemin": {"name": "Parchemin d'indice", "short": "Parchemin", "help": "Un indice gratuit, sans perdre de puissance."},
	"bouclier": {"name": "Bouclier", "short": "Bouclier", "help": "Le prochain coup de l'ennemi ne te touche pas."},
	"potion": {"name": "Potion d'urgence", "short": "Potion", "help": "Rend toute ta vie, sans question."},
}
const ORDER := ["plume", "parchemin", "bouclier", "potion"]


## `count` objets tirés au hasard, plutôt ceux que l'on a peu ; jamais au-delà de MAX.
static func draw(owned: Dictionary, count: int) -> Array[String]:
	var held := owned.duplicate()
	var out: Array[String] = []
	for _i in count:
		var weights: Array[float] = []
		for id in ORDER:
			weights.append(float(maxi(0, MAX - int(held.get(id, 0)))))
		var total := 0.0
		for w in weights:
			total += w
		if total <= 0.0:
			break
		var roll := randf() * total
		for k in ORDER.size():
			roll -= weights[k]
			if roll < 0.0:
				out.append(ORDER[k])
				held[ORDER[k]] = int(held.get(ORDER[k], 0)) + 1
				break
	return out


## « Plume du sage, Bouclier ×2 » (annonce d'un gain).
static func describe(ids: Array) -> String:
	var counts := {}
	for id in ids:
		counts[id] = int(counts.get(id, 0)) + 1
	var parts: Array[String] = []
	for id in ORDER:
		if counts.has(id):
			parts.append(ITEMS[id]["name"] + (" ×%d" % counts[id] if counts[id] > 1 else ""))
	return ", ".join(parts)


## Phrase d'annonce, vide si rien n'a été gagné (sac plein).
static func found_text(ids: Array) -> String:
	return "" if ids.is_empty() else "Dans ton sac : %s." % describe(ids)


## Contenu du sac pour le camp : « Plume ×2 · Bouclier ×1 », ou un sac vide.
static func summary(owned: Dictionary) -> String:
	var parts: Array[String] = []
	for id in ORDER:
		var n := int(owned.get(id, 0))
		if n > 0:
			parts.append("%s ×%d" % [ITEMS[id]["short"], n])
	return "Sac : " + (" · ".join(parts) if not parts.is_empty() else "vide pour l'instant")
