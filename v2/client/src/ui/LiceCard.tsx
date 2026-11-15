/** La carte de dialogue des jeux de la Lice (pont des fractions, stand de tir) : le titre, quelques lignes, des boutons (le dernier a le focus). */
export function LiceCard({ title, lines, actions, testId }: {
  title: string
  lines: string[]
  testId: string
  actions: { label: string; primary?: boolean; run: () => void }[]
}) {
  const titleId = `${testId}-titre`
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid={testId}>
      <section className="panel dialog">
        <h2 id={titleId}>{title}</h2>
        {lines.flatMap((line) => line.split('\n')).map((line, i) => <p key={i}>{line}</p>)}
        <div className="actions">
          {actions.map((a, i) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : 'secondary'} autoFocus={i === actions.length - 1} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
