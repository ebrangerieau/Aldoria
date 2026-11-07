import json
from pathlib import Path

import pytest

from app.engine import answers, mathexpr

VECTORS = Path(__file__).resolve().parents[2] / "content" / "test-vectors" / "answers.json"
CASES = json.loads(VECTORS.read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["note"] for c in CASES])
def test_shared_vectors(case):
    assert answers.check(case["answer"], case["input"]) is case["expected"]


@pytest.mark.parametrize(
    "text, x, expected",
    [
        ("2x+1", 3, 7),
        ("x^2", -2, 4),
        ("-x^2", 2, -4),
        ("2^-1", 0, 0.5),
        ("(x+1)(x-1)", 3, 8),
        ("6/2(1+2)", 0, 9),
        ("√(x+5)", 4, 3),
        ("x²", 3, 9),
    ],
)
def test_evaluate(text, x, expected):
    assert mathexpr.evaluate(mathexpr.parse(text), {"x": x}) == pytest.approx(expected)


@pytest.mark.parametrize("text", ["", "2+", "(x", "x)", "2**3", "3 $ 4"])
def test_invalid_expressions(text):
    with pytest.raises(mathexpr.ExprError):
        mathexpr.parse(text)
