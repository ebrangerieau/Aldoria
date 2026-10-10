"""Synthétise les effets sonores du prototype dans game/assets/sfx/ (WAV mono 16 bits).

Principe du PRD §9 : sons de réussite très gratifiants, son d'erreur doux.
Bibliothèque standard uniquement. Usage : python tools/make_sfx.py
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / "game" / "assets" / "sfx"


def note(name: str) -> float:
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    semitone = names[name[0]] + (1 if "#" in name else 0)
    octave = int(name[-1])
    return 440.0 * 2 ** ((semitone + 12 * (octave - 4)) / 12)


def envelope(i: int, n: int, attack: float = 0.01, release: float = 0.3) -> float:
    t = i / RATE
    total = n / RATE
    a = min(1.0, t / attack) if attack > 0 else 1.0
    r = min(1.0, (total - t) / release) if release > 0 else 1.0
    return max(0.0, a * r)


def tone(freq: float, dur: float, vol: float = 0.5, harmonics=(1.0, 0.3, 0.1), release: float = 0.25):
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        s = sum(h * math.sin(2 * math.pi * freq * (k + 1) * t) for k, h in enumerate(harmonics))
        out.append(vol * envelope(i, n, 0.005, release) * s / sum(harmonics))
    return out


def sequence(notes: list[str], step: float, dur: float, vol: float = 0.45, **kw):
    total = int((step * (len(notes) - 1) + dur) * RATE)
    out = [0.0] * total
    for k, name in enumerate(notes):
        start = int(k * step * RATE)
        for i, s in enumerate(tone(note(name), dur, vol, **kw)):
            out[start + i] += s
    return out


def noise_burst(dur: float, vol: float, cutoff_start: float, cutoff_end: float, seed: int):
    rng = random.Random(seed)
    n = int(dur * RATE)
    out, y = [], 0.0
    for i in range(n):
        cutoff = cutoff_start + (cutoff_end - cutoff_start) * i / n
        alpha = 1 - math.exp(-2 * math.pi * cutoff / RATE)
        y += alpha * (rng.uniform(-1, 1) - y)
        out.append(vol * envelope(i, n, 0.003, dur * 0.7) * y * 3)
    return out


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(n)]


def thump(freq_start: float, freq_end: float, dur: float, vol: float):
    n = int(dur * RATE)
    out, phase = [], 0.0
    for i in range(n):
        f = freq_start + (freq_end - freq_start) * i / n
        phase += 2 * math.pi * f / RATE
        out.append(vol * envelope(i, n, 0.002, dur * 0.8) * math.sin(phase))
    return out


def save(name: str, samples: list[float]) -> None:
    peak = max(1e-9, max(abs(s) for s in samples))
    gain = min(1.0, 0.9 / peak)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(s * gain * 32767)) for s in samples))
    print(f"{name}.wav  {len(samples) / RATE:.2f} s")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    save("click", tone(1400, 0.04, 0.3, harmonics=(1.0,), release=0.03))
    save("correct", sequence(["C6", "E6", "G6"], 0.07, 0.25, harmonics=(1.0, 0.4, 0.15)))
    save("crit", mix(
        sequence(["C6", "E6", "G6", "C7"], 0.06, 0.35, harmonics=(1.0, 0.5, 0.2)),
        noise_burst(0.5, 0.15, 6000, 9000, 1),
    ))
    # Erreur douce : deux notes graves et rondes, jamais agressives.
    save("wrong", sequence(["G4", "E4"], 0.14, 0.3, vol=0.35, harmonics=(1.0, 0.1)))
    save("hit", mix(noise_burst(0.15, 0.6, 2500, 400, 2), thump(180, 60, 0.15, 0.8)))
    save("hurt", mix(noise_burst(0.2, 0.4, 1200, 300, 3), thump(120, 45, 0.2, 0.7)))
    save("spell", mix(noise_burst(0.45, 0.35, 300, 5000, 4), sequence(["E5", "B5"], 0.15, 0.3, vol=0.25)))
    save("heal", sequence(["C5", "G5", "C6", "E6", "G6"], 0.08, 0.4, vol=0.35, harmonics=(1.0, 0.2)))
    save("victory", sequence(["C5", "E5", "G5", "C6", "G5", "C6"], 0.12, 0.45, harmonics=(1.0, 0.45, 0.2)))
    save("retreat", sequence(["E4", "C4", "A3"], 0.25, 0.6, vol=0.3, harmonics=(1.0, 0.2), release=0.5))


if __name__ == "__main__":
    main()
