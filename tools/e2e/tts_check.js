// Lecture à voix haute dans l'export web (aménagement « dys ») : avec la lecture
// automatique activée pour le profil de test, l'introduction d'un donjon doit être
// confiée à la synthèse vocale du navigateur (speechSynthesis.speak). Le navigateur
// headless n'a pas de voix : on intercepte les appels au lieu d'écouter.
//
// Usage : node tts_check.js <url du jeu> <url de l'API locale> <clé admin locale> [pin]
const { chromium } = require('playwright-core');

(async () => {
  const [url, apiUrl, adminKey, pin = '1234'] = process.argv.slice(2);
  const admin = (body) =>
    fetch(`${apiUrl}/api/v1/admin/profiles/1/accommodations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Aldoria-Admin-Key': adminKey, 'Remote-Email': 'parent@test.local' },
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
    await page.mouse.click(640, 403); // Jules
    await page.waitForTimeout(800);
    for (const digit of pin) {
      await page.keyboard.press(digit);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(5000);
    await page.mouse.click(642, 226); // « Entrer » dans le premier donjon
    await page.waitForTimeout(7000);
    const spoken = await page.evaluate(() => window.__spoken);
    console.log('Textes confiés à la synthèse vocale :\n  ' + spoken.join('\n  '));
    if (!spoken.some((t) => t.includes('La Tour des Fractions'))) {
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
