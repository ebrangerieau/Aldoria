// Test de bout en bout du jeu web : titre → profil → PIN → combat → question.
// Pilote Edge (ou Chrome) en headless via playwright-core, sur le banc local
// (tools/e2e_web.ps1) : jamais sur la production avec les vrais codes des enfants.
//
// Usage : node login_flow.js <url> <dossier captures> [pin]
// Échoue (code 1) si un appel /api/ ne répond pas 2xx ou si la console du jeu
// signale une erreur [Aldoria/api].
const { chromium } = require('playwright-core');

(async () => {
  const [url, outDir, pin = '1234'] = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];
  const api = [];
  page.on('console', (m) => {
    if (m.text().includes('[Aldoria/api]') || m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => {
    if (!r.url().includes('/api/')) return;
    api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
    if (r.status() >= 300) problems.push(`api: ${r.status()} ${r.url()}`);
  });

  const shot = async (name) => page.screenshot({ path: `${outDir}/e2e_${name}.png` });
  await page.goto(url);
  await page.waitForTimeout(8000);   // chargement du moteur
  await page.mouse.click(640, 400);  // écran titre
  await page.waitForTimeout(2500);
  await shot('1_profils');
  await page.mouse.click(640, 403);  // premier profil (Jules)
  await page.waitForTimeout(800);
  for (const digit of pin) {
    await page.keyboard.press(digit);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(5000);   // connexion + paquet de session + scène 3D
  await shot('2_combat');
  await page.mouse.click(640, 737);  // action « Sort »
  await page.waitForTimeout(2000);
  await shot('3_question');

  console.log('Appels API :\n  ' + api.join('\n  '));
  const started = api.some((line) => line.startsWith('200 POST /api/v1/play/session/start'));
  if (!started) problems.push('session/start jamais réussi');
  if (problems.length) {
    console.log('ÉCHEC :\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('OK : parcours complet sans erreur');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
