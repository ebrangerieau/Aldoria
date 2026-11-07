"""Accessibilité (troubles « dys ») : texte lu à voix haute pour chaque question,
aménagements réglés par le parent et transmis au jeu, maîtrise sans pénalité de lenteur."""

import re

import pytest

from app.engine import mastery, session_pack, speech
from app.engine.generators import REGISTRY
from tests.test_admin import ADMIN, PLAY, admin_settings, parent  # noqa: F401 (fixture)
from tests.test_tracking import _attempt


@pytest.mark.parametrize(
    ("formula", "spoken"),
    [
        (r"\frac{15}{8} + \frac{2}{8}", "15 sur 8 plus 2 sur 8"),
        (r"4\left(4x-8\right)", "4 ouvrir la parenthèse, 4 x moins 8, fermer la parenthèse"),
        (r"\left(x+1\right)^2", "ouvrir la parenthèse, x plus 1, fermer la parenthèse au carré"),
        (r"3x+3 \leq 27", "3 x plus 3 inférieur ou égal à 27"),
        (r"\frac{1}{2} \div 4", "1 sur 2 divisé par 4"),
        (r"5x^{2}-2x", "5 x au carré moins 2 x"),
    ],
)
def test_formulas_are_read_in_words(formula, spoken):
    assert speech.latex(formula) == spoken


@pytest.mark.parametrize(
    ("shown", "spoken"),
    [
        ("Calcule 2⁵ × 10⁻³.", "Calcule 2 puissance 5 fois 10 puissance moins 3."),
        ("x ∈ ]−∞ ; 2]", "x appartient à l'intervalle de moins l'infini exclu à 2 inclus"),
        ("|x − 3| ≤ 2", "la valeur absolue de x moins 3, inférieur ou égal à 2"),
        ("Convertis : 9,46 cL = ... L", "Convertis : 9,46 centilitres égale ... litres"),
        ("Compare 3/4 et 0,75.", "Compare 3 sur 4 et 0,75."),
        ("arrive-t-il ?\navancer de 1", "arrive-t-il ? avancer de 1"),
        ("le IVe siècle av. J.-C.", "le quatrième siècle avant Jésus-Christ"),
        ("le Ier siècle", "le premier siècle"),
        ("le XXIe siècle", "le vingt et unième siècle"),
        ("le XXXVe siècle av. J.-C.", "le trente-cinquième siècle avant Jésus-Christ"),
        ("en 476 après J.-C.", "en 476 après Jésus-Christ"),
    ],
)
def test_symbols_are_read_in_words(shown, spoken):
    assert speech.text(shown) == spoken


def test_every_generated_item_can_be_read_aloud():
    leftovers = re.compile(r"[\\{}^_]|\bfrac\b|\bleft\b|\bright\b|[×÷−≤≥√∞]")
    for code, generator in REGISTRY.items():
        for difficulty in range(1, 6):
            for seed in range(20):
                data = session_pack.item_data(generator.item(difficulty, seed), "chapitre", {})
                said = data["speech"]
                assert said["prompt"].strip(), code
                texts = [said["prompt"], said.get("explanation", ""), *said.get("choices", [])]
                for text in texts:
                    found = leftovers.search(text)
                    # « left », « right » : des mots anglais dans un item de langue vivante.
                    english = speech.foreign_lang(data) and found and found[0] in ("left", "right")
                    assert not found or english, (code, text)
                if data.get("choices"):
                    assert len(said["choices"]) == len(data["choices"])


async def test_parent_sets_accommodations_and_the_game_receives_them(
    client, login, profiles, curriculum
):
    url = f"{ADMIN}/profiles/{profiles['jules']}/accommodations"
    bad = await client.put(url, json={"text_size": 5}, headers=parent())
    assert bad.status_code == 422
    chosen = {"read_aloud": True, "spacing": True, "no_speed": True, "pause_minutes": 15}
    saved = (await client.put(url, json=chosen, headers=parent())).json()["accommodations"]
    assert saved["read_aloud"] and saved["pause_minutes"] == 15 and saved["calm"] is False

    response = await client.post(
        f"{PLAY}/login", json={"profile_id": profiles["jules"], "pin": "1234"}
    )
    assert response.json()["accommodations"]["spacing"] is True
    headers = {"Authorization": f"Bearer {response.json()['token']}"}
    me = (await client.get(f"{PLAY}/me", headers=headers)).json()
    assert me["accommodations"]["no_speed"] is True and me["profile"]["name"] == "Jules"
    started = (await client.post(f"{PLAY}/session/start", headers=headers)).json()
    assert started["settings"]["accommodations"]["read_aloud"] is True
    assert all("speech" in item for item in started["items"])
    # Les autres enfants ne sont pas concernés.
    other = await login("tom", "9876")
    assert (await client.get(f"{PLAY}/me", headers=other)).json()["accommodations"][
        "read_aloud"
    ] is False


async def test_slowness_does_not_lower_mastery_with_no_speed(client, login, profiles, curriculum):
    async def mastery_after_slow_answer(name, pin):
        headers = await login(name, pin)
        session_id = (await client.post(f"{PLAY}/session/start", headers=headers)).json()[
            "session_id"
        ]
        slow = _attempt(session_id) | {"time_ms": 120000, "time_target_ms": 40000}
        await client.post(f"{PLAY}/attempts", json={"attempts": [slow]}, headers=headers)
        chapters = (await client.get(f"{PLAY}/progress", headers=headers)).json()["chapters"]
        notions = {n["code"]: n for ch in chapters for n in ch["notions"]}
        return notions["6e.maths.fractions.addition"]["mastery"]

    penalised = await mastery_after_slow_answer("jules", "1234")
    await client.post(
        f"{ADMIN}/profiles/{profiles['jules']}/reset", json={"confirm": "jules"}, headers=parent()
    )
    await client.put(
        f"{ADMIN}/profiles/{profiles['jules']}/accommodations",
        json={"no_speed": True},
        headers=parent(),
    )
    spared = await mastery_after_slow_answer("jules", "1234")
    assert spared > penalised
    assert spared == pytest.approx(mastery.update(0.0, True, False, 1000, 40000, 2), abs=0.5)


def test_english_inside_a_french_sentence_is_read_in_english():
    from app.engine import speech
    from app.engine.generators import REGISTRY

    item = REGISTRY["6e.anglais.animaux"].item(2, 7).model_dump()
    said = speech.for_item(item)
    english = item["meta"]["english"]
    assert said["prompt_parts"] == [["Que veut dire", "fr-FR"], [english, "en-GB"]]
    assert [english, "en-GB"] in said["explanation_parts"]
    assert all(lang == "fr-FR" for text, lang in said["explanation_parts"] if "«" in text)


def test_quoted_english_in_a_bank_question_and_blanks():
    from app.engine import speech

    item = {
        "notions": ["6e.anglais.grammaire.be"],
        "prompt": 'Complète : "She ___ a cat." avec « être ».',
    }
    assert speech.for_item(item)["prompt_parts"] == [
        ["Complète :", "fr-FR"],
        ["She … a cat.", "en-GB"],
        ["avec « être ».", "fr-FR"],
    ]
    maths = {"notions": ["6e.maths.fractions.addition"], "prompt": 'Calcule "3/4 + 1/4".'}
    assert "prompt_parts" not in speech.for_item(maths), "les maths restent en un seul morceau"
