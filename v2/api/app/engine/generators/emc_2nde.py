"""Enseignement moral et civique, seconde (programme du 29 mai 2024, BO n° 24 du 13 juin 2024, en
vigueur en seconde depuis la rentrée 2024) : « Droits, libertés et responsabilité ». Exemples relus,
plus deux énigmes calculées :

- `2nde.emc.normes` : hiérarchie des normes, ou ordre des recours en justice (énigme de la Haute
  Cour) ;
- `2nde.emc.frise` : dates des textes et des nouveaux droits, de 1789 à 2024.

Citations exactes (domaine public) : Déclaration des droits de l'homme et du citoyen, Montesquieu,
loi de 1905, Charte de l'environnement, Code civil. Pas de sigle à lire : les textes sont nommés en
toutes lettres.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions

LEVEL, SUBJECT = "2nde", "emc"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    return Fact(level, prompt, answer, why, wrong)


NOTIONS = [
    # --- L'État de droit -----------------------------------------------------------------------
    Notion(
        "etat_droit.principes",
        "L'État de droit",
        "Dans un État de droit, les pouvoirs publics sont soumis au droit, la justice est "
        "indépendante et les citoyens sont égaux devant la loi. Chaque norme respecte celles qui "
        "lui sont supérieures, jusqu'à la Constitution.",
        [
            _q(1, "Dans un État de droit, à qui la loi s'applique-t-elle ?",
               "à tous, y compris aux gouvernants",
               "Personne n'est au-dessus des lois, pas même ceux qui gouvernent.",
               ("seulement aux citoyens ordinaires", "seulement aux étrangers",
                "à ceux qui l'ont votée")),
            _q(1, "Qu'est-ce que la séparation des pouvoirs ?",
               "confier les pouvoirs législatif, exécutif et judiciaire à des institutions "
               "distinctes",
               "Aucun pouvoir ne peut alors tout décider seul.",
               ("donner tous les pouvoirs au président", "partager le territoire en régions",
                "séparer l'armée et la police")),
            _q(1, "Quel auteur a défendu la séparation des pouvoirs dans « De l'esprit des lois », "
               "en 1748 ?", "Montesquieu",
               "Il écrit qu'il faut que « le pouvoir arrête le pouvoir ».",
               ("Voltaire", "Victor Hugo", "Napoléon")),
            _q(2, "Que signifie « la justice est indépendante » ?",
               "les juges décident sans recevoir d'ordres du gouvernement",
               "L'indépendance des juges protège les libertés de chacun.",
               ("les juges choisissent les lois", "les juges sont élus par les accusés",
                "la justice est gratuite")),
            _q(2, "Qu'est-ce que la hiérarchie des normes ?",
               "chaque règle de droit doit respecter les règles qui lui sont supérieures",
               "Un décret respecte la loi, la loi respecte la Constitution.",
               ("le classement des juges par âge", "l'ordre des articles d'un journal",
                "la liste des élus par importance")),
            _q(2, "Quel texte est au sommet de la hiérarchie des normes en France ?",
               "la Constitution", "Toutes les autres normes doivent la respecter.",
               ("un décret", "un arrêté municipal", "le règlement intérieur d'un lycée")),
            _q(3, "Quelle institution vérifie qu'une loi respecte la Constitution ?",
               "le Conseil constitutionnel",
               "Il peut censurer une loi contraire à la Constitution.",
               ("le Conseil d'État", "la Cour des comptes", "le Sénat")),
            _q(3, "Quelle juridiction est la plus haute pour juger les litiges entre les citoyens "
               "et l'administration ?", "le Conseil d'État",
               "La justice administrative soumet l'administration elle-même au droit.",
               ("la Cour de cassation", "le Conseil constitutionnel", "le tribunal de commerce")),
            _q(3, "Que dit l'article 16 de la Déclaration des droits de l'homme et du citoyen ?",
               "« Toute Société dans laquelle la garantie des Droits n'est pas assurée, ni la "
               "séparation des Pouvoirs déterminée, n'a point de Constitution. »",
               "Garantie des droits et séparation des pouvoirs fondent l'État de droit.",
               ("« Le Roi est la source de toute loi. »",
                "« Les juges obéissent au gouvernement. »",
                "« La loi ne s'applique pas aux gouvernants. »")),
        ],
    ),
    Notion(
        "etat_droit.laicite",
        "Sécularisation et laïcité",
        "La sécularisation sépare l'autorité politique et l'autorité religieuse. En France, la "
        "loi de 1905 sépare les Églises et l'État : l'État est neutre et garantit la liberté de "
        "conscience et le pluralisme des croyances.",
        [
            _q(1, "Qu'est-ce que la sécularisation de la politique ?",
               "la séparation de l'autorité politique et de l'autorité religieuse",
               "Les lois sont faites par les citoyens et leurs représentants, pas par une "
               "religion.",
               ("l'interdiction des religions", "le vote obligatoire",
                "la fusion de l'État et d'une Église")),
            _q(1, "Quelle loi sépare les Églises et l'État en France ?",
               "la loi du 9 décembre 1905", "Elle fonde la laïcité de la République.",
               ("la loi de 1881 sur la presse", "la loi de 2004 sur l'école",
                "la Constitution de 1791")),
            _q(1, "La laïcité, est-ce l'athéisme ?",
               "non : elle garantit à chacun la liberté de croire ou de ne pas croire",
               "La laïcité est un principe juridique, l'athéisme une conviction personnelle.",
               ("oui, c'est la même chose", "oui, elle impose de ne pas croire",
                "non, elle impose une religion d'État")),
            _q(2, "Que dit l'article 2 de la loi de 1905 ?",
               "« La République ne reconnaît, ne salarie ni ne subventionne aucun culte. »",
               "L'État n'a pas de religion officielle et traite toutes les croyances de la même "
               "façon.",
               ("« La République impose un culte officiel. »",
                "« La République interdit tous les cultes. »",
                "« La République salarie tous les prêtres. »")),
            _q(2, "À qui la neutralité religieuse s'impose-t-elle dans un service public ?",
               "aux agents du service public",
               "Les usagers restent libres d'exprimer leurs convictions, dans le respect de "
               "l'ordre public.",
               ("à tous les usagers", "à tous les citoyens, partout",
                "aux seuls visiteurs étrangers")),
            _q(2, "Qu'est-ce que le pluralisme ?",
               "la coexistence de convictions, d'opinions et de croyances différentes",
               "La laïcité le garantit en traitant tous les citoyens de manière égale.",
               ("l'obligation de penser comme la majorité", "le pouvoir d'un seul parti",
                "le refus de tout débat")),
            _q(3, "Un salarié d'une entreprise privée est-il tenu à la neutralité religieuse comme "
               "un agent public ?",
               "non, en principe : seul un règlement intérieur justifié peut la lui imposer",
               "La neutralité s'impose aux agents publics ; dans le privé, la liberté est la "
               "règle et les restrictions doivent être justifiées.",
               ("oui, toujours", "oui, dans toutes les entreprises de France",
                "non, et aucune règle ne peut jamais l'encadrer")),
            _q(3, "Que signifie le primat du droit sur les règles religieuses ?",
               "la loi votée s'applique à tous, quelles que soient leurs croyances",
               "Une règle religieuse ne peut pas dispenser d'obéir à la loi commune.",
               ("une religion peut annuler une loi", "chaque culte a son propre tribunal pénal",
                "les croyants votent des lois à part")),
            _q(3, "Pourquoi l'école publique est-elle un espace de neutralité ?",
               "pour faire primer les connaissances sur les croyances et former l'esprit "
               "critique",
               "Les élèves y apprennent à l'abri de toute pression.",
               ("pour interdire de croire", "pour enseigner une religion officielle",
                "pour éviter tout débat")),
        ],
    ),
    Notion(
        "etat_droit.nouveaux_droits",
        "De nouveaux droits",
        "L'État de droit peut créer de nouveaux droits par la loi (contraception, interruption "
        "volontaire de grossesse, mariage pour tous…). Il peut aussi restreindre des libertés "
        "pour l'ordre public, ou priver de liberté une personne condamnée, qui garde ses droits "
        "fondamentaux.",
        [
            _q(1, "En quelle année la loi Veil a-t-elle autorisé l'interruption volontaire de "
               "grossesse ?", "1975", "Simone Veil a porté ce texte comme ministre de la Santé.",
               ("1905", "1945", "2013")),
            _q(1, "En quelle année le mariage a-t-il été ouvert aux couples de même sexe en "
               "France ?", "2013", "C'est la loi dite du « mariage pour tous ».",
               ("1975", "1981", "2000")),
            _q(1, "En quelle année la peine de mort a-t-elle été abolie en France ?", "1981",
               "Le garde des Sceaux Robert Badinter a porté la loi d'abolition.",
               ("1789", "1905", "1945")),
            _q(2, "Quelle loi de 1967 a autorisé la contraception en France ?", "la loi Neuwirth",
               "Elle porte le nom du député Lucien Neuwirth.",
               ("la loi Veil", "la loi Pleven", "la loi Gayssot")),
            _q(2, "Dans un État de droit, une liberté peut-elle être restreinte ?",
               "oui, par la loi, par exemple pour maintenir l'ordre public",
               "Une restriction doit être prévue par la loi, nécessaire et proportionnée.",
               ("non, jamais", "oui, sur simple décision d'un policier",
                "oui, selon l'humeur du gouvernement")),
            _q(2, "Une personne condamnée à la prison perd-elle tous ses droits ?",
               "non : elle garde ses droits fondamentaux, comme le respect de sa dignité",
               "La peine prive de liberté, pas d'humanité.",
               ("oui, tous", "oui, sauf le droit de manger", "elle n'a plus de nom")),
            _q(3, "Quelle liberté la Constitution garantit-elle explicitement aux femmes depuis "
               "2024 ?", "la liberté de recourir à l'interruption volontaire de grossesse",
               "La loi constitutionnelle du 8 mars 2024 l'inscrit à l'article 34.",
               ("le droit de vote", "le droit de travailler", "le droit de se marier")),
            _q(3, "Comment de nouveaux droits apparaissent-ils dans une démocratie ?",
               "le Parlement vote des lois qui répondent à une demande de la société",
               "Mobilisations, débats et élections précèdent souvent ces lois.",
               ("un juge les invente seul", "ils apparaissent sans aucun texte",
                "un seul ministre les décrète pour toujours")),
            _q(3, "Qu'est-ce que l'ordre public ?",
               "la sécurité, la tranquillité et la salubrité publiques, protégées par la loi",
               "Il peut justifier de limiter une liberté, dans les conditions fixées par la "
               "loi.",
               ("l'ordre dans lequel on vote", "la liste des fonctionnaires",
                "le rangement des archives")),
        ],
    ),
    Notion(
        "etat_droit.europe",
        "L'État de droit en Europe",
        "Le Conseil de l'Europe (46 États) a adopté la Convention européenne des droits de "
        "l'homme ; sa Cour siège à Strasbourg. L'Union européenne (27 États) a sa Charte des "
        "droits fondamentaux et sa Cour de justice à Luxembourg.",
        [
            _q(1, "Quel texte, signé en 1950, protège les droits de l'homme en Europe ?",
               "la Convention européenne des droits de l'homme",
               "Elle a été adoptée par le Conseil de l'Europe.",
               ("la Déclaration de 1789", "le traité de Versailles", "la Charte de l'ONU")),
            _q(1, "Dans quelle ville siège la Cour européenne des droits de l'homme ?",
               "Strasbourg", "Elle veille au respect de la Convention européenne.",
               ("Bruxelles", "Genève", "La Haye")),
            _q(1, "Combien d'États compte l'Union européenne ?", "27",
               "Depuis le départ du Royaume-Uni en 2020.", ("12", "15", "46")),
            _q(2, "Dans quelle ville siège la Cour de justice de l'Union européenne ?",
               "Luxembourg", "Elle veille au respect du droit de l'Union.",
               ("Strasbourg", "Paris", "Berlin")),
            _q(2, "Le Conseil de l'Europe et l'Union européenne, est-ce la même organisation ?",
               "non : le Conseil de l'Europe réunit 46 États pour défendre les droits de l'homme",
               "L'Union européenne compte 27 États ; tous font aussi partie du Conseil de "
               "l'Europe.",
               ("oui, c'est la même", "non : le Conseil de l'Europe est une banque",
                "non : le Conseil de l'Europe ne réunit que la France")),
            _q(2, "Un citoyen français peut-il saisir la Cour européenne des droits de l'homme ?",
               "oui, après avoir épuisé les recours devant la justice française",
               "La Cour intervient en dernier recours.",
               ("non, jamais", "oui, à la place du tribunal de son quartier",
                "seulement s'il est député")),
            _q(3, "Que contrôlent les cours européennes de Strasbourg et de Luxembourg ?",
               "que les États respectent les droits fondamentaux et le droit européen",
               "Elles peuvent condamner un État, par exemple pour des conditions de détention "
               "indignes.",
               ("le résultat des élections nationales", "le budget de chaque famille",
                "les programmes de télévision")),
            _q(3, "Quel texte de l'Union européenne, proclamé en 2000, rassemble les droits "
               "fondamentaux ?", "la Charte des droits fondamentaux de l'Union européenne",
               "Elle a la même valeur juridique que les traités depuis 2009.",
               ("la Convention de Genève", "la Charte de l'environnement",
                "le Code civil")),
            _q(3, "Que peut faire la Cour européenne des droits de l'homme si la France viole un "
               "droit garanti par la Convention ?",
               "la condamner", "L'État condamné doit alors réparer et souvent changer ses "
               "règles.",
               ("dissoudre l'Assemblée nationale", "annuler l'élection présidentielle",
                "nommer un nouveau gouvernement")),
        ],
    ),
    # --- Liberté et responsabilité : l'information ---------------------------------------------
    Notion(
        "information.presse",
        "La liberté de la presse",
        "La liberté de la presse et celle de s'informer sont des piliers de la démocratie ; elles "
        "permettent le pluralisme. La loi du 29 juillet 1881 les fonde en France.",
        [
            _q(1, "Pourquoi la liberté de la presse est-elle un pilier de la démocratie ?",
               "elle permet aux citoyens de s'informer et de contrôler les pouvoirs",
               "Sans information libre, on ne peut pas choisir librement.",
               ("elle permet de vendre plus de journaux", "elle remplace les élections",
                "elle supprime les débats")),
            _q(1, "Quelle loi fonde la liberté de la presse en France ?",
               "la loi du 29 juillet 1881",
               "Elle proclame : « L'imprimerie et la librairie sont libres. »",
               ("la loi de 1905", "la loi Veil", "la loi de 2013")),
            _q(1, "Quelle organisation publie chaque année un classement mondial de la liberté de "
               "la presse ?", "Reporters sans frontières",
               "Elle défend les journalistes menacés partout dans le monde.",
               ("Médecins sans frontières", "la Croix-Rouge", "l'Arcom")),
            _q(2, "Qu'est-ce que le pluralisme des médias ?",
               "la diversité des médias et des opinions qu'ils expriment",
               "Il permet à chacun de comparer les points de vue.",
               ("un seul journal pour tout le pays", "l'obligation de penser comme la majorité",
                "la publicité dans les journaux")),
            _q(2, "Quelle autorité veille au pluralisme politique à la radio et à la télévision ?",
               "l'Arcom", "Elle contrôle notamment les temps de parole des partis politiques.",
               ("le Sénat", "la Cour des comptes", "le Conseil de l'Europe")),
            _q(2, "Qu'est-ce que la déontologie d'un journaliste ?",
               "les règles de son métier : vérifier, citer ses sources, distinguer faits et "
               "opinions",
               "Elle fonde la confiance du public.",
               ("le salaire du journaliste", "la liste de ses abonnés",
                "le droit de tout inventer")),
            _q(3, "Qu'est-ce que l'autocensure ?",
               "renoncer soi-même à publier par peur des conséquences",
               "Pressions et menaces peuvent pousser des journalistes à se taire.",
               ("la censure exercée par l'État", "la relecture d'un article",
                "le choix d'un titre")),
            _q(3, "Pourquoi le secret des sources des journalistes est-il protégé ?",
               "pour que des témoins osent révéler des informations sans crainte",
               "Sans cette protection, beaucoup d'abus resteraient cachés.",
               ("pour cacher les erreurs des journalistes", "pour vendre l'information",
                "pour empêcher toute enquête")),
            _q(3, "Que devient la presse dans un régime autoritaire ?",
               "elle est censurée et des journalistes peuvent être emprisonnés",
               "Les régimes autoritaires contrôlent l'information pour garder le pouvoir.",
               ("elle devient plus libre", "elle est payée par les lecteurs seulement",
                "elle disparaît d'elle-même")),
        ],
    ),
    Notion(
        "information.expression",
        "La liberté d'expression et ses limites",
        "L'article 11 de la Déclaration de 1789 garantit la liberté d'expression ; la loi en fixe "
        "les limites : diffamation, injure, incitation à la haine (loi Pleven, 1972), négation des "
        "crimes contre l'humanité (loi Gayssot, 1990), apologie du terrorisme.",
        [
            _q(1, "Quel article de la Déclaration des droits de l'homme et du citoyen garantit la "
               "libre communication des pensées et des opinions ?", "l'article 11",
               "C'est le fondement de la liberté d'expression en France.",
               ("l'article 1", "l'article 4", "l'article 16")),
            _q(1, "La liberté d'expression permet-elle de tout dire ?",
               "non : la loi interdit par exemple la diffamation et l'incitation à la haine",
               "Chacun répond devant la loi de l'abus de cette liberté.",
               ("oui, absolument tout", "oui, sur Internet seulement",
                "non : il est interdit de critiquer le gouvernement")),
            _q(1, "Qu'est-ce que la diffamation ?",
               "accuser publiquement quelqu'un d'un fait qui porte atteinte à son honneur",
               "Elle est punie par la loi de 1881.",
               ("faire un compliment en public", "écrire un roman", "voter blanc")),
            _q(2, "Quelle loi de 1972 punit la provocation à la haine raciale ?",
               "la loi Pleven", "Elle porte le nom du garde des Sceaux René Pleven.",
               ("la loi Gayssot", "la loi Veil", "la loi Neuwirth")),
            _q(2, "Quelle loi de 1990 punit la négation des crimes contre l'humanité ?",
               "la loi Gayssot", "Elle vise notamment la négation de la Shoah.",
               ("la loi Pleven", "la loi de 1905", "la loi Veil")),
            _q(2, "L'apologie du terrorisme est-elle protégée par la liberté d'expression ?",
               "non, c'est un délit puni par le Code pénal",
               "Présenter favorablement un acte terroriste est interdit.",
               ("oui, toujours", "oui, sur les réseaux sociaux", "seulement le week-end")),
            _q(3, "Comment commence l'article 11 de la Déclaration des droits de l'homme et du "
               "citoyen ?",
               "« La libre communication des pensées et des opinions est un des droits les plus "
               "précieux de l'Homme »",
               "Il ajoute que chacun doit « répondre de l'abus de cette liberté dans les cas "
               "déterminés par la Loi ».",
               ("« Les hommes naissent et demeurent libres et égaux en droits »",
                "« La liberté consiste à pouvoir faire tout ce qui ne nuit pas à autrui »",
                "« Nul ne doit être inquiété pour ses opinions, même religieuses »")),
            _q(3, "Que veut dire l'article 11 quand il précise « sauf à répondre de l'abus de "
               "cette liberté » ?", "chacun est responsable devant la loi de ce qu'il dit ou "
               "écrit", "La liberté s'accompagne de responsabilité.",
               ("on peut tout dire sans conséquence", "seuls les journalistes sont libres",
                "il faut demander l'autorisation avant de parler")),
            _q(3, "Critiquer une religion et injurier des croyants, est-ce la même chose pour la "
               "loi ?",
               "non : critiquer une idée est permis, injurier ou appeler à la haine contre des "
               "personnes est puni",
               "La loi protège les personnes, pas les idées.",
               ("oui, les deux sont interdits", "oui, les deux sont permis",
                "non : critiquer une religion est un délit")),
        ],
    ),
    Notion(
        "information.desinformation",
        "Désinformation et réseaux sociaux",
        "Les réseaux sociaux multiplient l'information et la désinformation. On vérifie la "
        "source, l'auteur, la date ; on se méfie des algorithmes et des chambres d'écho. Le "
        "règlement européen sur les services numériques et Pharos aident à lutter contre les "
        "contenus illicites.",
        [
            _q(1, "Qu'est-ce que la désinformation ?",
               "la diffusion volontaire de fausses informations pour tromper",
               "Elle vise à manipuler l'opinion.",
               ("une erreur de frappe", "une information ancienne", "une publicité honnête")),
            _q(1, "Qu'est-ce qu'une chambre d'écho ?",
               "un espace en ligne où l'on n'entend que des avis semblables au sien",
               "Elle renforce les certitudes et éloigne du débat.",
               ("un studio de radio", "une salle de concert", "une messagerie privée")),
            _q(1, "Une information choc circule sur un réseau social. Quel est le bon réflexe ?",
               "vérifier la source et chercher si des médias fiables la confirment",
               "Avant de partager, on vérifie.",
               ("la partager tout de suite", "la croire si elle a beaucoup de « j'aime »",
                "la modifier pour la rendre plus drôle")),
            _q(2, "Qu'est-ce que la mésinformation ?",
               "partager une fausse information en croyant qu'elle est vraie",
               "La personne se trompe sans vouloir tromper.",
               ("inventer volontairement une rumeur", "publier une information vraie",
                "censurer un journal")),
            _q(2, "Comment un algorithme de recommandation choisit-il ce qu'il vous montre ?",
               "selon ce que vous avez déjà regardé ou aimé, pour retenir votre attention",
               "Il peut enfermer dans une bulle de contenus semblables.",
               ("au hasard, sans aucune règle", "selon l'avis d'un journaliste",
                "selon l'ordre alphabétique")),
            _q(2, "Quelle plateforme de l'État permet de signaler un contenu illicite en ligne ?",
               "Pharos", "Les signalements sont traités par des policiers et des gendarmes.",
               ("l'Arcom", "Reporters sans frontières", "le Conseil constitutionnel")),
            _q(3, "Qu'est-ce que la malinformation ?",
               "une information vraie diffusée dans le but de nuire",
               "Par exemple, publier une donnée privée exacte pour humilier quelqu'un.",
               ("une information fausse partagée par erreur", "une information mal écrite",
                "une information sans image")),
            _q(3, "Quel texte de l'Union européenne oblige les grandes plateformes à lutter "
               "contre les contenus illicites ?",
               "le règlement européen sur les services numériques",
               "Les très grandes plateformes doivent évaluer et réduire les risques qu'elles "
               "créent.",
               ("la Convention européenne des droits de l'homme", "le Code de la route",
                "la loi de 1905")),
            _q(3, "Pourquoi une image créée par une intelligence artificielle peut-elle poser "
               "problème pour l'information ?",
               "elle peut sembler réelle et montrer un événement qui n'a jamais eu lieu",
               "Il faut vérifier l'origine d'une image avant de la croire.",
               ("elle est toujours floue", "elle est interdite par la loi",
                "elle ne peut pas être partagée")),
        ],
    ),
    # --- Droits et responsabilité : l'environnement --------------------------------------------
    Notion(
        "environnement.charte",
        "La Charte de l'environnement",
        "La Charte de l'environnement (2004) fait partie du bloc de constitutionnalité : chacun a "
        "le droit de vivre dans un environnement équilibré et respectueux de la santé, et le "
        "devoir de le préserver.",
        [
            _q(1, "En quelle année la Charte de l'environnement a-t-elle été adoptée ?", "2004",
               "Elle a été intégrée à la Constitution en 2005.",
               ("1789", "1905", "1958")),
            _q(1, "Que dit l'article premier de la Charte de l'environnement ?",
               "« Chacun a le droit de vivre dans un environnement équilibré et respectueux de "
               "la santé. »",
               "C'est le droit à un environnement sain.",
               ("« L'environnement appartient à l'État. »",
                "« La nature n'a pas besoin de protection. »",
                "« Seuls les agriculteurs protègent l'environnement. »")),
            _q(1, "La Charte de l'environnement a-t-elle la même valeur que la Constitution ?",
               "oui, elle fait partie du bloc de constitutionnalité",
               "Les lois doivent la respecter.",
               ("non, c'est un simple conseil", "non, elle vaut moins qu'un arrêté municipal",
                "elle n'a aucune valeur juridique")),
            _q(2, "Que dit l'article 2 de la Charte de l'environnement ?",
               "« Toute personne a le devoir de prendre part à la préservation et à "
               "l'amélioration de l'environnement. »",
               "Au droit répond un devoir : c'est la responsabilité de chacun.",
               ("« Seul l'État doit protéger l'environnement. »",
                "« Personne n'est responsable de l'environnement. »",
                "« L'environnement est l'affaire des scientifiques. »")),
            _q(2, "Quel principe permet d'agir face à un risque grave pour l'environnement, même "
               "sans certitude scientifique ?", "le principe de précaution",
               "Il figure à l'article 5 de la Charte.",
               ("le principe de laïcité", "le principe de majorité", "le principe d'égalité")),
            _q(2, "Selon l'article 4 de la Charte, que doit faire celui qui cause un dommage à "
               "l'environnement ?", "contribuer à le réparer",
               "« Toute personne doit contribuer à la réparation des dommages qu'elle cause à "
               "l'environnement », dans les conditions fixées par la loi.",
               ("rien du tout", "déménager", "payer une amende à un voisin")),
            _q(3, "Qu'est-ce que le bloc de constitutionnalité ?",
               "les textes à valeur constitutionnelle : Constitution, Déclaration de 1789, "
               "préambule de 1946, Charte de l'environnement",
               "Toutes les lois doivent respecter ces textes.",
               ("l'ensemble des décrets", "les règlements intérieurs des lycées",
                "les traités commerciaux")),
            _q(3, "Qu'est-ce que la démocratie environnementale ?",
               "le droit des citoyens d'être informés et de participer aux décisions qui "
               "touchent l'environnement",
               "C'est l'article 7 de la Charte : consultations, enquêtes publiques…",
               ("le vote des animaux", "un parti politique écologiste",
                "l'interdiction de construire")),
            _q(3, "Que dit l'article 6 de la Charte de l'environnement ?",
               "« Les politiques publiques doivent promouvoir un développement durable. »",
               "Elles concilient protection de l'environnement, développement économique et "
               "progrès social.",
               ("« Les politiques publiques ignorent l'environnement. »",
                "« L'économie passe toujours avant l'environnement. »",
                "« L'environnement relève seulement des communes. »")),
        ],
    ),
    Notion(
        "environnement.responsabilite",
        "Responsabilité et développement durable",
        "Le droit de l'environnement engage la responsabilité des États, des producteurs et des "
        "consommateurs. Le développement durable répond aux besoins d'aujourd'hui sans "
        "compromettre ceux des générations futures.",
        [
            _q(1, "Qu'est-ce que le développement durable ?",
               "un développement qui répond aux besoins d'aujourd'hui sans compromettre ceux des "
               "générations futures",
               "Il concilie environnement, économie et société.",
               ("produire toujours plus, quoi qu'il arrive", "arrêter toute activité humaine",
                "un développement réservé aux pays riches")),
            _q(1, "Qu'est-ce que la transition écologique ?",
               "le passage à des façons de vivre et de produire qui préservent l'environnement",
               "Énergies renouvelables, sobriété, recyclage en font partie.",
               ("le déménagement d'une usine", "un changement de gouvernement",
                "le passage de l'été à l'hiver")),
            _q(1, "Comment un lycéen peut-il agir pour l'environnement dans son lycée ?",
               "devenir éco-délégué ou s'engager au conseil de la vie lycéenne",
               "Chacun peut agir à son échelle.",
               ("attendre que les adultes s'en chargent", "jeter ses déchets n'importe où",
                "laisser les lumières allumées")),
            _q(2, "Qu'est-ce qu'un groupe de pression, ou lobby ?",
               "un groupe qui cherche à influencer les décisions publiques pour défendre des "
               "intérêts",
               "Entreprises, associations ou syndicats peuvent en former.",
               ("un groupe de musique", "une chambre du Parlement", "un tribunal")),
            _q(2, "Quel accord international de 2015 vise à limiter le réchauffement "
               "climatique ?", "l'accord de Paris",
               "Les États s'y engagent à limiter le réchauffement bien en dessous de 2 degrés.",
               ("le traité de Rome", "la Convention de Genève", "le traité de Versailles")),
            _q(2, "Qui est responsable de la protection de l'environnement ?",
               "les États, les producteurs et les consommateurs, chacun à son échelle",
               "La responsabilité est à la fois individuelle et collective.",
               ("seulement les scientifiques", "seulement les agriculteurs", "personne")),
            _q(3, "Qu'a obtenu en 2021 le recours en justice appelé « l'Affaire du siècle » ?",
               "la reconnaissance d'une faute de l'État dans la lutte contre le réchauffement "
               "climatique",
               "Le tribunal administratif de Paris a jugé l'État responsable de ses "
               "manquements.",
               ("la fermeture de toutes les usines", "l'interdiction des voitures",
                "la condamnation d'un pays voisin")),
            _q(3, "Comment un consommateur peut-il exercer sa responsabilité environnementale ?",
               "en choisissant des produits durables, réparables et sobres en énergie",
               "Les choix de consommation pèsent sur la production.",
               ("en achetant toujours plus", "en jetant au lieu de réparer",
                "en ignorant l'origine des produits")),
            _q(3, "Que sont les COP sur le climat ?",
               "des conférences internationales annuelles de l'ONU sur le climat",
               "Les États y négocient leurs engagements ; l'accord de Paris est né de la COP21.",
               ("des policiers de l'environnement", "des lois françaises",
                "des tribunaux européens")),
        ],
    ),
    Notion(
        "environnement.vivant",
        "Le respect du vivant",
        "Le droit protège la biodiversité (espèces protégées, préjudice écologique) et reconnaît "
        "l'animal comme un être vivant doué de sensibilité.",
        [
            _q(1, "Qu'est-ce que la biodiversité ?",
               "la diversité des êtres vivants et des milieux où ils vivent",
               "Sa sauvegarde est une responsabilité collective.",
               ("le nombre d'habitants d'un pays", "la variété des roches",
                "la diversité des langues")),
            _q(1, "Comment le Code civil définit-il les animaux depuis 2015 ?",
               "« des êtres vivants doués de sensibilité »",
               "C'est l'article 515-14 du Code civil.",
               ("« des objets comme les autres »", "« des personnes »",
                "« des meubles sans valeur »")),
            _q(1, "Maltraiter un animal est-il puni par la loi ?", "oui, c'est un délit",
               "Les sévices graves et les actes de cruauté sont punis par le Code pénal.",
               ("non, jamais", "seulement pour les animaux sauvages",
                "seulement à la campagne")),
            _q(2, "Qu'est-ce qu'une espèce protégée ?",
               "une espèce qu'il est interdit de capturer, de détruire ou de vendre",
               "La loi protège aussi souvent son milieu de vie.",
               ("une espèce élevée dans un zoo", "une espèce qui porte une puce",
                "une espèce dangereuse pour l'homme")),
            _q(2, "Pourquoi protéger la biodiversité relève-t-il de l'intérêt général ?",
               "elle rend des services vitaux : nourriture, eau propre, pollinisation, climat",
               "Toute la société en dépend, aujourd'hui et demain.",
               ("elle rapporte de l'argent à quelques-uns", "elle n'est utile qu'aux savants",
                "elle ne concerne que les forêts tropicales")),
            _q(2, "Quel texte international protège les espèces menacées en encadrant leur "
               "commerce ?", "la convention de Washington",
               "Signée en 1973, elle contrôle le commerce de l'ivoire ou des espèces rares.",
               ("le traité de Versailles", "la loi de 1905", "la Charte de la laïcité")),
            _q(3, "Que demande la séquence « éviter, réduire, compenser » à l'auteur d'un projet ?",
               "d'éviter d'abord les atteintes à la nature, puis de réduire celles qui restent, "
               "et enfin de compenser",
               "Compenser n'est que le dernier recours.",
               ("de compenser d'abord pour pouvoir tout détruire", "de ne rien faire",
                "de payer une taxe à la place")),
            _q(3, "Qu'est-ce que le préjudice écologique, inscrit dans le Code civil en 2016 ?",
               "une atteinte à l'environnement que son responsable doit réparer",
               "La nature elle-même est reconnue comme victime.",
               ("une amende pour excès de vitesse", "un impôt sur les voitures",
                "une maladie des arbres")),
            _q(3, "Pourquoi le programme parle-t-il de « respect du vivant » ?",
               "le droit reconnaît que les animaux et la biodiversité méritent une protection "
               "propre",
               "La responsabilité humaine s'étend aux autres êtres vivants.",
               ("parce que seuls les humains sont vivants", "parce que la nature n'a pas de "
                "valeur", "parce que les animaux votent")),
        ],
    ),
]

register_notions(LEVEL, SUBJECT, NOTIONS)


def _order(prompt: str, items: list[str], hint: str, explanation: str, difficulty: int,
           rng: random.Random, meta: dict[str, Any]) -> dict[str, Any]:
    shown = list(range(len(items)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": prompt,
        "choices": [items[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(items))]},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": meta,
    }


# --- Énigme de la Haute Cour : hiérarchie des normes, ordre des recours ------------------------

NORMS = ["la Constitution", "les traités internationaux", "les lois votées par le Parlement",
         "les décrets du gouvernement", "les arrêtés des ministres, des préfets ou des maires",
         "le règlement intérieur d'un lycée"]
APPEALS = ["le tribunal judiciaire", "la cour d'appel", "la Cour de cassation",
           "la Cour européenne des droits de l'homme"]
NORMES = {1: ("normes", 3), 2: ("recours", 3), 3: ("normes", 4), 4: ("recours", 4),
          5: ("normes", 6)}


def _normes(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kind, count = NORMES[difficulty]
    source = NORMS if kind == "normes" else APPEALS
    picked = sorted(rng.sample(range(len(source)), count))
    items = [source[i] for i in picked]
    if kind == "normes":
        return _order(
            "L'Arbitraire a renversé la pyramide des normes ! Range ces règles de droit, de la "
            "plus haute à la plus basse.",
            items, "Chaque norme doit respecter celles qui sont au-dessus d'elle ; la Constitution "
            "est au sommet.", "De la plus haute à la plus basse : " + " ; ".join(items) + ".",
            difficulty, rng, {"kind": kind, "ranks": picked})
    return _order(
        "L'Arbitraire a mélangé les portes de la justice ! Range ces juridictions dans l'ordre où "
        "un citoyen peut les saisir, de la première à la dernière.",
        items, "On commence par un tribunal ; on peut faire appel, puis se pourvoir en "
        "cassation ; l'Europe vient en dernier recours.",
        "Dans l'ordre : " + " ; ".join(items) + ".", difficulty, rng,
        {"kind": kind, "ranks": picked})


NORMES_GEN = register(
    Generator(code="2nde.emc.normes", level=LEVEL, notion="2nde.emc.etat_droit.principes",
              role="chapitre", title="La pyramide des normes", generate=_normes)
)


# --- Frise des droits et des libertés ------------------------------------------------------------

EVENTS = [
    (1789, "Déclaration des droits de l'homme et du citoyen"),
    (1881, "Loi sur la liberté de la presse"),
    (1905, "Loi de séparation des Églises et de l'État"),
    (1944, "Droit de vote des femmes"),
    (1950, "Convention européenne des droits de l'homme"),
    (1958, "Constitution de la Ve République"),
    (1967, "Loi Neuwirth sur la contraception"),
    (1972, "Loi Pleven contre la provocation à la haine raciale"),
    (1975, "Loi Veil sur l'interruption volontaire de grossesse"),
    (1981, "Abolition de la peine de mort"),
    (1990, "Loi Gayssot contre la négation des crimes contre l'humanité"),
    (2000, "Charte des droits fondamentaux de l'Union européenne"),
    (2004, "Charte de l'environnement"),
    (2013, "Mariage ouvert aux couples de même sexe"),
    (2022, "Règlement européen sur les services numériques"),
    (2024, "Liberté de recourir à l'interruption volontaire de grossesse inscrite dans la "
           "Constitution"),
]
FRISE = {1: (3, 40), 2: (3, 15), 3: (4, 10), 4: (4, 5), 5: (5, 2)}


def _frise(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, gap = FRISE[difficulty]
    while True:
        picked = sorted(rng.sample(EVENTS, count))
        if all(b[0] - a[0] >= gap for a, b in zip(picked, picked[1:], strict=False)):
            break
    items = [label for _y, label in picked]
    return _order(
        "L'Arbitraire a déchiré le registre des libertés ! Remets ces textes et ces droits dans "
        "l'ordre, du plus ancien au plus récent.",
        items, "1789 : la Révolution ; 1905 : la laïcité ; les droits des femmes progressent "
        "surtout depuis les années 1960.",
        "Dans l'ordre : " + " ; ".join(f"{label} ({year})" for year, label in picked) + ".",
        difficulty, rng, {"years": [y for y, _l in picked]})


FRISE_GEN = register(
    Generator(code="2nde.emc.frise", level=LEVEL, notion="2nde.emc.etat_droit.nouveaux_droits",
              role="chapitre", title="La frise des libertés", generate=_frise)
)
