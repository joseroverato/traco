/**
 * Modo 3D (R3, fase 4): o que a faixa de opções, a barra de status e o View3D dividem.
 *  - `visible`: quais camadas aparecem (Mostrar); a faixa muda, o View3D desenha.
 *  - `totals`: contagem por camada e volume dos sólidos, publicados pelo View3D (o cálculo continua lá).
 *  - `frame3d`: pede à cena para enquadrar (evento `traco:view3d`); a câmera e a cena (scene3d.ts) não mudam.
 */
import { create } from 'zustand'
import type { LayerKind } from './solids'

export type View3DName = 'iso' | 'top' | 'front' | 'right'
export const VIEW3D_EVENT = 'traco:view3d'

interface View3DUi { visible: Record<LayerKind, boolean>; totals: Record<LayerKind, { n: number; volume: number }> | null }
export const useView3dUi = create<View3DUi>(() => ({ visible: { solid: true, space: true, area: true, length: true, count: true }, totals: null }))

export const toggleLayer3d = (k: LayerKind) => useView3dUi.setState((u) => ({ visible: { ...u.visible, [k]: !u.visible[k] } }))
export const publishTotals3d = (totals: View3DUi['totals']) => useView3dUi.setState({ totals })
export const frame3d = (view: View3DName) => window.dispatchEvent(new CustomEvent<View3DName>(VIEW3D_EVENT, { detail: view }))
