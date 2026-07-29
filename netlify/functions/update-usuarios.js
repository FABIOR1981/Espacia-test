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
  if (!user || (user.rol !== 'admin' && user.rol !== 'gestor')) {
    return {
      statusCode: 403,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'No autorizado. Se requieren permisos de administrador.' }),
    };
  }

  try {
    const { data, token } = JSON.parse(event.body);
    if (!data) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Datos requeridos' }),
      };
    }
    if (!Array.isArray(data)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Los datos deben ser un array' }),
      };
    }

    // --- CORRECCIÓN: Validar nomUsu y nombre (email ahora es opcional) ---
    const nomUsuExistente = new Set();
    for (const item of data) {
      if (!item.nomUsu || !item.nombre) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: 'Cada usuario debe tener ID (nomUsu) y nombre' }),
        };
      }

      const nomUsuLower = item.nomUsu.toString().trim().toLowerCase();
      if (nomUsuExistente.has(nomUsuLower)) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ error: `ID de usuario duplicado: ${item.nomUsu}. Por favor, use un ID único y edite el usuario existente en lugar de crear uno nuevo.` }),
        };
      }
      nomUsuExistente.add(nomUsuLower);
    }


    // Token de GitHub (debe estar en variables de entorno de Netlify)
    const githubToken = process.env.GITHUB_TOKEN || token;
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

    // 1. Obtener el SHA actual del archivo
    const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const fileResponse = await fetch(fileUrl, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!fileResponse.ok) {
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

    const fileData = await fileResponse.json();
    const currentSha = fileData.sha;
    
    // Decodificar el contenido actual para recuperar las contraseñas
    let currentUsers = {};
    try {
      const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      currentUsers = JSON.parse(currentContent);
    } catch (e) {
      console.error("Error parseando el contenido actual de usuarios.json", e);
    }

    // --- CORRECCIÓN: Lógica de fusión (Merge) basada en nomUsu ---
    const mergedDataDict = {};
    data.forEach(newUser => {
      // Usamos nomUsu como clave principal para evitar problemas si falta el email
      const key = (newUser.tipdocu && newUser.documento) 
                  ? `${newUser.tipdocu}-${newUser.documento}` 
                  : newUser.nomUsu;

      // Buscar si el usuario ya existía para mantener su contraseña
      const existingUser = currentUsers[key] || Object.values(currentUsers).find(u => u.nomUsu === newUser.nomUsu);
      
      if (existingUser && !newUser.contrasena) {
        newUser.contrasena = existingUser.contrasena;
      }
      mergedDataDict[key] = newUser;
    });

    // 2. Preparar el nuevo contenido
    const newContent = JSON.stringify(mergedDataDict, null, 2).replace(
      /"consPref": \[\s+([\s\S]*?)\s+\]/g,
      (match, p1) => `"consPref": [${p1.replace(/\s+/g, '')}]`
    );
    const encodedContent = Buffer.from(newContent).toString('base64');

    // 3. Actualizar el archivo en GitHub
    const updateResponse = await fetch(fileUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Actualización de usuarios realizada desde ESPACIA.',
        content: encodedContent,
        sha: currentSha,
        branch: branch,
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ error: 'Error al actualizar el archivo en GitHub', details: error }),
      };
    }

    const updateResult = await updateResponse.json();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://espacia.netlify.app',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, message: 'Usuarios sincronizados con GitHub', commit: updateResult.commit.sha }),
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