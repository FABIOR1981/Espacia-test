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
                'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
            },
            body: '',
        };
    }

    const userToken = verifyToken(event);
    if (!userToken) {
        return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado. Token inválido o ausente.' }) };
    }

    if (event.httpMethod === 'POST') {
        try {
            const { email, nombre, consultorio, fecha, hora, minutos, intervalo, colorId, creadoPor, summary, prefijoGcal, etiquetaGeneral } = JSON.parse(event.body);
            const missing = [];
            if (!email) missing.push('email');
            if (!consultorio) missing.push('consultorio');
            if (!fecha) missing.push('fecha');
            if (!hora && hora !== 0) missing.push('hora');
            if (!colorId) missing.push('colorId');
            if (missing.length) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Datos faltantes o inválidos', missing, received: { email, consultorio, fecha, hora, colorId } }) };
            }

            // --- Restricción de fecha máxima para usuarios comunes ---
            let rol = userToken.rol || 'usuario';
            // Valores por defecto
            let maxSemanas = 12;
            let horasAntelacionConfig = 24;
            let reglaFinDeSemanaConfig = false;
            let adminMismoDiaHoraTope = "02:00"; // Hasta qué hora se considera "ayer" para un gestor

            // Leer configuraciones dinámicas de config.js (si está disponible)
            try {
                const fetch = require('node-fetch');
                // SI RENOMBRAS EL REPOSITORIO DE GITHUB, CAMBIAR AQUI TAMBIÉN
                const resp = await fetch(process.env.URL_CONFIG_JS || 'https://raw.githubusercontent.com/FABIOR1981/Espacia/main/js/config.js');
                if (resp.ok) {
                    const text = await resp.text();
                    
                    const matchSemanas = text.match(/maxSemanasReservaUsuario\s*:\s*(\d+)/);
                    if (matchSemanas) maxSemanas = parseInt(matchSemanas[1], 10);
                    
                    const matchHoras = text.match(/horasAntelacion\s*:\s*(\d+)/);
                    if (matchHoras) horasAntelacionConfig = parseInt(matchHoras[1], 10);
                    
                    const matchFds = text.match(/reglaFinDeSemana\s*:\s*(true|false)/);
                    if (matchFds) reglaFinDeSemanaConfig = matchFds[1] === 'true';
                }
            } catch (err) {
                console.warn('Error leyendo config.js remoto:', err.message);
            }

            // --- RESTRICCIÓN DE EVENTOS PASADOS PENSADA PARA EL BACKUP AUTOMÁTICO ---
            // Asegurar que solo el admin pueda crear eventos en el pasado.
            // Para Gestores o Usuarios, bloquear la creación de eventos si la fecha pertenece al pasado.
            if (rol !== 'admin') {
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                const fechaActualLocal = new Date(new Date().toLocaleString("en-US", { timeZone: zonaHoraria }));
                
                // Extraer el inicio de hoy a las 00:00:00 como límite estricto para usuarios comunes
                const hoyMismoBase = new Date(fechaActualLocal);
                hoyMismoBase.setHours(0, 0, 0, 0);
                
                // Fecha de la reserva solicitada
                const fechaReservaReq = new Date(`${fecha}T00:00:00`); 
                
                // Si la fecha solicitada es ANTERIOR a hoy, estamos retrocediendo en el tiempo
                if (fechaReservaReq < hoyMismoBase) {
                    let permitido = false;
                    
                    // Excepción Gestor: Si es GESTOR, y la reserva pedida es "ayer", 
                    // permite agendarla, pero SÓLO si la hora actual de hoy es ANTES de las 02:00 AM.
                    // Esto permite "cerrar" el período de ayer, salvando el backup automático a las 03:00.
                    if (rol === 'gestor') {
                        const ayer = new Date(hoyMismoBase);
                        ayer.setDate(ayer.getDate() - 1);
                        
                        // Si la reserva solicitada coincide exactamente con el día de "ayer"
                        if (fechaReservaReq.getTime() === ayer.getTime()) {
                            // ¿Es antes de las 02:00 AM de hoy?
                            const horaLimite = new Date(hoyMismoBase);
                            horaLimite.setHours(2, 0, 0, 0); // 02:00 AM
                            
                            if (fechaActualLocal < horaLimite) {
                                permitido = true; 
                            }
                        }
                    }

                    if (!permitido) {
                        return { statusCode: 400, body: JSON.stringify({ error: `La fecha solicitada es en el pasado o los plazos administrativos para cerrar la caja/reporte de esa fecha han vencido. Privilegios insuficientes.` }) };
                    }
                } 
                // Si la fecha solicitada es EXACTAMENTE hoy, bloqueamos agendar turnos anteriores a la hora/minuto actual
                else if (fechaReservaReq.getTime() === hoyMismoBase.getTime()) {
                    // Validamos específicamente contra los usuarios 'comunes'
                    if (rol === 'usuario') {
                        // Construimos la hora solicitada
                        const horaInicioStr = hora.toString().padStart(2, '0');
                        const minInicioStr = (minutos !== undefined ? minutos : 0).toString().padStart(2, '0');
                        
                        // Obtenemos qué hora/min es ahora mismo en MVD
                        const horaActual = fechaActualLocal.getHours();
                        const minutoActual = fechaActualLocal.getMinutes();

                        // Convertimos a minutos absolutos para comparar más fácil (ej. 14:30 = 870)
                        const minutosAbsolutosSolicitados = (parseInt(horaInicioStr, 10) * 60) + parseInt(minInicioStr, 10);
                        const minutosAbsolutosActuales = (horaActual * 60) + minutoActual;

                        // Si intenta agendar en un minuto MENOR al de ahora
                        if (minutosAbsolutosSolicitados < minutosAbsolutosActuales) {
                            return { statusCode: 400, body: JSON.stringify({ 
                                error: `El horario de ${horaInicioStr}:${minInicioStr} hs. ya ha pasado. Por favor, seleccione un horario posterior al actual.` 
                            }) };
                        }
                    }
                }
            }

            // Limitar a maxSemanas en el futuro para usuarios comunes
            if (rol !== 'admin') {
                const hoy = new Date();
                const fechaReserva = new Date(fecha);
                const maxFecha = new Date(hoy);
                maxFecha.setDate(maxFecha.getDate() + (maxSemanas * 7));
                if (fechaReserva > maxFecha) {
                    const numero = '091 001 334';
                    return { statusCode: 400, body: JSON.stringify({ error: `Para agendar con mayor antelación, por favor comuníquese con nuestra secretaría vía WhatsApp al ${numero}. Estamos para ayudarle.` }) };
                }
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
            // Calcular hora y minutos de inicio
            const horaInicio = hora.toString().padStart(2, '0');
            const minInicio = minutos !== undefined ? minutos.toString().padStart(2, '0') : '00';
            // Calcular fin según intervalo
            let duracion = intervalo ? parseInt(intervalo, 10) : 60;
            let fechaInicio = new Date(`${fecha}T${horaInicio}:${minInicio}:00-03:00`);
            // Sumar minutos manualmente para evitar errores de zona horaria
            let totalMinutos = parseInt(horaInicio, 10) * 60 + parseInt(minInicio, 10) + duracion;
            let horaFinManual = Math.floor(totalMinutos / 60);
            let minFinManual = totalMinutos % 60;
            // Si pasa de día, ajustar la fecha
            let fechaObj = new Date(fecha);
            let diaFin = fechaObj.getDate();
            let mesFin = fechaObj.getMonth() + 1;
            let anioFin = fechaObj.getFullYear();
            if (horaFinManual >= 24) {
                horaFinManual = horaFinManual % 24;
                // Sumar días
                let fechaTemp = new Date(fechaObj);
                fechaTemp.setDate(fechaTemp.getDate() + 1);
                diaFin = fechaTemp.getDate();
                mesFin = fechaTemp.getMonth() + 1;
                anioFin = fechaTemp.getFullYear();
            }
            const fechaFinStr = `${anioFin}-${mesFin.toString().padStart(2,'0')}-${diaFin.toString().padStart(2,'0')}T${horaFinManual.toString().padStart(2,'0')}:${minFinManual.toString().padStart(2,'0')}:00-03:00`;
            const calendarId = process.env.CALENDAR_ID;
            if (!calendarId) return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar CALENDAR_ID en Netlify.' }) };
            const sendUpdates = process.env.SEND_UPDATES === 'true';

            // Parámetros dinámicos para configuración Marca Blanca
            const prefix = prefijoGcal || 'C';
            const label = etiquetaGeneral || 'Consultorio';

            // Mostrar solo el nombre en la línea visible; el email se guarda en extendedProperties
            let descripcion = `Reserva para: ${nombre || email}\nEmail: ${email}\n${label}: ${consultorio}\nFecha: ${fecha}\nHora: ${horaInicio}:${minInicio} hs. Intervalo: ${duracion} min`;

            // Determinar nombre del creador: preferir el `creadoPor` enviado por el cliente,
            // pero si no viene, usar el nombre del token del usuario que hace la petición.
            let creadorNombre = '';
            if (creadoPor) {
                const m = creadoPor.match(/^(.*?)\s*</);
                creadorNombre = (m && m[1]) ? m[1].trim() : creadoPor;
            } else {
                creadorNombre = userToken.nombre || (email || '').split('@')[0];
            }
            // Añadir siempre la línea 'Reserva realizada por' (se guarda en el description visible)
            if (creadorNombre) {
                descripcion += `\n\nReserva realizada por: ${creadorNombre}`;
            }

            // Validar email para asistentes
            const cleanEmail = email ? email.trim() : '';

            const resourceBody = {
                summary: summary || `${prefix}${consultorio}: ${nombre || email}`,
                colorId: colorId,
                description: descripcion,
                extendedProperties: {
                    private: {
                        userEmail: cleanEmail || email
                    }
                },
                start: {
                    dateTime: `${fecha}T${horaInicio}:${minInicio}:00-03:00`,
                    timeZone: 'America/Montevideo'
                },
                end: {
                    dateTime: fechaFinStr,
                    timeZone: 'America/Montevideo'
                }
            };

            const insertOpts = {
                calendarId,
                resource: resourceBody
            }; 
            if (sendUpdates) insertOpts.sendUpdates = 'all';

            // Verificar disponibilidad antes de crear el evento
            const busySlots = await calendar.events.list({
                calendarId,
                timeMin: `${fecha}T${horaInicio}:${minInicio}:00-03:00`,
                timeMax: fechaFinStr,
                timeZone: 'America/Montevideo',
            });
            // Ignorar eventos que fueron marcados como 'Cancelada' (se mantienen para informes)
            // Filtrar solo eventos del espacio seleccionado (robusto a espacios y mayúsculas)
            const regexConsultorio = new RegExp(`^${prefix}${consultorio}:\\s`, 'i');
            const ocupantes = (busySlots.data.items || []).filter(ev => {
                if (ev.summary && ev.summary.startsWith('Cancelada')) return false;
                return ev.summary && regexConsultorio.test(ev.summary);
            });
            if (ocupantes.length > 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'El horario ya está ocupado.', ocupados: ocupantes.map(i => ({ id: i.id, summary: i.summary })) }) };
            }

            // Crear el evento
            let eventRes;
            try {
                eventRes = await calendar.events.insert(insertOpts);
            } catch (insertError) {
                // Google Calendar puede rechazar si hay conflicto de concurrencia real
                // En ese caso hacemos una segunda verificación para dar un mensaje claro
                try {
                    const recheck = await calendar.events.list({
                        calendarId,
                        timeMin: `${fecha}T${horaInicio}:${minInicio}:00-03:00`,
                        timeMax: fechaFinStr,
                        timeZone: 'America/Montevideo',
                    });
                    const ocupadoAhora = (recheck.data.items || []).filter(ev => {
                        if (ev.summary && ev.summary.startsWith('Cancelada')) return false;
                        return ev.summary && regexConsultorio.test(ev.summary);
                    });
                    if (ocupadoAhora.length > 0) {
                        return { statusCode: 409, body: JSON.stringify({ error: 'Este horario acaba de ser reservado por otro usuario. Por favor elegí otro.' }) };
                    }
                } catch {}
                return { statusCode: 500, body: JSON.stringify({ error: 'Error al crear la reserva', details: insertError.message }) };
            }
            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva creada correctamente', eventId: eventRes.data.id, created: eventRes.data.created || null }) };
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

    if (event.httpMethod === 'GET') {
        try {
            const { email, fecha, consultorio, all, prefijoGcal } = event.queryStringParameters || {};
            // Permitir all=1 solo para admin (demo: hardcodear email admin)
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@admin.com';
            if (all === '1') {
                // Solo permitir si el usuario es admin (en producción, validar JWT o cabecera auth)
                // Aquí, para demo, permitir si la petición viene de un navegador logueado como admin
                // (en producción, usar auth real)
                // Si quieres más seguridad, puedes validar por IP o cabecera especial
                // Aquí devolvemos todas las reservas activas
                let privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n');
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
                if (!calendarId) return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar CALENDAR_ID en Netlify.' }) };
                const now = new Date();
                const busySlots = await calendar.events.list({
                    calendarId,
                    timeMin: now.toISOString(),
                    maxResults: 2500,
                    singleEvents: true,
                    orderBy: 'startTime',
                    timeZone: 'America/Montevideo',
                });
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar solo eventos activos (no cancelados)
                const userEvents = busySlots.data.items.filter(event => {
                    return !(event.summary && event.summary.startsWith('Cancelada'));
                }).map(event => {
                    // Extraer consultorio(espacio), fecha, hora, nombre y email
                    let consultorio = '';
                    let fecha = '';
                    let hora = '';
                    let nombre = '';
                    let email = '';
                    let summary = event.summary || '';
                    if (event.summary) {
                        const prefixMatch = prefijoGcal || 'C';
                        const regex = new RegExp(`^${prefixMatch}(\\d+):`);
                        const match = event.summary.match(regex);
                        if (match) consultorio = match[1];
                    }
                    if (event.start && event.start.dateTime) {
                        const dt = new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria }));
                        fecha = dt.toISOString().slice(0,10);
                        hora = dt.getHours();
                    }
                    if (event.description) {
                        // Aceptar tanto 'Reserva realizada por: Nombre <email>' como 'Reserva realizada por: Nombre'
                        const m = event.description.match(/Reserva realizada por:\s*(.+?)(?:\s*<([^>]+)>)?/);
                        if (m) {
                            nombre = (m[1] || '').trim();
                            email = (m[2] || '').trim();
                        }
                        // Si no se obtuvo email, intentar con extendedProperties
                        if ((!email || !email.trim()) && event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.userEmail) {
                            email = event.extendedProperties.private.userEmail;
                        }
                    }
                    return {
                        eventId: event.id,
                        consultorio,
                        fecha,
                        hora,
                        nombre,
                        email,
                        summary
                    };
                });
                return { statusCode: 200, body: JSON.stringify({ userEvents }) };
            }
            if (!email && !fecha && !consultorio) {
                // Si no hay parámetros validos, retornar lista vacía para evitar errores 500/400 en llamadas espurias
                return { statusCode: 200, body: JSON.stringify({ horasDisponibles: [], ocupadasPorUsuario: [], userEvents: [] }) };
            }
            
            // Si el email es nulo (ej. llamada solo con fecha/consultorio), usar string vacía para evitar fallos abajo
            const emailBusqueda = email || '';

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
            if (!calendarId) return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar CALENDAR_ID en Netlify.' }) };
            // Si se pasa fecha y consultorio, mantener lógica anterior
            if (fecha && consultorio) {
                const busySlots = await calendar.events.list({
                    calendarId,
                    timeMin: `${fecha}T00:00:00-03:00`,
                    timeMax: `${fecha}T23:59:59-03:00`,
                    timeZone: 'America/Montevideo',
                });
                // Log de todos los eventos recuperados para el día
                // Obtener la zona horaria desde config.js o usar por defecto
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar solo eventos del consultorio seleccionado (robusto a espacios y mayúsculas)
                const prefixMatch2 = prefijoGcal || 'C';
                const regexConsultorio = new RegExp(`^${prefixMatch2}${consultorio}:\\s`, 'i');
                const eventosConsultorioAll = busySlots.data.items.filter(event => {
                    return event.summary && regexConsultorio.test(event.summary);
                });
                // Separar eventos activos (no cancelados) de los cancelados
                const eventosConsultorioActivos = eventosConsultorioAll.filter(ev => !(ev.summary && ev.summary.startsWith('Cancelada')));
                // Filtrar solo eventos ocupados por el usuario (activos) y mapear hora y eventId
                const userEvents = eventosConsultorioAll.filter(event => {
                    if (!event.description) return false;
                    const desc = event.description;
                    // Buscar por diferentes formatos donde puede aparecer el email del usuario
                    // Primero verificar si el evento tiene la propiedad privada con el email
                    const propEmail = event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.userEmail;
                    if (propEmail && emailBusqueda && propEmail.toLowerCase() === emailBusqueda.toLowerCase()) return !(event.summary && event.summary.startsWith('Cancelada'));
                    
                    if (!emailBusqueda) return false; // Si no hay email para filtrar, no es un evento "del usuario"
                    
                    // Mantener compatibilidad con formatos antiguos que incluían el email en la descripción
                    if (desc.includes(`Reserva realizada por: ${emailBusqueda}`)) return !(event.summary && event.summary.startsWith('Cancelada'));
                    if (desc.includes(`<${emailBusqueda}>`)) return !(event.summary && event.summary.startsWith('Cancelada'));
                    if (desc.includes(`Reserva para: ${emailBusqueda}`)) return !(event.summary && event.summary.startsWith('Cancelada'));
                    // regex: Reserva para: ... <email>
                    const mPara = desc.match(/Reserva para:\s*.+?<([^>]+)>/);
                    if (mPara && mPara[1] && mPara[1].trim().toLowerCase() === emailBusqueda.toLowerCase()) return !(event.summary && event.summary.startsWith('Cancelada'));
                    return false; 
                }).map(event => ({
                    hora: new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria })).getHours(),
                    eventId: event.id,
                    fecha,
                    consultorio
                }));
                // Generar todas las horas posibles del día
                const horas = Array.from({length: 24}, (_, i) => i);
                // Marcar como ocupadas solo las del usuario (activas)
                const ocupadasPorUsuario = userEvents.map(e => e.hora);
                // Horas ocupadas por cualquier persona en ese consultorio (solo activos)
                const ocupadasTodas = eventosConsultorioActivos.map(event => {
                    if (event.start && event.start.dateTime) {
                        return new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria })).getHours();
                    }
                    return null;
                }).filter(h => h !== null);
                const libres = horas.filter(h => !ocupadasTodas.includes(h));
                // Respuesta: solo horas libres o tomadas por el usuario
                const resultado = horas.filter(h => libres.includes(h) || ocupadasPorUsuario.includes(h));
                return { statusCode: 200, body: JSON.stringify({ horasDisponibles: resultado, ocupadasPorUsuario, userEvents }) };
            } else {
                // Si solo se pasa email, devolver todas las reservas activas del usuario
                const now = new Date();
                const busySlots = await calendar.events.list({
                    calendarId,
                    timeMin: now.toISOString(),
                    maxResults: 2500,
                    singleEvents: true,
                    orderBy: 'startTime',
                    timeZone: 'America/Montevideo',
                });
                const zonaHoraria = process.env.TIMEZONE || 'America/Montevideo';
                // Filtrar eventos del usuario
                const userEvents = busySlots.data.items.filter(event => {
                    if (!event.description) return false;
                    // Buscar por email exacto
                    // Preferir propiedad privada con el email (si existe)
                    const propEmail2 = event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.userEmail;
                    if (propEmail2 && propEmail2.toLowerCase() === (email || '').toLowerCase()) return true;
                    if (event.description.includes(`Reserva realizada por: ${email}`)) return true;
                    if (event.description.includes(`<${email}>`)) return true;
                    if (event.description.includes(`Reserva para: ${email}`)) return true;
                    // Buscar por nombre (si está en usuarios.json)
                    let nombreUsuario = ''; 
                    try {
                        // Cargar usuarios.json como archivo estático
                        const usuariosResp = require('node-fetch');
                        // NOTA: Esto es síncrono en Netlify, pero para robustez, podrías cachear el nombre en memoria
                    } catch {}
                    // Buscar por nombre extraído del email (antes de @)
                    const nombreEmail = email.split('@')[0].replace(/\./g, ' ');
                    if (event.description.includes(`Reserva realizada por: ${nombreEmail}`)) return true;
                    if (event.description.includes(`Reserva para: ${nombreEmail}`)) return true;
                    // Buscar por nombre+email (formato antiguo)
                    const regexNombreEmail = new RegExp(`Reserva realizada por: (.+?) ?<${email}>`);
                    if (regexNombreEmail.test(event.description)) return true;
                    const regexParaEmail = new RegExp(`Reserva para: (.+?) ?<${email}>`);
                    if (regexParaEmail.test(event.description)) return true;
                    return false;
                }).map(event => {
                    // Extraer consultorio, fecha, hora, nombre y email
                    let consultorio = '';
                    let fecha = '';
                    let hora = '';
                    let nombre = '';
                    let emailEvento = '';
                    let summary = event.summary || '';
                    if (event.summary) {
                        const match = event.summary.match(/^C(\d+):/);
                        if (match) consultorio = match[1];
                    }
                    if (event.start && event.start.dateTime) {
                        const dt = new Date(new Date(event.start.dateTime).toLocaleString('en-US', { timeZone: zonaHoraria }));
                        fecha = dt.toISOString().slice(0,10);
                        hora = dt.getHours();
                    }
                    if (event.description) {
                        // Extraer nombre y email si están presentes
                        const m = event.description.match(/Reserva realizada por: (.+?) <([^>]+)>/);
                        if (m) {
                            nombre = m[1].trim();
                            emailEvento = m[2].trim();
                        } else {
                            // Si solo hay email
                            const m2 = event.description.match(/Reserva realizada por: ([^@\s]+@[^\s]+)/);
                            if (m2) {
                                nombre = '';
                                emailEvento = m2[1].trim();
                            } else {
                                // Si solo hay nombre
                                const m3 = event.description.match(/Reserva realizada por: (.+)/);
                                if (m3) {
                                    nombre = m3[1].trim();
                                    emailEvento = '';
                                }
                            }
                        }
                    }
                    return {
                        eventId: event.id,
                        consultorio,
                        fecha,
                        hora,
                        nombre,
                        email: emailEvento,
                        summary
                    };
                });
                return { statusCode: 200, body: JSON.stringify({ userEvents }) };
            }
        } catch (error) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Error', details: error.message }) };
        }
    }

   if (event.httpMethod === 'DELETE') {
        try {
            // Extraemos solo el eventId del cuerpo. 
            // Ignoramos 'esAdmin' del cliente por seguridad.
            const { eventId, nombreUsuario: nombreNavegador } = JSON.parse(event.body);
            
            if (!eventId) {
                return { statusCode: 400, body: JSON.stringify({ error: 'Falta el ID del evento' }) };
            }

            // --- VALIDACIÓN DE SEGURIDAD BASADA EN TOKEN ---
            // El servidor decide si es admin basándose en el JWT, no en el JSON recibido
            const esAdmin = userToken.rol === 'admin' || userToken.rol === 'gestor';
            // Usar siempre la identidad provista por el JWT (userToken.nombre). No confiar en el nombre enviado por el cliente.
            const usuarioCancela = userToken.nombre ? userToken.nombre : 'Usuario';

            // debug: para confirmar quién está cancelando
            console.log('[reservar DELETE] userToken.nombre=', userToken.nombre, 'userToken.email=', userToken.email, 'esAdmin=', esAdmin, 'eventId=', eventId);

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
            if (!calendarId) return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar CALENDAR_ID.' }) };

            // Obtener el evento para validar política de cancelación y propiedad
            const eventRes = await calendar.events.get({ calendarId, eventId });
            const eventStart = new Date(eventRes.data.start.dateTime);
            const now = new Date();

            // Carga de configuración remota (se mantiene igual)
            let horasAntelacionConfig = 24;
            let reglaFinDeSemanaConfig = false;

            try {
                const fetch = require('node-fetch');
                const resp = await fetch(process.env.URL_CONFIG_JS || 'https://raw.githubusercontent.com/FABIOR1981/Espacia/main/js/config.js');
                if (resp.ok) {
                    const text = await resp.text();
                    const matchHoras = text.match(/horasAntelacion\s*:\s*(\d+)/);
                    if (matchHoras) horasAntelacionConfig = parseInt(matchHoras[1], 10);
                    const matchFds = text.match(/reglaFinDeSemana\s*:\s*(true|false)/);
                    if (matchFds) reglaFinDeSemanaConfig = matchFds[1] === 'true';
                }
            } catch (err) {
                console.warn('Error leyendo config.js remoto:', err.message);
            }
            
            let horasRequeridas = horasAntelacionConfig;
            if (reglaFinDeSemanaConfig && eventStart.getDay() === 1) { // Lunes
                horasRequeridas = horasAntelacionConfig + 48;
            }

            const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);
            
            if (hoursUntilEvent < 0) {
                return { statusCode: 400, body: JSON.stringify({ error: 'No puedes cancelar reservas que ya pasaron.' }) };
            }
            
            // VALIDACIÓN DE POLÍTICA: Solo se aplica a usuarios no admin
            if (hoursUntilEvent <= horasRequeridas && !esAdmin) {
                return { statusCode: 400, body: JSON.stringify({ error: `Política de cancelación: No puedes cancelar dentro de las ${horasRequeridas} horas antes.` }) };
            }
            
            // VALIDACIÓN DE PROPIEDAD: Si no es admin, debe ser el dueño
            if (!esAdmin) {
                const eventDesc = (eventRes.data.description || '').toLowerCase();
                const userEmail = (userToken.email || '').toLowerCase();
                
                const propEmail = eventRes.data.extendedProperties?.private?.userEmail;
                const matchProp = propEmail && propEmail.toLowerCase() === userEmail;
                
                const matchDesc = eventDesc.includes(`email: ${userEmail}`) || 
                                  eventDesc.includes(`<${userEmail}>`) || 
                                  eventDesc.includes(userEmail);
                                  
                if (!matchProp && !matchDesc) {
                    return { statusCode: 403, body: JSON.stringify({ error: 'No tienes permiso para cancelar esta reserva.' }) };
                }
            }

            // Actualizar el evento
            const nuevoTitulo = eventRes.data.summary.startsWith('Cancelada') ? eventRes.data.summary : `Cancelada - ${eventRes.data.summary}`;
            const fechaCancelacion = new Date().toLocaleString('es-UY', { timeZone: 'America/Montevideo' });
            
            let nuevaDescripcion = eventRes.data.description || '';
            // Forzar que se use el nombre desde el JWT (userToken.nombre) al registrar la cancelación
            nuevaDescripcion += `\nReserva Cancelada por: ${usuarioCancela} el ${fechaCancelacion}`;

            await calendar.events.patch({
                calendarId,
                eventId,
                resource: {
                    summary: nuevoTitulo,
                    colorId: '8', // Gris
                    description: nuevaDescripcion
                }
            });

            return { statusCode: 200, body: JSON.stringify({ message: 'Reserva marcada como cancelada por el servidor.' }) };

        } catch (error) {
            console.error('Error en DELETE:', error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Error interno', details: error.message }) };
        }
    }

    return { statusCode: 405, body: 'Método no permitido' };
};