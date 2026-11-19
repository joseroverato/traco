import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { download } from '../project'
import { PAPER, blankSource, splitToZip } from '../pdfexport'
import { pageText } from '../pdf'
import { desktop } from '../platform'
import type { Sheet } from '../types'
import { parseRanges } from '../ranges'
import { t, tp } from '../i18n'
import { Chk, DTabs, Dlg, Rad } from './Dlg'
import { SelectCb } from './pal/SelectCb'

const uid = () => Math.random().toString(36).slice(2, 10)

/** Os diálogos entram direto no body: a coluna do Pranchas tem transição de vista e prenderia o véu dentro dela. */
const onBody = (node: React.ReactNode) => createPortal(node, document.body)

/** Inserir folha em branco: tamanho, orientação e quantidade. A folha entra depois da última selecionada. */
export function BlankDialog({ after, ref0, onClose }: { after: number; ref0?: Sheet; onClose: () => void }) {
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
    s.notify(tp('pagesview.em_branco_inseridas', count))
    onClose()
  }
  return onBody(
    <Dlg
      title={t('pagesview.inserir_folha_em_branco')}
      onClose={onClose}
      width={520}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') void go() }}
      footer={<><button type="button" className="btn" onClick={onClose}>{t('pagesview.cancelar')}</button><button type="button" className="btn pri" onClick={() => void go()}>{t('pagesview.inserir')}</button></>}
    >
      <div className="row3">
        <div className="fv" style={{ flex: '1 1 auto' }}>
          <span>{t('pagesview.tamanho')}</span>
          <SelectCb value={size} onChange={setSize} label={t('pagesview.tamanho')} current={size === 'igual' ? t('pagesview.igual_a_folha_selecionada') : size}>
            {ref0 && <option value="igual">{t('pagesview.igual_a_folha_selecionada')}</option>}
            {Object.keys(PAPER).map((k) => <option key={k} value={k}>{k}</option>)}
          </SelectCb>
        </div>
        <div className="fv" style={{ width: 130 }}>
          <span>{t('pagesview.orientacao')}</span>
          <SelectCb value={orient} onChange={(v) => setOrient(v as 'retrato')} label={t('pagesview.orientacao')} disabled={size === 'igual'} current={orient === 'paisagem' ? t('pagesview.paisagem') : t('pagesview.retrato')}>
            <option value="paisagem">{t('pagesview.paisagem')}</option><option value="retrato">{t('pagesview.retrato')}</option>
          </SelectCb>
        </div>
        <label className="fv" style={{ width: 90 }}>
          <span>{t('pagesview.quantidade')}</span>
          <input className="in n" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value))))} />
        </label>
      </div>
      <p className="nt">{t('pagesview.sera_inserida_apos_a_ultima')}</p>
    </Dlg>,
  )
}

/** Renomear folhas: por padrão ({n}, {n:2}, {nome}) ou detectando o código no texto do carimbo. */
export function RenameDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
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
    s.notify(tp('pagesview.renomeadas', Object.keys(result).length))
    onClose()
  }
  return onBody(
    <Dlg
      title={tp('pagesview.renomear_folhas', order.length)}
      onClose={onClose}
      width={560}
      tabs={<DTabs label={t('pagesview.renomear')} value={tab} onChange={setTab} tabs={[{ id: 'pattern', label: t('pagesview.por_padrao') }, { id: 'detect', label: t('pagesview.detectar_no_carimbo') }]} />}
      footer={<><button type="button" className="btn" onClick={onClose}>{t('pagesview.cancelar')}</button><button type="button" className="btn pri" disabled={!result} onClick={apply}>{t('pagesview.aplicar')}</button></>}
    >
      {tab === 'pattern' ? (
        <div className="row3">
          <label className="fv" style={{ flex: '1 1 auto' }}><span>{t('pagesview.padrao_numero_n_2_com')}</span><input className="in mono" value={pattern} onChange={(e) => setPattern(e.target.value)} /></label>
          <label className="fv" style={{ width: 80 }}><span>{t('pagesview.inicio')}</span><input className="in n" type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} /></label>
        </div>
      ) : (
        <>
          <div className="row3">
            <label className="fv" style={{ flex: '1 1 auto' }}><span>{t('pagesview.expressao_procurada_no_texto_da')}</span><input className="in mono" value={regex} onChange={(e) => setRegex(e.target.value)} /></label>
            <button type="button" className="btn sm" onClick={() => void detect()}>{t('pagesview.detectar')}</button>
          </div>
          {err && <p className="warnl" role="alert">{err}</p>}
          <p className="nt">{desktop ? t('pagesview.le_o_texto_do_pdf') : t('pagesview.le_o_texto_do_pdf_2')}</p>
        </>
      )}
      {result && (
        <div className="rnp" aria-label={t('pagesview.novo_nome')}>
          <div className="kv h"><span>{t('pagesview.nome_atual')}</span><span>{t('pagesview.novo_nome')}</span></div>
          {order.slice(0, 12).map((sh) => (
            <div key={sh.id} className="kv"><span>{sh.label}</span><b className="n">{result[sh.id]}</b></div>
          ))}
          {order.length > 12 && <div className="mais">{t('pagesview.e_mais', { v: order.length - 12 })}</div>}
        </div>
      )}
    </Dlg>,
  )
}

/** Dividir em vários PDFs: uma folha por arquivo, a cada N folhas ou por intervalos. */
export function SplitDialog({ onClose, setBusy }: { onClose: () => void; setBusy: (b: string | null) => void }) {
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
  return onBody(
    <Dlg
      title={t('pagesview.dividir_em_varios_pdfs')}
      onClose={onClose}
      width={440}
      footer={<><button type="button" className="btn" onClick={onClose}>{t('pagesview.cancelar')}</button><button type="button" className="btn pri" disabled={!count} onClick={() => void go()}>{tp('pagesview.gerar_arquivos', count)}</button></>}
    >
      <Rad name="split-mode" checked={mode === 'each'} onChange={() => setMode('each')}>{t('pagesview.uma_folha_por_arquivo_nome')}</Rad>
      <div className="opc">
        <Rad name="split-mode" checked={mode === 'every'} onChange={() => setMode('every')}>{t('pagesview.a_cada')}</Rad>
        <input className="in inl n" type="number" min={1} value={every} disabled={mode !== 'every'} aria-label={t('pagesview.folhas_por_arquivo')} onChange={(e) => setEvery(Math.max(1, Number(e.target.value)))} />
        <span>{t('pagesview.folhas_2')}</span>
      </div>
      <Rad name="split-mode" checked={mode === 'ranges'} onChange={() => setMode('ranges')}>{t('pagesview.por_intervalos')}</Rad>
      <input className="in ind" value={ranges} disabled={mode !== 'ranges'} aria-label={t('pagesview.por_intervalos')} placeholder="1-3, 4-8, 9" onChange={(e) => setRanges(e.target.value)} />
      {err && <p className="warnl" role="alert">{err}</p>}
      <Chk checked={flatten} onChange={setFlatten}>{t('pagesview.incluir_marcacoes')}</Chk>
    </Dlg>,
  )
}
