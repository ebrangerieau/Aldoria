/**
 * Petit émetteur d'événements typé : seul lien entre le monde 3D (game/) et l'interface
 * React (ui/). Le monde ne connaît pas React, l'interface ne touche pas à Babylon.js.
 */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<(payload: Events[K]) => void> } = {}

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    const set = (this.handlers[event] ??= new Set())
    set.add(handler)
    return () => set.delete(handler)
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const handler of this.handlers[event] ?? []) handler(payload)
  }
}
