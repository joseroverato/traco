import './index.css'
import { initI18n } from './i18n'

// o idioma vem antes de qualquer outro módulo do app: o store cria marcadores e status padrão já no idioma da pessoa
await initI18n()
const { start } = await import('./bootstrap')
start()
