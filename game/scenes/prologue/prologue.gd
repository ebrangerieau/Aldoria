class_name Prologue
extends Node3D
## Prologue de l'histoire (docs/histoire.md §8) : la nuit où Malvrek a arraché les pages de la
## Grande Chronique, et Maître Ysaline qui confie la quête au héros. Cinq tableaux joués comme une
## petite cinématique dans une salle de la Citadelle (pièces KayKit, personnages et renard du jeu) :
## la caméra glisse, les personnages entrent, agissent et sortent (`_act`), une voix raconte
## (`Accessibility.say` : voix du serveur, sinon celle de l'appareil).
## Le texte reste caché pour laisser voir la scène ; le bouton « Texte » l'affiche (d'office quand
## aucune voix ne peut raconter). Texte caché, le tableau suivant vient seul quand la voix a fini ;
## texte affiché, on avance avec « Suivant » (le temps de lire).
## Vu une fois au premier passage sur la carte (`SaveManager.story_seen(STORY_KEY)`) ; se revoit
## depuis la Citadelle. Revient ensuite à la scène d'où l'on vient (`return_to`).

const SCENE := "res://scenes/prologue/prologue.tscn"
const STORY_KEY := "prologue"
const BOOK := CitadelHall.BOOK
const FADE := 0.45
const PAUSE_AFTER_VOICE := 1.4  # silence après la voix avant le tableau suivant
const MIN_SECONDS := 7.0  # un tableau dure au moins le temps de son action
const READING_SPEED := 14.0  # caractères par seconde : durée d'un tableau quand aucune voix ne s'entend

## Scène où revenir à la fin (la carte au premier passage, la Citadelle quand on le revoit).
static var return_to := "res://scenes/world_map/world_map.tscn"
## Texte affiché ou non (choix de l'enfant, gardé jusqu'à la fermeture du jeu) ; null : selon la voix.
static var text_choice: Variant = null

## Tableaux : décor (`shot`), qui parle, titre et texte par monde (Jules : chaleureux et drôle ;
## Tom : sobre). Phrases courtes, une idée par phrase (règle « dys »).
const PAGES := [
	{"shot": "chronique", "speaker": "", "title": "La Grande Chronique",
		"lumineux": "Au cœur du royaume d'Aldoria se dresse la Citadelle des Archives. Elle garde un livre immense : la Grande Chronique. Chaque page garde un savoir : les nombres, les mots, les langues. Grâce à elle, tout le monde sait compter, lire et parler.",
		"brouillard": "Le royaume d'Aldoria tient grâce à un livre : la Grande Chronique. Il repose au cœur de la Citadelle des Archives. Chaque page garde un savoir : les nombres, les mots, les langues. Tant qu'il est entier, personne n'oublie."},
	{"shot": "vol", "speaker": "", "title": "La nuit du vol",
		"lumineux": "Mais une nuit, quelqu'un est entré sans bruit. C'était Malvrek, un ancien Archiviste. Il a arraché les pages de la Chronique, une par une. Puis il les a confiées à ses Effaceurs, qui les ont cachées dans tout le royaume.",
		"brouillard": "Une nuit, Malvrek est revenu. Autrefois, il était Archiviste lui aussi. Il a arraché les pages de la Chronique. Ses Effaceurs les ont emportées aux quatre coins du royaume."},
	{"shot": "oubli", "speaker": "", "title": "Le royaume oublie",
		"lumineux": "Depuis, partout où une page manque, les habitants oublient. Le boulanger ne sait plus compter ses pains. Les livres se vident. Un brouillard gris recouvre les régions : le Brouillard de l'Oubli.",
		"brouillard": "Depuis, là où une page manque, le savoir s'efface. Les calculs se brouillent. Les livres se vident. Le Brouillard de l'Oubli gagne les régions, une à une."},
	{"shot": "ysaline", "speaker": "Maître Ysaline", "title": "Maître Ysaline",
		"lumineux": "Te voilà enfin ! Je suis Maître Ysaline, la gardienne de la Chronique. Je suis la seule à n'avoir rien oublié. Tu es le plus jeune des Archivistes. Tu te trompes parfois ? Tant mieux : c'est comme ça qu'on apprend. Malvrek, lui, n'a jamais accepté de se tromper.",
		"brouillard": "Je suis Maître Ysaline, la gardienne de la Chronique. Je n'ai rien oublié, mais je ne peux pas tout reprendre seule. Tu es le plus jeune des Archivistes. Tu te tromperas : c'est comme ça qu'on apprend. Malvrek n'a jamais accepté l'erreur. C'est ce qui l'a perdu."},
	{"shot": "quete", "speaker": "Maître Ysaline", "title": "Ta quête",
		"lumineux": "Va retrouver les pages, une à une. Chaque Effaceur vaincu t'en rendra une. Avant chaque chemin, je te dirai ce qui t'attend. Je t'attends ici, à la Citadelle, au centre de la carte. En route, jeune Archiviste !",
		"brouillard": "Retrouve les pages, une à une. Chaque Effaceur vaincu t'en rendra une. Avant chaque chemin, je te dirai ce qui t'attend. La Citadelle sera ton point de départ, au centre de la carte. La Chronique compte sur toi."},
]

## Caméra de chaque tableau : [départ, arrivée], chacun [position, point regardé]. Elle glisse
## de l'un à l'autre pendant le tableau (`_frame`).
const SHOTS := {
	"chronique": [[Vector3(8, 6.5, 15.5), Vector3(8, 1.6, 4.0)], [Vector3(8.6, 3.0, 10.4), Vector3(8.6, 1.4, 4.6)]],
	"vol": [[Vector3(10.8, 3.4, 12.6), Vector3(10.4, 1.0, 5.4)], [Vector3(8.0, 2.8, 10.6), Vector3(8.2, 1.3, 4.2)]],
	"oubli": [[Vector3(3.2, 2.6, 12.5), Vector3(6.0, 1.2, 6.5)], [Vector3(9.8, 2.4, 12.0), Vector3(6.2, 1.2, 6.5)]],
	"ysaline": [[Vector3(4.4, 2.4, 15.6), Vector3(7.4, 1.0, 8.4)], [Vector3(8.6, 2.3, 12.8), Vector3(8.0, 1.1, 6.9)]],
	"quete": [[Vector3(7.6, 2.2, 12.6), Vector3(8.2, 1.3, 6.0)], [Vector3(7.8, 4.6, 16.0), Vector3(8.0, 1.0, 5.8)]],
}
const PAGES_BRIGHT := Color("#fff4d6")
const PAGES_DULL := Color("#b9b3a6")

var page := -1
## Texte du tableau affiché sous la scène (bouton « Texte »).
var show_text := false
var _wt: WorldTheme
var _hall: CitadelHall
var _env: Environment
var _sun: DirectionalLight3D
var _camera: Camera3D
var _pages_material: StandardMaterial3D
var _book_glow: Node3D
var _paper: CPUParticles3D  # pages arrachées qui s'envolent
var _sparkles: CPUParticles3D
var _hero: Fighter
var _pet: Companion
var _ysaline: Fighter
var _malvrek: Fighter
var _villager: Fighter
var _question: Label3D
var _ui: CanvasLayer
var _fade: ColorRect
var _caption: Label
var _counter: Label
var _subtitles: PanelContainer
var _panel_box: VBoxContainer
var _text_button: Button
var _replay: Button
var _next: Button
var _act: Tween  # action du tableau (personnages, livre, brouillard)
var _moving: Tween  # glissement de la caméra
var _done := false
var _busy := false  # changement de tableau en cours
var _time := 0.0
var _narrate := false  # une voix peut raconter
var _page_time := 0.0
var _heard := false
var _quiet := 0.0
var _moment := 60.0  # tableau montré sans animation : instant de l'action (captures : `--moment=`)


## Lance le prologue ; `back` : scène où revenir à la fin.
static func play(tree: SceneTree, back: String) -> void:
	return_to = back
	tree.change_scene_to_file(SCENE)


func _ready() -> void:
	_wt = WorldTheme.for_world(Session.world())
	_narrate = _voice_possible()
	if not OS.has_feature("web") and Quality.option("texte") != "":
		text_choice = Quality.option("texte") == "1"  # captures : texte affiché ou non
	show_text = bool(text_choice) if text_choice != null else not _narrate
	_build_set()
	_build_cast()
	_build_ui()
	var start := 0
	if not OS.has_feature("web") and Quality.option("tableau") != "":
		start = clampi(int(Quality.option("tableau")) - 1, 0, PAGES.size() - 1)  # captures d'écran
		if Quality.option("moment") != "":
			_moment = float(Quality.option("moment"))
		show_page(start, false)
		return
	if not Accessibility.on("calm"):
		_fade.color.a = 1.0  # sortie du noir sur le premier tableau
	show_page(start, true, false)


## Une voix peut-elle raconter ? (son coupé ou ni voix du serveur ni voix française sur
## l'appareil : le texte s'affiche d'office)
func _voice_possible() -> bool:
	if Accessibility.volume() < 0.05:
		return false
	return Voice.usable("fr-FR") or not DisplayServer.tts_get_voices_for_language("fr").is_empty()


func _process(delta: float) -> void:
	_time += delta
	if _question.visible:
		_question.position.y = 2.7 + 0.1 * sin(_time * 3.0)
	if _done or _busy or page < 0:
		return
	_page_time += delta
	if _narrate and Accessibility.is_speaking():
		_heard = true
		_quiet = 0.0
		return
	_quiet += delta
	if show_text or page >= PAGES.size() - 1 or _page_time < MIN_SECONDS:
		return  # texte affiché : on avance avec « Suivant » ; le dernier tableau attend « Commencer »
	var spoken := _heard and _quiet >= PAUSE_AFTER_VOICE
	var read := not _heard and _page_time >= text_of(page).length() / READING_SPEED + 2.0
	if spoken or read:
		next()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		get_viewport().set_input_as_handled()
		finish()


# --- Déroulé ------------------------------------------------------------------------------------

func text_of(i: int) -> String:
	return str(PAGES[i][_wt.id if PAGES[i].has(_wt.id) else "lumineux"])


## Montre un tableau. `animate` : fondu, action jouée et voix ; sinon (tests, captures) l'action
## est menée d'un coup à sa fin. `fade_in` : fondu au noir avant (pas au premier tableau).
func show_page(i: int, animate := true, fade_in := true) -> void:
	_busy = true
	Accessibility.stop_speaking()
	var fading := animate and not Accessibility.on("calm")
	if fading and fade_in:
		await _fade_to(1.0)
	page = i
	_page_time = 0.0
	_heard = false
	_quiet = 0.0
	for tween: Tween in [_act, _moving]:
		if tween != null and tween.is_valid():
			tween.kill()
	_camera.h_offset = 0.0
	_camera.v_offset = 0.0
	var shot: String = PAGES[i]["shot"]
	_stage(shot)
	_act = create_tween()
	_play_action(shot, _act)
	_fill_texts(i)
	var cam: Array = SHOTS[shot]
	if animate:
		_frame(0.0, cam[0], cam[1])
		_moving = create_tween()
		_moving.tween_method(_frame.bind(cam[0], cam[1]), 0.0, 1.0, maxf(MIN_SECONDS + 3.0, _voice_seconds(i))) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		_speak()
	else:
		_act.custom_step(_moment)
		if _act.is_valid():
			_act.pause()  # capture : l'action reste figée à cet instant
		var w := clampf(_moment / maxf(MIN_SECONDS + 3.0, _voice_seconds(i)), 0.0, 1.0)
		_frame(ease(w, -1.6), cam[0], cam[1])
	if fading:
		await _fade_to(0.0)
	_busy = false


func next() -> void:
	if _done or _busy:
		return
	if page + 1 >= PAGES.size():
		finish()
	else:
		_next.disabled = true
		await show_page(page + 1)
		_next.disabled = false


## Fin ou « Passer » : l'histoire est vue (rangée dans la partie), retour à la scène d'origine.
func finish() -> void:
	if _done:
		return
	_done = true
	SaveManager.mark_story(STORY_KEY)
	Accessibility.stop_speaking()
	if is_inside_tree() and return_to != "":  # vide : les tests restent sur place
		get_tree().change_scene_to_file(return_to)


## « Texte » : affiche ou cache le texte du tableau (le choix vaut pour la suite).
func toggle_text() -> void:
	show_text = not show_text
	text_choice = show_text
	_quiet = 0.0
	_update_text_button()
	_subtitles.visible = show_text


## La voix raconte le tableau ; le son du suivant se prépare pendant ce temps.
func _speak() -> void:
	if not _narrate:
		return
	_heard = false
	_quiet = 0.0
	Accessibility.say(text_of(page))
	if page + 1 < PAGES.size():
		var upcoming := text_of(page + 1)
		await get_tree().create_timer(4.0).timeout
		Voice.prefetch(upcoming)


## Durée approximative de la voix (la caméra glisse jusqu'au bout).
func _voice_seconds(i: int) -> float:
	return text_of(i).length() / READING_SPEED


func _fade_to(alpha: float) -> void:
	var tween := create_tween()
	tween.tween_property(_fade, "color:a", alpha, FADE)
	await tween.finished


## Caméra à la fraction `w` de son glissement.
func _frame(w: float, from: Array, to: Array) -> void:
	_camera.position = (from[0] as Vector3).lerp(to[0], w)
	_camera.look_at((from[1] as Vector3).lerp(to[1], w))


# --- Mise en scène ------------------------------------------------------------------------------

## Début d'un tableau : lumière, état du livre, personnages à leur place de départ.
func _stage(shot: String) -> void:
	var night := shot == "vol"
	var fog := shot == "oubli"
	_env.background_color = Color("#0b1020") if night else (Color("#5d6470") if fog else _wt.background)
	var day := Color(1.0, 0.9, 0.78) if _wt.id == "lumineux" else Color(0.78, 0.84, 1.0)  # Tom : plus froid
	_env.ambient_light_color = Color(0.35, 0.42, 0.75) if night else (Color(0.7, 0.72, 0.78) if fog else day)
	_env.ambient_light_energy = 0.45 if night else 0.7
	_env.fog_enabled = fog
	_env.fog_density = 0.0
	_sun.light_color = Color(0.55, 0.65, 1.0) if night else _wt.sun_color
	_sun.light_energy = 0.4 if night else (0.6 if fog else 1.0)
	# La Chronique brille entière jusqu'au vol, puis reste terne ; Maître Ysaline la ranime à la fin.
	var whole := shot in ["chronique", "vol"]
	_pages_material.emission_energy_multiplier = 1.6 if whole else (0.2 if shot in ["ysaline", "quete"] else 0.0)
	_pages_material.albedo_color = PAGES_BRIGHT if whole else PAGES_DULL
	_book_glow.visible = whole
	_paper.emitting = false
	_paper.visible = false
	_sparkles.emitting = shot == "chronique" and not Accessibility.on("calm")
	_sparkles.visible = _sparkles.emitting

	_ysaline.visible = shot in ["chronique", "ysaline", "quete"]
	_malvrek.visible = night
	_villager.visible = fog
	_question.visible = false
	_question.scale = Vector3.ONE
	_hero.visible = shot in ["ysaline", "quete"]
	if _pet != null:
		_pet.visible = _hero.visible
	for who: Fighter in [_ysaline, _malvrek, _villager, _hero]:
		who.idle()
	match shot:
		"chronique":
			CitadelHall.place(_ysaline, Vector3(13.0, 0, 8.6), Vector3(10.2, 0, 4.8))
		"vol":
			CitadelHall.place(_malvrek, Vector3(14.2, 0, 9.4), Vector3(9.6, 0, 3.4))
		"oubli":
			CitadelHall.place(_villager, Vector3(6.0, 0, 6.5), Vector3(6.5, 0, 13))
		"ysaline":
			CitadelHall.place(_ysaline, Vector3(9.4, 0, 6.2), BOOK)
			CitadelHall.place(_hero, Vector3(6.2, 0, 13.6), Vector3(6.6, 0, 8.2))
		"quete":
			CitadelHall.place(_ysaline, Vector3(9.6, 0, 5.4), Vector3(7, 0, 8))
			CitadelHall.place(_hero, Vector3(7, 0, 8), Vector3(9.6, 0, 5.4))
	if _pet != null and _hero.visible:
		_pet.follow(_hero)


## Action d'un tableau, enchaînée dans `t` (mise d'un coup à sa fin par `custom_step`).
func _play_action(shot: String, t: Tween) -> void:
	match shot:
		"chronique":
			# Maître Ysaline traverse la salle jusqu'à la Chronique, la touche, puis se retourne.
			t.tween_interval(0.6)
			_walk(t, _ysaline, Vector3(10.2, 0, 4.8), 3.6)
			_turn(t, _ysaline, BOOK, 0.3)
			t.tween_callback(_ysaline.play.bind(["Interact"]))
			t.tween_interval(1.6)
			_turn(t, _ysaline, Vector3(8, 0, 11), 0.6)
		"vol":
			# Malvrek entre à pas de loup, arrache les pages (le livre s'éteint), puis s'enfuit.
			t.tween_interval(0.8)
			_walk(t, _malvrek, Vector3(9.6, 0, 3.4), 4.2, ["Walking_C", "Walking_B", "Walking_A"], 0.8)
			_turn(t, _malvrek, BOOK, 0.3)
			t.tween_callback(_tear_pages)
			_shake(t)
			t.tween_property(_pages_material, "emission_energy_multiplier", 0.0, 2.4)
			t.parallel().tween_property(_pages_material, "albedo_color", PAGES_DULL, 2.4)
			t.tween_callback(_book_glow.hide)
			_turn(t, _malvrek, Vector3(4.0, 0, 15.5), 0.3)
			_walk(t, _malvrek, Vector3(4.0, 0, 15.5), 2.4, ["Running_A", "Running_B"])
			t.tween_callback(_malvrek.hide)
		"oubli":
			# Le Brouillard monte ; le boulanger regarde partout, perdu.
			t.tween_property(_env, "fog_density", 0.05, 3.0)
			_turn(t, _villager, Vector3(2, 0, 8), 0.6)
			t.tween_interval(0.8)
			_turn(t, _villager, Vector3(11, 0, 8), 0.8)
			t.tween_interval(0.6)
			_turn(t, _villager, Vector3(6.5, 0, 13), 0.5)
			t.tween_callback(_question.show)
			t.tween_property(_question, "scale", Vector3.ONE, 0.5).from(Vector3.ZERO) \
				.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			t.tween_callback(_villager.play.bind(["Interact"]))
		"ysaline":
			# Le héros (et son renard) arrive ; Maître Ysaline se retourne et l'accueille.
			t.tween_interval(0.5)
			_walk(t, _hero, Vector3(6.6, 0, 8.2), 3.2)
			_turn(t, _hero, Vector3(9.4, 0, 6.2), 0.3)
			_turn(t, _ysaline, Vector3(6.6, 0, 8.2), 0.7)
			t.tween_callback(_ysaline.play.bind(["Interact"]))
		"quete":
			# Maître Ysaline ranime un peu la Chronique ; le héros, prêt, se tourne vers la sortie.
			t.tween_interval(0.8)
			t.tween_callback(_rekindle)
			t.tween_property(_pages_material, "emission_energy_multiplier", 0.9, 1.6)
			t.parallel().tween_property(_pages_material, "albedo_color", PAGES_BRIGHT, 1.6)
			_turn(t, _hero, Vector3(7, 0, 14), 0.5)
			t.tween_callback(_cheer)
			t.tween_interval(2.6)
			_walk(t, _hero, Vector3(7.1, 0, 9.8), 1.6)


## Marche (ou course) jusqu'à `to`, puis repos.
func _walk(t: Tween, who: Fighter, to: Vector3, seconds: float, gait: Array = ["Walking_A"], speed := 1.0) -> void:
	t.tween_callback(_set_off.bind(who, to, gait, speed))
	t.tween_property(who, "position", to, seconds)
	t.tween_callback(who.idle)


func _set_off(who: Fighter, to: Vector3, gait: Array, speed: float) -> void:
	CitadelHall.place(who, who.position, to)
	who.loop_any(gait, speed)


## Se tourne vers un point (par le plus court).
func _turn(t: Tween, who: Node3D, towards: Vector3, seconds: float) -> void:
	var angles := {"from": 0.0, "to": 0.0}
	t.tween_callback(_aim.bind(who, towards, angles))
	t.tween_method(_rotate.bind(who, angles), 0.0, 1.0, seconds)


func _aim(who: Node3D, towards: Vector3, angles: Dictionary) -> void:
	var d := towards - who.position
	angles["from"] = who.rotation.y
	angles["to"] = who.rotation.y + wrapf(atan2(d.x, d.z) - who.rotation.y, -PI, PI)


func _rotate(w: float, who: Node3D, angles: Dictionary) -> void:
	who.rotation.y = lerpf(angles["from"], angles["to"], w)


## Malvrek lance son sort : les pages s'envolent.
func _tear_pages() -> void:
	_malvrek.loop_any(["Spellcasting", "Spellcast_Long", "Spellcast_Raise"])
	_paper.visible = true
	_paper.emitting = true


func _rekindle() -> void:
	_ysaline.play(["Spellcast_Raise"])
	_book_glow.visible = true
	_sparkles.emitting = not Accessibility.on("calm")
	_sparkles.visible = _sparkles.emitting


func _cheer() -> void:
	_hero.play(["Cheer"])
	if _pet != null:
		_pet.celebrate()


## Secousse de la caméra (pas en mode calme).
func _shake(t: Tween) -> void:
	if Accessibility.on("calm"):
		return
	for k in 6:
		t.tween_property(_camera, "h_offset", randf_range(-0.08, 0.08), 0.05)
		t.parallel().tween_property(_camera, "v_offset", randf_range(-0.06, 0.06), 0.05)
	t.tween_property(_camera, "h_offset", 0.0, 0.05)
	t.parallel().tween_property(_camera, "v_offset", 0.0, 0.05)


# --- Décor -------------------------------------------------------------------------------------

## Salle de la Citadelle (CitadelHall) et caméra des tableaux.
func _build_set() -> void:
	_hall = CitadelHall.new()
	add_child(_hall)
	_hall.build()
	_env = _hall.env
	_sun = _hall.sun
	_pages_material = _hall.pages_material
	_book_glow = _hall.book_glow
	_paper = _hall.paper
	_sparkles = _hall.sparkles
	_camera = Camera3D.new()
	_camera.fov = 45.0
	add_child(_camera)
	_camera.make_current()


# --- Personnages --------------------------------------------------------------------------------

## Le héros (son apparence), son renard dans le monde de Jules, Maître Ysaline (mage à la cape
## dorée, bâton), Malvrek (rôdeur encapuchonné, violet sombre, sans arme) et un habitant qui a
## tout oublié.
func _build_cast() -> void:
	_hero = Fighter.create_hero(SaveManager.look(), _wt.hero_name, 1)
	add_child(_hero)
	if _wt.companion:
		_pet = Companion.create(SaveManager.look())
		add_child(_pet)
	_ysaline = CitadelHall.ysaline(self)
	_malvrek = CitadelHall.character(self, "Rogue_Hooded", "Malvrek",
		{"main": "", "off": "", "head": false, "cape": true, "cape_color": "violet"})
	_tint(_malvrek, Color(0.55, 0.45, 0.72))
	_villager = CitadelHall.character(self, "Barbarian", "Le boulanger",
		{"main": "Mug", "off": "", "head": false, "cape": false, "cape_color": "origine"})
	_question = Label3D.new()
	_question.text = "?"
	_question.font = Accessibility.font()
	_question.font_size = 160
	_question.pixel_size = 0.01
	_question.outline_size = 18
	_question.modulate = Color("#ffd447")
	_question.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_question.position = Vector3(6.9, 2.7, 6.5)  # à côté de la tête du boulanger
	add_child(_question)
	if Quality.settings().vertex_shading:
		for who: Node3D in [_hero, _ysaline, _malvrek, _villager]:
			MobileLighting.apply_vertex_shading(who)


## Teinte un personnage (Malvrek : plus sombre que le héros encapuchonné de Tom).
func _tint(who: Node3D, color: Color) -> void:
	for node in who.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		for surface in mesh_instance.mesh.get_surface_count():
			var source := mesh_instance.get_active_material(surface) as BaseMaterial3D
			if source == null:
				continue
			var mat := source.duplicate() as BaseMaterial3D
			mat.albedo_color = mat.albedo_color * color
			mesh_instance.set_surface_override_material(surface, mat)


# --- Interface ----------------------------------------------------------------------------------

## Peu de choses par-dessus la scène : titre du tableau en haut, boutons en bas ; le texte
## (panneau `_subtitles`) n'apparaît qu'à la demande.
func _build_ui() -> void:
	_ui = CanvasLayer.new()
	_ui.layer = 10
	add_child(_ui)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiKit.make_theme(_wt)
	_ui.add_child(root)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 20)
	root.add_child(margin)
	var column := VBoxContainer.new()
	column.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)

	var top := HBoxContainer.new()
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(top)
	var heading := VBoxContainer.new()
	heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(heading)
	_caption = UiKit.title("", 30, Color.WHITE)
	_counter = UiKit.label("", 18, Color(1, 1, 1, 0.85))
	for line: Label in [_caption, _counter]:
		line.autowrap_mode = TextServer.AUTOWRAP_OFF
		line.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
		line.add_theme_constant_override("outline_size", 8)
		heading.add_child(line)
	var skip := UiKit.button("Passer", 52.0)
	UiKit.style_secondary(skip, _wt)
	skip.custom_minimum_size.x = 150
	skip.pressed.connect(finish)
	top.add_child(skip)

	var gap := Control.new()
	gap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	column.add_child(gap)
	_subtitles = PanelContainer.new()
	_subtitles.visible = show_text
	column.add_child(_subtitles)
	_panel_box = VBoxContainer.new()
	_panel_box.add_theme_constant_override("separation", 8)
	_subtitles.add_child(_panel_box)

	var buttons := HBoxContainer.new()
	buttons.mouse_filter = Control.MOUSE_FILTER_IGNORE
	buttons.add_theme_constant_override("separation", 14)
	column.add_child(buttons)
	_text_button = UiKit.icon_button("Texte", "scroll-unfurled", 52.0)
	UiKit.style_secondary(_text_button, _wt)
	_text_button.pressed.connect(toggle_text)
	buttons.add_child(_text_button)
	_update_text_button()
	if _narrate:
		_replay = UiKit.icon_button("Réécouter", "speaker", 52.0)
		UiKit.style_secondary(_replay, _wt)
		_replay.pressed.connect(_speak)
		buttons.add_child(_replay)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	buttons.add_child(spacer)
	_next = UiKit.button("Suivant", 56.0)
	_next.custom_minimum_size.x = 220
	_next.pressed.connect(next)
	buttons.add_child(_next)

	_fade = ColorRect.new()
	_fade.color = Color(0, 0, 0, 0)
	_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_fade)


func _update_text_button() -> void:
	_text_button.text = "Cacher le texte" if show_text else "Texte"


## Titre du tableau (il apparaît doucement), compteur, texte du panneau, bouton « Suivant ».
func _fill_texts(i: int) -> void:
	var entry: Dictionary = PAGES[i]
	_caption.text = entry["title"]
	_counter.text = "%d / %d" % [i + 1, PAGES.size()]
	if not Accessibility.on("calm"):
		_caption.modulate.a = 0.0
		create_tween().tween_property(_caption, "modulate:a", 1.0, 1.2).set_delay(0.4)
	for child in _panel_box.get_children():
		child.queue_free()
	var text := text_of(i)
	if entry["speaker"] != "":
		_panel_box.add_child(UiKit.label("%s :" % entry["speaker"], 19, _wt.text_dim))
		text = "« %s »" % text
	_panel_box.add_child(UiKit.label(text, 23))
	_next.text = "Commencer la quête" if i == PAGES.size() - 1 else "Suivant"
	_next.custom_minimum_size.x = 300 if i == PAGES.size() - 1 else 220
	_next.focus_mode = Control.FOCUS_ALL
	_next.grab_focus.call_deferred()  # Entrée (clavier du PC) passe au tableau suivant
