import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import lieux from '@content/monde/lieux.json'
import lignes from '@content/voix/lignes.json'
import { digest, RecordedVoices, RETRY_AFTER_MS } from '../src/core/recordedVoices'

const FILE = 'seuil-abc12345.mp3'
const LINE = { id: 'seuil-x', voix: 'ysaline', fichier: FILE }

describe('digest', () => {
  it('est le SHA-256 du texte en UTF-8, comme Godot et hashlib (accents compris)', async () => {
    expect(await digest('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    // Calculé avec hashlib : sha256("Bonjour, Archiviste ! L'île t'attend à la Citadelle.".encode())
    expect(await digest("Bonjour, Archiviste ! L'île t'attend à la Citadelle.")).toBe(
      '051b2a45530629e92763ad82b43d6c907e7beae4247025877bba8e7991e8906e',
    )
  })
})

describe('RecordedVoices', () => {
  const withManifest = async (text: string) => ({ [await digest(text)]: LINE })

  it('donne l’adresse du son d’un texte enregistré, rien pour un autre texte', async () => {
    const voices = new RecordedVoices(async () => withManifest('Bienvenue.'))
    expect(await voices.urlFor('Bienvenue.')).toBe(`/voix/${FILE}`)
    expect(await voices.urlFor('Bienvenue. ')).toBeNull() // un seul octet de différence : Piper
    expect(await voices.urlFor('Autre texte.')).toBeNull()
  })

  it('ne lit le manifeste qu’une fois, même demandé en parallèle', async () => {
    const load = vi.fn(async () => withManifest('Bienvenue.'))
    const voices = new RecordedVoices(load)
    await Promise.all([voices.urlFor('Bienvenue.'), voices.urlFor('Bienvenue.'), voices.warm()])
    await voices.urlFor('Bienvenue.')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('retombe sur Piper (null) quand le manifeste manque, est vide ou illisible, puis réessaie plus tard', async () => {
    let now = 1_000
    const load = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce({}).mockImplementation(async () => withManifest('Bienvenue.'))
    const voices = new RecordedVoices(load, '/voix/', digest, () => now)
    expect(await voices.urlFor('Bienvenue.')).toBeNull() // échec réseau
    expect(await voices.urlFor('Bienvenue.')).toBeNull() // pas de nouvel essai tout de suite
    expect(load).toHaveBeenCalledTimes(1)
    now += RETRY_AFTER_MS
    expect(await voices.urlFor('Bienvenue.')).toBeNull() // manifeste vide : « pas de voix générées »
    expect(load).toHaveBeenCalledTimes(2)
    now += RETRY_AFTER_MS
    expect(await voices.urlFor('Bienvenue.')).toBe(`/voix/${FILE}`)
  })

  it('ignore les entrées invalides du manifeste (nom de fichier hors dossier, empreinte mal formée)', async () => {
    const good = await digest('Bon.')
    const raw = {
      [await digest('Mauvais.')]: { id: 'x', voix: 'ysaline', fichier: '../secret.mp3' },
      'pas-une-empreinte': LINE,
      [good]: LINE,
    }
    const voices = new RecordedVoices(async () => raw)
    expect(await voices.urlFor('Mauvais.')).toBeNull()
    expect(await voices.urlFor('Bon.')).toBe(`/voix/${FILE}`)
  })

  it('rend null si l’empreinte est impossible (page hors contexte sûr, sans crypto.subtle)', async () => {
    const voices = new RecordedVoices(async () => withManifest('Bienvenue.'), '/voix/', async () => {
      throw new Error('crypto.subtle indisponible')
    })
    expect(await voices.urlFor('Bienvenue.')).toBeNull()
  })
})

describe('voix enregistrées livrées avec le jeu (deploy/voix)', () => {
  const sounds = fileURLToPath(new URL('../../deploy/voix/', import.meta.url))
  // Lu à l'exécution, pas importé : l'image web2 construit le jeu avec client/ et content/ seulement (deploy/ n'y est pas),
  // et `tsc` vérifie aussi les tests (npm run build) : un import statique de deploy/ ferait échouer cette construction.
  const manifest = JSON.parse(readFileSync(sounds + 'manifest.json', 'utf-8')) as Record<string, { id: string; voix: string; fichier: string }>

  it('chaque réplique de content/voix/lignes.json a son son, et le fichier existe', async () => {
    const missing: string[] = []
    for (const line of lignes) {
      const entry = manifest[await digest(line.texte)]
      if (!entry || !existsSync(sounds + entry.fichier)) missing.push(line.id)
    }
    // Texte modifié sans nouvelle voix : relancer tools/voix_elevenlabs.py (clé ElevenLabs dans l'environnement).
    expect(missing).toEqual([])
  })

  it('l’accueil de Maître Ysaline dans l’île est enregistré de sa voix, et les pages rapportées parlent de l’île (plus d’une carte du royaume)', async () => {
    const accueil = lignes.find((l) => l.id === 'ile-accueil')
    expect(accueil?.voix).toBe('ysaline')
    expect(manifest[await digest(accueil!.texte)]?.id).toBe('ile-accueil')
    const pages = lignes.filter((l) => l.id.startsWith('page-'))
    expect(pages).toHaveLength(30)
    // Le chemin suivant « s'éclaire » sur l'île (la v2 n'a pas d'écran de carte du royaume) ; les « seuil-* » parlent, eux, de vraies cartes.
    expect(pages.filter((l) => /sur la carte/.test(l.texte)).map((l) => l.id)).toEqual([])
    expect(lignes.filter((l) => l.id.startsWith('prologue-quete-') && /la carte/.test(l.texte)).map((l) => l.id)).toEqual([])
  })

  it('le texte de seuil de chacun des 30 lieux est enregistré (Maître Ysaline le dit de sa vraie voix)', async () => {
    const lost: string[] = []
    for (const d of lieux.dungeons) {
      const entry = manifest[await digest(d.threshold)]
      if (entry?.id !== `seuil-${d.code}` || entry.voix !== 'ysaline') lost.push(d.code)
    }
    expect(lieux.dungeons).toHaveLength(30)
    expect(lost).toEqual([])
  })
})
