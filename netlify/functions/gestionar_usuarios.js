const fs = require('fs');
const path = require('path');

// Usar solo un usuarios.json: en local en data/, en producción SIEMPRE en /tmp/data/
const pathProyecto = path.resolve(__dirname, '../../');
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = IS_PROD ? '/tmp/data' : path.join(pathProyecto, 'data');
const USUARIOS_PATH = path.join(DATA_DIR, 'usuarios.json');

exports.handler = async function(event, context) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Cuerpo inválido' })
    };
  }

  // Leer usuarios locales
  let usuariosLocales = {};
  if (fs.existsSync(USUARIOS_PATH)) {
    const parsed = JSON.parse(fs.readFileSync(USUARIOS_PATH, 'utf8'));
    if (Array.isArray(parsed)) {
      parsed.forEach(u => {
        const key = (u.tipdocu && u.documento) ? `${u.tipdocu}-${u.documento}` : u.email;
        usuariosLocales[key] = u;
      });
    } else {
      usuariosLocales = parsed;
    }
  }

  // Validar si el usuario que realiza la acción es admin
  // Si el rol es vacío, se considera 'usuario' (no admin)
  const rolSolicitante = body.solicitante && typeof body.solicitante.rol === 'string' && body.solicitante.rol.trim() !== ''
    ? body.solicitante.rol.trim()
    : 'usuario';
  const esAdmin = rolSolicitante === 'admin';

  // Alta de usuario (solo admin o automático en login)
  if (event.headers['x-netlify-event'] === 'signup') {
    const { email, user_metadata, auto_signup } = body;
    const nombre = user_metadata && user_metadata.full_name ? user_metadata.full_name : '';
    const rol = user_metadata && (user_metadata.role || user_metadata.roles) ? (user_metadata.role || user_metadata.roles) : '';
    // Verifica si ya existe
    const existe = Object.values(usuariosLocales).find(u => u.email === email);
    if (!existe) {
      // Si es admin o es alta automática (auto_signup=true), permite el alta
      if (esAdmin || auto_signup) {
        // Necesitamos tipdocu y documento para la clave, si no los tenemos, usamos email como fallback temporal
        const key = body.tipdocu && body.documento ? `${body.tipdocu}-${body.documento}` : email;
        usuariosLocales[key] = { email, nombre, rol, activo: true, tipdocu: body.tipdocu || '', documento: body.documento || '' };
      } else {
        return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden dar de alta usuarios.' }) };
      }
    } else {
      // Si ya existe, actualiza nombre y rol si vienen en el login y no están vacíos
      existe.activo = true; // Reactiva si estaba dado de baja
      if (nombre && nombre.trim() && nombre !== existe.nombre) {
        existe.nombre = nombre;
      }
      if (rol && rol.trim() && rol !== existe.rol) {
        existe.rol = rol;
      }
    }
  }

  // Baja lógica de usuario (solo admin)
  if (event.headers['x-netlify-event'] === 'delete') {
    if (!esAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden dar de baja usuarios.' }) };
    }
    const { email } = body;
    const usuario = Object.values(usuariosLocales).find(u => u.email === email);
    if (usuario) {
      usuario.activo = false;
    }
  }

  // Edición de usuario (solo admin)
  if (event.headers['x-netlify-event'] === 'edit') {
    if (!esAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden editar usuarios.' }) };
    }
    const { email, nombre, rol } = body;
    const usuario = Object.values(usuariosLocales).find(u => u.email === email);
    if (usuario) {
      if (nombre) usuario.nombre = nombre;
      if (rol) usuario.rol = rol;
    }
  }

  // Guardar usuarios
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const newContent = JSON.stringify(usuariosLocales, null, 2).replace(
    /"consPref": \[\s+([\s\S]*?)\s+\]/g,
    (match, p1) => `"consPref": [${p1.replace(/\s+/g, '')}]`
  );
  fs.writeFileSync(USUARIOS_PATH, newContent);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
