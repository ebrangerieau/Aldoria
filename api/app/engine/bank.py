"""Banque de questions rédigées (PRD US-10) : validation d'une question saisie ou
importée par le parent, lecture des imports CSV et JSON (rapport ligne par ligne).

Une question de la banque a la même forme qu'un item généré (engine/items.py) ; elle
n'entre dans les paquets de jeu qu'une fois publiée (session_pack.build_items).

Format JSON : une liste d'objets
    {"notion", "type", "difficulty", "prompt", "latex"?, "choices"?, "answer", "hint"?,
     "explanation", "role"?, "time_target_ms"?}
où `answer` suit engine/items.py (ex. {"kind": "choice", "index": 0}).

Format CSV (tableur, séparateur « ; » ou « , », première ligne d'en-têtes) :
    notion ; type ; difficulte ; enonce ; formule ; choix ; reponse ; indice ; explication
- `choix` : propositions séparées par « | » (QCM, justifications d'un vrai/faux) ;
- `reponse` : QCM → numéro du bon choix (1, 2…) ; nombre → « 12,5 » ou « 3/4 » ;
  expression → « x^2+6x+9 » ; vrai/faux → « vrai | 2 » (verdict | numéro de la justification) ;
  texte → réponses acceptées séparées par « | » (« mum | mom »).
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from app.engine import answers
from app.engine.formulas import render_svg
from app.engine.items import Item

TYPES = ("mcq", "numeric", "expression", "true_false", "order", "text")
MAX_IMPORT_BYTES = 5 * 1024 * 1024
MAX_IMPORT_LINES = 2000
DEFAULT_TIME_MS = 30000
CSV_COLUMNS = (
    "notion",
    "type",
    "difficulte",
    "enonce",
    "formule",
    "choix",
    "reponse",
    "indice",
    "explication",
)


@dataclass
class Checked:
    """Résultat de validation : `data` (champs de l'item) si aucune erreur."""

    data: dict[str, Any] | None = None
    errors: list[str] = field(default_factory=list)


def validate(raw: dict[str, Any], notions: dict[str, tuple[str, bool]], level: str) -> Checked:
    """Valide une question. `notions` : code → (niveau, est un automatisme)."""
    errors: list[str] = []
    notion = str(raw.get("notion", "")).strip()
    if notion not in notions:
        errors.append(f"notion inconnue : « {notion} »")
    elif notions[notion][0] != level:
        errors.append(f"la notion « {notion} » n'est pas du niveau {level}")
    kind = raw.get("type")
    if kind not in TYPES:
        errors.append(f"type inconnu : « {kind} » (attendu : {', '.join(TYPES)})")
    prompt = str(raw.get("prompt") or "").strip()
    if not prompt:
        errors.append("énoncé vide")
    explanation = str(raw.get("explanation") or "").strip()
    if not explanation:
        errors.append("explication vide (elle s'affiche après une erreur)")
    if errors:
        return Checked(errors=errors)

    automatism = notions[notion][1]
    fields = {
        "type": kind,
        "difficulty": raw.get("difficulty"),
        "notions": [notion],
        "role": raw.get("role") or ("automatisme" if automatism else "chapitre"),
        "prompt": prompt,
        "latex": (str(raw.get("latex")).strip() or None) if raw.get("latex") else None,
        "choices": raw.get("choices") or None,
        "answer": raw.get("answer"),
        "hint": str(raw.get("hint") or "").strip(),
        "explanation": explanation,
        "time_target_ms": raw.get("time_target_ms") or DEFAULT_TIME_MS,
        "listen": raw.get("listen") or None,
        "generator": "banque",
    }
    try:
        item = Item(id="banque:0", **fields)
    except ValidationError as exc:
        return Checked(errors=[_pydantic_message(e) for e in exc.errors()])
    errors += _coherence(item)
    if item.latex:
        try:
            render_svg(item.latex)
        except Exception:  # noqa: BLE001 — toute erreur de rendu = formule à corriger
            errors.append(f"formule illisible : « {item.latex} »")
    if errors:
        return Checked(errors=errors)
    data = item.model_dump(exclude={"id", "seed", "meta", "game_modes", "visual"})
    if data.get("listen") is None:
        data.pop("listen", None)
    return Checked(data=data)


_FIELD_NAMES = {
    "difficulty": "difficulté",
    "answer": "réponse",
    "choices": "choix",
    "role": "rôle",
    "time_target_ms": "temps cible",
    "latex": "formule",
}


def _pydantic_message(error: Any) -> str:
    loc = [str(p) for p in error.get("loc", ())]
    label = _FIELD_NAMES.get(loc[0], loc[0]) if loc else "champ"
    return f"{label} : {error.get('msg', 'valeur invalide')}"


def _coherence(item: Item) -> list[str]:
    """La réponse attendue correspond au type et se vérifie elle-même."""
    answer = item.answer
    choices = item.choices or []
    expected = {
        "mcq": "choice",
        "true_false": "true_false",
        "order": "order",
        "expression": "expression",
        "text": "text",
    }.get(item.type)
    if item.type == "numeric" and answer.kind not in ("number", "fraction"):
        return ["une question « nombre » attend une réponse nombre ou fraction"]
    if expected and answer.kind != expected:
        return [f"le type « {item.type} » attend une réponse « {expected} »"]
    if item.type == "mcq":
        if not 2 <= len(choices) <= 6:
            return ["un QCM a de 2 à 6 propositions"]
        if len(set(choices)) != len(choices):
            return ["deux propositions identiques"]
        if not 0 <= answer.index < len(choices):
            return ["le numéro de la bonne réponse ne correspond à aucune proposition"]
        return []
    if item.type == "true_false":
        if len(choices) != 3:
            return ["un vrai/faux justifié propose 3 justifications"]
        if not 0 <= answer.reason < 3:
            return ["le numéro de la justification ne correspond à aucune proposition"]
        return []
    if item.type == "order":
        if sorted(answer.value) != list(range(len(choices))) or len(choices) < 2:
            return ["l'ordre attendu doit citer chaque proposition une fois"]
        return []
    if item.type == "text":
        if not all(v.strip() for v in answer.value):
            return ["une réponse acceptée est vide"]
        if not answers.check(answer.model_dump(), answer.value[0]):
            return [f"la réponse « {answer.value[0]} » n'est pas lisible par le jeu"]
        return []
    if not answers.check(answer.model_dump(), answer.value):
        return [f"la réponse « {answer.value} » n'est pas lisible par le jeu"]
    return []


# --- Imports ------------------------------------------------------------------------------


def parse_import(content: str, fmt: str) -> tuple[list[tuple[int, dict[str, Any] | str]], str]:
    """Lignes à valider : (numéro, question brute ou message d'erreur de lecture), et une
    erreur globale éventuelle (fichier illisible)."""
    if len(content.encode("utf-8")) > MAX_IMPORT_BYTES:
        return [], "fichier trop lourd (5 Mo au maximum)"
    if fmt == "json":
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            return [], f"JSON illisible (ligne {exc.lineno}) : {exc.msg}"
        if isinstance(data, dict):
            data = data.get("items", [data])
        if not isinstance(data, list):
            return [], "le JSON doit contenir une liste de questions"
        rows: list[tuple[int, dict[str, Any] | str]] = [
            (i + 1, q if isinstance(q, dict) else "pas un objet JSON") for i, q in enumerate(data)
        ]
        return rows[:MAX_IMPORT_LINES], ""
    return _parse_csv(content)


def _parse_csv(content: str) -> tuple[list[tuple[int, dict[str, Any] | str]], str]:
    text = content.lstrip("﻿")
    try:
        dialect = csv.Sniffer().sniff(text.splitlines()[0] if text else "", delimiters=";,\t")
    except csv.Error:
        dialect = csv.excel
        dialect.delimiter = ";"
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = [h.strip().lower() for h in reader.fieldnames or []]
    missing = [c for c in ("notion", "type", "difficulte", "enonce", "reponse") if c not in headers]
    if missing:
        return (
            [],
            f"colonnes manquantes : {', '.join(missing)} (attendu : {' ; '.join(CSV_COLUMNS)})",
        )
    rows: list[tuple[int, dict[str, Any] | str]] = []
    for number, row in enumerate(reader, start=2):
        cells = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        if not any(cells.values()):
            continue
        try:
            rows.append((number, _csv_question(cells)))
        except ValueError as exc:
            rows.append((number, str(exc)))
        if len(rows) >= MAX_IMPORT_LINES:
            break
    return rows, ""


def _csv_question(cells: dict[str, str]) -> dict[str, Any]:
    kind = cells.get("type", "").lower()
    kind = {
        "qcm": "mcq",
        "nombre": "numeric",
        "vrai_faux": "true_false",
        "ordre": "order",
        "texte": "text",
    }.get(kind, kind)
    choices = [c.strip() for c in cells.get("choix", "").split("|") if c.strip()]
    answer_text = cells.get("reponse", "")
    try:
        difficulty: Any = int(cells.get("difficulte", ""))
    except ValueError:
        raise ValueError(f"difficulté illisible : « {cells.get('difficulte', '')} »") from None
    if kind == "mcq":
        answer: dict[str, Any] = {"kind": "choice", "index": _number(answer_text) - 1}
    elif kind == "true_false":
        verdict, _, reason = answer_text.partition("|")
        if verdict.strip().lower() not in ("vrai", "faux"):
            raise ValueError("réponse d'un vrai/faux : « vrai | 2 » ou « faux | 1 »")
        answer = {
            "kind": "true_false",
            "value": verdict.strip().lower() == "vrai",
            "reason": _number(reason) - 1,
        }
    elif kind == "order":
        answer = {"kind": "order", "value": [_number(x) - 1 for x in answer_text.split("|")]}
    elif kind == "expression":
        answer = {"kind": "expression", "value": answer_text}
    elif kind == "text":
        # « dog | doggy » : formes acceptées ; accents comptés (orthographe).
        answer = {"kind": "text", "value": [v.strip() for v in answer_text.split("|") if v.strip()]}
    else:
        frac = "/" in answer_text
        answer = {"kind": "fraction" if frac else "number", "value": answer_text}
    return {
        "notion": cells.get("notion", ""),
        "type": kind,
        "difficulty": difficulty,
        "prompt": cells.get("enonce", ""),
        "latex": cells.get("formule", "") or None,
        "choices": choices or None,
        "answer": answer,
        "hint": cells.get("indice", ""),
        "explanation": cells.get("explication", ""),
    }


def _number(text: str) -> int:
    try:
        return int(text.strip())
    except ValueError:
        raise ValueError(f"numéro attendu, lu « {text.strip()} »") from None


def summary(data: dict[str, Any]) -> str:
    prompt = str(data.get("prompt", ""))
    return prompt if len(prompt) <= 90 else prompt[:87] + "…"
