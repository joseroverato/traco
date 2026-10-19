/** Ponte com o app de PC (Electron). Na versão web, `desktop` é undefined. */
export interface ToolContent {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}
export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'ready' | 'error'
  version?: string
  current?: string
  percent?: number
  error?: string | null
  notes?: string
  configured?: boolean
  packaged?: boolean
  checkedAt?: number
}
export interface DesktopApi {
  info(): Promise<{ version: string; platform: string; userData: string }>
  openFile(): Promise<{ name: string; path: string; data: ArrayBuffer } | null>
  readPath(path: string): Promise<{ name: string; path: string; data: ArrayBuffer }>
  saveFile(opts: { defaultName: string; data: Uint8Array | string; filters?: { name: string; extensions: string[] }[]; path?: string }): Promise<string | null>
  getSecret(key: string): Promise<string | null>
  setSecret(key: string, value: string): Promise<void>
  connectClaudeDesktop(): Promise<{ ok: boolean; message: string; paths: string[] }>
  onCommand(handler: (req: { id: string; name: string; args: Record<string, unknown> }) => void): void
  replyCommand(id: string, result: { content: ToolContent[]; isError?: boolean }): void
  onOpenPath(handler: (path: string) => void): void
  setDirty?(v: boolean): void
  closeNow?(): void
  onSaveAndClose?(h: () => void): void
  recovery?: {
    write(json: string, info: string): Promise<void>
    info(): Promise<string | null>
    read(): Promise<string | null>
    clear(): Promise<void>
  }
  update?: {
    state(): Promise<UpdateState>
    check(): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
    onState(h: (s: UpdateState) => void): void
  }
  engine: {
    optimize(pdf: Uint8Array): Promise<Uint8Array>
    redact(pdf: Uint8Array, items: { page: number; rect: [number, number, number, number]; fill: [number, number, number] }[]): Promise<Uint8Array>
    ocr(png: Uint8Array): Promise<{ text: string; words: { text: string; x: number; y: number; w: number; h: number; conf: number }[] }>
  }
}

export const desktop: DesktopApi | undefined = (window as unknown as { traco?: DesktopApi }).traco
export const IS_DESKTOP = !!desktop
