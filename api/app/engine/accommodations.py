"""Aménagements d'un enfant (accessibilité, troubles « dys »), réglés par le parent
dans l'espace parent et appliqués par le jeu sur tous les appareils.

Aucun diagnostic n'est enregistré : seulement les réglages. Les préréglages
(Dyslexie, Dyscalculie, Dyspraxie, Attention) sont proposés par l'espace parent.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class Accommodations(BaseModel):
    # Lecture
    read_aloud: bool = False  # bouton « Écouter » (énoncé, propositions, explication)
    auto_read: bool = False  # lecture automatique de chaque question
    text_size: int = Field(default=0, ge=0, le=2)  # 0 normal, 1 grand, 2 très grand
    spacing: bool = False  # lettres, mots et lignes plus espacés
    readable_font: bool = False  # police très lisible (Atkinson Hyperlegible)
    # Calcul
    no_speed: bool = False  # aucune pénalité ni récompense liée à la vitesse
    math_tools: bool = False  # table de multiplication et tableau de numération à la demande
    easy_start: bool = False  # difficulté de départ un cran plus bas
    # Gestes
    tap_only: bool = False  # déplacement par toucher seulement (pas de joystick)
    big_targets: bool = False  # boutons agrandis
    # Attention
    calm: bool = False  # ni secousses, ni ralentis, moins de particules, sons plus doux
    pause_minutes: int = Field(default=0, ge=0, le=60)  # rappel de pause (0 : aucun)
    # Couleurs
    colorblind: bool = False  # juste/faux aussi par icône et texte, couleurs adaptées


def of(raw: dict[str, Any] | None) -> Accommodations:
    """Aménagements enregistrés (champs inconnus ou manquants : valeurs par défaut)."""
    try:
        return Accommodations.model_validate(raw or {})
    except ValueError:
        return Accommodations()
