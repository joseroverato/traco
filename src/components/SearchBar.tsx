import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useStore } from '../store'
import { goTo, runSearch } from '../search'
import { t } from '../i18n'

/** Barra de busca (Ctrl+F) sobre a prancha. */
export function SearchBar() {
  const s = useStore((x) => x.search)
  const sheets = useStore((x) => x.sheets)
  const [q, setQ] = useState(s.query)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [s.open])
  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 220)
    return () => clearTimeout(t)
  }, [q])
  const close = () => useStore.setState({ search: { ...useStore.getState().search, open: false, hits: [] } })
  const cur = s.hits[s.index]
  const n = s.hits.length
  return (
    <div className="searchbar" onMouseDown={(e) => e.stopPropagation()}>
      <Search size={14} className="muted" />
      <input
        ref={input}
        value={q}
        placeholder={t('searchbar.buscar_texto_nas_folhas')}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); goTo(s.index + (e.shiftKey ? -1 : 1)) }
          if (e.key === 'Escape') { e.preventDefault(); close() }
        }}
      />
      <span className="muted small nowrap">{q.trim().length < 2 ? '' : n ? `${s.index + 1} de ${n}${cur ? ` · ${sheets.find((x) => x.id === cur.sheet)?.label ?? ''}` : ''}` : t('searchbar.nada_encontrado')}</span>
      <button className="icon-btn xs" data-tip={t('searchbar.anterior_shift_enter')} disabled={!n} onClick={() => goTo(s.index - 1)}><ChevronUp size={15} /></button>
      <button className="icon-btn xs" data-tip={t('searchbar.proximo_enter')} disabled={!n} onClick={() => goTo(s.index + 1)}><ChevronDown size={15} /></button>
      <button className="icon-btn xs" data-tip={t('searchbar.fechar_esc')} onClick={close}><X size={15} /></button>
    </div>
  )
}
