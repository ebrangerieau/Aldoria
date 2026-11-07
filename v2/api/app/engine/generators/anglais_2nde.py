"""Anglais, seconde (programme du BO n° 22 du 29 mai 2025, en vigueur en seconde depuis 2025).

Exemples relus (moteur commun `faits.py`) pour la grammaire, la prononciation et les repères
culturels ; listes de mots par axe culturel (même générateur que le vocabulaire de 6e) ; trois
générateurs calculés :

- `2nde.anglais.irreguliers` : prétérit et participe passé des verbes irréguliers ;
- `2nde.anglais.phrases` : remettre dans l'ordre les mots d'une phrase dont on lit la traduction
  (énigme de la Bibliothèque engloutie, « Les Phrases en miettes ») ;
- `2nde.anglais.frise` : ordonner des événements de l'histoire du Commonwealth (énigme du Port des
  Couronnes, « La Chronique déchirée »).

Écriture : l'anglais entre “ ”, lu par la voix anglaise ; un trou s'écrit « … ». Les propositions
d'une notion de langue sont en anglais (`lang`), sauf celles d'un exemple marqué en français.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.anglais_6e import vocabulary
from app.engine.generators.faits import Fact, Notion, register_notions

LEVEL, SUBJECT = "2nde", "anglais"
EN = "en-GB"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    """Exemple dont les propositions sont en anglais (langue de la notion)."""
    return Fact(level, prompt, answer, why, wrong)


def _fr(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    """Exemple dont les propositions sont en français."""
    return Fact(level, prompt, answer, why, wrong, choices_lang="")


# --- Le verbe -------------------------------------------------------------------------------------

VERBE = [
    Notion(
        "verbe.preterit",
        "Le prétérit simple et le prétérit en be + -ing",
        "Prétérit simple : action terminée, datée. Be + -ing au prétérit : action en cours à un moment du passé.",
        [
            _q(
                1,
                "Complète : “Yesterday, I … my grandmother.”",
                "visited",
                "« Yesterday » situe l'action dans un passé terminé : prétérit simple, “visited”.",
                ("visit", "have visited", "am visiting"),
            ),
            _q(
                1,
                "Complète : “Last summer, we … to Scotland.”",
                "went",
                "« Last summer » : passé terminé. “Go” est irrégulier : “went”.",
                ("go", "have gone", "goed"),
            ),
            _q(
                1,
                "Complète : “She … a letter when the phone rang.”",
                "was writing",
                "L'action était en cours quand le téléphone a sonné : prétérit en be + -ing, “was writing”.",
                ("writes", "has written", "is writing"),
            ),
            _q(
                1,
                "Complète : “Did you … the match last night?”",
                "watch",
                "Après l'auxiliaire “did”, le verbe reste à la base verbale : “watch”.",
                ("watched", "watching", "watches"),
            ),
            _q(
                2,
                "Complète : “They … know the answer, so they asked the teacher.”",
                "didn't",
                "Négation au prétérit : “didn't” + base verbale.",
                ("don't", "haven't", "weren't"),
            ),
            _q(
                2,
                "Complète : “While I …, my brother was cooking.”",
                "was studying",
                "Deux actions en cours en même temps dans le passé : prétérit en be + -ing.",
                ("am studying", "have studied", "study"),
            ),
            _q(
                2,
                "Complète : “When the teacher came in, the students … .”",
                "were talking",
                "Les élèves étaient en train de parler à ce moment-là : “were talking”.",
                ("are talking", "have talked", "talk"),
            ),
            _q(
                2,
                "Quelle phrase est au prétérit en be + -ing ?",
                "It was raining all night.",
                "“Was raining” : be au prétérit + verbe en -ing.",
                ("It rained all night.", "It is raining now.", "It has rained a lot."),
            ),
            _q(
                3,
                "Complète : “Who … this book? – Mark Twain did.”",
                "wrote",
                "Question sur le sujet (who) : pas d'auxiliaire “did”, le verbe est directement au prétérit.",
                ("did wrote", "writed", "was write"),
            ),
            _q(
                3,
                "Complète : “The sun … and the birds were singing when I woke up.”",
                "was shining",
                "Décor d'une scène passée : prétérit en be + -ing, comme “were singing”.",
                ("is shining", "has shone", "shines"),
            ),
            _q(
                3,
                "Complète : “What … you doing at 8 o'clock last night?”",
                "were",
                "Action en cours à une heure précise du passé : “were you doing”.",
                ("did", "was", "are"),
            ),
            _q(
                3,
                "Complète : “She … her leg while she was skiing.”",
                "broke",
                "Action brève qui interrompt une action en cours : prétérit simple, “broke”.",
                ("was breaking", "breaks", "has broken"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "verbe.present_perfect",
        "Le present perfect",
        "Present perfect (have + participe passé) : un passé relié au présent. Date précise ou “ago” : prétérit.",
        [
            _q(
                1,
                "Complète : “I have … finished my homework.”",
                "already",
                "“Already” (déjà) se place entre “have” et le participe passé.",
                ("yet", "ago", "since"),
            ),
            _q(
                1,
                "Complète : “She has lived in London … 2019.”",
                "since",
                "“Since” + point de départ (2019) ; “for” + durée.",
                ("for", "ago", "during"),
            ),
            _q(
                1,
                "Complète : “We have known each other … ten years.”",
                "for",
                "“For” + durée (ten years) ; “since” + point de départ.",
                ("since", "ago", "during"),
            ),
            _q(
                1,
                "Complète : “Have you ever … sushi?”",
                "eaten",
                "Present perfect : have + participe passé. “Eat, ate, eaten.”",
                ("ate", "eat", "eating"),
            ),
            _q(
                2,
                "Complète : “I … him two days ago.”",
                "saw",
                "“Ago” situe l'action dans un passé coupé du présent : prétérit, “saw”.",
                ("have seen", "have saw", "see"),
            ),
            _q(
                2,
                "Complète : “I haven't finished my essay … .”",
                "yet",
                "“Yet” (pas encore) se place en fin de phrase négative ou interrogative.",
                ("already", "since", "ago"),
            ),
            _q(
                2,
                "Complète : “This is the first time I … to Canada.”",
                "have been",
                "“This is the first time” est suivi du present perfect : “I have been”.",
                ("am", "was going", "go"),
            ),
            _q(
                2,
                "Complète : “How long … you been learning English?”",
                "have",
                "Durée jusqu'à maintenant : “How long have you been + -ing ?”",
                ("did", "are", "were"),
            ),
            _q(
                3,
                "Complète : “Charles Dickens … many novels.”",
                "wrote",
                "Dickens est mort en 1870 : action terminée, coupée du présent, donc prétérit.",
                ("has written", "has wrote", "writes"),
            ),
            _q(
                3,
                "Complète : “I'm exhausted: I … since six this morning.”",
                "have been working",
                "Action commencée à 6 h et qui dure encore : present perfect en be + -ing.",
                ("am working", "work", "worked"),
            ),
            _q(
                3,
                "Complète : “They … married in 2015.”",
                "got",
                "Date précise (2015) : prétérit, “got married”.",
                ("have got", "have gotten", "get"),
            ),
            _q(
                3,
                "Quelle phrase traduit « J'attends depuis une heure » ?",
                "I have been waiting for an hour.",
                "En anglais, « depuis » avec une action qui dure encore : present perfect + “for”.",
                (
                    "I am waiting since an hour.",
                    "I wait for an hour.",
                    "I have waited since an hour.",
                ),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "verbe.futur",
        "Exprimer le futur",
        "Will : décision, prévision, promesse. Be going to : intention, indice présent. Be + -ing : projet arrangé.",
        [
            _q(
                1,
                "Complète : “Look at those black clouds! It … rain.”",
                "is going to",
                "Un indice visible maintenant (les nuages) : “be going to”.",
                ("will be", "is", "rains"),
            ),
            _q(
                1,
                "Complète : “I'm tired. I think I … go to bed.”",
                "will",
                "Décision prise au moment où l'on parle : “will”.",
                ("am going", "going", "goes"),
            ),
            _q(
                1,
                "Complète : “We … our cousins next Saturday: it's all arranged.”",
                "are meeting",
                "Projet déjà organisé : présent en be + -ing.",
                ("meet", "met", "have met"),
            ),
            _q(
                2,
                "Complète : “The train … at 7.45 tomorrow morning.”",
                "leaves",
                "Horaire fixe (train, cours) : présent simple, même pour le futur.",
                ("left", "has left", "is leave"),
            ),
            _q(
                2,
                "Complète : “When I … 18, I will learn to drive.”",
                "am",
                "Après “when” qui renvoie au futur, on emploie le présent : “when I am 18”.",
                ("will be", "was", "be"),
            ),
            _q(
                2,
                "Complète : “Don't worry, I … help you with your project.”",
                "will",
                "Promesse, offre d'aide : “will”.",
                ("am", "going", "would have"),
            ),
            _q(
                2,
                "Complète : “What are you … to do next year?”",
                "going",
                "Intention : “be going to” + base verbale.",
                ("will", "go", "gone"),
            ),
            _q(
                3,
                "Complète : “By 2050, sea levels … risen considerably.”",
                "will have",
                "Action accomplie à un moment du futur : “will have” + participe passé.",
                ("will", "are", "have been"),
            ),
            _q(
                3,
                "Complète : “I'll call you as soon as I … home.”",
                "get",
                "Après “as soon as” (futur), présent simple : “as soon as I get home”.",
                ("will get", "got", "getting"),
            ),
            _q(
                3,
                "Complète : “This time tomorrow, we … on a beach in Australia.”",
                "will be lying",
                "Action en cours à un moment du futur : “will be” + -ing.",
                ("lay", "have lain", "had lain"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "verbe.habitude",
        "L'habitude dans le passé et le futur dans le passé",
        "Used to / would : habitude passée. Would, was going to : un futur vu depuis le passé.",
        [
            _q(
                1,
                "Complète : “When I was a child, I … to play with toy cars.”",
                "used",
                "Habitude passée qui n'existe plus : “used to” + base verbale.",
                ("use", "was used", "am used"),
            ),
            _q(
                1,
                "Complète : “My grandfather used to … a farmer.”",
                "be",
                "Après “used to”, la base verbale : “be”.",
                ("being", "been", "was"),
            ),
            _q(
                1,
                "Quelle phrase traduit « Avant, j'habitais à Lyon » ?",
                "I used to live in Lyon.",
                "« Avant, je… » : habitude passée, “used to” + base verbale.",
                (
                    "I am used to living in Lyon.",
                    "I use to live in Lyon.",
                    "I was living in Lyon since.",
                ),
            ),
            _q(
                2,
                "Complète : “Did you use … wear a uniform at school?”",
                "to",
                "À l'interrogatif : “Did you use to” + base verbale.",
                ("for", "of", "at"),
            ),
            _q(
                2,
                "Complète : “Every summer, we … spend hours on the beach.”",
                "would",
                "Habitude passée racontée comme un souvenir : “would” + base verbale.",
                ("will", "are used to", "were"),
            ),
            _q(
                2,
                "Complète : “She didn't … to like vegetables, but now she loves them.”",
                "use",
                "Après “didn't”, on écrit “use to” (sans d).",
                ("used", "using", "uses"),
            ),
            _fr(
                2,
                "Que veut dire “I'm used to getting up early” ?",
                "J'ai l'habitude de me lever tôt.",
                "“Be used to” + -ing : être habitué à. À ne pas confondre avec “used to” (habitude passée).",
                ("Avant, je me levais tôt.", "Je vais me lever tôt.", "Je me suis levé tôt."),
            ),
            _q(
                3,
                "Complète : “He promised that he … call me the next day.”",
                "would",
                "Futur vu depuis le passé (après “promised”) : “would”.",
                ("will", "is going", "shall"),
            ),
            _q(
                3,
                "Complète : “I was about … leave when she arrived.”",
                "to",
                "“Be about to” : être sur le point de.",
                ("for", "of", "that"),
            ),
            _q(
                3,
                "Complète : “They were going … move to Canada, but they changed their minds.”",
                "to",
                "Projet passé qui ne s'est pas réalisé : “was / were going to” + base verbale.",
                ("for", "at", "on"),
            ),
        ],
        lang=EN,
    ),
]

# --- Modalité, hypothèse, souhait -----------------------------------------------------------------

MODALITE = [
    Notion(
        "modalite.probabilite",
        "Les modaux de la probabilité",
        "Must : presque sûr. May, might, could : possible. Can't : impossible.",
        [
            _q(
                1,
                "Complète : “Take an umbrella: it … rain later.” (c'est possible)",
                "might",
                "Possibilité : “might” (ou “may”).",
                ("must", "can't", "has to"),
            ),
            _q(
                1,
                "Complète : “She's been working all day. She … be exhausted.” (presque sûr)",
                "must",
                "Déduction presque certaine : “must”.",
                ("can't", "mustn't", "needn't"),
            ),
            _q(
                1,
                "Complète : “That … be Tom: he's in Australia right now!” (impossible)",
                "can't",
                "Impossibilité logique : “can't”.",
                ("must", "might", "should"),
            ),
            _q(
                1,
                "Quel modal exprime une quasi-certitude ?",
                "must",
                "“Must” : je suis presque sûr. “Might”, “could”, “may” : c'est seulement possible.",
                ("might", "could", "may"),
            ),
            _fr(
                2,
                "Que signifie “He may be late” ?",
                "Il est possible qu'il soit en retard.",
                "“May” exprime une possibilité.",
                (
                    "Il doit être en retard, c'est sûr.",
                    "Il ne peut pas être en retard.",
                    "Il a le droit d'être en retard.",
                ),
            ),
            _q(
                2,
                "Complète : “The lights are off. They … have gone to bed.” (presque sûr)",
                "must",
                "Déduction sur le passé : “must have” + participe passé.",
                ("can't", "should", "needn't"),
            ),
            _q(
                2,
                "Complète : “I'm not sure where he is. He … be in the library.”",
                "could",
                "Simple possibilité : “could”.",
                ("must", "can't", "has to"),
            ),
            _q(
                3,
                "Complète : “You … have seen Anna yesterday: she was in Paris!” (impossible)",
                "can't",
                "Impossibilité dans le passé : “can't have” + participe passé.",
                ("must", "may", "should"),
            ),
            _q(
                3,
                "Complète : “She didn't answer. She might not … heard the phone.”",
                "have",
                "Possibilité dans le passé : “might (not) have” + participe passé.",
                ("has", "had", "having"),
            ),
            _q(
                3,
                "Complète : “Who knows? Humans … live on Mars one day.”",
                "may",
                "Possibilité dans l'avenir : “may”.",
                ("must", "can't", "ought"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "modalite.obligation",
        "Capacité, obligation et conseil",
        "Must / have to : obligation. Mustn't : interdiction. Don't have to, needn't : pas obligé. Should : conseil.",
        [
            _q(
                1,
                "Complète : “You … wear a seatbelt in a car: it's the law.”",
                "must",
                "Obligation : “must” (ou “have to”).",
                ("mustn't", "needn't", "might"),
            ),
            _q(
                1,
                "Complète : “You … smoke here: it's forbidden.”",
                "mustn't",
                "Interdiction : “mustn't”.",
                ("don't have to", "must", "needn't"),
            ),
            _q(
                1,
                "Complète : “It's Sunday: you … get up early.” (pas obligé)",
                "don't have to",
                "Absence d'obligation : “don't have to”. “Mustn't” serait une interdiction.",
                ("mustn't", "must", "have to"),
            ),
            _q(
                2,
                "Complète : “You look ill. You … see a doctor.” (conseil)",
                "should",
                "Conseil : “should”.",
                ("mustn't", "needn't", "can't"),
            ),
            _q(
                2,
                "Complète : “Will you … to come to the party?” (capacité au futur)",
                "be able",
                "“Can” n'a pas de futur : “will be able to”.",
                ("can", "could", "able"),
            ),
            _q(
                2,
                "Complète : “Yesterday, I … to work late.”",
                "had",
                "“Must” n'a pas de passé : “had to”.",
                ("must", "have", "should"),
            ),
            _fr(
                2,
                "Que veut dire “You needn't come” ?",
                "Tu n'es pas obligé de venir.",
                "“Needn't” : absence d'obligation.",
                ("Tu ne dois pas venir.", "Tu devrais venir.", "Tu ne peux pas venir."),
            ),
            _q(
                3,
                "Complète : “You ought … apologise to her.”",
                "to",
                "“Ought to” + base verbale : conseil, devoir moral.",
                ("for", "that", "at"),
            ),
            _q(
                3,
                "Complète : “You should have … me: I could have helped you!” (reproche)",
                "told",
                "Reproche sur le passé : “should have” + participe passé.",
                ("tell", "telling", "to tell"),
            ),
            _q(
                3,
                "Complète : “When she was five, she … already read.”",
                "could",
                "Capacité dans le passé : “could”.",
                ("can", "must", "should"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "modalite.hypothese",
        "Les subordonnées hypothétiques",
        "If + présent → will. If + prétérit → would. If + past perfect → would have + participe passé.",
        [
            _q(
                1,
                "Complète : “If it … tomorrow, we will stay at home.”",
                "rains",
                "Après “if”, pas de “will” : présent simple, “if it rains”.",
                ("will rain", "rained", "would rain"),
            ),
            _q(
                1,
                "Complète : “If I had more money, I … travel around the world.”",
                "would",
                "Hypothèse sur le présent : if + prétérit, puis “would” + base verbale.",
                ("will", "did", "am"),
            ),
            _q(
                1,
                "Complète : “If you heat ice, it … .”",
                "melts",
                "Vérité générale : présent dans les deux parties.",
                ("melted", "would melted", "melting"),
            ),
            _q(
                2,
                "Complète : “If I … you, I would accept the offer.”",
                "were",
                "« Si j'étais toi » : “If I were you”.",
                ("am", "will be", "be"),
            ),
            _q(
                2,
                "Complète : “What would you do if you … the lottery?”",
                "won",
                "Hypothèse sur le présent : if + prétérit, “won”.",
                ("win", "will win", "would win"),
            ),
            _q(
                2,
                "Complète : “We'll miss the bus … we hurry.”",
                "unless",
                "“Unless” = « à moins que », « sauf si ».",
                ("if", "whether", "so"),
            ),
            _q(
                2,
                "Quelle phrase traduit « Si j'avais su, je serais venu » ?",
                "If I had known, I would have come.",
                "Hypothèse sur le passé : if + past perfect, puis “would have” + participe passé.",
                (
                    "If I knew, I would come.",
                    "If I would have known, I had come.",
                    "If I have known, I will come.",
                ),
            ),
            _q(
                3,
                "Complète : “If she had taken the train, she … have been late.”",
                "wouldn't",
                "Hypothèse sur le passé : “wouldn't have” + participe passé.",
                ("won't", "didn't", "hasn't"),
            ),
            _q(
                3,
                "Complète : “… I known, I would have helped you.”",
                "Had",
                "Hypothèse par inversion (soutenu) : “Had I known” = “If I had known”.",
                ("Have", "If", "Did"),
            ),
            _q(
                3,
                "Complète : “I'll lend you my bike as long as you … careful.”",
                "are",
                "Après “as long as” (futur), présent simple.",
                ("will be", "were", "would be"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "modalite.souhait",
        "Le souhait et le regret",
        "Wish + prétérit : regret sur le présent. Wish + past perfect : regret sur le passé.",
        [
            _q(
                1,
                "Complète : “I wish I … taller.” (regret sur le présent)",
                "were",
                "Regret sur le présent : “wish” + prétérit, “were” à toutes les personnes.",
                ("am", "will be", "have been"),
            ),
            _q(
                1,
                "Complète : “I wish I … fly!”",
                "could",
                "Souhait impossible : “wish” + “could”.",
                ("can", "will", "must"),
            ),
            _fr(
                1,
                "Que veut dire “I wish I had a dog” ?",
                "J'aimerais avoir un chien.",
                "“Wish” + prétérit : souhait sur le présent (je n'en ai pas).",
                ("J'ai un chien.", "J'avais un chien.", "Je vais avoir un chien."),
            ),
            _q(
                2,
                "Complète : “I wish I … that: I'm so sorry.” (regret sur le passé)",
                "hadn't said",
                "Regret sur le passé : “wish” + past perfect.",
                ("didn't say", "don't say", "won't say"),
            ),
            _q(
                2,
                "Complète : “If only it … stop raining!”",
                "would",
                "Souhait qu'une situation change : “if only” + “would”.",
                ("will", "does", "has"),
            ),
            _q(
                2,
                "Complète : “She wishes she … speak Chinese.”",
                "could",
                "Souhait d'une capacité : “wish” + “could”.",
                ("can", "will", "must"),
            ),
            _q(
                3,
                "Complète : “I wish you … making so much noise: I'm trying to work.”",
                "would stop",
                "Agacement, souhait que quelqu'un change : “wish” + “would”.",
                ("stop", "will stop", "had stop"),
            ),
            _q(
                3,
                "Quelle phrase exprime un regret sur le passé ?",
                "I wish I had studied harder.",
                "Regret sur le passé : “wish” + past perfect (“had studied”).",
                (
                    "I wish I studied harder.",
                    "I wish I will study harder.",
                    "I wish to study harder.",
                ),
            ),
            _q(
                3,
                "Complète : “If only I … listened to my parents!”",
                "had",
                "Regret sur le passé : “if only” + past perfect.",
                ("have", "would", "did"),
            ),
        ],
        lang=EN,
    ),
]

# --- La phrase ------------------------------------------------------------------------------------

PHRASE = [
    Notion(
        "phrase.relatives",
        "Les propositions relatives",
        "Who : personne. Which : chose. That : les deux. Whose : dont (possession). Whom : après une préposition.",
        [
            _q(
                1,
                "Complète : “The man … lives next door is a doctor.”",
                "who",
                "Antécédent humain sujet : “who”.",
                ("which", "whose", "what"),
            ),
            _q(
                1,
                "Complète : “This is the book … I told you about.”",
                "that",
                "Antécédent non humain : “that” (ou “which”).",
                ("who", "whose", "what"),
            ),
            _q(
                1,
                "Complète : “I have a friend … mother is Australian.”",
                "whose",
                "Possession (« dont la mère ») : “whose”.",
                ("who", "which", "whom"),
            ),
            _q(
                2,
                "Complète : “The city … I was born is very small.”",
                "where",
                "Lieu : “where”.",
                ("which", "who", "whose"),
            ),
            _q(
                2,
                "Complète : “Do you remember the day … we met?”",
                "when",
                "Moment : “when”.",
                ("which", "who", "whose"),
            ),
            _q(
                2,
                "Complète : “The woman to … I spoke was very kind.”",
                "whom",
                "Après une préposition, pour une personne : “whom”.",
                ("who", "which", "whose"),
            ),
            _q(
                2,
                "Dans quelle phrase peut-on supprimer le pronom relatif ?",
                "The film that we saw was great.",
                "Le relatif complément (“that we saw”) peut disparaître : “The film we saw”. Le relatif sujet, non.",
                (
                    "The boy who won the race is my cousin.",
                    "The house which stands on the hill is old.",
                    "The girl whose bag was stolen called the police.",
                ),
            ),
            _q(
                3,
                "Complète : “He passed all his exams, … surprised everyone.”",
                "which",
                "Après une virgule, “which” reprend toute la proposition ; “that” est impossible.",
                ("that", "what", "who"),
            ),
            _q(
                3,
                "Complète : “Maya Angelou, … poems are famous, was also an activist.”",
                "whose",
                "« Dont les poèmes » : “whose”.",
                ("who", "which", "that"),
            ),
            _q(
                3,
                "Complète : “… I don't understand is why he left.”",
                "What",
                "« Ce que » : “what”.",
                ("Which", "That", "Who"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "phrase.discours_indirect",
        "Le discours indirect",
        "On recule d'un temps (is → was, will → would) ; pas d'inversion dans une question indirecte.",
        [
            _q(
                1,
                "Complète : “She said that she … tired.” (Elle a dit : « Je suis fatiguée. »)",
                "was",
                "Au discours indirect, le présent recule au prétérit : “was”.",
                ("be", "were", "been"),
            ),
            _q(
                1,
                "Complète : “He asked me … I liked jazz.”",
                "if",
                "Question fermée rapportée : “if” (ou “whether”).",
                ("that", "what", "do"),
            ),
            _q(
                1,
                "Complète : “She told … to sit down.”",
                "us",
                "“Tell” est suivi directement de la personne : “told us”.",
                ("to us", "that", "we"),
            ),
            _q(
                2,
                "Discours indirect de “I will help you” : “He said he … help me.”",
                "would",
                "“Will” devient “would” au discours indirect.",
                ("will be", "wills", "is"),
            ),
            _q(
                2,
                "Complète : “She asked me where I … .”",
                "lived",
                "Question indirecte : ni inversion ni auxiliaire “do”.",
                ("did live", "do live", "does live"),
            ),
            _q(
                2,
                "Complète : “They asked us what time … .”",
                "it was",
                "Question indirecte : sujet puis verbe, “what time it was”.",
                ("was it", "is it", "did it be"),
            ),
            _q(
                2,
                "Complète : “The teacher told us … talk during the test.”",
                "not to",
                "Ordre négatif rapporté : “told us not to” + base verbale.",
                ("didn't", "doesn't", "no"),
            ),
            _q(
                3,
                "Discours indirect de “I saw her yesterday” : “He said he had seen her the … day.”",
                "previous",
                "“Yesterday” devient “the previous day” (ou “the day before”).",
                ("next", "last", "yesterday"),
            ),
            _q(
                3,
                "Complète : “She asked whether we … finished.”",
                "had",
                "Le present perfect recule au past perfect : “had finished”.",
                ("did", "were having", "has"),
            ),
            _q(
                3,
                "Complète : “He suggested … for a walk.”",
                "going",
                "“Suggest” est suivi du verbe en -ing.",
                ("to go", "go", "went"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "phrase.connecteurs",
        "Les connecteurs logiques et chronologiques",
        "Cause : because. Conséquence : so, as a result. Opposition : however, whereas, although, despite.",
        [
            _q(
                1,
                "Complète : “I like tea, … my sister prefers coffee.”",
                "whereas",
                "Contraste entre deux faits : “whereas” (alors que).",
                ("because", "so", "unless"),
            ),
            _q(
                1,
                "Complète : “It was raining, … we stayed inside.”",
                "so",
                "Conséquence : “so” (donc).",
                ("because", "although", "however"),
            ),
            _q(
                1,
                "Complète : “He was late … the train was cancelled.”",
                "because",
                "Cause : “because” (parce que).",
                ("so", "although", "whereas"),
            ),
            _q(
                2,
                "Complète : “… it was cold, they went swimming.”",
                "Although",
                "Concession : “although” (bien que) + sujet et verbe.",
                ("Because", "So", "Despite"),
            ),
            _q(
                2,
                "Complète : “The plan is expensive. …, it could save lives.”",
                "However",
                "Opposition entre deux phrases : “However,” (cependant).",
                ("Therefore", "Because", "Unless"),
            ),
            _q(
                2,
                "Complète : “She saved money in order … buy a car.”",
                "to",
                "But : “in order to” + base verbale.",
                ("for", "that", "of"),
            ),
            _q(
                2,
                "Complète : “Social networks help people connect. …, they spread fake news.”",
                "On the other hand",
                "Deux aspects opposés : “On the other hand” (d'un autre côté).",
                ("As a result", "For example", "Because"),
            ),
            _q(
                3,
                "Complète : “Pollution has increased. …, many species are threatened.”",
                "As a result",
                "Conséquence : “As a result” (par conséquent).",
                ("Although", "Whereas", "Despite"),
            ),
            _q(
                3,
                "Complète : “… the rain, the match went on.”",
                "Despite",
                "“Despite” (malgré) + nom ; “although” + sujet et verbe.",
                ("Although", "Even though", "However"),
            ),
            _q(
                3,
                "Complète : “You can improve your English … watching series.”",
                "by",
                "Le moyen : “by” + verbe en -ing.",
                ("with", "for", "in"),
            ),
            _q(
                3,
                "Complète : “The museum is free. …, it opens late on Fridays.”",
                "Moreover",
                "Ajout d'un argument : “Moreover” (de plus).",
                ("However", "Therefore", "Although"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "phrase.tags",
        "Les réponses courtes et les question tags",
        "Le tag reprend l'auxiliaire : phrase affirmative → tag négatif, et inversement.",
        [
            _q(
                1,
                "Complète : “You're French, … ?”",
                "aren't you",
                "Phrase affirmative avec “are” : tag négatif “aren't you”.",
                ("isn't it", "don't you", "are you"),
            ),
            _q(
                1,
                "Complète : “She can swim, … ?”",
                "can't she",
                "L'auxiliaire “can” est repris : “can't she”.",
                ("doesn't she", "isn't she", "can she"),
            ),
            _q(
                1,
                "Réponse courte : “Do you like jazz?” – “Yes, I … .”",
                "do",
                "La réponse courte reprend l'auxiliaire de la question : “Yes, I do.”",
                ("like", "am", "does"),
            ),
            _q(
                2,
                "Complète : “They went to London, … ?”",
                "didn't they",
                "Prétérit sans auxiliaire : le tag prend “did”, ici négatif.",
                ("weren't they", "haven't they", "did they"),
            ),
            _q(
                2,
                "Complète : “He hasn't finished yet, … ?”",
                "has he",
                "Phrase négative : tag affirmatif, “has he”.",
                ("hasn't he", "did he", "is he"),
            ),
            _q(
                2,
                "Réponse courte : “Has she seen the film?” – “No, she … .”",
                "hasn't",
                "On reprend l'auxiliaire “has” : “No, she hasn't.”",
                ("doesn't", "didn't", "isn't"),
            ),
            _q(
                2,
                "Réaction : “I've never been to Ireland.” – “Neither … I.”",
                "have",
                "« Moi non plus » : “Neither” + auxiliaire + sujet, “Neither have I”.",
                ("am", "did", "do"),
            ),
            _q(
                3,
                "Complète : “Let's go to the beach, … ?”",
                "shall we",
                "Après “Let's”, le tag est “shall we”.",
                ("will we", "don't we", "let's we"),
            ),
            _q(
                3,
                "Complète : “I'm right, … ?”",
                "aren't I",
                "Cas particulier : “I am” donne le tag “aren't I”.",
                ("am not I", "isn't I", "don't I"),
            ),
            _q(
                3,
                "Complète : “Nobody called, … ?”",
                "did they",
                "“Nobody” rend la phrase négative : tag affirmatif, avec “they”.",
                ("didn't they", "did he", "does it"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "phrase.causatif",
        "Les structures causatives",
        "Make + base verbale : obliger, faire faire. Let + base verbale : laisser. Have something done : faire faire.",
        [
            _q(
                1,
                "Complète : “That film made me … .”",
                "cry",
                "“Make” + complément + base verbale, sans “to”.",
                ("to cry", "crying", "cried"),
            ),
            _q(
                1,
                "Complète : “My parents let me … out late on Saturdays.”",
                "stay",
                "“Let” + complément + base verbale.",
                ("to stay", "staying", "stayed"),
            ),
            _fr(
                1,
                "Que veut dire “Let me help you” ?",
                "Laisse-moi t'aider.",
                "“Let” : laisser, permettre.",
                ("Aide-moi.", "Je t'ai aidé.", "Fais-moi aider."),
            ),
            _q(
                2,
                "Complète : “I had my hair … yesterday.”",
                "cut",
                "« Se faire couper les cheveux » : “have” + objet + participe passé.",
                ("cutting", "to cut", "cuts"),
            ),
            _q(
                2,
                "Quelle phrase traduit « Elle a fait réparer son vélo » ?",
                "She had her bike repaired.",
                "Faire faire par quelqu'un d'autre : “have” + objet + participe passé.",
                (
                    "She repaired her bike.",
                    "She had repaired her bike.",
                    "She made her bike repair.",
                ),
            ),
            _q(
                2,
                "Complète : “The teacher made us … the text again.”",
                "read",
                "“Make” + complément + base verbale.",
                ("to read", "reading", "reads"),
            ),
            _q(
                3,
                "Complète : “We need to get the roof … before winter.”",
                "fixed",
                "“Get” + objet + participe passé : faire faire.",
                ("fix", "fixing", "to fix"),
            ),
            _q(
                3,
                "Complète : “I got my brother … me with my homework.”",
                "to help",
                "“Get” + personne + “to” + verbe : convaincre quelqu'un de faire.",
                ("helps", "helped", "help"),
            ),
            _q(
                3,
                "Complète : “He was made … the truth.”",
                "to tell",
                "Au passif, “make” est suivi de “to” : “was made to tell”.",
                ("tell", "telling", "told"),
            ),
        ],
        lang=EN,
    ),
]

# --- Le groupe nominal ----------------------------------------------------------------------------

NOM = [
    Notion(
        "nom.quantifieurs",
        "Les quantifieurs",
        "Much, little : indénombrable. Many, few : dénombrable. A few, a little : un peu (positif).",
        [
            _q(
                1,
                "Complète : “How … money do you have?”",
                "much",
                "“Money” est indénombrable : “how much”.",
                ("many", "few", "lot"),
            ),
            _q(
                1,
                "Complète : “How … students are there in your class?”",
                "many",
                "“Students” est dénombrable : “how many”.",
                ("much", "little", "lot"),
            ),
            _q(
                1,
                "Complète : “There isn't … milk left.”",
                "any",
                "Phrase négative : “any”.",
                ("some", "many", "few"),
            ),
            _q(
                2,
                "Complète : “I have … friends in Dublin, so I'm never lonely there.”",
                "a few",
                "“A few” = quelques (sens positif), avec un dénombrable.",
                ("few", "a little", "little"),
            ),
            _q(
                2,
                "Complète : “Hurry up! We have very … time.”",
                "little",
                "“Little” = peu de (sens négatif), avec un indénombrable.",
                ("few", "a few", "many"),
            ),
            _q(
                2,
                "Complète : “… people came to the concert: it was almost empty.”",
                "Few",
                "“Few” = peu de (presque personne), avec un dénombrable.",
                ("A few", "Little", "Much"),
            ),
            _q(
                2,
                "Complète : “Can I have … sugar in my tea, please?”",
                "a little",
                "“A little” = un peu de, avec un indénombrable.",
                ("a few", "few", "many"),
            ),
            _q(
                3,
                "Complète : “Most … us agree with you.”",
                "of",
                "« La plupart d'entre nous » : “most of us”.",
                ("from", "in", "to"),
            ),
            _q(
                3,
                "Complète : “There are too … cars in the city centre.”",
                "many",
                "“Cars” est dénombrable : “too many”.",
                ("much", "little", "less"),
            ),
            _q(
                3,
                "Complète : “We have … homework this week than last week.”",
                "less",
                "“Homework” est indénombrable : “less”.",
                ("fewer", "little", "few"),
            ),
            _q(
                3,
                "Complète : “There were … accidents this year than last year.”",
                "fewer",
                "“Accidents” est dénombrable : “fewer”.",
                ("less", "little", "much"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "nom.comparatifs",
        "Comparatifs et superlatifs",
        "Adjectif court : -er, the -est. Adjectif long : more, the most. Irréguliers : good, better, the best.",
        [
            _q(
                1,
                "Complète : “My brother is … than me.”",
                "taller",
                "Adjectif court : “tall” → “taller than”.",
                ("more tall", "tallest", "the taller"),
            ),
            _q(
                1,
                "Complète : “This is the … film I have ever seen.”",
                "best",
                "Superlatif irrégulier : “good, better, the best”.",
                ("better", "goodest", "most good"),
            ),
            _q(
                1,
                "Complète : “English is … difficult than French for me.”",
                "less",
                "Comparatif d'infériorité : “less” + adjectif + “than”.",
                ("fewer", "least", "littler"),
            ),
            _q(
                2,
                "Complète : “Today the weather is … than yesterday.” (plus mauvais)",
                "worse",
                "Comparatif irrégulier : “bad, worse, the worst”.",
                ("badder", "more bad", "worst"),
            ),
            _q(
                2,
                "Complète : “She is the … student in the class.”",
                "most talented",
                "Adjectif long : “the most” + adjectif.",
                ("more talented", "talentedest", "most talent"),
            ),
            _q(
                2,
                "Complète : “Your phone is as … as mine.”",
                "old",
                "Égalité : “as” + adjectif + “as”.",
                ("older", "oldest", "more old"),
            ),
            _q(
                2,
                "Complète : “The weather is getting … and colder.”",
                "colder",
                "« De plus en plus » : on répète le comparatif, “colder and colder”.",
                ("cold", "more cold", "coldest"),
            ),
            _q(
                3,
                "Complète : “Houses in London cost twice … much as in Manchester.”",
                "as",
                "« Deux fois plus » : “twice as much as”.",
                ("so", "than", "more"),
            ),
            _q(
                3,
                "Complète : “The … you practise, the better you get.”",
                "more",
                "« Plus… plus… » : “The more…, the better…”.",
                ("most", "much", "many"),
            ),
            _q(
                3,
                "Complète : “Is it … to the station than to the museum?” (distance)",
                "farther",
                "Comparatif irrégulier de “far” : “farther” (ou “further”).",
                ("farer", "most far", "farthest"),
            ),
            _q(
                3,
                "Complète : “Mount Everest is the highest mountain … the world.”",
                "in",
                "Après un superlatif, un lieu s'introduit par “in”.",
                ("of", "than", "at"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "nom.groupe_nominal",
        "Le groupe nominal complexe et le gérondif",
        "Génitif : my father's car. Nom + nom : a teacup. Verbe en -ing employé comme un nom : Swimming is fun.",
        [
            _q(
                1,
                "Comment dit-on « la voiture de mon père » ?",
                "my father's car",
                "Possession par une personne : génitif, “my father's car”.",
                ("my father car", "the father's my car", "my fathers' car"),
            ),
            _q(
                1,
                "Complète : “… is good for your health.” (Nager…)",
                "Swimming",
                "Un verbe sujet de la phrase se met en -ing : “Swimming is good…”.",
                ("Swim", "To swimming", "Swam"),
            ),
            _q(
                1,
                "Comment dit-on « une tasse de thé » ?",
                "a cup of tea",
                "Contenant et contenu : “a cup of tea”. “A teacup” est une tasse à thé.",
                ("a tea's cup", "a cup tea of", "a tea of cup"),
            ),
            _q(
                2,
                "Comment dit-on « un livre pour enfants » ?",
                "a children's book",
                "Pluriel irrégulier “children” + “'s” : “a children's book”.",
                ("a childrens' book", "a children book", "a book's children"),
            ),
            _q(
                2,
                "Complète : “She enjoys … novels.”",
                "reading",
                "“Enjoy” est suivi du verbe en -ing.",
                ("to read", "read", "reads"),
            ),
            _q(
                2,
                "Complète : “I'm not good at … speeches.”",
                "giving",
                "Après une préposition (at), le verbe se met en -ing.",
                ("give", "to give", "gave"),
            ),
            _q(
                2,
                "Comment dit-on « le travail d'une journée » ?",
                "a day's work",
                "Génitif de durée : “a day's work”.",
                ("a work of day", "a days work", "a day work's"),
            ),
            _fr(
                3,
                "Que désigne “a teacup” ?",
                "une tasse à thé",
                "Nom + nom : le premier précise la sorte. “A teacup” : une tasse à thé, “a cup of tea” : une tasse de thé.",
                ("une tasse de thé", "du thé en tasse", "une théière"),
            ),
            _q(
                3,
                "Complète : “He stopped … when he became ill.” (Il a arrêté de fumer.)",
                "smoking",
                "“Stop” + -ing : arrêter de faire. “Stop to smoke” : s'arrêter pour fumer.",
                ("to smoke", "smoke", "smoked"),
            ),
            _q(
                3,
                "Complète : “I'm looking forward to … you.”",
                "seeing",
                "Dans “look forward to”, “to” est une préposition : verbe en -ing.",
                ("see", "to see", "saw"),
            ),
            _q(
                3,
                "Complète : “It's no use … about it.”",
                "worrying",
                "“It's no use” est suivi du verbe en -ing.",
                ("to worry", "worry", "worried"),
            ),
        ],
        lang=EN,
    ),
    Notion(
        "nom.pronoms",
        "Pronoms réfléchis, réciproques et possessifs",
        "Réfléchi : myself, herself… Réciproque : each other. Possessif : mine, yours, theirs. Its = son (chose).",
        [
            _q(
                1,
                "Complète : “She hurt … while cooking.”",
                "herself",
                "L'action revient sur le sujet : pronom réfléchi, “herself”.",
                ("her", "himself", "itself"),
            ),
            _q(
                1,
                "Complète : “They love … very much.” (l'un l'autre)",
                "each other",
                "Action réciproque : “each other”.",
                ("themselves", "theirs", "them self"),
            ),
            _q(
                1,
                "Complète : “This bag isn't yours, it's … .”",
                "mine",
                "Pronom possessif : “mine” (le mien).",
                ("my", "me", "mines"),
            ),
            _q(
                2,
                "Complète : “The company changed … logo.”",
                "its",
                "Possessif d'une chose : “its”, sans apostrophe (“it's” = it is).",
                ("it's", "his", "it is"),
            ),
            _q(
                2,
                "Complète : “He's a friend of … .”",
                "mine",
                "« Un de mes amis » : “a friend of mine”.",
                ("me", "my", "I"),
            ),
            _q(
                2,
                "Complète : “We enjoyed … at the party.”",
                "ourselves",
                "“Enjoy oneself” : s'amuser. “We” → “ourselves”.",
                ("us", "ourself", "each other"),
            ),
            _q(
                2,
                "Complète : “It's … turn to play.” (c'est ton tour)",
                "your",
                "Déterminant possessif : “your turn”. “You're” = you are.",
                ("you're", "yours", "you"),
            ),
            _q(
                3,
                "Complète : “Help … to some cake!”",
                "yourself",
                "“Help yourself” : sers-toi.",
                ("you", "yours", "your"),
            ),
            _q(
                3,
                "Complète : “Those shoes over there are … .” (à eux)",
                "theirs",
                "Pronom possessif : “theirs” (les leurs).",
                ("their", "there", "them"),
            ),
            _q(
                3,
                "Complète : “Look at … pictures here: they're mine.”",
                "these",
                "Objets proches et au pluriel : “these”.",
                ("those", "this", "that"),
            ),
        ],
        lang=EN,
    ),
]

# --- Prononciation et repères culturels -----------------------------------------------------------

PRONONCIATION = Notion(
    "lexique.prononciation",
    "Prononciation",
    "Beaucoup de mots anglais ont une lettre muette : on l'écrit, on ne la prononce pas.",
    [
        _q(
            1,
            "Quelle lettre est muette dans “knife” ?",
            "k",
            "“Knife” se prononce sans le k, comme “know” et “knee”.",
            ("n", "f", "i"),
        ),
        _q(
            1,
            "Quelle lettre est muette dans “listen” ?",
            "t",
            "“Listen” se prononce sans le t, comme “castle”.",
            ("l", "s", "n"),
        ),
        _q(
            1,
            "Quelle lettre est muette dans “island” ?",
            "s",
            "“Island” se prononce sans le s.",
            ("l", "n", "d"),
        ),
        _q(
            1,
            "Quel mot commence par un h muet ?",
            "honest",
            "“Honest”, comme “hour” et “honour”, se prononce sans le h.",
            ("happy", "house", "hello"),
        ),
        _q(
            2,
            "Quelle lettre est muette dans “Wednesday” ?",
            "d",
            "“Wednesday” se prononce sans le premier d.",
            ("w", "n", "s"),
        ),
        _q(
            2,
            "Quelle lettre est muette dans “climb” ?",
            "b",
            "Après un m, le b final est muet : “climb”, “bomb”, “thumb”.",
            ("c", "l", "m"),
        ),
        _q(
            2,
            "Quelle lettre est muette dans “psychology” ?",
            "p",
            "Le p de “psych-” ne se prononce pas.",
            ("s", "y", "g"),
        ),
        _q(
            2,
            "Dans quel mot entend-on le son de “this” (/ð/) ?",
            "mother",
            "“Mother” : th sonore, comme dans “this”. “Think”, “three”, “bath” : th sourd.",
            ("think", "three", "bath"),
        ),
        _q(
            2,
            "Dans quel mot entend-on le son de “think” (/θ/) ?",
            "teeth",
            "“Teeth” : th sourd, comme dans “think”. “They”, “weather”, “those” : th sonore.",
            ("they", "weather", "those"),
        ),
        _q(
            3,
            "Quelle lettre est muette dans “autumn” ?",
            "n",
            "Après un m, le n final est muet : “autumn”, “column”.",
            ("a", "t", "m"),
        ),
        _q(
            3,
            "Quelle lettre est muette dans “receipt” ?",
            "p",
            "“Receipt” se prononce sans le p.",
            ("r", "c", "t"),
        ),
        _q(
            3,
            "Quelle lettre est muette dans “doubt” ?",
            "b",
            "“Doubt” se prononce sans le b.",
            ("d", "o", "t"),
        ),
        _q(
            3,
            "Dans quel mot le “gh” est-il muet ?",
            "night",
            "“Night” : gh muet. “Enough”, “laugh”, “tough” : gh se prononce comme un f.",
            ("enough", "laugh", "tough"),
        ),
    ],
    lang=EN,
)

CULTURE = [
    Notion(
        "culture.commonwealth",
        "Le Commonwealth : histoire et institutions",
        "Le Commonwealth of Nations réunit des pays, pour la plupart d'anciens territoires de l'Empire britannique.",
        [
            _fr(
                1,
                "Qui est le chef du Commonwealth depuis 2022 ?",
                "le roi Charles III",
                "Charles III a succédé à Elizabeth II en septembre 2022, comme roi et comme chef du Commonwealth.",
                (
                    "la reine Elizabeth II",
                    "le Premier ministre britannique",
                    "le président de l'Inde",
                ),
            ),
            _fr(
                1,
                "Quelle langue les pays du Commonwealth ont-ils en partage ?",
                "l'anglais",
                "L'anglais est la langue commune du Commonwealth, héritée de l'Empire britannique.",
                ("le français", "l'hindi", "l'espagnol"),
            ),
            _fr(
                1,
                "En quelle année l'Inde est-elle devenue indépendante ?",
                "1947",
                "L'Inde et le Pakistan deviennent indépendants en août 1947.",
                ("1857", "1914", "1962"),
            ),
            _fr(
                1,
                "Quelle compétition sportive réunit tous les quatre ans les pays du Commonwealth ?",
                "les Jeux du Commonwealth",
                "Les Jeux du Commonwealth existent depuis 1930 (d'abord appelés British Empire Games).",
                ("les Jeux panaméricains", "le Tournoi des Six Nations", "le Super Bowl"),
            ),
            _fr(
                2,
                "Quel texte de 1949 permet à l'Inde de rester dans le Commonwealth tout en devenant une république ?",
                "la déclaration de Londres",
                "La déclaration de Londres (1949) : les membres ne doivent plus allégeance à la Couronne.",
                ("le statut de Westminster", "la Magna Carta", "le traité de Versailles"),
            ),
            _fr(
                2,
                "Quelle loi de 1931 donne leur autonomie législative aux dominions (Canada, Australie…) ?",
                "le statut de Westminster",
                "Le statut de Westminster (1931) : le Parlement britannique ne fait plus les lois des dominions.",
                ("la déclaration de Londres", "le Bill of Rights", "l'Acte d'union"),
            ),
            _fr(
                2,
                "Quel dirigeant a mené l'Inde vers l'indépendance par la non-violence ?",
                "Gandhi",
                "Gandhi a conduit des campagnes de désobéissance civile non violente contre la domination britannique.",
                ("Nelson Mandela", "Winston Churchill", "Kwame Nkrumah"),
            ),
            _fr(
                2,
                "Quel pays a quitté le Commonwealth en 1961, puis l'a rejoint en 1994, après la fin de l'apartheid ?",
                "l'Afrique du Sud",
                "L'Afrique du Sud quitte le Commonwealth en 1961 et y revient en 1994, après les premières élections libres.",
                ("le Canada", "l'Inde", "l'Australie"),
            ),
            _fr(
                2,
                "Quel romancier né à Zanzibar a reçu le prix Nobel de littérature en 2021 ?",
                "Abdulrazak Gurnah",
                "Abdulrazak Gurnah, né à Zanzibar en 1948, écrit en anglais sur l'exil et les héritages coloniaux.",
                ("J.M. Coetzee", "Salman Rushdie", "Chinua Achebe"),
            ),
            _fr(
                3,
                "Dans quel pays du Commonwealth le roi Charles III est-il aussi chef de l'État ?",
                "le Canada",
                "Le Canada est une monarchie constitutionnelle : le souverain britannique y est chef de l'État.",
                ("l'Inde", "le Nigeria", "l'Afrique du Sud"),
            ),
            _fr(
                3,
                "Quelle colonie britannique d'Afrique de l'Ouest devient indépendante en 1957, avec Kwame Nkrumah ?",
                "le Ghana",
                "L'ancienne Gold Coast devient le Ghana en 1957, sous la conduite de Kwame Nkrumah.",
                ("le Kenya", "le Nigeria", "la Jamaïque"),
            ),
            _fr(
                3,
                "Que désignent les “Stolen Generations”, en Australie ?",
                "les enfants aborigènes retirés de force à leur famille",
                "Des enfants aborigènes ont été retirés à leur famille par les autorités, surtout de 1910 aux années 1970.",
                (
                    "les colons venus d'Europe",
                    "les soldats morts à Gallipoli",
                    "les orphelins de la Seconde Guerre mondiale",
                ),
            ),
            _fr(
                3,
                "Quel territoire est partagé en deux pays au moment de son indépendance, en 1947 ?",
                "l'Inde britannique",
                "La partition de 1947 crée l'Inde et le Pakistan, dans de grandes violences.",
                ("l'Irlande", "le Canada", "l'Australie"),
            ),
        ],
    ),
    Notion(
        "culture.reperes",
        "Figures et mouvements du monde anglophone",
        "Des personnes et des mouvements cités dans les axes du programme de seconde.",
        [
            _fr(
                1,
                "Quel pasteur américain a prononcé le discours “I Have a Dream” en 1963 ?",
                "Martin Luther King",
                "Martin Luther King, figure du mouvement des droits civiques, à Washington en août 1963.",
                ("Malcolm X", "Barack Obama", "Abraham Lincoln"),
            ),
            _fr(
                1,
                "Comment appelait-on les militantes britanniques qui réclamaient le droit de vote des femmes, au début du XXe siècle ?",
                "les suffragettes",
                "Les suffragettes, menées par Emmeline Pankhurst, réclamaient le droit de vote des femmes.",
                ("les préraphaélites", "les puritaines", "les pionnières"),
            ),
            _fr(
                1,
                "Quel militant sud-africain, libéré en 1990, est devenu président en 1994 ?",
                "Nelson Mandela",
                "Nelson Mandela est resté 27 ans en prison avant de devenir le premier président noir de l'Afrique du Sud.",
                ("Desmond Tutu", "Steve Biko", "Kofi Annan"),
            ),
            _fr(
                2,
                "Quelle femme a refusé de céder sa place dans un bus de Montgomery, en 1955 ?",
                "Rosa Parks",
                "L'arrestation de Rosa Parks déclenche le boycott des bus de Montgomery.",
                ("Maya Angelou", "Angela Davis", "Harriet Tubman"),
            ),
            _fr(
                2,
                "Qui sont les premiers habitants de l'Australie ?",
                "les Aborigènes et les insulaires du détroit de Torres",
                "Les peuples aborigènes et ceux du détroit de Torres vivent en Australie depuis des dizaines de milliers d'années.",
                ("les Maoris", "les Inuits", "les Amish"),
            ),
            _fr(
                2,
                "Qui sont les premiers habitants de la Nouvelle-Zélande ?",
                "les Maoris",
                "Les Maoris sont le peuple autochtone de la Nouvelle-Zélande (Aotearoa).",
                ("les Aborigènes", "les Inuits", "les Cherokees"),
            ),
            _fr(
                2,
                "Quelle commission sud-africaine, présidée par Desmond Tutu, a enquêté sur les crimes de l'apartheid ?",
                "la commission Vérité et Réconciliation",
                "La commission Vérité et Réconciliation (Truth and Reconciliation Commission) siège à partir de 1996.",
                ("la Société des Nations", "le Conseil de sécurité", "la Cour suprême"),
            ),
            _fr(
                2,
                "Quelle autrice américaine, aussi poétesse, a raconté sa jeunesse dans “I Know Why the Caged Bird Sings” (1969) ?",
                "Maya Angelou",
                "Maya Angelou, écrivaine et militante des droits civiques.",
                ("Toni Morrison", "Emily Dickinson", "Zadie Smith"),
            ),
            _fr(
                3,
                "Quelle créatrice britannique a contribué à lancer la mode punk dans les années 1970 ?",
                "Vivienne Westwood",
                "Vivienne Westwood a habillé la scène punk londonienne des années 1970.",
                ("Mary Quant", "Stella McCartney", "Coco Chanel"),
            ),
            _fr(
                3,
                "Quel mouvement artistique britannique du XIXe siècle a imposé de nouveaux canons de beauté ?",
                "les préraphaélites",
                "La confrérie préraphaélite, fondée en 1848, a créé un nouvel idéal de beauté féminine.",
                ("les impressionnistes", "les cubistes", "les surréalistes"),
            ),
            _fr(
                3,
                "En 2008, à qui le Premier ministre australien a-t-il présenté des excuses officielles ?",
                "aux Générations volées aborigènes",
                "En février 2008, Kevin Rudd présente les excuses de la nation aux Stolen Generations.",
                ("aux colons britanniques", "aux soldats de l'ANZAC", "aux immigrés irlandais"),
            ),
            _fr(
                3,
                "Quel architecte américain a conçu le musée Guggenheim de New York ?",
                "Frank Lloyd Wright",
                "Frank Lloyd Wright a dessiné le Guggenheim de New York, ouvert en 1959.",
                ("Frank Gehry", "Norman Foster", "Le Corbusier"),
            ),
        ],
    ),
]

NOTIONS = VERBE + MODALITE + PHRASE + NOM + [PRONONCIATION] + CULTURE
FACT_GENERATORS = register_notions(LEVEL, SUBJECT, NOTIONS)


# --- Lexique des axes culturels (même générateur que le vocabulaire de 6e) ------------------------

# Thème → (titre, [(anglais, français, autres formes anglaises acceptées)]).
LEXIQUE: dict[str, tuple[str, list[tuple[str, str, tuple[str, ...]]]]] = {
    "apparence": (
        "l'apparence et la mode",
        [
            ("appearance", "l'apparence", ()),
            ("beauty", "la beauté", ()),
            ("good-looking", "beau, séduisant", ("good looking",)),
            ("ugly", "laid", ()),
            ("weight", "le poids", ()),
            ("height", "la taille (hauteur)", ()),
            ("self-esteem", "l'estime de soi", ("self esteem",)),
            ("prejudice", "le préjugé", ()),
            ("fashion", "la mode", ()),
            ("outfit", "la tenue", ()),
            ("clothing", "les vêtements", ("clothes",)),
            ("trend", "la tendance", ()),
            ("second-hand", "d'occasion", ("second hand",)),
            ("to dye", "teindre", ("dye",)),
            ("tattoo", "le tatouage", ()),
            ("make-up", "le maquillage", ("makeup", "make up")),
        ],
    ),
    "generations": (
        "la famille et les générations",
        [
            ("relatives", "les membres de la famille", ("relative",)),
            ("ancestors", "les ancêtres", ()),
            ("descendants", "les descendants", ()),
            ("siblings", "les frères et sœurs", ()),
            ("stepfamily", "la famille recomposée", ("blended family",)),
            ("the elderly", "les personnes âgées", ("elderly",)),
            ("in-laws", "la belle-famille", ("in laws",)),
            ("household", "le foyer", ()),
            ("ageing", "le vieillissement", ("aging",)),
            ("to take care of", "prendre soin de", ("take care of",)),
            ("generation gap", "le fossé entre les générations", ()),
            ("upbringing", "l'éducation reçue des parents", ()),
            ("grandparents", "les grands-parents", ()),
            ("childhood", "l'enfance", ()),
            ("teenager", "l'adolescent", ("teen",)),
        ],
    ),
    "heritage": (
        "le patrimoine et la mémoire",
        [
            ("heritage", "le patrimoine", ()),
            ("legacy", "l'héritage (ce qu'on laisse)", ()),
            ("heir", "l'héritier", ()),
            ("to inherit", "hériter", ("inherit",)),
            ("monument", "le monument", ()),
            ("statue", "la statue", ()),
            ("to commemorate", "commémorer", ("commemorate",)),
            ("to pay tribute", "rendre hommage", ("pay tribute",)),
            ("memory", "le souvenir", ()),
            ("to remember", "se souvenir", ("remember",)),
            ("museum", "le musée", ()),
            ("estate", "le domaine (propriété)", ()),
            ("century", "le siècle", ()),
            ("slavery", "l'esclavage", ()),
            ("reconciliation", "la réconciliation", ()),
            ("to preserve", "préserver", ("preserve",)),
        ],
    ),
    "transitions": (
        "l'environnement et les transitions",
        [
            ("climate change", "le changement climatique", ()),
            ("greenhouse gas", "le gaz à effet de serre", ("greenhouse gases",)),
            ("emissions", "les émissions", ()),
            ("renewable energy", "l'énergie renouvelable", ("renewables",)),
            ("wind turbine", "l'éolienne", ()),
            ("solar panel", "le panneau solaire", ()),
            ("waste", "les déchets", ()),
            ("to recycle", "recycler", ("recycle",)),
            ("pollution", "la pollution", ()),
            ("to threaten", "menacer", ("threaten",)),
            ("drought", "la sécheresse", ()),
            ("flood", "l'inondation", ()),
            (
                "environmentally friendly",
                "respectueux de l'environnement",
                ("eco-friendly", "eco friendly"),
            ),
            ("demonstration", "la manifestation", ("demo",)),
            ("breakthrough", "la percée (découverte)", ()),
            ("fake news", "les fausses informations", ()),
        ],
    ),
    "creation": (
        "la création et les récits",
        [
            ("novel", "le roman", ()),
            ("novelist", "le romancier", ()),
            ("playwright", "le dramaturge", ()),
            ("plot", "l'intrigue", ()),
            ("character", "le personnage", ()),
            ("myth", "le mythe", ()),
            ("legend", "la légende", ()),
            ("tale", "le conte", ("fairy tale",)),
            ("happy ending", "la fin heureuse", ()),
            ("storytelling", "l'art de raconter des histoires", ()),
            ("to rewrite", "réécrire", ("rewrite",)),
            ("director", "le réalisateur", ()),
            ("readership", "le lectorat", ()),
            ("hero", "le héros", ()),
            ("villain", "le méchant", ()),
            ("masterpiece", "le chef-d'œuvre", ()),
        ],
    ),
    "commonwealth": (
        "la monarchie et le Commonwealth",
        [
            ("the Crown", "la Couronne", ("crown",)),
            ("king", "le roi", ()),
            ("queen", "la reine", ()),
            ("heir to the throne", "l'héritier du trône", ()),
            ("constitutional monarchy", "la monarchie constitutionnelle", ()),
            ("independence", "l'indépendance", ()),
            ("empire", "l'empire", ()),
            ("colony", "la colonie", ()),
            ("member state", "l'État membre", ("member country",)),
            ("ties", "les liens", ()),
            ("to rule", "gouverner", ("rule",)),
            ("republic", "la république", ()),
            ("parliament", "le parlement", ()),
            ("Prime Minister", "le Premier ministre", ()),
            ("Head of State", "le chef de l'État", ()),
            (
                "Indigenous peoples",
                "les peuples autochtones",
                ("indigenous people", "First Nations"),
            ),
        ],
    ),
    "phrasal_verbs": (
        "les phrasal verbs",
        [
            ("give up", "abandonner", ()),
            ("look after", "s'occuper de", ()),
            ("look for", "chercher", ()),
            ("look forward to", "avoir hâte de", ()),
            ("find out", "découvrir (une information)", ()),
            ("get up", "se lever", ()),
            ("grow up", "grandir", ()),
            ("bring up", "élever (un enfant)", ()),
            ("take off", "décoller", ()),
            ("turn down", "refuser (une offre)", ()),
            ("put off", "reporter", ()),
            ("cheer up", "remonter le moral", ()),
            ("set up", "créer, fonder", ()),
            ("carry on", "continuer", ()),
            ("run out of", "manquer de", ()),
            ("break down", "tomber en panne", ()),
            ("get along with", "bien s'entendre avec", ()),
        ],
    ),
}

LEXIQUE_GENERATORS = [
    register(
        Generator(
            code=f"{LEVEL}.{SUBJECT}.lexique.{theme}",
            level=LEVEL,
            notion=f"{LEVEL}.{SUBJECT}.lexique.{theme}",
            role="chapitre",
            title=f"Vocabulaire : {title}",
            generate=vocabulary(theme, title, words),
        )
    )
    for theme, (title, words) in LEXIQUE.items()
]


# --- Verbes irréguliers ---------------------------------------------------------------------------

# (base verbale, prétérit, participe passé, sens) par palier. Pas de verbe à forme régulière admise
# (learn, dream…) : l'intrus « régularisé » serait alors juste.
IRREGULAR: dict[int, list[tuple[str, str, str, str]]] = {
    1: [
        ("begin", "began", "begun", "commencer"),
        ("break", "broke", "broken", "casser"),
        ("bring", "brought", "brought", "apporter"),
        ("buy", "bought", "bought", "acheter"),
        ("choose", "chose", "chosen", "choisir"),
        ("come", "came", "come", "venir"),
        ("do", "did", "done", "faire"),
        ("drink", "drank", "drunk", "boire"),
        ("drive", "drove", "driven", "conduire"),
        ("eat", "ate", "eaten", "manger"),
        ("fall", "fell", "fallen", "tomber"),
        ("feel", "felt", "felt", "ressentir"),
        ("find", "found", "found", "trouver"),
        ("fly", "flew", "flown", "voler (dans les airs)"),
        ("forget", "forgot", "forgotten", "oublier"),
        ("give", "gave", "given", "donner"),
        ("go", "went", "gone", "aller"),
        ("have", "had", "had", "avoir"),
        ("hear", "heard", "heard", "entendre"),
        ("know", "knew", "known", "savoir, connaître"),
        ("leave", "left", "left", "partir, quitter"),
        ("lose", "lost", "lost", "perdre"),
        ("make", "made", "made", "fabriquer"),
        ("meet", "met", "met", "rencontrer"),
        ("pay", "paid", "paid", "payer"),
        ("run", "ran", "run", "courir"),
        ("say", "said", "said", "dire"),
        ("see", "saw", "seen", "voir"),
        ("sell", "sold", "sold", "vendre"),
        ("send", "sent", "sent", "envoyer"),
        ("sing", "sang", "sung", "chanter"),
        ("sleep", "slept", "slept", "dormir"),
        ("speak", "spoke", "spoken", "parler"),
        ("swim", "swam", "swum", "nager"),
        ("take", "took", "taken", "prendre"),
        ("teach", "taught", "taught", "enseigner"),
        ("tell", "told", "told", "raconter"),
        ("think", "thought", "thought", "penser"),
        ("understand", "understood", "understood", "comprendre"),
        ("wear", "wore", "worn", "porter (un vêtement)"),
        ("win", "won", "won", "gagner"),
        ("write", "wrote", "written", "écrire"),
    ],
    2: [
        ("become", "became", "become", "devenir"),
        ("bite", "bit", "bitten", "mordre"),
        ("blow", "blew", "blown", "souffler"),
        ("build", "built", "built", "construire"),
        ("catch", "caught", "caught", "attraper"),
        ("draw", "drew", "drawn", "dessiner"),
        ("fight", "fought", "fought", "se battre"),
        ("forgive", "forgave", "forgiven", "pardonner"),
        ("freeze", "froze", "frozen", "geler"),
        ("grow", "grew", "grown", "grandir, pousser"),
        ("hide", "hid", "hidden", "cacher"),
        ("hold", "held", "held", "tenir"),
        ("keep", "kept", "kept", "garder"),
        ("lead", "led", "led", "mener"),
        ("lend", "lent", "lent", "prêter"),
        ("ring", "rang", "rung", "sonner"),
        ("rise", "rose", "risen", "s'élever"),
        ("shake", "shook", "shaken", "secouer"),
        ("steal", "stole", "stolen", "voler (dérober)"),
        ("throw", "threw", "thrown", "lancer"),
        ("wake", "woke", "woken", "se réveiller"),
    ],
    3: [
        ("bend", "bent", "bent", "plier"),
        ("bind", "bound", "bound", "lier"),
        ("feed", "fed", "fed", "nourrir"),
        ("flee", "fled", "fled", "s'enfuir"),
        ("forbid", "forbade", "forbidden", "interdire"),
        ("seek", "sought", "sought", "chercher"),
        ("sink", "sank", "sunk", "couler, sombrer"),
        ("slide", "slid", "slid", "glisser"),
        ("spin", "spun", "spun", "tourner"),
        ("stick", "stuck", "stuck", "coller"),
        ("sting", "stung", "stung", "piquer"),
        ("swear", "swore", "sworn", "jurer"),
        ("tear", "tore", "torn", "déchirer"),
        ("weep", "wept", "wept", "pleurer"),
        ("withdraw", "withdrew", "withdrawn", "retirer"),
    ],
}
# Difficulté → (paliers de verbes, forme demandée, réponse écrite).
IRREGULAR_FORMS = {
    1: ((1,), "preterit", False),
    2: ((1,), "participe", False),
    3: ((1, 2), "preterit", True),
    4: ((1, 2), "participe", True),
    5: ((2, 3), "participe", True),
}
FORM_LABELS = {"preterit": "le prétérit", "participe": "le participe passé"}


def regularized(base: str) -> str:
    """Forme fautive « régulière » d'un verbe irrégulier : buy → buyed, write → writed."""
    if base.endswith("e"):
        return base + "d"
    if base.endswith("y") and base[-2:-1] not in "aeiou":
        return base[:-1] + "ied"
    return base + "ed"


def _irreguliers(difficulty: int, rng: random.Random) -> dict[str, Any]:
    tiers, form, written = IRREGULAR_FORMS[difficulty]
    base, preterit, participle, meaning = rng.choice([v for t in tiers for v in IRREGULAR[t]])
    right = preterit if form == "preterit" else participle
    item: dict[str, Any] = {
        "hint": f"“{base}” veut dire « {meaning} ».",
        "explanation": f"“{base}, {preterit}, {participle}” ({meaning}) : {FORM_LABELS[form]} est “{right}”.",
        "time_target_ms": 15000 + 3000 * difficulty,
        "meta": {"base": base, "preterit": preterit, "participle": participle, "form": form},
    }
    if written:
        item |= {
            "type": "text",
            "prompt": f"Écris {FORM_LABELS[form]} du verbe “{base}” ({meaning}).",
            "answer": {"kind": "text", "value": [right], "accents": False},
        }
        return item
    wrong = []
    for candidate in (regularized(base), preterit, participle, base, base + "ing"):
        if candidate != right and candidate not in wrong:
            wrong.append(candidate)
    choices = rng.sample(wrong[:3], 3) + [right]
    rng.shuffle(choices)
    item |= {
        "type": "mcq",
        "prompt": f"Quel est {FORM_LABELS[form]} de “{base}” ?",
        "choices": choices,
        "choices_lang": EN,
        "answer": {"kind": "choice", "index": choices.index(right)},
    }
    return item


IRREGULIERS = register(
    Generator(
        code=f"{LEVEL}.{SUBJECT}.irreguliers",
        level=LEVEL,
        notion=f"{LEVEL}.{SUBJECT}.verbe.irreguliers",
        role="chapitre",
        title="Verbes irréguliers",
        generate=_irreguliers,
    )
)


# --- Phrases en miettes (énigme de la Bibliothèque engloutie) -------------------------------------

# Phrase découpée en mots (tous différents : un seul ordre possible) et sa traduction, qui lève
# toute ambiguïté de sens. La majuscule du premier mot et la ponctuation finale aident.
SENTENCES: list[tuple[tuple[str, ...], str]] = [
    (("Reading", "novels", "helps", "me", "relax."), "Lire des romans m'aide à me détendre."),
    (("Few", "people", "know", "the", "truth."), "Peu de gens connaissent la vérité."),
    (("They", "must", "be", "very", "tired."), "Ils doivent être très fatigués."),
    (("India", "became", "independent", "in", "1947."), "L'Inde est devenue indépendante en 1947."),
    (("She", "made", "her", "brother", "laugh."), "Elle a fait rire son frère."),
    (("We", "wish", "it", "were", "summer."), "Nous aimerions que ce soit l'été."),
    (("Have", "you", "ever", "been", "to", "London?"), "Es-tu déjà allé à Londres ?"),
    (("She", "has", "lived", "here", "since", "2018."), "Elle habite ici depuis 2018."),
    (("I", "used", "to", "play", "the", "piano."), "Avant, je jouais du piano."),
    (("You", "should", "have", "told", "me", "earlier."), "Tu aurais dû me le dire plus tôt."),
    (
        ("She", "had", "her", "car", "repaired", "yesterday."),
        "Elle a fait réparer sa voiture hier.",
    ),
    (("You", "don't", "have", "to", "come", "tomorrow."), "Tu n'es pas obligé de venir demain."),
    (("Nobody", "knows", "where", "she", "has", "gone."), "Personne ne sait où elle est partie."),
    (("How", "long", "have", "you", "been", "waiting?"), "Depuis combien de temps attends-tu ?"),
    (
        ("Children", "used", "to", "work", "in", "factories."),
        "Autrefois, des enfants travaillaient dans les usines.",
    ),
    (
        ("They", "have", "just", "finished", "their", "homework."),
        "Ils viennent de finir leurs devoirs.",
    ),
    (
        ("Maya", "Angelou", "wrote", "poems", "about", "freedom."),
        "Maya Angelou a écrit des poèmes sur la liberté.",
    ),
    (
        ("If", "it", "rains,", "we", "will", "stay", "home."),
        "S'il pleut, nous resterons à la maison.",
    ),
    (
        ("They", "were", "watching", "TV", "when", "he", "arrived."),
        "Ils regardaient la télé quand il est arrivé.",
    ),
    (("He", "asked", "me", "if", "I", "was", "tired."), "Il m'a demandé si j'étais fatigué."),
    (
        ("This", "is", "the", "best", "film", "ever", "made."),
        "C'est le meilleur film jamais réalisé.",
    ),
    (("It", "was", "going", "to", "rain", "all", "day."), "Il allait pleuvoir toute la journée."),
    (("He", "is", "looking", "forward", "to", "the", "holidays."), "Il a hâte d'être en vacances."),
    (
        ("Although", "it", "was", "late,", "they", "kept", "working."),
        "Bien qu'il soit tard, ils ont continué à travailler.",
    ),
    (
        ("We", "are", "meeting", "our", "cousins", "on", "Saturday."),
        "Nous voyons nos cousins samedi.",
    ),
    (
        ("The", "museum", "which", "we", "visited", "was", "huge."),
        "Le musée que nous avons visité était immense.",
    ),
    (
        ("Her", "new", "novel", "is", "much", "longer", "than", "mine."),
        "Son nouveau roman est bien plus long que le mien.",
    ),
    (
        ("Abdulrazak", "Gurnah", "won", "the", "Nobel", "Prize", "in", "2021."),
        "Abdulrazak Gurnah a reçu le prix Nobel en 2021.",
    ),
    (
        ("Many", "young", "people", "are", "worried", "about", "climate", "change."),
        "Beaucoup de jeunes s'inquiètent du changement climatique.",
    ),
    (
        ("The", "girl", "whose", "father", "is", "a", "doctor", "lives", "here."),
        "La fille dont le père est médecin habite ici.",
    ),
    (
        ("My", "grandparents", "have", "known", "each", "other", "for", "sixty", "years."),
        "Mes grands-parents se connaissent depuis soixante ans.",
    ),
    (
        ("The", "house", "where", "my", "mother", "grew", "up", "has", "been", "sold."),
        "La maison où ma mère a grandi a été vendue.",
    ),
]
SENTENCE_LENGTHS = {1: (5, 5), 2: (5, 6), 3: (6, 7), 4: (7, 8), 5: (8, 10)}


def _phrases(difficulty: int, rng: random.Random) -> dict[str, Any]:
    low, high = SENTENCE_LENGTHS[difficulty]
    words, french = rng.choice([s for s in SENTENCES if low <= len(s[0]) <= high])
    shown = list(range(len(words)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    sentence = " ".join(words)
    return {
        "type": "order",
        "prompt": f"Sir Tense a mis cette phrase en miettes ! Remets les mots dans l'ordre pour dire : « {french} »",
        "choices": [words[i] for i in shown],
        "choices_lang": EN,
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(words))]},
        "hint": f"La phrase commence par “{words[0]}”.",
        "explanation": f"La phrase : “{sentence}”",
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": {"sentence": sentence, "french": french},
    }


PHRASES = register(
    Generator(
        code=f"{LEVEL}.{SUBJECT}.phrases",
        level=LEVEL,
        notion=f"{LEVEL}.{SUBJECT}.phrase.ordre",
        role="chapitre",
        title="Les phrases en miettes",
        generate=_phrases,
    )
)


# --- Chronique du Commonwealth (énigme du Port des Couronnes) -------------------------------------

# (année, événement en anglais) : dates sûres, une seule par année.
EVENTS = [
    (1867, "Canada becomes a self-governing dominion"),
    (1901, "The six Australian colonies unite as a federation"),
    (1907, "New Zealand becomes a dominion"),
    (1930, "The first British Empire Games take place in Canada"),
    (1931, "The Statute of Westminster is passed"),
    (1947, "India and Pakistan become independent"),
    (1949, "The London Declaration lets India stay in the Commonwealth as a republic"),
    (1952, "Elizabeth II becomes queen"),
    (1957, "Ghana becomes independent"),
    (1960, "Nigeria becomes independent"),
    (1961, "South Africa leaves the Commonwealth"),
    (1962, "Jamaica becomes independent"),
    (1963, "Kenya becomes independent"),
    (1965, "The Commonwealth Secretariat is created"),
    (1967, "Australians vote to count Aboriginal people in the census"),
    (1980, "Zimbabwe becomes independent"),
    (1990, "Nelson Mandela is released from prison"),
    (1994, "South Africa rejoins the Commonwealth"),
    (2008, "Australia's Prime Minister apologises to the Stolen Generations"),
    (2021, "Abdulrazak Gurnah wins the Nobel Prize in Literature"),
    (2022, "Charles III becomes king and Head of the Commonwealth"),
]
# Difficulté → (nombre d'événements, écart minimal en années).
FRISE = {1: (3, 30), 2: (3, 15), 3: (4, 10), 4: (4, 5), 5: (5, 3)}


def _frise(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, gap = FRISE[difficulty]
    while True:
        picked = sorted(rng.sample(EVENTS, count))
        if all(b[0] - a[0] >= gap for a, b in zip(picked, picked[1:], strict=False)):
            break
    shown = list(range(count))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": "Lady Oblivion a déchiré la chronique du Commonwealth ! Remets ces événements dans l'ordre, du plus ancien au plus récent.",
        "choices": [picked[i][1] for i in shown],
        "choices_lang": EN,
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "Les indépendances d'Asie précèdent celles d'Afrique et des Caraïbes.",
        "explanation": "Dans l'ordre : "
        + " ; ".join(f"“{label}” ({year})" for year, label in picked)
        + ".",
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"years": [y for y, _l in picked]},
    }


FRISE_GEN = register(
    Generator(
        code=f"{LEVEL}.{SUBJECT}.frise",
        level=LEVEL,
        notion=f"{LEVEL}.{SUBJECT}.culture.chronologie",
        role="chapitre",
        title="La chronique du Commonwealth",
        generate=_frise,
    )
)
