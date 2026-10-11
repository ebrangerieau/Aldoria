"""Analyseur d'expressions mathématiques saisies par les élèves.

Grammaire commune avec le client (game/core/math/math_expr.gd) : toute modification
doit être faite des deux côtés et couverte par content/test-vectors/answers.json.

    expr    := term (('+' | '-') term)*
    term    := unary (('*' | '/') unary | <implicite> unary)*
    unary   := ('+' | '-') unary | power
    power   := atom ('^' unary)?
    atom    := nombre | variable | fonction '(' expr ')' | '(' expr ')'

- Nombres : `3`, `3.5`, `3,5`.
- Multiplication implicite : `6x`, `2(x+1)`, `(x+1)(x-1)`, `x(x+2)`.
- Symboles acceptés : `×`, `·`, `÷`, `−`, `²`, `³`, `√`.
- Fonction : `sqrt` (ou `√`).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# Points d'évaluation fixes : déterministes, identiques côté client, non entiers
# pour éviter les coïncidences (racines, symétries).
EVAL_POINTS = (-2.7, -1.3, -0.4, 0.6, 1.1, 1.9, 2.3, 3.1)
REL_TOLERANCE = 1e-6

_SYMBOLS = {
    "×": "*",
    "·": "*",
    "÷": "/",
    "−": "-",
    "–": "-",
    "²": "^2",
    "³": "^3",
    "√": "sqrt",
}
_FUNCTIONS = {"sqrt"}


class ExprError(ValueError):
    """Saisie impossible à analyser."""


@dataclass(frozen=True)
class Token:
    kind: str  # num | var | func | op | lpar | rpar
    value: str


def normalize(text: str) -> str:
    out = text.strip().lower()
    for src, dst in _SYMBOLS.items():
        out = out.replace(src, dst)
    return out.replace(" ", "")


def tokenize(text: str) -> list[Token]:
    s = normalize(text)
    tokens: list[Token] = []
    i = 0
    while i < len(s):
        c = s[i]
        if c.isdigit() or (c in ".," and i + 1 < len(s) and s[i + 1].isdigit()):
            j = i
            seen_sep = False
            while j < len(s) and (s[j].isdigit() or (s[j] in ".," and not seen_sep)):
                if s[j] in ".,":
                    seen_sep = True
                j += 1
            tokens.append(Token("num", s[i:j].replace(",", ".")))
            i = j
        elif c.isalpha():
            j = i
            while j < len(s) and s[j].isalpha():
                j += 1
            word = s[i:j]
            func = next((f for f in _FUNCTIONS if word.startswith(f)), None)
            if func:
                tokens.append(Token("func", func))
                word = word[len(func) :]  # « sqrtx » (issu de « √x ») : sqrt puis x
            # « xy » = x * y : chaque lettre restante est une variable.
            tokens.extend(Token("var", ch) for ch in word)
            i = j
        elif c in "+-*/^":
            tokens.append(Token("op", c))
            i += 1
        elif c == "(":
            tokens.append(Token("lpar", c))
            i += 1
        elif c == ")":
            tokens.append(Token("rpar", c))
            i += 1
        else:
            raise ExprError(f"caractère inattendu : {c!r}")
    return tokens


class _Parser:
    def __init__(self, tokens: list[Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> Token | None:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def take(self) -> Token:
        tok = self.peek()
        if tok is None:
            raise ExprError("expression incomplète")
        self.pos += 1
        return tok

    def parse(self):
        if not self.tokens:
            raise ExprError("expression vide")
        node = self.expr()
        if self.peek() is not None:
            raise ExprError(f"symbole en trop : {self.peek().value!r}")
        return node

    def expr(self):
        node = self.term()
        while (tok := self.peek()) and tok.kind == "op" and tok.value in "+-":
            self.take()
            node = (tok.value, node, self.term())
        return node

    def term(self):
        node = self.unary()
        while True:
            tok = self.peek()
            if tok and tok.kind == "op" and tok.value in "*/":
                self.take()
                node = (tok.value, node, self.unary())
            elif tok and tok.kind in ("num", "var", "func", "lpar"):
                node = ("*", node, self.unary())  # multiplication implicite
            else:
                return node

    def unary(self):
        tok = self.peek()
        if tok and tok.kind == "op" and tok.value in "+-":
            self.take()
            operand = self.unary()
            return ("neg", operand) if tok.value == "-" else operand
        return self.power()

    def power(self):
        base = self.atom()
        tok = self.peek()
        if tok and tok.kind == "op" and tok.value == "^":
            self.take()
            return ("^", base, self.unary())
        return base

    def atom(self):
        tok = self.take()
        if tok.kind == "num":
            return ("num", float(tok.value))
        if tok.kind == "var":
            return ("var", tok.value)
        if tok.kind == "func":
            if (nxt := self.peek()) and nxt.kind == "lpar":
                self.take()
                inner = self.expr()
                self._expect_rpar()
                return (tok.value, inner)
            return (tok.value, self.power())  # √2, √x
        if tok.kind == "lpar":
            inner = self.expr()
            self._expect_rpar()
            return inner
        raise ExprError(f"symbole inattendu : {tok.value!r}")

    def _expect_rpar(self):
        tok = self.take()
        if tok.kind != "rpar":
            raise ExprError("parenthèse fermante manquante")


def parse(text: str):
    return _Parser(tokenize(text)).parse()


def evaluate(node, env: dict[str, float]) -> float:
    kind = node[0]
    if kind == "num":
        return node[1]
    if kind == "var":
        if node[1] not in env:
            raise ExprError(f"variable inconnue : {node[1]}")
        return env[node[1]]
    if kind == "neg":
        return -evaluate(node[1], env)
    if kind == "sqrt":
        value = evaluate(node[1], env)
        return math.sqrt(value) if value >= 0 else math.nan
    a = evaluate(node[1], env)
    b = evaluate(node[2], env)
    if kind == "+":
        return a + b
    if kind == "-":
        return a - b
    if kind == "*":
        return a * b
    if kind == "/":
        return a / b if b != 0 else math.nan
    if kind == "^":
        try:
            return math.pow(a, b)
        except (ValueError, OverflowError):
            return math.nan
    raise ExprError(f"nœud inconnu : {kind}")


def variables(node) -> set[str]:
    if node[0] == "var":
        return {node[1]}
    if node[0] == "num":
        return set()
    return set().union(*(variables(child) for child in node[1:]))


def is_product(text: str) -> bool:
    """Vrai si l'expression est, au premier niveau, un produit ou une puissance
    (au signe près) : 3(x+2), (x−3)(x+3), (x+1)², −2x(x+1)."""
    node = parse(text)
    while node[0] == "neg":
        node = node[1]
    return node[0] in ("*", "^")


def equivalent(a: str, b: str, variable: str = "x") -> bool:
    """Vrai si les deux expressions coïncident sur tous les points d'évaluation."""
    na, nb = parse(a), parse(b)
    if variables(na) - {variable} or variables(nb) - {variable}:
        return False
    compared = 0
    for x in EVAL_POINTS:
        va, vb = evaluate(na, {variable: x}), evaluate(nb, {variable: x})
        if math.isnan(va) and math.isnan(vb):
            continue
        if math.isnan(va) or math.isnan(vb):
            return False
        if abs(va - vb) > REL_TOLERANCE * max(1.0, abs(va), abs(vb)):
            return False
        compared += 1
    return compared > 0
