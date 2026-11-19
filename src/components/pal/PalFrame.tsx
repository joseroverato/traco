import type { ReactNode } from 'react'
import { Glyph, Icon } from '../Icon'
import { t } from '../../i18n'

/** Barra de título da paleta (25 px): pega, nome (clicar recolhe), contador, fixar e fechar. */
export function PalHeader({ title, count, onCollapse, pinned, onPin, onClose, extra }: {
  title: string
  count?: number | null
  onCollapse?: () => void
  pinned?: boolean
  onPin?: () => void
  onClose?: () => void
  extra?: ReactNode
}) {
  return (
    <header className="ph">
      <span className="grip" aria-hidden="true"><Glyph name="grip" size={12} /></span>
      <h2>
        {onCollapse
          ? <button type="button" className="ph-t" aria-expanded="true" title={t('pal.recolher_a_paleta')} onClick={onCollapse}>{title}</button>
          : title}
      </h2>
      {count != null && <span className="cnt">{count}</span>}
      <span className="sp" />
      {extra}
      {onPin && (
        <button type="button" className={`ib${pinned ? ' on' : ''}`} aria-pressed={pinned} aria-label={t('pal.fixar_a_paleta')} title={pinned ? t('pal.soltar_a_paleta') : t('pal.fixar_a_paleta')} onClick={onPin}>
          <Glyph name="pin" size={12} />
        </button>
      )}
      {onClose && (
        <button type="button" className="ib" aria-label={t('pal.fechar_a_paleta')} title={t('pal.fechar_a_paleta')} onClick={onClose}>
          <Glyph name="x" size={12} />
        </button>
      )}
    </header>
  )
}

/** Paleta recolhida: linha de 25 px no pé da coluna; o contador só aparece quando há o que contar. */
export function CollapsedRow({ title, icon, count, onOpen }: { title: string; icon: string; count?: number | null; onOpen: () => void }) {
  return (
    <button type="button" className="pcx" aria-expanded="false" title={t('pal.abrir_a_paleta')} onClick={onOpen}>
      <Glyph name="right" size={10} />
      <Icon name={icon} size={16} />
      <span>{title}</span>
      {count != null && <span className="cnt">{count}</span>}
    </button>
  )
}
