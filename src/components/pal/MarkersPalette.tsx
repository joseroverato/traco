import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useStore } from '../../store'
import type { Preset } from '../../types'
import { Glyph, Icon } from '../Icon'
import { Sample } from './Sample'
import { iconOf } from './model'
import { unitName } from '../../units'
import { activatePreset, deletePreset, duplicatePreset, editPreset, exportLibrary, importLibrary, newPreset, presetInUse, resetLibrary } from '../../presetLib'
import { t } from '../../i18n'
import { useMenu } from './useMenu'
import type { MenuItem } from '../ContextMenu'

/** Biblioteca de marcadores de quantitativo por grupo: buscar, Novo, Biblioteca ▾; o marcador em uso fica realçado. */
export function MarkersPalette() {
  const presets = useStore((s) => s.presets)
  const activePreset = useStore((s) => s.activePreset)
  const tool = useStore((s) => s.tool)
  const [q, setQ] = useState('')
  const [shut, setShut] = useState<Record<string, boolean>>({})
  const menu = useMenu()

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = presets.filter((p) => !needle || `${p.name} ${p.group} ${p.code}`.toLowerCase().includes(needle))
    return Array.from(new Set(presets.map((p) => p.group))).map((g) => ({ g, items: list.filter((p) => p.group === g) })).filter((x) => x.items.length)
  }, [presets, q])

  const libraryItems = (): MenuItem[] => [
    { title: t('pal.biblioteca') },
    { id: 'new', label: t('pal.novo_marcador'), iconId: 'novoMarcador', onClick: newPreset },
    { id: 'imp', label: t('rightpanel.importar'), iconId: 'importar', onClick: importLibrary },
    { id: 'exp', label: t('rightpanel.exportar'), iconId: 'exportar', onClick: exportLibrary },
    { id: 'def', label: t('rightpanel.padrao'), iconId: 'padrao', danger: true, onClick: resetLibrary },
  ]
  const onPreset = (e: MouseEvent, p: Preset) => {
    e.preventDefault()
    e.stopPropagation()
    menu.open(e.clientX, e.clientY, [
      { id: 'edit', label: t('pal.editar_marcador'), iconId: 'marcadores', onClick: () => editPreset(p.id) },
      { id: 'dup', label: t('rightpanel.duplicar'), iconId: iconOf('duplicate'), onClick: () => duplicatePreset(p) },
      { id: 'del', label: t('rightpanel.excluir'), iconId: iconOf('delete'), danger: true, onClick: () => deletePreset(p.id) },
      { sep: true },
      ...libraryItems(),
    ])
  }
  const libButton = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    menu.open(r.left, r.bottom + 2, libraryItems().filter((i) => !('id' in i) || i.id !== 'new'))
  }

  return (
    <div onContextMenu={(e) => { e.preventDefault(); menu.open(e.clientX, e.clientY, libraryItems()) }}>
      <div className="pbar">
        <input className="in" type="search" placeholder={t('pal.buscar')} aria-label={t('rightpanel.buscar_marcador')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="tbn" title={t('pal.novo_marcador')} onClick={newPreset}><Icon name="novoMarcador" size={16} />{t('rightpanel.novo')}</button>
        <button type="button" className="tbn txt" aria-haspopup="menu" onClick={libButton}>{t('pal.biblioteca')}<Glyph name="down" size={10} /></button>
      </div>
      <div className="bib" role="list">
        {groups.length === 0 && <p className="pvz">{t('pal.nenhum_marcador')}</p>}
        {groups.map(({ g, items }) => {
          const closed = !!shut[g] && !q
          return (
            <div key={g} role="listitem">
              <button type="button" className="bg-t" aria-expanded={!closed} onClick={() => setShut((o) => ({ ...o, [g]: !o[g] }))}>
                <Glyph name={closed ? 'right' : 'down'} size={10} />
                <span>{g}</span>
                <em>{items.length}</em>
              </button>
              {!closed && items.map((p) => (
                <button key={p.id} type="button" className={`bm${presetInUse(activePreset, tool, p) ? ' on' : ''}`} aria-pressed={presetInUse(activePreset, tool, p)} title={p.code ? `${p.name} · ${p.code}` : p.name} onClick={() => activatePreset(p)} onContextMenu={(e) => onPreset(e, p)}>
                  <Sample p={p} />
                  <span className="bn">{p.name}</span>
                  <span className="bd">{unitName(p.resultUnit)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      {menu.element}
    </div>
  )
}
