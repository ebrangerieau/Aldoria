import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
const S = process.argv[2]
const samples = JSON.parse(readFileSync(`${S}/samples.json`, 'utf8'))
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const [key, item] of Object.entries(samples)) {
  const classe = key.startsWith('vector') || key.startsWith('sign') ? '&classe=2nde' : ''
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
  p.on('pageerror', (e) => console.log(key, 'pageerror', e.message.slice(0, 200)))
  p.on('console', (m) => { if (m.type() === 'error') console.log(key, 'console', m.text().slice(0, 200)) })
  await p.goto(`http://127.0.0.1:5199/?decouverte&e2e&qualite=bas&erreurs=0${classe}`)
  await p.waitForFunction(() => window.__aldoria?.world, null, { timeout: 240_000 })
  await p.evaluate((it) => { window.__aldoria.services.questions.next = () => it }, item)
  await p.evaluate(() => window.__aldoria.world.teleport(9, -24.5, 9, -22))
  await p.getByTestId('invite').waitFor({ timeout: 20_000 })
  await p.keyboard.press('KeyE')
  await p.getByRole('dialog').waitFor()
  await p.waitForTimeout(600)
  await p.screenshot({ path: `${S}/visuel-${key.replace(/[^a-z_+]/g, '')}.png` })
  console.log(key, 'ok', item.prompt.slice(0, 80))
  await p.close()
}
await b.close()
