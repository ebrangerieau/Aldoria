/**
 * Rechargement après une mise en ligne (règle dans `core/staleBuild.ts`). L'heure du dernier
 * rechargement est gardée pour l'onglet (`sessionStorage`) : jamais deux rechargements de suite.
 * Pendant le rechargement, les erreurs qui suivent l'échec (import qui ne rend rien) ne remontent
 * pas à l'exploitant : elles ne disent rien d'autre qu'« une nouvelle version est arrivée ».
 */
import { shouldReloadForNewBuild } from '../core/staleBuild'

const KEY = 'aldoria2.rechargement'
let pending = false

export function reloadPending(): boolean {
  return pending
}

export function installReloadOnNewBuild(): void {
  window.addEventListener('vite:preloadError', (event) => {
    let last: number | null = null
    try {
      const saved = sessionStorage.getItem(KEY)
      last = saved === null ? null : Number(saved)
    } catch {
      last = null
    }
    if (!shouldReloadForNewBuild(Date.now(), last)) return // déjà rechargé : l'erreur s'affiche et remonte
    try {
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch {
      return // sans sessionStorage, pas de garde contre une boucle : on ne recharge pas
    }
    pending = true
    console.warn('Nouvelle version du jeu : rechargement de la page.')
    event.preventDefault()
    location.reload()
  })
}
