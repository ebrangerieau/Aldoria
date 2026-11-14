import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createServices } from './app/services'
import { installReloadOnNewBuild } from './app/staleBuild'
import { App } from './ui/App'
import './ui/styles.css'

// Onglet resté ouvert pendant une mise en ligne : recharger plutôt qu'échouer à l'entrée dans l'île.
installReloadOnNewBuild()
const services = createServices()
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
)
