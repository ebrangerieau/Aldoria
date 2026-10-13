// Test de bout en bout de l'espace parent sur le banc local (le proxy edge joue Traefik) :
// connexion (mauvais puis bon mot de passe) → tableau de bord (indicateurs) → Programme →
// Questions (générateurs, création d'une question avec aperçu, import vérifié) → Signalements
// → Réglages → Famille (enfant ajouté puis supprimé, lien d'invitation, code d'appareil)
// → Exploitation (sauvegardes) → Guide → déconnexion.
// Recette de sécurité : sur l'hôte public, même avec une session valide, l'API parent n'existe pas.
//
// Usage : node admin_flow.js <url admin> <url publique> <dossier captures> <e-mail> <mot de passe>
const { chromium } = require('playwright-core');

(async () => {
  const [adminUrl, publicUrl, outDir, email, password] = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  const api = [];
  page.on('console', (m) => {
    // Le navigateur journalise les réponses 401 attendues (voir plus bas) : elles ne comptent pas.
    if (m.type() === 'error' && !m.text().includes('status of 401')) problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (!r.url().includes('/api/')) return;
    api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    // Attendus : /me avant connexion, puis le mauvais mot de passe.
    if (r.status() === 401 && (r.url().endsWith('/admin/me') || r.url().endsWith('/admin/login'))) return;
    if (r.status() >= 300) problems.push(`api: ${r.status()} ${r.url()}`);
  });
  const shot = (name) => page.screenshot({ path: `${outDir}/admin_${name}.png`, fullPage: true });

  await page.goto(adminUrl);
  await page.getByRole('heading', { name: 'Connexion' }).waitFor({ timeout: 15000 });
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('pas le bon mot de passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByText('E-mail ou mot de passe incorrect.').waitFor();
  await shot('0_connexion');
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByText('À retravailler').waitFor({ timeout: 15000 });
  await page.getByText('Objectifs du projet').waitFor();
  await shot('1_tableau_de_bord');

  await page.getByRole('button', { name: 'Programme' }).click();
  const fractions = page.locator('section.chapter', { hasText: 'Fractions' }).first();
  await fractions.getByRole('radio', { name: 'En cours en classe' }).click();
  await page.waitForResponse((r) => r.url().includes('/chapters/') && r.request().method() === 'PUT');
  await page.waitForTimeout(500);
  const checked = await fractions.getByRole('radio', { name: 'En cours en classe' }).getAttribute('aria-checked');
  if (checked !== 'true') problems.push('statut « En cours » non appliqué');
  await shot('2_programme');

  // Questions : aperçu d'un générateur (formules en SVG rendues par l'API).
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  await page.getByRole('button', { name: 'Générateurs' }).click();
  await page.getByLabel('Générateur').selectOption('6e.fractions.addition');
  await page.locator('ol.previews li', { hasText: 'Calcule' }).first().waitFor();
  await page.waitForTimeout(500);
  const formulas = await page.locator('img.formula').evaluateAll((imgs) => imgs.filter((i) => i.naturalWidth > 0).length);
  if (formulas === 0) problems.push("aucune formule affichée dans l'aperçu des générateurs");
  await shot('3_generateurs');

  // Banque : nouvelle question, aperçu, enregistrement, puis suppression (banc réutilisé).
  await page.getByRole('button', { name: 'Banque' }).click();
  await page.getByRole('button', { name: 'Nouvelle question' }).click();
  await page.getByLabel('Notion').selectOption({ label: "Médiatrice d'un segment" });
  await page.getByLabel('Énoncé').fill('Un point de la médiatrice de [AB] est…');
  await page.getByLabel('Formule (LaTeX, facultative)').fill('MA = MB');
  await page.getByLabel('Propositions (une par ligne)').fill('à égale distance de A et de B\nle milieu de [AB]\nplus près de A');
  await page.getByLabel('Explication (affichée après une erreur)').fill('La médiatrice réunit les points équidistants de A et de B.');
  await page.getByRole('button', { name: 'Aperçu' }).click();
  await page.locator('.preview .question').waitFor();
  await shot('4_question_apercu');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const row = page.locator('tr.clickable', { hasText: 'Un point de la médiatrice' });
  await row.waitFor();
  await shot('5_banque');
  await row.click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await row.waitFor({ state: 'detached' });

  // IA : le banc n'a pas de clé d'API, l'onglet l'explique (aucun appel payant en test).
  await page.getByRole('button', { name: "Proposer avec l'IA" }).click();
  await page.getByText("L'IA n'est pas activée sur ce serveur").waitFor();

  // Import : vérification ligne par ligne, sans rien enregistrer.
  await page.getByRole('button', { name: 'Importer' }).click();
  await page.getByLabel('Contenu à importer').fill(
    'notion;type;difficulte;enonce;formule;choix;reponse;indice;explication\n' +
      '6e.maths.fractions.addition;nombre;2;Calcule 1/4 + 2/4.;;;3/4;;On ajoute les numérateurs.\n' +
      '6e.maths.inconnue;nombre;2;Calcule 2 + 2.;;;4;;Quatre.',
  );
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await page.locator('table.report').waitFor();
  if ((await page.locator('table.report td.ok').count()) !== 1) problems.push("rapport d'import inattendu");
  await shot('6_import');

  await page.getByRole('button', { name: /Signalements/ }).click();
  await page.getByText('Quand un enfant pense').waitFor();
  await shot('7_signalements');

  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByText('Notions à confirmer').waitFor();
  await page.getByText('Mélange des questions').waitFor();
  // Aménagements : un préréglage, enregistré puis retiré (banc réutilisé).
  await page.getByRole('button', { name: /^Dyslexie/ }).click();
  await page.locator('#amenagements').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForResponse((r) => r.url().includes('/accommodations') && r.request().method() === 'PUT');
  await page.locator('#amenagements').getByText('Enregistré ✓').waitFor();
  await page.getByRole('button', { name: 'Tout désactiver' }).click();
  await page.locator('#amenagements').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForResponse((r) => r.url().includes('/accommodations') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: /Tom/ }).click();
  await page.waitForTimeout(800);
  // Code secret : deux saisies différentes bloquent le bouton ; puis le même code que
  // celui du banc (9876), pour ne pas changer le profil de test.
  const code = page.locator('#code');
  await code.getByLabel('Nouveau code').fill('9876');
  await code.getByLabel('Encore une fois').fill('9875');
  await code.getByText('Les deux codes sont différents.').waitFor();
  await code.getByLabel('Encore une fois').fill('9876');
  await code.getByRole('button', { name: 'Changer le code' }).click();
  await code.getByText('Code changé ✓').waitFor();
  if ((await code.getByLabel('Nouveau code').inputValue()) !== '') problems.push('le code reste affiché après le changement');
  await shot('8_reglages_tom');
  // Classe et monde : une classe sans programme est proposée « bientôt » ; le monde se change puis revient.
  const classe = page.locator('#classe');
  await classe.locator('option').first().waitFor({ state: 'attached' });
  const options = await classe.locator('select').evaluate((select) => [...select.options].map((o) => [o.value, o.disabled]));
  const fifth = options.find(([value]) => value === '5e');
  if (!fifth || !fifth[1]) problems.push(`5ème proposable sans programme : ${JSON.stringify(options)}`);
  await classe.getByRole('button', { name: /lumineuse/ }).click();
  await page.waitForResponse((r) => r.url().includes('/profiles/') && r.request().method() === 'PATCH');
  await classe.getByRole('button', { name: /Brouillard/ }).click();
  await page.waitForResponse((r) => r.url().includes('/profiles/') && r.request().method() === 'PATCH');

  // Famille : un enfant ajouté puis supprimé (banc réutilisé), un lien d'invitation, un code d'appareil.
  await page.getByRole('button', { name: 'Famille', exact: true }).click();
  const kids = page.locator('#enfants');
  await kids.getByLabel('Prénom').fill('Zoé');
  await kids.getByLabel('Code secret (4 chiffres)').fill('2468');
  await kids.getByLabel('Encore une fois').fill('2468');
  await kids.getByRole('button', { name: 'Ajouter' }).click();
  await kids.getByText('Enfant ajouté ✓').waitFor();
  await page.getByRole('button', { name: /^Zoé/ }).waitFor();
  await page.locator('#adultes').getByRole('button', { name: "Créer un lien d'invitation" }).click();
  const link = await page.locator('#adultes').getByLabel('Lien à transmettre').inputValue();
  if (!link.includes('/#invitation=')) problems.push(`lien d'invitation inattendu : ${link}`);
  await page.locator('#appareils').getByLabel("Nom de l'appareil").fill('Tablette du banc');
  await page.locator('#appareils').getByRole('button', { name: 'Créer un code' }).click();
  const pairingCode = await page.locator('.pairing-code').innerText();
  if (!/^\d{4} \d{4}$/.test(pairingCode)) problems.push(`code d'appareil inattendu : ${pairingCode}`);
  await shot('10_famille');
  const zoe = kids.locator('li', { hasText: 'Zoé' });
  await zoe.getByRole('button', { name: 'Supprimer…' }).click();
  await zoe.getByPlaceholder('Écrivez « Zoé »').fill('Zoé');
  await zoe.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await zoe.waitFor({ state: 'detached' });
  await page.locator('#adultes').getByRole('button', { name: 'Annuler' }).first().click();

  // Exploitation : sauvegardes (le service du banc a fait sa première sauvegarde).
  await page.getByRole('button', { name: 'Exploitation' }).click();
  await page.locator('#sauvegardes').getByText('✓ Dernière sauvegarde').waitFor();
  await page.locator('#familles').getByText('Famille test').or(page.locator('#familles td').first()).first().waitFor();
  await shot('11_exploitation');

  // Guide : bandeau de première visite, puis un bouton « Ouvrir … » mène à la rubrique.
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  await page.getByRole('heading', { name: "Guide de l'espace parent" }).waitFor();
  await shot('9_guide');
  await page.getByRole('button', { name: /Ouvrir l.import/ }).click();
  await page.getByRole('heading', { name: /Importer des questions/ }).waitFor();
  await page.getByRole('button', { name: 'Guide', exact: true }).click();
  await page.getByRole('button', { name: 'Ouvrir le programme' }).click();
  await page.locator('section.chapter').first().waitFor();
  if ((await page.getByText('Première visite ?').count()) !== 0) problems.push('bandeau du guide encore affiché après lecture');

  // Recette : sur l'hôte public, même la session valide du parent n'ouvre pas l'API parent.
  const session = (await page.context().cookies()).find((c) => c.name === 'aldoria_parent');
  if (!session || !session.httpOnly || session.sameSite !== 'Strict') problems.push('cookie de session sans HttpOnly / SameSite=Strict');
  const forged = await page.request.get(`${publicUrl}api/v1/admin/profiles`, {
    headers: { Cookie: `aldoria_parent=${session?.value}`, 'X-Requested-With': 'aldoria' },
  });
  if (forged.status() !== 404) problems.push(`API parent ouverte sur l'hôte public (${forged.status()})`);
  else console.log("Recette : session du parent présentée sur l'hôte public → 404");

  // Déconnexion : retour à l'écran de connexion.
  await page.getByRole('button', { name: 'Se déconnecter' }).first().click();
  await page.getByRole('heading', { name: 'Connexion' }).waitFor();

  console.log('Appels API :\n  ' + api.join('\n  '));
  if (problems.length) {
    console.log('ÉCHEC :\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('OK : espace parent sans erreur');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
