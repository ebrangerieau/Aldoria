"""Voix neuronale : l'API vérifie l'enfant, demande le son au service de voix (simulé ici),
le garde en cache, et se retire proprement quand la voix n'est pas installée."""

import httpx
import pytest

from app.config import get_settings
from app.main import app
from app.routers import speech

API = "/api/v1/play"


class FakeVoice:
    """Service de voix simulé : compte les demandes, rend un faux MP3."""

    def __init__(self, status: int = 200):
        self.calls: list[dict] = []
        self.status = status

    async def post(self, url: str, json: dict) -> httpx.Response:
        self.calls.append({"url": url, **json})
        return httpx.Response(
            self.status, content=b"ID3-faux-mp3", headers={"content-type": "audio/mpeg"}
        )


@pytest.fixture
def voice(monkeypatch, tmp_path):
    fake = FakeVoice()
    monkeypatch.setenv("ALDORIA_VOICE_URL", "http://voice:8000")
    monkeypatch.setenv("ALDORIA_VOICE_CACHE_DIR", str(tmp_path))
    get_settings.cache_clear()

    async def _client():
        yield fake

    app.dependency_overrides[speech.get_voice_client] = _client
    yield fake
    app.dependency_overrides.pop(speech.get_voice_client, None)
    get_settings.cache_clear()


async def test_speech_needs_a_child(client, voice):
    response = await client.post(f"{API}/speech", json={"text": "Bonjour."})
    assert response.status_code == 401
    assert voice.calls == []


async def test_speech_is_made_once_then_cached(client, login, voice):
    headers = await login("jules", "1234")
    body = {"text": "Calcule  trois quarts\n plus un huitième.", "lang": "fr-FR"}
    first = await client.post(f"{API}/speech", json=body, headers=headers)
    assert first.status_code == 200
    assert first.headers["content-type"] == "audio/mpeg"
    assert first.content == b"ID3-faux-mp3"
    assert voice.calls[0]["url"] == "http://voice:8000/synthese"
    assert voice.calls[0]["text"] == "Calcule trois quarts plus un huitième.", "espaces réduits"
    again = await client.post(f"{API}/speech", json=body, headers=headers)
    assert again.content == first.content
    assert len(voice.calls) == 1, "le même texte n'est fabriqué qu'une fois"
    slower = await client.post(f"{API}/speech", json=body | {"rate": 0.85}, headers=headers)
    assert slower.status_code == 200
    assert len(voice.calls) == 2, "autre vitesse : autre son"


async def test_english_listening_and_unknown_language(client, login, voice):
    headers = await login("jules", "1234")
    english = await client.post(
        f"{API}/speech", json={"text": "horse", "lang": "en-GB", "rate": 0.85}, headers=headers
    )
    assert english.status_code == 200
    assert voice.calls[0]["lang"] == "en-GB"
    spanish = await client.post(
        f"{API}/speech", json={"text": "Pferd", "lang": "de-DE"}, headers=headers
    )
    assert spanish.status_code == 404
    assert spanish.json()["error"]["code"] == "voice_lang"


async def test_without_voice_service_the_game_falls_back(client, login, monkeypatch):
    monkeypatch.setenv("ALDORIA_VOICE_URL", "")
    get_settings.cache_clear()
    headers = await login("jules", "1234")
    response = await client.post(f"{API}/speech", json={"text": "Bonjour."}, headers=headers)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "voice_off"
    get_settings.cache_clear()


async def test_voice_service_error_is_a_503(client, login, voice):
    voice.status = 500
    headers = await login("jules", "1234")
    response = await client.post(f"{API}/speech", json={"text": "Bonjour."}, headers=headers)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "voice_down"


async def test_text_length_is_limited(client, login, voice):
    headers = await login("jules", "1234")
    response = await client.post(f"{API}/speech", json={"text": "a" * 801}, headers=headers)
    assert response.status_code == 422
    assert voice.calls == []
