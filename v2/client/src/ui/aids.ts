/** Les objets du sac proposés sous une question (plume, parchemin), rangés dans la partie à chaque usage. */
import { use as removeOne } from '../core/inventory'
import type { SaveData } from '../core/save'
import type { QuestionAids } from './QuestionPanel'

export function makeAids(get: () => SaveData, persist: (next: SaveData) => void): QuestionAids {
  return {
    owned: () => get().items,
    spend: (id) => {
      const save = get()
      const next = removeOne(save.items, id)
      if (!next) return false
      persist({ ...save, items: next })
      return true
    },
  }
}
