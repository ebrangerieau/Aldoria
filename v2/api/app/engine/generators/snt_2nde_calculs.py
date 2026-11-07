"""SNT, seconde : générateurs calculés (questions illimitées et justes).

- `debit` : durée de transfert = taille × 8 ÷ débit (Mo, Mbit/s), et l'inverse ;
- `graphe` : réseau d'amis (degré, distance, diamètre, rayon, centre) ;
- `table` : table CSV de livres (compter avec un filtre, trier, chercher le maximum) ;
- `itineraire` : plus court chemin sur un graphe routier (Dijkstra sur un petit réseau) ;
- `image` : définition, poids d'une image non compressée, couleur d'un triplet RVB ;
- `python` : valeur d'une variable après un petit programme (affectations, if, for, while, fonction) ;
- énigmes à remettre en ordre : `requete` (Pont des Paquets), `destinations` (Atelier des Automates).

1 Mo = 1 000 000 octets (unités du système international, comme dans les manuels de SNT).
"""

from __future__ import annotations

import heapq
import random
from collections import deque
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.formatting import fr_number

LEVEL, SUBJECT = "2nde", "snt"
PREFIX = f"{LEVEL}.{SUBJECT}"


def _number(value: float) -> str:
    return fr_number(value).replace(",", ".").replace("−", "-")


def _numeric(prompt: str, value: float, hint: str, explanation: str, difficulty: int,
             meta: dict[str, Any], tolerance: float = 0.0) -> dict[str, Any]:
    answer: dict[str, Any] = {"kind": "number", "value": _number(value)}
    if tolerance:
        answer["tolerance"] = tolerance
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": answer,
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 7000 * difficulty,
        "meta": {**meta, "value": value},
    }


def _mcq(prompt: str, right: str, wrong: list[str], hint: str, explanation: str,
         difficulty: int, rng: random.Random, meta: dict[str, Any]) -> dict[str, Any]:
    others = list(dict.fromkeys(w for w in wrong if w != right))
    count = 3 if difficulty == 1 else 4
    choices = rng.sample(others, min(count - 1, len(others))) + [right]
    rng.shuffle(choices)
    return {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(right)},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {**meta, "right": right},
    }


def _order(prompt: str, labels_in_order: list[str], rng: random.Random, hint: str,
           explanation: str, difficulty: int, meta: dict[str, Any]) -> dict[str, Any]:
    shown = list(labels_in_order)
    while shown == labels_in_order:
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": prompt,
        "choices": shown,
        "answer": {"kind": "order", "value": [shown.index(label) for label in labels_in_order]},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 30000 + 8000 * difficulty,
        "meta": meta,
    }


def _reg(name: str, notion: str, title: str, generate) -> Generator:
    return register(
        Generator(
            code=f"{PREFIX}.{name}",
            level=LEVEL,
            notion=f"{PREFIX}.{notion}",
            role="chapitre",
            title=title,
            generate=generate,
        )
    )


# --- Débit et durée de transfert ----------------------------------------------------------------

FILES = ["une vidéo", "un album photo", "une série de musiques", "une mise à jour de jeu",
         "un dossier de cours"]


def _debit(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["bits"], 2: ["bits", "duree"], 3: ["duree", "taille"],
             4: ["duree", "taille", "go"], 5: ["go", "taille", "duree"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    if kind == "bits":
        mo = rng.choice([2, 5, 10, 25, 50])
        return _numeric(
            f"Un fichier pèse {mo} Mo. Combien de mégabits cela fait-il ?", mo * 8,
            "1 octet = 8 bits, donc 1 Mo = 8 Mbit.", f"{mo} × 8 = {mo * 8} Mbit.", difficulty,
            meta)
    rate = rng.choice([8, 10, 20, 40, 50, 100])
    seconds = rng.choice([2, 4, 5, 10, 20, 30, 60])
    size_mo = rate * seconds / 8
    if size_mo != int(size_mo):
        seconds = 8
        size_mo = rate
    name = rng.choice(FILES)
    hint = "Durée = taille en mégabits ÷ débit en mégabits par seconde (1 octet = 8 bits)."
    if kind == "duree":
        return _numeric(
            f"On télécharge {name} de {fr_number(size_mo)} Mo avec un débit de {rate} Mbit/s. "
            "Combien de secondes faut-il ?", seconds, hint,
            f"{fr_number(size_mo)} Mo = {fr_number(size_mo * 8)} Mbit ; {fr_number(size_mo * 8)} ÷ "
            f"{rate} = {seconds} s.", difficulty, meta)
    if kind == "taille":
        return _numeric(
            f"Avec un débit de {rate} Mbit/s, un téléchargement dure {seconds} s. Quelle est la "
            "taille du fichier, en mégaoctets ?", size_mo, hint,
            f"{rate} × {seconds} = {rate * seconds} Mbit ; ÷ 8 = {fr_number(size_mo)} Mo.",
            difficulty, meta, tolerance=0.01)
    go = rng.choice([1, 2, 4, 5])
    rate = rng.choice([100, 200, 400, 1000])
    seconds = go * 8000 / rate
    return _numeric(
        f"On télécharge un jeu de {go} Go avec la fibre, à {rate} Mbit/s. Combien de secondes "
        "faut-il ?", seconds, "1 Go = 1 000 Mo et 1 octet = 8 bits.",
        f"{go} Go = {go * 1000} Mo = {go * 8000} Mbit ; {go * 8000} ÷ {rate} = "
        f"{fr_number(seconds)} s.", difficulty, meta, tolerance=0.01)


DEBIT = _reg("debit", "internet.echanges", "Débit et durée de transfert", _debit)


# --- Graphes d'un réseau social ---------------------------------------------------------------

NAMES = ["Léa", "Hugo", "Inès", "Noah", "Jade", "Tom", "Emma", "Sacha", "Zoé", "Malo"]


def _random_graph(rng: random.Random, count: int, extra: int) -> dict[str, set[str]]:
    """Graphe connexe : un arbre au hasard, puis `extra` arêtes de plus."""
    people = rng.sample(NAMES, count)
    graph: dict[str, set[str]] = {p: set() for p in people}
    for k in range(1, count):
        other = rng.choice(people[:k])
        graph[people[k]].add(other)
        graph[other].add(people[k])
    pairs = [(a, b) for i, a in enumerate(people) for b in people[i + 1:] if b not in graph[a]]
    for a, b in rng.sample(pairs, min(extra, len(pairs))):
        graph[a].add(b)
        graph[b].add(a)
    return graph


def distances(graph: dict[str, set[str]], start: str) -> dict[str, int]:
    seen = {start: 0}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for other in graph[node]:
            if other not in seen:
                seen[other] = seen[node] + 1
                queue.append(other)
    return seen


def eccentricities(graph: dict[str, set[str]]) -> dict[str, int]:
    return {p: max(distances(graph, p).values()) for p in graph}


def _graph_text(graph: dict[str, set[str]]) -> str:
    edges = sorted({tuple(sorted((a, b))) for a in graph for b in graph[a]})
    return "Liens d'amitié : " + " ; ".join(f"{a} et {b}" for a, b in edges) + "."


def _graphe(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, extra = {1: (5, 1), 2: (5, 2), 3: (6, 2), 4: (7, 3), 5: (7, 3)}[difficulty]
    kinds = {1: ["degre"], 2: ["degre", "distance"], 3: ["distance", "diametre"],
             4: ["diametre", "rayon", "centre"], 5: ["centre", "rayon", "diametre"]}[difficulty]
    kind = rng.choice(kinds)
    for _ in range(50):
        graph = _random_graph(rng, count, extra)
        ecc = eccentricities(graph)
        centers = [p for p in graph if ecc[p] == min(ecc.values())]
        if kind != "centre" or len(centers) == 1:
            break
    else:
        kind = "rayon"
    text = _graph_text(graph)
    meta = {"kind": kind, "graph": {p: sorted(v) for p, v in graph.items()}}
    hint = ("Distance : nombre minimal de liens entre deux personnes. Excentricité : la plus "
            "grande distance d'une personne aux autres. Diamètre : la plus grande excentricité ; "
            "rayon : la plus petite ; centre : les personnes d'excentricité minimale.")
    if kind == "degre":
        person = rng.choice(list(graph))
        return _numeric(f"{text}\nCombien d'amis a {person} ?", len(graph[person]), hint,
                        f"{person} est lié(e) à : {', '.join(sorted(graph[person]))}.",
                        difficulty, meta)
    if kind == "distance":
        while True:
            a, b = rng.sample(list(graph), 2)
            d = distances(graph, a)[b]
            if d >= 2 or difficulty == 2:
                break
        return _numeric(f"{text}\nQuelle est la distance entre {a} et {b} dans ce graphe ?", d,
                        hint, f"Il faut au moins {d} lien(s) pour aller de {a} à {b}.",
                        difficulty, {**meta, "pair": [a, b]})
    if kind == "diametre":
        return _numeric(f"{text}\nQuel est le diamètre de ce graphe ?", max(ecc.values()), hint,
                        "Excentricités : " + ", ".join(f"{p} {e}" for p, e in sorted(ecc.items()))
                        + f". Diamètre : {max(ecc.values())}.", difficulty, meta)
    if kind == "rayon":
        return _numeric(f"{text}\nQuel est le rayon de ce graphe ?", min(ecc.values()), hint,
                        "Excentricités : " + ", ".join(f"{p} {e}" for p, e in sorted(ecc.items()))
                        + f". Rayon : {min(ecc.values())}.", difficulty, meta)
    center = centers[0]
    return _mcq(f"{text}\nQui est au centre de ce graphe ?", center,
                [p for p in graph if p != center], hint,
                "Excentricités : " + ", ".join(f"{p} {e}" for p, e in sorted(ecc.items()))
                + f". La plus petite est celle de {center}.", difficulty, rng, meta)


GRAPHE = _reg("graphe", "reseaux_sociaux.graphes", "Graphes d'un réseau social", _graphe)


# --- Table de données ---------------------------------------------------------------------------

# (titre, auteur, année de parution) : œuvres du domaine public ; emprunts tirés au hasard.
BOOKS = [
    ("Les Misérables", "Hugo", 1862), ("Notre-Dame de Paris", "Hugo", 1831),
    ("Madame Bovary", "Flaubert", 1857), ("Germinal", "Zola", 1885), ("L'Assommoir", "Zola", 1877),
    ("Le Rouge et le Noir", "Stendhal", 1830), ("Candide", "Voltaire", 1759),
    ("Le Père Goriot", "Balzac", 1835), ("Bel-Ami", "Maupassant", 1885),
    ("Le Tour du monde en 80 jours", "Verne", 1872), ("Vingt mille lieues sous les mers", "Verne", 1870),
    ("Les Trois Mousquetaires", "Dumas", 1844), ("Le Comte de Monte-Cristo", "Dumas", 1844),
]


def _table(difficulty: int, rng: random.Random) -> dict[str, Any]:
    rows_count = {1: 4, 2: 5, 3: 6, 4: 7, 5: 8}[difficulty]
    kinds = {1: ["lignes", "descripteurs"], 2: ["filtre_auteur", "lignes"],
             3: ["filtre_auteur", "maximum", "filtre_annee"],
             4: ["filtre_annee", "tri", "maximum"], 5: ["filtre_double", "tri", "filtre_annee"]}[difficulty]
    kind = rng.choice(kinds)
    for _ in range(100):
        rows = [(t, a, y, rng.randint(3, 60)) for t, a, y in rng.sample(BOOKS, rows_count)]
        loans = [r[3] for r in rows]
        authors = [r[1] for r in rows]
        if len(set(loans)) == len(loans) and any(authors.count(a) > 1 for a in authors):
            break
    lines = ["titre;auteur;annee;emprunts"] + [f"{t};{a};{y};{n}" for t, a, y, n in rows]
    table = "Extrait du fichier livres.csv :\n" + "\n".join(lines)
    meta = {"kind": kind, "rows": [list(r) for r in rows]}
    hint = "Chaque ligne est un livre ; les descripteurs sont titre, auteur, annee et emprunts."
    if kind == "lignes":
        return _numeric(f"{table}\nCombien d'objets (livres) contient cet extrait ?", rows_count,
                        hint, f"La première ligne donne les descripteurs ; puis {rows_count} livres.",
                        difficulty, meta)
    if kind == "descripteurs":
        return _numeric(f"{table}\nCombien de descripteurs compte cette table ?", 4, hint,
                        "titre, auteur, annee, emprunts : 4 descripteurs.", difficulty, meta)
    if kind == "filtre_auteur":
        author = rng.choice([a for a in authors if authors.count(a) > 1] + authors)
        count = authors.count(author)
        return _numeric(f"{table}\nCombien de lignes garde le filtre « auteur = {author} » ?",
                        count, hint, f"{count} livre(s) de {author}.", difficulty,
                        {**meta, "author": author})
    if kind == "filtre_annee":
        limit = rng.choice([1840, 1850, 1860, 1870, 1880])
        count = sum(1 for r in rows if r[2] > limit)
        return _numeric(f"{table}\nCombien de livres sont parus après {limit} (annee > {limit}) ?",
                        count, hint, "Livres gardés : "
                        + (", ".join(r[0] for r in rows if r[2] > limit) or "aucun") + ".",
                        difficulty, {**meta, "limit": limit})
    if kind == "filtre_double":
        limit = rng.choice([10, 20, 30])
        year = rng.choice([1850, 1860, 1870])
        kept = [r for r in rows if r[2] > year and r[3] > limit]
        return _numeric(
            f"{table}\nCombien de lignes gardent les deux filtres « annee > {year} » et "
            f"« emprunts > {limit} » ?", len(kept), hint,
            "Livres gardés : " + (", ".join(r[0] for r in kept) or "aucun") + ".", difficulty,
            {**meta, "limit": limit, "year": year})
    if kind == "maximum":
        best = max(rows, key=lambda r: r[3])
        return _mcq(f"{table}\nQuel livre a été le plus emprunté ?", best[0],
                    [r[0] for r in rows if r != best], hint,
                    f"Le plus grand nombre d'emprunts est {best[3]} : {best[0]}.", difficulty,
                    rng, meta)
    ordered = sorted(rows, key=lambda r: r[3])
    return _mcq(f"{table}\nOn trie la table par emprunts croissants. Quel livre arrive en premier ?",
                ordered[0][0], [r[0] for r in rows if r != ordered[0]], hint,
                f"Le plus petit nombre d'emprunts est {ordered[0][3]} : {ordered[0][0]}.",
                difficulty, rng, meta)


TABLE = _reg("table", "donnees.tables", "Tables de données", _table)


# --- Itinéraires ----------------------------------------------------------------------------------

TOWNS = ["Aubeville", "Brumont", "Cressac", "Dorval", "Estrées", "Fontclair", "Gravelle"]


def _road_graph(rng: random.Random, count: int, extra: int) -> dict[str, dict[str, int]]:
    towns = TOWNS[:count]
    graph: dict[str, dict[str, int]] = {t: {} for t in towns}
    order = towns[:]
    rng.shuffle(order)
    for k in range(1, count):
        a, b = order[k], rng.choice(order[:k])
        graph[a][b] = graph[b][a] = rng.randint(2, 12)
    pairs = [(a, b) for i, a in enumerate(towns) for b in towns[i + 1:] if b not in graph[a]]
    for a, b in rng.sample(pairs, min(extra, len(pairs))):
        graph[a][b] = graph[b][a] = rng.randint(4, 20)
    return graph


def shortest(graph: dict[str, dict[str, int]], start: str) -> dict[str, int]:
    """Algorithme de Dijkstra."""
    best = {start: 0}
    heap = [(0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > best[node]:
            continue
        for other, w in graph[node].items():
            if d + w < best.get(other, 10**9):
                best[other] = d + w
                heapq.heappush(heap, (d + w, other))
    return best


def _de(name: str) -> str:
    return f"d'{name}" if name[0] in "AEIOUÉaeiouyé" else f"de {name}"


def _roads_text(graph: dict[str, dict[str, int]]) -> str:
    edges = sorted({tuple(sorted((a, b))) for a in graph for b in graph[a]})
    return "Routes : " + " ; ".join(f"entre {a} et {b}, {graph[a][b]} km" for a, b in edges) + "."


def _itineraire(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, extra = {1: (4, 0), 2: (4, 1), 3: (5, 2), 4: (6, 3), 5: (7, 4)}[difficulty]
    for _ in range(100):
        graph = _road_graph(rng, count, extra)
        start = TOWNS[0]
        best = shortest(graph, start)
        goal = rng.choice([t for t in graph if t != start])
        direct = graph[start].get(goal)
        # Dès la difficulté 3 : la route directe, s'il y en a une, n'est pas la plus courte.
        if difficulty < 3 or (direct is not None and direct > best[goal]) or (
            direct is None and best[goal] > min(graph[start].values())
        ):
            break
    return _numeric(
        f"{_roads_text(graph)}\nQuelle est la longueur du plus court chemin {_de(start)} à {goal}, "
        "en kilomètres ?", best[goal],
        "Compare les chemins possibles : un détour peut être plus court qu'une route directe.",
        f"Le plus court chemin {_de(start)} à {goal} mesure {best[goal]} km.", difficulty,
        {"graph": graph, "start": start, "goal": goal},
    )


ITINERAIRE = _reg("itineraire", "localisation.itineraires", "Plus court chemin", _itineraire)


def _destinations(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, extra, shown = {1: (4, 1, 3), 2: (5, 2, 3), 3: (5, 2, 4), 4: (6, 3, 4),
                           5: (7, 4, 5)}[difficulty]
    while True:
        graph = _road_graph(rng, count, extra)
        start = TOWNS[0]
        best = shortest(graph, start)
        targets = rng.sample([t for t in graph if t != start], shown)
        values = [best[t] for t in targets]
        if len(set(values)) == len(values):
            break
    ordered = sorted(targets, key=lambda t: best[t])
    return _order(
        f"Le Détraqueur a mélangé les panneaux ! {_roads_text(graph)}\nRange ces villes de la "
        f"plus proche à la plus lointaine {_de(start)}, par la route la plus courte.",
        ordered, rng, "Pour chaque ville, cherche le plus court chemin depuis le départ.",
        "De la plus proche à la plus lointaine : "
        + " ; ".join(f"{t} ({best[t]} km)" for t in ordered) + ".",
        difficulty, {"distances": [best[t] for t in ordered]},
    )


DESTINATIONS = _reg("destinations", "localisation.itineraires", "Les panneaux de l'Atelier",
                    _destinations)


# --- Images : pixels et couleurs ------------------------------------------------------------------

COLORS = [((255, 0, 0), "rouge"), ((0, 255, 0), "vert"), ((0, 0, 255), "bleu"),
          ((0, 0, 0), "noir"), ((255, 255, 255), "blanc"), ((255, 255, 0), "jaune"),
          ((0, 255, 255), "cyan"), ((255, 0, 255), "magenta"), ((128, 128, 128), "gris")]
DEFINITIONS = [(1920, 1080), (4000, 3000), (3000, 2000), (1000, 800), (2000, 1500), (800, 600)]


def _image(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["couleur"], 2: ["couleur", "pixels"], 3: ["pixels", "poids"],
             4: ["poids", "negatif"], 5: ["poids", "negatif", "gris"]}[difficulty]
    kind = rng.choice(kinds)
    meta = {"kind": kind}
    if kind == "couleur":
        rgb, name = rng.choice(COLORS[:6] if difficulty == 1 else COLORS)
        return _mcq(
            f"Quelle couleur code le triplet RVB ({rgb[0]}, {rgb[1]}, {rgb[2]}) ?", name,
            [n for _c, n in COLORS], "Rouge, vert, bleu de 0 (éteint) à 255 (à fond).",
            f"({rgb[0]}, {rgb[1]}, {rgb[2]}) : {name}.", difficulty, rng, meta)
    width, height = rng.choice(DEFINITIONS)
    pixels = width * height
    if kind == "pixels":
        return _numeric(
            f"Une image mesure {width} × {height} pixels. Combien de millions de pixels contient-elle ?",
            pixels / 1e6, "Définition = largeur × hauteur.",
            f"{width} × {height} = {pixels} pixels, soit {fr_number(pixels / 1e6)} millions.",
            difficulty, meta, tolerance=0.01)
    if kind == "poids":
        mo = pixels * 3 / 1e6
        return _numeric(
            f"Une image non compressée mesure {width} × {height} pixels, chaque pixel codé sur "
            "3 octets (rouge, vert, bleu). Quel est son poids, en mégaoctets ?", mo,
            "Poids = nombre de pixels × 3 octets ; 1 Mo = 1 000 000 octets.",
            f"{pixels} × 3 = {pixels * 3} octets = {fr_number(mo)} Mo.", difficulty, meta,
            tolerance=0.01)
    r, g, b = (rng.randrange(0, 256, 5) for _ in range(3))
    if kind == "negatif":
        component = rng.choice(["rouge", "vert", "bleu"])
        value = {"rouge": r, "vert": g, "bleu": b}[component]
        return _numeric(
            f"Un pixel vaut ({r}, {g}, {b}). On calcule le négatif de l'image. Que vaut la "
            f"composante {component} du nouveau pixel ?", 255 - value,
            "Négatif : chaque composante c devient 255 − c.",
            f"255 − {value} = {255 - value}.", difficulty, {**meta, "pixel": [r, g, b]})
    while (r + g + b) % 3:
        b = (b + 1) % 256
    return _numeric(
        f"Un pixel vaut ({r}, {g}, {b}). Pour le passer en niveaux de gris, on remplace chaque "
        "composante par la moyenne des trois. Quelle valeur obtient-on ?", (r + g + b) // 3,
        "Moyenne = (rouge + vert + bleu) ÷ 3.",
        f"({r} + {g} + {b}) ÷ 3 = {(r + g + b) // 3}.", difficulty, {**meta, "pixel": [r, g, b]})


IMAGE = _reg("image", "photo.pixels", "Pixels et couleurs", _image)


# --- Programmes Python ----------------------------------------------------------------------------


def _python(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kinds = {1: ["affectations"], 2: ["affectations", "condition"], 3: ["condition", "for"],
             4: ["for", "while", "fonction"], 5: ["while", "fonction", "for_if"]}[difficulty]
    kind = rng.choice(kinds)
    if kind == "affectations":
        a, b, k = rng.randint(2, 9), rng.randint(1, 9), rng.randint(2, 4)
        lines = [f"a = {a}", f"b = a + {b}", f"a = b * {k}"]
        value = (a + b) * k
        var = "a"
        why = f"b vaut {a} + {b} = {a + b}, puis a reçoit {a + b} × {k} = {value}."
    elif kind == "condition":
        x, s, d = rng.randint(1, 20), rng.randint(5, 15), rng.randint(2, 6)
        lines = [f"x = {x}", f"if x > {s}:", f"    y = x - {d}", "else:", f"    y = x + {d}"]
        value = x - d if x > s else x + d
        var = "y"
        why = (f"{x} > {s} est {'vrai' if x > s else 'faux'}, donc y = {x} "
               f"{'−' if x > s else '+'} {d} = {value}.")
    elif kind == "for":
        n, k = rng.randint(3, 6), rng.randint(2, 5)
        lines = ["s = 0", f"for i in range({n}):", f"    s = s + {k}"]
        value = n * k
        var = "s"
        why = f"La boucle fait {n} tours et ajoute {k} à chaque fois : {n} × {k} = {value}."
    elif kind == "for_if":
        n = rng.randint(5, 8)
        lines = ["s = 0", f"for i in range({n}):", "    if i > 2:", "        s = s + i"]
        value = sum(i for i in range(n) if i > 2)
        var = "s"
        why = f"i prend les valeurs 0 à {n - 1} ; on ajoute seulement celles plus grandes que 2 : {value}."
    elif kind == "while":
        start, limit = rng.randint(1, 3), rng.choice([20, 30, 50, 100])
        lines = [f"x = {start}", "c = 0", f"while x < {limit}:", "    x = x * 2", "    c = c + 1"]
        x, c = start, 0
        while x < limit:
            x, c = x * 2, c + 1
        value = c
        var = "c"
        why = f"x double jusqu'à atteindre au moins {limit} : x vaut {x} après {c} tours, donc c = {c}."
    else:
        m, p, arg = rng.randint(2, 5), rng.randint(1, 9), rng.randint(2, 7)
        lines = ["def f(x):", f"    return {m} * x + {p}", "", f"r = f({arg})"]
        value = m * arg + p
        var = "r"
        why = f"f({arg}) = {m} × {arg} + {p} = {value}."
    code = "\n".join(lines)
    return _numeric(
        f"Que vaut la variable {var} à la fin de ce programme Python ?\n{code}", value,
        "Exécute le programme ligne par ligne, en notant la valeur de chaque variable.",
        why, difficulty, {"kind": kind, "code": code, "var": var},
    )


PYTHON = _reg("python", "programmation.python", "Exécuter un programme", _python)


# --- Énigme : les étapes d'un échange sur le réseau ---------------------------------------------

SEQUENCES = {
    "Afficher une page web": [
        "On tape l'adresse du site dans le navigateur.",
        "Le DNS donne l'adresse IP du serveur.",
        "Le navigateur envoie une requête HTTP au serveur.",
        "Le serveur renvoie le code HTML de la page.",
        "Le navigateur affiche la page.",
    ],
    "Envoyer un fichier": [
        "Le fichier est découpé en paquets.",
        "Chaque paquet reçoit les adresses IP de départ et d'arrivée.",
        "Les routeurs font suivre les paquets de proche en proche.",
        "Les paquets arrivent, parfois dans le désordre.",
        "TCP remet les paquets dans l'ordre et reconstitue le fichier.",
    ],
    "Publier une photo sur un réseau social": [
        "On choisit la photo et qui pourra la voir.",
        "L'application envoie la photo aux serveurs du réseau social.",
        "La photo est enregistrée dans un centre de données.",
        "Les abonnés reçoivent une notification.",
        "La photo s'affiche dans leur fil d'actualité.",
    ],
    "Faire une recherche sur le Web": [
        "Des robots parcourent le Web en suivant les liens.",
        "Le moteur indexe le contenu des pages trouvées.",
        "On tape des mots-clés dans le moteur.",
        "Le moteur classe les pages selon leur pertinence.",
        "La page de résultats s'affiche.",
    ],
}


def _requete(difficulty: int, rng: random.Random) -> dict[str, Any]:
    size = {1: 3, 2: 4, 3: 4, 4: 5, 5: 5}[difficulty]
    title, steps = rng.choice(sorted(SEQUENCES.items()))
    keep = sorted(rng.sample(range(len(steps)), size))
    ordered = [steps[k] for k in keep]
    return _order(
        f"Le Crieur Menteur a mélangé les étapes ! « {title} » : remets-les dans l'ordre.",
        ordered, rng, "Pense au trajet des données : de qui part la demande, qui répond ?",
        "Dans l'ordre : " + " ".join(ordered), difficulty, {"title": title, "keep": keep},
    )


REQUETE = _reg("requete", "web.http", "Les étapes d'un échange", _requete)
