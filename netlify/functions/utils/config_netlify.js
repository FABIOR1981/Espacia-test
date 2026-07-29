// config_netlify.js - Configuración centralizada para el backend
// Este archivo NO se envía al frontend, solo se usa en las Netlify Functions

module.exports = {
    github: {
        repo: process.env.GITHUB_DB_REPO || 'FABIOR1981/bd',
        branch: process.env.GITHUB_DB_BRANCH || 'main',
        dbPath: process.env.GITHUB_DB_PATH || 'espacia/usuarios.json'
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'secreto_desarrollo_espacia',
        expiresInGestor: '12h',   // 12 horas para Admins y Gestores
        expiresInUsuario: '4h'    // 4 horas para el resto de los profesionales
    }
};
