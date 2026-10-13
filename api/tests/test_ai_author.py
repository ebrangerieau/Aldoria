"""Questions proposées par l'IA : appel à Claude (simulé), conversion au format de la banque,
validation, brouillons, quota par famille, aucune donnée d'enfant envoyée."""

import json
from types import SimpleNamespace

import pytest

from app import accounts
from app.config import get_settings
from app.engine import ai_author
from app.main import app
from app.models import Adult
from app.routers import admin_content
from tests.test_admin import ADMIN, admin_settings, parent  # noqa: F401 (fixture)

NOTION = "6e.anglais.vocabulaire.animaux"


def _question(**fields):
    base = {
        "type": "mcq",
        "difficulty": 2,
        "prompt": "Que veut dire « dog » ?",
        "choices": ["chien", "chat", "cheval"],
        "answer_index": 0,
        "verdict": False,
        "accepted": [],
        "accents": False,
        "value": "",
        "hint": "Un animal qui aboie.",
        "explanation": "« dog » veut dire « chien ».",
        "listen_text": "",
        "listen_lang": "",
    }
    return base | fields


GOOD = [
    _question(),
    _question(
        prompt="Écoute et choisis le bon mot.", listen_text="horse", listen_lang="en-GB",
        choices=["cheval", "vache", "mouton"],
    ),
    _question(type="text", prompt="Écris en anglais : « chat »", choices=[], accepted=["cat"]),
    _question(type="order", prompt="Du plus petit au plus grand.", choices=["mouse", "cat", "cow"]),
    _question(choices=["chien", "chat"], answer_index=7),  # bonne réponse inexistante
]  # fmt: skip


class FakeMessages:
    def __init__(self, questions=None, stop_reason="end_turn", error=None):
        self.calls = []
        self.questions = questions if questions is not None else GOOD
        self.stop_reason = stop_reason
        self.error = error

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        text = json.dumps({"questions": self.questions})
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            content=[SimpleNamespace(type="text", text=text)],
            usage=SimpleNamespace(input_tokens=2_000, output_tokens=3_000),
        )


@pytest.fixture
def fake_ai():
    fake = SimpleNamespace(beta=SimpleNamespace(messages=FakeMessages()))
    app.dependency_overrides[admin_content.get_ai] = lambda: fake
    yield fake.beta.messages
    app.dependency_overrides.pop(admin_content.get_ai, None)


async def test_disabled_without_api_key(client, curriculum):
    status = (await client.get(f"{ADMIN}/ai-questions", headers=parent())).json()
    assert status["enabled"] is False
    response = await client.post(
        f"{ADMIN}/ai-questions", json={"level": "6e", "notion": NOTION}, headers=parent()
    )
    assert response.status_code == 503 and response.json()["error"]["code"] == "ai_disabled"


async def test_proposals_become_drafts_after_validation(client, curriculum, profiles, fake_ai):
    response = await client.post(
        f"{ADMIN}/ai-questions",
        json={
            "level": "6e",
            "notion": NOTION,
            "count": 5,
            "instructions": "Vocabulaire de la ferme.",
        },
        headers=parent(),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert len(body["created"]) == 4
    assert {row["status"] for row in body["created"]} == {"brouillon"}
    assert {row["source"] for row in body["created"]} == {"ia"}
    assert len(body["rejected"]) == 1
    assert "aucune proposition" in " ".join(body["rejected"][0]["errors"])

    bank = (await client.get(f"{ADMIN}/bank?level=6e", headers=parent())).json()
    listening = next(r for r in bank if r["summary"].startswith("Écoute"))
    full = (await client.get(f"{ADMIN}/bank/{listening['id']}", headers=parent())).json()
    assert full["question"]["listen"] == {"text": "horse", "lang": "en-GB"}
    ordered = next(r for r in bank if r["type"] == "order")
    order = (await client.get(f"{ADMIN}/bank/{ordered['id']}", headers=parent())).json()
    choices, expected = order["question"]["choices"], order["question"]["answer"]["value"]
    assert [choices[i] for i in expected] == ["mouse", "cat", "cow"], "ordre rétabli"
    assert choices != ["mouse", "cat", "cow"], "présenté mélangé"

    # Ce qui part chez Anthropic : modèle, repli en cas de refus, sortie structurée, consigne.
    call = fake_ai.calls[0]
    assert call["model"] == "claude-sonnet-5-5"
    assert call["output_config"]["effort"] == "medium"
    assert call["fallbacks"] == "default" and ai_author.FALLBACK_BETA in call["betas"]
    assert call["output_config"]["format"]["type"] == "json_schema"
    sent = json.dumps(call, ensure_ascii=False)
    assert "Les animaux" in sent and "6ème" in sent and "Vocabulaire de la ferme." in sent
    assert "Jules" not in sent and "Tom" not in sent, "aucune donnée d'enfant"


async def test_lesson_photo_is_sent_as_an_image(client, curriculum, fake_ai):
    await client.post(
        f"{ADMIN}/ai-questions",
        json={
            "level": "6e",
            "notion": NOTION,
            "count": 2,
            "image_base64": "aGVsbG8=",
            "image_type": "image/jpeg",
            "material_text": "The farm: cow, pig, sheep.",
        },
        headers=parent(),
    )
    content = fake_ai.calls[0]["messages"][0]["content"]
    assert content[0]["type"] == "image"
    assert content[0]["source"] == {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": "aGVsbG8=",
    }
    assert "The farm" in content[-1]["text"]


async def test_daily_quota_and_refusals(client, curriculum, fake_ai, monkeypatch):
    monkeypatch.setenv("ALDORIA_AI_DAILY_LIMIT", "2")
    get_settings.cache_clear()
    url, body = f"{ADMIN}/ai-questions", {"level": "6e", "notion": NOTION, "count": 1}
    fake_ai.stop_reason = "refusal"
    refused = await client.post(url, json=body, headers=parent())
    assert refused.status_code == 422 and refused.json()["error"]["code"] == "ai_refused"
    fake_ai.stop_reason = "end_turn"
    assert (await client.post(url, json=body, headers=parent())).status_code == 201
    over = await client.post(url, json=body, headers=parent())
    assert over.status_code == 429 and over.json()["error"]["code"] == "ai_quota"
    status = (await client.get(url, headers=parent())).json()
    assert status == {"enabled": True, "limit": 2, "remaining": 0}


async def test_notion_must_belong_to_the_class(client, curriculum, fake_ai):
    response = await client.post(
        f"{ADMIN}/ai-questions", json={"level": "2nde", "notion": NOTION}, headers=parent()
    )
    assert response.status_code == 422
    assert not fake_ai.calls


async def test_operator_sees_ai_usage(client, curriculum, fake_ai, sessionmaker):
    body = {"level": "6e", "notion": NOTION, "count": 1}
    await client.post(f"{ADMIN}/ai-questions", json=body, headers=parent())
    async with sessionmaker() as db:
        (await db.get(Adult, 1)).is_operator = True
        await db.commit()
    families = (await client.get(f"{ADMIN}/families", headers=parent())).json()
    assert families[0]["ai_requests_month"] == 1
    assert families[0]["ai_cost_month_usd"] == round(ai_author.cost_usd(2_000, 3_000), 2)


def test_conversion_of_each_format():
    text = ai_author.to_bank(_question(type="text", accepted=["élève", " "], accents=True), "n")
    assert text["answer"] == {"kind": "text", "value": ["élève"], "accents": True}
    verdict = ai_author.to_bank(
        _question(type="true_false", verdict=True, answer_index=2, choices=["a", "b", "c"]), "n"
    )
    assert verdict["answer"] == {"kind": "true_false", "value": True, "reason": 2}
    number = ai_author.to_bank(_question(type="numeric", value="3/4"), "n")
    assert number["answer"] == {"kind": "fraction", "value": "3/4"}
    assert "listen" not in number
    assert accounts  # module chargé (cookies des tests)


def test_cost_follows_the_model():
    assert ai_author.cost_usd(1_000_000, 1_000_000, "claude-sonnet-5-5") == 12.0
    assert ai_author.cost_usd(1_000_000, 1_000_000, "claude-opus-5-5") == 24.0
    # Modèle inconnu : estimation haute plutôt qu'un coût sous-estimé.
    assert ai_author.cost_usd(1_000_000, 0, "modele-inconnu") == 10.0
