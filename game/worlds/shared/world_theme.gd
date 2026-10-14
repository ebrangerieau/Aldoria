class_name WorldTheme
extends RefCounted
## Ambiance d'un monde (PRD §3 et §9) : même moteur, deux tons, choisis par le parent
## pour chaque enfant (indépendants de la classe, api/app/engine/levels.py).
## « lumineux » : chaleureux, encourageant, renard compagnon. « brouillard » : sombre, épuré.

var id := ""
var title := ""
# Personnages (KayKit, voir game/assets/LICENSES.md) ; l'apparence du héros est choisie
# par l'enfant (Wardrobe), le compagnon animal n'existe que dans le monde de Jules (PRD §3).
var hero_name := ""
var companion := false
var enemy_models: Array[String] = []
var enemy_names: Array[String] = []
# Actions de combat
var action_names := {"automatisme": "", "chapitre": "", "soin": ""}
# Couleurs d'interface
var bg := Color()
var panel := Color()
var panel_border := Color()
var text := Color()
var text_dim := Color()
var accent := Color()
var good := Color()
var bad := Color()
var formula := Color()
# Scène 3D
var background := Color()
var ambient := Color()
var ambient_energy := 0.6
var sun_color := Color()
var sun_energy := 1.0
var torch_color := Color()
# Textes
var retreat_text := ""
var victory_texts: Array[String] = []
var encouragements: Array[String] = []
var wrong_title := ""


static func for_world(world: String) -> WorldTheme:
	var t := brouillard() if world == "brouillard" else lumineux()
	# Prénom de l'enfant connecté (toute famille), titre propre à chaque monde.
	var player := str(Session.profile.get("name", ""))
	if player != "":
		t.hero_name = ("%s, Archiviste" if world == "brouillard" else "%s, apprenti Archiviste") % player
	if Accessibility.on("colorblind"):
		# Juste / faux distinguables sans le rouge et le vert (daltonisme le plus fréquent).
		t.good = Color("#3d8bfd")
		t.bad = Color("#f08c00")
	return t


static func lumineux() -> WorldTheme:
	var t := WorldTheme.new()
	t.id = "lumineux"
	t.title = "Les Chroniques d'Aldoria"
	t.companion = true
	t.hero_name = "Apprenti Archiviste"
	t.enemy_models = ["Mushnub", "Skeleton_Minion", "GreenBlob", "Goleling", "Cactoro", "Skeleton_Mage"]
	t.enemy_names = ["Champignon égaré", "Squelette grognon", "Gelée sautillante", "Petit golem", "Cactus piquant", "Gardien des os"]
	t.action_names = {"automatisme": "Coup d'épée", "chapitre": "Sort d'étoiles", "soin": "Potion"}
	t.bg = Color("#2b1d3a")
	t.panel = Color("#f6e7c4")  # parchemin (assets/ui, tools/make_ui_textures.py)
	t.panel_border = Color("#e0ad4a")
	t.text = Color("#3b2414")
	t.text_dim = Color("#7a5a3a")
	t.accent = Color("#b0461b")  # rouge d'enluminure
	t.good = Color("#3aa655")
	t.bad = Color("#d9534f")
	t.formula = Color("#3b2a1a")
	t.background = Color("#2a2140")
	t.ambient = Color("#a294c4")
	t.ambient_energy = 0.7
	t.sun_color = Color("#ffe2b0")
	t.sun_energy = 1.15
	t.torch_color = Color(1.0, 0.68, 0.32)
	t.retreat_text = "Ouf ! Tu reprends ton souffle près du feu de camp. Tes forces reviennent, rien n'est perdu."
	t.victory_texts = ["Victoire !", "Bien joué !", "Bravo, Archiviste !", "Quelle puissance !"]
	t.encouragements = ["Super !", "Excellent !", "Tu gères !", "Magnifique !", "Trop fort !"]
	t.wrong_title = "Presque ! Regarde comment faire :"
	return t


static func brouillard() -> WorldTheme:
	var t := WorldTheme.new()
	t.id = "brouillard"
	t.title = "Les Chroniques d'Aldoria"
	t.hero_name = "Archiviste"
	t.enemy_models = ["Skeleton_Warrior", "GhostSkull", "Orc", "Skeleton_Rogue", "BlueDemon", "Skeleton_Mage"]
	t.enemy_names = ["Sentinelle du Brouillard", "Spectre du Brouillard", "Orc des brumes", "Spectre d'os", "Démon bleu", "Héraut du Brouillard"]
	t.action_names = {"automatisme": "Frappe", "chapitre": "Arcane", "soin": "Régénération"}
	t.bg = Color("#0d1117")
	t.panel = Color("#262e3a")  # pierre sombre (assets/ui)
	t.panel_border = Color("#8fa3b8")
	t.text = Color("#e6edf3")
	t.text_dim = Color("#9aa7b4")
	t.accent = Color("#7fb2ff")
	t.good = Color("#3fb950")
	t.bad = Color("#f85149")
	t.formula = Color("#e6edf3")
	t.background = Color("#06080d")
	t.ambient = Color("#5a6a8a")
	t.ambient_energy = 0.55
	t.sun_color = Color("#a9c4ff")
	t.sun_energy = 0.75
	t.torch_color = Color(0.55, 0.75, 1.0)
	t.retreat_text = "Le Brouillard t'a repoussé. Tu te replies et récupères. Aucune progression perdue."
	t.victory_texts = ["Ennemi dissipé.", "Propre.", "Brouillard repoussé.", "Archive restaurée."]
	t.encouragements = ["Exact.", "Net.", "Impeccable.", "Rapide et juste.", "Bien vu."]
	t.wrong_title = "Pas cette fois. La méthode :"
	return t
