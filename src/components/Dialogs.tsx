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
import { APP_VERSION, REPO_URL, THIRD_PARTY, releaseUrl, releasesUrl } from '../about'

function Modal({ title, children, onClose, actions, wide }: { title: string; children: React.ReactNode; onClose: () => void; actions: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onMouseDown={(e) => e.stopPropagation()}>
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
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Todas ({s.sheets.length})</button>
        <button className={scope === 'current' ? 'active' : ''} onClick={() => setScope('current')}>Folha atual</button>
        <button className={scope === 'ranges' ? 'active' : ''} onClick={() => setScope('ranges')}>Intervalo</button>
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
      s.notify(`PDF exportado com ${ids.length} folha(s)`)
      close()
    } catch (e) {
      console.error(e)
      setErr('Falha ao gerar o PDF: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Exportar PDF" wide onClose={close} actions={<><button className="btn ghost" onClick={close}>Cancelar</button><button className="btn primary" disabled={busy} onClick={go}>{busy ? 'Gerando…' : 'Exportar'}</button></>}>
      <div className="two-col">
        <div className="stack">
          <span className="section-label">Folhas</span>
          {range.ui}
          <span className="section-label">Conteúdo</span>
          <label className="check"><input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} /> Gravar marcações, carimbos e imagens no PDF</label>
          <label className="check"><input type="checkbox" checked={bookmarks} onChange={(e) => setBookmarks(e.target.checked)} /> Criar índice de folhas (marcadores)</label>
          <label className="check"><input type="checkbox" checked={pageLabels} onChange={(e) => setPageLabels(e.target.checked)} /> Numerar páginas com o nome da folha</label>
          <label className="check"><input type="checkbox" checked={removeAnnots} onChange={(e) => setRemoveAnnots(e.target.checked)} /> Remover anotações que vieram no PDF original</label>
          {IS_DESKTOP ? (
            <label className="check"><input type="checkbox" checked={optimize} onChange={(e) => setOptimize(e.target.checked)} /> Otimizar tamanho do arquivo</label>
          ) : (
            <span className="muted small">Tarjas definitivas e otimização de tamanho estão disponíveis no app de PC.</span>
          )}
        </div>
        <div className="stack">
          <span className="section-label">Metadados</span>
          <label className="field"><span>Título</span><input value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} /></label>
          <label className="field"><span>Autor</span><input value={meta.author} placeholder={s.author} onChange={(e) => setMeta({ author: e.target.value })} /></label>
          <label className="field"><span>Assunto</span><input value={meta.subject} placeholder="ex.: Projeto executivo — Rev. 02" onChange={(e) => setMeta({ subject: e.target.value })} /></label>
          <label className="field"><span>Palavras-chave</span><input value={meta.keywords} placeholder="arquitetura; executivo; rev02" onChange={(e) => setMeta({ keywords: e.target.value })} /></label>
        </div>
      </div>
      {err && <span className="warn">{err}</span>}
    </Modal>
  )
}

// ---------------------------------------------------------------- Carimbos em lote
type Pos = 'tl' | 'tc' | 'tr' | 'ml' | 'c' | 'mr' | 'bl' | 'bc' | 'br'
const KINDS = {
  numero: { label: 'Numeração', text: 'Folha {n} de {total}', size: 10, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#1f2937' },
  carimbo: { label: 'Carimbo', text: 'APROVADO PARA OBRA\n{autor} · {data}', size: 14, pos: 'tr' as Pos, border: 2, angle: 0, opacity: 1, color: '#30a46c' },
  marca: { label: "Marca d'água", text: 'PRELIMINAR', size: 110, pos: 'c' as Pos, border: 0, angle: -30, opacity: 0.14, color: '#e5484d' },
  imagem: { label: 'Imagem / logo', text: '', size: 12, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#000000' },
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
    if (kind === 'imagem' && !img) return setErr('Escolha uma imagem')
    const lines = text.split('\n')
    const longest = Math.max(...lines.map((l) => l.replace(/\{(total|n)\}/g, '00').replace(/\{data\}/g, '00/00/0000').replace(/\{autor\}/g, s.author).replace(/\{folha\}/g, 'XXX-00').length))
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
    s.notify(`${KINDS[kind].label} aplicado(a) em ${ids.length} folha(s) — cada um continua editável`)
    close()
  }

  return (
    <Modal title="Carimbos, numeração e marca d'água" wide onClose={close} actions={<><button className="btn ghost" onClick={close}>Cancelar</button><button className="btn primary" onClick={apply}>Aplicar</button></>}>
      <div className="seg wide">
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => pick(k)}>{KINDS[k].label}</button>
        ))}
      </div>
      <div className="two-col">
        <div className="stack">
          {kind === 'imagem' ? (
            <>
              <button className="btn" onClick={loadImg}>{img ? 'Trocar imagem' : 'Escolher PNG ou JPG…'}</button>
              {img && <img src={img.url} alt="" className="img-preview" />}
              <label className="field"><span>Largura (pt)</span><input type="number" value={imgW} onChange={(e) => setImgW(Number(e.target.value))} /></label>
            </>
          ) : (
            <>
              <label className="field"><span>Texto</span><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
              <div className="var-chips">
                {['{n}', '{total}', '{folha}', '{data}', '{hora}', '{autor}', '{arquivo}'].map((v) => (
                  <button key={v} className="chip-btn" onClick={() => setText(text + v)}>{v}</button>
                ))}
              </div>
              <div className="row">
                <label className="field"><span>Fonte</span><input type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
                <label className="field"><span>Cor</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
                <label className="field"><span>Borda</span><input type="number" min={0} step={0.5} value={border} onChange={(e) => setBorder(Number(e.target.value))} /></label>
              </div>
              <div className="row">
                <label className="field"><span>Rotação {angle}°</span><input type="range" min={-90} max={90} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
                <label className="field"><span>Opacidade {Math.round(opacity * 100)}%</span><input type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
              </div>
            </>
          )}
        </div>
        <div className="stack">
          <span className="section-label">Posição</span>
          <div className="pos-grid">
            {(['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br'] as Pos[]).map((p) => (
              <button key={p} className={pos === p ? 'active' : ''} onClick={() => setPos(p)} aria-label={p}><span /></button>
            ))}
          </div>
          <label className="field"><span>Margem (pt)</span><input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
          <span className="section-label">Aplicar em</span>
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
    <Modal title="Modelo de status" onClose={close} actions={<><button className="btn ghost" onClick={() => setList(defaultStatuses())}>Padrão</button><div className="spacer" /><button className="btn ghost" onClick={close}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <p className="muted small">Defina o fluxo de revisão do projeto (ex.: Enviado → Em análise → Aprovado c/ ressalvas → Aprovado). O primeiro é o status inicial.</p>
      <div className="stack tight">
        {list.map((x, i) => (
          <div key={i} className="row center">
            <input type="color" className="color-sm" value={x.color} onChange={(e) => setList(list.map((y, j) => (j === i ? { ...y, color: e.target.value } : y)))} />
            <input className="grow" value={x.name} onChange={(e) => setList(list.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} />
            <button className="icon-btn" onClick={() => setList(list.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setList([...list, { name: 'novo status', color: '#0090ff' }])}><Plus size={14} /> Adicionar status</button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Base de preços (SINAPI) e BDI
export function PricesDialog() {
  const s = useStore()
  const [base, setBase] = useState<PriceBase | null | undefined>(undefined)
  const [label, setLabel] = useState('SINAPI PR ' + new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) + ' não desonerado')
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
        s.notify(`${b.items.length.toLocaleString('pt-BR')} itens na base de preços`)
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
    s.notify(`${n} marcador(es) com preço atualizado pela base`)
  }
  return (
    <Modal title="Base de preços e BDI" onClose={close} actions={<button className="btn primary" onClick={close}>Concluir</button>}>
      <div className="card">
        {base === undefined ? <span className="muted">Carregando…</span> : base ? (
          <>
            <div className="kv"><span>Base atual</span><b>{base.label}</b></div>
            <div className="kv"><span>Itens</span><b>{base.items.length.toLocaleString('pt-BR')}</b></div>
            <div className="kv"><span>Importada em</span><b>{new Date(base.importedAt).toLocaleDateString('pt-BR')}</b></div>
            <div className="row">
              <button className="btn sm" onClick={updatePrices}>Atualizar preços dos marcadores pelo código</button>
              <button className="btn sm ghost" onClick={async () => { await clearBase(); setBase(null) }}>Remover base</button>
            </div>
          </>
        ) : <span className="muted">Nenhuma base importada.</span>}
      </div>
      <span className="section-label">Importar planilha</span>
      <label className="field"><span>Nome da base</span><input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Somar à base atual (ex.: composições + insumos, ou base própria da Lottos)</label>
      <button className="btn" disabled={!!busy} onClick={pick}>{busy || 'Escolher planilha .xlsx / .csv…'}</button>
      {err && <span className="warn">{err}</span>}
      <p className="muted small">Baixe no site da Caixa (SINAPI → Relatórios de preços → PR) a planilha de <b>composições sintético</b> e/ou <b>insumos</b>. O Traço detecta as colunas de código, descrição, unidade e custo automaticamente. Também serve para uma planilha própria com essas colunas.</p>
      <span className="section-label">BDI do orçamento</span>
      <div className="row center">
        <input type="number" step={0.01} min={0} value={s.bdi} onChange={(e) => s.set({ bdi: Number(e.target.value) })} style={{ maxWidth: 110 }} />
        <span className="muted">% aplicado sobre o total do quantitativo</span>
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
    <Modal title="Colunas personalizadas" wide onClose={close} actions={<><button className="btn ghost" onClick={close}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}>
      <p className="muted small">Campos extras em cada medição (etapa, fornecedor, lote…) e colunas calculadas. Aparecem nas propriedades da marcação, na tabela de quantitativo e no Excel.</p>
      <div className="stack tight">
        {cols.map((c, i) => (
          <div key={c.id} className="row center">
            <input className="grow" placeholder="Nome da coluna" value={c.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <select value={c.type} onChange={(e) => upd(i, { type: e.target.value as CustomColumn['type'] })} style={{ maxWidth: 130 }}>
              <option value="text">Texto</option><option value="number">Número</option><option value="formula">Fórmula</option>
            </select>
            {c.type === 'formula' && (
              <input className={c.formula && checkFormula(c.formula.replace(/\[[^\]]+\]/g, '1')) ? 'invalid' : ''} placeholder="ex.: Q * [Perda] " value={c.formula ?? ''} onChange={(e) => upd(i, { formula: e.target.value })} style={{ maxWidth: 200 }} />
            )}
            <button className="icon-btn" onClick={() => setCols(cols.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setCols([...cols, { id: uid(), name: '', type: 'text' }])}><Plus size={14} /> Adicionar coluna</button>
      </div>
      <p className="hint">Fórmulas: <b>Q</b> quantidade final, <b>L A P N H V</b> medidas, e colunas numéricas entre colchetes, ex.: <code>Q * [Perda %] / 100</code>.</p>
    </Modal>
  )
}

// ---------------------------------------------------------------- Atualizações (GitHub Releases)
const UPDATE_TEXT: Record<UpdateState['status'], string> = {
  idle: 'Ainda não verificado.',
  checking: 'Procurando atualização…',
  available: 'Nova versão disponível.',
  latest: 'Você está na versão mais recente.',
  downloading: 'Baixando…',
  ready: 'Atualização baixada — reinicie para instalar.',
  error: 'Não foi possível verificar.',
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
        <p className="muted">A versão web é atualizada no servidor (docker compose pull / up). As atualizações automáticas são do app de PC.</p>
      ) : (
        <div className="stack">
          <div className="card">
            <div className="kv"><span>Versão instalada</span><b>{st.current ?? '—'}</b></div>
            <div className="kv"><span>Situação</span><b>{UPDATE_TEXT[st.status]}{st.status === 'available' || st.status === 'ready' ? ` (${st.version})` : ''}</b></div>
            {st.status === 'downloading' && <div className="progress"><div style={{ width: `${st.percent ?? 0}%` }} /></div>}
            {st.status === 'error' && st.error && <span className="warn small">{st.error}</span>}
            <div className="row">
              <button className="btn sm" disabled={st.status === 'checking' || st.status === 'downloading'} onClick={() => up.check()}>Verificar agora</button>
              {st.status === 'available' && <button className="btn sm primary" onClick={() => up.download()}>Baixar {st.version}</button>}
              {st.status === 'ready' && <button className="btn sm primary" onClick={() => up.install()}>Reiniciar e instalar</button>}
            </div>
          </div>
          <label className="field"><span>Token de leitura do GitHub (opcional) {st.configured ? '· configurado ✓' : ''}</span>
            <input type="password" autoComplete="off" value={token} placeholder={st.configured ? 'Colar outro token para trocar' : 'github_pat_…'} onChange={(e) => { setToken(e.target.value); setSaved(false) }} />
          </label>
          <div className="row">
            <button className="btn sm primary" disabled={!token.trim()} onClick={saveToken}>Salvar token</button>
            {st.configured && <button className="btn sm ghost" onClick={async () => { await desktop!.setSecret('github-token', ''); setSt((o) => ({ ...o, configured: false })) }}>Remover token</button>}
            {saved && <span className="muted small">Salvo (criptografado neste PC).</span>}
          </div>
          <p className="muted small">O Traço consulta as releases públicas de joseroverato/traco e não precisa de token. O token só é necessário numa cópia <b>privada</b> do repositório: use um token “fine-grained” só com <b>Contents: Read-only</b>. Ele fica guardado criptografado neste computador e nunca vai para o código nem para o projeto.</p>
        </div>
      )}
    </>
  )
}

function AboutPanel({ st, goUpdates }: { st: UpdateState; goUpdates: () => void }) {
  const up = desktop?.update
  const version = st.current ?? APP_VERSION
  const busy = st.status === 'checking' || st.status === 'downloading'
  const newer = st.status === 'available' || st.status === 'ready'
  return (
    <div className="stack">
      <div className="card">
        <div className="kv"><span>Traço</span><b>{IS_DESKTOP ? 'App de PC' : 'Versão web'}</b></div>
        <div className="kv"><span>Versão instalada</span><b>{version}</b></div>
        {up ? (
          <>
            <div className="kv"><span>Atualização</span><b>{UPDATE_TEXT[st.status]}{newer ? ` (${st.version})` : ''}</b></div>
            {st.status === 'downloading' && <div className="progress"><div style={{ width: `${st.percent ?? 0}%` }} /></div>}
            {st.status === 'error' && st.error && <span className="warn small">{st.error}</span>}
            <div className="row">
              <button className="btn sm" disabled={busy} onClick={() => up.check()}>Verificar atualização</button>
              {st.status === 'available' && <button className="btn sm primary" onClick={() => up.download()}>Baixar {st.version}</button>}
              {st.status === 'ready' && <button className="btn sm primary" onClick={() => up.install()}>Reiniciar e instalar</button>}
              <button className="btn sm ghost" onClick={goUpdates} data-tip="Só para cópia privada do repositório">Token (opcional)</button>
            </div>
          </>
        ) : (
          <p className="muted small">A versão web é atualizada no servidor (docker compose pull / up). A atualização automática é do app de PC.</p>
        )}
        {st.notes && newer && <pre className="notes">{st.notes}</pre>}
      </div>
      <div className="row">
        <a className="btn sm" href={REPO_URL} target="_blank" rel="noreferrer">Repositório no GitHub</a>
        <a className="btn sm" href={newer && st.version ? releaseUrl(st.version) : releasesUrl()} target="_blank" rel="noreferrer">Versões e notas</a>
      </div>
      <p className="muted small">Traço — Lottos Engenharia. Usa {THIRD_PARTY.map(([n, l]) => `${n} (${l})`).join(', ')}.</p>
    </div>
  )
}

/** Configurações: aba Sobre (versão e atualização) e aba Atualizações (token do GitHub). */
export function SettingsDialog() {
  const [tab, setTab] = useState<'about' | 'updates'>('about')
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
    <Modal title="Configurações" onClose={close} actions={<><div className="spacer" /><button className="btn ghost" onClick={close}>Fechar</button></>}>
      <div className="tabs">
        <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>Sobre</button>
        <button className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>Atualizações</button>
      </div>
      {tab === 'about' ? <AboutPanel st={st} goUpdates={() => setTab('updates')} /> : <UpdatesPanel st={st} setSt={setSt} />}
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
    <Modal title="Recuperar trabalho não salvo" onClose={close} actions={<><button className="btn ghost danger" onClick={discard}>Descartar</button><div className="spacer" /><button className="btn ghost" onClick={close}>Agora não</button><button className="btn primary" disabled={busy} onClick={async () => {
      setBusy(true)
      try {
        await restoreRecovery()
        s.notify('Trabalho recuperado — salve o projeto para manter')
        close()
      } catch (e) {
        s.notify(String((e as Error).message))
        setBusy(false)
      }
    }}>{busy ? 'Abrindo…' : 'Recuperar'}</button></>}>
      <p>O Traço foi fechado sem salvar. Há uma cópia automática de <b>{info.fileName || 'projeto'}</b> de {new Date(info.savedAt).toLocaleString('pt-BR')} ({info.sheets} folha(s), {info.markups} marcação(ões)).</p>
    </Modal>
  )
}
