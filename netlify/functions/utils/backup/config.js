// Backup del antiguo config.js
// Este archivo solo es copia de seguridad, no se usa en producción.

module.exports = {
  github: {
    repo: process.env.GITHUB_DB_REPO || 'FABIOR1981/bd',
    branch: process.env.GITHUB_DB_BRANCH || 'main',
    dbPath: process.env.GITHUB_DB_PATH || 'espacia/usuarios.json'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'secreto_desarrollo_espacia',
    expiresIn: '24h'
  }
};
