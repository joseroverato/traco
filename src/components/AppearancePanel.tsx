import { Moon, Sun } from 'lucide-react'
import { useStore } from '../store'
import { applyPalette, derive, usePalette } from '../theme'
import { withTransition } from '../motion'
import { t } from '../i18n'

const ACCENTS = [null, '#8b7bff', '#c084fc', '#ff5d9e', '#ff5a5f', '#ff8a3d', '#ffc247', '#3ecf8e', '#2ec5c5', '#38bdf8']
const PRIMARIES = [null, '#5b6b8c', '#4a6a7a', '#4f7a6a', '#7a4a5a', '#5c4a8a', '#8a6a4a', '#6a6a6a']
const DEFAULT_ACCENT = '#4d8dff'

function Swatches({ value, options, onPick, base }: { value: string | null; options: (string | null)[]; onPick: (c: string | null) => void; base: string }) {
  const custom = value && !options.includes(value)
  return (
    <div className="swatches" role="radiogroup">
      {options.map((c) => (
        <button key={c ?? 'default'} role="radio" aria-checked={value === c} aria-label={c ?? t('dialogs.cor_padrao')} title={c ?? t('dialogs.cor_padrao')} className={`swatch ${value === c ? 'on' : ''} ${c ? '' : 'default'}`} style={{ background: c ?? base }} onClick={() => onPick(c)} />
      ))}
      <label className={`swatch pick ${custom ? 'on' : ''}`} title={t('dialogs.cor_personalizada')} style={custom ? { background: value! } : undefined}>
        <input type="color" aria-label={t('dialogs.cor_personalizada')} value={value ?? base} onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  )
}

/** Aba "Aparência" das configurações: tema, cor principal e cor de acento. Tudo vale na hora, para o app inteiro por trás da janela. */
export function AppearancePanel() {
  const theme = useStore((s) => s.theme)
  const set = useStore((s) => s.set)
  const { primary, accent, set: setPalette, reset } = usePalette()

  const pickTheme = (next: 'dark' | 'light') => {
    if (next === theme) return
    try {
      localStorage.setItem('traco.theme', JSON.stringify(next))
    } catch {
      /* sem storage */
    }
    withTransition(() => {
      document.documentElement.dataset.theme = next
      applyPalette(next)
      set({ theme: next })
    }, 'theme')
  }
  const d = derive(theme, { primary, accent })
  const changed = !!(primary || accent)

  return (
    <div className="appearance">
      <section>
        <h4>{t('dialogs.tema')}</h4>
        <div className="seg">
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => pickTheme('dark')}><Moon size={14} /> {t('topbar.tema_escuro')}</button>
          <button className={theme === 'light' ? 'active' : ''} onClick={() => pickTheme('light')}><Sun size={14} /> {t('topbar.tema_claro')}</button>
        </div>
      </section>
      <section>
        <h4>{t('dialogs.cor_principal')}</h4>
        <p className="muted">{t('dialogs.cor_principal_ajuda')}</p>
        <Swatches value={primary} options={PRIMARIES} base={theme === 'dark' ? '#2a2a2e' : '#e4e6ea'} onPick={(c) => setPalette({ primary: c })} />
      </section>
      <section>
        <h4>{t('dialogs.cor_de_acento')}</h4>
        <p className="muted">{t('dialogs.cor_de_acento_ajuda')}</p>
        <Swatches value={accent} options={ACCENTS} base={DEFAULT_ACCENT} onPick={(c) => setPalette({ accent: c })} />
      </section>
      <section>
        <h4>{t('dialogs.previa')}</h4>
        <div className="appearance-preview">
          <button className="btn primary sm">{t('dialogs.concluir')}</button>
          <span className="chip accent">12</span>
          <span className="link">{t('dialogs.cor_de_acento')}</span>
          <span className="muted">{t('dialogs.cor_principal')}</span>
        </div>
        {accent && d.onAccent && d.accentText && (
          <p className="muted legibility">{t('dialogs.legibilidade', { a: d.onAccent.toFixed(1), b: d.accentText.toFixed(1) })}</p>
        )}
      </section>
      {changed && <button className="btn ghost" onClick={reset}>{t('dialogs.restaurar_cores')}</button>}
    </div>
  )
}
