import { useEffect } from 'react'
import type { Item } from '../core/items'

/** Tests dans le navigateur (?e2e) : la question affichée, pour y répondre juste. */
export function E2eQuestion({ item }: { item: Item }) {
  useEffect(() => {
    const handle = (window as unknown as { __aldoria?: Record<string, unknown> }).__aldoria
    if (handle) handle.question = item
  }, [item])
  return null
}
