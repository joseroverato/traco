/**
 * Mini animação (SVG/SMIL, 5 s em laço) que mostra como a ferramenta funciona, num cenário próprio
 * (DemoScenes.tsx). Sem imagens nem vídeos: tudo vem de toolInfo.ts. Se existir src/assets/tools/<id>.mp4
 * (ou .webm), o vídeo substitui a animação.
 */
import { useId } from 'react'
import { cloudPath } from '../geometry'
import { DEMO_H, DEMO_W } from '../toolInfo'
import type { DemoShape, DemoSpec, Pt2 } from '../toolInfo'
import { DRAW_FROM, DRAW_TO, DUR, HOLD, appearKeys, cursorTimes, toolVideo } from '../demoTiming'
import { SceneArt } from './DemoScenes'
import { t } from '../i18n'

const f = (n: number) => +n.toFixed(3)
const times = (...n: number[]) => n.map(f).join(';')
const loop = { dur: `${DUR}s`, repeatCount: 'indefinite' } as const
const win = (s: { t0?: number; t1?: number }): [number, number] => [s.t0 ?? DRAW_FROM, s.t1 ?? DRAW_TO]
const uid = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, '')

const pathD = (pts: Pt2[], closed?: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0]} ${p[1]}`).join(' ') + (closed ? ' Z' : '')
const ellipseD = (c: Pt2, rx: number, ry: number) => `M ${c[0] - rx} ${c[1]} A ${rx} ${ry} 0 1 0 ${c[0] + rx} ${c[1]} A ${rx} ${ry} 0 1 0 ${c[0] - rx} ${c[1]}`

/** Traço que se desenha (stroke-dashoffset 1 → 0) entre `from` e `to`. */
function Stroke({ d, color, w = 1.8, from, to }: { d: string; color: string; w?: number; from: number; to: number }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1}>
      <animate attributeName="stroke-dashoffset" values="1;1;0;0;1;1" keyTimes={times(0, from, to, HOLD, Math.min(HOLD + 0.04, 1), 1)} {...loop} />
    </path>
  )
}

/** Aparece (opacidade 0 → v) em `at` e some em `until` (padrão: no fim do ciclo). */
function Appear({ at, until = HOLD, v = 1, children }: { at: number; until?: number; v?: number; children: React.ReactNode }) {
  return (
    <g opacity={0}>
      <animate attributeName="opacity" values={`0;0;${v};${v};0;0`} keyTimes={times(...appearKeys(at, until))} {...loop} />
      {children}
    </g>
  )
}

function Typing({ s }: { s: Extract<DemoShape, { t: 'typing' }> }) {
  const id = uid(useId())
  const size = s.size ?? 10
  const [t0, t1] = win(s)
  const w = s.text.length * size * 0.6
  return (
    <Appear at={t0}>
      <clipPath id={id}>
        <rect x={s.at[0] - 2} y={s.at[1] - size} width={0} height={size * 1.5}>
          <animate attributeName="width" values={`0;0;${f(w + 4)};${f(w + 4)}`} keyTimes={times(0, t0, t1, 1)} {...loop} />
        </rect>
      </clipPath>
      <text x={s.at[0]} y={s.at[1]} fontSize={size} fontWeight={700} fill={s.color ?? '#e5484d'} clipPath={`url(#${id})`} style={{ fontFamily: 'var(--font, sans-serif)' }}>{s.text}</text>
    </Appear>
  )
}

function Flood({ s }: { s: Extract<DemoShape, { t: 'flood' }> }) {
  const id = uid(useId())
  const [t0, t1] = win(s)
  const R = Math.max(...s.poly.map((p) => Math.hypot(p[0] - s.from[0], p[1] - s.from[1]))) + 2
  const c = s.color ?? '#30a46c'
  return (
    <Appear at={t0}>
      <clipPath id={id}><polygon points={s.poly.map((p) => p.join(',')).join(' ')} /></clipPath>
      <g clipPath={`url(#${id})`}>
        <circle cx={s.from[0]} cy={s.from[1]} r={0} fill={c} fillOpacity={0.3}>
          <animate attributeName="r" values={`0;0;${f(R)};${f(R)}`} keyTimes={times(0, t0, t1, 1)} {...loop} />
        </circle>
      </g>
      <path d={pathD(s.poly, true)} fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
    </Appear>
  )
}

function Box({ s }: { s: Extract<DemoShape, { t: 'box' }> }) {
  const c = s.color ?? '#2f9e8f'
  const [t0, t1] = win(s)
  const { x, y, w, d, h } = s
  const ox = d * 0.55, oy = d * 0.45
  const h2 = s.h2 ?? h
  const [t2a, t2b] = s.t2 ?? [t1, t1]
  // alturas ao longo do ciclo: 0 → h (extrusão) → h2 (puxada) → fica
  const hs = [0, 0.001, h, h, h2, h2, h2]
  const ks = [0, t0, t1, t2a, t2b, HOLD, 1]
  const at = (hh: number) => ({
    A: [x, y - hh] as Pt2, B: [x + w, y - hh] as Pt2, C: [x + w + ox, y - oy - hh] as Pt2, D: [x + ox, y - oy - hh] as Pt2,
    A0: [x, y] as Pt2, B0: [x + w, y] as Pt2, C0: [x + w + ox, y - oy] as Pt2,
  })
  const face = (pick: (g: ReturnType<typeof at>) => Pt2[], fill: string) => (
    <polygon points={pick(at(0)).map((p) => p.join(',')).join(' ')} fill={fill} stroke="#0b0c0f" strokeOpacity={0.5} strokeWidth={0.8} strokeLinejoin="round">
      <animate attributeName="points" values={hs.map((hh) => pick(at(hh)).map((p) => `${f(p[0])},${f(p[1])}`).join(' ')).join(';')} keyTimes={times(...ks)} {...loop} />
    </polygon>
  )
  const base: Pt2[] = [[x, y], [x + w, y], [x + w + ox, y - oy], [x + ox, y - oy]]
  const cx = x + (w + ox) / 2
  const topY = (hh: number) => y - oy / 2 - hh - 3
  const handle = hs.map((hh) => `${f(cx)} ${f(topY(hh))}`).join(';')
  return (
    <g>
      <Stroke d={pathD(base, true)} color={c} w={1.6} from={Math.max(0.1, t0 - 0.24)} to={t0 - 0.01} />
      <Appear at={t0 - 0.01}>
        <g>
          {face((g) => [g.A0, g.B0, g.B, g.A], c)}
          {face((g) => [g.B0, g.C0, g.C, g.B], '#1f7a6e')}
          {face((g) => [g.A, g.B, g.C, g.D], '#52c1b1')}
        </g>
      </Appear>
      {/* seta de puxar/empurrar, que acompanha o topo */}
      <Appear at={t1}>
        <g transform={`translate(${f(cx)} ${f(topY(h))})`}>
          <animateTransform attributeName="transform" type="translate" values={handle} keyTimes={times(...ks)} {...loop} />
          <polygon points="-5,2 5,2 0,-9" fill="#ff8a1f" stroke="#fff" strokeWidth={0.8} strokeLinejoin="round" />
        </g>
      </Appear>
    </g>
  )
}

function Shape({ s }: { s: DemoShape }) {
  const [t0, t1] = win(s)
  switch (s.t) {
    case 'path': {
      const c = s.color ?? '#e5484d'
      const d = pathD(s.pts, s.closed)
      return (
        <g>
          {(s.fill ?? 0) > 0 && <Appear at={s.static ? 0.02 : Math.max(t0, t1 - 0.05)} v={s.fill}><path d={d} fill={c} stroke="none" /></Appear>}
          {s.dash ? (
            <Appear at={t0}><path d={d} fill="none" stroke={c} strokeWidth={s.w ?? 1.6} strokeDasharray="5 3" strokeLinejoin="round" /></Appear>
          ) : s.static ? (
            <path d={d} fill="none" stroke={c} strokeWidth={s.w ?? 1.8} strokeLinejoin="round" />
          ) : (
            <Stroke d={d} color={c} w={s.w} from={t0} to={t1} />
          )}
        </g>
      )
    }
    case 'cloud':
      return <Stroke d={cloudPath({ x: s.a[0], y: s.a[1] }, { x: s.b[0], y: s.b[1] }, 7)} color={s.color ?? '#e5484d'} from={t0} to={t1} />
    case 'ellipse':
      return <Stroke d={ellipseD(s.c, s.rx, s.ry)} color={s.color ?? '#e5484d'} from={t0} to={t1} />
    case 'dots': {
      const r = s.r ?? 4
      const c = s.color ?? '#f76b15'
      const tt = s.pts.length > 1 ? cursorTimes(s.pts, t0, t1) : [t0]
      return (
        <g>
          {s.pts.map((p, i) => (
            <Appear key={i} at={tt[i]}>
              {s.square ? <rect x={p[0] - r} y={p[1] - r} width={r * 2} height={r * 2} rx={1.5} fill={c} fillOpacity={0.18} stroke={c} strokeWidth={1.5} /> : <circle cx={p[0]} cy={p[1]} r={r} fill={c} />}
              {s.numbered && <text x={p[0]} y={p[1] + 2.6} fontSize={7} fontWeight={700} fill="#fff" textAnchor="middle">{i + 1}</text>}
            </Appear>
          ))}
        </g>
      )
    }
    case 'label':
      return (
        <Appear at={t0} until={s.fade ? t1 : HOLD}>
          <text x={s.at[0]} y={s.at[1]} fontSize={s.size ?? 10} fontWeight={700} fill={s.color ?? '#e5484d'} textAnchor="middle" style={{ fontFamily: 'var(--font, sans-serif)' }}>{s.text}</text>
        </Appear>
      )
    case 'typing':
      return <Typing s={s} />
    case 'bar': {
      const w = s.b[0] - s.a[0]
      return (
        <rect x={s.a[0]} y={s.a[1]} width={0} height={s.b[1] - s.a[1]} fill={s.color ?? '#000'} stroke="#9aa1b2" strokeWidth={0.8}>
          <animate attributeName="width" values={`0;0;${w};${w};0;0`} keyTimes={times(0, t0, t1, HOLD, Math.min(HOLD + 0.04, 1), 1)} {...loop} />
        </rect>
      )
    }
    case 'box':
      return <Box s={s} />
    case 'table': {
      const rowH = 9
      return (
        <g>
          <Appear at={t0}>
            <rect x={s.at[0]} y={s.at[1]} width={s.w} height={rowH * (s.rows + 1)} fill="#fff" stroke={s.color ?? '#3e63dd'} strokeWidth={1.2} />
            <rect x={s.at[0]} y={s.at[1]} width={s.w} height={rowH} fill={s.color ?? '#3e63dd'} />
          </Appear>
          {Array.from({ length: s.rows }, (_, i) => (
            <Appear key={i} at={t0 + 0.05 * (i + 1)}>
              <rect x={s.at[0] + 4} y={s.at[1] + rowH * (i + 1) + 3} width={s.w * (0.35 + 0.1 * ((i * 3) % 4))} height={3} fill="#9aa1b2" />
              <rect x={s.at[0] + s.w - 22} y={s.at[1] + rowH * (i + 1) + 3} width={16} height={3} fill="#5b6275" />
            </Appear>
          ))}
        </g>
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
    case 'marquee': {
      const w = s.b[0] - s.a[0], h = s.b[1] - s.a[1], c = s.color ?? '#3e63dd'
      return (
        <Appear at={t0} until={s.keep ? HOLD : t1 + 0.03}>
          <rect x={s.a[0]} y={s.a[1]} width={0} height={0} fill={c} fillOpacity={s.fill ?? 0.1} stroke={c} strokeWidth={1.3} strokeDasharray="4 3">
            <animate attributeName="width" values={`0;0;${w};${w}`} keyTimes={times(0, t0, t1, 1)} {...loop} />
            <animate attributeName="height" values={`0;0;${h};${h}`} keyTimes={times(0, t0, t1, 1)} {...loop} />
          </rect>
        </Appear>
      )
    }
    case 'flood':
      return <Flood s={s} />
    case 'pop': {
      const c = s.color ?? '#e5484d'
      const ks = [0, t0, t0 + 0.04, t0 + 0.08, 1]
      return (
        <Appear at={t0}>
          <g transform={`translate(${s.at[0]} ${s.at[1]}) rotate(${s.angle ?? 0})`}>
            <g>
              <animateTransform attributeName="transform" type="scale" values="0.5;0.5;1.12;1;1" keyTimes={times(...ks)} {...loop} />
              <rect x={-s.w / 2} y={-s.h / 2} width={s.w} height={s.h} rx={4} fill="#14151a" fillOpacity={0.88} stroke={c} strokeWidth={2} />
              <text x={0} y={s.sub ? -1 : 3.5} fontSize={s.sub ? 10 : 11} fontWeight={800} fill={c} textAnchor="middle" style={{ fontFamily: 'var(--font, sans-serif)' }}>{s.text}</text>
              {s.sub && <text x={0} y={9.5} fontSize={9} fontWeight={700} fill={c} textAnchor="middle" style={{ fontFamily: 'var(--font, sans-serif)' }}>{s.sub}</text>}
            </g>
          </g>
        </Appear>
      )
    }
    case 'click': {
      const c = s.color ?? '#3e63dd'
      const ks = times(0, t0, t0 + 0.1, 1)
      return (
        <circle cx={s.at[0]} cy={s.at[1]} r={2} fill="none" stroke={c} strokeWidth={1.6} opacity={0}>
          <animate attributeName="r" values="2;2;11;11" keyTimes={ks} {...loop} />
          <animate attributeName="opacity" values="0;0.9;0;0" keyTimes={ks} {...loop} />
        </circle>
      )
    }
    case 'image': {
      const c = s.color ?? '#3e63dd'
      const w = s.b[0] - s.a[0], h = s.b[1] - s.a[1]
      return (
        <Appear at={t0}>
          <rect x={s.a[0]} y={s.a[1]} width={w} height={h} rx={2} fill={c} fillOpacity={0.14} stroke={c} strokeWidth={1.4} />
          <circle cx={s.a[0] + w * 0.75} cy={s.a[1] + h * 0.3} r={3} fill={c} fillOpacity={0.7} />
          <path d={`M ${s.a[0] + 3} ${s.b[1] - 3} L ${s.a[0] + w * 0.38} ${s.a[1] + h * 0.45} L ${s.a[0] + w * 0.58} ${s.a[1] + h * 0.7} L ${s.a[0] + w * 0.7} ${s.a[1] + h * 0.58} L ${s.b[0] - 3} ${s.b[1] - 3} Z`} fill={c} fillOpacity={0.5} />
        </Appear>
      )
    }
  }
}

function Cursor({ pts, tt }: { pts: Pt2[]; tt: number[] }) {
  if (!pts.length) return null
  const last = pts[pts.length - 1]
  const xs = [pts[0], ...pts, last, last] // 0 → parado no 1º ponto; percorre; fica no último até o fim
  const keyTimes = times(0, ...tt, HOLD, 1)
  const values = xs.map((p) => `${f(p[0])} ${f(p[1])}`).join(';')
  const c0 = tt[0]
  return (
    <g opacity={0}>
      <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={times(0, Math.max(c0 - 0.06, 0.005), c0, HOLD - 0.03, HOLD + 0.03, 1)} {...loop} />
      <g transform={`translate(${pts[0][0]} ${pts[0][1]})`}>
        <animateTransform attributeName="transform" type="translate" values={values} keyTimes={keyTimes} {...loop} />
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
  const [f0, f1] = first ? win(first) : [DRAW_FROM, DRAW_TO]
  const tt = demo.cursorTimes ?? cursorTimes(cur, f0, f1)
  const g = demo.ghost
  return (
    <svg className="tool-demo" viewBox={`0 0 ${DEMO_W} ${DEMO_H}`} role="img" aria-label={t('tooldemo.demonstracao_animada')}>
      <g>
        {demo.panBy && (
          <animateTransform attributeName="transform" type="translate" values={`0 0;0 0;${demo.panBy[0]} ${demo.panBy[1]};${demo.panBy[0]} ${demo.panBy[1]};0 0`} keyTimes={times(0, DRAW_FROM, DRAW_TO, HOLD, 1)} {...loop} />
        )}
        <SceneArt scene={demo.scene} />
        {g && (
          <Appear at={0.04}>
            <g style={{ color: g.color }} transform={`translate(${g.dx} ${g.dy})`}>
              <animateTransform attributeName="transform" type="translate" values={`${g.dx} ${g.dy};${g.dx} ${g.dy};0 0;0 0`} keyTimes={times(0, g.t0, g.t1, 1)} {...loop} />
              <SceneArt scene={demo.scene} ghost />
            </g>
          </Appear>
        )}
        {demo.shapes.map((s, i) => <Shape key={i} s={s} />)}
      </g>
      <Cursor pts={cur} tt={tt} />
    </svg>
  )
}
