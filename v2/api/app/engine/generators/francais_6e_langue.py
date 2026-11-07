"""Français, 6e : étude de la langue (programme du cycle 3, BO n° 16 du 17 avril 2025).

Grammaire, temps composés et valeurs des temps, orthographe grammaticale, vocabulaire, à partir
d'exemples relus. Phrases écrites pour le jeu, courtes, une seule bonne réponse. Un trou à
compléter s'écrit « … » (lu comme une pause). Terminologie du programme : « classe grammaticale »,
« fonction », « COD », « COI », « attribut du sujet », « complément circonstanciel ».
"""

from __future__ import annotations

from app.engine.generators.faits import Fact, Notion, register_notions

CLASSES = (
    "nom",
    "verbe",
    "adjectif",
    "adverbe",
    "déterminant",
    "pronom",
    "préposition",
    "conjonction de coordination",
    "conjonction de subordination",
)
DETERMINANTS = (
    "article défini",
    "article indéfini",
    "déterminant possessif",
    "déterminant démonstratif",
    "pronom personnel sujet",
    "pronom personnel complément",
)
FONCTIONS = (
    "sujet",
    "complément d'objet direct (COD)",
    "complément d'objet indirect (COI)",
    "attribut du sujet",
    "complément circonstanciel de lieu",
    "complément circonstanciel de temps",
    "complément circonstanciel de cause",
)
GN = ("nom noyau", "épithète", "complément du nom", "déterminant")
TYPES = ("phrase déclarative", "phrase interrogative", "phrase impérative", "phrase exclamative")
LIENS = (
    "propositions juxtaposées",
    "propositions coordonnées",
    "proposition subordonnée",
    "phrase simple (une seule proposition)",
)
VALEURS = (
    "présent d'énonciation (au moment où l'on parle)",
    "présent de vérité générale (toujours vrai)",
    "imparfait de description",
    "imparfait d'habitude",
    "passé simple : action soudaine ou unique",
    "futur : action à venir",
    "conditionnel : action imaginée ou souhaitée",
)
FORMATION = (
    "mot simple",
    "mot dérivé (préfixe)",
    "mot dérivé (suffixe)",
    "mot dérivé (préfixe et suffixe)",
    "mot composé",
)
REGISTRES = ("registre familier", "registre courant", "registre soutenu")


def _classe(level: int, phrase: str, mot: str, answer: str, why: str) -> Fact:
    return Fact(
        level,
        f"Dans « {phrase} », quelle est la classe grammaticale du mot « {mot} » ?",
        answer,
        why,
    )


def _fonction(level: int, phrase: str, groupe: str, answer: str, why: str) -> Fact:
    return Fact(level, f"Dans « {phrase} », quelle est la fonction de « {groupe} » ?", answer, why)


def _trou(level: int, phrase: str, answer: str, wrong: tuple[str, ...], why: str) -> Fact:
    return Fact(level, f"Complète : « {phrase} »", answer, why, wrong)


NOTIONS = [
    # --- Grammaire ----------------------------------------------------------------------------
    Notion(
        "grammaire.classes_mots",
        "Classes de mots",
        "Un nom se met après un déterminant ; un verbe se conjugue ; un adjectif précise un nom ; "
        "un adverbe est invariable.",
        [
            _classe(1, "Le dragon dort dans sa grotte.", "dragon", "nom",
                    "« dragon » est précédé du déterminant « le » : c'est un nom."),
            _classe(1, "Le dragon dort dans sa grotte.", "dort", "verbe",
                    "« dort » se conjugue (présent de « dormir ») : c'est un verbe."),
            _classe(1, "Une petite fée chantait.", "petite", "adjectif",
                    "« petite » précise le nom « fée » et s'accorde avec lui : c'est un adjectif."),
            _classe(1, "Le chevalier avance lentement.", "lentement", "adverbe",
                    "« lentement » précise le verbe « avance » et ne change jamais : c'est un adverbe."),
            _classe(1, "Le trésor est sous le lit.", "sous", "préposition",
                    "« sous » introduit le groupe « le lit » : c'est une préposition."),
            _classe(2, "Il pleut, mais nous partons.", "mais", "conjonction de coordination",
                    "« mais » relie deux propositions : c'est une conjonction de coordination "
                    "(mais, ou, et, donc, or, ni, car)."),
            _classe(2, "Elle rit quand le clown tombe.", "quand", "conjonction de subordination",
                    "« quand » introduit une proposition subordonnée : c'est une conjonction de "
                    "subordination."),
            _classe(2, "Le renard les guette.", "les", "pronom",
                    "« les » est placé devant le verbe et remplace un nom (les poules…) : c'est un "
                    "pronom personnel."),
            _classe(2, "Nous traversons la forêt très vite.", "très", "adverbe",
                    "« très » précise l'adverbe « vite » ; il est invariable : c'est un adverbe."),
            _classe(2, "Ce bateau semble immense.", "Ce", "déterminant",
                    "« Ce » est placé devant le nom « bateau » : c'est un déterminant démonstratif."),
            _classe(3, "Le marchand vend des tapis volants.", "volants", "adjectif",
                    "« volants » précise le nom « tapis » et s'accorde avec lui : c'est un adjectif."),
            _classe(3, "La sorcière lui parle doucement.", "lui", "pronom",
                    "« lui » remplace une personne (à qui parle-t-elle ?) : c'est un pronom "
                    "personnel complément."),
            _classe(3, "Ils ont marché pendant des heures.", "pendant", "préposition",
                    "« pendant » introduit le groupe « des heures » : c'est une préposition."),
            _classe(3, "Le savant parle bien.", "bien", "adverbe",
                    "« bien » précise le verbe « parle » et ne change pas : c'est un adverbe."),
        ],
        pool=CLASSES,
        writable=True,
    ),
    Notion(
        "grammaire.determinants_pronoms",
        "Déterminants et pronoms",
        "Le déterminant accompagne un nom ; le pronom le remplace.",
        [
            Fact(1, "Dans « le château », quel est le mot « le » ?", "article défini",
                 "« le » désigne un château précis : article défini (le, la, l', les).",
                 ("article indéfini", "déterminant possessif", "déterminant démonstratif")),
            Fact(1, "Dans « une épée », quel est le mot « une » ?", "article indéfini",
                 "« une » désigne une épée quelconque : article indéfini (un, une, des).",
                 ("article défini", "déterminant possessif", "déterminant démonstratif")),
            Fact(1, "Dans « mon cheval », quel est le mot « mon » ?", "déterminant possessif",
                 "« mon » indique à qui est le cheval : déterminant possessif.",
                 ("article défini", "article indéfini", "déterminant démonstratif")),
            Fact(1, "Dans « cette tour », quel est le mot « cette » ?", "déterminant démonstratif",
                 "« cette » montre la tour : déterminant démonstratif (ce, cet, cette, ces).",
                 ("article défini", "article indéfini", "déterminant possessif")),
            Fact(2, "Dans « Nous partons demain », quel est le mot « Nous » ?",
                 "pronom personnel sujet",
                 "« Nous » est le sujet du verbe « partons » : pronom personnel sujet.",
                 ("pronom personnel complément", "déterminant possessif", "article défini")),
            Fact(2, "Dans « La sorcière le regarde », quel est le mot « le » ?",
                 "pronom personnel complément",
                 "Ici « le » remplace un nom (le garçon, le chat…) et complète le verbe : pronom "
                 "personnel complément, pas article.",
                 ("article défini", "pronom personnel sujet", "déterminant démonstratif")),
            Fact(2, "Dans « Ses bottes sont magiques », quel est le mot « Ses » ?",
                 "déterminant possessif",
                 "« Ses » indique à qui sont les bottes : déterminant possessif.",
                 ("déterminant démonstratif", "article défini", "article indéfini")),
            Fact(3, "« Le roi appelle ses chevaliers. Il leur donne une mission. » Qui le pronom "
                 "« leur » remplace-t-il ?", "les chevaliers",
                 "« leur » (pronom complément) reprend « ses chevaliers » : c'est son antécédent.",
                 ("le roi", "une mission", "le château")),
            Fact(3, "« La princesse cherche sa clé. Elle la trouve enfin. » Que remplace « la » ?",
                 "sa clé",
                 "« la » est un pronom complément : il reprend « sa clé », son antécédent.",
                 ("la princesse", "la porte", "enfin")),
            Fact(3, "« Les loups hurlent. Le berger les entend. » Quelle est la fonction du pronom "
                 "« les » ?", "complément d'objet direct (COD)",
                 "On entend quoi ? « les » (les loups) : COD du verbe « entend ».",
                 ("sujet", "complément d'objet indirect (COI)", "attribut du sujet")),
        ],
        pool=DETERMINANTS,
    ),
    Notion(
        "grammaire.fonctions",
        "Fonctions dans la phrase",
        "Sujet : qui fait l'action ? COD : quoi ? qui ? COI : à qui ? de quoi ? "
        "Le complément circonstanciel se déplace et se supprime.",
        [
            _fonction(1, "Le magicien prépare une potion.", "Le magicien", "sujet",
                      "Qui prépare ? « Le magicien » : c'est le sujet du verbe."),
            _fonction(1, "Le magicien prépare une potion.", "une potion",
                      "complément d'objet direct (COD)",
                      "Il prépare quoi ? « une potion », sans préposition : COD."),
            _fonction(1, "Le chevalier parle à son cheval.", "à son cheval",
                      "complément d'objet indirect (COI)",
                      "Il parle à qui ? « à son cheval », avec la préposition « à » : COI."),
            _fonction(1, "Dans la forêt, les loups hurlent.", "Dans la forêt",
                      "complément circonstanciel de lieu",
                      "Où ? « Dans la forêt » ; on peut le déplacer ou le supprimer : complément "
                      "circonstanciel de lieu."),
            _fonction(2, "Le géant semble fatigué.", "fatigué", "attribut du sujet",
                      "« semble » est un verbe d'état : « fatigué » dit comment est le géant. "
                      "C'est un attribut du sujet."),
            _fonction(2, "Chaque soir, la reine lit un conte.", "Chaque soir",
                      "complément circonstanciel de temps",
                      "Quand ? « Chaque soir » ; il se déplace et se supprime : complément "
                      "circonstanciel de temps."),
            _fonction(2, "Le village tremble à cause du dragon.", "à cause du dragon",
                      "complément circonstanciel de cause",
                      "Pourquoi le village tremble-t-il ? « à cause du dragon » : complément "
                      "circonstanciel de cause."),
            _fonction(2, "Ma sœur est une excellente archère.", "une excellente archère",
                      "attribut du sujet",
                      "Après le verbe d'état « est », le groupe dit ce qu'est le sujet : attribut du "
                      "sujet (pas un COD)."),
            _fonction(3, "Au loin galopaient des cavaliers.", "des cavaliers", "sujet",
                      "Qui galopait ? « des cavaliers » : le sujet est placé après le verbe (sujet "
                      "inversé)."),
            _fonction(3, "Le pirate se souvient de son île.", "de son île",
                      "complément d'objet indirect (COI)",
                      "Se souvenir de quoi ? « de son île », construit avec « de » et "
                      "indispensable : COI."),
            _fonction(3, "Le héros devint roi.", "roi", "attribut du sujet",
                      "« devenir » est un verbe d'état : « roi » dit ce qu'est devenu le héros. "
                      "Attribut du sujet."),
            _fonction(3, "Le héros trouva un roi.", "un roi", "complément d'objet direct (COD)",
                      "« trouver » n'est pas un verbe d'état : il trouva qui ? « un roi » : COD."),
        ],
        pool=FONCTIONS,
        writable=False,
    ),
    Notion(
        "grammaire.groupe_nominal",
        "Le groupe nominal",
        "Le nom noyau est le nom principal. L'épithète est un adjectif collé au nom ; le "
        "complément du nom commence par une préposition (de, à, en…).",
        [
            Fact(1, "Dans « un vieux grimoire », quel est le nom noyau ?", "grimoire",
                 "« grimoire » est le nom principal ; « vieux » le précise.",
                 ("vieux", "un", "vieux grimoire")),
            Fact(1, "Dans « la clé du coffre », quel est le nom noyau ?", "clé",
                 "On parle d'une clé : « clé » est le noyau ; « du coffre » le complète.",
                 ("coffre", "la", "du coffre")),
            _fonction(1, "un chat noir", "noir", "épithète",
                      "« noir » est un adjectif placé à côté du nom « chat », sans verbe : épithète."),
            _fonction(2, "une tasse de chocolat", "de chocolat", "complément du nom",
                      "« de chocolat » complète le nom « tasse » avec la préposition « de » : "
                      "complément du nom."),
            _fonction(2, "le château de la reine", "de la reine", "complément du nom",
                      "« de la reine » complète « château » grâce à la préposition « de » : "
                      "complément du nom."),
            _fonction(2, "une immense montagne", "immense", "épithète",
                      "« immense » est un adjectif collé au nom « montagne » : épithète."),
            _fonction(3, "un moulin à vent abandonné", "à vent", "complément du nom",
                      "« à vent » complète « moulin » avec la préposition « à » : complément du nom."),
            _fonction(3, "un moulin à vent abandonné", "abandonné", "épithète",
                      "« abandonné » qualifie le moulin, sans verbe d'état : épithète."),
            Fact(3, "Dans « Ce dragon est terrible », quelle est la fonction de « terrible » ?",
                 "attribut du sujet",
                 "« terrible » est relié au nom par le verbe « est » : c'est un attribut du sujet, "
                 "pas une épithète.", ("épithète", "complément du nom", "nom noyau")),
        ],
        pool=GN,
    ),
    Notion(
        "grammaire.types_phrases",
        "Types et formes de phrases",
        "Déclarative : on affirme. Interrogative : on pose une question. Impérative : on donne un "
        "ordre. Une phrase peut aussi être négative ou exclamative.",
        [
            Fact(1, "« Le soleil se lève. » Quel est le type de cette phrase ?", "phrase déclarative",
                 "Elle donne une information et finit par un point : phrase déclarative."),
            Fact(1, "« Où se cache le trésor ? » Quel est le type de cette phrase ?",
                 "phrase interrogative",
                 "Elle pose une question et finit par un point d'interrogation : phrase "
                 "interrogative."),
            Fact(1, "« Ferme la porte du donjon. » Quel est le type de cette phrase ?",
                 "phrase impérative",
                 "Elle donne un ordre, avec un verbe à l'impératif : phrase impérative."),
            Fact(2, "« Le magicien ne parle jamais. » Quels mots rendent cette phrase négative ?",
                 "ne… jamais",
                 "« ne… jamais » encadre le verbe : la phrase est à la forme négative.",
                 ("parle", "Le magicien", "magicien… parle")),
            Fact(2, "« Quel immense château ! » Quel signe termine cette phrase exclamative ?",
                 "le point d'exclamation",
                 "Une phrase exclamative exprime une émotion et finit par un point "
                 "d'exclamation.", ("le point", "le point d'interrogation", "la virgule")),
            Fact(2, "« Est-ce que tu viens ? » Quel est le type de cette phrase ?",
                 "phrase interrogative",
                 "« Est-ce que » et le point d'interrogation montrent une question : phrase "
                 "interrogative."),
            Fact(3, "Quelle est la forme négative de « Le chat mange encore » ?",
                 "Le chat ne mange plus.",
                 "Le contraire de « encore » est « ne… plus », placé autour du verbe.",
                 ("Le chat ne mange encore.", "Le chat mange pas.", "Le chat ne mange encore pas.")),
            Fact(3, "Quelle phrase est interrogative avec inversion du sujet ?",
                 "Viens-tu avec nous ?",
                 "Le sujet « tu » est placé après le verbe, relié par un trait d'union.",
                 ("Tu viens avec nous ?", "Est-ce que tu viens avec nous ?", "Viens avec nous !")),
            Fact(3, "Transforme en phrase interrogative : « Tu connais ce chemin. »",
                 "Connais-tu ce chemin ?",
                 "Le sujet passe après le verbe (inversion) et la phrase finit par un point "
                 "d'interrogation.",
                 ("Connais ce chemin !", "Tu connais ce chemin.", "Tu ne connais pas ce chemin.")),
        ],
        pool=TYPES,
    ),
    Notion(
        "grammaire.phrase_complexe",
        "La phrase complexe",
        "Une proposition s'organise autour d'un verbe conjugué. Juxtaposées : reliées par une "
        "virgule ou un point-virgule. Coordonnées : par « et, mais, ou, donc, or, ni, car ». "
        "Subordonnée : introduite par « qui, que, quand, parce que… ».",
        [
            Fact(1, "Combien de verbes conjugués y a-t-il dans « Le loup court et le lapin se "
                 "cache » ?", "2",
                 "« court » et « se cache » : deux verbes conjugués, donc deux propositions.",
                 ("1", "3", "4")),
            Fact(1, "« Le soleil brille. » Comment appelle-t-on cette phrase ?",
                 "phrase simple (une seule proposition)",
                 "Un seul verbe conjugué (« brille ») : une seule proposition, phrase simple."),
            Fact(2, "« Il pleut, nous restons à l'abri. » Comment les propositions sont-elles "
                 "reliées ?", "propositions juxtaposées",
                 "Une simple virgule les sépare, sans mot de liaison : elles sont juxtaposées."),
            Fact(2, "« Il pleut, donc nous restons à l'abri. » Comment les propositions sont-elles "
                 "reliées ?", "propositions coordonnées",
                 "« donc » est une conjonction de coordination : propositions coordonnées."),
            Fact(2, "« Nous restons à l'abri parce qu'il pleut. » Comment est « parce qu'il pleut » ?",
                 "proposition subordonnée",
                 "« parce que » introduit une proposition subordonnée qui dépend de la principale."),
            Fact(3, "« Le dragon que tu as vu dort encore. » Quelle est la proposition subordonnée ?",
                 "que tu as vu",
                 "« que tu as vu » complète le nom « dragon » : c'est une subordonnée relative.",
                 ("Le dragon dort encore", "dort encore", "Le dragon que")),
            Fact(3, "Quelle phrase contient deux propositions coordonnées ?",
                 "La fée sourit mais le géant grogne.",
                 "« mais » relie deux propositions (« sourit », « grogne ») de même rang.",
                 ("La fée sourit au géant qui grogne.", "La fée sourit, le géant grogne.",
                  "La fée et le géant sourient.")),
            Fact(3, "Quelle phrase contient deux propositions juxtaposées ?",
                 "Le vent souffle ; la mer gronde.",
                 "Deux verbes conjugués, séparés par un point-virgule sans mot de liaison.",
                 ("Le vent souffle et la mer gronde.", "Le vent souffle quand la mer gronde.",
                  "Le vent et la mer grondent.")),
        ],
        pool=LIENS,
    ),
    # --- Conjugaison (exemples relus ; formes et reconnaissance : francais_6e_conjugaison.py) --
    Notion(
        "conjugaison.temps_composes",
        "Temps composés",
        "Passé composé : auxiliaire au présent + participe passé. Plus-que-parfait : auxiliaire à "
        "l'imparfait + participe passé.",
        [
            Fact(1, "« Nous avons chanté. » Quel est l'auxiliaire ?", "avoir",
                 "« avons » vient du verbe « avoir » : c'est l'auxiliaire.", ("être", "chanter", "aller")),
            Fact(1, "« Elle est partie. » Quel est l'auxiliaire ?", "être",
                 "« est » vient du verbe « être » : c'est l'auxiliaire.", ("avoir", "partir", "aller")),
            Fact(1, "« Ils ont fini. » Quel est le participe passé ?", "fini",
                 "Le passé composé = auxiliaire « ont » + participe passé « fini ».",
                 ("ont", "finir", "finissent")),
            Fact(2, "Quel est le participe passé de « prendre » ?", "pris",
                 "« prendre » → « pris » (j'ai pris).", ("prendu", "prit", "prendé")),
            Fact(2, "Quel est le participe passé de « venir » ?", "venu",
                 "« venir » → « venu » (il est venu).", ("venit", "vint", "venir")),
            Fact(2, "Quel est le participe passé de « faire » ?", "fait",
                 "« faire » → « fait » (j'ai fait).", ("fais", "fit", "faisé")),
            Fact(2, "« Tu avais oublié ta cape. » À quel temps est le verbe ?", "plus-que-parfait",
                 "Auxiliaire à l'imparfait (« avais ») + participe passé : plus-que-parfait.",
                 ("passé composé", "imparfait", "passé simple")),
            Fact(3, "Quelle est la forme négative de « Il a mangé » ?", "Il n'a pas mangé.",
                 "Au passé composé, « ne… pas » entoure l'auxiliaire.",
                 ("Il a ne pas mangé.", "Il n'a mangé pas.", "Il ne pas a mangé.")),
            Fact(3, "« aller » au passé composé avec « ils » :", "ils sont allés",
                 "« aller » se conjugue avec « être » ; le participe s'accorde avec « ils ».",
                 ("ils ont allé", "ils sont allé", "ils ont allés")),
            Fact(3, "« voir » au plus-que-parfait avec « nous » :", "nous avions vu",
                 "Auxiliaire « avoir » à l'imparfait (« avions ») + participe passé « vu ».",
                 ("nous avons vu", "nous voyions", "nous avions voyé")),
        ],
    ),
    Notion(
        "conjugaison.valeurs",
        "Valeurs des temps",
        "Le temps du verbe (présent, imparfait…) n'est pas toujours le moment de l'action : "
        "regarde ce que le temps exprime.",
        [
            Fact(1, "« Aujourd'hui, je lis un conte. » Que montre le présent ?",
                 "présent d'énonciation (au moment où l'on parle)",
                 "L'action se passe au moment où l'on parle : présent d'énonciation."),
            Fact(1, "« L'eau bout à cent degrés. » Que montre le présent ?",
                 "présent de vérité générale (toujours vrai)",
                 "C'est vrai tout le temps : présent de vérité générale."),
            Fact(1, "« Demain, nous partirons à l'aube. » Que montre le futur ?",
                 "futur : action à venir", "L'action n'a pas encore eu lieu : elle est à venir."),
            Fact(2, "« Le château était sombre ; des chauves-souris volaient. » Que montre "
                 "l'imparfait ?", "imparfait de description",
                 "Il décrit le décor de l'histoire : imparfait de description."),
            Fact(2, "« Chaque matin, le meunier ouvrait son moulin. » Que montre l'imparfait ?",
                 "imparfait d'habitude",
                 "« Chaque matin » : l'action se répète. C'est l'imparfait d'habitude."),
            Fact(2, "« Soudain, le dragon surgit. » Que montre le passé simple ?",
                 "passé simple : action soudaine ou unique",
                 "« Soudain » : une action brève, qui fait avancer le récit."),
            Fact(3, "« Si j'avais des ailes, je volerais jusqu'aux nuages. » Que montre le "
                 "conditionnel ?", "conditionnel : action imaginée ou souhaitée",
                 "On imagine une situation qui n'est pas vraie : le conditionnel l'exprime."),
            Fact(3, "Dans un récit au passé, quel temps raconte les actions principales, "
                 "l'une après l'autre ?", "le passé simple",
                 "Le passé simple raconte les actions de premier plan ; l'imparfait décrit le "
                 "décor.", ("l'imparfait", "le présent", "le conditionnel")),
            Fact(3, "Dans « Le roi dormait quand le voleur entra », quel verbe décrit l'arrière-plan "
                 "de l'histoire ?", "dormait",
                 "« dormait » (imparfait) installe la situation ; « entra » (passé simple) est "
                 "l'action qui survient.", ("entra", "roi", "voleur")),
        ],
        pool=VALEURS,
    ),
    # --- Orthographe grammaticale ------------------------------------------------------------
    Notion(
        "orthographe.accord_gn",
        "Accords dans le groupe nominal",
        "Dans le groupe nominal, le déterminant et l'adjectif s'accordent en genre et en nombre "
        "avec le nom noyau.",
        [
            _trou(1, "des chevaux … (blanc)", "blancs", ("blanc", "blanches", "blanche"),
                  "« chevaux » est masculin pluriel : « blancs »."),
            _trou(1, "une forêt … (sombre)", "sombre", ("sombres", "sombrent", "sombré"),
                  "« forêt » est féminin singulier ; « sombre » finit déjà par -e."),
            _trou(1, "les … princesses (petit)", "petites", ("petit", "petits", "petite"),
                  "« princesses » est féminin pluriel : « petites »."),
            _trou(2, "un … château (beau)", "beau", ("bel", "belle", "beaux"),
                  "« château » commence par une consonne : « beau » (on écrit « bel » devant une "
                  "voyelle : un bel arbre)."),
            _trou(2, "des journaux … (local)", "locaux", ("locals", "locales", "local"),
                  "Les adjectifs en -al font souvent leur pluriel en -aux : « locaux »."),
            _trou(2, "des … (bijou) précieux", "bijoux", ("bijous", "bijou", "bijoues"),
                  "Bijou, caillou, chou, genou, hibou, joujou, pou prennent un -x au pluriel."),
            _trou(3, "une robe et un chapeau … (vert)", "verts", ("vertes", "vert", "verte"),
                  "Un nom féminin et un nom masculin : l'adjectif se met au masculin pluriel."),
            _trou(3, "des fées … (gentil)", "gentilles", ("gentiles", "gentils", "gentille"),
                  "« fées » est féminin pluriel : « gentilles », avec deux l."),
            _trou(3, "les chevaliers … (courageux)", "courageux",
                  ("courageuxs", "courageuse", "courageuses"),
                  "Un adjectif qui finit par -x ne change pas au masculin pluriel."),
        ],
    ),
    Notion(
        "orthographe.accord_sujet_verbe",
        "Accord du verbe avec son sujet",
        "Le verbe s'accorde avec son sujet. Cherche le sujet : « Qui est-ce qui… ? ».",
        [
            _trou(1, "Les oiseaux … dans le ciel. (voler, présent)", "volent",
                  ("vole", "voles", "volez"), "Sujet « Les oiseaux » (ils) : « volent »."),
            _trou(1, "Tu … la porte. (ouvrir, présent)", "ouvres", ("ouvre", "ouvrent", "ouvrez"),
                  "Avec « tu », le verbe finit par -s : « ouvres »."),
            _trou(1, "Nous … le chemin. (chercher, présent)", "cherchons",
                  ("cherchez", "cherche", "cherchent"), "Avec « nous » : « cherchons »."),
            _trou(2, "Le chat et le chien … ensemble. (dormir, présent)", "dorment",
                  ("dort", "dors", "dormons"),
                  "Deux sujets (le chat et le chien = ils) : verbe au pluriel, « dorment »."),
            _trou(2, "Les pommes du verger … rouges. (être, présent)", "sont",
                  ("est", "es", "sommes"),
                  "Le sujet est « Les pommes » (pas « du verger ») : « sont »."),
            _trou(2, "Toi et moi … partir. (devoir, présent)", "devons",
                  ("doivent", "devez", "doit"), "« Toi et moi » = nous : « devons »."),
            _trou(3, "Dans la clairière … les lutins. (danser, présent)", "dansent",
                  ("danse", "danses", "dansez"),
                  "Qui est-ce qui danse ? « les lutins », placé après le verbe : « dansent »."),
            _trou(3, "Le roi les … chaque soir. (compter, présent)", "compte",
                  ("comptent", "comptes", "compter"),
                  "« les » est un pronom complément ; le sujet est « Le roi » : « compte »."),
            _trou(3, "La foule des curieux … le dragon. (regarder, présent)", "regarde",
                  ("regardent", "regardes", "regardez"),
                  "Le noyau du sujet est « La foule », singulier : « regarde »."),
        ],
    ),
    Notion(
        "orthographe.participe_passe",
        "Accord du participe passé",
        "Avec « être », le participe s'accorde avec le sujet. Avec « avoir », il s'accorde avec le "
        "COD seulement s'il est placé avant le verbe.",
        [
            _trou(1, "Elles sont … tôt. (partir)", "parties", ("parti", "partis", "partie"),
                  "Avec « être », accord avec le sujet « Elles » : « parties »."),
            _trou(1, "Le roi est … au château. (rentrer)", "rentré",
                  ("rentrée", "rentrés", "rentrer"),
                  "Avec « être », accord avec « Le roi » (masculin singulier) : « rentré »."),
            _trou(1, "Les fées sont … (arriver)", "arrivées", ("arrivé", "arrivés", "arrivée"),
                  "Avec « être », accord avec « Les fées » (féminin pluriel) : « arrivées »."),
            _trou(2, "Elle a … une pomme. (manger)", "mangé", ("mangée", "mangés", "manger"),
                  "Avec « avoir », pas d'accord avec le sujet ; le COD « une pomme » est après le "
                  "verbe : « mangé »."),
            _trou(2, "Les enfants ont … une cabane. (construire)", "construit",
                  ("construits", "construite", "construites"),
                  "Avec « avoir », le COD « une cabane » est placé après : pas d'accord."),
            _trou(2, "Nous sommes … ensemble. (venir ; nous = des garçons)", "venus",
                  ("venu", "venues", "venue"),
                  "Avec « être », accord avec « nous » (des garçons) : « venus »."),
            _trou(3, "Ces lettres, je les ai … hier. (écrire)", "écrites",
                  ("écrit", "écrits", "écrite"),
                  "Le COD « les » (ces lettres, féminin pluriel) est placé avant « avoir » : "
                  "« écrites »."),
            _trou(3, "La clé ? Le chevalier l'a … (perdre)", "perdue",
                  ("perdu", "perdus", "perdues"),
                  "Le COD « l' » (la clé) est placé avant « avoir » : accord au féminin, "
                  "« perdue »."),
            _trou(3, "Ces dragons, la princesse les a … (dompter)", "domptés",
                  ("dompté", "domptées", "domptée"),
                  "Le COD « les » (ces dragons, masculin pluriel) est avant « avoir » : « domptés »."),
        ],
    ),
    Notion(
        "orthographe.homophones",
        "Homophones grammaticaux",
        "Remplace pour vérifier : a → avait ; et → et puis ; est → était ; son → mon ; "
        "sont → étaient ; on → il ; ont → avaient ; ces → ce… ; ses → les siens.",
        [
            _trou(1, "Le chat … faim. (a / à)", "a", ("à",),
                  "On peut dire « Le chat avait faim » : c'est le verbe avoir, « a »."),
            _trou(1, "Il va … la plage. (a / à)", "à", ("a",),
                  "On ne peut pas dire « il va avait la plage » : c'est la préposition « à »."),
            _trou(1, "Le ciel … bleu. (et / est)", "est", ("et",),
                  "On peut dire « Le ciel était bleu » : verbe être, « est »."),
            _trou(1, "Paul … Lina jouent. (et / est)", "et", ("est",),
                  "On peut dire « Paul et puis Lina » : c'est la conjonction « et »."),
            _trou(2, "Les loups … affamés. (son / sont)", "sont", ("son",),
                  "On peut dire « Les loups étaient affamés » : verbe être, « sont »."),
            _trou(2, "Il cherche … épée. (son / sont)", "son", ("sont",),
                  "On peut dire « il cherche mon épée » : déterminant possessif, « son »."),
            _trou(2, "… entend la mer. (On / Ont)", "On", ("Ont",),
                  "On peut dire « Il entend la mer » : pronom « On »."),
            _trou(2, "Les rois … des couronnes. (on / ont)", "ont", ("on",),
                  "On peut dire « Les rois avaient des couronnes » : verbe avoir, « ont »."),
            _trou(3, "Regarde … étoiles là-haut ! (ces / ses)", "ces", ("ses",),
                  "On montre les étoiles (ces étoiles-là) : déterminant démonstratif « ces »."),
            _trou(3, "La sorcière range … potions. (ces / ses)", "ses", ("ces",),
                  "Les potions sont à elle (les siennes) : déterminant possessif « ses »."),
            _trou(3, "Il … parti … la ville. (est, à / et, a)", "est, à",
                  ("et, a", "est, a", "et, à"),
                  "« Il était parti » : « est » ; « à la ville » ne se remplace pas par « avait » : "
                  "« à »."),
        ],
    ),
    # --- Vocabulaire -------------------------------------------------------------------------
    Notion(
        "vocabulaire.formation",
        "Formation des mots",
        "Radical : la base du mot. Préfixe : avant le radical (re-, dé-, in-). Suffixe : après "
        "(-eur, -ment, -able). Mot composé : plusieurs mots réunis.",
        [
            Fact(1, "Quel est le préfixe de « refaire » ?", "re-",
                 "« re- » est ajouté devant « faire » ; il veut dire « encore ».",
                 ("-faire", "-er", "ref-")),
            Fact(1, "Quel est le suffixe de « chanteur » ?", "-eur",
                 "« -eur » est ajouté après le radical « chant- » ; il désigne celui qui fait "
                 "l'action.", ("chant-", "-teur", "-ant")),
            Fact(1, "« portemanteau » est…", "mot composé",
                 "Il est formé de deux mots : « porte » et « manteau »."),
            Fact(2, "« impossible » est…", "mot dérivé (préfixe)",
                 "« im- » (le contraire) + « possible » : un préfixe s'ajoute au mot."),
            Fact(2, "« lentement » est…", "mot dérivé (suffixe)",
                 "« lente » + le suffixe « -ment » (qui forme des adverbes)."),
            Fact(2, "« soleil » est…", "mot simple",
                 "On ne peut pas le découper en préfixe, radical et suffixe : mot simple."),
            Fact(3, "« démontable » est…", "mot dérivé (préfixe et suffixe)",
                 "« dé- » + « mont(er) » + « -able » : un préfixe et un suffixe."),
            Fact(3, "Que veut dire le préfixe de « invisible » ?", "le contraire",
                 "« in- » (ou im-, il-, ir-) donne le sens contraire : qu'on ne peut pas voir.",
                 ("à nouveau", "avant", "très")),
            Fact(3, "Quel mot est formé avec le suffixe « -able » (qu'on peut…) ?", "mangeable",
                 "« mangeable » : qu'on peut manger.", ("manger", "mangeoire", "démanger")),
        ],
        pool=FORMATION,
    ),
    Notion(
        "vocabulaire.synonymes_antonymes",
        "Synonymes et antonymes",
        "Synonyme : même sens. Antonyme : sens contraire. Ils sont de la même classe que le mot.",
        [
            Fact(1, "Quel est un synonyme de « content » ?", "joyeux",
                 "« content » et « joyeux » ont presque le même sens.",
                 ("triste", "fâché", "contenu")),
            Fact(1, "Quel est l'antonyme de « grand » ?", "petit", "« petit » est le contraire de "
                 "« grand ».", ("immense", "géant", "large")),
            Fact(1, "Quel est un synonyme de « rapide » ?", "vif", "« vif » et « rapide » ont un "
                 "sens proche.", ("lent", "lourd", "rapidement")),
            Fact(2, "Quel est l'antonyme de « allumer » ?", "éteindre",
                 "« éteindre » est le contraire de « allumer » ; tous deux sont des verbes.",
                 ("brûler", "éclairer", "extinction")),
            Fact(2, "Quel est un synonyme de « effrayé » ?", "apeuré",
                 "« apeuré » : qui a peur, comme « effrayé ».", ("rassuré", "calme", "effrayant")),
            Fact(2, "Quel est l'antonyme de « courageux » ?", "peureux",
                 "« peureux » est le contraire de « courageux » ; tous deux sont des adjectifs.",
                 ("brave", "hardi", "courage")),
            Fact(3, "Quel synonyme de « rapidement » respecte sa classe (adverbe) ?", "vite",
                 "« vite » est un adverbe, comme « rapidement ».", ("rapide", "vitesse", "pressé")),
            Fact(3, "Quel est l'antonyme de « honnête » formé avec un préfixe ?", "malhonnête",
                 "« mal- » donne le sens contraire : « malhonnête ».",
                 ("inhonnête", "dé-honnête", "honnêteté")),
            Fact(3, "Dans « un soldat brave », quel mot peut remplacer « brave » ?", "courageux",
                 "Ici « brave » veut dire « courageux ».", ("gentil", "peureux", "bravo")),
        ],
    ),
    Notion(
        "vocabulaire.sens",
        "Polysémie et homonymes",
        "Un mot polysémique a plusieurs sens : le contexte choisit. Des homonymes se prononcent "
        "pareil mais ont des sens différents. Sens figuré : une image (« un cœur de pierre »).",
        [
            Fact(1, "Dans « la souris de l'ordinateur », que désigne « souris » ?",
                 "un objet qui déplace la flèche sur l'écran",
                 "Ici, « souris » a un sens différent de l'animal : c'est un mot polysémique.",
                 ("un petit animal", "une souris en sucre", "un sourire")),
            Fact(1, "Quels mots sont des homonymes ?", "verre et vert",
                 "Ils se prononcent de la même façon mais n'ont pas le même sens.",
                 ("vert et rouge", "verre et tasse", "vert et verdure")),
            Fact(1, "« Mon frère a un cœur de pierre. » Le mot « pierre » est employé…",
                 "au sens figuré",
                 "Son cœur n'est pas en pierre : c'est une image pour dire qu'il est dur, "
                 "insensible.", ("au sens propre", "comme un homonyme", "comme un adverbe")),
            Fact(2, "Dans « Le vent souffle fort », le verbe « souffler » est employé…",
                 "au sens propre",
                 "Le vent pousse réellement de l'air : c'est le sens premier, le sens propre.",
                 ("au sens figuré", "comme un nom", "comme un homonyme")),
            Fact(2, "Dans « Elle est restée bouche bée », que veut dire « bouche bée » ?",
                 "très étonnée",
                 "Cette expression dit qu'on reste la bouche ouverte de surprise.",
                 ("affamée", "silencieuse par politesse", "en colère")),
            Fact(2, "Dans « le vol de l'aigle », que veut dire « vol » ?",
                 "le déplacement dans les airs",
                 "« vol » est polysémique : ici il s'agit de voler dans le ciel, pas de prendre "
                 "le bien d'un autre.",
                 ("le fait de prendre ce qui est à un autre", "un groupe d'aigles", "une plume")),
            Fact(3, "Dans « Le voyageur a pris la porte », le verbe « prendre » veut dire…",
                 "partir",
                 "« prendre la porte » est une expression : s'en aller.",
                 ("saisir", "voler", "fermer")),
            Fact(3, "Quels mots sont des homonymes ?", "mer, mère et maire",
                 "Même prononciation, sens et orthographes différents.",
                 ("mer, océan et lac", "mère, père et frère", "maire, mairie et ville")),
            Fact(3, "Dans « Ce problème est un vrai casse-tête », le mot « casse-tête » est "
                 "employé…", "au sens figuré",
                 "Personne ne se casse la tête : l'image dit que le problème est difficile.",
                 ("au sens propre", "comme un homonyme", "comme un verbe")),
        ],
    ),
    Notion(
        "vocabulaire.familles_registres",
        "Familles de mots, étymologie et registres",
        "Les mots d'une même famille ont le même radical. Beaucoup viennent du latin ou du grec. "
        "Registres : familier (entre amis), courant, soutenu (très soigné).",
        [
            Fact(1, "Quel mot est de la même famille que « terre » ?", "souterrain",
                 "« sous-terr-ain » contient le radical « terr » de « terre ».",
                 ("tard", "théière", "terrible")),
            Fact(1, "« une bagnole » appartient au…", "registre familier",
                 "On dit « une voiture » (courant) ; « une bagnole » se dit entre amis."),
            Fact(1, "« un logis » appartient au…", "registre soutenu",
                 "« logis » est un mot recherché pour « maison » (registre courant)."),
            Fact(2, "Quel mot n'est pas de la famille de « dent » ?", "danse",
                 "« danse » se prononce presque pareil mais n'a pas le radical « dent ».",
                 ("dentiste", "dentifrice", "édenté")),
            Fact(2, "Quel mot est de la même famille que « mer » ?", "marin",
                 "« marin » vient du latin « mare » (la mer), comme « marée » et « maritime ».",
                 ("mardi", "merveille", "mère")),
            Fact(2, "« J'ai la flemme » veut dire, en registre courant :", "Je n'ai pas envie.",
                 "« avoir la flemme » est familier : ne pas avoir envie de faire un effort.",
                 ("J'ai très chaud.", "J'ai peur.", "Je suis malade.")),
            Fact(3, "Le mot « géographie » contient le grec « gê » : que veut dire « gê » ?",
                 "la terre",
                 "« géo- » (la terre) + « -graphie » (écrire, décrire) : décrire la Terre.",
                 ("l'eau", "le temps", "le ciel")),
            Fact(3, "Le mot « aquarium » vient du latin « aqua » : que veut dire « aqua » ?",
                 "l'eau",
                 "« aqua » = l'eau, comme dans « aquatique ».", ("le poisson", "le verre", "le bleu")),
            Fact(3, "Quelle phrase est en registre soutenu ?", "Je vous prie de bien vouloir "
                 "m'excuser.",
                 "Vocabulaire choisi et tournure polie : registre soutenu.",
                 ("Désolé, hein !", "Pardon, je m'excuse.", "Oups, c'est ma faute.")),
        ],
        pool=REGISTRES,
    ),
]

GENERATORS = register_notions("6e", "francais", NOTIONS)
