import { useId } from 'react'

/** Logo do Traço (conceito "Cota": uma linha de cota com marcas nas pontas). A placa usa a cor de acento escolhida e o traço, a cor legível sobre ela. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="var(--accent)" />
      <rect width="64" height="64" rx="15" fill={`url(#${id}s)`} />
      <g fill="none" stroke="var(--on-accent)" strokeWidth="5" strokeLinecap="round">
        <path d="M18 46 L46 18" />
        <path d="M13.5 41.5 L22.5 50.5" />
        <path d="M41.5 13.5 L50.5 22.5" />
      </g>
    </svg>
  )
}
