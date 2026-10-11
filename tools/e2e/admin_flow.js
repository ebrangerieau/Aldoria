// Test de bout en bout de l'espace parent sur le banc local (TinyAuth simulé par le
// proxy edge) : tableau de bord → Programme (changement de statut) → Réglages.
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
  await shot('1_tableau_de_bord');

  await page.getByRole('button', { name: 'Programme' }).click();
  const fractions = page.locator('section.chapter', { hasText: 'Fractions' }).first();
  await fractions.getByRole('radio', { name: 'En cours en classe' }).click();
  await page.waitForResponse((r) => r.url().includes('/chapters/') && r.request().method() === 'PUT');
  await page.waitForTimeout(500);
  const checked = await fractions.getByRole('radio', { name: 'En cours en classe' }).getAttribute('aria-checked');
  if (checked !== 'true') problems.push('statut « En cours » non appliqué');
  await shot('2_programme');

  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByText('Notions à confirmer').waitFor();
  await page.getByRole('button', { name: /Tom/ }).click();
  await page.waitForTimeout(800);
  await shot('3_reglages_tom');

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
