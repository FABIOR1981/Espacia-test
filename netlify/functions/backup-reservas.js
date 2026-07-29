const { google } = require('googleapis');
const fetch = require('node-fetch');
const { schedule } = require('@netlify/functions');

const backupHandler = async (event, context) => {
    // Proteger el endpoint (opcional, podrías requerir un token o una cabecera de seguridad si la llamas mediante un Cron)
    // El método suele ser POST si lo llamas de forma segura, o puede ejecutarse mediante Scheduled Functions de Netlify

    try {
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

        // Definir la zona horaria a utilizar (si no está definida en Netlify, forzamos Montevideo)
        const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';

        // Obtener la fecha y hora de AHORA pero ajustada a Montevideo
        const stringAhoraMVD = new Date().toLocaleString("en-US", { timeZone: zonaHoraria });
        const hoyMVD = new Date(stringAhoraMVD);
        
        // Calcular "ayer" con respecto a esa hora exacta
        const ayerMVD = new Date(hoyMVD);
        ayerMVD.setDate(ayerMVD.getDate() - 1);
        
        // Empieza a las 00:00:00 del día de ayer en Montevideo
        const timeMin = new Date(ayerMVD);
        timeMin.setHours(0, 0, 0, 0);

        // Termina a las 23:59:59.999 del día de ayer en Montevideo
        const timeMax = new Date(ayerMVD);
        timeMax.setHours(23, 59, 59, 999);

        // Construir la cadena en formato ISO con el offset para que Google Calendar entienda el rango
        // En Montevideo el offset es -03:00 todo el año
        const timeMinStr = timeMin.toISOString().replace('Z', '') + '-03:00';
        const timeMaxStr = timeMax.toISOString().replace('Z', '') + '-03:00';

        // Consultar a Google Calendar por las reservas
        const resList = await calendar.events.list({
            calendarId,
            timeMin: timeMinStr,
            timeMax: timeMaxStr,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            timeZone: zonaHoraria,
        });

        const eventosAyer = resList.data.items || [];

        // Opcionalmente, filtrar solo los útiles
        const reservas = eventosAyer.map(event => {
            let descriptionLimpia = event.description || "";
            // Si la descripción está definida, intentamos quitar escapes literales
            if (descriptionLimpia) {
                // Reemplazamos la etiqueta de Google si viene en HTML extra o solo dejamos el texto limpio
                // Reemplazamos los saltos de línea crudos y repetidos por un formato que facilite la lectura del array
                descriptionLimpia = descriptionLimpia.replace(/\\n/g, '\n').split('\n').filter(l => l.trim() !== "");
            }

            return {
                id: event.id,
                summary: event.summary,
                description: descriptionLimpia,  // Ahora será un array de líneas, mucho más legible en un JSON
                inicio: event.start.dateTime || event.start.date,
                fin: event.end.dateTime || event.end.date,
                estado: (event.summary && event.summary.startsWith('Cancelada')) ? 'cancelada' : 'efectuada'
            };
        });

        // Configuración para guardar el backup en GitHub en el repositorio BD
        const githubToken = process.env.GITHUB_TOKEN;
        const repo = "FABIOR1981/bd"; // Ajusta al nombre real si es diferente
        const branch = "main"; 
        
        // Nombre del archivo de respaldo, por ejemplo: reservas-2026-02-27.json
        // Extraer formato AAAA-MM-DD local a Montevideo, para evitar corrimientos por Z
        const yyyy = ayerMVD.getFullYear();
        const mm = String(ayerMVD.getMonth() + 1).padStart(2, '0');
        const dd = String(ayerMVD.getDate()).padStart(2, '0');
        const fechaStr = `${yyyy}-${mm}-${dd}`;
        
        const filePath = `espacia/backups/reservas-${fechaStr}.json`;

        if (!githubToken) {
            console.error("No GITHUB_TOKEN configured.");
            return { statusCode: 500, body: "Error interno: Faltan credenciales" };
        }

        const fileUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;

        // Preparar el contenido
        const contentJson = JSON.stringify({
            fechaDelBackup: new Date().toISOString(),
            fechaReservas: fechaStr,
            total: reservas.length,
            reservas: reservas
        }, null, 2);

        const encodedContent = Buffer.from(contentJson).toString('base64');

        // Subir a GitHub
        const updateResponse = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                Authorization: `token ${githubToken}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Automated backup: Reservas del ${fechaStr}`,
                content: encodedContent,
                branch: branch,
            }),
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`GitHub Api Error: ${errorText}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: `Backup de las reservas del ${fechaStr} creado exitosamente con ${reservas.length} eventos.` 
            })
        };

    } catch (error) {
        console.error("Error realizando el backup de reservas:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "No se pudo realizar el backup", details: error.message })
        };
    }
};

// Se ejecuta automáticamente todos los días a las 03:00 AM (Hora configurada por el servidor, expresado en cron pattern)
// "0 3 * * *" = A las 03:00 am todos los días 
exports.handler = schedule("0 3 * * *", backupHandler);
