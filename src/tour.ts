import { loadFile } from './project'
import { useStore } from './store'
import { getLang, t } from './i18n'
import { isMobileNow } from './mobile'

export interface TourStep {
  title: string
  text: string
  /** acha o elemento destacado; sem ele o passo é pulado */
  find: () => HTMLElement | null
}

const q = (sel: string) => () => document.querySelector<HTMLElement>(sel)
const byText = (sel: string, text: string) => () => Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.textContent?.trim() === text) ?? null

export const TOUR_STEPS: TourStep[] = [
  { get title() { return t('tour.1_defina_a_escala') }, get text() { return t('tour.toda_medida_depende_dela_o') }, find: q('.scale-banner') },
  { get title() { return t('tour.2_escolha_uma_ferramenta') }, get text() { return t('tour.passe_o_mouse_em_qualquer') }, find: q('.rail') },
  { get title() { return t('tour.3_marcadores_servicos') }, get text() { return t('tour.cada_marcador_e_um_servico') }, find: q('aside.panel.right') },
  { get title() { return t('tour.4_o_quantitativo') }, get text() { return t('tour.aqui_aparece_o_total_de') }, find: q('section.panel.bottom') },
  { get title() { return t('tour.5_veja_em_3d') }, get text() { return t('tour.desenhe_um_solido_sobre_a') }, find: byText('.topbar button', '3D') },
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
    // uma planta de exemplo por idioma (rótulos de ambientes e carimbo na língua da pessoa); o chinês usa a versão em inglês
    const lang = getLang()
    const res = await fetch(`${import.meta.env.BASE_URL}exemplo/planta-exemplo${lang === 'pt' ? '' : `.${lang === 'zh' ? 'en' : lang}`}.pdf`)
    if (!res.ok) throw new Error(String(res.status))
    const file = new File([await res.blob()], t('tour.nome_da_planta'), { type: 'application/pdf' })
    // o passo a passo aponta para elementos do layout de PC; no celular ele não é iniciado
    if (await loadFile(file) && !isMobileNow()) startTour()
  } catch (e) {
    console.error(e)
    st.notify(t('tour.nao_foi_possivel_abrir_a'))
  }
}

/** Próximo passo cujo elemento existe na tela; null se acabaram. */
export function nextStep(from: number, dir: 1 | -1 = 1): number | null {
  for (let i = from; i >= 0 && i < TOUR_STEPS.length; i += dir) if (TOUR_STEPS[i].find()) return i
  return null
}
