const { google } = require('googleapis');
const { verifyToken } = require('./utils/jwthelper');

exports.handler = async (event) => {
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

    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Método no permitido' };
    
    const userToken = verifyToken(event);
    if (!userToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado. Token inválido o ausente.' }) };
    }

    try {
        const params = event.queryStringParameters || {};
        const { fechaInicio, fechaFin, consultorio, usuario, prefijoGcal } = params;
        const prefix = prefijoGcal || 'C';
        if (!fechaInicio || !fechaFin) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Debe indicar fechaInicio y fechaFin' }) };
        }
        let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }
        const subject = process.env.GOOGLE_IMPERSONATE_EMAIL || null;
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            null,
            privateKey,
            ['https://www.googleapis.com/auth/calendar'],
            subject
        );
        const calendar = google.calendar({ version: 'v3', auth });
        const calendarId = process.env.CALENDAR_ID;
        if (!calendarId) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar CALENDAR_ID en Netlify.' }) };
        }
        const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
        const eventsRes = await calendar.events.list({
            calendarId,
            timeMin: `${fechaInicio}T00:00:00-03:00`,
            timeMax: `${fechaFin}T23:59:59-03:00`,
            timeZone: zonaHoraria,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            fields: 'items(id,summary,description,start,end,colorId,created)'
        });
        let eventos = eventsRes.data.items || [];
        // Filtrar por consultorio(espacio) si se indica, pero siempre incluir bloqueos globales
        if (consultorio) {
            eventos = eventos.filter(ev => {
                if (!ev.summary) return false;
                // Incluir siempre bloqueos globales (C0 o Prefijo+0: Bloqueada)
                if (ev.summary.toUpperCase().startsWith(`${prefix.toUpperCase()}0: BLOQUEADA`)) return true;
                
                // Limpiar el posible prefijo "Cancelada - " para evaluar correctamente
                const summaryLimpio = ev.summary.replace(/^Cancelada\s*-\s*/i, '');

                // Buscar lista de espacios antes de los dos puntos (ej C1,C2,C3: o S1,S2:)
                const regexLista = new RegExp(`^((${prefix}\\d+,)*${prefix}\\d+):`, 'i');
                const m = summaryLimpio.match(regexLista);
                if (m) {
                    // Separar espacios
                    const espaciosArr = m[1].split(',').map(s => s.trim().toUpperCase());
                    return espaciosArr.includes(`${prefix.toUpperCase()}${consultorio}`);
                }
                // Fallback: buscar Prefijo+N: como antes
                return new RegExp(`^${prefix}${consultorio}:\\s`, 'i').test(summaryLimpio);
            });
        }
        // Si solicitan sólo la lista de usuarios, extraer nombre y email desde las descripciones
        if (params.listUsers) {
            const usersMap = new Map();
            eventos.forEach(ev => {
                if (!ev.description) return;
                // 1. Formato: Reserva realizada por: NOMBRE <email>
                let match = ev.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                if (match) {
                    const nombre = match[1].trim();
                    const email = match[2].trim();
                    if (!usersMap.has(email)) usersMap.set(email, { nombre, email });
                    return;
                }
                // 1b. Formato: Reserva para: NOMBRE <email> (reservado para...)
                match = ev.description.match(/Reserva para:\s*(.+?)\s*<([^>]+)>/);
                if (match) {
                    const nombre = match[1].trim();
                    const email = match[2].trim();
                    if (!usersMap.has(email)) usersMap.set(email, { nombre, email });
                    return;
                }
                // 2. Formato: Reserva realizada por: email
                match = ev.description.match(/Reserva realizada por: ([^\n@]+@[^\n]+)/);
                if (match) {
                    const email = match[1].trim();
                    if (!usersMap.has(email)) usersMap.set(email, { nombre: email, email });
                    return;
                }
                // 3. Formato: Reserva realizada por: Nombre (sin email)
                match = ev.description.match(/Reserva realizada por: ([^\n]+)/);
                if (match) {
                    const nombre = match[1].trim();
                    if (!usersMap.has(nombre)) usersMap.set(nombre, { nombre, email: nombre });
                }
            });
            const users = Array.from(usersMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
                // (log eliminado)
            return { statusCode: 200, body: JSON.stringify({ users }) };
        }
        // Filtrar por usuario si se indica
        if (usuario) {
            // Buscar por email, nombre completo o usuario (coincidencia exacta o parcial)
            const busqueda = usuario.trim().toLowerCase();
            eventos = eventos.filter(ev => {
                if (!ev.description) return false;
                // Buscar por email en varios formatos
                const match = ev.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                if (match) {
                    const nombre = match[1].trim().toLowerCase();
                    const email = match[2].trim().toLowerCase();
                    if (email.includes(busqueda) || nombre.includes(busqueda)) return true;
                } else {
                    // Buscar por "Reserva para: Nombre <email>"
                    const matchPara = ev.description.match(/Reserva para:\s*(.+?)\s*<([^>]+)>/);
                    if (matchPara) {
                        const nombre = matchPara[1].trim().toLowerCase();
                        const email = matchPara[2].trim().toLowerCase();
                        if (email.includes(busqueda) || nombre.includes(busqueda)) return true;
                    }
                    // Buscar por email simple
                    const matchEmail = ev.description.match(/Reserva realizada por: ([^\n@]+@[^\n]+)/);
                    if (matchEmail) {
                        const email = matchEmail[1].trim().toLowerCase();
                        if (email.includes(busqueda)) return true;
                    }
                    // Buscar por email en línea 'Email: ...'
                    const matchEmailLine = ev.description.match(/Email:\s*([^\s]+)/);
                    if (matchEmailLine) {
                        const email = matchEmailLine[1].trim().toLowerCase();
                        if (email.includes(busqueda)) return true;
                    }
                    // Buscar por nombre simple (también buscar en Reserva para)
                    const matchNombre = ev.description.match(/Reserva realizada por: ([^\n]+)/);
                    if (matchNombre) {
                        const nombre = matchNombre[1].trim().toLowerCase();
                        if (nombre.includes(busqueda)) return true;
                    }
                    const matchParaNombre = ev.description.match(/Reserva para:\s*([^\n<]+)/);
                    if (matchParaNombre) {
                        const nombre = matchParaNombre[1].trim().toLowerCase();
                        if (nombre.includes(busqueda)) return true;
                    }
                }
                return false;
            });
        }
        // Mapear a formato simple
        const resultado = eventos.map(ev => ({
            summary: ev.summary,
            start: ev.start && ev.start.dateTime,
            end: ev.end && ev.end.dateTime,
            description: ev.description,
            id: ev.id,
            created: ev.created || null  // Fecha/hora de creación del evento en Google Calendar
        }));

        // Filtrar bloqueos (C0:, C1: Bloqueada, etc) para que no sumen horas ni aparezcan en el informe final
        let eventosFiltrados = resultado.filter(ev => {
            if (!ev.summary) return true;
            return !ev.summary.toUpperCase().includes('BLOQUEADA');
        });

        // Calcular suma total de horas reservadas solo de reservas reales
        let totalHoras = 0;
        eventosFiltrados.forEach(ev => {
            if (ev.start && ev.end) {
                const inicio = new Date(ev.start);
                const fin = new Date(ev.end);
                const diffMs = fin - inicio;
                const diffHoras = diffMs / (1000 * 60 * 60);
                totalHoras += diffHoras;
            }
        });

        return { statusCode: 200, body: JSON.stringify({ reservas: eventosFiltrados, totalHoras }) };
    } catch (error) {
            // (log eliminado)
        return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
    }
};