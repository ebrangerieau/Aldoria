// Navigateur des tests de bout en bout : Edge (carte graphique) sur le poste, Chromium de Playwright en
// CI (E2E_BROWSER=chromium : pas de carte graphique, WebGL par SwiftShader, plus lent). E2E_SLOW
// multiplie toutes les attentes (rendu logiciel).
const { chromium } = require('playwright-core');

const ci = process.env.E2E_BROWSER === 'chromium';
const SLOW = Number(process.env.E2E_SLOW || 1);

function launch(webgl = true) {
  if (ci) {
    const args = webgl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
    return chromium.launch({ headless: true, args });
  }
  return chromium.launch({ channel: 'msedge', headless: true, args: webgl ? ['--use-angle=d3d11'] : [] });
}

module.exports = { launch, SLOW };
