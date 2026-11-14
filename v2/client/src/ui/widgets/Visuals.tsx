/**
 * Visuels des questions, en SVG (la v1 les dessinait en Godot) : balance, droite graduée, repère
 * quadrillé, carte à l'échelle, robot sur une grille, courbe. Tout le texte est du vrai texte (lecteur d'écran) et les couleurs viennent de la
 * feuille de style (aucun style en ligne). Les calculs sont dans core/visuals.ts.
 */
import { useState } from 'react'
import type { Item, UserInput } from '../../core/items'
import {
  arrowPoints,
  balanceFrom,
  canRemove,
  cellCenter,
  graphFrom,
  graphPixel,
  graphTicks,
  gridFrom,
  gridPixel,
  HEADING_NAMES,
  mapFrom,
  mapPixel,
  mapRoute,
  nearestTick,
  numberLineFrom,
  removeBoth,
  robotFrom,
  sideText,
  signed,
  type NumberLineSpec,
  tickCount,
  tickFraction,
  tickLabel,
  ticksOf,
  type BalanceState,
} from '../../core/visuals'

/** Après la réponse : le visuel montre ce qui était juste. */
export interface Revealed {
  correct: boolean
  /** Bonne réponse écrite (« 1/2 », « 6 »…). */
  answer: string
}

// --- Balance ---------------------------------------------------------------------------------

const PAN_W = 190
const MARBLE_STEP = 17

function Pan({ cx, boxes, units, revealedBox }: { cx: number; boxes: number; units: number; revealedBox: string | null }) {
  const items: { kind: 'box' | 'marble'; key: string }[] = [
    ...Array.from({ length: boxes }, (_, i) => ({ kind: 'box' as const, key: `b${i}` })),
    ...Array.from({ length: units }, (_, i) => ({ kind: 'marble' as const, key: `m${i}` })),
  ]
  const perRow = Math.floor(PAN_W / MARBLE_STEP)
  return (
    <g>
      <line x1={cx - PAN_W / 2} y1={118} x2={cx + PAN_W / 2} y2={118} className="v-pan" />
      {items.map((it, i) => {
        const row = Math.floor(i / perRow)
        const col = i % perRow
        const x = cx - PAN_W / 2 + 9 + col * MARBLE_STEP
        const y = 108 - row * MARBLE_STEP
        return it.kind === 'box' ? (
          <g key={it.key}>
            <rect x={x - 8} y={y - 14} width={26} height={26} rx={4} className="v-box" />
            <text x={x + 5} y={y + 5} className="v-box-label" textAnchor="middle">{revealedBox ?? '?'}</text>
          </g>
        ) : (
          <circle key={it.key} cx={x + 4} cy={y + 4} r={7} className="v-marble" />
        )
      })}
    </g>
  )
}

export function BalanceView({ item, revealed }: { item: Item; revealed: Revealed | null }) {
  const initial = balanceFrom(item.visual ?? {})
  const [state, setState] = useState<BalanceState>(initial.state)
  const { names } = initial
  const box = revealed?.correct ? revealed.answer : null
  return (
    <figure className="visual balance">
      <svg viewBox="0 0 560 150" role="img" aria-label={`Une balance en équilibre. À gauche : ${sideText(state.left, names)}. À droite : ${sideText(state.right, names)}.`}>
        <polygon points="280,60 262,132 298,132" className="v-stand" />
        <line x1={110} y1={60} x2={450} y2={60} className="v-beam" />
        {[130, 430].flatMap((cx) => [cx - PAN_W / 2, cx + PAN_W / 2].map((x) => <line key={`${cx}-${x}`} x1={cx} y1={60} x2={x} y2={118} className="v-string" />))}
        <Pan cx={130} boxes={state.left.boxes} units={state.left.units} revealedBox={box} />
        <Pan cx={430} boxes={state.right.boxes} units={state.right.units} revealedBox={box} />
      </svg>
      <figcaption>
        À gauche : {sideText(state.left, names)}. À droite : {sideText(state.right, names)}.
      </figcaption>
      {!revealed && (
        <div className="visual-actions">
          <button type="button" className="secondary" disabled={!canRemove(state, 'units')} onClick={() => setState(removeBoth(state, 'units'))}>
            Enlever 1 {names.unit[0]} de chaque côté
          </button>
          <button type="button" className="secondary" disabled={!canRemove(state, 'boxes')} onClick={() => setState(removeBoth(state, 'boxes'))}>
            Enlever 1 {names.box[0]} de chaque côté
          </button>
          <button type="button" className="secondary" onClick={() => setState(initial.state)} aria-label="Remettre la balance comme au départ">↺</button>
        </div>
      )}
    </figure>
  )
}

// --- Droite graduée ----------------------------------------------------------------------------

const LINE_W = 560
const LINE_MARGIN = 36

const tickX = (spec: NumberLineSpec, t: number) => LINE_MARGIN + ((LINE_W - 2 * LINE_MARGIN) * t) / tickCount(spec)

/** Droite graduée : `onChoose` la rend interactive (toucher ou « un cran à gauche / droite »). */
export function NumberLine({ spec, point, label, chosen, onChoose, correctText }: {
  spec: NumberLineSpec
  /** Point déjà placé (mode lecture), écrit « 3/4 » ou « 1,5 ». */
  point?: string
  label?: string
  chosen?: number | null
  onChoose?: (ticks: number) => void
  /** Bonne réponse, donnée après la réponse : sa graduation s'affiche. */
  correctText?: string
}) {
  const fixed = point !== undefined ? ticksOf(spec, point) : null
  const correct = correctText !== undefined ? ticksOf(spec, correctText) : null
  const mark = chosen ?? fixed
  const pick = (clientX: number, svg: SVGSVGElement) => {
    if (!onChoose) return
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * LINE_W
    onChoose(nearestTick(spec, (x - LINE_MARGIN) / (LINE_W - 2 * LINE_MARGIN)))
  }
  return (
    <svg
      viewBox={`0 0 ${LINE_W} 120`}
      className={onChoose ? 'visual number-line interactive' : 'visual number-line'}
      role="img"
      aria-label={`Droite graduée de ${spec.min} à ${spec.max}, ${spec.sub} graduations entre deux entiers.`}
      onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
      onPointerMove={(e) => e.buttons === 1 && pick(e.clientX, e.currentTarget)}
    >
      <line x1={LINE_MARGIN - 20} y1={52} x2={LINE_W - LINE_MARGIN + 24} y2={52} className="v-axis" />
      <polygon points={`${LINE_W - LINE_MARGIN + 30},52 ${LINE_W - LINE_MARGIN + 18},45 ${LINE_W - LINE_MARGIN + 18},59`} className="v-arrow" />
      {Array.from({ length: tickCount(spec) + 1 }, (_, t) => {
        const name = tickLabel(spec, t)
        const x = tickX(spec, t)
        return (
          <g key={t}>
            <line x1={x} y1={name ? 34 : 43} x2={x} y2={name ? 70 : 61} className="v-tick" />
            {name && <text x={x} y={98} textAnchor="middle" className="v-tick-label">{name}</text>}
          </g>
        )
      })}
      {correct !== null && correct !== mark && <circle cx={tickX(spec, correct)} cy={52} r={11} className="v-point good" />}
      {mark !== null && (
        <g>
          <circle cx={tickX(spec, mark)} cy={52} r={11} className={correct === null ? 'v-point' : mark === correct ? 'v-point good' : 'v-point bad'} />
          {label && <text x={tickX(spec, mark)} y={26} textAnchor="middle" className="v-point-label">{label}</text>}
        </g>
      )}
    </svg>
  )
}

/** Réponse par la droite graduée (type number_line) : on pose le point, puis « Valider ». */
export function NumberLineAnswer({ item, onAnswer, disabled }: { item: Item; onAnswer: (input: UserInput) => void; disabled: boolean }) {
  const spec = numberLineFrom(item.visual ?? {})
  const [ticks, setTicks] = useState<number | null>(null)
  const move = (delta: number) => setTicks((t) => Math.max(0, Math.min(tickCount(spec), (t ?? (delta > 0 ? -1 : tickCount(spec) + 1)) + delta)))
  return (
    <div className="number-line-answer">
      <NumberLine spec={spec} chosen={disabled ? null : ticks} onChoose={disabled ? undefined : setTicks} />
      <p className="hint">Touche la droite pour poser le point sur la bonne graduation.</p>
      <div className="visual-actions">
        <button type="button" className="secondary" disabled={disabled} onClick={() => move(-1)}>◀ Un cran à gauche</button>
        <button type="button" className="secondary" disabled={disabled} onClick={() => move(1)}>Un cran à droite ▶</button>
        <button type="button" className="primary" disabled={disabled || ticks === null} onClick={() => ticks !== null && onAnswer(tickFraction(spec, ticks))}>Valider</button>
      </div>
    </div>
  )
}

// --- Repère quadrillé (rayon, miroir, cristal) -------------------------------------------------

const GRID = 260

export function GridView({ item, revealed }: { item: Item; revealed: Revealed | null }) {
  const { span, points, path } = gridFrom(item.visual ?? {})
  const px = (name: string) => {
    const p = points.find((q) => q.name === name)
    return p ? gridPixel(p.at, span, GRID) : null
  }
  const ticks = Array.from({ length: 2 * span - 1 }, (_, i) => i - span + 1)
  const beam = path.map(px).filter((p): p is [number, number] => p !== null)
  return (
    <figure className="visual grid">
      <svg viewBox={`0 0 ${GRID} ${GRID}`} role="img" aria-label="Repère quadrillé avec les points de la question.">
        <rect width={GRID} height={GRID} className="v-grid-bg" />
        {ticks.map((k) => {
          const [x] = gridPixel([k, 0], span, GRID)
          const [, y] = gridPixel([0, k], span, GRID)
          return (
            <g key={k}>
              <line x1={x} y1={0} x2={x} y2={GRID} className={k === 0 ? 'v-grid-axis' : 'v-grid-line'} />
              <line x1={0} y1={y} x2={GRID} y2={y} className={k === 0 ? 'v-grid-axis' : 'v-grid-line'} />
            </g>
          )
        })}
        {revealed && beam.length >= 2 && (
          <polyline points={beam.map((p) => p.join(',')).join(' ')} className={revealed.correct ? 'v-beam-ray good' : 'v-beam-ray bad'} />
        )}
        {points.map((p) => {
          if (p.hidden && !revealed) return null
          const [x, y] = gridPixel(p.at, span, GRID)
          return (
            <g key={p.name}>
              {p.role === 'source' && <circle cx={x} cy={y} r={7} className="v-source" />}
              {p.role === 'mirror' && <line x1={x - 8} y1={y + 8} x2={x + 8} y2={y - 8} className="v-mirror" />}
              {p.role !== 'source' && p.role !== 'mirror' && <polygon points={`${x},${y - 10} ${x + 7},${y} ${x},${y + 10} ${x - 7},${y}`} className={revealed?.correct ? 'v-target good' : 'v-target'} />}
              <text x={x + 10} y={y - 8} className="v-point-label">{p.name}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// --- Carte à l'échelle (Atelier des Balances) ----------------------------------------------------

const MAP_CELL = 40
const MAP_MARGIN = 20

export function MapView({ item }: { item: Item }) {
  const spec = mapFrom(item.visual ?? {})
  const width = spec.cols * MAP_CELL + 2 * MAP_MARGIN
  const height = spec.rows * MAP_CELL + 2 * MAP_MARGIN + (spec.scale.text ? 46 : 0)
  const at = (p: readonly [number, number]) => mapPixel(p, MAP_CELL, MAP_MARGIN)
  const route = mapRoute(spec).map(at)
  const barY = spec.rows * MAP_CELL + 2 * MAP_MARGIN + 6
  const barW = spec.scale.cells * MAP_CELL
  const names = spec.points.map((p) => p.label).join(' et ')
  return (
    <figure className="visual map">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Carte quadrillée de ${spec.cols} carreaux sur ${spec.rows}, avec ${names}. ${spec.scale.text}`}>
        <rect x={MAP_MARGIN} y={MAP_MARGIN} width={spec.cols * MAP_CELL} height={spec.rows * MAP_CELL} className="v-map-bg" />
        {Array.from({ length: spec.cols + 1 }, (_, i) => (
          <line key={`c${i}`} x1={MAP_MARGIN + i * MAP_CELL} y1={MAP_MARGIN} x2={MAP_MARGIN + i * MAP_CELL} y2={MAP_MARGIN + spec.rows * MAP_CELL} className="v-grid-line" />
        ))}
        {Array.from({ length: spec.rows + 1 }, (_, i) => (
          <line key={`r${i}`} x1={MAP_MARGIN} y1={MAP_MARGIN + i * MAP_CELL} x2={MAP_MARGIN + spec.cols * MAP_CELL} y2={MAP_MARGIN + i * MAP_CELL} className="v-grid-line" />
        ))}
        {route.length >= 2 && <polyline points={route.map((p) => p.join(',')).join(' ')} className="v-map-route" />}
        {spec.points.map((p) => {
          const [x, y] = at(p.at)
          return (
            <g key={p.label}>
              <circle cx={x} cy={y} r={8} className="v-map-place" />
              <text x={x} y={y - 14} textAnchor="middle" className="v-point-label">{p.label}</text>
            </g>
          )
        })}
        {spec.scale.text && (
          <g>
            {barW > 0 && (
              <>
                <line x1={MAP_MARGIN} y1={barY + 8} x2={MAP_MARGIN + barW} y2={barY + 8} className="v-map-bar" />
                <line x1={MAP_MARGIN} y1={barY} x2={MAP_MARGIN} y2={barY + 16} className="v-map-bar" />
                <line x1={MAP_MARGIN + barW} y1={barY} x2={MAP_MARGIN + barW} y2={barY + 16} className="v-map-bar" />
              </>
            )}
            <text x={MAP_MARGIN + barW + (barW > 0 ? 12 : 0)} y={barY + 14} className="v-point-label">{spec.scale.text}</text>
          </g>
        )}
      </svg>
    </figure>
  )
}

// --- Robot sur une grille ------------------------------------------------------------------------

const ROBOT_CELL = 44

export function RobotView({ item, revealed }: { item: Item; revealed: Revealed | null }) {
  const spec = robotFrom(item.visual ?? {})
  const side = spec.size * ROBOT_CELL
  const start = cellCenter(spec.start, ROBOT_CELL)
  const where = (at: readonly [number, number]) => `colonne ${at[0] + 1}, ligne ${at[1] + 1}`
  const label = `Grille de ${spec.size} sur ${spec.size}. Le robot part de la case verte (${where(spec.start)}), tourné ${HEADING_NAMES[spec.facing]}. Cases proposées : ${spec.marks.map((m) => `${m.letter} (${where(m.at)})`).join(', ')}.`
  return (
    <figure className="visual robot">
      <svg viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label}>
        <rect width={side} height={side} className="v-grid-bg" />
        {Array.from({ length: spec.size + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * ROBOT_CELL} y1={0} x2={i * ROBOT_CELL} y2={side} className="v-grid-line" />
            <line x1={0} y1={i * ROBOT_CELL} x2={side} y2={i * ROBOT_CELL} className="v-grid-line" />
          </g>
        ))}
        <rect x={spec.start[0] * ROBOT_CELL + 3} y={spec.start[1] * ROBOT_CELL + 3} width={ROBOT_CELL - 6} height={ROBOT_CELL - 6} rx={6} className="v-robot-start" />
        <polygon points={arrowPoints(start, spec.facing, 14).map((p) => p.join(',')).join(' ')} className="v-robot-arrow" />
        {spec.marks.map((m) => {
          const [x, y] = cellCenter(m.at, ROBOT_CELL)
          const isAnswer = revealed !== null && revealed.answer === m.letter
          return (
            <g key={m.letter}>
              <circle cx={x} cy={y} r={15} className={isAnswer ? 'v-robot-mark good' : 'v-robot-mark'} />
              <text x={x} y={y + 6} textAnchor="middle" className="v-robot-letter">{m.letter}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// --- Courbe (lecture graphique) ------------------------------------------------------------------

const GRAPH_W = 440
const GRAPH_H = 360
const GRAPH_MARGIN = 32

export function GraphView({ item }: { item: Item }) {
  const spec = graphFrom(item.visual ?? {})
  const at = (p: readonly [number, number]) => graphPixel(spec, p, GRAPH_W, GRAPH_H, GRAPH_MARGIN)
  const [x0, y0] = at([0, 0])
  const [left, top] = at([spec.xmin, spec.ymax])
  const [right, bottom] = at([spec.xmax, spec.ymin])
  const curve = spec.points.map(at)
  const description = spec.points.map((p) => `(${signed(p[0])} ; ${signed(p[1])})`).join(', ')
  return (
    <figure className="visual graph">
      <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} role="img" aria-label={`Courbe de f, de x = ${signed(spec.xmin)} à x = ${signed(spec.xmax)}, qui relie les points ${description}.`}>
        <rect x={left} y={top} width={right - left} height={bottom - top} className="v-grid-bg" />
        {graphTicks(spec.xmin, spec.xmax).map((k) => {
          const [x] = at([k, 0])
          return <line key={`x${k}`} x1={x} y1={top} x2={x} y2={bottom} className={k === 0 ? 'v-grid-axis' : 'v-grid-line'} />
        })}
        {graphTicks(spec.ymin, spec.ymax).map((k) => {
          const [, y] = at([0, k])
          return <line key={`y${k}`} x1={left} y1={y} x2={right} y2={y} className={k === 0 ? 'v-grid-axis' : 'v-grid-line'} />
        })}
        {curve.length >= 2 && <polyline points={curve.map((p) => p.join(',')).join(' ')} className="v-graph-curve" />}
        {curve.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={4} className="v-graph-dot" />
        ))}
        {graphTicks(spec.xmin, spec.xmax).filter((k) => k !== 0).map((k) => (
          <text key={`tx${k}`} x={at([k, 0])[0]} y={Math.min(bottom + 20, y0 + 20)} textAnchor="middle" className="v-graph-tick">{signed(k)}</text>
        ))}
        {graphTicks(spec.ymin, spec.ymax).filter((k) => k !== 0).map((k) => (
          <text key={`ty${k}`} x={x0 - 8} y={at([0, k])[1] + 5} textAnchor="end" className="v-graph-tick">{signed(k)}</text>
        ))}
      </svg>
    </figure>
  )
}

/** Visuel d'une question, au-dessus de sa réponse ; null si le type n'en a pas ou s'il ne sait pas le dessiner. */
export function VisualFor({ item, revealed }: { item: Item; revealed: Revealed | null }) {
  const kind = item.visual?.kind
  if (item.type === 'number_line') {
    // Mode « place » : le widget de réponse est la droite elle-même ; après la réponse, on montre la bonne graduation.
    return revealed ? <NumberLine spec={numberLineFrom(item.visual ?? {})} correctText={revealed.answer} /> : null
  }
  switch (kind) {
    case 'balance':
      return <BalanceView item={item} revealed={revealed} />
    case 'grid':
      return <GridView item={item} revealed={revealed} />
    case 'map':
      return <MapView item={item} />
    case 'robot':
      return <RobotView item={item} revealed={revealed} />
    case 'graph':
      return <GraphView item={item} />
    case 'number_line': {
      const v = item.visual ?? {}
      return <NumberLine spec={numberLineFrom(v)} point={v.point !== undefined ? String(v.point) : undefined} label={v.label !== undefined ? String(v.label) : 'A'} correctText={revealed?.answer} />
    }
    default:
      return null
  }
}
