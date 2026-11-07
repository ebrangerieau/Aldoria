/**
 * Parcours de l'enfant : écran titre → (appareil relié ?) → choix du profil → code secret →
 * l'île. Le mode « découverte » ouvre l'île sans compte, avec un paquet de questions de test,
 * sans rien enregistrer (démonstration, tests dans le navigateur).
 */
import { useEffect, useRef, useState } from 'react'
import type { Services } from '../app/services'
import { applyToDocument, fromServer } from '../core/accessibility'
import type { Pack } from '../core/items'
import type { Profile } from '../core/session'
import { GameScreen } from './GameScreen'
import { PairScreen, PinScreen, ProfilesScreen } from './Login'
import { Title } from './Title'

type Screen =
  | { name: 'title' }
  | { name: 'pair' }
  | { name: 'profiles' }
  | { name: 'pin'; profile: Profile }
  | { name: 'game'; demo: boolean }

export function App({ services }: { services: Services }) {
  const [screen, setScreen] = useState<Screen>({ name: 'title' })
  const params = new URLSearchParams(location.search)

  useEffect(() => {
    applyToDocument(fromServer(services.session.profile?.accommodations))
  }, [screen, services.session.profile])
  // Écran en cours, joint aux erreurs remontées (jamais le prénom ni le profil).
  useEffect(() => {
    const names = { title: 'titre', pair: 'liaison', profiles: 'profils', pin: 'code', game: 'ile' } as const
    services.errors.scene = screen.name === 'game' && screen.demo ? 'ile (decouverte)' : names[screen.name]
  }, [screen, services])
  useEffect(() => {
    if (params.get('interface') === '0') document.documentElement.classList.add('sans-interface')
  }, [])

  // Lancement direct (tests, captures) : ?decouverte ouvre l'île sans passer par l'écran titre.
  const launched = useRef(false)
  useEffect(() => {
    if (launched.current || !params.has('decouverte')) return
    launched.current = true
    void startDemo(params.get('classe') === '2nde' ? '2nde' : '6e')
  }, [])

  async function startDemo(level: '6e' | '2nde') {
    const pack = (level === '6e'
      ? await import('../../tests/fixtures/pack_6e.json')
      : await import('../../tests/fixtures/pack_2nde.json')).default as unknown as Pack
    const world = params.get('monde') === 'brouillard' ? 'brouillard' : 'lumineux'
    services.session.startDemo(pack, { id: 0, name: 'Archiviste', level, world })
    services.questions.reset()
    setScreen({ name: 'game', demo: true })
  }

  async function startPlaying() {
    const started = await services.session.start('monde')
    services.questions.reset(fromServer(services.session.profile?.accommodations).easy_start)
    if (!started.ok) return
    setScreen({ name: 'game', demo: false })
  }

  switch (screen.name) {
    case 'title':
      return (
        <Title
          onPlay={() => {
            if (services.session.loggedIn) void startPlaying()
            else setScreen(services.api.paired ? { name: 'profiles' } : { name: 'pair' })
          }}
          onDiscover={() => void startDemo('6e')}
          playerName={services.session.loggedIn ? services.session.profile?.name : undefined}
        />
      )
    case 'pair':
      return <PairScreen services={services} onPaired={() => setScreen({ name: 'profiles' })} onBack={() => setScreen({ name: 'title' })} />
    case 'profiles':
      return (
        <ProfilesScreen
          services={services}
          onChoose={(profile) => setScreen({ name: 'pin', profile })}
          onUnpaired={() => setScreen({ name: 'pair' })}
          onBack={() => setScreen({ name: 'title' })}
        />
      )
    case 'pin':
      return (
        <PinScreen
          services={services}
          profile={screen.profile}
          onLoggedIn={() => void startPlaying()}
          onBack={() => setScreen({ name: 'profiles' })}
        />
      )
    case 'game':
      return (
        <GameScreen
          services={services}
          demo={screen.demo}
          onQuit={async () => {
            await services.session.end()
            if (!screen.demo) await services.session.logout()
            setScreen({ name: 'title' })
          }}
        />
      )
  }
}
