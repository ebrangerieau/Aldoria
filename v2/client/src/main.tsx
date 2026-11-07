import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createServices } from './app/services'
import { App } from './ui/App'
import './ui/styles.css'

const services = createServices()
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
)
