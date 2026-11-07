/**
 * Formule d'une question : rendue par KaTeX dans le navigateur (nette à toutes les tailles,
 * suit la taille du texte choisie). Si KaTeX ne sait pas la lire, on affiche le SVG que
 * l'API joint au paquet (ziamath, comme la v1). katex.render construit le DOM et pose les
 * styles par l'objet `style` : compatible avec la CSP `style-src 'self'`.
 */
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useRef, useState } from 'react'

export function Formula({ latex, svg }: { latex: string; svg?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    try {
      katex.render(latex, ref.current, { displayMode: true, throwOnError: true, strict: 'ignore' })
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [latex])
  if (failed && svg) {
    return <img className="formula-svg" alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} />
  }
  return <div ref={ref} className="formula" aria-hidden="true" />
}
