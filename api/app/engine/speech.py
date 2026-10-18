"""Texte à lire à voix haute (aménagement « dys », lecture des consignes) : énoncé,
formule, propositions, indice et explication d'un item, écrits pour la synthèse
vocale du navigateur (« 3/4 » → « 3 sur 4 », « x² » → « x au carré »…).

Le client lit `item["speech"]` tel quel ; il ne connaît pas les formules LaTeX.

Langues vivantes : dans un item d'anglais (ou d'une autre langue), le texte entre guillemets
anglais “ ” ou droits " " est dans la langue étrangère et lu par sa voix ; le reste, y compris
les mots français cités entre « », est lu en français. `prompt_parts` et `explanation_parts`
donnent alors ces morceaux : [[texte, langue], …].
"""

from __future__ import annotations

import re
from typing import Any

# Symboles du texte affiché → mots (ordre : les plus longs d'abord).
_WORDS = [
    ("−∞", "moins l'infini"),
    ("+∞", "plus l'infini"),
    ("∞", "l'infini"),
    ("≤", " inférieur ou égal à "),
    ("≥", " supérieur ou égal à "),
    ("≠", " différent de "),
    ("<", " inférieur à "),
    (">", " supérieur à "),
    ("×", " fois "),
    ("÷", " divisé par "),
    ("−", " moins "),
    ("±", " plus ou moins "),
    ("²", " au carré"),
    ("³", " au cube"),
    ("√", " racine de "),
    ("∈", " appartient à "),
    ("∉", " n'appartient pas à "),
    ("∩", " inter "),
    ("∪", " union "),
    ("ℕ", " N "),
    ("ℤ", " Z "),
    ("𝔻", " D "),
    ("ℚ", " Q "),
    ("ℝ", " R "),
    ("□", " case vide "),
    ("…", "... "),
    ("→", ", puis "),
    ("|", " "),
    ("=", " égale "),
    ("%", " pour cent"),
]
_UNITS = {
    "km/h": "kilomètres par heure",
    "m/s": "mètres par seconde",
    "m/min": "mètres par minute",
    "km": "kilomètres",
    "hm": "hectomètres",
    "dam": "décamètres",
    "m": "mètres",
    "dm": "décimètres",
    "cm": "centimètres",
    "mm": "millimètres",
    "kg": "kilogrammes",
    "hg": "hectogrammes",
    "dag": "décagrammes",
    "g": "grammes",
    "dg": "décigrammes",
    "cg": "centigrammes",
    "mg": "milligrammes",
    "kL": "kilolitres",
    "hL": "hectolitres",
    "daL": "décalitres",
    "L": "litres",
    "dL": "décilitres",
    "cL": "centilitres",
    "mL": "millilitres",
    "min": "minutes",
    "h": "heures",
    "cm²": "centimètres carrés",
    "m²": "mètres carrés",
    "km²": "kilomètres carrés",
}
_SUPERSCRIPTS = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻", "0123456789-")
_ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50}
_UNITS_WORDS = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
                "onze", "douze", "treize", "quatorze", "quinze", "seize"]  # fmt: skip
_TENS_WORDS = {2: "vingt", 3: "trente", 4: "quarante"}


def _roman_value(roman: str) -> int:
    total = 0
    for i, letter in enumerate(roman):
        value = _ROMAN_VALUES[letter]
        nxt = _ROMAN_VALUES[roman[i + 1]] if i + 1 < len(roman) else 0
        total += -value if value < nxt else value
    return total


def _cardinal(n: int) -> str:
    if n <= 16:
        return _UNITS_WORDS[n]
    if n < 20:
        return "dix-" + _UNITS_WORDS[n - 10]
    tens, unit = divmod(n, 10)
    if unit == 0:
        return _TENS_WORDS[tens]
    return f"{_TENS_WORDS[tens]}{' et ' if unit == 1 else '-'}{_UNITS_WORDS[unit]}"


def ordinal(n: int) -> str:
    """Nombre ordinal en toutes lettres : 1 → premier, 4 → quatrième, 21 → vingt et unième."""
    if n == 1:
        return "premier"
    word = _cardinal(n)
    if word.endswith("cinq"):
        return word + "uième"
    if word.endswith("neuf"):
        return word[:-1] + "vième"
    if word.endswith("e"):
        word = word[:-1]
    return word + "ième"


def _century(m: re.Match) -> str:
    return f"{ordinal(_roman_value(m.group(1)))} {m.group(3)}"


def text(value: str) -> str:
    """Texte affiché → texte lu."""
    # Retours à la ligne (programme du robot…) : une pause à chaque ligne.
    out = re.sub(r"([.?!:;])?\s*\n+\s*", lambda m: (m.group(1) or ".") + " ", str(value))
    # Unités après un nombre ou des points de suspension : « 9,46 cL » → « 9,46 centilitres ».
    out = re.sub(
        r"(\d|\.\.\.|…)\s*(" + "|".join(sorted(_UNITS, key=len, reverse=True)) + r")\b",
        lambda m: f"{m.group(1)} {_UNITS[m.group(2)]}",
        out,
    )
    # Ensembles de solutions : « S = { −7 ; −1 } » → « l'ensemble formé de −7 et −1 ».
    out = re.sub(
        r"\{\s*([^{}]*?)\s*\}",
        lambda m: "l'ensemble formé de " + re.sub(r"\s*;\s*", " et ", m.group(1)),
        out,
    )
    out = out.replace("∅", "l'ensemble vide")
    # Puissances écrites avec ^ : « a^(m+n) » → « a puissance m plus n ».
    out = re.sub(r"\^\(([^()]+)\)", r" puissance \1 ", out)
    out = re.sub(r"\^2\b", " au carré", out)
    out = re.sub(r"\^3\b", " au cube", out)
    out = re.sub(r"\^(-?\w+)", r" puissance \1", out)
    # Probabilités conditionnelles : « P_L(C) » → « la probabilité de C sachant L ».
    out = re.sub(r"P_(\w+)\(([^()]+)\)", r"la probabilité de \2 sachant \1", out)
    # Puissances en exposants (10⁻³, 2⁵) : « 10 puissance moins 3 ».
    out = re.sub(
        r"([0-9a-zA-Z)])([⁰¹⁴⁵⁶⁷⁸⁹⁻][⁰¹²³⁴⁵⁶⁷⁸⁹]*|[²³][⁰¹²³⁴⁵⁶⁷⁸⁹]+)",
        lambda m: (
            f"{m.group(1)} puissance {m.group(2).translate(_SUPERSCRIPTS).replace('-', 'moins ')}"
        ),
        out,
    )
    # Fractions écrites a/b (pas les dates ni les unités comme km/h).
    out = re.sub(r"(?<![\w/])(-?\d+)\s*/\s*(\d+)(?![\w/])", r"\1 sur \2", out)
    # Valeur absolue |x − 3|.
    out = re.sub(r"\|([^|]+)\|", r"la valeur absolue de \1,", out)
    # Intervalles : « ]2 ; 5] » → « de 2 exclu à 5 inclus ».
    out = re.sub(r"([\[\]])\s*([^;\[\]]+?)\s*;\s*([^;\[\]]+?)\s*([\[\]])", _interval, out)
    # Siècles en chiffres romains : « IVe siècle av. J.-C. » → « quatrième siècle avant J.-C. »,
    # lu ensuite « avant Jésus-Christ ».
    out = re.sub(r"\b([IVXL]+)(er|e) (siècles?|millénaires?)\b", _century, out)
    out = re.sub(r"\bav\. J\.-C\.", "avant Jésus-Christ", out)
    out = re.sub(r"\b(?:apr\.|après) J\.-C\.", "après Jésus-Christ", out)
    # Vitesse sans nombre devant : « en km/h ? » → « en kilomètres par heure ? ».
    out = re.sub(r"(?<![\w/])(km/h|m/s|m/min)(?![\w/])", lambda m: _UNITS[m.group(1)], out)
    for symbol, word in _WORDS:
        out = out.replace(symbol, word)
    out = re.sub(r"(?<=\d)-(?=\d)", " moins ", out)  # 7-3
    out = re.sub(r"(?<![\w])-(?=\d)", "moins ", out)  # -5 (trait d'union utilisé comme signe)
    out = re.sub(r"(\d)([a-z])\b", r"\1 \2", out)  # 4x → 4 x
    return re.sub(r"\s+", " ", out).strip()


def _interval(m: re.Match) -> str:
    left = "inclus" if m.group(1) == "[" else "exclu"
    right = "inclus" if m.group(4) == "]" else "exclu"
    return f"l'intervalle de {m.group(2)} {left} à {m.group(3)} {right}"


def latex(formula: str) -> str:
    """Formule LaTeX (sous-ensemble produit par les générateurs) → texte lu."""
    out = formula
    # Fractions, les plus internes d'abord.
    frac = re.compile(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}")
    # Exposants d'abord : ils peuvent se trouver dans une fraction (\frac{3^{8}}{3^{5}}).
    out = re.sub(r"\^(?:\{2\}|2(?!\d))", " au carré ", out)
    out = re.sub(r"\^(?:\{3\}|3(?!\d))", " au cube ", out)
    out = re.sub(r"\^\{([^{}]*)\}|\^(\w)", lambda m: f" puissance {m.group(1) or m.group(2)} ", out)
    out = re.sub(r"\\sqrt\{([^{}]*)\}", r" racine de \1 ", out)
    while frac.search(out):
        out = frac.sub(lambda m: f" {_group(m.group(1))} sur {_group(m.group(2))} ", out)
    replacements = {
        r"\left(": " ouvrir la parenthèse, ",
        r"\right)": ", fermer la parenthèse ",
        r"\left[": " crochet ",
        r"\right]": " crochet ",
        r"\times": " fois ",
        r"\div": " divisé par ",
        r"\cdot": " fois ",
        r"\leq": " inférieur ou égal à ",
        r"\geq": " supérieur ou égal à ",
        r"\le": " inférieur ou égal à ",
        r"\ge": " supérieur ou égal à ",
        r"\neq": " différent de ",
        r"\quad": ", ",
        r"\square": " case vide ",
        r"\pi": " pi ",
    }
    for command, word in replacements.items():
        out = out.replace(command, word)
    out = out.replace("{", " ").replace("}", " ").replace("\\", " ")
    out = out.replace("(", " ouvrir la parenthèse, ").replace(")", ", fermer la parenthèse ")
    out = out.replace("=", " égale ").replace("+", " plus ")
    out = out.replace("<", " inférieur à ").replace(">", " supérieur à ")
    out = re.sub(r"(?<=[\w)])\s*-\s*", " moins ", out)
    out = re.sub(r"-", " moins ", out)
    out = out.replace("/", " sur ")
    out = re.sub(r"(\d)([a-z])\b", r"\1 \2", out)
    return re.sub(r"\s+", " ", out).strip(" ,")


def _group(part: str) -> str:
    """Numérateur ou dénominateur lu : simple tel quel, composé entre « la quantité »."""
    clean = part.strip()
    return clean if re.fullmatch(r"-?[\w.,]+", clean) else f"la quantité {clean}, "


# Matière (2e segment du code de notion) → langue de sa voix.
LANGUAGE_SUBJECTS = {
    "anglais": "en-GB",
    "espagnol": "es-ES",
    "allemand": "de-DE",
    "italien": "it-IT",
}
_PUNCTUATION = " .,:;?!…"
_FOREIGN = re.compile(r"“([^”]*)”|\"([^\"]*)\"")


def foreign_lang(item: dict[str, Any]) -> str:
    """Langue étrangère d'un item de langue vivante, "" sinon."""
    for notion in item.get("notions") or [item.get("notion", "")]:
        parts = str(notion).split(".")
        if len(parts) > 1 and parts[1] in LANGUAGE_SUBJECTS:
            return LANGUAGE_SUBJECTS[parts[1]]
    listen = item.get("listen")
    if isinstance(listen, dict) and listen.get("lang"):
        return str(listen["lang"])
    return ""


def parts(value: str, lang: str) -> list[list[str]]:
    """Morceaux lus d'un texte : “ … ” dans la langue étrangère, le reste en français."""
    out: list[list[str]] = []
    position = 0
    for match in _FOREIGN.finditer(value):
        before = text(value[position : match.start()])
        if before.strip(_PUNCTUATION):
            out.append([before.strip(), "fr-FR"])
        # Un trou à compléter (« She ___ a cat ») devient une courte pause.
        quoted = " ".join(re.sub(r"_{2,}", " … ", match.group(1) or match.group(2) or "").split())
        if quoted.strip(_PUNCTUATION):
            out.append([quoted, lang])
        position = match.end()
    rest = text(value[position:])
    if rest.strip(_PUNCTUATION):
        out.append([rest.strip(), "fr-FR"])
    return out


def for_item(item: dict[str, Any]) -> dict[str, Any]:
    """Textes lus d'un item tel qu'envoyé au client."""
    prompt = text(item.get("prompt", ""))
    if item.get("latex"):
        prompt = f"{prompt} {latex(item['latex'])}"
    speech: dict[str, Any] = {"prompt": prompt}
    if item.get("choices"):
        speech["choices"] = [text(c) for c in item["choices"]]
    for key in ("hint", "explanation"):
        if item.get(key):
            speech[key] = text(item[key])
    lang = foreign_lang(item)
    if lang:
        for key in ("prompt", "explanation"):
            if item.get(key) and _FOREIGN.search(str(item[key])):
                speech[f"{key}_parts"] = parts(str(item[key]), lang)
    return speech
