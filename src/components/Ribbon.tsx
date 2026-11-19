import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { State } from '../store'
import { Glyph, Icon } from './Icon'
import { RichTip } from './RichTip'
import { RIBBON_TABS, activeTab, groupsFor, selectTab } from '../ribbon'
import { nameOf, ribbonIcon } from '../ribbon'
import type { RibbonBtn, RibbonNum, RibbonSel, RibbonTxt } from '../ribbon'
import { SelectCb } from './pal/SelectCb'
import { usePagesUi } from '../pagesUi'
import { useCompareUi, useCompareShare } from '../compareShare'
import { useView3dUi } from '../view3dUi'
import { useClaudeBusy } from '../claudeCmd'
import { keyOf, useKeymap } from '../hotkeys'
import { requestCloseProject, saveProject } from '../project'
import { readRecoveryInfo } from '../autosave'
import { t } from '../i18n'

/** Rótulo de botão grande em até duas linhas: quebra no espaço mais perto do meio (a base da faixa usa .b2 no lugar de <br>). */
function splitLabel(text: string): [string, string] {
  if (text.length <= 10 || !text.includes(' ')) return [text, '']
  const mid = text.length / 2
  let best = -1
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  return [text.slice(0, best), text.slice(best + 1)]
}

/** Limpar a seleção: o retângulo tracejado com o X vermelho da maquete (não há ícone dele no sprite). */
function Limpar() {
  return (
    <svg className="ic" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.5 2.5H13.5V13.5H2.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeDasharray="2.2 1.8" />
      <path d="M5.6 5.6L10.4 10.4M10.4 5.6L5.6 10.4" fill="none" stroke="var(--err)" strokeWidth="1.6" />
    </svg>
  )
}

/** Parar: o quadrado vermelho de interromper (sem ícone no sprite). */
function Parar() {
  return (
    <svg className="ic" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <rect x="5.7" y="5.7" width="4.6" height="4.6" fill="var(--err)" />
    </svg>
  )
}

function Btn({ b, s }: { b: RibbonBtn; s: State }) {
  const label = b.label()
  const on = b.active?.(s) ?? false
  const sel = b.sel?.(s) ?? false
  const key = b.tool ? keyOf(b.tool) : b.keyHint
  const full = b.tip?.() ?? label
  const title = key ? `${full} (${key})` : full
  const disabled = b.disabled?.(s) ?? false
  const checked = b.check?.(s)
  const toggle = b.active !== undefined || b.sel !== undefined
  const common = {
    type: 'button' as const,
    disabled,
    title: b.tool ? undefined : title,
    'aria-label': full,
    'aria-pressed': b.sel || b.check ? undefined : toggle ? on : undefined,
    role: b.sel ? ('radio' as const) : b.check ? ('checkbox' as const) : undefined,
    'aria-checked': b.sel ? sel : b.check ? !!checked : undefined,
    onClick: () => void b.run(),
  }
  let el: React.ReactElement<React.HTMLAttributes<HTMLElement>>
  if (b.big) {
    const [l1, l2] = splitLabel(label)
    el = (
      <button {...common} className={`bb${on ? ' on' : ''}`}>
        <Icon name={b.icon} size={32} />
        <span className="bl">{l1}{l2 && <span className="b2">{l2}</span>}</span>
      </button>
    )
  } else {
    el = (
      <button {...common} className={`sb${on ? ' on' : ''}${sel ? ' sel' : ''}`}>
        {b.check ? <span className={`ck${checked ? ' on' : ''}`}>{checked && <Glyph name="check" size={10} />}</span> : b.icon === '@limpar' ? <Limpar /> : b.icon === '@parar' ? <Parar /> : <Icon name={b.icon} size={16} />}
        <span className="sl">{label}{key && b.tool && <> <kbd>({key})</kbd></>}{key && !b.tool && b.keyHint && <> <kbd>({b.keyHint})</kbd></>}</span>
        {b.count && <span className="cnt n">{b.count()}</span>}
        {b.menu && <Glyph name="down" size={10} />}
      </button>
    )
  }
  return b.tool ? <RichTip tool={b.tool} shortcut={key} side="below">{el}</RichTip> : el
}

/** Campo numérico de um grupo contextual. Guarda o texto enquanto a pessoa digita (para aceitar "0," e "0.0") e só grava valores válidos. */
function Num({ f, s }: { f: RibbonNum; s: State }) {
  const value = f.value(s)
  const [txt, setTxt] = useState(String(value))
  useEffect(() => setTxt((cur) => (Number(cur.replace(',', '.')) === value ? cur : String(value))), [value])
  return (
    <label className="nf">
      <span className="k">{f.label()}</span>
      <span className="nfi">
        <input
          type="text"
          inputMode="decimal"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value)
            const n = Number(e.target.value.replace(',', '.'))
            if (e.target.value.trim() !== '' && Number.isFinite(n)) f.set(Math.min(f.max, Math.max(f.min, n)))
          }}
          onBlur={() => setTxt(String(f.value(useStore.getState())))}
        />
        <em>{f.unit}</em>
      </span>
    </label>
  )
}

/** Lista suspensa da faixa: campo fechado (.cb) com o <select> nativo por cima; com ícone grande e linha de apoio nas revisões. */
function Sel({ f }: { f: RibbonSel }) {
  const lead = f.label()
  return (
    <div className={`rvb${f.icon ? '' : ' nolead'}`}>
      {f.icon && <Icon name={f.icon} size={32} />}
      <div className="col" style={{ width: f.width }}>
        <span className="rl">{lead}</span>
        <SelectCb value={f.value} label={lead} current={f.current} onChange={f.set} disabled={f.disabled}>
          {f.groups.map((g, i) => g.label
            ? <optgroup key={i} label={g.label}>{g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
            : g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>))}
        </SelectCb>
        {f.sub && <span className="rs2">{f.sub}</span>}
      </div>
    </div>
  )
}

function Txt({ f }: { f: RibbonTxt }) {
  return <div className="rtx" role="status">{f.text}</div>
}

interface FileItem { id: string; label: string; icon: string; kbd?: string; disabled?: boolean; run: () => void; sepBefore?: boolean }

/** Botão Arquivo e seu menu: Abrir, Salvar, Exportar, Recuperar, Fechar e Configurações. */
function FileMenu({ onOpen }: { onOpen: () => void }) {
  const has = useStore((s) => s.sheets.length > 0)
  const hasMarks = useStore((s) => s.markups.length > 0)
  const [open, setOpen] = useState(false)
  const [canRecover, setCanRecover] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    let alive = true
    void readRecoveryInfo().then((i) => alive && setCanRecover(!!i))
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const down = (e: PointerEvent) => {
      const n = e.target as Node
      if (!menu.current?.contains(n) && !btn.current?.contains(n)) setOpen(false)
    }
    document.addEventListener('pointerdown', down, true)
    return () => { alive = false; document.removeEventListener('pointerdown', down, true) }
  }, [open])
  const set = useStore.getState().set
  const items: FileItem[] = [
    { id: 'open', label: nameOf(t('topbar.abrir_ctrl_o')), icon: ribbonIcon('open'), kbd: 'Ctrl+O', run: onOpen },
    { id: 'save', label: t('leftpanel.salvar_projeto'), icon: ribbonIcon('save'), kbd: t('leftpanel.ctrl_s'), disabled: !has, run: () => void saveProject() },
    { id: 'saveAs', label: t('leftpanel.salvar_projeto_como'), icon: ribbonIcon('saveAs'), kbd: t('leftpanel.ctrl_s_2'), disabled: !has, run: () => void saveProject(true) },
    { id: 'pdf', label: t('leftpanel.exportar_pdf'), icon: ribbonIcon('exportPdf'), kbd: t('leftpanel.ctrl_e'), disabled: !has, sepBefore: true, run: () => set({ dialog: 'export' }) },
    { id: 'xlsx', label: t('leftpanel.exportar_quantitativo_excel'), icon: ribbonIcon('sheet'), disabled: !hasMarks, run: async () => { const s = useStore.getState(); (await import('../xlsxExport')).exportXlsx(s.fileName, s.markups.filter((m) => m.kind !== 'viewport'), s.presets, s.scales, s.sheets) } },
    { id: 'recover', label: t('dialogs.recuperar_trabalho_nao_salvo'), icon: ribbonIcon('recover'), disabled: !canRecover, sepBefore: true, run: () => set({ dialog: 'recover' }) },
    { id: 'close', label: t('project.fechar_projeto'), icon: ribbonIcon('closeProject'), kbd: 'Ctrl+W', disabled: !has, sepBefore: true, run: requestCloseProject },
    { id: 'settings', label: t('dialogs.configuracoes'), icon: ribbonIcon('settings'), sepBefore: true, run: () => set({ dialog: 'updates' }) },
  ]
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); return }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
  }
  return (
    <>
      <button ref={btn} type="button" className={`am-btn${open ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t('ribbon.arquivo')}<Glyph name="down" size={10} />
      </button>
      {open && (
        <div ref={menu} className="mn amn" role="menu" onKeyDown={onKey}>
          {items.map((it) => (
            <div key={it.id} role="none">
              {it.sepBefore && <div className="mn-s" role="separator" />}
              <button type="button" role="menuitem" className={`mn-i${it.disabled ? ' off' : ''}`} disabled={it.disabled} onClick={() => { setOpen(false); it.run() }}>
                <span className="mn-v"><Icon name={it.icon} size={16} /></span>
                <span className="sl">{it.label}</span>
                {it.kbd && <kbd>{it.kbd}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/** Abas da faixa e a faixa de opções com os grupos da aba (R3). Substitui o seletor de modos e o trilho de ferramentas. */
export function Ribbon({ onOpen }: { onOpen: () => void }) {
  const s = useStore()
  useKeymap() // as dicas e os atalhos mostrados acompanham as letras que a pessoa trocou
  // Pranchas, Comparar e 3D: os botões dependem do estado dessas views (seleção de folhas, revisões A e B, camadas); a faixa refaz junto
  usePagesUi(); useCompareUi(); useCompareShare(); useView3dUi(); useClaudeBusy()
  const has = s.sheets.length > 0
  const tab = activeTab(s)
  const groups = groupsFor(tab, s)
  return (
    <>
      <div className="rt">
        <FileMenu onOpen={onOpen} />
        <div className="rt-l" role="tablist" aria-label={t('ribbon.faixa')}>
          {RIBBON_TABS.map((x) => {
            const isMode = x.id === 'pranchas' || x.id === 'comparar' || x.id === '3d'
            return (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} disabled={isMode && !has} onClick={() => selectTab(x.id)}>
                {x.id === 'claude' && <Icon name="claude" size={16} />}
                {x.label()}
              </button>
            )
          })}
        </div>
      </div>
      <div className="rb" role="tabpanel" aria-label={t('ribbon.faixa')}>
        {groups.map((g) => (
          <div key={g.id} className={`grp${g.ctx ? ' ctx' : ''}`} role="group" aria-label={g.label()} data-grp={g.id}>
            <div className="gb">
              {g.cells.map((c, i) =>
                c === 'sep' ? <span key={i} className="vs2" />
                : Array.isArray(c) ? <div key={i} className="stk">{c.map((b) => <Btn key={b.id} b={b} s={s} />)}</div>
                : 'kind' in c ? (c.kind === 'num' ? <Num key={c.id} f={c} s={s} /> : c.kind === 'sel' ? <Sel key={c.id} f={c} /> : <Txt key={c.id} f={c} />)
                : <Btn key={c.id} b={c} s={s} />,
              )}
            </div>
            <div className="gn">{g.label()}</div>
          </div>
        ))}
      </div>
    </>
  )
}
