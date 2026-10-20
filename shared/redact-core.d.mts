/** Módulo PDFium já iniciado (@embedpdf/pdfium). */
export type PdfiumModule = Record<string, any>
export interface RedactItem {
  page: number
  /** [x0, y0, x1, y1] em pontos, origem no canto superior esquerdo, folha já girada */
  rect: [number, number, number, number]
  fill?: [number, number, number]
}
export function redactWith(m: PdfiumModule, bytes: Uint8Array | ArrayBuffer, items: RedactItem[]): Uint8Array & { stats?: { text: number; paths: number; images: number } }
