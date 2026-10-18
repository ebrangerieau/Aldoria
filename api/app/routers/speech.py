"""Voix neuronale du jeu (lecture à voix haute, exercices d'écoute).

Le jeu envoie le texte à lire ; l'API vérifie l'enfant connecté, demande le son au service
de voix interne (Piper, voice/app.py) et garde chaque fichier en cache : un même texte n'est
fabriqué qu'une fois. Sans service de voix (ALDORIA_VOICE_URL vide) ou s'il ne répond pas,
la route renvoie 503 et le jeu se rabat sur la voix de l'appareil.

Seuls des textes du jeu passent ici (énoncés, histoire, répliques) : jamais de réponse ni de
donnée d'un enfant ; tout reste sur le serveur de la famille.
"""

from __future__ import annotations

import hashlib
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.auth import CurrentProfile
from app.config import get_settings
from app.errors import ApiError

router = APIRouter(prefix="/play", tags=["voix"])

LANGS = {"fr", "en", "es"}
# À changer quand les voix changent : les sons déjà fabriqués ne servent plus.
VOICE_VERSION = "piper-1"
TIMEOUT_S = 20.0


class SpeechIn(BaseModel):
    text: str = Field(min_length=1, max_length=800)
    lang: str = Field(default="fr-FR", pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    rate: float = Field(default=1.0, ge=0.5, le=1.5)


async def get_voice_client() -> AsyncIterator[httpx.AsyncClient]:
    """Client du service de voix (remplacé dans les tests)."""
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
        yield client


VoiceClient = Annotated[httpx.AsyncClient, Depends(get_voice_client)]


def cache_key(text: str, lang: str, rate: float) -> str:
    return hashlib.sha256(f"{VOICE_VERSION}|{lang}|{rate:.2f}|{text}".encode()).hexdigest()


@router.post("/speech", response_class=Response, responses={200: {"content": {"audio/mpeg": {}}}})
async def speech(body: SpeechIn, profile: CurrentProfile, voice: VoiceClient) -> Response:
    settings = get_settings()
    if not settings.voice_url:
        raise ApiError(503, "voice_off", "Voix du serveur non installée.")
    family = body.lang[:2]
    if family not in LANGS:
        raise ApiError(404, "voice_lang", "Pas de voix du serveur pour cette langue.")
    text = " ".join(body.text.split())
    rate = round(body.rate, 2)
    key = cache_key(text, family, rate)
    path = Path(settings.voice_cache_dir) / key[:2] / f"{key}.mp3"
    headers = {"Cache-Control": "private, max-age=31536000, immutable"}
    if path.is_file():
        return Response(path.read_bytes(), media_type="audio/mpeg", headers=headers)
    try:
        answer = await voice.post(
            f"{settings.voice_url.rstrip('/')}/synthese",
            json={"text": text, "lang": body.lang, "rate": rate},
        )
    except httpx.HTTPError as exc:
        raise ApiError(503, "voice_down", "Le service de voix ne répond pas.") from exc
    if answer.status_code != 200 or answer.headers.get("content-type") != "audio/mpeg":
        raise ApiError(503, "voice_down", "Le service de voix n'a pas pu lire ce texte.")
    _store(path, answer.content)
    return Response(answer.content, media_type="audio/mpeg", headers=headers)


def _store(path: Path, data: bytes) -> None:
    """Écrit le son en cache (nom temporaire puis renommage : jamais de fichier à moitié écrit)."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(f".{os.getpid()}.part")
        temporary.write_bytes(data)
        temporary.replace(path)
    except OSError:
        pass  # cache indisponible : le son est quand même rendu
