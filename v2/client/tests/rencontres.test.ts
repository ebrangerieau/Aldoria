import { describe, expect, it } from 'vitest'
import { type Action, type Answer, Combatant, type CombatEvent, Encounter, type Engagement } from '../src/core/combat/encounter'
import { applyEvent, type FightHost, type FightView, runFight, viewOf } from '../src/core/combat/flow'
import { combatTexts, pickOne } from '../src/core/combat/texts'
import {
  AGGRO_DISTANCE, CLIMB_RISE, Dungeon, type DungeonDecor, ENEMY_RADIUS, FIGHT_GAP, FIGHT_MARGIN, OPEN_KINDS, ROOM_W, STAIR_RUN, VOID_HEIGHT,
} from '../src/core/world/dungeon'
import { HERO_RADIUS, RUN_SPEED, step } from '../src/core/world/movement'
import { Obstacles } from '../src/core/world/obstacles'
import { DUNGEONS } from '../src/core/world/places'
import { enemyFile, enemyFiles, HERO_HEIGHT, isSkeleton, MONSTER_MODELS, monsterFit } from '../src/core/world/monsters'

const right = (over: Partial<Answer> = {}): Answer => ({ correct: true, speedRatio: 1.4, rewardFactor: 1, hintUsed: false, difficulty: 2, ...over })
const wrong = (): Answer => ({ correct: false, speedRatio: 1, rewardFactor: 1, hintUsed: false, difficulty: 2 })

/** Un faux hôte : les choix et les verdicts viennent d'un scénario, ce qui est raconté est noté. */
function script(actions: Action[], answers: (Answer | null)[]) {
  const log: string[] = []
  const shown: CombatEvent[][] = []
  const views: FightView[] = []
  const asked: { action: Action; role: string; level: number }[] = []
  const host: FightHost = {
    chooseAction: async (view) => {
      views.push(view)
      log.push('choisit')
      const next = actions.shift()
      if (!next) throw new Error('plus d’action au scénario')
      return next
    },
    ask: async (action, role, level) => {
      log.push('question')
      asked.push({ action, role, level })
      const next = answers.shift()
      if (next === undefined) throw new Error('plus de réponse au scénario')
      return next
    },
    show: async (events) => {
      log.push('raconte')
      shown.push(events)
    },
  }
  return { host, log, shown, views, asked }
}

function encounter(foeHp = 100, over: Partial<Engagement> = {}) {
  const hero = new Combatant('Archiviste', 100)
  const foe = new Combatant('Champignon', foeHp)
  const enc = new Encounter(hero, { world: 'lumineux', random: () => 0.5 })
  enc.engage(foe, { tier: 1, rewardXp: 30, ...over })
  return { hero, foe, enc }
}

describe('Déroulé d’un combat', () => {
  it('enchaîne action, question, verdict et récit jusqu’à la victoire', async () => {
    const { enc } = encounter(36)
    const s = script(['automatisme', 'automatisme'], [right(), right()])
    expect(await runFight(enc, s.host)).toBe('victory')
    expect(s.log).toEqual(['choisit', 'question', 'raconte', 'choisit', 'question', 'raconte'])
    expect(s.shown.at(-1)!.map((e) => e.kind)).toContain('foe_down')
  })

  it('une erreur ne finit pas le combat : la riposte est racontée, puis on rechoisit', async () => {
    const { enc, hero } = encounter(100)
    const s = script(Array(5).fill('chapitre'), [wrong(), right(), right(), right(), right()])
    expect(await runFight(enc, s.host)).toBe('victory') // 4 sorts de 32 (128 PV) après 1 erreur
    expect(s.shown[0]!.map((e) => e.kind)).toEqual(['hero_stumble', 'foe_attack'])
    expect(hero.hp).toBeLessThan(100)
  })

  it('rend « repli » quand le héros tombe', async () => {
    const hero = new Combatant('Archiviste', 100, 4)
    const enc = new Encounter(hero, { world: 'lumineux', random: () => 0.5 })
    enc.engage(new Combatant('Gelée', 100), { tier: 1, rewardXp: 30 })
    const s = script(['automatisme'], [wrong()])
    expect(await runFight(enc, s.host)).toBe('retreat')
    expect(s.shown[0]!.at(-1)!.kind).toBe('hero_down')
  })

  it('sans question à poser (null), on revient aux actions sans rien compter', async () => {
    const { enc } = encounter(10)
    const s = script(['automatisme', 'automatisme'], [null, right()])
    expect(await runFight(enc, s.host)).toBe('victory')
    expect(s.log).toEqual(['choisit', 'question', 'choisit', 'question', 'raconte'])
    expect(enc.questions).toBe(1)
    expect(enc.hero.hp).toBe(100) // aucune riposte pour la question qui n'a pas eu lieu
  })

  it('le soin interroge le chapitre, une frappe l’automatisme', async () => {
    const { enc, hero } = encounter(18)
    hero.damage(40)
    const s = script(['soin', 'automatisme'], [right(), right()])
    await runFight(enc, s.host)
    expect(s.asked.map((a) => `${a.action}:${a.role}`)).toEqual(['soin:chapitre', 'automatisme:automatisme'])
  })

  it('un boss impose la difficulté de ses questions, qui monte', async () => {
    const { enc } = encounter(200, { boss: true, baseLevels: { chapitre: 3 } })
    const s = script(Array(8).fill('chapitre'), Array(8).fill(right()))
    await runFight(enc, s.host)
    const levels = s.asked.map((a) => a.level)
    expect(levels[0]).toBe(2)
    expect(levels.at(-1)).toBeGreaterThanOrEqual(3)
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })

  it('montre à l’interface les PV, le soin possible et les questions déjà posées', async () => {
    const { enc, hero } = encounter(100)
    hero.damage(10)
    const s = script(['automatisme', 'automatisme', 'automatisme', 'automatisme', 'automatisme', 'automatisme'], Array(6).fill(right()))
    await runFight(enc, s.host)
    expect(s.views[0]).toMatchObject({ foe: { name: 'Champignon', hp: 100, maxHp: 100 }, hero: { hp: 90, maxHp: 100 }, canHeal: true, boss: false, questions: 0 })
    expect(s.views[1]!.questions).toBe(1)
    expect(s.views[1]!.foe.hp).toBeLessThan(100)
    expect(viewOf(enc).foe.hp).toBe(0)
  })
})

// --- Portes et emplacements ---------------------------------------------------------------------------

const decorOf = (d: unknown) => (d as { v1_decor: DungeonDecor }).v1_decor

describe('Portes d’un lieu', () => {
  const kinds = ['entree', 'combat', 'combat', 'enigme', 'combat', 'boss']

  it('ferme la sortie des salles de combat, de l’énigme et du boss, ouvre celle de l’entrée', () => {
    const tower = new Dungeon(6)
    tower.lockDoors(kinds)
    expect(tower.lockedDoors).toEqual([1, 2, 3, 4])
    expect([...OPEN_KINDS].sort()).toEqual(['entree'])
    expect(tower.isDoorOpen(0)).toBe(true)
    expect(tower.isDoorOpen(1)).toBe(false)
  })

  it('une porte fermée est un mur : le héros s’arrête devant, une porte ouverte le laisse passer', () => {
    const tower = new Dungeon(6)
    tower.lockDoors(kinds)
    const run = (from: { x: number; z: number }, seconds: number) => {
      let p = { x: from.x, z: from.z, y: tower.heightAt(from.x, from.z) }
      for (let t = 0; t < seconds; t += 1 / 60) p = step(p, { x: 1, z: 0 }, RUN_SPEED, 1 / 60, tower, null)
      return p
    }
    const start = tower.entryPoint(1)
    const blocked = run(start, 10)
    expect(blocked.x).toBeLessThan(2 * ROOM_W) // la porte 1 est fermée
    expect(blocked.y).toBeGreaterThan(2 * CLIMB_RISE - 1.2) // en haut de l'escalier de la salle 1, à un rayon de héros de la porte
    tower.openDoor(1)
    expect(tower.lockedDoors).toEqual([2, 3, 4])
    expect(run(start, 10).x).toBeGreaterThan(2 * ROOM_W + 1)
  })

  it('une porte fermée reste du vide même en son milieu, ouverte elle donne une hauteur', () => {
    const tower = new Dungeon(6)
    tower.lockDoors(kinds)
    expect(tower.heightAt(2 * ROOM_W, -10)).toBe(VOID_HEIGHT)
    tower.openDoor(1)
    expect(tower.heightAt(2 * ROOM_W, -10)).toBeGreaterThan(VOID_HEIGHT)
  })

  it('ne ferme jamais la dernière salle', () => {
    const tower = new Dungeon(6)
    tower.lockDoors(['combat', 'combat', 'combat', 'combat', 'combat', 'boss'])
    expect(tower.lockedDoors).toEqual([0, 1, 2, 3, 4])
  })
})

describe('Ennemis des 30 lieux', () => {
  it('posent chaque ennemi et son point de combat sur le sol, dans sa salle, hors des obstacles', () => {
    for (const place of DUNGEONS) {
      const dungeon = new Dungeon(place.rooms.length, CLIMB_RISE, decorOf(place))
      const obstacles = new Obstacles()
      for (const c of dungeon.obstacles()) obstacles.add(c)
      place.rooms.forEach((room, index) => {
        for (const enemy of room.enemies ?? []) {
          const at = enemy as unknown as { v1_at: [number, number]; name: string }
          const where = `${place.code} salle ${index} ${at.name}`
          const p = dungeon.enemyPoint(index, at.v1_at)
          const floor = index * CLIMB_RISE
          expect(dungeon.roomAt(p.x), where).toBe(index)
          expect(dungeon.heightAt(p.x, p.z), `${where} : sol`).toBe(floor) // plat : ni vide, ni escalier
          expect(obstacles.overlaps(p.x, p.z, ENEMY_RADIUS), `${where} : sur un objet`).toBe(false)
          const spot = dungeon.fightSpot(index, p)
          expect(spot.x, where).toBeGreaterThanOrEqual(index * ROOM_W + FIGHT_MARGIN)
          expect(p.x - spot.x, where).toBeLessThanOrEqual(FIGHT_GAP + 1e-9)
          expect(dungeon.heightAt(spot.x, spot.z), `${where} : point de combat`).toBe(floor)
          // L'escalier (x de 12 à 16, autour de la porte) reste libre : ni ennemi, ni combat dessus.
          const onStairs = (x: number, z: number) => x - index * ROOM_W > ROOM_W - STAIR_RUN - HERO_RADIUS && Math.abs(-z - 10) < 3
          expect(onStairs(p.x, p.z), `${where} : escalier`).toBe(false)
        }
      })
    }
  })

  it('un ennemi qui se tient près de l’entrée de sa salle ne coince pas le héros hors de la salle', () => {
    for (const place of DUNGEONS) {
      const dungeon = new Dungeon(place.rooms.length, CLIMB_RISE, decorOf(place))
      place.rooms.forEach((room, index) => {
        for (const enemy of room.enemies ?? []) {
          const p = dungeon.enemyPoint(index, (enemy as unknown as { v1_at: [number, number] }).v1_at)
          // Le héros arrive par la porte ouest (x = salle + 2,5) : il doit pouvoir s'approcher à AGGRO_DISTANCE.
          expect(p.x - (index * ROOM_W + 2.5), `${place.code} ${index}`).toBeGreaterThan(AGGRO_DISTANCE - 1.5)
        }
      })
    }
  })
})

describe('Ennemis : modèles et mesures', () => {
  const models = new Set(DUNGEONS.flatMap((d) => d.rooms.flatMap((r) => (r.enemies ?? []).map((e) => e.model))))

  it('connaît chaque modèle d’ennemi des 30 lieux : squelette KayKit ou monstre mesuré', () => {
    expect(models.size).toBe(18)
    for (const model of models) {
      if (isSkeleton(model)) continue
      const fit = monsterFit(model)
      expect(fit, model).not.toBeNull()
      expect(fit!.scale, `${model} : échelle (à mesurer : tools/mesurer_monstres.mjs)`).toBeGreaterThan(0.05)
      expect(fit!.scale, `${model} : échelle`).toBeLessThan(5)
    }
  })

  it('donne aux monstres une hauteur proportionnelle à celle du héros', () => {
    expect(HERO_HEIGHT).toBe(1.75)
    expect(monsterFit('Mushnub')!.height).toBeCloseTo((1.7 * 1.75) / 2.5, 5)
    expect(monsterFit('Mushnub')!.height).toBeLessThan(monsterFit('MushnubEvolved')!.height)
    expect(monsterFit('Skeleton_Warrior')).toBeNull()
    expect(monsterFit('Inconnu')).toBeNull()
  })

  it('tourne le dragon (modélisé de profil), pas les autres', () => {
    expect(monsterFit('Dragon')!.yaw).toBeCloseTo(Math.PI / 2, 5)
    expect(monsterFit('Orc')!.yaw).toBe(0)
  })

  it('ne couvre que des monstres dont le fichier existe', async () => {
    const { existsSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    for (const model of MONSTER_MODELS) {
      expect(existsSync(fileURLToPath(new URL(`../public/ressources/models/quaternius/monsters/${model}.glb`, import.meta.url))), model).toBe(true)
    }
    for (const model of ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage']) {
      expect(isSkeleton(model)).toBe(true)
      expect(existsSync(fileURLToPath(new URL(`../public/ressources/models/kaykit/characters/${model}.glb`, import.meta.url))), model).toBe(true)
    }
  })
})

describe('État affiché pendant un tour', () => {
  const view: FightView = { hero: { hp: 80, maxHp: 100 }, foe: { name: 'Gelée', hp: 50, maxHp: 80 }, boss: false, canHeal: true, questions: 1 }

  it('baisse les PV de l’ennemi au coup, ceux du héros à la riposte, jamais sous zéro', () => {
    const hit = applyEvent(view, { kind: 'hero_strike', action: 'automatisme', power: 18, crit: false })
    expect(hit.foe.hp).toBe(32)
    expect(hit.hero.hp).toBe(80)
    expect(applyEvent(hit, { kind: 'foe_attack', damage: 9, blocked: false }).hero.hp).toBe(71)
    expect(applyEvent(view, { kind: 'hero_strike', action: 'chapitre', power: 999, crit: true }).foe.hp).toBe(0)
    expect(applyEvent(view, { kind: 'foe_attack', damage: 999, blocked: false }).hero.hp).toBe(0)
  })

  it('rend des PV au soin et à la potion, jusqu’au maximum', () => {
    expect(applyEvent(view, { kind: 'hero_heal', healed: 15 }).hero.hp).toBe(95)
    expect(applyEvent(view, { kind: 'potion', healed: 80 }).hero.hp).toBe(100)
  })

  it('laisse l’état tel quel pour les autres événements', () => {
    for (const event of [{ kind: 'xp', amount: 20 }, { kind: 'hero_stumble' }, { kind: 'foe_down' }, { kind: 'shield_up' }] as CombatEvent[]) {
      expect(applyEvent(view, event)).toBe(view)
    }
  })

  it('rejoint l’état final du combat, événement après événement', async () => {
    const { enc } = encounter(36)
    const before = viewOf(enc)
    const s = script(['automatisme', 'automatisme'], [right(), right()])
    await runFight(enc, s.host)
    let shown = before
    for (const e of s.shown.flat()) shown = applyEvent(shown, e)
    expect(shown.foe.hp).toBe(viewOf(enc).foe.hp)
    expect(shown.hero.hp).toBe(viewOf(enc).hero.hp)
  })
})

describe('Textes du combat', () => {
  it('donne à chaque monde ses noms d’actions et ses mots', () => {
    for (const world of ['lumineux', 'brouillard'] as const) {
      const t = combatTexts(world)
      expect(Object.keys(t.actions).sort()).toEqual(['automatisme', 'chapitre', 'soin'])
      expect(t.encouragements.length).toBeGreaterThan(2)
      expect(t.victoire.length).toBeGreaterThan(2)
      expect(t.repli.length).toBeGreaterThan(20)
    }
    expect(combatTexts('lumineux').actions.automatisme).not.toBe(combatTexts('brouillard').actions.automatisme)
  })

  it('tire un mot de la liste', () => {
    expect(pickOne(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickOne(['a', 'b', 'c'], () => 0.999)).toBe('c')
    expect(pickOne([], () => 0.5)).toBe('')
  })
})

describe('Obstacles retirés', () => {
  it('un ennemi vaincu ne barre plus le chemin', () => {
    const obstacles = new Obstacles()
    const corps = { x: 10, z: -5, r: 0.5 }
    const autre = { x: 14, z: -5, r: 0.5 }
    obstacles.add(corps)
    obstacles.add(autre)
    expect(obstacles.overlaps(10, -5, 0.45)).toBe(true)
    obstacles.remove(corps)
    expect(obstacles.overlaps(10, -5, 0.45)).toBe(false)
    expect(obstacles.overlaps(14, -5, 0.45)).toBe(true) // les autres restent
    expect(obstacles.count).toBe(1)
    obstacles.remove(corps) // sans effet une seconde fois
    expect(obstacles.count).toBe(1)
  })

  it('le héros traverse la salle là où gisait l’ennemi', () => {
    const tower = new Dungeon(6)
    const obstacles = new Obstacles()
    const corps = { x: 27, z: -7, r: ENEMY_RADIUS }
    obstacles.add(corps)
    const run = () => {
      let p = { x: 22.2, z: -7, y: tower.heightAt(22.2, -7) }
      for (let t = 0; t < 2; t += 1 / 60) p = step(p, { x: 1, z: 0 }, RUN_SPEED, 1 / 60, tower, obstacles)
      return p
    }
    expect(run().x).toBeLessThan(26.5) // bloqué de plein fouet
    obstacles.remove(corps)
    expect(run().x).toBeGreaterThan(27.5)
  })
})

describe('Préchargement des ennemis d’un lieu', () => {
  it('donne le fichier de chaque modèle, sans doublon', () => {
    expect(enemyFile('Skeleton_Warrior')).toBe('kaykit/characters/Skeleton_Warrior.glb')
    expect(enemyFile('Mushnub')).toBe('quaternius/monsters/Mushnub.glb')
    const files = enemyFiles(DUNGEONS.find((d) => d.code === 'forge_algebre')!.rooms)
    expect(new Set(files).size).toBe(files.length)
    expect(files.filter((f) => f.startsWith('kaykit/')).length).toBeGreaterThanOrEqual(3) // trois sortes de squelettes : 8,7 Mo
  })

  it('ne cite que des fichiers qui existent, pour les 30 lieux', async () => {
    const { existsSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    for (const place of DUNGEONS) {
      for (const file of enemyFiles(place.rooms)) {
        expect(existsSync(fileURLToPath(new URL(`../public/ressources/models/${file}`, import.meta.url))), `${place.code} ${file}`).toBe(true)
      }
    }
  })
})
