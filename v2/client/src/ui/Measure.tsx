/**
 * Banc de mesure (`?mesure`, pour l'adulte qui mesure, docs/perf-log.md) : avancement pendant le
 * tour de l'île, puis le résultat et la ligne à recopier dans le journal des performances.
 */
import { useState } from 'react'
import { isReliable, MIN_FRAMES, type PerfReport, perfLogRow } from '../core/perf'

const ms = (v: number) => `${v.toFixed(1).replace('.', ',')} ms`

export function MeasureProgress({ ratio }: { ratio: number }) {
  return (
    <div className="measure-progress" role="status">
      Mesure en cours : {Math.round(ratio * 100)} %. Ne touche ni la souris ni le clavier.
    </div>
  )
}

export function MeasurePanel({ report, onAgain, onClose }: { report: PerfReport; onAgain: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const s = report.summary
  const row = perfLogRow(report)
  const other = report.engine === 'WebGPU' ? 'webgl2' : 'webgpu'
  const switchEngine = () => {
    const params = new URLSearchParams(location.search)
    params.set('moteur', other)
    location.search = params.toString()
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="mesure-titre">
      <section className="panel dialog measure" data-testid="mesure">
        <h2 id="mesure-titre">Mesure terminée</h2>
        <p>{report.engine} · profil {report.quality} · {report.width} × {report.height} · {report.browser}</p>
        <p>Carte graphique : {report.gpu || 'inconnue (masquée par le navigateur)'}</p>
        <ul>
          <li>Images par seconde : <strong>{Math.round(s.fps)}</strong> (durée médiane d'une image : {ms(s.frameP50)})</li>
          <li>Images les plus lentes (95e centile) : {ms(s.frameP95)} ; saccades (sous 30 images par seconde) : {Math.round(s.slowShare * 100)} %</li>
          <li>Processeur par image : {ms(s.cpuP50)} ; carte graphique par image : {s.gpuP50 === null ? 'non mesurée par ce navigateur' : ms(s.gpuP50)}</li>
          <li>Au plus : {report.drawCalls} appels de dessin, {(report.triangles / 1e6).toFixed(2).replace('.', ',')} million de triangles</li>
          <li>Île prête en {(report.loadMs / 1000).toFixed(1).replace('.', ',')} s{report.heapMb !== null && ` ; mémoire JavaScript : ${Math.round(report.heapMb)} Mo`}</li>
        </ul>
        {!isReliable(s) && (
          <p className="hint" role="alert" data-testid="mesure-peu-fiable">
            Seulement {s.frames} images relevées (moins de {MIN_FRAMES}) : le rendu est trop lent ou le tour trop court. Ces chiffres ne
            disent rien de ce PC : ne pas les recopier dans le journal.
          </p>
        )}
        <p>Ligne pour docs/perf-log.md ({s.frames} images sur {report.seconds} s) :</p>
        <pre className="measure-row">{row}</pre>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(row).then(() => setCopied(true))}>
            {copied ? 'Ligne copiée' : 'Copier la ligne'}
          </button>
          <button type="button" className="secondary" onClick={switchEngine}>Mesurer en {other === 'webgpu' ? 'WebGPU' : 'WebGL 2'}</button>
          <button type="button" className="secondary" onClick={onAgain}>Mesurer encore</button>
          <button type="button" className="primary" autoFocus onClick={onClose}>Fermer</button>
        </div>
      </section>
    </div>
  )
}
