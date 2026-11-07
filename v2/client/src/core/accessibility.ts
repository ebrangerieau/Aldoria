/**
 * Aménagements (troubles « dys ») réglés par le parent (api/app/engine/accommodations.py) et
 * réglages que l'enfant peut ajouter lui-même (agrandir le texte, jamais retirer un
 * aménagement du parent). Appliqués par des attributs sur <html> : tout le style est en CSS
 * (ui/styles.css), aucune scène ne réécrit la police ou les tailles.
 */
export interface Accommodations {
  read_aloud: boolean
  auto_read: boolean
  text_size: number
  spacing: boolean
  readable_font: boolean
  no_speed: boolean
  math_tools: boolean
  easy_start: boolean
  tap_only: boolean
  big_targets: boolean
  calm: boolean
  pause_minutes: number
  colorblind: boolean
}

export const DEFAULTS: Accommodations = {
  read_aloud: false,
  auto_read: false,
  text_size: 0,
  spacing: false,
  readable_font: false,
  no_speed: false,
  math_tools: false,
  easy_start: false,
  tap_only: false,
  big_targets: false,
  calm: false,
  pause_minutes: 0,
  colorblind: false,
}

/** Aménagements reçus du serveur (champs inconnus ignorés, manquants par défaut). */
export function fromServer(raw: Record<string, unknown> | undefined): Accommodations {
  const out: Accommodations = { ...DEFAULTS }
  for (const key of Object.keys(DEFAULTS) as (keyof Accommodations)[]) {
    const value = raw?.[key]
    if (typeof value === typeof DEFAULTS[key]) (out[key] as unknown) = value
  }
  return out
}

/** Réglage de l'enfant : il peut agrandir le texte, pas descendre sous le choix du parent. */
export function withChildPrefs(parent: Accommodations, prefs: { text_size?: number }): Accommodations {
  return { ...parent, text_size: Math.max(parent.text_size, Math.min(2, prefs.text_size ?? 0)) }
}

export function applyToDocument(a: Accommodations, root: HTMLElement = document.documentElement): void {
  root.dataset.textSize = String(a.text_size)
  root.dataset.readableFont = String(a.readable_font)
  root.dataset.spacing = String(a.spacing)
  root.dataset.bigTargets = String(a.big_targets)
  root.dataset.calm = String(a.calm)
  root.dataset.colorblind = String(a.colorblind)
}
