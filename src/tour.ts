import { loadFile } from './project'
import { useStore } from './store'

export interface TourStep {
  title: string
  text: string
  /** acha o elemento destacado; sem ele o passo é pulado */
  find: () => HTMLElement | null
}

const q = (sel: string) => () => document.querySelector<HTMLElement>(sel)
const byText = (sel: string, text: string) => () => Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.textContent?.trim() === text) ?? null

export const TOUR_STEPS: TourStep[] = [
  { title: '1. Defina a escala', text: 'Toda medida depende dela. O Traço lê a escala escrita no carimbo da prancha: é só clicar em “Usar 1:50 do carimbo”. Também dá para calibrar por uma cota conhecida.', find: q('.scale-banner') },
  { title: '2. Escolha uma ferramenta', text: 'Passe o mouse em qualquer ícone: aparece o nome, uma descrição e uma animação curta de como usar. Comprimento, área, contagem, tarja, sólido 3D…', find: q('.rail') },
  { title: '3. Marcadores = serviços', text: 'Cada marcador é um serviço (alvenaria, piso, pintura…) com fator, fórmula e preço. Escolha um e meça na planta: o quantitativo se monta sozinho.', find: q('aside.panel.right') },
  { title: '4. O quantitativo', text: 'Aqui aparece o total de cada serviço, por folha, ambiente ou pavimento. Exporte para Excel quando quiser.', find: q('section.panel.bottom') },
  { title: '5. Veja em 3D', text: 'Desenhe um sólido sobre a planta, puxe a altura e veja o volume em m³. O botão ao lado divide a tela: planta de um lado, 3D do outro.', find: byText('.topbar button', '3D') },
]

const KEY = 'traco.tourDone'
export const tourDone = () => {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
export const markTourDone = () => {
  try { localStorage.setItem(KEY, '1') } catch { /* sem storage */ }
}

export const startTour = () => useStore.setState({ tour: 0 })

/** Abre a planta de exemplo embutida e inicia o passo a passo. */
export async function openSample() {
  const st = useStore.getState()
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}exemplo/planta-exemplo.pdf`)
    if (!res.ok) throw new Error(String(res.status))
    const file = new File([await res.blob()], 'Planta de exemplo.pdf', { type: 'application/pdf' })
    if (await loadFile(file)) startTour()
  } catch (e) {
    console.error(e)
    st.notify('Não foi possível abrir a planta de exemplo')
  }
}

/** Próximo passo cujo elemento existe na tela; null se acabaram. */
export function nextStep(from: number, dir: 1 | -1 = 1): number | null {
  for (let i = from; i >= 0 && i < TOUR_STEPS.length; i += dir) if (TOUR_STEPS[i].find()) return i
  return null
}
