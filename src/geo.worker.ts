/// <reference lib="webworker" />
/**
 * Worker de geometria (fora da thread da interface, para não travar a tela):
 *  - fill: "área por clique" — rasteriza as linhas do PDF, faz flood fill a partir do clique
 *          e devolve o contorno (com vazios/ilhas) como polígonos em pt.
 *  - symbol: contagem automática — procura cópias de um símbolo vetorial (com rotações).
 *  - raster: busca de símbolo por imagem (pranchas escaneadas), correlação normalizada.
 */

type Segs = { segs: Float32Array; n: number; w: number; h: number; grid?: Map<number, number[]> }
const sheets = new Map<string, Segs>()
const CELL = 12
const key = (cx: number, cy: number) => (cx + 1024) * 8192 + (cy + 1024)

function grid(s: Segs) {
  if (s.grid) return s.grid
  const g = new Map<number, number[]>()
  for (let id = 0; id < s.n; id++) {
    const o = id * 4
    const x1 = s.segs[o], y1 = s.segs[o + 1], x2 = s.segs[o + 2], y2 = s.segs[o + 3]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.max(1, Math.ceil(len / (CELL / 2)))
    let last = -1
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const k = key(Math.floor((x1 + (x2 - x1) * t) / CELL), Math.floor((y1 + (y2 - y1) * t) / CELL))
      if (k === last) continue
      last = k
      const a = g.get(k)
      if (!a) g.set(k, [id])
      else if (a[a.length - 1] !== id) a.push(id)
    }
  }
  s.grid = g
  return g
}

// ---------------------------------------------------------------- área por clique
interface FillReq { key: string; x: number; y: number; gap: number }

function fill(r: FillReq) {
  const s = sheets.get(r.key)
  if (!s) return { ok: false, reason: 'geo.carregando' }
  // janela crescente ao redor do clique: alta precisão em ambientes normais, sem estourar memória
  let half = 300 // pt
  for (let attempt = 0; attempt < 6; attempt++) {
    const x0 = Math.max(0, r.x - half), y0 = Math.max(0, r.y - half)
    const x1 = Math.min(s.w, r.x + half), y1 = Math.min(s.h, r.y + half)
    const whole = x0 === 0 && y0 === 0 && x1 === s.w && y1 === s.h
    const k = Math.min(4, 3000 / Math.max(x1 - x0, y1 - y0)) // px por pt
    const W = Math.ceil((x1 - x0) * k), H = Math.ceil((y1 - y0) * k)
    const mask = rasterize(s, x0, y0, k, W, H, Math.max(1.6, r.gap * k))
    const sx = Math.floor((r.x - x0) * k), sy = Math.floor((r.y - y0) * k)
    if (mask[sy * W + sx]) return { ok: false, reason: 'geo.clique_sobre_linha' }
    const touches = flood(mask, W, H, sx, sy)
    if (touches && !whole) {
      half *= 2.2
      continue
    }
    if (touches) return { ok: false, reason: 'geo.contorno_aberto' }
    const loops = traceLoops(mask, W, H)
    if (!loops.length) return { ok: false, reason: 'geo.nenhuma_regiao' }
    // maior anel = contorno externo; anéis de orientação oposta = vazios (pilares, shafts, ilhas)
    let outerI = 0
    loops.forEach((l, i) => Math.abs(l.area) > Math.abs(loops[outerI].area) && (outerI = i))
    const outer = loops[outerI]
    const toPt = (pts: number[]) => {
      const simp = simplify(pts, 0.9)
      const out: number[] = []
      for (let i = 0; i < simp.length; i += 2) out.push(x0 + simp[i] / k, y0 + simp[i + 1] / k)
      return out
    }
    const minHole = 9 * k * k // ignora ilhas menores que ~3×3 pt (textos, cruzetas)
    const holes = loops.filter((l, i) => i !== outerI && Math.sign(l.area) !== Math.sign(outer.area) && Math.abs(l.area) > minHole).map((l) => toPt(l.pts))
    return { ok: true, outer: toPt(outer.pts), holes, halfLine: Math.max(1.6, r.gap * k) / 2 / k }
  }
  return { ok: false, reason: 'geo.regiao_grande' }
}

function rasterize(s: Segs, x0: number, y0: number, k: number, W: number, H: number, lw: number) {
  const c = new OffscreenCanvas(W, H)
  const ctx = c.getContext('2d')!
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#000'
  ctx.beginPath()
  const g = grid(s)
  const seen = new Set<number>()
  const cx0 = Math.floor(x0 / CELL) - 1, cy0 = Math.floor(y0 / CELL) - 1
  const cx1 = Math.floor((x0 + W / k) / CELL) + 1, cy1 = Math.floor((y0 + H / k) / CELL) + 1
  for (let cx = cx0; cx <= cx1; cx++)
    for (let cy = cy0; cy <= cy1; cy++) {
      const a = g.get(key(cx, cy))
      if (!a) continue
      for (const id of a) {
        if (seen.has(id)) continue
        seen.add(id)
        const o = id * 4
        ctx.moveTo((s.segs[o] - x0) * k, (s.segs[o + 1] - y0) * k)
        ctx.lineTo((s.segs[o + 2] - x0) * k, (s.segs[o + 3] - y0) * k)
      }
    }
  ctx.stroke()
  const d = ctx.getImageData(0, 0, W, H).data
  const m = new Uint8Array(W * H)
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 40 ? 1 : 0
  return m
}

/** Preenche com 2 a partir de (sx,sy). Retorna true se vazou até a borda da janela. */
function flood(m: Uint8Array, W: number, H: number, sx: number, sy: number) {
  let touches = false
  const stack = [sx, sy]
  while (stack.length) {
    const y = stack.pop()!, x0 = stack.pop()!
    let x = x0
    while (x > 0 && m[y * W + x - 1] === 0) x--
    let up = false, dn = false
    for (; x < W && m[y * W + x] === 0; x++) {
      m[y * W + x] = 2
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) touches = true
      if (y > 0) {
        const f = m[(y - 1) * W + x] === 0
        if (f && !up) stack.push(x, y - 1)
        up = f
      }
      if (y < H - 1) {
        const f = m[(y + 1) * W + x] === 0
        if (f && !dn) stack.push(x, y + 1)
        dn = f
      }
    }
  }
  return touches
}

/** Contornos da região preenchida (valor 2) seguindo as bordas dos pixels. */
function traceLoops(m: Uint8Array, W: number, H: number) {
  const VW = W + 1
  const next = new Map<number, number[]>()
  const add = (a: number, b: number) => {
    const l = next.get(a)
    if (l) l.push(b)
    else next.set(a, [b])
  }
  const f = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x] === 2
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (m[y * W + x] !== 2) continue
      // arestas com a região à esquerda (sentido anti-horário em coordenadas de tela)
      if (!f(x, y - 1)) add(y * VW + x + 1, y * VW + x)
      if (!f(x - 1, y)) add(y * VW + x, (y + 1) * VW + x)
      if (!f(x, y + 1)) add((y + 1) * VW + x, (y + 1) * VW + x + 1)
      if (!f(x + 1, y)) add((y + 1) * VW + x + 1, y * VW + x + 1)
    }
  const loops: { pts: number[]; area: number }[] = []
  for (const [start] of next) {
    let list = next.get(start)
    if (!list || !list.length) continue
    const pts: number[] = []
    let v = start
    let guard = 0
    while (guard++ < 5e6) {
      list = next.get(v)
      if (!list || !list.length) break
      const n = list.pop()!
      pts.push(v % VW, Math.floor(v / VW))
      v = n
      if (v === start) break
    }
    if (pts.length < 8) continue
    let a = 0
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length
      a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
    }
    loops.push({ pts, area: a / 2 })
  }
  return loops
}

/** Douglas-Peucker em anel fechado (coordenadas planas x,y,x,y…). */
function simplify(pts: number[], eps: number): number[] {
  const n = pts.length / 2
  if (n < 4) return pts
  // divide o anel no ponto mais distante do primeiro
  let far = 0, fd = -1
  for (let i = 1; i < n; i++) {
    const d = (pts[i * 2] - pts[0]) ** 2 + (pts[i * 2 + 1] - pts[1]) ** 2
    if (d > fd) { fd = d; far = i }
  }
  const keep = new Uint8Array(n)
  keep[0] = keep[far] = 1
  const dp = (a: number, b: number) => {
    const stack = [a, b]
    while (stack.length) {
      const e = stack.pop()!, s = stack.pop()!
      const ax = pts[s * 2], ay = pts[s * 2 + 1], bx = pts[(e % n) * 2], by = pts[(e % n) * 2 + 1]
      const L = Math.hypot(bx - ax, by - ay) || 1
      let md = -1, mi = -1
      for (let i = s + 1; i < e; i++) {
        const px = pts[(i % n) * 2], py = pts[(i % n) * 2 + 1]
        const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L
        if (d > md) { md = d; mi = i }
      }
      if (md > eps) {
        keep[mi % n] = 1
        stack.push(s, mi, mi, e)
      }
    }
  }
  dp(0, far)
  dp(far, n)
  const out: number[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1])
  return out
}

// ---------------------------------------------------------------- contagem automática (vetorial)
interface SymReq { key: string; rect: { x: number; y: number; w: number; h: number }; rotations: boolean; srcKey?: string }

function symbol(r: SymReq) {
  const src = sheets.get(r.srcKey ?? r.key), dst = sheets.get(r.key)
  if (!src || !dst) return { ok: false, reason: 'geo.carregando', centers: [] }
  const { x, y, w, h } = r.rect
  const pad = Math.max(w, h) * 0.04
  const T: number[][] = []
  const gs = grid(src)
  const seen = new Set<number>()
  for (let cx = Math.floor((x - pad) / CELL); cx <= Math.floor((x + w + pad) / CELL); cx++)
    for (let cy = Math.floor((y - pad) / CELL); cy <= Math.floor((y + h + pad) / CELL); cy++)
      for (const id of gs.get(key(cx, cy)) ?? []) {
        if (seen.has(id)) continue
        seen.add(id)
        const o = id * 4
        const a = [src.segs[o], src.segs[o + 1], src.segs[o + 2], src.segs[o + 3]]
        const inside = (px: number, py: number) => px >= x - pad && px <= x + w + pad && py >= y - pad && py <= y + h + pad
        if (inside(a[0], a[1]) && inside(a[2], a[3])) T.push(a)
      }
  if (T.length < 2) return { ok: false, reason: 'vector-empty', centers: [] }
  const cx0 = x + w / 2, cy0 = y + h / 2
  const rel = T.map(([a, b, c, d]) => [a - cx0, b - cy0, c - cx0, d - cy0])
  // âncora: o segmento mais longo do símbolo
  let ai = 0
  rel.forEach((s, i) => Math.hypot(s[2] - s[0], s[3] - s[1]) > Math.hypot(rel[ai][2] - rel[ai][0], rel[ai][3] - rel[ai][1]) && (ai = i))
  const anchor = rel[ai]
  const La = Math.hypot(anchor[2] - anchor[0], anchor[3] - anchor[1])
  const size = Math.max(w, h)
  const tol = Math.max(0.6, size * 0.035)
  const g = grid(dst)
  const rots = r.rotations ? [0, 90, 180, 270] : [0]
  const found: [number, number][] = []
  const hasSeg = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    for (const id of g.get(key(Math.floor(mx / CELL), Math.floor(my / CELL))) ?? []) {
      const o = id * 4
      const a = dst.segs[o], b = dst.segs[o + 1], c = dst.segs[o + 2], d = dst.segs[o + 3]
      if ((Math.abs(a - x1) < tol && Math.abs(b - y1) < tol && Math.abs(c - x2) < tol && Math.abs(d - y2) < tol) ||
          (Math.abs(a - x2) < tol && Math.abs(b - y2) < tol && Math.abs(c - x1) < tol && Math.abs(d - y1) < tol)) return true
    }
    return false
  }
  for (let id = 0; id < dst.n; id++) {
    const o = id * 4
    const sx1 = dst.segs[o], sy1 = dst.segs[o + 1], sx2 = dst.segs[o + 2], sy2 = dst.segs[o + 3]
    const Ls = Math.hypot(sx2 - sx1, sy2 - sy1)
    if (Math.abs(Ls - La) > tol) continue
    for (const deg of rots) {
      const c = Math.round(Math.cos((deg * Math.PI) / 180)), sn = Math.round(Math.sin((deg * Math.PI) / 180))
      const R = (px: number, py: number): [number, number] => [px * c - py * sn, px * sn + py * c]
      const [a1x, a1y] = R(anchor[0], anchor[1])
      const [a2x, a2y] = R(anchor[2], anchor[3])
      for (const [px, py, qx, qy] of [[sx1, sy1, sx2, sy2], [sx2, sy2, sx1, sy1]]) {
        // a direção da âncora girada precisa bater com o segmento candidato
        if (Math.abs((a2x - a1x) - (qx - px)) > tol * 1.5 || Math.abs((a2y - a1y) - (qy - py)) > tol * 1.5) continue
        const tx = px - a1x, ty = py - a1y // centro do símbolo candidato
        if (found.some(([fx, fy]) => Math.hypot(fx - tx, fy - ty) < size * 0.35)) continue
        let ok = 0
        for (const s of rel) {
          const [u1, v1] = R(s[0], s[1]), [u2, v2] = R(s[2], s[3])
          if (hasSeg(u1 + tx, v1 + ty, u2 + tx, v2 + ty)) ok++
        }
        if (ok / rel.length >= 0.88) found.push([tx, ty])
      }
    }
  }
  return { ok: true, centers: found, segments: rel.length }
}

// ---------------------------------------------------------------- contagem por imagem (escaneadas)
interface RasterReq { gray: Uint8Array; W: number; H: number; rect: { x: number; y: number; w: number; h: number }; k: number; thr: number }

function raster(r: RasterReq) {
  const { gray, W, H, k } = r
  const tx = Math.round(r.rect.x * k), ty = Math.round(r.rect.y * k), tw = Math.max(4, Math.round(r.rect.w * k)), th = Math.max(4, Math.round(r.rect.h * k))
  const tpl = new Float32Array(tw * th)
  let mean = 0
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) mean += tpl[j * tw + i] = 255 - gray[(ty + j) * W + tx + i]
  mean /= tpl.length
  let tn = 0
  for (let i = 0; i < tpl.length; i++) { tpl[i] -= mean; tn += tpl[i] * tpl[i] }
  tn = Math.sqrt(tn) || 1
  const hits: [number, number, number][] = []
  const step = Math.max(1, Math.floor(Math.min(tw, th) / 8))
  for (let y = 0; y + th < H; y += step)
    for (let x = 0; x + tw < W; x += step) {
      let m = 0
      for (let j = 0; j < th; j += 2) for (let i = 0; i < tw; i += 2) m += 255 - gray[(y + j) * W + x + i]
      m /= Math.ceil(th / 2) * Math.ceil(tw / 2)
      if (Math.abs(m - (mean)) > 60) continue // descarta rápido regiões muito diferentes
      let num = 0, den = 0
      for (let j = 0; j < th; j++)
        for (let i = 0; i < tw; i++) {
          const v = 255 - gray[(y + j) * W + x + i] - m
          num += v * tpl[j * tw + i]
          den += v * v
        }
      const ncc = num / ((Math.sqrt(den) || 1) * tn)
      if (ncc > r.thr) hits.push([x, y, ncc])
    }
  hits.sort((a, b) => b[2] - a[2])
  const out: [number, number][] = []
  for (const [x, y] of hits) {
    const cx = (x + tw / 2) / k, cy = (y + th / 2) / k
    if (out.every(([ox, oy]) => Math.hypot(ox - cx, oy - cy) > Math.max(r.rect.w, r.rect.h) * 0.6)) out.push([cx, cy])
  }
  return { ok: true, centers: out }
}

self.onmessage = (e: MessageEvent) => {
  const { id, type, payload } = e.data
  try {
    let result: unknown
    if (type === 'load') {
      sheets.set(payload.key, { segs: payload.segs, n: payload.n, w: payload.w, h: payload.h })
      result = true
    } else if (type === 'fill') result = fill(payload)
    else if (type === 'symbol') result = symbol(payload)
    else if (type === 'raster') result = raster(payload)
    ;(self as unknown as Worker).postMessage({ id, result })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
