import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url'
import { redactWith } from '../shared/redact-core.mjs'
import type { PdfiumModule, RedactItem } from '../shared/redact-core.mjs'

/** Tarja definitiva no navegador: o mesmo código do app de PC, com o PDFium carregado sob demanda (~4,6 MB, só ao exportar com tarja). */
let pdfiumP: Promise<PdfiumModule> | null = null
function pdfium(): Promise<PdfiumModule> {
  pdfiumP ??= (async () => {
    const { init } = await import('@embedpdf/pdfium')
    const res = await fetch(wasmUrl)
    if (!res.ok) throw new Error('Não foi possível carregar o motor de tarja (PDFium)')
    const m = (await init({ wasmBinary: await res.arrayBuffer() })) as unknown as PdfiumModule
    m.PDFiumExt_Init()
    return m
  })().catch((e) => {
    pdfiumP = null // tenta de novo na próxima exportação
    throw e
  })
  return pdfiumP
}

export async function redactInBrowser(bytes: Uint8Array, items: RedactItem[]): Promise<Uint8Array> {
  return redactWith(await pdfium(), bytes, items)
}
