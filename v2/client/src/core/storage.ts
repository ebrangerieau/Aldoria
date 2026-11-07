/**
 * Stockage local (navigateur) : jeton de l'appareil, connexion, paquets hors connexion, file
 * des réponses, sauvegarde. Le serveur reste la source de vérité ; ce stockage permet de
 * continuer à jouer pendant une coupure. Clés préfixées « aldoria2. » pour ne jamais se
 * mélanger à un autre site du même domaine.
 */
export interface Store {
  get<T>(key: string, fallback: T): T
  set(key: string, value: unknown): void
  remove(key: string): void
  keys(): string[]
}

const PREFIX = 'aldoria2.'

export class BrowserStore implements Store {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  }

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      // Stockage plein ou refusé (navigation privée) : le jeu continue, le serveur fait foi.
    }
  }

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key)
  }

  keys(): string[] {
    const out: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) out.push(key.slice(PREFIX.length))
    }
    return out
  }
}

/** Stockage en mémoire : tests, et repli si localStorage est indisponible. */
export class MemoryStore implements Store {
  private data = new Map<string, string>()

  get<T>(key: string, fallback: T): T {
    const raw = this.data.get(key)
    return raw === undefined ? fallback : (JSON.parse(raw) as T)
  }

  set(key: string, value: unknown): void {
    this.data.set(key, JSON.stringify(value))
  }

  remove(key: string): void {
    this.data.delete(key)
  }

  keys(): string[] {
    return [...this.data.keys()]
  }
}

export function defaultStore(): Store {
  try {
    localStorage.setItem(PREFIX + 'test', '1')
    localStorage.removeItem(PREFIX + 'test')
    return new BrowserStore()
  } catch {
    return new MemoryStore()
  }
}
