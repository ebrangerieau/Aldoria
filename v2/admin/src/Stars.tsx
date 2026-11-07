export function Stars({ count }: { count: number }) {
  return (
    <span className="stars" aria-label={`${count} étoile${count > 1 ? 's' : ''} sur 3`}>
      {'★'.repeat(count)}
      <span className="dim">{'☆'.repeat(3 - count)}</span>
    </span>
  )
}
