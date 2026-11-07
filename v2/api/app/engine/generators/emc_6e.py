"""Enseignement moral et civique, 6e (programme du 29 mai 2024, BO n° 24 du 13 juin 2024, en vigueur
en 6e à la rentrée 2026) : exemples relus, plus des générateurs calculés.

- `6e.emc.election` : élection des délégués (majorité absolue des suffrages exprimés au premier
  tour, bulletins blancs non comptés, majorité relative au second tour) ;
- `6e.emc.echelons` : ranger les échelons de la représentation, de la classe au Parlement européen
  (énigme de la Tribune du Conseil) ;
- `6e.emc.frise` : ordonner les grandes dates des droits, de la laïcité et du vote (énigme du
  Palais des Libertés).

Citations : Déclaration des droits de l'homme et du citoyen, loi de 1905, Constitution de 1958 et
Code civil, textes exacts (domaine public).
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions

LEVEL, SUBJECT = "6e", "emc"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    return Fact(level, prompt, answer, why, wrong)


NOTIONS = [
    # --- Représenter les autres et servir l'intérêt général ----------------------------------
    Notion(
        "representer.interet_general",
        "Intérêt général et intérêts particuliers",
        "L'intérêt général, c'est ce qui est bon pour tous, aujourd'hui et demain. Un intérêt "
        "particulier ne concerne qu'une personne ou un petit groupe.",
        [
            _q(1, "Qu'est-ce que l'intérêt général ?", "ce qui est bon pour tout le monde",
               "L'intérêt général dépasse l'envie de chacun : il concerne toute la société.",
               ("ce qui me fait plaisir à moi", "ce que veut le plus fort",
                "ce qui rapporte le plus d'argent")),
            _q(1, "Lequel de ces souhaits sert l'intérêt général de la classe ?",
               "une classe calme où chacun peut travailler",
               "Le calme profite à tous les élèves, pas seulement à un seul.",
               ("partir en récréation avant les autres", "avoir la meilleure place pour moi seul",
                "ne jamais ranger mes affaires")),
            _q(1, "Un intérêt particulier, c'est…", "l'intérêt d'une personne ou d'un petit groupe",
               "« Particulier » : qui concerne une partie seulement des gens.",
               ("l'intérêt de tout le pays", "l'intérêt de la planète entière",
                "une règle votée par tous")),
            _q(2, "Le maire veut construire une piste cyclable sur le terrain où Paul joue au foot. "
               "Quel intérêt la piste sert-elle ?", "l'intérêt général",
               "Une piste cyclable sert à tous les habitants ; le terrain de Paul est un intérêt "
               "particulier.",
               ("l'intérêt particulier de Paul", "aucun intérêt", "l'intérêt du maire seulement")),
            _q(2, "Pourquoi l'intérêt général pense-t-il aussi aux générations futures ?",
               "parce que nos choix d'aujourd'hui pèsent sur la vie de ceux qui viendront après "
               "nous",
               "Protéger l'eau, l'air ou la forêt, c'est aussi servir ceux qui ne sont pas encore "
               "nés.",
               ("parce que les enfants votent", "parce que les adultes ne comptent plus",
                "parce que l'avenir ne change jamais")),
            _q(2, "Que fait un délégué qui sert l'intérêt général de sa classe ?",
               "il porte la parole de toute la classe, même celle des élèves qui n'ont pas voté "
               "pour lui",
               "Une fois élu, le délégué représente tous les élèves, pas seulement ses amis.",
               ("il défend seulement ses amis", "il décide seul des notes",
                "il punit les élèves bavards")),
            _q(3, "Quand l'intérêt général et des intérêts particuliers s'opposent, que fait-on "
               "dans une démocratie ?",
               "on en débat, puis les représentants élus décident selon la loi",
               "Le débat permet d'entendre chacun ; la décision revient aux élus, dans le respect "
               "de la loi et des droits de tous.",
               ("le plus riche décide", "on tire au sort sans discuter",
                "on fait ce que veut celui qui crie le plus fort")),
            _q(3, "Pourquoi paie-t-on des impôts ?",
               "pour financer ce qui sert à tous : écoles, routes, hôpitaux, secours",
               "Les impôts mettent en commun une partie de l'argent de chacun au service de "
               "l'intérêt général.",
               ("pour enrichir le président", "pour acheter des cadeaux aux élus",
                "pour punir ceux qui travaillent")),
            _q(3, "En 2015, l'ONU a fixé 17 objectifs à atteindre d'ici 2030 pour la planète et "
               "ses habitants. Comment s'appellent-ils ?",
               "les objectifs de développement durable",
               "Lutter contre la pauvreté et la faim, protéger le climat et la vie : ces objectifs "
               "servent l'intérêt général de toute l'humanité.",
               ("les objectifs olympiques", "les droits de l'enfant", "les lois de la République")),
        ],
    ),
    Notion(
        "representer.vote",
        "Voter et élire",
        "Le vote est secret. Au premier tour d'une élection de délégués, il faut plus de la moitié "
        "des suffrages exprimés ; les bulletins blancs et nuls ne comptent pas.",
        [
            _q(1, "Pourquoi passe-t-on dans l'isoloir avant de voter ?",
               "pour que le vote reste secret",
               "Personne ne doit savoir pour qui l'on vote : chacun choisit librement.",
               ("pour se reposer", "pour montrer son bulletin à tout le monde",
                "pour compter les voix")),
            _q(1, "Dans quoi glisse-t-on son enveloppe pour voter ?", "dans l'urne",
               "L'urne est la boîte transparente où l'on dépose son enveloppe.",
               ("dans l'isoloir", "dans la boîte aux lettres", "dans le cartable")),
            _q(1, "À quel âge peut-on voter aux élections en France ?", "à 18 ans",
               "Il faut aussi être inscrit sur les listes électorales.",
               ("à 11 ans", "à 15 ans", "à 21 ans")),
            _q(1, "Combien de délégués titulaires chaque classe de collège élit-elle ?", "deux",
               "La classe élit deux délégués, et deux suppléants pour les remplacer si besoin.",
               ("un seul", "cinq", "toute la classe")),
            _q(2, "Que veut dire « le suffrage universel » ?",
               "tous les citoyens majeurs ont le droit de voter",
               "Universel : pour tous, sans distinction de richesse ou de sexe.",
               ("seuls les riches votent", "on vote dans le monde entier en même temps",
                "seuls les hommes votent")),
            _q(2, "Depuis quand les femmes votent-elles en France ?", "depuis 1944",
               "Le droit de vote des femmes date de 1944 ; elles votent pour la première fois en "
               "1945.",
               ("depuis 1789", "depuis 1905", "depuis 1990")),
            _q(2, "Qu'est-ce qu'un bulletin blanc ?",
               "un bulletin sans nom de candidat",
               "Voter blanc, c'est dire qu'on ne choisit aucun candidat ; ce bulletin n'entre pas "
               "dans les suffrages exprimés.",
               ("un bulletin pour le candidat le plus jeune", "un bulletin déchiré",
                "un bulletin compté deux fois")),
            _q(3, "À l'élection des délégués, que faut-il pour être élu au premier tour ?",
               "plus de la moitié des suffrages exprimés",
               "C'est la majorité absolue ; au second tour, il suffit d'avoir le plus de voix.",
               ("une seule voix", "le tiers des voix", "toutes les voix de la classe")),
            _q(3, "À l'élection des délégués, deux candidats ont le même nombre de voix au second "
               "tour. Qui est élu ?", "le plus jeune des deux",
               "C'est la règle des élections des délégués d'élèves en cas d'égalité.",
               ("le plus âgé des deux", "celui qui a les meilleures notes",
                "celui que choisit le professeur")),
            _q(3, "Que signifie « voter, c'est un droit et un devoir civique » ?",
               "chacun est libre de voter, mais voter fait vivre la démocratie",
               "En France, voter n'est pas obligatoire, mais c'est la façon dont les citoyens "
               "choisissent ceux qui décident en leur nom.",
               ("on est puni si on ne vote pas", "on vote seulement si on est élu",
                "seuls les maires votent")),
        ],
    ),
    Notion(
        "representer.representants",
        "Les représentants",
        "Un représentant est élu pour parler et décider au nom des autres : délégué de classe, "
        "conseillers municipaux, députés, sénateurs, députés européens.",
        [
            _q(1, "Qui représente les élèves d'une classe ?", "les délégués de classe",
               "Ils sont élus par les élèves de la classe.",
               ("le principal", "le maire", "les parents")),
            _q(1, "Qui dirige la commune ?", "le maire, avec le conseil municipal",
               "Le maire est élu par le conseil municipal, lui-même élu par les habitants.",
               ("le président de la République", "le préfet seul", "les délégués de classe")),
            _q(1, "Qui est élu pour représenter la France et la diriger pendant cinq ans ?",
               "le président de la République",
               "Il est élu par tous les citoyens, au suffrage universel direct.",
               ("le maire de Paris", "le délégué de classe", "le roi")),
            _q(2, "Où siègent les députés ?", "à l'Assemblée nationale",
               "Les 577 députés votent les lois, avec les sénateurs.",
               ("au Sénat", "à la mairie", "au collège")),
            _q(2, "Quel est le rôle principal du Parlement (Assemblée nationale et Sénat) ?",
               "voter les lois", "Députés et sénateurs discutent et votent les lois de la "
               "République.",
               ("juger les voleurs", "élire les délégués", "diriger l'armée")),
            _q(2, "Qui élit le maire ?", "le conseil municipal",
               "Les habitants élisent les conseillers municipaux, qui élisent ensuite le maire.",
               ("le président de la République", "les élèves du collège", "les députés")),
            _q(3, "Qui les citoyens français élisent-ils pour les représenter à l'Union "
               "européenne ?", "les députés européens",
               "Ils siègent au Parlement européen, élu tous les cinq ans.",
               ("les sénateurs", "les conseillers municipaux", "les préfets")),
            _q(3, "Quelle instance du collège réunit des élèves pour proposer des projets sur la "
               "vie au collège ?", "le conseil de la vie collégienne",
               "Les élèves élus y proposent des projets avec des adultes du collège.",
               ("le conseil municipal", "le Sénat", "le Parlement européen")),
            _q(3, "Que fait un éco-délégué ?",
               "il propose et mène des actions pour l'environnement dans son collège",
               "Chaque classe de collège élit un éco-délégué : tri, économies d'énergie, "
               "biodiversité…",
               ("il note les professeurs", "il remplace le maire", "il vote les lois")),
        ],
    ),
    Notion(
        "representer.services",
        "À quoi servent les représentants",
        "Les élus organisent les services publics : la commune s'occupe des écoles, le "
        "département des collèges, la région des lycées, l'État de la police et de l'armée.",
        [
            _q(1, "Lequel de ces services est un service public ?", "l'école publique",
               "Un service public répond à un besoin de tous ; il est ouvert à chacun.",
               ("un magasin de jouets", "une boulangerie", "une salle de jeux vidéo")),
            _q(1, "Que fait-on en composant le 18 ?", "on appelle les pompiers",
               "Les secours sont un service public, gratuit et ouvert à tous.",
               ("on commande une pizza", "on appelle la mairie", "on vote")),
            _q(1, "Qui s'occupe des bâtiments des écoles maternelles et élémentaires ?",
               "la commune", "La commune construit et entretient les écoles du primaire.",
               ("la région", "l'Union européenne", "les parents")),
            _q(2, "Qui s'occupe des bâtiments des collèges ?", "le département",
               "Le conseil départemental construit, entretient et équipe les collèges.",
               ("la commune", "la région", "le collège lui-même")),
            _q(2, "Qui s'occupe des bâtiments des lycées ?", "la région",
               "Le conseil régional construit et entretient les lycées.",
               ("la commune", "le département", "le président de la République")),
            _q(2, "Pourquoi un service public doit-il être le même pour tous ?",
               "parce que tous les citoyens sont égaux devant lui",
               "Égalité : l'école, les secours ou la poste servent chacun de la même façon.",
               ("pour gagner plus d'argent", "parce qu'il est réservé aux élus",
                "pour que les plus riches passent devant")),
            _q(3, "Qui s'occupe de la police nationale, de l'armée et de la justice ?", "l'État",
               "Ce sont des missions de l'État pour tout le pays.",
               ("la commune", "le département", "le collège")),
            _q(3, "Le conseil municipal veut installer des bacs à compost et des pistes "
               "cyclables. Quel objectif sert-il surtout ?", "la transition écologique",
               "Moins de déchets et moins de pollution : c'est servir aussi les générations "
               "futures.",
               ("la défense du pays", "la justice", "l'élection du maire")),
            _q(3, "Avec quel argent les élus financent-ils les écoles, les routes et les secours ?",
               "avec les impôts payés par les habitants et les entreprises",
               "L'argent public vient des impôts ; les élus décident comment l'utiliser.",
               ("avec l'argent personnel du maire", "avec les notes des élèves",
                "avec les amendes des élèves")),
        ],
    ),
    # --- Respecter des règles : la laïcité à l'école -----------------------------------------
    Notion(
        "laicite.regles",
        "Règles et lois",
        "Une règle protège chacun et permet de vivre ensemble. Elle vaut pour tous ; ne pas la "
        "respecter entraîne une sanction.",
        [
            _q(1, "Comment s'appelle le texte qui fixe les règles de vie du collège ?",
               "le règlement intérieur",
               "Chaque élève et sa famille le lisent et s'engagent à le respecter.",
               ("le bulletin de notes", "le carnet de santé", "la carte d'identité")),
            _q(1, "À quoi sert une règle commune ?", "à vivre ensemble en se respectant",
               "Les règles protègent chacun et évitent la loi du plus fort.",
               ("à embêter les élèves", "à faire plaisir aux adultes",
                "à rien, on peut s'en passer")),
            _q(1, "Que se passe-t-il quand on ne respecte pas une règle ?",
               "on peut recevoir une sanction",
               "La sanction montre que la règle compte, et aide à réparer.",
               ("rien du tout", "on reçoit une récompense", "on devient délégué")),
            _q(2, "Qui vote les lois en France ?", "le Parlement",
               "L'Assemblée nationale et le Sénat votent les lois.",
               ("le maire", "le principal du collège", "les délégués de classe")),
            _q(2, "Une loi s'applique-t-elle à tout le monde ?",
               "oui, à tous, de la même façon",
               "C'est l'égalité devant la loi : personne n'est au-dessus d'elle.",
               ("non, seulement aux enfants", "non, seulement aux pauvres",
                "seulement à ceux qui l'ont votée")),
            _q(2, "Selon l'article 4 de la Déclaration des droits de l'homme et du citoyen, en "
               "quoi consiste la liberté ?",
               "à pouvoir faire tout ce qui ne nuit pas à autrui",
               "Ma liberté s'arrête là où je ferais du tort aux autres.",
               ("à faire tout ce que l'on veut", "à ne jamais obéir", "à décider pour les autres")),
            _q(3, "Pourquoi une sanction doit-elle être juste et proportionnée ?",
               "parce qu'elle doit correspondre à la gravité de la faute",
               "Une petite faute n'entraîne pas une lourde sanction ; chacun peut s'expliquer.",
               ("pour faire peur à tous", "pour être toujours la plus forte possible",
                "parce qu'elle dépend de l'humeur des adultes")),
            _q(3, "Quelle phrase ouvre l'article premier de la Déclaration des droits de l'homme et "
               "du citoyen de 1789 ?",
               "« Les hommes naissent et demeurent libres et égaux en droits. »",
               "C'est le principe d'égalité de tous en droits, qui fonde nos règles communes.",
               ("« Le plus fort a toujours raison. »", "« Chacun fait sa propre loi. »",
                "« Le roi décide de tout. »")),
            _q(3, "Quelle est la devise de la République française ?",
               "Liberté, Égalité, Fraternité",
               "Elle est inscrite sur les mairies et les écoles.",
               ("Travail, Famille, Patrie", "Un pour tous, tous pour un", "Paix et Prospérité")),
        ],
    ),
    Notion(
        "laicite.liberte_conscience",
        "La liberté de conscience",
        "La liberté de conscience, c'est le droit de croire, de ne pas croire ou de changer de "
        "croyance.",
        [
            _q(1, "Que permet la liberté de conscience ?",
               "croire en une religion, ne pas croire, ou changer d'avis",
               "Chacun choisit librement ses croyances, sans y être obligé.",
               ("obliger les autres à croire comme soi", "croire seulement en la religion du roi",
                "ne jamais en parler à l'école")),
            _q(1, "Inès croit en Dieu ; son amie Zoé n'y croit pas. Laquelle a le droit de penser "
               "ainsi ?", "les deux",
               "La liberté de conscience protège celui qui croit comme celui qui ne croit pas.",
               ("seulement Inès", "seulement Zoé", "aucune des deux")),
            _q(1, "Peut-on se moquer d'un camarade à cause de sa religion ?",
               "non, c'est un manque de respect et une discrimination",
               "On respecte les personnes, quelles que soient leurs convictions.",
               ("oui, si c'est pour rire", "oui, s'il est seul", "oui, à la récréation")),
            _q(2, "Que dit l'article 10 de la Déclaration des droits de l'homme et du citoyen ?",
               "« Nul ne doit être inquiété pour ses opinions, même religieuses, pourvu que leur "
               "manifestation ne trouble pas l'ordre public établi par la Loi. »",
               "Personne ne peut être menacé ou puni pour ses croyances, tant qu'il respecte la "
               "loi.",
               ("« Chacun doit avoir la religion du roi. »",
                "« Les opinions religieuses sont interdites. »",
                "« Seuls les élus ont le droit d'avoir une opinion. »")),
            _q(2, "Peut-on changer de religion, ou cesser d'en avoir une, en France ?",
               "oui, c'est un droit",
               "La liberté de conscience comprend le droit de changer de croyance.",
               ("non, c'est interdit", "seulement avec l'accord du maire",
                "seulement après 60 ans")),
            _q(2, "Comment appelle-t-on une personne qui pense que Dieu n'existe pas ?",
               "une personne athée",
               "Être athée est un choix personnel, protégé comme le fait de croire.",
               ("une personne laïque", "une personne croyante", "une personne élue")),
            _q(3, "La laïcité et l'athéisme, est-ce la même chose ?",
               "non : la laïcité est une règle de la République, l'athéisme un choix personnel",
               "La laïcité protège toutes les convictions ; elle n'impose pas de ne pas croire.",
               ("oui, c'est la même chose", "oui : la laïcité interdit de croire",
                "non : l'athéisme est obligatoire à l'école")),
            _q(3, "Comment appelle-t-on une personne qui pense qu'on ne peut pas savoir si Dieu "
               "existe ?", "une personne agnostique",
               "L'agnosticisme est, lui aussi, un choix personnel protégé.",
               ("une personne athée", "une personne croyante", "une personne citoyenne")),
            _q(3, "Que dit l'article premier de la loi de 1905 ?",
               "« La République assure la liberté de conscience. »",
               "La loi continue : elle garantit le libre exercice des cultes, dans le respect de "
               "l'ordre public.",
               ("« La République impose une religion. »", "« La République interdit les cultes. »",
                "« La République choisit la croyance de chacun. »")),
        ],
    ),
    Notion(
        "laicite.principe",
        "La laïcité",
        "La laïcité sépare les religions et l'État (loi de 1905) : l'État est neutre, il garantit "
        "la liberté de conscience et le libre exercice des cultes, et l'égalité de tous.",
        [
            _q(1, "En quelle année a été votée la loi de séparation des Églises et de l'État ?",
               "1905", "La loi du 9 décembre 1905 fonde la laïcité en France.",
               ("1789", "1945", "2004")),
            _q(1, "Que garantit la laïcité ?",
               "la liberté de croire ou de ne pas croire, et l'égalité de tous",
               "Tous les citoyens sont égaux, quelles que soient leurs convictions.",
               ("l'obligation d'être croyant", "l'interdiction de toutes les religions",
                "une religion officielle pour tous")),
            _q(1, "Quel jour fête-t-on la laïcité dans les écoles ?", "le 9 décembre",
               "C'est l'anniversaire de la loi du 9 décembre 1905.",
               ("le 14 juillet", "le 1er janvier", "le 11 novembre")),
            _q(2, "Que veut dire « l'État est neutre » ?",
               "il ne favorise et ne rejette aucune religion",
               "L'État n'a pas de religion officielle : il traite tous les citoyens de la même "
               "façon.",
               ("il n'a pas d'avis sur les lois", "il ne fait rien", "il choisit une religion")),
            _q(2, "Selon la loi de 1905, la République salarie-t-elle des prêtres, des pasteurs, "
               "des rabbins ou des imams ?", "non, elle ne salarie aucun culte",
               "Article 2 : « La République ne reconnaît, ne salarie ni ne subventionne aucun "
               "culte. »",
               ("oui, tous", "seulement les prêtres", "seulement ceux de Paris")),
            _q(2, "Que signifie « le libre exercice des cultes » ?",
               "chacun peut pratiquer sa religion, dans le respect de la loi",
               "Prier, se rendre dans un lieu de culte, fêter une fête religieuse : c'est permis, "
               "si l'ordre public est respecté.",
               ("chacun peut imposer sa religion aux autres",
                "les religions n'ont plus le droit d'exister", "les cultes sont gratuits")),
            _q(3, "Que dit l'article premier de la Constitution de 1958 ?",
               "« La France est une République indivisible, laïque, démocratique et sociale. »",
               "La laïcité est inscrite dans la Constitution de la Ve République.",
               ("« La France est un royaume chrétien. »",
                "« La France n'a pas de lois. »",
                "« La France est une République religieuse. »")),
            _q(3, "Un agent de la mairie peut-il porter un signe religieux pendant son travail ?",
               "non : au service du public, il doit rester neutre",
               "Les agents publics respectent la neutralité ; les usagers, eux, restent libres "
               "dans l'espace public.",
               ("oui, autant qu'il veut", "seulement le dimanche", "seulement s'il est maire")),
            _q(3, "Dans la rue (l'espace public), peut-on porter un signe religieux ?",
               "oui, dans le respect de la loi et de l'ordre public",
               "Dans l'espace public, chacun exprime librement ses convictions ; la neutralité "
               "s'impose à l'État et à ses agents.",
               ("non, c'est toujours interdit", "seulement avec l'accord du maire",
                "seulement à Noël")),
        ],
    ),
    Notion(
        "laicite.ecole",
        "La laïcité à l'école",
        "L'école publique est laïque : elle protège les élèves de toute pression (prosélytisme). "
        "Depuis la loi de 2004, les élèves n'y portent pas de signes religieux ostensibles.",
        [
            _q(1, "Comment s'appelle le texte affiché dans les écoles publiques qui explique la "
               "laïcité ?", "la Charte de la laïcité à l'école",
               "Elle date de 2013 et compte 15 articles.",
               ("le bulletin de notes", "le menu de la cantine", "le Code de la route")),
            _q(1, "Pourquoi l'école publique est-elle laïque ?",
               "pour accueillir tous les élèves, quelles que soient leurs croyances",
               "L'école protège chacun et apprend à vivre ensemble.",
               ("pour interdire de croire", "pour enseigner une seule religion",
                "pour faire plaisir aux professeurs")),
            _q(1, "Un professeur de l'école publique peut-il dire à ses élèves quelle religion "
               "choisir ?", "non, il doit rester neutre",
               "Le professeur enseigne les savoirs, sans pousser vers une croyance.",
               ("oui, c'est son rôle", "oui, s'il est sûr de lui", "seulement en histoire")),
            _q(2, "Que fixe la loi du 15 mars 2004 pour les élèves des écoles, collèges et lycées "
               "publics ?", "elle interdit les signes religieux ostensibles",
               "Les élèves ne portent pas de signe qui montre de façon visible leur appartenance "
               "religieuse.",
               ("elle interdit de croire", "elle rend la religion obligatoire",
                "elle supprime les vacances de Noël")),
            _q(2, "Qu'est-ce que le prosélytisme ?",
               "chercher à imposer ses croyances aux autres",
               "L'école protège les élèves du prosélytisme, d'où qu'il vienne.",
               ("expliquer une leçon", "voter pour un délégué", "respecter les autres")),
            _q(2, "Un élève peut-il refuser un cours de sciences au nom de sa religion ?",
               "non : aucun élève ne peut refuser un enseignement",
               "La Charte de la laïcité le dit : on ne peut pas contester un enseignement au nom "
               "de ses convictions.",
               ("oui, toujours", "oui, s'il prévient le professeur",
                "seulement en sixième")),
            _q(3, "Chez lui, avec sa famille, un élève peut-il porter un signe religieux ?",
               "oui : la vie privée n'est pas concernée par la loi de 2004",
               "Dans la sphère privée, chacun pratique librement ; l'école publique est un cas "
               "particulier.",
               ("non, jamais", "seulement avec l'accord du collège",
                "seulement s'il est majeur")),
            _q(3, "La maison, la famille, les amis : dans quelle sphère sont-ils ?",
               "la sphère privée",
               "La sphère privée est celle de la vie personnelle ; l'État n'y intervient pas pour "
               "les croyances.",
               ("la sphère publique", "l'espace public", "la sphère scolaire")),
            _q(3, "Pourquoi dit-on que l'école est un cas particulier de l'espace public ?",
               "parce qu'elle accueille des enfants qu'elle doit protéger de toute pression",
               "Les élèves y apprennent à penser par eux-mêmes, à l'abri du prosélytisme.",
               ("parce qu'elle est fermée le dimanche", "parce qu'elle n'a pas de règles",
                "parce qu'elle appartient aux parents")),
        ],
    ),
    # --- Avoir des droits et respecter ceux des autres : la vie privée -----------------------
    Notion(
        "vie_privee.droits",
        "Les droits de l'enfant",
        "La Convention internationale des droits de l'enfant (1989) protège tous les enfants : "
        "droit à l'éducation, à la santé, à la protection, au respect de sa vie privée.",
        [
            _q(1, "Quel texte protège les droits de tous les enfants du monde ?",
               "la Convention internationale des droits de l'enfant",
               "L'ONU l'a adoptée le 20 novembre 1989.",
               ("le règlement intérieur", "le Code de la route", "le carnet de correspondance")),
            _q(1, "Lequel de ces droits est un droit de l'enfant ?", "le droit d'aller à l'école",
               "Chaque enfant a droit à l'éducation.",
               ("le droit de conduire une voiture", "le droit de voter",
                "le droit de ne jamais dormir")),
            _q(1, "Jusqu'à quel âge est-on un enfant, selon la Convention internationale des "
               "droits de l'enfant ?", "jusqu'à 18 ans",
               "Toute personne de moins de 18 ans est un enfant, protégé par la Convention.",
               ("jusqu'à 10 ans", "jusqu'à 12 ans", "jusqu'à 25 ans")),
            _q(2, "Quel jour fête-t-on la Journée internationale des droits de l'enfant ?",
               "le 20 novembre", "C'est le jour de l'adoption de la Convention, en 1989.",
               ("le 14 juillet", "le 9 décembre", "le 1er mai")),
            _q(2, "L'enfant a-t-il droit au respect de sa vie privée ?",
               "oui, comme les adultes",
               "La Convention internationale des droits de l'enfant le protège (article 16).",
               ("non, seulement les adultes", "seulement après 15 ans",
                "seulement s'il est délégué")),
            _q(2, "Quelle organisation a adopté la Convention internationale des droits de "
               "l'enfant ?", "l'ONU",
               "L'Organisation des Nations unies réunit presque tous les pays du monde.",
               ("l'Union européenne", "la mairie", "l'Assemblée nationale")),
            _q(3, "Que dit l'article 9 du Code civil ?",
               "« Chacun a droit au respect de sa vie privée. »",
               "En France, ce droit protège tout le monde, enfants compris.",
               ("« Chacun peut publier la vie des autres. »",
                "« Seuls les adultes ont une vie privée. »",
                "« La vie privée n'existe pas sur Internet. »")),
            _q(3, "Quel texte de l'Union européenne protège la vie privée et les données "
               "personnelles ?", "la Charte des droits fondamentaux de l'Union européenne",
               "Adoptée en 2000, elle protège la vie privée (article 7) et les données "
               "personnelles (article 8).",
               ("la Charte de la laïcité à l'école", "le règlement intérieur du collège",
                "la Constitution de 1958")),
            _q(3, "Avoir des droits, est-ce pouvoir tout faire ?",
               "non : mes droits s'arrêtent où commencent ceux des autres",
               "J'ai droit au respect de ma vie privée ; je dois respecter celle des autres.",
               ("oui, tout est permis", "oui, si personne ne me voit",
                "non, les enfants n'ont aucun droit")),
        ],
    ),
    Notion(
        "vie_privee.intimite",
        "Intimité et droit à l'image",
        "La vie privée et l'intimité n'ont pas à être exposées. Avant de photographier quelqu'un "
        "ou de publier sa photo, il faut lui demander son accord.",
        [
            _q(1, "Avant de publier la photo d'un camarade, que faut-il faire ?",
               "lui demander son accord",
               "C'est le droit à l'image : chacun décide de l'usage de sa photo.",
               ("rien, c'est permis", "la publier vite avant qu'il ne voie",
                "demander à un autre ami")),
            _q(1, "Lequel de ces éléments fait partie de la vie privée ?", "son journal intime",
               "Le journal intime, la santé, la famille : c'est la vie privée.",
               ("le nom de son collège affiché à l'entrée", "le résultat d'un match à la télé",
                "le menu de la cantine affiché")),
            _q(1, "Peut-on lire le journal intime d'un camarade sans sa permission ?",
               "non, c'est sa vie privée",
               "Lire en cachette ses secrets, c'est ne pas respecter sa vie privée.",
               ("oui, si on le trouve", "oui, s'il est ouvert", "oui, pour rigoler")),
            _q(2, "Qu'est-ce que l'intimité ?",
               "ce qui touche à son corps, à ses sentiments, à ses secrets",
               "L'intimité n'a pas à être exposée aux autres.",
               ("ce qui est affiché à la mairie", "ce qu'on publie pour tout le monde",
                "les résultats sportifs")),
            _q(2, "Léo filme un camarade qui tombe et veut partager la vidéo. Qu'en penses-tu ?",
               "il n'a pas le droit sans l'accord de ce camarade",
               "Publier une vidéo humiliante sans accord porte atteinte à son droit à l'image.",
               ("c'est permis si c'est drôle", "c'est permis si la vidéo est courte",
                "c'est permis s'il ne met pas de son")),
            _q(2, "Pour publier la photo d'un enfant, l'accord de qui faut-il demander ?",
               "celui de l'enfant et de ses parents",
               "Un mineur est protégé par ses parents ; son propre avis compte aussi.",
               ("celui du photographe seulement", "celui du maire", "personne")),
            _q(3, "Qu'est-ce que le droit à l'image ?",
               "le droit de refuser qu'on prenne ou diffuse une image de soi",
               "Toute personne reconnaissable peut s'opposer à la diffusion de son image.",
               ("le droit de photographier tout le monde", "le droit d'acheter des photos",
                "le droit de dessiner")),
            _q(3, "Une star a-t-elle droit au respect de sa vie privée ?",
               "oui, comme tout le monde",
               "Même une personne célèbre garde une vie privée protégée par la loi.",
               ("non, jamais", "seulement si elle paie", "seulement le dimanche")),
            _q(3, "Un ami te confie un secret. Que fais-tu ?",
               "je le garde, sauf s'il est en danger : alors j'en parle à un adulte de confiance",
               "Respecter la confiance, c'est garder le secret ; protéger un ami en danger passe "
               "avant.",
               ("je le raconte à toute la classe", "je le publie sur Internet",
                "je l'écris au tableau")),
        ],
    ),
    Notion(
        "vie_privee.numerique",
        "Données personnelles et identité numérique",
        "Nom, adresse, photo, téléphone : ce sont des données personnelles. Tout ce qu'on publie "
        "laisse des traces. Avant 15 ans, s'inscrire sur un réseau social demande l'accord d'un "
        "parent.",
        [
            _q(1, "Laquelle de ces informations est une donnée personnelle ?", "mon adresse",
               "Une donnée personnelle permet de savoir qui je suis ou où me trouver.",
               ("la capitale de la France", "la météo de demain", "le prix d'un croissant")),
            _q(1, "Un inconnu te demande ton adresse sur un jeu en ligne. Que fais-tu ?",
               "je ne la donne pas et j'en parle à un adulte",
               "On ne donne jamais ses informations personnelles à un inconnu.",
               ("je la donne", "je donne celle d'un ami", "je donne aussi mon mot de passe")),
            _q(1, "À qui peut-on donner son mot de passe ?",
               "à personne, sauf à ses parents",
               "Le mot de passe protège ton compte : il reste secret.",
               ("à son meilleur ami", "à toute la classe", "à un inconnu qui le demande")),
            _q(2, "Que sont les traces numériques ?",
               "ce que l'on laisse sur Internet : messages, photos, recherches, « j'aime »",
               "Ces traces peuvent rester longtemps et être vues par d'autres.",
               ("des traces de pas dans la neige", "les fils d'un ordinateur",
                "des dessins à la craie")),
            _q(2, "Qu'est-ce que l'identité numérique ?",
               "l'image de soi que donnent ses traces sur Internet",
               "Ce que je publie dit qui je suis, aux autres et plus tard.",
               ("sa carte d'identité", "son numéro de téléphone seulement",
                "son nom écrit au stylo")),
            _q(2, "Quelle autorité protège les données personnelles en France ?", "la CNIL",
               "La Commission nationale de l'informatique et des libertés existe depuis 1978.",
               ("la mairie", "les pompiers", "le conseil de la vie collégienne")),
            _q(3, "À quel âge la loi du 7 juillet 2023 fixe-t-elle la majorité numérique ?",
               "15 ans",
               "Avant 15 ans, il faut l'accord d'un parent pour s'inscrire sur un réseau social.",
               ("11 ans", "13 ans", "18 ans")),
            _q(3, "Qu'est-ce que le droit à l'oubli ?",
               "le droit de demander l'effacement d'informations sur soi en ligne",
               "On peut demander qu'une photo ou un texte qui nous concerne soit retiré.",
               ("le droit d'oublier ses devoirs", "le droit de ne jamais aller sur Internet",
                "le droit d'effacer les messages des autres")),
            _q(3, "Pourquoi faut-il réfléchir avant de publier une photo de soi ?",
               "parce qu'elle peut être copiée et rester en ligne longtemps",
               "Ce qui est publié peut circuler sans qu'on le contrôle : c'est sa réputation en "
               "ligne.",
               ("parce qu'elle s'efface toute seule le lendemain",
                "parce que c'est interdit par la loi", "parce que les photos coûtent cher")),
        ],
    ),
    Notion(
        "vie_privee.harcelement",
        "Cyberharcèlement et désinformation",
        "Le cyberharcèlement, ce sont des moqueries ou des menaces répétées en ligne. On en parle "
        "à un adulte ; le 3018 aide les victimes. Avant de partager une information, on vérifie "
        "sa source.",
        [
            _q(1, "Une camarade reçoit chaque jour des messages méchants sur son téléphone. "
               "Comment s'appelle cette situation ?", "du cyberharcèlement",
               "Des attaques répétées en ligne, c'est du cyberharcèlement.",
               ("une blague", "un jeu", "une élection")),
            _q(1, "Tu es victime de moqueries en ligne. Que fais-tu ?",
               "j'en parle à un adulte de confiance",
               "Il ne faut pas rester seul : un parent, un professeur ou le 3018 peuvent aider.",
               ("je réponds par des insultes", "je garde tout pour moi",
                "je supprime l'application et je n'en parle pas")),
            _q(1, "Quel numéro gratuit aide les victimes de cyberharcèlement ?", "le 3018",
               "Le 3018 est gratuit, anonyme et confidentiel.",
               ("le 18", "le 15", "le 112")),
            _q(2, "Partager ou « liker » un message qui se moque d'un camarade, est-ce grave ?",
               "oui : c'est participer au harcèlement",
               "Le témoin qui partage aggrave la situation ; celui qui alerte aide la victime.",
               ("non, ce n'est qu'un clic", "non, si on ne l'a pas écrit",
                "non, si tout le monde le fait")),
            _q(2, "Le cyberharcèlement est-il puni par la loi ?",
               "oui, c'est un délit",
               "Harceler quelqu'un, en ligne ou non, est puni par la loi, même pour un mineur.",
               ("non, Internet n'a pas de loi", "seulement s'il dure un an",
                "seulement pour les adultes")),
            _q(2, "Qu'est-ce qu'une « fausse information » ?",
               "une information inventée ou déformée, qu'on fait passer pour vraie",
               "On l'appelle aussi « infox » : elle trompe ceux qui la lisent.",
               ("une information un peu ancienne", "une information en anglais",
                "une information trop longue")),
            _q(3, "Avant de partager une information étonnante, que faut-il vérifier ?",
               "sa source, sa date et si d'autres médias sérieux la donnent",
               "Vérifier évite de propager une fausse information.",
               ("le nombre de « j'aime » seulement", "la couleur de la page",
                "rien, si elle me plaît")),
            _q(3, "Une photo ancienne est publiée comme si elle venait d'être prise. Comment "
               "appelle-t-on ce piège ?", "une image sortie de son contexte",
               "La photo est vraie, mais on lui fait dire autre chose : c'est de la "
               "désinformation.",
               ("un selfie", "un droit à l'image", "un éco-délégué")),
            _q(3, "Passer des heures devant les écrans tard le soir, quel risque cela fait-il "
               "courir ?", "manquer de sommeil et avoir du mal à se concentrer",
               "Les écrans ont aussi des risques pour la santé : on apprend à en limiter l'usage.",
               ("devenir plus grand", "avoir de meilleures notes sans travailler",
                "aucun risque")),
        ],
    ),
]

register_notions(LEVEL, SUBJECT, NOTIONS)


# --- Élection des délégués ----------------------------------------------------------------------

NAMES = ["Léa", "Malik", "Inès", "Hugo", "Chloé", "Noah", "Sarah", "Yanis", "Zoé", "Adam", "Jade",
         "Lucas"]
NOBODY = "Personne : il faut un second tour."


def majority(expressed: int) -> int:
    """Voix nécessaires pour la majorité absolue : plus de la moitié des suffrages exprimés."""
    return expressed // 2 + 1


def _numeric(prompt: str, value: int, hint: str, explanation: str, difficulty: int,
             meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": str(value)},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": meta,
    }


def _half(n: int) -> str:
    return str(n // 2) if n % 2 == 0 else f"{n // 2},5"


def _votes(names: list[str], votes: list[int]) -> str:
    return ", ".join(f"{name} {v} voix" for name, v in zip(names, votes, strict=True))


def _election(difficulty: int, rng: random.Random) -> dict[str, Any]:
    hint = ("Majorité absolue : plus de la moitié des suffrages exprimés. Les bulletins blancs ne "
            "sont pas des suffrages exprimés.")
    kind = {1: "majorite", 2: "majorite", 3: "premier_tour", 4: "second_tour", 5: "blancs"}[
        difficulty]
    if kind in ("majorite", "blancs"):
        expressed = rng.randint(21, 30) if difficulty > 1 else rng.choice([20, 22, 24, 26, 28])
        blank = rng.randint(1, 3) if kind == "blancs" else 0
        voters = expressed + blank
        need = majority(expressed)
        if blank:
            prompt = (f"Dans une classe, {voters} élèves votent pour élire leur délégué. "
                      f"{blank} bulletin{'s sont blancs' if blank > 1 else ' est blanc'}. "
                      "Combien de voix faut-il au minimum pour être élu au premier tour ?")
            why = (f"Les bulletins blancs ne comptent pas : {voters} − {blank} = {expressed} "
                   f"suffrages exprimés. La moitié de {expressed} est {_half(expressed)} : il faut "
                   f"au moins {need} voix.")
        else:
            prompt = (f"Dans une classe, {voters} élèves votent pour élire leur délégué ; tous les "
                      "bulletins sont valables. Combien de voix faut-il au minimum pour être élu "
                      "au premier tour ?")
            why = (f"Il faut plus de la moitié des {expressed} suffrages exprimés. La moitié de "
                   f"{expressed} est {_half(expressed)} : il faut au moins {need} voix.")
        return _numeric(prompt, need, hint, why, difficulty,
                        {"kind": kind, "expressed": expressed, "blank": blank, "need": need})
    names = rng.sample(NAMES, 3)
    while True:
        votes = sorted(rng.sample(range(2, 13), 3), reverse=True)
        expressed = sum(votes)
        has_majority = votes[0] >= majority(expressed)
        if kind == "second_tour" or rng.random() < 0.5 or has_majority:
            break
    if kind == "premier_tour":
        prompt = (f"Premier tour de l'élection des délégués : {_votes(names, votes)}. "
                  f"Il y a {expressed} suffrages exprimés. Qui est élu ?")
        answer = names[0] if has_majority else NOBODY
        if has_majority:
            why = (f"{names[0]} a {votes[0]} voix, plus de la moitié des {expressed} suffrages "
                   f"exprimés (il en fallait {majority(expressed)}) : élu dès le premier tour.")
        else:
            why = (f"Il fallait {majority(expressed)} voix, plus de la moitié des {expressed} "
                   f"suffrages exprimés. Personne ne les a : on organise un second tour.")
    else:
        prompt = (f"Second tour de l'élection des délégués : {_votes(names, votes)}. "
                  "Qui est élu ?")
        answer = names[0]
        why = (f"Au second tour, la majorité relative suffit : {names[0]} a le plus de voix "
               f"({votes[0]}), même sans en avoir plus de la moitié.")
    choices = [*names, NOBODY] if kind == "premier_tour" else list(names)
    rng.shuffle(choices)
    if NOBODY in choices:  # toujours en dernier
        choices.remove(NOBODY)
        choices.append(NOBODY)
    return {
        "type": "mcq",
        "prompt": prompt,
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(answer)},
        "hint": hint,
        "explanation": why,
        "time_target_ms": 30000 + 5000 * difficulty,
        "meta": {"kind": kind, "votes": votes, "names": names, "answer": answer},
    }


ELECTION = register(
    Generator(
        code="6e.emc.election",
        level=LEVEL,
        notion="6e.emc.representer.vote",
        role="chapitre",
        title="L'élection des délégués",
        generate=_election,
    )
)


# --- Échelons de la représentation (énigme de la Tribune du Conseil) ----------------------------

# (rang, assemblée, élu) : du plus petit territoire au plus grand ; le collège n'a pas d'élu
# « à son nom » dans la seconde liste.
ECHELONS = [
    (0, "la classe : les délégués de classe", "un délégué de classe"),
    (1, "le collège : le conseil de la vie collégienne", ""),
    (2, "la commune : le conseil municipal", "un conseiller municipal"),
    (3, "le département : le conseil départemental", "un conseiller départemental"),
    (4, "la région : le conseil régional", "un conseiller régional"),
    (5, "la France : l'Assemblée nationale et le Sénat", "un député"),
    (6, "l'Union européenne : le Parlement européen", "un député européen"),
]
ECHELON_COUNT = {1: 3, 2: 4, 3: 4, 4: 5, 5: 6}


def _echelons(difficulty: int, rng: random.Random) -> dict[str, Any]:
    people = difficulty in (2, 4) or (difficulty == 5 and rng.random() < 0.5)
    pool = [(r, who) for r, _a, who in ECHELONS if who] if people else [
        (r, assembly) for r, assembly, _w in ECHELONS]
    picked = sorted(rng.sample(pool, min(ECHELON_COUNT[difficulty], len(pool))))
    shown = list(range(len(picked)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    what = "ces élus" if people else "ces échelons"
    return {
        "type": "order",
        "prompt": f"Le Voleur de Voix a mélangé les échelons ! Range {what}, du plus petit "
        "territoire représenté au plus grand.",
        "choices": [picked[i][1] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(picked))]},
        "hint": "La classe, puis la commune, le département, la région, la France, et enfin "
        "l'Union européenne.",
        "explanation": "Du plus petit au plus grand : " + " ; ".join(p[1] for p in picked) + ".",
        "time_target_ms": 20000 + 6000 * difficulty,
        "meta": {"ranks": [p[0] for p in picked]},
    }


ECHELONS_GEN = register(
    Generator(
        code="6e.emc.echelons",
        level=LEVEL,
        notion="6e.emc.representer.representants",
        role="chapitre",
        title="Les échelons de la représentation",
        generate=_echelons,
    )
)


# --- Frise des droits (énigme du Palais des Libertés) -------------------------------------------

EVENTS = [
    (1789, "Déclaration des droits de l'homme et du citoyen"),
    (1848, "Suffrage universel masculin en France"),
    (1882, "École primaire obligatoire et laïque, avec les lois Ferry"),
    (1905, "Loi de séparation des Églises et de l'État"),
    (1944, "Droit de vote des femmes en France"),
    (1948, "Déclaration universelle des droits de l'homme"),
    (1958, "Constitution de la Ve République, qui dit la France laïque"),
    (1974, "Droit de vote à 18 ans"),
    (1978, "Création de la CNIL, gardienne des données personnelles"),
    (1989, "Convention internationale des droits de l'enfant"),
    (2000, "Charte des droits fondamentaux de l'Union européenne"),
    (2004, "Loi sur les signes religieux à l'école"),
    (2013, "Charte de la laïcité à l'école"),
    (2023, "Loi sur la majorité numérique à 15 ans"),
]
# Difficulté → (nombre d'événements, écart minimal en années entre deux voisins).
FRISE = {1: (3, 40), 2: (3, 15), 3: (4, 10), 4: (4, 5), 5: (5, 1)}


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
        "prompt": "Le Fouineur a mélangé les archives ! Remets ces textes et ces droits dans "
        "l'ordre, du plus ancien au plus récent.",
        "choices": [picked[i][1] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "La Déclaration des droits de l'homme date de la Révolution (1789) ; la loi sur "
        "la laïcité, de 1905 ; la Convention des droits de l'enfant, de 1989.",
        "explanation": "Dans l'ordre : " + " ; ".join(f"{label} ({year})"
                                                      for year, label in picked) + ".",
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"years": [y for y, _l in picked]},
    }


FRISE_GEN = register(
    Generator(
        code="6e.emc.frise",
        level=LEVEL,
        notion="6e.emc.vie_privee.droits",
        role="chapitre",
        title="La frise des droits",
        generate=_frise,
    )
)
