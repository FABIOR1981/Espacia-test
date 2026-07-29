const fetch = require('node-fetch');
const { verifyToken } = require('./utils/jwthelper');
const config = require('./utils/config_netlify');

exports.handler = async (event, context) => {
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
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  const user = verifyToken(event);
  if (!user) {
    return {
      statusCode: 401,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'No autorizado. Token inválido o ausente.' }),
    };
  }

  // VALIDACIÓN DE SEGURIDAD: Solo admin o gestor pueden descargar el listado completo
  if (user.rol !== 'admin' && user.rol !== 'gestor') {
    return {
      statusCode: 403,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Permisos insuficientes. Solo administradores pueden consultar usuarios.' }),
    };
  }

  try {
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
        Accept: 'application/vnd.github.v3.raw', // Importante: .raw para obtener el contenido directamente
      },
    });

    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
         // Si el archivo no existe aún, devolvemos un array vacío
         return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify([]),
          };
      }
      const error = await fileResponse.text();
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Error al obtener el archivo de GitHub', details: error }),
      };
    }

    const fileData = await fileResponse.text();
    
    // Parsear el JSON y eliminar las contraseñas antes de enviarlo al cliente
    let usuarios = [];
    try {
      const usuariosDict = JSON.parse(fileData);
      usuarios = Object.values(usuariosDict).map(u => {
        const { contrasena, ...userSinPass } = u;
        return userSinPass;
      });
    } catch (e) {
      console.error("Error parseando usuarios.json", e);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(usuarios),
    };

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
