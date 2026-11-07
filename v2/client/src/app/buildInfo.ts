/** Version du jeu : le commit, posé par la CI à la construction de l'image (`VITE_VERSION`,
 * deploy/web.Dockerfile) ; « dev » sur le poste. Affichée dans les Options, jointe aux erreurs. */
export const VERSION: string = (import.meta.env.VITE_VERSION as string | undefined)?.slice(0, 40) || 'dev'
