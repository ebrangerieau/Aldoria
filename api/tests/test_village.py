"""Phase 3, village : quêtes des habitants (révision, veille de contrôle) et enquêtes
de Tom sur un document (relevé statistique, tableau croisé)."""

from fractions import Fraction

from app.engine import answers
from app.engine.generators import REGISTRY
from tests.test_admin import ADMIN, admin_settings, parent  # noqa: F401 (fixture)

API = "/api/v1/play"
ENQUETES = ["2nde.statistiques.enquete", "2nde.probabilites.enquete"]


def _value(text):
    return Fraction(text.replace(",", ".").replace(" ", ""))


def test_document_is_shared_by_the_three_questions_of_a_quest():
    for code in ENQUETES:
        gen = REGISTRY[code]
        assert gen.shared_document and not gen.combat
        for seed in range(300):
            documents = {str(gen.item(d, seed).visual) for d in range(1, 6)}
            assert len(documents) == 1, (code, seed)


def test_survey_answers_recomputed_from_the_table():
    gen = REGISTRY["2nde.statistiques.enquete"]
    for seed in range(1000):
        for difficulty in range(1, 6):
            item = gen.item(difficulty, seed)
            rows = item.visual["rows"]
            values = [int(v) for v in rows[0][1:]]
            counts = [int(n) for n in rows[1][1:]]
            total = sum(counts)
            data = sorted(v for v, n in zip(values, counts, strict=True) for _ in range(n))
            pick = item.meta["pick"]
            expected = {
                1: Fraction(total),
                2: Fraction(100 * counts[pick], total),
                3: Fraction(100 * sum(counts[: pick + 1]), total),
                4: Fraction(sum(data), total),
                5: (
                    Fraction(data[total // 2])
                    if total % 2
                    else Fraction(data[total // 2 - 1] + data[total // 2], 2)
                ),
            }[difficulty]
            assert _value(item.answer.value) == expected, item.id
            assert answers.check(item.answer.model_dump(), item.answer.value)
            if difficulty in (2, 3):
                assert str(values[pick]) in item.prompt


def test_cross_table_answers_recomputed_from_the_table():
    gen = REGISTRY["2nde.probabilites.enquete"]
    for seed in range(1000):
        for difficulty in range(1, 6):
            item = gen.item(difficulty, seed)
            rows = item.visual["rows"]
            (a, b, ab), (c, d, cd), (ac, bd, total) = (
                [int(x) for x in row[1:]] for row in rows[1:]
            )
            assert (a + b, c + d, a + c, b + d, a + b + c + d) == (ab, cd, ac, bd, total)
            expected = {
                1: Fraction(a + b, total),
                2: Fraction(a, total),
                3: Fraction(a, a + b),
                4: Fraction(a, a + c),
                5: Fraction(a + b + c, total),
            }[difficulty]
            assert Fraction(item.answer.value) == expected, item.id


async def test_village_pack_has_quests_in_groups_of_three(client, login, curriculum):
    headers = await login("tom", "9876")
    body = (
        await client.post(
            f"{API}/session/start",
            json={
                "mode": "village",
                "enigmas": [{"generator": code, "count": 6} for code in ENQUETES],
            },
            headers=headers,
        )
    ).json()
    for code in ENQUETES:
        quest = [i for i in body["items"] if i["generator"] == code]
        assert len(quest) == 6 and all(i["role"] == "enigme" for i in quest)
        for group in (quest[:3], quest[3:]):
            assert len({str(i["visual"]) for i in group}) == 1, "un document par quête"
            levels = [i["difficulty"] for i in group]
            assert levels == list(range(levels[0], levels[0] + 3))
        assert len({i["id"] for i in quest}) == 6
    assert body["context"] == {"test_soon": [], "current": []}


async def test_context_names_the_chapters_set_by_the_parent(client, login, profiles, curriculum):
    for code, status in (
        ("6e.maths.angles", "controle_bientot"),
        ("6e.maths.fractions", "en_cours"),
    ):
        response = await client.put(
            f"{ADMIN}/profiles/{profiles['jules']}/chapters/{code}",
            json={"status": status},
            headers=parent(),
        )
        assert response.status_code == 200
    headers = await login("jules", "1234")
    body = (
        await client.post(f"{API}/session/start", json={"mode": "village"}, headers=headers)
    ).json()
    assert body["context"]["test_soon"] == [
        {"code": "6e.maths.angles", "title": "Angles et triangles"}
    ]
    assert [c["code"] for c in body["context"]["current"]] == ["6e.maths.fractions"]
    # Contrôle bientôt : l'essentiel des questions « chapitre » porte sur ce chapitre.
    chapter_items = [i for i in body["items"] if i["category"] == "chapitre"]
    on_angles = [i for i in chapter_items if i["notions"][0].startswith("6e.maths.angles.")]
    assert len(on_angles) > len(chapter_items) / 2
