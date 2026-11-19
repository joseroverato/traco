import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { IS_DESKTOP, desktop } from '../platform'
import type { UpdateState } from '../platform'
import { startTour } from '../tour'
import { APP_VERSION, REPO_URL, THIRD_PARTY, releaseUrl, releasesUrl } from '../about'
import { LANGS, setLang, t, useLang } from '../i18n'
import type { Lang } from '../i18n'
import { Rich } from './Rich'
import { TOOLS } from '../railTools'
import { DEFAULT_KEYS, hasCustomKeys, resetKeys, setKey, useKeymap, validKey } from '../hotkeys'
import { copyDiagnostic } from '../diagnostics'
import { setUnits, useUnits } from '../units'
import type { UnitSystem } from '../units'
import { usePalette } from '../theme'
import { AppearancePanel } from './AppearancePanel'
import { ReleaseNotes } from './ReleaseNotes'
import { DTabs, Dlg } from './Dlg'
import { Icon } from './Icon'
import { SelectCb } from './pal/SelectCb'
import ICONS from '../ribbonIcons.json'

const close = () => useStore.setState({ dialog: null })

// ---------------------------------------------------------------- Atualizações (GitHub Releases)
const UPDATE_TEXT: Record<UpdateState['status'], string> = {
  get idle() { return t('dialogs.update_idle') },
  get checking() { return t('dialogs.update_checking') },
  get available() { return t('dialogs.update_available') },
  get latest() { return t('dialogs.update_latest') },
  get downloading() { return t('dialogs.update_downloading') },
  get ready() { return t('dialogs.update_ready') },
  get error() { return t('dialogs.update_error') },
}

function UpdatesPanel({ st, setSt }: { st: UpdateState; setSt: React.Dispatch<React.SetStateAction<UpdateState>> }) {
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const up = desktop?.update
  const newer = st.status === 'available' || st.status === 'ready'
  const saveToken = async () => {
    await desktop!.setSecret('github-token', token.trim())
    setToken('')
    setSaved(true)
    setSt((o) => ({ ...o, configured: !!token.trim() }))
    if (token.trim()) up?.check()
  }
  if (!up) return <p>{t('dialogs.a_versao_web_e_atualizada')}</p>
  return (
    <>
      <div className="gbx"><h3>{t('dialogs.atualizacoes')}</h3>
        <div className="kv"><span>{t('dialogs.versao_instalada')}</span><b className="n">{st.current ?? '—'}</b></div>
        <div className="kv"><span>{t('dialogs.situacao')}</span><b>{UPDATE_TEXT[st.status]}{newer ? ` (${st.version})` : ''}</b></div>
        {st.status === 'downloading' && <div className="progress" role="progressbar" aria-valuenow={st.percent ?? 0} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${st.percent ?? 0}%` }} /></div>}
        {st.status === 'error' && st.error && <p className="warnl" role="alert">{st.error}</p>}
        <div className="lin2">
          <button type="button" className="btn sm" disabled={st.status === 'checking' || st.status === 'downloading'} onClick={() => up.check()}>{t('dialogs.verificar_agora')}</button>
          {st.status === 'available' && <button type="button" className="btn sm pri" onClick={() => up.download()}>{t('dialogs.baixar', { version: st.version })}</button>}
          {st.status === 'ready' && <button type="button" className="btn sm pri" onClick={() => up.install()}>{t('dialogs.reiniciar_e_instalar')}</button>}
        </div>
        {st.notes && newer && <div className="notes"><ReleaseNotes source={st.notes} /></div>}
      </div>
      <div className="gbx"><h3>{t('dialogs.token_de_leitura')}{st.configured ? ` ${t('dialogs.token_configurado')}` : ''}</h3>
        <input className="in" type="password" autoComplete="off" aria-label={t('dialogs.token_de_leitura')} value={token} placeholder={st.configured ? t('dialogs.colar_outro_token_para_trocar') : t('dialogs.github_pat')} onChange={(e) => { setToken(e.target.value); setSaved(false) }} />
        <div className="lin2">
          <button type="button" className="btn sm pri" disabled={!token.trim()} onClick={() => void saveToken()}>{t('dialogs.salvar_token')}</button>
          {st.configured && <button type="button" className="btn sm" onClick={async () => { await desktop!.setSecret('github-token', ''); setSt((o) => ({ ...o, configured: false })) }}>{t('dialogs.remover_token')}</button>}
          {saved && <span className="nt" role="status">{t('dialogs.salvo_criptografado_neste_pc')}</span>}
        </div>
        <p><Rich k="dialogs.token_explicacao" /></p>
      </div>
    </>
  )
}

/** Letras de atalho das ferramentas: clicar numa ferramenta e apertar a nova letra. */
function KeysPanel({ listening, setListening, setMsg }: { listening: string | null; setListening: (v: string | null) => void; setMsg: (m: string) => void }) {
  useKeymap()
  useEffect(() => {
    if (!listening) return
    const h = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation() // senão o atalho global também dispararia
      if (e.key === 'Escape') return setListening(null)
      if (e.key.length !== 1 || !validKey(e.key)) return setMsg(t('dialogs.atalho_invalido'))
      const owner = setKey(listening, e.key)
      if (owner) return setMsg(t('dialogs.atalho_em_uso', { key: e.key.toUpperCase(), tool: TOOLS.find((x) => x.id === owner)?.label ?? owner }))
      setMsg('')
      setListening(null)
    }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [listening]) // eslint-disable-line react-hooks/exhaustive-deps
  const groups = [t('dialogs.grupo_selecao_e_vista'), t('ribbon.t_anotar'), t('leftpanel.medir')]
  return (
    <>
      <p>{t('dialogs.atalhos_ajuda')}</p>
      <div className="kg">
        <div className="ks">
          <table className="kt">
            <caption>{t('dialogs.ferramentas')} <span>· {t('dialogs.n_letras_trocaveis', { n: TOOLS.length })}</span></caption>
            <thead><tr><th scope="col" className="c0" /><th scope="col">{t('dialogs.comando')}</th><th scope="col" className="ct">{t('dialogs.tecla')}</th><th scope="col" className="cf">{t('dialogs.de_fabrica')}</th></tr></thead>
            <tbody>
              {groups.map((g, gi) => (
                <GroupRows key={g} title={g} rows={TOOLS.filter((x) => x.group === gi)} listening={listening} setListening={setListening} setMsg={setMsg} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function GroupRows({ title, rows, listening, setListening, setMsg }: { title: string; rows: typeof TOOLS; listening: string | null; setListening: (v: string | null) => void; setMsg: (m: string) => void }) {
  return (
    <>
      <tr className="gr"><th scope="rowgroup" colSpan={4}>{title}</th></tr>
      {rows.map((x) => {
        const icon = (ICONS as Record<string, string>)[x.id]
        return (
          <tr key={x.id} className={listening === x.id ? 'esc' : ''}>
            <td className="c0">{icon && <Icon name={icon} size={16} />}</td>
            <td>{x.label}</td>
            <td className="ct">
              <button type="button" aria-label={`${x.label}: ${x.key}`} onClick={() => { setMsg(''); setListening(listening === x.id ? null : x.id) }}>
                {listening === x.id ? <span className="esp">{t('dialogs.atalho_aperte')}</span> : <kbd className="kc">{x.key}</kbd>}
              </button>
            </td>
            <td className="cf">{DEFAULT_KEYS[x.id] ?? ''}</td>
          </tr>
        )
      })}
    </>
  )
}

function GeneralPanel() {
  const lang = useLang()
  const units = useUnits()
  return (
    <div className="gbx"><h3>{t('dialogs.geral')}</h3>
      <div className="fld"><span>Idioma · Language</span>
        <SelectCb value={lang} onChange={(v) => void setLang(v as Lang)} label="Idioma · Language" current={LANGS.find((l) => l.id === lang)?.name ?? lang}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </SelectCb>
      </div>
      <div className="fld"><span>{t('dialogs.unidades')}</span>
        <SelectCb value={units} onChange={(v) => setUnits(v as UnitSystem)} label={t('dialogs.unidades')} current={units === 'metric' ? t('dialogs.unidades_metrico') : t('dialogs.unidades_imperial')}>
          <option value="metric">{t('dialogs.unidades_metrico')}</option>
          <option value="imperial">{t('dialogs.unidades_imperial')}</option>
        </SelectCb>
      </div>
      <p className="aj">{t('dialogs.unidades_ajuda')}</p>
    </div>
  )
}

function AboutPanel({ st }: { st: UpdateState }) {
  const newer = st.status === 'available' || st.status === 'ready'
  const rows: (readonly [string, string])[][] = []
  for (let i = 0; i < THIRD_PARTY.length; i += 2) rows.push(THIRD_PARTY.slice(i, i + 2) as unknown as (readonly [string, string])[])
  return (
    <>
      <div className="c2c">
        <div className="gbx"><h3>{t('dialogs.sobre')}</h3>
          <div className="kv"><span>Traço</span><b>{IS_DESKTOP ? t('dialogs.app_de_pc') : t('dialogs.versao_web')}</b></div>
          <div className="kv"><span>{t('dialogs.versao_instalada')}</span><b className="n">{st.current ?? APP_VERSION}</b></div>
          <div className="lin2" style={{ marginTop: 6 }}>
            <a className="btn sm" href={REPO_URL} target="_blank" rel="noreferrer">{t('dialogs.repositorio_no_github')}</a>
            <button type="button" className="btn sm" onClick={() => { useStore.setState({ dialog: null }); startTour() }}>{t('dialogs.rever_o_passo_a_passo')}</button>
            <a className="btn sm" href={newer && st.version ? releaseUrl(st.version) : releasesUrl()} target="_blank" rel="noreferrer">{t('dialogs.versoes_e_notas')}</a>
          </div>
        </div>
        <div className="gbx"><h3>{t('dialogs.diagnostico')}</h3>
          <div className="lin2">
            <button type="button" className="btn sm" onClick={async () => { const ok = await copyDiagnostic(); useStore.getState().notify(ok ? t('dialogs.diagnostico_copiado') : t('dialogs.diagnostico_falhou'), ok ? undefined : 'err') }}>{t('dialogs.copiar_diagnostico')}</button>
            <p>{t('dialogs.diagnostico_explicacao')}</p>
          </div>
        </div>
      </div>
      <div className="gbx"><h3>{t('dialogs.componentes_de_terceiros')}</h3>
        <p>{t('dialogs.usa_componentes')}</p>
        <table className="th">
          <thead><tr><th scope="col">{t('dialogs.componente')}</th><th scope="col">{t('dialogs.licenca')}</th><th scope="col">{t('dialogs.componente')}</th><th scope="col">{t('dialogs.licenca')}</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map(([n, l]) => [<td key={n}>{n}</td>, <td key={`${n}-l`}>{l}</td>])}</tr>)}</tbody>
        </table>
      </div>
    </>
  )
}

type Tab = 'general' | 'look' | 'keys' | 'updates' | 'about'

/** Configurações: Geral, Aparência, Atalhos, Atualizações e Sobre, todas no mesmo tamanho de janela. */
export function SettingsDialog() {
  const [tab, setTab] = useState<Tab>('general')
  const [st, setSt] = useState<UpdateState>({ status: 'idle', current: APP_VERSION })
  const [listening, setListening] = useState<string | null>(null)
  const [keyMsg, setKeyMsg] = useState('')
  const { primary, accent, reset: resetColors } = usePalette()
  useKeymap()
  const up = desktop?.update
  useEffect(() => {
    if (!up) return
    up.state().then((x) => {
      setSt(x)
      // ao abrir, já procura atualização
      if (x.status === 'idle') up.check()
    })
    up.onState((x) => setSt((o) => ({ ...o, ...x })))
  }, [up])
  const colorsChanged = !!(primary || accent)
  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: t('dialogs.geral') },
    { id: 'look', label: t('dialogs.aparencia') },
    { id: 'keys', label: t('dialogs.atalhos') },
    { id: 'updates', label: t('dialogs.atualizacoes') },
    { id: 'about', label: t('dialogs.sobre') },
  ]
  return (
    <Dlg
      title={t('dialogs.configuracoes')}
      onClose={close}
      fix
      bodyClass={`cfg ${tab === 'keys' ? 'keys' : ''}`}
      tabs={<DTabs label={t('dialogs.configuracoes')} value={tab} onChange={(v) => { setTab(v); setListening(null) }} tabs={tabs} />}
      footer={<>
        {tab === 'look' && <button type="button" className={`btn ${colorsChanged ? '' : 'off'}`} aria-disabled={!colorsChanged} onClick={colorsChanged ? resetColors : undefined}>{t('dialogs.restaurar_cores')}</button>}
        {tab === 'keys' && <button type="button" className={`btn ${hasCustomKeys() ? '' : 'off'}`} aria-disabled={!hasCustomKeys()} onClick={hasCustomKeys() ? () => { resetKeys(); setKeyMsg('') } : undefined}>{t('dialogs.atalhos_restaurar')}</button>}
        {tab === 'keys' && keyMsg && <span className="nota warnl" role="status">{keyMsg}</span>}
        <span className="sp" />
        <button type="button" className="btn" onClick={close}>{t('dialogs.fechar')}</button>
      </>}
    >
      {tab === 'general' ? <GeneralPanel /> : tab === 'look' ? <AppearancePanel /> : tab === 'keys' ? <KeysPanel listening={listening} setListening={setListening} setMsg={setKeyMsg} /> : tab === 'updates' ? <UpdatesPanel st={st} setSt={setSt} /> : <AboutPanel st={st} />}
    </Dlg>
  )
}
