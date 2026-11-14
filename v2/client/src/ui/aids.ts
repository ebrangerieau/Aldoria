/** Les objets du sac proposés sous une question (plume, parchemin), rangés dans la partie à chaque usage. */
import { use } from '../core/inventory'
import type { SaveData } from '../core/save'
import type { QuestionAids } from './QuestionPanel'

export function makeAids(get: () => SaveData, persist: (next: SaveData) => void): QuestionAids {
  return {
    owned: () => get().items,
    use: (id) => {
      const save = get()
      const next = use(save.items, id)
      if (!next) return false
      persist({ ...save, items: next })
      return true
    },
  }
}
