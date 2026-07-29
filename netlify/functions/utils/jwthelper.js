const jwt = require('jsonwebtoken');
const config = require('./config_netlify');

/**
 * Verifica el token JWT en los headers de la petición.
 * @param {Object} event - El evento de Netlify Function.
 * @returns {Object|null} - El payload del token decodificado si es válido, o null si es inválido/no existe.
 */
const verifyToken = (event) => {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return decoded;
  } catch (error) {
    console.error('Error verificando JWT:', error.message);
    return null;
  }
};

module.exports = {
  verifyToken
};
