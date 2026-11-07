"""Format d'un item (question), TRD §5.1. Source de vérité du schéma JSON
(exporté dans content/schemas/ par tools/export_schemas.py)."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


class ChoiceAnswer(BaseModel):
    kind: Literal["choice"] = "choice"
    index: int


class NumberAnswer(BaseModel):
    kind: Literal["number"] = "number"
    value: str
    tolerance: float = 0.0


class FractionAnswer(BaseModel):
    kind: Literal["fraction"] = "fraction"
    value: str
    accept_equivalent: bool = True
    require_irreducible: bool = False


class ExpressionAnswer(BaseModel):
    kind: Literal["expression"] = "expression"
    value: str
    variable: str = "x"
    form: Literal["expanded", "factored"] | None = None


class VectorAnswer(BaseModel):
    """Coordonnées (x ; y) d'un vecteur, chaque composante comparée comme un nombre."""

    kind: Literal["vector"] = "vector"
    value: list[str] = Field(min_length=2, max_length=2)


class OrderAnswer(BaseModel):
    """Ordre attendu des choix (indices dans `choices`), du premier au dernier."""

    kind: Literal["order"] = "order"
    value: list[int] = Field(min_length=2)


class TrueFalseAnswer(BaseModel):
    """Vrai ou faux, puis la bonne justification (indice dans `choices`)."""

    kind: Literal["true_false"] = "true_false"
    value: bool
    reason: int


class SignsAnswer(BaseModel):
    """Tableau de signes, cases lues ligne par ligne (« + » ou « - »)."""

    kind: Literal["signs"] = "signs"
    value: list[Literal["+", "-"]] = Field(min_length=2)


class TextAnswer(BaseModel):
    """Réponse écrite : une des formes acceptées (answers.normalize_text). `accents` : les
    accents comptent (orthographe) ; faux pour une langue étrangère tapée sans accents."""

    kind: Literal["text"] = "text"
    value: list[str] = Field(min_length=1, max_length=10)
    accents: bool = True


class Listen(BaseModel):
    """Texte lu à voix haute par la synthèse vocale de l'appareil dans `lang` (écoute en
    langue étrangère : il ne fait pas partie de l'énoncé affiché)."""

    text: str = Field(min_length=1, max_length=300)
    lang: Literal["fr-FR", "en-GB", "en-US", "es-ES", "de-DE"]


Answer = Annotated[
    ChoiceAnswer
    | NumberAnswer
    | FractionAnswer
    | ExpressionAnswer
    | VectorAnswer
    | OrderAnswer
    | TrueFalseAnswer
    | SignsAnswer
    | TextAnswer,
    Field(discriminator="kind"),
]

# number_line : placer un point sur une droite graduée (réponse fraction) ;
# order : remettre des éléments dans l'ordre (réponse order).
# true_false : vrai/faux puis justification ; sign_table : tableau de signes à compléter ;
# text : réponse écrite au clavier (langues, orthographe).
ItemType = Literal[
    "mcq",
    "numeric",
    "expression",
    "vector",
    "number_line",
    "order",
    "true_false",
    "sign_table",
    "text",
]
# Rôle dans le combat : « automatisme » = Frappe (rapide), « chapitre » = Sort (puissant).
Role = Literal["automatisme", "chapitre"]


class Item(BaseModel):
    id: str
    type: ItemType
    difficulty: int = Field(ge=1, le=5)
    notions: list[str]
    role: Role
    prompt: str
    latex: str | None = None
    choices: list[str] | None = None
    answer: Answer
    hint: str
    explanation: str
    time_target_ms: int
    game_modes: list[str] = ["combat"]
    # Données d'illustration pour le client (plateaux d'une balance, points d'un repère…).
    visual: dict[str, Any] | None = None
    # Écoute en langue étrangère (bouton « Écouter » ; le texte n'est pas affiché).
    listen: Listen | None = None
    # Langue des propositions quand elle n'est pas le français (lecture à voix haute).
    choices_lang: Literal["fr-FR", "en-GB", "en-US", "es-ES", "de-DE"] | None = None
    generator: str | None = None
    seed: int | None = None
    # Données internes du générateur (valeurs tirées), utiles aux tests ; ignorées par le client.
    meta: dict[str, Any] = {}
