import { useDeferredValue, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useStore } from '../../store'
import type { Markup, MarkupKind, Preset, Sheet } from '../../types'
import { Glyph, Icon } from '../Icon'
import { Sample } from './Sample'
import { KIND_ICON, iconOf, markupNames, sheetTitle, valueOf } from './model'
import { selectMarkup } from './select'
import { rotateSheets, deleteSheet } from '../../sheetOps'
import { t } from '../../i18n'
import { useMenu } from './useMenu'
import type { MenuItem } from '../ContextMenu'

type Row =
  | { k: 'sheet'; key: string; sh: Sheet; i: number; open: boolean; expandable: boolean }
  | { k: 'group'; key: string; level: 1; open: boolean; label: string; preset?: Preset; icon?: string; des?: boolean; vz?: boolean; count?: number }
  | { k: 'item'; key: string; level: 2; m: Markup; name: string; value: string; vz: boolean }

const ANNOTATION_KINDS: MarkupKind[] = ['cloud', 'rect', 'ellipse', 'arrow', 'line', 'text', 'stamp', 'image', 'redact', 'legend']

/** Árvore folha → marcador → medição (GUIA 4: recuo = 3 + nível × 11 px). Nas Pranchas mostra só as folhas. */
export function NavigatorPalette() {
  const sheets = useStore((s) => s.sheets)
  const page = useStore((s) => s.page)
  const mode = useStore((s) => s.mode)
  const scales = useStore((s) => s.scales)
  const presets = useStore((s) => s.presets)
  const selected = useStore((s) => s.selected)
  const tool = useStore((s) => s.tool)
  const activePreset = useStore((s) => s.activePreset)
  const markups = useDeferredValue(useStore((s) => s.markups))
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const menu = useMenu()

  const names = useMemo(() => markupNames(markups), [markups])
  const rows = useMemo(() => {
    const out: Row[] = []
    const isOpen = (key: string, dflt: boolean) => openMap[key] ?? dflt
    sheets.forEach((sh, i) => {
      const mine = markups.filter((m) => m.page === sh.id)
      const expandable = mode !== 'pages' && mine.length > 0
      const open = expandable && isOpen(`s:${sh.id}`, i === page)
      out.push({ k: 'sheet', key: `s:${sh.id}`, sh, i, open, expandable })
      if (!open) return
      // marcadores (na ordem em que aparecem), depois ambientes, sólidos, anotações e viewports
      const byPreset = new Map<string, Markup[]>()
      const spaces: Markup[] = [], solids: Markup[] = [], notes: Markup[] = [], vps: Markup[] = []
      for (const m of mine) {
        if (m.kind === 'viewport') vps.push(m)
        else if (m.kind === 'space') spaces.push(m)
        else if (m.kind === 'solid') solids.push(m)
        else if (ANNOTATION_KINDS.includes(m.kind)) notes.push(m)
        else { const k = m.presetId ?? ''; byPreset.set(k, [...(byPreset.get(k) ?? []), m]) }
      }
      const pushItems = (list: Markup[]) => {
        for (const m of list) {
          const v = valueOf(m, markups, scales, presets)
          out.push({ k: 'item', key: m.id, level: 2, m, name: names.get(m.id) ?? '', value: v ? `${v.text}${v.unit ? ' ' + v.unit : ''}` : '', vz: !!v && !v.ok })
        }
      }
      const group = (key: string, label: string, list: Markup[], extra: Partial<Extract<Row, { k: 'group' }>> = {}) => {
        const gk = `g:${sh.id}:${key}`
        const open2 = isOpen(gk, true)
        out.push({ k: 'group', key: gk, level: 1, open: open2, label, count: list.length, ...extra })
        if (open2) pushItems(list)
      }
      for (const [pid, list] of byPreset) {
        const p = presets.find((x) => x.id === pid)
        group(pid || '_', p?.name ?? t('pal.sem_marcador'), list, { preset: p, des: !!p && activePreset === p.id && tool === p.measure })
      }
      if (spaces.length) group('space', t('kinds.ambiente'), spaces, { icon: iconOf('space') })
      if (solids.length) group('solid', t('pal.solidos_3d'), solids, { icon: 'solido' })
      if (notes.length) group('notes', t('pal.anotacoes'), notes, { icon: 'texto' })
      const gk = `g:${sh.id}:vp`
      const vOpen = vps.length > 0 && isOpen(gk, true)
      out.push({ k: 'group', key: gk, level: 1, open: vOpen, label: t('pal.viewports'), icon: 'viewport', vz: vps.length === 0, count: vps.length })
      if (vOpen) for (const m of vps) out.push({ k: 'item', key: m.id, level: 2, m, name: m.text.trim() || (names.get(m.id) ?? ''), value: m.scale?.label ?? '', vz: !m.scale })
    })
    return out
  }, [sheets, page, mode, markups, names, scales, presets, openMap, activePreset, tool])

  const toggle = (key: string, now: boolean) => setOpenMap((o) => ({ ...o, [key]: !now }))

  const openSheet = (sh: Sheet, i: number, expand: boolean) => {
    const st = useStore.getState()
    st.set({ page: i, selected: [] })
    if (expand) setOpenMap((o) => (o[`s:${sh.id}`] === false || (o[`s:${sh.id}`] === undefined && i !== st.page) ? { ...o, [`s:${sh.id}`]: true } : o))
  }

  const sheetMenu = (e: MouseEvent, sh: Sheet, i: number): void => {
    e.preventDefault()
    e.stopPropagation()
    const st = useStore.getState()
    st.set({ page: i, selected: [] }) // "Folha atual" passa a ser a que recebeu o botão direito
    const items: MenuItem[] = [
      { title: t('leftpanel.folha_atual') },
      { id: 'rot-r', label: t('leftpanel.girar_a_direita'), iconId: 'girarDir', onClick: () => rotateSheets([sh.id], 90) },
      { id: 'rot-l', label: t('leftpanel.girar_a_esquerda'), iconId: 'girarEsq', onClick: () => rotateSheets([sh.id], -90) },
      { sep: true },
      { id: 'del', label: t('leftpanel.excluir_folha'), iconId: iconOf('delete'), danger: true, disabled: st.sheets.length < 2, onClick: () => deleteSheet(sh.id) },
    ]
    menu.open(e.clientX, e.clientY, items)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement
    if (!el.classList.contains('tr-row')) return
    const all = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.tr-row'))
    const i = all.indexOf(el)
    const go = (n: number) => { e.preventDefault(); all[Math.max(0, Math.min(all.length - 1, n))]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(all.length - 1)
    else if (e.key === 'ArrowRight' && el.getAttribute('aria-expanded') === 'false') { e.preventDefault(); el.querySelector<HTMLElement>('.tw')?.click() }
    else if (e.key === 'ArrowLeft' && el.getAttribute('aria-expanded') === 'true') { e.preventDefault(); el.querySelector<HTMLElement>('.tw')?.click() }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click() }
    else if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') { e.preventDefault(); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 24, clientY: r.bottom })) }
  }

  if (!sheets.length) return <p className="pvz">{t('leftpanel.nenhum_documento_aberto')}</p>

  return (
    <div className="tree" role="tree" aria-label={t('pal.navegador_do_projeto')} onKeyDown={onKey}>
      {rows.map((r) => {
        if (r.k === 'sheet') {
          const sc = scales[r.sh.id]
          const active = r.i === page
          return (
            <div
              key={r.key}
              className={`tr-row${active ? ' ativa' : ''}${!sc ? ' alerta' : ''}`}
              role="treeitem"
              aria-level={1}
              aria-selected={active}
              aria-expanded={r.expandable ? r.open : undefined}
              tabIndex={active ? 0 : -1}
              style={{ paddingLeft: 3 }}
              onClick={() => openSheet(r.sh, r.i, true)}
              onContextMenu={(e) => sheetMenu(e, r.sh, r.i)}
            >
              <span className="tw" onClick={(e) => { if (r.expandable) { e.stopPropagation(); toggle(r.key, r.open) } }}>{r.expandable && <Glyph name={r.open ? 'down' : 'right'} size={10} />}</span>
              <Icon name="folhaIco" size={16} />
              <span className="tx">{sheetTitle(sheets, r.sh)}</span>
              <span className="tv" title={sc ? undefined : t('pal.folha_sem_escala')}>{sc ? sc.label : t('pal.sem_escala')}</span>
            </div>
          )
        }
        if (r.k === 'group') {
          const expandable = (r.count ?? 0) > 0
          return (
            <div
              key={r.key}
              className={`tr-row${r.des ? ' des' : ''}${r.vz ? ' vz' : ''}`}
              role="treeitem"
              aria-level={2}
              aria-expanded={expandable ? r.open : undefined}
              tabIndex={-1}
              style={{ paddingLeft: 3 + 11 }}
              onClick={() => expandable && toggle(r.key, r.open)}
            >
              <span className="tw">{expandable && <Glyph name={r.open ? 'down' : 'right'} size={10} />}</span>
              {r.preset ? <Sample p={r.preset} /> : <Icon name={r.icon ?? 'marcadores'} size={16} />}
              <span className="tx">{r.label}</span>
              {r.vz && <span className="tv">{r.count ?? 0}</span>}
            </div>
          )
        }
        const sel = selected.includes(r.m.id)
        return (
          <div
            key={r.key}
            className={`tr-row${sel ? ' sel' : ''}${r.vz ? ' vz' : ''}`}
            role="treeitem"
            aria-level={3}
            aria-selected={sel}
            tabIndex={-1}
            style={{ paddingLeft: 3 + 22 }}
            onClick={() => selectMarkup(r.m)}
          >
            <span className="tw" />
            <Icon name={KIND_ICON[r.m.kind]} size={16} />
            <span className="tx">{r.name}</span>
            {r.value && <span className="tv">{r.value}</span>}
          </div>
        )
      })}
      {menu.element}
    </div>
  )
}
