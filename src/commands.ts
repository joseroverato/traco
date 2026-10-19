/**
 * Comandos que o Claude pode executar no Traço.
 * Os mesmos comandos atendem o painel do Claude (API) e o servidor MCP do app de PC (Claude Desktop).
 */
import TOOLS from './tools.json'
import { uid, useStore } from './store'
import { renderSheet, viewportOf } from './pdf'
import { bbox, centroid, fmt, measureOf, paperScale, scaleFor } from './geometry'
import { summarize } from './summary'
import type { GroupBy } from './summary'
import { spaceOf } from './columns'
import type { ToolContent } from './platform'
import type { Markup, MarkupKind, Preset, Sheet } from './types'

export { TOOLS }
export interface CommandResult {
  content: ToolContent[]
  isError?: boolean
}
type Args = Record<string, unknown>

const st = () => useStore.getState()
const r1 = (n: number) => Math.round(n * 10) / 10
const json = (o: unknown): CommandResult => ({ content: [{ type: 'text', text: JSON.stringify(o) }] })
const fail = (msg: string): CommandResult => ({ content: [{ type: 'text', text: msg }], isError: true })

function sheetOf(ref: unknown): Sheet {
  const s = st()
  if (ref === undefined || ref === null || ref === '') {
    const cur = s.sheets[s.page]
    if (!cur) throw new Error('Nenhum documento aberto no Traço.')
    return cur
  }
  const str = String(ref).trim()
  const byId = s.sheets.find((x) => x.id === str)
  if (byId) return byId
  if (/^\d+$/.test(str)) {
    const sh = s.sheets[Number(str) - 1]
    if (sh) return sh
  }
  const byLabel = s.sheets.find((x) => x.label.toLowerCase() === str.toLowerCase()) ?? s.sheets.find((x) => x.label.toLowerCase().includes(str.toLowerCase()))
  if (byLabel) return byLabel
  throw new Error(`Folha não encontrada: "${str}". Use list_sheets.`)
}

function presetOf(ref: unknown): Preset | undefined {
  if (!ref) return undefined
  const s = st()
  const str = String(ref).toLowerCase()
  return s.presets.find((p) => p.id === ref) ?? s.presets.find((p) => p.name.toLowerCase() === str) ?? s.presets.find((p) => p.name.toLowerCase().includes(str))
}

function describe(m: Markup, withPoints = false) {
  const s = st()
  const sh = s.sheets.find((x) => x.id === m.page)
  const p = s.presets.find((x) => x.id === m.presetId)
  const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), p)
  const b = bbox(m.points)
  return {
    id: m.id,
    sheet: sh?.label,
    kind: m.kind,
    preset: p?.name,
    quantity: q ? (q.error ? `erro na fórmula: ${q.error}` : `${fmt(q.value)} ${q.unit}`) : undefined,
    status: m.status,
    text: m.text || undefined,
    comment: m.comment || undefined,
    deduct: m.deduct || undefined,
    bbox: [r1(b.x), r1(b.y), r1(b.w), r1(b.h)],
    points: withPoints ? m.points.map((pt) => [r1(pt.x), r1(pt.y)]) : undefined,
    scale: m.kind === 'viewport' ? m.scale?.label ?? null : undefined,
    holes: withPoints && m.holes?.length ? m.holes.map((h) => h.map((pt) => [r1(pt.x), r1(pt.y)])) : m.holes?.length || undefined,
    space: m.kind !== 'space' ? spaceOf(m, s.markups)?.text : undefined,
    assignee: m.assignee || undefined,
    priority: m.priority || undefined,
    due: m.due || undefined,
    replies: m.replies?.length ? m.replies.map((r) => `${r.author}: ${r.text}`) : undefined,
  }
}

async function textItems(sh: Sheet) {
  const s = st()
  const ocr = s.ocr[sh.id]
  const src = s.sources[sh.src]
  const page = await src.doc.getPage(sh.srcIndex + 1)
  const vp = viewportOf(page, sh, 1)
  const tc = await page.getTextContent()
  const items = tc.items
    .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && !!i.str.trim())
    .map((i) => {
      const [x, y] = vp.convertToViewportPoint(i.transform[4], i.transform[5])
      return { t: i.str.trim(), x: r1(x), y: r1(y) }
    })
  if (!items.length && ocr) return { source: 'ocr', items: ocr.words.map((w) => ({ t: w.text, x: r1(w.x), y: r1(w.y + w.h) })) }
  return { source: 'pdf', items }
}

/** Desenha marcações de forma simplificada (para a imagem enviada ao Claude). */
function paintMarkups(ctx: CanvasRenderingContext2D, ms: Markup[], k: number, ox: number, oy: number) {
  const s = st()
  const P = (x: number, y: number): [number, number] => [(x - ox) * k, (y - oy) * k]
  for (const m of ms) {
    if (m.kind === 'image') continue
    ctx.strokeStyle = m.color
    ctx.fillStyle = m.color
    ctx.lineWidth = Math.max(1.5, m.width * k)
    const pts = m.points
    ctx.beginPath()
    if (m.kind === 'count') {
      pts.forEach((p) => {
        const [x, y] = P(p.x, p.y)
        ctx.moveTo(x + 6, y)
        ctx.arc(x, y, 6, 0, Math.PI * 2)
      })
      ctx.globalAlpha = 0.85
      ctx.fill()
      ctx.globalAlpha = 1
    } else if (['rect', 'cloud', 'ellipse', 'text', 'stamp', 'viewport', 'redact'].includes(m.kind) && pts.length >= 2) {
      const b = bbox(pts)
      const [x, y] = P(b.x, b.y)
      ctx.rect(x, y, b.w * k, b.h * k)
      if (m.kind === 'redact') ctx.fill()
      ctx.setLineDash(m.kind === 'viewport' ? [8, 5] : [])
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      pts.forEach((p, i) => (i ? ctx.lineTo(...P(p.x, p.y)) : ctx.moveTo(...P(p.x, p.y))))
      if (m.kind === 'area') {
        ctx.closePath()
        ctx.globalAlpha = 0.2
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.stroke()
    }
    // rótulo curto com o id para o Claude referenciar
    const c = m.kind === 'count' ? pts[pts.length - 1] : centroid(pts)
    const p = s.presets.find((x) => x.id === m.presetId)
    const q = measureOf(m, scaleFor(m, s.markups, s.scales[m.page]), p)
    const label = `${m.id}${q && !q.error ? ` ${fmt(q.value)}${q.unit}` : ''}`
    const [lx, ly] = P(c.x, c.y)
    ctx.font = 'bold 12px sans-serif'
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    ctx.strokeText(label, lx + 4, ly - 4)
    ctx.fillStyle = m.color
    ctx.fillText(label, lx + 4, ly - 4)
  }
}

const HANDLERS: Record<string, (a: Args) => Promise<CommandResult> | CommandResult> = {
  get_document() {
    const s = st()
    if (!s.sheets.length) return json({ open: false, message: 'Nenhum documento aberto. Peça ao usuário para abrir um PDF ou projeto .traco no Traço.' })
    const cur = s.sheets[s.page]
    return json({
      open: true,
      file: s.fileName,
      sheets: s.sheets.length,
      current_sheet: { number: s.page + 1, id: cur.id, label: cur.label },
      scales: Object.fromEntries(s.sheets.filter((x) => s.scales[x.id]).map((x) => [x.label, s.scales[x.id].label])),
      markups: s.markups.length,
      presets: s.presets.length,
      statuses: s.statuses.map((x) => x.name),
      mode: s.mode,
      units: 'Coordenadas em pt (1/72 pol), origem no canto superior esquerdo da folha como exibida, y para baixo.',
    })
  },

  list_sheets() {
    const s = st()
    return json(s.sheets.map((x, i) => ({ number: i + 1, id: x.id, label: x.label, width_pt: r1(x.width), height_pt: r1(x.height), scale: s.scales[x.id]?.label ?? null, markups: s.markups.filter((m) => m.page === x.id).length, rotation: x.rot || undefined })))
  },

  async get_sheet_image(a) {
    const s = st()
    const sh = sheetOf(a.sheet)
    const reg = a.region as { x: number; y: number; w: number; h: number } | undefined
    const max = Math.min(2000, Number(a.max_size) || 1400)
    const area = reg ? { x: Math.max(0, reg.x), y: Math.max(0, reg.y), w: Math.min(reg.w, sh.width - Math.max(0, reg.x)), h: Math.min(reg.h, sh.height - Math.max(0, reg.y)) } : { x: 0, y: 0, w: sh.width, h: sh.height }
    if (area.w <= 0 || area.h <= 0) return fail('Recorte fora da folha.')
    const k = max / Math.max(area.w, area.h)
    const full = await renderSheet(s.sources[sh.src], sh, k)
    const c = document.createElement('canvas')
    c.width = Math.round(area.w * k)
    c.height = Math.round(area.h * k)
    const ctx = c.getContext('2d')!
    ctx.drawImage(full, -area.x * k, -area.y * k)
    if (a.show_markups !== false) paintMarkups(ctx, s.markups.filter((m) => m.page === sh.id), k, area.x, area.y)
    const data = c.toDataURL('image/png').split(',')[1]
    return {
      content: [
        { type: 'image', data, mimeType: 'image/png' },
        { type: 'text', text: JSON.stringify({ sheet: sh.label, px_per_pt: Math.round(k * 1000) / 1000, origin_pt: [r1(area.x), r1(area.y)], hint: 'pt = origin_pt + px / px_per_pt', scale: s.scales[sh.id]?.label ?? null }) },
      ],
    }
  },

  async get_sheet_text(a) {
    const sh = sheetOf(a.sheet)
    const { source, items } = await textItems(sh)
    const f = a.contains ? String(a.contains).toLowerCase() : ''
    const list = f ? items.filter((i) => i.t.toLowerCase().includes(f)) : items
    return json({ sheet: sh.label, source, count: list.length, items: list.slice(0, 800), truncated: list.length > 800 || undefined })
  },

  async find_text(a) {
    const q = String(a.query ?? '').toLowerCase()
    if (!q) return fail('Informe "query".')
    const out: { sheet: string; number: number; text: string; x: number; y: number }[] = []
    for (const [i, sh] of st().sheets.entries()) {
      const { items } = await textItems(sh)
      items.filter((it) => it.t.toLowerCase().includes(q)).forEach((it) => out.push({ sheet: sh.label, number: i + 1, text: it.t, x: it.x, y: it.y }))
      if (out.length > 300) break
    }
    return json({ query: a.query, matches: out })
  },

  list_markups(a) {
    const s = st()
    let ms = s.markups
    if (a.sheet !== undefined) {
      const sh = sheetOf(a.sheet)
      ms = ms.filter((m) => m.page === sh.id)
    }
    if (a.kind) ms = ms.filter((m) => m.kind === a.kind)
    if (a.status) ms = ms.filter((m) => m.status === a.status)
    if (a.preset) {
      const p = presetOf(a.preset)
      ms = ms.filter((m) => m.presetId === p?.id)
    }
    return json({ count: ms.length, markups: ms.slice(0, 400).map((m) => describe(m, !!a.include_points)) })
  },

  get_quantities(a) {
    const s = st()
    const ms = (a.sheet !== undefined ? s.markups.filter((m) => m.page === sheetOf(a.sheet).id) : s.markups).filter((m) => m.kind !== 'viewport')
    const by = (a.group_by as GroupBy) || 'preset'
    const rows = summarize(ms, s.presets, s.scales, s.sheets, s.markups, by, s.columns)
    const total = rows.reduce((t, r) => t + r.total, 0)
    return json({
      group_by: by,
      bdi_percent: s.bdi || undefined,
      total_with_bdi: s.bdi ? Math.round(total * (1 + s.bdi / 100) * 100) / 100 : undefined,
      rows: rows.map((r) => ({ bucket: by !== 'preset' ? r.bucket : undefined, columns: s.columns.length ? Object.fromEntries(s.columns.map((c) => [c.name, r.fields[c.id] ?? null])) : undefined, group: r.group, code: r.code || undefined, service: r.name, sheets: r.sheets, items: r.items, gross: `${fmt(r.raw)} ${r.rawUnit}`, factor: r.factor !== 1 ? r.factor : undefined, quantity: Math.round(r.qty * 100) / 100, unit: r.unit, unit_price: r.price || undefined, total: r.price ? Math.round(r.total * 100) / 100 : undefined, without_scale: r.unscaled || undefined })),
      total_brl: Math.round(rows.reduce((t, r) => t + r.total, 0) * 100) / 100,
    })
  },

  list_presets() {
    return json(st().presets.map((p) => ({ id: p.id, name: p.name, group: p.group, code: p.code || undefined, measure: p.measure, factor: p.factor !== 1 ? p.factor : undefined, factor_label: p.factorLabel || undefined, formula: p.formula || undefined, unit: p.resultUnit, unit_price: p.unitPrice || undefined, color: p.color })))
  },

  upsert_preset(a) {
    const s = st()
    const cur = a.id ? s.presets.find((p) => p.id === a.id) : undefined
    if (a.id && !cur) return fail(`Marcador ${a.id} não existe.`)
    const measure = (a.measure as Preset['measure']) ?? cur?.measure ?? 'area'
    const base: Preset = cur ?? {
      id: uid(), name: 'Novo marcador', group: 'Geral', code: '', measure, color: '#0090ff', opacity: 0.25, width: measure === 'length' ? 3 : 1.5, dash: 'solid',
      pattern: 'solid', symbol: 'circle', letter: '', factor: 1, factorLabel: '', formula: '', resultUnit: measure === 'length' ? 'm' : measure === 'area' ? 'm²' : 'un', unitPrice: 0, showLabel: true,
    }
    const next: Preset = {
      ...base,
      ...(a.name !== undefined && { name: String(a.name) }),
      ...(a.group !== undefined && { group: String(a.group) }),
      ...(a.code !== undefined && { code: String(a.code) }),
      measure,
      ...(a.color !== undefined && { color: String(a.color) }),
      ...(a.factor !== undefined && { factor: Number(a.factor) }),
      ...(a.factor_label !== undefined && { factorLabel: String(a.factor_label) }),
      ...(a.formula !== undefined && { formula: String(a.formula) }),
      ...(a.result_unit !== undefined && { resultUnit: String(a.result_unit) }),
      ...(a.unit_price !== undefined && { unitPrice: Number(a.unit_price) }),
      ...(a.pattern !== undefined && { pattern: a.pattern as Preset['pattern'] }),
    }
    s.setPresets(cur ? s.presets.map((p) => (p.id === cur.id ? next : p)) : [...s.presets, next])
    if (cur) useStore.setState({ markups: st().markups.map((m) => (m.presetId === cur.id ? { ...m, color: next.color, fill: next.color } : m)) })
    return json({ ok: true, created: !cur, preset: { id: next.id, name: next.name } })
  },

  set_scale(a) {
    const s = st()
    const n = Number(a.ratio)
    if (!n || n <= 0) return fail('ratio inválido')
    const sc = { metersPerUnit: paperScale(n), label: `1:${n}` }
    if (a.viewport_id) {
      const vp = s.markups.find((m) => m.id === a.viewport_id && m.kind === 'viewport')
      if (!vp) return fail('Viewport não encontrado.')
      s.updateMarkup(vp.id, { scale: sc })
      return json({ ok: true, viewport: vp.text, scale: sc.label })
    }
    const scales = { ...s.scales }
    const targets = a.all_sheets ? s.sheets : [sheetOf(a.sheet)]
    targets.forEach((sh) => (scales[sh.id] = sc))
    s.set({ scales })
    return json({ ok: true, sheets: targets.map((x) => x.label), scale: sc.label })
  },

  add_markups(a) {
    const s = st()
    const list = (a.markups as Args[]) ?? []
    if (!list.length) return fail('Nenhuma marcação informada.')
    const created: Markup[] = []
    const errors: string[] = []
    list.forEach((it, i) => {
      try {
        const sh = sheetOf(it.sheet)
        const kind = it.kind as MarkupKind
        const pts = ((it.points as number[][]) ?? []).map(([x, y]) => ({ x: Number(x), y: Number(y) }))
        const need = kind === 'area' || kind === 'space' ? 3 : kind === 'count' ? 1 : 2
        if (pts.length < need) throw new Error(`${kind} precisa de ${need}+ pontos`)
        const p = presetOf(it.preset)
        if (it.preset && !p) throw new Error(`marcador "${it.preset}" não encontrado`)
        if (p && p.measure !== kind) throw new Error(`marcador "${p.name}" é de ${p.measure}, não ${kind}`)
        const color = (it.color as string) ?? p?.color ?? (kind === 'viewport' ? '#0090ff' : kind === 'redact' ? '#000000' : kind === 'space' ? '#8e4ec6' : '#e5484d')
        const holes = ((it.holes as number[][][]) ?? []).map((h) => h.map(([x, y]) => ({ x: Number(x), y: Number(y) }))).filter((h) => h.length >= 3)
        created.push({
          id: uid(), page: sh.id, kind, points: ['rect', 'cloud', 'ellipse', 'text', 'stamp', 'viewport', 'redact'].includes(kind) ? pts.slice(0, 2) : pts,
          text: String(it.text ?? (kind === 'viewport' ? 'Viewport' : '')), comment: String(it.comment ?? ''), status: String(it.status ?? s.statuses[0]?.name ?? 'aberto'),
          author: 'Claude', createdAt: Date.now(), presetId: p?.id ?? null, deduct: !!it.deduct, color, width: p?.width ?? (kind === 'stamp' ? 2 : 1.5),
          fill: kind === 'redact' ? '#000000' : color, fillOpacity: kind === 'redact' ? 1 : p?.opacity ?? (kind === 'area' ? 0.2 : 0), fontSize: kind === 'stamp' ? 14 : kind === 'redact' ? 9 : 12,
          ...(holes.length && (kind === 'area' || kind === 'space') ? { holes } : {}),
          ...(kind === 'space' && !it.text ? { text: `Ambiente ${s.markups.filter((x) => x.kind === 'space').length + created.length + 1}` } : {}),
          ...(it.assignee ? { assignee: String(it.assignee) } : {}),
          ...(it.priority ? { priority: it.priority as Markup['priority'] } : {}),
          ...(it.due ? { due: String(it.due) } : {}),
        })
      } catch (e) {
        errors.push(`item ${i + 1}: ${(e as Error).message}`)
      }
    })
    if (created.length) {
      s.checkpoint()
      useStore.setState({ markups: [...st().markups, ...created] })
    }
    return { content: [{ type: 'text', text: JSON.stringify({ created: created.map((m) => describe(m)), errors: errors.length ? errors : undefined }) }], isError: !created.length }
  },

  update_markups(a) {
    const s = st()
    const ids = (a.ids as string[]) ?? []
    const p = a.preset !== undefined ? presetOf(a.preset) : undefined
    if (a.preset && !p) return fail(`marcador "${a.preset}" não encontrado`)
    s.checkpoint()
    let n = 0
    useStore.setState({
      markups: s.markups.map((m) => {
        if (!ids.includes(m.id)) return m
        n++
        return {
          ...m,
          ...(a.status !== undefined && { status: String(a.status) }),
          ...(a.comment !== undefined && { comment: String(a.comment) }),
          ...(a.text !== undefined && { text: String(a.text) }),
          ...(a.color !== undefined && { color: String(a.color), fill: String(a.color) }),
          ...(a.deduct !== undefined && { deduct: !!a.deduct }),
          ...(p && p.measure === m.kind && { presetId: p.id, color: p.color, fill: p.color, width: p.width, fillOpacity: p.opacity }),
          ...(a.assignee !== undefined && { assignee: String(a.assignee) }),
          ...(a.priority !== undefined && { priority: (a.priority || undefined) as Markup['priority'] }),
          ...(a.due !== undefined && { due: String(a.due) || undefined }),
          ...(a.reply ? { replies: [...(m.replies ?? []), { author: 'Claude', at: Date.now(), text: String(a.reply) }] } : {}),
          ...(Array.isArray(a.add_holes) && (m.kind === 'area' || m.kind === 'space') ? { holes: [...(m.holes ?? []), ...(a.add_holes as number[][][]).map((h) => h.map(([x, y]) => ({ x: Number(x), y: Number(y) })))] } : {}),
        }
      }),
    })
    return json({ updated: n })
  },

  delete_markups(a) {
    const ids = (a.ids as string[]) ?? []
    const n = st().markups.filter((m) => ids.includes(m.id)).length
    st().removeMarkups(ids)
    return json({ deleted: n })
  },

  rename_sheets(a) {
    const s = st()
    const map = new Map<string, string>()
    for (const r of (a.renames as Args[]) ?? []) map.set(sheetOf(r.sheet).id, String(r.label))
    s.setSheets(s.sheets.map((x) => (map.has(x.id) ? { ...x, label: map.get(x.id)! } : x)))
    return json({ renamed: map.size })
  },

  go_to(a) {
    const s = st()
    const sh = sheetOf(a.sheet ?? (a.markup_id ? s.markups.find((m) => m.id === a.markup_id)?.page : undefined))
    s.set({ mode: 'review', page: s.sheets.indexOf(sh), selected: a.markup_id ? [String(a.markup_id)] : [], tool: 'select' })
    return json({ ok: true, sheet: sh.label })
  },

  async fill_area_at(a) {
    const s = st()
    const sh = sheetOf(a.sheet)
    const { detectRegion } = await import('./regions')
    const r = await detectRegion(sh, { x: Number(a.x), y: Number(a.y) }, a.gap !== undefined ? Number(a.gap) : undefined)
    if (typeof r === 'string') return fail(r)
    if (a.hole_of) {
      const target = s.markups.find((m) => m.id === a.hole_of && (m.kind === 'area' || m.kind === 'space'))
      if (!target) return fail('Área/ambiente não encontrado para receber o vazio.')
      s.updateMarkup(target.id, { holes: [...(target.holes ?? []), r.outer] })
      return json({ ok: true, hole_added_to: describe(st().markups.find((m) => m.id === target.id)!) })
    }
    const asSpace = a.as === 'space'
    const p = asSpace ? undefined : presetOf(a.preset)
    if (a.preset && !p) return fail(`marcador "${a.preset}" não encontrado`)
    if (p && p.measure !== 'area') return fail(`marcador "${p.name}" não é de área`)
    const prev = s.activePreset
    useStore.setState({ activePreset: p?.id ?? null })
    const m = asSpace
      ? s.addMarkup('space', sh.id, r.outer, { text: String(a.name ?? `Ambiente ${s.markups.filter((x) => x.kind === 'space').length + 1}`), color: '#8e4ec6', holes: r.holes, author: 'Claude' })
      : s.addMarkup('area', sh.id, r.outer, { ...(r.holes.length ? { holes: r.holes } : {}), author: 'Claude' })
    useStore.setState({ activePreset: prev })
    return json({ ok: true, created: describe(m), vertices: r.outer.length, holes: r.holes.length })
  },

  async find_symbols(a) {
    const s = st()
    const sh = sheetOf(a.sheet)
    const [x, y, w, h] = (a.rect as number[]).map(Number)
    if (!(w > 0 && h > 0)) return fail('rect inválido: [x, y, largura, altura] em pt')
    const { symbolsIn } = await import('./regions')
    const targets = a.all_sheets ? s.sheets : [sh]
    const found = await symbolsIn(sh, { x, y, w, h }, targets)
    const total = Object.values(found).reduce((t, v) => t + v.length, 0)
    let created: string[] = []
    if (a.create && total) {
      const p = presetOf(a.preset)
      if (a.preset && (!p || p.measure !== 'count')) return fail(`marcador de contagem "${a.preset}" não encontrado`)
      s.checkpoint()
      const add: Markup[] = Object.entries(found).filter(([, pts]) => pts.length).map(([page, pts], i) => ({
        id: uid(), page, kind: 'count', points: pts, text: '', comment: 'Contagem automática (Claude)', status: s.statuses[0]?.name ?? 'aberto', author: 'Claude',
        createdAt: Date.now() + i, presetId: p?.id ?? null, deduct: false, color: p?.color ?? '#f76b15', width: 1.5, fill: p?.color ?? '#f76b15', fillOpacity: 0, fontSize: 12,
      }))
      useStore.setState({ markups: [...st().markups, ...add] })
      created = add.map((m) => m.id)
    }
    return json({ total, per_sheet: Object.entries(found).map(([id, pts]) => ({ sheet: s.sheets.find((x) => x.id === id)?.label, count: pts.length, centers: pts.slice(0, 200).map((p) => [r1(p.x), r1(p.y)]) })), created: created.length ? created : undefined })
  },

  set_sheet_level(a) {
    const s = st()
    const ids = new Set(((a.sheets as string[]) ?? []).map((r) => sheetOf(r).id))
    useStore.setState({ sheets: s.sheets.map((x) => (ids.has(x.id) ? { ...x, level: String(a.level) } : x)) })
    return json({ ok: true, sheets: ids.size, level: a.level })
  },

  async save_project() {
    const { saveProject } = await import('./project')
    await saveProject()
    return json({ ok: true, path: st().projectPath })
  },
}

export async function runCommand(name: string, args: Args = {}): Promise<CommandResult> {
  const h = HANDLERS[name]
  if (!h) return fail(`Ferramenta desconhecida: ${name}`)
  if (name !== 'get_document' && !st().sheets.length) return fail('Nenhum documento aberto no Traço. Peça ao usuário para abrir um PDF ou projeto.')
  try {
    return await h(args ?? {})
  } catch (e) {
    return fail((e as Error).message)
  }
}

/** Rótulo amigável para mostrar a atividade do Claude no painel. */
export const TOOL_LABEL: Record<string, string> = {
  get_document: 'Leu o resumo do projeto', list_sheets: 'Listou as folhas', get_sheet_image: 'Olhou a folha', get_sheet_text: 'Leu o texto da folha',
  find_text: 'Procurou texto', list_markups: 'Listou marcações', get_quantities: 'Consultou o quantitativo', list_presets: 'Consultou os marcadores',
  upsert_preset: 'Criou/alterou marcador', set_scale: 'Definiu escala', add_markups: 'Criou marcações', update_markups: 'Alterou marcações',
  delete_markups: 'Excluiu marcações', rename_sheets: 'Renomeou folhas', go_to: 'Mostrou a folha', save_project: 'Salvou o projeto',
  fill_area_at: 'Detectou um contorno', find_symbols: 'Contou símbolos', set_sheet_level: 'Definiu o pavimento',
}
