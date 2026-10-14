"""Service de voix des Chroniques d'Aldoria : synthèse vocale neuronale (Piper), en interne.

Reçoit un texte et une langue, rend un MP3. N'est joignable que par l'API (réseau Docker
interne, pas de route Traefik) : c'est l'API qui vérifie l'enfant connecté et garde les
fichiers en cache (api/app/routers/speech.py).

Voix (téléchargées à la construction de l'image, deploy/voice.Dockerfile) :
- français : fr_FR-siwis-medium (jeu de données SIWIS, CC BY 4.0) ;
- anglais : en_GB-alba-medium (jeu de données Alba, CC BY 4.0).
Moteur : piper-tts (GPL-3.0), utilisé tel quel dans ce conteneur.
"""

from __future__ import annotations

import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import lameenc
import onnxruntime
from fastapi import FastAPI, HTTPException, Response
from piper import PiperVoice, SynthesisConfig
from pydantic import BaseModel, Field

VOICES_DIR = Path("/voix")
VOICES = {"fr": "fr_FR-siwis-medium", "en": "en_GB-alba-medium"}
MP3_KBPS = 48
# Fils de calcul : par défaut, onnxruntime en lance un par cœur de la machine hôte, ce qui
# s'étrangle sous la limite de processeur du conteneur (docker-compose : cpus).
THREADS = int(os.environ.get("VOICE_THREADS", "1"))

_loaded: dict[str, PiperVoice] = {}


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Voix chargées au démarrage : la première phrase lue n'attend pas (≈ 5 s par voix).
    for family in VOICES:
        _voice(family)
    yield


app = FastAPI(title="Aldoria – voix", lifespan=lifespan)
# Une synthèse à la fois : le VPS n'a que deux cœurs, l'API et la base doivent rester vives.
_lock = threading.Lock()


class Demande(BaseModel):
    text: str = Field(min_length=1, max_length=800)
    lang: str = Field(default="fr-FR", max_length=10)
    rate: float = Field(default=1.0, ge=0.5, le=1.5)  # 0,85 = plus lent (écoute en anglais)


def _voice(lang: str) -> PiperVoice:
    family = lang[:2].lower()
    if family not in VOICES:
        raise HTTPException(404, f"Pas de voix pour la langue {lang}.")
    if family not in _loaded:
        model = str(VOICES_DIR / f"{VOICES[family]}.onnx")
        voice = PiperVoice.load(model)
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = THREADS
        options.inter_op_num_threads = 1
        voice.session = onnxruntime.InferenceSession(
            model, sess_options=options, providers=["CPUExecutionProvider"]
        )
        _loaded[family] = voice
    return _loaded[family]


@app.get("/sante")
def sante() -> dict[str, object]:
    return {"status": "ok", "langues": sorted(VOICES)}


@app.post("/synthese")
def synthese(demande: Demande) -> Response:
    """MP3 mono du texte lu dans sa langue (fonction synchrone : exécutée hors de la boucle)."""
    voice = _voice(demande.lang)
    config = SynthesisConfig(length_scale=1.0 / demande.rate)
    with _lock:
        chunks = list(voice.synthesize(demande.text, syn_config=config))
    if not chunks:
        raise HTTPException(422, "Rien à lire.")
    pcm = b"".join(chunk.audio_int16_bytes for chunk in chunks)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(MP3_KBPS)
    encoder.set_in_sample_rate(chunks[0].sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    mp3 = encoder.encode(pcm) + encoder.flush()
    return Response(content=bytes(mp3), media_type="audio/mpeg")
