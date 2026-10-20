import { useState } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../store'
import { findSymbols } from '../geoWorker'
import { snapIndexFor } from '../snap'
import type { Pt } from '../types'
import { t } from '../i18n'

/** Painel flutuante com o resultado da contagem automática. */
export function SymbolResult({ found, onClose, sheetId }: { found: { rect: { x: number; y: number; w: number; h: number }; centers: Pt[] }; onClose: () => void; sheetId: string }) {
  const s = useStore()
  const [busy, setBusy] = useState('')
  const countPresets = s.presets.filter((p) => p.measure === 'count')
  const [preset, setPreset] = useState(s.presets.find((p) => p.id === s.activePreset && p.measure === 'count')?.id ?? '')

  const create = (perSheet: Record<string, Pt[]>) => {
    const st = useStore.getState()
    const p = st.presets.find((x) => x.id === preset)
    st.checkpoint()
    const now = Date.now()
    const add = Object.entries(perSheet)
      .filter(([, pts]) => pts.length)
      .map(([page, pts], i) => ({
        id: Math.random().toString(36).slice(2, 10), page, kind: 'count' as const, points: pts, text: '', comment: t('symbolresult.contagem_automatica'),
        status: st.statuses[0]?.name ?? 'aberto', author: st.author, createdAt: now + i, presetId: p?.id ?? null, deduct: false,
        color: p?.color ?? '#f76b15', width: 1.5, fill: p?.color ?? '#f76b15', fillOpacity: 0, fontSize: 12,
      }))
    useStore.setState({ markups: [...st.markups, ...add], tool: 'select' })
    const n = add.reduce((t, m) => t + m.points.length, 0)
    st.notify(t('symbolresult.itens_contados_em_folha_s', { n, length: add.length }))
    onClose()
  }

  const allSheets = async () => {
    const st = useStore.getState()
    const srcSheet = st.sheets.find((x) => x.id === sheetId)!
    const srcPage = await st.sources[srcSheet.src].doc.getPage(srcSheet.srcIndex + 1)
    const srcIdx = await snapIndexFor(srcPage, srcSheet, st.sources[srcSheet.src])
    const per: Record<string, Pt[]> = {}
    for (const [i, sh] of st.sheets.entries()) {
      setBusy(t('symbolresult.procurando_na_folha', { i: i + 1, total: st.sheets.length }))
      const page = await st.sources[sh.src].doc.getPage(sh.srcIndex + 1)
      const idx = await snapIndexFor(page, sh, st.sources[sh.src])
      const r = await findSymbols(sh, idx, srcSheet, srcIdx, found.rect, true)
      per[sh.id] = r.ok ? r.centers.map(([x, y]) => ({ x, y })) : []
    }
    setBusy('')
    create(per)
  }

  return (
    <div className="symbol-result" onPointerDown={(e) => e.stopPropagation()}>
      <div className="row center">
        <Target size={16} className="accent-ic" />
        <b className="grow">{t('symbolresult.simbolo_s_encontrados_nesta_folha', { length: found.centers.length })}</b>
      </div>
      <label className="field">
        <span>{t('symbolresult.contar_como')}</span>
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="">{t('symbolresult.contagem_sem_marcador')}</option>
          {countPresets.map((p) => <option key={p.id} value={p.id}>{p.group} · {p.name}</option>)}
        </select>
      </label>
      {busy ? <span className="muted small">{busy}</span> : (
        <div className="row">
          <button className="btn sm primary" disabled={!found.centers.length} onClick={() => create({ [sheetId]: found.centers })}>{t('symbolresult.criar_contagem')}</button>
          <button className="btn sm" onClick={allSheets}>{t('symbolresult.todas_as_folhas')}</button>
          <button className="btn sm ghost" onClick={onClose}>{t('symbolresult.cancelar')}</button>
        </div>
      )}
      <span className="muted small">{t('symbolresult.encontra_o_mesmo_desenho_inclusive')}</span>
    </div>
  )
}
