"""Histoire-géographie, seconde (programme de 2019, BO spécial n° 1 du 22 janvier 2019, en vigueur
en 2026-2027) : exemples relus, plus trois générateurs calculés.

- `2nde.histoire_geo.siecles` : le siècle d'une année, de l'Antiquité au XVIIIe siècle ;
- `2nde.histoire_geo.frise` : remettre dans l'ordre les repères du programme (énigme de la Porte des
  Empires) ;
- `2nde.histoire_geo.idh` : classer des pays selon leur indice de développement humain (énigme de la
  Porte des Transitions). Ordre du PNUD, avec des écarts nets entre voisins : il ne change pas d'un
  rapport annuel à l'autre. Pas de valeur chiffrée affichée.

Les points de passage et d'ouverture du programme (Périclès, Auguste, Constantin, Bernard de
Clairvaux, Venise, Las Casas, Michel-Ange, Érasme, Luther, Villers-Cotterêts, Colbert, Versailles,
l'édit de Nantes, Habeas Corpus et Bill of Rights, Voltaire, Washington, Galilée, Newcomen, Émilie
du Châtelet, les Va-nu-pieds, les salons, les ports de la traite) ont tous leurs questions.
"""

from __future__ import annotations

import random
from typing import Any

from app.engine.generators import Generator, register
from app.engine.generators.faits import Fact, Notion, register_notions
from app.engine.generators.histoire_geo_6e import century, century_label, year_label

LEVEL, SUBJECT = "2nde", "histoire_geo"


def _q(level: int, prompt: str, answer: str, why: str, wrong: tuple[str, ...]) -> Fact:
    return Fact(level, prompt, answer, why, wrong)


NOTIONS = [
    # --- Histoire -----------------------------------------------------------------------------
    Notion(
        "mediterranee.antiquite",
        "La Méditerranée antique",
        "Athènes : démocratie et empire maritime (Ve siècle av. J.-C.). Rome : empire territorial, "
        "Auguste (27 av. J.-C.), puis Constantin et la christianisation.",
        [
            _q(1, "Quel stratège dirige Athènes au Ve siècle av. J.-C., à l'apogée de sa démocratie ?",
               "Périclès", "Périclès est réélu stratège pendant une quinzaine d'années.",
               ("Alexandre le Grand", "Auguste", "Solon")),
            _q(1, "Qui devient le premier empereur romain, en 27 av. J.-C. ?", "Auguste",
               "Octave reçoit le titre d'Auguste et fonde le principat.",
               ("Jules César", "Constantin", "Néron")),
            _q(1, "Quel empereur se convertit au christianisme et fonde Constantinople ?",
               "Constantin", "Constantin favorise le christianisme et crée une nouvelle capitale.",
               ("Auguste", "Néron", "Caracalla")),
            _q(1, "À Athènes, qui peut voter à l'assemblée du peuple (l'Ecclésia) ?",
               "les citoyens : des hommes libres, fils de parents athéniens",
               "Depuis une loi de Périclès (451 av. J.-C.), il faut un père et une mère athéniens.",
               ("tous les habitants d'Athènes", "les citoyens et leurs esclaves",
                "les hommes et les femmes libres")),
            _q(2, "Comment s'appelle l'alliance maritime dominée par Athènes au Ve siècle av. J.-C. ?",
               "la ligue de Délos", "Athènes y impose un tribut aux cités alliées : son empire "
               "maritime finance la cité.", ("la ligue du Péloponnèse", "la Hanse", "l'Empire perse")),
            _q(2, "À quoi sert le misthos, créé à l'époque de Périclès ?",
               "à indemniser les citoyens pauvres pour qu'ils participent à la vie politique",
               "Le misthos permet aux plus pauvres de siéger sans perdre leur journée de travail.",
               ("à payer un tribut au roi de Perse", "à acheter des esclaves",
                "à financer les Jeux olympiques")),
            _q(2, "Comment appelle-t-on le régime fondé par Auguste, qui garde l'apparence de la "
               "République ?", "le principat", "Auguste se dit « premier citoyen » (princeps) mais "
               "concentre les pouvoirs.", ("la tétrarchie", "la démocratie", "la monarchie absolue")),
            _q(2, "En quelle année Constantin autorise-t-il le christianisme par l'édit de Milan ?",
               "313", "L'édit de Milan (313) accorde la liberté de culte aux chrétiens.",
               ("476", "27 av. J.-C.", "1054")),
            _q(3, "Quelle ville Constantin inaugure-t-il en 330 comme nouvelle capitale ?",
               "Constantinople", "Constantinople, l'ancienne Byzance, devient la capitale de l'Orient.",
               ("Ravenne", "Alexandrie", "Rome")),
            _q(3, "Quel édit de 212 accorde la citoyenneté romaine à presque tous les hommes libres "
               "de l'Empire ?", "l'édit de Caracalla", "L'édit de Caracalla unifie juridiquement "
               "l'Empire.", ("l'édit de Milan", "l'édit de Nantes", "la loi des Douze Tables")),
            _q(3, "Quelle limite majeure la démocratie athénienne comporte-t-elle ?",
               "Les femmes, les métèques et les esclaves en sont exclus.",
               "Seule une minorité d'hommes adultes est citoyenne.",
               ("Les citoyens ne votent jamais.", "Seuls les rois décident.",
                "Les assemblées sont interdites en temps de guerre.")),
            _q(3, "Comment Rome réorganise-t-elle son immense empire à la fin du IIIe siècle et au "
               "IVe siècle ?", "en le divisant en plusieurs parties, avec deux capitales, Rome et "
               "Constantinople", "Dioclétien puis Constantin réorganisent l'Empire ; il est "
               "définitivement partagé en 395.",
               ("en abandonnant toutes ses provinces", "en devenant une démocratie",
                "en confiant l'Empire au pape")),
        ],
    ),
    Notion(
        "mediterranee.medievale",
        "La Méditerranée médiévale",
        "Trois civilisations : chrétienté latine, Empire byzantin, monde musulman. Échanges (Venise) "
        "et conflits (croisades).",
        [
            _q(1, "Quelles sont les trois grandes civilisations de la Méditerranée médiévale ?",
               "la chrétienté latine, l'Empire byzantin et le monde musulman",
               "Elles partagent la Méditerranée et ses échanges, entre contacts et conflits.",
               ("Rome, Athènes et Carthage", "la Chine, l'Inde et la Perse",
                "les Francs, les Vikings et les Mongols")),
            _q(1, "Quelle ville est la capitale de l'Empire byzantin ?", "Constantinople",
               "Constantinople reste la capitale byzantine jusqu'en 1453.",
               ("Rome", "Bagdad", "Venise")),
            _q(1, "Comment appelle-t-on les expéditions militaires de chrétiens vers Jérusalem à "
               "partir de 1095 ?", "les croisades", "Le pape Urbain II appelle à la première "
               "croisade en 1095.", ("les grandes découvertes", "les guerres de Religion",
                                     "la Reconquista")),
            _q(1, "Quelle ville italienne est une grande puissance maritime et commerciale au "
               "Moyen Âge ?", "Venise", "Venise commerce avec Byzance et l'Orient grâce à sa flotte.",
               ("Florence", "Rome", "Milan")),
            _q(2, "Quel moine cistercien prêche la deuxième croisade à Vézelay en 1146 ?",
               "Bernard de Clairvaux", "Bernard de Clairvaux est la grande voix de la chrétienté "
               "de son temps.", ("Urbain II", "Saint Louis", "Thomas d'Aquin")),
            _q(2, "Quel pape appelle à la première croisade en 1095 ?", "Urbain II",
               "Urbain II lance l'appel au concile de Clermont.",
               ("Innocent III", "Léon X", "Grégoire le Grand")),
            _q(2, "Que se passe-t-il en 1054 entre Rome et Constantinople ?",
               "le schisme entre catholiques et orthodoxes",
               "Les Églises de Rome et de Constantinople se séparent.",
               ("la chute de Constantinople", "la première croisade", "le couronnement de Charlemagne")),
            _q(2, "Quelle ville est la capitale du califat abbasside ?", "Bagdad",
               "Les Abbassides fondent Bagdad en 762 ; les Omeyyades régnaient depuis Damas.",
               ("Cordoue", "Damas", "Le Caire")),
            _q(3, "Que font les croisés de la quatrième croisade en 1204 ?",
               "Ils prennent et pillent Constantinople.",
               "Détournée par Venise, la croisade frappe une ville chrétienne, Constantinople.",
               ("Ils reprennent Jérusalem.", "Ils fondent Venise.", "Ils traversent l'Atlantique.")),
            _q(3, "Dans al-Andalus, quelle ville est un grand centre de culture au Xe siècle ?",
               "Cordoue", "Cordoue, capitale du califat omeyyade d'Espagne, est l'une des plus "
               "grandes villes d'Europe.", ("Venise", "Bagdad", "Paris")),
            _q(3, "Que rapportent surtout d'Orient les marchands vénitiens ?",
               "des épices et de la soie", "Venise s'enrichit en revendant en Europe les produits "
               "de l'Orient.", ("de l'or des Amériques", "du tabac", "du charbon")),
            _q(3, "Que désigne la Reconquista ?",
               "la reconquête par les royaumes chrétiens des territoires musulmans de la péninsule "
               "Ibérique", "Elle s'achève en 1492 avec la prise de Grenade.",
               ("la reprise de Jérusalem par Saladin", "la conquête de l'Amérique",
                "la réunion des Églises d'Orient et d'Occident")),
        ],
    ),
    Notion(
        "monde_xvie.atlantique",
        "L'ouverture atlantique",
        "Après 1453 et 1492, les échanges basculent de la Méditerranée vers l'Atlantique : empires "
        "coloniaux, or et argent, esclavage, choc microbien.",
        [
            _q(1, "En quelle année Christophe Colomb atteint-il l'Amérique ?", "1492",
               "Colomb aborde aux Bahamas le 12 octobre 1492.", ("1453", "1517", "1789")),
            _q(1, "Pour quel royaume Christophe Colomb navigue-t-il ?",
               "l'Espagne (les Rois catholiques)", "Isabelle de Castille et Ferdinand d'Aragon "
               "financent son voyage.", ("le Portugal", "l'Angleterre", "la France")),
            _q(1, "Comment appelle-t-on les conquérants espagnols de l'Amérique ?",
               "les conquistadors", "Cortés et Pizarro sont les plus célèbres.",
               ("les croisés", "les corsaires", "les missionnaires")),
            _q(1, "Quel empire Hernán Cortés conquiert-il de 1519 à 1521 ?", "l'Empire aztèque",
               "Cortés prend Tenochtitlan, la capitale aztèque.",
               ("l'Empire inca", "l'Empire ottoman", "l'Empire mongol")),
            _q(2, "Quel empire Francisco Pizarro conquiert-il ?", "l'Empire inca",
               "Pizarro capture l'empereur inca Atahualpa en 1532.",
               ("l'Empire aztèque", "l'Empire byzantin", "l'Empire du Mali")),
            _q(2, "Quelle ville tombe aux mains des Ottomans en 1453 ?", "Constantinople",
               "La chute de Constantinople met fin à l'Empire byzantin.",
               ("Venise", "Grenade", "Rome")),
            _q(2, "Quel navigateur portugais atteint l'Inde en 1498 en contournant l'Afrique ?",
               "Vasco de Gama", "Il passe le cap de Bonne-Espérance et ouvre la route des épices.",
               ("Magellan", "Christophe Colomb", "Jacques Cartier")),
            _q(2, "D'où vient l'essentiel de l'argent qui afflue en Europe au XVIe siècle ?",
               "des mines du Potosí, dans les Andes", "L'argent des Amériques passe par Séville.",
               ("des mines d'Angleterre", "de Chine", "d'Afrique australe")),
            _q(3, "Quel dominicain défend les Amérindiens lors de la controverse de Valladolid "
               "(1550-1551) ?", "Bartolomé de Las Casas",
               "Las Casas s'oppose à Sepúlveda, qui justifie la conquête.",
               ("Juan Ginés de Sepúlveda", "Hernán Cortés", "Christophe Colomb")),
            _q(3, "Pourquoi la population amérindienne s'effondre-t-elle au XVIe siècle ?",
               "surtout à cause des maladies venues d'Europe, mais aussi des guerres et du travail "
               "forcé", "C'est le choc microbien : variole, grippe, rougeole.",
               ("à cause d'une famine due au froid", "parce qu'ils émigrent en Europe",
                "à cause d'éruptions volcaniques")),
            _q(3, "Où se développe d'abord l'économie sucrière fondée sur l'esclavage ?",
               "dans les îles portugaises de l'Atlantique, puis au Brésil",
               "Madère et São Tomé précèdent le Brésil, grand producteur de sucre.",
               ("en Angleterre", "en Inde", "en Égypte")),
            _q(3, "Quel traité partage en 1494 le monde à découvrir entre l'Espagne et le "
               "Portugal ?", "le traité de Tordesillas", "Une ligne nord-sud sépare les zones "
               "espagnole et portugaise.", ("le traité de Versailles", "les traités de Westphalie",
                                            "le traité d'Utrecht")),
        ],
    ),
    Notion(
        "monde_xvie.renaissance",
        "Renaissance, humanisme et réformes",
        "Imprimerie, retour aux textes antiques, homme au centre ; Luther (1517), Calvin, puis la "
        "Réforme catholique (concile de Trente).",
        [
            _q(1, "Qui met au point l'imprimerie à caractères mobiles en Europe, vers 1450 ?",
               "Gutenberg", "Gutenberg imprime une Bible à Mayence vers 1455.",
               ("Luther", "Érasme", "Léonard de Vinci")),
            _q(1, "Qui publie en 1517 ses 95 thèses contre les indulgences ?", "Martin Luther",
               "Luther ouvre le temps des réformes.", ("Jean Calvin", "Érasme", "Henri VIII")),
            _q(1, "Quel artiste entreprend en 1508 la fresque de la chapelle Sixtine ?", "Michel-Ange",
               "Michel-Ange peint la voûte de 1508 à 1512.",
               ("Léonard de Vinci", "Raphaël", "Botticelli")),
            _q(1, "Comment appelle-t-on le mouvement qui place l'homme au centre et redécouvre les "
               "textes antiques ?", "l'humanisme", "Les humanistes relisent les auteurs grecs et "
               "latins dans le texte.", ("les Lumières", "le baroque", "le romantisme")),
            _q(2, "Quel humaniste est surnommé le « prince des humanistes » ?", "Érasme",
               "Érasme de Rotterdam correspond avec toute l'Europe savante.",
               ("Rabelais", "Montaigne", "Luther")),
            _q(2, "Qu'est-ce qu'une indulgence ?",
               "une remise des peines du purgatoire accordée par l'Église, parfois contre de l'argent",
               "Leur vente choque Luther.", ("un impôt royal sur le sel", "une prière protestante",
                                            "un livre imprimé")),
            _q(2, "Quel réformateur organise une Église protestante à Genève ?", "Jean Calvin",
               "Calvin fait de Genève la « Rome protestante ».",
               ("Martin Luther", "Érasme", "Ignace de Loyola")),
            _q(2, "Comment s'appelle la réponse de l'Église catholique aux protestants ?",
               "la Réforme catholique (ou Contre-Réforme)",
               "Le concile de Trente (1545-1563) en fixe les règles.",
               ("la Renaissance", "le schisme d'Orient", "l'édit de Nantes")),
            _q(3, "Quel astronome propose au XVIe siècle que la Terre tourne autour du Soleil ?",
               "Copernic", "Son ouvrage paraît en 1543 : c'est l'héliocentrisme.",
               ("Ptolémée", "Newton", "Aristote")),
            _q(3, "Quelle ville italienne, autour des Médicis, est un grand foyer de la Renaissance ?",
               "Florence", "Les Médicis y protègent artistes et savants.",
               ("Venise", "Naples", "Milan")),
            _q(3, "Pourquoi l'imprimerie favorise-t-elle la Réforme ?",
               "Elle diffuse vite et en grand nombre les textes de Luther et la Bible en langue "
               "courante.", "Les idées nouvelles circulent plus vite que les copies à la main.",
               ("Elle est interdite aux catholiques.", "Elle remplace les églises.",
                "Elle n'imprime que des textes en latin.")),
            _q(3, "Quand s'ouvre le concile de Trente, qui définit la Réforme catholique ?",
               "en 1545", "Il siège par intermittence de 1545 à 1563.", ("en 1492", "en 1517", "en 1598")),
        ],
    ),
    Notion(
        "etat_moderne.france",
        "L'affirmation de l'État en France",
        "Le roi impose son autorité : guerre, administration, impôt, contrôle des religions et de la "
        "noblesse. De François Ier à Louis XIV.",
        [
            _q(1, "Quel roi est surnommé le « Roi-Soleil » ?", "Louis XIV",
               "Louis XIV règne de 1643 à 1715.", ("François Ier", "Henri IV", "Louis XVI")),
            _q(1, "Où Louis XIV installe-t-il la cour en 1682 ?", "à Versailles",
               "À Versailles, la noblesse vit sous le regard du roi.",
               ("au Louvre", "à Fontainebleau", "à Chambord")),
            _q(1, "Quel roi signe l'édit de Nantes en 1598 ?", "Henri IV",
               "Henri IV met fin aux guerres de Religion.", ("Louis XIV", "François Ier", "Henri II")),
            _q(1, "Que rend obligatoire l'ordonnance de Villers-Cotterêts (1539) ?",
               "le français dans les actes officiels et de justice",
               "Le français remplace le latin dans les actes du royaume.",
               ("le latin dans toutes les écoles", "la religion protestante", "l'impôt sur le sel")),
            _q(2, "Quel roi signe l'ordonnance de Villers-Cotterêts ?", "François Ier",
               "François Ier renforce l'administration du royaume.",
               ("Louis XIV", "Henri IV", "Louis XIII")),
            _q(2, "Que permet l'édit de Nantes ?",
               "aux protestants de pratiquer leur culte, sous conditions",
               "L'édit accorde aussi des places de sûreté aux protestants.",
               ("aux paysans de ne plus payer d'impôt", "au roi de choisir le pape",
                "aux nobles de lever des armées")),
            _q(2, "Quel ministre de Louis XIV développe la marine et les manufactures ?", "Colbert",
               "Colbert fonde aussi les compagnies des Indes et du Levant.",
               ("Richelieu", "Mazarin", "Sully")),
            _q(2, "Comment s'appelle la politique de Colbert, qui veut enrichir le royaume en "
               "exportant plus qu'il n'importe ?", "le mercantilisme",
               "On parle aussi de colbertisme.", ("le libéralisme", "le communisme", "la physiocratie")),
            _q(3, "En quelle année Louis XIV révoque-t-il l'édit de Nantes ?", "1685",
               "L'édit de Fontainebleau (1685) pousse de nombreux protestants à l'exil.",
               ("1598", "1661", "1715")),
            _q(3, "Quelle compagnie de commerce Colbert fonde-t-il en 1664 ?",
               "la Compagnie des Indes orientales",
               "Elle doit concurrencer les Hollandais et les Anglais en Asie.",
               ("la Compagnie de Jésus", "la Banque de France", "la Hanse")),
            _q(3, "Comment appelle-t-on une monarchie où le roi, de droit divin, concentre tous "
               "les pouvoirs ?", "une monarchie absolue",
               "Le roi ne partage pas son pouvoir, mais il doit respecter les lois de Dieu et du "
               "royaume.", ("une monarchie parlementaire", "une république", "une démocratie")),
            _q(3, "Qui représente le roi dans les provinces au XVIIe siècle ?", "les intendants",
               "Les intendants contrôlent la justice, la police et les finances.",
               ("les seigneurs", "les évêques", "les consuls")),
        ],
    ),
    Notion(
        "etat_moderne.britannique",
        "Le modèle britannique et son influence",
        "En Angleterre, le Parlement limite le roi (Habeas Corpus 1679, Bill of Rights 1689). Les "
        "philosophes s'en inspirent ; les colons américains s'en servent contre Londres.",
        [
            _q(1, "Quel texte de 1689 limite le pouvoir du roi d'Angleterre au profit du "
               "Parlement ?", "le Bill of Rights", "Le roi ne peut plus lever d'impôt ni d'armée "
               "sans le Parlement.", ("la Magna Carta", "l'édit de Nantes",
                                      "la Déclaration d'indépendance")),
            _q(1, "Qui est le premier président des États-Unis ?", "George Washington",
               "Washington est élu en 1789.", ("Thomas Jefferson", "Benjamin Franklin",
                                               "Abraham Lincoln")),
            _q(1, "En quelle année les treize colonies américaines déclarent-elles leur "
               "indépendance ?", "1776", "La Déclaration d'indépendance est adoptée le 4 juillet "
               "1776.", ("1689", "1789", "1492")),
            _q(1, "Quel philosophe français fait l'éloge de l'Angleterre dans ses Lettres "
               "philosophiques ?", "Voltaire", "Voltaire découvre l'Angleterre lors de son exil "
               "(1726-1728).", ("Montesquieu", "Rousseau", "Diderot")),
            _q(2, "Que garantit l'Habeas Corpus (1679) ?",
               "que nul ne peut être emprisonné sans être présenté à un juge",
               "Il protège contre les détentions arbitraires.",
               ("le droit de vote pour tous", "la liberté de religion",
                "l'élection du roi par le Parlement")),
            _q(2, "Comment appelle-t-on la révolution anglaise de 1688-1689, presque sans "
               "violence ?", "la Glorieuse Révolution", "Le Parlement remplace Jacques II par "
               "Guillaume d'Orange et Marie.", ("la Révolution française", "la Fronde",
                                                 "la guerre des Deux-Roses")),
            _q(2, "Quel régime l'Angleterre adopte-t-elle après 1689 ?", "une monarchie parlementaire",
               "Le roi règne, mais le Parlement vote les lois et l'impôt.",
               ("une monarchie absolue", "une république", "une dictature militaire")),
            _q(2, "Quel philosophe, admirateur du modèle anglais, défend la séparation des pouvoirs "
               "dans De l'esprit des lois (1748) ?", "Montesquieu",
               "Législatif, exécutif et judiciaire doivent être séparés.",
               ("Voltaire", "Rousseau", "Louis XIV")),
            _q(3, "En quelle année est rédigée la Constitution des États-Unis ?", "1787",
               "Elle est rédigée à Philadelphie en 1787.", ("1776", "1789", "1689")),
            _q(3, "Quelle limite la démocratie américaine présente-t-elle à sa naissance ?",
               "L'esclavage est maintenu et les Amérindiens sont exclus.",
               "Les principes de liberté ne s'appliquent pas à tous.",
               ("Le Parlement anglais garde le pouvoir.", "Il n'y a pas d'élections.",
                "Le président est nommé à vie par le roi.")),
            _q(3, "Quelle conséquence l'aide française aux Insurgents a-t-elle pour la France ?",
               "Elle aggrave la dette du royaume et diffuse les idées de liberté.",
               "La crise financière qui suit pèse sur la fin de l'Ancien Régime.",
               ("Elle enrichit durablement le royaume.", "Elle donne le Canada à la France.",
                "Elle met fin à la monarchie dès 1783.")),
            _q(3, "Quel roi d'Angleterre est chassé du trône en 1688 ?", "Jacques II",
               "Catholique et autoritaire, il est remplacé par Guillaume d'Orange.",
               ("Charles Ier", "Henri VIII", "Guillaume d'Orange")),
        ],
    ),
    Notion(
        "societes.lumieres",
        "Les Lumières et les sciences",
        "L'esprit scientifique s'affirme au XVIIe siècle (Galilée, Newton) et se diffuse au XVIIIe "
        "(L'Encyclopédie). Nouvelles techniques : la machine à vapeur.",
        [
            _q(1, "Quel savant italien est condamné par l'Église en 1633 pour avoir défendu "
               "l'héliocentrisme ?", "Galilée", "Galilée doit renier ses idées devant "
               "l'Inquisition.", ("Copernic", "Newton", "Léonard de Vinci")),
            _q(1, "Qui dirigent L'Encyclopédie ?", "Diderot et d'Alembert",
               "L'Encyclopédie rassemble les savoirs de leur temps.",
               ("Voltaire et Rousseau", "Montesquieu et Colbert", "Galilée et Newton")),
            _q(1, "Quel savant anglais formule la loi de la gravitation universelle ?", "Newton",
               "Ses Principia paraissent en 1687.", ("Galilée", "Descartes", "Lavoisier")),
            _q(1, "Comment appelle-t-on le mouvement intellectuel du XVIIIe siècle qui défend la "
               "raison et la liberté ?", "les Lumières", "Les philosophes des Lumières critiquent "
               "l'arbitraire et l'intolérance.", ("l'humanisme", "la Renaissance", "le romantisme")),
            _q(2, "Quelle femme de science traduit en français les Principia de Newton ?",
               "Émilie du Châtelet", "Sa traduction, publiée en 1759, fait référence.",
               ("Madame de Tencin", "Marie Curie", "Madame de Pompadour")),
            _q(2, "Qu'invente Thomas Newcomen en 1712 ?",
               "une machine à vapeur pour pomper l'eau des mines",
               "Elle annonce les débuts de la révolution industrielle.",
               ("la lunette astronomique", "le paratonnerre", "l'imprimerie")),
            _q(2, "Quel instrument Galilée tourne-t-il vers le ciel en 1609-1610 ?",
               "la lunette astronomique", "Il découvre les satellites de Jupiter.",
               ("le microscope", "le baromètre", "la boussole")),
            _q(2, "Que pensent les physiocrates ?",
               "que la terre et l'agriculture sont la source de la richesse",
               "Quesnay en est le chef de file.",
               ("que l'or des colonies fait la richesse", "que l'industrie est inutile",
                "que le roi doit tout produire lui-même")),
            _q(3, "Quel chimiste français établit la conservation de la masse dans les réactions "
               "chimiques ?", "Lavoisier", "Lavoisier fonde la chimie moderne.",
               ("Pascal", "Buffon", "Descartes")),
            _q(3, "Quelle machine à vapeur améliorée, vers 1769, prépare la révolution "
               "industrielle ?", "celle de James Watt",
               "Watt rend la machine plus efficace : elle pourra actionner des usines.",
               ("celle de Gutenberg", "celle de Galilée", "celle de Colbert")),
            _q(3, "En quelle année paraît le premier volume de L'Encyclopédie ?", "1751",
               "La publication s'étend jusqu'en 1772.", ("1689", "1789", "1712")),
            _q(3, "Où savants et philosophes se réunissent-ils souvent au XVIIIe siècle pour "
               "discuter ?", "dans les salons, les académies et les cafés",
               "Ces lieux de sociabilité diffusent les idées nouvelles.",
               ("dans les monastères seulement", "à la cour de Versailles seulement",
                "dans les casernes")),
        ],
    ),
    Notion(
        "societes.ordres",
        "La société d'ordres",
        "Trois ordres : clergé, noblesse, tiers état. Fiscalité et droits seigneuriaux pèsent sur "
        "les paysans ; l'économie de plantation et la traite enrichissent les ports.",
        [
            _q(1, "Quels sont les trois ordres de la société d'Ancien Régime ?",
               "le clergé, la noblesse et le tiers état", "Chacun a son rôle et ses privilèges.",
               ("les rois, les ducs et les comtes", "les riches, les pauvres et les esclaves",
                "les paysans, les ouvriers et les marchands")),
            _q(1, "Quel ordre paie la taille, le principal impôt royal ?", "le tiers état",
               "Le clergé et la noblesse en sont exemptés.", ("la noblesse", "le clergé", "le roi")),
            _q(1, "Qu'est-ce que la traite négrière ?", "le commerce des esclaves africains",
               "Des millions d'Africains sont déportés vers les Amériques.",
               ("un impôt sur le sel", "le commerce des épices", "une révolte paysanne")),
            _q(1, "Quels ports français s'enrichissent par la traite au XVIIIe siècle ?",
               "Nantes et Bordeaux", "Nantes est le premier port négrier français.",
               ("Lyon et Strasbourg", "Lille et Reims", "Toulouse et Dijon")),
            _q(2, "Comment appelle-t-on le commerce entre l'Europe, l'Afrique et l'Amérique au "
               "XVIIIe siècle ?", "le commerce triangulaire",
               "Marchandises vers l'Afrique, esclaves vers l'Amérique, sucre et café vers l'Europe.",
               ("la route de la soie", "le mercantilisme", "la Hanse")),
            _q(2, "Quelle révolte paysanne éclate en Normandie en 1639 ?",
               "la révolte des Va-nu-pieds", "Elle proteste contre l'impôt et la gabelle.",
               ("la Fronde", "la Jacquerie", "la Saint-Barthélemy")),
            _q(2, "Quelle femme anime un salon littéraire célèbre au XVIIIe siècle ?",
               "Madame de Tencin", "Elle reçoit écrivains et philosophes à Paris.",
               ("Marie-Antoinette", "Jeanne d'Arc", "Catherine de Médicis")),
            _q(2, "Quel texte de 1685 réglemente l'esclavage dans les colonies françaises ?",
               "le Code noir", "Il fait de l'esclave un « bien meuble ».",
               ("l'édit de Nantes", "le Bill of Rights", "l'ordonnance de Villers-Cotterêts")),
            _q(3, "Que sont les droits seigneuriaux ?",
               "des taxes et des corvées que les paysans doivent à leur seigneur",
               "Ils s'ajoutent aux impôts du roi et à la dîme.",
               ("des privilèges accordés aux paysans", "un salaire versé par le roi",
                "les lois de l'Église")),
            _q(3, "Quel impôt le clergé prélève-t-il sur les récoltes ?", "la dîme",
               "Environ un dixième des récoltes revient à l'Église.",
               ("la taille", "la gabelle", "la corvée")),
            _q(3, "Quel impôt sur le sel est très détesté sous l'Ancien Régime ?", "la gabelle",
               "Le sel, indispensable pour conserver les aliments, est lourdement taxé.",
               ("la dîme", "la taille", "le misthos")),
            _q(3, "Que montre l'opposition entre riches et pauvres à Paris au XVIIIe siècle ?",
               "La richesse crée de nouvelles hiérarchies à côté des ordres.",
               "Un riche négociant du tiers état peut vivre mieux qu'un noble pauvre.",
               ("Les ordres ont disparu.", "Tous les nobles sont riches.",
                "Le clergé gouverne la ville.")),
        ],
    ),
    # --- Géographie ---------------------------------------------------------------------------
    Notion(
        "environnements.risques",
        "Les sociétés face aux risques",
        "Risque = aléa + enjeux vulnérables. La vulnérabilité dépend du développement ; la "
        "résilience est la capacité à se relever.",
        [
            _q(1, "Comment appelle-t-on la rencontre entre un aléa et des enjeux humains "
               "vulnérables ?", "un risque", "Sans population ni biens exposés, il n'y a pas de "
               "risque.", ("une ressource", "un milieu", "une transition")),
            _q(1, "Qu'est-ce qu'un aléa ?",
               "un phénomène naturel ou technologique qui peut se produire (séisme, crue…)",
               "L'aléa est l'événement possible ; le risque dépend aussi des enjeux.",
               ("une catastrophe déjà arrivée", "une ressource naturelle", "un plan d'urgence")),
            _q(1, "Lequel est un risque naturel ?", "un séisme",
               "Le séisme a une origine naturelle.",
               ("l'explosion d'une usine chimique", "une marée noire", "un accident nucléaire")),
            _q(1, "Lequel est un risque technologique ?", "l'explosion d'une usine chimique",
               "Il naît d'une activité humaine.",
               ("un cyclone", "une éruption volcanique", "un tsunami")),
            _q(2, "Qu'est-ce que la vulnérabilité d'une société ?",
               "sa fragilité face à un aléa (pauvreté, constructions, préparation)",
               "Plus une société est vulnérable, plus l'aléa fait de dégâts.",
               ("sa richesse en ressources", "sa capacité à prévoir la météo", "le nombre de touristes")),
            _q(2, "Quel effet du changement climatique menace les littoraux densément peuplés ?",
               "la montée du niveau des mers", "Deltas et villes côtières sont très exposés.",
               ("le refroidissement des océans", "la disparition des marées",
                "l'arrêt des cyclones")),
            _q(2, "Que veut dire « résilience » ?",
               "la capacité d'une société à se relever après une catastrophe",
               "Une société résiliente reconstruit vite et apprend de la crise.",
               ("la fréquence d'un aléa", "l'absence de tout risque", "la vitesse d'un séisme")),
            _q(2, "Quel pays très peuplé, dans le delta du Gange, est très exposé aux inondations "
               "et aux cyclones ?", "le Bangladesh", "Une grande partie du pays est à quelques "
               "mètres au-dessus de la mer.", ("la Mongolie", "le Tchad", "la Suisse")),
            _q(3, "Pourquoi un même séisme fait-il souvent plus de victimes dans un pays pauvre ?",
               "Les bâtiments sont moins solides et les secours moins préparés.",
               "La vulnérabilité est plus forte, même si l'aléa est le même.",
               ("Les séismes y sont toujours plus forts.", "Les habitants y sont plus nombreux "
                "par maison, rien d'autre.", "Il n'y a pas de séismes dans les pays riches.")),
            _q(3, "En France, quel document limite les constructions dans les zones à risque ?",
               "le plan de prévention des risques", "Il délimite les zones inondables ou "
               "exposées.", ("le plan local de tourisme", "le cadastre des forêts",
                             "le code de la route")),
            _q(3, "Quelle catastrophe de 2011, au Japon, associe séisme, tsunami et accident "
               "nucléaire ?", "Fukushima", "Le tsunami a endommagé la centrale nucléaire.",
               ("Tchernobyl", "Lubrizol", "AZF")),
            _q(3, "Pourquoi l'Arctique attire-t-il davantage avec le réchauffement ?",
               "La fonte de la glace ouvre des routes maritimes et l'accès à des ressources.",
               "L'Arctique est à la fois fragile et convoité.",
               ("Il devient une destination de baignade.", "Ses villes deviennent très peuplées.",
                "Il n'est plus soumis à aucun risque.")),
        ],
    ),
    Notion(
        "environnements.ressources",
        "Des ressources sous pression",
        "Eau et énergie : besoins croissants, tensions entre usagers et entre États ; la transition "
        "énergétique cherche à réduire les énergies fossiles.",
        [
            _q(1, "Laquelle est une ressource renouvelable ?", "l'énergie solaire",
               "Le Soleil ne s'épuise pas à notre échelle.", ("le pétrole", "le charbon", "le gaz naturel")),
            _q(1, "Quelle activité utilise le plus d'eau douce dans le monde ?",
               "l'agriculture (irrigation)", "Elle consomme environ 70 % de l'eau prélevée.",
               ("l'industrie", "les ménages", "le tourisme")),
            _q(1, "Que veut dire « stress hydrique » ?", "manquer d'eau par rapport aux besoins",
               "Le stress hydrique touche surtout les régions arides et très peuplées.",
               ("avoir trop d'eau", "polluer une rivière", "construire un barrage")),
            _q(1, "Laquelle est une énergie fossile ?", "le pétrole",
               "Le pétrole vient de matières organiques enfouies pendant des millions d'années.",
               ("l'éolien", "l'hydroélectricité", "le solaire")),
            _q(2, "Pourquoi l'eau des fleuves provoque-t-elle des tensions entre pays ?",
               "Un barrage en amont peut priver d'eau les pays situés en aval.",
               "Les grands fleuves traversent souvent plusieurs États.",
               ("Les fleuves changent de pays chaque année.", "L'eau des fleuves est salée.",
                "Les pays d'aval interdisent la pêche.")),
            _q(2, "Comment s'appelle le passage des énergies fossiles vers des énergies moins "
               "polluantes ?", "la transition énergétique", "Elle répond au changement climatique.",
               ("la transition démographique", "la mondialisation", "l'exode rural")),
            _q(2, "Quelle grande forêt tropicale est menacée par la déforestation (soja, élevage) ?",
               "la forêt amazonienne", "Elle s'étend surtout au Brésil.",
               ("la forêt boréale de Sibérie", "la forêt des Landes", "la forêt de Brocéliande")),
            _q(2, "Qu'est-ce que le dessalement ?", "transformer l'eau de mer en eau douce",
               "Il est très utilisé dans les pays du golfe Persique, mais consomme beaucoup "
               "d'énergie.", ("ajouter du sel à l'eau", "nettoyer une plage", "irriguer un désert")),
            _q(3, "Quel fleuve est au cœur de tensions entre l'Égypte et l'Éthiopie, autour d'un "
               "grand barrage ?", "le Nil", "Le grand barrage de la Renaissance est construit en "
               "Éthiopie, en amont de l'Égypte.", ("le Niger", "le Congo", "le Zambèze")),
            _q(3, "Qu'est-ce qu'un développement durable ?",
               "un développement qui répond aux besoins actuels sans compromettre ceux des "
               "générations futures", "Il concilie économie, société et environnement.",
               ("une croissance la plus rapide possible", "l'arrêt de toute activité industrielle",
                "un développement réservé aux pays riches")),
            _q(3, "Quelles ressources font du golfe Persique un espace stratégique ?",
               "le pétrole et le gaz", "Le Golfe concentre une grande part des réserves mondiales.",
               ("le bois et le charbon", "le café et le cacao", "l'or et les diamants")),
            _q(3, "Pourquoi les métaux rares (terres rares, lithium) sont-ils stratégiques ?",
               "Ils servent aux batteries, aux éoliennes et aux téléphones.",
               "La transition énergétique en a besoin, et leur production est très concentrée.",
               ("Ils remplacent le pétrole dans les voitures à essence.",
                "Ils sont inépuisables.", "Ils ne servent qu'à la bijouterie.")),
        ],
    ),
    Notion(
        "environnements.france",
        "La France : des milieux à valoriser et protéger",
        "Milieux variés en métropole et dans les Outre-mer : richesses à valoriser (tourisme, "
        "ressources, domaine maritime) et à protéger (parcs, littoral, risques).",
        [
            _q(1, "Comment appelle-t-on les territoires français situés hors d'Europe (La Réunion, "
               "la Guyane…) ?", "les Outre-mer", "On parle aussi de territoires ultramarins.",
               ("les colonies", "les régions frontalières", "les métropoles")),
            _q(1, "Quel est le plus haut sommet de France et des Alpes ?", "le mont Blanc",
               "Il dépasse 4 800 mètres.", ("le Mont-Saint-Michel", "le puy de Dôme", "le Vignemale")),
            _q(1, "Quel territoire français d'Amérique du Sud est couvert de forêt amazonienne ?",
               "la Guyane", "La forêt couvre la plus grande partie de la Guyane.",
               ("la Martinique", "La Réunion", "Mayotte")),
            _q(1, "Qu'est-ce qu'un parc national ?", "un espace protégé pour sa nature remarquable",
               "La France en compte onze, en métropole et dans les Outre-mer.",
               ("un grand parc d'attractions", "une zone industrielle", "un jardin de ville")),
            _q(2, "Grâce à ses Outre-mer, quel atout maritime la France possède-t-elle ?",
               "le deuxième plus grand domaine maritime du monde",
               "Ses zones économiques exclusives couvrent plus de 10 millions de km².",
               ("le plus petit littoral d'Europe", "aucune zone de pêche", "la plus grande "
                "flotte de pétroliers")),
            _q(2, "Quel risque naturel menace particulièrement les Antilles françaises ?",
               "les cyclones", "Les Antilles sont aussi exposées aux séismes et aux volcans.",
               ("les avalanches", "les tempêtes de neige", "les glissements de glaciers")),
            _q(2, "Quel volcan actif se trouve à La Réunion ?", "le piton de la Fournaise",
               "C'est l'un des volcans les plus actifs du monde.",
               ("la montagne Pelée", "le Vésuve", "l'Etna")),
            _q(2, "Que fait le Conservatoire du littoral ?",
               "il achète des terrains sur les côtes pour les protéger",
               "Il protège les rivages de l'urbanisation.",
               ("il construit des ports de plaisance", "il vend des plages à des hôtels",
                "il organise des courses de voiliers")),
            _q(3, "Comment appelle-t-on la zone de 200 milles marins où un État exploite les "
               "ressources de la mer ?", "la zone économique exclusive", "On la note aussi ZEE.",
               ("les eaux internationales", "la mer territoriale de 12 milles", "le plateau "
                "continental européen")),
            _q(3, "Quel est le plus grand parc national de France ?", "le parc amazonien de Guyane",
               "Il protège une immense forêt tropicale.",
               ("le parc des Écrins", "le parc des Cévennes", "le parc de Port-Cros")),
            _q(3, "Quel conflit d'usage touche souvent les littoraux français ?",
               "le tourisme, l'urbanisation et la protection de la nature se disputent l'espace",
               "Le littoral est très attractif, donc très convoité.",
               ("les agriculteurs refusent d'y cultiver", "personne ne veut y habiter",
                "les ports y sont interdits")),
            _q(3, "Qu'est-ce que le recul du trait de côte ?",
               "l'érosion qui fait reculer le littoral vers l'intérieur des terres",
               "Il menace des maisons et des routes, surtout sur les côtes sableuses.",
               ("l'avancée de la mer à marée haute seulement", "la construction de nouvelles "
                "plages", "la baisse du niveau de la mer")),
        ],
    ),
    Notion(
        "developpement.demographie",
        "Trajectoires démographiques",
        "Transition démographique : la mortalité baisse, puis la natalité. Certains pays croissent "
        "vite (Afrique), d'autres vieillissent (Japon, Europe).",
        [
            _q(1, "Combien d'habitants la Terre compte-t-elle environ au milieu des années 2020 ?",
               "8 milliards", "Le cap des 8 milliards a été franchi en 2022.",
               ("2 milliards", "4 milliards", "15 milliards")),
            _q(1, "Quel est le pays le plus peuplé du monde depuis 2023 ?", "l'Inde",
               "L'Inde a dépassé la Chine.", ("la Chine", "les États-Unis", "l'Indonésie")),
            _q(1, "Qu'est-ce que le vieillissement d'une population ?",
               "la part des personnes âgées augmente",
               "Il vient de la baisse de la natalité et de l'allongement de la vie.",
               ("tous les habitants ont plus de 60 ans", "la natalité augmente fortement",
                "la population diminue de moitié")),
            _q(1, "Quel continent connaît la croissance démographique la plus forte ?", "l'Afrique",
               "La fécondité y reste élevée.", ("l'Europe", "l'Amérique du Nord", "l'Océanie")),
            _q(2, "Comment s'appelle le passage d'une natalité et d'une mortalité fortes à une "
               "natalité et une mortalité faibles ?", "la transition démographique",
               "Pendant la transition, la population augmente vite.",
               ("la transition énergétique", "l'exode rural", "la mondialisation")),
            _q(2, "Qu'est-ce que l'indice de fécondité ?", "le nombre moyen d'enfants par femme",
               "Il mesure la natalité d'un pays.", ("le nombre de naissances par an",
                                                    "l'âge moyen des mères", "le nombre de mariages")),
            _q(2, "Quel pays d'Asie est l'un des plus touchés par le vieillissement ?", "le Japon",
               "Près de trois Japonais sur dix ont plus de 65 ans.",
               ("le Niger", "l'Inde", "le Nigeria")),
            _q(2, "Qu'est-ce que l'accroissement naturel ?",
               "la différence entre les naissances et les décès",
               "Il ne tient pas compte des migrations.",
               ("les naissances et les arrivées de migrants", "le nombre de décès par an",
                "l'augmentation de la richesse")),
            _q(3, "Quel indice de fécondité assure le renouvellement des générations ?",
               "environ 2,1 enfants par femme", "Il faut un peu plus de deux enfants pour "
               "remplacer les deux parents.", ("1 enfant par femme", "3,5 enfants par femme",
                                               "5 enfants par femme")),
            _q(3, "Quel défi pose le vieillissement d'une population ?",
               "financer les retraites et la santé avec moins d'actifs",
               "La part des personnes en âge de travailler diminue.",
               ("construire beaucoup d'écoles", "nourrir une population très jeune",
                "réduire le nombre de médecins")),
            _q(3, "Quelle politique la Chine a-t-elle menée de 1979 à 2015 pour limiter les "
               "naissances ?", "la politique de l'enfant unique",
               "Elle accélère le vieillissement de la population chinoise.",
               ("une politique nataliste", "la fermeture des frontières", "l'exode rural forcé")),
            _q(3, "Comment appelle-t-on l'avantage d'avoir beaucoup de jeunes adultes en âge de "
               "travailler ?", "le dividende démographique",
               "Il peut favoriser la croissance s'il y a des emplois et une bonne formation.",
               ("le vieillissement", "la décroissance", "le baby-boom")),
        ],
    ),
    Notion(
        "developpement.inegalites",
        "Développement et inégalités",
        "Le développement ne se mesure pas qu'avec la richesse (PIB) : l'IDH ajoute la santé et "
        "l'éducation. Les inégalités existent entre pays et à l'intérieur des pays.",
        [
            _q(1, "Que mesure l'indice de développement humain (IDH) ?",
               "la santé, l'éducation et le niveau de vie",
               "L'IDH combine espérance de vie, durée de scolarisation et revenu par habitant.",
               ("seulement la richesse produite", "le nombre d'habitants", "la surface d'un pays")),
            _q(1, "Quel indicateur mesure la richesse produite dans un pays en un an ?", "le PIB",
               "PIB : produit intérieur brut.", ("l'IDH", "l'indice de fécondité",
                                                 "l'espérance de vie")),
            _q(1, "Qu'est-ce qu'un pays émergent ?",
               "un pays en forte croissance qui s'intègre à la mondialisation",
               "Le Brésil, l'Inde ou la Chine en sont des exemples.",
               ("un pays qui vient d'être créé", "un pays sans aucune industrie",
                "un pays qui perd des habitants")),
            _q(1, "Lequel est un pays émergent ?", "le Brésil",
               "Le Brésil est une grande puissance agricole et industrielle émergente.",
               ("le Niger", "la Norvège", "la Suisse")),
            _q(2, "Pourquoi le PIB par habitant ne suffit-il pas à mesurer le développement ?",
               "Il ne dit rien de la santé, de l'éducation ni des inégalités.",
               "Une moyenne peut cacher de grands écarts.",
               ("Il est calculé seulement tous les cent ans.", "Il ne compte que l'agriculture.",
                "Il mesure seulement la population.")),
            _q(2, "Comment appelle-t-on les quartiers pauvres et informels des grandes villes du "
               "Brésil ?", "les favelas", "Ils côtoient des quartiers très riches.",
               ("les townships", "les gated communities", "les banlieues pavillonnaires")),
            _q(2, "Quelle organisation publie chaque année le classement de l'IDH ?",
               "le Programme des Nations unies pour le développement",
               "On l'appelle le PNUD.", ("l'Union européenne", "la Banque de France", "l'OTAN")),
            _q(2, "Quel continent regroupe la plupart des pays à l'IDH le plus faible ?", "l'Afrique",
               "Surtout l'Afrique subsaharienne.", ("l'Europe", "l'Amérique du Nord", "l'Océanie")),
            _q(3, "Que mesure le coefficient de Gini ?", "les inégalités de revenus dans un pays",
               "0 : égalité parfaite ; 1 : inégalité maximale.",
               ("la croissance du PIB", "la densité de population", "le nombre de touristes")),
            _q(3, "Qu'est-ce qu'une « gated community » ?",
               "un quartier résidentiel fermé et surveillé, pour les plus riches",
               "Ces quartiers montrent la séparation entre riches et pauvres.",
               ("un camp de réfugiés", "un parc national", "un quartier industriel")),
            _q(3, "Pourquoi l'Inde est-elle un pays de forts contrastes ?",
               "Une économie en forte croissance coexiste avec une grande pauvreté.",
               "Les services informatiques côtoient une agriculture pauvre.",
               ("Tous ses habitants sont riches.", "Elle n'a aucune industrie.",
                "Sa population diminue très vite.")),
            _q(3, "Qu'est-ce qu'un pays moins avancé (PMA) pour l'ONU ?",
               "un des pays les plus pauvres et les plus fragiles du monde",
               "La plupart des PMA sont en Afrique.",
               ("un pays émergent", "un pays très industrialisé", "un pays sans armée")),
        ],
    ),
    Notion(
        "developpement.france",
        "La France : population et inégalités",
        "Une population qui vieillit mais continue de croître ; des territoires attractifs "
        "(métropoles, littoraux, Sud et Ouest) et d'autres en difficulté ; des Outre-mer contrastés.",
        [
            _q(1, "Combien d'habitants la France compte-t-elle environ, Outre-mer compris ?",
               "68 millions", "L'Insee compte environ 68 millions d'habitants en 2024.",
               ("40 millions", "100 millions", "150 millions")),
            _q(1, "Quelle est la plus grande aire urbaine de France ?", "Paris",
               "L'aire parisienne compte environ 13 millions d'habitants.",
               ("Lyon", "Marseille", "Lille")),
            _q(1, "Quels espaces français attirent de nombreux habitants ?",
               "les grandes métropoles et les littoraux", "Le Sud et l'Ouest sont particulièrement "
               "attractifs.", ("les montagnes du centre", "les zones industrielles anciennes",
                               "les campagnes isolées")),
            _q(1, "Quel département d'Outre-mer a la population la plus jeune et la croissance la "
               "plus forte ?", "Mayotte", "Mayotte a une natalité très élevée.",
               ("la Martinique", "la Guadeloupe", "Saint-Pierre-et-Miquelon")),
            _q(2, "Que désigne la « diagonale des faibles densités » ?",
               "une bande peu peuplée des Ardennes aux Pyrénées",
               "Elle traverse le centre de la France.",
               ("les littoraux méditerranéens", "la vallée du Rhône", "la région parisienne")),
            _q(2, "Quels territoires d'Outre-mer vieillissent le plus vite ?",
               "la Martinique et la Guadeloupe", "Beaucoup de jeunes partent étudier ou travailler "
               "ailleurs.", ("Mayotte et la Guyane", "La Réunion et Mayotte", "la Guyane seule")),
            _q(2, "Qu'est-ce que la périurbanisation ?",
               "l'extension des villes vers les campagnes proches",
               "Des ménages s'installent en périphérie, souvent en maison individuelle.",
               ("l'abandon total des villes", "la construction de gratte-ciel au centre",
                "le départ vers l'étranger")),
            _q(2, "À quoi sert la politique de la ville ?",
               "à réduire les inégalités dans des quartiers en difficulté",
               "Elle finance logements, transports et services dans ces quartiers.",
               ("à construire de nouvelles villes à la campagne", "à fermer les petites communes",
                "à interdire les voitures en ville")),
            _q(3, "Par rapport à la métropole, comment sont souvent le chômage et la pauvreté dans "
               "les Outre-mer ?", "plus élevés", "Les Outre-mer cumulent souvent chômage, "
               "pauvreté et vie chère.", ("plus faibles", "identiques", "inexistants")),
            _q(3, "Quel fonds européen aide les régions les moins développées de l'Union ?",
               "le Fonds européen de développement régional (FEDER)",
               "Il finance des infrastructures et des projets locaux.",
               ("la politique agricole commune", "l'euro numérique", "le programme Erasmus+")),
            _q(3, "Pourquoi l'espérance de vie progresse-t-elle en France sur le long terme ?",
               "grâce aux progrès de la médecine et des conditions de vie",
               "Elle dépasse 80 ans.", ("grâce à la hausse de la natalité", "grâce à l'immigration "
                                        "seulement", "parce que la population diminue")),
            _q(3, "Comment appelle-t-on les écarts de richesse et d'accès aux services entre "
               "territoires ?", "des inégalités territoriales",
               "Elles opposent par exemple centres-villes, banlieues et campagnes isolées.",
               ("des inégalités démographiques", "une transition urbaine", "une mobilité pendulaire")),
        ],
    ),
    Notion(
        "mobilites.migrations",
        "Les migrations internationales",
        "Migrer : s'installer durablement dans un autre pays (travail, études, fuite d'un danger). "
        "Les flux vont du Sud vers le Nord, mais aussi beaucoup entre pays du Sud.",
        [
            _q(1, "Comment appelle-t-on une personne qui va vivre dans un autre pays ?",
               "un migrant", "Pour son pays de départ, c'est un émigré ; pour son pays "
               "d'arrivée, un immigré.", ("un touriste", "un frontalier", "un réfugié climatique "
                                          "seulement")),
            _q(1, "Comment appelle-t-on une personne qui fuit la guerre ou les persécutions et "
               "obtient une protection ?", "un réfugié", "Le statut de réfugié est défini par "
               "la convention de Genève (1951).", ("un touriste", "un expatrié", "un frontalier")),
            _q(1, "Quelle mer est l'une des routes migratoires les plus dangereuses du monde ?",
               "la Méditerranée", "Des milliers de migrants y meurent chaque année.",
               ("la mer du Nord", "la mer Baltique", "la mer de Chine")),
            _q(1, "Quel pays accueille le plus grand nombre de migrants internationaux ?",
               "les États-Unis", "Environ un migrant international sur cinq y vit.",
               ("le Japon", "la Chine", "le Brésil")),
            _q(2, "Que sont les remises (transferts de fonds) des migrants ?",
               "l'argent qu'ils envoient à leur famille restée au pays",
               "Pour certains pays, c'est une ressource essentielle.",
               ("les impôts payés par les touristes", "les aides de l'ONU",
                "les billets d'avion remboursés")),
            _q(2, "Quels facteurs poussent le plus souvent à partir ?",
               "la guerre, la pauvreté, les persécutions et les catastrophes",
               "D'autres facteurs attirent vers un pays : emploi, études, sécurité.",
               ("le beau temps du pays d'arrivée seulement", "le tourisme",
                "les fêtes religieuses")),
            _q(2, "Quelle ville du golfe Persique attire de très nombreux travailleurs immigrés ?",
               "Dubaï", "Les étrangers y sont très majoritaires.", ("Téhéran", "Bagdad", "Le Caire")),
            _q(2, "Comment appelle-t-on l'espace où l'on circule sans contrôle aux frontières "
               "intérieures, en Europe ?", "l'espace Schengen",
               "Il réunit la plupart des pays de l'Union européenne et quelques voisins.",
               ("la zone euro", "l'OTAN", "le Commonwealth")),
            _q(3, "Qu'est-ce que la « fuite des cerveaux » ?",
               "le départ de personnes très diplômées vers d'autres pays",
               "Le pays de départ perd des compétences.",
               ("l'oubli des connaissances", "l'arrivée de touristes", "la fermeture des universités")),
            _q(3, "Quel programme européen favorise la mobilité des étudiants ?", "Erasmus+",
               "Il permet d'étudier dans un autre pays européen.",
               ("Schengen", "Frontex", "la PAC")),
            _q(3, "Les migrations internationales vont-elles surtout du Sud vers le Nord ?",
               "Non : une grande part se fait entre pays du Sud.",
               "Les migrations Sud-Sud sont presque aussi nombreuses que les migrations Sud-Nord.",
               ("Oui, uniquement du Sud vers le Nord.", "Non, surtout du Nord vers le Sud.",
                "Il n'y a plus de migrations aujourd'hui.")),
            _q(3, "Qu'est-ce qu'un pays de transit ?",
               "un pays que les migrants traversent avant d'atteindre leur destination",
               "Le Maroc, la Libye ou la Turquie sont des pays de transit vers l'Europe.",
               ("un pays sans frontières", "un pays qui interdit les avions",
                "le pays de naissance d'un migrant")),
        ],
    ),
    Notion(
        "mobilites.tourisme",
        "Les mobilités touristiques",
        "Le tourisme international explose avec l'avion : de nouveaux touristes (pays émergents) "
        "et de nouvelles destinations, mais aussi le surtourisme.",
        [
            _q(1, "Quel pays reçoit le plus de touristes internationaux au monde ?", "la France",
               "Elle accueille près de 100 millions de touristes étrangers par an.",
               ("l'Allemagne", "le Brésil", "le Japon")),
            _q(1, "Qu'est-ce que l'écotourisme ?",
               "un tourisme respectueux de la nature et des habitants",
               "Il cherche à protéger les milieux visités.",
               ("un tourisme dans les usines", "un tourisme réservé aux villes",
                "un tourisme de shopping")),
            _q(1, "Quel moyen de transport a permis l'essor du tourisme international ?", "l'avion",
               "Les vols à bas prix ont encore accéléré cet essor.",
               ("le cheval", "la diligence", "le canal")),
            _q(1, "Quel continent reçoit le plus de touristes internationaux ?", "l'Europe",
               "Environ la moitié des arrivées mondiales.", ("l'Afrique", "l'Océanie",
                                                             "l'Amérique du Sud")),
            _q(2, "Qu'est-ce que le surtourisme ?",
               "trop de touristes dans un même lieu, au détriment des habitants et de "
               "l'environnement", "Certaines villes limitent désormais le nombre de visiteurs.",
               ("l'absence de touristes", "un tourisme de luxe", "le tourisme spatial")),
            _q(2, "Quelle ville italienne est un exemple de surtourisme ?", "Venise",
               "Venise a mis en place une taxe d'entrée pour les visiteurs à la journée.",
               ("Turin", "Bologne", "Milan")),
            _q(2, "D'où viennent de plus en plus de touristes internationaux ?",
               "des pays émergents, comme la Chine", "Leurs classes moyennes voyagent davantage.",
               ("uniquement d'Europe", "des pays les plus pauvres", "des îles du Pacifique")),
            _q(2, "Quel pays perçoit les plus grandes recettes du tourisme international ?",
               "les États-Unis", "Les touristes y dépensent plus qu'ailleurs.",
               ("la France", "l'Espagne", "le Maroc")),
            _q(3, "Quel parc d'Afrique du Sud est célèbre pour ses safaris ?", "le parc Kruger",
               "Il est l'un des plus grands parcs d'Afrique.",
               ("le parc des Écrins", "le parc de Yellowstone", "le parc du Serengeti")),
            _q(3, "Pourquoi le tourisme peut-il accroître les inégalités ?",
               "Les profits vont souvent à de grandes entreprises, et les habitants en profitent "
               "peu.", "Les espaces touristiques peuvent devenir des enclaves.",
               ("Il fait toujours baisser les prix.", "Il interdit le commerce local.",
                "Il n'emploie jamais de salariés.")),
            _q(3, "Quelle ville des Émirats arabes unis est devenue un pôle touristique mondial ?",
               "Dubaï", "Hôtels de luxe, centres commerciaux et hub aérien attirent les visiteurs.",
               ("Riyad", "Bagdad", "Kaboul")),
            _q(3, "Comment appelle-t-on un lieu créé ou aménagé pour accueillir les touristes ?",
               "une station touristique", "Stations de ski ou balnéaires en sont des exemples.",
               ("une zone franche", "une métropole", "un port de commerce")),
        ],
    ),
    Notion(
        "mobilites.france",
        "La France : mobilités et transports",
        "Mobilités quotidiennes, saisonnières, ponctuelles ; réseau en étoile autour de Paris ; "
        "inégalités d'accès ; transition vers des mobilités plus durables.",
        [
            _q(1, "Comment appelle-t-on les trajets quotidiens entre le domicile et le travail ?",
               "les migrations pendulaires", "On fait l'aller le matin et le retour le soir.",
               ("les migrations internationales", "le tourisme", "l'exode rural")),
            _q(1, "Quel réseau relie à grande vitesse les grandes villes françaises ?",
               "les lignes à grande vitesse du TGV", "Il met Lyon à environ deux heures de Paris.",
               ("les canaux", "les routes départementales", "les pistes cyclables")),
            _q(1, "Quelle ville est au centre du réseau de transport français ?", "Paris",
               "Autoroutes et TGV rayonnent depuis Paris.", ("Lyon", "Toulouse", "Bordeaux")),
            _q(1, "Quel moyen de transport domine pour les trajets domicile-travail en France ?",
               "la voiture", "Environ trois actifs sur quatre vont travailler en voiture.",
               ("le vélo", "le train", "la marche")),
            _q(2, "Qu'est-ce que la continuité territoriale ?",
               "aider les habitants des îles et des Outre-mer à se déplacer comme en métropole",
               "L'État aide par exemple à payer certains billets d'avion ou de bateau.",
               ("relier toutes les villes par TGV", "supprimer les frontières de l'Europe",
                "construire des routes en montagne seulement")),
            _q(2, "Qu'est-ce que la fracture numérique territoriale ?",
               "des territoires moins bien reliés à internet (fibre, réseau mobile)",
               "Les zones rurales isolées sont souvent les moins bien couvertes.",
               ("une panne d'électricité", "une faille sismique", "une frontière fermée")),
            _q(2, "Qu'est-ce que la distance-temps ?",
               "le temps nécessaire pour aller d'un lieu à un autre",
               "Le TGV réduit la distance-temps entre les grandes villes.",
               ("la distance en kilomètres", "le décalage horaire", "la durée d'un voyage en avion "
                "seulement")),
            _q(2, "Quel tunnel relie la France au Royaume-Uni ?", "le tunnel sous la Manche",
               "Il est ouvert depuis 1994.", ("le tunnel du Mont-Blanc", "le tunnel du Fréjus",
                                              "le tunnel de Fourvière")),
            _q(3, "Quelles mobilités les villes développent-elles pour réduire la pollution ?",
               "le vélo, le tramway et les transports en commun",
               "Elles participent à la transition vers des mobilités durables.",
               ("les voitures diesel", "les vols intérieurs courts", "les poids lourds")),
            _q(3, "Comment appelle-t-on un réseau organisé en étoile autour de Paris ?",
               "un réseau radial", "Les liaisons entre villes de province sont plus difficiles.",
               ("un réseau maillé", "un réseau circulaire", "un réseau linéaire")),
            _q(3, "Quel grand port est la porte d'entrée maritime de Paris, par la Seine ?",
               "Le Havre", "Le Havre, Rouen et Paris forment l'axe de la Seine.",
               ("Marseille", "Brest", "Bordeaux")),
            _q(3, "Qu'est-ce qu'un aéroport « hub » ?",
               "une plaque tournante où se font de nombreuses correspondances",
               "Roissy-Charles-de-Gaulle est le grand hub français.",
               ("un petit aéroport régional", "un aéroport réservé au fret", "un aéroport militaire")),
        ],
    ),
    Notion(
        "afrique_australe.milieux",
        "Afrique australe : des milieux à valoriser et à ménager",
        "Milieux variés (déserts, savanes, littoraux), riches en ressources minières ; risques "
        "climatiques (sécheresses, cyclones) et pression sur l'eau.",
        [
            _q(1, "Quel est le pays le plus peuplé et le plus riche d'Afrique australe ?",
               "l'Afrique du Sud", "C'est la première puissance économique de la région.",
               ("le Botswana", "la Namibie", "le Lesotho")),
            _q(1, "Quel désert s'étend sur le Botswana, la Namibie et l'Afrique du Sud ?",
               "le Kalahari", "Le désert du Namib longe aussi la côte namibienne.",
               ("le Sahara", "le Gobi", "l'Atacama")),
            _q(1, "Quelle ressource a fait la richesse de Johannesburg ?", "l'or",
               "La ville est née de la ruée vers l'or de 1886.",
               ("le pétrole", "le café", "le cacao")),
            _q(1, "Quelle ville est la capitale économique de l'Afrique du Sud ?", "Johannesburg",
               "Pretoria est la capitale administrative, Le Cap la capitale parlementaire.",
               ("Le Cap", "Durban", "Maputo")),
            _q(2, "Quel pays d'Afrique australe est un grand producteur de diamants ?", "le Botswana",
               "Les revenus du diamant ont financé son développement.",
               ("le Mozambique", "le Malawi", "le Lesotho")),
            _q(2, "Quel fleuve forme les chutes Victoria ?", "le Zambèze",
               "Elles marquent la frontière entre la Zambie et le Zimbabwe.",
               ("le Nil", "le Congo", "le Niger")),
            _q(2, "Quel risque climatique frappe souvent l'Afrique australe ?", "la sécheresse",
               "Elle menace l'agriculture et l'approvisionnement en eau.",
               ("les tempêtes de neige", "la mousson indienne", "les avalanches")),
            _q(2, "Qu'est-ce que l'accaparement des terres ?",
               "l'achat ou la location de grandes terres agricoles par des investisseurs étrangers",
               "Les paysans locaux peuvent en être privés.",
               ("le partage des terres entre paysans", "la création d'un parc national",
                "l'abandon des champs par les agriculteurs")),
            _q(3, "Quelle ville sud-africaine a frôlé le « jour zéro », sans eau au robinet, en "
               "2018 ?", "Le Cap", "Une forte sécheresse avait vidé ses barrages.",
               ("Johannesburg", "Durban", "Pretoria")),
            _q(3, "Quel métal stratégique l'Afrique du Sud produit-elle en très grande quantité ?",
               "le platine", "Elle en est le premier producteur mondial.",
               ("l'aluminium", "l'étain", "le mercure")),
            _q(3, "Quel pays côtier d'Afrique australe est souvent frappé par des cyclones ?",
               "le Mozambique", "Le cyclone Idai a dévasté le pays en 2019.",
               ("le Botswana", "le Zimbabwe", "la Zambie")),
            _q(3, "Que sont les parcs transfrontaliers d'Afrique australe ?",
               "des espaces naturels protégés partagés entre plusieurs pays",
               "Ils protègent la faune et développent l'écotourisme.",
               ("des zones industrielles", "des camps de réfugiés", "des routes douanières")),
        ],
    ),
    Notion(
        "afrique_australe.societes",
        "Afrique australe : transition, développement et mobilités",
        "Des pays inégalement développés ; l'héritage de l'apartheid en Afrique du Sud ; des "
        "migrations régionales et un tourisme en essor.",
        [
            _q(1, "Comment s'appelait le régime de ségrégation raciale en Afrique du Sud (1948-1991) ?",
               "l'apartheid", "Il séparait les populations selon leur couleur de peau.",
               ("le colonialisme", "le communisme", "la monarchie")),
            _q(1, "Qui est le premier président noir de l'Afrique du Sud, élu en 1994 ?",
               "Nelson Mandela", "Emprisonné 27 ans, il incarne la fin de l'apartheid.",
               ("Desmond Tutu", "Frederik de Klerk", "Jacob Zuma")),
            _q(1, "Quelle organisation regroupe les pays d'Afrique australe pour coopérer ?",
               "la Communauté de développement de l'Afrique australe",
               "On l'appelle la SADC.", ("l'Union européenne", "l'ASEAN", "le Mercosur")),
            _q(1, "Quel est le grand pays d'immigration de la région ?", "l'Afrique du Sud",
               "Son économie attire les travailleurs des pays voisins.",
               ("le Malawi", "le Lesotho", "le Zimbabwe")),
            _q(2, "Comment appelle-t-on les quartiers où les Noirs étaient relégués sous "
               "l'apartheid ?", "les townships", "Soweto, près de Johannesburg, est le plus célèbre.",
               ("les favelas", "les gated communities", "les bidonvilles de Bombay")),
            _q(2, "Pourquoi l'Afrique du Sud reste-t-elle très inégalitaire ?",
               "à cause de l'héritage de l'apartheid et d'un chômage très élevé",
               "C'est l'un des pays les plus inégalitaires du monde.",
               ("parce qu'elle n'a aucune ressource", "parce qu'elle est très peu peuplée",
                "parce qu'elle n'a jamais connu de croissance")),
            _q(2, "D'où viennent beaucoup de migrants installés en Afrique du Sud ?",
               "des pays voisins, comme le Zimbabwe et le Mozambique",
               "Les migrations sont surtout régionales.",
               ("d'Europe du Nord", "d'Amérique du Sud", "d'Asie centrale")),
            _q(2, "Quel tourisme se développe dans les grands parcs d'Afrique australe ?",
               "les safaris et l'écotourisme", "La faune sauvage attire des visiteurs du monde "
               "entier.", ("le tourisme de ski", "le tourisme industriel", "le tourisme religieux")),
            _q(3, "Quel surnom désigne l'Afrique du Sud après 1994 pour célébrer sa diversité ?",
               "la nation arc-en-ciel", "L'expression est attribuée à Desmond Tutu.",
               ("le pays de l'or noir", "la Suisse de l'Afrique", "le pays du soleil levant")),
            _q(3, "Que montre la ville du Cap ?",
               "un centre moderne et touristique à côté de townships pauvres",
               "La ville garde la trace de la ségrégation.",
               ("une ville sans inégalités", "une ville abandonnée", "une ville uniquement "
                                                                    "industrielle")),
            _q(3, "Quel corridor de transport relie la région de Johannesburg au port de Maputo ?",
               "le corridor de Maputo", "Il relie l'Afrique du Sud au Mozambique et à "
               "l'océan Indien.", ("la route de la soie", "le canal de Suez",
                                   "le corridor du Nil")),
            _q(3, "Quelle épidémie a très fortement touché l'Afrique australe depuis les années "
               "1990 ?", "le sida", "La région compte une grande partie des personnes vivant avec "
               "le VIH dans le monde.", ("la peste", "la grippe espagnole", "le choléra seulement")),
        ],
    ),
]

GENERATORS = register_notions(LEVEL, SUBJECT, NOTIONS)


# --- Siècles ------------------------------------------------------------------------------------


def _siecles(difficulty: int, rng: random.Random) -> dict[str, Any]:
    # 1 : époque moderne (1401-1800) ; 2 : de l'an 1 à 1800 ; 3 : années « rondes » ;
    # 4-5 : avec l'Antiquité avant J.-C.
    if difficulty == 1:
        year = rng.randint(1401, 1800)
    elif difficulty == 2:
        year = rng.randint(1, 1800)
    elif difficulty == 3:
        year = rng.choice([rng.randint(1, 18) * 100, -rng.randint(1, 8) * 100])
    else:
        year = rng.choice([rng.randint(1, 1800), -rng.randint(1, 800), rng.randint(1, 18) * 100])
    n, before = century(year)
    answer = century_label(n, before)
    wrong = {century_label(n + 1, before), century_label(n, not before)}
    if n > 1:
        wrong.add(century_label(n - 1, before))
    choices = rng.sample(sorted(wrong), min(3, len(wrong))) + [answer]
    rng.shuffle(choices)
    hundreds = (abs(year) - 1) // 100
    return {
        "type": "mcq",
        "prompt": f"En quel siècle se situe l'année {year_label(year)} ?",
        "choices": choices,
        "answer": {"kind": "choice", "index": choices.index(answer)},
        "hint": "On prend le nombre de centaines complètes et on ajoute 1 : 1492 est au XVe siècle, "
        "1500 au XVe siècle aussi.",
        "explanation": f"{year_label(year)} : {hundreds} centaines complètes, plus 1. "
        f"C'est le {answer}.",
        "time_target_ms": 18000 + 3000 * difficulty,
        "meta": {"year": year, "century": n, "before": before},
    }


SIECLES = register(
    Generator(
        code="2nde.histoire_geo.siecles",
        level=LEVEL,
        notion="2nde.histoire_geo.reperes.siecles",
        role="chapitre",
        title="Le siècle d'une date",
        generate=_siecles,
    )
)


# --- Frise des repères du programme --------------------------------------------------------------

# (année, événement, date écrite) : points de passage et grands repères de seconde.
EVENTS = [
    (-508, "Réformes de Clisthène : naissance de la démocratie athénienne", "508 av. J.-C."),
    (-27, "Octave devient Auguste, premier empereur romain", "27 av. J.-C."),
    (212, "Édit de Caracalla : citoyenneté pour presque tous les hommes libres", "212"),
    (313, "Édit de Milan : le christianisme est autorisé", "313"),
    (330, "Inauguration de Constantinople", "330"),
    (476, "Fin de l'Empire romain d'Occident", "476"),
    (1054, "Schisme entre catholiques et orthodoxes", "1054"),
    (1095, "Appel d'Urbain II à la première croisade", "1095"),
    (1146, "Bernard de Clairvaux prêche la deuxième croisade", "1146"),
    (1204, "Les croisés pillent Constantinople", "1204"),
    (1453, "Les Ottomans prennent Constantinople", "1453"),
    (1492, "Christophe Colomb atteint l'Amérique", "1492"),
    (1498, "Vasco de Gama atteint l'Inde", "1498"),
    (1508, "Michel-Ange commence la chapelle Sixtine", "1508"),
    (1517, "Luther publie ses 95 thèses", "1517"),
    (1539, "Ordonnance de Villers-Cotterêts", "1539"),
    (1550, "Controverse de Valladolid", "1550"),
    (1572, "Massacre de la Saint-Barthélemy", "1572"),
    (1598, "Édit de Nantes", "1598"),
    (1633, "Condamnation de Galilée", "1633"),
    (1639, "Révolte des Va-nu-pieds", "1639"),
    (1682, "Louis XIV installe la cour à Versailles", "1682"),
    (1685, "Révocation de l'édit de Nantes", "1685"),
    (1689, "Bill of Rights en Angleterre", "1689"),
    (1712, "Machine à vapeur de Newcomen", "1712"),
    (1751, "Premier volume de L'Encyclopédie", "1751"),
    (1776, "Déclaration d'indépendance des États-Unis", "1776"),
    (1787, "Constitution des États-Unis", "1787"),
]
# Difficulté → (nombre d'événements, écart minimal en années entre deux voisins).
FRISE = {1: (3, 300), 2: (3, 100), 3: (4, 50), 4: (4, 20), 5: (5, 10)}


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
        "prompt": "Le Grand Censeur a brouillé la frise des siècles. Remets ces événements dans "
        "l'ordre, du plus ancien au plus récent.",
        "choices": [picked[i][1] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "Repères : 1453 et 1492 ouvrent l'époque moderne ; 1517, les réformes ; 1685, la "
        "révocation de l'édit de Nantes.",
        "explanation": "Dans l'ordre : "
        + " ; ".join(f"{label} ({date})" for _y, label, date in picked)
        + ".",
        "time_target_ms": 25000 + 6000 * difficulty,
        "meta": {"years": [y for y, _l, _d in picked]},
    }


FRISE_GEN = register(
    Generator(
        code="2nde.histoire_geo.frise",
        level=LEVEL,
        notion="2nde.histoire_geo.reperes.frise",
        role="chapitre",
        title="La frise des siècles",
        generate=_frise,
    )
)


# --- Classement par indice de développement humain ------------------------------------------------

# Rang croissant de l'IDH (PNUD, rapports sur le développement humain des années 2020). Pays choisis
# pour des écarts nets : leur ordre est le même dans tous les rapports récents.
HDI_ORDER = [
    "la Norvège",
    "la France",
    "la Russie",
    "le Brésil",
    "l'Afrique du Sud",
    "l'Inde",
    "le Nigeria",
    "le Niger",
]
IDH_COUNT = {1: 3, 2: 3, 3: 4, 4: 4, 5: 5}


def _idh(difficulty: int, rng: random.Random) -> dict[str, Any]:
    count = IDH_COUNT[difficulty]
    while True:
        ranks = sorted(rng.sample(range(len(HDI_ORDER)), count))
        # Facile : pas deux voisins du classement côte à côte.
        if difficulty >= 4 or all(b - a >= 2 for a, b in zip(ranks, ranks[1:], strict=False)):
            break
    picked = [HDI_ORDER[r] for r in ranks]
    shown = list(range(count))
    while shown == sorted(shown):
        rng.shuffle(shown)
    return {
        "type": "order",
        "prompt": "L'Arpenteur Aveugle a mélangé l'échelle du développement. Classe ces pays de "
        "l'IDH le plus élevé au plus faible.",
        "choices": [picked[i] for i in shown],
        "answer": {"kind": "order", "value": [shown.index(i) for i in range(count)]},
        "hint": "L'IDH combine santé, éducation et niveau de vie : les pays d'Europe du Nord sont "
        "en tête, plusieurs pays du Sahel en bas du classement.",
        "explanation": "De l'IDH le plus élevé au plus faible (classement du PNUD) : "
        + ", ".join(picked)
        + ".",
        "time_target_ms": 25000 + 5000 * difficulty,
        "meta": {"ranks": ranks},
    }


IDH_GEN = register(
    Generator(
        code="2nde.histoire_geo.idh",
        level=LEVEL,
        notion="2nde.histoire_geo.developpement.inegalites",
        role="chapitre",
        title="L'échelle du développement",
        generate=_idh,
    )
)
