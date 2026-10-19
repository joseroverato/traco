import { describe, expect, it } from 'vitest'
import { MAX_HISTORY, pushHistory } from './history'

describe('pushHistory', () => {
  it('acrescenta ao final sem alterar o array original', () => {
    const past = [1, 2]
    expect(pushHistory(past, 3)).toEqual([1, 2, 3])
    expect(past).toEqual([1, 2])
  })

  it('mantém no máximo MAX_HISTORY passos, descartando os mais antigos', () => {
    let past: number[] = []
    for (let i = 0; i < MAX_HISTORY + 20; i++) past = pushHistory(past, i)
    expect(MAX_HISTORY).toBe(80)
    expect(past).toHaveLength(80)
    expect(past[0]).toBe(20)
    expect(past[past.length - 1]).toBe(99)
  })

  it('respeita um limite customizado', () => {
    expect(pushHistory([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  })
})
