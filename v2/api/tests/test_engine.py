import random
from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest

from app.engine import mastery, selector
from app.engine.scheduler import LeitnerScheduler

NOW = datetime(2026, 10, 11, 18, 0, tzinfo=UTC)


# --- Leitner (TRD §5.3) --------------------------------------------------------------


@pytest.mark.parametrize(
    "box, correct, hint, expected_box, days",
    [
        (1, True, False, 2, 3),
        (4, True, False, 5, 60),
        (5, True, False, 5, 60),  # plafond
        (3, True, True, 3, 7),  # indice : boîte inchangée
        (4, False, False, 1, 1),  # erreur : retour en boîte 1
    ],
)
def test_leitner(box, correct, hint, expected_box, days):
    review = LeitnerScheduler().review(box, correct, hint, NOW)
    assert review.box == expected_box
    assert review.due_at == NOW + timedelta(days=days)


# --- Maîtrise (TRD §5.4) ---------------------------------------------------------------


def test_mastery_formula():
    # α = 0,25 × (0,6 + 0,1 × 1) = 0,175
    assert mastery.update(0, True, False, 5000, 20000, 1) == pytest.approx(17.5)
    # indice : gain × 0,6
    assert mastery.update(0, True, True, 5000, 20000, 1) == pytest.approx(10.5)
    # 3 × le temps cible : gain × 0,7
    assert mastery.update(0, True, False, 60000, 20000, 1) == pytest.approx(12.25)
    # erreur : la maîtrise décroît
    assert mastery.update(80, False, False, 5000, 20000, 5) == pytest.approx(80 * (1 - 0.275))


def test_mastery_converges_with_successes():
    m = 0.0
    for _ in range(20):
        m = mastery.update(m, True, False, 5000, 20000, 3)
    assert m > 95


@pytest.mark.parametrize(
    "m, seen, stars", [(0, 0, 0), (10, 2, 1), (39.9, 5, 1), (40, 5, 2), (74, 5, 2), (75, 5, 3)]
)
def test_stars(m, seen, stars):
    assert mastery.stars(m, seen) == stars


# --- Sélecteur (TRD §5.5) ---------------------------------------------------------------

NOTIONS = [
    selector.NotionInfo("f.addition", "fractions", False),
    selector.NotionInfo("f.produit", "fractions", False),
    selector.NotionInfo("p.balance", "prealgebre", False),
    selector.NotionInfo("f.comparaison", "fractions", True),
]
RATIOS = (0.5, 0.3, 0.2)


def _select(progress=None, status=None, recent=None, seed=1):
    return selector.select(
        NOTIONS, progress or {}, status or {}, recent or [], RATIOS, NOW, random.Random(seed)
    )


def test_pack_size_and_mix_with_due_reviews():
    progress = {"p.balance": selector.NotionProgress(50, 3, NOW - timedelta(days=2))}
    slots = _select(progress, {"fractions": "en_cours"})
    assert len(slots) == 60
    categories = Counter(s.category for s in slots)
    assert categories == {"chapitre": 30, "revision": 18, "automatisme": 12}
    assert {s.notion for s in slots if s.category == "chapitre"} <= {"f.addition", "f.produit"}
    assert {s.notion for s in slots if s.category == "revision"} == {"p.balance"}


def test_no_review_due_gives_its_share_to_others():
    categories = Counter(s.category for s in _select(status={"fractions": "en_cours"}))
    assert categories["revision"] == 0
    assert categories["chapitre"] + categories["automatisme"] == 60
    assert categories["chapitre"] > categories["automatisme"]


def test_without_parent_settings_all_notions_are_current():
    notions = {s.notion for s in _select() if s.category == "chapitre"}
    assert notions == {"f.addition", "f.produit", "p.balance"}


def test_test_soon_takes_70_percent():
    slots = _select(status={"fractions": "en_cours", "prealgebre": "controle_bientot"})
    chapter = [s for s in slots if s.category == "chapitre"]
    # Au moins 70 % (la part des révisions, sans révision due, revient au chapitre).
    assert len(chapter) >= 42
    assert {s.notion for s in chapter} == {"p.balance"}


def test_low_mastery_is_prioritised():
    progress = {
        "f.addition": selector.NotionProgress(95, 20, NOW + timedelta(days=30)),
        "f.produit": selector.NotionProgress(5, 3, NOW + timedelta(days=1)),
    }
    slots = _select(progress, {"fractions": "en_cours"})
    counts = Counter(s.notion for s in slots if s.category == "chapitre")
    assert counts["f.produit"] > counts["f.addition"]


def test_difficulty_follows_mastery_and_success_rate():
    progress = {"f.addition": selector.NotionProgress(80, 10, NOW + timedelta(days=5))}
    slots = _select(progress, {"fractions": "en_cours"})
    hard = [s.difficulty for s in slots if s.notion == "f.addition"]
    easy = [s.difficulty for s in slots if s.notion == "f.produit"]
    assert min(hard) >= 3 and max(easy) <= 2
    struggling = _select(progress, {"fractions": "en_cours"}, recent=[False] * 12 + [True] * 8)
    assert max(s.difficulty for s in struggling if s.notion == "f.addition") <= 4


def test_difficulty_shift_needs_history():
    assert selector.difficulty_shift([True] * 5) == 0
    assert selector.difficulty_shift([True] * 20) == 1
    assert selector.difficulty_shift([True] * 15 + [False] * 5) == 0  # 75 %
    assert selector.difficulty_shift([False] * 10 + [True] * 10) == -1


def test_never_more_than_three_in_a_row():
    for seed in range(30):
        slots = _select(seed=seed)
        run = 1
        for previous, current in zip(slots, slots[1:], strict=False):
            run = run + 1 if previous.notion == current.notion else 1
            assert run <= 3, f"graine {seed}"
