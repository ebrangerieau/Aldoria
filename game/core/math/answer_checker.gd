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
	push_error("Type de réponse inconnu : %s" % answer.get("kind"))
	return false


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
			return "(" in MathExpr.normalize(text)
	return true


static func _gcd(a: int, b: int) -> int:
	while b != 0:
		var t := b
		b = a % b
		a = t
	return maxi(a, 1)
