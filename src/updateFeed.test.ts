import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { feedFor } = require('../electron/update-feed.cjs') as { feedFor: (repo: { owner: string; repo: string }, token?: string | null) => Record<string, unknown> }
const repo = { owner: 'joseroverato', repo: 'traco' }

describe('fonte das atualizações', () => {
  it('sem token: repositório público, sem credencial', () => {
    expect(feedFor(repo, null)).toEqual({ provider: 'github', owner: 'joseroverato', repo: 'traco', private: false })
    expect(feedFor(repo, undefined)).not.toHaveProperty('token')
  })

  it('token em branco conta como sem token', () => {
    expect(feedFor(repo, '   ')).toMatchObject({ private: false })
    expect(feedFor(repo, '')).not.toHaveProperty('token')
  })

  it('com token: repositório privado, com a credencial (sem espaços sobrando)', () => {
    expect(feedFor(repo, '  github_pat_abc ')).toEqual({ provider: 'github', owner: 'joseroverato', repo: 'traco', private: true, token: 'github_pat_abc' })
  })
})

describe('empacotamento do atualizador', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

  it('o módulo da fonte vai dentro do app instalado (senão o Electron quebra ao abrir)', () => {
    expect(pkg.build.files).toContain('electron/update-feed.cjs')
    const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8')
    expect(main).toContain("require('./update-feed.cjs')")
  })

  it('o repositório de publicação é público e é o mesmo que o app consulta', () => {
    const pub = pkg.build.publish[0]
    expect(pub.private).toBe(false)
    expect(`${pub.owner}/${pub.repo}`).toBe('joseroverato/traco')
    const yml = readFileSync(new URL('../electron/app-update.yml', import.meta.url), 'utf8')
    expect(yml).toContain('private: false')
  })

  it('tem licença declarada e arquivo LICENSE', () => {
    expect(pkg.license).toBe('MIT')
    expect(readFileSync(new URL('../LICENSE', import.meta.url), 'utf8')).toMatch(/^MIT License/)
  })
})
