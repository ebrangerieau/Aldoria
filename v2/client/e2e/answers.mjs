// Réponses aux questions dans le navigateur (parcours smoke.mjs). Les questions sont tirées au hasard dans le paquet : chaque forme
// de question que le jeu sait poser doit pouvoir être résolue ici, sinon le parcours échoue une fois sur dix, au hasard du tirage.

/** « 3/4 », « 1,5 » ou « 2 » en nombre. */
export const toNumber = (text) => {
  const [n, d] = String(text).replace(',', '.').split('/')
  return Number(n) / Number(d ?? 1)
}

/**
 * Attend que la question lue par les tests (`window.__aldoria.question`, posée après l'affichage) soit celle du panneau ouvert :
 * sans cela, on pourrait répondre à la question d'avant.
 */
export async function currentQuestion(page, timeout) {
  await page.waitForFunction(
    () => window.__aldoria?.question && document.querySelector('.question-panel .prompt')?.textContent === window.__aldoria.question.prompt,
    null,
    { timeout },
  )
  return page.evaluate(() => window.__aldoria.question)
}

/** Répond à la question ouverte, juste ou fausse, quel que soit son widget ; ne clique pas sur « Continuer ». */
export async function solve(page, item, correct) {
  const a = item.answer
  const valider = () => page.getByRole('button', { name: 'Valider' }).click()
  if (item.type === 'number_line') {
    // Droite graduée : le point se place cran par cran (le premier appui sur « un cran à droite » pose la graduation 0).
    const v = item.visual
    const sub = Math.max(1, Math.trunc(v.subdivisions ?? 2))
    let ticks = Math.round((toNumber(a.value) - (v.min ?? 0)) * sub)
    if (!correct) ticks = ticks === 0 ? 1 : 0
    for (let i = 0; i <= ticks; i += 1) await page.getByRole('button', { name: /Un cran à droite/ }).click()
    await valider()
  } else if (a.kind === 'choice') {
    const count = await page.locator('.choice').count()
    await page.locator('.choice').nth(correct ? a.index : (a.index + 1) % count).click()
  } else if (a.kind === 'number' || a.kind === 'fraction') {
    await page.getByLabel('Ta réponse').fill(correct ? String(a.value).replace('.', ',') : '99999')
    await valider()
  } else if (a.kind === 'text') {
    await page.getByLabel('Ta réponse').fill(correct ? a.value[0] : 'zzzz')
    await valider()
  } else if (a.kind === 'order') {
    for (const i of correct ? a.value : [...a.value].reverse()) await page.locator('.choices .choice').nth(i).click()
    await valider()
  } else if (a.kind === 'vector') {
    const [x, y] = correct ? a.value : ['99', '99']
    await page.getByLabel('Première coordonnée, x').fill(String(x).replace('.', ','))
    await page.getByLabel('Deuxième coordonnée, y').fill(String(y).replace('.', ','))
    await valider()
  } else {
    throw new Error(`forme de question non gérée par le test : ${item.type} / ${a.kind}`)
  }
}
