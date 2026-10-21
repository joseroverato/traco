import { useRef, useState } from 'react'
import { ScanText, ArrowDownAZ, Copy, FilePlus2, FileStack, RotateCcw, RotateCw, Scissors, SquareDashedMousePointer, Tags, Trash2, Undo, FileOutput } from 'lucide-react'
import { useStore } from '../store'
import { Thumb } from './Thumb'
import { insertPdf, download } from '../project'
import { PAPER, blankSource, buildPdf, splitToZip } from '../pdfexport'
import { pageText, renderSheet } from '../pdf'
import { desktop } from '../platform'
import { useDialogA11y } from '../dialogA11y'
import type { Markup, Sheet } from '../types'
import { parseRanges } from '../ranges'
import { rotateSheets } from '../sheetOps'
import { LANGS, localeOf, t, useLang } from '../i18n'
import type { Lang } from '../i18n'

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
  const appLang = useLang()
  const [ocrPick, setOcrPick] = useState<Lang | null>(() => {
    try { const v = localStorage.getItem('traco.ocrLang'); return LANGS.some((l) => l.id === v) ? (v as Lang) : null } catch { return null }
  })
  const ocrLang = ocrPick ?? appLang // sem escolha própria, o OCR lê no idioma do app
  const pickOcrLang = (l: Lang) => {
    setOcrPick(l)
    try { localStorage.setItem('traco.ocrLang', l) } catch { /* sem armazenamento: vale só nesta sessão */ }
  }
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
    if (!target.length || target.length === sheets.length) return s.notify(t('pagesview.mantenha_ao_menos_uma_folha'))
    const ids = new Set(target)
    s.setSheets(sheets.filter((x) => !ids.has(x.id)))
    setSel([])
    s.notify(t('pagesview.folha_s_removida_s_ctrl', { size: ids.size }))
  }

  const duplicate = () => {
    if (!target.length) return
    const out: Sheet[] = []
    const extra: Markup[] = []
    const scales = { ...s.scales }
    for (const sh of sheets) {
      out.push(sh)
      if (target.includes(sh.id)) {
        const copy = { ...sh, id: uid(), label: t('pagesview.copia', { label: sh.label }) }
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

  const sortByName = () => s.setSheets([...sheets].sort((a, b) => a.label.localeCompare(b.label, localeOf(), { numeric: true })))
  const reverse = () => s.setSheets([...sheets].reverse())

  const extract = async () => {
    const ids = target.length ? sheets.filter((x) => target.includes(x.id)).map((x) => x.id) : sheets.map((x) => x.id)
    setBusy(t('pagesview.gerando_pdf'))
    try {
      const bytes = await buildPdf({ sheetIds: ids, flatten: false, bookmarks: true, pageLabels: true, removeAnnots: false, meta: true })
      download(bytes, t('pagesview.nome_extraido', { nome: s.fileName.replace(/\.pdf$/i, ''), n: ids.length }), 'application/pdf')
    } finally {
      setBusy(null)
    }
  }

  const runOcr = async () => {
    if (!desktop) return
    const st = await desktop.engine.ocrStatus(ocrLang)
    if (!st.ready && !window.confirm(t('pagesview.ocr_baixar_idioma', { idioma: LANGS.find((l) => l.id === ocrLang)!.name, mb: st.size }))) return
    const list = sheets.filter((x) => (target.length ? target.includes(x.id) : true))
    const ocr = { ...s.ocr }
    try {
      for (const [i, sh] of list.entries()) {
        setBusy(t('pagesview.ocr_progresso', { i: i + 1, total: list.length, label: sh.label }))
        const k = 220 / 72 // ~220 dpi
        const c = await renderSheet(s.sources[sh.src], sh, k)
        const png = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))).arrayBuffer())
        const res = await desktop.engine.ocr(png, ocrLang)
        ocr[sh.id] = { text: res.text, words: res.words.map((w) => ({ ...w, x: w.x / k, y: w.y / k, w: w.w / k, h: w.h / k })) }
      }
      useStore.setState({ ocr })
      s.notify(t('pagesview.ocr_concluido_em_folha_s', { length: list.length }))
    } catch {
      useStore.setState({ ocr }) // o que já foi lido fica
      s.notify(t('pagesview.ocr_sem_internet'))
    } finally {
      setBusy(null)
    }
  }

  const onPdf = async (f: File) => {
    setBusy(t('pagesview.inserindo_pdf'))
    try {
      const n = await insertPdf(f, lastIndex + 1)
      s.notify(t('pagesview.folha_s_inseridas_de', { n, name: f.name }))
    } catch {
      s.notify(t('pagesview.nao_foi_possivel_ler_o'))
    } finally {
      setBusy(null)
    }
  }

  if (!sheets.length) return <div className="pages-view empty"><p className="muted">{t('pagesview.abra_um_pdf_para_gerenciar')}</p></div>

  return (
    <div className="pages-view">
      <div className="pages-toolbar">
        <div className="tb-cluster">
          <span className="sel-count">{selected.length ? t('pagesview.selecionada_s', { length: selected.length }) : t('pagesview.folhas', { length: sheets.length })}</span>
          <button className="btn ghost sm" onClick={() => setSel(selected.length === sheets.length ? [] : sheets.map((x) => x.id))}><SquareDashedMousePointer size={14} /> {selected.length === sheets.length ? t('pagesview.limpar') : t('pagesview.todas')}</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" disabled={!target.length} onClick={() => rotate(-90)} title={t('pagesview.girar_a_esquerda')}><RotateCcw size={14} /></button>
          <button className="btn sm" disabled={!target.length} onClick={() => rotate(90)} title={t('pagesview.girar_a_direita')}><RotateCw size={14} /></button>
          <button className="btn sm" disabled={!target.length} onClick={duplicate}><Copy size={14} /> {t('pagesview.duplicar')}</button>
          <button className="btn sm danger" disabled={!target.length} onClick={remove}><Trash2 size={14} /> {t('pagesview.excluir')}</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" onClick={() => setDlg('blank')}><FilePlus2 size={14} /> {t('pagesview.folha_em_branco')}</button>
          <button className="btn sm" onClick={() => pdfInput.current?.click()}><FileStack size={14} /> {t('pagesview.inserir_pdf')}</button>
          <button className="btn sm" onClick={extract}><FileOutput size={14} /> {target.length ? t('pagesview.extrair_selecao') : t('pagesview.extrair_todas')}</button>
          <button className="btn sm" onClick={() => setDlg('split')}><Scissors size={14} /> {t('pagesview.dividir')}</button>
        </div>
        <div className="tb-cluster">
          <button className="btn sm" onClick={() => setDlg('rename')}><Tags size={14} /> {t('pagesview.renomear')}</button>
          {desktop && <select className="btn sm" value={ocrLang} onChange={(e) => pickOcrLang(e.target.value as Lang)} title={t('pagesview.ocr_idioma')} aria-label={t('pagesview.ocr_idioma')}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
          {desktop && <button className="btn sm" onClick={runOcr} title={t('pagesview.reconhecer_texto_de_pranchas_escaneadas')}><ScanText size={14} /> OCR</button>}
          <button className="btn sm" onClick={sortByName} title={t('pagesview.ordenar_pelo_nome_da_folha')}><ArrowDownAZ size={14} /></button>
          <button className="btn sm" onClick={reverse} title={t('pagesview.inverter_ordem')}><Undo size={14} /></button>
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
                  <span className="page-label" title={t('pagesview.duplo_clique_para_renomear')} onDoubleClick={(e) => { e.stopPropagation(); setEditing(sh.id) }}>{sh.label}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="pages-hint muted small">{t('pagesview.arraste_para_reordenar_ctrl_shift')}</div>

      <input ref={pdfInput} type="file" accept=".pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPdf(f); e.target.value = '' }} />
      {busy && <div className="busy">{busy}</div>}
      {dlg === 'blank' && <BlankDialog after={lastIndex} ref0={sheets[lastIndex]} onClose={() => setDlg(null)} />}
      {dlg === 'rename' && <RenameDialog ids={target.length ? target : sheets.map((x) => x.id)} onClose={() => setDlg(null)} />}
      {dlg === 'split' && <SplitDialog onClose={() => setDlg(null)} setBusy={setBusy} />}
    </div>
  )
}

function Modal({ title, children, onClose, actions }: { title: string; children: React.ReactNode; onClose: () => void; actions: React.ReactNode }) {
  const a11y = useDialogA11y(onClose)
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} {...a11y}>
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
    const add: Sheet[] = Array.from({ length: count }, (_, i) => ({ id: uid(), src: src.id, srcIndex: 0, baseRot: 0, rot: 0, label: t('pagesview.folha_em_branco_2', { v: i + 1 }), width: w, height: h }))
    const st = useStore.getState()
    st.setSheets([...st.sheets.slice(0, after + 1), ...add, ...st.sheets.slice(after + 1)], { sources: { ...st.sources, [src.id]: src } })
    s.notify(t('pagesview.folha_s_em_branco_inserida', { count }))
    onClose()
  }
  return (
    <Modal title={t('pagesview.inserir_folha_em_branco')} onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>{t('pagesview.cancelar')}</button><button className="btn primary" onClick={go}>{t('pagesview.inserir')}</button></>}>
      <div className="row">
        <label className="field"><span>{t('pagesview.tamanho')}</span>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {ref0 && <option value="igual">{t('pagesview.igual_a_folha_selecionada')}</option>}
            {Object.keys(PAPER).map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="field"><span>{t('pagesview.orientacao')}</span>
          <select value={orient} disabled={size === 'igual'} onChange={(e) => setOrient(e.target.value as 'retrato')}>
            <option value="paisagem">{t('pagesview.paisagem')}</option><option value="retrato">{t('pagesview.retrato')}</option>
          </select>
        </label>
        <label className="field"><span>{t('pagesview.quantidade')}</span><input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} /></label>
      </div>
      <p className="muted small">{t('pagesview.sera_inserida_apos_a_ultima')}</p>
    </Modal>
  )
}

function RenameDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const s = useStore()
  const [tab, setTab] = useState<'pattern' | 'detect'>('pattern')
  const [pattern, setPattern] = useState(t('pagesview.padrao_inicial'))
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
        .replace(/\{(?:nome|name|nombre|nom)\}/g, sh.label)
    })
    return out
  }
  const detect = async () => {
    setErr('')
    let re: RegExp
    try {
      re = new RegExp(regex, 'g')
    } catch {
      return setErr(t('pagesview.expressao_invalida'))
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
    s.notify(t('pagesview.folha_s_renomeada_s', { length: Object.keys(result).length }))
    onClose()
  }
  return (
    <Modal title={t('pagesview.renomear_folha_s', { length: order.length })} onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>{t('pagesview.cancelar')}</button><button className="btn primary" disabled={!result} onClick={apply}>{t('pagesview.aplicar')}</button></>}>
      <div className="seg wide">
        <button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}>{t('pagesview.por_padrao')}</button>
        <button className={tab === 'detect' ? 'active' : ''} onClick={() => setTab('detect')}>{t('pagesview.detectar_no_carimbo')}</button>
      </div>
      {tab === 'pattern' ? (
        <div className="row">
          <label className="field grow"><span>{t('pagesview.padrao_numero_n_2_com')}</span><input value={pattern} onChange={(e) => setPattern(e.target.value)} /></label>
          <label className="field" style={{ maxWidth: 80 }}><span>{t('pagesview.inicio')}</span><input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} /></label>
        </div>
      ) : (
        <div className="stack">
          <div className="row">
            <label className="field grow"><span>{t('pagesview.expressao_procurada_no_texto_da')}</span><input className="mono-in" value={regex} onChange={(e) => setRegex(e.target.value)} /></label>
            <button className="btn sm" onClick={detect}>{t('pagesview.detectar')}</button>
          </div>
          {err && <span className="warn">{err}</span>}
          <span className="muted small">{desktop ? t('pagesview.le_o_texto_do_pdf') : t('pagesview.le_o_texto_do_pdf_2')}</span>
        </div>
      )}
      {result && (
        <div className="rename-preview">
          {order.slice(0, 12).map((sh) => (
            <div key={sh.id} className="kv"><span>{sh.label}</span><b>{result[sh.id]}</b></div>
          ))}
          {order.length > 12 && <span className="muted small">{t('pagesview.e_mais', { v: order.length - 12 })}</span>}
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
      for (let i = 0; i < sheets.length; i += every) out.push({ name: t('pagesview.nome_parte', { base, n: out.length + 1 }), ids: sheets.slice(i, i + every).map((x) => x.id) })
      return out
    }
    return parseRanges(ranges, sheets.length).map((g, i) => ({ name: t('pagesview.nome_intervalo', { base, i: i + 1, de: g[0], ate: g[g.length - 1] }), ids: g.map((n) => sheets[n - 1].id) }))
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
      s.notify(t('pagesview.arquivos_gerados', { length: gs.length }))
      onClose()
    } finally {
      setBusy(null)
    }
  }
  let count = 0
  try { count = groups().length } catch { count = 0 }
  return (
    <Modal title={t('pagesview.dividir_em_varios_pdfs')} onClose={onClose} actions={<><button className="btn ghost" onClick={onClose}>{t('pagesview.cancelar')}</button><button className="btn primary" disabled={!count} onClick={go}>{t('pagesview.gerar_arquivo_s', { count })}</button></>}>
      <label className="check"><input type="radio" checked={mode === 'each'} onChange={() => setMode('each')} /> {t('pagesview.uma_folha_por_arquivo_nome')}</label>
      <label className="check"><input type="radio" checked={mode === 'every'} onChange={() => setMode('every')} /> {t('pagesview.a_cada')} <input type="number" min={1} className="inline-num" value={every} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} /> {t('pagesview.folhas_2')}</label>
      <label className="check"><input type="radio" checked={mode === 'ranges'} onChange={() => setMode('ranges')} /> {t('pagesview.por_intervalos')}</label>
      {mode === 'ranges' && <input value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder="1-3, 4-8, 9" />}
      {err && <span className="warn">{err}</span>}
      <label className="check"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> {t('pagesview.incluir_marcacoes')}</label>
    </Modal>
  )
}
