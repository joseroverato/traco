import { create } from 'zustand'
import { useStore } from './store'

/**
 * Zoom durante a animação da roda e dos botões. Enquanto ela corre, o valor de cada quadro fica aqui, e não no store principal:
 * quase todos os painéis assinam o store inteiro, e gravar o zoom nele a cada quadro refazia o app todo 60 vezes por segundo.
 * Só o visor e o mostrador de porcentagem leem este valor. No fim da animação o zoom final vai para o store, uma vez.
 */
export const useLiveZoom = create<{ z: number | null }>(() => ({ z: null }))

/** Zoom que está na tela agora (o da animação, se houver uma em curso). Para uso fora do React. */
export const currentZoom = (): number => useLiveZoom.getState().z ?? useStore.getState().zoom

/** Zoom que está na tela agora, como hook. */
export function useZoom(): number {
  const live = useLiveZoom((s) => s.z)
  const stored = useStore((s) => s.zoom)
  return live ?? stored
}
