/**
 * Analyseur d'expressions saisies par les élèves. Même grammaire que
 * api/app/engine/mathexpr.py (et que game/core/math/math_expr.gd de la v1) : toute
 * modification se fait des deux côtés et se couvre dans content/test-vectors/answers.json.
 *
 *   expr  := term (('+' | '-') term)*
 *   term  := unary (('*' | '/') unary | <implicite> unary)*
 *   unary := ('+' | '-') unary | power
 *   power := atom ('^' unary)?
 *   atom  := nombre | variable | fonction '(' expr ')' | '(' expr ')'
 */

export type Node =
  | { op: 'num'; value: number }
  | { op: 'var'; name: string }
  | { op: 'neg'; arg: Node }
  | { op: 'sqrt'; arg: Node }
  | { op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }

type Token = { kind: 'num' | 'var' | 'func' | 'op' | 'lpar' | 'rpar' | 'end'; text: string }

/** Points d'évaluation fixes, identiques côté serveur. */
export const EVAL_POINTS = [-2.7, -1.3, -0.4, 0.6, 1.1, 1.9, 2.3, 3.1]
export const REL_TOLERANCE = 1e-6
const FUNCTIONS = ['sqrt']
// Ordre de remplacement identique à la v1 (dictionnaire GDScript, ordre d'insertion).
const SYMBOLS: [string, string][] = [
  ['×', '*'], ['·', '*'], ['÷', '/'], ['−', '-'], ['–', '-'], ['²', '^2'], ['³', '^3'], ['√', 'sqrt'],
]

export function normalize(text: string): string {
  let out = text.trim().toLowerCase()
  for (const [src, dst] of SYMBOLS) out = out.split(src).join(dst)
  return out.split(' ').join('')
}

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9'
const isLetter = (c: string | undefined): boolean => c !== undefined && c >= 'a' && c <= 'z'

class Parser {
  error = ''
  private tokens: Token[] = []
  private pos = 0

  parse(text: string): Node | null {
    this.error = ''
    this.tokens = this.tokenize(normalize(text))
    this.pos = 0
    if (this.error) return null
    if (this.tokens.length === 0) {
      this.error = 'expression vide'
      return null
    }
    const node = this.expr()
    if (!this.error && this.pos < this.tokens.length) {
      this.error = `symbole en trop : ${this.tokens[this.pos]?.text}`
    }
    return this.error ? null : node
  }

  private tokenize(s: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < s.length) {
      const c = s[i]!
      if (isDigit(c) || ((c === '.' || c === ',') && isDigit(s[i + 1]))) {
        let j = i
        let seenSep = false
        while (j < s.length && (isDigit(s[j]) || ((s[j] === '.' || s[j] === ',') && !seenSep))) {
          if (s[j] === '.' || s[j] === ',') seenSep = true
          j += 1
        }
        tokens.push({ kind: 'num', text: s.slice(i, j).replace(',', '.') })
        i = j
      } else if (isLetter(c)) {
        let j = i
        while (j < s.length && isLetter(s[j])) j += 1
        let word = s.slice(i, j)
        for (const f of FUNCTIONS) {
          if (word.startsWith(f)) {
            tokens.push({ kind: 'func', text: f })
            word = word.slice(f.length) // « sqrtx » (issu de « √x ») : sqrt puis x
            break
          }
        }
        for (const ch of word) tokens.push({ kind: 'var', text: ch })
        i = j
      } else if ('+-*/^'.includes(c)) {
        tokens.push({ kind: 'op', text: c })
        i += 1
      } else if (c === '(') {
        tokens.push({ kind: 'lpar', text: c })
        i += 1
      } else if (c === ')') {
        tokens.push({ kind: 'rpar', text: c })
        i += 1
      } else {
        this.error = `caractère inattendu : ${c}`
        return []
      }
    }
    return tokens
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private take(): Token {
    const tok = this.tokens[this.pos]
    if (tok === undefined) {
      this.error = 'expression incomplète'
      return { kind: 'end', text: '' }
    }
    this.pos += 1
    return tok
  }

  private isOp(tok: Token | undefined, ops: string): boolean {
    return tok !== undefined && tok.kind === 'op' && ops.includes(tok.text)
  }

  private expr(): Node {
    let node = this.term()
    while (!this.error && this.isOp(this.peek(), '+-')) {
      const op = this.take().text as '+' | '-'
      node = { op, a: node, b: this.term() }
    }
    return node
  }

  private term(): Node {
    let node = this.unary()
    while (!this.error) {
      const tok = this.peek()
      if (this.isOp(tok, '*/')) {
        this.take()
        node = { op: tok!.text as '*' | '/', a: node, b: this.unary() }
      } else if (tok !== undefined && ['num', 'var', 'func', 'lpar'].includes(tok.kind)) {
        node = { op: '*', a: node, b: this.unary() } // multiplication implicite
      } else {
        break
      }
    }
    return node
  }

  private unary(): Node {
    if (this.isOp(this.peek(), '+-')) {
      const op = this.take().text
      const operand = this.unary()
      return op === '-' ? { op: 'neg', arg: operand } : operand
    }
    return this.power()
  }

  private power(): Node {
    const base = this.atom()
    if (!this.error && this.isOp(this.peek(), '^')) {
      this.take()
      return { op: '^', a: base, b: this.unary() }
    }
    return base
  }

  private atom(): Node {
    const tok = this.take()
    const invalid: Node = { op: 'num', value: Number.NaN }
    if (this.error) return invalid
    switch (tok.kind) {
      case 'num':
        return { op: 'num', value: Number.parseFloat(tok.text) }
      case 'var':
        return { op: 'var', name: tok.text }
      case 'func': {
        const next = this.peek()
        if (next !== undefined && next.kind === 'lpar') {
          this.take()
          const inner = this.expr()
          this.expectRpar()
          return { op: 'sqrt', arg: inner }
        }
        return { op: 'sqrt', arg: this.power() } // √2, √x
      }
      case 'lpar': {
        const inner = this.expr()
        this.expectRpar()
        return inner
      }
      default:
        this.error = `symbole inattendu : ${tok.text}`
        return invalid
    }
  }

  private expectRpar(): void {
    if (this.error) return
    const tok = this.take()
    if (!this.error && tok.kind !== 'rpar') this.error = 'parenthèse fermante manquante'
  }
}

/** Arbre de l'expression, ou `{ error }` si elle est illisible. */
export function parse(text: string): Node | { error: string } {
  const parser = new Parser()
  const node = parser.parse(text)
  return node ?? { error: parser.error }
}

const isNode = (value: Node | { error: string }): value is Node => 'op' in value

/** Valeur en x (comme la v1 : toute autre lettre vaut NaN). */
export function evaluate(node: Node, x: number): number {
  switch (node.op) {
    case 'num':
      return node.value
    case 'var':
      return node.name === 'x' ? x : Number.NaN
    case 'neg':
      return -evaluate(node.arg, x)
    case 'sqrt': {
      const v = evaluate(node.arg, x)
      return v >= 0 ? Math.sqrt(v) : Number.NaN
    }
  }
  const a = evaluate(node.a, x)
  const b = evaluate(node.b, x)
  switch (node.op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return b !== 0 ? a / b : Number.NaN
    case '^':
      return a ** b
  }
}

export function variables(node: Node): string[] {
  const out: string[] = []
  const visit = (n: Node): void => {
    if (n.op === 'var') {
      if (!out.includes(n.name)) out.push(n.name)
    } else if (n.op === 'neg' || n.op === 'sqrt') {
      visit(n.arg)
    } else if (n.op !== 'num') {
      visit(n.a)
      visit(n.b)
    }
  }
  visit(node)
  return out
}

/** Vrai si l'expression est, au premier niveau, un produit ou une puissance (au signe près). */
export function isProduct(text: string): boolean {
  const parsed = parse(text)
  if (!isNode(parsed)) return false
  let node: Node = parsed
  while (node.op === 'neg') node = node.arg
  return node.op === '*' || node.op === '^'
}

/** Vrai si les deux expressions coïncident sur tous les points d'évaluation. */
export function equivalent(a: string, b: string, variable = 'x'): boolean {
  const na = parse(a)
  const nb = parse(b)
  if (!isNode(na) || !isNode(nb)) return false
  for (const v of [...variables(na), ...variables(nb)]) {
    if (v !== variable) return false
  }
  let compared = 0
  for (const x of EVAL_POINTS) {
    const va = evaluate(na, x)
    const vb = evaluate(nb, x)
    if (Number.isNaN(va) && Number.isNaN(vb)) continue
    if (Number.isNaN(va) || Number.isNaN(vb)) return false
    if (Math.abs(va - vb) > REL_TOLERANCE * Math.max(1, Math.abs(va), Math.abs(vb))) return false
    compared += 1
  }
  return compared > 0
}
