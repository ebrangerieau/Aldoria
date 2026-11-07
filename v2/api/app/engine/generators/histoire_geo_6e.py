"""Histoire-géographie, 6e (programme 2020, en vigueur en 2026-2027) : exemples relus, plus trois
générateurs calculés.

- `6e.histoire_geo.siecles` : le siècle d'une année, avant ou après J.-C. ;
- `6e.histoire_geo.frise` : remettre des événements dans l'ordre chronologique (énigme de la
  Porte des Origines) ;
- `6e.histoire_geo.population` : classer des pays du plus au moins peuplé (énigme de la Porte des
  Horizons). Ordre des Nations unies (World Population Prospects 2024), écarts nets entre voisins.

Dates : celles des manuels de 6e (« vers » quand elles sont approximatives).
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions

LEVEL, SUBJECT = "6e", "histoire_geo"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    return Fact(level, prompt, answer, why, wrong)


NOTIONS = [
    Notion(
        "humanite.premiers_humains",
        "Les débuts de l'humanité",
        "Paléolithique : avant l'agriculture. Les humains chassent, pêchent, cueillent et se déplacent.",
        [
            _q(
                1,
                "Sur quel continent sont apparus les premiers humains ?",
                "l'Afrique",
                "Les plus anciens fossiles humains ont été trouvés en Afrique.",
                ("l'Europe", "l'Asie", "l'Amérique"),
            ),
            _q(
                1,
                "Comment s'appelle la période des premiers humains, avant l'agriculture ?",
                "le Paléolithique",
                "« Paléo- » : ancien ; « lithique » : la pierre. C'est l'âge de la pierre taillée.",
                ("le Néolithique", "l'Antiquité", "le Moyen Âge"),
            ),
            _q(
                1,
                "Au Paléolithique, de quoi vivent les humains ?",
                "de la chasse, de la pêche et de la cueillette",
                "Ils ne cultivent pas encore : ils trouvent leur nourriture dans la nature.",
                ("de l'agriculture et de l'élevage", "du commerce", "de l'industrie"),
            ),
            _q(
                2,
                "Comment s'appelle notre espèce ?",
                "Homo sapiens",
                "Nous sommes tous des Homo sapiens, « l'homme sage ».",
                ("Homo erectus", "l'Australopithèque", "l'homme de Néandertal"),
            ),
            _q(
                2,
                "Homo sapiens est apparu il y a environ…",
                "300 000 ans",
                "Les plus anciens Homo sapiens connus, au Maroc, ont environ 300 000 ans.",
                ("3 000 ans", "30 000 000 ans", "3 000 000 000 ans"),
            ),
            Fact(
                2,
                "Comment appelle-t-on un humain qui se déplace sans cesse, sans habitat fixe ?",
                "nomade",
                "Les chasseurs-cueilleurs suivent le gibier et les saisons : ils sont nomades.",
                ("sédentaire", "citoyen", "esclave"),
            ),
            _q(
                3,
                "Lucy, célèbre fossile découvert en Éthiopie en 1974, est…",
                "une australopithèque",
                "Lucy vivait il y a 3,2 millions d'années : c'est une australopithèque, pas une Homo sapiens.",
                ("une Homo sapiens", "une Néandertalienne", "une Romaine"),
            ),
            _q(
                3,
                "Comment les humains ont-ils peuplé tous les continents ?",
                "par des migrations",
                "Partis d'Afrique, les humains se sont déplacés peu à peu vers tous les continents.",
                (
                    "par bateau à moteur",
                    "ils sont apparus partout en même temps",
                    "grâce aux Romains",
                ),
            ),
            _q(
                3,
                "Les peintures des grottes Chauvet et de Lascaux datent du…",
                "Paléolithique",
                "Ces peintures d'animaux ont été faites par des chasseurs-cueilleurs du Paléolithique.",
                ("Néolithique", "Moyen Âge", "temps des Romains"),
            ),
        ],
    ),
    Notion(
        "humanite.neolithique",
        "La révolution néolithique",
        "Néolithique : les humains cultivent, élèvent et s'installent dans des villages.",
        [
            _q(
                1,
                "La révolution néolithique, c'est l'invention de…",
                "l'agriculture et l'élevage",
                "Au Néolithique, les humains produisent leur nourriture : ils cultivent et élèvent.",
                ("l'écriture", "la maîtrise du feu", "la monnaie"),
            ),
            _q(
                1,
                "Au Néolithique, les humains deviennent…",
                "sédentaires",
                "Pour cultiver leurs champs, ils s'installent au même endroit : ils deviennent sédentaires.",
                ("nomades", "chasseurs-cueilleurs", "navigateurs"),
            ),
            _q(
                2,
                "Où commence le Néolithique, vers 10 000 av. J.-C. ?",
                "au Proche-Orient",
                "Les premiers champs et troupeaux apparaissent au Proche-Orient, dans le Croissant fertile.",
                ("en Europe du Nord", "en Amérique", "en Australie"),
            ),
            Fact(
                2,
                "Comment appelle-t-on un humain qui vit toujours au même endroit ?",
                "sédentaire",
                "Le sédentaire vit dans une maison fixe, au contraire du nomade.",
                ("nomade", "migrant", "chasseur"),
            ),
            _q(
                2,
                "Qu'apparaît-il au Néolithique ?",
                "les premiers villages",
                "En devenant sédentaires, les humains construisent les premiers villages.",
                (
                    "les premières grandes villes de béton",
                    "les premières routes romaines",
                    "les premiers châteaux forts",
                ),
            ),
            _q(
                3,
                "Où se situe le Croissant fertile ?",
                "au Proche-Orient, entre la Méditerranée et le golfe Persique",
                "Cette région en forme de croissant, bien arrosée, a vu naître l'agriculture.",
                ("en Égypte, le long du Nil seulement", "en Chine", "en Gaule"),
            ),
            _q(
                3,
                "Les grandes pierres dressées de Carnac sont…",
                "des menhirs du Néolithique",
                "Les menhirs ont été dressés par des paysans du Néolithique.",
                ("des temples romains", "des statues grecques", "des pyramides"),
            ),
        ],
    ),
    Notion(
        "humanite.etats_ecriture",
        "Premiers États, premières écritures",
        "Mésopotamie (Tigre et Euphrate) : l'écriture vers 3300 av. J.-C. Égypte : le Nil, le pharaon, les hiéroglyphes.",
        [
            _q(
                1,
                "Où l'écriture a-t-elle été inventée, vers 3300 av. J.-C. ?",
                "en Mésopotamie",
                "Les premières tablettes écrites viennent de Mésopotamie (l'Irak actuel).",
                ("en Gaule", "en Grèce", "en Amérique"),
            ),
            Fact(
                1,
                "Comment s'appelle le roi de l'Égypte ancienne ?",
                "le pharaon",
                "Le pharaon est à la fois roi et dieu vivant pour les Égyptiens.",
                ("l'empereur", "le consul", "le calife"),
            ),
            Fact(
                1,
                "Comment s'appelle l'écriture des Égyptiens de l'Antiquité ?",
                "les hiéroglyphes",
                "Les hiéroglyphes sont des signes dessinés, gravés ou peints.",
                ("l'alphabet latin", "l'écriture cunéiforme", "les runes"),
            ),
            _q(
                2,
                "L'écriture mésopotamienne, en forme de clous tracés sur l'argile, s'appelle…",
                "l'écriture cunéiforme",
                "« cunéiforme » vient du latin « cuneus », le clou.",
                ("les hiéroglyphes", "l'alphabet grec", "l'écriture chinoise"),
            ),
            _q(
                2,
                "Quel fleuve fait vivre l'Égypte ?",
                "le Nil",
                "Les crues du Nil déposent un limon fertile : « l'Égypte est un don du Nil ».",
                ("le Tigre", "l'Euphrate", "le Tibre"),
            ),
            _q(
                2,
                "Entre quels fleuves se trouve la Mésopotamie ?",
                "le Tigre et l'Euphrate",
                "« Mésopotamie » veut dire en grec « entre les fleuves ».",
                ("le Nil et le Jourdain", "le Tibre et le Pô", "le Rhin et le Danube"),
            ),
            _q(
                3,
                "Quel roi de Babylone fit graver un recueil de lois vers 1750 av. J.-C. ?",
                "Hammurabi",
                "Le Code de Hammurabi est gravé sur une stèle conservée au Louvre.",
                ("Khéops", "Ramsès II", "Périclès"),
            ),
            _q(
                3,
                "Pourquoi l'écriture a-t-elle été inventée ?",
                "pour compter, gérer les richesses et noter les lois",
                "Les premiers textes sont surtout des comptes de céréales et de troupeaux.",
                ("pour écrire des romans", "pour s'envoyer des lettres d'amour", "pour jouer"),
            ),
            _q(
                3,
                "Qu'est-ce qu'un État ?",
                "un territoire et une population dirigés par un pouvoir organisé",
                "Un État a un chef, des lois, des fonctionnaires et prélève des impôts.",
                ("une très grande ville", "un groupe de nomades", "un temple et ses prêtres"),
            ),
        ],
    ),
    Notion(
        "antiquite.cites_grecques",
        "Le monde des cités grecques",
        "Les Grecs vivent dans des cités indépendantes, mais partagent la langue, les dieux et les Jeux.",
        [
            _q(
                1,
                "Qu'est-ce qu'une cité grecque ?",
                "une ville et son territoire, indépendants, avec leurs lois et leurs dieux",
                "Athènes, Sparte ou Corinthe sont des cités : de petits États indépendants.",
                ("une très grande capitale", "un temple", "un royaume gouverné par un pharaon"),
            ),
            _q(
                1,
                "Quel est le roi des dieux grecs ?",
                "Zeus",
                "Zeus règne sur l'Olympe ; les Romains l'appellent Jupiter.",
                ("Jupiter", "Osiris", "Thor"),
            ),
            _q(
                1,
                "En l'honneur de quel dieu ont lieu les Jeux olympiques ?",
                "Zeus",
                "Les Jeux se tiennent à Olympie, dans le sanctuaire de Zeus.",
                ("Poséidon", "Hadès", "Mars"),
            ),
            _q(
                2,
                "De quand datent les premiers Jeux olympiques ?",
                "776 av. J.-C.",
                "Selon la tradition, les premiers Jeux ont lieu en 776 av. J.-C.",
                ("753 av. J.-C.", "52 av. J.-C.", "476 après J.-C."),
            ),
            Fact(
                2,
                "À Athènes, au Ve siècle av. J.-C., comment s'appelle le régime où les citoyens votent les lois ?",
                "la démocratie",
                "« démocratie » : le pouvoir (kratos) du peuple (dèmos).",
                ("la monarchie", "la tyrannie", "l'empire"),
            ),
            _q(
                2,
                "À qui attribue-t-on l'Iliade et l'Odyssée ?",
                "Homère",
                "Ces deux grands récits fondateurs sont attribués au poète Homère.",
                ("Ulysse", "Périclès", "Virgile"),
            ),
            _q(
                3,
                "À Athènes, qui est citoyen ?",
                "les hommes libres, nés de parents athéniens, majeurs",
                "Les femmes, les esclaves et les étrangers (métèques) ne sont pas citoyens.",
                (
                    "tous les habitants, femmes comprises",
                    "les esclaves",
                    "les étrangers installés à Athènes",
                ),
            ),
            _q(
                3,
                "Comment s'appelle l'assemblée des citoyens athéniens ?",
                "l'Ecclésia",
                "L'Ecclésia se réunit sur la colline de la Pnyx pour voter les lois.",
                ("le Sénat", "l'agora", "le forum"),
            ),
            _q(
                3,
                "Quel temple dédié à Athéna domine l'Acropole d'Athènes ?",
                "le Parthénon",
                "Le Parthénon est construit au Ve siècle av. J.-C. pour la déesse Athéna.",
                ("le Colisée", "le Panthéon de Rome", "la pyramide de Khéops"),
            ),
        ],
    ),
    Notion(
        "antiquite.rome_origines",
        "Rome, du mythe à l'histoire",
        "Selon la légende, Romulus fonde Rome en 753 av. J.-C. ; les archéologues retrouvent un village du VIIIe siècle av. J.-C.",
        [
            _q(
                1,
                "Selon la légende, qui a fondé Rome ?",
                "Romulus",
                "Romulus aurait tracé l'enceinte de Rome, après avoir tué son frère Rémus.",
                ("Jules César", "Auguste", "Ulysse"),
            ),
            _q(
                1,
                "Quelle est la date légendaire de la fondation de Rome ?",
                "753 av. J.-C.",
                "Les Romains comptaient les années à partir de 753 av. J.-C.",
                ("776 av. J.-C.", "52 av. J.-C.", "476 après J.-C."),
            ),
            _q(
                1,
                "Quel fleuve traverse Rome ?",
                "le Tibre",
                "Rome est née sur des collines au bord du Tibre.",
                ("le Nil", "la Seine", "le Rhône"),
            ),
            _q(
                2,
                "Selon la légende, qui a nourri Romulus et Rémus ?",
                "une louve",
                "Abandonnés au bord du Tibre, les jumeaux auraient été allaités par une louve.",
                ("une ourse", "une chèvre", "un aigle"),
            ),
            _q(
                2,
                "De 509 à 27 av. J.-C., Rome est…",
                "une république",
                "Après les rois, Rome est gouvernée par des magistrats élus et le Sénat : c'est la République.",
                ("un empire", "une monarchie", "une démocratie comme Athènes"),
            ),
            _q(
                2,
                "Quel est le roi des dieux romains ?",
                "Jupiter",
                "Jupiter est l'équivalent romain de Zeus.",
                ("Zeus", "Osiris", "Apollon"),
            ),
            _q(
                3,
                "Quel récit de Virgile raconte la fuite d'Énée, de Troie jusqu'en Italie ?",
                "l'Énéide",
                "Virgile écrit l'Énéide sous Auguste, pour donner à Rome des origines glorieuses.",
                ("l'Iliade", "l'Odyssée", "la Bible"),
            ),
            _q(
                3,
                "Qu'ont trouvé les archéologues sur la colline du Palatin, à Rome ?",
                "les traces d'un village du VIIIe siècle av. J.-C.",
                "Des trous de poteaux de cabanes montrent qu'un village existait bien à l'époque de la légende.",
                ("le tombeau de Romulus", "la louve de la légende", "un palais égyptien"),
            ),
        ],
    ),
    Notion(
        "antiquite.monotheisme",
        "La naissance du monothéisme juif",
        "Monothéisme : un seul dieu. Polythéisme : plusieurs dieux.",
        [
            Fact(
                1,
                "Comment appelle-t-on le fait de croire en un seul dieu ?",
                "le monothéisme",
                "« mono » : un seul ; « théos » : dieu.",
                ("le polythéisme", "l'athéisme", "la mythologie"),
            ),
            Fact(
                1,
                "Comment appelle-t-on le fait de croire en plusieurs dieux ?",
                "le polythéisme",
                "« poly » : plusieurs ; « théos » : dieu. Grecs, Romains et Égyptiens sont polythéistes.",
                ("le monothéisme", "la démocratie", "le néolithique"),
            ),
            _q(
                1,
                "Quel est le livre sacré des Hébreux ?",
                "la Bible hébraïque",
                "La Bible hébraïque rassemble les textes sacrés des Hébreux.",
                ("le Coran", "l'Iliade", "les Évangiles"),
            ),
            _q(
                2,
                "Dans quelle ville se trouvait le Temple des Hébreux ?",
                "Jérusalem",
                "Le Temple de Jérusalem était le centre de la religion des Hébreux.",
                ("Rome", "Athènes", "Babylone"),
            ),
            Fact(
                2,
                "Comment s'appelle le lieu de prière et d'étude des Juifs ?",
                "la synagogue",
                "La synagogue est le lieu de réunion, de prière et d'étude de la Torah.",
                ("l'église", "la mosquée", "le temple grec"),
            ),
            _q(
                2,
                "Comment s'appellent les cinq premiers livres de la Bible hébraïque ?",
                "la Torah",
                "La Torah contient la Loi donnée, selon la Bible, à Moïse.",
                ("les Évangiles", "l'Énéide", "le Code de Hammurabi"),
            ),
            _q(
                3,
                "En quelle année les Romains détruisent-ils le Temple de Jérusalem ?",
                "70 après J.-C.",
                "Après une révolte des Juifs, Titus détruit le Temple en 70.",
                ("753 av. J.-C.", "313 après J.-C.", "476 après J.-C."),
            ),
            _q(
                3,
                "Selon la Bible, qui est Abraham ?",
                "l'ancêtre du peuple hébreu",
                "Abraham est le premier patriarche, avec qui Dieu fait alliance.",
                ("un pharaon d'Égypte", "un empereur romain", "un dieu grec"),
            ),
            _q(
                3,
                "Quel roi de Babylone détruit le premier Temple de Jérusalem en 587 av. J.-C. ?",
                "Nabuchodonosor II",
                "Les Hébreux sont alors déportés à Babylone : c'est l'Exil.",
                ("Hammurabi", "Ramsès II", "Jules César"),
            ),
        ],
    ),
    Notion(
        "empire_romain.conquetes",
        "Conquêtes, paix romaine et romanisation",
        "Auguste, premier empereur en 27 av. J.-C. ; la paix romaine ; les peuples conquis adoptent le mode de vie romain.",
        [
            _q(
                1,
                "Qui est le premier empereur romain ?",
                "Auguste",
                "Octave prend le nom d'Auguste et devient empereur en 27 av. J.-C.",
                ("Jules César", "Romulus", "Néron"),
            ),
            _q(
                1,
                "Quelle région Jules César a-t-il conquise ?",
                "la Gaule",
                "César conquiert la Gaule de 58 à 51 av. J.-C.",
                ("l'Égypte", "la Chine", "l'Amérique"),
            ),
            _q(
                2,
                "En quelle année a lieu la bataille d'Alésia, où Vercingétorix se rend à César ?",
                "52 av. J.-C.",
                "En 52 av. J.-C., Vercingétorix est vaincu à Alésia.",
                ("753 av. J.-C.", "27 av. J.-C.", "476 après J.-C."),
            ),
            _q(
                2,
                "Comment appelle-t-on la longue paix des deux premiers siècles de l'empire ?",
                "la paix romaine",
                "La « pax romana » permet le commerce et la construction de routes et de villes.",
                ("la guerre de Cent Ans", "la Révolution", "la paix des cités grecques"),
            ),
            Fact(
                2,
                "Comment appelle-t-on l'adoption de la langue, des lois et du mode de vie des Romains par les peuples conquis ?",
                "la romanisation",
                "Thermes, amphithéâtres, latin : les provinces se romanisent.",
                ("la mondialisation", "la démocratie", "la colonisation grecque"),
            ),
            _q(
                3,
                "Qu'accorde l'empereur Caracalla en 212 ?",
                "la citoyenneté romaine à tous les hommes libres de l'empire",
                "Par l'édit de Caracalla, tous les hommes libres deviennent citoyens romains.",
                (
                    "la liberté à tous les esclaves",
                    "le droit de vote aux femmes",
                    "l'indépendance de la Gaule",
                ),
            ),
            _q(
                3,
                "Quel mur protège la frontière de l'empire au nord de la Bretagne (l'actuelle Grande-Bretagne) ?",
                "le mur d'Hadrien",
                "L'empereur Hadrien le fait construire à partir de 122.",
                ("la Grande Muraille", "le mur de Berlin", "le mur des Lamentations"),
            ),
            _q(
                3,
                "Comment s'appelait Lyon, capitale des Gaules à l'époque romaine ?",
                "Lugdunum",
                "Lugdunum est la grande ville romaine de la Gaule.",
                ("Lutèce", "Massalia", "Burdigala"),
            ),
        ],
    ),
    Notion(
        "empire_romain.chretiens",
        "Des chrétiens dans l'empire",
        "D'abord persécutés, les chrétiens sont autorisés en 313 ; le christianisme devient religion officielle en 380.",
        [
            _q(
                1,
                "Pour les chrétiens, qui est Jésus ?",
                "le Messie, fils de Dieu",
                "Les chrétiens croient que Jésus est le Messie annoncé, mort et ressuscité.",
                ("un empereur romain", "un dieu grec", "un pharaon"),
            ),
            _q(
                1,
                "Quel est le livre sacré des chrétiens ?",
                "la Bible (Ancien et Nouveau Testament)",
                "La Bible chrétienne réunit l'Ancien Testament et le Nouveau Testament.",
                ("le Coran", "l'Iliade", "le Code de Hammurabi"),
            ),
            _q(
                2,
                "Comment s'appellent les récits de la vie de Jésus ?",
                "les Évangiles",
                "Les quatre Évangiles racontent la vie et l'enseignement de Jésus.",
                ("la Torah", "l'Énéide", "les Fables"),
            ),
            _q(
                2,
                "Pourquoi les premiers chrétiens sont-ils persécutés ?",
                "ils refusent de rendre un culte à l'empereur",
                "Refuser le culte impérial passe pour une révolte contre Rome.",
                (
                    "ils ne parlent pas latin",
                    "ils refusent de payer le pain",
                    "ils veulent quitter l'empire",
                ),
            ),
            _q(
                3,
                "Que décide l'empereur Constantin par l'édit de Milan, en 313 ?",
                "il autorise le christianisme",
                "En 313, les chrétiens peuvent pratiquer librement leur religion.",
                ("il interdit le christianisme", "il fonde Rome", "il conquiert la Gaule"),
            ),
            _q(
                3,
                "Que décide l'empereur Théodose en 380 ?",
                "le christianisme devient la religion officielle de l'empire",
                "En 380, le christianisme devient religion d'État.",
                (
                    "il autorise le christianisme",
                    "il détruit le Temple de Jérusalem",
                    "il partage la Gaule",
                ),
            ),
            _q(
                3,
                "Qui est Paul de Tarse ?",
                "un apôtre qui a diffusé le christianisme dans l'empire",
                "Paul voyage en Méditerranée et écrit des lettres aux premières communautés chrétiennes.",
                ("un empereur romain", "un pharaon", "un poète grec"),
            ),
        ],
    ),
    Notion(
        "empire_romain.route_soie",
        "Rome et la Chine des Han",
        "Les Han gouvernent la Chine de 206 av. J.-C. à 220 ; la route de la soie relie la Chine à la Méditerranée.",
        [
            _q(
                1,
                "Quelle dynastie gouverne la Chine à l'époque de l'Empire romain ?",
                "les Han",
                "La dynastie des Han règne de 206 av. J.-C. à 220.",
                ("les Ming", "les Romains", "les pharaons"),
            ),
            _q(
                1,
                "Que relie la route de la soie ?",
                "la Chine et le monde méditerranéen",
                "Des caravanes font passer les marchandises de Chine jusqu'à l'Empire romain.",
                ("Rome et la Gaule", "l'Égypte et la Grèce", "l'Europe et l'Amérique"),
            ),
            _q(
                2,
                "Quel produit précieux venu de Chine les Romains recherchent-ils ?",
                "la soie",
                "La soie, tissu léger et brillant, est très chère à Rome.",
                ("le blé", "le vin", "l'huile d'olive"),
            ),
            _q(
                2,
                "Quand la dynastie des Han gouverne-t-elle la Chine ?",
                "de 206 av. J.-C. à 220 après J.-C.",
                "Les Han règnent plus de quatre siècles, comme les grandes heures de Rome.",
                ("de 753 à 509 av. J.-C.", "de 1368 à 1644", "de 476 à 1453"),
            ),
            _q(
                3,
                "Quelle invention chinoise de l'époque des Han sert à écrire ?",
                "le papier",
                "Le papier est mis au point en Chine sous les Han.",
                ("le papyrus", "le parchemin", "la tablette d'argile"),
            ),
            _q(
                3,
                "Pourquoi les Han renforcent-ils la Grande Muraille ?",
                "pour se protéger des peuples nomades du nord",
                "La muraille protège la Chine des cavaliers des steppes.",
                (
                    "pour arrêter les Romains",
                    "pour retenir les eaux du fleuve",
                    "pour décorer la capitale",
                ),
            ),
        ],
    ),
    Notion(
        "metropoles.habitants",
        "Les métropoles et leurs habitants",
        "Une métropole concentre habitants, richesses et pouvoirs ; elle s'étend sur sa périphérie.",
        [
            _q(
                1,
                "Qu'est-ce qu'une métropole ?",
                "une grande ville qui concentre population, richesses et pouvoirs",
                "Paris, Londres ou Tokyo commandent tout un territoire autour d'elles.",
                ("un petit village de campagne", "une région sans habitants", "un port de pêche"),
            ),
            Fact(
                1,
                "Comment appelle-t-on les communes autour de la ville-centre ?",
                "la banlieue",
                "La banlieue entoure la ville-centre et en dépend.",
                ("le centre-ville", "le désert", "le littoral"),
            ),
            _q(
                2,
                "Comment s'appelle le quartier des affaires, avec ses tours de bureaux ?",
                "le quartier des affaires (CBD)",
                "Le CBD (Central Business District) concentre bureaux, banques et sièges d'entreprises.",
                ("le bidonville", "la zone agricole", "la vieille ville médiévale"),
            ),
            Fact(
                2,
                "Comment appelle-t-on l'extension de la ville sur les campagnes ?",
                "l'étalement urbain",
                "Lotissements et zones commerciales grignotent les champs : c'est l'étalement urbain.",
                ("l'exode rural", "la littoralisation", "la déforestation"),
            ),
            Fact(
                2,
                "Comment appelle-t-on les trajets quotidiens entre domicile et travail ?",
                "les migrations pendulaires",
                "Comme un pendule, on fait l'aller-retour chaque jour.",
                ("les migrations internationales", "la transhumance", "le tourisme"),
            ),
            Fact(
                3,
                "Comment appelle-t-on une ville de plus de 10 millions d'habitants ?",
                "une mégapole",
                "Une mégapole est une agglomération géante, comme Tokyo ou Mumbai.",
                ("une mégalopole", "une métropole régionale", "un bourg"),
            ),
            Fact(
                3,
                "Comment appelle-t-on une chaîne de grandes villes reliées entre elles, comme de Boston à Washington ?",
                "une mégalopole",
                "La mégalopole relie plusieurs métropoles sur des centaines de kilomètres.",
                ("une mégapole", "un écoquartier", "une banlieue"),
            ),
            _q(
                3,
                "Comment appelle-t-on des quartiers pauvres aux habitations précaires ?",
                "des bidonvilles",
                "Faits de tôles et de planches, souvent sans eau ni électricité.",
                ("des écoquartiers", "des quartiers d'affaires", "des stations balnéaires"),
            ),
        ],
        writable=True,
    ),
    Notion(
        "metropoles.ville_demain",
        "La ville de demain",
        "Une ville durable limite la pollution, économise l'énergie et permet de bien vivre ensemble.",
        [
            _q(
                1,
                "Que cherche une ville durable ?",
                "limiter la pollution et bien vivre ensemble",
                "Une ville durable pense à l'environnement et à ses habitants, aujourd'hui et demain.",
                (
                    "construire le plus de tours possible",
                    "remplacer les parcs par des parkings",
                    "avoir le plus de voitures",
                ),
            ),
            _q(
                1,
                "Quel transport en commun pollue peu ?",
                "le tramway",
                "Le tramway, électrique, transporte beaucoup de monde en polluant peu.",
                ("la voiture individuelle", "l'avion", "le camion"),
            ),
            Fact(
                2,
                "Comment appelle-t-on un quartier conçu pour économiser l'énergie et respecter l'environnement ?",
                "un écoquartier",
                "Panneaux solaires, espaces verts, pistes cyclables : c'est un écoquartier.",
                ("un bidonville", "un quartier d'affaires", "une zone industrielle"),
            ),
            _q(
                2,
                "À quoi servent notamment les espaces verts en ville ?",
                "rafraîchir la ville et accueillir la nature",
                "Les arbres font de l'ombre et abritent oiseaux et insectes.",
                ("augmenter la pollution", "remplacer les écoles", "attirer les voitures"),
            ),
            _q(
                3,
                "Qu'utilise une « ville intelligente » (smart city) ?",
                "les technologies numériques pour mieux gérer la ville",
                "Capteurs et données aident à régler la circulation ou l'éclairage.",
                ("seulement des chevaux", "aucune électricité", "des murailles fortifiées"),
            ),
        ],
    ),
    Notion(
        "faible_densite.contraintes",
        "Espaces à fortes contraintes ou de grande biodiversité",
        "Faible densité : peu d'habitants au kilomètre carré. Contraintes : froid, chaleur, sécheresse, relief.",
        [
            _q(
                1,
                "Qu'est-ce qu'un espace de faible densité ?",
                "un espace où peu de personnes vivent au kilomètre carré",
                "On y compte peu d'habitants pour une grande surface.",
                (
                    "un espace où les maisons sont très hautes",
                    "une grande ville",
                    "un espace sans arbres",
                ),
            ),
            _q(
                1,
                "Quel est le plus grand désert chaud du monde ?",
                "le Sahara",
                "Le Sahara couvre une grande partie du nord de l'Afrique.",
                ("l'Amazonie", "la Bretagne", "la Sibérie"),
            ),
            _q(
                2,
                "Quelle grande forêt équatoriale est très riche en biodiversité ?",
                "l'Amazonie",
                "L'Amazonie abrite un très grand nombre d'espèces vivantes.",
                ("le Sahara", "la Beauce", "l'Antarctique"),
            ),
            _q(
                2,
                "Quelle est la principale contrainte d'un désert chaud ?",
                "la chaleur et le manque d'eau",
                "Sans eau, il est difficile de cultiver et de vivre.",
                ("le froid et la neige", "trop de forêts", "la pluie toute l'année"),
            ),
            Fact(
                2,
                "Comment appelle-t-on un lieu du désert où l'eau permet de cultiver ?",
                "une oasis",
                "Grâce à une source ou une nappe d'eau, on y cultive des palmiers-dattiers.",
                ("un iceberg", "un delta", "une métropole"),
            ),
            _q(
                3,
                "Quel peuple vit dans l'Arctique ?",
                "les Inuits",
                "Les Inuits vivent au Groenland, au Canada et en Alaska.",
                ("les Touaregs", "les Romains", "les Aztèques"),
            ),
            _q(
                3,
                "En quoi mesure-t-on la densité de population ?",
                "en habitants au kilomètre carré",
                "On divise le nombre d'habitants par la superficie en kilomètres carrés.",
                ("en kilomètres", "en degrés", "en litres"),
            ),
            Fact(
                3,
                "Comment appelle-t-on la diversité des êtres vivants d'un milieu ?",
                "la biodiversité",
                "« bio » : la vie. La biodiversité, c'est la variété des espèces.",
                ("la densité", "la littoralisation", "la mondialisation"),
            ),
        ],
    ),
    Notion(
        "faible_densite.agricole",
        "Espaces agricoles de faible densité",
        "Agriculture intensive : produire beaucoup avec machines et engrais. Vivrière : nourrir sa famille.",
        [
            _q(
                1,
                "Dans les Grandes Plaines des États-Unis, comment sont les exploitations agricoles ?",
                "immenses et très mécanisées",
                "Quelques agriculteurs cultivent d'immenses champs avec de grosses machines.",
                ("minuscules et cultivées à la main", "situées en pleine ville", "abandonnées"),
            ),
            Fact(
                2,
                "Comment s'appelle une agriculture qui produit beaucoup sur une surface donnée, grâce aux machines et aux engrais ?",
                "l'agriculture intensive",
                "Elle cherche les plus forts rendements possibles.",
                ("l'agriculture vivrière", "la cueillette", "la transhumance"),
            ),
            Fact(
                2,
                "Comment s'appelle une agriculture qui sert surtout à nourrir la famille de l'agriculteur ?",
                "l'agriculture vivrière",
                "Les récoltes sont d'abord consommées par la famille.",
                ("l'agriculture commerciale", "l'agriculture intensive", "l'industrie"),
            ),
            Fact(
                3,
                "Comment s'appelle une agriculture qui vend sa production sur les marchés, parfois lointains ?",
                "l'agriculture commerciale",
                "Elle produit pour vendre, souvent à l'exportation.",
                ("l'agriculture vivrière", "la chasse", "la pêche"),
            ),
            Fact(
                3,
                "Comment appelle-t-on le déplacement des troupeaux vers les montagnes l'été ?",
                "la transhumance",
                "Les bergers mènent les bêtes vers les alpages l'été, puis redescendent l'hiver.",
                ("l'exode rural", "la migration pendulaire", "la littoralisation"),
            ),
        ],
        writable=True,
    ),
    Notion(
        "littoraux.industrialo_portuaire",
        "Littoral industrialo-portuaire",
        "Une zone industrialo-portuaire réunit un port et des usines ; les marchandises voyagent en conteneurs.",
        [
            _q(
                1,
                "Qu'est-ce qu'un littoral ?",
                "la zone de contact entre la terre et la mer",
                "Le littoral, c'est le bord de mer et ses alentours.",
                ("le sommet d'une montagne", "le centre d'un continent", "le lit d'un fleuve"),
            ),
            _q(
                1,
                "Quel est le plus grand port d'Europe ?",
                "Rotterdam",
                "Rotterdam, aux Pays-Bas, est le premier port européen.",
                ("Marseille", "Le Havre", "Barcelone"),
            ),
            _q(
                2,
                "Qu'associe une zone industrialo-portuaire (ZIP) ?",
                "un port et des industries",
                "Les usines s'installent près des quais pour recevoir et expédier par la mer.",
                (
                    "une plage et des hôtels",
                    "une forêt et des scieries",
                    "un aéroport et des musées",
                ),
            ),
            Fact(
                2,
                "Comment s'appellent les grandes boîtes métalliques qui transportent les marchandises sur les navires ?",
                "les conteneurs",
                "Le conteneur se charge du bateau au camion ou au train sans être ouvert.",
                ("les tonneaux", "les palettes", "les wagons"),
            ),
            _q(
                3,
                "Quel est le premier port du monde pour les conteneurs ?",
                "Shanghai",
                "Shanghai, en Chine, est le premier port à conteneurs du monde.",
                ("Rotterdam", "New York", "Marseille"),
            ),
            Fact(
                3,
                "Comment appelle-t-on la concentration des hommes et des activités sur les littoraux ?",
                "la littoralisation",
                "De plus en plus d'habitants et d'activités s'installent près des côtes.",
                ("l'étalement urbain", "la romanisation", "la déforestation"),
            ),
        ],
        writable=True,
    ),
    Notion(
        "littoraux.touristique",
        "Littoral touristique",
        "Le tourisme fait vivre les côtes mais les abîme : constructions, foule l'été, pollution.",
        [
            _q(
                1,
                "Qui accueille un littoral touristique ?",
                "des vacanciers venus pour la mer et le soleil",
                "Plages, hôtels et campings accueillent les touristes.",
                ("seulement des pêcheurs", "des usines", "des agriculteurs"),
            ),
            Fact(
                1,
                "Comment appelle-t-on une ville du bord de mer qui vit du tourisme ?",
                "une station balnéaire",
                "Nice, La Baule ou Biarritz sont des stations balnéaires.",
                ("une métropole", "une oasis", "une zone industrialo-portuaire"),
            ),
            _q(
                2,
                "Quel problème le tourisme pose-t-il sur le littoral ?",
                "la bétonisation des côtes et la pollution",
                "Hôtels et routes couvrent la côte ; la foule produit déchets et pollution.",
                (
                    "le manque de visiteurs",
                    "la neige",
                    "la disparition des plages de sable par le froid",
                ),
            ),
            _q(
                2,
                "Que fait la loi Littoral, votée en France en 1986 ?",
                "elle protège les côtes de la construction",
                "Elle limite les constructions au bord de la mer.",
                (
                    "elle interdit la baignade",
                    "elle oblige à construire des ports",
                    "elle supprime le tourisme",
                ),
            ),
            _q(
                3,
                "Que fait le Conservatoire du littoral ?",
                "il achète des terrains pour les protéger",
                "Créé en 1975, il rachète des espaces naturels de bord de mer pour les préserver.",
                ("il construit des hôtels", "il organise des croisières", "il pêche les poissons"),
            ),
            _q(
                3,
                "Qu'est-ce que la saisonnalité sur un littoral touristique ?",
                "la population augmente beaucoup l'été",
                "Certaines stations voient leur population multipliée en été.",
                (
                    "il pleut toute l'année",
                    "les habitants partent pour toujours",
                    "la mer monte chaque saison",
                ),
            ),
        ],
    ),
    Notion(
        "monde_habite.repartition",
        "La répartition de la population mondiale",
        "Environ 8 milliards d'humains, très inégalement répartis : Asie de l'Est, Asie du Sud et Europe concentrent les foyers.",
        [
            _q(
                1,
                "Combien d'humains vivent sur Terre aujourd'hui ?",
                "environ 8 milliards",
                "La population mondiale a dépassé 8 milliards en 2022.",
                ("environ 800 millions", "environ 80 milliards", "environ 2 milliards"),
            ),
            _q(
                1,
                "Quel est le continent le plus peuplé ?",
                "l'Asie",
                "Près de 6 humains sur 10 vivent en Asie.",
                ("l'Europe", "l'Afrique", "l'Océanie"),
            ),
            _q(
                2,
                "Quels sont les trois grands foyers de peuplement du monde ?",
                "l'Asie de l'Est, l'Asie du Sud et l'Europe",
                "Ces trois régions rassemblent une grande partie de l'humanité.",
                (
                    "le Sahara, l'Amazonie et la Sibérie",
                    "l'Australie, le Groenland et l'Antarctique",
                    "l'Alaska, le Canada et l'Islande",
                ),
            ),
            _q(
                2,
                "Quel est le pays le plus peuplé du monde depuis 2023 ?",
                "l'Inde",
                "L'Inde a dépassé la Chine en 2023, selon les Nations unies.",
                ("la Chine", "les États-Unis", "la Russie"),
            ),
            _q(
                3,
                "Où se trouvent les grands vides humains ?",
                "dans les déserts chauds et froids, les grandes forêts et les hautes montagnes",
                "Ce sont des milieux aux fortes contraintes naturelles.",
                (
                    "dans les grandes plaines tempérées",
                    "au bord des grands fleuves d'Asie",
                    "dans les métropoles",
                ),
            ),
            _q(
                3,
                "Où vit aujourd'hui la majorité des humains ?",
                "en ville",
                "Depuis 2007, plus de la moitié de l'humanité vit en ville.",
                ("à la campagne", "dans le désert", "en montagne"),
            ),
            Fact(
                3,
                "Comment appelle-t-on une région où la population est très concentrée ?",
                "un foyer de peuplement",
                "Un foyer de peuplement est une zone de fortes densités.",
                ("un désert humain", "une oasis", "un littoral touristique"),
            ),
        ],
    ),
    Notion(
        "monde_habite.occupation",
        "Les formes d'occupation de l'espace",
        "Urbain : les villes. Rural : les campagnes. Périurbain : les communes autour des villes.",
        [
            _q(
                1,
                "Qu'est-ce qu'un espace rural ?",
                "un espace de campagne, aux paysages agricoles et naturels",
                "Champs, forêts et villages forment l'espace rural.",
                ("un espace de grandes villes", "le centre d'une métropole", "un port"),
            ),
            _q(
                1,
                "Qu'est-ce qu'un espace urbain ?",
                "un espace de villes",
                "« urbain » vient du latin « urbs », la ville.",
                ("un espace de champs", "un désert", "une forêt"),
            ),
            _q(
                2,
                "Qu'est-ce qu'un espace périurbain ?",
                "les communes autour des villes, où vivent des habitants qui travaillent en ville",
                "Maisons individuelles et lotissements entourent les villes.",
                ("le centre historique d'une ville", "une île déserte", "le sommet des montagnes"),
            ),
            Fact(
                3,
                "Comment appelle-t-on le départ des habitants des campagnes vers les villes ?",
                "l'exode rural",
                "Partout dans le monde, les campagnes se vident au profit des villes.",
                ("l'étalement urbain", "la transhumance", "la migration pendulaire"),
            ),
            _q(
                3,
                "Pourquoi les humains se concentrent-ils souvent près des fleuves et des côtes ?",
                "pour l'eau, les terres fertiles et les échanges",
                "Les fleuves et les côtes offrent de l'eau, des sols riches et des voies de transport.",
                (
                    "parce qu'il y fait toujours froid",
                    "parce qu'il n'y a pas d'eau",
                    "pour être loin des autres",
                ),
            ),
        ],
    ),
]

GENERATORS = register_notions(LEVEL, SUBJECT, NOTIONS)


# --- Siècles ------------------------------------------------------------------------------------

_ROMAN = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def roman(n: int) -> str:
    out = ""
    for value, letters in _ROMAN:
        while n >= value:
            out += letters
            n -= value
    return out


def century(year: int) -> tuple[int, bool]:
    """Siècle d'une année (négative avant J.-C., jamais 0) : (numéro, avant J.-C.)."""
    return (abs(year) - 1) // 100 + 1, year < 0


def century_label(n: int, before: bool) -> str:
    return f"{roman(n)}{'er' if n == 1 else 'e'} siècle{' av. J.-C.' if before else ''}"


def year_label(year: int) -> str:
    return f"{-year} av. J.-C." if year < 0 else f"{year} après J.-C."


def _siecles(difficulty: int, rng: random.Random) -> dict[str, Any]:
    # 1 : après J.-C. ; 2 : avant J.-C. ; 3 : années « rondes » (fin de siècle) ; 4-5 : tout.
    if difficulty == 1:
        year = rng.randint(101, 2026)
    elif difficulty == 2:
        year = -rng.randint(101, 3500)
    elif difficulty == 3:
        year = rng.choice([rng.randint(1, 20) * 100, -rng.randint(1, 30) * 100])
    else:
        year = rng.choice([rng.randint(1, 2026), -rng.randint(1, 3500), -rng.randint(1, 30) * 100])
    n, before = century(year)
    answer = century_label(n, before)
    wrong = {century_label(n + 1, before), century_label(n, not before)}
    if n > 1:
        wrong.add(century_label(n - 1, before))
    if difficulty >= 4:
        wrong.add(century_label(n + 1, not before))
    choices = rng.sample(sorted(wrong), min(3, len(wrong))) + [answer]
    rng.shuffle(choices)
    hundreds = (abs(year) - 1) // 100
    return {
        "type": "mcq",
        "prompt": f"En quel siècle se situe l'année {year_label(year)} ?",
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(answer)},
        "hint": "Du 1er au 100 : le Ier siècle ; du 101 au 200 : le IIe siècle. Avant J.-C., on compte de la même façon en remontant le temps.",
        "explanation": f"{year_label(year)} : on prend le nombre de centaines complètes ({hundreds}) et on ajoute 1. C'est le {answer}.",
        "time_target_ms": 20000 + 4000 * difficulty,
        "meta": {"year": year, "century": n, "before": before},
    }


SIECLES = register(
    Generator(
        code="6e.histoire_geo.siecles",
        level=LEVEL,
        notion="6e.histoire_geo.reperes.siecles",
        role="chapitre",
        title="Le siècle d'une date",
        generate=_siecles,
    )
)


# --- Frise chronologique ------------------------------------------------------------------------

# (année, événement, date telle qu'on l'écrit) ; « vers » pour les dates approximatives.
EVENTS = [
    (-300000, "Apparition d'Homo sapiens en Afrique", "il y a environ 300 000 ans"),
    (-10000, "Débuts de l'agriculture au Proche-Orient", "vers 10 000 av. J.-C."),
    (-3300, "Invention de l'écriture en Mésopotamie", "vers 3300 av. J.-C."),
    (-2560, "Construction de la pyramide de Khéops", "vers 2560 av. J.-C."),
    (-1750, "Code de Hammurabi à Babylone", "vers 1750 av. J.-C."),
    (-776, "Premiers Jeux olympiques", "776 av. J.-C."),
    (-753, "Fondation légendaire de Rome", "753 av. J.-C."),
    (-508, "Naissance de la démocratie à Athènes", "508 av. J.-C."),
    (-206, "Début de la dynastie des Han en Chine", "206 av. J.-C."),
    (-52, "Bataille d'Alésia", "52 av. J.-C."),
    (-27, "Auguste, premier empereur romain", "27 av. J.-C."),
    (70, "Destruction du Temple de Jérusalem", "70 après J.-C."),
    (212, "Édit de Caracalla : tous les hommes libres deviennent citoyens", "212 après J.-C."),
    (313, "Édit de Milan : le christianisme est autorisé", "313 après J.-C."),
    (380, "Le christianisme devient religion officielle", "380 après J.-C."),
    (476, "Fin de l'Empire romain d'Occident", "476 après J.-C."),
]
# Difficulté → (nombre d'événements, écart minimal entre deux événements, en années).
FRISE = {1: (3, 1000), 2: (3, 200), 3: (4, 100), 4: (4, 25), 5: (5, 20)}


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
        "prompt": "Dame Sablière a mélangé la frise du temps ! Remets ces événements dans l'ordre, du plus ancien au plus récent.",
        "choices": [picked[i][1] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "Avant J.-C., plus le nombre est grand, plus c'est ancien.",
        "explanation": "Dans l'ordre : "
        + " ; ".join(f"{label} ({date})" for _y, label, date in picked)
        + ".",
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"years": [y for y, _l, _d in picked]},
    }


FRISE_GEN = register(
    Generator(
        code="6e.histoire_geo.frise",
        level=LEVEL,
        notion="6e.histoire_geo.reperes.frise",
        role="chapitre",
        title="La frise du temps",
        generate=_frise,
    )
)


# --- Pays les plus peuplés ----------------------------------------------------------------------

# Population en millions (Nations unies, World Population Prospects 2024, valeurs 2024 arrondies).
# Choisis pour des écarts nets : l'ordre ne bascule pas d'une année sur l'autre.
COUNTRIES = [
    ("l'Inde", 1451),
    ("la Chine", 1419),
    ("les États-Unis", 345),
    ("l'Indonésie", 283),
    ("le Brésil", 212),
    ("la Russie", 144),
    ("le Japon", 124),
    ("l'Allemagne", 84),
    ("la France", 66),
    ("le Canada", 40),
    ("l'Australie", 27),
]
POPULATION = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _population(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = POPULATION[difficulty]
    while True:
        picked = sorted(rng.sample(COUNTRIES, count), key=lambda c: -c[1])
        # Facile : pas de voisins trop proches (Inde et Chine ensemble seulement à la fin).
        close = any(a[1] / b[1] < 1.15 for a, b in zip(picked, picked[1:], strict=False))
        if difficulty >= 4 or not close:
            break
    shown = list(range(count))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": "Le Brouille-Cartes a mélangé l'atlas ! Classe ces pays du plus peuplé au moins peuplé.",
        "choices": [picked[i][0] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "L'Inde et la Chine dépassent chacune 1,4 milliard d'habitants ; la France en compte environ 66 millions.",
        "explanation": "Du plus peuplé au moins peuplé : "
        + " ; ".join(f"{name} (environ {_people(m)})" for name, m in picked)
        + ".",
        "time_target_ms": 25000 + 5000 * difficulty,
        "meta": {"millions": [m for _n, m in picked]},
    }


def _people(millions: int) -> str:
    if millions >= 1000:
        return f"{millions / 1000:.1f} milliard".replace(".", ",") + "s"
    return f"{millions} millions"


POPULATION_GEN = register(
    Generator(
        code="6e.histoire_geo.population",
        level=LEVEL,
        notion="6e.histoire_geo.monde_habite.repartition",
        role="chapitre",
        title="Les pays les plus peuplés",
        generate=_population,
    )
)
