import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_HITS, Combatant, Encounter, sealsLeft, type Answer } from '../src/core/combat/encounter'
import { digest } from '../src/core/recordedVoices'
import { MAX_PER_ITEM } from '../src/core/inventory'
import { bossOf, isBossRoom } from '../src/core/quest/boss'
import { chestMessage, CHEST_ITEMS, completePlace, pageGreeting } from '../src/core/quest/chest'
import { EMPTY_SAVE, type SaveData } from '../src/core/save'
import { CHEST_RADIUS, CLIMB_RISE, Dungeon, type DungeonDecor, ENEMY_RADIUS, ROOM_W } from '../src/core/world/dungeon'
import { Obstacles } from '../src/core/world/obstacles'
import { DUNGEONS } from '../src/core/world/places'

const fresh = (): SaveData => structuredClone(EMPTY_SAVE)
const right: Answer = { correct: true, speedRatio: 1.2, rewardFactor: 1, hintUsed: false, difficulty: 3 }

describe('sceaux de l’Effaceur', () => {
  it('se comptent d’après les PV : tous intacts, puis un de moins à chaque tranche, jamais négatifs', () => {
    expect(sealsLeft(200, 200)).toBe(BOSS_HITS)
    expect(sealsLeft(175, 200)).toBe(7)
    expect(sealsLeft(176, 200)).toBe(8) // 25 PV par sceau : 176 PV entament à peine le premier
    expect(sealsLeft(1, 200)).toBe(1)
    expect(sealsLeft(0, 200)).toBe(0)
    expect(sealsLeft(-5, 200)).toBe(0)
    expect(sealsLeft(10, 0)).toBe(0)
    expect(sealsLeft(205, 205)).toBe(BOSS_HITS) // PV qui ne se divisent pas : toujours huit sceaux au départ
  })

  it('suivent les vrais dégâts : une bonne réponse en brise un, et le dernier tombe avec l’Effaceur', () => {
    const hero = new Combatant('Héros', 10_000)
    const foe = new Combatant('Le Grand Diviseur', 200)
    const encounter = new Encounter(hero, { world: 'lumineux', random: () => 0 })
    encounter.engage(foe, { tier: 4, rewardXp: 150, boss: true, baseLevels: { chapitre: 3 } })
    const seals: number[] = [sealsLeft(foe.hp, foe.maxHp)]
    for (let i = 0; i < BOSS_HITS; i += 1) {
      const turn = encounter.answer('chapitre', right)
      seals.push(sealsLeft(foe.hp, foe.maxHp))
      expect(turn.outcome).toBe(i === BOSS_HITS - 1 ? 'victory' : null)
    }
    expect(seals).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0])
  })

  it('un indice affaiblit le coup : le sceau ne se brise pas toujours ; un coup critique en brise plus vite', () => {
    const hero = new Combatant('Héros', 10_000)
    const foe = new Combatant('Le Faux Peseur', 200)
    const encounter = new Encounter(hero, { world: 'lumineux', random: () => 0 })
    encounter.engage(foe, { tier: 4, rewardXp: 160, boss: true })
    encounter.answer('chapitre', { ...right, hintUsed: true }) // 25 × 0,7 = 18 PV
    expect(foe.hp).toBe(182)
    expect(sealsLeft(foe.hp, foe.maxHp)).toBe(8)
    const quick = new Combatant('Le Dragon', 240)
    encounter.engage(quick, { tier: 5, rewardXp: 170, boss: true })
    encounter.answer('chapitre', { ...right, speedRatio: 0.2 }) // critique : 30 × 1,25 = 38 PV
    expect(quick.hp).toBe(240 - 38)
    expect(sealsLeft(quick.hp, quick.maxHp)).toBe(7)
  })
})

describe('l’Effaceur de chaque lieu', () => {
  it('les 30 lieux ont leur Effaceur, dans leur dernière salle, avec une force qui se bat à huit sceaux', () => {
    expect(DUNGEONS).toHaveLength(30)
    for (const d of DUNGEONS) {
      const boss = bossOf(d)
      expect(boss, d.code).not.toBeNull()
      expect(boss!.room, d.code).toBe(d.rooms.length - 1)
      expect(isBossRoom(d, boss!.room)).toBe(true)
      expect(isBossRoom(d, 0)).toBe(false)
      expect(boss!.spec.name.length).toBeGreaterThan(3)
      expect(boss!.spec.hp, d.code).toBeGreaterThanOrEqual(200)
      expect(boss!.spec.hp, d.code).toBeLessThanOrEqual(260)
      expect(boss!.spec.xp, d.code).toBeGreaterThan(100)
      expect(d.boss_intro.length, d.code).toBeGreaterThan(20)
      expect(d.boss_defeat.length, d.code).toBeGreaterThan(20)
    }
  })

  it('un lieu sans Effaceur n’en invente pas', () => {
    expect(bossOf({ rooms: [{ kind: 'entree', title: 'Hall' }] })).toBeNull()
    expect(bossOf({ rooms: [{ kind: 'boss', title: 'Salle vide' }] })).toBeNull()
  })
})

describe('fin d’un lieu : le coffre', () => {
  const tour = { code: 'tour_fractions', chest_xp: 100 }

  it('la première fois : lieu terminé, XP du coffre, deux objets, page rendue ; la partie d’avant n’est pas modifiée', () => {
    const before = fresh()
    before.xp = 120
    const done = completePlace(before, tour, () => 0)
    expect(done.first).toBe(true)
    expect(done.save.places).toEqual({ tour_fractions: 1 })
    expect(done.save.xp).toBe(220)
    expect(done.found).toHaveLength(CHEST_ITEMS)
    expect(Object.values(done.save.items).reduce((a, b) => a + b, 0)).toBe(CHEST_ITEMS)
    expect(done.save.story).toContain('page-tour_fractions')
    expect(before.places).toEqual({}) // jamais modifiée sur place
    expect(before.items).toEqual({})
    expect(before.story).toEqual([])
    expect(before.xp).toBe(120)
  })

  it('ensuite : le coffre rend encore l’XP et des objets, mais ce n’est plus la première fois et la page n’est pas rendue deux fois', () => {
    const first = completePlace(fresh(), tour, () => 0)
    const again = completePlace(first.save, tour, () => 0.5)
    expect(again.first).toBe(false)
    expect(again.save.places.tour_fractions).toBe(2)
    expect(again.save.xp).toBe(first.save.xp + 100)
    expect(again.save.story.filter((s) => s === 'page-tour_fractions')).toHaveLength(1)
  })

  it('un sac plein ne gagne pas d’objet (jamais plus de cinq de chaque), le reste du coffre est rendu', () => {
    const save = fresh()
    save.items = { plume: MAX_PER_ITEM, parchemin: MAX_PER_ITEM, bouclier: MAX_PER_ITEM, potion: MAX_PER_ITEM }
    const done = completePlace(save, tour)
    expect(done.found).toEqual([])
    expect(done.save.items).toEqual(save.items)
    expect(done.save.xp).toBe(100)
  })

  it('termine d’abord un lieu, puis le suivant s’ouvre : le lieu terminé est compté pour le précédent', () => {
    const done = completePlace(fresh(), tour, () => 0)
    // isOpen(place, done) lit `places[précédent] > 0` : c'est ce que le coffre vient d'écrire.
    expect((done.save.places[tour.code] ?? 0) > 0).toBe(true)
  })
})

describe('message du coffre', () => {
  const tour = DUNGEONS.find((d) => d.code === 'tour_fractions')!

  it('la première fois : la page des Fractions est retrouvée, avec ce qu’elle rend, les réponses et l’XP', () => {
    const m = chestMessage(tour, { first: true, answered: 14, correct: 11, found: ['plume', 'potion'] })
    expect(m.title).toBe('La page des Fractions retrouvée !')
    expect(m.text.split('\n')).toEqual([
      tour.page_text,
      '11 bonnes réponses sur 14. +100 XP dans le coffre.',
      "Dans ton sac : Plume du sage, Potion d'urgence.",
    ])
  })

  it('les fois suivantes : le mot de la fin, « terminé », sans ligne d’objets quand le sac est plein', () => {
    const m = chestMessage(tour, { first: false, answered: 9, correct: 9, found: [] })
    expect(m.title).toBe('La Tour des Fractions : terminé !')
    expect(m.text.split('\n')).toEqual([tour.outro, '9 bonnes réponses sur 9. +100 XP dans le coffre.'])
  })

  it('accorde « bonne réponse » au singulier, y compris aucune', () => {
    expect(chestMessage(tour, { first: false, answered: 3, correct: 1, found: [] }).text).toContain('1 bonne réponse sur 3.')
    expect(chestMessage(tour, { first: false, answered: 3, correct: 0, found: [] }).text).toContain('0 bonne réponse sur 3.')
  })

  it('chaque lieu a sa page à rendre et son mot de la fin', () => {
    for (const d of DUNGEONS) {
      const m = chestMessage(d, { first: true, answered: 5, correct: 5, found: [] })
      expect(m.title, d.code).toMatch(/retrouvée !$/)
      expect(m.text, d.code).toContain(d.page_text)
      expect(chestMessage(d, { first: false, answered: 5, correct: 5, found: [] }).text, d.code).toContain(d.outro)
    }
  })
})

describe('salut de Maître Ysaline au retour sur l’île', () => {
  const sounds = fileURLToPath(new URL('../../deploy/voix/', import.meta.url))
  // Lu à l'exécution : l'image web2 ne copie que client/ et content/ (voir recordedVoices.test.ts).
  const manifest = JSON.parse(readFileSync(sounds + 'manifest.json', 'utf-8')) as Record<string, { id: string; voix: string }>

  it('les 30 lieux ont leur salut, enregistré de la voix de Maître Ysaline', async () => {
    const lost: string[] = []
    for (const d of DUNGEONS) {
      const text = pageGreeting(d.code)
      const entry = text ? manifest[await digest(text)] : undefined
      if (entry?.id !== `page-${d.code}` || entry.voix !== 'ysaline') lost.push(d.code)
    }
    expect(lost).toEqual([])
  })

  it('un lieu inconnu n’a pas de salut', () => {
    expect(pageGreeting('lieu_inconnu')).toBeNull()
  })

  it('annonce le chemin qui s’ouvre « sur l’île » (jamais sur une carte du royaume)', () => {
    for (const d of DUNGEONS) {
      const text = pageGreeting(d.code)!
      expect(text, d.code).not.toMatch(/sur la carte/)
      expect(text, d.code).toMatch(/Tu as rapporté/)
    }
  })
})

describe('le coffre dans la salle de l’Effaceur (30 lieux)', () => {
  it('apparaît sur le sol de la salle du boss, hors des objets, de l’Effaceur tombé et de l’escalier, et reste atteignable', () => {
    for (const place of DUNGEONS) {
      const dungeon = new Dungeon(place.rooms.length, CLIMB_RISE, (place as unknown as { v1_decor: DungeonDecor }).v1_decor)
      const obstacles = new Obstacles()
      for (const c of dungeon.obstacles()) obstacles.add(c)
      const boss = bossOf(place)!
      const where = `${place.code} (${boss.spec.name})`
      const chest = dungeon.chestPoint(boss.room)
      const floor = boss.room * CLIMB_RISE
      expect(dungeon.roomAt(chest.x), where).toBe(boss.room)
      expect(dungeon.heightAt(chest.x, chest.z), `${where} : sol du coffre`).toBe(floor)
      expect(obstacles.overlaps(chest.x, chest.z, CHEST_RADIUS), `${where} : coffre sur un objet`).toBe(false)
      // L'Effaceur vaincu gît à sa place : le coffre ne lui est pas posé dessus.
      const at = dungeon.enemyPoint(boss.room, boss.spec.v1_at)
      expect(Math.hypot(chest.x - at.x, chest.z - at.z), `${where} : coffre sur l'Effaceur`).toBeGreaterThan(ENEMY_RADIUS + CHEST_RADIUS + 1)
      // Le héros combat à FIGHT_GAP de l'Effaceur : le coffre est à portée de marche depuis là, sans traverser un objet.
      const spot = dungeon.fightSpot(boss.room, at)
      const dx = chest.x - spot.x
      const dz = chest.z - spot.z
      for (let k = 0; k <= 20; k += 1) {
        expect(obstacles.overlaps(spot.x + (dx * k) / 20, spot.z + (dz * k) / 20, 0.45), `${where} : chemin vers le coffre`).toBe(false)
      }
      // Pas d'escalier dans la dernière salle : tout le quart est de la salle est libre.
      expect(dungeon.hasStairs(boss.room), where).toBe(false)
      expect(chest.x - boss.room * ROOM_W, where).toBeLessThan(ROOM_W - 0.75 - CHEST_RADIUS)
    }
  })
})
