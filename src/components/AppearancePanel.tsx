import { useState } from 'react'
import { useStore } from '../store'
import { applyPalette, derive, glassEnabled, setGlass, usePalette } from '../theme'
import { withTransition } from '../motion'
import { t } from '../i18n'
import { Chk, Rad } from './Dlg'
import { Icon } from './Icon'

// valores de fábrica por tema: servem de ponto de partida do seletor de cor quando ainda não há cor escolhida
const BASE_PRIMARY = { dark: '#2d2e31', light: '#cacdd1' }
const BASE_ACCENT = { dark: '#6cc0dc', light: '#075a73' }

/** Linha de uma cor: amostra e nome (Padrão ou o valor) + "Personalizada…" (abre o seletor do sistema) + volta ao padrão. */
function ColorRow({ value, base, sample, label, onPick }: { value: string | null; base: string; sample: string; label: string; onPick: (c: string | null) => void }) {
  return (
    <div className="vv">
      <span className="cor fl1"><i className="cz" style={{ background: value ?? sample }} /><span className="n">{value ? value.toUpperCase() : t('dialogs.cor_padrao')}</span></span>
      <label className="tbn txt pickl">{t('dialogs.cor_personalizada')}…<input type="color" aria-label={`${label}: ${t('dialogs.cor_personalizada')}`} value={value ?? base} onChange={(e) => onPick(e.target.value)} /></label>
      {value && <button type="button" className="tbn txt" onClick={() => onPick(null)}>{t('dialogs.cor_padrao')}</button>}
    </div>
  )
}

/** Aba "Aparência" das configurações: tema, vidro, cor principal e cor de acento, com uma prévia da faixa, de uma lista e da barra. Tudo vale na hora, para o app inteiro por trás da janela. */
export function AppearancePanel() {
  const theme = useStore((s) => s.theme)
  const set = useStore((s) => s.set)
  const presets = useStore((s) => s.presets)
  const { primary, accent, set: setPalette } = usePalette()

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
  const [glass, setGlassOn] = useState(glassEnabled)
  const toggleGlass = (on: boolean) => {
    setGlassOn(on)
    withTransition(() => setGlass(on), 'theme')
  }
  const d = derive(theme, { primary, accent })
  const sample = presets.slice(0, 3)

  return (
    <div className="c2c">
      <div className="col">
        <div className="gbx"><h3>{t('dialogs.tema')}</h3>
          <div className="opc h" role="radiogroup" aria-label={t('dialogs.tema')}>
            <Rad name="tema" checked={theme === 'dark'} onChange={() => pickTheme('dark')}>{t('topbar.tema_escuro')}</Rad>
            <Rad name="tema" checked={theme === 'light'} onChange={() => pickTheme('light')}>{t('topbar.tema_claro')}</Rad>
          </div>
        </div>
        <div className="gbx"><h3>{t('dialogs.efeitos')}</h3>
          <Chk checked={glass} onChange={toggleGlass}>{t('dialogs.vidro')}</Chk>
          <p>{t('dialogs.vidro_ajuda')}</p>
        </div>
        <div className="gbx"><h3>{t('dialogs.cor_principal')}</h3>
          <p>{t('dialogs.cor_principal_ajuda')}</p>
          <ColorRow value={primary} base={BASE_PRIMARY[theme]} sample="var(--pal)" label={t('dialogs.cor_principal')} onPick={(c) => setPalette({ primary: c })} />
        </div>
        <div className="gbx"><h3>{t('dialogs.cor_de_acento')}</h3>
          <p>{t('dialogs.cor_de_acento_ajuda')}</p>
          <ColorRow value={accent} base={BASE_ACCENT[theme]} sample="var(--ac)" label={t('dialogs.cor_de_acento')} onPick={(c) => setPalette({ accent: c })} />
        </div>
      </div>
      <div className="col">
        <div className="gbx fl1"><h3>{t('dialogs.previa')}</h3>
          <div className="pvw" inert aria-hidden="true">
            <div className="dtabs"><button type="button" className="on" tabIndex={-1}>{t('ribbon.t_inicio')}</button><button type="button" tabIndex={-1}>{t('ribbon.t_anotar')}</button><button type="button" tabIndex={-1}>{t('ribbon.t_exibir')}</button></div>
            <div className="pv-r">
              <button className="bb on" type="button" tabIndex={-1}><Icon name="area" size={32} /><span className="bl">{t('railtools.area')}</span></button>
              <button className="bb" type="button" tabIndex={-1}><Icon name="comprimento" size={32} /><span className="bl">{t('railtools.comprimento')}</span></button>
            </div>
            <div className="pv-b">
              {sample.length > 0 && (
                <div className="lbx">
                  {sample.map((p, i) => <div key={p.id} className={`lbi ${i === 0 ? 'on' : ''}`}>{p.name}<span className="lbd">{p.resultUnit}</span></div>)}
                </div>
              )}
              <div className="l1"><span className="btn pri">{t('dialogs.concluir')}</span><span className="chp">12</span><span className="lc">{t('dialogs.cor_de_acento')}</span></div>
            </div>
            <div className="pv-s"><span className="mut">{t('dialogs.previa_cor_principal')}</span></div>
          </div>
          {accent && d.onAccent && d.accentText && <p>{t('dialogs.legibilidade', { a: d.onAccent.toFixed(1), b: d.accentText.toFixed(1) })}</p>}
        </div>
      </div>
    </div>
  )
}
