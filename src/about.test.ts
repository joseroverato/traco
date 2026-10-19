import { describe, expect, it } from 'vitest'
import { APP_VERSION, REPO_URL, releaseUrl, releasesUrl } from './about'
import pkg from '../package.json'

describe('about', () => {
  it('a versão mostrada é a do package.json', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('links apontam para o repositório do GitHub', () => {
    expect(REPO_URL).toBe('https://github.com/joseroverato/traco')
    expect(releasesUrl()).toBe(`${REPO_URL}/releases`)
    expect(releaseUrl('1.3.0')).toBe(`${REPO_URL}/releases/tag/v1.3.0`)
    expect(releaseUrl('v1.3.0')).toBe(`${REPO_URL}/releases/tag/v1.3.0`)
  })

  it('o repositório do link é o mesmo que o atualizador consulta', async () => {
    const { readFileSync } = await import('node:fs')
    const yml = readFileSync(new URL('../electron/app-update.yml', import.meta.url), 'utf8')
    expect(yml).toContain('owner: joseroverato')
    expect(yml).toContain('repo: traco')
    expect(REPO_URL.endsWith('/joseroverato/traco')).toBe(true)
  })
})
