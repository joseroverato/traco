/**
 * Ponte com o app Android (Capacitor). Na web e no app de PC nada disso é usado.
 * O WebView do Android não baixa arquivos por link: o arquivo é gravado no cache do app e o menu "Compartilhar" do sistema
 * deixa a pessoa salvar (Google Drive, Arquivos…) ou enviar. Os plugins são lidos de `Capacitor.Plugins`, sem importar pacotes no site.
 */
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  Plugins?: {
    Filesystem?: { writeFile(o: { path: string; data: string; directory: string }): Promise<{ uri: string }> }
    Share?: { share(o: { title?: string; url?: string; dialogTitle?: string }): Promise<unknown> }
  }
}

const cap = (): CapacitorGlobal | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor)

export const IS_NATIVE = !!cap()?.isNativePlatform?.()

/** Bytes → base64, em blocos (btoa direto estoura a pilha em arquivos grandes). */
export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Grava o arquivo no cache do app e abre o menu Compartilhar do Android. Devolve false se o plugin não existir. */
export async function saveNative(data: Uint8Array | ArrayBuffer | string, name: string): Promise<boolean> {
  const p = cap()?.Plugins
  if (!p?.Filesystem || !p.Share) return false
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data)
  const { uri } = await p.Filesystem.writeFile({ path: name, data: toBase64(bytes), directory: 'CACHE' })
  try {
    await p.Share.share({ title: name, url: uri, dialogTitle: name })
  } catch {
    /* a pessoa fechou o menu sem escolher */
  }
  return true
}
