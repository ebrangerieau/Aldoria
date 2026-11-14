/**
 * Mini-carte de l'île, en haut à droite : le relief vu d'en haut (nord en haut), la Citadelle,
 * le village, l'île du Sphinx, les lieux de quête et les pierres de savoir tels que le monde les
 * a posés, et le héros (flèche) avec la direction du regard. Rien n'y clignote (mode calme).
 * Le relief est peint une fois par monde dans un <canvas> ; les repères sont en SVG ; le seul
 * texte, le lieu où l'on est, est du HTML.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { landBounds, type MapFrame, type MapMarker, mapFrame, paintRelief, toMap } from '../core/world/minimap'
import type { GameWorld, HeroPose } from '../game/GameWorld'

/** Largeur de la carte en unités du dessin (pixels CSS au réglage normal). */
const MAP_WIDTH = 240
/** Pixels du relief par unité : net sur les écrans à haute densité. */
const DENSITY = 2

interface Relief {
  frame: MapFrame
  fine: MapFrame
  pixels: Uint8ClampedArray<ArrayBuffer>
}

// Le relief ne change pas pendant la partie : peint une fois par monde, gardé quand on cache la carte.
const reliefs = new WeakMap<GameWorld, Relief>()

function reliefOf(world: GameWorld): Relief {
  const cached = reliefs.get(world)
  if (cached) return cached
  const info = world.mapInfo()
  const bounds = landBounds(info.heightAt, info.extent)
  const frame = mapFrame(bounds, MAP_WIDTH)
  const fine = mapFrame(bounds, MAP_WIDTH * DENSITY)
  const relief = { frame, fine, pixels: paintRelief(fine, info.heightAt, info.palette) }
  reliefs.set(world, relief)
  return relief
}

const STATE_TEXT: Record<MapMarker['state'], string> = {
  repere: '',
  ouvert: 'ouvert',
  ferme: 'encore fermé',
  termine: 'terminé',
  endormie: 'endormie',
  eveillee: 'éveillée',
  a_faire: 'à relever',
  faite: 'relevé aujourd’hui',
}

export function Minimap({ world, place }: { world: GameWorld; place: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const relief = useMemo(() => reliefOf(world), [world])
  const [markers, setMarkers] = useState<MapMarker[]>(() => world.mapInfo().markers)
  const [pose, setPose] = useState<HeroPose>(() => world.heroPose())

  useEffect(() => {
    const offs = [world.events.on('hero', setPose), world.events.on('markers', setMarkers)]
    setMarkers(world.mapInfo().markers)
    return () => {
      for (const off of offs) off()
    }
  }, [world])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(relief.pixels, relief.fine.width, relief.fine.height), 0, 0)
  }, [relief])

  const { frame } = relief
  const hero = toMap(frame, pose.x, pose.z)
  const where = place || "L'île d'Aldoria"

  return (
    <div className="minimap" data-testid="carte" role="img" aria-label={`Carte de l'île. Tu es ici : ${where}.`}>
      <div className="minimap-map">
        <canvas ref={canvasRef} className="minimap-relief" width={relief.fine.width} height={relief.fine.height} />
        <svg className="minimap-marks" viewBox={`0 0 ${frame.width} ${frame.height}`} aria-hidden="true" focusable="false">
          {/* Le regard sous les repères (ils restent lisibles), le héros par-dessus tout. */}
          <path className="mark-view" d={VIEW_CONE} transform={`translate(${hero.u.toFixed(1)} ${hero.v.toFixed(1)}) rotate(${pose.view.toFixed(0)})`} />
          {markers.map((m) => {
            const { u, v } = toMap(frame, m.x, m.z)
            return (
              <g key={m.id} transform={`translate(${u.toFixed(1)} ${v.toFixed(1)})`} className={`mark mark-${m.kind} mark-${m.state}`} data-id={m.id}>
                <title>{STATE_TEXT[m.state] ? `${m.label} (${STATE_TEXT[m.state]})` : m.label}</title>
                <MarkerShape marker={m} />
              </g>
            )
          })}
          <g
            transform={`translate(${hero.u.toFixed(1)} ${hero.v.toFixed(1)})`}
            data-testid="carte-heros"
            data-u={hero.u.toFixed(1)}
            data-v={hero.v.toFixed(1)}
          >
            <path className="mark-hero" d={HERO_PIN} transform={`rotate(${pose.heading.toFixed(0)})`} />
          </g>
        </svg>
      </div>
      <div className="minimap-caption">{where}</div>
    </div>
  )
}

/** Héros : un rond et sa pointe vers l'avant (vers le haut avant rotation), lisible même tout petit. */
const HERO_PIN = 'M0 -9.5 L3.9 -2.4 A4.6 4.6 0 1 1 -3.9 -2.4 Z'

/** Cône du regard : 70°, vers le haut avant rotation. */
const VIEW_CONE = (() => {
  const r = 26
  const a = (35 * Math.PI) / 180
  const x = (r * Math.sin(a)).toFixed(1)
  const y = (-r * Math.cos(a)).toFixed(1)
  return `M0 0 L-${x} ${y} A${r} ${r} 0 0 1 ${x} ${y} Z`
})()

function MarkerShape({ marker }: { marker: MapMarker }) {
  switch (marker.kind) {
    case 'citadelle':
      return <path d="M-6 6 V-3 H-4 V-6 H-1.5 V-3 H1.5 V-6 H4 V-3 H6 V6 Z" />
    case 'village':
      return <path d="M-5 5 V-1 L0 -5.5 L5 -1 V5 Z" />
    case 'sphinx':
      return <path d="M-6.5 4.5 L0 -6 L6.5 4.5 Z" />
    case 'lieu':
      return (
        <>
          <path d="M0 -5.5 L4.5 0 L0 5.5 L-4.5 0 Z" />
          {marker.state === 'termine' && <path className="mark-check" d="M-2.2 0 L-0.6 1.8 L2.4 -1.8" />}
        </>
      )
    case 'pierre':
      return <circle r={marker.state === 'eveillee' ? 3.6 : 3.2} />
    case 'jour':
      return <path d="M0 -6 L1.7 -1.9 L6 -1.7 L2.6 1 L3.7 5.2 L0 2.8 L-3.7 5.2 L-2.6 1 L-6 -1.7 L-1.7 -1.9 Z" />
  }
}
