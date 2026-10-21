import type { Profile } from './api'
import type { View } from './Questions'
import { Stars } from './Stars'

export type GuideTarget = 'dashboard' | 'week' | 'program' | 'questions' | 'reports' | 'settings' | 'family'

const SECTIONS = [
  { id: 'demarrer', title: 'Démarrer en 3 gestes' },
  { id: 'famille', title: 'Votre famille : enfants, adultes, appareils' },
  { id: 'enfant', title: 'Choisir l’enfant' },
  { id: 'tableau', title: 'Suivre la progression' },
  { id: 'semaine', title: 'Le résumé de la semaine' },
  { id: 'programme', title: 'Dire au jeu ce qui se passe en classe' },
  { id: 'questions', title: 'Ajouter vos propres questions' },
  { id: 'ia', title: "Faire proposer des questions par l'IA" },
  { id: 'import', title: 'Importer un fichier de questions' },
  { id: 'generateurs', title: 'Voir les questions du jeu' },
  { id: 'signalements', title: 'Traiter les signalements' },
  { id: 'reglages', title: 'Régler le jeu' },
  { id: 'classe', title: 'Changer de classe ou de monde' },
  { id: 'amenagements', title: 'Adapter le jeu (troubles « dys », attention)' },
  { id: 'jeu', title: 'Ce que vit votre enfant dans le jeu' },
  { id: 'faq', title: 'Questions fréquentes' },
]

// Guide de l'espace parent : tout ce qu'il est possible de faire, et comment, pas à pas.
export function Guide({ child, onOpen }: { child?: Profile; onOpen: (page: GuideTarget, view?: View) => void }) {
  const tom = child?.level === '2nde'
  const name = child?.name ?? 'votre enfant'
  return (
    <div className="stack guide">
      <section className="card">
        <h2>Guide de l'espace parent</h2>
        <p>
          Les Chroniques d'Aldoria font réviser les maths à vos enfants en jouant : chaque combat, énigme ou quête repose sur une question du
          programme. L'espace parent sert à trois choses : <strong>voir où en est chaque enfant</strong>, <strong>orienter les questions</strong>{' '}
          vers ce qu'il travaille en classe, et <strong>ajouter vos propres questions</strong>.
        </p>
        <p className="muted small">Les exemples de ce guide concernent {name} ; changez d'enfant en haut à droite pour adapter les exemples.</p>
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
            <strong>Dans Programme</strong>, passez en « En cours en classe » le ou les chapitres que {name} travaille en ce moment. C'est le
            réglage qui a le plus d'effet sur les questions posées.
          </li>
          <li>
            <strong>Avant un contrôle</strong>, passez le chapitre en « Contrôle bientôt » : le jeu le fait réviser en priorité.
          </li>
          <li>
            <strong>Une fois par semaine</strong>, ouvrez l'onglet Semaine : en une phrase, ce que {name} a fait, puis ce qui marche et ce qui
            reste à revoir. Regardez aussi l'onglet Signalements si un chiffre rouge y apparaît.
          </li>
        </ol>
        <div className="tip">
          <strong>Astuce.</strong> Tout le reste (questions personnelles, réglages fins) est facultatif : le jeu fonctionne très bien avec ses
          questions automatiques.
        </div>
      </Section>

      <Section id="famille" title="Votre famille : enfants, adultes, appareils" open={() => onOpen('family')} openLabel="Ouvrir Famille">
        <p>L'onglet <strong>Famille</strong> regroupe tout ce qui concerne les personnes et les appareils :</p>
        <ul className="bullets">
          <li>
            <strong>Ajouter un enfant</strong> : son prénom, sa classe (6ème ou seconde) et son code secret à 4 chiffres, tapé deux fois. Il
            apparaît aussitôt dans le jeu, sur les appareils de la famille.
          </li>
          <li>
            <strong>Relier un appareil</strong> (une seule fois par tablette ou ordinateur) : donnez-lui un nom, cliquez sur{' '}
            <strong>Créer un code</strong>, puis ouvrez le jeu sur l'appareil et tapez les 8 chiffres affichés (valables 30 minutes). Le jeu
            n'affiche les enfants que sur un appareil relié : un inconnu qui ouvre l'adresse du jeu ne voit personne.
          </li>
          <li>
            <strong>Installer le jeu comme une application</strong> (téléphone ou tablette Android, avec Chrome) : ouvrez l'adresse du jeu,
            touchez le menu <strong>⋮</strong> en haut à droite, puis <strong>Installer l'application</strong> (ou{' '}
            <strong>Ajouter à l'écran d'accueil</strong>). Une icône Aldoria apparaît : le jeu s'ouvre alors en plein écran, sans la barre du
            navigateur, et reste à l'horizontale. Les mises à jour arrivent toutes seules. L'appareil reste relié : pas de nouveau code à taper.
          </li>
          <li>
            <strong>Inviter un adulte</strong> (l'autre parent, un grand-parent…) : <strong>Créer un lien d'invitation</strong>, puis envoyez
            ce lien comme vous voulez (SMS, messagerie). La personne y choisit son e-mail et son mot de passe. Le lien ne sert qu'une fois et
            expire au bout de 7 jours.
          </li>
          <li>
            <strong>Mot de passe oublié</strong> : un autre adulte de la famille clique sur <strong>Lien « mot de passe oublié »</strong> à
            côté de son nom et le lui envoie.
          </li>
          <li>
            <strong>Retirer</strong> un appareil perdu ou un adulte qui ne doit plus accéder : l'effet est immédiat.
          </li>
          <li>
            <strong>Mon compte</strong> : changer son mot de passe, déconnecter ses autres appareils, se déconnecter.
          </li>
        </ul>
        <div className="warn">
          <strong>Supprimer un enfant ou la famille</strong> efface définitivement toutes ses données (droit à l'effacement). Il faut écrire son
          nom pour confirmer.
        </div>
      </Section>

      <Section id="enfant" title="Choisir l’enfant">
        <p>
          Les boutons en haut à droite (un par enfant, avec sa classe, par exemple <span className="pill">{child?.name ?? 'Jules'} 6ème</span>)
          choisissent l'enfant affiché. Tous les onglets s'adaptent : tableau de bord, programme, questions (de son niveau) et réglages.
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

      <Section id="semaine" title="Le résumé de la semaine" open={() => onOpen('week')} openLabel="Ouvrir la semaine">
        <p>
          L'onglet <strong>Semaine</strong> fait le bilan d'une semaine, du lundi au dimanche, pour l'enfant choisi. Tout en haut, une phrase
          résume l'essentiel : combien de jours {name} a joué, combien de temps, combien de questions, dans quelles matières, et ce qui est à
          revoir en priorité.
        </p>
        <ul className="bullets">
          <li>
            <strong>Les quatre chiffres</strong> : temps de jeu, séances, jours joués et réponses (avec la part de justes), chacun comparé à la
            semaine d'avant.
          </li>
          <li>
            <strong>Jour par jour</strong> : les minutes de jeu de chaque jour (passez la souris sur une barre pour le détail), et le nombre de
            notions rencontrées pour la première fois.
          </li>
          <li>
            <strong>Matières travaillées</strong> : le nombre de réponses et la part de justes dans chaque matière.
          </li>
          <li>
            <strong>Ce qui marche</strong> et <strong>À revoir</strong> : les notions réussies à 80 % au moins, et celles ratées plus d'une fois
            sur deux. Une notion n'y figure qu'à partir de 3 réponses dans la semaine.
          </li>
          <li>
            <strong>À regarder</strong> : les notions mises de côté dans la semaine (par vous ou par {name}) et les questions signalées.
          </li>
        </ul>
        <ol className="steps">
          <li>Ouvrez l'onglet <strong>Semaine</strong> : la semaine en cours s'affiche.</li>
          <li>
            Touchez <strong>← Semaine précédente</strong> pour remonter dans le temps, <strong>Semaine suivante →</strong> pour revenir, ou{' '}
            <strong>Cette semaine</strong> pour y retourner d'un coup.
          </li>
          <li>
            Une notion revient souvent dans « À revoir » ? Revoyez la leçon avec {name}, ou passez son chapitre en « Contrôle bientôt » dans
            Programme : le jeu la fera travailler davantage.
          </li>
        </ol>
      </Section>

      <Section id="programme" title="Dire au jeu ce qui se passe en classe" open={() => onOpen('program')} openLabel="Ouvrir le programme">
        <p>
          L'onglet Programme liste les chapitres de {tom ? 'seconde' : '6ème'}, <strong>une matière à la fois</strong> : choisissez la matière
          dans la rangée de boutons (chaque bouton indique combien de chapitres y sont en cours, ou combien sont terminés). L'encadré{' '}
          <strong>En ce moment</strong>, tout en haut, rassemble les chapitres en cours et les contrôles annoncés de toutes les matières ;
          touchez-en un pour ouvrir sa matière. Les notions d'un chapitre et leurs étoiles se déplient sous son titre (dépliées d'office pour
          les chapitres du moment). La page se souvient de la dernière matière ouverte pour chaque enfant. Chaque chapitre a un statut, que
          vous choisissez d'un clic :
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
          <li>Ouvrez Programme, choisissez la matière, puis repérez le chapitre étudié en ce moment.</li>
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
        <h3>Une notion pas encore vue en classe</h3>
        <p>
          Un chapitre « en cours » contient souvent des notions que la classe n'a pas encore abordées. Sous le titre du chapitre, chaque notion a
          une case <strong>pas encore vue en classe</strong>. Cochée, la notion n'est plus jamais posée : ni dans l'arène, ni au village, ni au
          défi du jour, ni dans les donjons. Décochez-la quand le professeur l'a traitée.
        </p>
        <p>
          {name} peut aussi le dire lui-même : sous chaque question du jeu, le bouton <strong>Pas vu en classe</strong> (à toucher deux fois,
          pour éviter une erreur) remplace la question par une autre, sans la compter comme une erreur ni lui faire perdre de points de vie. La
          notion est mise de côté tout de suite, et vous la retrouvez dans le <strong>tableau de bord</strong>, encadré « Mises de côté par{' '}
          {name} », et dans Programme avec l'étiquette « mise de côté par {name} ».
        </p>
        <ol className="steps">
          <li>Ouvrez le tableau de bord : l'encadré « Mises de côté par {name} » n'apparaît que s'il y en a.</li>
          <li>Si c'est exact, touchez « C'est exact » : la notion reste de côté et quitte la liste.</li>
          <li>Si {name} a déjà vu la notion en classe, décochez la case : elle revient dans les questions.</li>
        </ol>
        <div className="tip">
          <strong>Pour éviter les abus.</strong> Le bouton ne fait pas gagner la question : il la remplace. Tout ce que {name} met de côté reste
          visible ici. Si toute une matière était mise de côté, ses donjons continueraient à poser ses questions (jamais celles d'une autre
          matière).
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
            <tr>
              <td>Réponse écrite</td>
              <td>Écrit un mot ou une courte expression sur un clavier à l'écran</td>
              <td>
                Les réponses acceptées (une par ligne, par exemple <code>mum</code> et <code>mom</code>). Majuscules, espaces et point final ne
                comptent pas ; cochez « les accents comptent » pour l'orthographe en français, décochez pour une langue étrangère.
              </td>
            </tr>
          </tbody>
        </table>
        <div className="tip">
          <strong>Écoute (langues vivantes).</strong> Pour n'importe quel type, remplissez « Écoute » : l'appareil prononce ce mot ou cette
          phrase dans la langue choisie (anglais, espagnol, allemand…), sans l'écrire. Exemple : écoute « horse », question « Que veut dire ce
          mot ? », propositions en français. Le bouton reste actif même sans l'aménagement de lecture à voix haute.
        </div>
        <div className="tip">
          <strong>Anglais lu avec l'accent anglais.</strong> Dans une question d'anglais, écrivez les mots et les phrases en anglais entre
          guillemets droits ou anglais : <code>Complète : "She ___ a cat."</code>. Ils sont lus par la voix anglaise (le trou devient une
          courte pause) ; le reste est lu en français. Un mot français cité s'écrit entre « » : <code>Comment dit-on « chat » ?</code>.
          L'IA suit déjà cette règle.
        </div>
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

      <Section id="ia" title="Faire proposer des questions par l'IA" open={() => onOpen('questions', 'ai')} openLabel="Ouvrir l'IA">
        <p>
          Pour une notion sans questions, ou pour coller à la leçon du moment, l'IA (Claude, d'Anthropic) peut rédiger des questions à votre
          place. Vous gardez la main : elles arrivent en brouillon et ne sont jouées qu'une fois publiées par vous.
        </p>
        <ol className="steps">
          <li>
            Questions, puis <strong>Proposer avec l'IA</strong>.
          </li>
          <li>
            Choisissez la <strong>notion</strong>, le nombre de questions et la difficulté. Une <strong>consigne</strong> est facultative
            (« surtout des questions d'écoute », « vocabulaire de la ferme »).
          </li>
          <li>
            Joignez si vous voulez la <strong>leçon</strong> : son texte, ou une photo du cahier ou du manuel. L'IA s'appuie alors sur ce que
            {` ${name} `}a réellement vu en classe.
          </li>
          <li>
            Cliquez sur <strong>Proposer des questions</strong> (jusqu'à une minute). Les questions valides s'ajoutent en brouillon ; celles qui
            ne tiennent pas (réponse incohérente…) sont écartées et listées.
          </li>
          <li>
            <strong>Relisez</strong> chaque question (bouton Relire) : corrigez si besoin, puis cochez <strong>Publiée</strong>.
          </li>
        </ol>
        <div className="warn">
          <strong>Ce qui est envoyé à l'IA :</strong> la classe, la matière, la notion, votre consigne et la leçon jointe. Jamais le prénom, les
          réponses ni les résultats de votre enfant. Photographiez seulement la leçon : ni prénom, ni visage, ni copie notée.
        </div>
        <div className="tip">
          <strong>Limite :</strong> un nombre de demandes par jour et par famille (le coût est à la charge de l'exploitant du serveur). Si
          l'onglet indique que l'IA n'est pas activée, c'est que le serveur n'a pas de clé d'API.
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
            Type : <code>qcm</code>, <code>nombre</code>, <code>expression</code>, <code>vrai_faux</code>, <code>ordre</code> ou{' '}
            <code>texte</code> (réponse écrite). Les propositions se séparent par <code>|</code>.
          </li>
          <li>
            Réponse : le numéro du bon choix pour un QCM (<code>2</code>), le nombre ou la fraction (<code>3/4</code>), l'expression, ou pour un
            vrai/faux le verdict et le numéro de la justification (<code>faux | 1</code>), pour une réponse écrite les formes acceptées
            (<code>mum | mom</code>).
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
          C'est utile pour savoir ce que {name} rencontre réellement, et pour vérifier qu'une forme de question correspond à ce qui est fait en
          classe. Les questions « d'énigme ou de quête » demandent une illustration (carte, balance, tableau…), résumée en une ligne dans l'aperçu.
        </p>
      </Section>

      <Section id="signalements" title="Traiter les signalements" open={() => onOpen('reports')} openLabel="Ouvrir les signalements">
        <p>
          Quand {name} se trompe, le jeu affiche la bonne réponse et l'explication. S'il pense que c'est la question qui est fausse, il touche{' '}
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
            <strong>Durée de jeu</strong> : au-delà du temps choisi (25 minutes par défaut), le jeu félicite l'enfant, termine la partie et
            lui demande une pause de 30 minutes : d'ici là, la carte et la Citadelle lui indiquent dans combien de minutes il pourra rejouer (l'apparence et les
            Archives restent ouvertes). Le temps compte d'une activité à l'autre (donjon, arène, village, défi du jour), sur tous les appareils
            de la famille ; seul le temps où le jeu est affiché compte. Pour lui accorder du temps en plus, augmentez la durée : c'est pris en
            compte dès son retour sur la carte.
          </li>
          <li>
            <strong>Code secret</strong> : tapez deux fois les 4 nouveaux chiffres, puis <strong>Changer le code</strong>. Le code sert dès la
            prochaine connexion de l'enfant ; une partie déjà ouverte sur un appareil continue. Le code doit être différent de celui des autres
            enfants. Changer le code débloque aussi un profil bloqué après 5 erreurs (sinon, il se débloque seul au bout de 5 minutes).
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

      <Section id="classe" title="Changer de classe ou de monde" open={() => onOpen('settings')} openLabel="Ouvrir les réglages">
        <p>
          La <strong>classe</strong> fixe ce que le jeu fait travailler : le programme, les donjons et le village. Le <strong>monde</strong> ne
          change que l'ambiance : Aldoria lumineuse (ton chaleureux, renard compagnon) ou le Brouillard (plus sombre et épuré).
        </p>
        <ol className="steps">
          <li>
            Ouvrez <strong>Réglages</strong>, rubrique <strong>Classe et monde</strong>.
          </li>
          <li>
            <strong>À la rentrée</strong>, choisissez la nouvelle classe puis cliquez sur <strong>Passer en …</strong>. Une classe marquée
            « bientôt » n'est pas encore dans le jeu.
          </li>
          <li>
            Indiquez ensuite les chapitres en cours dans <strong>Programme</strong> : c'est ce qui oriente le plus les questions.
          </li>
          <li>
            Pour le <strong>monde</strong>, touchez celui qui plaît à {name} : le changement se voit au prochain retour sur la carte.
          </li>
        </ol>
        <div className="tip">
          <strong>Rien n'est perdu au passage de classe.</strong> Le héros garde son niveau, son apparence, son renard et ses trophées ; les
          notions travaillées l'année d'avant reviennent de temps en temps en révision, pour ne pas les oublier.
        </div>
        <div className="tip">
          <strong>Une classe sans donjons pour l'instant ?</strong> La Citadelle l'annonce à l'enfant ; l'arène, le défi du jour et les Archives
          fonctionnent avec les questions de sa classe.
        </div>
      </Section>

      <Section
        id="amenagements"
        title="Adapter le jeu (troubles « dys », attention)"
        open={() => onOpen('settings')}
        openLabel="Ouvrir les aménagements"
      >
        <p>
          Si {name} est dyslexique, dyscalculique, dyspraxique, ou a du mal à rester concentré, le jeu peut s'adapter, comme les
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
            Cliquez sur <strong>Enregistrer</strong>. Le jeu applique les réglages au prochain retour sur la carte, sur tous les appareils.
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
          <strong>Et l'enfant ?</strong> Sur la carte, son bouton <strong>Options</strong> lui permet d'agrandir encore le texte, de régler le
          volume et d'activer ou non la lecture automatique. Il ne peut pas retirer ce que vous avez choisi.
        </div>
        <div className="tip">
          <strong>Conseil.</strong> Parlez-en avec {name} et, si possible, avec ses enseignants : les aménagements utiles en classe
          sont souvent les bons dans le jeu. Commencez par un profil, observez quelques sessions, puis ajustez.
        </div>
        <div className="warn">
          <strong>Données.</strong> Le jeu n'enregistre aucun diagnostic, seulement les réglages choisis, sur votre serveur.
        </div>
      </Section>

      <Section id="jeu" title="Ce que vit votre enfant dans le jeu">
        <p>Savoir ce qui se passe à l'écran aide à en parler avec {name} :</p>
        <ul className="bullets">
          <li>
            <strong>L'histoire</strong> : Malvrek, un Archiviste déchu, et ses Effaceurs ont volé les pages de la Grande Chronique, le livre qui garde
            les savoirs du royaume. {name} est un jeune Archiviste chargé de les reprendre, guidé par Maître Ysaline. Chaque boss vaincu rend une page.
            Un <strong>prologue</strong> de cinq tableaux raconte ce début d'histoire la première fois (bouton « Passer » à tout moment) ; il se revoit
            depuis la Citadelle avec <strong>Revoir le prologue</strong>.
          </li>
          <li>
            <strong>La carte du royaume</strong> : l'écran d'accueil après la connexion (avatar, puis code secret). Au centre, la Citadelle des
            Archives ; autour, une région par matière (les Cimes Fractales pour les maths, la Bibliothèque des Langues pour l'anglais et l'espagnol, le Bois des
            Mots pour le français, les Portes du Temps pour l'histoire-géographie, le Laboratoire des Inventeurs pour les sciences et la physique-chimie, le Carrefour des Messagers pour la SNT, le Forum des Citoyens pour l'EMC et les SES, la Vallée du Vivant pour les SVT) et le village
            de Clairval. Les régions pas encore au programme restent dans le brouillard. En touchant un lieu, {name} lit d'abord ce qui l'attend
            (le lieu, la page à reprendre, ce qu'il va travailler) et choisit d'y entrer ou non.
          </li>
          <li>
            <strong>La Citadelle des Archives</strong> : le niveau et l'expérience du héros, les pages retrouvées, le défi du jour, l'arène, les
            Archives et l'apparence.
          </li>
          <li>
            <strong>Les donjons</strong> : dans chaque région, ils s'ouvrent l'un après l'autre. Six salles sur six étages, des monstres variés, une
            énigme, un boss, puis un coffre et une note de 1 à 5. Le héros commente sa progression et donne des indices sur la salle suivante. Une
            défaite ne fait rien perdre : le héros reprend des forces et l'ennemi garde ses blessures. Certaines énigmes se jouent directement
            dans le décor : dans la Tour des Fractions, une balance géante se résout en enlevant la même chose des deux côtés puis en essayant
            une masse ; le fléau penche du côté trop lourd. Seul le premier essai compte comme réponse dans le suivi. À la Citadelle,
            le <strong>stand de tir</strong> propose six tirs calculés : {tom ? 'Tom donne le coefficient directeur de la droite de son arbalète' : 'Jules mesure un angle sur un rapporteur géant'} ;
            un tir raté montre où il est parti, et seul le premier tir de chaque cible compte dans le suivi.
            {!tom && (
              <>
                {' '}
                Le <strong>pont des fractions</strong> propose six ravins à franchir : Jules choisit des planches (1/2, 1/3, 1/4…) et les pose
                bout à bout. Le pont tient si leurs longueurs font exactement la largeur du ravin ; sinon il s'effondre et le jeu montre la
                somme posée. Toute combinaison juste est acceptée, et seul le premier pont de chaque ravin compte dans le suivi (notion
                « Additionner et soustraire des fractions »).
              </>
            )}
          </li>
          <li>
            <strong>Le sac</strong> : des objets gagnés en jouant (plume qui retire deux mauvaises propositions, parchemin d'indice, bouclier,
            potion). Aucun ne fait sauter une question ; une aide par objet compte comme un indice dans vos statistiques.
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
            <strong>L'apparence</strong> : à la Citadelle, le bouton <strong>Apparence</strong> permet de choisir l'allure du héros (chevalier,
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
            Oui, une fois chaque appareil relié à la famille (Famille → Appareils). La partie est enregistrée sur le serveur : il retrouve sa
            progression sur l'autre appareil. Si les deux ont joué, la partie la plus avancée l'emporte.
          </p>
        </details>
        <details>
          <summary>Le jeu demande un code à 8 chiffres</summary>
          <p>
            L'appareil n'est pas (ou plus) relié à la famille : navigateur nouveau, données du navigateur effacées, navigation privée, ou appareil
            retiré. Créez un code dans Famille → Appareils et tapez-le dans le jeu.
          </p>
        </details>
        <details>
          <summary>Que faire à la rentrée ?</summary>
          <p>
            Dans Réglages → Classe et monde, passez chaque enfant dans sa nouvelle classe, puis marquez ses premiers chapitres « En cours » dans
            Programme. Sa progression de l'année d'avant reste visible dans le jeu (héros, trophées) et ses notions reviennent en révision.
          </p>
        </details>
        <details>
          <summary>J'ai oublié mon mot de passe</summary>
          <p>
            Demandez à un autre adulte de la famille de vous envoyer un lien « mot de passe oublié » (Famille → Adultes). Si vous êtes le seul
            adulte, l'exploitant du serveur peut en créer un.
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
            Quand l'enfant est connecté, la voix est fabriquée par le serveur de la famille : une voix naturelle, la même sur la tablette et
            l'ordinateur, en français et en anglais (rien n'est envoyé à un service extérieur). Vérifiez d'abord le volume de l'appareil.
          </p>
          <p>
            Sans connexion, le jeu se sert de la voix de l'appareil. Sur une tablette Android : Paramètres, puis « Synthèse vocale » (ou
            « Sortie de la synthèse vocale »), choisissez le moteur Google et la langue française, et téléchargez la voix française pour
            qu'elle marche aussi hors connexion. Sur un ordinateur Windows, une voix française est normalement déjà installée.
          </p>
        </details>
        <details>
          <summary>Comment changer le code d'un enfant ?</summary>
          <p>
            Dans <strong>Réglages</strong>, rubrique <strong>Code secret</strong> : tapez le nouveau code deux fois, puis cliquez sur{' '}
            <strong>Changer le code</strong>. L'ancien code ne marche plus. Si l'enfant a oublié son code ou s'est trompé 5 fois, c'est aussi
            la solution.
          </p>
        </details>
        <details>
          <summary>Quelles données sont conservées ?</summary>
          <p>
            Les réponses (juste ou faux, temps de réponse), les sessions et la partie de chaque enfant, les comptes des adultes (e-mail, mot de
            passe chiffré) et les appareils reliés, sur le serveur d'Aldoria, ainsi que leurs sauvegardes. Aucune donnée ne part ailleurs, et
            aucune autre famille ne voit les vôtres. La réinitialisation, dans les Réglages, efface tout
            pour un enfant ; ses anciennes données disparaissent des sauvegardes au bout de 14 jours sur le serveur (60 sur l'ordinateur de la
            maison).
          </p>
        </details>
        <details>
          <summary>Comment savoir si le jeu rencontre des erreurs ? (exploitant du serveur)</summary>
          <p>
            Ouvrez l'onglet <strong>Exploitation</strong>, carte <strong>Erreurs du jeu</strong>. Chaque erreur rencontrée sur un appareil y
            apparaît : ce qui s'est passé, l'écran, le type d'appareil et la version du jeu, avec le nombre de fois. Rien sur les enfants (ni
            prénom, ni réponse). Quand une erreur est corrigée, cliquez sur « Vider la liste » : si elle revient, elle réapparaît. Les erreurs
            s'effacent seules au bout de 30 jours. La version du jeu d'un appareil se lit dans ses Options, tout en bas.
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
