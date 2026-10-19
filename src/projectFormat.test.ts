import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { PROJECT_VERSION, decodeProject, encodeProject, migrate } from './projectFormat'
import type { ProjectData } from './projectFormat'
import { mk, sheet } from './testUtils'

const pdfA = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 0, 255, 128, 7]) // "%PDF-1.4" + bytes não-texto
const pdfB = new Uint8Array(5000).map((_, i) => (i * 31) & 255)

const base = (): ProjectData => ({
  app: 'traco',
  version: PROJECT_VERSION,
  fileName: 'obra.pdf',
  sources: [],
  sheets: [sheet({ id: 's1', src: 'a' }), sheet({ id: 's2', src: 'b', label: 'A-02' })],
  markups: [mk({ id: 'm1', page: 's1', kind: 'length', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] })],
  presets: [],
  statuses: [{ name: 'aberto', color: '#e5484d' }],
  scales: { s1: { metersPerUnit: 0.01, label: '1:100' } },
  bdi: 25,
})

/** Arquivo legado v2: um JSON com os PDFs em base64. */
const v2File = (version = 2) => {
  const { sources: _s, ...rest } = base()
  void _s
  return strToU8(JSON.stringify({ ...rest, version, sources: [{ id: 'a', name: 'a.pdf', pdf: btoa(String.fromCharCode(...pdfA)) }, { id: 'b', name: 'b.pdf', pdf: btoa(String.fromCharCode(...pdfB)) }] }))
}

describe('formato v3 (ZIP)', () => {
  const sources = [{ id: 'a', name: 'a.pdf', bytes: pdfA }, { id: 'b', name: 'b.pdf', bytes: pdfB }]

  it('começa com a assinatura de ZIP e faz ida e volta sem perder nada', () => {
    const bytes = encodeProject({ data: base(), sources })
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const back = decodeProject(bytes)
    expect(back.data.version).toBe(PROJECT_VERSION)
    expect(back.data.markups).toEqual(base().markups)
    expect(back.data.scales).toEqual(base().scales)
    expect(back.data.bdi).toBe(25)
    expect(back.sources.map((s) => [s.id, s.name])).toEqual([['a', 'a.pdf'], ['b', 'b.pdf']])
    expect(back.sources[0].bytes).toEqual(pdfA)
    expect(back.sources[1].bytes).toEqual(pdfB)
  })

  it('guarda os PDFs em binário: bem menor que o base64 do v2', () => {
    const big = new Uint8Array(200_000).map((_, i) => (i * 7919 + (i >> 3)) & 255)
    const v3 = encodeProject({ data: base(), sources: [{ id: 'a', name: 'a.pdf', bytes: big }] })
    const b64Size = Math.ceil(big.length / 3) * 4
    expect(v3.length).toBeLessThan(b64Size)
    expect(v3.length).toBeLessThan(big.length * 1.02)
  })

  it('o version do arquivo é sempre o atual, mesmo que o chamador mande outro', () => {
    const bytes = encodeProject({ data: { ...base(), version: 0 }, sources })
    expect(decodeProject(bytes).data.version).toBe(PROJECT_VERSION)
  })

  it('rejeita ZIP sem project.json, ZIP sem o PDF e ZIP corrompido', () => {
    expect(() => decodeProject(zipSync({ 'outra-coisa.txt': strToU8('x') }))).toThrow(/não é um projeto/)
    const ok = encodeProject({ data: base(), sources })
    const files = { 'project.json': strToU8(JSON.stringify({ ...base(), sources: [{ id: 'a', name: 'a.pdf' }] })) }
    expect(() => decodeProject(zipSync(files))).toThrow(/ausente/)
    const broken = ok.slice(0, 30)
    expect(() => decodeProject(broken)).toThrow(/corrompido|não é um projeto/)
  })
})

describe('compatibilidade com v2 (JSON + base64)', () => {
  it('abre um projeto v2 e devolve os PDFs idênticos', () => {
    const back = decodeProject(v2File())
    expect(back.data.version).toBe(PROJECT_VERSION)
    expect(back.data.fileName).toBe('obra.pdf')
    expect(back.data.markups).toHaveLength(1)
    expect(back.sources[0].bytes).toEqual(pdfA)
    expect(back.sources[1].bytes).toEqual(pdfB)
    expect(back.data.sources).toEqual([{ id: 'a', name: 'a.pdf' }, { id: 'b', name: 'b.pdf' }])
  })

  it('v2 → v3: abrir e salvar de novo preserva o conteúdo', () => {
    const opened = decodeProject(v2File())
    const again = decodeProject(encodeProject({ data: opened.data, sources: opened.sources }))
    expect(again.data.markups).toEqual(opened.data.markups)
    expect(again.sources.map((s) => s.bytes)).toEqual(opened.sources.map((s) => s.bytes))
  })

  it('aceita também ArrayBuffer', () => {
    const u = v2File()
    expect(decodeProject(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer).sources).toHaveLength(2)
  })
})

describe('versionamento', () => {
  it('rejeita projeto de versão mais nova com mensagem clara', () => {
    expect(() => decodeProject(v2File(PROJECT_VERSION + 1))).toThrow(/versão mais nova/)
  })

  it('rejeita arquivo que não é do Traço', () => {
    expect(() => decodeProject(strToU8('{"app":"outro","version":2,"sources":[]}'))).toThrow(/não é um projeto/)
    expect(() => decodeProject(strToU8('isto nem é JSON'))).toThrow(/não é um projeto/)
    expect(() => migrate({ ...base(), version: 1.5 })).toThrow(/não é um projeto/)
  })

  it('formato antigo sem migração disponível é recusado', () => {
    expect(() => migrate({ ...base(), version: 1 })).toThrow(/não é mais suportado/)
  })

  it('migrate é identidade na versão atual', () => {
    const d = base()
    expect(migrate(d)).toBe(d)
  })
})
