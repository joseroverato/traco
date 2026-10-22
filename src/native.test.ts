import { describe, expect, it } from 'vitest'
import { toBase64 } from './native'

describe('ponte com o Android', () => {
  it('converte bytes em base64 igual ao padrão', () => {
    expect(toBase64(new TextEncoder().encode('Traço'))).toBe(Buffer.from('Traço').toString('base64'))
    expect(toBase64(new Uint8Array(0))).toBe('')
  })

  it('aguenta arquivos grandes (milhões de bytes) sem estourar a pilha', () => {
    const big = new Uint8Array(3_000_000).map((_, i) => i % 251)
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'))
  })
})
