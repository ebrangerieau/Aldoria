import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ile from '@content/monde/ile.json'
import { digest } from '../src/core/recordedVoices'
import { markSeen, PAUSE_AFTER_VOICE, readingTime, shouldAutoplay, STORY_KEY, tableaux } from '../src/core/prologue'
import { EMPTY_SAVE, normalizeSave } from '../src/core/save'
import { type IslandLayout, SEA_LEVEL, Terrain } from '../src/core/world/terrain'

const layout = ile as unknown as IslandLayout
const terrain = new Terrain(layout)

/** Où chaque `lieu` des tableaux se trouve dans l'île. */
const PLACES: Record<string, { x: number; z: number }> = {
  citadelle: layout.citadelle,
  tour_oubli: layout.secrets.tour_oubli!,
  svt: layout.regions.svt!,
  ysaline: layout.ysaline,
  depart: layout.depart,
}

describe('Le prologue : les cinq tableaux', () => {
  it('cinq tableaux dans l’ordre de l’histoire : la Chronique, le vol, l’oubli, puis Maître Ysaline qui confie la quête', () => {
    for (const world of ['lumineux', 'brouillard'] as const) {
      const list = tableaux(world)
      expect(list.map((t) => t.id)).toEqual(['chronique', 'vol', 'oubli', 'ysaline', 'quete'])
      expect(list.map((t) => t.voix)).toEqual(['narrateur', 'narrateur', 'narrateur', 'ysaline', 'ysaline'])
      for (const t of list) {
        expect(t.ligne).toBe(`prologue-${t.id}-${world}`)
        expect(t.texte.length, t.ligne).toBeGreaterThan(60)
        expect(t.titre.length).toBeGreaterThan(2)
      }
    }
    // Les deux mondes ne disent pas la même chose (le ton de Jules, celui de Tom).
    expect(tableaux('lumineux')[0]!.texte).not.toBe(tableaux('brouillard')[0]!.texte)
  })

  it('chaque texte est celui que le narrateur ou Maître Ysaline a enregistré : il se lit de la vraie voix', async () => {
    const sounds = fileURLToPath(new URL('../../deploy/voix/', import.meta.url))
    const manifest = JSON.parse(readFileSync(sounds + 'manifest.json', 'utf-8')) as Record<string, { id: string; voix: string }>
    for (const world of ['lumineux', 'brouillard'] as const) {
      for (const t of tableaux(world)) {
        const entry = manifest[await digest(t.texte)]
        expect(entry?.id, t.ligne).toBe(t.ligne)
        expect(entry?.voix, t.ligne).toBe(t.voix)
      }
    }
  })

  it('chaque plan vise un endroit de l’île, sur la terre ferme, d’où la caméra ne passe pas sous le sol', () => {
    for (const t of tableaux('lumineux')) {
      const place = PLACES[t.lieu]
      expect(place, `lieu inconnu : ${t.lieu}`).toBeDefined()
      expect(t.plan.x, t.id).toBe(place!.x)
      expect(t.plan.z, t.id).toBe(place!.z)
      expect(terrain.heightAt(t.plan.x, t.plan.z), `${t.id} : le point visé est sur la terre ferme`).toBeGreaterThan(SEA_LEVEL)
      const { alpha, beta, rayon, haut } = t.plan
      for (const n of [alpha, beta, rayon, haut]) expect(Number.isFinite(n)).toBe(true)
      expect(beta).toBeGreaterThan(0.45)
      expect(beta).toBeLessThanOrEqual(1.5)
      // La caméra (au bout du rayon) reste au-dessus du relief et dans les limites du monde.
      const ground = terrain.heightAt(t.plan.x, t.plan.z)
      const eye = {
        x: t.plan.x + rayon * Math.cos(alpha) * Math.sin(beta),
        y: ground + haut + rayon * Math.cos(beta),
        z: t.plan.z + rayon * Math.sin(alpha) * Math.sin(beta),
      }
      expect(Math.abs(eye.x), `${t.id} : x`).toBeLessThan(layout.taille)
      expect(Math.abs(eye.z), `${t.id} : z`).toBeLessThan(layout.taille)
      // Au-dessus du sol sous la caméra (le monde relève de toute façon la caméra qui le touche : on vise juste dès le départ).
      expect(eye.y - terrain.heightAt(eye.x, eye.z), `${t.id} : hauteur de la caméra`).toBeGreaterThan(0.5)
    }
  })

  it('le temps de lecture grandit avec le texte, entre 5 et 25 secondes', () => {
    expect(readingTime('')).toBe(5_000)
    expect(readingTime('x'.repeat(100))).toBeLessThan(readingTime('x'.repeat(200)))
    expect(readingTime('x'.repeat(10_000))).toBe(25_000)
    for (const t of tableaux('brouillard')) {
      expect(readingTime(t.texte), t.id).toBeGreaterThanOrEqual(5_000)
      expect(readingTime(t.texte), t.id).toBeLessThanOrEqual(25_000)
    }
    expect(PAUSE_AFTER_VOICE).toBeGreaterThan(500)
  })
})

describe('Le prologue : vu ou pas vu', () => {
  it('se joue tout seul la première fois pour un enfant connecté, jamais en mode découverte, jamais une fois vu', () => {
    const fresh = normalizeSave(undefined)
    expect(shouldAutoplay(fresh, false)).toBe(true)
    expect(shouldAutoplay(fresh, true)).toBe(false)
    expect(shouldAutoplay(markSeen(fresh), false)).toBe(false)
  })

  it('le marquer rend une partie neuve, une seule fois (déjà vu : la même), sans toucher aux autres étapes', () => {
    const before = { ...EMPTY_SAVE, story: ['page-a'] }
    const after = markSeen(before)
    expect(after).not.toBe(before)
    expect(before.story).toEqual(['page-a'])
    expect(after.story).toEqual(['page-a', STORY_KEY])
    expect(markSeen(after)).toBe(after)
  })
})
