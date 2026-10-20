// Lecture à voix haute dans l'export web (aménagement « dys ») : avec la lecture
// automatique activée pour le profil de test, l'introduction d'un donjon doit être
// confiée à la synthèse vocale du navigateur (speechSynthesis.speak). Le navigateur
// headless n'a pas de voix : on intercepte les appels au lieu d'écouter.
// Le jeu est ouvert avec ?erreur_test=1 : l'erreur d'essai doit arriver au serveur (ErrorReport,
// Exploitation → Erreurs du jeu) avec la version et le type d'appareil.
//
// Usage : node tts_check.js <url du jeu> <url de l'API locale> <clé admin locale> <code de liaison>
//        <e-mail du parent du banc> <mot de passe du parent du banc> [pin]
const { launch, SLOW } = require('./browser');

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
  const errorsUrl = `${apiUrl}/api/v1/admin/client-errors`;
  await fetch(errorsUrl, { method: 'DELETE', headers: { ...base, Cookie: cookie } });
  await admin({ read_aloud: true, auto_read: true });
  const browser = await launch(true);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    // Capture en cas d'échec, dans E2E_OUT si le banc le donne (CI : artefact e2e-captures).
    const shot = async (name) => {
      if (process.env.E2E_OUT) await page.screenshot({ path: `${process.env.E2E_OUT}/voix_${name}.png` });
    };
    const step = async (what, promise) => {
      try {
        await promise;
      } catch (e) {
        await shot(what.replace(/\W+/g, '_'));
        throw new Error(`étape « ${what} » : pas de réponse du serveur (${e.message.split('\n')[0]})`);
      }
    };
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
    // Chaque étape attend la réponse du serveur qui la conclut (et non une durée fixe) : en CI, le
    // rendu logiciel rend le jeu lent et irrégulier.
    const answered = (path, method = 'GET') =>
      page.waitForResponse((r) => r.url().includes(path) && r.request().method() === method && r.ok(),
        { timeout: 60000 * SLOW });
    await page.goto(url + (url.includes('?') ? '&' : '?') + 'erreur_test=1');
    await page.waitForTimeout((8000) * SLOW);
    await page.mouse.click(640, 400); // écran titre
    await page.waitForTimeout((2500) * SLOW);
    const pairedNow = answered('/play/devices/pair', 'POST');
    for (const digit of pairing) {     // liaison de l'appareil (navigateur neuf)
      await page.keyboard.press(digit);
      await page.waitForTimeout((120) * SLOW);
    }
    await step('liaison de l\'appareil', pairedNow);
    await page.waitForTimeout((3000) * SLOW);
    await page.mouse.click(478, 440); // carte de Jules
    await page.waitForTimeout((800) * SLOW);
    const loggedIn = answered('/play/login', 'POST');
    for (const digit of pin) {
      await page.keyboard.press(digit);
      await page.waitForTimeout((120) * SLOW);
    }
    await step('connexion de Jules', loggedIn);
    await page.waitForTimeout((5000) * SLOW);
    await page.keyboard.press('Escape'); // « Passer » le prologue (première fois seulement)
    await page.waitForTimeout((4000) * SLOW);    // retour sur la carte
    await page.keyboard.press('Enter'); // accueil de Maître Ysaline (première fois seulement)
    await page.waitForTimeout((800) * SLOW);
    await page.mouse.click(771, 329); // la Tour des Fractions → son seuil
    await page.waitForTimeout((1000) * SLOW);
    const started = answered('/play/session/start', 'POST');
    await page.keyboard.press('Enter'); // « J'y vais »
    await step('ouverture du donjon', started);
    // L'introduction est lue une fois la salle construite : on l'attend (au plus 30 s × SLOW).
    let spoken = [];
    for (let i = 0; i < 30; i++) {
      spoken = await page.evaluate(() => window.__spoken);
      if (spoken.some((t) => t.includes('sens dessus dessous'))) break;
      await page.waitForTimeout((1000) * SLOW);
    }
    console.log('Textes confiés à la synthèse vocale :\n  ' + spoken.join('\n  '));
    // Introduction du donjon (et non le seuil de la carte, qui porte aussi son nom).
    if (!spoken.some((t) => t.includes('sens dessus dessous'))) {
      console.log("ÉCHEC : l'introduction du donjon n'a pas été lue");
      await shot('introduction');
      failed = true;
    } else {
      console.log('OK : lecture à voix haute appelée dans le navigateur');
    }
    // Erreur d'essai remontée (envoi toutes les 15 s, une fois l'appareil relié).
    let reported = null;
    for (let i = 0; i < 25 && !reported; i++) {
      const rows = await (await fetch(errorsUrl, { headers: { ...base, Cookie: cookie } })).json();
      reported = rows.find((r) => r.message.includes("Erreur d'essai"));
      if (!reported) await page.waitForTimeout((1000) * SLOW);
    }
    if (!reported) {
      console.log("ÉCHEC : l'erreur d'essai n'est pas arrivée au serveur");
      failed = true;
    } else if (!reported.location.includes('error_report.gd')) {
      // Sans always_track_call_stacks, l'export publié ne donne que l'endroit dans le moteur.
      console.log(`ÉCHEC : erreur remontée sans l'endroit dans le script (${reported.location})`);
      failed = true;
    } else {
      console.log(`OK : erreur remontée (version ${reported.version}, ${reported.platform}, ${reported.location})`);
      await fetch(errorsUrl, { method: 'DELETE', headers: { ...base, Cookie: cookie } });
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
