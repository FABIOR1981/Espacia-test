const { google } = require('googleapis');
const { verifyToken } = require('./utils/jwthelper');

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
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const userToken = verifyToken(event);
    if (!userToken || (userToken.rol !== 'admin' && userToken.rol !== 'gestor')) {
        return { statusCode: 403, body: JSON.stringify({ error: 'No autorizado. Se requieren permisos de administrador.' }) };
    }

    try {
        const { fechaInicio, fechaFin, prefijoGcal } = event.queryStringParameters || {};
        const prefix = prefijoGcal || 'C';

        if (!fechaInicio || !fechaFin) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Faltan parámetros de fecha' }) };
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

        // Ajustar fechas para abarcar todo el día
        const timeMin = `${fechaInicio}T00:00:00-03:00`;
        const timeMax = `${fechaFin}T23:59:59-03:00`;

        const response = await calendar.events.list({
            calendarId,
            timeMin,
            timeMax,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: 'America/Montevideo',
        });

        let eventos = response.data.items || [];

        // Filtrar solo los eventos que están cancelados
        const cancelados = eventos.filter(ev => ev.summary && ev.summary.startsWith('Cancelada'));

        // Mapear a un formato útil para el frontend
        const resultado = cancelados.map(ev => {
            // Normalizador simple para comparar nombres sin acentos ni mayúsculas
            function _normalize(s){ return (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }

            // Extraer titular (Reserva para) desde description o summary
            let titular = '';
            if (ev.description) {
                const mTit = ev.description.match(/Reserva para:\s*([^\n<]+)/i);
                if (mTit) titular = mTit[1].trim();
            }
            if (!titular && ev.summary) {
                const mSum = ev.summary.match(new RegExp(`${prefix}\\d+:\\s*(.+)`, 'i'));
                if (mSum) titular = mSum[1].trim();
            }

            // Extraer quién canceló y cuándo de la descripción
            let cancelRaw = '';
            let fechaCancelacion = 'Desconocida';
            if (ev.description) {
                const match = ev.description.match(/Reserva Cancelada por:\s*(.+?) el (.+)/i);
                if (match) {
                    cancelRaw = match[1].trim();
                    fechaCancelacion = match[2].trim();
                }
            }

            // Determinar valor final para 'canceladoPor'
            let canceladoPor = 'Administración';
            if (cancelRaw) {
                const cancelName = (cancelRaw.match(/^(.+?)(?:\s*<|$)/) || [cancelRaw])[1].trim();
                if (titular && _normalize(cancelName) === _normalize(titular)) {
                    canceladoPor = titular;
                } else {
                    canceladoPor = 'Administración';
                }
            }

            // Extraer el consultorio(espacio) del título original
            let consultorio = 'N/A';
            const regexEspacio = new RegExp(`${prefix}(\\d+):`, 'i');
            const consMatch = ev.summary.match(regexEspacio);
            if (consMatch) {
                consultorio = consMatch[1];
            }

            return {
                id: ev.id,
                summary: ev.summary,
                start: ev.start && ev.start.dateTime,
                end: ev.end && ev.end.dateTime,
                description: ev.description,
                canceladoPor,
                fechaCancelacion,
                consultorio
            };
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://espacia.netlify.app'
            },
            body: JSON.stringify({ canceladas: resultado })
        };

    } catch (error) {
        console.error('Error en informe_canceladas:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
        };
    }
};
