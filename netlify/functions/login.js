const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const config = require('./utils/config_netlify');

exports.handler = async (event, context) => {
  // Manejar CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    const { nomUsu, contrasenaHash } = JSON.parse(event.body);

    if (!nomUsu || !contrasenaHash) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Nombre de usuario y contraseña son requeridos' }),
      };
    }

    // Configuración del repositorio BD
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = config.github.repo;
    const branch = config.github.branch;
    const filePath = config.github.dbPath;

    if (!githubToken) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Token de GitHub no configurado' }),
      };
    }

    const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    
    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });

    if (!fileResponse.ok) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Error al obtener la base de usuarios' }),
      };
    }

    const usuarios = await fileResponse.json();
    const user = Object.values(usuarios).find(u =>
      u.nomUsu === nomUsu &&
      u.contrasena === contrasenaHash &&
      u.activo === true
    );

    if (user) {
      // No devolver la contraseña al cliente
      const { contrasena, ...userSinPass } = user;

      // Determinar duración de sesión según rol
      let expiresIn = config.jwt.expiresInUsuario;
      if (user.rol === 'admin' || user.rol === 'gestor') {
        expiresIn = config.jwt.expiresInGestor;
      }

      // Generar JWT
      const token = jwt.sign(
        { 
          tipdocu: user.tipdocu, 
          documento: user.documento, 
          email: user.email, 
          rol: user.rol,
          nombre: user.nombre,
          nomUsu: user.nomUsu
        }, 
        config.jwt.secret, 
        { expiresIn }
      );

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: true, user: userSinPass, token }),
      };
    } else {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ success: false, error: 'Usuario o contraseña incorrectos' }),
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message }),
    };
  }
};
