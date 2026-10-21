/* Service worker do Traço (versão web instalável).
 * - /assets/*: nomes com hash, nunca mudam → cache primeiro (o app abre sem rede depois do primeiro uso).
 * - páginas: rede primeiro, cache se estiver sem rede → uma versão nova aparece na próxima abertura.
 * - demais arquivos do mesmo site (ícones, planta de exemplo): usa o cache e atualiza em segundo plano.
 * Nada de outro domínio passa por aqui (a API da Anthropic, por exemplo, vai direto). */
const CACHE = 'traco-v1'
const ASSET_LIMIT = 120

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('traco-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

async function put(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return
  const c = await caches.open(CACHE)
  await c.put(req, res.clone())
  if (new URL(req.url).pathname.includes('/assets/')) {
    const keys = await c.keys()
    const assets = keys.filter((k) => new URL(k.url).pathname.includes('/assets/'))
    for (const k of assets.slice(0, Math.max(0, assets.length - ASSET_LIMIT))) await c.delete(k)
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          put('./index.html', res.clone())
          return res
        })
        .catch(async () => (await caches.match('./index.html')) || Response.error()),
    )
    return
  }

  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            put(req, res.clone())
            return res
          }),
      ),
    )
    return
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          put(req, res.clone())
          return res
        })
        .catch(() => hit || Response.error())
      return hit || net
    }),
  )
})
