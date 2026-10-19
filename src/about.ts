/** Informações do app para a tela "Sobre". */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
export const REPO_URL = 'https://github.com/joseroverato/traco'
export const releasesUrl = () => `${REPO_URL}/releases`
export const releaseUrl = (version: string) => `${REPO_URL}/releases/tag/v${version.replace(/^v/, '')}`

/** Componentes de terceiros e licenças (para distribuição). */
export const THIRD_PARTY = [
  ['PDF.js', 'Apache-2.0'],
  ['PDFium (via EmbedPDF)', 'BSD-3-Clause / MIT'],
  ['pdf-lib', 'MIT'],
  ['Tesseract.js', 'Apache-2.0'],
  ['React', 'MIT'],
  ['Electron', 'MIT'],
] as const
