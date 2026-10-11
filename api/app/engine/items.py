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


Answer = Annotated[
    ChoiceAnswer | NumberAnswer | FractionAnswer | ExpressionAnswer | VectorAnswer,
    Field(discriminator="kind"),
]

ItemType = Literal["mcq", "numeric", "expression", "vector"]
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
    generator: str | None = None
    seed: int | None = None
    # Données internes du générateur (valeurs tirées), utiles aux tests ; ignorées par le client.
    meta: dict[str, Any] = {}
