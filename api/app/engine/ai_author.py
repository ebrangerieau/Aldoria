"""Questions proposées par l'IA (Claude), relues par le parent avant publication.

Le parent choisit une notion de la classe de l'enfant, un nombre de questions et,
s'il le veut, joint la leçon (texte ou photo). Claude rédige des questions au format
de la banque ; chacune repasse par `engine/bank.py` (même validation qu'une question
saisie à la main, réponse qui se vérifie elle-même) et entre en **brouillon**.

Ce qui part chez Anthropic : la classe, la matière, la notion, la consigne et le
matériel joint par le parent. Jamais de prénom, de réponse ni de donnée d'un enfant.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from typing import Any, Protocol

import anthropic

MODEL = "claude-sonnet-5-5"
# Effort de réflexion : « medium » laisse le modèle vérifier ses réponses sans gonfler le coût.
EFFORT = "medium"
EFFORTS = ("low", "medium", "high", "xhigh", "max")
# Prix d'Anthropic en dollars par million de jetons (entrée, sortie) : estimation du coût
# affichée à l'exploitant. Modèle absent de la table : prix du plus cher (estimation haute).
PRICES_PER_MTOK = {
    "claude-haiku-5-5": (0.10, 0.50),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-fable-5-1": (10.0, 50.0),
}
MAX_QUESTIONS = 10
MAX_MATERIAL_CHARS = 20_000
FALLBACK_BETA = "server-side-fallback-2026-07-01"
LANGS = ["", "en-GB", "en-US", "es-ES", "de-DE", "fr-FR"]
TYPES = ["mcq", "true_false", "order", "text", "numeric"]

SYSTEM = """Tu rédiges des questions de révision pour « Les Chroniques d'Aldoria », un jeu \
éducatif pour des collégiens et lycéens français. Chaque question devient un combat, une \
énigme ou une quête : elle doit être juste, claire et sans ambiguïté.

Règles :
- Conforme au programme officiel de la classe indiquée, au niveau de cette classe.
- Énoncés courts, une idée par phrase (des enfants « dys » jouent aussi), tutoiement.
- Une seule bonne réponse. Intrus plausibles, tirés d'erreurs fréquentes.
- Indice : met sur la voie sans donner la réponse.
- Explication (affichée après une erreur) : une ou deux phrases bienveillantes qui montrent \
pourquoi.
- Pas de formule LaTeX : écris les fractions « 3/4 » et les puissances « x² ».
- Aucune donnée personnelle. Si le matériel fourni contient des noms ou des informations \
sur des personnes, ignore-les.
- Si une leçon est fournie, appuie-toi d'abord sur elle.

Formats (champ `type`) ; les champs inutiles restent vides (chaîne vide, liste vide, 0, \
false) :
- mcq : `choices` = 3 ou 4 propositions, `answer_index` = rang de la bonne (0 = première).
- true_false : `prompt` = une affirmation ; `verdict` = vrai ou faux ; `choices` = exactement \
3 justifications dont une seule juste, `answer_index` = son rang.
- order : `choices` = 3 à 5 éléments donnés DANS LE BON ORDRE (le jeu les mélange).
- text : réponse écrite d'un ou quelques mots ; `accepted` = toutes les formes correctes ; \
`accents` = true en français (orthographe), false pour une langue étrangère.
- numeric (maths) : `value` = la réponse, « 12,5 » ou « 3/4 ».
Langues vivantes : tout mot ou phrase dans la langue étrangère s'écrit entre guillemets anglais \
“ ” (il est lu par une voix de cette langue) ; un mot français cité s'écrit entre « ».
Écoute (langues vivantes) : `listen_text` = mot ou phrase prononcé par l'appareil, jamais \
écrit dans `prompt` ; `listen_lang` = sa langue (en-GB pour l'anglais). Sinon chaînes vides.
`difficulty` : de 1 (facile) à 5 (difficile)."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": TYPES},
                    "difficulty": {"type": "integer"},
                    "prompt": {"type": "string"},
                    "choices": {"type": "array", "items": {"type": "string"}},
                    "answer_index": {"type": "integer"},
                    "verdict": {"type": "boolean"},
                    "accepted": {"type": "array", "items": {"type": "string"}},
                    "accents": {"type": "boolean"},
                    "value": {"type": "string"},
                    "hint": {"type": "string"},
                    "explanation": {"type": "string"},
                    "listen_text": {"type": "string"},
                    "listen_lang": {"type": "string", "enum": LANGS},
                },
                "required": [
                    "type", "difficulty", "prompt", "choices", "answer_index", "verdict",
                    "accepted", "accents", "value", "hint", "explanation", "listen_text",
                    "listen_lang",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questions"],
    "additionalProperties": False,
}  # fmt: skip

# Formats conseillés selon la matière (le parent peut demander autre chose dans la consigne).
ADVICE = {
    "anglais": "Varie : QCM dans les deux sens, écoute (listen_lang en-GB), réponse écrite "
    "(accents false), vrai/faux justifié sur une règle de grammaire, remise en ordre des "
    "mots d'une phrase (avec sa traduction).",
    "francais": "Varie : QCM, vrai/faux justifié, réponse écrite (accents true) pour "
    "l'orthographe ou un terme d'analyse, remise en ordre (chronologie, étapes).",
    "maths": "Varie : QCM, nombre ou fraction (numeric), vrai/faux justifié.",
    "sciences": "Varie : QCM (vocabulaire, expériences, phénomènes), nombre (conversions, "
    "vitesse = distance ÷ durée), remise en ordre (chaîne alimentaire, cycle de vie, frise du "
    "vivant), vrai/faux justifié ; températures écrites en toutes lettres (« 100 degrés »).",
    "physique_chimie": "Varie : QCM (vocabulaire, phénomènes, expériences), nombre (masse "
    "volumique, concentration, vitesse, P = m × g, loi d'Ohm, f = 1 ÷ T, avec une tolérance si "
    "arrondi), remise en ordre (échelles, sons du grave à l'aigu) ; formules chimiques avec "
    "indices "
    "(H₂O) et charges (Ca²⁺), équations avec ⟶ ; unité demandée en toutes lettres, températures "
    "en toutes lettres.",
    "histoire_geo": "Varie : QCM (dates, personnages, vocabulaire), remise en ordre (frise "
    "chronologique), vrai/faux justifié ; dates des manuels, « vers » si approximative, "
    "« av. J.-C. » écrit ainsi.",
}


def cost_usd(input_tokens: int, output_tokens: int, model: str = MODEL) -> float:
    price_in, price_out = PRICES_PER_MTOK.get(model, max(PRICES_PER_MTOK.values()))
    return (input_tokens * price_in + output_tokens * price_out) / 1_000_000


class AiUnavailable(Exception):
    """Service indisponible (clé absente ou refusée, réseau, quota d'Anthropic)."""


class AiRefused(Exception):
    """Claude a refusé la demande (consigne ou matériel jugé inapproprié)."""


@dataclass
class Request:
    level_label: str
    subject: str  # code (« anglais »)
    subject_label: str
    chapter: str
    notion_code: str
    notion_label: str
    count: int
    difficulty: int | None = None
    instructions: str = ""
    material_text: str = ""
    image_base64: str = ""
    image_type: str = ""


@dataclass
class Draft:
    raw: list[dict[str, Any]] = field(default_factory=list)  # questions au format de la banque
    input_tokens: int = 0
    output_tokens: int = 0


class Client(Protocol):
    beta: Any


def client(api_key: str) -> Client:
    return anthropic.AsyncAnthropic(api_key=api_key, max_retries=2, timeout=180.0)


def user_content(req: Request) -> list[dict[str, Any]]:
    difficulty = (
        f"difficulté {req.difficulty} sur 5 pour toutes"
        if req.difficulty
        else "difficultés variées, de 1 à 5"
    )
    lines = [
        f"Classe : {req.level_label}. Matière : {req.subject_label}.",
        f"Chapitre : {req.chapter}. Notion : {req.notion_label}.",
        f"Rédige {req.count} questions, {difficulty}.",
        ADVICE.get(req.subject, ADVICE["maths"]),
    ]
    if req.instructions.strip():
        lines.append(f"Consigne du parent : {req.instructions.strip()[:1000]}")
    if req.material_text.strip():
        lines.append(
            "Leçon fournie par le parent :\n" + req.material_text.strip()[:MAX_MATERIAL_CHARS]
        )
    content: list[dict[str, Any]] = []
    if req.image_base64:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": req.image_type,
                    "data": req.image_base64,
                },
            }
        )
        lines.append("La photo jointe est la leçon (ou l'exercice) sur laquelle t'appuyer.")
    content.append({"type": "text", "text": "\n".join(lines)})
    return content


async def propose(ai: Client, req: Request, model: str = MODEL, effort: str = EFFORT) -> Draft:
    """Questions proposées par Claude, converties au format de la banque (non validées)."""
    try:
        response = await ai.beta.messages.create(
            model=model,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": SCHEMA},
            },
            system=SYSTEM,
            messages=[{"role": "user", "content": user_content(req)}],
        )
    except anthropic.APIConnectionError as exc:
        raise AiUnavailable("Le service d'IA ne répond pas : réessayez dans un instant.") from exc
    except anthropic.RateLimitError as exc:
        raise AiUnavailable(
            "Le service d'IA est saturé : réessayez dans quelques minutes."
        ) from exc
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as exc:
        raise AiUnavailable("La clé d'API de l'IA est refusée : prévenez l'exploitant.") from exc
    except anthropic.BadRequestError as exc:
        raise AiUnavailable(f"Demande refusée par le service d'IA : {exc.message}") from exc
    except anthropic.APIStatusError as exc:
        raise AiUnavailable(f"Erreur du service d'IA ({exc.status_code}).") from exc

    draft = Draft(
        input_tokens=int(getattr(response.usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(response.usage, "output_tokens", 0) or 0),
    )
    if response.stop_reason == "refusal":
        raise AiRefused("L'IA a refusé cette demande : reformulez la consigne ou changez de leçon.")
    if response.stop_reason == "max_tokens":
        raise AiUnavailable("Réponse trop longue : demandez moins de questions à la fois.")
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        questions = json.loads(text)["questions"]
    except (ValueError, KeyError, TypeError) as exc:
        raise AiUnavailable("Réponse de l'IA illisible : réessayez.") from exc
    draft.raw = [to_bank(q, req.notion_code) for q in questions[: req.count] if isinstance(q, dict)]
    return draft


def to_bank(q: dict[str, Any], notion: str) -> dict[str, Any]:
    """Question de Claude → question brute de la banque (validée ensuite par bank.validate)."""
    kind = str(q.get("type", ""))
    choices = [str(c).strip() for c in q.get("choices") or [] if str(c).strip()]
    raw: dict[str, Any] = {
        "notion": notion,
        "type": kind,
        "difficulty": q.get("difficulty"),
        "prompt": str(q.get("prompt", "")).strip(),
        "hint": str(q.get("hint", "")).strip(),
        "explanation": str(q.get("explanation", "")).strip(),
        "choices": None,
    }
    if kind == "mcq":
        raw |= {"choices": choices, "answer": {"kind": "choice", "index": q.get("answer_index")}}
    elif kind == "true_false":
        raw |= {
            "choices": choices,
            "answer": {
                "kind": "true_false",
                "value": bool(q.get("verdict")),
                "reason": q.get("answer_index"),
            },
        }
    elif kind == "order":
        # Mélange stable (même texte, même ordre affiché) : le jeu attend l'ordre d'origine.
        shown = list(range(len(choices)))
        random.Random("|".join(choices)).shuffle(shown)
        if shown == sorted(shown) and len(shown) > 1:
            shown.reverse()
        raw |= {
            "choices": [choices[i] for i in shown],
            "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(choices))]},
        }
    elif kind == "text":
        accepted = [str(a).strip() for a in q.get("accepted") or [] if str(a).strip()]
        raw["answer"] = {"kind": "text", "value": accepted, "accents": bool(q.get("accents", True))}
    else:
        value = str(q.get("value", "")).strip()
        raw["answer"] = {"kind": "fraction" if "/" in value else "number", "value": value}
    listen_text = str(q.get("listen_text", "")).strip()
    if listen_text and q.get("listen_lang"):
        raw["listen"] = {"text": listen_text, "lang": q["listen_lang"]}
    return raw
