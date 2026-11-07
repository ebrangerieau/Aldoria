/** Bonne réponse d'une question, écrite pour l'enfant (panneau d'explication). */
import type { Item } from './items'

const decimal = (value: string): string => value.replace('.', ',')

export function answerText(item: Item): string {
  const a = item.answer
  const choices = item.choices ?? []
  switch (a.kind) {
    case 'choice':
      return choices[a.index] ?? ''
    case 'number':
    case 'fraction':
      return decimal(a.value)
    case 'expression':
      return a.value.replaceAll('*', '×')
    case 'text':
      return a.value[0] ?? ''
    case 'order':
      return a.value.map((i) => choices[i] ?? '').join(' → ')
    case 'true_false':
      return `${a.value ? 'Vrai' : 'Faux'} : ${choices[a.reason] ?? ''}`
    case 'vector':
      return `(${a.value.map(decimal).join(' ; ')})`
    case 'signs':
      return a.value.join(' ')
  }
}
