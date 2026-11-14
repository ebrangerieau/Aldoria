/**
 * Onglet resté ouvert pendant une mise en ligne : les fichiers du jeu sont nommés par empreinte et
 * chaque build les renomme. L'ancienne page demande, à l'entrée dans l'île, des fichiers qui
 * n'existent plus (Vite le signale par l'événement `vite:preloadError`). On recharge alors la page
 * une fois pour prendre la nouvelle version ; si l'échec revient juste après un rechargement, ce
 * n'est plus une mise en ligne : on laisse l'erreur s'afficher et remonter (`app/staleBuild.ts`).
 */
export const RELOAD_GUARD_MS = 60_000

export function shouldReloadForNewBuild(now: number, lastReload: number | null): boolean {
  return lastReload === null || !Number.isFinite(lastReload) || now - lastReload >= RELOAD_GUARD_MS || now < lastReload
}
