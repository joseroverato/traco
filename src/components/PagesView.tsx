import { useEffect, useState } from 'react'
import { ArrowDownAZ, Copy, FilePlus2, FileStack, RotateCcw, RotateCw, Scissors, SquareDashedMousePointer, Tags, Trash2, Undo, FileOutput } from 'lucide-react'
import { useStore } from '../store'
import { Thumb } from './Thumb'
import { formatOf } from './pal/model'
import { useIsMobile } from '../mobile'
import { t, tp } from '../i18n'
import { setModeAnimated } from '../motion'
import { BlankDialog, RenameDialog, SplitDialog } from './PagesDialogs'
import {
  clearSheetSel, clickSheet, duplicateSel, extractSheets, lastSelectedIndex, moveSheets, removeSel, renameSheet, resetPagesTransient, reverseOrder,
  rotateSel, selectAllSheets, setPagesBusy, setPagesDlg, sortByName, pickPdfToInsert, usePagesSelected, usePagesUi,
} from '../pagesUi'

/** Barra de ações do celular (sem faixa de opções): as mesmas funções da aba Pranchas, em botões. No PC elas ficam na faixa. */
function MobileBar({ selected, total }: { selected: string[]; total: number }) {
  const some = selected.length > 0
  return (
    <div className="pages-toolbar">
      <div className="tb-cluster">
        <span className="sel-count">{some ? tp('pagesview.selecionadas', selected.length) : tp('pagesview.n_folhas', total)}</span>
        <button className="btn ghost sm" onClick={() => (selected.length === total ? clearSheetSel() : selectAllSheets())}><SquareDashedMousePointer size={14} /> {selected.length === total ? t('pagesview.limpar') : t('pagesview.todas')}</button>
      </div>
      <div className="tb-cluster">
        <button className="btn sm" disabled={!some} onClick={() => rotateSel(-90)} title={t('pagesview.girar_a_esquerda')}><RotateCcw size={14} /></button>
        <button className="btn sm" disabled={!some} onClick={() => rotateSel(90)} title={t('pagesview.girar_a_direita')}><RotateCw size={14} /></button>
        <button className="btn sm" disabled={!some} onClick={duplicateSel}><Copy size={14} /> {t('pagesview.duplicar')}</button>
        <button className="btn sm danger" disabled={!some} onClick={removeSel}><Trash2 size={14} /> {t('pagesview.excluir')}</button>
      </div>
      <div className="tb-cluster">
        <button className="btn sm" onClick={() => setPagesDlg('blank')}><FilePlus2 size={14} /> {t('pagesview.folha_em_branco')}</button>
        <button className="btn sm" onClick={pickPdfToInsert}><FileStack size={14} /> {t('pagesview.inserir_pdf')}</button>
        <button className="btn sm" onClick={() => void extractSheets()}><FileOutput size={14} /> {some ? t('pagesview.extrair_selecao') : t('pagesview.extrair_todas')}</button>
        <button className="btn sm" onClick={() => setPagesDlg('split')}><Scissors size={14} /> {t('pagesview.dividir')}</button>
      </div>
      <div className="tb-cluster">
        <button className="btn sm" onClick={() => setPagesDlg('rename')}><Tags size={14} /> {t('pagesview.renomear')}</button>
        <button className="btn sm" onClick={sortByName} title={t('pagesview.ordenar_pelo_nome_da_folha')}><ArrowDownAZ size={14} /></button>
        <button className="btn sm" onClick={reverseOrder} title={t('pagesview.inverter_ordem')}><Undo size={14} /></button>
      </div>
    </div>
  )
}

/** Modo Pranchas: a grade de folhas (miniaturas reais). As ações (copiar, girar, excluir, inserir, extrair, renomear…) ficam na faixa de opções. */
export function PagesView() {
  const sheets = useStore((s) => s.sheets)
  const markups = useStore((s) => s.markups)
  const scales = useStore((s) => s.scales)
  const mobile = useIsMobile()
  const selected = usePagesSelected()
  const dlg = usePagesUi((u) => u.dlg)
  const busy = usePagesUi((u) => u.busy)
  const [dragIds, setDragIds] = useState<string[] | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  useEffect(() => () => { resetPagesTransient(); setPagesBusy(null) }, [])

  if (!sheets.length) return <div className="pages-view empty rx"><p className="vz">{t('pagesview.abra_um_pdf_para_gerenciar')}</p></div>

  const lastIndex = lastSelectedIndex()
  const target = selected.length ? selected : sheets.map((x) => x.id)
  return (
    <div className="pages-view">
      {mobile && <MobileBar selected={selected} total={sheets.length} />}
      <div className="rx pgr" role="listbox" aria-multiselectable="true" aria-label={t('pagesview.grade_de_folhas')} onClick={(e) => e.target === e.currentTarget && clearSheetSel()}>
        {sheets.map((sh, i) => {
          const isSel = selected.includes(sh.id)
          const n = markups.filter((m) => m.page === sh.id).length
          const scale = scales[sh.id]?.label
          const fm = formatOf(sh)
          const landscape = sh.width >= sh.height
          return (
            <div
              key={sh.id}
              role="option"
              aria-selected={isSel}
              className={`fo${isSel ? ' sel' : ''}${dragIds?.includes(sh.id) ? ' dragging' : ''}${dropAt === i ? ' drop-before' : ''}${dropAt === i + 1 && i === sheets.length - 1 ? ' drop-after' : ''}`}
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
                if (dragIds && dropAt !== null) moveSheets(dragIds, dropAt)
                setDragIds(null)
                setDropAt(null)
              }}
              onDragEnd={() => {
                setDragIds(null)
                setDropAt(null)
              }}
              onClick={(e) => clickSheet(e, sh.id)}
              onDoubleClick={() => setModeAnimated('review', { page: i })}
            >
              <div className="fo-p"><Thumb sheet={sh} width={252} /></div>
              <div className="fo-c">
                <span className="fo-n">{String(i + 1).padStart(2, '0')}</span>
                {editing === sh.id ? (
                  <input
                    className="fo-in"
                    autoFocus
                    defaultValue={sh.label}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== sh.label) renameSheet(sh.id, v)
                      setEditing(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <span className="fo-l" title={t('pagesview.duplo_clique_para_renomear')} onDoubleClick={(e) => { e.stopPropagation(); setEditing(sh.id) }}>{sh.label}</span>
                )}
                <span className="fo-e" data-warn={scale ? undefined : ''}>{scale ?? t('topbar.sem_escala').toLowerCase()}</span>
              </div>
              <div className="fo-d">
                <span>{fm.name ? `${fm.name} ` : `${fm.dims} `}{landscape ? t('pagesview.paisagem').toLowerCase() : t('pagesview.retrato').toLowerCase()}{sh.rot !== 0 && <> · <b>{sh.rot}°</b></>}</span>
                <span>{n > 0 ? tp('pal.n_marcacoes', n) : t('pagesview.sem_marcacoes')}</span>
              </div>
            </div>
          )
        })}
      </div>

      {busy && <div className="busy">{busy}</div>}
      {dlg === 'blank' && <BlankDialog after={lastIndex} ref0={sheets[lastIndex]} onClose={() => setPagesDlg(null)} />}
      {dlg === 'rename' && <RenameDialog ids={target} onClose={() => setPagesDlg(null)} />}
      {dlg === 'split' && <SplitDialog onClose={() => setPagesDlg(null)} setBusy={setPagesBusy} />}
    </div>
  )
}
