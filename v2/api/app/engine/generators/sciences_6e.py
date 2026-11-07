"""Sciences et technologie, 6e (programme du cycle 3, BO n° 25 du 22 juin 2023, en vigueur en 6e en
2026-2027) : exemples relus, plus des générateurs calculés.

- `6e.sciences.masse_volume` : conversions de masse et de volume, proportionnalité masse-volume ;
- `6e.sciences.vitesse` : vitesse d'un mouvement uniforme (distance ÷ durée), seul calcul exigible
  en 6e ;
- `6e.sciences.course` : classer des mobiles du plus lent au plus rapide (énigme de la Tour des
  Expériences : il faut calculer chaque vitesse) ;
- `6e.sciences.frise_vivant` : ordonner de grands moments de l'histoire de la vie (énigme de la
  Maison du Naturaliste) ;
- `6e.sciences.chaine` : remettre une chaîne alimentaire dans l'ordre (« est mangé par »).

Températures écrites en toutes lettres (« 100 degrés ») ; unités abrégées lues par engine/speech.py.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions
from app.engine.generators.formatting import fr_number

LEVEL, SUBJECT = "6e", "sciences"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    return Fact(level, prompt, answer, why, wrong)


NOTIONS = [
    # --- La matière -----------------------------------------------------------------------------
    Notion(
        "matiere.etats",
        "États de la matière",
        "Solide : forme et volume propres. Liquide : volume propre, pas de forme propre. "
        "Gaz : ni forme ni volume propres.",
        [
            _q(1, "Dans quel état la matière a-t-elle une forme propre et un volume propre ?",
               "solide", "Un caillou garde sa forme et son volume.", ("liquide", "gazeux", "aucun")),
            _q(1, "Comment s'appelle le passage de l'état liquide à l'état solide ?",
               "la solidification", "L'eau qui gèle se solidifie.",
               ("la fusion", "la vaporisation", "la condensation")),
            _q(1, "Comment s'appelle le passage de l'état solide à l'état liquide ?", "la fusion",
               "Le glaçon qui fond passe de l'état solide à l'état liquide.",
               ("la solidification", "la condensation", "l'évaporation")),
            _q(1, "À quelle température l'eau pure gèle-t-elle, à la pression habituelle ?",
               "0 degré", "L'eau pure se solidifie à 0 degré Celsius.",
               ("10 degrés", "100 degrés", "moins 50 degrés")),
            _q(2, "Un gaz a-t-il une forme propre et un volume propre ?",
               "Non : il occupe tout l'espace disponible.",
               "L'air d'un ballon prend la forme et le volume du ballon.",
               ("Oui, les deux.", "Il a seulement une forme propre.",
                "Il a seulement un volume propre.")),
            _q(2, "Comment s'appelle le passage de l'état liquide à l'état gazeux ?",
               "la vaporisation", "L'ébullition et l'évaporation sont deux vaporisations.",
               ("la condensation", "la fusion", "la solidification")),
            _q(2, "D'où vient la buée sur une vitre froide ?",
               "de la vapeur d'eau de l'air qui se condense",
               "Au contact du froid, la vapeur d'eau (gaz) redevient liquide.",
               ("de la pluie qui traverse la vitre", "du verre qui fond", "de la glace qui fond")),
            _q(2, "À quelle température l'eau pure bout-elle, au niveau de la mer ?", "100 degrés",
               "L'eau pure bout à 100 degrés Celsius à la pression habituelle.",
               ("0 degré", "50 degrés", "37 degrés")),
            _q(3, "Que fait la température de l'eau pendant qu'elle bout ?",
               "Elle reste constante : c'est un palier.",
               "Tant que l'eau bout, sa température ne monte plus.",
               ("Elle monte sans cesse.", "Elle baisse.", "Elle double chaque minute.")),
            _q(3, "Les changements d'état sont-ils réversibles ?",
               "Oui : l'eau d'un glaçon fondu peut geler de nouveau.",
               "On peut passer d'un état à l'autre dans les deux sens.",
               ("Non, jamais.", "Seulement pour les métaux.", "Seulement en été.")),
            _q(3, "Que devient la masse d'un glaçon quand il fond ?", "Elle reste la même.",
               "Lors d'un changement d'état, la matière ne disparaît pas : la masse se conserve.",
               ("Elle augmente.", "Elle diminue.", "Elle devient nulle.")),
            _q(3, "Sous quels états trouve-t-on l'eau dans la nature ?",
               "solide, liquide et gazeux", "Glace et neige, mers et pluie, vapeur d'eau.",
               ("seulement liquide", "liquide et solide seulement", "seulement gazeux")),
        ],
    ),
    Notion(
        "matiere.materiaux",
        "Propriétés des matériaux",
        "On trie les matériaux selon leurs propriétés : conduire l'électricité ou la chaleur, être "
        "attiré par un aimant, se décomposer plus ou moins vite.",
        [
            _q(1, "Lequel de ces matériaux est attiré par un aimant ?", "le fer",
               "Le fer et l'acier sont attirés par un aimant.",
               ("le bois", "le verre", "le plastique")),
            _q(1, "Lequel de ces matériaux conduit l'électricité ?", "le cuivre",
               "Les fils électriques sont en cuivre.", ("le bois", "le plastique", "le verre")),
            _q(1, "Lequel de ces matériaux est directement disponible dans la nature ?", "le bois",
               "Le bois vient des arbres ; les autres sont fabriqués par l'être humain.",
               ("le plastique", "le verre", "l'acier")),
            _q(1, "Lequel de ces matériaux est un bon isolant thermique ?", "la laine",
               "La laine garde la chaleur : elle conduit mal la chaleur.",
               ("le cuivre", "l'aluminium", "le fer")),
            _q(2, "Lequel de ces déchets met le plus de temps à se décomposer dans la nature ?",
               "une bouteille en verre", "Le verre peut rester des milliers d'années.",
               ("un mouchoir en papier", "une peau de banane", "un carton")),
            _q(2, "Pourquoi trie-t-on les déchets ?",
               "pour recycler les matériaux et protéger l'environnement",
               "Chaque matériau trié peut être réutilisé.",
               ("pour les brûler tous ensemble", "pour remplir les poubelles plus vite",
                "pour les rendre plus lourds")),
            _q(2, "Pourquoi les poignées de casserole sont-elles souvent en bois ou en plastique ?",
               "Ce sont des isolants thermiques : on ne se brûle pas.",
               "Ils conduisent mal la chaleur du métal chauffé.",
               ("Ils sont attirés par un aimant.", "Ils conduisent bien la chaleur.",
                "Ils fondent à basse température.")),
            _q(2, "Lequel de ces métaux n'est pas attiré par un aimant ?", "l'aluminium",
               "Les canettes en aluminium ne sont pas attirées par un aimant.",
               ("le fer", "l'acier", "le nickel")),
            _q(3, "Comment séparer les boîtes en acier des canettes en aluminium dans un centre "
               "de tri ?", "avec un gros aimant : seul l'acier est attiré",
               "On utilise une propriété physique : l'attraction par un aimant.",
               ("en les lavant", "en les pesant une par une", "en les chauffant")),
            _q(3, "À partir de quoi fabrique-t-on la plupart des plastiques ?", "du pétrole",
               "Le pétrole est une ressource non renouvelable.", ("du sable", "du bois", "du fer")),
            _q(3, "À partir de quoi fabrique-t-on principalement le verre ?", "du sable",
               "Le sable est fondu à très haute température.", ("du pétrole", "du bois", "du sel")),
            _q(3, "Combien de temps un sac en plastique met-il environ à se décomposer ?",
               "plusieurs centaines d'années", "D'où l'importance de réduire les plastiques.",
               ("quelques jours", "un mois", "un an")),
        ],
    ),
    Notion(
        "matiere.melanges",
        "Mélanges et transformations",
        "On sépare un mélange par tamisage, décantation, filtration ou évaporation. Une "
        "transformation chimique fait apparaître de nouvelles substances.",
        [
            _q(1, "Comment séparer le sable de l'eau dans un mélange ?", "par filtration",
               "Le filtre retient le sable et laisse passer l'eau.",
               ("avec un aimant", "en ajoutant du sucre", "en secouant le mélange")),
            _q(1, "Le sel est dissous dans l'eau. Comment le récupérer ?",
               "en faisant évaporer l'eau", "C'est ainsi qu'on récolte le sel dans les marais "
               "salants.", ("par filtration", "avec un aimant", "en ajoutant de l'eau")),
            _q(1, "On dissout 10 g de sucre dans 100 g d'eau. Quelle est la masse du mélange ?",
               "110 g", "La masse se conserve : 100 g + 10 g = 110 g.", ("100 g", "10 g", "90 g")),
            _q(1, "Comment appelle-t-on deux liquides qui ne se mélangent pas, comme l'huile et "
               "l'eau ?", "non miscibles", "Ils forment deux couches séparées.",
               ("solubles", "dissous", "gazeux")),
            _q(2, "On verse de l'huile et de l'eau dans un verre. Quelle couche est au-dessus ?",
               "l'huile", "Pour un même volume, l'huile est moins lourde que l'eau.",
               ("l'eau", "elles se mélangent", "aucune, elles disparaissent")),
            _q(2, "Qu'est-ce qu'une solution saturée ?",
               "une eau où le sel ne se dissout plus : il reste au fond",
               "Au-delà d'une certaine quantité, le solide ne se dissout plus.",
               ("une eau très froide", "une eau sans sel", "une eau gazeuse")),
            _q(2, "De quoi l'air est-il surtout composé ?",
               "de diazote (environ 78 %) et de dioxygène (environ 21 %)",
               "Le reste est fait d'autres gaz, dont le dioxyde de carbone.",
               ("de dioxygène seulement", "de vapeur d'eau surtout", "de dioxyde de carbone surtout")),
            _q(2, "Quel gaz présent dans l'air contribue à l'effet de serre ?",
               "le dioxyde de carbone", "Ses rejets par les activités humaines réchauffent le "
               "climat.", ("le diazote", "le dioxygène", "l'argon")),
            _q(3, "On mélange du vinaigre et du bicarbonate : des bulles apparaissent. Que se "
               "passe-t-il ?", "une transformation chimique : un gaz se forme",
               "De nouvelles substances apparaissent, dont un gaz (le dioxyde de carbone).",
               ("un changement d'état", "une simple dissolution", "une filtration")),
            _q(3, "Que signifie le pictogramme de danger qui montre une flamme ?",
               "produit inflammable", "Il peut prendre feu facilement.",
               ("produit corrosif", "produit dangereux pour l'environnement",
                "produit sans danger")),
            _q(3, "Que signifie le pictogramme de danger qui montre une tête de mort ?",
               "produit toxique", "Il peut empoisonner, même en petite quantité.",
               ("produit inflammable", "produit recyclable", "produit corrosif")),
            _q(3, "Avec quoi sépare-t-on deux liquides non miscibles, comme l'huile et l'eau ?",
               "une ampoule à décanter", "On laisse couler le liquide du dessous, puis on ferme.",
               ("un aimant", "un filtre à café", "un thermomètre")),
        ],
    ),
    # --- Mouvement, énergie, électricité, signaux ---------------------------------------------
    Notion(
        "mouvement_energie.terre_soleil",
        "La Terre, le Soleil, les jours et les saisons",
        "Rotation de la Terre sur elle-même en environ 24 heures : jour et nuit. Révolution autour "
        "du Soleil en environ 365 jours : une année. Un mouvement se décrit « par rapport à » un "
        "repère.",
        [
            _q(1, "En combien de temps environ la Terre fait-elle un tour sur elle-même ?",
               "24 heures", "Ce tour sur elle-même donne la durée d'un jour.",
               ("1 heure", "7 jours", "365 jours")),
            _q(1, "En combien de temps environ la Terre fait-elle le tour du Soleil ?",
               "365 jours", "Ce tour du Soleil donne la durée d'une année.",
               ("24 heures", "30 jours", "100 ans")),
            _q(1, "Pourquoi y a-t-il le jour et la nuit ?",
               "La Terre tourne sur elle-même : une moitié est éclairée par le Soleil.",
               "Il fait nuit sur la moitié de la Terre tournée à l'opposé du Soleil.",
               ("Le Soleil s'éteint le soir.", "La Lune cache le Soleil chaque nuit.",
                "Les nuages arrêtent la lumière.")),
            _q(1, "De quel côté le Soleil semble-t-il se lever ?", "à l'est",
               "Il se lève à l'est et se couche à l'ouest.", ("à l'ouest", "au nord", "au sud")),
            _q(2, "Comment s'appelle le mouvement de la Terre autour du Soleil ?", "la révolution",
               "Une révolution complète dure une année.",
               ("la rotation", "une éclipse", "une marée")),
            _q(2, "Comment s'appelle le mouvement de la Terre sur elle-même ?", "la rotation",
               "Elle tourne autour de l'axe des pôles.",
               ("la révolution", "une éclipse", "une saison")),
            _q(2, "Vu depuis la cour de récréation, quel mouvement le Soleil semble-t-il faire "
               "dans la journée ?", "une courbe dans le ciel",
               "Il monte puis redescend : du point de vue de la cour, il décrit une courbe.",
               ("une ligne droite verticale", "un cercle complet", "il reste immobile")),
            _q(2, "Un passager est assis dans un train qui roule. Est-il en mouvement ?",
               "Oui par rapport au quai, non par rapport à son siège.",
               "Un mouvement se décrit toujours par rapport à un repère.",
               ("Non, jamais.", "Oui, par rapport à tout.", "Seulement si le train freine.")),
            _q(3, "Pourquoi fait-il plus chaud en été, en France ?",
               "Le Soleil monte plus haut dans le ciel et les jours sont plus longs.",
               "Les rayons arrivent plus droit et chauffent plus longtemps.",
               ("La Terre est plus proche du Soleil.", "Le Soleil brille plus fort en été.",
                "La Lune nous cache moins le Soleil.")),
            _q(3, "En hiver, en France, comment sont les jours par rapport aux nuits ?",
               "plus courts", "Le Soleil reste moins longtemps au-dessus de l'horizon.",
               ("plus longs", "égaux", "il n'y a plus de jour")),
            _q(3, "Qu'est-ce qui explique l'alternance des saisons ?",
               "l'inclinaison de l'axe de la Terre pendant sa révolution autour du Soleil",
               "Selon la saison, le Soleil monte plus ou moins haut dans le ciel.",
               ("la distance qui change beaucoup entre la Terre et le Soleil", "les phases de la "
                "Lune", "la rotation de la Terre en 24 heures")),
            _q(3, "Comment appelle-t-on un mouvement dont la vitesse ne change pas ?",
               "un mouvement uniforme", "La distance parcourue chaque seconde reste la même.",
               ("un mouvement accéléré", "un mouvement ralenti", "un mouvement circulaire")),
        ],
    ),
    Notion(
        "mouvement_energie.energie",
        "Formes et ressources d'énergie",
        "Énergies de pesanteur, cinétique (mouvement), chimique, thermique, électrique, nucléaire, "
        "lumineuse. Un appareil convertit une forme d'énergie en une autre.",
        [
            _q(1, "Laquelle de ces ressources est renouvelable ?", "le vent",
               "Le vent ne s'épuise pas à l'échelle d'une vie humaine.",
               ("le pétrole", "le charbon", "le gaz naturel")),
            _q(1, "D'où vient l'énergie qui permet la vie sur Terre ?", "du Soleil",
               "La Terre reçoit l'énergie du Soleil par sa lumière.",
               ("de la Lune", "des volcans seulement", "du vent seulement")),
            _q(1, "Une éolienne transforme l'énergie du vent en énergie…", "électrique",
               "Le vent fait tourner les pales, qui entraînent un générateur.",
               ("chimique", "nucléaire", "de pesanteur")),
            _q(1, "Comment s'appelle l'énergie d'un objet en mouvement ?", "l'énergie cinétique",
               "« Cinétique » vient du grec « kinêsis », le mouvement.",
               ("l'énergie de pesanteur", "l'énergie nucléaire", "l'énergie lumineuse")),
            _q(2, "Une lampe allumée transforme l'énergie électrique en énergie…",
               "lumineuse et thermique", "Elle éclaire et elle chauffe un peu.",
               ("chimique", "nucléaire", "de pesanteur")),
            _q(2, "Quand un objet tombe, son énergie de pesanteur est convertie en énergie…",
               "cinétique", "En tombant, il va de plus en plus vite.",
               ("électrique", "chimique", "nucléaire")),
            _q(2, "Dans une voiture à essence, quelle énergie est convertie en mouvement ?",
               "l'énergie chimique du carburant", "Le moteur brûle l'essence pour faire avancer la "
               "voiture.", ("l'énergie nucléaire", "l'énergie lumineuse",
                            "l'énergie de pesanteur")),
            _q(2, "Laquelle de ces ressources n'est pas renouvelable à l'échelle d'une vie "
               "humaine ?", "le charbon", "Il a mis des millions d'années à se former.",
               ("le Soleil", "le vent", "l'eau des rivières")),
            _q(3, "Que transforme une centrale hydroélectrique ?",
               "l'énergie de l'eau qui descend d'un barrage en énergie électrique",
               "L'eau qui tombe fait tourner une turbine reliée à un alternateur.",
               ("le charbon en électricité", "le vent en lumière", "l'uranium en chaleur")),
            _q(3, "Quel combustible utilise une centrale nucléaire ?", "l'uranium",
               "L'uranium est une ressource non renouvelable.",
               ("le charbon", "le bois", "le dihydrogène")),
            _q(3, "Quelle conséquence a l'usage des énergies fossiles sur l'environnement ?",
               "Il rejette des gaz à effet de serre.",
               "Pétrole, gaz et charbon libèrent du dioxyde de carbone en brûlant.",
               ("Il refroidit la planète.", "Il n'a aucune conséquence.",
                "Il crée de nouvelles forêts.")),
            _q(3, "Comment représente-t-on les conversions d'énergie d'un appareil ?",
               "par une chaîne énergétique", "Des cases et des flèches montrent les formes "
               "d'énergie qui entrent et qui sortent.", ("par une chaîne alimentaire",
                                                         "par une frise chronologique",
                                                         "par une carte")),
        ],
    ),
    Notion(
        "mouvement_energie.electricite",
        "Circuits électriques",
        "Une lampe brille si le circuit est fermé, avec un générateur (la pile). Les métaux "
        "conduisent l'électricité ; plastique et bois sont des isolants.",
        [
            _q(1, "Que faut-il pour qu'une lampe s'allume ?",
               "un circuit fermé avec une pile", "Le courant doit pouvoir circuler sans "
               "interruption.", ("une pile seule", "une lampe et un interrupteur ouvert",
                                 "un fil coupé")),
            _q(1, "Dans un circuit simple, quel composant fournit l'énergie électrique ?",
               "la pile", "La pile est le générateur du circuit.",
               ("la lampe", "l'interrupteur", "le fil")),
            _q(1, "Que fait un interrupteur ouvert ?", "il coupe le courant",
               "Le circuit est ouvert : la lampe s'éteint.",
               ("il allume la lampe", "il recharge la pile", "il produit de l'électricité")),
            _q(1, "Pourquoi ne faut-il jamais toucher un appareil électrique avec les mains "
               "mouillées ?", "L'eau conduit l'électricité : on risque l'électrocution.",
               "L'électricité du secteur est très dangereuse.",
               ("L'appareil va rouiller.", "L'eau éteint l'électricité.", "Il n'y a aucun risque.")),
            _q(2, "Dans un circuit à une boucle, peut-on échanger la place de la lampe et de "
               "l'interrupteur ?", "Oui : la lampe s'allume toujours quand on ferme "
               "l'interrupteur.", "Dans une boucle, l'ordre des composants ne change rien.",
               ("Non, la lampe ne s'allumera plus.", "Oui, mais la pile s'use deux fois plus vite.",
                "Non, la lampe va exploser.")),
            _q(2, "Lequel de ces matériaux est un isolant électrique ?", "le plastique",
               "Il entoure les fils pour qu'on ne touche pas le métal.",
               ("le cuivre", "le fer", "l'aluminium")),
            _q(2, "Que transforme un moteur électrique ?",
               "l'énergie électrique en mouvement", "C'est un convertisseur d'énergie.",
               ("la lumière en électricité", "le mouvement en chaleur seulement",
                "le son en électricité")),
            _q(2, "Que fait un panneau photovoltaïque ?",
               "il transforme la lumière en électricité", "On l'appelle aussi panneau solaire.",
               ("il chauffe l'eau avec du gaz", "il stocke l'eau de pluie", "il produit du vent")),
            _q(3, "Le courant s'use-t-il en traversant la lampe ?",
               "Non : dans une boucle, le courant est le même partout.",
               "C'est l'énergie de la pile qui s'épuise peu à peu, pas le courant.",
               ("Oui, il n'en reste plus après la lampe.", "Oui, il diminue de moitié.",
                "Il double après la lampe.")),
            _q(3, "Qu'est-ce qu'un capteur dans un circuit ?",
               "un composant qui détecte quelque chose (lumière, température, mouvement)",
               "Le capteur transmet une information au circuit.",
               ("une pile de secours", "un fil plus épais", "une lampe plus puissante")),
            _q(3, "Comment représente-t-on un circuit électrique pour qu'on le comprenne partout ?",
               "par un schéma normalisé, avec des symboles", "Chaque composant a son symbole.",
               ("par une photo floue", "par un tableau de nombres", "par une frise")),
            _q(3, "Pourquoi la lampe ne s'allume-t-elle pas quand le circuit est ouvert ?",
               "Le courant ne peut plus circuler.", "Il faut une boucle fermée.",
               ("La lampe est trop loin de la pile.", "La pile se recharge.",
                "Le courant va trop vite.")),
        ],
    ),
    Notion(
        "mouvement_energie.signaux",
        "Lumière, ombres et signaux",
        "Un objet opaque éclairé crée une ombre. Un signal (lumineux, sonore, électrique) "
        "transporte une information.",
        [
            _q(1, "Quel type de signal utilise un feu tricolore ?", "un signal lumineux",
               "Les couleurs transmettent une information aux conducteurs.",
               ("un signal sonore", "un signal électrique seulement", "un signal olfactif")),
            _q(1, "Quel type de signal utilise une alarme incendie ?", "un signal sonore",
               "La sonnerie prévient d'un danger.",
               ("un signal lumineux seulement", "un signal écrit", "aucun signal")),
            _q(1, "Comment appelle-t-on un objet qui ne laisse pas passer la lumière ?", "opaque",
               "Un mur ou un livre sont opaques.", ("transparent", "translucide", "lumineux")),
            _q(1, "Que crée un objet opaque éclairé par une lampe ?", "une ombre",
               "L'ombre est une zone qui ne reçoit pas la lumière.",
               ("un reflet", "un arc-en-ciel", "une étincelle")),
            _q(2, "Comment appelle-t-on l'ombre projetée sur le sol derrière un objet éclairé ?",
               "l'ombre portée", "L'ombre propre, elle, est la partie non éclairée de l'objet.",
               ("l'ombre propre", "le reflet", "la pénombre de la Lune")),
            _q(2, "Comment les câbles sous-marins transmettent-ils des informations entre "
               "continents ?", "par des signaux lumineux dans des fibres optiques",
               "La lumière circule très vite dans les fibres de verre.",
               ("par des signaux sonores", "par des pigeons voyageurs", "par des courants marins")),
            _q(2, "Que transmet le voyant rouge d'un chargeur ?",
               "une information : l'appareil est en train de charger",
               "Un signal lumineux donne une information.",
               ("de l'électricité au voisin", "de la chaleur", "rien du tout")),
            _q(2, "Le code morse peut être transmis par…", "des signaux sonores ou lumineux",
               "Points et traits peuvent être des sons ou des éclairs de lumière.",
               ("des odeurs", "des couleurs de peinture", "des tremblements de terre")),
            _q(3, "Pourquoi la Lune semble-t-elle changer de forme au cours du mois ?",
               "Nous voyons plus ou moins sa partie éclairée par le Soleil.",
               "Ce sont les phases de la Lune.",
               ("Elle grossit puis rétrécit.", "La Terre lui fait de l'ombre chaque soir.",
                "Des nuages la recouvrent.")),
            _q(3, "Qu'est-ce qu'un signal ?", "un phénomène qui transporte une information",
               "Lumière, son, courant électrique peuvent servir de signal.",
               ("une source d'énergie", "un matériau", "un être vivant")),
            _q(3, "Comment une information circule-t-elle dans un fil de téléphone fixe ?",
               "sous forme de signal électrique", "Le courant varie et transporte la voix codée.",
               ("sous forme de gaz", "sous forme d'eau", "sous forme de lumière visible à l'œil")),
            _q(3, "Un bâton planté au soleil : quand son ombre est-elle la plus courte ?",
               "vers midi, quand le Soleil est le plus haut",
               "Plus le Soleil est haut, plus l'ombre est courte.",
               ("au lever du Soleil", "au coucher du Soleil", "la nuit")),
        ],
    ),
    # --- Le vivant ------------------------------------------------------------------------------
    Notion(
        "vivant.cellule",
        "La cellule",
        "Tous les êtres vivants sont faits de cellules. Certains n'en ont qu'une (unicellulaires).",
        [
            _q(1, "Quelle est l'unité de base de tous les êtres vivants ?", "la cellule",
               "Tous les êtres vivants sont faits d'une ou de plusieurs cellules.",
               ("l'organe", "l'os", "le sang")),
            _q(1, "Quel instrument permet d'observer des cellules ?", "le microscope",
               "Les cellules sont trop petites pour être vues à l'œil nu.",
               ("le télescope", "les jumelles", "le thermomètre")),
            _q(1, "Comment appelle-t-on un être vivant formé d'une seule cellule ?", "unicellulaire",
               "« Uni » veut dire « un seul ».", ("pluricellulaire", "invertébré", "végétal")),
            _q(1, "L'être humain est formé…", "de milliards de cellules",
               "C'est un être pluricellulaire.", ("d'une seule cellule", "de dix cellules",
                                                   "d'aucune cellule")),
            _q(2, "Quels éléments trouve-t-on dans une cellule animale observée au microscope ?",
               "une membrane, du cytoplasme et un noyau", "Le noyau est souvent coloré pour mieux "
               "le voir.", ("des os et du sang", "des feuilles et des racines",
                            "seulement de l'eau")),
            _q(2, "Quel élément entoure la cellule ?", "la membrane",
               "Elle sépare l'intérieur de la cellule de l'extérieur.",
               ("le noyau", "le cytoplasme", "la paroi osseuse")),
            _q(2, "Quel élément trouve-t-on autour des cellules végétales, mais pas des cellules "
               "animales ?", "une paroi rigide", "La paroi donne sa forme à la cellule végétale.",
               ("un noyau", "une membrane", "du cytoplasme")),
            _q(2, "Que contiennent les chloroplastes des cellules des feuilles ?",
               "la chlorophylle, qui les rend vertes", "Ils permettent à la plante de fabriquer sa "
               "matière grâce à la lumière.", ("du sang", "du sel", "des os")),
            _q(3, "Range du plus grand au plus petit : organe, cellule, organisme.",
               "organisme, organe, cellule", "Un organisme est fait d'organes, faits de cellules.",
               ("cellule, organe, organisme", "organe, organisme, cellule",
                "organisme, cellule, organe")),
            _q(3, "Qu'est-ce qu'une levure ?", "un champignon unicellulaire",
               "La levure, une seule cellule, fait lever la pâte à pain.",
               ("une plante verte", "un animal", "un minéral")),
            _q(3, "Les bactéries sont-elles des êtres vivants ?",
               "Oui, ce sont des êtres vivants unicellulaires.",
               "Elles se nourrissent et se reproduisent.",
               ("Non, ce sont des minéraux.", "Non, ce sont des virus.",
                "Seulement quand elles sont malades.")),
            _q(3, "Quel colorant aide à voir le noyau des cellules au microscope ?",
               "le bleu de méthylène", "Il colore le noyau en bleu.",
               ("le sel", "l'huile", "l'eau du robinet")),
        ],
    ),
    Notion(
        "vivant.classification",
        "Classer le vivant",
        "On range les êtres vivants en groupes emboîtés selon les attributs qu'ils partagent : "
        "plus ils en partagent, plus ils sont proches parents.",
        [
            _q(1, "Quel attribut partagent tous les vertébrés ?",
               "un squelette interne avec une colonne vertébrale",
               "Poissons, amphibiens, reptiles, oiseaux et mammifères sont des vertébrés.",
               ("des plumes", "six pattes", "des poils")),
            _q(1, "Quel attribut ont les mammifères ?", "des poils et des mamelles",
               "Les femelles allaitent leurs petits.",
               ("des plumes", "des écailles et des nageoires", "six pattes")),
            _q(1, "Quel attribut ont tous les oiseaux ?", "des plumes",
               "Seuls les oiseaux ont des plumes.",
               ("des poils", "des nageoires", "huit pattes")),
            _q(1, "Combien de pattes ont les insectes ?", "six", "Fourmi, abeille, papillon : six "
               "pattes.", ("quatre", "huit", "dix")),
            _q(2, "Dans une classification en groupes emboîtés, que montre un groupe ?",
               "des êtres vivants qui partagent un attribut",
               "Un attribut partagé révèle une parenté.",
               ("des êtres vivants qui vivent au même endroit",
                "des êtres vivants de la même taille", "des êtres vivants de la même couleur")),
            _q(2, "La baleine est…", "un mammifère", "Elle respire de l'air et allaite son petit.",
               ("un poisson", "un reptile", "un amphibien")),
            _q(2, "Le requin est…", "un poisson", "Il a des nageoires et respire avec des branchies.",
               ("un mammifère", "un reptile", "un amphibien")),
            _q(2, "Classer les animaux en herbivores et carnivores montre-t-il leur parenté ?",
               "Non : c'est un classement selon le mode de vie.",
               "La parenté se lit dans les attributs partagés, pas dans le régime alimentaire.",
               ("Oui, toujours.", "Oui, pour les mammifères seulement.", "Oui, pour les oiseaux.")),
            _q(3, "Que représente un arbre de parenté ?",
               "les liens de parenté entre espèces, d'après leurs attributs communs",
               "Plus deux espèces sont proches dans l'arbre, plus elles sont parentes.",
               ("la taille des animaux", "un arbre généalogique d'une famille humaine",
                "la carte des forêts")),
            _q(3, "Pourquoi l'araignée n'est-elle pas un insecte ?", "Elle a huit pattes, pas six.",
               "L'araignée fait partie des arachnides.",
               ("Elle n'a pas de pattes.", "Elle vit dans l'eau.", "Elle a des plumes.")),
            _q(3, "De quel groupe le crocodile est-il le plus proche parent ?", "des oiseaux",
               "Crocodiles et oiseaux partagent des attributs hérités d'ancêtres communs.",
               ("des poissons", "des amphibiens", "des mammifères")),
            _q(3, "À quoi sert une clé de détermination ?", "à identifier une espèce",
               "On répond à des questions pour trouver le nom d'un être vivant.",
               ("à établir des parentés", "à ouvrir une serre", "à mesurer une plante")),
        ],
    ),
    Notion(
        "vivant.biodiversite",
        "Biodiversité actuelle et passée",
        "Les fossiles racontent la vie d'autrefois. Des crises ont fait disparaître de nombreuses "
        "espèces. L'histoire de la Terre se compte en millions d'années.",
        [
            _q(1, "Qu'est-ce qu'un fossile ?",
               "un reste ou une trace d'un être vivant ancien, conservé dans une roche",
               "Coquillages, os ou empreintes peuvent devenir des fossiles.",
               ("un être vivant actuel", "un minéral précieux", "une plante en pot")),
            _q(1, "Il y a combien de temps environ les dinosaures (non volants) ont-ils disparu ?",
               "66 millions d'années", "Leur disparition marque une grande crise biologique.",
               ("2 000 ans", "10 000 ans", "4 milliards d'années")),
            _q(1, "Qu'est-ce que la biodiversité ?", "la diversité des êtres vivants",
               "Elle comprend toutes les espèces et leurs différences.",
               ("le nombre d'humains", "la quantité d'eau sur Terre", "la variété des roches")),
            _q(1, "Quels animaux actuels descendent des dinosaures ?", "les oiseaux",
               "Les oiseaux sont des dinosaures à plumes qui ont survécu.",
               ("les poissons", "les grenouilles", "les chats")),
            _q(2, "Qu'est-ce qu'une crise biologique ?",
               "la disparition rapide d'un grand nombre d'espèces",
               "La Terre en a connu plusieurs.",
               ("l'apparition d'une seule espèce", "une maladie d'une personne",
                "un hiver très froid")),
            _q(2, "Quel âge a la Terre environ ?", "4,6 milliards d'années",
               "Les premières traces de vie ont environ 3,5 milliards d'années.",
               ("6 000 ans", "1 million d'années", "100 milliards d'années")),
            _q(2, "Depuis combien de temps environ notre espèce, Homo sapiens, existe-t-elle ?",
               "300 000 ans", "C'est très récent à l'échelle des temps géologiques.",
               ("3 000 ans", "66 millions d'années", "4 milliards d'années")),
            _q(2, "Un labrador et un caniche appartiennent-ils à la même espèce ?",
               "Oui : ce sont deux races de chiens.",
               "Ils peuvent avoir ensemble des petits eux-mêmes féconds : c'est la diversité "
               "au sein d'une espèce.", ("Non, ce sont deux espèces.",
                                         "Non, l'un est un loup.", "Seulement s'ils ont la même "
                                         "couleur.")),
            _q(3, "Que permet de comparer la reconstitution d'un paléoenvironnement ?",
               "les êtres vivants d'autrefois et ceux d'aujourd'hui en un même lieu",
               "On montre que la biodiversité d'un lieu change au cours du temps.",
               ("les prix des fossiles", "les saisons d'une seule année", "la météo de demain")),
            _q(3, "Si toute l'histoire de la Terre tenait en une année, quand l'être humain "
               "apparaîtrait-il ?", "le 31 décembre, au dernier moment",
               "L'histoire humaine est minuscule face au temps long de la Terre.",
               ("le 1er janvier", "en juillet", "au printemps")),
            _q(3, "Quand dit-on que deux êtres vivants sont de la même espèce ?",
               "Quand ils peuvent avoir ensemble des descendants eux-mêmes féconds.",
               "Le cheval et l'âne ont des mulets, qui sont stériles : ce sont deux espèces.",
               ("Quand ils ont la même couleur.", "Quand ils vivent au même endroit.",
                "Quand ils ont la même taille.")),
            _q(3, "Quelle cause probable explique la crise d'il y a 66 millions d'années ?",
               "la chute d'une météorite géante, avec un volcanisme intense",
               "Le climat a été bouleversé : de nombreuses espèces ont disparu.",
               ("une épidémie de grippe", "la chasse par les humains", "un été trop long")),
        ],
    ),
    # --- Alimentation et plantes à fleurs -----------------------------------------------------
    Notion(
        "nutrition.aliments",
        "Alimentation et micro-organismes",
        "Des micro-organismes fabriquent des aliments (pain, yaourt, fromage) par fermentation. "
        "Le froid, le sel, la chaleur de la stérilisation conservent les aliments.",
        [
            _q(1, "Quel micro-organisme fait lever la pâte à pain ?", "la levure",
               "La levure est un champignon microscopique.",
               ("le sel", "le sucre", "une bactérie du yaourt")),
            _q(1, "Quel aliment est fabriqué avec des bactéries appelées ferments lactiques ?",
               "le yaourt", "Les ferments transforment le lait en yaourt.",
               ("le pain", "la confiture", "les pâtes")),
            _q(1, "Pourquoi met-on certains aliments au réfrigérateur ?",
               "Le froid ralentit la multiplication des micro-organismes.",
               "Les aliments se gâtent moins vite.", ("Le froid les rend plus sucrés.",
                                                       "Pour qu'ils pèsent moins lourd.",
                                                       "Pour les faire cuire.")),
            _q(1, "Pourquoi se lave-t-on les mains avant de cuisiner ?",
               "pour éliminer des micro-organismes", "C'est une règle d'hygiène essentielle.",
               ("pour que les aliments soient plus salés", "pour refroidir les aliments",
                "ça ne sert à rien")),
            _q(2, "Comment s'appelle la transformation du lait en yaourt par des bactéries ?",
               "une fermentation", "Les bactéries transforment le sucre du lait.",
               ("une évaporation", "une solidification", "une filtration")),
            _q(2, "Quel procédé de conservation utilise beaucoup de sel ?", "la salaison",
               "Le sel empêche les micro-organismes de se développer (jambon, morue).",
               ("la congélation", "la stérilisation", "la cuisson")),
            _q(2, "Que fait la stérilisation des conserves ?",
               "Elle tue les micro-organismes par une forte chaleur.",
               "La boîte fermée reste ensuite sans micro-organismes.",
               ("Elle ajoute des micro-organismes.", "Elle congèle les aliments.",
                "Elle sale les aliments.")),
            _q(2, "Pourquoi avoir une alimentation équilibrée ?",
               "pour couvrir les besoins de l'organisme, sans excès",
               "Le corps a besoin de matière et d'énergie pour grandir et bouger.",
               ("pour manger seulement des sucres", "pour ne jamais manger de légumes",
                "pour grossir le plus vite possible")),
            _q(3, "Quel gaz produit la levure qui fait gonfler la pâte à pain ?",
               "le dioxyde de carbone", "Ses bulles font gonfler la pâte.",
               ("le dioxygène", "le diazote", "la vapeur d'eau seulement")),
            _q(3, "Quelle température favorise la fabrication d'un yaourt ?",
               "une température tiède, vers 40 à 45 degrés",
               "Les ferments se multiplient bien quand il fait tiède.",
               ("une température glacée, 0 degré", "une ébullition à 100 degrés",
                "moins 18 degrés, comme au congélateur")),
            _q(3, "Pourquoi un adolescent sportif a-t-il besoin de manger plus ?",
               "La croissance et l'activité physique demandent plus d'énergie et de matière.",
               "Les besoins varient selon l'âge et l'activité.",
               ("Parce que le sport rend gourmand, sans raison.",
                "Parce qu'il dort moins.", "Ce n'est pas vrai, les besoins sont les mêmes.")),
            _q(3, "Quel point commun ont le pain, le yaourt et le fromage ?",
               "Ils sont fabriqués grâce à des micro-organismes.",
               "Levures et bactéries réalisent des fermentations.",
               ("Ils viennent tous des arbres.", "Ils ne contiennent que du sucre.",
                "Ils sont tous stérilisés.")),
        ],
    ),
    Notion(
        "nutrition.pollinisation",
        "Plantes à fleurs et pollinisation",
        "Le pollen transporté d'une fleur à l'autre permet la transformation de la fleur en fruit, "
        "et des ovules en graines.",
        [
            _q(1, "Qu'est-ce que la pollinisation ?",
               "le transport du pollen jusqu'au pistil d'une fleur",
               "Insectes et vent transportent le pollen.",
               ("la chute des feuilles", "l'arrosage des plantes", "la germination d'une graine")),
            _q(1, "Quel insecte est un grand pollinisateur ?", "l'abeille",
               "En butinant, elle transporte le pollen de fleur en fleur.",
               ("le moustique", "la fourmi", "le pou")),
            _q(1, "Que devient la fleur après la pollinisation ?", "un fruit",
               "Le pistil se transforme en fruit.", ("une racine", "une feuille", "une tige")),
            _q(1, "Que devient l'ovule après la pollinisation ?", "une graine",
               "La graine contient l'embryon d'une nouvelle plante.",
               ("un fruit", "une fleur", "du pollen")),
            _q(2, "Pourquoi la pollinisation par les insectes est-elle une coopération ?",
               "L'insecte se nourrit de nectar et la plante est pollinisée : chacun y gagne.",
               "C'est une interaction mutualiste.",
               ("L'insecte mange la plante entière.", "La plante mange l'insecte.",
                "Aucun des deux n'y gagne.")),
            _q(2, "Quel est l'ordre du cycle de vie d'une plante à fleurs ?",
               "graine, plantule, plante fleurie, fruit avec de nouvelles graines",
               "Le cycle recommence avec les nouvelles graines.",
               ("fruit, fleur, graine, racine", "plante fleurie, graine, plantule, fruit",
                "fleur, racine, fruit, plantule")),
            _q(2, "Que trouve-t-on à l'intérieur d'un fruit ?", "des graines",
               "Le pépin de pomme et le noyau de cerise contiennent des graines.",
               ("du pollen", "des racines", "des feuilles")),
            _q(2, "Quelle partie de la fleur produit le pollen ?", "les étamines",
               "Le pollen est une poudre produite par les étamines.",
               ("le pistil", "les pétales", "la racine")),
            _q(3, "Quel effet ont certains pesticides sur les pollinisateurs ?",
               "Ils les tuent ou les affaiblissent.", "Moins de pollinisateurs, c'est moins de "
               "fruits.", ("Ils les rendent plus nombreux.", "Ils n'ont aucun effet.",
                           "Ils les nourrissent.")),
            _q(3, "Pourquoi le déclin des abeilles menace-t-il certaines cultures ?",
               "Beaucoup de fruits et de légumes ont besoin des insectes pour être pollinisés.",
               "Pommes, fraises ou courgettes dépendent des pollinisateurs.",
               ("Les abeilles mangent les mauvaises herbes.", "Les abeilles arrosent les champs.",
                "Les abeilles chassent la pluie.")),
            _q(3, "Quelle partie de la fleur reçoit le pollen ?", "le pistil",
               "Le pistil contient les ovules ; il deviendra le fruit.",
               ("les étamines", "les sépales", "la tige")),
            _q(3, "Le vent peut-il assurer la pollinisation ?",
               "Oui, par exemple pour les graminées et beaucoup d'arbres.",
               "Ces plantes produisent un pollen léger, en grande quantité.",
               ("Non, jamais.", "Seulement la nuit.", "Seulement pour les fleurs en plastique.")),
        ],
    ),
    # --- La Terre ---------------------------------------------------------------------------------
    Notion(
        "terre.planete",
        "La Terre, planète de la vie",
        "Troisième planète du système solaire, la Terre a de l'eau liquide, une atmosphère et des "
        "températures compatibles avec la vie.",
        [
            _q(1, "Quelle est la place de la Terre dans le système solaire ?",
               "la troisième planète à partir du Soleil", "Mercure, Vénus, puis la Terre.",
               ("la première", "la cinquième", "la dernière")),
            _q(1, "Autour de quelle étoile la Terre tourne-t-elle ?", "le Soleil",
               "Le Soleil est l'étoile du système solaire.",
               ("la Lune", "l'étoile Polaire", "Mars")),
            _q(1, "Quel est le satellite naturel de la Terre ?", "la Lune",
               "La Lune tourne autour de la Terre.", ("le Soleil", "Mars", "Vénus")),
            _q(1, "Qu'est-ce qui rend la vie possible sur Terre ?",
               "de l'eau liquide, une atmosphère et des températures douces",
               "Ces conditions n'existent pas ailleurs dans le système solaire.",
               ("des volcans partout", "l'absence d'air", "un froid extrême")),
            _q(2, "Pourquoi l'eau est-elle liquide sur Terre ?",
               "La Terre n'est ni trop près ni trop loin du Soleil.",
               "Plus près, l'eau s'évaporerait ; plus loin, elle gèlerait.",
               ("La Terre est la plus grosse planète.", "La Lune réchauffe la Terre.",
                "La Terre ne tourne pas.")),
            _q(2, "Comment s'appelle la couche de gaz qui entoure la Terre ?", "l'atmosphère",
               "Elle contient l'air que nous respirons.",
               ("la croûte", "le noyau", "l'océan")),
            _q(2, "Quelle planète est la plus proche du Soleil ?", "Mercure",
               "Mercure est la première planète du système solaire.",
               ("Vénus", "la Terre", "Neptune")),
            _q(2, "Combien de planètes compte le système solaire ?", "huit",
               "Mercure, Vénus, la Terre, Mars, Jupiter, Saturne, Uranus, Neptune.",
               ("cinq", "neuf", "douze")),
            _q(3, "Quels indices montrent que la Terre est une planète active ?",
               "les volcans et les séismes", "Ils montrent l'activité interne de la Terre.",
               ("les marées seulement", "les phases de la Lune", "les arcs-en-ciel")),
            _q(3, "Quelle énergie utilise la chaleur interne de la Terre ?", "la géothermie",
               "« Géo » : la Terre ; « thermie » : la chaleur.",
               ("l'éolien", "le photovoltaïque", "le charbon")),
            _q(3, "Pourquoi Vénus est-elle brûlante ?",
               "Son atmosphère, très riche en dioxyde de carbone, provoque un énorme effet de serre.",
               "Elle est même plus chaude que Mercure, pourtant plus proche du Soleil.",
               ("Elle touche le Soleil.", "Elle n'a pas d'atmosphère.",
                "Elle est couverte de volcans en feu.")),
            _q(3, "Pourquoi n'y a-t-il pas d'eau liquide à la surface de Mars aujourd'hui ?",
               "Il y fait trop froid et son atmosphère est très mince.",
               "L'eau y est gelée dans le sol et aux pôles.",
               ("Mars est trop proche du Soleil.", "Mars n'a jamais eu d'eau.",
                "Les Martiens l'ont bue.")),
        ],
    ),
    Notion(
        "terre.climat",
        "Météo, climat et réchauffement",
        "La météo : le temps qu'il fait sur quelques jours. Le climat : sur au moins 30 ans. "
        "Le réchauffement actuel est dû aux gaz à effet de serre rejetés par les activités humaines.",
        [
            _q(1, "Quelle est la différence entre la météo et le climat ?",
               "La météo décrit quelques jours ; le climat, au moins trente ans.",
               "Une journée froide ne dit rien du climat.",
               ("C'est la même chose.", "La météo dure un siècle.",
                "Le climat change chaque matin.")),
            _q(1, "Quel instrument mesure la quantité de pluie tombée ?", "le pluviomètre",
               "« Pluvio » : la pluie.", ("l'anémomètre", "le thermomètre", "le baromètre")),
            _q(1, "Quel instrument mesure la vitesse du vent ?", "l'anémomètre",
               "« Anémo » vient du grec « anemos », le vent.",
               ("le pluviomètre", "le thermomètre", "le microscope")),
            _q(1, "Quel instrument mesure la température de l'air ?", "le thermomètre",
               "« Thermo » : la chaleur.", ("l'anémomètre", "le pluviomètre", "la balance")),
            _q(2, "Qu'est-ce que le réchauffement climatique actuel ?",
               "la hausse de la température moyenne de la Terre depuis environ 150 ans",
               "Elle est mesurée partout sur la planète.",
               ("un été plus chaud que l'autre", "le Soleil qui grossit", "la chaleur d'un volcan")),
            _q(2, "Quel gaz rejeté par les activités humaines renforce le plus l'effet de serre ?",
               "le dioxyde de carbone", "Il vient surtout du charbon, du pétrole et du gaz brûlés.",
               ("le dioxygène", "le diazote", "l'hélium")),
            _q(2, "Quel indice montre le réchauffement climatique ?", "la fonte des glaciers",
               "Les glaciers des Alpes reculent depuis des décennies.",
               ("la pluie d'un jour", "un hiver froid", "la pleine Lune")),
            _q(2, "De combien la température moyenne de la Terre a-t-elle augmenté depuis "
               "l'époque préindustrielle ?", "d'un peu plus d'un degré",
               "Cela semble peu, mais c'est une moyenne sur toute la planète.",
               ("de 10 degrés", "de 30 degrés", "elle a baissé")),
            _q(3, "Qu'est-ce qu'une stratégie d'atténuation du réchauffement ?",
               "réduire les rejets de gaz à effet de serre",
               "Mieux isoler les maisons, utiliser les transports en commun…",
               ("construire des digues plus hautes", "planter des arbres pour l'ombre seulement",
                "ne rien changer")),
            _q(3, "Qu'est-ce qu'une stratégie d'adaptation au réchauffement ?",
               "se préparer à ses effets, par exemple végétaliser les villes contre la chaleur",
               "On s'adapte à des conséquences qui arrivent déjà.",
               ("réduire les rejets de dioxyde de carbone", "brûler plus de charbon",
                "supprimer les arbres")),
            _q(3, "Comment le réchauffement modifie-t-il le peuplement des milieux ?",
               "Certaines espèces remontent vers le nord ou en altitude.",
               "Elles cherchent des conditions qui leur conviennent.",
               ("Toutes les espèces disparaissent d'un coup.", "Rien ne change.",
                "Les espèces descendent toutes vers l'équateur.")),
            _q(3, "Pourquoi faut-il des mesures sur de longues durées pour parler de climat ?",
               "Une seule année chaude ne suffit pas : il faut des moyennes sur trente ans.",
               "On compare de longues séries de mesures.",
               ("Parce que les thermomètres sont lents.", "Parce que la météo n'existe pas.",
                "Parce que le climat change chaque jour.")),
        ],
    ),
    Notion(
        "terre.ecosystemes",
        "Écosystèmes",
        "Un écosystème : un milieu de vie et les êtres vivants qui y vivent et interagissent. "
        "Une chaîne alimentaire se lit avec « est mangé par ».",
        [
            _q(1, "Qu'est-ce qu'un écosystème ?",
               "un milieu de vie et les êtres vivants qui y vivent et interagissent",
               "Une mare, une forêt ou une haie sont des écosystèmes.",
               ("un seul animal", "une usine", "un type de roche")),
            _q(1, "Dans « le renard mange le lapin », que représente le renard ?", "un prédateur",
               "Le lapin est sa proie.", ("une proie", "un producteur", "un décomposeur")),
            _q(1, "Dans une chaîne alimentaire, que veut dire une flèche ?", "« est mangé par »",
               "herbe → lapin : l'herbe est mangée par le lapin.",
               ("« mange »", "« est plus grand que »", "« vit à côté de »")),
            _q(1, "Quel être vivant est un producteur ?", "une plante verte",
               "Elle fabrique sa propre matière grâce à la lumière.",
               ("un lapin", "un renard", "un ver de terre")),
            _q(2, "Que font les décomposeurs, comme les vers de terre et les champignons ?",
               "Ils transforment les déchets et les êtres morts en matière minérale.",
               "Cette matière nourrit ensuite les plantes.",
               ("Ils mangent les prédateurs.", "Ils produisent de la lumière.",
                "Ils construisent des nids.")),
            _q(2, "Qu'est-ce qu'un réseau trophique ?",
               "l'ensemble des chaînes alimentaires reliées d'un écosystème",
               "Un être vivant peut appartenir à plusieurs chaînes.",
               ("un réseau de routes", "une toile d'araignée", "un réseau électrique")),
            _q(2, "Pourquoi ne trouve-t-on pas les mêmes êtres vivants à l'ombre et au soleil ?",
               "La lumière, l'humidité et la température n'y sont pas les mêmes.",
               "Chaque espèce vit là où les conditions lui conviennent.",
               ("Par hasard seulement.", "Parce que le soleil fait peur aux animaux.",
                "Parce que l'ombre est interdite aux plantes.")),
            _q(2, "Quel animal est un consommateur herbivore ?", "le lapin",
               "Il se nourrit de végétaux.", ("le renard", "la buse", "le loup")),
            _q(3, "Que se passe-t-il souvent si les prédateurs disparaissent d'un écosystème ?",
               "Les proies se multiplient et peuvent manquer de nourriture.",
               "Tout l'équilibre de l'écosystème est modifié.",
               ("Rien ne change.", "Les proies disparaissent aussi aussitôt.",
                "Les plantes se mettent à chasser.")),
            _q(3, "Quelle action humaine dégrade un écosystème ?", "assécher une zone humide",
               "Les espèces qui y vivaient perdent leur milieu.",
               ("replanter une haie", "créer une mare", "réduire les pesticides")),
            _q(3, "Qu'est-ce que la résilience d'un écosystème ?",
               "sa capacité à se rétablir après une perturbation, dans certaines limites",
               "Une forêt repousse après un incendie, si on lui en laisse le temps.",
               ("sa taille", "son âge", "le nombre de ses arbres")),
            _q(3, "Pourquoi un écosystème change-t-il au fil des saisons ?",
               "La température, la lumière et la nourriture varient.",
               "Migrations, hibernation, chute des feuilles en sont des exemples.",
               ("Il ne change jamais.", "Seulement à cause des humains.",
                "Parce que la Lune change de forme.")),
        ],
    ),
]

GENERATORS = register_notions(LEVEL, SUBJECT, NOTIONS)


# --- Masse et volume ----------------------------------------------------------------------------

MASS_UNITS = {"kg": 1000, "g": 1, "mg": 0.001}  # en grammes
VOLUME_UNITS = {"L": 1000, "dL": 100, "cL": 10, "mL": 1}  # en millilitres
UNIT_NAMES = {
    "kg": "kilogrammes", "g": "grammes", "mg": "milligrammes",
    "L": "litres", "dL": "décilitres", "cL": "centilitres", "mL": "millilitres",
}
LIQUIDS = [("d'huile", 92), ("d'eau", 100), ("de lait", 103), ("de miel", 140), ("d'eau salée", 104)]


def _numeric(prompt: str, value: float, hint: str, explanation: str, difficulty: int,
             meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "numeric",
        "prompt": prompt,
        "answer": {"kind": "number", "value": fr_number(value).replace(",", ".")},
        "hint": hint,
        "explanation": explanation,
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": meta,
    }


def _masse_volume(difficulty: int, rng: random.Random) -> dict[str, Any]:
    kind = rng.choice(["masse", "volume", "proportion"] if difficulty >= 3 else ["masse", "volume"])
    if kind == "proportion":
        name, per_100 = rng.choice(LIQUIDS)
        factor = rng.choice([2, 3, 4, 5]) if difficulty < 5 else rng.choice([0.5, 1.5, 2.5])
        volume = 100 * factor
        mass = per_100 * factor
        return _numeric(
            f"100 mL {name} pèsent {per_100} g. Combien de grammes pèsent {fr_number(volume)} mL "
            f"{name} ?",
            mass,
            "La masse est proportionnelle au volume : deux fois plus de liquide pèse deux fois "
            "plus lourd.",
            f"{fr_number(volume)} mL, c'est {fr_number(factor)} fois 100 mL : "
            f"{per_100} × {fr_number(factor)} = {fr_number(mass)} g.",
            difficulty,
            {"kind": kind},
        )
    units = MASS_UNITS if kind == "masse" else VOLUME_UNITS
    while True:
        src, dst = rng.sample(list(units), 2)
        if difficulty <= 2 and abs(units[src] / units[dst]) not in (1000, 0.001, 10, 0.1, 100, 0.01):
            continue
        amount = rng.choice([1, 2, 3, 4, 5, 8, 12, 25]) if difficulty <= 2 else rng.choice(
            [0.5, 1.5, 2.5, 0.25, 12, 75, 250, 3.2]
        )
        result = amount * units[src] / units[dst]
        if result >= 0.001 and abs(result * 1000 - round(result * 1000)) < 1e-9:
            break
    ratio = units[src] / units[dst]
    rule = (
        f"1 {src} = {fr_number(ratio)} {dst}" if ratio >= 1 else f"1 {dst} = {fr_number(1 / ratio)} {src}"
    )
    return _numeric(
        f"Convertis {fr_number(amount)} {src} en {UNIT_NAMES[dst]}.",
        result,
        "Masses : 1 kg = 1000 g ; 1 g = 1000 mg. Volumes : 1 L = 10 dL = 100 cL = 1000 mL.",
        f"{rule}, donc {fr_number(amount)} {src} = {fr_number(result)} {dst}.",
        difficulty,
        {"kind": kind, "from": src, "to": dst},
    )


MASSE_VOLUME = register(
    Generator(
        code="6e.sciences.masse_volume",
        level=LEVEL,
        notion="6e.sciences.matiere.masse_volume",
        role="chapitre",
        title="Masses et volumes",
        generate=_masse_volume,
    )
)


# --- Vitesse ------------------------------------------------------------------------------------

# (mobile, unité de distance, unité de vitesse, vitesses plausibles)
MOBILES = [
    ("un cycliste", "km", "h", (12, 15, 18, 20, 24)),
    ("une voiture", "km", "h", (50, 60, 80, 90, 110)),
    ("un train", "km", "h", (120, 150, 200, 300)),
    ("un marcheur", "km", "h", (4, 5, 6)),
    ("un coureur", "m", "s", (4, 5, 6, 8)),
    ("un robot", "m", "s", (1, 2, 3)),
    ("un escargot", "m", "min", (1, 2)),
]
UNIT_WORD = {"h": "heure", "s": "seconde", "min": "minute"}


def _speed_label(speed: float, dist: str, per: str) -> str:
    return f"{fr_number(speed)} {dist}/{per}"


def _vitesse(difficulty: int, rng: random.Random) -> dict[str, Any]:
    mobile, dist, per, speeds = rng.choice(MOBILES)
    speed = rng.choice(speeds)
    # 1 : durée de 1 à 3 unités ; 2 : jusqu'à 5 ; 3+ : en minutes pour une vitesse par heure.
    if per == "h" and difficulty >= 3 and rng.random() < 0.6:
        minutes = rng.choice([30, 15, 20, 45, 90])
        distance = speed * minutes / 60
        if abs(distance - round(distance, 1)) > 1e-9:
            minutes, distance = 30, speed / 2
        duration_text = f"{minutes} min"
        explanation = (
            f"{minutes} min = {fr_number(minutes / 60)} h ; {fr_number(distance)} {dist} ÷ "
            f"{fr_number(minutes / 60)} h = {speed} {dist}/{per}."
        )
    else:
        count = rng.randint(1, 3 if difficulty == 1 else 5 if difficulty == 2 else 10)
        distance = speed * count
        unit = UNIT_WORD[per] + ("s" if count > 1 else "")
        duration_text = f"{count} {unit}"
        explanation = f"{fr_number(distance)} {dist} ÷ {count} = {speed} {dist} par {UNIT_WORD[per]}."
    prompt = (
        f"À vitesse constante, {mobile} parcourt {fr_number(distance)} {dist} en {duration_text}. "
        f"Quelle est sa vitesse, en {dist}/{per} ?"
    )
    return _numeric(
        prompt,
        speed,
        "Vitesse = distance parcourue ÷ durée du trajet.",
        explanation,
        difficulty,
        {"speed": speed, "unit": f"{dist}/{per}"},
    )


VITESSE = register(
    Generator(
        code="6e.sciences.vitesse",
        level=LEVEL,
        notion="6e.sciences.mouvement_energie.vitesse",
        role="chapitre",
        title="Calculer une vitesse",
        generate=_vitesse,
    )
)


# --- Énigme : la course (du plus lent au plus rapide) -------------------------------------------

RACERS = ["la tortue mécanique", "le robot à roues", "la trottinette", "le vélo", "le chariot à "
          "voile", "la draisienne", "le tricycle à vapeur"]
COURSE = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _course(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = COURSE[difficulty]
    names = rng.sample(RACERS, count)
    speeds = rng.sample(range(2, 25), count)  # km/h, toutes différentes
    racers = []
    for name, speed in zip(names, speeds, strict=True):
        hours = rng.choice([1, 2, 3]) if difficulty <= 2 else rng.choice([1, 2, 3, 4, 5])
        racers.append((speed, f"{name} : {speed * hours} km en {hours} h"))
    ordered = sorted(racers)
    shown = list(range(count))
    while [racers[i] for i in shown] == ordered:
        rng.shuffle(shown)
    labels = [racers[i][1] for i in shown]
    answer = [labels.index(label) for _s, label in ordered]
    return {
        "type": "order",
        "prompt": "Le Professeur Court-Circuit a truqué la course des inventions ! Classe ces "
        "engins du plus lent au plus rapide.",
        "choices": labels,
        "answer": {"kind": "order", "value": answer},
        "hint": "Calcule la vitesse de chacun : distance ÷ durée.",
        "explanation": "Du plus lent au plus rapide : "
        + " ; ".join(f"{label} ({speed} km/h)" for speed, label in ordered)
        + ".",
        "time_target_ms": 30000 + 8000 * difficulty,
        "meta": {"speeds": [s for s, _l in ordered]},
    }


COURSE_GEN = register(
    Generator(
        code="6e.sciences.course",
        level=LEVEL,
        notion="6e.sciences.mouvement_energie.vitesse",
        role="chapitre",
        title="La course des inventions",
        generate=_course,
    )
)


# --- Énigme : la frise du vivant ----------------------------------------------------------------

# (millions d'années avant aujourd'hui, événement, date écrite). Ordres de grandeur des manuels.
LIFE_EVENTS = [
    (3500, "Premières traces de vie : des bactéries dans l'océan", "il y a environ 3,5 milliards d'années"),
    (500, "Premiers poissons", "il y a environ 500 millions d'années"),
    (470, "Premières plantes sur la terre ferme", "il y a environ 470 millions d'années"),
    (230, "Premiers dinosaures", "il y a environ 230 millions d'années"),
    (200, "Premiers mammifères", "il y a environ 200 millions d'années"),
    (150, "Premiers oiseaux", "il y a environ 150 millions d'années"),
    (130, "Premières plantes à fleurs", "il y a environ 130 millions d'années"),
    (66, "Disparition des dinosaures non volants", "il y a environ 66 millions d'années"),
    (2.8, "Premiers humains du genre Homo", "il y a environ 2,8 millions d'années"),
    (0.3, "Apparition d'Homo sapiens", "il y a environ 300 000 ans"),
]
# Difficulté → (nombre d'événements, écart minimal en millions d'années entre deux voisins).
LIFE_FRISE = {1: (3, 150), 2: (3, 60), 3: (4, 30), 4: (4, 15), 5: (5, 2)}


def _frise_vivant(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count, gap = LIFE_FRISE[difficulty]
    while True:
        picked = sorted(rng.sample(LIFE_EVENTS, count), key=lambda e: -e[0])
        if all(a[0] - b[0] >= gap for a, b in zip(picked, picked[1:], strict=False)):
            break
    shown = list(range(count))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": "Le Pétrificateur a mélangé les fossiles ! Remets ces moments de l'histoire de "
        "la vie dans l'ordre, du plus ancien au plus récent.",
        "choices": [picked[i][1] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "La vie commence dans l'océan ; les dinosaures disparaissent bien avant "
        "l'arrivée des humains.",
        "explanation": "Dans l'ordre : "
        + " ; ".join(f"{label} ({date})" for _y, label, date in picked)
        + ".",
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"ages": [y for y, _l, _d in picked]},
    }


FRISE_VIVANT = register(
    Generator(
        code="6e.sciences.frise_vivant",
        level=LEVEL,
        notion="6e.sciences.vivant.biodiversite",
        role="chapitre",
        title="La frise du vivant",
        generate=_frise_vivant,
    )
)


# --- Chaînes alimentaires -----------------------------------------------------------------------

CHAINS = [
    ("l'herbe", "le lapin", "le renard"),
    ("le blé", "le mulot", "la chouette"),
    ("les feuilles", "la chenille", "la mésange"),
    ("les feuilles", "la chenille", "la mésange", "l'épervier"),
    ("l'herbe", "le criquet", "la grenouille", "le héron"),
    ("les algues microscopiques", "le krill", "le hareng", "le phoque"),
    ("l'herbe", "le criquet", "la grenouille", "la couleuvre", "la buse"),
    ("les algues microscopiques", "le krill", "le hareng", "le phoque", "l'ours blanc"),
]
CHAIN_LENGTH = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _chaine(difficulty: int, rng: random.Random) -> dict[str, Any]:
    chain = rng.choice([c for c in CHAINS if len(c) == CHAIN_LENGTH[difficulty]])
    shown = list(range(len(chain)))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": "Remets cette chaîne alimentaire dans l'ordre, du producteur au dernier "
        "consommateur (« est mangé par »).",
        "choices": [chain[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(len(chain))]},
        "hint": "Commence par la plante (le producteur) : elle fabrique sa matière grâce à la "
        "lumière.",
        "explanation": " → ".join(chain) + " : chacun est mangé par le suivant.",
        "time_target_ms": 20000 + 5000 * difficulty,
        "meta": {"chain": list(chain)},
    }


CHAINE = register(
    Generator(
        code="6e.sciences.chaine",
        level=LEVEL,
        notion="6e.sciences.terre.ecosystemes",
        role="chapitre",
        title="La chaîne alimentaire",
        generate=_chaine,
    )
)
