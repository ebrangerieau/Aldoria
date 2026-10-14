// Lecture à voix haute dans l'export web (aménagement « dys ») : avec la lecture
// automatique activée pour le profil de test, l'introduction d'un donjon doit être
// confiée à la synthèse vocale du navigateur (speechSynthesis.speak). Le navigateur
// headless n'a pas de voix : on intercepte les appels au lieu d'écouter.
//
// Usage : node tts_check.js <url du jeu> <url de l'API locale> <clé admin locale> <code de liaison>
//        <e-mail du parent du banc> <mot de passe du parent du banc> [pin]
const { chromium } = require('playwright-core');

(async () => {
  const [url, apiUrl, adminKey, pairing, email, password, pin = '1234'] = process.argv.slice(2);
  // Session du parent du banc (API parent appelée directement, avec le secret du routeur admin).
  const base = { 'Content-Type': 'application/json', 'X-Aldoria-Admin-Key': adminKey, 'X-Requested-With': 'aldoria' };
  const login = await fetch(`${apiUrl}/api/v1/admin/login`, { method: 'POST', headers: base, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`connexion du parent du banc : ${login.status}`);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const admin = (body) =>
    fetch(`${apiUrl}/api/v1/admin/profiles/1/accommodations`, {
      method: 'PUT',
      headers: { ...base, Cookie: cookie },
      body: JSON.stringify(body),
    });
  let failed = false;
  await admin({ read_aloud: true, auto_read: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      window.__spoken = [];
      if ('speechSynthesis' in window) {
        const speak = speechSynthesis.speak.bind(speechSynthesis);
        speechSynthesis.speak = (utterance) => {
          window.__spoken.push(utterance.text);
          speak(utterance);
        };
      }
    });
    await page.goto(url);
    await page.waitForTimeout(8000);
    await page.mouse.click(640, 400); // écran titre
    await page.waitForTimeout(2500);
    for (const digit of pairing) {     // liaison de l'appareil (navigateur neuf)
      await page.keyboard.press(digit);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(3000);
    await page.mouse.click(640, 403); // Jules
    await page.waitForTimeout(800);
    for (const digit of pin) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(5000);
    await page.keyboard.press('Escape'); // « Passer » le prologue (première fois seulement)
    await page.waitForTimeout(4000);    // retour sur la carte
    await page.keyboard.press('Enter'); // accueil de Maître Ysaline (première fois seulement)
    await page.waitForTimeout(800);
    await page.mouse.click(771, 329); // la Tour des Fractions → son seuil
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter'); // « J'y vais »
    await page.waitForTimeout(7000);
    const spoken = await page.evaluate(() => window.__spoken);
    console.log('Textes confiés à la synthèse vocale :\n  ' + spoken.join('\n  '));
    // Introduction du donjon (et non le seuil de la carte, qui porte aussi son nom).
    if (!spoken.some((t) => t.includes('sens dessus dessous'))) {
      console.log("ÉCHEC : l'introduction du donjon n'a pas été lue");
      failed = true;
    } else {
      console.log('OK : lecture à voix haute appelée dans le navigateur');
    }
  } finally {
    await admin({});
    await browser.close();
  }
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
