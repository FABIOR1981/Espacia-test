// Función para obtener la lista de usuarios desde usuarios.json
const { verifyToken } = require('./utils/jwthelper');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async function(event, context) {
  // Manejar CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }

  const userToken = verifyToken(event);
  if (!userToken) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado. Token inválido o ausente.' }) };
  }

  let usuarios = [];
  try {
    // Usar la nueva función get-usuarios para leer desde el repo BD
    const baseUrl = process.env.URL || 'http://localhost:8888';
    const resp = await fetch(`${baseUrl}/.netlify/functions/get-usuarios`, {
      headers: {
        'Authorization': event.headers.authorization || event.headers.Authorization
      }
    });
    if (resp.ok) {
      usuarios = await resp.json();
    }
  } catch {}
  // Solo usuarios activos
  usuarios = Array.isArray(usuarios) ? usuarios.filter(u => u.activo !== false) : [];
  return {
    statusCode: 200,
    body: JSON.stringify({ usuarios })
  };
};
