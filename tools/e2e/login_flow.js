// Test de bout en bout du jeu web : titre → profil → PIN → camp → donjon (marche
// au clavier) → Quitter → camp → Archives → camp → Changer de joueur → profils.
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
  await page.waitForTimeout(4000);   // connexion + sauvegarde → camp
  await shot('2_camp');
  await page.mouse.click(270, 712);  // « Entrer » dans le donjon (paquet + scène 3D)
  await page.waitForTimeout(6000);
  await shot('3_donjon_intro');
  await page.mouse.click(640, 730);  // « En avant ! »
  await page.waitForTimeout(800);
  await page.keyboard.down('d');     // marcher vers l'est (D, ou → )
  await page.waitForTimeout(1500);
  await page.keyboard.up('d');
  await page.waitForTimeout(500);
  await shot('4_donjon_marche');
  await page.mouse.click(1210, 63);  // « Quitter » → camp
  await page.waitForTimeout(3000);
  await page.mouse.click(1078, 712); // « Consulter » les Archives
  await page.waitForTimeout(3000);
  await shot('5_archives');
  await page.mouse.click(1170, 52);  // « Retour au camp »
  await page.waitForTimeout(2500);
  await page.mouse.click(1133, 71);  // « Changer de joueur »
  await page.waitForTimeout(2500);
  await shot('6_changer_joueur');

  console.log('Appels API :\n  ' + api.join('\n  '));
  for (const call of ['200 POST /api/v1/play/session/start', '200 GET /api/v1/play/save', '200 GET /api/v1/play/progress']) {
    if (!api.includes(call)) problems.push(`appel manquant : ${call}`);
  }
  const profileLoads = api.filter((line) => line === '200 GET /api/v1/play/profiles').length;
  if (profileLoads < 2) problems.push('« Changer de joueur » n\'a pas rouvert le choix des profils');
  if (problems.length) {
    console.log('ÉCHEC :\n  ' + problems.join('\n  '));
    process.exitCode = 1;
  } else {
    console.log('OK : parcours complet sans erreur');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
