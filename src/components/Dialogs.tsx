import { useEffect, useId, useState } from 'react'
import { defaultStatuses, uid, useStore } from '../store'
import { exportPdf } from '../pdfexport'
import { clearRecovery, readRecoveryInfo, restoreRecovery } from '../autosave'
import type { RecoveryInfo } from '../autosave'
import { discardProject, download, saveProject } from '../project'
import { parseRanges } from '../ranges'
import type { CustomColumn, Markup, StatusDef } from '../types'
import { clearBase, importPriceFile, loadBase } from '../sinapi'
import type { PriceBase } from '../sinapi'
import { checkFormula } from '../formula'
import { localeOf, t, tp } from '../i18n'
import { Rich } from './Rich'
import { stampText } from '../geometry'
import { Chk, ColorField, DTabs, Dlg, Rad, Sld } from './Dlg'
import { Glyph, Icon } from './Icon'
import { SelectCb } from './pal/SelectCb'

const close = () => useStore.setState({ dialog: null })
const cancelBtn = <button type="button" className="btn" onClick={close}>{t('dialogs.cancelar')}</button>

/** Escopo das folhas (todas, folha atual ou intervalo). `h`: opções lado a lado (Exportar); sem `h`: em coluna (Carimbos em lote). */
function useRange(horizontal: boolean) {
  const s = useStore()
  const name = useId()
  const [scope, setScope] = useState<'all' | 'current' | 'ranges'>('all')
  const [ranges, setRanges] = useState('')
  const ids = (): string[] => {
    if (scope === 'all') return s.sheets.map((x) => x.id)
    if (scope === 'current') return [s.sheets[s.page].id]
    return parseRanges(ranges, s.sheets.length).flat().map((n) => s.sheets[n - 1].id)
  }
  const ui = (
    <>
      <div className={horizontal ? 'opc h' : 'rg'} role="radiogroup" aria-label={t('dialogs.folhas')}>
        <Rad name={name} checked={scope === 'all'} onChange={() => setScope('all')}>{t('dialogs.todas', { length: s.sheets.length })}</Rad>
        <Rad name={name} checked={scope === 'current'} onChange={() => setScope('current')}>{t('dialogs.folha_atual')}</Rad>
        <Rad name={name} checked={scope === 'ranges'} onChange={() => setScope('ranges')}>{t('dialogs.intervalo')}</Rad>
      </div>
      {scope === 'ranges' && <input className="in" aria-label={t('dialogs.intervalo')} placeholder="ex.: 1-3, 7, 10-12" value={ranges} onChange={(e) => setRanges(e.target.value)} />}
    </>
  )
  return { ids, ui }
}

// ---------------------------------------------------------------- Exportar PDF
export function ExportDialog() {
  const s = useStore()
  const range = useRange(true)
  const [flatten, setFlatten] = useState(true)
  const [bookmarks, setBookmarks] = useState(true)
  const [pageLabels, setPageLabels] = useState(true)
  const [removeAnnots, setRemoveAnnots] = useState(false)
  const [optimize, setOptimize] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const meta = s.meta
  const setMeta = (p: Partial<typeof meta>) => s.set({ meta: { ...meta, ...p } })
  const outName = `${(meta.title || s.fileName.replace(/\.pdf$/i, '')).replace(/[\\/:*?"<>|]/g, '_')}${flatten ? ' - revisado' : ''}.pdf`
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
      await download(bytes, outName, 'application/pdf')
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
    <Dlg
      title={t('dialogs.exportar_pdf')}
      onClose={close}
      width={720}
      footer={<>
        <span className="arq"><Icon name="arquivoPdf" size={16} /><span><Rich k="dialogs.sera_gravado_como" vars={{ nome: outName }} /></span></span>
        {cancelBtn}
        <button type="button" className="btn pri" disabled={busy} onClick={() => void go()}>{busy ? t('dialogs.gerando') : t('dialogs.exportar')}</button>
      </>}
    >
      <div className="ex2">
        <div>
          <div className="gbx"><h3>{t('dialogs.folhas')}</h3>{range.ui}</div>
          <div className="gbx"><h3>{t('dialogs.conteudo')}</h3>
            <Chk checked={flatten} onChange={setFlatten}>{t('dialogs.gravar_marcacoes_carimbos_e_imagens')}</Chk>
            <Chk checked={bookmarks} onChange={setBookmarks}>{t('dialogs.criar_indice_de_folhas_marcadores')}</Chk>
            <Chk checked={pageLabels} onChange={setPageLabels}>{t('dialogs.numerar_paginas_com_o_nome')}</Chk>
            <Chk checked={removeAnnots} onChange={setRemoveAnnots}>{t('dialogs.remover_anotacoes_que_vieram_no')}</Chk>
            <Chk checked={optimize} onChange={setOptimize}>{t('dialogs.otimizar_tamanho_do_arquivo')}</Chk>
          </div>
        </div>
        <div>
          <div className="gbx"><h3>{t('dialogs.metadados')}</h3>
            <label className="fld"><span>{t('dialogs.titulo')}</span><input className="in" value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} /></label>
            <label className="fld"><span>{t('dialogs.autor')}</span><input className="in" value={meta.author} placeholder={s.author} onChange={(e) => setMeta({ author: e.target.value })} /></label>
            <label className="fld"><span>{t('dialogs.assunto')}</span><input className="in" value={meta.subject} placeholder={t('dialogs.ex_projeto_executivo_rev_02')} onChange={(e) => setMeta({ subject: e.target.value })} /></label>
            <label className="fld"><span>{t('dialogs.palavras_chave')}</span><input className="in" value={meta.keywords} placeholder={t('dialogs.arquitetura_executivo_rev02')} onChange={(e) => setMeta({ keywords: e.target.value })} /></label>
          </div>
        </div>
      </div>
      {err && <p className="warnl" role="alert">{err}</p>}
    </Dlg>
  )
}

// ---------------------------------------------------------------- Carimbos em lote
type Pos = 'tl' | 'tc' | 'tr' | 'ml' | 'c' | 'mr' | 'bl' | 'bc' | 'br'
const POSITIONS: Pos[] = ['tl', 'tc', 'tr', 'ml', 'c', 'mr', 'bl', 'bc', 'br']
const POS_LABEL: Record<Pos, () => string> = {
  tl: () => t('dialogs.pos_tl'), tc: () => t('dialogs.pos_tc'), tr: () => t('dialogs.pos_tr'),
  ml: () => t('dialogs.pos_ml'), c: () => t('dialogs.pos_c'), mr: () => t('dialogs.pos_mr'),
  bl: () => t('dialogs.pos_bl'), bc: () => t('dialogs.pos_bc'), br: () => t('dialogs.pos_br'),
}
const KINDS = {
  numero: { get label() { return t('dialogs.numeracao') }, get text() { return t('dialogs.folha_de') }, size: 10, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#1f2937' },
  carimbo: { get label() { return t('dialogs.carimbo') }, get text() { return t('dialogs.aprovado_para_obra') }, size: 14, pos: 'tr' as Pos, border: 2, angle: 0, opacity: 1, color: '#30a46c' },
  marca: { get label() { return t('dialogs.marca_d_agua') }, get text() { return t('dialogs.preliminar') }, size: 110, pos: 'c' as Pos, border: 0, angle: -30, opacity: 0.14, color: '#e5484d' },
  imagem: { get label() { return t('dialogs.imagem_logo') }, text: '', size: 12, pos: 'br' as Pos, border: 0, angle: 0, opacity: 1, color: '#000000' },
}

export function StampDialog() {
  const s = useStore()
  const range = useRange(false)
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
    <Dlg
      title={t('dialogs.carimbos_numeracao_e_marca_d')}
      onClose={close}
      width={780}
      tabs={<DTabs label={t('dialogs.carimbos_numeracao_e_marca_d')} value={kind} onChange={pick} tabs={(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => ({ id: k, label: KINDS[k].label }))} />}
      footer={<>{cancelBtn}<button type="button" className="btn pri" onClick={apply}>{t('dialogs.aplicar')}</button></>}
    >
      <div className="stp">
        <div>
          {kind === 'imagem' ? (
            <>
              <div className="lin2"><button type="button" className="btn" onClick={loadImg}>{img ? t('dialogs.trocar_imagem') : t('dialogs.escolher_png_ou_jpg')}</button></div>
              {img && <img src={img.url} alt="" className="prevst" />}
              <label className="fv"><span>{t('dialogs.largura_pt')}</span><input className="in n nm" type="number" value={imgW} onChange={(e) => setImgW(Number(e.target.value))} /></label>
            </>
          ) : (
            <>
              <label className="fv"><span>{t('dialogs.texto')}</span><textarea className="in ml" rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label>
              <div className="tk" role="group" aria-label={t('dialogs.variaveis_do_texto')}>
                {t('dialogs.stamp_tokens').split(' ').map((v) => (
                  <button key={v} type="button" className="tbn txt" onClick={() => setText(text + v)}>{v}</button>
                ))}
              </div>
              <div className="c3">
                <label className="fv"><span>{t('dialogs.fonte')}</span><input className="in n nm" type="number" value={size} onChange={(e) => setSize(Number(e.target.value))} /></label>
                <div className="fv"><span>{t('dialogs.cor')}</span><ColorField value={color} onChange={setColor} label={t('dialogs.cor')} /></div>
                <label className="fv"><span>{t('dialogs.borda')}</span><input className="in n nm" type="number" min={0} step={0.5} value={border} onChange={(e) => setBorder(Number(e.target.value))} /></label>
              </div>
              <div className="c2">
                <div className="fv"><span>{t('dialogs.rotacao', { angle })}</span><Sld min={-90} max={90} step={5} value={angle} onChange={setAngle} label={t('dialogs.rotacao', { angle })} valueText={`${angle}°`} /></div>
                <div className="fv"><span>{t('dialogs.opacidade', { round: Math.round(opacity * 100) })}</span><Sld min={0.05} max={1} step={0.05} value={opacity} onChange={setOpacity} label={t('dialogs.opacidade', { round: Math.round(opacity * 100) })} valueText={`${Math.round(opacity * 100)}%`} /></div>
              </div>
            </>
          )}
        </div>
        <div>
          <h3>{t('dialogs.posicao')}</h3>
          <div className="pgd" role="radiogroup" aria-label={t('dialogs.posicao')}>
            {POSITIONS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={pos === p} aria-label={POS_LABEL[p]()} title={POS_LABEL[p]()} className={`pgc ${pos === p ? 'on' : ''}`} onClick={() => setPos(p)}><i /></button>
            ))}
          </div>
          <label className="fv"><span>{t('dialogs.margem_pt')}</span><input className="in n nm" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></label>
          <h3>{t('dialogs.aplicar_em')}</h3>
          {range.ui}
        </div>
      </div>
      {err && <p className="warnl" role="alert">{err}</p>}
    </Dlg>
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
  const upd = (i: number, patch: Partial<StatusDef>) => setList(list.map((y, j) => (j === i ? { ...y, ...patch } : y)))
  return (
    <Dlg
      title={t('dialogs.modelo_de_status')}
      onClose={close}
      width={520}
      footer={<><button type="button" className="btn" onClick={() => setList(defaultStatuses())}>{t('dialogs.padrao')}</button><span className="sp" />{cancelBtn}<button type="button" className="btn pri" onClick={save}>{t('dialogs.salvar')}</button></>}
    >
      <p>{t('dialogs.defina_o_fluxo_de_revisao')}</p>
      <div className="st-l" role="list" aria-label={t('dialogs.modelo_de_status')}>
        {list.map((x, i) => (
          <div key={i} className="li" role="listitem">
            <ColorField value={x.color} text="" onChange={(c) => upd(i, { color: c })} label={t('dialogs.cor')} />
            <input className="in" value={x.name} aria-label={t('dialogs.nome_do_status')} onChange={(e) => upd(i, { name: e.target.value })} />
            <button type="button" className="ib" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={t('pagesview.excluir')} title={t('pagesview.excluir')}><Icon name="excluir" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="lin2"><button type="button" className="tbn" onClick={() => setList([...list, { name: t('dialogs.novo_status'), color: '#0090ff' }])}><Glyph name="plus" size={12} />{t('dialogs.adicionar_status')}</button></div>
    </Dlg>
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
    <Dlg title={t('dialogs.base_de_precos_e_bdi')} onClose={close} width={560} footer={<button type="button" className="btn pri" onClick={close}>{t('dialogs.concluir')}</button>}>
      <div className="gbx"><h3>{t('dialogs.base_atual')}</h3>
        {base === undefined ? <p>{t('dialogs.carregando')}</p> : base ? (
          <>
            <div className="kv"><span>{t('dialogs.base_atual')}</span><b>{base.label}</b></div>
            <div className="kv"><span>{t('dialogs.itens')}</span><b className="n">{base.items.length.toLocaleString(localeOf())}</b></div>
            <div className="kv"><span>{t('dialogs.importada_em')}</span><b className="n">{new Date(base.importedAt).toLocaleDateString(localeOf())}</b></div>
            <div className="lin2">
              <button type="button" className="btn sm" onClick={updatePrices}>{t('dialogs.atualizar_precos_dos_marcadores_pelo')}</button>
              <button type="button" className="btn sm dg" onClick={async () => { await clearBase(); setBase(null) }}>{t('dialogs.remover_base')}</button>
            </div>
          </>
        ) : <p>{t('dialogs.nenhuma_base_importada')}</p>}
      </div>
      <div className="gbx"><h3>{t('dialogs.importar_planilha')}</h3>
        <label className="fld"><span>{t('dialogs.nome_da_base')}</span><input className="in" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <Chk checked={merge} onChange={setMerge}>{t('dialogs.somar_a_base_atual_ex')}</Chk>
        <div className="lin2"><button type="button" className="btn" disabled={!!busy} onClick={pick}>{busy || t('dialogs.escolher_planilha_xlsx_csv')}</button></div>
        {err && <p className="warnl" role="alert">{err}</p>}
        <p><Rich k="dialogs.baixe_sinapi" /></p>
      </div>
      <div className="gbx"><h3>{t('dialogs.bdi_do_orcamento')}</h3>
        <label className="fld"><input className="in n nm" type="number" step={0.01} min={0} value={s.bdi} aria-label={t('dialogs.bdi_do_orcamento')} style={{ flex: 'none', width: 96 }} onChange={(e) => s.set({ bdi: Number(e.target.value) })} /><span style={{ width: 'auto', flex: '1 1 auto' }}>{t('dialogs.aplicado_sobre_o_total_do')}</span></label>
      </div>
    </Dlg>
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
  const typeName = (ty: CustomColumn['type']) => (ty === 'text' ? t('dialogs.texto') : ty === 'number' ? t('dialogs.numero') : t('dialogs.formula'))
  return (
    <Dlg title={t('dialogs.colunas_personalizadas')} onClose={close} width={800} footer={<>{cancelBtn}<button type="button" className="btn pri" onClick={save}>{t('dialogs.salvar')}</button></>}>
      <p>{t('dialogs.campos_extras_em_cada_medicao')}</p>
      <div className="col1">
        {cols.map((c, i) => (
          <div key={c.id} className="crw">
            <input className="in" aria-label={t('dialogs.nome_da_coluna')} placeholder={t('dialogs.nome_da_coluna')} value={c.name} onChange={(e) => upd(i, { name: e.target.value })} />
            <SelectCb value={c.type} onChange={(v) => upd(i, { type: v as CustomColumn['type'] })} label={t('dialogs.tipo_da_coluna')} current={typeName(c.type)}>
              <option value="text">{t('dialogs.texto')}</option><option value="number">{t('dialogs.numero')}</option><option value="formula">{t('dialogs.formula')}</option>
            </SelectCb>
            {c.type === 'formula'
              ? <input className={`in fm mono ${c.formula && checkFormula(c.formula.replace(/\[[^\]]+\]/g, '1')) ? 'invalid' : ''}`} aria-label={t('dialogs.formula')} placeholder={t('dialogs.ex_q_perda')} value={c.formula ?? ''} onChange={(e) => upd(i, { formula: e.target.value })} />
              : <span className="fm" />}
            <button type="button" className="tbn" title={t('pagesview.excluir')} onClick={() => setCols(cols.filter((_, j) => j !== i))}><Icon name="excluir" size={16} />{t('pagesview.excluir')}</button>
          </div>
        ))}
      </div>
      <div className="lin2"><button type="button" className="tbn" onClick={() => setCols([...cols, { id: uid(), name: '', type: 'text' }])}><Glyph name="plus" size={12} />{t('dialogs.adicionar_coluna')}</button></div>
      <p><Rich k="dialogs.formulas_colunas" /></p>
    </Dlg>
  )
}

// ---------------------------------------------------------------- Fechar projeto
export function CloseDialog() {
  const s = useStore()
  const [busy, setBusy] = useState(false)
  const name = s.fileName || t('dialogs.projeto')
  return (
    <Dlg
      title={t('project.fechar_projeto_titulo')}
      onClose={close}
      width={480}
      footer={<>
        <button type="button" className="btn dg" onClick={() => void discardProject()}>{t('project.fechar_sem_salvar')}</button>
        <span className="sp" />
        {cancelBtn}
        <button type="button" className="btn pri" disabled={busy} onClick={async () => {
          setBusy(true)
          if (await saveProject()) await discardProject()
          else setBusy(false)
        }}>{t('project.salvar_e_fechar')}</button>
      </>}
    >
      <div className="msg">
        <svg className="qi wa" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false"><path d="M13 3.5L24 22.5H2Z" strokeLinejoin="miter" /><path d="M13 10.5V16M13 19V19.2" strokeLinecap="butt" /></svg>
        <p><Rich k="project.fechar_projeto_texto" vars={{ name }} /></p>
      </div>
    </Dlg>
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
    <Dlg
      title={t('dialogs.recuperar_trabalho_nao_salvo')}
      onClose={close}
      width={520}
      footer={<>
        <button type="button" className="btn dg" onClick={() => void discard()}>{t('dialogs.descartar')}</button>
        <span className="sp" />
        <button type="button" className="btn" onClick={close}>{t('dialogs.agora_nao')}</button>
        <button type="button" className="btn pri" disabled={busy} onClick={async () => {
          setBusy(true)
          try {
            await restoreRecovery()
            s.notify(t('dialogs.trabalho_recuperado_salve_o_projeto'))
            close()
          } catch (e) {
            s.notify(String((e as Error).message), 'err')
            setBusy(false)
          }
        }}>{busy ? t('dialogs.abrindo') : t('dialogs.recuperar')}</button>
      </>}
    >
      <p><Rich k="dialogs.recuperar_texto" vars={{ nome: info.fileName || t('dialogs.projeto'), data: new Date(info.savedAt).toLocaleString(localeOf()), folhas: tp('dialogs.n_folhas', info.sheets), marcacoes: tp('pal.n_marcacoes', info.markups) }} /></p>
    </Dlg>
  )
}
