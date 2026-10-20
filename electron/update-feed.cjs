// Fonte das atualizações automáticas (GitHub Releases).
// Repositório público: não precisa de token. Uma cópia privada continua funcionando com um token de leitura.
/** @param {{ owner: string; repo: string }} repo @param {string | null | undefined} token */
function feedFor(repo, token) {
  const t = typeof token === 'string' ? token.trim() : ''
  return { provider: 'github', owner: repo.owner, repo: repo.repo, private: !!t, ...(t ? { token: t } : {}) }
}

module.exports = { feedFor }
