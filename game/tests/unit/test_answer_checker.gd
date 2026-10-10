extends GutTest
## Rejoue content/test-vectors/answers.json : le client doit rendre exactement
## le même verdict que l'API (api/tests/test_answers.py).

const VECTORS := "../content/test-vectors/answers.json"


func _cases() -> Array:
	var path := ProjectSettings.globalize_path("res://").path_join(VECTORS)
	var text := FileAccess.get_file_as_string(path)
	assert_ne(text, "", "vecteurs introuvables : %s" % path)
	return JSON.parse_string(text)["cases"]


func test_shared_vectors() -> void:
	var cases := _cases()
	assert_gt(cases.size(), 30)
	for c in cases:
		var got := AnswerChecker.check(c["answer"], c["input"])
		assert_eq(got, c["expected"], "%s (saisie : %s)" % [c["note"], c["input"]])


func test_evaluate() -> void:
	var samples := [["2x+1", 3.0, 7.0], ["-x^2", 2.0, -4.0], ["2^-1", 0.0, 0.5],
		["(x+1)(x-1)", 3.0, 8.0], ["6/2(1+2)", 0.0, 9.0], ["√(x+5)", 4.0, 3.0], ["x²", 3.0, 9.0]]
	for s in samples:
		var parser := MathExpr.new()
		var node: Variant = parser.parse(s[0])
		assert_not_null(node, "%s : %s" % [s[0], parser.error])
		if node != null:
			assert_almost_eq(MathExpr.evaluate(node, s[1]), s[2], 1e-9, s[0])


func test_invalid_expressions() -> void:
	for text in ["", "2+", "(x", "x)", "2**3", "3 $ 4"]:
		var parser := MathExpr.new()
		assert_null(parser.parse(text), "devrait être refusé : %s" % text)
		assert_ne(parser.error, "", text)


func test_parse_rational() -> void:
	var r := AnswerChecker.parse_rational("-6/8")
	assert_eq([r.num, r.den, r.typed_num, r.typed_den], [-3, 4, -6, 8])
	r = AnswerChecker.parse_rational("0,75")
	assert_eq([r.num, r.den], [3, 4])
	assert_true(AnswerChecker.parse_rational("1/0").is_empty())
