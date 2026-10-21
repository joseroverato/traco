import { APP_VERSION } from './about'
import { getLang } from './i18n'
import { IS_DESKTOP } from './platform'
import { useStore } from './store'

const MAX = 5
const errors: { at: string; text: string }[] = []

const brief = (e: unknown): string => {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 4).join('\n')}`.trim()
  try { return String(e) } catch { return 'unknown error' }
}

/** Guarda o erro na memória (nunca é enviado a lugar nenhum); a pessoa decide se copia o diagnóstico para uma issue. */
export function recordError(e: unknown) {
  errors.push({ at: new Date().toISOString(), text: brief(e) })
  if (errors.length > MAX) errors.shift()
}

export function installErrorCapture() {
  window.addEventListener('error', (ev) => recordError(ev.error ?? ev.message))
  window.addEventListener('unhandledrejection', (ev) => recordError(ev.reason))
}

/** Texto para colar numa issue: versão, sistema e últimos erros. Sem nomes de arquivo, textos do projeto nem caminhos do computador. */
export function buildDiagnostic(): string {
  const s = useStore.getState()
  const sizeMb = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
  const lines = [
    `Traço ${APP_VERSION} (${IS_DESKTOP ? 'desktop' : 'web'})`,
    `UA: ${navigator.userAgent}`,
    `Language: ${getLang()} · screen ${screen.width}x${screen.height} @${window.devicePixelRatio}`,
    `Project: ${s.sheets.length} sheet(s), ${s.markups.length} markup(s)` + (sizeMb ? ` · JS memory ${Math.round(sizeMb / 1048576)} MB` : ''),
    '',
    errors.length ? 'Recent errors:' : 'No errors recorded in this session.',
    ...errors.map((e) => `[${e.at}] ${e.text.replace(/file:\/\/\/[^\s)]+/g, '<file>')}`),
  ]
  return lines.join('\n')
}

export async function copyDiagnostic(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(buildDiagnostic())
    return true
  } catch {
    return false
  }
}
