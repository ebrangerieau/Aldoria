"""Français, 6e : les cinq entrées littéraires du programme (BO n° 16 du 17 avril 2025).

Récits des origines, poésie (et fables), théâtre et ruses, récit d'aventure, monstres. Œuvres du
domaine public (Bible, mythes grecs, Ovide, Homère, La Fontaine, Perrault, Molière, Defoe,
Stevenson, Verne, Mme Leprince de Beaumont, Andersen) ; citations exactes et sourcées.

Deux énigmes « à remettre dans l'ordre » :
- les vers défaits de La Fontaine (les mots d'un vers) ;
- le conte en désordre (les étapes d'un conte ou d'un mythe, du début à la fin).
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions

NOTIONS = [
    Notion(
        "lectures.origines",
        "Récits des origines",
        "Un récit des origines explique comment sont nés le monde, les hommes ou une chose.",
        [
            Fact(1, "Dans la mythologie grecque, qui vole le feu aux dieux pour le donner aux "
                 "hommes ?", "Prométhée", "Prométhée, un Titan, offre le feu aux hommes et "
                 "désobéit à Zeus.", ("Zeus", "Hermès", "Héraclès")),
            Fact(1, "Qui est le roi des dieux grecs, sur le mont Olympe ?", "Zeus",
                 "Zeus règne sur l'Olympe ; Poséidon règne sur la mer, Hadès sur les Enfers.",
                 ("Poséidon", "Hadès", "Apollon")),
            Fact(1, "Dans la Bible, comment s'appellent le premier homme et la première femme ?",
                 "Adam et Ève", "Le livre de la Genèse raconte leur création et leur vie au "
                 "jardin d'Éden.", ("Romulus et Rémus", "Zeus et Héra", "Thésée et Ariane")),
            Fact(1, "Dans la Genèse, en combien de jours Dieu crée-t-il le monde, avant de se "
                 "reposer le septième ?", "six", "Six jours de création, puis le repos du "
                 "septième jour.", ("trois", "dix", "quarante")),
            Fact(2, "Dans la Bible, qui construit une arche pour sauver sa famille et les animaux "
                 "du Déluge ?", "Noé", "Noé fait entrer un couple de chaque espèce dans "
                 "l'arche.", ("Moïse", "Abraham", "Adam")),
            Fact(2, "Que contient la jarre que Pandore ouvre, dans le mythe grec ?",
                 "tous les malheurs du monde",
                 "En ouvrant la jarre, Pandore libère les malheurs ; seule l'espérance reste au "
                 "fond.", ("de l'or", "le feu des dieux", "les étoiles")),
            Fact(2, "Dans la mythologie grecque, comment s'appelle la Terre, mère des premiers "
                 "dieux ?", "Gaïa", "Gaïa, la Terre, apparaît juste après le Chaos, au début du monde.",
                 ("Athéna", "Artémis", "Pandore")),
            Fact(2, "Que cherche à expliquer un récit étiologique ?",
                 "l'origine de quelque chose (le monde, un animal, une coutume)",
                 "« étiologique » vient du grec « aitia », la cause : il explique pourquoi une "
                 "chose existe.", ("la fin du monde", "la vie d'un roi réel",
                                   "comment écrire un poème")),
            Fact(3, "Dans Les Métamorphoses d'Ovide, Arachné défie la déesse du tissage. "
                 "En quoi est-elle changée ?", "en araignée",
                 "La déesse la change en araignée, qui tisse pour toujours : le mythe explique "
                 "l'origine de l'araignée.", ("en hirondelle", "en arbre", "en pierre")),
            Fact(3, "Dans Les Métamorphoses d'Ovide, Narcisse tombe amoureux de son reflet. "
                 "En quoi est-il changé ?", "en fleur",
                 "À sa place pousse une fleur qui porte son nom : le narcisse.",
                 ("en écho", "en rocher", "en cygne")),
            Fact(3, "Dans la Bible, pourquoi la tour de Babel n'est-elle jamais terminée ?",
                 "Les hommes se mettent à parler des langues différentes.",
                 "Ne se comprenant plus, les bâtisseurs se dispersent : le récit explique la "
                 "diversité des langues.",
                 ("Un tremblement de terre la détruit.", "Les pierres viennent à manquer.",
                  "Un géant la renverse.")),
            Fact(3, "Comment Zeus punit-il Prométhée ?",
                 "Il l'enchaîne sur un rocher, où un aigle lui dévore le foie.",
                 "Le foie repousse chaque nuit : le supplice recommence, jusqu'à ce qu'Héraclès "
                 "le délivre.", ("Il le change en araignée.", "Il l'envoie sur la Lune.",
                                 "Il lui retire le feu pour toujours.")),
        ],
    ),
    Notion(
        "lectures.poesie",
        "Poésie et fables",
        "Un vers est une ligne du poème ; une strophe, un groupe de vers. La fable raconte une "
        "histoire et donne une leçon : la morale.",
        [
            Fact(1, "Comment appelle-t-on une ligne d'un poème ?", "un vers",
                 "Chaque ligne d'un poème est un vers.", ("une strophe", "une rime", "un paragraphe")),
            Fact(1, "Comment appelle-t-on un groupe de vers ?", "une strophe",
                 "Les strophes sont séparées par un blanc.", ("un vers", "une rime", "un chapitre")),
            Fact(1, "Quels mots riment ?", "lune / plume",
                 "« lune » et « plume » finissent par le même son : « une ».",
                 ("lune / soleil", "lune / lumière", "lune / ciel")),
            Fact(1, "Qui a écrit « Le Corbeau et le Renard » et « La Cigale et la Fourmi » ?",
                 "Jean de La Fontaine",
                 "Jean de La Fontaine a écrit ses Fables au XVIIe siècle.",
                 ("Charles Perrault", "Victor Hugo", "Molière")),
            Fact(2, "Dans une fable, comment appelle-t-on la leçon à retenir ?", "la morale",
                 "La morale tire une leçon de l'histoire.", ("la rime", "la strophe", "le titre")),
            Fact(2, "« La raison du plus fort est toujours la meilleure » : de quelle fable "
                 "est-ce la morale ?", "Le Loup et l'Agneau",
                 "La Fontaine, « Le Loup et l'Agneau » : le loup, plus fort, mange l'agneau.",
                 ("Le Lièvre et la Tortue", "Le Lion et le Rat", "La Cigale et la Fourmi")),
            Fact(2, "« Rien ne sert de courir ; il faut partir à point. » : de quelle fable "
                 "est-ce la morale ?", "Le Lièvre et la Tortue",
                 "La Fontaine, « Le Lièvre et la Tortue » : la tortue, partie à temps, gagne.",
                 ("Le Loup et l'Agneau", "Le Corbeau et le Renard", "Le Lion et le Rat")),
            Fact(2, "« La lune est comme un ballon d'argent. » Comment s'appelle cette image ?",
                 "une comparaison",
                 "« comme » relie la lune et le ballon : c'est une comparaison.",
                 ("une métaphore", "une personnification", "une rime")),
            Fact(3, "« La lune est un ballon d'argent. » Comment s'appelle cette image ?",
                 "une métaphore",
                 "La lune et le ballon sont rapprochés sans mot de comparaison : métaphore.",
                 ("une comparaison", "une personnification", "une strophe")),
            Fact(3, "« Le vent chante dans les arbres. » Comment s'appelle cette image ?",
                 "une personnification",
                 "Le vent fait une action humaine (chanter) : c'est une personnification.",
                 ("une comparaison", "une métaphore", "une morale")),
            Fact(3, "Combien de syllabes compte un alexandrin ?", "douze",
                 "L'alexandrin est le vers de douze syllabes.", ("huit", "dix", "quatorze")),
            Fact(3, "Dans « Le Corbeau et le Renard », comment le renard obtient-il le fromage ?",
                 "Il flatte le corbeau, qui ouvre son bec pour chanter.",
                 "« Apprenez que tout flatteur vit aux dépens de celui qui l'écoute » (La "
                 "Fontaine).", ("Il le lui vole pendant son sommeil.",
                               "Il l'échange contre une noix.", "Il le fait tomber avec un bâton.")),
        ],
    ),
    Notion(
        "lectures.theatre",
        "Théâtre et ruses",
        "Au théâtre, les personnages parlent par répliques ; les didascalies indiquent le jeu. "
        "Chez Molière, la ruse fait rire.",
        [
            Fact(1, "Au théâtre, comment appelle-t-on ce que dit un personnage quand il prend la "
                 "parole ?", "une réplique", "Les personnages se répondent par répliques.",
                 ("une didascalie", "un acte", "un décor")),
            Fact(1, "Comment appelle-t-on les indications de jeu, souvent en italique ?",
                 "les didascalies",
                 "Les didascalies indiquent les gestes, le ton, le décor.",
                 ("les répliques", "les actes", "les strophes")),
            Fact(1, "Une pièce de théâtre est divisée en actes, eux-mêmes divisés en…", "scènes",
                 "Un acte contient plusieurs scènes.", ("chapitres", "strophes", "vers")),
            Fact(1, "Qui a écrit Les Fourberies de Scapin ?", "Molière",
                 "Molière a écrit cette comédie en 1671.",
                 ("Jean de La Fontaine", "Charles Perrault", "Victor Hugo")),
            Fact(2, "Comment appelle-t-on une pièce qui fait rire et finit bien ?", "une comédie",
                 "La comédie fait rire ; la tragédie finit mal.",
                 ("une tragédie", "une fable", "un conte")),
            Fact(2, "Quand un personnage parle seul sur scène, c'est…", "un monologue",
                 "« mono- » veut dire « seul » : le personnage parle seul.",
                 ("un dialogue", "un aparté", "une didascalie")),
            Fact(2, "Un personnage parle pour lui-même : les autres ne l'entendent pas, mais le "
                 "public, si. C'est…", "un aparté",
                 "L'aparté est dit « à part », pour le public.",
                 ("un monologue", "une réplique", "une scène")),
            Fact(2, "Dans Les Fourberies de Scapin, qui est Scapin ?", "un valet rusé",
                 "Scapin, valet de Léandre, invente ruse sur ruse pour aider les jeunes gens.",
                 ("un roi", "un juge", "un médecin")),
            Fact(3, "« Que diable allait-il faire dans cette galère ? » Qui répète cette phrase "
                 "dans Les Fourberies de Scapin ?", "Géronte",
                 "Géronte, père avare, la répète quand Scapin lui réclame une rançon (acte II, "
                 "scène 7).", ("Scapin", "Argante", "Léandre")),
            Fact(3, "Comment Scapin se venge-t-il de Géronte ?",
                 "Il le fait cacher dans un sac et le bat.",
                 "Scapin fait croire à Géronte que des ennemis le cherchent, le cache dans un sac "
                 "et lui donne des coups de bâton (acte III, scène 2).",
                 ("Il le dénonce au roi.", "Il lui vole sa maison.", "Il l'enferme dans une tour.")),
            Fact(3, "Dans Le Médecin malgré lui de Molière, Sganarelle est un bûcheron qui se fait "
                 "passer pour…", "un médecin",
                 "Sa femme, pour se venger, le fait passer pour un grand médecin.",
                 ("un juge", "un soldat", "un marchand")),
            Fact(3, "Qu'est-ce qu'une farce ?",
                 "une courte pièce comique, avec des ruses et des coups de bâton",
                 "La farce, née au Moyen Âge, fait rire par des tours et des bastonnades.",
                 ("une pièce triste où le héros meurt", "un poème de douze vers",
                  "un conte avec des fées")),
        ],
    ),
    Notion(
        "lectures.aventure",
        "Récits d'aventure",
        "Un récit suit des étapes : situation initiale, élément perturbateur, péripéties, "
        "élément de résolution, situation finale.",
        [
            Fact(1, "Comment s'appelle le début d'un récit, qui présente les personnages et le "
                 "lieu ?", "la situation initiale",
                 "La situation initiale installe l'histoire avant que tout bascule.",
                 ("l'élément perturbateur", "les péripéties", "la situation finale")),
            Fact(1, "Quelle étape vient bouleverser la situation du début ?",
                 "l'élément perturbateur",
                 "L'élément perturbateur lance l'aventure.",
                 ("la situation finale", "l'élément de résolution", "la morale")),
            Fact(1, "Comment s'appellent les aventures que vit le héros ?", "les péripéties",
                 "Les péripéties sont les épreuves et rebondissements du récit.",
                 ("les didascalies", "les strophes", "la situation initiale")),
            Fact(1, "Comment appelle-t-on la fin du récit, une fois l'aventure terminée ?",
                 "la situation finale",
                 "La situation finale montre ce qui a changé.",
                 ("la situation initiale", "l'élément perturbateur", "les péripéties")),
            Fact(2, "Qui a écrit L'Odyssée, le récit du retour d'Ulysse ?", "Homère",
                 "L'Odyssée est attribuée au poète grec Homère.", ("Ovide", "Molière", "Virgile")),
            Fact(2, "Combien d'années Ulysse met-il à rentrer chez lui, à Ithaque, après la "
                 "guerre de Troie ?", "dix ans",
                 "Après dix ans de guerre, Ulysse erre encore dix ans sur les mers.",
                 ("un an", "trois ans", "cent ans")),
            Fact(2, "Dans L'Odyssée, comment Ulysse écoute-t-il le chant des sirènes sans "
                 "danger ?", "Il se fait attacher au mât de son navire.",
                 "Ses compagnons, les oreilles bouchées de cire, rament sans entendre.",
                 ("Il chante plus fort qu'elles.", "Il dort pendant le passage.",
                  "Il les fait fuir avec une torche.")),
            Fact(2, "Qui a écrit Robinson Crusoé ?", "Daniel Defoe",
                 "Daniel Defoe a publié Robinson Crusoé en 1719.",
                 ("Jules Verne", "Robert Louis Stevenson", "Homère")),
            Fact(3, "Qui a écrit Le Tour du monde en quatre-vingts jours ?", "Jules Verne",
                 "Jules Verne a aussi écrit Vingt mille lieues sous les mers.",
                 ("Daniel Defoe", "Alexandre Dumas", "Charles Perrault")),
            Fact(3, "Dans L'Île au trésor de Stevenson, comment s'appelle le pirate à la jambe de "
                 "bois ?", "Long John Silver",
                 "Long John Silver, cuisinier du navire, est en réalité un pirate.",
                 ("le capitaine Crochet", "Barbe-Noire", "Vendredi")),
            Fact(3, "Comment Robinson appelle-t-il le compagnon qu'il sauve sur son île ?",
                 "Vendredi", "Il le nomme d'après le jour où il l'a sauvé.",
                 ("Dimanche", "Samedi", "Lundi")),
            Fact(3, "Comment s'appelle le capitaine du sous-marin Nautilus, chez Jules Verne ?",
                 "le capitaine Nemo", "« Nemo » veut dire « personne » en latin.",
                 ("le capitaine Achab", "le capitaine Haddock", "le capitaine Crochet")),
        ],
    ),
    Notion(
        "lectures.monstres",
        "Monstres des mythes et des contes",
        "Les monstres font peur, mais les récits montrent aussi leur part d'humanité ou ce qu'ils "
        "nous apprennent.",
        [
            Fact(1, "Quel monstre, mi-homme mi-taureau, vit dans le labyrinthe de Crète ?",
                 "le Minotaure", "Le Minotaure est enfermé dans le labyrinthe construit par "
                 "Dédale.", ("le Cyclope", "Méduse", "le Sphinx")),
            Fact(1, "Combien d'yeux a un Cyclope ?", "un seul",
                 "Les Cyclopes sont des géants qui n'ont qu'un œil, au milieu du front.",
                 ("deux", "trois", "cent")),
            Fact(1, "Dans « Le Petit Poucet » de Perrault, qui veut manger les enfants ?",
                 "l'ogre", "Les sept frères arrivent chez un ogre qui mange les petits enfants.",
                 ("le loup", "le dragon", "la sorcière")),
            Fact(1, "Quel héros tue le Minotaure ?", "Thésée",
                 "Thésée tue le Minotaure et ressort grâce au fil d'Ariane.",
                 ("Ulysse", "Persée", "Héraclès")),
            Fact(2, "Quel est le pouvoir de Méduse ?", "Son regard change en pierre.",
                 "Quiconque croise le regard de Méduse est changé en pierre.",
                 ("Elle crache du feu.", "Elle devient invisible.", "Elle vole plus vite que le vent.")),
            Fact(2, "Quel héros coupe la tête de Méduse ?", "Persée",
                 "Persée la regarde dans le reflet de son bouclier pour ne pas être changé en "
                 "pierre.", ("Thésée", "Ulysse", "Jason")),
            Fact(2, "Quel nom Ulysse donne-t-il au Cyclope Polyphème ?", "Personne",
                 "Quand Polyphème crie que « Personne » l'attaque, les autres Cyclopes ne viennent pas "
                 "l'aider.",
                 ("Ulysse", "Zeus", "Nemo")),
            Fact(2, "Dans La Belle et la Bête de Mme Leprince de Beaumont, pourquoi la Bête "
                 "a-t-elle cet aspect ?", "Une méchante fée l'a transformée.",
                 "La Bête était un prince, changé en monstre par une fée.",
                 ("Elle est née ainsi.", "Elle a mangé une pomme magique.",
                  "Un dragon l'a mordue.")),
            Fact(3, "À la fin de La Belle et la Bête, que devient la Bête ?",
                 "Elle redevient un prince.",
                 "L'amour de la Belle brise l'enchantement.",
                 ("Elle s'envole.", "Elle reste un monstre.", "Elle devient un dragon.")),
            Fact(3, "Que se passe-t-il quand on coupe une tête de l'Hydre de Lerne ?",
                 "Deux têtes repoussent.",
                 "Héraclès en vient à bout en brûlant chaque cou coupé.",
                 ("Elle meurt aussitôt.", "Elle se change en pierre.", "Elle s'enfuit dans la mer.")),
            Fact(3, "Dans L'Odyssée, quelles créatures attirent les marins par leur chant ?",
                 "les sirènes", "Leur chant mène les marins à leur perte, sur les rochers.",
                 ("les nymphes", "les Cyclopes", "les harpies")),
            Fact(3, "Que montre souvent un monstre dans un conte ou un mythe ?",
                 "nos peurs, et parfois une part d'humanité cachée",
                 "Le monstre fait peur, mais il peut aussi souffrir ou changer, comme la Bête.",
                 ("rien : il sert seulement de décor", "toujours la méchanceté pure",
                  "la vie réelle d'un animal")),
        ],
    ),
]

GENERATORS = register_notions("6e", "francais", NOTIONS)


# --- Énigme : les vers défaits de La Fontaine ----------------------------------------------------

# Vers des Fables (1668), cités exactement, découpés en mots tous différents (l'ordre attendu est
# alors unique). La difficulté choisit la longueur.
FABLE_VERSES = [
    (("La", "Cigale,", "ayant", "chanté"), "« La Cigale et la Fourmi »"),
    (("Se", "trouva", "fort", "dépourvue"), "« La Cigale et la Fourmi »"),
    (("Petit", "poisson", "deviendra", "grand,"), "« Le Petit Poisson et le Pêcheur »"),
    (("Maître", "Renard,", "par", "l'odeur", "alléché,"), "« Le Corbeau et le Renard »"),
    (("Une", "Grenouille", "vit", "un", "Bœuf"),
     "« La Grenouille qui se veut faire aussi grosse que le Bœuf »"),
    (("Le", "Corbeau,", "honteux", "et", "confus,"), "« Le Corbeau et le Renard »"),
    (("Travaillez,", "prenez", "de", "la", "peine :"), "« Le Laboureur et ses Enfants »"),
    (("Maître", "Corbeau,", "sur", "un", "arbre", "perché,"), "« Le Corbeau et le Renard »"),
    (("Tenait", "en", "son", "bec", "un", "fromage."), "« Le Corbeau et le Renard »"),
    (("Nous", "l'allons", "montrer", "tout", "à", "l'heure."), "« Le Loup et l'Agneau »"),
    (("Pourvu", "que", "Dieu", "lui", "prête", "vie."), "« Le Petit Poisson et le Pêcheur »"),
    (("Qui", "lui", "sembla", "de", "belle", "taille."),
     "« La Grenouille qui se veut faire aussi grosse que le Bœuf »"),
    (("La", "raison", "du", "plus", "fort", "est", "toujours", "la", "meilleure :"),
     "« Le Loup et l'Agneau »"),
    (("On", "a", "souvent", "besoin", "d'un", "plus", "petit", "que", "soi."),
     "« Le Lion et le Rat »"),
    (("Il", "faut,", "autant", "qu'on", "peut,", "obliger", "tout", "le", "monde :"),
     "« Le Lion et le Rat »"),
    (("Rien", "ne", "sert", "de", "courir ;", "il", "faut", "partir", "à", "point."),
     "« Le Lièvre et la Tortue »"),
    (("Jura,", "mais", "un", "peu", "tard,", "qu'on", "ne", "l'y", "prendrait", "plus."),
     "« Le Corbeau et le Renard »"),
]
FABLE_LENGTHS = {1: (4, 5), 2: (5, 6), 3: (6, 6), 4: (6, 9), 5: (9, 10)}


def _shuffle_order(count: int, rng: random.Random) -> list[int]:
    shown = list(range(count))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return shown


def _fables(difficulty: int, rng: random.Random) -> dict[str, Any]:
    low, high = FABLE_LENGTHS[difficulty]
    words, fable = rng.choice([v for v in FABLE_VERSES if low <= len(v[0]) <= high])
    shown = _shuffle_order(len(words), rng)
    verse = " ".join(words)
    return {
        "type": "order",
        "prompt": "Le Gobe-Lettres a défait ce vers de La Fontaine ! Remets ses mots dans l'ordre.",
        "choices": [words[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(words))]},
        "hint": f"Le vers commence par « {words[0]} ». Il vient de la fable {fable}.",
        "explanation": f"Le vers : « {verse} » (Jean de La Fontaine, {fable}).",
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": {"verse": verse, "source": fable},
    }


FABLES = register(
    Generator(
        code="6e.francais.fables",
        level="6e",
        notion="6e.francais.lectures.poesie",
        role="chapitre",
        title="Les fables défaites",
        generate=_fables,
    )
)


# --- Énigme : le conte en désordre ---------------------------------------------------------------

# Étapes de contes et de mythes du domaine public, dans l'ordre du récit.
TALES = [
    ("Le Petit Chaperon rouge (Perrault)", (
        "Sa mère envoie le Petit Chaperon rouge porter une galette à sa mère-grand.",
        "Dans le bois, la fillette rencontre le loup et lui dit où elle va.",
        "Le loup arrive le premier chez la mère-grand et la dévore.",
        "Le loup se couche dans le lit et attend la fillette.",
        "Le loup se jette sur le Petit Chaperon rouge et la mange.",
    )),
    ("Le Petit Poucet (Perrault)", (
        "Trop pauvres, les parents perdent leurs sept enfants dans la forêt.",
        "Le Petit Poucet retrouve le chemin grâce à ses cailloux blancs.",
        "Perdus une seconde fois, les enfants arrivent chez un ogre.",
        "La nuit, le Petit Poucet échange leurs bonnets contre les couronnes des filles de l'ogre.",
        "Il prend les bottes de sept lieues de l'ogre endormi.",
    )),
    ("Cendrillon (Perrault)", (
        "Cendrillon vit chez sa belle-mère, qui la fait travailler sans cesse.",
        "Sa marraine la fée l'habille pour le bal du prince.",
        "Au premier coup de minuit, Cendrillon s'enfuit et perd une pantoufle de verre.",
        "Le prince fait essayer la pantoufle à toutes les jeunes filles.",
        "La pantoufle va à Cendrillon, et le prince l'épouse.",
    )),
    ("Le Vilain Petit Canard (Andersen)", (
        "Un caneton gris et maladroit sort du dernier œuf.",
        "Les animaux de la basse-cour se moquent de lui.",
        "Il s'enfuit et passe un hiver terrible, seul.",
        "Au printemps, il s'approche de beaux cygnes.",
        "Dans l'eau, il découvre qu'il est devenu un cygne.",
    )),
    ("Thésée et le Minotaure (mythe grec)", (
        "Athènes doit livrer des jeunes gens au Minotaure.",
        "Thésée part pour la Crète avec eux.",
        "Ariane lui donne une pelote de fil.",
        "Thésée tue le Minotaure au cœur du labyrinthe.",
        "Il retrouve la sortie en suivant le fil.",
    )),
    ("Ulysse et le Cyclope (L'Odyssée)", (
        "Ulysse et ses compagnons entrent dans la grotte du Cyclope Polyphème.",
        "Le Cyclope les enferme et dévore plusieurs compagnons.",
        "Ulysse lui fait boire du vin et dit s'appeler « Personne ».",
        "Ils crèvent l'œil du Cyclope endormi.",
        "Ils s'échappent cachés sous le ventre des moutons.",
    )),
    ("Prométhée (mythe grec)", (
        "Les hommes vivent sans feu, dans le froid.",
        "Prométhée dérobe le feu aux dieux de l'Olympe.",
        "Il apporte le feu aux hommes.",
        "Zeus, furieux, le fait enchaîner sur un rocher.",
        "Chaque jour, un aigle vient lui dévorer le foie.",
    )),
    ("Persée et Méduse (mythe grec)", (
        "Le roi Polydecte demande à Persée la tête de Méduse.",
        "Les dieux lui prêtent des sandales ailées et un bouclier brillant.",
        "Persée regarde Méduse dans le reflet du bouclier.",
        "Il lui coupe la tête.",
        "Il change ses ennemis en pierre avec la tête de Méduse.",
    )),
]
TALE_STEPS = {1: 3, 2: 4, 3: 4, 4: 5, 5: 5}


def _conte(difficulty: int, rng: random.Random) -> dict[str, Any]:
    title, steps = rng.choice(TALES)
    count = TALE_STEPS[difficulty]
    kept = sorted(rng.sample(range(len(steps)), count)) if count < len(steps) else list(range(count))
    ordered = [steps[i] for i in kept]
    shown = _shuffle_order(count, rng)
    return {
        "type": "order",
        "prompt": f"L'Ogre Oublieux a mélangé les pages de « {title} » ! Remets les étapes dans "
        "l'ordre du récit.",
        "choices": [ordered[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": f"La première étape : « {ordered[0]} »",
        "explanation": "L'histoire dans l'ordre : " + " ".join(ordered),
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"tale": title},
    }


CONTE = register(
    Generator(
        code="6e.francais.conte",
        level="6e",
        notion="6e.francais.lectures.aventure",
        role="chapitre",
        title="Le conte en désordre",
        generate=_conte,
    )
)
