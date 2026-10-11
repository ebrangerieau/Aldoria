class_name MathExpr
extends RefCounted
## Analyseur d'expressions saisies par les élèves. Même grammaire que
## api/app/engine/mathexpr.py : toute modification doit être faite des deux côtés
## et couverte par content/test-vectors/answers.json.
##
##   expr  := term (('+' | '-') term)*
##   term  := unary (('*' | '/') unary | <implicite> unary)*
##   unary := ('+' | '-') unary | power
##   power := atom ('^' unary)?
##   atom  := nombre | variable | fonction '(' expr ')' | '(' expr ')'
##
## Nœuds : [type, ...] avec type ∈ num, var, neg, sqrt, +, -, *, /, ^.

## Points d'évaluation fixes, identiques côté serveur.
const EVAL_POINTS: Array[float] = [-2.7, -1.3, -0.4, 0.6, 1.1, 1.9, 2.3, 3.1]
const REL_TOLERANCE := 1e-6
const FUNCTIONS: Array[String] = ["sqrt"]
const SYMBOLS := {
	"×": "*", "·": "*", "÷": "/", "−": "-", "–": "-", "²": "^2", "³": "^3", "√": "sqrt",
}

var error := ""
var _tokens: Array = []
var _pos := 0


static func normalize(text: String) -> String:
	var out := text.strip_edges().to_lower()
	for src in SYMBOLS:
		out = out.replace(src, SYMBOLS[src])
	return out.replace(" ", "")


## Analyse `text` ; renvoie l'arbre, ou null (raison dans `error`).
func parse(text: String) -> Variant:
	error = ""
	_tokens = _tokenize(normalize(text))
	_pos = 0
	if error != "":
		return null
	if _tokens.is_empty():
		error = "expression vide"
		return null
	var node: Variant = _expr()
	if error == "" and _pos < _tokens.size():
		error = "symbole en trop : %s" % _tokens[_pos][1]
	return null if error != "" else node


static func evaluate(node: Array, x: float) -> float:
	match node[0]:
		"num":
			return node[1]
		"var":
			return x if node[1] == "x" else NAN
		"neg":
			return -evaluate(node[1], x)
		"sqrt":
			var v := evaluate(node[1], x)
			return sqrt(v) if v >= 0.0 else NAN
	var a := evaluate(node[1], x)
	var b := evaluate(node[2], x)
	match node[0]:
		"+":
			return a + b
		"-":
			return a - b
		"*":
			return a * b
		"/":
			return a / b if b != 0.0 else NAN
		"^":
			return pow(a, b)
	return NAN


static func variables(node: Array) -> Array[String]:
	var out: Array[String] = []
	if node[0] == "var":
		out.append(node[1])
	elif node[0] != "num":
		for i in range(1, node.size()):
			for v in variables(node[i]):
				if v not in out:
					out.append(v)
	return out


## Vrai si l'expression est, au premier niveau, un produit ou une puissance
## (au signe près) : 3(x+2), (x−3)(x+3), (x+1)², −2x(x+1).
static func is_product(text: String) -> bool:
	var parser := MathExpr.new()
	var node: Variant = parser.parse(text)
	if node == null:
		return false
	while node[0] == "neg":
		node = node[1]
	return node[0] in ["*", "^"]


## Vrai si les deux expressions coïncident sur tous les points d'évaluation.
static func equivalent(a: String, b: String, variable := "x") -> bool:
	var pa := MathExpr.new()
	var pb := MathExpr.new()
	var na: Variant = pa.parse(a)
	var nb: Variant = pb.parse(b)
	if na == null or nb == null:
		return false
	for v in variables(na) + variables(nb):
		if v != variable:
			return false
	var compared := 0
	for x in EVAL_POINTS:
		var va := evaluate(na, x)
		var vb := evaluate(nb, x)
		if is_nan(va) and is_nan(vb):
			continue
		if is_nan(va) or is_nan(vb):
			return false
		if absf(va - vb) > REL_TOLERANCE * maxf(1.0, maxf(absf(va), absf(vb))):
			return false
		compared += 1
	return compared > 0


# --- Lexique et syntaxe ---------------------------------------------------------

func _tokenize(s: String) -> Array:
	var tokens: Array = []
	var i := 0
	while i < s.length():
		var c := s[i]
		if c.is_valid_int() or (c in ".," and i + 1 < s.length() and s[i + 1].is_valid_int()):
			var j := i
			var seen_sep := false
			while j < s.length() and (s[j].is_valid_int() or (s[j] in ".," and not seen_sep)):
				if s[j] in ".,":
					seen_sep = true
				j += 1
			tokens.append(["num", s.substr(i, j - i).replace(",", ".")])
			i = j
		elif _is_letter(c):
			var j := i
			while j < s.length() and _is_letter(s[j]):
				j += 1
			var word := s.substr(i, j - i)
			for f in FUNCTIONS:
				if word.begins_with(f):
					tokens.append(["func", f])
					word = word.substr(f.length())  # « sqrtx » (issu de « √x ») : sqrt puis x
					break
			for ch in word:
				tokens.append(["var", ch])
			i = j
		elif c in "+-*/^":
			tokens.append(["op", c])
			i += 1
		elif c == "(":
			tokens.append(["lpar", c])
			i += 1
		elif c == ")":
			tokens.append(["rpar", c])
			i += 1
		else:
			error = "caractère inattendu : %s" % c
			return []
	return tokens


static func _is_letter(c: String) -> bool:
	return c >= "a" and c <= "z"


func _peek() -> Array:
	return _tokens[_pos] if _pos < _tokens.size() else []


func _take() -> Array:
	if _pos >= _tokens.size():
		error = "expression incomplète"
		return ["end", ""]
	_pos += 1
	return _tokens[_pos - 1]


func _is_op(tok: Array, ops: String) -> bool:
	return not tok.is_empty() and tok[0] == "op" and tok[1] in ops


func _expr() -> Array:
	var node := _term()
	while error == "" and _is_op(_peek(), "+-"):
		var op: String = _take()[1]
		node = [op, node, _term()]
	return node


func _term() -> Array:
	var node := _unary()
	while error == "":
		var tok := _peek()
		if _is_op(tok, "*/"):
			_take()
			node = [tok[1], node, _unary()]
		elif not tok.is_empty() and tok[0] in ["num", "var", "func", "lpar"]:
			node = ["*", node, _unary()]  # multiplication implicite
		else:
			break
	return node


func _unary() -> Array:
	if _is_op(_peek(), "+-"):
		var op: String = _take()[1]
		var operand := _unary()
		return ["neg", operand] if op == "-" else operand
	return _power()


func _power() -> Array:
	var base := _atom()
	if error == "" and _is_op(_peek(), "^"):
		_take()
		return ["^", base, _unary()]
	return base


func _atom() -> Array:
	var tok := _take()
	if error != "":
		return []
	match tok[0]:
		"num":
			return ["num", float(tok[1])]
		"var":
			return ["var", tok[1]]
		"func":
			var nxt := _peek()
			if not nxt.is_empty() and nxt[0] == "lpar":
				_take()
				var inner := _expr()
				_expect_rpar()
				return [tok[1], inner]
			return [tok[1], _power()]  # √2, √x
		"lpar":
			var inner := _expr()
			_expect_rpar()
			return inner
	error = "symbole inattendu : %s" % tok[1]
	return []


func _expect_rpar() -> void:
	if error != "":
		return
	var tok := _take()
	if error == "" and tok[0] != "rpar":
		error = "parenthèse fermante manquante"
