/** Relatório de compatibilização (PDF com recortes e Excel). */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { useStore } from './store'
import { renderSheet } from './pdf'
import { bbox, cloudPath } from './geometry'
import { download } from './project'
import { filtered } from './issues'
import type { ReportFilter } from './issues'
import type { Markup } from './types'
import { fmtDate, t, tPdf } from './i18n'
import { priorityLabel } from './kinds'

const safe = (t: string) => (t ?? '').replace(/[−–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/→/g, '->').replace(/[^\n\x20-\xFF€•…]/g, '?')
const hex = (h: string) => {
  const n = parseInt((h || '#888888').slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = []
  for (const para of safe(text).split('\n')) {
    let line = ''
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(t, size) > width && line) {
        out.push(line)
        line = w
      } else line = t
    }
    out.push(line)
  }
  return out
}

/** Recorte da prancha em volta do item, com o item destacado. */
async function cropImage(m: Markup) {
  const s = useStore.getState()
  const sh = s.sheets.find((x) => x.id === m.page)!
  const b = bbox(m.points)
  const margin = Math.max(60, Math.max(b.w, b.h) * 0.7)
  const r = { x: Math.max(0, b.x - margin), y: Math.max(0, b.y - margin), w: 0, h: 0 }
  r.w = Math.min(sh.width - r.x, b.w + margin * 2)
  r.h = Math.min(sh.height - r.y, b.h + margin * 2)
  const k = Math.min(4, 1100 / Math.max(r.w, r.h))
  const full = await renderSheet(s.sources[sh.src], sh, k)
  const c = document.createElement('canvas')
  c.width = Math.round(r.w * k)
  c.height = Math.round(r.h * k)
  const ctx = c.getContext('2d')!
  ctx.drawImage(full, -r.x * k, -r.y * k)
  ctx.setTransform(k, 0, 0, k, -r.x * k, -r.y * k)
  ctx.lineWidth = 2.2 / k * 1.6
  ctx.strokeStyle = m.color || '#e5484d'
  if (m.kind === 'cloud') ctx.stroke(new Path2D(cloudPath(m.points[0], m.points[1], 9)))
  else if (m.kind === 'ellipse') {
    ctx.beginPath()
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (m.kind === 'line' || m.kind === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(m.points[0].x, m.points[0].y)
    ctx.lineTo(m.points[1].x, m.points[1].y)
    ctx.stroke()
  } else ctx.strokeRect(b.x, b.y, b.w, b.h)
  return c.toDataURL('image/jpeg', 0.86)
}

export async function issuesPdf(f: ReportFilter, onProgress?: (t: string) => void) {
  const s = useStore.getState()
  const items = filtered(f)
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const A4: [number, number] = [595.28, 841.89]
  const M = 42
  let page: PDFPage = doc.addPage(A4)
  let y = A4[1] - M
  const text = (t: string, x: number, size = 9, f2 = font, color = rgb(0.1, 0.1, 0.12)) => page.drawText(safe(t), { x, y, size, font: f2, color })
  const statusColor = (st: string) => hex(s.statuses.find((x) => x.name === st)?.color ?? '#888888')

  // capa / resumo
  text(tPdf('issues.relatorio_titulo'), M, 18, bold)
  y -= 22
  text(s.meta.title || s.fileName.replace(/\.pdf$/i, ''), M, 12, font, rgb(0.3, 0.3, 0.35))
  y -= 16
  text(tPdf('issues.resumo_linha', { data: fmtDate(Date.now(), true), autor: s.meta.author || s.author, n: items.length }), M, 9, font, rgb(0.45, 0.45, 0.5))
  y -= 26
  const by = (key: (m: Markup) => string) => {
    const mp = new Map<string, number>()
    items.forEach(({ m }) => mp.set(key(m) || '—', (mp.get(key(m) || '—') ?? 0) + 1))
    return [...mp.entries()]
  }
  for (const [title, rows] of [[tPdf('issues.por_status'), by((m) => m.status)], [tPdf('issues.por_responsavel'), by((m) => m.assignee ?? '')]] as const) {
    text(title, M, 10, bold)
    y -= 14
    for (const [k, n] of rows) {
      text(`${k}`, M + 8, 9)
      text(String(n), M + 220, 9, bold)
      y -= 12
    }
    y -= 10
  }
  page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: rgb(0.8, 0.8, 0.82) })
  y -= 18

  for (const [i, { m, no }] of items.entries()) {
    onProgress?.(t('issues.progresso', { i: i + 1, total: items.length }))
    const sh = s.sheets.find((x) => x.id === m.page)
    const img = await doc.embedJpg(Uint8Array.from(atob((await cropImage(m)).split(',')[1]), (c) => c.charCodeAt(0)))
    const iw = 250, ih = Math.min(220, (img.height / img.width) * iw)
    const desc = [m.text, m.comment].filter(Boolean).join('\n') || tPdf('issues.sem_descricao')
    const lines = wrap(desc, font, 9, A4[0] - M * 2 - iw - 16)
    const replies = (m.replies ?? []).flatMap((r) => wrap(`${r.author} (${fmtDate(r.at, true)}): ${r.text}`, font, 8, A4[0] - M * 2 - iw - 16))
    const need = Math.max(ih, 62 + lines.length * 11 + (replies.length ? 16 + replies.length * 10 : 0)) + 34
    if (y - need < M) {
      page = doc.addPage(A4)
      y = A4[1] - M
    }
    // cabeçalho do item
    page.drawRectangle({ x: M, y: y - 16, width: A4[0] - M * 2, height: 20, color: rgb(0.95, 0.95, 0.96) })
    page.drawRectangle({ x: M, y: y - 16, width: 4, height: 20, color: statusColor(m.status) })
    y -= 10
    text(tPdf('issues.item', { n: String(no).padStart(2, '0') }), M + 10, 10, bold)
    text(`${sh?.label ?? ''}`, M + 80, 9)
    const st = safe(m.status.toUpperCase())
    page.drawText(st, { x: A4[0] - M - 8 - bold.widthOfTextAtSize(st, 8), y, size: 8, font: bold, color: statusColor(m.status) })
    y -= 18
    const top = y
    page.drawImage(img, { x: M, y: y - ih, width: iw, height: ih })
    page.drawRectangle({ x: M, y: y - ih, width: iw, height: ih, borderColor: rgb(0.85, 0.85, 0.87), borderWidth: 0.6 })
    const x2 = M + iw + 16
    const field = (k: string, v: string) => {
      page.drawText(safe(k), { x: x2, y, size: 7.5, font: bold, color: rgb(0.45, 0.45, 0.5) })
      page.drawText(safe(v || '—'), { x: x2 + 70, y, size: 9, font })
      y -= 13
    }
    field(tPdf('issues.responsavel'), m.assignee ?? '')
    field(tPdf('issues.prioridade'), m.priority ? priorityLabel(m.priority, true) : '')
    field(tPdf('issues.prazo'), m.due ? fmtDate(m.due + 'T12:00', true) : '')
    field(tPdf('issues.aberto_por'), `${m.author} · ${fmtDate(m.createdAt, true)}`)
    y -= 4
    page.drawText(safe(tPdf('issues.descricao')), { x: x2, y, size: 7.5, font: bold, color: rgb(0.45, 0.45, 0.5) })
    y -= 12
    for (const l of lines) {
      page.drawText(l, { x: x2, y, size: 9, font })
      y -= 11
    }
    if (replies.length) {
      y -= 4
      page.drawText(safe(tPdf('issues.respostas')), { x: x2, y, size: 7.5, font: bold, color: rgb(0.45, 0.45, 0.5) })
      y -= 11
      for (const l of replies) {
        page.drawText(l, { x: x2, y, size: 8, font, color: rgb(0.25, 0.25, 0.3) })
        y -= 10
      }
    }
    y = Math.min(y, top - ih) - 22
  }
  // rodapé com numeração
  const pages = doc.getPages()
  pages.forEach((p, i) => p.drawText(safe(tPdf('issues.rodape', { i: i + 1, total: pages.length })), { x: M, y: 22, size: 7, font, color: rgb(0.55, 0.55, 0.6) }))
  doc.setTitle(tPdf('issues.titulo_pdf'))
  doc.setProducer('Traço')
  const bytes = await doc.save()
  return download(bytes, `${(s.meta.title || s.fileName.replace(/\.pdf$/i, '')).replace(/[\\/:*?"<>|]/g, '_')} - ${t('issues.sufixo_arquivo')}.pdf`, 'application/pdf')
}

export async function issuesXlsx(f: ReportFilter) {
  const XLSX = await import('xlsx')
  const s = useStore.getState()
  const rows = filtered(f).map(({ m, no }) => ({
    [t('issues.x_item')]: no, [t('issues.x_folha')]: s.sheets.find((x) => x.id === m.page)?.label ?? '', [t('issues.x_status')]: m.status, [t('issues.x_responsavel')]: m.assignee ?? '', [t('issues.x_prioridade')]: m.priority ? priorityLabel(m.priority) : '',
    [t('issues.x_prazo')]: m.due ?? '', [t('issues.x_descricao')]: [m.text, m.comment].filter(Boolean).join(' — '), [t('issues.x_respostas')]: (m.replies ?? []).map((r) => `${r.author}: ${r.text}`).join(' | '),
    [t('issues.x_autor')]: m.author, [t('issues.x_data')]: fmtDate(m.createdAt),
  }))
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [6, 14, 12, 18, 10, 11, 60, 50, 12, 11].map((w) => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, t('issues.aba_itens'))
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return download(out, `${s.fileName.replace(/\.pdf$/i, '')} - ${t('issues.sufixo_arquivo')}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}
