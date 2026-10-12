import type { Profile } from './api'
import type { View } from './Questions'
import { Stars } from './Stars'

export type GuideTarget = 'dashboard' | 'program' | 'questions' | 'reports' | 'settings'

const SECTIONS = [
  { id: 'demarrer', title: 'Démarrer en 3 gestes' },
  { id: 'enfant', title: 'Choisir l’enfant' },
  { id: 'tableau', title: 'Suivre la progression' },
  { id: 'programme', title: 'Dire au jeu ce qui se passe en classe' },
  { id: 'questions', title: 'Ajouter vos propres questions' },
  { id: 'import', title: 'Importer un fichier de questions' },
  { id: 'generateurs', title: 'Voir les questions du jeu' },
  { id: 'signalements', title: 'Traiter les signalements' },
  { id: 'reglages', title: 'Régler le jeu' },
  { id: 'amenagements', title: 'Adapter le jeu (troubles « dys », attention)' },
  { id: 'jeu', title: 'Ce que vit votre enfant dans le jeu' },
  { id: 'faq', title: 'Questions fréquentes' },
]

// Guide de l'espace parent : tout ce qu'il est possible de faire, et comment, pas à pas.
export function Guide({ child, onOpen }: { child: Profile; onOpen: (page: GuideTarget, view?: View) => void }) {
  const tom = child.level === '2nde'
  return (
    <div className="stack guide">
      <section className="card">
        <h2>Guide de l'espace parent</h2>
        <p>
          Les Chroniques d'Aldoria font réviser les maths à vos enfants en jouant : chaque combat, énigme ou quête repose sur une question du
          programme. L'espace parent sert à trois choses : <strong>voir où en est chaque enfant</strong>, <strong>orienter les questions</strong>{' '}
          vers ce qu'il travaille en classe, et <strong>ajouter vos propres questions</strong>.
        </p>
        <p className="muted small">Les exemples de ce guide concernent {child.name} ; changez d'enfant en haut à droite pour adapter les exemples.</p>
        <nav className="toc" aria-label="Sommaire du guide">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      </section>

      <Section id="demarrer" title="Démarrer en 3 gestes">
        <p>Si vous ne deviez faire que trois choses :</p>
        <ol className="steps">
          <li>
            <strong>Dans Programme</strong>, passez en « En cours en classe » le ou les chapitres que {child.name} travaille en ce moment. C'est le
            réglage qui a le plus d'effet sur les questions posées.
          </li>
          <li>
            <strong>Avant un contrôle</strong>, passez le chapitre en « Contrôle bientôt » : le jeu le fait réviser en priorité.
          </li>
          <li>
            <strong>Une fois par semaine</strong>, ouvrez le Tableau de bord : notions à retravailler, temps de jeu, et l'onglet Signalements si un
            chiffre rouge y apparaît.
          </li>
        </ol>
        <div className="tip">
          <strong>Astuce.</strong> Tout le reste (questions personnelles, réglages fins) est facultatif : le jeu fonctionne très bien avec ses
          questions automatiques.
        </div>
      </Section>

      <Section id="enfant" title="Choisir l’enfant">
        <p>
          Les boutons en haut à droite (<span className="pill">Jules 6ème</span> <span className="pill">Tom Seconde</span>) choisissent l'enfant
          affiché. Tous les onglets s'adaptent : tableau de bord, programme, questions (de son niveau) et réglages.
        </p>
      </Section>

      <Section id="tableau" title="Suivre la progression" open={() => onOpen('dashboard')} openLabel="Ouvrir le tableau de bord">
        <p>Le tableau de bord résume, pour l'enfant choisi :</p>
        <ul className="bullets">
          <li>
            <strong>Les notions par état.</strong> Chaque notion du programme gagne jusqu'à 3 étoiles selon les réponses de l'enfant :
            <span className="legend">
              <Stars count={3} /> acquise · <Stars count={2} /> fragile · <Stars count={1} /> en cours d'apprentissage · <Stars count={0} /> jamais vue
            </span>
            Les étoiles tiennent compte de la justesse, de la rapidité, de l'usage de l'indice et de la difficulté. Elles peuvent baisser : une
            notion « acquise » mais oubliée redevient fragile.
          </li>
          <li>
            <strong>Les 7 derniers jours</strong> : temps de jeu actif (une page laissée ouverte en arrière-plan ne compte pas), nombre de
            réponses et taux de réussite, avec un graphique sur 14 jours.
          </li>
          <li>
            <strong>À retravailler</strong> : les notions déjà rencontrées qui n'ont pas encore leurs 3 étoiles, les plus faibles en premier.
            C'est la liste à regarder avant un contrôle.
          </li>
          <li>
            <strong>Dernières sessions</strong> : date, activité (arène, donjon, village, défi du jour), durée, réponses justes et la note de 1 à 5
            que l'enfant donne à la fin d'un donjon.
          </li>
          <li>
            <strong>Objectifs du projet</strong> : six indicateurs comparés aux cibles fixées au départ (par exemple 3 sessions par semaine, 20 à
            40 questions par session, une note de plaisir de 4 ou plus). Une bordure verte signale une cible atteinte, orange une cible pas encore
            atteinte, grise un indicateur pas encore mesurable.
          </li>
        </ul>
        <div className="tip">
          <strong>Bon à savoir.</strong> L'indicateur « Progrès entre la 1re et la 4e rencontre » mesure si l'enfant apprend vraiment : il compare
          sa réussite la première fois qu'il croise une notion et la quatrième fois.
        </div>
      </Section>

      <Section id="programme" title="Dire au jeu ce qui se passe en classe" open={() => onOpen('program')} openLabel="Ouvrir le programme">
        <p>
          L'onglet Programme liste les chapitres de {tom ? 'seconde' : '6ème'} avec, pour chacun, les étoiles de ses notions. Chaque chapitre a un
          statut, que vous choisissez d'un clic :
        </p>
        <dl className="statuses-guide">
          <dt>
            <span className="status">À venir</span>
          </dt>
          <dd>Pas encore vu en classe. Ses notions ne sont pas proposées comme questions de chapitre.</dd>
          <dt>
            <span className="status active en_cours">En cours en classe</span>
          </dt>
          <dd>
            Le chapitre du moment. Les questions « de chapitre » (la moitié d'une session, par défaut) viennent de ces chapitres.
          </dd>
          <dt>
            <span className="status active controle_bientot">Contrôle bientôt</span>
          </dt>
          <dd>
            Le chapitre prend 70 % des questions, et au village le sage propose chaque jour une quête de révision qui le nomme. Indiquez la date du
            contrôle si vous la connaissez.
          </dd>
          <dt>
            <span className="status active termine">Terminé</span>
          </dt>
          <dd>Vu en classe. Ses notions reviennent par la révision espacée, au bon moment pour ne pas les oublier.</dd>
        </dl>
        <ol className="steps">
          <li>Ouvrez Programme et repérez le chapitre étudié en ce moment.</li>
          <li>Cliquez sur « En cours en classe ». L'enregistrement est immédiat, il n'y a pas de bouton à valider.</li>
          <li>Quand un contrôle est annoncé, cliquez sur « Contrôle bientôt » et choisissez la date.</li>
          <li>Après le contrôle, passez le chapitre en « Terminé ».</li>
        </ol>
        <div className="warn">
          <strong>Attention.</strong> Le statut ne change pas tout seul après la date du contrôle : pensez à le passer en « Terminé ». Si aucun
          chapitre n'est « en cours », le jeu pioche dans tout le programme.
        </div>
        <div className="tip">
          <strong>Et les donjons ?</strong> Chaque donjon a ses propres chapitres (par exemple la Tour des Fractions pour les fractions) : le statut
          que vous choisissez ici agit sur l'arène et le village. Le défi du jour, lui, ne pose que des questions de calcul rapide.
        </div>
      </Section>

      <Section id="questions" title="Ajouter vos propres questions" open={() => onOpen('questions')} openLabel="Ouvrir la banque de questions">
        <p>
          Le jeu fabrique déjà ses questions automatiquement, en nombre illimité. La <strong>banque</strong> vous permet d'ajouter les vôtres : une
          question vue dans le cahier, un exercice du manuel, ou une notion que le jeu ne couvre pas encore.
        </p>
        <ol className="steps">
          <li>
            Onglet <strong>Questions</strong>, puis <strong>Banque</strong>, puis <strong>Nouvelle question</strong>.
          </li>
          <li>
            Choisissez la <strong>notion</strong> (rangée par chapitre), le <strong>type</strong> et la <strong>difficulté</strong> (1 étoile =
            très facile, 5 étoiles = difficile).
          </li>
          <li>
            Écrivez l'<strong>énoncé</strong>. Une <strong>formule</strong> est facultative : elle s'écrit en LaTeX, par exemple{' '}
            <code>\frac{'{3}{4}'} + \frac{'{1}{8}'}</code> pour ³⁄₄ + ¹⁄₈.
          </li>
          <li>Indiquez la bonne réponse (selon le type, voir le tableau ci-dessous).</li>
          <li>
            Écrivez l'<strong>explication</strong>, obligatoire : l'enfant la lit quand il se trompe. Expliquez la méthode, pas seulement le
            résultat. L'<strong>indice</strong> est facultatif.
          </li>
          <li>
            Cliquez sur <strong>Aperçu</strong> : la question s'affiche comme le jeu la recevra, ou la liste de ce qu'il faut corriger.
          </li>
          <li>
            Cochez <strong>Publiée</strong> si elle est prête, puis <strong>Enregistrer</strong>. Une question non cochée reste en brouillon et n'est
            jamais jouée.
          </li>
        </ol>
        <table className="guide-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Ce que fait l'enfant</th>
              <th>Ce que vous saisissez</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>QCM</td>
              <td>Choisit une proposition</td>
              <td>De 2 à 6 propositions (une par ligne), puis la bonne</td>
            </tr>
            <tr>
              <td>Nombre ou fraction</td>
              <td>Tape sa réponse sur un pavé</td>
              <td>
                La réponse : <code>12,5</code> ou <code>3/4</code>. Pour une fraction, les fractions égales sont acceptées (6/8 pour 3/4).
              </td>
            </tr>
            <tr>
              <td>Expression</td>
              <td>Tape une expression (x², parenthèses…)</td>
              <td>
                L'expression attendue, par exemple <code>x^2+6x+9</code>. Toute écriture équivalente est acceptée.
              </td>
            </tr>
            <tr>
              <td>Vrai ou faux justifié</td>
              <td>Dit vrai ou faux, puis choisit la bonne raison</td>
              <td>Trois justifications (une par ligne), le verdict et la bonne justification</td>
            </tr>
            <tr>
              <td>Remettre dans l'ordre</td>
              <td>Touche les éléments dans l'ordre</td>
              <td>Les éléments dans le bon ordre : le jeu les mélange lui-même</td>
            </tr>
          </tbody>
        </table>
        <div className="tip">
          <strong>Où la question apparaît-elle ?</strong> Dans les combats et les quêtes qui portent sur sa notion, environ 4 fois sur 10 face aux
          questions automatiques, et au plus une fois par session. Une notion sans questions automatiques (comme la médiatrice en 6ème) devient
          jouable dès qu'elle a une question publiée.
        </div>
        <div className="tip">
          <strong>Corriger une question</strong> : cliquez dessus dans la liste, modifiez, enregistrez. Le jeu la considère alors comme une
          nouvelle question. Les boutons « Toutes / Publiées / Brouillons » filtrent la liste.
        </div>
      </Section>

      <Section id="import" title="Importer un fichier de questions" open={() => onOpen('questions', 'import')} openLabel="Ouvrir l'import">
        <p>
          Pour ajouter beaucoup de questions d'un coup, préparez-les dans un tableur (Excel, LibreOffice, Google Sheets) puis enregistrez le fichier
          au format <strong>CSV</strong> avec le séparateur point-virgule.
        </p>
        <ol className="steps">
          <li>
            Première ligne, les en-têtes : <code>notion;type;difficulte;enonce;formule;choix;reponse;indice;explication</code>.
          </li>
          <li>
            Une question par ligne. Le <strong>code de la notion</strong> (par exemple <code>{tom ? '2nde.maths.calcul_litteral.developpement' : '6e.maths.fractions.addition'}</code>)
            s'affiche dans l'onglet Générateurs, sous le nom du générateur.
          </li>
          <li>
            Type : <code>qcm</code>, <code>nombre</code>, <code>expression</code>, <code>vrai_faux</code> ou <code>ordre</code>. Les propositions
            se séparent par <code>|</code>.
          </li>
          <li>
            Réponse : le numéro du bon choix pour un QCM (<code>2</code>), le nombre ou la fraction (<code>3/4</code>), l'expression, ou pour un
            vrai/faux le verdict et le numéro de la justification (<code>faux | 1</code>).
          </li>
          <li>
            Questions, puis Importer : choisissez le fichier (ou collez son contenu) et cliquez sur <strong>Vérifier</strong>.
          </li>
          <li>
            Lisez le rapport : chaque ligne est « Valide » ou dit ce qui ne va pas. <strong>Rien n'est encore enregistré.</strong>
          </li>
          <li>
            Cliquez sur <strong>Ajouter … questions en brouillon</strong>, relisez-les dans la Banque, puis publiez-les une par une.
          </li>
        </ol>
        <p className="muted small">
          Un exemple complet s'affiche sous la zone d'import (« Format CSV »). Le format JSON est aussi accepté, pour qui préfère. Fichiers de 5 Mo au
          plus.
        </p>
      </Section>

      <Section id="generateurs" title="Voir les questions du jeu" open={() => onOpen('questions', 'generators')} openLabel="Ouvrir les générateurs">
        <p>
          Questions, puis <strong>Générateurs</strong> : choisissez un générateur et une difficulté. Le jeu tire dix questions au hasard, avec la
          réponse attendue, l'indice et l'explication. « Autres exemples » en tire dix nouvelles.
        </p>
        <p>
          C'est utile pour savoir ce que {child.name} rencontre réellement, et pour vérifier qu'une forme de question correspond à ce qui est fait en
          classe. Les questions « d'énigme ou de quête » demandent une illustration (carte, balance, tableau…), résumée en une ligne dans l'aperçu.
        </p>
      </Section>

      <Section id="signalements" title="Traiter les signalements" open={() => onOpen('reports')} openLabel="Ouvrir les signalements">
        <p>
          Quand {child.name} se trompe, le jeu affiche la bonne réponse et l'explication. S'il pense que c'est la question qui est fausse, il touche{' '}
          <strong>Signaler une erreur</strong> et choisit un motif : réponse attendue fausse, énoncé faux, ou question incompréhensible.
        </p>
        <ol className="steps">
          <li>Un chiffre rouge s'affiche sur l'onglet Signalements.</li>
          <li>Chaque signalement montre la question telle que l'enfant l'a vue et la réponse qu'il a donnée.</li>
          <li>
            Si c'est une question de votre banque, <strong>Corriger dans la banque</strong> l'ouvre directement. Si c'est une question automatique
            vraiment fausse, notez-la : c'est un défaut du jeu à corriger dans le programme informatique.
          </li>
          <li>
            Cliquez sur <strong>Marquer traité</strong>. Le signalement passe dans l'onglet « Traités » (on peut le rouvrir).
          </li>
        </ol>
        <div className="tip">
          <strong>Astuce.</strong> Souvent, l'enfant a mal compris l'énoncé : c'est une bonne occasion d'en parler avec lui, et d'améliorer
          l'explication si c'est votre question.
        </div>
      </Section>

      <Section id="reglages" title="Régler le jeu" open={() => onOpen('settings')} openLabel="Ouvrir les réglages">
        <ul className="bullets">
          <li>
            <strong>Durée de jeu</strong> : au-delà du temps choisi (25 minutes par défaut), le jeu félicite l'enfant et termine la partie en
            proposant une pause. Seul le temps où le jeu est affiché compte.
          </li>
          <li>
            <strong>Mélange des questions</strong> : la part des questions du chapitre en cours, de la révision des notions à revoir et des
            automatismes (calcul rapide{tom ? ", au format du QCM de l'épreuve anticipée de première" : ''}). Par défaut 50 / 30 / 20. Un chapitre en
            « Contrôle bientôt » prend de toute façon 70 %.
          </li>
          <li>
            <strong>Notions à confirmer</strong> : quelques points du programme récent sont incertains (les sources se contredisent). Vérifiez dans
            le manuel ou le cahier, puis choisissez « Au programme » ou « Hors programme ». Une notion hors programme n'apparaît jamais dans le jeu.
          </li>
          <li>
            <strong>Réinitialiser la progression</strong> : efface les réponses, les sessions, les étoiles et la partie de l'enfant (niveau, donjons,
            défis). Le profil, son code et le programme restent. Pour éviter une erreur, il faut écrire le prénom de l'enfant.
          </li>
          <li>
            <strong>Sauvegardes</strong> : rien à régler, c'est un témoin. Chaque nuit, le serveur copie toutes les données du jeu et garde les
            14 dernières copies ; l'ordinateur de la maison les récupère chaque soir. Une coche verte veut dire que tout va bien. Une ligne
            orange ou rouge dit ce qui ne va pas : le plus souvent, l'ordinateur de la maison est resté éteint ; allumez-le, la copie se fait
            dans le quart d'heure.
          </li>
        </ul>
        <div className="warn">
          <strong>Attention.</strong> La réinitialisation est définitive. Elle sert par exemple à repartir de zéro à la rentrée, ou à effacer les
          données d'un enfant (droit à l'effacement).
        </div>
      </Section>

      <Section
        id="amenagements"
        title="Adapter le jeu (troubles « dys », attention)"
        open={() => onOpen('settings')}
        openLabel="Ouvrir les aménagements"
      >
        <p>
          Si {child.name} est dyslexique, dyscalculique, dyspraxique, ou a du mal à rester concentré, le jeu peut s'adapter, comme les
          aménagements d'un PAP en classe. Rien n'est imposé : vous choisissez, et vous pouvez revenir en arrière à tout moment.
        </p>
        <ol className="steps">
          <li>
            Ouvrez <strong>Réglages</strong>, rubrique <strong>Aménagements</strong>.
          </li>
          <li>
            Touchez un ou plusieurs <strong>profils</strong> (ils se cumulent) : chacun coche les aménagements utiles.
          </li>
          <li>Ajustez case par case si besoin : chaque case explique ce qu'elle change.</li>
          <li>
            Cliquez sur <strong>Enregistrer</strong>. Le jeu applique les réglages au prochain retour au camp, sur tous les appareils.
          </li>
        </ol>
        <table className="guide-table">
          <thead>
            <tr>
              <th>Profil</th>
              <th>Ce qui change dans le jeu</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dyslexie</td>
              <td>
                Un bouton <strong>Écouter</strong> lit à voix haute l'énoncé (formules comprises : « 3/4 » devient « 3 sur 4 »), les
                propositions, l'explication et les dialogues. Texte plus grand et aéré, police très lisible.
              </td>
            </tr>
            <tr>
              <td>Dyscalculie</td>
              <td>
                Plus aucune pénalité de lenteur : le temps ne compte ni dans les étoiles, ni dans les combats (le coup critique récompense
                trois bonnes réponses d'affilée au lieu de la vitesse), ni dans le défi du jour. Un bouton <strong>Outils</strong> affiche
                la table de multiplication et un tableau de numération où le nombre tapé se range chiffre par chiffre. Les sessions
                commencent un cran plus facile.
              </td>
            </tr>
            <tr>
              <td>Dyspraxie</td>
              <td>
                Plus de joystick : toucher un endroit, un habitant ou un ennemi suffit pour y aller. Boutons plus grands. Aucune pénalité de
                lenteur. Le jeu ne demande déjà jamais de geste rapide, de glisser-déposer ni d'écriture.
              </td>
            </tr>
            <tr>
              <td>Attention</td>
              <td>
                Mode calme (ni secousses d'écran, ni ralentis, moins d'étincelles, sons plus doux) et rappel de pause toutes les 15 minutes :
                l'enfant peut faire une pause ou continuer.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Indépendamment des profils : <strong>couleurs adaptées</strong> pour un enfant daltonien (juste en bleu et faux en orange au lieu du vert et du rouge).
        </p>
        <div className="tip">
          <strong>Et l'enfant ?</strong> Au camp, son bouton <strong>Options</strong> lui permet d'agrandir encore le texte, de régler le
          volume et d'activer ou non la lecture automatique. Il ne peut pas retirer ce que vous avez choisi.
        </div>
        <div className="tip">
          <strong>Conseil.</strong> Parlez-en avec {child.name} et, si possible, avec ses enseignants : les aménagements utiles en classe
          sont souvent les bons dans le jeu. Commencez par un profil, observez quelques sessions, puis ajustez.
        </div>
        <div className="warn">
          <strong>Données.</strong> Le jeu n'enregistre aucun diagnostic, seulement les réglages choisis, sur votre serveur.
        </div>
      </Section>

      <Section id="jeu" title="Ce que vit votre enfant dans le jeu">
        <p>Savoir ce qui se passe à l'écran aide à en parler avec {child.name} :</p>
        <ul className="bullets">
          <li>
            <strong>Le camp</strong> : point de départ, avec le niveau et l'expérience du héros. L'enfant se connecte en touchant son avatar puis en tapant
            son code secret.
          </li>
          <li>
            <strong>Les donjons</strong> : trois par monde, qui s'ouvrent l'un après l'autre. Salles, combats, une énigme, un boss, puis un coffre et
            une note de 1 à 5. Une défaite ne fait rien perdre : le héros repart du début de la salle.
          </li>
          <li>
            <strong>Le village</strong> : chaque habitant demande de l'aide une fois par jour (3 questions). Révisions espacées, préparation du
            contrôle{tom ? ', enquêtes statistiques et probabilités sur un document' : ', cartes à échelle'}.
          </li>
          <li>
            <strong>Le défi du jour</strong> : 10 questions de calcul rapide, sans chrono à l'écran. Les jours d'affilée forment une série ; un jour
            manqué peut se rattraper le lendemain ; 5 défis dans la semaine ouvrent un coffre.
          </li>
          <li>
            <strong>L'apparence</strong> : au camp, le bouton <strong>Apparence</strong> permet de choisir l'allure du héros (chevalier,
            rôdeur, voleur, barbare, mage), son arme, sa cape et sa couleur{tom ? '' : ', ainsi que le nom et le pelage de son renard, qui le suit partout'}.
            Certains choix se gagnent en montant de niveau ou en terminant des donjons : une étoile ★ sur le bouton signale une nouveauté.
            C'est uniquement décoratif, rien ne s'achète.
          </li>
          <li>
            <strong>L'arène</strong> : des combats à la chaîne pour s'entraîner. <strong>Les Archives</strong> : les étoiles de chaque notion, comme
            dans votre tableau de bord, et le bestiaire des créatures vaincues.
          </li>
        </ul>
        <div className="tip">
          <strong>Comment le jeu choisit-il les questions ?</strong> La difficulté s'adapte : elle monte après deux bonnes réponses, baisse après une
          erreur. Une notion ratée revient deux questions plus tard sous une autre forme. Une notion réussie revient de plus en plus tard (1 jour, 3
          jours, une semaine, 3 semaines, 2 mois) pour être retenue durablement. Répondre au hasard très vite rapporte moins, sans message.
        </div>
      </Section>

      <Section id="faq" title="Questions fréquentes">
        <details>
          <summary>Mon enfant peut-il jouer sur l'ordinateur et sur la tablette ?</summary>
          <p>
            Oui. La partie est enregistrée sur le serveur : il retrouve sa progression sur l'autre appareil. Si les deux ont joué, la partie la plus
            avancée l'emporte.
          </p>
        </details>
        <details>
          <summary>Et sans connexion Internet ?</summary>
          <p>
            Une partie commencée continue : les réponses sont gardées sur l'appareil et envoyées au retour de la connexion, sans doublon. Une
            activité déjà jouée sur cet appareil peut même être relancée avec les questions gardées en mémoire.
          </p>
        </details>
        <details>
          <summary>Une question me paraît fausse, que faire ?</summary>
          <p>
            Si elle vient de votre banque, corrigez-la dans Questions, puis Banque. Si c'est une question automatique, notez le générateur
            (visible dans un signalement ou dans l'onglet Générateurs) pour qu'il soit corrigé.
          </p>
        </details>
        <details>
          <summary>Pourquoi le tableau de bord indique-t-il peu de notions « jouables » ?</summary>
          <p>
            Certaines notions du programme n'ont pas encore de questions automatiques. Elles deviennent jouables dès que vous publiez une question
            dans la banque pour elles.
          </p>
        </details>
        <details>
          <summary>La lecture à voix haute ne fonctionne pas ou la voix est en anglais</summary>
          <p>
            Le jeu utilise la voix du navigateur. Vérifiez le volume de l'appareil. Sur une tablette Android : Paramètres, puis « Synthèse
            vocale » (ou « Sortie de la synthèse vocale »), choisissez le moteur Google et la langue française, et téléchargez la voix
            française pour qu'elle marche aussi sans connexion. Sur un ordinateur Windows, une voix française est normalement déjà installée.
          </p>
        </details>
        <details>
          <summary>Comment changer le code d'un enfant ?</summary>
          <p>
            Pas encore depuis cet espace : sur le serveur, dans le dossier du jeu, avec la commande{' '}
            <code>docker compose exec -T api python -m app.cli set-pin --name Prénom --pin NOUVEAU_CODE</code>.
          </p>
        </details>
        <details>
          <summary>Quelles données sont conservées ?</summary>
          <p>
            Les réponses (juste ou faux, temps de réponse), les sessions et la partie de chaque enfant, sur votre serveur, et leurs sauvegardes
            sur le serveur et sur l'ordinateur de la maison. Aucune donnée ne part ailleurs. La réinitialisation, dans les Réglages, efface tout
            pour un enfant ; ses anciennes données disparaissent des sauvegardes au bout de 14 jours sur le serveur (60 sur l'ordinateur de la
            maison).
          </p>
        </details>
        <details>
          <summary>Où sont les sauvegardes, et comment revenir en arrière ?</summary>
          <p>
            Sur le serveur, dans <code>/docker/aldoria/backups/quotidiennes</code> ; à la maison, dans le dossier{' '}
            <code>Documents\Sauvegardes Aldoria</code> de l'ordinateur qui fait la copie (un fichier par jour, avec un journal). Revenir en
            arrière remplace toutes les données du jeu par celles du jour choisi : c'est une opération technique, décrite pas à pas dans{' '}
            <code>docs/exploitation.md</code>. Pour vérifier qu'une sauvegarde est lisible sans rien toucher :{' '}
            <code>tools/test_restauration.ps1 fichier.sql.gz</code>.
          </p>
        </details>
      </Section>
    </div>
  )
}

function Section({
  id,
  title,
  open,
  openLabel,
  children,
}: {
  id: string
  title: string
  open?: () => void
  openLabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="card" id={id}>
      <h2>{title}</h2>
      {children}
      <div className="row spread section-foot">
        <a href="#" className="small">
          ↑ Haut du guide
        </a>
        {open && (
          <button className="primary" onClick={open}>
            {openLabel}
          </button>
        )}
      </div>
    </section>
  )
}
