/**
 * Formato do arquivo de projeto (.traco).
 *
 *  v3 (atual): ZIP com `project.json` (marcações, folhas, escalas…) e os PDFs em binário em `sources/<id>.pdf`.
 *  v2 (legado): um único JSON com os PDFs em base64. Continua abrindo; ao salvar vira v3.
 *
 * Para mudar o formato no futuro: aumente PROJECT_VERSION e acrescente a migração `n → n+1` em MIGRATIONS.
 * Este módulo é puro (não conhece a interface nem o store), por isso é testável.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { CustomColumn, Markup, OcrResult, Overlay, PageScale, Preset, Sheet, StatusDef } from './types'

export const PROJECT_VERSION = 3

export interface ProjectData {
  app: 'traco'
  version: number
  fileName: string
  sources: { id: string; name: string }[]
  sheets: Sheet[]
  markups: Markup[]
  presets: Preset[]
  statuses: StatusDef[]
  scales: Record<string, PageScale>
  meta?: { title: string; author: string; subject: string; keywords: string }
  ocr?: Record<string, OcrResult>
  columns?: CustomColumn[]
  bdi?: number
  overlays?: Record<string, Overlay[]>
  hiddenLayers?: Record<string, string[]>
}

export interface ProjectSource {
  id: string
  name: string
  bytes: Uint8Array
}

export interface ProjectBundle {
  data: ProjectData
  sources: ProjectSource[]
}

/** Migrações do documento (sem os PDFs), de uma versão para a seguinte. */
const MIGRATIONS: Record<number, (d: ProjectData) => ProjectData> = {
  // v2 → v3: o conteúdo do documento é o mesmo; mudou só onde ficam os PDFs (tratado na leitura)
  2: (d) => ({ ...d, version: 3 }),
}

export function migrate(data: ProjectData): ProjectData {
  let d = data
  if (d.app !== 'traco' || !Number.isInteger(d.version)) throw new Error('Arquivo não é um projeto Traço')
  if (d.version > PROJECT_VERSION) throw new Error(`Projeto criado por uma versão mais nova do Traço (formato v${d.version}). Atualize o app para abri-lo.`)
  while (d.version < PROJECT_VERSION) {
    const step = MIGRATIONS[d.version]
    if (!step) throw new Error(`Formato de projeto v${d.version} não é mais suportado`)
    d = step(d)
  }
  return d
}

const entry = (id: string) => `sources/${id}.pdf`

export function encodeProject(bundle: ProjectBundle): Uint8Array {
  const data: ProjectData = { ...bundle.data, version: PROJECT_VERSION, sources: bundle.sources.map((s) => ({ id: s.id, name: s.name })) }
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]> = { 'project.json': [strToU8(JSON.stringify(data)), { level: 6 }] }
  // PDFs já vêm comprimidos: só guardar (nível 0) deixa salvar e abrir rápido
  for (const s of bundle.sources) files[entry(s.id)] = [s.bytes, { level: 0 }]
  return zipSync(files)
}

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04

const fromB64 = (b64: string) => {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function decodeProject(input: ArrayBuffer | Uint8Array): ProjectBundle {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  if (isZip(bytes)) {
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(bytes)
    } catch {
      throw new Error('Arquivo de projeto corrompido')
    }
    if (!files['project.json']) throw new Error('Arquivo não é um projeto Traço')
    const data = migrate(JSON.parse(strFromU8(files['project.json'])) as ProjectData)
    const sources = data.sources.map((s) => {
      const f = files[entry(s.id)]
      if (!f) throw new Error(`PDF "${s.name}" ausente no projeto`)
      return { id: s.id, name: s.name, bytes: f }
    })
    return { data, sources }
  }
  // legado v2: JSON com PDFs em base64
  let raw: (Omit<ProjectData, 'sources'> & { sources: { id: string; name: string; pdf: string }[] }) | undefined
  try {
    raw = JSON.parse(strFromU8(bytes))
  } catch {
    throw new Error('Arquivo não é um projeto Traço')
  }
  if (!raw || raw.app !== 'traco' || !Array.isArray(raw.sources)) throw new Error('Arquivo não é um projeto Traço')
  const sources = raw.sources.map((s) => ({ id: s.id, name: s.name, bytes: fromB64(s.pdf) }))
  const data = migrate({ ...raw, sources: sources.map((s) => ({ id: s.id, name: s.name })) })
  return { data, sources }
}
