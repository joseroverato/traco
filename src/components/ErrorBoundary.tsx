import { Component } from 'react'
import type { ReactNode } from 'react'
import { copyDiagnostic, recordError } from '../diagnostics'
import { t } from '../i18n'

/** Última rede de proteção: se a tela quebrar, a pessoa vê o que fazer em vez de uma janela em branco. O trabalho continua no salvamento automático. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; copied: boolean }> {
  state = { failed: false, copied: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: unknown) {
    recordError(e)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="crash" role="alert">
        <h2>{t('crash.titulo')}</h2>
        <p>{t('crash.explicacao')}</p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>{t('crash.reabrir')}</button>
          <button className="btn" onClick={async () => this.setState({ copied: await copyDiagnostic() })}>{this.state.copied ? t('dialogs.diagnostico_copiado') : t('dialogs.copiar_diagnostico')}</button>
        </div>
      </div>
    )
  }
}
