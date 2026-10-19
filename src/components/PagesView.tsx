import { useRef, useState } from 'react'
import { ScanText, ArrowDownAZ, Copy, FilePlus2, FileStack, RotateCcw, RotateCw, Scissors, SquareDashedMousePointer, Tags, Trash2, Undo, FileOutput } from 'lucide-react'
import { useStore } from '../store'
import { Thumb } from './Thumb'
import { insertPdf, download } from '../project'
import { PAPER, blankSource, buildPdf, splitToZip } from '../pdfexport'
import { pageText, renderSheet } from '../pdf'
import { desktop } from '../platform'
import type { Markup, Sheet } from '../types'
import { parseRanges } from '../ranges'
import { rotateSheets } from '../sheetOps'

const uid = () => Math.random().toString(36).slice(2, 10)

export function PagesView() {
  const s = useStore()
  const [sel, setSel] = useState<string[]>([])
  const [anchor, setAnchor] = useState<string | null>(null)
  const [dragIds, setDragIds] = useState<string[] | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [dlg, setDlg] = useState<null | 'rename' | 'split' | 'blank'>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const sheets = s.sheets
  const selected = sel.filter((id) => sheets.some((x) => x.id === id))
  const target = selected.length ? selected : []
  const lastIndex = selected.length ? Math.max(...selected.map((id) => sheets.findIndex((x) => x.id === id))) : sheets.length - 1

  const click = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && anchor) {
      const a = sheets.findIndex((x) => x.id === anchor), b = sheets.findIndex((x) => x.id === id)
      const [lo, hi] = a < b ? [a, b] : [b, a]
      setSel(sheets.slice(lo, hi + 1).map((x) => x.id))
    } else if (e.ctrlKey || e.metaKey) {
      setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])
      setAnchor(id)
    } else {
      setSel([id])
      setAnchor(id)
    }
  }

  const rotate = (dir: 90 | -90) => {
    if (target.length) rotateSheets(target, dir)
  }

  const remove = () => {
    if (!target.length || target.length === sheets.length) return s.notify('Mantenha ao menos uma folha')
    const ids = new Set(target)
    s.setSheets(sheets.filter((x) => !ids.has(x.id)))
    setSel([])
    s.notify(`${ids.size} folha(s) removida(s) — Ctrl+Z desfaz`)
  }

  const duplicate = () => {
    if (!target.length) return
    const out: Sheet[] = []
    const extra: Markup[] = []
    const scales = { ...s.scales }
    for (const sh of sheets) {
      out.push(sh)
      if (target.includes(sh.id)) {
        const copy = { ...sh, id: uid(), label: `${sh.label} (cópia)` }
        out.push(copy)
        if (s.scales[sh.id]) scales[copy.id] = s.scales[sh.id]
        s.markups.filter((m) => m.page === sh.id).forEach((m) => extra.push({ ...m, id: uid(), page: copy.id }))
      }
    }
    s.setSheets(out, { markups: [...s.markups, ...extra], scales })
  }

  const move = (ids: string[], at: number) => {
    const moving = sheets.filter((x) => ids.includes(x.id))
    const rest = sheets.filter((x) => !ids.includes(x.id))
    const before = sheets.slice(0, at).filter((x) => !ids.includes(x.id)).length
    s.setSheets([...rest.slice(0, before), ...moving, ...rest.slice(before)])
  }

  const sortByName = () => s.setSheets([...sheets].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true })))
  const reverse = () => s.setSheets([...sheets].reverse())

  const extract = async () => {
    const ids = target.length ? sheets.filter((x) => target.includes(x.id)).map((x) => x.id) : sheets.map((x) => x.id)
    setBusy('Gerando PDF…')
    try {
      const bytes = await buildPdf({ sheetIds: ids, flatten: false, bookmarks: true, pageLabels: true, removeAnnots: false, meta: true })
      download(bytes, `${s.fileName.replace(/\.pdf$/i, '')} - extraído (${ids.length} folhas).pdf`, 'application/pdf')
    } finally {
      setBusy(null)
    }
  }

  const runOcr = async () => {
    if (!desktop) return
    const list = sheets.filter((x) => (target.length ? target.includes(x.id) : true))
    const ocr = { ...s.ocr }
    for (const [i, sh] of list.entries()) {
      setBusy(`OCR ${i + 1}/${list.length} — ${sh.label}…`)
      const k = 220 / 72 // ~220 dpi
      const c = await renderSheet(s.sources[sh.src], sh, k)
      const png = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))).arrayBuffer())
      const res = await desktop.engine.ocr(png)
      ocr[sh.id] = { text: res.text, words: res.words.map((w) => ({ ...w, x: w.x / k, y: w.y / k, w: w.w / k, h: w.h / k })) }
    }
    useStore.setState({ ocr })
    setBusy(null)
    s.notify(`OCR concluído em ${list.length} folha(s) — texto disponível para busca, renomear e Claude`)
  }

  const onPdf = async (f: File) => {
    setBusy('Inserindo PDF…')
    try {
      const n = await insertPdf(f, lastIndex + 1)
      s.notify(`${n} folha(s) inseridas de ${f.name}`)
    } catch {
      s.notify('Não foi possível ler o PDF')
    } finally {
      setBusy(null)
    }
  }

  if (!sheets.length) return <div className="pages-view empty"><p className="muted">Abra um PDF para gerenciar as pranchas.</p></div>

  return (
    <div className="pages-view">
      <div className="pages-toolbar">
        <div className="tb-cluster">
          <span className="sel-count">{selected.length ? `${selected.length} selecionada(s)` : `${sheets.length} folhas`}</span>
          <button className="btn ghost sm" onClick={() => setSel(selected.length === sheets.length ? [] : sheets.map((x) => x.id))}><SquareDashedMousePointer size={14} /> {selected.length === sheets.length ? 'Limpar' : 'Todas'}</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" disabled={!target.length} onClick={() => rotate(-90)} title="Girar à esquerda"><RotateCcw size={14} /></button>
          <button className="btn sm" disabled={!target.length} onClick={() => rotate(90)} title="Girar à direita"><RotateCw size={14} /></button>
          <button className="btn sm" disabled={!target.length} onClick={duplicate}><Copy size={14} /> Duplicar</button>
          <button className="btn sm danger" disabled={!target.length} onClick={remove}><Trash2 size={14} /> Excluir</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" onClick={() => setDlg('blank')}><FilePlus2 size={14} /> Folha em branco</button>
          <button className="btn sm" onClick={() => pdfInput.current?.click()}><FileStack size={14} /> Inserir PDF</button>
          <button className="btn sm" onClick={extract}><FileOutput size={14} /> {target.length ? 'Extrair seleção' : 'Extrair todas'}</button>
          <button className="btn sm" onClick={() => setDlg('split')}><Scissors size={14} /> Dividir</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" onClick={() => setDlg('rename')}><Tags size={14} /> Renomear</button>
          {desktop && <button className="btn sm" onClick={runOcr} title="Reconhecer texto de pranchas escaneadas (português)"><ScanText size={14} /> OCR</button>}
          <button className="btn sm" onClick={sortByName} title="Ordenar pelo nome da folha"><ArrowDownAZ size={14} /></button>
          <button className="btn sm" onClick={reverse} title="Inverter ordem"><Undo size={14} /></button>
        </div>
      </div>

      <div className="pages-grid" onClick={(e) => e.target === e.currentTarget && setSel([])}>
        {sheets.map((sh, i) => {
          const isSel = selected.includes(sh.id)
          const n = s.markups.filter((m) => m.page === sh.id).length
          return (
            <div
              key={sh.id}
              className={`page-card ${isSel ? 'sel' : ''} ${dragIds?.includes(sh.id) ? 'dragging' : ''} ${dropAt === i ? 'drop-before' : ''} ${dropAt === i + 1 && i === sheets.length - 1 ? 'drop-after' : ''}`}
              draggable
              onDragStart={(e) => {
                const ids = isSel ? selected : [sh.id]
                setDragIds(ids)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', ids.join(','))
              }}
              onDragOver={(e) => {
                if (!dragIds) return
                e.preventDefault()
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                setDropAt(e.clientX < r.left + r.width / 2 ? i : i + 1)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIds && dropAt !== null) move(dragIds, dropAt)
                setDragIds(null)
                setDropAt(null)
              }}
              onDragEnd={() => {
                setDragIds(null)
                setDropAt(null)
              }}
              onClick={(e) => click(e, sh.id)}
              onDoubleClick={() => s.set({ mode: 'review', page: i })}
            >
              <div className="page-thumb">
                <Thumb sheet={sh} width={200} />
                {n > 0 && <span className="chip accent corner">{n}</span>}
                {sh.rot !== 0 && <span className="chip corner-l">{sh.rot}°</span>}
              </div>
              <div className="page-meta">
                <span className="page-no">{i + 1}</span>
                {editing === sh.id ? (
                  <input
                    autoFocus
                    defaultValue={sh.label}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== sh.label) s.setSheets(sheets.map((x) => (x.id === sh.id ? { ...x, label: v } : x)))
                      setEditing(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <span className="page-label" title="Duplo clique para renomear" onDoubleClick={(e) => { e.stopPropagation(); setEditing(sh.id) }}>{sh.label}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="pages-hint muted small">Arraste para reordenar · Ctrl/Shift seleciona várias · duplo clique na folha abre para revisar · duplo clique no nome renomeia</div>

      <input ref={pdfInput} type="file" accept=".pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = '' }} />
      {busy && <div className="busy">{busy}</div>}
      {dlg === 'blank' && <BlankDialog after={lastIndex} ref0={sheets[lastIndex]} onClose={() => setDlg(null)} />}
      {dlg === 'rename' && <RenameDialog ids={target.length ? target : sheets.map((x) => x.id)} onClose={() => setDlg(null)} />}
      {dlg === 'split' && <SplitDialog onClose={() => setDlg(null)} setBusy={setBusy} />}
    </div>
  )
}

function Modal({ title, children, onClose, actions }: { title: string; children: React.ReactNode; onClose: () => void; actions: React.ReactNode }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

function BlankDialog({ after, ref0, onClose }: { after: number; ref0?: Sheet; onClose: () => void }) {
  const s = useStore()
  const [size, setSize] = useState(ref0 ? 'igual' : 'A4')
  const [orient, setOrient] = useState<'retrato' | 'paisagem'>('paisagem')
  const [count, setCount] = useState(1)
  const go = async () => {
    let [w, h] = size === 'igual' && ref0 ? [ref0.width, ref0.height] : PAPER[size]
    if (size !== 'igual' && (orient === 'paisagem') !== w > h) [w, h] = [h, w]
    const src = await blankSource(w, h)
    const add: Sheet[] = Array.from({ length: count }, (_, i) => ({ id: uid(), src: src.id, srcIndex: 0, baseRot: 0, rot: 0, label: `Folha em branco ${i + 1}`, width: w, height: h }))
    const st = useStore.getState()
    st.setSheets([...st.sheets.slice(0, after + 1), ...add, ...st.sheets.slice(after + 1)], { sources: { ...st.sources, [src.id]: src } })
    s.notify(`${count} folha(s) em branco inserida(s)`)
    onClose()
  }
  return (
    <Modal title="Inserir folha em branco" onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={go}>Inserir</button></>}>
      <div className="row">
        <label className="field"><span>Tamanho</span>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {ref0 && <option value="igual">Igual à folha selecionada</option>}
            {Object.keys(PAPER).map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="field"><span>Orientação</span>
          <select value={orient} disabled={size === 'igual'} onChange={(e) => setOrient(e.target.value as 'retrato')}>
            <option value="paisagem">Paisagem</option><option value="retrato">Retrato</option>
          </select>
        </label>
        <label className="field"><span>Quantidade</span><input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} /></label>
      </div>
      <p className="muted small">Será inserida após a última folha selecionada. Útil para capa, folha de observações ou croquis.</p>
    </Modal>
  )
}

function RenameDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const s = useStore()
  const [tab, setTab] = useState<'pattern' | 'detect'>('pattern')
  const [pattern, setPattern] = useState('ARQ-{n:2}')
  const [start, setStart] = useState(1)
  const [regex, setRegex] = useState('[A-Z]{2,4}[-_ ]?\\d{2,3}')
  const [preview, setPreview] = useState<Record<string, string> | null>(null)
  const [err, setErr] = useState('')
  const order = s.sheets.filter((x) => ids.includes(x.id))

  const fromPattern = () => {
    const out: Record<string, string> = {}
    order.forEach((sh, i) => {
      const n = start + i
      out[sh.id] = pattern
        .replace(/\{n:(\d)\}/g, (_, d) => String(n).padStart(Number(d), '0'))
        .replace(/\{n\}/g, String(n))
        .replace(/\{nome\}/g, sh.label)
    })
    return out
  }
  const detect = async () => {
    setErr('')
    let re: RegExp
    try {
      re = new RegExp(regex, 'g')
    } catch {
      return setErr('Expressão inválida')
    }
    const out: Record<string, string> = {}
    for (const sh of order) {
      let txt = await pageText(s.sources[sh.src], sh.srcIndex)
      if (!txt.trim() && s.ocr[sh.id]) txt = s.ocr[sh.id].text // prancha escaneada: usa o OCR
      const all = txt.match(re)
      // o carimbo costuma ficar no fim do conteúdo: usa a última ocorrência
      out[sh.id] = all?.length ? all[all.length - 1].trim() : sh.label
    }
    setPreview(out)
  }
  const result = tab === 'pattern' ? fromPattern() : preview
  const apply = () => {
    if (!result) return
    s.setSheets(s.sheets.map((x) => (result[x.id] ? { ...x, label: result[x.id] } : x)))
    s.notify(`${Object.keys(result).length} folha(s) renomeada(s)`)
    onClose()
  }
  return (
    <Modal title={`Renomear ${order.length} folha(s)`} onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!result} onClick={apply}>Aplicar</button></>}>
      <div className="seg wide">
        <button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}>Por padrão</button>
        <button className={tab === 'detect' ? 'active' : ''} onClick={() => setTab('detect')}>Detectar no carimbo</button>
      </div>
      {tab === 'pattern' ? (
        <div className="row">
          <label className="field grow"><span>Padrão — {'{n}'} número, {'{n:2}'} com zeros, {'{nome}'} nome atual</span><input value={pattern} onChange={(e) => setPattern(e.target.value)} /></label>
          <label className="field" style={{ maxWidth: 80 }}><span>Início</span><input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} /></label>
        </div>
      ) : (
        <div className="stack">
          <div className="row">
            <label className="field grow"><span>Expressão procurada no texto da folha</span><input className="mono-in" value={regex} onChange={(e) => setRegex(e.target.value)} /></label>
            <button className="btn sm" onClick={detect}>Detectar</button>
          </div>
          {err && <span className="warn">{err}</span>}
          <span className="muted small">{desktop ? 'Lê o texto do PDF; em pranchas escaneadas, rode o OCR antes (botão OCR).' : 'Lê o texto do PDF (pranchas escaneadas precisam do OCR do app de PC).'}</span>
        </div>
      )}
      {result && (
        <div className="rename-preview">
          {order.slice(0, 12).map((sh) => (
            <div key={sh.id} className="kv"><span>{sh.label}</span><b>{result[sh.id]}</b></div>
          ))}
          {order.length > 12 && <span className="muted small">… e mais {order.length - 12}</span>}
        </div>
      )}
    </Modal>
  )
}

function SplitDialog({ onClose, setBusy }: { onClose: () => void; setBusy: (b: string | null) => void }) {
  const s = useStore()
  const [mode, setMode] = useState<'each' | 'every' | 'ranges'>('every')
  const [every, setEvery] = useState(5)
  const [ranges, setRanges] = useState('1-3, 4-6')
  const [flatten, setFlatten] = useState(true)
  const [err, setErr] = useState('')
  const sheets = s.sheets
  const groups = (): { name: string; ids: string[] }[] => {
    const base = s.fileName.replace(/\.pdf$/i, '') || 'traco'
    if (mode === 'each') return sheets.map((x, i) => ({ name: `${String(i + 1).padStart(2, '0')} - ${x.label.replace(/[\\/:*?"<>|]/g, '_')}`, ids: [x.id] }))
    if (mode === 'every') {
      const out = []
      for (let i = 0; i < sheets.length; i += every) out.push({ name: `${base} - parte ${out.length + 1}`, ids: sheets.slice(i, i + every).map((x) => x.id) })
      return out
    }
    return parseRanges(ranges, sheets.length).map((g, i) => ({ name: `${base} - ${i + 1} (folhas ${g[0]}-${g[g.length - 1]})`, ids: g.map((n) => sheets[n - 1].id) }))
  }
  const go = async () => {
    setErr('')
    let gs
    try {
      gs = groups()
    } catch (e) {
      return setErr((e as Error).message)
    }
    setBusy('Dividindo…')
    try {
      const zip = await splitToZip(gs, { flatten, bookmarks: true, pageLabels: true, removeAnnots: false, meta: true })
      download(zip, `${s.fileName.replace(/\.pdf$/i, '')} - dividido.zip`, 'application/zip')
      s.notify(`${gs.length} arquivos gerados`)
      onClose()
    } finally {
      setBusy(null)
    }
  }
  let count = 0
  try { count = groups().length } catch { count = 0 }
  return (
    <Modal title="Dividir em vários PDFs" onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!count} onClick={go}>Gerar {count} arquivo(s)</button></>}>
      <label className="check"><input type="radio" checked={mode === 'each'} onChange={() => setMode('each')} /> Uma folha por arquivo (nome = nome da folha)</label>
      <label className="check"><input type="radio" checked={mode === 'every'} onChange={() => setMode('every')} /> A cada <input type="number" min={1} className="inline-num" value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} /> folhas</label>
      <label className="check"><input type="radio" checked={mode === 'ranges'} onChange={() => setMode('ranges')} /> Por intervalos</label>
      {mode === 'ranges' && <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-8, 9" />}
      {err && <span className="warn">{err}</span>}
      <label className="check"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> Incluir marcações</label>
    </Modal>
  )
}
