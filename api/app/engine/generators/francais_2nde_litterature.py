"""Français, seconde : figures de style, poésie, littérature d'idées, récit, théâtre.

Exemples écrits pour le jeu ou vers d'auteurs du domaine public (cités exactement, avec leur
source). Deux générateurs « calculés » :
- `2nde.francais.rimes` : disposition des rimes d'un quatrain (fins de vers tirées de familles
  de rimes), notion versification ;
- `2nde.francais.vers` : un vers célèbre dont les mots sont mélangés, à remettre dans l'ordre
  (énigme du Bois des Mots, « Les Vers défaits » ; sert aussi en combat).
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions

ANALOGIE = ("comparaison", "métaphore", "personnification", "allégorie")
INSISTANCE = ("anaphore", "gradation", "accumulation", "hyperbole")
ATTENUATION = ("litote", "euphémisme", "hyperbole", "antiphrase", "périphrase")
OPPOSITION = ("antithèse", "oxymore", "chiasme", "paradoxe")
SUBSTITUTION = ("métonymie", "périphrase", "métaphore", "comparaison")
FOCALISATIONS = (
    "focalisation zéro (narrateur omniscient)",
    "focalisation interne",
    "focalisation externe",
)
TEMPS_RECIT = ("ellipse", "sommaire", "scène", "pause", "analepse", "prolepse")
THEATRE = (
    "tirade",
    "monologue",
    "aparté",
    "didascalie",
    "stichomythie",
    "réplique",
    "quiproquo",
    "coup de théâtre",
    "exposition",
    "dénouement",
)
REGISTRES = ("comique", "tragique", "pathétique", "lyrique", "épique", "ironique", "polémique")
CONNECTEURS = (
    "la cause",
    "la conséquence",
    "l'opposition",
    "la concession",
    "l'addition",
    "le but",
)


def _figure(level: int, phrase: str, answer: str, why: str, source: str = "") -> Fact:
    cite = f" ({source})" if source else ""
    return Fact(level, f"Quelle figure de style dans : « {phrase} »{cite} ?", answer, why)


def _definition(level: int, definition: str, answer: str, why: str = "") -> Fact:
    return Fact(
        level,
        f"Comment appelle-t-on : {definition}",
        answer,
        why or f"C'est la définition de : {answer}.",
    )


NOTIONS = [
    Notion(
        "figures.analogie",
        "Figures d'analogie",
        "Comparaison : avec un outil (comme, tel, pareil à). Métaphore : sans outil. Personnification : une chose agit comme une personne.",
        [
            _figure(
                1,
                "Ses yeux brillent comme des étoiles.",
                "comparaison",
                "Le rapprochement se fait avec l'outil « comme » : comparaison.",
            ),
            _figure(
                1,
                "Ses yeux sont des étoiles.",
                "métaphore",
                "Les yeux sont rapprochés des étoiles sans outil de comparaison : métaphore.",
            ),
            _figure(
                1,
                "Le vent hurle dans la nuit.",
                "personnification",
                "Le vent « hurle » comme un être vivant : personnification.",
            ),
            _figure(
                2,
                "Cette mer, pareille à un miroir, reflétait le ciel.",
                "comparaison",
                "L'outil « pareille à » relie la mer et le miroir : comparaison.",
            ),
            _figure(
                2,
                "Il versait un océan de larmes.",
                "métaphore",
                "Les larmes deviennent un océan, sans outil : métaphore (exagérée).",
            ),
            _figure(
                2,
                "La Mort fauche les vivants.",
                "allégorie",
                "Une idée abstraite, la mort, prend une forme humaine qui agit (avec une majuscule) : allégorie.",
            ),
            _figure(
                2,
                "La ville s'éveille et s'étire.",
                "personnification",
                "La ville se réveille et s'étire comme une personne : personnification.",
            ),
            _figure(
                3,
                "Le Poète est semblable au prince des nuées",
                "comparaison",
                "« semblable à » est un outil de comparaison : le poète est comparé à l'albatros.",
                "Baudelaire, « L'Albatros »",
            ),
            _figure(
                3,
                "La Nature est un temple où de vivants piliers",
                "métaphore",
                "La Nature est assimilée à un temple, sans outil : métaphore.",
                "Baudelaire, « Correspondances »",
            ),
            _figure(
                3,
                "La Justice, les yeux bandés, tient sa balance.",
                "allégorie",
                "La justice, idée abstraite, est représentée par une femme aux yeux bandés : allégorie.",
            ),
        ],
        ANALOGIE,
        writable=True,
    ),
    Notion(
        "figures.insistance",
        "Figures d'insistance",
        "Anaphore : même mot en tête de vers ou de phrase. Gradation : intensité croissante. Hyperbole : exagération.",
        [
            _figure(
                1,
                "Je meurs de faim !",
                "hyperbole",
                "On ne meurt pas vraiment : l'exagération insiste sur la faim. C'est une hyperbole.",
            ),
            _figure(
                1,
                "Va, cours, vole, et nous venge.",
                "gradation",
                "Les verbes vont du plus lent au plus rapide : gradation.",
                "Corneille, Le Cid",
            ),
            _figure(
                1,
                "Je te l'ai dit mille fois !",
                "hyperbole",
                "« mille fois » exagère pour insister : hyperbole.",
            ),
            _figure(
                2,
                "Il y avait des livres, des cartes, des plumes, des globes, des fioles partout.",
                "accumulation",
                "Une longue suite de noms de même nature : accumulation.",
            ),
            _figure(
                2,
                "C'est un roc !… c'est un pic !… c'est un cap ! Que dis-je, c'est un cap ?… C'est une péninsule !",
                "gradation",
                "Roc, pic, cap, péninsule : de plus en plus grand, pour se moquer du nez de Cyrano. Gradation.",
                "Rostand, Cyrano de Bergerac",
            ),
            _figure(
                2,
                "Rome, l'unique objet de mon ressentiment ! Rome, à qui vient ton bras d'immoler mon amant !",
                "anaphore",
                "« Rome » est répété en tête de chaque vers : anaphore.",
                "Corneille, Horace",
            ),
            _figure(
                3,
                "Mon bras, qu'avec respect toute l'Espagne admire, Mon bras, qui tant de fois a sauvé cet empire",
                "anaphore",
                "« Mon bras » revient en tête de vers pour insister : anaphore.",
                "Corneille, Le Cid",
            ),
            _figure(
                3,
                "Je ne vois que le ciel, l'eau, le sable, les rochers, les nuages, et rien d'autre.",
                "accumulation",
                "Une énumération de noms qui s'entassent : accumulation.",
            ),
            _figure(
                3,
                "Ce sac pèse une tonne !",
                "hyperbole",
                "Une tonne, c'est une exagération pour dire « très lourd » : hyperbole.",
            ),
        ],
        INSISTANCE,
        writable=True,
    ),
    Notion(
        "figures.attenuation",
        "Figures d'atténuation",
        "Litote : dire moins pour faire entendre plus. Euphémisme : adoucir une réalité pénible.",
        [
            _figure(
                1,
                "Va, je ne te hais point.",
                "litote",
                "Chimène dit « je ne te hais point » pour faire entendre « je t'aime » : litote.",
                "Corneille, Le Cid",
            ),
            _figure(
                1,
                "Il nous a quittés.",
                "euphémisme",
                "Pour adoucir l'annonce d'une mort, on dit « il nous a quittés » : euphémisme.",
            ),
            _figure(
                2,
                "Ce n'est pas mauvais !",
                "litote",
                "On dit « pas mauvais » pour faire entendre « c'est très bon » : litote.",
            ),
            _figure(
                2,
                "Les personnes à mobilité réduite",
                "euphémisme",
                "L'expression adoucit la réalité du handicap : euphémisme.",
            ),
            _figure(
                3,
                "Elle s'est éteinte paisiblement.",
                "euphémisme",
                "« s'éteindre » adoucit le mot « mourir » : euphémisme.",
            ),
            _figure(
                3,
                "Je ne suis pas mécontent de mon travail.",
                "litote",
                "« pas mécontent » fait entendre « très content » : litote.",
            ),
        ],
        ATTENUATION,
        writable=True,
    ),
    Notion(
        "figures.opposition",
        "Figures d'opposition",
        "Antithèse : deux idées opposées rapprochées. Oxymore : deux mots contraires collés. Chiasme : A B / B A.",
        [
            _figure(
                1,
                "Cette obscure clarté qui tombe des étoiles",
                "oxymore",
                "« obscure » et « clarté » sont contraires et réunis dans le même groupe : oxymore.",
                "Corneille, Le Cid",
            ),
            _figure(
                1,
                "Je vis, je meurs ; je me brûle et me noie",
                "antithèse",
                "Vivre et mourir, brûler et se noyer : idées opposées rapprochées. Antithèse.",
                "Louise Labé, Sonnet VIII",
            ),
            _figure(
                2,
                "Il faut manger pour vivre et non pas vivre pour manger.",
                "chiasme",
                "manger / vivre puis vivre / manger : les termes sont croisés (A B B A). Chiasme.",
                "Molière, L'Avare",
            ),
            _figure(
                2,
                "Un silence assourdissant",
                "oxymore",
                "Un silence ne fait pas de bruit : les deux mots contraires sont collés. Oxymore.",
            ),
            _figure(
                2,
                "Je suis l'homme le plus occupé du monde : je ne fais rien.",
                "paradoxe",
                "L'idée semble absurde mais fait réfléchir : paradoxe.",
            ),
            _figure(
                3,
                "Un roi chantait en bas, en haut mourait un dieu.",
                "chiasme",
                "roi / en bas puis en haut / dieu : construction croisée. Chiasme.",
                "Victor Hugo",
            ),
            _figure(
                3,
                "Je ne sais qu'une chose, c'est que je ne sais rien.",
                "paradoxe",
                "Savoir qu'on ne sait rien : l'idée paraît contradictoire mais elle est juste. Paradoxe.",
            ),
            _figure(
                3,
                "Le jour, il riait avec tous ; la nuit, il pleurait seul.",
                "antithèse",
                "Le jour et la nuit, rire et pleurer, tous et seul : des idées opposées rapprochées. Antithèse.",
            ),
        ],
        OPPOSITION,
        writable=True,
    ),
    Notion(
        "figures.substitution",
        "Figures de substitution",
        "Métonymie : un mot pour un autre qui lui est lié (contenant, lieu, auteur). Périphrase : plusieurs mots pour un seul.",
        [
            _figure(
                1,
                "Boire un verre.",
                "métonymie",
                "On boit le contenu, pas le verre : le contenant pour le contenu. Métonymie.",
            ),
            _figure(
                1,
                "La Ville Lumière.",
                "périphrase",
                "Plusieurs mots pour désigner Paris : périphrase.",
            ),
            _figure(
                2,
                "Toute la salle applaudit.",
                "métonymie",
                "Ce sont les spectateurs qui applaudissent : le lieu pour les personnes. Métonymie.",
            ),
            _figure(
                2,
                "L'astre du jour se lève.",
                "périphrase",
                "« L'astre du jour » désigne le soleil : périphrase.",
            ),
            _figure(2, "J'ai lu un Zola.", "métonymie", "L'auteur pour son œuvre : métonymie."),
            _figure(
                3,
                "Le roi des animaux dort sous l'arbre.",
                "périphrase",
                "« Le roi des animaux » désigne le lion : périphrase.",
            ),
            _figure(
                3,
                "Paris a voté.",
                "métonymie",
                "Ce sont les habitants de Paris qui ont voté : le lieu pour ses habitants. Métonymie.",
            ),
        ],
        SUBSTITUTION,
        writable=True,
    ),
    Notion(
        "poesie.versification",
        "Versification",
        "Un alexandrin compte 12 syllabes, coupé en deux hémistiches par la césure.",
        [
            Fact(
                1,
                "Combien de syllabes compte un alexandrin ?",
                "12",
                "L'alexandrin est le vers de 12 syllabes.",
                ("10", "8", "14"),
            ),
            Fact(
                1,
                "Un vers de 10 syllabes s'appelle…",
                "un décasyllabe",
                "« déca- » : dix. Le décasyllabe compte 10 syllabes.",
                ("un alexandrin", "un octosyllabe", "un hexasyllabe"),
            ),
            Fact(
                1,
                "Une strophe de 4 vers s'appelle…",
                "un quatrain",
                "Quatre vers : un quatrain.",
                ("un tercet", "un sizain", "un distique"),
            ),
            Fact(
                2,
                "Une strophe de 3 vers s'appelle…",
                "un tercet",
                "Trois vers : un tercet.",
                ("un quatrain", "un quintil", "un distique"),
            ),
            Fact(
                2,
                "Comment s'appelle la pause au milieu de l'alexandrin ?",
                "la césure",
                "La césure coupe l'alexandrin en deux moitiés de 6 syllabes.",
                ("l'enjambement", "le rejet", "la rime"),
            ),
            Fact(
                2,
                "Chaque moitié d'un alexandrin s'appelle…",
                "un hémistiche",
                "« hémi- » : moitié. Un hémistiche fait 6 syllabes.",
                ("un tercet", "un pied", "un distique"),
            ),
            Fact(
                2,
                "« rose » et « chose » forment une rime…",
                "féminine",
                "Une rime terminée par un « e » muet est féminine.",
                ("masculine", "pauvre"),
            ),
            Fact(
                3,
                "Prononcer « li-on » en deux syllabes au lieu d'une s'appelle…",
                "une diérèse",
                "La diérèse sépare deux voyelles d'ordinaire prononcées ensemble.",
                ("une synérèse", "une élision", "une césure"),
            ),
            Fact(
                3,
                "Quand la phrase se poursuit sur le vers suivant sans pause, c'est…",
                "un enjambement",
                "La phrase « enjambe » la fin du vers : enjambement.",
                ("une césure", "une diérèse", "une rime croisée"),
            ),
            Fact(
                3,
                "« ombre » et « sombre » forment une rime…",
                "riche",
                "Trois sons communs (« on », « b », « r ») : rime riche.",
                ("pauvre", "suffisante"),
            ),
            Fact(
                3,
                "« ami » et « joli » forment une rime…",
                "pauvre",
                "Un seul son commun (« i ») : rime pauvre.",
                ("riche", "suffisante"),
            ),
        ],
    ),
    Notion(
        "poesie.formes",
        "Formes poétiques",
        "Le sonnet : 14 vers, deux quatrains puis deux tercets.",
        [
            Fact(
                1,
                "Combien de vers compte un sonnet ?",
                "14",
                "Le sonnet compte 14 vers.",
                ("12", "10", "16"),
            ),
            Fact(
                1,
                "Comment se compose un sonnet ?",
                "deux quatrains et deux tercets",
                "4 + 4 + 3 + 3 = 14 vers.",
                ("quatre quatrains", "trois tercets et un quatrain", "un seul long quatrain"),
            ),
            Fact(
                2,
                "Quelle forme fixe du Moyen Âge repose sur un refrain et se termine par un envoi ?",
                "la ballade",
                "La ballade (Villon) a un refrain à la fin de chaque strophe et un envoi final.",
                ("le sonnet", "le haïku", "l'ode"),
            ),
            Fact(
                2,
                "Qu'est-ce qu'une fable ?",
                "un court récit, souvent en vers, qui illustre une morale",
                "La fable (La Fontaine) raconte une histoire pour en tirer une leçon.",
                (
                    "un long poème épique",
                    "une pièce de théâtre comique",
                    "un poème de quatorze vers",
                ),
            ),
            Fact(
                3,
                "À quoi reconnaît-on un rondeau ?",
                "un refrain repris du début du premier vers",
                "Le rondeau reprend comme refrain les premiers mots du poème.",
                ("quatorze alexandrins", "l'absence de rimes", "un envoi final adressé au roi"),
            ),
            Fact(
                3,
                "Un poème en vers sans mètre régulier ni rimes obligatoires est écrit en…",
                "vers libres",
                "Les vers libres s'affranchissent du mètre et de la rime.",
                ("alexandrins", "prose", "octosyllabes"),
            ),
        ],
    ),
    Notion(
        "poesie.reperes",
        "Repères : poètes et mouvements",
        "XVIe : la Pléiade (Ronsard, Du Bellay). Fin XVIe – début XVIIe : le baroque. XVIIe : le classicisme.",
        [
            Fact(
                1,
                "Ronsard appartient au groupe…",
                "de la Pléiade",
                "Ronsard et Du Bellay fondent la Pléiade au XVIe siècle.",
                ("des romantiques", "des surréalistes", "des symbolistes"),
            ),
            Fact(
                1,
                "Qui a écrit les Fables (1668-1694) ?",
                "La Fontaine",
                "Jean de La Fontaine a publié ses Fables de 1668 à 1694.",
                ("Molière", "Ronsard", "Hugo"),
            ),
            Fact(
                2,
                "Du Bellay, auteur des Regrets (1558), est un poète du…",
                "XVIe siècle",
                "Les Regrets paraissent en 1558 : XVIe siècle.",
                ("XVIIe siècle", "XVIIIe siècle", "XIXe siècle"),
            ),
            Fact(
                2,
                "Quel poème est de François Villon (XVe siècle) ?",
                "la Ballade des pendus",
                "Villon a écrit la Ballade des pendus, appelée aussi L'Épitaphe Villon.",
                ("Les Fleurs du mal", "Les Regrets", "Les Contemplations"),
            ),
            Fact(
                3,
                "Agrippa d'Aubigné et ses Tragiques (1616) relèvent du…",
                "baroque",
                "Mouvement de l'instabilité et des contrastes, au tournant des XVIe et XVIIe siècles : le baroque.",
                ("classicisme", "romantisme", "surréalisme"),
            ),
            Fact(
                3,
                "Boileau, dans son Art poétique (1674), défend les règles du…",
                "classicisme",
                "L'Art poétique de Boileau fixe les règles du classicisme.",
                ("baroque", "romantisme", "réalisme"),
            ),
            Fact(
                3,
                "Qui a écrit Les Fleurs du mal (1857) ?",
                "Baudelaire",
                "Charles Baudelaire publie Les Fleurs du mal en 1857.",
                ("Verlaine", "Rimbaud", "Hugo"),
            ),
        ],
    ),
    Notion(
        "idees.argumentation",
        "Thèse, arguments, exemples",
        "La thèse est l'opinion défendue, l'argument la justifie, l'exemple l'illustre.",
        [
            Fact(
                1,
                "Dans un texte argumentatif, la thèse est…",
                "l'opinion que défend l'auteur",
                "La thèse, c'est l'idée que l'auteur veut faire admettre.",
                (
                    "un fait concret qui illustre une idée",
                    "une raison qui justifie l'opinion",
                    "la fin d'un récit",
                ),
            ),
            Fact(
                1,
                "Un argument est…",
                "une raison qui justifie la thèse",
                "L'argument répond à la question « pourquoi ? ».",
                (
                    "l'opinion que défend l'auteur",
                    "un fait concret qui illustre une idée",
                    "une citation d'un auteur",
                ),
            ),
            Fact(
                1,
                "Un exemple est…",
                "un fait concret qui illustre un argument",
                "L'exemple rend l'argument concret et vérifiable.",
                (
                    "l'opinion que défend l'auteur",
                    "une raison qui justifie la thèse",
                    "une conclusion générale",
                ),
            ),
            Fact(
                2,
                "« Il faut lire chaque jour. La lecture enrichit le vocabulaire. Ainsi, Paul a progressé en lisant un roman par mois. » Quelle phrase est l'exemple ?",
                "Ainsi, Paul a progressé en lisant un roman par mois.",
                "Le cas de Paul est un fait concret qui illustre l'argument.",
                ("Il faut lire chaque jour.", "La lecture enrichit le vocabulaire."),
            ),
            Fact(
                2,
                "« Il faut lire chaque jour. La lecture enrichit le vocabulaire. Ainsi, Paul a progressé en lisant un roman par mois. » Quelle phrase est la thèse ?",
                "Il faut lire chaque jour.",
                "C'est l'opinion défendue ; les deux autres phrases la justifient et l'illustrent.",
                (
                    "La lecture enrichit le vocabulaire.",
                    "Ainsi, Paul a progressé en lisant un roman par mois.",
                ),
            ),
            Fact(
                3,
                "Réfuter une thèse, c'est…",
                "la contester avec des arguments",
                "Réfuter, c'est montrer qu'une thèse est fausse.",
                ("la défendre", "la résumer", "l'illustrer par un exemple"),
            ),
            Fact(
                3,
                "Faire une concession, c'est…",
                "reconnaître une part de vérité à la thèse adverse",
                "On concède un point (« certes… ») avant de réaffirmer sa thèse (« mais… »).",
                ("abandonner sa propre thèse", "donner un exemple personnel", "conclure son texte"),
            ),
        ],
    ),
    Notion(
        "idees.connecteurs",
        "Connecteurs logiques",
        "« donc » : conséquence ; « car » : cause ; « mais » : opposition ; « bien que » : concession.",
        [
            Fact(
                1,
                "Le connecteur « donc » exprime…",
                "la conséquence",
                "« donc » introduit le résultat de ce qui précède.",
                ("la cause", "l'opposition", "l'addition"),
            ),
            Fact(
                1,
                "Le connecteur « car » exprime…",
                "la cause",
                "« car » introduit une explication, une raison.",
                ("la conséquence", "l'opposition", "le but"),
            ),
            Fact(
                1,
                "Le connecteur « mais » exprime…",
                "l'opposition",
                "« mais » oppose deux idées.",
                ("la cause", "la conséquence", "l'addition"),
            ),
            Fact(
                1,
                "Le connecteur « de plus » exprime…",
                "l'addition",
                "« de plus » ajoute une idée.",
                ("la cause", "l'opposition", "la conséquence"),
            ),
            Fact(
                2,
                "Le connecteur « c'est pourquoi » exprime…",
                "la conséquence",
                "« c'est pourquoi » introduit le résultat.",
                ("la cause", "l'opposition", "le but"),
            ),
            Fact(
                2,
                "Le connecteur « afin que » exprime…",
                "le but",
                "« afin que » indique l'objectif visé.",
                ("la cause", "la conséquence", "l'addition"),
            ),
            Fact(
                2,
                "Complète : « Il pleuvait, … nous sommes sortis. »",
                "pourtant",
                "La sortie s'oppose à ce qu'on attendrait avec la pluie : « pourtant ».",
                ("donc", "car", "ainsi"),
            ),
            Fact(
                3,
                "« Certes…, mais… » exprime…",
                "la concession",
                "On admet un point (« certes ») avant de s'y opposer (« mais ») : concession.",
                ("la cause", "la conséquence", "le but"),
            ),
            Fact(
                3,
                "Le connecteur « bien que » exprime…",
                "la concession",
                "« bien que » : un fait qui devrait empêcher l'autre ne l'empêche pas.",
                ("la cause", "la conséquence", "l'addition"),
            ),
            Fact(
                3,
                "Complète : « Il n'a pas révisé ; … il a échoué. »",
                "par conséquent",
                "L'échec est le résultat du manque de révision : conséquence.",
                ("pourtant", "car", "néanmoins"),
            ),
        ],
    ),
    Notion(
        "idees.genres",
        "Genres argumentatifs",
        "Essai : réflexion personnelle. Pamphlet : attaque violente. Apologue : récit qui porte une leçon.",
        [
            Fact(
                1,
                "Court récit en vers ou en prose qui illustre une morale :",
                "la fable",
                "La fable raconte une histoire pour transmettre une leçon.",
                ("l'essai", "le pamphlet", "l'éditorial"),
            ),
            Fact(
                1,
                "Article où le journal donne son opinion, souvent en première page :",
                "l'éditorial",
                "L'éditorial exprime la position du journal.",
                ("le fait divers", "la fable", "le conte"),
            ),
            Fact(
                2,
                "Texte court et violent qui attaque une personne ou une institution :",
                "le pamphlet",
                "Le pamphlet est une attaque polémique.",
                ("l'essai", "la fable", "l'éloge"),
            ),
            Fact(
                2,
                "Texte où l'auteur réfléchit librement sur un sujet, souvent à la première personne :",
                "l'essai",
                "Montaigne a donné son nom au genre avec ses Essais.",
                ("le pamphlet", "le fait divers", "la fable"),
            ),
            Fact(
                3,
                "Récit qui sert à illustrer une leçon (fable, conte philosophique, parabole) :",
                "l'apologue",
                "L'apologue regroupe les récits porteurs d'une leçon.",
                ("l'essai", "le pamphlet", "l'éditorial"),
            ),
            Fact(
                3,
                "Candide (1759), de Voltaire, est…",
                "un conte philosophique",
                "Voltaire y critique l'optimisme à travers les aventures de Candide.",
                ("un roman réaliste", "une tragédie", "un pamphlet en vers"),
            ),
            Fact(
                3,
                "« J'accuse… ! » (1898), d'Émile Zola, est…",
                "une lettre ouverte publiée dans la presse",
                "Zola y défend Dreyfus dans le journal L'Aurore.",
                ("un roman naturaliste", "un poème satirique", "un discours au Parlement"),
            ),
        ],
    ),
    Notion(
        "recit.narration",
        "Narrateur et point de vue",
        "Zéro : le narrateur sait tout. Interne : on voit par les yeux d'un personnage. Externe : on ne voit que l'extérieur.",
        [
            _definition(
                1,
                "un narrateur qui sait tout des personnages, même leurs pensées ?",
                "focalisation zéro (narrateur omniscient)",
            ),
            _definition(
                1,
                "un récit raconté à travers les yeux et les pensées d'un personnage ?",
                "focalisation interne",
            ),
            _definition(
                1,
                "un récit qui montre seulement les gestes et les paroles, sans les pensées ?",
                "focalisation externe",
            ),
            Fact(
                2,
                "Quel point de vue ?\n« Julien sentit son cœur battre. Il n'osait lever les yeux ; cette femme l'intimidait. »",
                "focalisation interne",
                "On connaît les sensations et les pensées de Julien seul : focalisation interne.",
            ),
            Fact(
                2,
                "Quel point de vue ?\n« Un homme entra. Il posa son chapeau, regarda la salle et s'assit sans un mot. »",
                "focalisation externe",
                "On ne sait ni qui il est ni ce qu'il pense : focalisation externe.",
            ),
            Fact(
                2,
                "Quel point de vue ?\n« Pendant que Marie dormait, son frère, à l'autre bout de la ville, ignorait encore que leur père allait revenir. »",
                "focalisation zéro (narrateur omniscient)",
                "Le narrateur sait ce qui se passe en deux lieux et ce qu'ignorent les personnages : focalisation zéro.",
            ),
            Fact(
                3,
                "Dans un récit à la première personne, le narrateur est…",
                "un personnage de l'histoire",
                "Le « je » qui raconte participe à l'histoire.",
                ("absent de l'histoire", "toujours l'auteur lui-même", "toujours omniscient"),
            ),
        ],
        FOCALISATIONS,
    ),
    Notion(
        "recit.temps_recit",
        "Ordre et rythme du récit",
        "Analepse : retour en arrière. Prolepse : anticipation. Ellipse : du temps passé sous silence.",
        [
            _definition(1, "un retour en arrière dans le récit ?", "analepse"),
            _definition(1, "l'annonce d'événements futurs dans le récit ?", "prolepse"),
            _definition(1, "des années qui passent sans être racontées ?", "ellipse"),
            _definition(2, "plusieurs années résumées en quelques lignes ?", "sommaire"),
            _definition(2, "un arrêt du récit pour une description ?", "pause"),
            _definition(
                2,
                "un passage où le temps du récit suit celui de l'histoire, comme un dialogue ?",
                "scène",
            ),
            Fact(
                3,
                "Quel procédé ?\n« Dix ans plus tard, il revint au village. »",
                "ellipse",
                "Dix années passent sans être racontées : ellipse.",
            ),
            Fact(
                3,
                "Quel procédé ?\n« Il se souvint alors de son enfance à Rouen, des étés chez sa grand-mère. »",
                "analepse",
                "Le récit revient en arrière, vers l'enfance : analepse.",
            ),
            Fact(
                3,
                "Quel procédé ?\n« Il ne savait pas encore que cette rencontre changerait sa vie. »",
                "prolepse",
                "Le narrateur annonce la suite de l'histoire : prolepse.",
            ),
        ],
        TEMPS_RECIT,
        writable=True,
    ),
    Notion(
        "recit.reperes",
        "Repères : romanciers et mouvements",
        "XIXe siècle : Balzac et Flaubert (réalisme), Zola (naturalisme), Hugo (romantisme).",
        [
            Fact(
                1,
                "Balzac, auteur de La Comédie humaine, est un romancier…",
                "réaliste",
                "Balzac peint la société de son temps : réalisme.",
                ("naturaliste", "surréaliste", "classique"),
            ),
            Fact(
                1,
                "Zola, auteur des Rougon-Macquart, est le chef de file du…",
                "naturalisme",
                "Zola étudie l'hérédité et le milieu : naturalisme.",
                ("romantisme", "réalisme", "symbolisme"),
            ),
            Fact(
                2,
                "Qui a écrit Madame Bovary (1857) ?",
                "Flaubert",
                "Gustave Flaubert publie Madame Bovary en 1857.",
                ("Balzac", "Zola", "Stendhal"),
            ),
            Fact(
                2,
                "Qui a écrit Les Misérables (1862) ?",
                "Victor Hugo",
                "Victor Hugo publie Les Misérables en exil, en 1862.",
                ("Zola", "Balzac", "Dumas"),
            ),
            Fact(
                2,
                "Candide (1759) appartient au siècle…",
                "des Lumières",
                "Le XVIIIe siècle de Voltaire est le siècle des Lumières.",
                ("du classicisme", "du romantisme", "du baroque"),
            ),
            Fact(
                3,
                "Qui a écrit Le Rouge et le Noir (1830) ?",
                "Stendhal",
                "Stendhal publie Le Rouge et le Noir en 1830.",
                ("Balzac", "Flaubert", "Maupassant"),
            ),
            Fact(
                3,
                "Les Liaisons dangereuses (1782), roman par lettres, sont de…",
                "Choderlos de Laclos",
                "Laclos écrit ce roman épistolaire en 1782.",
                ("Rousseau", "Voltaire", "Diderot"),
            ),
            Fact(
                3,
                "Germinal (1885) appartient au cycle…",
                "des Rougon-Macquart",
                "Germinal est le treizième roman des Rougon-Macquart de Zola.",
                ("de La Comédie humaine", "des Misérables", "des Thibault"),
            ),
        ],
    ),
    Notion(
        "theatre.vocabulaire",
        "Vocabulaire du théâtre",
        "Tirade : longue réplique. Monologue : seul en scène. Aparté : à part, pour le public. Didascalie : indication de l'auteur.",
        [
            _definition(1, "une longue réplique d'un personnage devant d'autres ?", "tirade"),
            _definition(1, "les paroles d'un personnage seul en scène ?", "monologue"),
            _definition(
                1,
                "une indication de l'auteur sur le jeu ou le décor, souvent en italique ?",
                "didascalie",
            ),
            _definition(
                1, "ce que dit un personnage chaque fois qu'il prend la parole ?", "réplique"
            ),
            _definition(
                2, "des paroles que les autres personnages sont censés ne pas entendre ?", "aparté"
            ),
            _definition(2, "un malentendu : un personnage est pris pour un autre ?", "quiproquo"),
            _definition(
                2,
                "le début de la pièce, qui présente la situation et les personnages ?",
                "exposition",
            ),
            _definition(
                2, "la fin de la pièce, où le sort des personnages est fixé ?", "dénouement"
            ),
            _definition(
                3,
                "un échange rapide de répliques très courtes, souvent d'un vers chacune ?",
                "stichomythie",
            ),
            _definition(
                3,
                "un événement inattendu qui change brusquement le cours de l'action ?",
                "coup de théâtre",
            ),
        ],
        THEATRE,
        writable=True,
    ),
    Notion(
        "theatre.genres",
        "Genres et règles du théâtre",
        "Classicisme : trois unités (action, lieu, temps), bienséance, vraisemblance.",
        [
            Fact(
                1,
                "Pièce qui finit bien, pour faire rire et corriger les mœurs :",
                "la comédie",
                "La comédie veut « corriger les mœurs par le rire ».",
                ("la tragédie", "le drame romantique", "la farce tragique"),
            ),
            Fact(
                1,
                "Pièce où un héros noble affronte un destin fatal :",
                "la tragédie",
                "La tragédie montre des héros écrasés par la fatalité.",
                ("la comédie", "la farce", "le vaudeville"),
            ),
            Fact(
                2,
                "Une seule action, en un seul lieu, en une seule journée :",
                "la règle des trois unités",
                "C'est la règle des trois unités du théâtre classique.",
                ("la règle de bienséance", "la règle de vraisemblance", "la double énonciation"),
            ),
            Fact(
                2,
                "Le drame romantique (Hugo, Hernani, 1830)…",
                "mêle le comique et le tragique",
                "Hugo refuse la séparation des genres et mélange les tons.",
                (
                    "respecte les trois unités",
                    "est toujours écrit en prose",
                    "se termine toujours bien",
                ),
            ),
            Fact(
                3,
                "La règle de bienséance interdit…",
                "de montrer sur scène la violence ou la mort",
                "Ce qui choque n'est pas montré : on le raconte (récit).",
                ("de faire rire", "d'écrire en vers", "de changer d'acte"),
            ),
            Fact(
                3,
                "Phèdre (1677) est une tragédie de…",
                "Racine",
                "Jean Racine écrit Phèdre en 1677.",
                ("Corneille", "Molière", "Marivaux"),
            ),
            Fact(
                3,
                "Le Tartuffe (1664) est une comédie de…",
                "Molière",
                "Molière y dénonce l'hypocrisie religieuse.",
                ("Racine", "Corneille", "Beaumarchais"),
            ),
        ],
    ),
    Notion(
        "theatre.enonciation",
        "Double énonciation et registres",
        "Au théâtre, les personnages se parlent, et à travers eux l'auteur parle au public.",
        [
            Fact(
                1,
                "Au théâtre, la double énonciation signifie que…",
                "les personnages se parlent, mais l'auteur s'adresse aussi au public",
                "Chaque réplique a deux destinataires : un personnage et le spectateur.",
                (
                    "deux acteurs jouent le même rôle",
                    "la pièce est jouée deux fois",
                    "un personnage parle seul",
                ),
            ),
            _definition(1, "un registre qui fait rire ?", "comique"),
            _definition(1, "un registre qui suscite la pitié et l'émotion ?", "pathétique"),
            _definition(
                2, "un registre où le héros lutte contre un destin inévitable ?", "tragique"
            ),
            _definition(
                2,
                "un registre qui exprime des sentiments personnels, souvent amoureux ?",
                "lyrique",
            ),
            _definition(
                2,
                "un registre qui dit le contraire de ce qu'on pense, pour se moquer ?",
                "ironique",
            ),
            _definition(3, "un registre qui grandit des exploits héroïques ?", "épique"),
            _definition(3, "un registre qui attaque et dénonce avec vigueur ?", "polémique"),
        ],
        REGISTRES,
        writable=True,
    ),
]

GENERATORS = register_notions("2nde", "francais", NOTIONS)


# --- Rimes d'un quatrain ------------------------------------------------------------------------

# Familles de rimes (même son final, même graphie) : jamais deux familles qui riment entre elles.
RHYMES = [
    ("amour", "jour", "retour", "détour", "tambour"),
    ("rivage", "voyage", "nuage", "orage", "visage"),
    ("lumière", "prière", "rivière", "poussière", "chaumière"),
    ("cœur", "douleur", "fleur", "bonheur", "couleur"),
    ("enfant", "tremblant", "brillant", "chantant", "éléphant"),
    ("ami", "parmi", "endormi", "infini", "fini"),
    ("ruisseau", "oiseau", "berceau", "roseau", "tombeau"),
]
SCHEMES = {
    "rimes plates (AABB)": "AABB",
    "rimes croisées (ABAB)": "ABAB",
    "rimes embrassées (ABBA)": "ABBA",
}


def _rimes(difficulty: int, rng: random.Random) -> dict[str, Any]:
    name = rng.choice(list(SCHEMES))
    a, b = rng.sample(RHYMES, 2)
    words = {"A": rng.sample(a, 2), "B": rng.sample(b, 2)}
    used = {"A": 0, "B": 0}
    ends = []
    for letter in SCHEMES[name]:
        ends.append(words[letter][used[letter]])
        used[letter] += 1
    choices = list(SCHEMES)
    rng.shuffle(choices)
    return {
        "type": "mcq",
        "prompt": f"Voici les derniers mots des quatre vers d'un quatrain : {', '.join(ends)}. Comment sont disposées les rimes ?",
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(name)},
        "hint": "Plates : AABB. Croisées : ABAB. Embrassées : ABBA.",
        "explanation": f"{' / '.join(f'{w} ({lt})' for w, lt in zip(ends, SCHEMES[name], strict=True))} : {name}.",
        "time_target_ms": 25000 + 3000 * difficulty,
        "meta": {"ends": ends, "scheme": SCHEMES[name]},
    }


RIMES = register(
    Generator(
        code="2nde.francais.rimes",
        level="2nde",
        notion="2nde.francais.poesie.versification",
        role="chapitre",
        title="Disposition des rimes",
        generate=_rimes,
    )
)


# --- Énigme : les vers défaits ------------------------------------------------------------------

# Vers d'auteurs du domaine public, cités exactement, découpés en mots tous différents (l'ordre
# attendu est alors unique). Trié du plus court au plus long : la difficulté choisit la longueur.
VERSES = [
    (("Il", "pleure", "dans", "mon", "cœur"), "Paul Verlaine, Romances sans paroles (1874)"),
    (("Va,", "je", "ne", "te", "hais", "point."), "Pierre Corneille, Le Cid (1637)"),
    (
        ("Mignonne,", "allons", "voir", "si", "la", "rose"),
        "Pierre de Ronsard, « Mignonne, allons voir si la rose »",
    ),
    (
        ("Maître", "Corbeau,", "sur", "un", "arbre", "perché,"),
        "Jean de La Fontaine, « Le Corbeau et le Renard »",
    ),
    (
        ("Sous", "le", "pont", "Mirabeau", "coule", "la", "Seine"),
        "Guillaume Apollinaire, Alcools (1913)",
    ),
    (
        ("Cette", "obscure", "clarté", "qui", "tombe", "des", "étoiles"),
        "Pierre Corneille, Le Cid (1637)",
    ),
    (
        ("Comme", "je", "descendais", "des", "Fleuves", "impassibles,"),
        "Arthur Rimbaud, « Le Bateau ivre » (1871)",
    ),
    (
        ("Rien", "ne", "sert", "de", "courir ;", "il", "faut", "partir", "à", "point."),
        "Jean de La Fontaine, « Le Lièvre et la Tortue »",
    ),
    (
        ("Le", "Poète", "est", "semblable", "au", "prince", "des", "nuées"),
        "Charles Baudelaire, « L'Albatros », Les Fleurs du mal (1857)",
    ),
    (
        ("Heureux", "qui,", "comme", "Ulysse,", "a", "fait", "un", "beau", "voyage,"),
        "Joachim du Bellay, Les Regrets (1558)",
    ),
    (
        ("Ô", "temps !", "suspends", "ton", "vol,", "et", "vous,", "heures", "propices !"),
        "Alphonse de Lamartine, « Le Lac » (1820)",
    ),
    (
        ("Demain,", "dès", "l'aube,", "à", "l'heure", "où", "blanchit", "la", "campagne,"),
        "Victor Hugo, Les Contemplations (1856)",
    ),
]
VERSE_LENGTHS = {1: (5, 6), 2: (6, 7), 3: (7, 8), 4: (8, 9), 5: (9, 10)}


def _vers(difficulty: int, rng: random.Random) -> dict[str, Any]:
    low, high = VERSE_LENGTHS[difficulty]
    words, source = rng.choice([v for v in VERSES if low <= len(v[0]) <= high])
    shown = list(range(len(words)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    verse = " ".join(words)
    return {
        "type": "order",
        "prompt": "Le Ratureur a défait ce vers ! Remets ses mots dans l'ordre.",
        "choices": [words[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(words))]},
        "hint": f"Le vers commence par « {words[0]} ». Il est de : {source}.",
        "explanation": f"Le vers complet : « {verse} » ({source}).",
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": {"verse": verse, "source": source},
    }


VERS = register(
    Generator(
        code="2nde.francais.vers",
        level="2nde",
        notion="2nde.francais.poesie.reperes",
        role="chapitre",
        title="Les vers défaits",
        generate=_vers,
    )
)
