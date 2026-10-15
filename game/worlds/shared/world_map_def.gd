class_name WorldMapDef
extends RefCounted
## Carte du royaume d'Aldoria (docs/histoire.md, §5 et §6) : une île en tuiles hexagonales
## (pack KayKit Medieval Hexagon), la Citadelle des Archives au centre, une région par matière
## autour. Les donjons d'une matière occupent, dans l'ordre, les emplacements de sa région ; une
## région sans donjon pour la classe de l'enfant reste dans le brouillard.
##
## Grille : hexagones à pointe vers le haut, lignes impaires décalées d'une demi-tuile vers l'est.
## Colonne q (0 à 12) vers l'est, ligne r (0 à 10) vers le sud.

const PIECES := "res://assets/kaykit/hexagon/%s.gltf"
const TILE_W := 2.0
const ROW_H := 1.732  # 3/4 de la hauteur d'une tuile (2,31 m)

## ~ eau · . herbe · M montagne · H collines boisées · h collines · T forêt
const GRID := [
	"~~~~~~~~~~~~~",
	"~~~..H..MMMM~",
	"~~...h.MMM.M~",
	"~~.....hM.MM~",
	"~~......M...~",
	"~~..........~",
	"~~.....h..h.~",
	"~~.........H~",
	"~~.TT...T.T.~",
	"~~~TTT.TT..~~",
	"~~~~~~~~~~~~~",
]

const CITADEL := Vector2i(6, 5)
const VILLAGE := Vector2i(4, 7)

## Régions : matière → titre, emplacements des donjons (dans l'ordre d'ouverture), cellule du
## nom, texte du brouillard (région pas encore au programme de l'enfant).
const REGIONS := {
	"maths": {
		"title": "Les Cimes Fractales",
		"slots": [Vector2i(8, 4), Vector2i(9, 2), Vector2i(10, 1)],
		"label": Vector2i(10, 3),
		"fog": "Les Cimes Fractales dorment sous le brouillard. Leurs pages t'attendront quand ta classe y montera.",
	},
	"anglais": {
		"title": "La Bibliothèque des Langues",
		"slots": [Vector2i(2, 5), Vector2i(2, 3), Vector2i(3, 2)],
		"label": Vector2i(3, 4),
		"fog": "Au bord de la mer, la Bibliothèque des Langues est encore noyée de brume. Ses portes s'ouvriront quand l'anglais entrera dans ta quête.",
	},
	"francais": {
		"title": "Le Bois des Mots",
		"slots": [Vector2i(6, 8), Vector2i(8, 8), Vector2i(7, 9)],
		"label": Vector2i(5, 9),
		"fog": "Le Bois des Mots est perdu dans le brouillard. On raconte que les arbres y murmurent des histoires. Un jour, un Archiviste y entrera.",
	},
	"histoire_geo": {
		"title": "Les Portes du Temps",
		"slots": [Vector2i(10, 6), Vector2i(10, 8), Vector2i(11, 5)],
		"label": Vector2i(11, 7),
		"fog": "Dans ce cercle de pierres, chaque porte ouvre sur une autre époque ou un autre lieu du monde. Dame Sablière y a tout mélangé. Ces portes s'ouvriront quand l'histoire-géographie entrera dans ta quête.",
	},
}

## Lieux fermés pour l'instant, visibles pour donner envie (docs/histoire.md §6 et §8).
const SECRETS := {
	"tour_oubli": {
		"title": "La Tour de l'Oubli",
		"cell": Vector2i(5, 1),
		"piece": "building_tower_B_red",
		"text": "Là-bas se dresse la Tour de l'Oubli, le repaire de Malvrek, l'Archiviste déchu. Elle ne s'ouvrira que lorsque tu auras repris assez de pages et vraiment appris ce qu'elles contiennent.",
	},
}

const CITADEL_TEXT := "Voici la Citadelle des Archives, le cœur du royaume. Tu y retrouves la Grande Chronique, ta salle d'armes, la Lice pour t'entraîner et la Pierre du Jour, ton défi quotidien."
## Accueil sur la carte, juste après le prologue (qui raconte le vol des pages).
const WELCOME := "Voici la carte du royaume. Touche un lieu : je te dirai ce qui t'y attend, et tu choisiras d'y aller ou non. La Citadelle, au centre, garde ta salle d'armes, la Lice et la Pierre du Jour."


## Centre d'une tuile, au niveau du sol (le dessus des tuiles d'herbe est à y = 0).
static func cell_position(cell: Vector2i) -> Vector3:
	return Vector3(cell.x * TILE_W + (TILE_W / 2.0 if cell.y % 2 == 1 else 0.0), 0.0, cell.y * ROW_H)


static func terrain(cell: Vector2i) -> String:
	if cell.y < 0 or cell.y >= GRID.size() or cell.x < 0 or cell.x >= (GRID[cell.y] as String).length():
		return "~"
	return (GRID[cell.y] as String)[cell.x]


## Taille de la carte en mètres (pour cadrer la caméra).
static func size() -> Vector2:
	return Vector2((GRID[0] as String).length() * TILE_W + TILE_W / 2.0, GRID.size() * ROW_H)
