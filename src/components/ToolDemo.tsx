/**
 * Mini animação (SVG/SMIL, 4 s em laço) que mostra como a ferramenta funciona. Sem imagens nem vídeos:
 * tudo vem de toolInfo.ts. Se existir src/assets/tools/<id>.mp4 (ou .webm), o vídeo substitui a animação.
 */
import { cloudPath } from '../geometry'
import { DEMO_H, DEMO_W } from '../toolInfo'
import { DRAW_FROM, DRAW_TO, DUR, HOLD, cursorTimes, toolVideo } from '../demoTiming'
import type { DemoShape, DemoSpec, Pt2 } from '../toolInfo'

const f = (n: number) => +n.toFixed(3)
const times = (...n: number[]) => n.map(f).join(';')

const pathD = (pts: Pt2[], closed?: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ') + (closed ? ' Z' : '')
const ellipseD = (c: Pt2, rx: number, ry: number) => `M ${c[0] - rx} ${c[1]} A ${rx} ${ry} 0 1 0 ${c[0] + rx} ${c[1]} A ${rx} ${ry} 0 1 0 ${c[0] - rx} ${c[1]}`

/** Traço que se desenha (stroke-dashoffset 1 → 0) entre `from` e `to`. */
function Stroke({ d, color, w = 1.8, from = DRAW_FROM, to = DRAW_TO, still }: { d: string; color: string; w?: number; from?: number; to?: number; still?: boolean }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={still ? 0 : 1}>
      {!still && <animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes={times(0, from, to, 1)} dur={`${DUR}s`} repeatCount="indefinite" />}
    </path>
  )
}

/** Aparece (opacidade 0 → v) a partir do instante `at`. */
function Appear({ at, v = 1, children }: { at: number; v?: number; children: React.ReactNode }) {
  return (
    <g opacity={0}>
      <animate attributeName="opacity" values={`0;0;${v};${v};0`} keyTimes={times(0, at, Math.min(at + 0.06, HOLD), HOLD, 1)} dur={`${DUR}s`} repeatCount="indefinite" />
      {children}
    </g>
  )
}

function Shape({ s }: { s: DemoShape }) {
  switch (s.t) {
    case 'path': {
      const c = s.color ?? '#e5484d'
      const d = pathD(s.pts, s.closed)
      return (
        <g>
          {(s.fill ?? 0) > 0 && <Appear at={DRAW_TO - 0.05} v={s.fill}><path d={d} fill={c} stroke="none" /></Appear>}
          {s.dash ? (
            <Appear at={DRAW_FROM}><path d={d} fill="none" stroke={c} strokeWidth={s.w ?? 1.6} strokeDasharray="5 3" strokeLinejoin="round" /></Appear>
          ) : s.static ? (
            <path d={d} fill="none" stroke={c} strokeWidth={s.w ?? 1.8} strokeLinejoin="round" />
          ) : (
            <Stroke d={d} color={c} w={s.w} />
          )}
        </g>
      )
    }
    case 'cloud':
      return <Stroke d={cloudPath({ x: s.a[0], y: s.a[1] }, { x: s.b[0], y: s.b[1] }, 7)} color={s.color ?? '#e5484d'} />
    case 'ellipse':
      return <Stroke d={ellipseD(s.c, s.rx, s.ry)} color={s.color ?? '#e5484d'} />
    case 'dots': {
      const n = s.pts.length
      const r = s.r ?? 4
      const c = s.color ?? '#f76b15'
      return (
        <g>
          {s.pts.map((p, i) => (
            <Appear key={i} at={DRAW_FROM + ((DRAW_TO - DRAW_FROM) * (i + 1)) / (n + 0.5)}>
              {s.square ? <rect x={p[0] - r} y={p[1] - r} width={r * 2} height={r * 2} fill="#fff" stroke={c} strokeWidth={1.5} /> : <circle cx={p[0]} cy={p[1]} r={r} fill={c} />}
              {s.numbered && <text x={p[0]} y={p[1] + 2.6} fontSize={7} fontWeight={700} fill="#fff" textAnchor="middle">{i + 1}</text>}
            </Appear>
          ))}
        </g>
      )
    }
    case 'label':
      return (
        <Appear at={DRAW_TO - 0.02}>
          <text x={s.at[0]} y={s.at[1]} fontSize={s.size ?? 10} fontWeight={700} fill={s.color ?? '#e5484d'} textAnchor="middle" style={{ fontFamily: 'var(--font, sans-serif)' }}>{s.text}</text>
        </Appear>
      )
    case 'bar': {
      const w = s.b[0] - s.a[0]
      return (
        <rect x={s.a[0]} y={s.a[1]} width={0} height={s.b[1] - s.a[1]} fill={s.color ?? '#000'} stroke="#9aa1b2" strokeWidth={0.8}>
          <animate attributeName="width" values={`0;0;${w};${w};0`} keyTimes={times(0, DRAW_FROM, DRAW_TO, HOLD, 1)} dur={`${DUR}s`} repeatCount="indefinite" />
        </rect>
      )
    }
    case 'box': {
      const c = s.color ?? '#2f9e8f'
      const ox = s.d * 0.55, oy = s.d * 0.45
      const { x, y, w, h } = s
      const at = (k: number) => {
        const hh = h * k
        const A: Pt2 = [x, y - hh], B: Pt2 = [x + w, y - hh], C: Pt2 = [x + w + ox, y - oy - hh], D: Pt2 = [x + ox, y - oy - hh]
        return { A, B, C, D, A0: [x, y] as Pt2, B0: [x + w, y] as Pt2, C0: [x + w + ox, y - oy] as Pt2 }
      }
      const poly = (pick: (g: ReturnType<typeof at>) => Pt2[]) => [0, 0.001, 1, 1, 1].map((k) => pick(at(k)).map((p) => `${f(p[0])},${f(p[1])}`).join(' ')).join(';')
      const kt = times(0, DRAW_FROM + 0.1, DRAW_TO, HOLD, 1)
      const face = (pick: (g: ReturnType<typeof at>) => Pt2[], fill: string) => (
        <polygon points={pick(at(0)).map((p) => p.join(',')).join(' ')} fill={fill} stroke="#0b0c0f" strokeOpacity={0.5} strokeWidth={0.8} strokeLinejoin="round">
          <animate attributeName="points" values={poly(pick)} keyTimes={kt} dur={`${DUR}s`} repeatCount="indefinite" />
        </polygon>
      )
      return (
        <g>
          <Appear at={DRAW_FROM}><polygon points={`${x},${y} ${x + w},${y} ${x + w + ox},${y - oy} ${x + ox},${y - oy}`} fill={c} fillOpacity={0.25} stroke={c} strokeWidth={1.4} /></Appear>
          <Appear at={DRAW_FROM + 0.1}>
            <g>
              {face((g) => [g.A0, g.B0, g.B, g.A], c)}
              {face((g) => [g.B0, g.C0, g.C, g.B], '#1f7a6e')}
              {face((g) => [g.A, g.B, g.C, g.D], '#52c1b1')}
            </g>
          </Appear>
        </g>
      )
    }
    case 'table': {
      const rowH = 9
      return (
        <Appear at={DRAW_FROM + 0.05}>
          <g>
            <rect x={s.at[0]} y={s.at[1]} width={s.w} height={rowH * (s.rows + 1)} fill="#fff" stroke={s.color ?? '#3e63dd'} strokeWidth={1.2} />
            <rect x={s.at[0]} y={s.at[1]} width={s.w} height={rowH} fill={s.color ?? '#3e63dd'} />
            {Array.from({ length: s.rows }, (_, i) => (
              <g key={i}>
                <rect x={s.at[0] + 4} y={s.at[1] + rowH * (i + 1) + 3} width={s.w * (0.35 + 0.1 * ((i * 3) % 4))} height={3} fill="#9aa1b2" />
                <rect x={s.at[0] + s.w - 20} y={s.at[1] + rowH * (i + 1) + 3} width={14} height={3} fill="#5b6275" />
              </g>
            ))}
          </g>
        </Appear>
      )
    }
    case 'lines':
      return (
        <g>
          {Array.from({ length: s.n }, (_, i) => (
            <rect key={i} x={s.at[0]} y={s.at[1] + i * 7} width={s.w * (i === s.n - 1 ? 0.6 : 1)} height={3} rx={1.2} fill="#8b8f9c" opacity={0.7} />
          ))}
        </g>
      )
  }
}

/** Planta de fundo: contorno e paredes de 3 ambientes (traços finos, sem cor). */
function Plan() {
  return (
    <g stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.4} fill="none">
      <rect x={10} y={10} width={180} height={100} />
      <path d="M 100 10 V 70 M 10 70 H 190" />
      <path d="M 100 70 V 110" strokeOpacity={0.25} strokeDasharray="3 3" />
    </g>
  )
}

function Cursor({ pts, tt }: { pts: Pt2[]; tt: number[] }) {
  if (!pts.length) return null
  const last = pts[pts.length - 1]
  const xs = [pts[0], ...pts, last, last] // 0 → parado no 1º ponto; percorre; fica no último até o fim
  const keyTimes = times(0, ...tt, HOLD, 1)
  const values = xs.map((p) => `${f(p[0])} ${f(p[1])}`).join(';')
  return (
    <g>
      <animate attributeName="opacity" values="0;1;1;0;0" keyTimes={times(0, DRAW_FROM - 0.06, HOLD - 0.04, HOLD + 0.04, 1)} dur={`${DUR}s`} repeatCount="indefinite" />
      <g transform={`translate(${pts[0][0]} ${pts[0][1]})`}>
        <animateTransform attributeName="transform" type="translate" values={values} keyTimes={keyTimes} dur={`${DUR}s`} repeatCount="indefinite" />
        <path d="M 0 0 L 0 11 L 3 8.2 L 5.4 13 L 7.2 12.2 L 4.9 7.5 L 8.5 7.4 Z" fill="#fff" stroke="#111" strokeWidth={0.9} strokeLinejoin="round" />
      </g>
    </g>
  )
}

export function ToolDemo({ demo, id }: { demo: DemoSpec; id: string }) {
  const video = toolVideo(id)
  if (video) return <video className="tool-demo" src={video} autoPlay loop muted playsInline />
  const first = demo.shapes.find((s) => s.t === 'path' && !s.static && !s.dash) as Extract<DemoShape, { t: 'path' }> | undefined
  const cur: Pt2[] = demo.cursor ?? (first ? (first.closed ? [...first.pts, first.pts[0]] : first.pts) : [])
  const cursorTt = cursorTimes(cur)
  return (
    <svg className="tool-demo" viewBox={`0 0 ${DEMO_W} ${DEMO_H}`} role="img" aria-label="Demonstração animada">
      <g>
        {demo.panBy && (
          <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${demo.panBy[0]} ${demo.panBy[1]};${demo.panBy[0]} ${demo.panBy[1]};0 0`} keyTimes={times(0, DRAW_FROM, DRAW_TO, HOLD, 1)} dur={`${DUR}s`} repeatCount="indefinite" />
        )}
        {demo.plan !== false && <Plan />}
        {demo.panBy && <circle cx={150} cy={90} r={5} fill="none" stroke="currentColor" strokeOpacity={0.4} />}
        {demo.shapes.map((s, i) => <Shape key={i} s={s} />)}
      </g>
      <Cursor pts={cur} tt={cursorTt} />
    </svg>
  )
}
