import { useStore } from '../store'
import { Icon } from './Icon'
import { ribbonIcon } from '../ribbon'
import { toggleTheme } from '../motion'
import { saveProject } from '../project'
import { t } from '../i18n'

/**
 * Barra de título de 30 px: só o logo (o nome do app escrito ao lado deixa o app genérico), acesso rápido, nome do arquivo ao centro
 * e, à direita, busca, tema e configurações. No Electron/Windows os botões da janela vêm do titleBarOverlay; o respiro à direita
 * está no CSS (env(titlebar-area-*)), e a barra arrasta a janela (-webkit-app-region).
 */
export function TitleBar({ onOpen }: { onOpen: () => void }) {
  const has = useStore((s) => s.sheets.length > 0)
  const fileName = useStore((s) => s.fileName)
  const dirty = useStore((s) => s.dirty)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const updateReady = useStore((s) => s.updateReady)
  const theme = useStore((s) => s.theme)
  const searchOpen = useStore((s) => s.search.open)
  const set = useStore((s) => s.set)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  const qa = (label: string, icon: string, run: () => void, disabled = false) => (
    <button type="button" className="ib" title={label} aria-label={label} disabled={disabled} onClick={run}>
      <Icon name={ribbonIcon(icon)} size={16} />
    </button>
  )
  const settingsLabel = updateReady ? t('topbar.atualizacao_pronta', { updateReady }) : t('topbar.configuracoes_e_atualizacoes')
  const themeLabel = theme === 'dark' ? t('topbar.tema_claro') : t('topbar.tema_escuro')
  const searchLabel = t('topbar.buscar_texto_ctrl_f')
  return (
    <header className="tb">
      {/* só o logo: regra do autor (teste em TitleBar.test.tsx) */}
      <span className="logo brand" role="img" aria-label="Traço">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <rect className="lm-bg" width="20" height="20" rx="3" />
          <path className="lm-tr" d="M5.5 14.5L14.5 5.5M3.8 12.8L7.2 16.2M12.8 3.8L16.2 7.2" />
        </svg>
      </span>
      <div className="qa" role="toolbar" aria-label={t('ribbon.acesso_rapido')}>
        {qa(t('topbar.abrir_ctrl_o'), 'open', onOpen)}
        {qa(t('topbar.salvar_projeto_ctrl_s'), 'save', () => void saveProject(), !has)}
        {qa(t('topbar.exportar_pdf_ctrl_e'), 'exportPdf', () => set({ dialog: 'export' }), !has)}
        <span className="vs" />
        {qa(t('topbar.desfazer_ctrl_z'), 'undo', undo, !canUndo)}
        {qa(t('topbar.refazer_ctrl_y'), 'redo', redo, !canRedo)}
      </div>
      <div className="tt" title={fileName || undefined}>
        {fileName ? <span className="tn">{fileName}</span> : <span className="tu">{t('topbar.nenhum_documento')}</span>}
        {fileName && dirty && <span className="tu">{t('tabs.nao_salvo')}</span>}
      </div>
      <div className="tr2">
        <button type="button" className={`ib${searchOpen ? ' on' : ''}`} title={searchLabel} aria-label={searchLabel} disabled={!has} onClick={() => set({ search: { ...useStore.getState().search, open: !searchOpen }, mode: 'review' })}>
          <Icon name={ribbonIcon('search')} size={16} />
        </button>
        <button type="button" className="ib" title={themeLabel} aria-label={themeLabel} onClick={toggleTheme}>
          <Icon name={ribbonIcon('theme')} size={16} />
        </button>
        <button type="button" className={`ib${updateReady ? ' badge' : ''}`} title={settingsLabel} aria-label={settingsLabel} onClick={() => set({ dialog: 'updates' })}>
          <Icon name={ribbonIcon('settings')} size={16} />
        </button>
      </div>
    </header>
  )
}
