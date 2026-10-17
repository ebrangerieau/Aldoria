extends Node
## Aménagements d'accessibilité (troubles « dys », attention, couleurs), réglés par le
## parent dans l'espace parent (`accommodations` du profil, voir
## api/app/engine/accommodations.py) et préférences de l'enfant sur cet appareil
## (taille du texte, volume, lecture automatique). L'enfant peut agrandir le texte,
## jamais retirer un aménagement choisi par le parent.
##
## Appliqués à la construction des interfaces : `UiKit.make_theme` (police, espacement,
## taille), `UiKit.button` (cibles agrandies), `CombatFx` (mode calme), `WorldTheme`
## (couleurs), `QuestionService` (départ plus doux), `TouchStick` (toucher seul).

signal changed

const DEFAULTS := {
	"read_aloud": false,
	"auto_read": false,
	"text_size": 0,
	"spacing": false,
	"readable_font": false,
	"no_speed": false,
	"math_tools": false,
	"easy_start": false,
	"tap_only": false,
	"big_targets": false,
	"calm": false,
	"pause_minutes": 0,
	"colorblind": false,
}
const PREFS_FILE := "user://prefs_%d.json"
const READABLE_FONT := "res://assets/fonts/AtkinsonHyperlegible-Regular.ttf"
const SYMBOLS_FONT := "res://assets/fonts/DejaVuSans.ttf"
const TITLE_FONT := "res://assets/fonts/Cinzel.ttf"
const CALM_VOLUME_DB := -8.0

## Aménagements du parent (dernière version reçue du serveur).
var parent: Dictionary = DEFAULTS.duplicate()
## Préférences de l'enfant sur cet appareil : {text_size, volume et music (0 à 1), auto_read}.
var prefs: Dictionary = {}

var _font: Font
var _title_font: Font
var _voices: Dictionary = {}  # langue (« en-GB ») → identifiant de voix
var _next_pause_s := 0.0


func _ready() -> void:
	# Joueur déjà connecté au lancement (Session a relu auth.json) : ses derniers réglages.
	parent = normalized(Session.profile.get("accommodations", {}))
	load_prefs(int(Session.profile.get("id", 0)))


# --- Lecture des réglages ------------------------------------------------------------

func on(key: String) -> bool:
	return bool(parent.get(key, false))


## Taille du texte : la plus grande entre celle du parent et celle de l'enfant (0 à 2).
func text_size() -> int:
	return clampi(maxi(int(parent.get("text_size", 0)), int(prefs.get("text_size", 0))), 0, 2)


func auto_read() -> bool:
	return on("read_aloud") and bool(prefs.get("auto_read", on("auto_read")))


func volume() -> float:
	return clampf(float(prefs.get("volume", 1.0)), 0.0, 1.0)


## Volume de la musique (Options, autoload `Music`), indépendant de celui des sons et des voix.
func music_volume() -> float:
	return clampf(float(prefs.get("music", 0.7)), 0.0, 1.0)


## Police des interfaces : très lisible ou par défaut, espacée si demandé, avec les
## symboles mathématiques en secours (la police lisible ne les a pas).
func font() -> Font:
	if _font == null:
		var variation := FontVariation.new()
		if on("readable_font"):
			var readable: FontFile = load(READABLE_FONT)
			readable.fallbacks = [ThemeDB.fallback_font, load(SYMBOLS_FONT)]
			variation.base_font = readable
		else:
			variation.base_font = ThemeDB.fallback_font
		if on("spacing"):
			variation.spacing_glyph = 2
			variation.spacing_space = 6
		_font = variation
	return _font


## Police des titres (grimoire : Cinzel, capitales gravées) ; la police très lisible la remplace
## quand le parent l'a choisie.
func title_font() -> Font:
	if on("readable_font"):
		return font()
	if _title_font == null:
		var cinzel: FontFile = load(TITLE_FONT)
		cinzel.fallbacks = [ThemeDB.fallback_font, load(SYMBOLS_FONT)]
		var variation := FontVariation.new()
		variation.base_font = cinzel
		variation.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): 700}
		if on("spacing"):
			variation.spacing_glyph = 2
		_title_font = variation
	return _title_font


func line_spacing() -> int:
	return 8 if on("spacing") else 0


# --- Mise à jour -------------------------------------------------------------------------

## Aménagements reçus du serveur (connexion, début de session, retour au camp).
func apply_parent(received: Variant) -> void:
	if not received is Dictionary:
		return
	var merged := normalized(received)
	if not OS.has_feature("web") and Quality.option("acc") != "":
		# Développement (PC) : `--acc=big_targets,… [--text-size=2]` force des aménagements (captures).
		for key in Quality.option("acc").split(",", false):
			merged[key] = true
		merged["text_size"] = int(Quality.option("text-size", "0"))
	if merged == parent:
		return
	parent = merged
	_apply()
	reset_pause_timer()
	changed.emit()


## Réglages complets et typés comme DEFAULTS (le JSON rend les entiers en décimaux :
## sans cela, des réglages identiques passeraient pour modifiés).
static func normalized(received: Dictionary) -> Dictionary:
	var out := DEFAULTS.duplicate()
	for key in DEFAULTS:
		if received.has(key):
			out[key] = int(received[key]) if DEFAULTS[key] is int else bool(received[key])
	return out


## Relit les aménagements au serveur (appelé au camp) ; garde les derniers connus hors ligne.
func refresh() -> void:
	if ApiClient.token == "":
		return
	var res := await ApiClient.get_json("/play/me")
	if res.ok:
		apply_parent(res.data.get("accommodations", {}))
		Session.remember_accommodations(parent)
		Session.update_profile(res.data.get("profile", {}))
		Session.sync_play_time(res.data.get("play_time", {}))


## `notify` faux : réglage lu en continu (volume de la musique), sans reconstruire les écrans.
func set_pref(key: String, value: Variant, notify := true) -> void:
	prefs[key] = value
	_save_prefs()
	_apply()
	if notify:
		changed.emit()


## Préférences de l'enfant connecté (changement de joueur).
func load_prefs(profile_id: int) -> void:
	prefs = {}
	if profile_id > 0 and FileAccess.file_exists(PREFS_FILE % profile_id):
		var stored: Variant = JSON.parse_string(FileAccess.get_file_as_string(PREFS_FILE % profile_id))
		if stored is Dictionary:
			prefs = stored
	_apply()
	changed.emit()


func _save_prefs() -> void:
	var id := int(Session.profile.get("id", 0))
	if id == 0:
		return
	var file := FileAccess.open(PREFS_FILE % id, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(prefs))


func _apply() -> void:
	_font = null
	_title_font = null
	UiKit.text_scale = UiKit.TEXT_SCALES[text_size()]
	UiKit.target_scale = 1.3 if on("big_targets") else 1.0
	var db := linear_to_db(maxf(volume(), 0.001)) - 4.0
	Sfx.volume_db = db + (CALM_VOLUME_DB if on("calm") else 0.0)


# --- Lecture à voix haute ----------------------------------------------------------------

func can_speak() -> bool:
	return on("read_aloud")


## Lit un texte avec la voix française (aménagement « lecture à voix haute » ;
## interrompt la lecture précédente).
func speak(text: String) -> void:
	if can_speak():
		say(text, "fr-FR")


## Lecture en plusieurs morceaux, chacun dans sa langue : [[texte, langue], …]
## (énoncé en français, propositions en anglais…).
func speak_parts(parts: Array) -> void:
	if not can_speak():
		return
	stop_speaking()
	for part: Array in parts:
		say(str(part[0]), str(part[1]), false)


## Prononce un texte dans une langue, que la lecture à voix haute soit activée ou non :
## c'est le support d'un exercice d'écoute. Voix neuronale du serveur (autoload `Voice`) si
## possible, sinon voix de l'appareil.
func say(text: String, lang := "fr-FR", interrupt := true, rate := 0.95) -> void:
	if text.strip_edges() == "":
		return
	if Voice.usable(lang):
		if interrupt:
			DisplayServer.tts_stop()
		Voice.speak(text, lang, rate, interrupt)
		return
	device_say(text, lang, interrupt, rate)


## Voix de l'appareil (synthèse du navigateur ou du système). Sans voix de cette langue :
## voix par défaut.
func device_say(text: String, lang := "fr-FR", interrupt := true, rate := 0.95) -> void:
	if interrupt:
		DisplayServer.tts_stop()
	DisplayServer.tts_speak(text, voice_for(lang), roundi(volume() * 100), 1.0, rate)


## Vrai tant qu'une voix lit : celle du serveur (préparation du son comprise) ou celle de l'appareil.
func is_speaking() -> bool:
	return Voice.is_speaking() or DisplayServer.tts_is_speaking()


func stop_speaking() -> void:
	DisplayServer.tts_stop()
	Voice.stop()


## Voix d'une langue : d'abord la variante exacte (en-GB), sinon la langue (en).
func voice_for(lang: String) -> String:
	if not _voices.has(lang):
		var wanted := lang.replace("_", "-").to_lower()
		var found := ""
		for voice: Dictionary in DisplayServer.tts_get_voices():
			if str(voice.get("language", "")).replace("_", "-").to_lower() == wanted:
				found = str(voice.get("id", ""))
				break
		if found == "":
			var same_language := DisplayServer.tts_get_voices_for_language(lang.substr(0, 2))
			found = same_language[0] if not same_language.is_empty() else ""
		_voices[lang] = found
	return _voices[lang]


## Morceaux lus d'une question : énoncé (formule comprise), puis les propositions, dans
## leur langue (`choices_lang`) quand ce n'est pas le français.
static func question_parts(item: Dictionary) -> Array:
	var said: Dictionary = item.get("speech", {})
	# Langue vivante : énoncé en morceaux, l'anglais lu par la voix anglaise (engine/speech.py).
	var parts: Array = (said["prompt_parts"] as Array).duplicate() if said.get("prompt_parts") is Array \
		else [[str(said.get("prompt", item.get("prompt", ""))), "fr-FR"]]
	var choices: Array = said.get("choices", item.get("choices", []) if item.get("choices") else [])
	var lang := str(item.get("choices_lang", "")) if item.get("choices_lang") else "fr-FR"
	if item.get("type") == "true_false":
		parts.append(["Vrai ou faux ? Puis choisis pourquoi.", "fr-FR"])
	for i in choices.size():
		if lang == "fr-FR":
			parts.append(["Proposition %d : %s." % [i + 1, choices[i]], "fr-FR"])
		else:
			parts.append(["Proposition %d :" % (i + 1), "fr-FR"])
			parts.append([str(choices[i]), lang])
	return parts


## Texte lu d'une question, d'un seul tenant (tests, affichage).
static func question_speech(item: Dictionary) -> String:
	var texts: Array[String] = []
	for part: Array in question_parts(item):
		texts.append(str(part[0]))
	return " ".join(texts)


# --- Rappel de pause -------------------------------------------------------------------

## Vrai quand le temps de jeu actif atteint le prochain rappel (0 : jamais).
func pause_due() -> bool:
	var minutes := int(parent.get("pause_minutes", 0))
	if minutes <= 0:
		return false
	if _next_pause_s <= 0.0:
		_next_pause_s = minutes * 60.0
	return Session.played_seconds >= _next_pause_s


## L'enfant continue : prochain rappel dans le même délai.
func snooze_pause() -> void:
	_next_pause_s = Session.played_seconds + int(parent.get("pause_minutes", 0)) * 60.0


func reset_pause_timer() -> void:
	_next_pause_s = 0.0
