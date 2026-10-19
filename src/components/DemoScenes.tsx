/**
 * Cenários de fundo das mini animações (traços finos, sem cor própria, em 200×120):
 * cada ferramenta usa o cenário em que ela faz sentido, em vez de todas desenharem na mesma planta.
 */
import type { Scene } from '../toolInfo'

const wall = (d: string, w = 2) => <path d={d} strokeWidth={w} />

/** Planta baixa: 4 ambientes, portas, janelas e um banheiro. */
function Rooms() {
  return (
    <g fill="none" stroke="currentColor">
      {wall('M 12 10 H 188 V 110 H 12 Z', 2.4)}
      {wall('M 96 10 V 28 M 96 44 V 64 M 12 64 H 38 M 54 64 H 120 M 136 64 H 188 M 110 64 V 110')}
      {/* portas: folha + arco */}
      <path d="M 38 64 L 38 50 A 14 14 0 0 1 52 64" strokeWidth={1} opacity={0.7} />
      <path d="M 96 28 L 82 28 A 14 14 0 0 0 96 42" strokeWidth={1} opacity={0.7} />
      <path d="M 120 64 L 120 78 A 14 14 0 0 0 134 64" strokeWidth={1} opacity={0.7} />
      {/* janelas */}
      <path d="M 28 10 H 62 M 28 12.5 H 62 M 128 10 H 162 M 128 12.5 H 162 M 188 78 V 98 M 185.5 78 V 98" strokeWidth={1} opacity={0.8} />
      {/* banheiro e pia */}
      <ellipse cx={170} cy={96} rx={6} ry={4.5} strokeWidth={1} opacity={0.6} />
      <rect x={160} y={102} width={9} height={5} strokeWidth={1} opacity={0.6} />
      <rect x={16} y={14} width={10} height={6} strokeWidth={1} opacity={0.5} />
    </g>
  )
}

/** Fachada: edifício de 3 pavimentos, janelas, níveis e cota — mais larga que o quadro (para mover a vista). */
function Facade() {
  const cols = [48, 90, 132, 174, 216]
  const rows = [32, 58, 84]
  return (
    <g fill="none" stroke="currentColor">
      <path d="M 4 104 H 264" strokeWidth={1.8} />
      <path d="M 30 104 V 26 H 238 V 104 M 30 52 H 238 M 30 78 H 238" strokeWidth={1.6} />
      <path d="M 26 22 H 242" strokeWidth={1} opacity={0.6} />
      {rows.map((y) => cols.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width={20} height={14} strokeWidth={1.1} opacity={0.85} />))}
      {/* níveis (à direita, fora do quadro até mover a vista) */}
      {[104, 78, 52, 26].map((y) => (
        <g key={y} opacity={0.75}>
          <path d={`M 242 ${y} H 262`} strokeWidth={0.9} />
          <path d={`M 247 ${y} l 3 -5 l 3 5`} strokeWidth={0.9} />
          <rect x={246} y={y - 10} width={12} height={2.4} fill="currentColor" stroke="none" opacity={0.6} />
        </g>
      ))}
      <path d="M 20 26 V 104 M 17 26 H 23 M 17 52 H 23 M 17 78 H 23 M 17 104 H 23" strokeWidth={0.9} opacity={0.6} />
    </g>
  )
}

/** Estrutural: eixos A–D / 1–3, pilares, vigas e cota de 5,00 m. */
function Structure({ ghost }: { ghost?: boolean }) {
  const xs = [30, 80, 130, 180], ys = [30, 64, 98]
  return (
    <g fill="none" stroke="currentColor">
      {!ghost && (
        <g strokeDasharray="5 3" strokeWidth={0.7} opacity={0.5}>
          {xs.map((x) => <path key={x} d={`M ${x} 14 V 114`} />)}
          {ys.map((y) => <path key={y} d={`M 12 ${y} H 192`} />)}
        </g>
      )}
      {xs.map((x, i) => !ghost && (
        <g key={x} opacity={0.7}>
          <circle cx={x} cy={9} r={4.4} strokeWidth={0.9} />
          <rect x={x - 1.6} y={7.4} width={3.2} height={3.2} fill="currentColor" stroke="none" opacity={0.7 - i * 0.05} />
        </g>
      ))}
      {ys.map((y) => !ghost && <circle key={y} cx={8} cy={y} r={4.4} strokeWidth={0.9} opacity={0.7} />)}
      <g strokeWidth={1.8} opacity={ghost ? 1 : 0.5}>
        {ys.map((y) => <path key={y} d={`M ${xs[0]} ${y} H ${xs[3]}`} />)}
        {xs.map((x) => <path key={x} d={`M ${x} ${ys[0]} V ${ys[2]}`} />)}
      </g>
      {xs.map((x) => ys.map((y) => <rect key={`${x}${y}`} x={x - 3.5} y={y - 3.5} width={7} height={7} fill="currentColor" stroke="none" opacity={ghost ? 0.95 : 0.55} />))}
      {!ghost && (
        <g strokeWidth={0.9} opacity={0.7}>
          <path d="M 80 108 H 130 M 80 105 V 111 M 130 105 V 111" />
          <rect x={98} y={109.4} width={14} height={2.4} fill="currentColor" stroke="none" opacity={0.7} />
        </g>
      )}
    </g>
  )
}

/** Detalhe construtivo: bloco e laje hachurados, chamadas e escala. */
function Detail() {
  return (
    <g fill="none" stroke="currentColor">
      <defs>
        <pattern id="demo-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M 0 0 V 5" stroke="currentColor" strokeWidth={0.8} opacity={0.55} />
        </pattern>
      </defs>
      <rect x={26} y={26} width={84} height={76} strokeWidth={1.8} />
      <rect x={26} y={26} width={84} height={76} fill="url(#demo-hatch)" stroke="none" />
      <rect x={110} y={56} width={72} height={20} strokeWidth={1.6} />
      <rect x={110} y={56} width={72} height={20} fill="url(#demo-hatch)" stroke="none" />
      <path d="M 40 60 H 96 M 40 70 H 96" strokeWidth={1} strokeDasharray="4 2" opacity={0.7} />
      {[[150, 66, 176, 32], [60, 88, 130, 94]].map(([x1, y1, x2, y2], i) => (
        <g key={i} opacity={0.75}>
          <path d={`M ${x1} ${y1} L ${x2} ${y2} h 12`} strokeWidth={0.9} />
          <circle cx={x1} cy={y1} r={1.4} fill="currentColor" stroke="none" />
          <rect x={x2 + 1} y={y2 - 5} width={26} height={2.4} fill="currentColor" stroke="none" opacity={0.7} />
        </g>
      ))}
      <path d="M 186 56 V 76 M 183 56 H 189 M 183 76 H 189" strokeWidth={0.9} opacity={0.7} />
      <rect x={26} y={108} width={34} height={3} fill="currentColor" stroke="none" opacity={0.55} />
    </g>
  )
}

/** Carimbo da prancha: área de desenho em cima e quadro de legenda embaixo. */
function TitleBlock() {
  return (
    <g fill="none" stroke="currentColor">
      <rect x={8} y={8} width={184} height={104} strokeWidth={1.6} />
      <path d="M 8 76 H 192 M 60 76 V 112 M 112 76 V 112 M 152 76 V 112 M 112 94 H 192" strokeWidth={1} opacity={0.8} />
      <g fill="currentColor" stroke="none" opacity={0.5}>
        <rect x={66} y={81} width={38} height={3} /><rect x={66} y={88} width={26} height={3} />
        <rect x={118} y={81} width={26} height={3} /><rect x={118} y={86} width={20} height={2.4} />
        <rect x={158} y={81} width={26} height={3} /><rect x={118} y={99} width={30} height={3} /><rect x={158} y={99} width={26} height={3} />
        <rect x={66} y={99} width={34} height={3} /><rect x={66} y={105} width={22} height={2.4} />
      </g>
      <path d="M 24 60 H 70 M 24 52 H 96 M 24 44 H 54 M 40 24 V 60 M 120 60 H 168 M 120 52 H 150" strokeWidth={1} opacity={0.35} />
    </g>
  )
}

/** Forro: luminárias em malha (4×3) e duas tomadas de outro tipo. */
export const LUMINAIRES: [number, number][] = [34, 78, 122, 166].flatMap((x) => [34, 60, 86].map((y) => [x, y] as [number, number]))
function Lighting() {
  return (
    <g fill="none" stroke="currentColor">
      <rect x={12} y={12} width={176} height={96} strokeWidth={1.8} />
      {LUMINAIRES.map(([x, y]) => (
        <g key={`${x}${y}`} opacity={0.8}>
          <circle cx={x} cy={y} r={5} strokeWidth={1.1} />
          <path d={`M ${x - 3.4} ${y - 3.4} L ${x + 3.4} ${y + 3.4} M ${x + 3.4} ${y - 3.4} L ${x - 3.4} ${y + 3.4}`} strokeWidth={0.9} />
        </g>
      ))}
      {[[56, 48], [144, 74]].map(([x, y]) => <rect key={x} x={x - 3} y={y - 3} width={6} height={6} strokeWidth={1.1} opacity={0.7} />)}
    </g>
  )
}

/** Quadro quadriculado discreto (para o 3D). */
function Grid() {
  return (
    <g stroke="currentColor" strokeWidth={0.5} opacity={0.4}>
      {Array.from({ length: 9 }, (_, i) => <path key={`v${i}`} d={`M ${12 + i * 22} 10 V 112`} />)}
      {Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M 12 ${10 + i * 20.4} H 188`} />)}
    </g>
  )
}

export function SceneArt({ scene, ghost }: { scene: Scene; ghost?: boolean }) {
  switch (scene) {
    case 'rooms': return <Rooms />
    case 'facade': return <Facade />
    case 'structure': return <Structure ghost={ghost} />
    case 'detail': return <Detail />
    case 'titleblock': return <TitleBlock />
    case 'lighting': return <Lighting />
    case 'grid': return <Grid />
  }
}

