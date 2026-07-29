const fetch = require('node-fetch');
const { verifyToken } = require('./utils/jwthelper');
const config = require('./utils/config_netlify');

exports.handler = async (event, context) => {
  // Solo permitir POST
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

  try {
    const { nuevaContrasenaHash } = JSON.parse(event.body);
    if (!nuevaContrasenaHash) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'La nueva contraseña es requerida' }),
      };
    }

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

    // 1. Obtener el archivo actual
    const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
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

    const fileData = await fileResponse.json();
    const currentSha = fileData.sha;
    
    // Decodificar el contenido actual
    let currentUsers = {};
    try {
      const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      currentUsers = JSON.parse(currentContent);
    } catch (e) {
      console.error("Error parseando usuarios.json", e);
      return { statusCode: 500, body: JSON.stringify({ error: 'Error al parsear usuarios.json' }) };
    }

    // 2. Actualizar la contraseña del usuario actual
    const userKey = `${user.tipdocu}-${user.documento}`;
    
    if (!currentUsers[userKey]) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Usuario no encontrado en la base de datos' }),
      };
    }

    // Actualizar la contraseña y quitar el flag de requiereCambioPass
    currentUsers[userKey].contrasena = nuevaContrasenaHash;
    currentUsers[userKey].requiereCambioPass = false;

    // 3. Preparar el nuevo contenido
    const newContent = JSON.stringify(currentUsers, null, 2).replace(
      /"consPref": \[\s+([\s\S]*?)\s+\]/g,
      (match, p1) => `"consPref": [${p1.replace(/\s+/g, '')}]`
    );
    const encodedContent = Buffer.from(newContent).toString('base64');
    
    // 4. Guardar archivo en GitHub
    const updateResponse = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Cambio de contraseña para: ${userKey}`,
        content: encodedContent,
        sha: currentSha,
        branch: branch,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Error al actualizar la contraseña', details: errorText }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, message: 'Contraseña actualizada' }),
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
