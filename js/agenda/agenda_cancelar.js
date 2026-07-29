// js/agenda/agenda_cancelar.js
// Lógica de cancelación de reserva: extrae datos del description,
// construye el objeto Reserva completo y genera el ticket PDF.

import { APP_CONFIG } from '../config.js';
import { mostrarToast } from '../utils.js';

// Extrae todos los campos del description de Google Calendar
// Formato: "Reserva para: X\nEmail: Y\nConsultorio: C4\nFecha: 17/03/2026\nHora: 09:00 a 10:30 hs\nIntervalo: 90 min\n\nReserva realizada por: Z"
export function extraerDatosDescription(summary, description) {
    const prefijo  = APP_CONFIG.espacios?.prefijoGeneral || 'C';
    const etiqueta = APP_CONFIG.espacios?.etiquetaGeneral || 'Consultorio';

    const matchSummary   = summary.match(new RegExp(`^${prefijo}\\d+:\\s*(.+)`, 'i'));
    const matchEmail     = description.match(/Email:\s*([^\n]+)/);
    const matchFecha     = description.match(/Fecha:\s*([^\n]+)/);
    const matchHorario   = description.match(/Hora:\s*([\d:]+)\s*a\s*([\d:]+)\s*hs/);
    const matchHoraSimp  = description.match(/Hora:\s*([\d:]+)/);
    const matchIntervalo = description.match(/Intervalo:\s*(\d+)/);
    const matchEspacio   = description.match(new RegExp(`(?:Consultorio|${etiqueta}):\\s*([^\\n]+)`, 'i'));
    const matchCreadoPor = description.match(/Reserva realizada por:\s*([^\n]+)/);

    // Hora fin: desde el rango o calculada con el intervalo
    let horaInicio = matchHorario ? matchHorario[1] : (matchHoraSimp ? matchHoraSimp[1] : '');
    let horaFin    = matchHorario ? matchHorario[2] : '';
    if (!horaFin && horaInicio && matchIntervalo) {
        const [h, m] = horaInicio.split(':').map(Number);
        const fObj = new Date(2000, 0, 1, h, m);
        fObj.setMinutes(fObj.getMinutes() + parseInt(matchIntervalo[1]));
        horaFin = `${fObj.getHours().toString().padStart(2,'0')}:${fObj.getMinutes().toString().padStart(2,'0')}`;
    }

    // Normalizar espacio: "C4" → "Consultorio 4"
    let espacioDisplay = matchEspacio ? matchEspacio[1].trim() : '';
    if (espacioDisplay && espacioDisplay[0].toUpperCase() === prefijo.toUpperCase()) {
        espacioDisplay = etiqueta + ' ' + espacioDisplay.slice(1);
    }

    return {
        usuario:    matchSummary  ? matchSummary[1].trim()   : '',
        email:      matchEmail    ? matchEmail[1].trim()     : '',
        fecha:      matchFecha    ? matchFecha[1].trim()     : '',
        horaInicio,
        horaFin,
        intervalo:  matchIntervalo ? matchIntervalo[1]       : '',
        espacio:    espacioDisplay,
        creadoPor:  matchCreadoPor ? matchCreadoPor[1].trim(): ''
    };
}

export async function cancelarReserva({ id, summary, description, nombreUsuario, esAdmin, created, recargarGrilla, modal, btnConfirmar }) {
    try {
        const datos = extraerDatosDescription(summary, description);
        const { Reserva } = await import('../modelo/reserva.js');

        const reserva      = new Reserva();
        reserva.id         = id;
        reserva.usuario    = datos.usuario    || nombreUsuario;
        reserva.email      = datos.email;
        reserva.fecha      = datos.fecha;
        reserva.h_inicio   = datos.horaInicio;
        reserva.h_fin      = datos.horaFin;
        reserva.intervalo  = datos.intervalo;
        reserva.lugar      = datos.espacio;
        // No sobrescribir `creadoPor` cuando un admin cancela: conservar el valor original
        reserva.creadoPor  = datos.creadoPor || null;
        // Registrar quién ejecuta la cancelación
        reserva.canceladoPor  = nombreUsuario;
        reserva.fechaCreacion = created || null;

        const resp = await reserva.cancelar();
        if (resp.ok) {
            mostrarToast('✅ Reserva cancelada.', 'success');
            try {
                console.log("fechaCreacion:", reserva.fechaCreacion);
                await reserva.imprimirTicketCancelacion();
            } catch (e) { console.error('Error generando ticket cancelación:', e); }
            modal.remove();
            await recargarGrilla();
        } else {
            const err = await resp.json();
            mostrarToast('❌ Error: ' + (err.error || 'No se pudo cancelar'), 'error');
            btnConfirmar.disabled = false;
            btnConfirmar.innerText = 'Cancelar Reserva';
        }
    } catch (error) {
        console.error('Error en cancelarReserva:', error);
        mostrarToast('Error de conexión', 'error');
        btnConfirmar.disabled = false;
        btnConfirmar.innerText = 'Cancelar Reserva';
    }
}