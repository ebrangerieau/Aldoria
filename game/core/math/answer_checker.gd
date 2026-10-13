class_name AnswerChecker
extends RefCounted
## Validation locale des réponses (retour instantané, TRD §2.4). Même verdict que
## api/app/engine/answers.py, vérifié sur content/test-vectors/answers.json.


## « -3/4 », « 0,75 », « 2 » → {num, den (valeur exacte réduite), typed_num, typed_den}.
## `typed_*` ne sont renseignés que pour une fraction écrite a/b. {} si illisible.
static func parse_rational(text: String) -> Dictionary:
	var s := MathExpr.normalize(text)
	var regex := RegEx.create_from_string("^([+-]?)(\\d+(?:[.,]\\d+)?)(?:/(\\d+))?$")
	var m := regex.search(s)
	if m == null:
		return {}
	var sign_text := m.get_string(1)
	var num_text := m.get_string(2).replace(",", ".")
	var den_text := m.get_string(3)
	var parts := num_text.split(".")
	var decimals := parts[1].length() if parts.size() > 1 else 0
	var num := int(parts[0] + (parts[1] if parts.size() > 1 else ""))
	var den := int(pow(10, decimals))
	var typed_num: Variant = null
	var typed_den: Variant = null
	if den_text != "":
		if decimals > 0:
			return {}
		var d := int(den_text)
		if d == 0:
			return {}
		den *= d
		typed_num = num
		typed_den = d
	if sign_text == "-":
		num = -num
		if typed_num != null:
			typed_num = -typed_num
	var g := _gcd(absi(num), den)
	@warning_ignore("integer_division")  # division exacte par le PGCD
	return {"num": num / g, "den": den / g, "typed_num": typed_num, "typed_den": typed_den}


static func check(answer: Dictionary, user_input: Variant) -> bool:
	match answer.get("kind", ""):
		"choice":
			# Le JSON de Godot donne des flottants (2 → 2.0) : on accepte les nombres.
			if user_input is int or user_input is float:
				return int(user_input) == int(answer["index"])
			return str(user_input).is_valid_int() and int(str(user_input)) == int(answer["index"])
		"number":
			return _check_number(answer, str(user_input))
		"fraction":
			return _check_fraction(answer, str(user_input))
		"expression":
			return _check_expression(answer, str(user_input))
		"vector":
			return _check_vector(answer, user_input)
		"order":
			return _check_order(answer, user_input)
		"true_false":
			return _check_true_false(answer, user_input)
		"signs":
			return _check_signs(answer, user_input)
		"text":
			var accents := bool(answer.get("accents", true))
			var got := normalize_text(str(user_input), accents)
			if got == "":
				return false
			for accepted in answer.get("value", []):
				if normalize_text(str(accepted), accents) == got:
					return true
			return false
	push_error("Type de réponse inconnu : %s" % answer.get("kind"))
	return false


## Lettres accentuées → lettre de base (même table que api/app/engine/answers.py).
const ACCENTS := {
	"à": "a", "á": "a", "â": "a", "ä": "a", "ã": "a", "å": "a", "ç": "c",
	"è": "e", "é": "e", "ê": "e", "ë": "e", "ì": "i", "í": "i", "î": "i", "ï": "i",
	"ñ": "n", "ò": "o", "ó": "o", "ô": "o", "ö": "o", "õ": "o",
	"ù": "u", "ú": "u", "û": "u", "ü": "u", "ý": "y", "ÿ": "y", "œ": "oe", "æ": "ae",
}


## Réponse écrite comparable : minuscules, espaces réduits, apostrophe droite, sans point
## final ; sans accents si `accents` est faux.
static func normalize_text(text: String, accents := true) -> String:
	var s := text.replace("’", "'").replace("‘", "'").replace(char(0xA0), " ").to_lower()
	var words := PackedStringArray()
	for word in s.split(" ", false):
		for part in word.split("\t", false):
			words.append(part)
	s = " ".join(words)
	while s.length() > 0 and s[-1] in [".", "!", "?"]:
		s = s.substr(0, s.length() - 1)
	s = s.strip_edges()
	if not accents:
		var plain := ""
		for c in s:
			plain += ACCENTS.get(c, c)
		s = plain
	return s


static func _check_number(answer: Dictionary, text: String) -> bool:
	var got := parse_rational(text)
	var expected := parse_rational(str(answer["value"]))
	if got.is_empty() or expected.is_empty():
		return false
	var diff := absf(float(got.num) / got.den - float(expected.num) / expected.den)
	return diff <= float(answer.get("tolerance", 0.0)) + 1e-12


static func _check_fraction(answer: Dictionary, text: String) -> bool:
	var got := parse_rational(text)
	var expected := parse_rational(str(answer["value"]))
	if got.is_empty() or expected.is_empty():
		return false
	if got.num != expected.num or got.den != expected.den:
		return false
	if answer.get("require_irreducible", false) and got.typed_den != null:
		if _gcd(absi(got.typed_num), got.typed_den) != 1:
			return false
	if not answer.get("accept_equivalent", true):
		return got.typed_num == expected.typed_num and got.typed_den == expected.typed_den
	return true


static func _check_expression(answer: Dictionary, text: String) -> bool:
	if not MathExpr.equivalent(text, str(answer["value"]), answer.get("variable", "x")):
		return false
	match answer.get("form"):
		"expanded":
			return "(" not in MathExpr.normalize(text)
		"factored":
			# Un vrai produit (« 3(x+2) », « (x+3)² ») : « (x²−9) » n'est pas une factorisation.
			return "(" in MathExpr.normalize(text) and MathExpr.is_product(text)
	return true


## Vrai/faux justifié : le verdict ET la justification (indice des choix).
static func _check_true_false(answer: Dictionary, user_input: Variant) -> bool:
	if not user_input is Dictionary or not user_input.get("value") is bool:
		return false
	var reason: Variant = user_input.get("reason")
	if not (reason is int or reason is float) or float(reason) != floorf(float(reason)):
		return false
	return user_input["value"] == bool(answer["value"]) and int(reason) == int(answer["reason"])


## Tableau de signes : cases lues ligne par ligne, « + » ou « - » (ou « − »).
static func _check_signs(answer: Dictionary, user_input: Variant) -> bool:
	var expected: Array = answer["value"]
	if not user_input is Array or (user_input as Array).size() != expected.size():
		return false
	for i in expected.size():
		if str(user_input[i]).strip_edges().replace("−", "-") != str(expected[i]):
			return false
	return true


## Ordre des choix : liste d'indices (le JSON donne des flottants : 2.0 accepté).
static func _check_order(answer: Dictionary, user_input: Variant) -> bool:
	var expected: Array = answer["value"]
	if not user_input is Array or (user_input as Array).size() != expected.size():
		return false
	for i in expected.size():
		var got: Variant = user_input[i]
		if not (got is int or got is float) or float(got) != floorf(float(got)) or int(got) != int(expected[i]):
			return false
	return true


## Coordonnées d'un vecteur : liste de 2 nombres, chacun comparé exactement.
static func _check_vector(answer: Dictionary, user_input: Variant) -> bool:
	if not user_input is Array or (user_input as Array).size() != 2:
		return false
	for i in 2:
		var got := parse_rational(str(user_input[i]))
		var expected := parse_rational(str(answer["value"][i]))
		if got.is_empty() or expected.is_empty() or got.num != expected.num or got.den != expected.den:
			return false
	return true


static func _gcd(a: int, b: int) -> int:
	while b != 0:
		var t := b
		b = a % b
		a = t
	return maxi(a, 1)
