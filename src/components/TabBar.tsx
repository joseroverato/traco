import { useRef, useState } from 'react'
import { useStore } from '../store'
import { moveTab, switchTab, tabDirty } from '../tabs'
import { requestCloseTab } from '../project'
import { t } from '../i18n'
import { Glyph, Icon } from './Icon'
import { SelectCb } from './pal/SelectCb'

/**
 * Abas dos documentos abertos, no topo da coluna central (24 px): nome do arquivo, ponto de alteração não salva, fechar e "+".
 * À direita, o seletor de folha com anterior e próxima. Só aparece quando há algum documento.
 */
export function TabBar({ onOpen }: { onOpen: () => void }) {
  const tabs = useStore((s) => s.tabs)
  const active = useStore((s) => s.activeTab)
  const fileName = useStore((s) => s.fileName)
  const sheets = useStore((s) => s.sheets)
  const page = useStore((s) => s.page)
  const set = useStore((s) => s.set)
  useStore((s) => s.dirty) // a bolinha de "não salvo" acompanha as edições
  const dragId = useRef<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  if (!tabs.length) return null
  const go = (n: number) => set({ page: Math.max(0, Math.min(sheets.length - 1, n)), selected: [] })
  return (
    <div className="rx dt-wrap">
      <div className="dt">
        <div className="dt-l" role="tablist" aria-label={t('tabs.documentos_abertos')}>
          {tabs.map((tab, i) => {
            const on = tab.id === active
            const title = on ? fileName || tab.title : tab.title
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={on}
                tabIndex={0}
                className={`doc${on ? ' on' : ''}${over === tab.id ? ' drop' : ''}`}
                title={title}
                draggable
                onClick={() => switchTab(tab.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchTab(tab.id) } }}
                onMouseDown={(e) => { if (e.button === 1) e.preventDefault() }}
                onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); requestCloseTab(tab.id) } }}
                onDragStart={(e) => { dragId.current = tab.id; e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => { if (dragId.current) { e.preventDefault(); setOver(tab.id) } }}
                onDragLeave={() => setOver((o) => (o === tab.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); if (dragId.current) moveTab(dragId.current, i); dragId.current = null; setOver(null) }}
                onDragEnd={() => { dragId.current = null; setOver(null) }}
              >
                <Icon name="arquivoPdf" size={16} />
                <span className="doc-n">{title}</span>
                {tabDirty(tab.id) && <i className="dot" aria-label={t('tabs.nao_salvo')} title={t('tabs.nao_salvo')} />}
                <button type="button" className="ib doc-x" title={t('tabs.fechar_aba')} aria-label={t('tabs.fechar_aba')} onClick={(e) => { e.stopPropagation(); requestCloseTab(tab.id) }}><Glyph name="x" size={10} /></button>
              </div>
            )
          })}
          <button type="button" className="ib" title={t('tabs.abrir_outro_pdf')} aria-label={t('tabs.abrir_outro_pdf')} onClick={onOpen}><Glyph name="plus" size={12} /></button>
        </div>
        {sheets.length > 0 && (
          <div className="dt-r">
            <button type="button" className="ib" title={t('pal.folha_anterior')} aria-label={t('pal.folha_anterior')} disabled={page <= 0} onClick={() => go(page - 1)}><Glyph name="left" size={10} /></button>
            <SelectCb className="fs" value={String(page)} label={t('view3d.folha')} current={<><b>{String(page + 1).padStart(2, '0')} · {sheets[page]?.label}</b> <em>{t('pal.n_de_total', { n: page + 1, total: sheets.length })}</em></>} onChange={(v) => go(Number(v))}>
              {sheets.map((sh, i) => <option key={sh.id} value={i}>{String(i + 1).padStart(2, '0')} · {sh.label}</option>)}
            </SelectCb>
            <button type="button" className="ib" title={t('pal.proxima_folha')} aria-label={t('pal.proxima_folha')} disabled={page >= sheets.length - 1} onClick={() => go(page + 1)}><Glyph name="right" size={10} /></button>
          </div>
        )}
      </div>
    </div>
  )
}
