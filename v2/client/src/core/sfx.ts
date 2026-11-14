/**
 * Effets sonores courts (clic, bonne et mauvaise réponse, coups, soin, victoire…), repris de la v1 : les dix fichiers
 * `public/ressources/sfx/*.wav` sont synthétisés par tools/make_sfx.py. Logique pure : le lecteur (app/sfx.ts) les charge et
 * les joue. Aucun effet n'est lié à la vitesse de réponse.
 */
export const SOUNDS = ['click', 'correct', 'crit', 'wrong', 'hit', 'hurt', 'spell', 'heal', 'victory', 'retreat'] as const
export type Sound = (typeof SOUNDS)[number]

/** Volume des effets, comme la v1 (-4 dB) : sous la voix et la musique, jamais agressif. */
export const VOLUME_DB = -4

export const gainOf = (db: number): number => 10 ** (db / 20)

export const soundUrl = (name: Sound, base = '/ressources/sfx/'): string => `${base}${name}.wav`

export const isSound = (name: string): name is Sound => (SOUNDS as readonly string[]).includes(name)

/** Hauteur d'un son (1 : celle du fichier), bornée : au-delà, le son devient méconnaissable. */
export const clampPitch = (pitch: number): number => (Number.isFinite(pitch) ? Math.min(2, Math.max(0.5, pitch)) : 1)
