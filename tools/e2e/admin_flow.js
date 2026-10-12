// Test de bout en bout de l'espace parent sur le banc local (TinyAuth simulé par le
// proxy edge) : tableau de bord (indicateurs) → Programme (changement de statut) →
// Questions (générateurs, création d'une question avec aperçu, import vérifié) →
// Signalements → Réglages.
// Recette de sécurité : sur l'hôte public, un Remote-User forgé n'ouvre pas l'API parent.
//
// Usage : node admin_flow.js <url admin> <url publique> <dossier captures>
const { chromium } = require('playwright-core');

(async () => {
  const [adminUrl, publicUrl, outDir] = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  const api = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (!r.url().includes('/api/')) return;
    api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    if (r.status() >= 300) problems.push(`api: ${r.status()} ${r.url()}`);
  });
  const shot = (name) => page.screenshot({ path: `${outDir}/admin_${name}.png`, fullPage: true });

  await page.goto(adminUrl);
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
  await page.getByRole('button', { name: /Tom/ }).click();
  await page.waitForTimeout(800);
  await shot('8_reglages_tom');

  // Recette : Remote-User forgé sur l'hôte public → l'API parent reste introuvable.
  const forged = await page.request.get(`${publicUrl}api/v1/admin/profiles`, {
    headers: { 'Remote-User': 'parent', 'Remote-Email': 'parent@test.local' },
  });
  if (forged.status() !== 404) problems.push(`Remote-User forgé accepté sur l'hôte public (${forged.status()})`);
  else console.log('Recette : Remote-User forgé sur l\'hôte public → 404');

  console.log('Appels API :\n  ' + api.join('\n  '));
  if (problems.length) {
    console.log('ÉCHEC :\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('OK : espace parent sans erreur');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
