import { create } from 'zustand'

/**
 * Medir no celular: o dedo cobre o ponto que se quer marcar, então a marcação é feita pela mira fixa no centro da tela.
 * A pessoa move a folha por baixo da mira e toca em "Adicionar ponto". Estas ferramentas usam a mira.
 */
export const MIRA_TOOLS: readonly string[] = ['length', 'area', 'hole', 'space', 'solid', 'calibrate']
export const isMiraTool = (tool: string) => MIRA_TOOLS.includes(tool)

/** Estado do traçado em andamento, para a barra de botões saber o que habilitar. */
export const useMira = create<{ n: number; min: number }>(() => ({ n: 0, min: 2 }))

export type MiraCmd = 'add' | 'undo' | 'done' | 'cancel'
export const miraCmd = (cmd: MiraCmd) => window.dispatchEvent(new CustomEvent('traco:mira', { detail: cmd }))
