import './index.css'
import './r3.css' // casca R3 (barra de título, faixa, barra de status): depois do index.css para valer sobre ele
import './theme'
import { initI18n } from './i18n'

// o idioma vem antes de qualquer outro módulo do app: o store cria marcadores e status padrão já no idioma da pessoa
await initI18n()
const { start } = await import('./bootstrap')
start()
