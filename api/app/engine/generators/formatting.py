"""Mise en forme commune aux générateurs (écriture française)."""

from __future__ import annotations

from fractions import Fraction


def fr_number(value: float | Fraction | int, max_decimals: int = 4) -> str:
    """1.2 → « 1,2 » ; 3.0 → « 3 » ; -0.05 → « −0,05 » (signe moins typographique)."""
    text = f"{float(value):.{max_decimals}f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    if text in ("-0", ""):
        text = "0"
    return text.replace(".", ",").replace("-", "−")


def frac_text(value: Fraction) -> str:
    """Fraction → « 3/4 » (ou « 2 » si entière). Forme attendue dans `answer.value`."""
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


def frac_latex(num: int, den: int) -> str:
    sign = "-" if num * den < 0 else ""
    return f"{sign}\\frac{{{abs(num)}}}{{{abs(den)}}}"


def frac_plain(num: int, den: int) -> str:
    return f"{num}/{den}"
