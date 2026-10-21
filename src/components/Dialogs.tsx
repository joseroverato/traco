import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { defaultStatuses, uid, useStore } from '../store'
import { exportPdf } from '../pdfexport'
import { IS_DESKTOP, desktop } from '../platform'
import type { UpdateState } from '../platform'
import { clearRecovery, readRecoveryInfo, restoreRecovery } from '../autosave'
import type { RecoveryInfo } from '../autosave'
import { download } from '../project'
import { parseRanges } from '../ranges'
import type { CustomColumn, Markup, StatusDef } from '../types'
import { clearBase, importPriceFile, loadBase } from '../sinapi'
import type { PriceBase } from '../sinapi'
import { checkFormula } from '../formula'
import { startTour } from '../tour'
import { APP_VERSION, REPO_URL, THIRD_PARTY, releaseUrl, releasesUrl } from '../about'
import { LANGS, localeOf, setLang, t, useLang } from '../i18n'
import type { Lang } from '../i18n'
import { Rich } from './Rich'
import { stampText } from '../geometry'
import { TOOLS } from '../railTools'
import { hasCustomKeys, resetKeys, setKey, useKeymap, validKey } from '../hotkeys'
import { copyDiagnostic } from '../diagnostics'
import { setUnits, useUnits } from '../units'
import type { UnitSystem } from '../units'
import { useDialogA11y } from '../dialogA11y'

function Modal({ title, children, onClose, actions, wide }: { title: string; children: React.ReactNode; onClose: () => void; actions: React.ReactNode; wide?: boolean }) {
  const a11y = useDialogA11y(onClose)
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()} {...a11y}>
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

const close = () => useStore.setState({ dialog: null })

function useRange() {
  const s = useStore()
  const [scope, setScope] = useState<'all' | 'current' | 'ranges'>('all')
  const [ranges, setRanges] = useState('')
  const ids = (): string[] => {
    if (scope === 'all') return s.sheets.map((x) => x.id)
    if (scope === 'current') return [s.sheets[s.page].id]
    return parseRanges(ranges, s.sheets.length).flat().map((n) => s.sheets[n - 1].id)
  }
  const ui = (
    <div className="stack tight">
      <div className="seg wide">
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>{t('dialogs.todas', { length: s.sheets.length })}</button>
        <button className={scope === 'current' ? 'active' : ''} onClick={() => setScope('current')}>{t('dialogs.folha_atual')}</button>
        <button className={scope === 'ranges' ? 'active' : ''} onClick={() => setScope('ranges')}>{t('dialogs.intervalo')}</button>
      </div>
      {scope === 'ranges' && <input placeholder="ex.: 1-3, 7, 10-12" value={ranges} onChange={(e) => setRanges(e.target.value)} />}
    </div>
  )
  return { ids, ui }
}

// ---------------------------------------------------------------- Exportar PDF
export function ExportDialog() {
  const s = useStore()
  const range = useRange()
  const [flatten, setFlatten] = useState(true)
  const [bookmarks, setBookmarks] = useState(true)
  const [pageLabels, setPageLabels] = useState(true)
  const [removeAnnots, setRemoveAnnots] = useState(false)
  const [optimize, setOptimize] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const meta = s.meta
  const setMeta = (p: Partial<typeof meta>) => s.set({ meta: { ...meta, ...p } })
  const go = async () => {
    setErr('')
    let ids: string[]
    try {
      ids = range.ids()
    } catch (e) {
      return setErr((e as Error).message)
    }
    setBusy(true)
    try {
      const bytes = await exportPdf({ sheetIds: ids, flatten, bookmarks, pageLabels, removeAnnots, meta: true, optimize })
      await download(bytes, `${(meta.title || s.fileName.replace(/\.pdf$/i, '')).replace(/[\\/:*?"<>|]/g, '_')}${flatten ? ' - revisado' : ''}.pdf`, 'application/pdf')
      s.notify(t('dialogs.pdf_exportado_com_folha_s', { length: ids.length }))
      close()
    } catch (e) {
      console.error(e)
      setErr(t('dialogs.falha_ao_gerar_o_pdf', { erro: (e as Error).message }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={t('dialogs.exportar_pdf')} wide onClose={close} actions={<><button className="btn ghost" onClick={close}>{t('dialogs.cancelar')}</button><button className="btn primary" disabled={busy} onClick={go}>{busy ? t('dialogs.gerando') : t('dialogs.exportar')}</button></>}>
      <div className="two-col">
        <div className="stack">
          <span className="section-label">{t('dialogs.folhas')}</span>
          {range.ui}
          <span className="section-label">{t('dialogs.conteudo')}</span>
          <label className="check"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> {t('dialogs.gravar_marcacoes_carimbos_e_imagens')}</label>
          <label className="check"><input type="checkbox" checked={bookmarks} onChange={(e) => setBookmarks(e.target.checked)} /> {t('dialogs.criar_indice_de_folhas_marcadores')}</label>
          <label className="check"><input type="checkbox" checked={pageLabels} onChange={(e) => setPageLabels(e.target.checked)} /> {t('dialogs.numerar_paginas_com_o_nome')}</label>
          <label className="check"><input type="checkbox" checked={removeAnnots} onChange={(e) => setRemoveAnnots(e.target.checked)} /> {t('dialogs.remover_anotacoes_que_vieram_no')}</label>
          <label className="check"><input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} /> {t('dialogs.otimizar_tamanho_do_arquivo')}</label>
        </div>
        <div className="stack">
          <span className="section-label">{t('dialogs.metadados')}</span>
          <label className="field"><span>{t('dialogs.titulo')}</span><input value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} /></label>
          <label className="field"><span>{t('dialogs.autor')}</span><input value={meta.author} placeholder={s.author} onChange={(e) => setMeta({ author: e.target.value })} /></label>
          <label className="field"><span>{t('dialogs.assunto')}</span><input value={meta.subject} placeholder={t('dialogs.ex_projeto_executivo_rev_02')} onChange={(e) => setMeta({ subject: e.target.value })} /></label>
          <label className="field"><span>{t('dialogs.palavras_chave')}</span><input value={meta.keywords} placeholder={t('dialogs.arquitetura_executivo_rev02')} onChange={(e) => setMeta({ keywords: e.target.value })} /></label>
        </div>
      </div>
      {err && <span className="warn">{err}</span>}
    </Modal>
  )
}

// ---------------------------------------------------------------- Carimbos em lote
type Pos = 'tl' | 'tc' | 'tr' | 'ml' | 'c' | 'mr' | 'bl' | 'bc' | 'br'
const KINDS = {
  numero: { get label() { return t('dialogs.numeracao') }, get text() { return t('dialogs.folha_de') }, size: 10, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#1f2937' },
  carimbo: { get label() { return t('dialogs.carimbo') }, get text() { return t('dialogs.aprovado_para_obra') }, size: 14, pos: 'tr' as Pos, border: 2, angle: 0, opacity: 1, color: '#30a46c' },
  marca: { get label() { return t('dialogs.marca_d_agua') }, get text() { return t('dialogs.preliminar') }, size: 110, pos: 'c' as Pos, border: 0, angle: -30, opacity: 0.14, color: '#e5484d' },
  imagem: { get label() { return t('dialogs.imagem_logo') }, text: '', size: 12, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#000000' },
}

export function StampDialog() {
  const s = useStore()
  const range = useRange()
  const [kind, setKind] = useState<keyof typeof KINDS>('numero')
  const k0 = KINDS[kind]
  const [text, setText] = useState(k0.text)
  const [size, setSize] = useState(k0.size)
  const [pos, setPos] = useState<Pos>(k0.pos)
  const [border, setBorder] = useState(k0.border)
  const [angle, setAngle] = useState(k0.angle)
  const [opacity, setOpacity] = useState(k0.opacity)
  const [color, setColor] = useState(k0.color)
  const [margin, setMargin] = useState(24)
  const [img, setImg] = useState<{ url: string; w: number; h: number } | null>(null)
  const [imgW, setImgW] = useState(120)
  const [err, setErr] = useState('')

  const pick = (k: keyof typeof KINDS) => {
    const d = KINDS[k]
    setKind(k); setText(d.text); setSize(d.size); setPos(d.pos); setBorder(d.border); setAngle(d.angle); setOpacity(d.opacity); setColor(d.color)
  }
  const loadImg = () => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = 'image/png,image/jpeg'
    i.onchange = () => {
      const f = i.files?.[0]
      if (!f) return
      const r = new FileReader()
      r.onload = () => {
        const url = String(r.result)
        const im = new Image()
        im.onload = () => setImg({ url, w: im.width, h: im.height })
        im.src = url
      }
      r.readAsDataURL(f)
    }
    i.click()
  }

  const apply = () => {
    setErr('')
    let ids: string[]
    try {
      ids = range.ids()
    } catch (e) {
      return setErr((e as Error).message)
    }
    if (kind === 'imagem' && !img) return setErr(t('dialogs.escolha_uma_imagem'))
    const lines = text.split('\n')
    const longest = Math.max(...lines.map((l) => stampText(l, { n: 99, total: 99, label: 'XXX-00', file: 'XXXXXXXX', author: s.author }).length))
    const bw = kind === 'imagem' ? imgW : longest * size * 0.62 + (border ? 16 : 6)
    const bh = kind === 'imagem' && img ? (imgW * img.h) / img.w : lines.length * size * 1.25 + (border ? 12 : 4)
    const add: Markup[] = []
    for (const id of ids) {
      const sh = s.sheets.find((x) => x.id === id)!
      const W = sh.width, H = sh.height
      const col = pos.endsWith('l') ? 0 : pos.endsWith('r') ? 2 : 1
      const row = pos.startsWith('t') ? 0 : pos.startsWith('b') ? 2 : 1
      const x = col === 0 ? margin : col === 2 ? W - margin - bw : (W - bw) / 2
      const y = row === 0 ? margin : row === 2 ? H - margin - bh : (H - bh) / 2
      add.push({
        id: uid(), page: id, kind: kind === 'imagem' ? 'image' : 'stamp', points: [{ x, y }, { x: x + bw, y: y + bh }],
        text, comment: `lote: ${KINDS[kind].label}`, status: s.statuses[0]?.name ?? 'aberto', author: s.author, createdAt: Date.now(),
        presetId: null, deduct: false, color, width: border, fill: color, fillOpacity: 0, fontSize: size, angle, opacity, image: img?.url,
      })
    }
    s.checkpoint()
    useStore.setState({ markups: [...useStore.getState().markups, ...add] })
    s.notify(t('dialogs.aplicado_a_em_folha_s', { label: KINDS[kind].label, length: ids.length }))
    close()
  }

  return (
    <Modal title={t('dialogs.carimbos_numeracao_e_marca_d')} wide onClose={close} actions={<><button className="btn ghost" onClick={close}>{t('dialogs.cancelar')}</button><button className="btn primary" onClick={apply}>{t('dialogs.aplicar')}</button></>}>
      <div className="seg wide">
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => pick(k)}>{KINDS[k].label}</button>
        ))}
      </div>
      <div className="two-col">
        <div className="stack">
          {kind === 'imagem' ? (
            <>
              <button className="btn" onClick={loadImg}>{img ? t('dialogs.trocar_imagem') : t('dialogs.escolher_png_ou_jpg')}</button>
              {img && <img src={img.url} alt="" className="img-preview" />}
              <label className="field"><span>{t('dialogs.largura_pt')}</span><input type="number" value={imgW} onChange={(e) => setImgW(Number(e.target.value))} /></label>
            </>
          ) : (
            <>
              <label className="field"><span>{t('dialogs.texto')}</span><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
              <div className="var-chips">
                {t('dialogs.stamp_tokens').split(' ').map((v) => (
                  <button key={v} className="chip-btn" onClick={() => setText(text + v)}>{v}</button>
                ))}
              </div>
              <div className="row">
                <label className="field"><span>{t('dialogs.fonte')}</span><input type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
                <label className="field"><span>{t('dialogs.cor')}</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
                <label className="field"><span>{t('dialogs.borda')}</span><input type="number" min={0} step={0.5} value={border} onChange={(e) => setBorder(Number(e.target.value))} /></label>
              </div>
              <div className="row">
                <label className="field"><span>{t('dialogs.rotacao', { angle })}</span><input type="range" min={-90} max={90} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
                <label className="field"><span>{t('dialogs.opacidade', { round: Math.round(opacity * 100) })}</span><input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
              </div>
            </>
          )}
        </div>
        <div className="stack">
          <span className="section-label">{t('dialogs.posicao')}</span>
          <div className="pos-grid">
            {(['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br'] as Pos[]).map((p) => (
              <button key={p} className={pos === p ? 'active' : ''} onClick={() => setPos(p)} aria-label={p}><span /></button>
            ))}
          </div>
          <label className="field"><span>{t('dialogs.margem_pt')}</span><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
          <span className="section-label">{t('dialogs.aplicar_em')}</span>
          {range.ui}
        </div>
      </div>
      {err && <span className="warn">{err}</span>}
    </Modal>
  )
}

// ---------------------------------------------------------------- Modelos de status
export function StatusDialog() {
  const s = useStore()
  const [list, setList] = useState<(StatusDef & { old?: string })[]>(s.statuses.map((x) => ({ ...x, old: x.name })))
  const save = () => {
    const clean = list.filter((x) => x.name.trim())
    // renomeios propagam às marcações
    const ren = new Map(clean.filter((x) => x.old && x.old !== x.name).map((x) => [x.old!, x.name.trim()]))
    if (ren.size) useStore.setState({ markups: s.markups.map((m) => (ren.has(m.status) ? { ...m, status: ren.get(m.status)! } : m)) })
    s.setStatuses(clean.map(({ name, color }) => ({ name: name.trim(), color })))
    close()
  }
  return (
    <Modal title={t('dialogs.modelo_de_status')} onClose={close} actions={<><button className="btn ghost" onClick={() => setList(defaultStatuses())}>{t('dialogs.padrao')}</button><div className="spacer" /><button className="btn ghost" onClick={close}>{t('dialogs.cancelar')}</button><button className="btn primary" onClick={save}>{t('dialogs.salvar')}</button></>}>
      <p className="muted small">{t('dialogs.defina_o_fluxo_de_revisao')}</p>
      <div className="stack tight">
        {list.map((x, i) => (
          <div key={i} className="row center">
            <input type="color" className="color-sm" value={x.color} onChange={(e) => setList(list.map((y, j) => (j === i ? { ...y, color: e.target.value } : y)))} />
            <input className="grow" value={x.name} onChange={(e) => setList(list.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <button className="icon-btn" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setList([...list, { name: t('dialogs.novo_status'), color: '#0090ff' }])}><Plus size={14} /> {t('dialogs.adicionar_status')}</button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Base de preços (SINAPI) e BDI
export function PricesDialog() {
  const s = useStore()
  const [base, setBase] = useState<PriceBase | null | undefined>(undefined)
  const [label, setLabel] = useState('SINAPI PR ' + new Date().toLocaleDateString(localeOf(), { month: '2-digit', year: 'numeric' }) + ' ' + t('dialogs.nao_desonerado'))
  const [merge, setMerge] = useState(false)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => {
    loadBase().then(setBase)
  }, [])
  const pick = () => {
    const i = document.createElement('input')
    i.type = 'file'
    i.accept = '.xlsx,.xls,.csv'
    i.onchange = async () => {
      const f = i.files?.[0]
      if (!f) return
      setErr('')
      setBusy(`Lendo ${f.name}…`)
      try {
        const b = await importPriceFile(f, label, merge)
        setBase(b)
        s.notify(t('dialogs.itens_na_base_de_precos', { toLocaleString: b.items.length.toLocaleString(localeOf()) }))
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setBusy('')
      }
    }
    i.click()
  }
  const updatePrices = () => {
    if (!base) return
    let n = 0
    s.setPresets(s.presets.map((p) => {
      const it = p.code ? base.items.find((x) => x.code === p.code) : undefined
      if (!it) return p
      n++
      return { ...p, unitPrice: Math.round(it.price * 100) / 100 }
    }))
    s.notify(t('dialogs.marcador_es_com_preco_atualizado', { n }))
  }
  return (
    <Modal title={t('dialogs.base_de_precos_e_bdi')} onClose={close} actions={<button className="btn primary" onClick={close}>{t('dialogs.concluir')}</button>}>
      <div className="card">
        {base === undefined ? <span className="muted">{t('dialogs.carregando')}</span> : base ? (
          <>
            <div className="kv"><span>{t('dialogs.base_atual')}</span><b>{base.label}</b></div>
            <div className="kv"><span>{t('dialogs.itens')}</span><b>{base.items.length.toLocaleString(localeOf())}</b></div>
            <div className="kv"><span>{t('dialogs.importada_em')}</span><b>{new Date(base.importedAt).toLocaleDateString(localeOf())}</b></div>
            <div className="row">
              <button className="btn sm" onClick={updatePrices}>{t('dialogs.atualizar_precos_dos_marcadores_pelo')}</button>
              <button className="btn sm ghost" onClick={async () => { await clearBase(); setBase(null) }}>{t('dialogs.remover_base')}</button>
            </div>
          </>
        ) : <span className="muted">{t('dialogs.nenhuma_base_importada')}</span>}
      </div>
      <span className="section-label">{t('dialogs.importar_planilha')}</span>
      <label className="field"><span>{t('dialogs.nome_da_base')}</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> {t('dialogs.somar_a_base_atual_ex')}</label>
      <button className="btn" disabled={!!busy} onClick={pick}>{busy || t('dialogs.escolher_planilha_xlsx_csv')}</button>
      {err && <span className="warn">{err}</span>}
      <p className="muted small"><Rich k="dialogs.baixe_sinapi" /></p>
      <span className="section-label">{t('dialogs.bdi_do_orcamento')}</span>
      <div className="row center">
        <input type="number" step={0.01} min={0} value={s.bdi} onChange={(e) => s.set({ bdi: Number(e.target.value) })} style={{ maxWidth: 110 }} />
        <span className="muted">{t('dialogs.aplicado_sobre_o_total_do')}</span>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Colunas personalizadas
export function ColumnsDialog() {
  const s = useStore()
  const [cols, setCols] = useState<CustomColumn[]>(s.columns)
  const upd = (i: number, patch: Partial<CustomColumn>) => setCols(cols.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const save = () => {
    s.set({ columns: cols.filter((c) => c.name.trim()) })
    close()
  }
  return (
    <Modal title={t('dialogs.colunas_personalizadas')} wide onClose={close} actions={<><button className="btn ghost" onClick={close}>{t('dialogs.cancelar')}</button><button className="btn primary" onClick={save}>{t('dialogs.salvar')}</button></>}>
      <p className="muted small">{t('dialogs.campos_extras_em_cada_medicao')}</p>
      <div className="stack tight">
        {cols.map((c, i) => (
          <div key={c.id} className="row center">
            <input className="grow" placeholder={t('dialogs.nome_da_coluna')} value={c.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <select value={c.type} onChange={(e) => upd(i, { type: e.target.value as CustomColumn['type'] })} style={{ maxWidth: 130 }}>
              <option value="text">{t('dialogs.texto')}</option><option value="number">{t('dialogs.numero')}</option><option value="formula">{t('dialogs.formula')}</option>
            </select>
            {c.type === 'formula' && (
              <input className={c.formula && checkFormula(c.formula.replace(/\[[^\]]+\]/g, '1')) ? 'invalid' : ''} placeholder={t('dialogs.ex_q_perda')} value={c.formula ?? ''} onChange={(e) => upd(i, { formula: e.target.value })} style={{ maxWidth: 200 }} />
            )}
            <button className="icon-btn" onClick={() => setCols(cols.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setCols([...cols, { id: uid(), name: '', type: 'text' }])}><Plus size={14} /> {t('dialogs.adicionar_coluna')}</button>
      </div>
      <p className="hint"><Rich k="dialogs.formulas_colunas" /></p>
    </Modal>
  )
}

// ---------------------------------------------------------------- Atualizações (GitHub Releases)
const UPDATE_TEXT: Record<UpdateState['status'], string> = {
  get idle() { return t('dialogs.update_idle') },
  get checking() { return t('dialogs.update_checking') },
  get available() { return t('dialogs.update_available') },
  get latest() { return t('dialogs.update_latest') },
  get downloading() { return t('dialogs.update_downloading') },
  get ready() { return t('dialogs.update_ready') },
  get error() { return t('dialogs.update_error') },
}
function UpdatesPanel({ st, setSt }: { st: UpdateState; setSt: React.Dispatch<React.SetStateAction<UpdateState>> }) {
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const up = desktop?.update
  const saveToken = async () => {
    await desktop!.setSecret('github-token', token.trim())
    setToken('')
    setSaved(true)
    setSt((o) => ({ ...o, configured: !!token.trim() }))
    if (token.trim()) up?.check()
  }
  return (
    <>
      {!up ? (
        <p className="muted">{t('dialogs.a_versao_web_e_atualizada')}</p>
      ) : (
        <div className="stack">
          <div className="card">
            <div className="kv"><span>{t('dialogs.versao_instalada')}</span><b>{st.current ?? '—'}</b></div>
            <div className="kv"><span>{t('dialogs.situacao')}</span><b>{UPDATE_TEXT[st.status]}{st.status === 'available' || st.status === 'ready' ? ` (${st.version})` : ''}</b></div>
            {st.status === 'downloading' && <div className="progress"><div style={{ width: `${st.percent ?? 0}%` }} /></div>}
            {st.status === 'error' && st.error && <span className="warn small">{st.error}</span>}
            <div className="row">
              <button className="btn sm" disabled={st.status === 'checking' || st.status === 'downloading'} onClick={() => up.check()}>{t('dialogs.verificar_agora')}</button>
              {st.status === 'available' && <button className="btn sm primary" onClick={() => up.download()}>{t('dialogs.baixar', { version: st.version })}</button>}
              {st.status === 'ready' && <button className="btn sm primary" onClick={() => up.install()}>{t('dialogs.reiniciar_e_instalar')}</button>}
            </div>
          </div>
          <label className="field"><span>{t('dialogs.token_de_leitura')} {st.configured ? t('dialogs.token_configurado') : ''}</span>
            <input type="password" autoComplete="off" value={token} placeholder={st.configured ? t('dialogs.colar_outro_token_para_trocar') : t('dialogs.github_pat')} onChange={(e) => { setToken(e.target.value); setSaved(false) }} />
          </label>
          <div className="row">
            <button className="btn sm primary" disabled={!token.trim()} onClick={saveToken}>{t('dialogs.salvar_token')}</button>
            {st.configured && <button className="btn sm ghost" onClick={async () => { await desktop!.setSecret('github-token', ''); setSt((o) => ({ ...o, configured: false })) }}>{t('dialogs.remover_token')}</button>}
            {saved && <span className="muted small">{t('dialogs.salvo_criptografado_neste_pc')}</span>}
          </div>
          <p className="muted small"><Rich k="dialogs.token_explicacao" /></p>
        </div>
      )}
    </>
  )
}

/** Letras de atalho das ferramentas: clicar numa ferramenta e apertar a nova letra. */
function KeysPanel() {
  useKeymap()
  const [listening, setListening] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    if (!listening) return
    const h = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation() // senão o atalho global também dispararia
      if (e.key === 'Escape') return setListening(null)
      if (e.key.length !== 1 || !validKey(e.key)) return setMsg(t('dialogs.atalho_invalido'))
      const owner = setKey(listening, e.key)
      if (owner) return setMsg(t('dialogs.atalho_em_uso', { key: e.key.toUpperCase(), tool: TOOLS.find((x) => x.id === owner)?.label ?? owner }))
      setMsg('')
      setListening(null)
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [listening])
  return (
    <div className="stack">
      <p className="muted small">{t('dialogs.atalhos_ajuda')}</p>
      <div className="keys-grid">
        {TOOLS.map((x) => {
          const I = x.icon
          return (
            <div key={x.id} className="keys-row">
              <I size={15} />
              <span>{x.label}</span>
              <button className={`btn sm keys-btn ${listening === x.id ? 'active' : ''}`} onClick={() => { setMsg(''); setListening(listening === x.id ? null : x.id) }} aria-label={`${x.label}: ${x.key}`}>
                {listening === x.id ? t('dialogs.atalho_aperte') : <kbd>{x.key}</kbd>}
              </button>
            </div>
          )
        })}
      </div>
      {msg && <span className="warn small" role="status">{msg}</span>}
      <div className="row"><button className="btn sm ghost" disabled={!hasCustomKeys()} onClick={() => { resetKeys(); setMsg('') }}>{t('dialogs.atalhos_restaurar')}</button></div>
    </div>
  )
}

function AboutPanel({ st, goUpdates }: { st: UpdateState; goUpdates: () => void }) {
  const lang = useLang()
  const units = useUnits()
  const up = desktop?.update
  const version = st.current ?? APP_VERSION
  const busy = st.status === 'checking' || st.status === 'downloading'
  const newer = st.status === 'available' || st.status === 'ready'
  return (
    <div className="stack">
      <label className="field"><span>Idioma · Language</span>
        <select value={lang} onChange={(e) => void setLang(e.target.value as Lang)}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="field"><span>{t('dialogs.unidades')}</span>
        <select value={units} onChange={(e) => setUnits(e.target.value as UnitSystem)}>
          <option value="metric">{t('dialogs.unidades_metrico')}</option>
          <option value="imperial">{t('dialogs.unidades_imperial')}</option>
        </select>
        <small className="muted">{t('dialogs.unidades_ajuda')}</small>
      </label>
      <div className="card">
        <div className="kv"><span>Traço</span><b>{IS_DESKTOP ? t('dialogs.app_de_pc') : t('dialogs.versao_web')}</b></div>
        <div className="kv"><span>{t('dialogs.versao_instalada')}</span><b>{version}</b></div>
        {up ? (
          <>
            <div className="kv"><span>{t('dialogs.atualizacao')}</span><b>{UPDATE_TEXT[st.status]}{newer ? ` (${st.version})` : ''}</b></div>
            {st.status === 'downloading' && <div className="progress"><div style={{ width: `${st.percent ?? 0}%` }} /></div>}
            {st.status === 'error' && st.error && <span className="warn small">{st.error}</span>}
            <div className="row">
              <button className="btn sm" disabled={busy} onClick={() => up.check()}>{t('dialogs.verificar_atualizacao')}</button>
              {st.status === 'available' && <button className="btn sm primary" onClick={() => up.download()}>{t('dialogs.baixar', { version: st.version })}</button>}
              {st.status === 'ready' && <button className="btn sm primary" onClick={() => up.install()}>{t('dialogs.reiniciar_e_instalar')}</button>}
              <button className="btn sm ghost" onClick={goUpdates} data-tip={t('dialogs.so_para_copia_privada_do')}>{t('dialogs.token_opcional')}</button>
            </div>
          </>
        ) : (
          <p className="muted small">{t('dialogs.a_versao_web_e_atualizada_2')}</p>
        )}
        {st.notes && newer && <pre className="notes">{st.notes}</pre>}
      </div>
      <div className="row">
        <a className="btn sm" href={REPO_URL} target="_blank" rel="noreferrer">{t('dialogs.repositorio_no_github')}</a>
        <button className="btn sm" onClick={() => { useStore.setState({ dialog: null }); startTour() }}>{t('dialogs.rever_o_passo_a_passo')}</button>
        <a className="btn sm" href={newer && st.version ? releaseUrl(st.version) : releasesUrl()} target="_blank" rel="noreferrer">{t('dialogs.versoes_e_notas')}</a>
      </div>
      <div className="row">
        <button className="btn sm" onClick={async () => useStore.getState().notify((await copyDiagnostic()) ? t('dialogs.diagnostico_copiado') : t('dialogs.diagnostico_falhou'))} data-tip={t('dialogs.diagnostico_explicacao')}>{t('dialogs.copiar_diagnostico')}</button>
      </div>
      <p className="muted small">{t('dialogs.traco_lottos_engenharia_usa', { join: THIRD_PARTY.map(([n, l]) => `${n} (${l})`).join(', ') })}</p>
    </div>
  )
}

/** Configurações: aba Sobre (versão e atualização) e aba Atualizações (token do GitHub). */
export function SettingsDialog() {
  const [tab, setTab] = useState<'about' | 'keys' | 'updates'>('about')
  const [st, setSt] = useState<UpdateState>({ status: 'idle', current: APP_VERSION })
  const up = desktop?.update
  useEffect(() => {
    if (!up) return
    up.state().then((x) => {
      setSt(x)
      // ao abrir, já procura atualização
      if (x.status === 'idle') up.check()
    })
    up.onState((x) => setSt((o) => ({ ...o, ...x })))
  }, [up])
  return (
    <Modal wide={tab === 'keys'} title={t('dialogs.configuracoes')} onClose={close} actions={<><div className="spacer" /><button className="btn ghost" onClick={close}>{t('dialogs.fechar')}</button></>}>
      <div className="tabs">
        <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>{t('dialogs.sobre')}</button>
        <button className={tab === 'keys' ? 'active' : ''} onClick={() => setTab('keys')}>{t('dialogs.atalhos')}</button>
        <button className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>{t('dialogs.atualizacoes')}</button>
      </div>
      {tab === 'about' ? <AboutPanel st={st} goUpdates={() => setTab('updates')} /> : tab === 'keys' ? <KeysPanel /> : <UpdatesPanel st={st} setSt={setSt} />}
    </Modal>
  )
}

// ---------------------------------------------------------------- Recuperação
export function RecoverDialog() {
  const s = useStore()
  const [info, setInfo] = useState<RecoveryInfo | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    readRecoveryInfo().then(setInfo)
  }, [])
  if (!info) return null
  const discard = async () => {
    await clearRecovery()
    close()
  }
  return (
    <Modal title={t('dialogs.recuperar_trabalho_nao_salvo')} onClose={close} actions={<><button className="btn ghost danger" onClick={discard}>{t('dialogs.descartar')}</button><div className="spacer" /><button className="btn ghost" onClick={close}>{t('dialogs.agora_nao')}</button><button className="btn primary" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        await restoreRecovery()
        s.notify(t('dialogs.trabalho_recuperado_salve_o_projeto'))
        close()
      } catch (e) {
        s.notify(String((e as Error).message))
        setBusy(false)
      }
    }}>{busy ? t('dialogs.abrindo') : t('dialogs.recuperar')}</button></>}>
      <p><Rich k="dialogs.recuperar_texto" vars={{ nome: info.fileName || t('dialogs.projeto'), data: new Date(info.savedAt).toLocaleString(localeOf()), folhas: info.sheets, marcacoes: info.markups }} /></p>
    </Modal>
  )
}
